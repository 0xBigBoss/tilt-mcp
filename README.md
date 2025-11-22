# Tilt MCP Server

MCP (Model Context Protocol) server for Tilt CLI integration, enabling AI assistants to interact with Tilt development workflows.

## Features

- **Status Monitoring**: Real-time status of Tilt resources with summary counts
- **Resource Management**: List, describe, enable, disable, and trigger resources
- **Log Access**: Access logs from Tilt resources with ANSI stripping, tail limits, and optional client-side search
- **Verbose Actions**: Optional `verbose` responses on control tools to return updated resource state
- **WebSocket Client**: Real-time updates via Tilt's WebSocket API
- **Safe Execution**: Secure CLI wrapper with timeout and buffer limits
- **LLM-Optimized Responses**: Slim resource format, pagination, and status filtering

## Available Tools

| Tool | Description |
|------|-------------|
| `tilt_status` | Get Tilt session status summary (counts by status + errors) |
| `tilt_get_resources` | List resources with filtering, pagination, and slim/verbose modes |
| `tilt_describe_resource` | Get detailed information about a resource (cleaned format) |
| `tilt_logs` | View logs from resources (plain-text output); supports client-side search; `level` filters Tilt system messages only (not app logs); see docs/log-filtering-behavior.md |
| `tilt_trigger` | Manually trigger a resource update (add `verbose` to include updated resource state) |
| `tilt_enable` | Enable a disabled resource (add `verbose` to include updated resource state) |
| `tilt_disable` | Disable a resource (add `verbose` to include updated resource state) |
| `tilt_args` | Set or clear Tiltfile arguments |
| `tilt_wait` | Wait for resources to reach a ready state (add `verbose` for a slim status summary) |

ℹ️ `tilt_dump` is implemented and tested but intentionally not registered for MCP use because the raw engine state can exceed 6MB and needs further shaping for Agent consumption. Use only after tailoring output for your client.

🚦 Connection configuration: Set `TILT_PORT` in your `.mcp.json` server config (under `env`) or export it in your shell. `TILT_HOST` defaults to `localhost` if not set. Tools will fail fast if port is missing; host/port inputs are not exposed to avoid cross-instance mistakes.
🔎 Discovery note: The previous `tilt_discover` helper was removed. Configure `TILT_PORT`/`TILT_HOST` explicitly instead of relying on discovery.

## Prerequisites

- [Bun](https://bun.sh) 1.3+ (runtime, package manager, test runner)
- [Tilt](https://tilt.dev) CLI (v0.35.0 or later)

## Installation

```bash
bun install
```

## Quick Install for Claude Code

The fastest way to use this MCP server with Claude Code is via `npx` or `bunx`:

```bash
# Using npx (npm)
claude mcp add --transport stdio tilt \
  --env TILT_PORT=10350 \
  -- npx -y @0xbigboss/tilt-mcp

# Using bunx (Bun)
claude mcp add --transport stdio tilt \
  --env TILT_PORT=10350 \
  -- bunx @0xbigboss/tilt-mcp
```

**Understanding the command:**

- `--transport stdio`: Run as a local process (required for stdio-based MCP servers)
- `--env TILT_PORT=10350`: Set the Tilt API port (required; adjust if your Tilt uses a different port)
- `--`: Separates Claude's flags from the MCP server command
- `npx -y @0xbigboss/tilt-mcp` or `bunx @0xbigboss/tilt-mcp`: Automatically downloads and runs the latest version

**Optional environment variables:**

```bash
# Connect to a remote Tilt instance
claude mcp add --transport stdio tilt \
  --env TILT_PORT=10350 \
  --env TILT_HOST=tilt.example.com \
  -- npx -y @0xbigboss/tilt-mcp
```

**Verify installation:**

```bash
# List configured MCP servers
claude mcp list

# Check server status in Claude Code
> /mcp
```

**Using the tools:**

Once installed, you can ask Claude Code to interact with Tilt:

```
> "Show me the status of all Tilt resources"
> "Get logs from the api service"
> "Trigger a rebuild of the frontend resource"
```

**Note:** This requires the package to be published to npm. For local development, see the [Building a Standalone Executable](#building-a-standalone-executable) section below.

## Usage

### As MCP Server

The server communicates via stdio transport:

```bash
# Development (watch, no build required)
bun run dev

# Production (requires build first)
bun run build
bun run start
```

### Configure in Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "tilt": {
      "command": "bun",
      "args": ["run", "/path/to/tilt-mcp/dist/server.js"],
      "env": {
        "TILT_PORT": "10350"
      }
    }
  }
}
```

Note: `TILT_HOST` defaults to `localhost`. Only set it explicitly if connecting to a remote Tilt instance.

### Connection Configuration

- Required: define `TILT_PORT` in your MCP server `env` block in `.mcp.json` (or export it before starting the server).
- Optional: `TILT_HOST` defaults to `localhost` if not explicitly set.
- Typical local setup: `TILT_PORT=10350` (host defaults to localhost)
- Tools do **not** accept host/port parameters; set them once in configuration to avoid cross-instance mistakes.
- Values are validated and the server fails fast if port is missing or invalid.

## Building a Standalone Executable

To create a standalone executable that can be added to your PATH:

```bash
# Build the standalone executable
bun run build:standalone

