import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Button,
  EmptyState,
  IconCloudCustom,
  IconCloudProviderAzure,
  IconCloudProviderGCS,
  IconCloudProviderRedis,
  IconCloudProviderS3,
  IconExternal,
  SimpleCard,
  Spinner,
  Tooltip,
  Typography,
} from "@humansignal/ui";
import { useQuery } from "@tanstack/react-query";
import { useAPI } from "../../providers/ApiProvider";
import { cn } from "../../utils/bem";
import { Columns } from "../../components";
import { confirm, modal } from "../../components/Modal/Modal";
import { StorageProviderForm } from "@humansignal/app-common/blocks/StorageProviderForm";
import { ff } from "@humansignal/core";
import { StorageForm } from "../Settings/StorageSettings/StorageForm";
import { StorageCard } from "../Settings/StorageSettings/StorageCard";
import { providers } from "../Settings/StorageSettings/providers";
import "./WorkspaceData.scss";
import ManageStorageModal from "./ManageStorageModal";

function useWorkspaceStorages(target, workspaceId) {
  const api = useAPI();
  const storagesQueryKey = ["storages", target, "workspace", workspaceId];
  const { data, isLoading, isSuccess, refetch } = useQuery({
    queryKey: storagesQueryKey,
    enabled: workspaceId !== undefined,
    async queryFn() {
      const apiTarget = target === "import" ? undefined : target;
      const result = await api.callApi("listStorages", {
        params: { workspace: workspaceId, target: apiTarget },
        errorFilter: () => true,
      });

      if (!result?.$meta.ok) return [];

      return result;
    },
  });

  return {
    storages: data,
    storagesLoading: isLoading,
    storagesLoaded: isSuccess,
    reloadStoragesList: () => refetch({ queryKey: storagesQueryKey }),
  };
}

function useWorkspaceStorageTypes(target) {
  const api = useAPI();
  const storageTypesQueryKey = ["storage-types", target];
  const { data, isLoading, isSuccess, refetch } = useQuery({
    queryKey: storageTypesQueryKey,
    async queryFn() {
      const apiTarget = target === "import" ? undefined : target;
      const result = await api.callApi("storageTypes", {
        params: { target: apiTarget },
        errorFilter: () => true,
      });

      if (!result?.$meta.ok) return [];

      return result;
    },
  });

  return {
    storageTypes: data,
    storageTypesLoading: isLoading,
    storageTypesLoaded: isSuccess,
    reloadStorageTypes: () => refetch({ queryKey: storageTypesQueryKey }),
  };
}

function useWorkspaceStorageCard(target, workspaceId) {
  const { reloadStoragesList, ...storages } = useWorkspaceStorages(target, workspaceId);
  const { reloadStorageTypes, ...storageTypes } = useWorkspaceStorageTypes(target);

  const fetchStorages = useCallback(async () => {
    reloadStoragesList();
    reloadStorageTypes();
  }, [reloadStoragesList, reloadStorageTypes]);

  const loading = useMemo(
    () => storageTypes.storageTypesLoading || storages.storagesLoading,
    [storageTypes.storageTypesLoading, storages.storagesLoading],
  );
  const loaded = useMemo(
    () => storageTypes.storageTypesLoaded || storages.storagesLoaded,
    [storageTypes.storageTypesLoaded, storages.storagesLoaded],
  );

  return {
    ...storages,
    ...storageTypes,
    loaded,
    loading,
    fetchStorages,
  };
}

