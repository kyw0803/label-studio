import React, { useState } from "react";
import { Spinner, Button } from "@humansignal/ui";
import { useAPI } from "../../providers/ApiProvider";
import { useAbortController } from "@humansignal/core";
import { cn } from "../../utils/bem";
import { Oneof } from "../../components/Oneof/Oneof";
import { Modal } from "../../components/Modal/Modal";
import { 
  IconFolder, 
  IconPlus, 
  IconSettings, 
  IconTrash, 
  IconMore,
  IconFolderOpen,
  IconLsLabeling
} from "@humansignal/icons";
import "./WorkspacesSidebar.scss";

const WorkspaceModal = ({ visible, onClose, onSubmit, initialValue = "", title, loading }) => {
  const [value, setValue] = useState(initialValue);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue, visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      onHide={onClose}
      title={title}
      style={{ width: 400 }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(value);
        }}
        className="workspaces-sidebar__modal-content"
      >
        <input
          autoFocus
          className="workspaces-sidebar__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Workspace name"
        />
        <div className="workspaces-sidebar__modal-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" waiting={loading} disabled={!value.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export const WorkspacesSidebar = ({ selectedWorkspaceId, onSelectWorkspace, className }) => {
  const api = useAPI();
  const abortController = useAbortController();
  const [workspaces, setWorkspaces] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchWorkspaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.callApi("workspaces", {
        signal: abortController.controller.current.signal,
        errorFilter: (e) => e.error.includes("aborted"),
      });

      let workspacesList = [];
      if (Array.isArray(response)) {
        workspacesList = response;
      } else if (response?.results && Array.isArray(response.results)) {
        workspacesList = response.results;
      } else if (response && typeof response === 'object') {
        workspacesList = [response];
      }

      setWorkspaces(workspacesList);
    } catch (err) {
      if (!err.error?.includes("aborted")) {
        console.error("Failed to fetch workspaces:", err);
        setError(err.message || "Failed to load workspaces");
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleCreate = async (title) => {
    setActionLoading(true);
    try {
      const newWorkspace = await api.callApi("createWorkspace", {
        body: { title },
      });
      setWorkspaces([...workspaces, newWorkspace]);
      setCreateModalVisible(false);
      onSelectWorkspace(newWorkspace.id);
    } catch (err) {
      console.error("Failed to create workspace:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (title) => {
    if (!editingWorkspace) return;
    setActionLoading(true);
    try {
      const updatedWorkspace = await api.callApi("updateWorkspace", {
        params: { pk: editingWorkspace.id },
        body: { title },
      });
      setWorkspaces(workspaces.map(w => w.id === editingWorkspace.id ? updatedWorkspace : w));
      setEditModalVisible(false);
      setEditingWorkspace(null);
    } catch (err) {
      console.error("Failed to update workspace:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (e, workspace) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete workspace "${workspace.title}"?`)) return;

    try {
      await api.callApi("deleteWorkspace", {
        params: { pk: workspace.id },
      });
      setWorkspaces(workspaces.filter(w => w.id !== workspace.id));
      if (selectedWorkspaceId === workspace.id) {
        onSelectWorkspace(null);
      }
    } catch (err) {
      console.error("Failed to delete workspace:", err);
    }
  };

  const rootClass = cn("workspaces-sidebar");

  return (
    <div className={rootClass.mix(className).toClassName()}>
      <div className={rootClass.elem("header")}>
        <h3 className={rootClass.elem("title")}>Workspaces</h3>
        <div 
          className={rootClass.elem("add-button")} 
          onClick={() => setCreateModalVisible(true)}
          title="Create Workspace"
        >
          <IconPlus width={20} height={20} />
        </div>
      </div>

      <div className={rootClass.elem("content")}>
        <Oneof value={loading ? "loading" : error ? "error" : "loaded"}>
          <div case="loading" className={rootClass.elem("loading")}>
            <Spinner size={32} />
          </div>

          <div case="error" className={rootClass.elem("error")}>
            <div className={rootClass.elem("error-message")}>{error}</div>
            <Button size="small" onClick={fetchWorkspaces}>Retry</Button>
          </div>

          <div case="loaded" className={rootClass.elem("list")}>
            <div
              className={rootClass
                .elem("item")
                .mod({ active: !selectedWorkspaceId })
                .toClassName()}
              onClick={() => onSelectWorkspace(null)}
            >
              <div className={rootClass.elem("item-content")}>
                <div className={rootClass.elem("icon")}>
                  <IconLsLabeling />
                </div>
                <span className={rootClass.elem("item-title")}>All Projects</span>
              </div>
            </div>

            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className={rootClass
                  .elem("item")
                  .mod({ active: workspace.id === selectedWorkspaceId })
                  .toClassName()}
                onClick={() => onSelectWorkspace(workspace.id)}
              >
                <div className={rootClass.elem("item-content")}>
                  <div className={rootClass.elem("icon")}>
                    <IconFolder />
                  </div>
                  <span className={rootClass.elem("item-title")} title={workspace.title}>
                    {workspace.title}
                  </span>
                </div>
                <div className={rootClass.elem("item-actions")}>
                  <div 
                    className={rootClass.elem("action-button")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingWorkspace(workspace);
                      setEditModalVisible(true);
                    }}
                    title="Edit Workspace"
                  >
                    <IconSettings width={16} height={16} />
                  </div>
                  <div 
                    className={rootClass.elem("action-button")}
                    onClick={(e) => handleDelete(e, workspace)}
                    title="Delete Workspace"
                  >
                    <IconTrash width={16} height={16} />
                  </div>
                </div>
              </div>
            ))}
            
            {workspaces.length === 0 && (
              <div className={rootClass.elem("empty")}>
                <span>No workspaces found</span>
                <Button size="small" onClick={() => setCreateModalVisible(true)}>
                  Create Workspace
                </Button>
              </div>
            )}
          </div>
        </Oneof>
      </div>

      <WorkspaceModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreate}
        title="Create Workspace"
        loading={actionLoading}
      />

      <WorkspaceModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setEditingWorkspace(null);
        }}
        initialValue={editingWorkspace?.title}
        onSubmit={handleUpdate}
        title="Edit Workspace"
        loading={actionLoading}
      />
    </div>
  );
};
