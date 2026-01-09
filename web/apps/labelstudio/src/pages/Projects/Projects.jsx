import React, { useState, useEffect } from "react";
import { useParams as useRouterParams, useLocation, useHistory } from "react-router";
import { Redirect } from "react-router-dom";
import { Button, Spinner } from "@humansignal/ui";
import { Oneof } from "../../components/Oneof/Oneof";
import { ApiContext } from "../../providers/ApiProvider";
import { useContextProps } from "../../providers/RoutesProvider";
import { cn } from "../../utils/bem";
import { CreateProject } from "../CreateProject/CreateProject";
import { DataManagerPage } from "../DataManager/DataManager";
import { SettingsPage } from "../Settings";
import { EmptyProjectsList, ProjectsList } from "./ProjectsList";
import { useAbortController, useUpdatePageTitle } from "@humansignal/core";
import "./Projects.scss";

const getCurrentPage = () => {
  const pageNumberFromURL = new URLSearchParams(location.search).get("page");

  return pageNumberFromURL ? Number.parseInt(pageNumberFromURL) : 1;
};

const getWorkspaceId = () => {
  const workspaceIdFromURL = new URLSearchParams(location.search).get("workspace");
  return workspaceIdFromURL ? Number.parseInt(workspaceIdFromURL) : null;
};

