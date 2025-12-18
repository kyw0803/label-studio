from django.conf import settings
from django.db import models


class WorkSpaceMember(models.Model):
    workspace = models.ForeignKey('WorkSpace', on_delete=models.CASCADE, related_name='memberships')
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='workspace_memberships'
    )


class WorkSpace(models.Model):
    title = models.CharField(max_length=100, null=False, blank=False, unique=True)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='workspace', through=WorkSpaceMember)
