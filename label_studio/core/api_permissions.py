import logging

from rest_framework import permissions
from rest_framework.permissions import SAFE_METHODS, BasePermission

logger = logging.getLogger('django')


class HasViewClassPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        # Get the required permission from the view's permission_required attribute
        required_perm = getattr(view, 'permission_required', None)
        perm_name = getattr(required_perm, request.method, None)

        if not required_perm or not perm_name:
            return True

        if perm_name:
            has_perm_without_obj = request.user.has_perm(perm_name)
            logger.info(f'has_perm_without_obj: {has_perm_without_obj}')
            logger.info(f'authenticated: {request.user.is_authenticated}')
            if not has_perm_without_obj:
                return request.user.is_authenticated

            return has_perm_without_obj

        return False

    def has_object_permission(self, request, view, obj):
        # Get the required permission from the view's permission_required attribute
        required_perm = getattr(view, 'permission_required', None)
        logger.info(f'has object permission required_perm: {required_perm}')
        logger.info(f'has object permission request.method: {request.method}')
        # If no permission is required, deny access.
        if not required_perm:
            return True

        # Get the permission name for the current request method
        perm_name = getattr(required_perm, request.method, None)

        # If a permission is specified for this method, check it against the object
        if perm_name:
            return request.user.has_perm(perm_name, obj)

        # If no permission is specified for this method, deny access.
        return False


class HasObjectPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.has_permission(request.user)


class MemberHasOwnerPermission(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method not in SAFE_METHODS and not request.user.own_organization:
            return False

        return obj.has_permission(request.user)
