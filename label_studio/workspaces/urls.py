from django.urls import include, path

from . import api

app_name = 'workspaces'

# 내부 API URL 패턴 정의
_api_urlpatterns = [
    # 워크스페이스 목록 조회 및 생성
    path('', api.WorkSpaceListAPI.as_view(), name='workspace-list'),
    # 특정 워크스페이스 상세 조회, 수정, 삭제
    path('<int:pk>/', api.WorkSpaceAPI.as_view(), name='workspace-detail'),
    # 워크스페이스 멤버 관리
    path('<int:pk>/members/', api.WorkSpaceMemberListAPI.as_view(), name='workspace-members'),
    # 워크스페이스 초대 가능 멤버 조회
    path('<int:pk>/candidates/', api.WorkSpaceCandidateAPI.as_view(), name='workspace-candidates'),
]

urlpatterns = [
    # /api/workspaces/ 경로로 API 연결
    path('api/workspaces/', include((_api_urlpatterns, app_name), namespace='api')),
]
