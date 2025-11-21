/**
 * tilt_wait tool
 *
 * Waits for resources to reach ready state
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { TiltConnection } from '../tilt/connection.js';
import { type TiltToolExtra, TiltWaitInput } from './schemas.js';

export const tiltWait = tool(
  'tilt_wait',
  'Wait for Tilt resource(s) to reach ready state',
  TiltWaitInput.shape,
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

    // Wait for resources using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    const output = await client.wait(
      args.resources,
      args.timeout,
      args.condition,
    );

    const result = {
      success: true,
      resources: args.resources ?? 'all',
      timeout: args.timeout,
      condition: args.condition ?? 'Ready',
      output,
      message: args.resources
        ? `Resource(s) '${args.resources.join(', ')}' are ready`
        : 'All resources are ready',
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
