/**
 * tilt_wait tool
 *
 * Waits for resources to reach ready state
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { resolveTiltTarget } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import { toSlimResource } from '../tilt/transformers.js';
import type { UIResource } from '../tilt/types.js';
import { type TiltToolExtra, TiltWaitInput } from './schemas.js';

export const tiltWait = tool(
  'tilt_wait',
  'Wait for Tilt resource(s) to reach ready state. Set verbose=true for a slim status summary after completion.',
  TiltWaitInput.shape,
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

    // Wait for resources using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    await client.wait(args.resources, args.timeout, args.condition);

    let resourceStatuses:
      | { name: string; status: string; ready: boolean; upToDate: boolean }[]
      | undefined;

    if (args.verbose) {
      const resources = (await client.getResources()) as unknown as UIResource[];
      const relevantResources = args.resources
        ? resources.filter((r) => args.resources?.includes(r.metadata.name))
        : resources;
      resourceStatuses = relevantResources.map((resource) => {
        const slim = toSlimResource(resource);
        return {
          name: slim.name,
          status: slim.status,
          ready: slim.ready,
          upToDate: slim.upToDate,
        };
      });
    }

    const result = {
      success: true,
      resources: args.resources ?? 'all',
      timeout: args.timeout,
      condition: args.condition ?? 'Ready',
      message: args.resources
        ? `Resource(s) '${args.resources.join(', ')}' are ready`
        : 'All resources are ready',
      ...(resourceStatuses ? { resourceStatuses } : {}),
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
