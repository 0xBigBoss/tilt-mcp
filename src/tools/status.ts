/**
 * tilt_status tool
 * 
 * Gets overall Tilt session status
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltStatusInput } from './schemas.js';
import { TiltConnection } from '../tilt/connection.js';
import { TiltCliClient } from '../tilt/cli-client.js';

export const tiltStatus = tool(
  'tilt_status',
  'Get overall Tilt status and resource summary',
  TiltStatusInput.shape,
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

    const sessionActive = await connection.checkSession();

    // Get resources using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    const resources = await client.getResources();

    const result = {
      sessionActive,
      resourceCount: resources.length,
      resources,
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
