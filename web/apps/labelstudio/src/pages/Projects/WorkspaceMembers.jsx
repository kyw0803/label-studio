import React, { useState, useEffect } from "react";
import { Button, Spinner } from "@humansignal/ui";
import { useAPI } from "../../providers/ApiProvider";
import { useAbortController } from "@humansignal/core";
import { IconTrash, IconPersonInCircle } from "@humansignal/icons";
import { cn } from "../../utils/bem";
import "./WorkspaceMembers.scss";

export const WorkspaceMembers = ({ workspace }) => {
  const api = useAPI();
  const abortController = useAbortController();
  const [members, setMembers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchMembers = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const data = await api.callApi("workspaceMembers", {
        params: { pk: workspace.id },
      });
      setMembers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async () => {
    if (!workspace) return;
    try {
      const data = await api.callApi("workspaceCandidates", {
        params: { pk: workspace.id },
      });
      setCandidates(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (workspace) {
      fetchMembers();
      fetchCandidates();
      setSelectedCandidate("");
    }
  }, [workspace]);

  const handleAddMember = async () => {
    if (!selectedCandidate) return;
    setAdding(true);
    try {
      await api.callApi("addWorkspaceMembers", {
        params: { pk: workspace.id },
        body: {
          member_ids: [selectedCandidate],
        },
      });
      await fetchMembers();
      await fetchCandidates();
      setSelectedCandidate("");
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
      await api.callApi("deleteWorkspaceMembers", {
        params: { pk: workspace.id },
        body: {
          member_ids: [memberId],
        },
      });
      await fetchMembers();
      await fetchCandidates();
    } catch (err) {
      console.error(err);
    }
  };

  const rootClass = cn("workspace-members");

  return (
    <div className={rootClass} style={{ padding: "20px", maxWidth: "800px" }}>
      <div className={rootClass.elem("add-section")}>
        <select
          className={rootClass.elem("select")}
          value={selectedCandidate}
          onChange={(e) => setSelectedCandidate(e.target.value)}
          disabled={candidates.length === 0}
        >
          <option value="" disabled>
            {candidates.length > 0 ? "Select user to add..." : "No users available to add"}
          </option>
          {candidates.map((user) => (
            <option key={user.id} value={user.id}>
              {user.email} ({user.first_name} {user.last_name})
            </option>
          ))}
        </select>
        <Button
          type="primary"
          onClick={handleAddMember}
          disabled={!selectedCandidate || adding}
          waiting={adding}
        >
          Add Member
        </Button>
      </div>

      <div className={rootClass.elem("list-container")}>
        {loading ? (
          <div className={rootClass.elem("loading")}>
            <Spinner />
          </div>
        ) : members.length > 0 ? (
          <ul className={rootClass.elem("list")}>
            {members.map((item) => (
              <li key={item.member.id} className={rootClass.elem("item")}>
                <div className={rootClass.elem("user-info")}>
                  <div className={rootClass.elem("avatar")}>
                    <IconPersonInCircle />
                  </div>
                  <div className={rootClass.elem("details")}>
                    <span className={rootClass.elem("email")}>{item.member.email}</span>
                    <span className={rootClass.elem("name")}>
                      {item.member.first_name} {item.member.last_name}
                    </span>
                  </div>
                </div>
                <Button
                  size="small"
                  look="danger"
                  type="text"
                  onClick={() => handleRemoveMember(item.member.id)}
                  icon={<IconTrash />}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className={rootClass.elem("empty")}>No members found</div>
        )}
      </div>
    </div>
  );
};
