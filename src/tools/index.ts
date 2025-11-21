/**
 * Tool registry
 *
 * Exports all MCP tools for Tilt
 * Note: tiltDump is intentionally excluded - returns 6.8MB which is unusable for LLMs
 */

export { tiltArgs } from './args.js';
export { tiltDescribeResource } from './describe.js';
export { tiltDisable } from './disable.js';
export { tiltDiscover } from './discover.js';
export { tiltEnable } from './enable.js';
export { tiltLogs } from './logs.js';
export { tiltGetResources } from './resources.js';
export { tiltStatus } from './status.js';
export { tiltTrigger } from './trigger.js';
export { tiltWait } from './wait.js';
