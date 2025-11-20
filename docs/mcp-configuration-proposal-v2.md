# MCP Configuration Proposal v2 - Tilt Integration

**Version**: 2.0
**Date**: 2025-11-20
**Status**: Updated after API validation and Codex review

## Changes from v1

- **Architecture**: Switched from hybrid API/CLI to **CLI-only with WebSocket streaming**
- **Validation**: All assumptions verified against Tilt v0.35.0
- **Dependencies**: Added missing `@anthropic-ai/claude-agent-sdk` and `ws`
- **Security**: Comprehensive input validation specifications
- **Streaming**: WebSocket-based design for real-time updates
- **Testing**: Detailed fixture and mocking strategy

## Overview

This document outlines the validated MCP server architecture for exposing Tilt CLI functionality to AI assistants, based on actual Tilt v0.35.0 behavior.

## Transport Layer

**Recommendation**: stdio

Rationale:
- Local process communication (Tilt CLI is local)
- Standard for MCP server implementations
- No network configuration required
- Secure by default (no exposed ports)

## Tilt Integration Architecture

### Validated Approach: CLI-Only with WebSocket Streaming

**Finding**: Tilt's programmatic interface is CLI-first, not HTTP REST API.

**Architecture**:
1. **Primary Interface**: Tilt CLI commands with JSON output
2. **Streaming**: WebSocket at `ws://localhost:10350/ws/view`
3. **Session Detection**: `tilt get session` for health checks
4. **Port Configuration**: `TILT_PORT` and `TILT_HOST` environment variables

```
┌─────────────────────────────────────────────┐
│          MCP Server (stdio)                 │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────┐  ┌─────────────────┐│
│  │   TiltClient     │  │ WebSocketClient ││
│  │  (CLI wrapper)   │  │  (streaming)    ││
│  └────────┬─────────┘  └────────┬────────┘│
│           │                     │         │
│           ▼                     ▼         │
│    ┌──────────────────────────────────┐  │
│    │     Tilt CLI + WebSocket         │  │
│    │  (port 10350 by default)         │  │
│    └──────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Session Detection & Connection

```typescript
// src/tilt/connection.ts
export interface TiltConnectionConfig {
  port?: number;
  host?: string;
  timeout?: number;
}

export class TiltConnection {
  private port: number;
  private host: string;
  private timeout: number;
  private sessionActive: boolean = false;
  private lastCheck: number = 0;
  private checkInterval: number = 30000; // 30 seconds

  constructor(config: TiltConnectionConfig = {}) {
    this.port = config.port || parseInt(process.env.TILT_PORT || '10350');
    this.host = config.host || process.env.TILT_HOST || 'localhost';
    this.timeout = config.timeout || 5000;
  }

