/**
 * tilt_enable tool
 *
 * Enables a Tilt resource
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { getDefaultTiltHost, getDefaultTiltPort } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import { TiltEnableInput, type TiltToolExtra } from './schemas.js';

export const tiltEnable = tool(
  'tilt_enable',
  'Enable a disabled Tilt resource',
  TiltEnableInput.shape,
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

    // Enable resource using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    await client.enable(args.resourceName);

    const result = {
      success: true,
      resourceName: args.resourceName,
      message: `Resource '${args.resourceName}' enabled successfully`,
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
