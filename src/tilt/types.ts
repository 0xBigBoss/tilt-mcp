/**
 * Tilt resource type definitions
 * Based on real Tilt API output from `tilt get uiresources -o json`
 *
 * These types match the actual Kubernetes-style resources returned by Tilt.
 * Reference: Tilt v0.35.0
 */

/**
 * Runtime status of a resource
 */
export type RuntimeStatus =
  | 'ok'
  | 'error'
  | 'warning'
  | 'pending'
  | 'not_applicable';

/**
 * Condition status (K8s-style)
 */
export type ConditionStatus = 'True' | 'False' | 'Unknown';

/**
 * Resource spec type
 */
export type ResourceType = 'local' | 'docker-compose' | 'k8s' | 'image';

/**
 * Disable/Enable state
 */
export type DisableState = 'Enabled' | 'Disabled';

/**
 * K8s-style owner reference
 */
export interface OwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
  controller?: boolean;
  blockOwnerDeletion?: boolean;
}

/**
 * K8s-style resource metadata
 */
export interface ResourceMetadata {
  name: string;
  uid: string;
  creationTimestamp: string;
  resourceVersion: string;
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
  ownerReferences?: OwnerReference[];
}

/**
 * Build history record
 */
export interface BuildRecord {
  startTime: string;
  finishTime?: string;
  spanID?: string;
  error?: string;
  warnings?: string[];
  isCrashRebuild?: boolean;
}

/**
 * K8s-style condition
 */
export interface ResourceCondition {
  type: string;
  status: ConditionStatus;
  lastTransitionTime: string;
  reason?: string;
  message?: string;
}

/**
 * ConfigMap reference for disable status
 */
export interface ConfigMapRef {
  name: string;
  key: string;
}

/**
 * Disable status source
 */
export interface DisableSource {
  configMap?: ConfigMapRef;
}

/**
 * Disable status information
 */
export interface DisableStatus {
  state: DisableState;
  enabledCount: number;
  disabledCount: number;
  sources?: DisableSource[];
}

/**
 * Endpoint link (for accessing services)
 */
export interface EndpointLink {
  url: string;
  name?: string;
}

/**
 * Resource spec identifier
 */
export interface ResourceSpec {
  id: string;
  type: ResourceType;
}

/**
 * Local resource information
 */
export interface LocalResourceInfo {
  pid?: number;
}

/**
 * Docker Compose resource information
 */
export interface ComposeResourceInfo {
  healthStatus?: string;
}

/**
 * Kubernetes resource information
 */
export interface K8sResourceInfo {
  podName?: string;
  podCreationTime?: string;
  podUpdateStartTime?: string;
  podStatus?: string;
  podRestarts?: number;
  allContainersReady?: boolean;
  spanID?: string;
}

/**
 * Resource status information
 */
export interface ResourceStatus {
  runtimeStatus: RuntimeStatus;
  updateStatus?: string;
  buildHistory?: BuildRecord[];
  conditions?: ResourceCondition[];
  disableStatus?: DisableStatus;
  endpointLinks?: EndpointLink[];
  specs?: ResourceSpec[];
  localResourceInfo?: LocalResourceInfo;
  composeResourceInfo?: ComposeResourceInfo;
  k8sResourceInfo?: K8sResourceInfo;
  lastDeployTime?: string | null;
  pendingBuildSince?: string | null;
  hasPendingChanges?: boolean;
  order?: number;
}

/**
 * Tilt UIResource (main resource type)
 */
export interface UIResource {
  apiVersion: string;
  kind: 'UIResource';
  metadata: ResourceMetadata;
  spec: Record<string, unknown>;
  status: ResourceStatus;
}

/**
 * List of UIResources (K8s-style list)
 */
export interface UIResourceList {
  apiVersion: string;
  items: UIResource[];
}

/**
 * Tilt Session information
 */
export interface TiltSession {
  apiVersion: string;
  kind: 'Session';
  metadata: ResourceMetadata;
  spec: {
    tiltfilePath: string;
    exitCondition: string;
    ci?: {
      timeout: string;
      readinessTimeout: string;
    };
  };
  status: {
    done: boolean;
    pid?: number;
    startTime: string;
    targets?: Array<{
      name: string;
      type: string;
      state: Record<string, unknown>;
      resources: string[];
    }>;
  };
}

/**
 * Log line from WebSocket or logs command
 */
export interface LogLine {
  spanID?: string;
  text: string;
  level?: 'info' | 'warn' | 'error' | 'debug';
  time?: string;
  fields?: Record<string, unknown>;
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  type: 'resource' | 'log' | 'error';
  payload: UIResource | LogLine | { message: string };
}
