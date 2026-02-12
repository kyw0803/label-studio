from django.contrib.auth import get_user_model
from io_storages.localfiles.api import AllocateStorageAPI, WorkspaceLocalStorageInSubStorageAPI
from io_storages.localfiles.models import LocalFilesImportStorage, WorkspaceLocalFilesImportStorage
from organizations.models import Organization
from projects.models import Project
from rest_framework import status
from rest_framework.test import APIRequestFactory, APITestCase
from workspaces.models import WorkSpace


class WorkspaceSubStorageAPITest(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email='test@example.com', password='password')
        self.organization = Organization.objects.create(title='Test Org', created_by=self.user)
        self.user.active_organization = self.organization
        self.user.save()

        self.client.force_authenticate(user=self.user)
        self.factory = APIRequestFactory()

        # 1. Create Workspace
        self.workspace_1 = WorkSpace.objects.create(title='Workspace 1')
        self.workspace_2 = WorkSpace.objects.create(title='Workspace 2')

        # 2. Create Parent Storage (Root Dataset)
        self.parent_storage_ws1 = WorkspaceLocalFilesImportStorage.objects.create(
            workspace=self.workspace_1, title='Root_Dataset_WS1', path='/data/ws1_root'
        )

        # 3. Create Sub Storages
        self.sub_storage_b = LocalFilesImportStorage.objects.create(
            parent_storage=self.parent_storage_ws1, title='B_Sub_Folder', path='/data/ws1_root/b_sub'
        )
        self.sub_storage_a = LocalFilesImportStorage.objects.create(
            parent_storage=self.parent_storage_ws1, title='A_Sub_Folder', path='/data/ws1_root/a_sub'
        )

        # 4. Create Project and assign to sub_storage_a
        self.project = Project.objects.create(
            title='Test Project', created_by=self.user, organization=self.organization
        )
        self.sub_storage_a.project = self.project
        self.sub_storage_a.save()

        # 5. Create storage in another workspace
        self.parent_storage_ws2 = WorkspaceLocalFilesImportStorage.objects.create(
            workspace=self.workspace_2, title='Root_Dataset_WS2', path='/data/ws2_root'
        )
        self.sub_storage_ws2 = LocalFilesImportStorage.objects.create(
            parent_storage=self.parent_storage_ws2, title='Other_Sub_Folder', path='/data/ws2_root/sub'
        )

    def test_list_sub_storages_by_workspace_with_ordering(self):
        """
        Test listing sub-storages for a specific workspace.
        """
        url = f'/api/storages/local/sub-storage/?workspace={self.workspace_1.id}'
        request = self.factory.get(url)
        request.user = self.user

        view = WorkspaceLocalStorageInSubStorageAPI.as_view()
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return both A and B
        self.assertEqual(len(response.data), 2)
        # Check ordering (title)
        self.assertEqual(response.data[0]['title'], 'A_Sub_Folder')
        self.assertEqual(response.data[1]['title'], 'B_Sub_Folder')

    def test_list_sub_storages_assigned_true(self):
        """
        Test 'assigned=true' filter.
        """
        url = f'/api/storages/local/sub-storage/?workspace={self.workspace_1.id}&assigned=true'
        request = self.factory.get(url)
        request.user = self.user

        view = WorkspaceLocalStorageInSubStorageAPI.as_view()
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.sub_storage_a.id)

    def test_list_sub_storages_assigned_false(self):
        """
        Test 'assigned=false' filter.
        """
        url = f'/api/storages/local/sub-storage/?workspace={self.workspace_1.id}&assigned=false'
        request = self.factory.get(url)
        request.user = self.user

        view = WorkspaceLocalStorageInSubStorageAPI.as_view()
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.sub_storage_b.id)

    def test_allocate_storage(self):
        """
        Test AllocateStorageAPI.
        """
        new_project = Project.objects.create(title='New Project', created_by=self.user, organization=self.organization)

        url = '/api/storages/local/allocate/'
        data = {'project': new_project.id, 'storage_ids': [self.sub_storage_b.id]}
        request = self.factory.post(url, data, format='json')
        request.user = self.user

        view = AllocateStorageAPI.as_view()
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated'], 1)

        self.sub_storage_b.refresh_from_db()
        self.assertEqual(self.sub_storage_b.project.id, new_project.id)

    def test_allocate_storage_multiple(self):
        """
        Test allocating multiple storages to a project.
        """
        new_project = Project.objects.create(
            title='New Project Multi', created_by=self.user, organization=self.organization
        )

        # Reset project for A
        self.sub_storage_a.project = None
        self.sub_storage_a.save()

        url = '/api/storages/local/allocate/'
        data = {'project': new_project.id, 'storage_ids': [self.sub_storage_a.id, self.sub_storage_b.id]}
        request = self.factory.post(url, data, format='json')
        request.user = self.user

        view = AllocateStorageAPI.as_view()
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated'], 2)

        self.sub_storage_a.refresh_from_db()
        self.sub_storage_b.refresh_from_db()
        self.assertEqual(self.sub_storage_a.project.id, new_project.id)
        self.assertEqual(self.sub_storage_b.project.id, new_project.id)

    def test_allocate_storage_missing_params(self):
        """
        Test AllocateStorageAPI with missing parameters.
        """
        url = '/api/storages/local/allocate/'

        # Missing project
        data = {'storage_ids': [self.sub_storage_b.id]}
        request = self.factory.post(url, data, format='json')
        request.user = self.user
        response = AllocateStorageAPI.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing storage_ids
        data = {'project': 1}
        request = self.factory.post(url, data, format='json')
        request.user = self.user
        response = AllocateStorageAPI.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_result_for_workspace_without_sub_storages(self):
        """
        Test empty result for workspace without sub storages.
        """
        empty_ws = WorkSpace.objects.create(title='Empty WS')
        WorkspaceLocalFilesImportStorage.objects.create(
            workspace=empty_ws, title='Empty_Root', path='/data/empty_root'
        )

        url = f'/api/storages/local/sub-storage/?workspace={empty_ws.id}'
        request = self.factory.get(url)
        request.user = self.user

        view = WorkspaceLocalStorageInSubStorageAPI.as_view()
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
