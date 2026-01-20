import rules
from core.permissions import make_perm
from workspaces.models import WorkSpaceMember


# Predicates
@rules.predicate
def is_workspace_manager(user, workspace=None):
    """
    Check if user is a manager of the workspace
    """
    if workspace is None:
        return False

    if not hasattr(workspace, 'members'):
        return False

    return WorkSpaceMember.objects.filter(member=user, workspace=workspace, is_workspace_manager=True).exists()


@rules.predicate
def is_workspace_member(user, workspace=None):
    """
    Check if user is a member of the workspace
    """
    if workspace is None:
        return False

    if not hasattr(workspace, 'members'):
        return False

    return WorkSpaceMember.objects.filter(member=user, workspace=workspace).exists()


# Register and overwrite permissions using set_perm
make_perm('workspaces.view', is_workspace_member, overwrite=True)
make_perm('workspaces.change', is_workspace_manager, overwrite=True)
make_perm('workspaces.delete', is_workspace_manager, overwrite=True)
make_perm('workspaces.create', rules.is_authenticated, overwrite=True)