  async checkSession(): Promise<boolean> {
    const now = Date.now();

    // Use cached result if within interval
    if (now - this.lastCheck < this.checkInterval) {
      return this.sessionActive;
    }

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      await execAsync(
        `tilt get session --port ${this.port} --host ${this.host}`,
        { timeout: this.timeout }
      );

      this.sessionActive = true;
      this.lastCheck = now;
      return true;
    } catch (error: any) {
      this.sessionActive = false;
      this.lastCheck = now;

      // Provide specific error messages
      if (error.code === 'ENOENT') {
        throw new Error(
          'Tilt CLI not found. Please install Tilt: https://docs.tilt.dev/install.html'
        );
      }

      if (error.stderr?.includes('connection refused') || error.stderr?.includes('dial tcp')) {
        throw new Error(
          `No active Tilt session on ${this.host}:${this.port}. Run 'tilt up' first.`
        );
      }

      throw new Error(`Tilt session check failed: ${error.message}`);
    }
  }

  getConnectionInfo() {
    return {
      port: this.port,
      host: this.host,
      sessionActive: this.sessionActive,
      lastCheck: new Date(this.lastCheck).toISOString(),
    };
  }
}
```

## Proposed Tools

All tools now use CLI-only approach with validated commands.

### Phase 1: Core Status & Control Tools

1. **tilt_discover**
   - Discover running Tilt instances by scanning common ports
   - Input: `{ portRange?: [number, number] }` (default: [10350, 10354])
   - Output: Array of `{ host, port, version, sessionActive }`
   - Implementation: Try `tilt get session --port N` for each port

2. **tilt_status**
   - Get overall Tilt status and resource summary
   - Input: `{ tiltPort?: number, tiltHost?: string }`
   - Output: `{ resources: Resource[], sessionInfo: SessionInfo, connectionMethod: 'cli' }`
   - Implementation: `tilt get uiresources -o json`

3. **tilt_get_resources**
   - List all resources managed by Tilt
   - Input: `{ filter?: string, labels?: string[], tiltPort?: number }`
   - Output: Array of UIResource objects
   - Implementation: `tilt get uiresources -o json -l <labels>`

4. **tilt_describe_resource**
   - Get detailed information about a specific resource
   - Input: `{ resourceName: string, tiltPort?: number }`
   - Output: Detailed resource object
   - Implementation: `tilt describe uiresource/<resourceName> -o json`

5. **tilt_logs**
   - Read logs from a specific resource
   - Input: `{ resourceName: string, follow?: boolean, tailLines?: number, level?: 'warn'|'error', source?: 'all'|'build'|'runtime' }`
   - Output: Log text
   - Implementation: `tilt logs <resourceName> -f --level <level> | tail -n <lines>`

6. **tilt_trigger**
   - Manually trigger a resource update
   - Input: `{ resourceName: string, tiltPort?: number }`
   - Output: `{ triggered: boolean, resourceName: string }`
   - Implementation: `tilt trigger <resourceName>`

### Phase 2: Control & Configuration

7. **tilt_enable**
   - Enable a disabled resource
   - Input: `{ resourceName: string, tiltPort?: number }`
   - Output: `{ enabled: boolean, resourceName: string }`
   - Implementation: `tilt enable <resourceName>`

8. **tilt_disable**
   - Disable a resource
   - Input: `{ resourceName: string, tiltPort?: number }`
   - Output: `{ disabled: boolean, resourceName: string }`
   - Implementation: `tilt disable <resourceName>`

9. **tilt_args**
   - Changes the Tiltfile args in use by a running Tilt
   - Input: `{ args: string[], tiltPort?: number }`
   - Output: `{ updated: boolean, currentArgs: string[] }`
   - Implementation: `tilt args <arg1> <arg2> ...`

## Input Validation & Security

### Zod Schemas for All Tools

```typescript
// src/tools/schemas.ts
import { z } from 'zod';

// Base schema with common fields
export const TiltBaseInput = z.object({
  tiltPort: z.number().int().min(1).max(65535).optional(),
  tiltHost: z.string().regex(/^[a-zA-Z0-9.-]+$/).optional(),
});

// Resource name validation (prevent command injection)
export const ResourceNameSchema = z.string()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/,
    'Resource name must be valid Kubernetes name');

// tilt_status schema
export const TiltStatusInput = TiltBaseInput;

// tilt_get_resources schema
export const TiltGetResourcesInput = TiltBaseInput.extend({
  filter: z.string().optional(),
  labels: z.array(z.string().regex(/^[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?$/)).optional(),
});

// tilt_logs schema
export const TiltLogsInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
  follow: z.boolean().optional(),
  tailLines: z.number().int().positive().max(10000).optional(),
  level: z.enum(['warn', 'error']).optional(),
  source: z.enum(['all', 'build', 'runtime']).optional(),
});

// tilt_trigger schema
export const TiltTriggerInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
});
```

### Command Execution Safety

```typescript
// src/tilt/cli-client.ts
import { spawn } from 'child_process';

export class TiltCliClient {
  private port: number;
  private host: string;

  constructor(port: number, host: string) {
    this.port = port;
    this.host = host;
  }

  // SAFE: Uses argument array (no shell interpolation)
  async getResources(labels?: string[]): Promise<Resource[]> {
    const args = [
      'get', 'uiresources',
      '-o', 'json',
      '--port', this.port.toString(),
      '--host', this.host,
    ];

    if (labels && labels.length > 0) {
      args.push('-l', labels.join(','));
    }

    const result = await this.execTilt(args);
    return JSON.parse(result).items;
  }

