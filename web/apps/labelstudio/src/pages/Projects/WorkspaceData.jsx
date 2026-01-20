import React from "react";
import { Button } from "@humansignal/ui";
import { IconUpload, IconCloudCustom, IconCloudProviderAzure, IconCloudProviderGCS, IconCloudProviderS3 } from "@humansignal/icons";
import { cn } from "../../utils/bem";
import "./WorkspaceData.scss";

export const WorkspaceData = () => {
  const rootClass = cn("workspace-data");

  return (
    <div className={rootClass}>
      <div className={rootClass.elem("container")}>
        <div className={rootClass.elem("icon-wrapper")}>
           <IconUpload width="64" height="64" className={rootClass.elem("main-icon")} />
        </div>
        
        <h2 className={rootClass.elem("title")}>Import data to get your project started</h2>
        
        <p className={rootClass.elem("description")}>
          Connect your cloud storage or upload files from your computer
        </p>
        
        <div className={rootClass.elem("providers")}>
          <IconCloudCustom className={rootClass.elem("provider-icon")} />
          <IconCloudProviderGCS className={rootClass.elem("provider-icon")} />
          <IconCloudProviderAzure className={rootClass.elem("provider-icon")} />
          <IconCloudProviderS3 className={rootClass.elem("provider-icon")} />
        </div>
        
        <div className={rootClass.elem("actions")}>
          <Button look="primary" size="large">Connect Cloud Storage</Button>
          <Button look="outlined" size="large">Import</Button>
        </div>
        
        <a href="https://labelstud.io/guide/ingest.html" target="_blank" rel="noopener noreferrer" className={rootClass.elem("link")}>
          See docs on importing data
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginLeft: 4}}>
            <path d="M6 1H11V6M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>
    </div>
  );
};
