import React, { useState, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Button, Spinner } from "@humansignal/ui";
import { Oneof } from "../../components/Oneof/Oneof";
import { ApiContext } from "../../providers/ApiProvider";
import { useContextProps } from "../../providers/RoutesProvider";
import { cn } from "../../utils/bem";
import { useAbortController, useUpdatePageTitle } from "@humansignal/core";
import { ProjectsList, EmptyProjectsList } from "../Projects/ProjectsList";
import { CreateProject } from "../CreateProject/CreateProject";
import "./WorkspacesPage.scss";

const getCurrentPage = () => {
  const pageNumberFromURL = new URLSearchParams(location.search).get("page");
  return pageNumberFromURL ? Number.parseInt(pageNumberFromURL) : 1;
};

const getWorkspaceId = () => {
  const workspaceIdFromURL = new URLSearchParams(location.search).get("workspace");
  return workspaceIdFromURL ? Number.parseInt(workspaceIdFromURL) : null;
};

export const WorkspacesPage = () => {
  const api = React.useContext(ApiContext);
  const history = useHistory();
  const location = useLocation();
  const abortController = useAbortController();
  const [workspaces, setWorkspaces] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [networkState, setNetworkState] = useState(null);
  const [workspacesState, setWorkspacesState] = useState(null);
  const [currentPage, setCurrentPage] = useState(getCurrentPage());
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(getWorkspaceId());
  const [totalItems, setTotalItems] = useState(1);
  const setContextProps = useContextProps();

  useUpdatePageTitle("Workspaces");
  const defaultPageSize = Number.parseInt(localStorage.getItem("pages:projects-list") ?? 30);

  const [modal, setModal] = useState(false);

  const openModal = () => setModal(true);
  const closeModal = () => setModal(false);

  // URL 파라미터 변경 감지
  useEffect(() => {
    const newWorkspaceId = getWorkspaceId();
    const newPage = getCurrentPage();
    if (newWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(newWorkspaceId);
    }
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  }, [location.search]);

  // 워크스페이스 목록 조회
  const fetchWorkspaces = async () => {
    setWorkspacesState("loading");
    try {
      const data = await api.callApi("workspaces", {
        signal: abortController.controller.current.signal,
        errorFilter: (e) => e.error.includes("aborted"),
      });
      setWorkspaces(data?.results ?? []);
      setWorkspacesState("loaded");

      // 워크스페이스가 있고 선택된 워크스페이스가 없으면 첫 번째 워크스페이스 선택
      if (data?.results?.length > 0 && !selectedWorkspaceId) {
        const firstWorkspaceId = data.results[0].id;
        setSelectedWorkspaceId(firstWorkspaceId);
        history.replace(`/projects?workspace=${firstWorkspaceId}`);
      }
    } catch (error) {
      setWorkspacesState("error");
    }
  };

  // 프로젝트 목록 조회
  const fetchProjects = async (page = currentPage, pageSize = defaultPageSize, workspace = selectedWorkspaceId) => {
    if (!workspace) return;

    setNetworkState("loading");
    abortController.renew();

    const requestParams = { page, page_size: pageSize, workspace };

    requestParams.include = [
      "id",
      "title",
      "created_by",
      "created_at",
      "color",
      "is_published",
      "assignment_settings",
      "state",
    ].join(",");

    try {
      const data = await api.callApi("projects", {
        params: requestParams,
        signal: abortController.controller.current.signal,
        errorFilter: (e) => e.error.includes("aborted"),
      });

      setTotalItems(data?.count ?? 1);
      setProjectsList(data.results ?? []);
      setNetworkState("loaded");

      if (data?.results?.length) {
        const additionalData = await api.callApi("projects", {
          params: {
            ids: data?.results?.map(({ id }) => id).join(","),
            include: [
              "id",
              "description",
              "num_tasks_with_annotations",
              "task_number",
              "skipped_annotations_number",
              "total_annotations_number",
              "total_predictions_number",
              "ground_truth_number",
              "finished_task_number",
            ].join(","),
            page_size: pageSize,
          },
          signal: abortController.controller.current.signal,
          errorFilter: (e) => e.error.includes("aborted"),
        });

        if (additionalData?.results?.length) {
          setProjectsList((prev) =>
            additionalData.results.map((project) => {
              const prevProject = prev.find(({ id }) => id === project.id);
              return {
                ...prevProject,
                ...project,
              };
            }),
          );
        }
      }
    } catch (error) {
      setNetworkState("error");
    }
  };

  const loadNextPage = async (page, pageSize) => {
    setCurrentPage(page);
    await fetchProjects(page, pageSize, selectedWorkspaceId);
  };

  const handleWorkspaceSelect = (workspaceId) => {
    setSelectedWorkspaceId(workspaceId);
    setCurrentPage(1);
    history.push(`/projects?workspace=${workspaceId}`);
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      fetchProjects(currentPage, defaultPageSize, selectedWorkspaceId);
    }
  }, [selectedWorkspaceId]);

  useEffect(() => {
    setContextProps({ openModal, showButton: projectsList.length > 0 });
  }, [projectsList.length]);

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);

  return (
    <div className={cn("workspaces-page").toClassName()}>
      <div className={cn("workspaces-page").elem("sidebar").toClassName()}>
        <div className={cn("workspaces-page").elem("workspaces-list").toClassName()}>
          <h3 className={cn("workspaces-page").elem("section-title").toClassName()}>Workspaces</h3>
          <Oneof value={workspacesState}>
            <div className={cn("workspaces-page").elem("loading").toClassName()} case="loading">
              <Spinner size={32} />
            </div>
            <div className={cn("workspaces-page").elem("workspaces-content").toClassName()} case="loaded">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className={cn("workspaces-page")
                    .elem("workspace-item")
                    .mod({ active: workspace.id === selectedWorkspaceId })
                    .toClassName()}
                  onClick={() => handleWorkspaceSelect(workspace.id)}
                >
                  {workspace.title || `Workspace ${workspace.id}`}
                </div>
              ))}
            </div>
            <div className={cn("workspaces-page").elem("error").toClassName()} case="error">
              Failed to load workspaces
            </div>
          </Oneof>
        </div>
      </div>
      <div className={cn("workspaces-page").elem("content").toClassName()}>
        {selectedWorkspace && (
          <div className={cn("workspaces-page").elem("header").toClassName()}>
            <h2>{selectedWorkspace.title || `Workspace ${selectedWorkspace.id}`}</h2>
          </div>
        )}
        <Oneof value={networkState}>
          <div className={cn("workspaces-page").elem("loading").toClassName()} case="loading">
            <Spinner size={64} />
          </div>
          <div className={cn("workspaces-page").elem("projects-content").toClassName()} case="loaded">
            {projectsList.length ? (
              <ProjectsList
                projects={projectsList}
                currentPage={currentPage}
                totalItems={totalItems}
                loadNextPage={loadNextPage}
                pageSize={defaultPageSize}
              />
            ) : selectedWorkspaceId ? (
              <EmptyProjectsList openModal={openModal} />
            ) : (
              <div className={cn("workspaces-page").elem("empty").toClassName()}>
                <p>Select a workspace to view projects</p>
              </div>
            )}
          </div>
          <div className={cn("workspaces-page").elem("error").toClassName()} case="error">
            Failed to load projects
          </div>
        </Oneof>
        {modal && <CreateProject onClose={closeModal} />}
      </div>
    </div>
  );
};

WorkspacesPage.title = "Workspaces";
WorkspacesPage.path = "/projects";
WorkspacesPage.exact = true;
WorkspacesPage.context = ({ openModal, showButton }) => {
  if (!showButton) return null;
  return (
    <Button onClick={openModal} size="small" aria-label="Create new project">
      Create Project
    </Button>
  );
};