# The executable will be created at dist/tilt-mcp
# Add it to your PATH by creating a symlink or copying it
ln -s $(pwd)/dist/tilt-mcp /usr/local/bin/tilt-mcp

# Or copy it directly
cp dist/tilt-mcp /usr/local/bin/tilt-mcp
```

The standalone executable includes the Bun runtime and all dependencies, making it portable and easy to distribute.

### Using the Standalone Executable

Once installed to your PATH, you can run it directly:

```bash
# Run the MCP server
tilt-mcp

# Configure in Claude Desktop with the absolute path
{
  "mcpServers": {
    "tilt": {
      "command": "/usr/local/bin/tilt-mcp",
      "env": {
        "TILT_PORT": "10350"
      }
    }
  }
}
```

## Development

```bash
# Build (creates dist/server.js)
bun run build

# Build standalone executable (creates dist/tilt-mcp)
bun run build:standalone

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

## Common Tool Examples

- List resources with slim summaries: `tilt_get_resources` with no args (add `status: "error"` or `verbose: true` as needed).
- Tail Tilt hints only: `tilt_logs` with `level: "error"` (filters Tilt system messages; app logs are returned unfiltered).
- Manage Tiltfile args safely: `tilt_args` with `mode: "get"` to view, `mode: "set", args: ["arg1=value"]` to update, or `mode: "clear"` to reset (avoid running without arguments).
- Trigger and inspect a resource in one call: `tilt_trigger` with `verbose: true` to include the updated resource state.
- Wait with post-state snapshot: `tilt_wait` with `resources: ["api"], verbose: true` to receive a slim readiness summary after the wait.

## Project Structure

```
tilt-mcp/
├── src/
│   ├── server.ts              # MCP server entry point
│   ├── tools/                 # MCP tool implementations
│   │   ├── status.ts          # tilt_status
│   │   ├── resources.ts       # tilt_get_resources
│   │   ├── describe.ts        # tilt_describe_resource
│   │   ├── logs.ts            # tilt_logs
│   │   ├── trigger.ts         # tilt_trigger
│   │   ├── enable.ts          # tilt_enable
│   │   ├── disable.ts         # tilt_disable
│   │   ├── args.ts            # tilt_args
│   │   ├── wait.ts            # tilt_wait
│   │   ├── transformers.ts    # Response transformers (slim format, ANSI strip)
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

### Response Design

- Slim by default: resources are returned in a compact “slim” format with optional `verbose` to include full details.
- Tailored logs: ANSI stripping with a default `tailLines` cap; `level` filters Tilt system messages only.
- Reduced noise: build history truncated to the last two entries and duplicate endpoints deduped.
- Control tools with state: `tilt_enable`, `tilt_disable`, `tilt_trigger`, and `tilt_wait` accept `verbose` to return post-action state.

### WebSocket Client

The `TiltWebSocketClient` connects to Tilt's WebSocket API for real-time updates:

- Log line streaming
- Resource status updates
- Event callbacks with unsubscribe support

### Input Validation

All tool inputs are validated using Zod schemas:

- Resource names: Kubernetes naming conventions (plus special Tilt `(Tiltfile)`)
- Arguments: Shell injection prevention

## Testing

The project includes comprehensive tests:

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

## Troubleshooting

- Tiltfile args fixture: If Tilt reports `You specified some resources that could not be found: "--foo", "bar"`, clear stored Tiltfile args via `tilt_args` (`mode="clear"`). This scenario is used in QA coverage to validate error handling and is not a code defect.
- Log level filtering: The `level` flag on `tilt_logs` filters Tilt system messages only. Application logs are returned unfiltered; see `docs/log-filtering-behavior.md` for details, search examples, and limitations.

## License

MIT
