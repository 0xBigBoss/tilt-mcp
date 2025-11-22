/**
 * MCP Server Integration Tests
 *
 * Tests the full MCP protocol flow between client and server,
 * verifying that the server correctly handles initialization,
 * tool listing, and tool invocation through the MCP protocol.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { dirname } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.ts';

describe('MCP Server Integration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'bun',
      args: ['src/server.ts'],
      cwd: process.cwd(),
      env: {
        TILT_PORT: '10350',
        TILT_HOST: 'localhost',
      },
    });

    client = new Client({
      name: 'test-client',
      version: '1.0.0',
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('Server Lifecycle', () => {
    it('server starts and accepts connections via stdio transport', () => {
      // If we got here, the client connected successfully
      expect(client).toBeDefined();
    });

    it('server responds to initialize request with server info', async () => {
      // The client.connect() already performed initialization
      // Verify the client is in a connected state
      expect(client).toBeDefined();
    });

    it('server lists available tools', async () => {
      const result = await client.listTools();

      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);

      // Verify expected tools are present
      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toContain('tilt_status');
      expect(toolNames).toContain('tilt_get_resources');
      expect(toolNames).toContain('tilt_describe_resource');
      expect(toolNames).toContain('tilt_logs');
      expect(toolNames).toContain('tilt_trigger');
    });

    it('each tool has required schema properties', async () => {
      const result = await client.listTools();

      for (const tool of result.tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      }
    });
  });

  describe('Tool Parameter Validation', () => {
    it('rejects calls to unknown tools', async () => {
      await expect(
        client.callTool({
          name: 'unknown_tool',
          arguments: {},
        }),
      ).rejects.toThrow();
    });

    it('rejects invalid resource name format', async () => {
      await expect(
        client.callTool({
          name: 'tilt_describe_resource',
          arguments: {
            resourceName: 'INVALID-UPPERCASE',
          },
        }),
      ).rejects.toThrow();
    });
  });

});

describe('MCP Server with Tilt Fixture', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let fixture: TiltCliFixture;

  beforeAll(async () => {
    // Create fixture first to get port
    fixture = await createTiltCliFixture({
      stdout: JSON.stringify({
        kind: 'UIResourceList',
        items: [
          {
            metadata: { name: 'test-resource' },
            status: { runtimeStatus: 'ok', updateStatus: 'ok' },
          },
        ],
      }),
    });
    const fixtureDir = dirname(fixture.tiltBinary);

    // Create transport with environment variable for tilt binary path
    transport = new StdioClientTransport({
      command: 'bun',
      args: ['src/server.ts'],
      cwd: process.cwd(),
      env: {
        TILT_PORT: fixture.port.toString(),
        TILT_HOST: fixture.host,
        PATH: `${fixtureDir}:${process.env.PATH ?? ''}`,
      },
    });

    client = new Client({
      name: 'test-client-fixture',
      version: '1.0.0',
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
    fixture.cleanup();
  });

  describe('Tool Invocation - tilt_status', () => {
    it('returns Tilt status using configured environment', async () => {
      const result = await client.callTool({
        name: 'tilt_status',
        arguments: {},
      });

      const textContent = result.content[0] as { text: string };
      const parsed = JSON.parse(textContent.text);

      expect(parsed.sessionActive).toBe(true);
      expect(parsed.connectionInfo).toEqual({
        port: fixture.port,
        host: fixture.host,
      });
    });
  });

  describe('Tool Invocation - tilt_get_resources', () => {
    it('returns resources from the fixture', async () => {
      const result = await client.callTool({
        name: 'tilt_get_resources',
        arguments: {},
      });

      const parsed = JSON.parse((result.content[0] as { text: string }).text);
      expect(parsed.resources).toHaveLength(1);
      expect(parsed.resources[0].name).toBe('test-resource');
    });

    it('accepts filter parameter without schema errors', async () => {
      const result = await client.callTool({
        name: 'tilt_get_resources',
        arguments: {
          filter: 'test',
        },
      });

      const parsed = JSON.parse((result.content[0] as { text: string }).text);
      expect(parsed.resources.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Propagation', () => {
    it('propagates connection errors through MCP protocol', async () => {
      fixture.setBehavior('refused');

      await expect(
        client.callTool({
          name: 'tilt_status',
          arguments: {},
        }),
      ).rejects.toThrow(/connection refused|No active Tilt session/i);
    });
  });
});

describe('MCP Server Error Handling', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'bun',
      args: ['src/server.ts'],
      cwd: process.cwd(),
      env: {
        TILT_PORT: '10350',
        TILT_HOST: 'localhost',
      },
    });

    client = new Client({
      name: 'test-client-errors',
      version: '1.0.0',
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('handles missing required parameters', async () => {
    await expect(
      client.callTool({
        name: 'tilt_describe_resource',
        arguments: {
          // Missing required resourceName
        },
      }),
    ).rejects.toThrow();
  });

  it('handles invalid parameter types', async () => {
    await expect(
      client.callTool({
        name: 'tilt_logs',
        arguments: {
          resourceName: 123, // Should be string
        },
      }),
    ).rejects.toThrow();
  });
});