export const WorkspaceData = ({ workspaceId }) => {
  const rootClass = cn("workspace-data");
  const sourceStorageRef = useRef();
  const [manageModalVisible, setManageModalVisible] = useState(false);

  // Fetch storage data at parent level
  const sourceStorage = useWorkspaceStorageCard("import", workspaceId);

  // Check if any storages exist
  const hasAnyStorages = sourceStorage.storages?.length > 0;
  const isLoading = sourceStorage.loading;
  const isLoaded = sourceStorage.loaded;

  return (
    <section className="max-w-[680px]">
      <Typography variant="headline" size="medium" className="mb-base">
        Cloud Storage
      </Typography>
      {hasAnyStorages && (
        <Typography size="small" className="text-neutral-content-subtler mb-wider">
          Use cloud or database storage as the source for your labeling tasks.
        </Typography>
      )}

      {isLoading && !isLoaded && (
        <div className="flex items-center justify-center h-[50rem]">
          <Spinner />
        </div>
      )}

      {/* Always render StorageSet components (hidden when showing EmptyState) so refs are populated */}
      <div className={!hasAnyStorages && isLoaded ? "hidden" : ""}>
        <div className="grid grid-cols-1 gap-8">
          <WorkspaceStorageSet
            ref={sourceStorageRef}
            title="Source Cloud Storage"
            buttonLabel="Add Source Storage"
            rootClass={rootClass}
            storageTypes={sourceStorage.storageTypes}
            storages={sourceStorage.storages}
            storagesLoaded={sourceStorage.storagesLoaded}
            loading={sourceStorage.loading}
            loaded={sourceStorage.loaded}
            fetchStorages={sourceStorage.fetchStorages}
            workspaceId={workspaceId}
            onManageStorage={() => setManageModalVisible(true)}
            target="import"
          />
        </div>
      </div>

      {/* Show EmptyState when no storages exist */}
      {!hasAnyStorages && isLoaded && !isLoading && (
        <SimpleCard title="" className="bg-primary-background border-primary-border-subtler p-base">
          <EmptyState
            size="medium"
            variant="primary"
            icon={<IconCloudCustom />}
            title="Add your first cloud storage"
            description="Use cloud or database storage as the source for your labeling tasks."
            additionalContent={
              <div className="flex items-center justify-center gap-base" data-testid="dm-storage-provider-icons">
                <Tooltip title="Amazon S3">
                  <div className="flex items-center justify-center p-2" aria-label="Amazon S3">
                    <IconCloudProviderS3 width={32} height={32} className="text-neutral-content-subtler" />
                  </div>
                </Tooltip>
                <Tooltip title="Google Cloud Storage">
                  <div className="flex items-center justify-center p-2" aria-label="Google Cloud Storage">
                    <IconCloudProviderGCS width={32} height={32} className="text-neutral-content-subtler" />
                  </div>
                </Tooltip>
                <Tooltip title="Azure Blob Storage">
                  <div className="flex items-center justify-center p-2" aria-label="Azure Blob Storage">
                    <IconCloudProviderAzure width={32} height={32} className="text-neutral-content-subtler" />
                  </div>
                </Tooltip>
                <Tooltip title="Redis Storage">
                  <div className="flex items-center justify-center p-2" aria-label="Redis Storage">
                    <IconCloudProviderRedis width={32} height={32} className="text-neutral-content-subtler" />
                  </div>
                </Tooltip>
              </div>
            }
            actions={
              <div className="flex gap-base">
                <Button
                  look="primary"
                  data-testid="add-source-storage-button-empty-state"
                  aria-label="Add Source Storage"
                  onClick={() => sourceStorageRef.current?.openAddModal()}
                >
                  Add Source Storage
                </Button>
              </div>
            }
            footer={
              !window.APP_SETTINGS?.whitelabel_is_active && (
                <Typography variant="label" size="small" className="text-primary-link">
                  <a
                    href="https://docs.humansignal.com/guide/storage"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="storage-help-link"
                    aria-label="Learn more about cloud storage (opens in new window)"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    Learn more
                    <IconExternal width={16} height={16} />
                  </a>
                </Typography>
              )
            }
          />
        </SimpleCard>
      )}

      <ManageStorageModal
        workspaceId={workspaceId}
        visible={manageModalVisible}
        onClose={() => setManageModalVisible(false)}
      />
    </section>
  );
};

