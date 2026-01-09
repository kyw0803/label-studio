from django.apps import AppConfig


class WorkspaceConfig(AppConfig):
    name = 'workspaces'

    def ready(self):
        from . import rules  # noqa
