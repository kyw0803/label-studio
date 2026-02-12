from django.db import migrations, connection
from django.conf import settings
from core.redis import start_job_async_or_sync
from core.models import AsyncMigrationStatus
import logging

logger = logging.getLogger(__name__)
migration_name = '0028_add_localfiles_parent_storage_index_async'

def forward_migration(migration_name, db_alias=None):
    migration = AsyncMigrationStatus.objects.create(
        name=migration_name,
        status=AsyncMigrationStatus.STATUS_STARTED,
    )
    logger.debug(f'Start async migration {migration_name}')

    if connection.vendor == 'postgresql':
        sql = '''
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "io_storages_localfiles_parent_idx"
        ON "io_storages_localfilesimportstorage" ("parent_storage_id");
        '''
    else:
        sql = '''
        CREATE INDEX IF NOT EXISTS "io_storages_localfiles_parent_idx"
        ON "io_storages_localfilesimportstorage" ("parent_storage_id");
        '''

    with connection.cursor() as cursor:
        cursor.execute(sql)

    migration.status = AsyncMigrationStatus.STATUS_FINISHED
    migration.save()
    logger.debug(f'Async migration {migration_name} complete')

def reverse_migration(migration_name, db_alias=None):
    migration = AsyncMigrationStatus.objects.create(
        name=migration_name,
        status=AsyncMigrationStatus.STATUS_STARTED,
    )
    logger.debug(f'Start async migration rollback {migration_name}')

    if connection.vendor == 'postgresql':
        sql = 'DROP INDEX CONCURRENTLY IF EXISTS "io_storages_localfiles_parent_idx";'
    else:
        sql = 'DROP INDEX IF EXISTS "io_storages_localfiles_parent_idx";'

    with connection.cursor() as cursor:
        cursor.execute(sql)

    migration.status = AsyncMigrationStatus.STATUS_FINISHED
    migration.save()
    logger.debug(f'Async migration rollback {migration_name} complete')

def forwards(apps, schema_editor):
    start_job_async_or_sync(forward_migration, migration_name=migration_name, db_alias=schema_editor.connection.alias)

def backwards(apps, schema_editor):
    start_job_async_or_sync(reverse_migration, migration_name=migration_name, db_alias=schema_editor.connection.alias)

class Migration(migrations.Migration):
    atomic = False
    dependencies = [
        ('io_storages', '0027_alter_localfilesimportstorage_parent_storage'),
    ]
    operations = [
        migrations.RunPython(forwards, backwards),
    ]
