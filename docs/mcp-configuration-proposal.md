# MCP Configuration Proposal for Tilt Integration

## Overview

This document outlines the proposed MCP server architecture for exposing Tilt CLI functionality to AI assistants.

## Transport Layer

**Recommendation: stdio**

Rationale:
- Local process communication (Tilt CLI is local)
- Simplest setup for CLI tool integration
- Standard for MCP server implementations
- No network configuration required
- Secure by default (no exposed ports)

## Server Architecture

```typescript
// src/server.ts
import { McpServer } from '@modelcontextprotocol/sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'tilt-mcp-server',
  version: '0.1.0',
});
```

## Tilt Connection Strategy

### API vs CLI Approach

Tilt provides two interfaces for external interaction:

1. **Tilt API Server** (HTTP REST API)
   - Runs when `tilt up` is active (default port: 10350)
   - Rich JSON responses with structured data
   - Real-time updates via WebSocket
   - Supports watching resources for changes
   - Better performance (no process spawning)
   - Official endpoint: `http://localhost:10350/api/...`

2. **Tilt CLI Commands**
   - Works without an active Tilt session
   - Some commands require running session
   - Text-based output (JSON available with `-o json`)
   - Process overhead per command
   - More portable (works over SSH, containers, etc.)

**Recommendation: Hybrid Approach**
- **Prefer API when available** (faster, richer, real-time)
- **Fallback to CLI** when API unavailable
- **Auto-detect** on startup and tool invocation

### Connection Configuration

Support multiple configuration methods:

**Environment Variables:**
```bash
TILT_HOST=localhost:10350    # API server address
TILT_PORT=10350               # API server port (if host not specified)
TILT_API_URL=http://localhost:10350  # Full API URL
```

**Configuration File:** `.tilt-mcp.json`
```json
{
  "tiltApi": {
    "host": "localhost",
    "port": 10350,
    "timeout": 5000
  },
  "fallbackToCli": true,
  "cliPath": "tilt"
}
```

**Priority Order:**
1. Environment variables
2. Configuration file
3. Defaults (localhost:10350)

### Connection Detection & Health

Implement health checking on startup and before each operation:

```typescript
// src/tilt/connection.ts
export interface TiltConnectionConfig {
  apiUrl?: string;
  host?: string;
  port?: number;
  timeout?: number;
  fallbackToCli?: boolean;
}

export class TiltConnection {
  private apiUrl: string;
  private apiAvailable: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds

  constructor(config: TiltConnectionConfig = {}) {
    // Priority: TILT_API_URL > TILT_HOST > host:port > defaults
    this.apiUrl =
      config.apiUrl ||
      process.env.TILT_API_URL ||
      `http://${config.host || process.env.TILT_HOST || 'localhost'}:${config.port || process.env.TILT_PORT || '10350'}`;
  }

  async checkHealth(): Promise<boolean> {
    const now = Date.now();

    // Use cached result if within interval
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.apiAvailable;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });

      this.apiAvailable = response.ok;
      this.lastHealthCheck = now;
      return this.apiAvailable;
    } catch (error) {
      this.apiAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  async ensureConnection(): Promise<'api' | 'cli'> {
    const healthy = await this.checkHealth();

    if (healthy) {
      return 'api';
    }

    // Check if CLI is available
    const cliAvailable = await this.checkCliAvailable();
    if (cliAvailable) {
      return 'cli';
    }

    throw new Error(
      'Cannot connect to Tilt. Please ensure Tilt is running (tilt up) or Tilt CLI is installed.'
    );
  }

  private async checkCliAvailable(): Promise<boolean> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      await execAsync('tilt version');
      return true;
    } catch {
      return false;
    }
  }
}
```

### Handling Multiple Tilt Instances

Support scenarios where multiple Tilt sessions run on different ports:

**Tool Input Extension:**
```typescript
// All tools accept optional connection override
interface ToolBaseInput {
  tiltHost?: string;    // Override connection for this call
  tiltPort?: number;    // Override port for this call
}

