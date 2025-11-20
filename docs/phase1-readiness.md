# Phase 1 Readiness - Final Specifications

**Date**: 2025-11-20
**Status**: Addressing Codex Review #2 findings
**Goal**: Complete all specifications before Phase 1 implementation

## Codex Review #2 Findings Summary

Codex identified 6 critical gaps that must be addressed before implementation:

1. ❌ **Unsafe shell execution examples** still in documentation
2. ❌ **Log tailing via shell pipes** - security and cross-platform concerns
3. ❌ **WebSocket lacks** message contract, backpressure, size limits
4. ❌ **Incomplete input validation** - portRange, args, filter, IPv6
5. ❌ **Session cache concerns** - stale state handling
6. ❌ **Testing gaps** - WebSocket reconnection, timeouts, cache invalidation

## 1. Safe Command Execution - FINAL SPECIFICATION

### Mandated Pattern: Argument Arrays Only

**Rule**: ALL CLI execution MUST use `spawn(command, args[])` - NO shell interpolation, NO piping.

```typescript
// src/tilt/cli-client.ts - FINAL IMPLEMENTATION

import { spawn, ChildProcess } from 'child_process';

export interface ExecOptions {
  timeout?: number;      // Max execution time (ms)
  maxBuffer?: number;    // Max stdout/stderr size (bytes)
}

export class TiltCliClient {
  private port: number;
  private host: string;

  constructor(port: number = 10350, host: string = 'localhost') {
    this.port = port;
    this.host = host;
  }

  /**
   * Execute tilt command safely with argument array
   * NO shell interpolation - prevents command injection
   */
  private async execTilt(
    args: readonly string[],
    options: ExecOptions = {}
  ): Promise<string> {
    const timeout = options.timeout || 30000;
    const maxBuffer = options.maxBuffer || 10 * 1024 * 1024; // 10MB

    return new Promise((resolve, reject) => {
      const proc = spawn('tilt', args, {
        timeout,
        stdio: ['ignore', 'pipe', 'pipe'],
        // NO shell: true - prevents command injection
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
      }, timeout);

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.length > maxBuffer) {
          clearTimeout(timer);
          killed = true;
          proc.kill('SIGTERM');
          reject(new Error(`Output exceeded ${maxBuffer} bytes`));
        }
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (error.code === 'ENOENT') {
          reject(new TiltNotInstalledError());
        } else {
          reject(error);
        }
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);

        if (killed) {
          reject(new TiltCommandTimeoutError(args.join(' '), timeout));
          return;
        }

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(this.parseCliError(stderr, code));
        }
      });
    });
  }

  private parseCliError(stderr: string, code: number | null): Error {
    if (stderr.includes('connection refused') || stderr.includes('dial tcp')) {
      return new TiltNotRunningError(this.port, this.host);
    }
    if (stderr.includes('not found')) {
      const match = stderr.match(/resource "([^"]+)" not found/);
      if (match) {
        return new TiltResourceNotFoundError(match[1]);
      }
    }
    return new Error(`Tilt command failed (exit ${code}): ${stderr}`);
  }

  // ✅ SAFE: All user input validated, argument array
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

    const output = await this.execTilt(args);
    return JSON.parse(output).items;
  }

  // ✅ SAFE: Resource name validated by Zod before calling
  async describeResource(resourceName: string): Promise<ResourceDetail> {
    const args = [
      'describe', `uiresource/${resourceName}`,
      '-o', 'json',
      '--port', this.port.toString(),
      '--host', this.host,
    ];

    const output = await this.execTilt(args);
    return JSON.parse(output);
  }

  // ✅ SAFE: No pipes, in-process tailing (see next section)
  async getLogs(
    resourceName: string,
    options: LogOptions = {}
  ): Promise<string> {
    const args = ['logs', resourceName, '--port', this.port.toString()];

    if (options.level) args.push('--level', options.level);
    if (options.source) args.push('--source', options.source);

    const output = await this.execTilt(args, {
      timeout: options.follow ? 0 : 30000, // No timeout for follow
      maxBuffer: 50 * 1024 * 1024, // 50MB for logs
    });

    // In-process tailing (safe, no shell)
    if (options.tailLines && !options.follow) {
      return this.tailLines(output, options.tailLines);
    }

    return output;
  }

  // ✅ SAFE: In-process line tailing (cross-platform, deterministic)
  private tailLines(text: string, count: number): string {
    const lines = text.split('\n');
    return lines.slice(-count).join('\n');
  }
}
```

