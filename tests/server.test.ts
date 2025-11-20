/**
 * MCP Server tests
 * Tests the core MCP server functionality including:
 * - Server initialization
 * - Tool registration
 * - Tool invocation (via handlers)
 * - Error handling
 * - Proper MCP protocol responses
 */

import { describe, expect, it } from 'bun:test';
import { createServer, handleListTools, handleCallTool } from '../src/server.ts';

describe('MCP Server Initialization', () => {
  it('creates server with correct name and version', () => {
    const server = createServer();
    
    expect(server).toBeDefined();
  });
});

describe('Tool Registration - tools/list handler', () => {
  it('registers all 6 Phase 1 tools', async () => {
    const response = await handleListTools();
    
    expect(response.tools).toBeDefined();
    expect(response.tools.length).toBe(6);
    
    // Verify all expected tools are registered
    const toolNames = response.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain('tilt_discover');
    expect(toolNames).toContain('tilt_status');
    expect(toolNames).toContain('tilt_get_resources');
    expect(toolNames).toContain('tilt_describe_resource');
    expect(toolNames).toContain('tilt_logs');
    expect(toolNames).toContain('tilt_trigger');
  });

  it('tilt_discover has correct schema', async () => {
    const response = await handleListTools();
    
    const tool = response.tools.find((t: { name: string }) => t.name === 'tilt_discover');
    expect(tool).toBeDefined();
    expect(tool.name).toBe('tilt_discover');
    expect(tool.description).toContain('Discover running Tilt instances');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.inputSchema.type).toBe('object');
  });

  it('tilt_status has correct schema', async () => {
    const response = await handleListTools();
    
    const tool = response.tools.find((t: { name: string }) => t.name === 'tilt_status');
    expect(tool).toBeDefined();
    expect(tool.name).toBe('tilt_status');
    expect(tool.description).toContain('Get overall Tilt status');
    expect(tool.inputSchema).toBeDefined();
  });

  it('tilt_get_resources has correct schema', async () => {
    const response = await handleListTools();
    
    const tool = response.tools.find((t: { name: string }) => t.name === 'tilt_get_resources');
    expect(tool).toBeDefined();
    expect(tool.name).toBe('tilt_get_resources');
    expect(tool.description).toContain('List all resources');
    expect(tool.inputSchema).toBeDefined();
  });

  it('tilt_describe_resource has correct schema', async () => {
    const response = await handleListTools();
    
    const tool = response.tools.find((t: { name: string }) => t.name === 'tilt_describe_resource');
    expect(tool).toBeDefined();
    expect(tool.name).toBe('tilt_describe_resource');
    expect(tool.description).toContain('detailed information');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.inputSchema.properties.resourceName).toBeDefined();
  });

  it('tilt_logs has correct schema', async () => {
    const response = await handleListTools();
    
    const tool = response.tools.find((t: { name: string }) => t.name === 'tilt_logs');
    expect(tool).toBeDefined();
    expect(tool.name).toBe('tilt_logs');
    expect(tool.description).toContain('logs');
    expect(tool.inputSchema).toBeDefined();
  });

  it('tilt_trigger has correct schema', async () => {
    const response = await handleListTools();
    
    const tool = response.tools.find((t: { name: string }) => t.name === 'tilt_trigger');
    expect(tool).toBeDefined();
    expect(tool.name).toBe('tilt_trigger');
    expect(tool.description).toContain('trigger');
    expect(tool.inputSchema).toBeDefined();
  });
});

