/**
 * tilt_trigger tool
 * 
 * Manually triggers a resource update
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltTriggerInput } from './schemas.js';
import { TiltConnection } from '../tilt/connection.js';
import { TiltCliClient } from '../tilt/cli-client.js';

export const tiltTrigger = tool(
  'tilt_trigger',
  'Manually trigger a resource update',
  TiltTriggerInput.shape,
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

    // Trigger resource using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    await client.trigger(args.resourceName);

    const result = {
      success: true,
      resourceName: args.resourceName,
      message: `Resource '${args.resourceName}' triggered successfully`,
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