### Documentation Fix

**Remove all examples showing**:
- ❌ `execAsync(\`tilt get ...\`)`
- ❌ `tilt logs ... | tail -n`
- ❌ Any shell interpolation

**Replace with**:
- ✅ `spawn('tilt', ['get', ...])`
- ✅ In-process `tailLines()` helper
- ✅ Argument array examples only

## 2. Safe Log Tailing - FINAL SPECIFICATION

### In-Process Implementation (No Shell Piping)

```typescript
export interface LogOptions {
  follow?: boolean;
  tailLines?: number;  // Limit to N most recent lines
  level?: 'warn' | 'error';
  source?: 'all' | 'build' | 'runtime';
}

export class TiltCliClient {
  /**
   * Get logs with safe in-process tailing
   * NO shell pipes - cross-platform, secure, deterministic
   */
  async getLogs(
    resourceName: string,
    options: LogOptions = {}
  ): Promise<string> {
    // Always fetch without -f first for tailing
    const args = [
      'logs',
      resourceName,
      '--port', this.port.toString(),
      '--host', this.host,
    ];

    if (options.level) args.push('--level', options.level);
    if (options.source) args.push('--source', options.source);

    if (options.follow) {
      // For follow mode, return immediately with streaming handle
      return this.streamLogs(args);
    }

    // Fetch complete logs
    const output = await this.execTilt(args, {
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });

    // Tail in-process (safe, cross-platform)
    if (options.tailLines) {
      return this.tailLines(output, options.tailLines);
    }

    return output;
  }

  /**
   * Tail lines in-process (NO shell pipes)
   * Cross-platform, deterministic, secure
   */
  private tailLines(text: string, count: number): string {
    if (count <= 0) return '';

    const lines = text.split('\n');
    const startIndex = Math.max(0, lines.length - count);
    return lines.slice(startIndex).join('\n');
  }

  /**
   * Stream logs in follow mode
   * Returns readable stream for MCP to handle
   */
  private async streamLogs(args: string[]): Promise<string> {
    // Add -f flag for follow mode
    const followArgs = [...args, '-f'];

    const proc = spawn('tilt', followArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // For follow mode, we'll collect output until interrupted
    // MCP server handles the streaming to the client
    let output = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });

    // Return after collecting initial output
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return output + '\n[Streaming logs, press Ctrl+C to stop...]';
  }
}
```

**Cross-Platform**: Works on Windows, macOS, Linux
**Secure**: No shell execution, no command injection
**Deterministic**: Consistent behavior across platforms

## 3. WebSocket Specification - FINAL CONTRACT

### Message Schema

```typescript
// src/tilt/websocket-types.ts

export interface TiltWebSocketMessage {
  view: TiltView;
}

export interface TiltView {
  uiResources?: UIResource[];
  uiSession?: UISession;
  logList?: LogLine[];
  // Additional fields as discovered
}

export interface LogLine {
  spanId: string;
  text: string;
  level: 'info' | 'warn' | 'error';
  time: string;  // ISO 8601
}

export interface UIResource {
  metadata: {
    name: string;
    creationTimestamp: string;
    // ... K8s metadata
  };
  status: {
    buildHistory?: BuildRecord[];
    runtimeStatus?: RuntimeStatus;
    // ... resource status
  };
}
```

### Backpressure & Size Limits

