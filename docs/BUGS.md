# Known Bugs

## BUG-001: `tilt_describe_resource` uses invalid `-o json` flag

**Status:** ✅ FIXED
**Severity:** High
**Fixed in:** Response optimization PR - changed to `tilt get uiresource/{name} -o json`
**File:** `src/tilt/cli-client.ts:222-235`

### Description

The `describeResource()` method passes `-o json` to `tilt describe`, but `tilt describe` doesn't support this flag:

```
Error: unknown shorthand flag: 'o' in -o
```

### Original Code (before fix)
```typescript
async describeResource(resourceName: string): Promise<ResourceDetail> {
  const args = [
    'describe',  // BUG: 'describe' doesn't support -o json
    `uiresource/${resourceName}`,
    '-o',
    'json',  // NOT SUPPORTED with 'describe'
    '--port',
    this.port.toString(),
    '--host',
    this.host,
  ];
  // ...
}
```

### Fix (applied)

Use `tilt get` instead of `tilt describe`:

```typescript
async describeResource(resourceName: string): Promise<ResourceDetail> {
  const args = [
    'get',
    `uiresource/${resourceName}`,
    '-o',
    'json',
    '--port',
    this.port.toString(),
    '--host',
    this.host,
  ];
  // ...
}
```

### Verification

```bash
# This fails:
tilt describe uiresource/api-gateway -o json --port 10350

# This works:
tilt get uiresource/api-gateway -o json --port 10350
```

---

## BUG-002: `tilt_dump` returns 6.8MB+ of data

**Status:** ✅ FIXED (tool excluded)
**Severity:** Critical
**Fixed in:** Response optimization PR - tool removed from server registration and exports
**File:** `src/tools/dump.ts`

### Description

The `tilt dump engine` command returns the entire Tilt engine state (~6.8MB), which:
- Exceeds MCP response limits
- Fills LLM context immediately
- Has no practical use case for AI assistants

### Current Behavior

```bash
$ tilt dump engine --port 10350 | wc -c
6894276  # 6.8MB
```

### Recommended Fix

Either:
1. **Remove the tool** - It's not useful for AI assistants
2. **Add `summary` mode** - Extract only useful top-level fields
3. **Add field selection** - Allow specifying which sections to dump

### Summary Mode Example

```json
{
  "sessionActive": true,
  "completedBuildCount": 193,
  "currentBuildSet": {},
  "features": {...},
  "tiltfilePath": "/path/to/Tiltfile"
}
```

---

## BUG-003: Several tools implemented but not registered

**Status:** ✅ FIXED
**Severity:** Medium
**Fixed in:** Response optimization PR - registered enable, disable, wait, args (10 tools total)
**File:** `src/server.ts:14-21, 37-68`

### Description

The following tools are implemented in `src/tools/` but not registered in the MCP server:

| Tool | File | Status |
|------|------|--------|
| `tilt_enable` | `enable.ts` | Not registered |
| `tilt_disable` | `disable.ts` | Not registered |
| `tilt_wait` | `wait.ts` | Not registered |
| `tilt_dump` | `dump.ts` | Not registered (intentional - returns 6.8MB) |
| `tilt_args` | `args.ts` | Not registered |

### Registered Tools (6)
- `tilt_discover`
- `tilt_status`
- `tilt_get_resources`
- `tilt_describe_resource`
- `tilt_logs`
- `tilt_trigger`

### Fix

Add missing tools to `server.ts` (except `tilt_dump` which should be removed or limited first):

```typescript
import {
  tiltDescribeResource,
  tiltDisable,
  tiltDiscover,
  tiltEnable,
  tiltGetResources,
  tiltLogs,
  tiltStatus,
  tiltTrigger,
  tiltWait,
  tiltArgs,
} from './tools/index.js';
```

And register them in `handleListTools()` and `handleCallTool()`.
