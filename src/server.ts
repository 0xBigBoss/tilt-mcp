#!/usr/bin/env bun
/**
 * Tilt MCP Server
 *
 * Main entry point for the MCP server that provides Tilt CLI integration.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  tiltArgs,
  tiltDescribeResource,
  tiltDisable,
  tiltEnable,
  tiltGetResources,
  tiltLogs,
  tiltStatus,
  tiltTrigger,
  tiltWait,
} from './tools/index.js';
import {
  TiltArgsInput,
  TiltDescribeResourceInput,
  TiltDisableInput,
  TiltEnableInput,
  TiltGetResourcesInput,
  TiltLogsInput,
  TiltStatusInput,
  TiltTriggerInput,
  TiltWaitInput,
  validateTiltArgsInput,
} from './tools/schemas.js';

/**
 * Handler for tools/list request
 * Exported for testing
 */
export async function handleListTools() {
  return {
    tools: [
      {
        name: 'tilt_status',
        description: 'Get overall Tilt status and resource summary',
        inputSchema: zodToJsonSchema(TiltStatusInput),
      },
      {
        name: 'tilt_get_resources',
        description: 'List all resources managed by Tilt',
        inputSchema: zodToJsonSchema(TiltGetResourcesInput),
      },
      {
        name: 'tilt_describe_resource',
        description: 'Get detailed information about a specific resource',
        inputSchema: zodToJsonSchema(TiltDescribeResourceInput),
      },
      {
        name: 'tilt_logs',
        description: 'Read logs from a specific resource',
        inputSchema: zodToJsonSchema(TiltLogsInput),
      },
      {
        name: 'tilt_trigger',
        description: 'Manually trigger a resource update',
        inputSchema: zodToJsonSchema(TiltTriggerInput),
      },
      {
        name: 'tilt_enable',
        description: 'Enable a disabled resource',
        inputSchema: zodToJsonSchema(TiltEnableInput),
      },
      {
        name: 'tilt_disable',
        description: 'Disable a resource',
        inputSchema: zodToJsonSchema(TiltDisableInput),
      },
      {
        name: 'tilt_wait',
        description: 'Wait for resources to reach ready state',
        inputSchema: zodToJsonSchema(TiltWaitInput),
      },
      {
        name: 'tilt_args',
        description: 'Set or clear Tiltfile arguments',
        inputSchema: zodToJsonSchema(TiltArgsInput),
      },
    ],
  };
}

/**
 * Handler for tools/call request
 * Exported for testing
 */
export async function handleCallTool(request: {
  params: { name: string; arguments?: unknown };
}) {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'tilt_status': {
      const validatedArgs = TiltStatusInput.parse(args);
      return await tiltStatus.handler(validatedArgs, {});
    }

    case 'tilt_get_resources': {
      const validatedArgs = TiltGetResourcesInput.parse(args);
      return await tiltGetResources.handler(validatedArgs, {});
    }

    case 'tilt_describe_resource': {
      const validatedArgs = TiltDescribeResourceInput.parse(args);
      return await tiltDescribeResource.handler(validatedArgs, {});
    }

    case 'tilt_logs': {
      const validatedArgs = TiltLogsInput.parse(args);
      return await tiltLogs.handler(validatedArgs, {});
    }

    case 'tilt_trigger': {
      const validatedArgs = TiltTriggerInput.parse(args);
      return await tiltTrigger.handler(validatedArgs, {});
    }

    case 'tilt_enable': {
      const validatedArgs = TiltEnableInput.parse(args);
      return await tiltEnable.handler(validatedArgs, {});
    }

    case 'tilt_disable': {
      const validatedArgs = TiltDisableInput.parse(args);
      return await tiltDisable.handler(validatedArgs, {});
    }

    case 'tilt_wait': {
      const validatedArgs = TiltWaitInput.parse(args);
      return await tiltWait.handler(validatedArgs, {});
    }

    case 'tilt_args': {
      const validatedArgs = TiltArgsInput.parse(args);
      validateTiltArgsInput(validatedArgs); // Additional runtime validation
      return await tiltArgs.handler(validatedArgs, {});
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Create and configure the MCP server instance
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'tilt-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register handlers
  server.setRequestHandler(ListToolsRequestSchema, handleListTools);
  server.setRequestHandler(CallToolRequestSchema, handleCallTool);

  return server;
}

/**
 * Display help information
 */
function showHelp(): void {
  const help = `
Tilt MCP Server v0.1.0

USAGE:
  tilt-mcp [OPTIONS]

DESCRIPTION:
  MCP server for Tilt CLI integration, enabling AI assistants to interact
  with Tilt development workflows via the Model Context Protocol.

OPTIONS:
  -h, --help     Show this help message and exit
  -v, --version  Show version information and exit

AVAILABLE TOOLS:
  tilt_status             Get overall Tilt status and resource summary
  tilt_get_resources      List all resources managed by Tilt
  tilt_describe_resource  Get detailed information about a specific resource
  tilt_logs              Read logs from a specific resource
  tilt_trigger           Manually trigger a resource update
  tilt_enable            Enable a disabled resource
  tilt_disable           Disable a resource
  tilt_wait              Wait for resources to reach ready state
  tilt_args              Set or clear Tiltfile arguments

ENVIRONMENT VARIABLES:
  TILT_HOST    Tilt server hostname (default: localhost)
  TILT_PORT    Tilt server port (required, typically 10350)

EXAMPLES:
  # Run as MCP server (stdio transport)
  tilt-mcp

  # Configure in Claude Desktop (.mcp.json)
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

MORE INFORMATION:
  https://github.com/0xbigboss/tilt-mcp
  https://docs.tilt.dev
`;

  console.log(help.trim());
}

/**
 * Display version information
 */
function showVersion(): void {
  console.log('Tilt MCP Server v0.1.0');
}

/**
 * Main entry point - starts the server with stdio transport
 */
export async function main(): Promise<void> {
  // Parse command line arguments
  const args = Bun.argv.slice(2);

  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Handle version flag
  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(0);
  }

  // Start MCP server
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('Tilt MCP Server running on stdio');
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