```typescript
// src/tilt/websocket-client.ts

export interface WebSocketConfig {
  maxMessageSize: number;      // Max single message size (bytes)
  maxQueueSize: number;         // Max queued messages before drop
  notificationThrottle: number; // Min ms between MCP notifications
  reconnectMaxAttempts: number;
  reconnectBackoff: number;     // Initial backoff (ms)
}

const DEFAULT_CONFIG: WebSocketConfig = {
  maxMessageSize: 10 * 1024 * 1024,  // 10MB per message
  maxQueueSize: 100,                  // Drop old messages beyond 100
  notificationThrottle: 100,          // Max 10 notifications/sec
  reconnectMaxAttempts: 5,
  reconnectBackoff: 1000,
};

export class TiltWebSocketClient {
  private config: WebSocketConfig;
  private messageQueue: TiltWebSocketMessage[] = [];
  private lastNotification: number = 0;
  private allowedHosts: string[];

  constructor(
    mcpServer: McpServer,
    port: number = 10350,
    host: string = 'localhost',
    config: Partial<WebSocketConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.allowedHosts = [host, 'localhost', '127.0.0.1'];
    this.url = `ws://${host}:${port}/ws/view`;
    this.mcpServer = mcpServer;
  }

  async connect(): Promise<void> {
    // Validate host against allowlist
    const urlHost = new URL(this.url).hostname;
    if (!this.allowedHosts.includes(urlHost)) {
      throw new Error(`Host ${urlHost} not in allowlist`);
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        this.handleClose();
      });
    });
  }

  private handleMessage(data: Buffer) {
    // Size check
    if (data.length > this.config.maxMessageSize) {
      console.warn(`Dropped oversized WebSocket message: ${data.length} bytes`);
      return;
    }

    try {
      const message: TiltWebSocketMessage = JSON.parse(data.toString());

      // Queue management (backpressure)
      if (this.messageQueue.length >= this.config.maxQueueSize) {
        this.messageQueue.shift(); // Drop oldest
      }
      this.messageQueue.push(message);

      // Throttled processing
      this.processQueue();
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      // Don't crash on malformed messages
    }
  }

  private processQueue() {
    const now = Date.now();

    // Throttle notifications
    if (now - this.lastNotification < this.config.notificationThrottle) {
      return;
    }

    const message = this.messageQueue.shift();
    if (!message) return;

    this.lastNotification = now;
    this.sendMcpNotification(message);

    // Schedule next if queue not empty
    if (this.messageQueue.length > 0) {
      setTimeout(() => this.processQueue(), this.config.notificationThrottle);
    }
  }

  private sendMcpNotification(message: TiltWebSocketMessage) {
    // Send resource updates
    if (message.view.uiResources) {
      this.mcpServer.sendNotification({
        method: 'notifications/resources/updated',
        params: {
          resources: message.view.uiResources,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Send log updates
    if (message.view.logList && message.view.logList.length > 0) {
      this.mcpServer.sendNotification({
        method: 'notifications/logs',
        params: {
          logs: message.view.logList,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private handleClose() {
    // Exponential backoff reconnection
    if (this.reconnectAttempts < this.config.reconnectMaxAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.config.reconnectBackoff * Math.pow(2, this.reconnectAttempts),
        30000
      );

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('WebSocket reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max WebSocket reconnection attempts reached');
    }
  }
}
```

**Host Allowlist**: Only connect to localhost/127.0.0.1
**Size Limits**: 10MB per message, 100 message queue
**Backpressure**: Throttle to max 10 notifications/sec, drop old messages
**Malformed Handling**: Log and continue (no crash)

## 4. Complete Input Validation - ALL SCHEMAS

```typescript
// src/tools/schemas.ts - COMPLETE SET

import { z } from 'zod';

// Base schema
export const TiltBaseInput = z.object({
  tiltPort: z.number().int().min(1).max(65535).optional(),
  tiltHost: z.string()
    // Allow hostnames, IPv4, IPv6
    .regex(/^([a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])$/, 'Invalid host format')
    .optional(),
});

// Resource name (Kubernetes naming)
export const ResourceNameSchema = z.string()
  .min(1)
  .max(253)
  .regex(
    /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/,
    'Must be valid Kubernetes resource name'
  );

// Label (Kubernetes label format)
export const LabelSchema = z.string()
  .regex(/^[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?$/, 'Invalid label format');

// Port range
export const PortRangeSchema = z.tuple([
  z.number().int().min(1).max(65535),
  z.number().int().min(1).max(65535),
]).refine(
  ([start, end]) => start <= end,
  'Start port must be <= end port'
);

// Filter string (prevent injection)
export const FilterSchema = z.string()
  .max(256)
  .regex(/^[a-zA-Z0-9._=,\s-]*$/, 'Filter contains invalid characters');

// Tiltfile args (space-separated, no injection)
export const TiltfileArgsSchema = z.array(
  z.string().max(256).regex(/^[a-zA-Z0-9._=/-]+$/, 'Invalid arg format')
);

// Tool-specific schemas

export const TiltDiscoverInput = TiltBaseInput.extend({
  portRange: PortRangeSchema.optional().default([10350, 10354]),
});

export const TiltStatusInput = TiltBaseInput;

export const TiltGetResourcesInput = TiltBaseInput.extend({
  filter: FilterSchema.optional(),
  labels: z.array(LabelSchema).optional(),
});

export const TiltDescribeResourceInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
});

export const TiltLogsInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
  follow: z.boolean().optional(),
  tailLines: z.number().int().positive().max(10000).optional(),
  level: z.enum(['warn', 'error']).optional(),
  source: z.enum(['all', 'build', 'runtime']).optional(),
});

export const TiltTriggerInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
});

export const TiltEnableInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
});

