# Phase 1 Implementation Plan

**Goal**: Deliver working MCP server with core Tilt tools
**Timeline**: 2-3 weeks
**Status**: Ready to implement (all specs complete)

## Overview

Phase 1 delivers a functional MCP server with 6 core tools, WebSocket streaming, comprehensive testing, and production-ready error handling.

### Deliverables

1. **MCP Server** - stdio transport, tool registration
2. **CLI Client** - Safe command execution with validation
3. **Core Tools** (6):
   - `tilt_discover` - Find running Tilt instances
   - `tilt_status` - Overall session status
   - `tilt_get_resources` - List resources
   - `tilt_describe_resource` - Resource details
   - `tilt_logs` - Log access with tailing
   - `tilt_trigger` - Manual resource triggers
4. **WebSocket Client** - Real-time updates with backpressure
5. **Test Suite** - Unit, integration, fixture-based
6. **Documentation** - README, troubleshooting, examples

## Phase 1 Timeline

### Week 1: Foundation & Core Client

#### Day 1: Project Setup
- [ ] Initialize npm project
- [ ] Configure TypeScript (`tsconfig.json`)
- [ ] Set up testing (Vitest)
- [ ] Configure linting (ESLint + TypeScript ESLint)
- [ ] Create project structure (src/, tests/, fixtures/)
- [ ] Set up package.json scripts

**Deliverable**: `npm test` runs, `npm run build` compiles

#### Day 2: Error Classes & Connection
- [ ] Implement error taxonomy (`src/tilt/errors.ts`)
- [ ] Implement `TiltConnection` class with optimized cache
- [ ] Write unit tests for connection and cache
- [ ] Test session detection against real Tilt

**Deliverable**: Session detection working, cache tested

#### Day 3: CLI Client Foundation
- [ ] Implement `TiltCliClient.execTilt()` with safe execution
- [ ] Add timeout and buffer limit handling
- [ ] Implement error parsing
- [ ] Write unit tests (mock spawn)

**Deliverable**: Safe CLI execution with comprehensive error handling

#### Day 4: CLI Client Methods
- [ ] Implement `getResources()`
- [ ] Implement `describeResource()`
- [ ] Implement `getLogs()` with in-process tailing
- [ ] Implement `trigger()`
- [ ] Unit tests for all methods

**Deliverable**: All CLI methods working, tested

#### Day 5: Input Validation Schemas
- [ ] Create all Zod schemas (`src/tools/schemas.ts`)
- [ ] Write validation tests
- [ ] Verify injection prevention

**Deliverable**: Complete input validation for all tools

### Week 2: Tools & MCP Server

#### Day 1: First Tools
- [ ] Implement `tilt_discover` tool
- [ ] Implement `tilt_status` tool
- [ ] Write tool unit tests
- [ ] Test with real Tilt

**Deliverable**: 2 working tools with tests

#### Day 2: Remaining Tools
- [ ] Implement `tilt_get_resources` tool
- [ ] Implement `tilt_describe_resource` tool
- [ ] Implement `tilt_logs` tool
- [ ] Implement `tilt_trigger` tool
- [ ] Write tool unit tests

**Deliverable**: All 6 tools implemented and tested

#### Day 3: MCP Server Setup
- [ ] Implement MCP server (`src/server.ts`)
- [ ] Register all tools
- [ ] Set up stdio transport
- [ ] Create MCP client test configuration
- [ ] Test with Claude Desktop

**Deliverable**: Working MCP server, tools callable from Claude

#### Day 4: WebSocket Client
- [ ] Implement `TiltWebSocketClient` with backpressure
- [ ] Add message parsing and validation
- [ ] Implement reconnection logic
- [ ] Add MCP notification integration
- [ ] Write WebSocket unit tests

**Deliverable**: Real-time streaming with proper backpressure

#### Day 5: Integration Tests
- [ ] Capture real Tilt CLI output fixtures
- [ ] Write integration tests (requires running Tilt)
- [ ] Test multi-instance discovery
- [ ] Test error scenarios
- [ ] Test WebSocket reconnection

**Deliverable**: Comprehensive integration test suite

### Week 3: Polish & Documentation

#### Day 1: Documentation
- [ ] Write README with installation instructions
- [ ] Document all tools with examples
- [ ] Create troubleshooting guide
- [ ] Write developer guide (for contributors)

**Deliverable**: Complete documentation

#### Day 2-3: Buffer Days
- [ ] Fix any bugs discovered
- [ ] Performance optimization
- [ ] Add structured logging
- [ ] Final integration testing

**Deliverable**: Production-ready code

## Detailed Implementation Steps

### Step 1: Project Initialization

