import { useState, useEffect } from "react";
import { Modal } from "../../components/Modal/Modal";
import { Button } from "@humansignal/ui";
import { useAPI } from "../../providers/ApiProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "../../utils/bem";
import "./ManageStorageModal.scss";

const ManageStorageModal = ({ workspaceId, onClose, visible }) => {
  const api = useAPI();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'allocate'
  const rootClass = cn("manage-storage-modal");

  // Reset view mode when modal opens
  useEffect(() => {
    if (visible) setViewMode("list");
  }, [visible]);

  // --- Allocate Mode Logic ---
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedStorages, setSelectedStorages] = useState([]);

  // Fetch Projects (Allocate Mode)
  const { data: projectsData, isLoading: isProjectsLoading } = useQuery({
    queryKey: ["projects", "list", workspaceId],
    queryFn: async () => {
      const result = await api.callApi("projects", {
        params: { workspace: workspaceId },
      });
      return result?.results || [];
    },
    enabled: visible && viewMode === "allocate",
  });

  // Fetch Unassigned Storages (Allocate Mode)
  const { data: unassignedStorages, isLoading: isUnassignedLoading } = useQuery({
    queryKey: ["storages", "unassigned", workspaceId],
    queryFn: async () => {
      console.log("Fetching workspaceSubStorages for workspace:", workspaceId);
      const result = await api.callApi("workspaceSubStorages", {
        params: { workspace: workspaceId, assigned: "false" },
        errorFilter: () => true,
      });
      console.log("workspaceSubStorages result:", result);
      return result || [];
    },
    enabled: visible && viewMode === "allocate",
  });

  // Fetch All Storages (List Mode)
  const {
    data: allStorages,
    isLoading: isAllStoragesLoading,
    refetch: refetchAll,
  } = useQuery({
    queryKey: ["storages", "all", workspaceId],
    queryFn: async () => {
      const result = await api.callApi("workspaceSubStorages", {
        params: { workspace: workspaceId },
        errorFilter: () => true,
      });
      return result || [];
    },
    enabled: visible && viewMode === "list",
  });

  const allocateMutation = useMutation({
    mutationFn: async () => {
      return await api.callApi("allocateStorage", {
        body: {
          project: selectedProject,
          storage_ids: selectedStorages,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["storages"]);
      queryClient.invalidateQueries(["projects"]);
      refetchAll(); // Refresh list view
      setViewMode("list"); // Go back to list view
      setSelectedProject(null);
      setSelectedStorages([]);
    },
  });

  const handleStorageToggle = (storageId) => {
    setSelectedStorages((prev) => {
      if (prev.includes(storageId)) return prev.filter((id) => id !== storageId);
      return [...prev, storageId];
    });
  };

  const handleSelectAllStorages = () => {
    if (unassignedStorages && selectedStorages.length === unassignedStorages.length) {
      setSelectedStorages([]);
    } else if (unassignedStorages) {
      setSelectedStorages(unassignedStorages.map((s) => s.id));
    }
  };

  const renderListView = () => (
    <div className={rootClass.elem("list-view")}>
      <div className={rootClass.elem("table-header")}>
        <div className={rootClass.elem("col-name")}>Storage Name</div>
        <div className={rootClass.elem("col-path")}>Path</div>
        <div className={rootClass.elem("col-project")}>Assigned Project</div>
      </div>
      <div className={rootClass.elem("table-body")}>
        {isAllStoragesLoading ? (
          <div className={rootClass.elem("loading")}>Loading...</div>
        ) : allStorages?.length === 0 ? (
          <div className={rootClass.elem("empty")}>No storages found</div>
        ) : (
          allStorages?.map((storage) => (
            <div key={storage.id} className={rootClass.elem("row")}>
              <div className={rootClass.elem("col-name")}>{storage.title}</div>
              <div className={rootClass.elem("col-path")} title={storage.path}>
                {storage.path}
              </div>
              <div className={rootClass.elem("col-project")}>
                {storage.project ? (
                  <span className={rootClass.elem("assigned")}>
                    {storage.project_title ? storage.project_title : `Project ID: ${storage.project}`}
                  </span>
                ) : (
                  <span className={rootClass.elem("unassigned")}>Unassigned</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderAllocateView = () => (
    <div className={rootClass.elem("allocate-view")}>
      <div className={rootClass.elem("column")}>
        <h3 className={rootClass.elem("column-header")}>Select Project</h3>
        <div className={rootClass.elem("list")}>
          {isProjectsLoading ? (
            <div>Loading...</div>
          ) : projectsData?.length === 0 ? (
            <div className={rootClass.elem("empty")}>No projects found</div>
          ) : (
            projectsData?.map((project) => (
              <div
                key={project.id}
                className={rootClass.elem("item").mod({ "project-selected": selectedProject === project.id })}
                onClick={() => setSelectedProject(project.id)}
              >
                <div className={rootClass.elem("project-title")}>{project.title}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={rootClass.elem("column")}>
        <h3 className={rootClass.elem("column-header")}>
          Select Storages
          {unassignedStorages && unassignedStorages.length > 0 && (
            <span className={rootClass.elem("select-all")} onClick={handleSelectAllStorages}>
              {selectedStorages.length === unassignedStorages.length ? "Deselect All" : "Select All"}
            </span>
          )}
        </h3>
        <div className={rootClass.elem("list")}>
          {isUnassignedLoading ? (
            <div className={rootClass.elem("loading")}>Loading...</div>
          ) : !unassignedStorages || unassignedStorages.length === 0 ? (
            <div className={rootClass.elem("empty")}>No unassigned storages found</div>
          ) : (
            unassignedStorages?.map((storage) => (
              <div
                key={storage.id}
                className={rootClass.elem("item").mod({ selected: selectedStorages.includes(storage.id) })}
                onClick={() => handleStorageToggle(storage.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedStorages.includes(storage.id)}
                  readOnly
                  className={rootClass.elem("checkbox")}
                />
                <div className={rootClass.elem("storage-info")}>
                  <div className={rootClass.elem("storage-title")}>{storage.title}</div>
                  <div className={rootClass.elem("storage-path")}>{storage.path}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      visible={visible}
      onHide={onClose}
      title={viewMode === "list" ? "Manage Workspace Storage" : "Allocate Storage to Project"}
      style={{ width: 800 }}
      footer={
        <div className={rootClass.elem("footer")}>
          {viewMode === "list" ? (
            <>
              <Button onClick={onClose} look="outlined" style={{ marginRight: 8 }}>
                Close
              </Button>
              <Button onClick={() => setViewMode("allocate")} look="primary">
                Allocate Storage
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setViewMode("list")} look="outlined" style={{ marginRight: 8 }}>
                Back
              </Button>
              <Button
                onClick={() => allocateMutation.mutate()}
                look="primary"
                disabled={!selectedProject || selectedStorages.length === 0 || allocateMutation.isLoading}
                waiting={allocateMutation.isLoading}
              >
                Allocate
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className={rootClass}>{viewMode === "list" ? renderListView() : renderAllocateView()}</div>
    </Modal>
  );
};

export default ManageStorageModal;
