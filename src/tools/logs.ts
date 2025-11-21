/**
 * tilt_logs tool
 *
 * Gets logs from a resource with optional filtering and tailing
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { getDefaultTiltHost, getDefaultTiltPort } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import { stripAnsiCodes } from '../tilt/transformers.js';
import { TiltLogsInput, type TiltToolExtra } from './schemas.js';

export const tiltLogs = tool(
  'tilt_logs',
  'Read logs from a specific resource with optional tailing and filtering. ' +
    'Note: The level parameter filters Tilt internal messages (build/resource warnings/errors), ' +
    'not application log content. The source parameter filters by log origin (build vs runtime).',
  TiltLogsInput.shape,
  async (args, _extra) => {
    const extra = (_extra ?? {}) as TiltToolExtra;
    const port =
      (args as { tiltPort?: number }).tiltPort ??
      extra.tiltPort ??
      getDefaultTiltPort();
    const host =
      (args as { tiltHost?: string }).tiltHost ??
      extra.tiltHost ??
      getDefaultTiltHost();
    const binaryPath = extra.tiltBinaryPath;

    // Check if session is active first
    const connection = new TiltConnection({
      port,
      host,
      binaryPath,
    });

    await connection.checkSession();

    // Get logs using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    // Validate resource exists before attempting to get logs
    const resources = await client.getResources();
    const resourceExists = resources.some(
      (r) => r.metadata.name === args.resourceName,
    );

    if (!resourceExists) {
      throw new Error(
        `Resource '${args.resourceName}' not found. Use tilt_get_resources to list available resources.`,
      );
    }

    const logOptions = {
      // Note: follow mode disabled - MCP tools must return a response
      follow: false,
      tailLines: args.tailLines ?? 100,
      level: args.level,
      source: args.source,
    };

    const rawLogs = await client.getLogs(args.resourceName, logOptions);
    const logs = stripAnsiCodes(rawLogs);

    const result = {
      resourceName: args.resourceName,
      logs,
      options: logOptions,
      connectionInfo: {
        port,
        host,
      },
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);