// Example: Get resources from specific Tilt instance
{
  "resourceName": "frontend",
  "tiltHost": "localhost",
  "tiltPort": 10351  // Secondary Tilt instance
}
```

**Multiple Server Configuration:**
```json
{
  "mcpServers": {
    "tilt-main": {
      "command": "node",
      "args": ["/Users/allen/0xbigboss/tilt-mcp/dist/server.js"],
      "env": {
        "TILT_PORT": "10350"
      }
    },
    "tilt-staging": {
      "command": "node",
      "args": ["/Users/allen/0xbigboss/tilt-mcp/dist/server.js"],
      "env": {
        "TILT_PORT": "10351"
      }
    }
  }
}
```

### Automatic Discovery

Implement port scanning for automatic Tilt instance discovery:

```typescript
async discoverTiltInstances(): Promise<TiltInstance[]> {
  const instances: TiltInstance[] = [];
  const portsToCheck = [10350, 10351, 10352, 10353, 10354]; // Common ports

  await Promise.all(
    portsToCheck.map(async (port) => {
      try {
        const response = await fetch(`http://localhost:${port}/api/status`, {
          signal: AbortSignal.timeout(500),
        });

        if (response.ok) {
          const data = await response.json();
          instances.push({
            host: 'localhost',
            port,
            version: data.version,
            tiltfilePath: data.tiltfilePath,
          });
        }
      } catch {
        // Port not available, skip
      }
    })
  );

  return instances;
}
```

## Proposed Tools

### Phase 1: Core Status & Control Tools

1. **tilt_discover**
   - Discover running Tilt instances on localhost
   - Input: `{ portRange?: [number, number] }`
   - Output: Array of discovered Tilt instances with host, port, version, tiltfile path

2. **tilt_status**
   - Get overall Tilt status and resource summary
   - Input: `{ tiltHost?: string, tiltPort?: number }`
   - Output: JSON with resource states, build status, health, connection method (API or CLI)

3. **tilt_get_resources**
   - List all resources managed by Tilt
   - Input: `{ filter?: string, labels?: string[], tiltHost?: string, tiltPort?: number }`
   - Output: Array of resource objects with status

4. **tilt_describe_resource**
   - Get detailed information about a specific resource
   - Input: `{ resourceName: string, tiltHost?: string, tiltPort?: number }`
   - Output: Detailed resource status, dependencies, history

5. **tilt_logs**
   - Read logs from a specific resource
   - Input: `{ resourceName: string, follow?: boolean, tailLines?: number, tiltHost?: string, tiltPort?: number }`
   - Output: Log text (stream support for follow mode)

6. **tilt_trigger**
   - Manually trigger a resource update
   - Input: `{ resourceName: string, tiltHost?: string, tiltPort?: number }`
   - Output: Trigger confirmation and status

### Phase 2: Control & Configuration

7. **tilt_up**
   - Start Tilt (if not already running)
   - Input: `{ tiltfile?: string, stream?: boolean, tiltHost?: string, tiltPort?: number }`
   - Output: Startup status

8. **tilt_down**
   - Stop all Tilt resources
   - Input: `{ deleteNamespaces?: boolean, tiltHost?: string, tiltPort?: number }`
   - Output: Shutdown confirmation

9. **tilt_enable**
   - Enable a disabled resource
   - Input: `{ resourceName: string, tiltHost?: string, tiltPort?: number }`
   - Output: Enable confirmation

10. **tilt_disable**
    - Disable a resource
    - Input: `{ resourceName: string, tiltHost?: string, tiltPort?: number }`
    - Output: Disable confirmation

### Phase 3: Advanced Features

11. **tilt_args**
    - Get or set Tiltfile args
    - Input: `{ args?: Record<string, any>, tiltHost?: string, tiltPort?: number }`
    - Output: Current args configuration

12. **tilt_wait**
    - Wait for resource(s) to reach desired state
    - Input: `{ resourceName?: string, timeout?: number, tiltHost?: string, tiltPort?: number }`
    - Output: Wait result and final status

## Proposed Resources

Resources expose Tilt data without requiring execution:

1. **tilt://status**
   - Current Tilt session status snapshot
   - Auto-updates on Tilt state changes

2. **tilt://resources/{resourceName}**
   - Individual resource status
   - Template-based with dynamic resource names

3. **tilt://tiltfile**
   - Current Tiltfile content and location
   - Useful for understanding configuration

4. **tilt://logs/{resourceName}**
   - Latest logs for a resource
   - Alternative to tool-based log access

## Project Structure

```
tilt-mcp/
├── .claude/
│   └── CLAUDE.md
├── docs/
│   ├── agent-sdk-typescript.md
│   ├── mcp-typescript-sdk.md
│   └── mcp-configuration-proposal.md
├── src/
│   ├── server.ts              # Main MCP server setup
│   ├── types.ts               # Shared TypeScript types
│   ├── tools/
│   │   ├── index.ts          # Tool registry
│   │   ├── discover.ts       # tilt_discover tool
│   │   ├── status.ts         # tilt_status tool
│   │   ├── resources.ts      # Resource management tools
│   │   ├── logs.ts           # Log access tools
│   │   └── control.ts        # Start/stop/trigger tools
│   ├── resources/
│   │   ├── index.ts          # Resource registry
│   │   ├── status.ts         # Status resource
│   │   └── logs.ts           # Log resources
│   └── tilt/
│       ├── connection.ts     # Connection management & health checking
│       ├── api-client.ts     # Tilt API HTTP client
│       ├── cli-client.ts     # Tilt CLI wrapper
│       ├── client.ts         # Unified client with fallback logic
│       ├── parser.ts         # Output parsing utilities
│       └── types.ts          # Tilt-specific types
├── tests/
│   ├── tools/
│   ├── resources/
│   └── tilt/
├── scripts/
│   └── mock-service.js       # Demo service for Tiltfile
├── package.json
├── tsconfig.json
├── Tiltfile
└── README.md
```

## Configuration Files

### package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src tests",
    "lint:fix": "eslint src tests --fix",
    "docs": "typedoc src/server.ts"
  }
}
```

