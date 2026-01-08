import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@humansignal/ui";
import { useAPI } from "../../providers/ApiProvider";
import { useProject } from "../../providers/ProjectProvider";
import { Modal } from "../../components/Modal/ModalPopup";
import { cn } from "../../utils/bem";
import "./MembersModal.scss";

const ROLES = {
  annotator: "Annotator",
  reviewer: "Reviewer",
  project_manager: "Project Manager",
};

export const ProjectMembersModal = ({ onClose }) => {
  const api = useAPI();
  const { project } = useProject();
  const [members, setMembers] = useState([]);
  const [potentialMembers, setPotentialMembers] = useState([]);
  const [selectedPotentialMembers, setSelectedPotentialMembers] = useState({}); // { userId: role }
  const [showAddMember, setShowAddMember] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!project?.id) return;
    const data = await api.callApi("projectMembers", {
      params: { pk: project.id },
    });
    setMembers(data);
  }, [project, api]);

  const fetchPotentialMembers = useCallback(async () => {
    if (!project?.id) return;
    const data = await api.callApi("projectPotentialMembers", {
      params: { pk: project.id },
    });
    setPotentialMembers(data);
  }, [project, api]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (showAddMember) {
      fetchPotentialMembers();
    }
  }, [showAddMember, fetchPotentialMembers]);

  const handleSave = async () => {
    const userIds = Object.keys(selectedPotentialMembers);
    if (userIds.length === 0) return;

    const membersPayload = userIds.map((id) => ({
      user_id: Number(id),
      role: selectedPotentialMembers[id],
    }));

    await api.callApi("addProjectMembers", {
      params: { pk: project.id },
      body: { members: membersPayload },
    });
    setShowAddMember(false);
    setSelectedPotentialMembers({});
    fetchMembers();
  };

  const toggleSelection = (id, isChecked) => {
    const newSelection = { ...selectedPotentialMembers };
    if (isChecked) {
      newSelection[id] = "annotator"; // Default role
    } else {
      delete newSelection[id];
    }
    setSelectedPotentialMembers(newSelection);
  };

  const handleRoleChange = (id, role) => {
    if (selectedPotentialMembers[id]) {
      setSelectedPotentialMembers({
        ...selectedPotentialMembers,
        [id]: role,
      });
    }
  };

  return (
    <Modal
      onHide={onClose}
      title={showAddMember ? "Add Members" : "Project Members"}
      style={{ width: 600 }}
      visible
      animate
    >
      <div className={cn("members-modal")}>
        {!showAddMember ? (
          <>
            <div className={cn("members-modal").elem("header")}>
              <Button onClick={() => setShowAddMember(true)} look="primary" size="small">
                Add
              </Button>
            </div>
            <div className={cn("members-modal").elem("content")}>
              {members.length > 0 ? (
                members.map((member) => (
                  <div key={member.id} className={cn("members-modal").elem("item")}>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                      <div>
                        {member.user.email}{" "}
                        <span style={{ color: "#999" }}>
                          ({member.user.first_name} {member.user.last_name})
                        </span>
                      </div>
                      <div
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: "#f0f0f0",
                          fontSize: "12px",
                          textTransform: "capitalize",
                        }}
                      >
                        {ROLES[member.role] || member.role}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 16, textAlign: "center", color: "#666" }}>No members found</div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={cn("members-modal").elem("content")}>
              {potentialMembers.length > 0 ? (
                potentialMembers.map((user) => {
                  const isSelected = !!selectedPotentialMembers[user.id];
                  return (
                    <div key={user.id} className={cn("members-modal").elem("item")}>
                      <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
                        <input
                          type="checkbox"
                          id={`user-${user.id}`}
                          checked={isSelected}
                          onChange={(e) => toggleSelection(user.id, e.target.checked)}
                        />
                        <label htmlFor={`user-${user.id}`} style={{ marginLeft: 8, cursor: "pointer", flex: 1 }}>
                          {user.email} ({user.first_name} {user.last_name})
                        </label>
                      </div>
                      {isSelected && (
                        <select
                          value={selectedPotentialMembers[user.id]}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          style={{ marginLeft: 16, padding: "4px" }}
                        >
                          {Object.entries(ROLES).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: 16, textAlign: "center", color: "#666" }}>
                  No potential members found to add.
                </div>
              )}
            </div>
            <div className={cn("members-modal").elem("footer")}>
              <Button onClick={() => setShowAddMember(false)} size="small">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                look="primary"
                size="small"
                disabled={Object.keys(selectedPotentialMembers).length === 0}
              >
                Save
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
