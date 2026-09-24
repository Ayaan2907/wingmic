export { WingmicApiClient, type FetchLike } from './client';
export { ConfigError, DEFAULT_API_BASE_URL, loadConfig } from './config';
export { WingmicApiError, isWingmicApiError } from './errors';
export {
  createWingmicServer,
  matchPerson,
  personNeighborhood,
  runStdioServer,
  SERVER_NAME,
  SERVER_VERSION,
  TOOL_SCOPES,
} from './server';
export type { ToolName } from './server';
export { formatToolError } from './tool-errors';
export type {
  ApiErrorCode,
  ApiScope,
  CaptureExtracted,
  CaptureInput,
  CaptureResponse,
  GraphLink,
  GraphNode,
  GraphResponse,
  McpConfig,
  PeopleResponse,
  Person,
  RecallEntity,
  RecallResponse,
} from './types';