### MCP Client Configuration (for Claude Desktop)

```json
{
  "mcpServers": {
    "tilt": {
      "command": "node",
      "args": ["/Users/allen/0xbigboss/tilt-mcp/dist/server.js"],
      "env": {
        "TILT_HOST": "localhost:10350"
      }
    }
  }
}
```

### Alternative: Development Mode

```json
{
  "mcpServers": {
    "tilt-dev": {
      "command": "npx",
      "args": ["tsx", "/Users/allen/0xbigboss/tilt-mcp/src/server.ts"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

## Implementation Strategy

### Phase 1: Foundation (Week 1)
1. Initialize npm project with dependencies
2. Set up TypeScript configuration
3. Implement basic MCP server with stdio transport
4. Create Tilt CLI wrapper (`src/tilt/client.ts`)
5. Implement first tool: `tilt_status`
6. Write tests for CLI wrapper and first tool

### Phase 2: Core Tools (Week 2)
1. Implement resource management tools
2. Implement log access tools
3. Add status resources
4. Comprehensive testing
5. Documentation and examples

### Phase 3: Advanced Features (Week 3+)
1. Control tools (up/down/enable/disable)
2. Advanced resource patterns
3. Error handling and edge cases
4. Performance optimization
5. Integration testing with real Tilt instances

## Tilt Integration Implementation Details

### Unified Client Architecture

Implement a unified client that abstracts API vs CLI differences:

```typescript
// src/tilt/client.ts
import { TiltConnection } from './connection.js';
import { TiltApiClient } from './api-client.js';
import { TiltCliClient } from './cli-client.js';

export class TiltClient {
  private connection: TiltConnection;
  private apiClient: TiltApiClient;
  private cliClient: TiltCliClient;

  constructor(config?: TiltConnectionConfig) {
    this.connection = new TiltConnection(config);
    this.apiClient = new TiltApiClient(this.connection);
    this.cliClient = new TiltCliClient();
  }

  async getResources(): Promise<Resource[]> {
    const method = await this.connection.ensureConnection();

    if (method === 'api') {
      return this.apiClient.getResources();
    } else {
      return this.cliClient.getResources();
    }
  }

  async getLogs(resourceName: string, options: LogOptions): Promise<string> {
    const method = await this.connection.ensureConnection();

    if (method === 'api') {
      return this.apiClient.getLogs(resourceName, options);
    } else {
      return this.cliClient.getLogs(resourceName, options);
    }
  }
}
```

### API Client Implementation

```typescript
// src/tilt/api-client.ts
export class TiltApiClient {
  constructor(private connection: TiltConnection) {}

