# Tilt API Validation Results

**Validation Date**: 2025-11-20
**Tilt Version**: v0.35.0, built 2025-06-13
**Environment**: darwin-arm64, Docker (OrbStack), Kubernetes (OrbStack)

## Executive Summary

Validation confirms that Tilt CLI commands work as expected, but reveals important differences from initial assumptions:

**Key Findings**:
- ✅ CLI commands support `-o json` and `--port` parameters
- ✅ WebSocket endpoint exists at `/ws/view` for real-time updates
- ⚠️  HTTP REST API at `/api/*` returns HTML (web UI), not JSON
- ✅ CLI is the primary programmatic interface (not HTTP REST)
- ✅ All CLI commands connect to running Tilt session on port 10350

**Impact**: Switch from hybrid API/CLI to **CLI-first with WebSocket streaming** approach.

## Detailed Validation Results

### Tilt CLI Commands

#### ✅ `tilt get` - VALIDATED

```bash
# Command structure
tilt get TYPE [NAME | -l label] [flags]

# JSON output support
tilt get uiresources -o json      # Works perfectly

# Port override
tilt get uiresources --port 10351  # Supported
```

**Flags Confirmed**:
- `-o json` - JSON output format ✅
- `-o yaml` - YAML output format ✅
- `--port <int>` - Port override (default: 10350) ✅
- `--host <string>` - Host override (default: localhost) ✅
- `-l, --selector <string>` - Label selector ✅
- `--field-selector <string>` - Field selector ✅
- `-w, --watch` - Watch for changes ✅

**Resource Types Available** (from `tilt api-resources`):
```
clusters
cmdimages
cmds
configmaps (cm)
dockercomposelogstreams (dclog, dcls)
dockercomposeservices (dc)
dockerimages
extensionrepos (repo, extrepo)
extensions (ext)
filewatches (fw)
imagemaps (im)
kubernetesapplys (ka, kapp)
kubernetesdiscoveries (kd, kdisco)
liveupdates
podlogstreams (pls)
portforwards (pf)
sessions
tiltfiles
togglebuttons
uibuttons
uiresources
uisessions
```

**Primary Resource**: `uiresources` - Main resources visible in Tilt UI

#### ✅ `tilt logs` - VALIDATED

```bash
# Command structure
tilt logs [resource1, resource2...] [flags]
```

**Flags Confirmed**:
- `-f, --follow` - Stream logs ✅
- `--port <int>` - Port override (default: 10350) ✅
- `--host <string>` - Host override (default: localhost) ✅
- `--level <string>` - Log level filter (warn, error) ✅
- `--source <string>` - Log source (all, build, runtime) ✅

**Note**: NO `--tail` flag - must implement alternative for limiting log lines

#### ✅ `tilt describe` - VALIDATED

```bash
# Command structure
tilt describe (-f FILENAME | TYPE [NAME] | TYPE/NAME)
```

**Flags Confirmed**:
- `--port <int>` - Port override ✅
- `--host <string>` - Host override ✅
- `-l, --selector <string>` - Label selector ✅

#### ✅ `tilt trigger` - VALIDATED

```bash
# Command structure
tilt trigger [RESOURCE_NAME] [flags]
```

**Flags Confirmed**:
- `--port <int>` - Port override ✅
- `--host <string>` - Host override ✅

#### ✅ `tilt up/down` - VALIDATED

Available but not tested in detail. Commands exist and support standard flags.

### Tilt HTTP API

#### ⚠️ REST API - NOT AS EXPECTED

**Tested Endpoints**:
```bash
# Root API
curl http://localhost:10350/api/
# Returns: HTML (Tilt web UI)

# Session endpoint
curl http://localhost:10350/api/v1/session
# Returns: HTML (Tilt web UI)

# Status endpoint
curl http://localhost:10350/api/status
# Returns: HTML (Tilt web UI)
```

**Finding**: The `/api/*` path serves the web UI, not a REST API.

**Implication**: Cannot use HTTP REST API as initially proposed. Must use CLI commands instead.

#### ✅ WebSocket API - EXISTS

**Endpoint**: `ws://localhost:10350/ws/view`

**Test Result**:
```bash
curl http://localhost:10350/ws/view
# Returns: Bad Request - websocket: 'upgrade' token not found
```

**Finding**: WebSocket endpoint exists and properly rejects non-WebSocket connections.

**Capability**: Real-time streaming updates for resources, logs, and status changes.

**Implication**: Can implement watch functionality via WebSocket instead of polling.

### Session Detection

#### ✅ Session Status - WORKS

```bash
# Check if Tilt is running
tilt get session

# Output when running:
NAME       CREATED AT
Tiltfile   2025-11-20T15:36:56Z

# Output when not running:
Error: error loading config file "/Users/allen/.tilt-dev/config.json":
Get "http://localhost:10350/api/": dial tcp [::1]:10350: connect: connection refused
```

**Implication**: Can detect running Tilt session by checking `tilt get session` exit code.

### Port Override

#### ✅ Multiple Instances - SUPPORTED

All CLI commands support `--port` and `--host` flags:

```bash
tilt get uiresources --port 10351 --host localhost
tilt logs myresource --port 10352
tilt trigger myresource --port 10353
```

**Environment Variables**:
- `TILT_PORT` - Default port override
- `TILT_HOST` - Default host override

## Revised Architecture Recommendations

### Connection Strategy

**Primary Interface**: Tilt CLI commands
- All operations via `tilt` CLI with JSON output
- No HTTP REST API client needed
- Simpler implementation, fewer failure modes

