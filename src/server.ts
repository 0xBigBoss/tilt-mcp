/**
 * Tilt MCP Server
 * 
 * Main entry point for the MCP server that provides Tilt CLI integration.
 */

export function main() {
  throw new Error('Not implemented: MCP server initialization');
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
