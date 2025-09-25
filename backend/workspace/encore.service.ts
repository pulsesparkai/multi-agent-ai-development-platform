import { Service } from "encore.dev/service";

export default new Service("workspace");

export { startBuild, getBuildStatus, startPreview, stopPreview, getPreviewUrl } from "./build";
export { applyFileChanges, getFileDiff, revertChanges } from "./filesystem";
export { executeAIAction, getWorkspaceStatus } from "./manager";