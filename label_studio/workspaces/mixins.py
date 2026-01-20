
from typing import TYPE_CHECKING, Mapping, Optional

from core.redis import start_job_async_or_sync
from django.db.models import QuerySet
from django.utils.functional import cached_property
from projects.functions.utils import get_unique_ids_list

if TYPE_CHECKING:
    from users.models import User


class WorkSpaceMixin:


    def has_permission(self, user):
        """
        Dummy stub for has_permission
        """
        user.project = self  # link for activity log
        return True

