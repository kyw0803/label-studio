from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from users.models import User
from workspaces.models import WorkSpace, WorkSpaceMember


class WorkSpaceAPITests(APITestCase):
    def setUp(self):
        self.user_manager = User.objects.create_user(email='manager@example.com', password='password123')
        self.user_member = User.objects.create_user(email='member@example.com', password='password123')
        self.user_outsider = User.objects.create_user(email='outsider@example.com', password='password123')

        self.workspace = WorkSpace.objects.create(title='Test Workspace')

        # Setup Memberships
        WorkSpaceMember.objects.create(workspace=self.workspace, member=self.user_manager, is_workspace_manager=True)
        WorkSpaceMember.objects.create(workspace=self.workspace, member=self.user_member, is_workspace_manager=False)

    def test_list_workspaces(self):
        """Test listing workspaces for authenticated user"""
        self.client.force_authenticate(user=self.user_member)
        url = reverse('workspaces:api:workspace-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Test Workspace')

    def test_create_workspace(self):
        """Test creating a new workspace"""
        self.client.force_authenticate(user=self.user_member)
        url = reverse('workspaces:api:workspace-list')
        data = {'title': 'New Workspace'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WorkSpace.objects.count(), 2)
        # Check if creator became manager
        new_ws = WorkSpace.objects.get(title='New Workspace')
        self.assertTrue(
            WorkSpaceMember.objects.filter(
                workspace=new_ws, member=self.user_member, is_workspace_manager=True
            ).exists()
        )

    def test_get_workspace_detail_permission(self):
        """Test retrieve permission: Member vs Outsider"""
        url = reverse('workspaces:api:workspace-detail', kwargs={'pk': self.workspace.pk})

        # Member should succeed
        self.client.force_authenticate(user=self.user_member)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Outsider should fail (404 or 403 depending on implementation, usually 403 if found but denied)
        # But since queryset filters by user.workspaces, outsider gets 404 because it's not in their queryset
        self.client.force_authenticate(user=self.user_outsider)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_workspace_permission(self):
        """Test update permission: Manager vs Member"""
        url = reverse('workspaces:api:workspace-detail', kwargs={'pk': self.workspace.pk})
        data = {'title': 'Updated Title'}

        # Member should fail (403 Forbidden)
        self.client.force_authenticate(user=self.user_member)
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Manager should succeed
        self.client.force_authenticate(user=self.user_manager)
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.workspace.refresh_from_db()
        self.assertEqual(self.workspace.title, 'Updated Title')

    def test_add_member_permission(self):
        """Test adding members: Manager only"""
        url = reverse('workspaces:api:workspace-members', kwargs={'pk': self.workspace.pk})
        data = {'member_ids': [self.user_outsider.id]}

        # Member fails
        self.client.force_authenticate(user=self.user_member)
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Manager succeeds
        self.client.force_authenticate(user=self.user_manager)
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(WorkSpaceMember.objects.filter(workspace=self.workspace, member=self.user_outsider).exists())

    def test_promote_member_to_manager(self):
        """Test promoting a member to manager (PATCH)"""
        url = reverse('workspaces:api:workspace-members', kwargs={'pk': self.workspace.pk})
        data = {'member_ids': [self.user_member.id], 'is_workspace_manager': True}

        # Manager promotes member
        self.client.force_authenticate(user=self.user_manager)
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify promotion
        membership = WorkSpaceMember.objects.get(workspace=self.workspace, member=self.user_member)
        self.assertTrue(membership.is_workspace_manager)