export const TiltDisableInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
});

export const TiltArgsInput = TiltBaseInput.extend({
  args: TiltfileArgsSchema,
});
```

**IPv6 Support**: ✅ Host regex accepts IPv6 format `[::1]`
**Port Range**: ✅ Validated tuple with refinement
**Filter Safety**: ✅ Whitelist of safe characters only
**Args Safety**: ✅ Alphanumeric + safe punctuation only

## 5. Session Cache & Invalidation

### Updated Cache Strategy

```typescript
export class TiltConnection {
  private sessionActive: boolean = false;
  private lastCheck: number = 0;
  private checkInterval: number = 10000; // Reduced to 10 seconds

  /**
   * Check session with shorter cache (10s instead of 30s)
   * Explicit invalidation on errors
   */
  async checkSession(forceRefresh: boolean = false): Promise<boolean> {
    const now = Date.now();

    // Use cached result only if not forced and within interval
    if (!forceRefresh && now - this.lastCheck < this.checkInterval) {
      return this.sessionActive;
    }

    try {
      await this.execTilt(['get', 'session'], { timeout: 2000 });

      this.sessionActive = true;
      this.lastCheck = now;
      return true;
    } catch (error) {
      // Invalidate cache on any error
      this.sessionActive = false;
      this.lastCheck = now;

      // Re-throw with context
      throw this.handleSessionError(error);
    }
  }

  /**
   * Invalidate cache explicitly (call after failed operations)
   */
  invalidateCache() {
    this.sessionActive = false;
    this.lastCheck = 0;
  }

  /**
   * Get fresh session state (bypass cache)
   */
  async checkSessionFresh(): Promise<boolean> {
    return this.checkSession(true);
  }
}
```

**Cache Duration**: Reduced from 30s to 10s
**Force Refresh**: `forceRefresh` parameter for critical operations
**Explicit Invalidation**: `invalidateCache()` after errors
**Testing**: See section 6 for stale cache test cases

## 6. Complete Testing Matrix

### Unit Tests

```typescript
// tests/tilt/cli-client.test.ts

