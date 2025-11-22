/**
 * tilt_disable tool
 *
 * Disables a Tilt resource
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { resolveTiltTarget } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import { cleanResource } from '../tilt/transformers.js';
import type { UIResource } from '../tilt/types.js';
import { TiltDisableInput, type TiltToolExtra } from './schemas.js';

export const tiltDisable = tool(
  'tilt_disable',
  'Disable a Tilt resource. Set verbose=true to include the updated resource state.',
  TiltDisableInput.shape,
  async (args, _extra) => {
    const extra = (_extra ?? {}) as TiltToolExtra;
    const { port, host } = resolveTiltTarget({
      port: extra.tiltPort,
      host: extra.tiltHost,
    });
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

    let resourceState: Record<string, unknown> | undefined;
    if (args.verbose) {
      const rawResource = await client.describeResource(args.resourceName);
      resourceState = cleanResource(rawResource as unknown as UIResource);
    }

    const result = {
      success: true,
      resourceName: args.resourceName,
      message: `Resource '${args.resourceName}' disabled successfully`,
      ...(resourceState ? { resourceState } : {}),
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