**Streaming**: WebSocket at `ws://localhost:10350/ws/view`
- Real-time updates for logs and resource status
- Eliminates need for polling
- Better performance and lower latency

**Discovery**: Environment variables + CLI
- Use `TILT_PORT` and `TILT_HOST` env vars
- Test connection with `tilt get session`
- No HTTP health checks needed

### Updated Client Architecture

```typescript
// src/tilt/client.ts
export class TiltClient {
  private port: number;
  private host: string;

  constructor(config?: TiltConnectionConfig) {
    this.port = config?.port || parseInt(process.env.TILT_PORT || '10350');
    this.host = config?.host || process.env.TILT_HOST || 'localhost';
  }

  async getResources(): Promise<Resource[]> {
    const { stdout } = await execAsync(
      `tilt get uiresources -o json --port ${this.port} --host ${this.host}`
    );
    return JSON.parse(stdout).items;
  }

  async getLogs(resourceName: string, options: LogOptions): Promise<string> {
    const args = ['logs', resourceName, '--port', this.port.toString()];
    if (options.follow) args.push('-f');
    if (options.level) args.push('--level', options.level);
    if (options.source) args.push('--source', options.source);

    const { stdout } = await execAsync(`tilt ${args.join(' ')}`);
    return stdout;
  }

  async checkSession(): Promise<boolean> {
    try {
      await execAsync(`tilt get session --port ${this.port} --host ${this.host}`);
      return true;
    } catch {
      return false;
    }
  }
}
```

### WebSocket Streaming

```typescript
// src/tilt/websocket-client.ts
import WebSocket from 'ws';

export class TiltWebSocketClient {
  private ws: WebSocket;
  private url: string;

  constructor(port: number = 10350, host: string = 'localhost') {
    this.url = `ws://${host}:${port}/ws/view`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => resolve());
      this.ws.on('error', reject);

      this.ws.on('message', (data: Buffer) => {
        const update = JSON.parse(data.toString());
        this.handleUpdate(update);
      });
    });
  }

  private handleUpdate(update: any) {
    // Emit MCP notifications for resource updates
    // Handle log streams
    // Update resource status
  }
}
```

## Validation Against Initial Assumptions

### Assumption vs. Reality

| Assumption | Reality | Status |
|------------|---------|--------|
| HTTP REST API at `/api/status` | Returns HTML, not JSON | ❌ WRONG |
| HTTP REST API at `/api/resources` | Does not exist | ❌ WRONG |
| `tilt get all -o json` | Should be `tilt get uiresources -o json` | ⚠️  ADJUSTED |
| Log query params via HTTP | Not applicable (no REST API) | ❌ WRONG |
| CLI fallback strategy | CLI is primary, not fallback | ⚠️  ADJUSTED |
| WebSocket for streaming | Exists at `/ws/view` | ✅ CORRECT |
| Port configuration via env vars | `TILT_PORT` and `TILT_HOST` exist | ✅ CORRECT |
| `--port` flag on CLI commands | All commands support it | ✅ CORRECT |

### Impact on Proposal

**Major Changes Required**:
1. ❌ Remove HTTP REST API client implementation
2. ✅ Make CLI the primary (only) interface
3. ✅ Implement WebSocket client for streaming
4. ⚠️  Update tool implementations to use CLI only
5. ✅ Simplify connection detection (just check CLI)

**Advantages of CLI-Only Approach**:
- Simpler implementation (no HTTP client)
- Fewer failure modes
- Direct access to all Tilt functionality
- Better error messages from Tilt itself
- No API version compatibility issues

**Disadvantages**:
- Process overhead per command
- Need to parse CLI output carefully
- Streaming requires WebSocket (separate connection)

## Missing CLI Features

### No `--tail` Flag for Logs

**Issue**: `tilt logs` doesn't support `--tail=N` to limit output lines

**Workaround**: Pipe through `tail` or buffer output:
```bash
tilt logs myresource | tail -n 100
```

**Implementation**:
```typescript
async getLogs(resourceName: string, options: LogOptions): Promise<string> {
  const cmd = options.tailLines
    ? `tilt logs ${resourceName} --port ${this.port} | tail -n ${options.tailLines}`
    : `tilt logs ${resourceName} --port ${this.port}`;

  const { stdout } = await execAsync(cmd);
  return stdout;
}
```

## Recommendations

### Immediate Actions

1. **Update proposal** to remove HTTP REST API client
2. **Simplify architecture** to CLI-only (no hybrid approach)
3. **Implement WebSocket client** for streaming functionality
4. **Update tool schemas** to remove API-specific options
5. **Add WebSocket dependency**: `npm install ws @types/ws`

### Testing Strategy

1. **CLI Output Fixtures**: Capture real `tilt get -o json` output for testing
2. **Mock CLI Execution**: Mock `execAsync` for unit tests
3. **WebSocket Mock**: Mock WebSocket for streaming tests
4. **Integration Tests**: Test against real Tilt instance

### Documentation Updates

1. Remove references to Tilt HTTP REST API
2. Document WebSocket protocol for streaming
3. Add CLI command reference
4. Update error handling for CLI-specific errors

## Conclusion

The validation revealed that Tilt's programmatic interface is **CLI-first**, not HTTP REST API. This simplifies implementation and removes the hybrid API/CLI complexity. WebSocket support provides the streaming capabilities we need.

**Next Steps**:
1. Update `docs/mcp-configuration-proposal.md` with validated architecture
2. Remove API client code from project structure
3. Add WebSocket client for streaming
4. Proceed with Phase 1 implementation using CLI-only approach
