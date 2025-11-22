/**
 * tilt_trigger tool
 *
 * Manually triggers a resource update
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { resolveTiltTarget } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import { cleanResource } from '../tilt/transformers.js';
import type { UIResource } from '../tilt/types.js';
import { type TiltToolExtra, TiltTriggerInput } from './schemas.js';

export const tiltTrigger = tool(
  'tilt_trigger',
  'Manually trigger a resource update. Set verbose=true to include the updated resource state.',
  TiltTriggerInput.shape,
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

    // Trigger resource using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    await client.trigger(args.resourceName);

    let resourceState: Record<string, unknown> | undefined;
    if (args.verbose) {
      const rawResource = await client.describeResource(args.resourceName);
      resourceState = cleanResource(rawResource as unknown as UIResource);
    }

    const result = {
      success: true,
      resourceName: args.resourceName,
      message: `Resource '${args.resourceName}' triggered successfully`,
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
