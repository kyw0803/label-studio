from core.api_permissions import HasViewClassPermission
from core.permissions import ViewClassPermission, all_permissions
from django.utils.decorators import method_decorator
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser
from rest_framework.response import Response
from users.models import User
from users.serializers import UserSimpleSerializer
from workspaces.models import WorkSpace, WorkSpaceMember
from workspaces.serializers import WorkSpaceMemberSerializer, WorkSpaceSerializer


@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Workspaces'],
        summary='List workspaces',
        description='List all workspaces that the current user belongs to.',
    ),
)
@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Workspaces'],
        summary='Create workspace',
        description='Create a new workspace and assign the current user as the owner.',
    ),
)
class WorkSpaceListAPI(generics.ListCreateAPIView):
    serializer_class = WorkSpaceSerializer
    parser_classes = [JSONParser, FormParser]
    permission_classes = [HasViewClassPermission]
    permission_required = ViewClassPermission(
        GET=all_permissions.workspaces_view, POST=all_permissions.workspaces_create
    )

    def get_queryset(self):
        return self.request.user.workspaces.all()

    def perform_create(self, serializer):
        workspace = serializer.save()
        WorkSpaceMember.objects.create(workspace=workspace, member=self.request.user, is_workspace_manager=True)


@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Workspaces'],
        summary='Get workspace details',
        description='Retrieve detailed information about a specific workspace.',
    ),
)
@method_decorator(
    name='patch',
    decorator=extend_schema(
        tags=['Workspaces'],
        summary='Partial update workspace',
        description='Partially update workspace information.',
    ),
)
@method_decorator(
    name='delete',
    decorator=extend_schema(
        tags=['Workspaces'],
        summary='Delete workspace',
        description='Delete a specific workspace. Only the owner can perform this action.',
    ),
)
class WorkSpaceAPI(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = WorkSpaceSerializer
    parser_classes = [JSONParser, FormParser]
    permission_classes = [HasViewClassPermission]
    permission_required = ViewClassPermission(
        GET=all_permissions.workspaces_view,
        PUT=all_permissions.workspaces_change,
        PATCH=all_permissions.workspaces_change,
        DELETE=all_permissions.workspaces_delete,
    )

    def get_queryset(self):
        return self.request.user.workspaces.all()


@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Workspaces'],
        summary='List candidate workspace members',
        description='Retrieve a list of users from the organization who are not yet members of the workspace.',
        responses={200: UserSimpleSerializer(many=True)},
    ),
)
class WorkSpaceCandidateAPI(generics.ListAPIView):
    permission_classes = [HasViewClassPermission]
    permission_required = ViewClassPermission(GET=all_permissions.workspaces_view)
    serializer_class = UserSimpleSerializer

    def get_queryset(self):
        workspace = generics.get_object_or_404(WorkSpace, pk=self.kwargs['pk'])
        organization = self.request.user.active_organization
        return (
            User.objects.filter(organizations=organization).exclude(workspaces=workspace).distinct().order_by('email')
        )


# get: workspacemember 가져오기 post: workspace에 멤버 추가 delete: workspace 멤버 삭제 patch: workspace manager 권한 주기
@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Workspaces'],
        summary='List workspace members',
        description='Retrieve a list of members for a specific workspace.',
    ),
)
@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Workspaces'],
        summary='Add members to workspace',
        description='Add one or more users to the workspace.',
    ),
)
@method_decorator(
    name='patch',
    decorator=extend_schema(
        tags=['Workspaces'],
        summary='Update workspace member permissions',
        description='Update permissions (e.g., promote to manager) for selected workspace members.',
    ),
)
@method_decorator(
    name='delete',
    decorator=extend_schema(
        tags=['Workspaces'],
        summary='Remove members from workspace',
        description='Remove selected members from the workspace.',
    ),
)
class WorkSpaceMemberListAPI(generics.ListCreateAPIView):
    parser_classes = [JSONParser, FormParser]
    serializer_class = WorkSpaceMemberSerializer
    permission_classes = [HasViewClassPermission]
    permission_required = ViewClassPermission(
        GET=all_permissions.workspaces_view,
        POST=all_permissions.workspaces_change,
        PATCH=all_permissions.workspaces_change,
        DELETE=all_permissions.workspaces_change,
    )

    def get_queryset(self):
        workspace = generics.get_object_or_404(WorkSpace, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, workspace)
        return WorkSpaceMember.objects.filter(workspace=workspace).select_related('member')

    def post(self, request, *args, **kwargs):
        workspace = generics.get_object_or_404(WorkSpace, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, workspace)
        members_ids = request.data.get('member_ids', [])

        members = User.objects.filter(id__in=members_ids)
        for member in members:
            workspace.add_member(member)

        members = WorkSpaceMember.objects.filter(workspace=workspace, member__in=members).select_related('member')
        serializer = self.get_serializer(members, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def patch(self, request, *args, **kwargs):
        workspace = generics.get_object_or_404(WorkSpace, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, workspace)
        member_ids = request.data.get('member_ids', [])
        queryset = self.get_queryset().filter(member__in=member_ids)
        queryset.update(is_workspace_manager=True)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, *args, **kwargs):
        workspace = generics.get_object_or_404(WorkSpace, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, workspace)
        queryset = self.get_queryset()
        member_ids = request.data.get('member_ids', [])
        queryset.filter(member__in=member_ids).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
