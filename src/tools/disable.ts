/**
 * tilt_disable tool
 *
 * Disables a Tilt resource
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { getDefaultTiltHost, getDefaultTiltPort } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import { TiltDisableInput, type TiltToolExtra } from './schemas.js';

export const tiltDisable = tool(
  'tilt_disable',
  'Disable a Tilt resource',
  TiltDisableInput.shape,
  async (args, _extra) => {
    const extra = (_extra ?? {}) as TiltToolExtra;
    const port = args.tiltPort ?? extra.tiltPort ?? getDefaultTiltPort();
    const host = args.tiltHost ?? extra.tiltHost ?? getDefaultTiltHost();
    const binaryPath = extra.tiltBinaryPath;

    // Check if session is active first
    const connection = new TiltConnection({
      port,
      host,
      binaryPath,
    });

    await connection.checkSession();

    // Disable resource using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    await client.disable(args.resourceName);

    const result = {
      success: true,
      resourceName: args.resourceName,
      message: `Resource '${args.resourceName}' disabled successfully`,
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