export const ProjectsPage = () => {
  const api = React.useContext(ApiContext);
  const location = useLocation();
  const history = useHistory();
  const abortController = useAbortController();
  const [projectsList, setProjectsList] = React.useState([]);
  const [workspaces, setWorkspaces] = React.useState([]);
  const [networkState, setNetworkState] = React.useState(null);
  const [workspacesState, setWorkspacesState] = React.useState("loading");
  const [workspacesError, setWorkspacesError] = React.useState(null);
  const [currentPage, setCurrentPage] = useState(getCurrentPage());
  const [workspaceId, setWorkspaceId] = useState(getWorkspaceId());
  const [totalItems, setTotalItems] = useState(1);
  const setContextProps = useContextProps();

  useUpdatePageTitle("Projects");
  const defaultPageSize = Number.parseInt(localStorage.getItem("pages:projects-list") ?? 30);

  const [modal, setModal] = React.useState(false);

  const openModal = () => setModal(true);

  const closeModal = () => setModal(false);

  // 워크스페이스 목록 조회
  const fetchWorkspaces = async () => {
    setWorkspacesState("loading");
    try {
      const response = await api.callApi("workspaces", {
        signal: abortController.controller.current.signal,
        errorFilter: (e) => e.error.includes("aborted"),
      });

      // API 응답이 배열인지 객체인지 확인
      let workspacesList = [];
      if (Array.isArray(response)) {
        workspacesList = response;
      } else if (response?.results && Array.isArray(response.results)) {
        workspacesList = response.results;
      } else if (response && typeof response === "object") {
        // 단일 객체인 경우 배열로 변환
        workspacesList = [response];
      }

      console.log("Workspaces API response:", response);
      console.log("Workspaces list:", workspacesList);

      setWorkspaces(workspacesList);
      setWorkspacesState("loaded");

      // 워크스페이스가 있고 선택된 워크스페이스가 없으면 첫 번째 워크스페이스 선택
      if (workspacesList.length > 0 && !workspaceId) {
        const firstWorkspaceId = workspacesList[0].id;
        setWorkspaceId(firstWorkspaceId);
        history.replace(`/projects?workspace=${firstWorkspaceId}`);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
      setWorkspacesError(error?.message || "Failed to load workspaces");
      setWorkspacesState("error");
    }
  };

  const handleWorkspaceSelect = (wsId) => {
    setWorkspaceId(wsId);
    setCurrentPage(1);
    history.push(`/projects?workspace=${wsId}`);
  };

  // URL 파라미터 변경 감지
  useEffect(() => {
    const newWorkspaceId = getWorkspaceId();
    const newPage = getCurrentPage();
    if (newWorkspaceId !== workspaceId) {
      setWorkspaceId(newWorkspaceId);
    }
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  }, [location.search]);

  const fetchProjects = async (page = currentPage, pageSize = defaultPageSize, workspace = workspaceId) => {
    setNetworkState("loading");
    abortController.renew(); // Cancel any in flight requests

    const requestParams = { page, page_size: pageSize };

    // 워크스페이스 필터 추가
    if (workspace) {
      requestParams.workspace = workspace;
    }

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
  };

  const loadNextPage = async (page, pageSize) => {
    setCurrentPage(page);
    await fetchProjects(page, pageSize, workspaceId);
  };

  React.useEffect(() => {
    fetchWorkspaces();
  }, []);

  React.useEffect(() => {
    if (workspaceId) {
      fetchProjects(currentPage, defaultPageSize, workspaceId);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    // there is a nice page with Create button when list is empty
    // so don't show the context button in that case
    setContextProps({ openModal, showButton: projectsList.length > 0 });
  }, [projectsList.length]);

  return (
    <div className={cn("projects-page").toClassName()}>
      <div className={cn("projects-page").elem("sidebar").toClassName()}>
        <div className={cn("projects-page").elem("workspaces-list").toClassName()}>
          <h3 className={cn("projects-page").elem("section-title").toClassName()}>Workspaces</h3>
          <Oneof value={workspacesState}>
            <div className={cn("projects-page").elem("loading").toClassName()} case="loading">
              <Spinner size={32} />
            </div>
            <div className={cn("projects-page").elem("workspaces-content").toClassName()} case="loaded">
              {workspaces.length > 0 ? (
                workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    className={cn("projects-page")
                      .elem("workspace-item")
                      .mod({ active: workspace.id === workspaceId })
                      .toClassName()}
                    onClick={() => handleWorkspaceSelect(workspace.id)}
                  >
                    {workspace.title || `Workspace ${workspace.id}`}
                  </div>
                ))
              ) : (
                <div className={cn("projects-page").elem("empty-workspaces").toClassName()}>
                  No workspaces available
                </div>
              )}
            </div>
            <div className={cn("projects-page").elem("error").toClassName()} case="error">
              <div>{workspacesError || "Failed to load workspaces"}</div>
              <Button
                size="small"
                onClick={() => {
                  setWorkspacesState("loading");
                  setWorkspacesError(null);
                  fetchWorkspaces();
                }}
                style={{ marginTop: "8px" }}
              >
                Retry
              </Button>
            </div>
          </Oneof>
        </div>
      </div>
      <div className={cn("projects-page").elem("main-content").toClassName()}>
        <Oneof value={networkState}>
          <div className={cn("projects-page").elem("loading").toClassName()} case="loading">
            <Spinner size={64} />
          </div>
          <div className={cn("projects-page").elem("content").toClassName()} case="loaded">
            {projectsList.length ? (
              <ProjectsList
                projects={projectsList}
                currentPage={currentPage}
                totalItems={totalItems}
                loadNextPage={loadNextPage}
                pageSize={defaultPageSize}
              />
            ) : (
              <EmptyProjectsList openModal={openModal} />
            )}
            {modal && <CreateProject onClose={closeModal} />}
          </div>
        </Oneof>
      </div>
    </div>
  );
};

ProjectsPage.title = "Projects";
ProjectsPage.path = "/projects";
ProjectsPage.exact = true;
ProjectsPage.routes = ({ store }) => [
  {
    title: () => store.project?.title,
    path: "/:id(\\d+)",
    exact: true,
    component: () => {
      const params = useRouterParams();

      return <Redirect to={`/projects/${params.id}/data`} />;
    },
    pages: {
      DataManagerPage,
      SettingsPage,
    },
  },
];
ProjectsPage.context = ({ openModal, showButton }) => {
  if (!showButton) return null;
  return (
    <Button onClick={openModal} size="small" aria-label="Create new project">
      Create
    </Button>
  );
};
