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
import { WorkspacesSidebar } from "./WorkspacesSidebar";
import { WorkspaceMembers } from "./WorkspaceMembers";
import { WorkspaceData } from "./WorkspaceData";
import { ToggleItems } from "../../components/ToggleItems/ToggleItems";
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
  const [networkState, setNetworkState] = React.useState(null);
  const [currentPage, setCurrentPage] = useState(getCurrentPage());
  const [workspaceId, setWorkspaceId] = useState(getWorkspaceId());
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [totalItems, setTotalItems] = useState(1);
  const setContextProps = useContextProps();
  
  // 탭 상태 관리: 'projects', 'members', 'data'
  const [activeTab, setActiveTab] = useState("projects");

  useUpdatePageTitle("Projects");
  const defaultPageSize = Number.parseInt(localStorage.getItem("pages:projects-list") ?? 30);

  const [createModal, setCreateModal] = React.useState(false);

  const openCreateModal = () => setCreateModal(true);
  const closeCreateModal = () => setCreateModal(false);

  const handleWorkspaceSelect = (wsId) => {
    setWorkspaceId(wsId);
    setCurrentPage(1);
    setActiveTab("projects"); // 워크스페이스 변경 시 프로젝트 탭으로 리셋
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

  // 워크스페이스 정보 조회
  const fetchCurrentWorkspace = async () => {
    if (!workspaceId) {
      setCurrentWorkspace(null);
      return;
    }
    try {
      const data = await api.callApi("workspace", {
        params: { pk: workspaceId },
      });
      setCurrentWorkspace(data);
    } catch (err) {
      console.error("Failed to fetch workspace details:", err);
    }
  };

  useEffect(() => {
    fetchCurrentWorkspace();
  }, [workspaceId]);

  const fetchProjects = async (page = currentPage, pageSize = defaultPageSize, workspace = workspaceId) => {
    setNetworkState("loading");
    abortController.renew(); // Cancel any in flight requests

    const requestParams = { page, page_size: pageSize };
    
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
      console.error("Failed to fetch projects:", error);
      setNetworkState("error");
    }
  };

  const loadNextPage = async (page, pageSize) => {
    setCurrentPage(page);
    await fetchProjects(page, pageSize, workspaceId);
  };

  React.useEffect(() => {
    fetchProjects(currentPage, defaultPageSize, workspaceId);
  }, [workspaceId]);

  React.useEffect(() => {
    // context button 제거 (헤더에 직접 넣었으므로)
    setContextProps({ openModal: openCreateModal, showButton: false });
  }, [projectsList.length]);

  // 탭 정의
  const tabs = React.useMemo(() => {
    const items = {
      projects: "Projects List",
    };
    if (currentWorkspace) {
      items.members = "Manage Members";
      items.data = "Manage Data";
    }
    return items;
  }, [currentWorkspace]);

  return (
    <div className={cn("projects-page").toClassName()}>
      <WorkspacesSidebar 
        selectedWorkspaceId={workspaceId} 
        onSelectWorkspace={handleWorkspaceSelect}
      />
      
      <div className={cn("projects-page").elem("main-content").toClassName()}>
        <div className={cn("projects-page").elem("header")}>
          <div className={cn("projects-page").elem("header-top")}>
            <h1 className={cn("projects-page").elem("title")}>
              {currentWorkspace ? currentWorkspace.title : "All Projects"}
            </h1>
            <div className={cn("projects-page").elem("controls")}>
              <Button onClick={openCreateModal} look="primary" size="medium">
                Create Project
              </Button>
            </div>
          </div>
          
          {/* 탭 네비게이션: 워크스페이스가 선택되었을 때만 표시 */}
          {currentWorkspace && (
             <div className={cn("projects-page").elem("tabs")}>
               <ToggleItems items={tabs} active={activeTab} onSelect={setActiveTab} />
             </div>
          )}
        </div>

        <div className={cn("projects-page").elem("content-area")}>
          {activeTab === "projects" && (
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
                  <EmptyProjectsList openModal={openCreateModal} />
                )}
                {createModal && <CreateProject onClose={closeCreateModal} />}
              </div>
              <div className={cn("projects-page").elem("error").toClassName()} case="error">
                Failed to load projects
              </div>
            </Oneof>
          )}

          {activeTab === "members" && currentWorkspace && (
            <div className={cn("projects-page").elem("tab-content")}>
              <WorkspaceMembers workspace={currentWorkspace} />
            </div>
          )}

          {activeTab === "data" && currentWorkspace && (
            <div className={cn("projects-page").elem("tab-content")}>
               <WorkspaceData />
            </div>
          )}
        </div>
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
