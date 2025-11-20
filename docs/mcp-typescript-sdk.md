# MCP TypeScript SDK Documentation

Source: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/README.md

## Overview

The Model Context Protocol (MCP) TypeScript SDK implements the full MCP specification, enabling developers to "create MCP servers that expose resources, prompts and tools" and "build MCP clients that can connect to any MCP server."

## Installation

```bash
npm install @modelcontextprotocol/sdk zod
```

The SDK requires Zod as a peer dependency for schema validation and maintains backward compatibility with Zod v3.25 or later.

## Core Components

### Server

The `McpServer` serves as the primary interface for protocol compliance and message routing:

```typescript
const server = new McpServer({
  name: 'my-app',
  version: '1.0.0'
});
```

### Tools

Tools enable LLMs to perform computations, retrieve data, and trigger side effects. The documentation demonstrates registering tools with input/output schemas using Zod validation. Tools can return structured content and `ResourceLink` objects that reference files without embedding full content—useful for performance optimization with large datasets.

### Resources

Resources expose data to LLMs without requiring significant computation. Unlike tools, resources follow an application-driven pattern where clients decide exposure methods. Resources support static URIs, dynamic parameters via `ResourceTemplate`, and context-aware completion for intelligent parameter suggestions.

### Prompts

The SDK supports prompt definition and execution capabilities.

### Completions

Clients can leverage completion functionality through the SDK.

## Transport Options

### Streamable HTTP

The preferred approach for browser-based and remote clients. Implementation options include:
- Without session management (recommended)
- With session management
- CORS configuration for browser clients
- DNS rebinding protection

### stdio

Standard input/output transport for local process communication.

### Testing & Debugging

Built-in support for development and testing workflows.

## Advanced Features

- **Dynamic Servers**: Servers with runtime-configurable capabilities
- **Notification Debouncing**: Optimize network efficiency through intelligent message batching
- **Low-Level Server**: Direct protocol handling for advanced use cases
- **User Input Elicitation**: Request information from clients
- **URL Actions**: Trigger browser-based actions
- **Client Implementation**: Build custom MCP clients
- **Authorization Proxying**: Forward authorization requests upstream
- **Backward Compatibility**: Maintained across versions

## Metadata & Display Names

Tools support display metadata with title precedence rules for UI presentation.

## Sampling

The SDK includes sampling capabilities for model-controlled execution patterns.

## Additional Resources

The complete documentation available at the GitHub repository provides extensive code examples, integration patterns, and reference implementations for both simple and complex MCP applications.