// WorkspaceStorageSet is a wrapper around StorageSet that passes workspace instead of project
const WorkspaceStorageSet = React.forwardRef(
  (
    {
      title,
      target,
      rootClass,
      buttonLabel,
      storageTypes,
      storages,
      storagesLoaded,
      loading,
      loaded,
      fetchStorages,
      workspaceId,
      onManageStorage,
    },
    ref,
  ) => {
    const api = useAPI();
    const useNewStorageScreen = ff.isActive(ff.FF_NEW_STORAGES);

    const showStorageFormModal = useCallback(
      (storage) => {
        const action = storage ? "Edit" : "Connect";
        const actionTarget = target === "export" ? "Target" : "Source";
        const modalTitle = `${action} ${actionTarget} Storage`;

        const modalRef = modal({
          title: modalTitle,
          closeOnClickOutside: false,
          style: { width: 840 },
          bare: useNewStorageScreen,
          onHidden: () => {
            // Reset state when modal is closed
          },
          body: useNewStorageScreen ? (
            <StorageProviderForm
              title={modalTitle}
              target={target}
              storage={storage}
              workspace={workspaceId}
              rootClass={rootClass}
              storageTypes={storageTypes}
              providers={providers}
              onSubmit={async () => {
                modalRef.close();
                fetchStorages();
              }}
              onHide={() => {}}
            />
          ) : (
            <StorageForm
              target={target}
              storage={storage}
              workspace={workspaceId}
              rootClass={rootClass}
              storageTypes={storageTypes}
              onSubmit={async () => {
                await fetchStorages();
                modalRef.close();
              }}
            />
          ),
        });
      },
      [workspaceId, fetchStorages, target, rootClass, storageTypes],
    );

    const onEditStorage = useCallback(
      async (storage) => {
        showStorageFormModal(storage);
      },
      [showStorageFormModal],
    );

    // Expose showStorageFormModal to parent via ref
    React.useImperativeHandle(
      ref,
      () => ({
        openAddModal: () => showStorageFormModal(),
      }),
      [showStorageFormModal],
    );

    const onDeleteStorage = useCallback(
      async (storage) => {
        confirm({
          title: "Deleting storage",
          body: "This action cannot be undone. Are you sure?",
          buttonLook: "negative",
          onOk: async () => {
            const apiTarget = target === "import" ? undefined : target;
            const response = await api.callApi("deleteStorage", {
              params: {
                type: storage.type,
                pk: storage.id,
                target: apiTarget,
                workspace: workspaceId,
              },
            });

            if (response !== null) fetchStorages();
          },
        });
      },
      [fetchStorages, workspaceId, api],
    );

    return (
      <Columns.Column title={title}>
        <div className={rootClass.elem("controls")}>
          <Button
            onClick={() => showStorageFormModal()}
            disabled={loading}
            look="outlined"
            data-testid={`add-${target === "export" ? "target" : "source"}-storage-button`}
            aria-label={`Add ${target === "export" ? "Target" : "Source"} Storage`}
          >
            {buttonLabel}
          </Button>
          {target === "import" && (
            <Button onClick={onManageStorage} disabled={loading} look="outlined" style={{ marginLeft: 8 }}>
              Manage Storage
            </Button>
          )}
        </div>

        {loading && !loaded ? (
          <div className={rootClass.elem("empty")}>
            <Spinner size={32} />
          </div>
        ) : storagesLoaded && storages.length === 0 ? null : (
          storages?.map?.((storage) => (
            <StorageCard
              key={storage.id}
              storage={storage}
              target={target}
              rootClass={rootClass}
              storageTypes={storageTypes}
              onEditStorage={onEditStorage}
              onDeleteStorage={onDeleteStorage}
              onManageStorage={onManageStorage}
            />
          ))
        )}
      </Columns.Column>
    );
  },
);

WorkspaceStorageSet.displayName = "WorkspaceStorageSet";
