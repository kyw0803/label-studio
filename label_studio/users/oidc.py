import logging

from django.contrib.auth import get_user_model
from mozilla_django_oidc.auth import OIDCAuthenticationBackend
from mozilla_django_oidc.views import OIDCAuthenticationCallbackView

from organizations.models import Organization

# 로거 설정 (잘 보이게 django 로거 사용)
logger = logging.getLogger('django')


class CustomOIDCAuthenticationBackend(OIDCAuthenticationBackend):

    def get_token(self, payload):
        """Step 1: Authorization Code로 Token 교환"""
        logger.error("DEBUG: 1. get_token called")
        try:
            token_info = super().get_token(payload)
            self.request.oidc_tokens = token_info
            logger.error(f"DEBUG: 1. Token retrieved successfully. Keys: {token_info.keys() if token_info else 'None'}")
            return token_info
        except Exception as e:
            logger.error(f"DEBUG: 1. get_token FAILED: {e}")
            raise e

    def verify_token(self, token, **kwargs):
        """Step 2: Token 서명 및 유효성 검증"""
        logger.error("DEBUG: 2. verify_token called")
        try:
            # 부모 클래스의 verify_token 호출 (여기서 RS256 서명 검증 수행)
            payload = super().verify_token(token, **kwargs)
            if payload:
                logger.error(f"DEBUG: 2. Token verified. Email in payload: {payload.get('email')}")
            else:
                logger.error("DEBUG: 2. Token verification returned None (Validation Failed)")
            return payload
        except Exception as e:
            logger.error(f"DEBUG: 2. verify_token FAILED (Exception): {e}")
            return None

    def filter_users_by_claims(self, claims):
        """Step 3: 유저 조회"""
        email = claims.get('email')
        logger.error(f"DEBUG: 3. filter_users_by_claims called. Email: {email}")
        if not email:
            logger.error("DEBUG: 3. Email MISSING in claims!")

        users = super().filter_users_by_claims(claims)
        logger.error(f"DEBUG: 3. Users found: {list(users)}")
        return users

    def create_user(self, claims):
        """Step 4: 유저 생성 (DB에 없을 경우)"""
        logger.error("DEBUG: 4. create_user called")
        User = get_user_model()

        email = claims.get('email')
        if not email:
            logger.error('DEBUG: 4. Email not found in OIDC claims')
            return None

        username = claims.get('preferred_username') or email.split('@')[0]
        first_name = claims.get('given_name', '')
        last_name = claims.get('family_name', '')

        try:
            logger.error(f"DEBUG: 4. Attempting to create user: {email}")
            user = User.objects.create_user(
                email=email,
                username=username,
                first_name=first_name,
                last_name=last_name,
            )
            user.save()
            logger.error(f"DEBUG: 4. User created successfully: {user.email} (ID: {user.id})")

            # 조직 할당 (필수)
            self._assign_organization(user)
            return user

        except Exception as e:
            logger.error(f'DEBUG: 4. Failed to create user: {e}')
            return None

    def update_user(self, user, claims):
        """Step 4-2: 기존 유저 업데이트"""
        logger.error(f"DEBUG: 4. update_user called for {user.email}")
        user.first_name = claims.get('given_name', user.first_name)
        user.last_name = claims.get('family_name', user.last_name)
        user.save()

        # 기존 유저도 조직 할당 확인
        if not user.active_organization:
            logger.error(f"DEBUG: Assigning organization to existing user: {user.email}")
            self._assign_organization(user)

        return user

    def _assign_organization(self, user):
        if Organization.objects.exists():
            org = Organization.objects.first()
            if not org.has_user(user):
                org.add_user(user)
        else:
            org = Organization.create_organization(created_by=user, title='Default Organization')

        user.active_organization = org
        user.save(update_fields=['active_organization'])
class CustomOIDCAuthenticationCallbackView(OIDCAuthenticationCallbackView):
    def login_success(self):
        logger.error('DEBUG: 5. login_success view called')
        logger.error(f"DEBUG: [BEFORE super] Session Key: {self.request.session.session_key}")

        # 부모 클래스의 login_success 호출 (auth.login + 리다이렉트 처리)
        response = super().login_success()
        
        logger.error(f"DEBUG: [AFTER super] Session Key: {self.request.session.session_key}")
        logger.error(f"DEBUG: [AFTER super] User: {self.request.user}")
        logger.error(f"DEBUG: [AFTER super] User is_authenticated: {self.request.user.is_authenticated}")

        # [중요] 세션을 명시적으로 저장하여 쿠키가 포함되도록 함
        # auth.login()이 세션을 수정했으므로 저장해야 함
        self.request.session.save()
        logger.error(f"DEBUG: [AFTER save] Session Key: {self.request.session.session_key}")
        logger.error(f"DEBUG: [AFTER save] Session modified: {self.request.session.modified}")

        # 토큰 저장 (선택사항)
        if hasattr(self.request, 'oidc_tokens'):
            tokens = self.request.oidc_tokens
            if 'access_token' in tokens:
                self.request.session['access_token'] = tokens['access_token']
            if 'refresh_token' in tokens:
                self.request.session['refresh_token'] = tokens['refresh_token']
            if 'id_token' in tokens:
                self.request.session['id_token'] = tokens['id_token']
            # 토큰 저장으로 인해 세션 수정됨
            self.request.session.modified = True
            self.request.session.save()
            logger.error(f"DEBUG: [AFTER token save] Session Key: {self.request.session.session_key}")

        # 응답에 세션 쿠키가 포함되도록 확인
        # 세션 미들웨어가 process_response에서 처리하지만, 명시적으로 확인
        from django.conf import settings
        from django.utils.http import http_date
        from django.utils import timezone
        from datetime import timedelta
        
        if self.request.session.session_key:
            # 세션 쿠키 설정
            max_age = settings.SESSION_COOKIE_AGE
            expires = timezone.now() + timedelta(seconds=max_age)
            cookie_value = self.request.session.session_key
            
            # 쿠키 설정
            response.set_cookie(
                settings.SESSION_COOKIE_NAME,
                cookie_value,
                max_age=max_age,
                expires=expires,
                domain=settings.SESSION_COOKIE_DOMAIN,
                path=settings.SESSION_COOKIE_PATH,
                secure=settings.SESSION_COOKIE_SECURE,
                httponly=settings.SESSION_COOKIE_HTTPONLY,
                samesite=settings.SESSION_COOKIE_SAMESITE,
            )
            logger.error(f"DEBUG: [MANUAL Set-Cookie] Session cookie set: {cookie_value}")

        return response

    def get_success_url(self):
        # 무조건 프로젝트 목록으로 리다이렉트
        return '/projects/'

    def login_failure(self):
        logger.error("============== DEBUG: OIDC Login FAILED! (login_failure called) ==============")
        return super().login_failure()