  // UNSAFE: Would allow command injection
  // async getResources_UNSAFE(labels?: string): Promise<Resource[]> {
  //   const cmd = `tilt get uiresources -o json -l ${labels}`;  // ❌ NO!
  //   const { stdout } = await execAsync(cmd);
  //   return JSON.parse(stdout).items;
  // }

  private execTilt(args: string[], timeout: number = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('tilt', args, {
        timeout,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      proc.on('error', (error) => {
        if (error.message.includes('ENOENT')) {
          reject(new Error('Tilt CLI not found. Install from: https://docs.tilt.dev/install.html'));
        } else {
          reject(error);
        }
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Tilt command failed (exit ${code}): ${stderr}`));
        }
      });
    });
  }
}
```

## WebSocket Streaming Design

### MCP Notification Integration

```typescript
// src/tilt/websocket-client.ts
import WebSocket from 'ws';
import { McpServer } from '@modelcontextprotocol/sdk';

export interface TiltWebSocketUpdate {
  view: {
    uiResources: UIResource[];
    logList: LogLine[];
    // ... other Tilt view data
  };
}

export class TiltWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private mcpServer: McpServer;

  constructor(
    mcpServer: McpServer,
    port: number = 10350,
    host: string = 'localhost'
  ) {
    this.url = `ws://${host}:${port}/ws/view`;
    this.mcpServer = mcpServer;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${error.message}`));
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const update: TiltWebSocketUpdate = JSON.parse(data.toString());
          this.handleUpdate(update);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('close', () => {
        this.handleClose();
      });
    });
  }

  private handleUpdate(update: TiltWebSocketUpdate) {
    // Send MCP notification for resource updates
    this.mcpServer.sendNotification({
      method: 'notifications/resources/updated',
      params: {
        resources: update.view.uiResources,
        timestamp: new Date().toISOString(),
      },
    });

    // Send MCP notification for new logs
    if (update.view.logList && update.view.logList.length > 0) {
      this.mcpServer.sendNotification({
        method: 'notifications/logs',
        params: {
          logs: update.view.logList,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private handleClose() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

### Streaming Logs via Tool

```typescript
// src/tools/logs.ts
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltLogsInput } from './schemas.js';
import { TiltCliClient } from '../tilt/cli-client.js';

export const tiltLogsTool = tool(
  'tilt_logs',
  'Get logs from a Tilt resource. Supports following logs in real-time.',
  TiltLogsInput.shape,
  async (args, extra) => {
    const client = new TiltCliClient(
      args.tiltPort || 10350,
      args.tiltHost || 'localhost'
    );

    if (args.follow) {
      // For follow mode, return streaming text
      const stream = await client.streamLogs(args.resourceName, args);

      return {
        content: [
          {
            type: 'text',
            text: 'Streaming logs... (Press Ctrl+C to stop)\n\n',
          },
        ],
        isStreaming: true,
        stream,
      };
    } else {
      // For one-shot, return complete logs
      const logs = await client.getLogs(args.resourceName, args);

      return {
        content: [
          {
            type: 'text',
            text: logs,
          },
        ],
      };
    }
  }
);
```

## MCP Resources

Resources provide read-only access to Tilt data:

1. **tilt://session**
   - Current Tilt session information
   - Auto-updates via WebSocket

2. **tilt://resources**
   - List of all resources (alternative to tool)
   - URI: `tilt://resources`

3. **tilt://resources/{resourceName}**
   - Individual resource details
   - URI template: `tilt://resources/{resourceName}`

4. **tilt://logs/{resourceName}**
   - Latest logs (last 100 lines by default)
   - URI template: `tilt://logs/{resourceName}`

## Project Structure

```
tilt-mcp/
├── .claude/
│   └── CLAUDE.md
├── docs/
│   ├── agent-sdk-typescript.md
│   ├── mcp-typescript-sdk.md
│   ├── mcp-configuration-proposal.md      # v1 (original)
│   ├── mcp-configuration-proposal-v2.md   # v2 (this document)
│   ├── codex-review-feedback.md
│   └── tilt-api-validation.md
├── src/
│   ├── server.ts                  # Main MCP server setup
│   ├── types.ts                   # Shared TypeScript types
│   ├── tools/
│   │   ├── index.ts              # Tool registry
│   │   ├── schemas.ts            # Zod validation schemas
│   │   ├── discover.ts           # tilt_discover
│   │   ├── status.ts             # tilt_status
│   │   ├── resources.ts          # tilt_get_resources, tilt_describe_resource
│   │   ├── logs.ts               # tilt_logs
│   │   ├── trigger.ts            # tilt_trigger
│   │   └── control.ts            # tilt_enable, tilt_disable, tilt_args
│   ├── resources/
│   │   ├── index.ts              # Resource registry
│   │   ├── session.ts            # Session resource
│   │   ├── resources.ts          # Resources list/detail
│   │   └── logs.ts               # Log resources
│   └── tilt/
│       ├── connection.ts         # Session detection & health
│       ├── cli-client.ts         # Tilt CLI wrapper (safe execution)
│       ├── websocket-client.ts   # WebSocket streaming client
│       ├── parser.ts             # CLI output parsing utilities
│       └── types.ts              # Tilt-specific TypeScript types
├── tests/
│   ├── tools/
│   ├── resources/
│   ├── tilt/
│   └── fixtures/                 # Real Tilt CLI output samples
│       ├── get-uiresources.json
│       ├── get-session.json
│       └── logs-sample.txt
├── scripts/
│   └── mock-service.js           # Demo service for Tiltfile
├── package.json
├── tsconfig.json
├── Tiltfile
└── README.md
```

## Dependencies

```json
{
  "name": "tilt-mcp-server",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "ws": "^8.18.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.0",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "bun-types": "^1.3.2",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "typedoc": "^0.25.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Testing Strategy

### Unit Tests

**Mock CLI Execution**:
```typescript
// tests/tilt/cli-client.test.ts
import { describe, it, expect, mock } from 'bun:test';
import { TiltCliClient } from '../../src/tilt/cli-client';

mock.module('child_process', () => ({
  spawn: mock.fn(),
}));

describe('TiltCliClient', () => {
  it('getResources returns parsed JSON', async () => {
    const mockOutput = JSON.stringify(require('../fixtures/get-uiresources.json'));

    // Mock spawn to return fixture
    const { spawn } = await import('child_process');
    (spawn as any).mockReturnValue({
      stdout: {
        on: (event: string, cb: Function) => {
          if (event === 'data') cb(mockOutput);
        },
      },
      stderr: { on: mock.fn() },
      on: (event: string, cb: Function) => {
        if (event === 'close') cb(0);
      },
    });

    const client = new TiltCliClient(10350, 'localhost');
    const resources = await client.getResources();

    expect(resources).toHaveLength(19);
    expect(resources[0].metadata.name).toBe('web-app');
  });
});
```

### Integration Tests

**Test Against Real Tilt**:
```typescript
// tests/integration/tilt-commands.test.ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { TiltConnection } from '../../src/tilt/connection';
import { TiltCliClient } from '../../src/tilt/cli-client';

describe('Tilt Integration Tests', () => {
  let connection: TiltConnection;
  let client: TiltCliClient;

  beforeAll(async () => {
    connection = new TiltConnection();
    const sessionActive = await connection.checkSession();

    if (!sessionActive) {
      throw new Error('Integration tests require active Tilt session');
    }

    client = new TiltCliClient(10350, 'localhost');
  });

  it('can list resources', async () => {
    const resources = await client.getResources();
    expect(resources).toBeDefined();
    expect(Array.isArray(resources)).toBe(true);
  });

  it('can get logs', async () => {
    const resources = await client.getResources();
    if (resources.length > 0) {
      const logs = await client.getLogs(resources[0].metadata.name, { tailLines: 10 });
      expect(typeof logs).toBe('string');
    }
  });
});
```

### Fixtures

Capture real Tilt output for consistent testing:

```bash
# Capture fixtures
tilt get uiresources -o json > tests/fixtures/get-uiresources.json
tilt get session -o json > tests/fixtures/get-session.json
tilt logs web-app 2>&1 | head -50 > tests/fixtures/logs-sample.txt
```

## Error Handling

### Error Taxonomy

```typescript
// src/tilt/errors.ts
export class TiltError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'TiltError';
  }
}

export class TiltNotInstalledError extends TiltError {
  constructor() {
    super(
      'Tilt CLI not found. Please install Tilt: https://docs.tilt.dev/install.html',
      'TILT_NOT_INSTALLED'
    );
  }
}

export class TiltNotRunningError extends TiltError {
  constructor(port: number, host: string) {
    super(
      `No active Tilt session on ${host}:${port}. Run 'tilt up' first.`,
      'TILT_NOT_RUNNING',
      { port, host }
    );
  }
}

export class TiltResourceNotFoundError extends TiltError {
  constructor(resourceName: string) {
    super(
      `Resource '${resourceName}' not found. Use tilt_get_resources to list available resources.`,
      'RESOURCE_NOT_FOUND',
      { resourceName }
    );
  }
}

export class TiltCommandTimeoutError extends TiltError {
  constructor(command: string, timeout: number) {
    super(
      `Tilt command '${command}' timed out after ${timeout}ms`,
      'COMMAND_TIMEOUT',
      { command, timeout }
    );
  }
}
```

### User-Facing Error Messages

All errors provide:
1. Clear description of what went wrong
2. Why it happened (if known)
3. How to fix it (actionable steps)

```typescript
function handleTiltError(error: any): never {
  if (error.code === 'ENOENT') {
    throw new TiltNotInstalledError();
  }

  if (error.stderr?.includes('connection refused')) {
    throw new TiltNotRunningError(10350, 'localhost');
  }

  if (error.stderr?.includes('not found')) {
    const match = error.stderr.match(/resource "([^"]+)" not found/);
    if (match) {
      throw new TiltResourceNotFoundError(match[1]);
    }
  }

  if (error.killed && error.signal === 'SIGTERM') {
    throw new TiltCommandTimeoutError('tilt command', 30000);
  }

  throw new TiltError(`Tilt command failed: ${error.message}`, 'UNKNOWN_ERROR', error);
}
```

## Security Considerations

### Input Validation

1. **Resource Names**: Validated against Kubernetes naming conventions (no path traversal)
2. **Labels**: Alphanumeric + hyphens only
3. **Port Numbers**: 1-65535 range
4. **Host Names**: Alphanumeric + dots + hyphens only

### Command Execution

1. **Argument Arrays**: Always use `spawn(command, args[])`, never shell interpolation
2. **No User Input in Commands**: All user input validated before use
3. **Timeouts**: All commands have reasonable timeouts (5-30 seconds)
4. **Resource Limits**: Log output capped at reasonable sizes

### Principle: Fail Securely

- Invalid input → Throw error immediately
- Command fails → Propagate error with context
- Timeout → Kill process and report
- Unknown error → Generic message (no internals leaked)

## Next Steps

### Phase 1: Foundation (Week 1)
1. ✅ Validate Tilt CLI commands and API
2. ✅ Update architecture based on findings
3. Initialize npm project with all dependencies
4. Set up TypeScript configuration
5. Implement `TiltConnection` with session detection
6. Implement `TiltCliClient` with safe execution
7. Create Zod schemas for all tools
8. Implement first tool: `tilt_status`
9. Write unit tests with fixtures

### Phase 2: Core Tools (Week 2)
1. Implement remaining Phase 1 tools
2. Add WebSocket client for streaming
3. Implement MCP resources
4. Integration tests with real Tilt
5. Error handling and user messages
6. Documentation and examples

### Phase 3: Polish & Deploy (Week 3)
1. Add Phase 2 tools (enable/disable/args)
2. Performance optimization
3. Observability (structured logging)
4. Package for distribution
5. README and user documentation
6. CI/CD setup

## Conclusion

This updated proposal reflects the validated Tilt integration architecture based on actual Tilt v0.35.0 behavior. The CLI-only approach simplifies implementation while WebSocket provides streaming capabilities. Comprehensive input validation and error handling ensure security and reliability.

**Ready to implement**: All critical questions addressed, architecture validated, security specified.
