# MCP Response Optimization Plan

## Problem Statement

The Tilt MCP tools return excessively large responses that fill up LLM context quickly:

- `tilt_status` returned ~19.8k tokens (full resource list with Kubernetes metadata)
- `tilt_get_resources` returned ~18.3k tokens (same data, slightly different format)
- Both responses were **truncated** at 25,000 token limit
- 36 resources × ~500 tokens each = context exhaustion

This makes the tools impractical for real-world use where LLM context is precious.

## Root Causes

### 1. Raw Kubernetes Metadata Passthrough
Each resource includes ~30 lines of noise:
```json
{
  "apiVersion": "tilt.dev/v1alpha1",    // Always the same
  "kind": "UIResource",                  // Always the same
  "metadata": {
    "annotations": {...},                // Rarely needed
    "creationTimestamp": "...",         // Rarely needed
    "labels": {...},                     // Occasionally useful
    "ownerReferences": [...],           // Internal reference
    "resourceVersion": "10644",         // Internal
    "uid": "cc71864f-..."               // Internal
  }
}
```

### 2. Redundant Status Fields
```json
"status": {
  "buildHistory": [{...}, {...}],        // Full history, not just latest
  "conditions": [                        // Raw K8s conditions
    {"lastTransitionTime": "...", "status": "True", "type": "UpToDate"},
    {"lastTransitionTime": "...", "status": "True", "type": "Ready"}
  ],
  "disableStatus": {                     // Verbose enable/disable info
    "disabledCount": 0,
    "enabledCount": 1,
    "sources": [...],
    "state": "Enabled"
  }
}
```

### 3. Duplicate Endpoint Links
Many resources have the same endpoint listed twice (named and unnamed):
```json
"endpointLinks": [
  {"url": "http://localhost:8880/"},                    // Duplicate
  {"name": "Keycloak Console", "url": "http://localhost:8880"}  // Keep this one
]
```

### 4. No Summary Mode
`tilt_status` includes full resource list instead of a summary. LLMs need:
- Quick status overview first
- Detailed resource info on demand

### 5. Redundant Tool Calls
Calling `tilt_status` + `tilt_get_resources` returns essentially the same data twice.

---

## Proposed Improvements

### Phase 1: Response Compression (Quick Wins)

#### 1.1 Add `summary` mode (default) vs `verbose` mode

```typescript
// schemas.ts
export const TiltGetResourcesInput = TiltBaseInput.extend({
  filter: FilterSchema.optional(),
  labels: z.array(LabelSchema).optional(),
  verbose: z.boolean().optional().default(false),  // NEW
});
```

**Summary mode output (~50 tokens per resource):**
```json
{
  "name": "web-app",
  "type": "local",
  "status": "ok",           // Derived: ok | error | pending | building | disabled
  "ready": true,
  "upToDate": true,
  "endpoint": "http://localhost:3001",
  "labels": ["web"]
}
```

**Verbose mode:** Current full output (for debugging)

#### 1.2 Transform `tilt_status` to return summary only

```json
{
  "sessionActive": true,
  "resourceCount": 36,
  "summary": {
    "ok": 28,
    "error": 1,
    "pending": 3,
    "disabled": 4
  },
  "errors": [
    {
      "name": "api-gateway-test",
      "error": "Command \"yarn workspace @canton/api-gateway test\" failed: exit status 1"
    }
  ],
  "connectionInfo": { "port": 10350, "host": "localhost" }
}
```

**Token reduction:** ~19k → ~200 tokens (99% reduction)

#### 1.3 Deduplicate endpoint links

Keep only named endpoints, or first unnamed if no named exists:
```typescript
function dedupeEndpoints(links: EndpointLink[]): EndpointLink[] {
  const byUrl = new Map<string, EndpointLink>();
  for (const link of links) {
    const existing = byUrl.get(link.url);
    if (!existing || (link.name && !existing.name)) {
      byUrl.set(link.url, link);
    }
  }
  return [...byUrl.values()];
}
```

### Phase 2: Filtering & Pagination

#### 2.1 Add status filter to `tilt_get_resources`

```typescript
export const TiltGetResourcesInput = TiltBaseInput.extend({
  filter: FilterSchema.optional(),
  labels: z.array(LabelSchema).optional(),
  status: z.enum(['ok', 'error', 'pending', 'building', 'disabled', 'all']).optional().default('all'),
  verbose: z.boolean().optional().default(false),
});
```

**Use case:** `tilt_get_resources({ status: 'error' })` → returns only failing resources

#### 2.2 Add pagination

```typescript
export const TiltGetResourcesInput = TiltBaseInput.extend({
  // ... existing
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});
```

