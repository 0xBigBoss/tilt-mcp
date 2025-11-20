# Tilt MCP Tools Project

## Project Overview

This project provides Model Context Protocol (MCP) tools for the Tilt CLI, enabling AI assistants to interact with and control Tilt deployments programmatically.

**Tilt** is a local Kubernetes development tool that watches files, builds containers, loads them into the local cluster, and manages resources. Tilt enables fast, iterative development on Kubernetes.

## Project Goals

1. **Create MCP tools** that expose Tilt CLI functionality to AI assistants
2. **Enable programmatic interaction** with Tilt deployments, resources, and logs
3. **Provide comprehensive access** to Tilt's capabilities through the MCP protocol
4. **Build reusable, type-safe tools** using the TypeScript MCP SDK

## Technical Approach

### Technology Stack

- **Language**: TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Agent SDK**: `@anthropic-ai/claude-agent-sdk`
- **Schema Validation**: Zod
- **Target CLI**: Tilt

### Architecture

The project implements MCP servers that wrap Tilt CLI commands, exposing them as tools, resources, and prompts that AI assistants can use to:

- Query Tilt resource status
- Start/stop/restart services
- Read logs from deployments
- Trigger rebuilds
- Monitor deployment health
- Access Tilt configuration

### Implementation Standards

- **Type Safety**: Use Zod schemas for all tool inputs and outputs
- **Error Handling**: Fail fast with explicit error messages (no silent failures)
- **Complete Implementations**: No placeholder functions or TODO comments without corresponding errors
- **Idiomatic TypeScript**: Follow TypeScript best practices and conventions
- **Testing**: Write tests for all tools before implementation (TDD approach)
- **Documentation**: Maintain clear inline documentation for complex logic

## Reference Documentation

The project relies on two key SDKs:

### Claude Agent SDK - TypeScript

**Local reference**: [`docs/agent-sdk-typescript.md`](../docs/agent-sdk-typescript.md)

**Source**: https://platform.claude.com/docs/en/agent-sdk/typescript

Key capabilities:
- `query()`: Interact with Claude programmatically
- `tool()`: Create type-safe MCP tools with Zod schemas
- `createSdkMcpServer()`: Create in-process MCP servers
- Hooks system for custom logic injection
- Permission management and settings configuration

### MCP TypeScript SDK

**Local reference**: [`docs/mcp-typescript-sdk.md`](../docs/mcp-typescript-sdk.md)

**Source**: https://github.com/modelcontextprotocol/typescript-sdk

Key capabilities:
- `McpServer`: Primary interface for MCP protocol compliance
- Tools: Enable LLMs to perform computations and trigger actions
- Resources: Expose data to LLMs efficiently
- Transport options: stdio, HTTP, SSE
- Dynamic servers and notification handling

## Tilt CLI Reference

**Official Documentation**: https://docs.tilt.dev/

**Key Tilt Commands**:
- `tilt up`: Start Tilt and begin watching for changes
- `tilt down`: Stop all resources managed by Tilt
- `tilt logs`: View logs from resources
- `tilt get`: Get information about resources
- `tilt describe`: Show detailed information about a resource
- `tilt trigger`: Manually trigger an update

## Development Workflow

1. **Understand Tilt behavior** by running commands and observing output
2. **Define tool schema** using Zod
3. **Write failing tests** that validate expected behavior
4. **Implement tool handler** to execute Tilt commands
5. **Verify with tests** and manual validation
6. **Document usage** and add examples

## Project Structure

```
tilt-mcp/
├── .claude/
│   └── CLAUDE.md          # This file
├── docs/
│   ├── agent-sdk-typescript.md
│   └── mcp-typescript-sdk.md
├── src/
│   ├── tools/             # MCP tool implementations
│   ├── resources/         # MCP resource implementations
│   └── server.ts          # MCP server setup
├── tests/                 # Test suite
└── package.json
```

## Quality Standards

- **No placeholders**: Every function must be fully implemented or throw an explicit error
- **No silent failures**: All errors must be propagated, not logged and ignored
- **Complete implementations**: No partial logic or hardcoded return values
- **Test coverage**: All tools must have unit and integration tests
- **Type safety**: All inputs and outputs must be validated with Zod schemas

## Next Steps

1. Initialize npm project with required dependencies
2. Set up TypeScript configuration
3. Create basic MCP server structure
4. Implement first tool (e.g., `tilt status`)
5. Add tests and validation
6. Iterate on additional tools
