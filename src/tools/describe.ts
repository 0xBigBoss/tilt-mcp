/**
 * tilt_describe_resource tool
 *
 * Gets detailed information about a specific resource
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { TiltConnection } from '../tilt/connection.js';
import { TiltDescribeResourceInput, type TiltToolExtra } from './schemas.js';

export const tiltDescribeResource = tool(
  'tilt_describe_resource',
  'Get detailed information about a specific resource',
  TiltDescribeResourceInput.shape,
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

    // Get resource details using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    const resource = await client.describeResource(args.resourceName);

    const result = {
      resource,
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