**Response includes pagination info:**
```json
{
  "resources": [...],
  "pagination": {
    "total": 36,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Phase 3: Computed Status Fields

#### 3.1 Derive simple status from conditions

```typescript
function deriveStatus(resource: Resource): 'ok' | 'error' | 'pending' | 'building' | 'disabled' {
  const status = resource.status;

  if (status?.disableStatus?.state === 'Disabled') return 'disabled';

  const ready = status?.conditions?.find(c => c.type === 'Ready');
  const upToDate = status?.conditions?.find(c => c.type === 'UpToDate');

  if (ready?.reason === 'UpdateError' || upToDate?.reason === 'UpdateError') return 'error';
  if (status?.updateStatus === 'pending' || status?.hasPendingChanges) return 'pending';
  if (status?.updateStatus === 'in_progress') return 'building';
  if (ready?.status === 'True' && upToDate?.status === 'True') return 'ok';

  return 'pending';
}
```

#### 3.2 Extract primary endpoint

```typescript
function getPrimaryEndpoint(resource: Resource): string | undefined {
  const links = resource.status?.endpointLinks;
  if (!links?.length) return undefined;

  // Prefer named endpoints
  const named = links.find(l => l.name);
  return (named ?? links[0])?.url;
}
```

### Phase 4: Response Schema Optimization

#### 4.1 Define slim resource schema

```typescript
interface SlimResource {
  name: string;
  type: 'local' | 'docker-compose' | 'k8s';
  status: 'ok' | 'error' | 'pending' | 'building' | 'disabled';
  ready: boolean;
  upToDate: boolean;
  endpoint?: string;
  labels: string[];
  lastError?: string;  // Only if status === 'error'
  lastDeployTime?: string;
}
```

#### 4.2 Create transformer

```typescript
function toSlimResource(resource: Resource): SlimResource {
  const status = deriveStatus(resource);
  const conditions = resource.status?.conditions ?? [];

  return {
    name: resource.metadata.name,
    type: extractType(resource),
    status,
    ready: conditions.some(c => c.type === 'Ready' && c.status === 'True'),
    upToDate: conditions.some(c => c.type === 'UpToDate' && c.status === 'True'),
    endpoint: getPrimaryEndpoint(resource),
    labels: Object.keys(resource.metadata?.labels ?? {}),
    lastError: status === 'error' ? extractError(resource) : undefined,
    lastDeployTime: resource.status?.lastDeployTime ?? undefined,
  };
}
```

---

## Implementation Checklist

### Quick Wins (Phase 1)
- [ ] Add `verbose` parameter to `tilt_get_resources` (default: false)
- [ ] Create `toSlimResource()` transformer
- [ ] Refactor `tilt_status` to return summary only (remove full resource list)
- [ ] Add `deriveStatus()` function
- [ ] Deduplicate endpoint links

### Medium Term (Phase 2)
- [ ] Add `status` filter parameter
- [ ] Add `limit`/`offset` pagination
- [ ] Add pagination metadata to response

### Nice to Have (Phase 3-4)
- [ ] Create `tilt_list_errors` convenience tool
- [ ] Add `fields` parameter for selective field return
- [ ] Cache resource list for pagination (session-scoped)

---

## Expected Token Reduction

| Tool | Before | After (Summary) | Reduction |
|------|--------|-----------------|-----------|
| `tilt_status` | ~19,800 | ~200 | **99%** |
| `tilt_get_resources` (all) | ~18,300 | ~1,800 | **90%** |
| `tilt_get_resources` (verbose) | ~18,300 | ~18,300 | 0% (opt-in) |
| `tilt_get_resources` (status=error) | ~18,300 | ~50 | **99.7%** |

---

## Example Optimized Responses

### `tilt_status`
```json
{
  "sessionActive": true,
  "resourceCount": 36,
  "summary": { "ok": 28, "error": 1, "pending": 3, "disabled": 4 },
  "errors": [
    { "name": "api-gateway-test", "error": "exit status 1" }
  ],
  "connection": { "port": 10350, "host": "localhost" }
}
```

### `tilt_get_resources` (summary mode, default)
```json
{
  "resources": [
    { "name": "web-app", "status": "ok", "ready": true, "endpoint": "http://localhost:3001", "labels": ["web"] },
    { "name": "api-gateway", "status": "ok", "ready": true, "endpoint": "http://localhost:8787", "labels": ["api-gateway"] },
    { "name": "api-gateway-test", "status": "error", "ready": false, "lastError": "exit status 1", "labels": ["testing"] }
  ],
  "pagination": { "total": 36, "limit": 20, "offset": 0, "hasMore": true }
}
```

### `tilt_get_resources({ status: 'error' })`
```json
{
  "resources": [
    { "name": "api-gateway-test", "status": "error", "ready": false, "lastError": "Command \"yarn...\" failed: exit status 1", "labels": ["testing"] }
  ],
  "pagination": { "total": 1, "limit": 20, "offset": 0, "hasMore": false }
}
```

---

## Backward Compatibility

All changes are backward compatible:
- `verbose: true` returns current full response
- New parameters have sensible defaults
- `tilt_describe_resource` unchanged (already single-resource focused)

## Testing Strategy

1. Add tests for `toSlimResource()` transformer
2. Add tests for `deriveStatus()` function
3. Add tests for endpoint deduplication
4. Add integration tests comparing token counts before/after
5. Verify verbose mode still returns full data

---

## Full Tool Analysis

### Tool Efficiency Summary

| Tool | Output Size | Status | Action Required |
|------|-------------|--------|-----------------|
| `tilt_discover` | ~100 bytes | Efficient | None |
| `tilt_status` | ~19.8k tokens | Inefficient | Refactor to summary |
| `tilt_get_resources` | ~18.3k tokens | Inefficient | Add summary mode |
| `tilt_describe_resource` | ~2.4KB | Broken | Fix CLI command (see BUGS.md) |
| `tilt_logs` | Variable | Risk | Add default `tailLines` |
| `tilt_trigger` | ~200 bytes | Efficient | None |
| `tilt_enable` | ~200 bytes | Efficient | None |
| `tilt_disable` | ~200 bytes | Efficient | None |
| `tilt_wait` | Variable | Risk | Trim `output` field |
| `tilt_dump` | **6.8MB** | Critical | Remove or add summary mode |

---

### Tool-by-Tool Analysis

#### `tilt_discover`
**Status:** Efficient
**Output:** ~100 bytes
```json
[{"host": "localhost", "port": 10350, "sessionActive": true}]
```
**Recommendation:** No changes needed.

---

#### `tilt_status`
**Status:** Inefficient
**Output:** ~19.8k tokens (truncated)
**Issue:** Returns full resource list instead of summary.
**Recommendation:** Return summary only (see Phase 1.2 above).

---

#### `tilt_get_resources`
**Status:** Inefficient
**Output:** ~18.3k tokens (truncated)
**Issue:** Full K8s metadata for every resource.
**Recommendation:** Add `verbose` parameter, default to slim format.

---

#### `tilt_describe_resource`
**Status:** Broken
**Issue:** Uses `tilt describe -o json` which doesn't exist.
**Error:** `unknown shorthand flag: 'o' in -o`
**Fix:** Use `tilt get uiresource/NAME -o json` instead.
**See:** `BUGS.md#BUG-001`

