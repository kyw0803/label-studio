"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""

import logging

from django.utils.decorators import method_decorator
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from io_storages.api import (
    ExportStorageDetailAPI,
    ExportStorageFormLayoutAPI,
    ExportStorageListAPI,
    ExportStorageSyncAPI,
    ExportStorageValidateAPI,
    ImportStorageDetailAPI,
    ImportStorageFormLayoutAPI,
    ImportStorageListAPI,
    ImportStorageSyncAPI,
    ImportStorageValidateAPI,
)
from io_storages.localfiles.models import (
    LocalFilesExportStorage,
    LocalFilesImportStorage,
    WorkspaceLocalFilesImportStorage,
)
from io_storages.localfiles.serializers import (
    LocalFilesExportStorageSerializer,
    LocalFilesImportStorageSerializer,
    WorkspaceLocalFilesImportStorageSerializer,
)
from rest_framework import generics
from rest_framework.response import Response

from .openapi_schema import (
    _local_files_export_storage_schema,
    _local_files_export_storage_schema_with_id,
    _local_files_import_storage_schema,
    _local_files_import_storage_schema_with_id,
)

logger = logging.getLogger('django')


@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Get all import storage',
        description='Get a list of all local file import storage connections.',
        parameters=[
            OpenApiParameter(
                name='project',
                type=OpenApiTypes.INT,
                location='query',
                description='Project ID',
                required=True,
            ),
        ],
        request=None,
        extensions={
            'x-fern-sdk-group-name': ['import_storage', 'local'],
            'x-fern-sdk-method-name': 'list',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Create import storage',
        description='Create a new local file import storage connection.',
        request={
            'application/json': _local_files_import_storage_schema,
        },
        extensions={
            'x-fern-sdk-group-name': ['import_storage', 'local'],
            'x-fern-sdk-method-name': 'create',
            'x-fern-audiences': ['public'],
        },
    ),
)
class LocalFilesImportStorageListAPI(ImportStorageListAPI):
    queryset = LocalFilesImportStorage.objects.all()
    serializer_class = LocalFilesImportStorageSerializer

    def get_serializer_class(self):
        if 'workspace' in self.request.query_params or 'workspace' in self.request.data:
            return WorkspaceLocalFilesImportStorageSerializer
        return LocalFilesImportStorageSerializer

    def get_queryset(self):
        if 'workspace' in self.request.query_params:
            self.serializer_class = WorkspaceLocalFilesImportStorageSerializer
        return super().get_queryset()


class WorkspaceLocalStorageInSubStorageAPI(generics.ListAPIView):
    serializer_class = LocalFilesImportStorageSerializer

    def get_queryset(self):
        workspace_pk = self.request.query_params.get('workspace')
        assigned = self.request.query_params.get('assigned')

        logger.debug(f'WorkspaceLocalStorageInSubStorageAPI: workspace={workspace_pk}, assigned={assigned}')

        queryset = LocalFilesImportStorage.objects.filter(parent_storage__workspace=workspace_pk).order_by('title')
        logger.debug(f'Initial queryset count: {queryset.count()}')

        if assigned == 'false':
            queryset = queryset.filter(project__isnull=True)
            logger.debug(f'Filtered (unassigned) count: {queryset.count()}')
            return queryset
        elif assigned == 'true':
            queryset = queryset.filter(project__isnull=False)
            return queryset

        return queryset


class AllocateStorageAPI(generics.GenericAPIView):
    serializer_class = LocalFilesImportStorageSerializer

    def post(self, request, *args, **kwargs):
        project_id = request.data.get('project')
        storage_ids = request.data.get('storage_ids', [])

        if not project_id:
            return Response({'error': 'project_id is required'}, status=400)

        if not storage_ids:
            return Response({'error': 'storage_ids is required'}, status=400)

        storages = LocalFilesImportStorage.objects.filter(id__in=storage_ids)
        updated_count = storages.update(project_id=project_id)

        return Response({'updated': updated_count}, status=200)


@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Get import storage',
        description='Get a specific local file import storage connection.',
        request=None,
        extensions={
            'x-fern-sdk-group-name': ['import_storage', 'local'],
            'x-fern-sdk-method-name': 'get',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='patch',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Update import storage',
        description='Update a specific local file import storage connection.',
        request={
            'application/json': _local_files_import_storage_schema,
        },
        extensions={
            'x-fern-sdk-group-name': ['import_storage', 'local'],
            'x-fern-sdk-method-name': 'update',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='delete',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Delete import storage',
        description='Delete a specific local file import storage connection.',
        request=None,
        extensions={
            'x-fern-sdk-group-name': ['import_storage', 'local'],
            'x-fern-sdk-method-name': 'delete',
            'x-fern-audiences': ['public'],
        },
    ),
)
class LocalFilesImportStorageDetailAPI(ImportStorageDetailAPI):
    queryset = LocalFilesImportStorage.objects.all()
    serializer_class = LocalFilesImportStorageSerializer

    def get_serializer_class(self):
        if 'workspace' in self.request.query_params or 'workspace' in self.request.data:
            return WorkspaceLocalFilesImportStorageSerializer
        return LocalFilesImportStorageSerializer

    def get_queryset(self):
        if 'workspace' in self.request.query_params:
            self.serializer_class = WorkspaceLocalFilesImportStorageSerializer
            return WorkspaceLocalFilesImportStorage.objects.all()
        return LocalFilesImportStorage.objects.all()


