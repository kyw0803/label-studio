"""Projects Django App Configuration"""

import logging

from django.apps import AppConfig
from django.db.models.signals import post_migrate

logger = logging.getLogger(__name__)


def create_role(sender, **kwargs):
    from projects.models import Role

    for role in Role.RoleChoices:
        Role.objects.get_or_create(role_name=role)


class ProjectsConfig(AppConfig):
    name = 'projects'

    def ready(self):
        post_migrate.connect(create_role, sender=self)
