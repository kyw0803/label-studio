import os
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase
from io_storages.localfiles.models import LocalFilesImportStorage, WorkspaceLocalFilesImportStorage
from io_storages.localfiles.serializers import WorkspaceLocalFilesImportStorageSerializer
from users.models import User
from workspaces.models import WorkSpace


class WorkspaceSerializerCreateTest(TestCase):
    def setUp(self):
        self.user = User.objects.create(email='test@test.com')
        self.workspace = WorkSpace.objects.create(title='Test Workspace', created_by=self.user)
        self.temp_dir = tempfile.mkdtemp()

        # 하위 디렉토리 생성
        os.makedirs(os.path.join(self.temp_dir, 'sub1'))
        os.makedirs(os.path.join(self.temp_dir, 'sub2'))

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    @patch('io_storages.localfiles.models.LocalFilesMixin.validate_connection')
    def test_create_generates_sub_storages(self, mock_validate):
        # validate_connection 통과시키기
        mock_validate.return_value = None

        data = {
            'path': self.temp_dir,
            'title': 'Workspace Root',
            'use_blob_urls': True,
            'workspace': self.workspace.id,
            'recursive_scan': True,
        }

        serializer = WorkspaceLocalFilesImportStorageSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        # create 호출
        instance = serializer.save()

        # 1. 부모 스토리지 생성 확인
        self.assertIsInstance(instance, WorkspaceLocalFilesImportStorage)
        # Windows Path 처리 고려하여 str 변환 비교
        self.assertEqual(str(Path(instance.path)), str(Path(self.temp_dir)))

        # 2. 하위 스토리지 생성 확인
        sub_storages = LocalFilesImportStorage.objects.filter(parent_storage=instance)
        self.assertEqual(sub_storages.count(), 2)

        sub_titles = sorted([s.title for s in sub_storages])
        self.assertEqual(sub_titles, ['sub1', 'sub2'])

        # 3. 속성 및 Path 객체 변환 확인
        for s in sub_storages:
            self.assertIsNone(s.project)  # project=None 확인
            self.assertEqual(s.recursive_scan, True)  # recursive_scan 상속 확인
            # path가 문자열로 저장되었는지 확인 (DB 필드는 TextField이므로 문자열이어야 함)
            self.assertIsInstance(s.path, str)
