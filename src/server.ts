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
  TiltDiscoverInput,
  TiltStatusInput,
  TiltGetResourcesInput,
  TiltDescribeResourceInput,
  TiltLogsInput,
  TiltTriggerInput,
} from './tools/schemas.js';

/**
 * Handler for tools/list request
 * Exported for testing
 */
export async function handleListTools() {
  return {
    tools: [
      {
        name: 'tilt_discover',
        description: 'Discover running Tilt instances by scanning common ports',
        inputSchema: zodToJsonSchema(TiltDiscoverInput),
      },
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
    case 'tilt_discover': {
      const validatedArgs = TiltDiscoverInput.parse(args);
      throw new Error(
        `Not implemented: tilt_discover with portRange ${validatedArgs.portRange}`
      );
    }

    case 'tilt_status': {
      const validatedArgs = TiltStatusInput.parse(args);
      throw new Error(
        `Not implemented: tilt_status for ${validatedArgs.tiltHost || 'localhost'}:${validatedArgs.tiltPort || 10350}`
      );
    }

    case 'tilt_get_resources': {
      const validatedArgs = TiltGetResourcesInput.parse(args);
      throw new Error(
        `Not implemented: tilt_get_resources with filter=${validatedArgs.filter || 'none'}`
      );
    }

    case 'tilt_describe_resource': {
      const validatedArgs = TiltDescribeResourceInput.parse(args);
      throw new Error(
        `Not implemented: tilt_describe_resource for resource ${validatedArgs.resourceName}`
      );
    }

    case 'tilt_logs': {
      const validatedArgs = TiltLogsInput.parse(args);
      throw new Error(
        `Not implemented: tilt_logs for resource ${validatedArgs.resourceName}`
      );
    }

    case 'tilt_trigger': {
      const validatedArgs = TiltTriggerInput.parse(args);
      throw new Error(
        `Not implemented: tilt_trigger for resource ${validatedArgs.resourceName}`
      );
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
    }
  );

  // Register handlers
  server.setRequestHandler(ListToolsRequestSchema, handleListTools);
  server.setRequestHandler(CallToolRequestSchema, handleCallTool);

  return server;
}

/**
 * Main entry point - starts the server with stdio transport
 */
export async function main(): Promise<void> {
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
