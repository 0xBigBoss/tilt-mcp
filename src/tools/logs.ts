/**
 * tilt_logs tool
 * 
 * Gets logs from a resource with optional filtering and tailing
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltLogsInput } from './schemas.js';
import { TiltConnection } from '../tilt/connection.js';
import { TiltCliClient } from '../tilt/cli-client.js';

export const tiltLogs = tool(
  'tilt_logs',
  'Read logs from a specific resource with optional tailing and filtering',
  TiltLogsInput.shape,
  async (args, extra) => {
    const port = args.tiltPort ?? (extra as any)?.tiltPort ?? 10350;
    const host = args.tiltHost ?? (extra as any)?.tiltHost ?? 'localhost';
    const binaryPath = (extra as any)?.tiltBinaryPath;

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

    const logOptions = {
      follow: args.follow,
      tailLines: args.tailLines,
      level: args.level,
      source: args.source,
    };

    const logs = await client.getLogs(args.resourceName, logOptions);

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
  }
);
