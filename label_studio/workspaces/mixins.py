from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass


class WorkSpaceMixin:
    def has_permission(self, user):
        """
        Dummy stub for has_permission
        """
        user.project = self  # link for activity log
        return True
