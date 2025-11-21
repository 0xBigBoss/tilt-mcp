/**
 * Response transformer utilities for Tilt MCP tools
 *
 * These functions transform verbose K8s-style responses into slim, LLM-friendly formats.
 */
import type { EndpointLink, UIResource } from './types';

/**
 * Regex pattern for ANSI escape codes
 * Matches SGR sequences (colors, styles) and other CSI sequences
 * biome-ignore lint/complexity/useRegexLiterals: Using RegExp constructor for readability with unicode escapes
 */
const ANSI_PATTERN = new RegExp(
  '[\\u001b\\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]',
  'g',
);

// ============================================================================
// Types
// ============================================================================

/**
 * Computed status derived from K8s conditions
 */
export type ComputedStatus =
  | 'ok'
  | 'error'
  | 'pending'
  | 'building'
  | 'disabled';

/**
 * Slim resource format for LLM consumption
 */
export interface SlimResource {
  name: string;
  type: string;
  status: ComputedStatus;
  ready: boolean;
  upToDate: boolean;
  hasPendingChanges: boolean;
  endpoint?: string;
  labels: string[];
  lastError?: string;
  lastDeployTime?: string;
  runtimeStatus?: string;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Strip ANSI escape codes from log output
 */
export function stripAnsiCodes(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

/**
 * Derive simple status from K8s conditions
 */
export function deriveStatus(resource: UIResource): ComputedStatus {
  const status = resource.status;

  // Check disabled first
  if (status?.disableStatus?.state === 'Disabled') return 'disabled';

  // Check conditions
  const conditions = status?.conditions ?? [];
  const ready = conditions.find((c) => c.type === 'Ready');
  const upToDate = conditions.find((c) => c.type === 'UpToDate');

  // Check for errors
  if (ready?.reason === 'UpdateError' || upToDate?.reason === 'UpdateError')
    return 'error';
  if (status?.runtimeStatus === 'error') return 'error';

  // Check for building/pending
  if (status?.updateStatus === 'in_progress') return 'building';
  if (status?.updateStatus === 'pending' || status?.hasPendingChanges)
    return 'pending';

  // If ready and up to date, it's ok
  if (ready?.status === 'True' && upToDate?.status === 'True') return 'ok';

  return 'pending';
}

/**
 * Deduplicate endpoint links, preferring named endpoints
 */
export function dedupeEndpoints(
  links: EndpointLink[] | undefined,
): EndpointLink[] {
  if (!links?.length) return [];

  const byUrl = new Map<string, EndpointLink>();
  for (const link of links) {
    const normalizedUrl = link.url.replace(/\/$/, ''); // Remove trailing slash
    const existing = byUrl.get(normalizedUrl);
    if (!existing || (link.name && !existing.name)) {
      byUrl.set(normalizedUrl, link);
    }
  }
  return [...byUrl.values()];
}

/**
 * Get the primary endpoint URL from a resource
 */
export function extractPrimaryEndpoint(
  resource: UIResource,
): string | undefined {
  const links = resource.status?.endpointLinks;
  if (!links?.length) return undefined;

  // Prefer named endpoints
  const named = links.find((l) => l.name);
  return (named ?? links[0])?.url;
}

/**
 * Extract error message if resource is in error state
 */
export function extractError(resource: UIResource): string | undefined {
  const status = resource.status;

  // Check conditions for error messages
  const conditions = status?.conditions ?? [];
  for (const condition of conditions) {
    if (condition.reason === 'UpdateError' && condition.message) {
      return condition.message;
    }
  }

  // Check last build error
  const buildHistory = status?.buildHistory;
  if (buildHistory?.length) {
    const lastBuild = buildHistory[buildHistory.length - 1];
    if (lastBuild.error) return lastBuild.error;
  }

  return undefined;
}

/**
 * Transform full UIResource to slim format
 */
export function toSlimResource(resource: UIResource): SlimResource {
  const computedStatus = deriveStatus(resource);
  const conditions = resource.status?.conditions ?? [];

  return {
    name: resource.metadata.name,
    type: resource.status?.specs?.[0]?.type ?? 'unknown',
    status: computedStatus,
    ready: conditions.some((c) => c.type === 'Ready' && c.status === 'True'),
    upToDate: conditions.some(
      (c) => c.type === 'UpToDate' && c.status === 'True',
    ),
    hasPendingChanges: resource.status?.hasPendingChanges ?? false,
    endpoint: extractPrimaryEndpoint(resource),
    labels: Object.keys(resource.metadata?.labels ?? {}),
    lastError: computedStatus === 'error' ? extractError(resource) : undefined,
    lastDeployTime: resource.status?.lastDeployTime ?? undefined,
    runtimeStatus: resource.status?.runtimeStatus,
  };
}

/**
 * Clean a resource by removing K8s boilerplate but preserving structure
 */
export function cleanResource(resource: UIResource): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {
    name: resource.metadata.name,
    labels: resource.metadata.labels ?? {},
  };

  if (resource.status) {
    const status = { ...resource.status };

    // Dedupe endpoints
    if (status.endpointLinks) {
      status.endpointLinks = dedupeEndpoints(status.endpointLinks);
    }

    // Truncate build history to last 2
    if (status.buildHistory?.length && status.buildHistory.length > 2) {
      status.buildHistory = status.buildHistory.slice(-2);
    }

    cleaned.status = status;
  }

  return cleaned;
}