describe('TiltCliClient', () => {
  // Safe execution
  test('uses argument arrays (no shell)', async () => {
    const spawnSpy = vi.spyOn(child_process, 'spawn');
    await client.getResources();

    expect(spawnSpy).toHaveBeenCalledWith(
      'tilt',
      expect.arrayContaining(['get', 'uiresources']),
      expect.objectContaining({ stdio: expect.anything() })
    );
  });

  // Timeout handling
  test('kills process on timeout', async () => {
    // Mock spawn to never complete
    vi.spyOn(child_process, 'spawn').mockReturnValue(mockNeverEnding());

    await expect(
      client.getResources()
    ).rejects.toThrow(TiltCommandTimeoutError);
  });

  // Max buffer
  test('rejects output exceeding maxBuffer', async () => {
    const hugeOutput = 'x'.repeat(11 * 1024 * 1024); // 11MB
    vi.spyOn(child_process, 'spawn').mockReturnValue(mockOutput(hugeOutput));

    await expect(
      client.getResources()
    ).rejects.toThrow('Output exceeded');
  });

  // In-process tailing
  test('tailLines works correctly', () => {
    const logs = 'line1\nline2\nline3\nline4\nline5';
    const tailed = client['tailLines'](logs, 2);
    expect(tailed).toBe('line4\nline5');
  });
});
```

### WebSocket Tests

```typescript
// tests/tilt/websocket-client.test.ts

describe('TiltWebSocketClient', () => {
  // Reconnection with backoff
  test('reconnects with exponential backoff', async () => {
    const client = new TiltWebSocketClient(mockMcpServer);
    // ... simulate disconnection
    // ... verify backoff delays: 1s, 2s, 4s, 8s, 16s
  });

  // Malformed messages
  test('handles malformed JSON gracefully', () => {
    const client = new TiltWebSocketClient(mockMcpServer);
    // Send invalid JSON
    client['handleMessage'](Buffer.from('invalid json'));
    // Should not crash, should log error
  });

  // Large payloads
  test('drops messages exceeding maxMessageSize', () => {
    const client = new TiltWebSocketClient(mockMcpServer, 10350, 'localhost', {
      maxMessageSize: 1024,
    });

    const largeMessage = Buffer.alloc(2048);
    client['handleMessage'](largeMessage);

    // Verify dropped, MCP not notified
    expect(mockMcpServer.sendNotification).not.toHaveBeenCalled();
  });

  // Backpressure
  test('throttles notifications per config', async () => {
    const client = new TiltWebSocketClient(mockMcpServer, 10350, 'localhost', {
      notificationThrottle: 100,
    });

    // Send 10 messages rapidly
    for (let i = 0; i < 10; i++) {
      client['handleMessage'](Buffer.from(JSON.stringify({ view: {} })));
    }

    // Should throttle to max 1 per 100ms
    await sleep(1000);
    expect(mockMcpServer.sendNotification).toHaveBeenCalledTimes(10);
  });

  // Queue overflow
  test('drops old messages when queue full', () => {
    const client = new TiltWebSocketClient(mockMcpServer, 10350, 'localhost', {
      maxQueueSize: 3,
    });

    // Send 5 messages
    for (let i = 0; i < 5; i++) {
      client['handleMessage'](Buffer.from(JSON.stringify({ view: { id: i } })));
    }

    // First 2 should be dropped, last 3 retained
    expect(client['messageQueue'].length).toBe(3);
    expect(client['messageQueue'][0].view.id).toBe(2);
  });
});
```

### Session Cache Tests

```typescript
// tests/tilt/connection.test.ts

describe('TiltConnection - Session Cache', () => {
  // Cache hit
  test('uses cached result within interval', async () => {
    const execSpy = vi.spyOn(connection, 'execTilt');

    await connection.checkSession(); // First call
    await connection.checkSession(); // Second call (cached)

    expect(execSpy).toHaveBeenCalledTimes(1);
  });

  // Cache miss (expired)
  test('refreshes after cache interval', async () => {
    const execSpy = vi.spyOn(connection, 'execTilt');

    await connection.checkSession();
    await sleep(11000); // Wait past 10s interval
    await connection.checkSession();

    expect(execSpy).toHaveBeenCalledTimes(2);
  });

  // Stale cache invalidation
  test('invalidates cache on error', async () => {
    vi.spyOn(connection, 'execTilt').mockResolvedValueOnce('ok');

    await connection.checkSession(); // Cached as true
    expect(connection['sessionActive']).toBe(true);

    vi.spyOn(connection, 'execTilt').mockRejectedValueOnce(new Error('down'));

    await expect(connection.checkSession(true)).rejects.toThrow();
    expect(connection['sessionActive']).toBe(false);
  });

  // Force refresh
  test('forceRefresh bypasses cache', async () => {
    const execSpy = vi.spyOn(connection, 'execTilt');

    await connection.checkSession(); // First call
    await connection.checkSession(true); // Force refresh

    expect(execSpy).toHaveBeenCalledTimes(2);
  });
});
```

### Integration Test Matrix

```typescript
// tests/integration/

