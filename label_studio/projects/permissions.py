import rules

from projects.models import ProjectMember, Role
@rules.predicate
def is_project_member(user, project=None):

    if project is None:
        return False

    return ProjectMember.objects.filter(user=user, project=project).exists()

@rules.predicate
def is_project_reviewer(user, project=None):
    if project is None:
        return False

    project_member = ProjectMember.objects.get(user=user, project=project)
    return Role.objects.get(role_name='project_reviewer') == project_member.role

@rules.predicate
def is_project_manager(user, project=None):
    if project is None:
        return False

    project_member = ProjectMember.objects.get(user=user, project=project)

    return Role.objects.get(role_name='project_manager') == project_member.role


make_perm('project.member')