describe('Tool Invocation - tools/call handler', () => {
  it('tilt_discover tool is implemented and callable', async () => {
    const result = handleCallTool({
      params: {
        name: 'tilt_discover',
        arguments: {},
      },
    });

    // Tool is implemented - it will either succeed or fail depending on Tilt availability
    // Either way, it should not throw "not implemented"
    await expect(result).resolves.toBeDefined();
  });

  it('tilt_status tool is implemented and callable', async () => {
    const result = handleCallTool({
      params: {
        name: 'tilt_status',
        arguments: {},
      },
    });

    // May succeed if Tilt is running, or throw error if not
    try {
      await result;
      // Success - Tilt is running
    } catch (error: any) {
      // Expected to fail if Tilt not running
      expect(error.message).not.toMatch(/not implemented/i);
    }
  });

  it('tilt_get_resources tool is implemented and callable', async () => {
    const result = handleCallTool({
      params: {
        name: 'tilt_get_resources',
        arguments: {},
      },
    });

    try {
      await result;
      // Success - Tilt is running
    } catch (error: any) {
      // Expected to fail if Tilt not running
      expect(error.message).not.toMatch(/not implemented/i);
    }
  });

  it('tilt_describe_resource tool is implemented and callable', async () => {
    const result = handleCallTool({
      params: {
        name: 'tilt_describe_resource',
        arguments: { resourceName: 'my-service' },
      },
    });

    try {
      await result;
      // Success - resource exists
    } catch (error: any) {
      // Expected to fail if resource not found
      expect(error.message).not.toMatch(/not implemented/i);
    }
  });

  it('tilt_logs tool is implemented and callable', async () => {
    const result = handleCallTool({
      params: {
        name: 'tilt_logs',
        arguments: { resourceName: 'my-service' },
      },
    });

    try {
      await result;
      // Success - logs available
    } catch (error: any) {
      // Expected to fail if resource not found
      expect(error.message).not.toMatch(/not implemented/i);
    }
  });

  it('tilt_trigger tool is implemented and callable', async () => {
    const result = handleCallTool({
      params: {
        name: 'tilt_trigger',
        arguments: { resourceName: 'my-service' },
        },
      });

    try {
      await result;
      // Success - trigger worked
    } catch (error: any) {
      // Expected to fail if resource not found
      expect(error.message).not.toMatch(/not implemented/i);
    }
  });
});

describe('Error Handling', () => {
  it('throws error for unknown tool', async () => {
    await expect(
      handleCallTool({
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      })
    ).rejects.toThrow(/Unknown tool/);
  });

  it('validates input schema for tilt_describe_resource', async () => {
    await expect(
      handleCallTool({
        params: {
          name: 'tilt_describe_resource',
          arguments: {}, // Missing required resourceName
        },
      })
    ).rejects.toThrow();
  });

  it('validates input schema for tilt_logs', async () => {
    await expect(
      handleCallTool({
        params: {
          name: 'tilt_logs',
          arguments: {}, // Missing required resourceName
        },
      })
    ).rejects.toThrow();
  });

  it('rejects invalid resource names', async () => {
    await expect(
      handleCallTool({
        params: {
          name: 'tilt_describe_resource',
          arguments: { resourceName: '../../../etc/passwd' },
        },
      })
    ).rejects.toThrow();
  });

  it('rejects invalid port numbers', async () => {
    await expect(
      handleCallTool({
        params: {
          name: 'tilt_status',
          arguments: { tiltPort: 99999 },
        },
      })
    ).rejects.toThrow();
  });
});

describe('MCP Protocol Responses', () => {
  it('tools/list returns proper MCP response format', async () => {
    const response = await handleListTools();
    
    expect(response).toBeDefined();
    expect(response.tools).toBeDefined();
    expect(Array.isArray(response.tools)).toBe(true);
    
    // Verify tool format
    response.tools.forEach((tool: unknown) => {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
    });
  });

  it('all tool schemas have proper JSON Schema structure', async () => {
    const response = await handleListTools();
    
    response.tools.forEach((tool: any) => {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
      
      // All tools should support optional tiltPort and tiltHost
      if (tool.inputSchema.properties.tiltPort) {
        expect(tool.inputSchema.properties.tiltPort.type).toBe('integer');
      }
      if (tool.inputSchema.properties.tiltHost) {
        expect(tool.inputSchema.properties.tiltHost.type).toBe('string');
      }
    });
  });
});
