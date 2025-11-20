# Claude Agent SDK TypeScript Reference

Source: https://platform.claude.com/docs/en/agent-sdk/typescript

## Overview

The TypeScript Agent SDK provides a complete API for interacting with Claude Code programmatically. Installation requires running `npm install @anthropic-ai/claude-agent-sdk`.

## Core Functions

### query()

The primary interface creates an async generator for streaming messages. It accepts either string prompts or async iterables for streaming input, along with optional configuration.

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query
```

Returns a `Query` object extending `AsyncGenerator<SDKMessage, void>` with methods for interruption and permission mode management.

### tool()

Creates type-safe MCP tool definitions using Zod schemas:

```typescript
function tool<Schema extends ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args, extra) => Promise<CallToolResult>
): SdkMcpToolDefinition<Schema>
```

### createSdkMcpServer()

Instantiates an in-process MCP server:

```typescript
function createSdkMcpServer(options: {
  name: string;
  version?: string;
  tools?: Array<SdkMcpToolDefinition<any>>;
}): McpSdkServerConfigWithInstance
```

## Configuration Options

The `Options` object supports 30+ configuration parameters:

**Key settings include:**
- `model`: Claude model selection (defaults to CLI setting)
- `cwd`: Working directory (defaults to `process.cwd()`)
- `maxThinkingTokens`: Extended thinking token limit
- `permissionMode`: Control execution permissions ('default', 'acceptEdits', 'bypassPermissions', 'plan')
- `systemPrompt`: Custom or preset system instructions
- `settingSources`: Control filesystem settings loading from user/project/local locations
- `mcpServers`: MCP server configurations (stdio, SSE, HTTP, or SDK)
- `hooks`: Event callbacks for PreToolUse, PostToolUse, SessionStart, etc.
- `outputFormat`: JSON schema for structured outputs

## Message Types

The SDK returns a union of message types:

- **SDKAssistantMessage**: Claude's responses with UUID and session tracking
- **SDKUserMessage**: User input with optional UUID
- **SDKResultMessage**: Final results including execution metrics and token usage
- **SDKSystemMessage**: System initialization data (tools, servers, permissions)
- **SDKPartialAssistantMessage**: Streaming events when `includePartialMessages: true`
- **SDKCompactBoundaryMessage**: Conversation compaction indicators

## Built-in Tools

The SDK provides 15+ tools accessible to Claude:

| Tool | Purpose |
|------|---------|
| Task | Delegate work to subagents |
| Bash | Execute shell commands with timeout support |
| Read/Write/Edit | File system operations |
| Glob/Grep | Pattern matching and search |
| WebSearch/WebFetch | Internet access |
| NotebookEdit | Jupyter notebook manipulation |
| TodoWrite | Task list management |
| ListMcpResources/ReadMcpResource | MCP resource access |

Each tool has defined input and output schemas with optional parameters.

## Hooks System

Eight hook events enable custom logic injection:

- PreToolUse / PostToolUse
- UserPromptSubmit / SessionStart / SessionEnd
- Notification / Stop / SubagentStop
- PreCompact

Hooks receive context including `session_id`, `cwd`, `tool_name`, and return decisions like 'approve'/'block' or custom system messages.

## Permission Management

**PermissionMode options:**
- `'default'`: Standard permission checks
- `'acceptEdits'`: Auto-approve file modifications
- `'bypassPermissions'`: Skip all checks
- `'plan'`: No execution, planning only

Custom `CanUseTool` functions enable granular permission logic with access to tool names, inputs, and suggestions.

## Settings Management

The `settingSources` array controls configuration loading:

- `'user'`: `~/.claude/settings.json`
- `'project'`: `.claude/settings.json`
- `'local'`: `.claude/settings.local.json`

By default, no filesystem settings load, providing SDK isolation. Specify sources explicitly to enable loading CLAUDE.md project instructions.

## MCP Server Integration

Four configuration types supported:

- **stdio**: `{ type: 'stdio', command: string, args?: string[] }`
- **SSE**: `{ type: 'sse', url: string, headers?: Record }`
- **HTTP**: `{ type: 'http', url: string, headers?: Record }`
- **SDK**: In-process servers via `createSdkMcpServer()`

## Plugin System

Plugins load from local paths:

```typescript
plugins: [
  { type: 'local', path: './my-plugin' }
]
```

## Agent Definitions

Programmatically define subagents:

```typescript
type AgentDefinition = {
  description: string;      // When to use
  tools?: string[];         // Allowed tools
  prompt: string;           // System instructions
  model?: string;           // Optional model override
}
```

## Error Handling

The SDK exports `AbortError` for interrupt operations and uses standard TypeScript error handling with AbortController support.

## Usage Examples

**Basic query:**
```typescript
const result = await query({
  prompt: "Analyze this code",
  options: { model: "claude-opus-4" }
});
```

**With hooks:**
```typescript
options: {
  hooks: {
    PreToolUse: [{
      hooks: [async (input, id, opts) => ({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow'
        }
      })]
    }]
  }
}
```

## See Also

- SDK overview documentation
- Python SDK reference
- CLI reference guide
- Common workflows guide
