from projects.models import ProjectMember
from rest_framework import permissions
from rest_framework.permissions import BasePermission


class ProjectImportPermission(BasePermission):
    class IsProjectMember(permissions.BasePermission):
        def has_permission(self, request, view):
            project_id = view.kwargs.get('project_id')
            if not project_id:
                return False

            return ProjectMember.objects.filter(project_id=project_id, user=request.user).exists()

    class IsProjectManager(permissions.BasePermission):
        def has_permission(self, request, view):
            project_id = view.kwargs.get('pk')

            if not project_id:
                return False

            try:
                member = ProjectMember.objects.get(project_id=project_id, user=request.user)
                return member.role == ProjectMember.Role.PROJECT_MANAGER
            except ProjectMember.DoesNotExist:
                return False

    class IsReviewer(permissions.BasePermission):
        def has_permission(self, request, view):
            project_id = view.kwargs.get('pk')

            if not project_id:
                return False

            try:
                member = ProjectMember.objects.get(project_id=project_id, user=request.user)
                return member.role == ProjectMember.Role.REVIEWER
            except ProjectMember.DoesNotExist:
                return False
