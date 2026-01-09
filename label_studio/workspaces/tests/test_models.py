from django.test import TestCase
from users.models import User
from workspaces.models import WorkSpace, WorkSpaceMember


class WorkSpaceModelTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(email='user1@example.com', password='password123')
        self.user2 = User.objects.create_user(email='user2@example.com', password='password123')
        self.workspace = WorkSpace.objects.create(title='Test Workspace')

    def test_add_member(self):
        """Test adding a member to workspace"""
        member, created = self.workspace.add_member(self.user1)
        self.assertTrue(created)
        self.assertEqual(member.member, self.user1)
        self.assertEqual(member.workspace, self.workspace)
        self.assertFalse(member.is_workspace_manager)

        # Add duplicate member
        member, created = self.workspace.add_member(self.user1)
        self.assertFalse(created)

    def test_delete_member(self):
        """Test removing a member from workspace"""
        self.workspace.add_member(self.user1)
        self.workspace.delete_member(self.user1)
        self.assertFalse(WorkSpaceMember.objects.filter(workspace=self.workspace, member=self.user1).exists())

    def test_delete_manager_raises_error(self):
        """Test that a workspace manager cannot be deleted via delete_member"""
        WorkSpaceMember.objects.create(workspace=self.workspace, member=self.user1, is_workspace_manager=True)

        # It should just exclude the manager and return empty queryset, which raises ValueError in current implementation
        with self.assertRaises(ValueError):
            self.workspace.delete_member(self.user1)

    def test_pass_managership(self):
        """Test transferring workspace ownership/managership"""
        # Setup: user1 is manager, user2 is member
        WorkSpaceMember.objects.create(workspace=self.workspace, member=self.user1, is_workspace_manager=True)
        WorkSpaceMember.objects.create(workspace=self.workspace, member=self.user2, is_workspace_manager=False)

        self.workspace.pass_managership(self.user1, self.user2)

        manager_qs = WorkSpaceMember.objects.filter(workspace=self.workspace, is_workspace_manager=True)
        self.assertEqual(manager_qs.count(), 1)
        self.assertEqual(manager_qs.first().member, self.user2)

    def test_pass_managership_invalid_cases(self):
        """Test invalid scenarios for transferring managership"""
        # Case 1: Transfer to self
        with self.assertRaisesMessage(ValueError, '자신에게 권한을 위임할 수 없습니다'):
            self.workspace.pass_managership(self.user1, self.user1)

        # Setup: user1 is manager, user2 is member
        WorkSpaceMember.objects.create(workspace=self.workspace, member=self.user1, is_workspace_manager=True)
        WorkSpaceMember.objects.create(workspace=self.workspace, member=self.user2, is_workspace_manager=False)

        # Case 2: Non-manager tries to pass
        with self.assertRaisesMessage(ValueError, '현재 사용자는 소유자가 아닙니다'):
            self.workspace.pass_managership(self.user2, self.user1)
