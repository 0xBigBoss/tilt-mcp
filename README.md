# Tilt MCP Server

MCP (Model Context Protocol) server for Tilt CLI integration, enabling AI assistants to interact with Tilt development workflows.

## Features

- **Session Discovery**: Find and connect to running Tilt instances
- **Status Monitoring**: Real-time status of Tilt resources
- **Resource Management**: List, describe, enable, disable, and trigger resources
- **Log Streaming**: Access logs from Tilt resources (with follow mode)
- **WebSocket Client**: Real-time updates via Tilt's WebSocket API
- **Safe Execution**: Secure CLI wrapper with timeout and buffer limits

## Available Tools

| Tool | Description |
|------|-------------|
| `tilt_discover` | Find running Tilt instances on specified ports |
| `tilt_status` | Get Tilt session status |
| `tilt_get_resources` | List all resources in the Tilt session |
| `tilt_describe_resource` | Get detailed information about a resource |
| `tilt_logs` | View logs from resources (supports streaming) |
| `tilt_trigger` | Manually trigger a resource update |
| `tilt_enable` | Enable a disabled resource |
| `tilt_disable` | Disable a resource |
| `tilt_args` | Set or clear Tiltfile arguments |
| `tilt_wait` | Wait for resources to reach a ready state |
| `tilt_dump` | Export Tilt engine state |

## Prerequisites

- [Bun](https://bun.sh) 1.3+ (runtime, package manager, test runner)
- [Tilt](https://tilt.dev) CLI (v0.35.0 or later)

## Installation

```bash
bun install
```

## Usage

### As MCP Server

The server communicates via stdio transport:

```bash
bun run start
```

### Configure in Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "tilt": {
      "command": "bun",
      "args": ["run", "/path/to/tilt-mcp/dist/server.js"]
    }
  }
}
```

## Development

```bash
# Build
bun run build

# Development mode (watch)
bun run dev

# Run tests
bun test

# Run tests in watch mode
bun run test:watch

# Type checking (uses tsgo - native TypeScript)
bun run typecheck

# Linting (uses Biome)
bun run lint
bun run lint:fix
```

## Project Structure

```
tilt-mcp/
├── src/
│   ├── server.ts              # MCP server entry point
│   ├── tools/                 # MCP tool implementations
│   │   ├── discover.ts        # tilt_discover
│   │   ├── status.ts          # tilt_status
│   │   ├── resources.ts       # tilt_get_resources
│   │   ├── describe.ts        # tilt_describe_resource
│   │   ├── logs.ts            # tilt_logs
│   │   ├── trigger.ts         # tilt_trigger
│   │   ├── enable.ts          # tilt_enable
│   │   ├── disable.ts         # tilt_disable
│   │   ├── args.ts            # tilt_args
│   │   ├── wait.ts            # tilt_wait
│   │   ├── dump.ts            # tilt_dump
│   │   └── schemas.ts         # Zod validation schemas
│   └── tilt/                  # Tilt integration layer
│       ├── cli-client.ts      # Safe CLI command execution
│       ├── ws-client.ts       # WebSocket client for real-time updates
│       ├── connection.ts      # Connection management
│       ├── types.ts           # TypeScript type definitions
│       └── errors.ts          # Error types
├── tests/
│   ├── tools/                 # Tool unit tests
│   ├── tilt/                  # Client tests
│   ├── integration/           # MCP protocol integration tests
│   └── fixtures/              # Test fixtures and mocks
└── docs/                      # SDK reference documentation
```

## Architecture

### CLI Client

The `TiltCliClient` provides safe command execution:

- **No shell execution**: Uses `spawn()` with argument arrays
- **Timeout handling**: Configurable timeouts with process termination
- **Buffer limits**: 10MB default, 50MB for logs
- **Error parsing**: Typed errors (TiltNotRunningError, TiltResourceNotFoundError, etc.)

### WebSocket Client

The `TiltWebSocketClient` connects to Tilt's WebSocket API for real-time updates:

- Log line streaming
- Resource status updates
- Event callbacks with unsubscribe support

### Input Validation

All tool inputs are validated using Zod schemas:

- Resource names: Kubernetes naming conventions
- Port ranges: 1-65535
- Hostnames: Valid DNS names or IP addresses
- Arguments: Shell injection prevention

## Testing

The project includes comprehensive tests:

- **333 tests** across 21 test files
- Unit tests for all tools and clients
- Integration tests for MCP protocol compliance
- Mock fixtures for Tilt CLI responses

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/tools/status.test.ts

# Run integration tests only
bun run test:integration
```

## License

MIT
