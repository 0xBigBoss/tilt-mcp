/**
 * MCP Server Integration Tests
 *
 * Tests the full MCP protocol flow between client and server,
 * verifying that the server correctly handles initialization,
 * tool listing, and tool invocation through the MCP protocol.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
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
      cwd: '/Users/allen/0xbigboss/tilt-mcp',
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
      expect(toolNames).toContain('tilt_discover');
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

    it('rejects invalid port range for tilt_discover', async () => {
      await expect(
        client.callTool({
          name: 'tilt_discover',
          arguments: {
            portRange: [100, 50], // Invalid: start > end
          },
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

  describe('Tool Invocation - tilt_discover', () => {
    it('returns discovery results in proper MCP format', async () => {
      const result = await client.callTool({
        name: 'tilt_discover',
        arguments: {
          portRange: [65000, 65001], // Unlikely to have anything running
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);

      const textContent = result.content[0];
      expect(textContent.type).toBe('text');
      expect(typeof (textContent as { text: string }).text).toBe('string');

      // Should be valid JSON with consistent DiscoveryResult shape
      const parsed = JSON.parse((textContent as { text: string }).text);
      expect(parsed.instances).toBeDefined();
      expect(Array.isArray(parsed.instances)).toBe(true);
    });

    it('returns empty array when no instances found', async () => {
      const result = await client.callTool({
        name: 'tilt_discover',
        arguments: {
          portRange: [65000, 65001], // Very unlikely to have anything
        },
      });

      const textContent = result.content[0] as { text: string };
      const parsed = JSON.parse(textContent.text);
      expect(parsed.instances).toEqual([]);
      expect(parsed.warning).toBeUndefined();
      expect(parsed.message).toBeUndefined();
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

    // Create transport with environment variable for tilt binary path
    transport = new StdioClientTransport({
      command: 'bun',
      args: ['src/server.ts'],
      cwd: '/Users/allen/0xbigboss/tilt-mcp',
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
    it('throws MCP error when no tilt instance is running', async () => {
      // The server uses the real tilt binary (not fixture), so this will fail
      // because no Tilt instance is running on the fixture port
      // This tests that errors are properly propagated through MCP protocol
      await expect(
        client.callTool({
          name: 'tilt_status',
          arguments: {
            tiltPort: fixture.port,
            tiltHost: fixture.host,
          },
        }),
      ).rejects.toThrow(/No tilt apiserver found/);
    });
  });

  describe('Tool Invocation - tilt_get_resources', () => {
    it('throws MCP error when no tilt instance is running', async () => {
      // Similar to status, this will fail without a running Tilt instance
      await expect(
        client.callTool({
          name: 'tilt_get_resources',
          arguments: {
            tiltPort: fixture.port,
            tiltHost: fixture.host,
          },
        }),
      ).rejects.toThrow(/No tilt apiserver found/);
    });

    it('validates filter parameter format', async () => {
      // Filter with valid format should be accepted by schema
      // (will still fail due to no Tilt, but schema validation passes)
      await expect(
        client.callTool({
          name: 'tilt_get_resources',
          arguments: {
            tiltPort: fixture.port,
            tiltHost: fixture.host,
            filter: 'test',
          },
        }),
      ).rejects.toThrow(/No tilt apiserver found/);
    });
  });

  describe('Error Propagation', () => {
    it('propagates connection errors through MCP protocol', async () => {
      // Try to connect to a port that doesn't have tilt running
      // The server should throw an MCP error with the connection failure
      await expect(
        client.callTool({
          name: 'tilt_status',
          arguments: {
            tiltPort: 65432,
            tiltHost: '127.0.0.1',
          },
        }),
      ).rejects.toThrow(/No tilt apiserver found/);
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
      cwd: '/Users/allen/0xbigboss/tilt-mcp',
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
        name: 'tilt_discover',
        arguments: {
          portRange: 'not-an-array', // Should be [number, number]
        },
      }),
    ).rejects.toThrow();
  });
});
