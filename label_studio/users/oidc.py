import logging

from django.contrib.auth import get_user_model
from mozilla_django_oidc.auth import OIDCAuthenticationBackend
from organizations.models import Organization

# 로거 설정
logger = logging.getLogger('django')


class CustomOIDCAuthenticationBackend(OIDCAuthenticationBackend):
    def verify_token(self, token_response, **kwargs):
        # 1. 토큰 검증 로그
        logger.info('============== Verify Token Called ==============')

        # 2. 강제로 세션에 토큰 저장 시도
        request = kwargs.get('request')
        if request and isinstance(token_response, dict):
            access_token = token_response.get('access_token')
            refresh_token = token_response.get('refresh_token')
            id_token = token_response.get('id_token')

            if access_token:
                request.session['oidc_access_token'] = access_token
                logger.info('Saved oidc_access_token to session')

            if refresh_token:
                request.session['oidc_refresh_token'] = refresh_token
                logger.info('Saved oidc_refresh_token to session')

            if id_token:
                request.session['oidc_id_token'] = id_token
                logger.info('Saved oidc_id_token to session')

        return super().verify_token(token_response, **kwargs)

    def create_user(self, claims):
        """Keycloak 사용자 정보로 로컬 사용자 생성"""
        User = get_user_model()

        # 이메일 확인
        email = claims.get('email')
        if not email:
            logger.error('Email not found in OIDC claims')
            return None

        username = claims.get('preferred_username') or email.split('@')[0]

        first_name = claims.get('given_name', '')
        last_name = claims.get('family_name', '')

        try:
            user = User.objects.create_user(
                email=email,
                username=username,
                first_name=first_name,
                last_name=last_name,
            )
            user.save()

            # 조직 할당 (필수)
            self._assign_organization(user)

            return user

        except Exception as e:
            logger.error(f'Failed to create user: {e}')
            return None

    def update_user(self, user, claims):
        user.first_name = claims.get('given_name', user.first_name)
        user.last_name = claims.get('family_name', user.last_name)
        user.save()
        return user

    def _assign_organization(self, user):
        """사용자에게 조직 할당 (없으면 생성)"""
        if Organization.objects.exists():
            org = Organization.objects.first()
            if not org.has_user(user):
                org.add_user(user)
        else:
            # 조직이 하나도 없으면 새로 생성
            org = Organization.create_organization(created_by=user, title='Default Organization')

        user.active_organization = org
        user.save(update_fields=['active_organization'])
