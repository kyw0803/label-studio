from django.conf import settings
from django.db import models, transaction
from workspaces.mixins import WorkSpaceMixin


class WorkSpaceMember(models.Model):
    workspace = models.ForeignKey('WorkSpace', on_delete=models.CASCADE, related_name='memberships')
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='workspace_memberships'
    )
    is_workspace_manager = models.BooleanField(default=False)

    def members_count(self):
        return WorkSpaceMember.objects.filter(workspace=self.workspace).count()


class WorkSpace(WorkSpaceMixin, models.Model):
    title = models.CharField(max_length=100, null=False, blank=False, unique=True)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='workspaces', through=WorkSpaceMember)
    # organization = models.ForeignKey('organizations.Organization', on_delete=models.CASCADE, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)  # TODO null=True 지우기
    deleted_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    def add_member(self, user):
        member, created = WorkSpaceMember.objects.get_or_create(member=user, workspace=self)
        return member, created

    def delete_member(self, user):
        membership = WorkSpaceMember.objects.exclude(is_workspace_manager=True).filter(member=user, workspace=self)

        if not membership:
            raise ValueError('This member has no membership')

        membership.delete()

    # workspace 권한 위임
    def pass_managership(self, workspace_manager, will_workspace_manager):
        if workspace_manager == will_workspace_manager:
            raise ValueError('자신에게 권한을 위임할 수 없습니다.')

        with transaction.atomic():
            try:
                members = WorkSpaceMember.objects.select_for_update().filter(
                    workspace=self, member__in=[workspace_manager, will_workspace_manager]
                )
                current_owner_membership = members.get(member=workspace_manager)
                next_owner_membership = members.get(member=will_workspace_manager)

            except WorkSpaceMember.DoesNotExist:
                raise ValueError('멤버가 존재하지 않습니다.')

            if not current_owner_membership.is_workspace_manager:
                raise ValueError('현재 사용자는 소유자가 아닙니다.')

            if next_owner_membership.is_workspace_manager:
                raise ValueError('대상은 이미 소유자입니다.')

            current_owner_membership.is_workspace_manager = False
            next_owner_membership.is_workspace_manager = True

            current_owner_membership.save(update_fields=['is_workspace_manager'])
            next_owner_membership.save(update_fields=['is_workspace_manager'])

    class Meta:
        db_table = 'workspaces'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['title']),
        ]