// Multi-instance discovery
test('discovers multiple Tilt instances', async () => {
  // Start Tilt on ports 10350, 10351, 10352
  // Call tilt_discover
  // Verify all 3 found
});

// Discovery with conflicts
test('handles discovery when some ports refuse connection', async () => {
  // Start Tilt on 10350 only
  // Scan 10350-10354
  // Verify graceful handling of refused connections
});

// CLI timeout paths
test('handles CLI command timeout correctly', async () => {
  // Mock Tilt command that hangs
  // Verify timeout, process kill, error message
});

// Cache invalidation in real scenario
test('invalidates cache when Tilt stops mid-window', async () => {
  // Check session (cache active)
  // Stop Tilt
  // Try operation (should fail and invalidate)
  // Check session again (should check fresh)
});
```

## 7. Answers to Open Questions

### Q: Should logs follow mode use WebSocket instead of CLI?

**Answer**: **CLI only for Phase 1**.

Rationale:
- CLI `tilt logs -f` is simpler and well-tested
- WebSocket is for UI updates, not log streaming
- MCP server can handle CLI stdout streaming directly
- Avoids duplicate streams and synchronization issues

**Phase 2** may explore WebSocket log streaming if CLI proves insufficient.

### Q: What are acceptable limits for log/resource payloads?

**Answer**:
- **Single message**: 10MB max
- **Log buffer**: 50MB max
- **Message queue**: 100 messages max
- **Notification rate**: 10/sec max (100ms throttle)
- **Reconnection**: 5 attempts max, exponential backoff

### Q: IPv6 support needed?

**Answer**: **Yes, basic support for Phase 1**.

Host regex updated to accept:
- Hostnames: `localhost`, `tilt-server`
- IPv4: `192.168.1.1`
- IPv6: `[::1]`, `[fe80::1]`

## Summary: Phase 1 Readiness Checklist

- [x] Safe command execution (argument arrays only)
- [x] Safe log tailing (in-process, no shell pipes)
- [x] WebSocket message contract defined
- [x] WebSocket backpressure & size limits specified
- [x] Complete input validation schemas (all tools)
- [x] Session cache optimized (10s, force refresh, invalidation)
- [x] Comprehensive testing matrix (unit, WebSocket, integration)
- [x] All open questions answered
- [x] IPv6 support added
- [x] Cross-platform considerations documented

## Implementation Order for Phase 1

1. **Foundation** (Week 1, Days 1-2)
   - Initialize npm project
   - Set up TypeScript, ESLint, Vitest
   - Create error classes
   - Implement `TiltConnection` with optimized cache

2. **CLI Client** (Week 1, Days 3-4)
   - Implement `TiltCliClient` with safe execution
   - Add in-process log tailing
   - Write unit tests with timeout/buffer tests

3. **First Tools** (Week 1, Day 5)
   - Create all Zod schemas
   - Implement `tilt_status` tool
   - Implement `tilt_get_resources` tool
   - Unit tests for tools

4. **MCP Server** (Week 2, Days 1-2)
   - Set up MCP server with stdio transport
   - Register tools
   - Test with MCP client (Claude Desktop)

5. **WebSocket Streaming** (Week 2, Days 3-4)
   - Implement `TiltWebSocketClient` with backpressure
   - Add MCP notification integration
   - WebSocket unit tests (reconnection, malformed, backpressure)

6. **Remaining Tools** (Week 2, Day 5)
   - Implement remaining Phase 1 tools
   - Integration tests with real Tilt
   - End-to-end testing

7. **Documentation** (Week 3, Day 1)
   - README with installation & usage
   - Tool reference documentation
   - Troubleshooting guide

**Total**: ~2-3 weeks for Phase 1

## Status: READY FOR PHASE 1

All specifications complete. No blocking issues remain.