@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Sync import storage',
        description='Sync tasks from a local file import storage connection.',
        parameters=[
            OpenApiParameter(
                name='id',
                type=OpenApiTypes.INT,
                location='path',
                description='Storage ID',
            ),
        ],
        request=None,
        extensions={
            'x-fern-sdk-group-name': ['import_storage', 'local'],
            'x-fern-sdk-method-name': 'sync',
            'x-fern-audiences': ['public'],
        },
    ),
)
class LocalFilesImportStorageSyncAPI(ImportStorageSyncAPI):
    serializer_class = LocalFilesImportStorageSerializer

    def get_serializer_class(self):
        if 'workspace' in self.request.query_params or 'workspace' in self.request.data:
            return WorkspaceLocalFilesImportStorageSerializer
        return LocalFilesImportStorageSerializer


@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Sync export storage',
        description='Sync tasks from a local file export storage connection.',
        request=None,
        extensions={
            'x-fern-sdk-group-name': ['export_storage', 'local'],
            'x-fern-sdk-method-name': 'sync',
            'x-fern-audiences': ['public'],
        },
    ),
)
class LocalFilesExportStorageSyncAPI(ExportStorageSyncAPI):
    serializer_class = LocalFilesExportStorageSerializer


@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Validate import storage',
        description='Validate a specific local file import storage connection.',
        request={
            'application/json': _local_files_import_storage_schema_with_id,
        },
        responses={200: OpenApiResponse(description='Validation successful')},
        extensions={
            'x-fern-sdk-group-name': ['import_storage', 'local'],
            'x-fern-sdk-method-name': 'validate',
            'x-fern-audiences': ['public'],
        },
    ),
)
class LocalFilesImportStorageValidateAPI(ImportStorageValidateAPI):
    serializer_class = LocalFilesImportStorageSerializer

    def get_serializer_class(self):
        # 1. 쿼리 파라미터나 POST 데이터(Body)에 'workspace'가 있는지 확인
        if 'workspace' in self.request.query_params or 'workspace' in self.request.data:
            logger.info(f'Workspace: {self.request.data["workspace"]}')
            return WorkspaceLocalFilesImportStorageSerializer

        # 2. 없으면 기본(프로젝트용) 시리얼라이저 반환
        return LocalFilesImportStorageSerializer


@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Validate export storage',
        description='Validate a specific local file export storage connection.',
        request={
            'application/json': _local_files_export_storage_schema_with_id,
        },
        responses={200: OpenApiResponse(description='Validation successful')},
        extensions={
            'x-fern-sdk-group-name': ['export_storage', 'local'],
            'x-fern-sdk-method-name': 'validate',
            'x-fern-audiences': ['public'],
        },
    ),
)
class LocalFilesExportStorageValidateAPI(ExportStorageValidateAPI):
    serializer_class = LocalFilesExportStorageSerializer


@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Get all export storage',
        description='Get a list of all local file export storage connections.',
        parameters=[
            OpenApiParameter(
                name='project',
                type=OpenApiTypes.INT,
                location='query',
                description='Project ID',
                required=True,
            ),
        ],
        extensions={
            'x-fern-sdk-group-name': ['export_storage', 'local'],
            'x-fern-sdk-method-name': 'list',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='post',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Create export storage',
        description='Create a new local file export storage connection to store annotations.',
        request={
            'application/json': _local_files_export_storage_schema,
        },
        extensions={
            'x-fern-sdk-group-name': ['export_storage', 'local'],
            'x-fern-sdk-method-name': 'create',
            'x-fern-audiences': ['public'],
        },
    ),
)
class LocalFilesExportStorageListAPI(ExportStorageListAPI):
    queryset = LocalFilesExportStorage.objects.all()
    serializer_class = LocalFilesExportStorageSerializer


@method_decorator(
    name='get',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Get export storage',
        description='Get a specific local file export storage connection.',
        request=None,
        extensions={
            'x-fern-sdk-group-name': ['export_storage', 'local'],
            'x-fern-sdk-method-name': 'get',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='patch',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Update export storage',
        description='Update a specific local file export storage connection.',
        request={
            'application/json': _local_files_export_storage_schema,
        },
        extensions={
            'x-fern-sdk-group-name': ['export_storage', 'local'],
            'x-fern-sdk-method-name': 'update',
            'x-fern-audiences': ['public'],
        },
    ),
)
@method_decorator(
    name='delete',
    decorator=extend_schema(
        tags=['Storage: Local'],
        summary='Delete export storage',
        description='Delete a specific local file export storage connection.',
        request=None,
        extensions={
            'x-fern-sdk-group-name': ['export_storage', 'local'],
            'x-fern-sdk-method-name': 'delete',
            'x-fern-audiences': ['public'],
        },
    ),
)
class LocalFilesExportStorageDetailAPI(ExportStorageDetailAPI):
    queryset = LocalFilesExportStorage.objects.all()
    serializer_class = LocalFilesExportStorageSerializer


class LocalFilesImportStorageFormLayoutAPI(ImportStorageFormLayoutAPI):
    pass


class LocalFilesExportStorageFormLayoutAPI(ExportStorageFormLayoutAPI):
    pass
