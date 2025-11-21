/**
 * tilt_trigger tool
 *
 * Manually triggers a resource update
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { TiltConnection } from '../tilt/connection.js';
import { type TiltToolExtra, TiltTriggerInput } from './schemas.js';

export const tiltTrigger = tool(
  'tilt_trigger',
  'Manually trigger a resource update',
  TiltTriggerInput.shape,
  async (args, _extra) => {
    const extra = (_extra ?? {}) as TiltToolExtra;
    const port = args.tiltPort ?? extra.tiltPort ?? 10350;
    const host = args.tiltHost ?? extra.tiltHost ?? 'localhost';
    const binaryPath = extra.tiltBinaryPath;

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
  },
);
