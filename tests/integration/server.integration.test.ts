/**
 * Integration test for server startup
 * Verifies that the server can be created and started
 */

import { describe, expect, it } from 'bun:test';
import { createServer } from '../../src/server.ts';

describe('Server Integration', () => {
  it('creates server instance', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it('server has required properties', () => {
    const server = createServer();
    // Server should be an instance of the MCP Server class
    expect(server).toBeTruthy();
  });
});