```bash
# Initialize project
cd /Users/allen/0xbigboss/tilt-mcp
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk@^1.0.0 \
            @anthropic-ai/claude-agent-sdk@^0.1.0 \
            ws@^8.18.0 \
            zod@^3.25.0

# Install dev dependencies
npm install -D @types/node@^20.0.0 \
               @types/ws@^8.5.0 \
               typescript@^5.3.0 \
               tsx@^4.7.0 \
               vitest@^1.2.0 \
               eslint@^8.56.0 \
               @typescript-eslint/eslint-plugin@^6.19.0 \
               @typescript-eslint/parser@^6.19.0
```

**package.json scripts**:
```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:integration": "vitest --run tests/integration",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src tests",
    "lint:fix": "eslint src tests --fix"
  }
}
```

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Directory structure**:
```
tilt-mcp/
├── src/
│   ├── server.ts
│   ├── types.ts
│   ├── tools/
│   │   ├── index.ts
│   │   ├── schemas.ts
│   │   ├── discover.ts
│   │   ├── status.ts
│   │   ├── resources.ts
│   │   ├── logs.ts
│   │   └── trigger.ts
│   └── tilt/
│       ├── errors.ts
│       ├── types.ts
│       ├── connection.ts
│       ├── cli-client.ts
│       └── websocket-client.ts
├── tests/
│   ├── tools/
│   ├── tilt/
│   ├── integration/
│   └── fixtures/
├── docs/
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .gitignore
└── README.md
```

### Step 2: Error Classes

**File**: `src/tilt/errors.ts`

```typescript
export class TiltError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'TiltError';
  }
}

export class TiltNotInstalledError extends TiltError {
  constructor() {
    super(
      'Tilt CLI not found. Install from: https://docs.tilt.dev/install.html',
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

export class TiltOutputExceededError extends TiltError {
  constructor(maxBuffer: number) {
    super(
      `Output exceeded maximum buffer size of ${maxBuffer} bytes`,
      'OUTPUT_EXCEEDED',
      { maxBuffer }
    );
  }
}
```

### Step 3: Connection Class

**File**: `src/tilt/connection.ts`

Implementation per `docs/phase1-readiness.md` Section 5.

Key features:
- 10-second cache (down from 30s)
- Force refresh parameter
- Explicit cache invalidation
- Proper error handling

### Step 4: CLI Client

**File**: `src/tilt/cli-client.ts`

Implementation per `docs/phase1-readiness.md` Section 1.

Key features:
- Argument arrays only (no shell)
- Timeout handling
- Buffer limits
- In-process log tailing
- Safe execution pattern

### Step 5: Validation Schemas

**File**: `src/tools/schemas.ts`

Implementation per `docs/phase1-readiness.md` Section 4.

All schemas defined:
- TiltDiscoverInput
- TiltStatusInput
- TiltGetResourcesInput
- TiltDescribeResourceInput
- TiltLogsInput
- TiltTriggerInput

### Step 6: Implement Tools

**Pattern for each tool** (example: `tilt_status`):

```typescript
// src/tools/status.ts
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltStatusInput } from './schemas.js';
import { TiltConnection } from '../tilt/connection.js';
import { TiltCliClient } from '../tilt/cli-client.js';

export const tiltStatusTool = tool(
  'tilt_status',
  'Get overall Tilt session status and resource summary',
  TiltStatusInput.shape,
  async (args, extra) => {
    const port = args.tiltPort || 10350;
    const host = args.tiltHost || 'localhost';

    const connection = new TiltConnection({ port, host });
    await connection.checkSession(); // Throws if not running

    const client = new TiltCliClient(port, host);
    const resources = await client.getResources();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            sessionActive: true,
            resourceCount: resources.length,
            resources: resources.map(r => ({
              name: r.metadata.name,
              status: r.status?.runtimeStatus || 'unknown',
            })),
            connectionInfo: {
              method: 'cli',
              port,
              host,
            },
          }, null, 2),
        },
      ],
    };
  }
);
```

Repeat pattern for all 6 tools.

### Step 7: MCP Server

**File**: `src/server.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { tiltDiscoverTool } from './tools/discover.js';
import { tiltStatusTool } from './tools/status.js';
import { tiltGetResourcesTool } from './tools/resources.js';
import { tiltDescribeResourceTool } from './tools/resources.js';
import { tiltLogsTool } from './tools/logs.js';
import { tiltTriggerTool } from './tools/trigger.js';

const server = new McpServer({
  name: 'tilt-mcp-server',
  version: '0.1.0',
});

// Register tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    tiltDiscoverTool,
    tiltStatusTool,
    tiltGetResourcesTool,
    tiltDescribeResourceTool,
    tiltLogsTool,
    tiltTriggerTool,
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  const tool = [
    tiltDiscoverTool,
    tiltStatusTool,
    tiltGetResourcesTool,
    tiltDescribeResourceTool,
    tiltLogsTool,
    tiltTriggerTool,
  ].find(t => t.name === request.params.name);

  if (!tool) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  return await tool.handler(request.params.arguments, {});
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('Tilt MCP server running on stdio');
```