  async getResources(): Promise<Resource[]> {
    const apiUrl = this.connection.getApiUrl();
    const response = await fetch(`${apiUrl}/api/resources`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Tilt API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.resources;
  }

  async getLogs(resourceName: string, options: LogOptions): Promise<string> {
    const apiUrl = this.connection.getApiUrl();
    const params = new URLSearchParams({
      resourceName,
      ...(options.tailLines && { tailLines: options.tailLines.toString() }),
    });

    const response = await fetch(`${apiUrl}/api/logs?${params}`, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Tilt API error: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }
}
```

### CLI Client Implementation

```typescript
// src/tilt/cli-client.ts
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TiltCliClient {
  async getResources(): Promise<Resource[]> {
    const { stdout } = await execAsync('tilt get all -o json');
    return JSON.parse(stdout);
  }

  async getLogs(resourceName: string, options: LogOptions): Promise<string> {
    const args = ['logs', resourceName];
    if (options.follow) args.push('-f');
    if (options.tailLines) args.push(`--tail=${options.tailLines}`);

    // For streaming logs, use spawn
    if (options.follow) {
      return this.streamLogs(args);
    }

    const { stdout } = await execAsync(`tilt ${args.join(' ')}`);
    return stdout;
  }

  private async streamLogs(args: string[]): Promise<string> {
    throw new Error('Streaming logs via CLI not yet implemented');
  }
}
```

### Error Handling

All Tilt operations must handle both API and CLI errors:

```typescript
// API errors
try {
  const result = await apiClient.getResources();
  return result;
} catch (error) {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    throw new Error('Cannot connect to Tilt API. Ensure Tilt is running.');
  }
  if (error.response?.status === 404) {
    throw new Error('Tilt API endpoint not found. Check Tilt version compatibility.');
  }
  throw new Error(`Tilt API error: ${error.message}`);
}

// CLI errors
try {
  const result = await cliClient.getResources();
  return result;
} catch (error) {
  if (error.code === 'ENOENT') {
    throw new Error('Tilt CLI not found. Please install Tilt: https://docs.tilt.dev/');
  }
  if (error.stderr?.includes('no Tilt session')) {
    throw new Error('No active Tilt session. Run "tilt up" first.');
  }
  if (error.stderr?.includes('not found')) {
    throw new Error(`Resource not found: ${error.stderr}`);
  }
  throw new Error(`Tilt CLI error: ${error.message}`);
}
```

### Connection Method Transparency

Tools should report which connection method was used:

```typescript
interface ToolResult {
  data: any;
  meta: {
    connectionMethod: 'api' | 'cli';
    responseTime: number;
    tiltVersion?: string;
  };
}
```

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "bun-types": "^1.3.2",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "typedoc": "^0.25.0"
  }
}
```

## Testing Strategy

1. **Unit Tests**: Test individual tools and parsers with mocked Tilt CLI
2. **Integration Tests**: Test against real Tilt CLI with the demo Tiltfile
3. **E2E Tests**: Test full MCP server communication via stdio
4. **Mock Tilt Responses**: Create fixtures for consistent testing

## Security Considerations

1. **Command Injection**: Sanitize all inputs before passing to shell
2. **Path Traversal**: Validate resource names don't contain path separators
3. **Resource Limits**: Timeout long-running commands
4. **Permissions**: Document required filesystem/process permissions

## Open Questions

1. ~~Should we support connecting to remote Tilt instances (via Tilt API)?~~ **RESOLVED**: Yes, via environment variables and per-tool overrides
2. ~~How should we handle multiple Tilt instances on different ports?~~ **RESOLVED**: Discovery tool + per-tool host/port overrides + multiple MCP server configs
3. How should we handle streaming logs in the MCP protocol? (Need to research MCP streaming capabilities)
4. Should we implement Tilt file watching for proactive notifications?
5. What level of Tilt configuration management should be exposed?
6. Should we cache API health check results? If so, for how long? **PROPOSED**: 30-second cache with manual refresh option

## Next Steps

1. Review and approve this proposal
2. Initialize the npm project structure
3. Begin Phase 1 implementation
4. Create mock Tilt responses for testing