---

#### `tilt_logs`
**Status:** Moderate Risk
**Output:** Variable (potentially huge)
**Issue:** No default limit on log lines.
**Current:** Has `tailLines` parameter but it's optional.

**Recommendation:** Add sensible default:
```typescript
tailLines: z.number().int().positive().max(10000).optional().default(100),
```

Also consider:
- Truncating very long lines (>500 chars)
- Adding line count to response metadata

---

#### `tilt_trigger` / `tilt_enable` / `tilt_disable`
**Status:** Efficient
**Output:** ~200 bytes each
```json
{
  "success": true,
  "resourceName": "api-gateway",
  "message": "Resource 'api-gateway' triggered successfully",
  "connectionInfo": {"port": 10350, "host": "localhost"}
}
```
**Recommendation:** No changes needed.

---

#### `tilt_wait`
**Status:** Moderate Risk
**Output:** Variable
**Issue:** Includes raw `output` field from Tilt CLI which can be verbose.

**Current response:**
```json
{
  "success": true,
  "resources": ["api-gateway"],
  "timeout": 60,
  "condition": "Ready",
  "output": "...",  // Can be large
  "message": "Resource(s) 'api-gateway' are ready",
  "connectionInfo": {...}
}
```

**Recommendation:** Remove or truncate `output` field:
```typescript
const result = {
  success: true,
  resources: args.resources ?? 'all',
  timeout: args.timeout,
  condition: args.condition ?? 'Ready',
  message: args.resources
    ? `Resource(s) '${args.resources.join(', ')}' are ready`
    : 'All resources are ready',
  connectionInfo: { port, host },
  // Remove: output
};
```

---

#### `tilt_dump`
**Status:** Critical
**Output:** **6.8MB**
**Issue:** Returns entire Tilt engine state - unusable for LLMs.

**Recommendation:** Either:
1. **Remove the tool entirely** (preferred)
2. **Add mandatory summary mode** that extracts only:
   - `completedBuildCount`
   - `currentBuildSet`
   - `features`
   - `tiltfilePath`
   - Error states

**See:** `BUGS.md#BUG-002`

---

## Priority Order

### P0 - Critical (Blocking)
1. Fix `tilt_describe_resource` CLI command
2. Remove or limit `tilt_dump`

### P1 - High (Major UX Impact)
3. Add summary mode to `tilt_status`
4. Add summary mode to `tilt_get_resources`

### P2 - Medium (Improve Efficiency)
5. Add default `tailLines` to `tilt_logs`
6. Remove `output` from `tilt_wait`
7. Add status filtering to `tilt_get_resources`

### P3 - Nice to Have
8. Add pagination
9. Add `tilt_list_errors` convenience tool