### Step 8: WebSocket Client

**File**: `src/tilt/websocket-client.ts`

Implementation per `docs/phase1-readiness.md` Section 3.

Key features:
- Message schema validation
- Size limits (10MB per message)
- Queue backpressure (100 messages max)
- Throttled notifications (10/sec)
- Reconnection with exponential backoff
- Host allowlist

### Step 9: Testing

**Unit test example** (`tests/tilt/cli-client.test.ts`):

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TiltCliClient } from '../../src/tilt/cli-client.js';
import * as child_process from 'child_process';

vi.mock('child_process');

describe('TiltCliClient', () => {
  let client: TiltCliClient;

  beforeEach(() => {
    client = new TiltCliClient(10350, 'localhost');
  });

  test('uses argument arrays (no shell)', async () => {
    const mockSpawn = vi.spyOn(child_process, 'spawn').mockReturnValue({
      stdout: { on: vi.fn((event, cb) => event === 'data' && cb('{}')) },
      stderr: { on: vi.fn() },
      on: vi.fn((event, cb) => event === 'close' && cb(0)),
    } as any);

    await client.getResources();

    expect(mockSpawn).toHaveBeenCalledWith(
      'tilt',
      expect.arrayContaining(['get', 'uiresources']),
      expect.any(Object)
    );
  });

  test('throws on timeout', async () => {
    vi.spyOn(child_process, 'spawn').mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(), // Never calls close
      kill: vi.fn(),
    } as any);

    await expect(
      client.getResources()
    ).rejects.toThrow('timed out');
  });
});
```

**Integration test setup**:
```typescript
// tests/integration/setup.ts
export async function ensureTiltRunning() {
  try {
    const connection = new TiltConnection();
    await connection.checkSession();
  } catch (error) {
    throw new Error(
      'Integration tests require active Tilt session. Run "tilt up" first.'
    );
  }
}
```

### Step 10: Documentation

**README.md** structure:
1. Overview & features
2. Installation
3. Configuration (env vars)
4. Usage examples
5. Tool reference
6. Troubleshooting
7. Development guide

## Testing Strategy

### Test Pyramid

```
        /\
       /  \  Integration Tests (10%)
      /____\  - Test against real Tilt
     /      \ - End-to-end workflows
    /________\ Unit Tests (90%)
                - Mock CLI execution
                - Validate schemas
                - Test error handling
```

### Fixture Capture

```bash
# Capture real Tilt output for tests
tilt get uiresources -o json > tests/fixtures/get-uiresources.json
tilt get session -o json > tests/fixtures/get-session.json
tilt describe uiresource/web-app -o json > tests/fixtures/describe-resource.json
tilt logs web-app 2>&1 | head -50 > tests/fixtures/logs-sample.txt
```

### Test Coverage Goals

- **Unit tests**: 90%+ coverage
- **Integration tests**: Critical paths covered
- **Error scenarios**: All error classes tested
- **WebSocket**: Reconnection, malformed, backpressure
- **Cache**: Stale state, invalidation, refresh

## Success Criteria

Phase 1 is complete when:

- [x] All 6 tools implemented and tested
- [x] MCP server runs via stdio
- [x] Tools callable from Claude Desktop
- [x] WebSocket streaming works with real Tilt
- [x] 90%+ test coverage
- [x] Integration tests pass
- [x] Documentation complete
- [x] No critical bugs
- [x] Code passes lint and typecheck

## Risk Mitigation

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tilt CLI changes | Low | High | Pin to Tilt v0.35.0 for testing, document compatibility |
| WebSocket protocol changes | Low | Medium | Extensive error handling, graceful degradation |
| MCP SDK issues | Medium | High | Isolate MCP code, test with real Claude Desktop early |
| Performance issues | Medium | Low | Buffer limits, throttling, profiling |
| Cross-platform bugs | Medium | Medium | Test on macOS, Linux; document Windows limitations |

## Next Steps After Phase 1

Phase 2 scope (not in this plan):
- `tilt_enable` / `tilt_disable` tools
- `tilt_args` tool
- MCP resources (read-only data)
- Improved streaming (WebSocket logs)
- Configuration file support
- Observability (structured logging, metrics)

## Timeline Summary

- **Week 1**: Foundation, CLI client, schemas, first tools
- **Week 2**: All tools, MCP server, WebSocket, integration tests
- **Week 3**: Documentation, polish, buffer for bugs

**Total**: 2-3 weeks to production-ready Phase 1

## Status: READY TO IMPLEMENT

All specifications complete per `docs/phase1-readiness.md`.
No blocking issues. Can begin implementation immediately.
