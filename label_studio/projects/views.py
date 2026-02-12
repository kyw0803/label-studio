"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import logging

from django.contrib.auth.decorators import login_required
from django.shortcuts import render

logger = logging.getLogger(__name__)


# @login_required  # 일시적으로 주석 처리 (디버깅용)
def project_list(request):
    # request 객체의 모든 관련 속성 확인
    logger.error('DEBUG: [project_list] View reached!')
    logger.error(f'DEBUG: [project_list] request.user: {request.user} (type: {type(request.user)})')
    logger.error(f'DEBUG: [project_list] request.user.is_authenticated: {request.user.is_authenticated}')
    logger.error(f'DEBUG: [project_list] request.session.session_key: {request.session.session_key}')
    logger.error(f"DEBUG: [project_list] request.session.get('_auth_user_id'): {request.session.get('_auth_user_id')}")
    logger.error(f"DEBUG: [project_list] request.COOKIES.get('sessionid'): {request.COOKIES.get('sessionid')}")
    logger.error(f"DEBUG: [project_list] hasattr(request, '_cached_user'): {hasattr(request, '_cached_user')}")
    if hasattr(request, '_cached_user'):
        logger.error(f'DEBUG: [project_list] request._cached_user: {request._cached_user}')

    # 세션 객체 상태 확인
    logger.error(f'DEBUG: [project_list] request.session type: {type(request.session)}')
    logger.error(
        f"DEBUG: [project_list] request.session._session_key: {getattr(request.session, '_session_key', 'NO ATTR')}"
    )
    logger.error(f'DEBUG: [project_list] request.session.modified: {request.session.modified}')
    logger.error(
        f"DEBUG: [project_list] request.session._session_cache: {getattr(request.session, '_session_cache', 'NO ATTR')}"
    )

    # _cached_user가 있으면 강제로 request.user에 설정
    if hasattr(request, '_cached_user') and request._cached_user:
        logger.error('DEBUG: [project_list] Setting request.user from _cached_user')
        request.user = request._cached_user

    logger.error(
        f'DEBUG: [project_list] After fix - request.user: {request.user}, authenticated: {request.user.is_authenticated}'
    )

    if not request.user.is_authenticated:
        logger.error('DEBUG: [project_list] User NOT authenticated, redirecting')
        from django.conf import settings
        from django.contrib.auth.views import redirect_to_login

        return redirect_to_login(request.get_full_path(), settings.LOGIN_URL)

    logger.error('DEBUG: [project_list] User authenticated, rendering template')
    return render(request, 'projects/list.html')


@login_required
def project_settings(request, pk, sub_path):
    return render(request, 'projects/settings.html')
