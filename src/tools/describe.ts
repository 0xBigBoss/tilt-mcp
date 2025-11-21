/**
 * tilt_describe_resource tool
 *
 * Gets detailed information about a specific resource.
 * Output is cleaned to remove K8s boilerplate while preserving useful structure.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { getDefaultTiltHost, getDefaultTiltPort } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import { cleanResource } from '../tilt/transformers.js';
import type { UIResource } from '../tilt/types.js';
import { TiltDescribeResourceInput, type TiltToolExtra } from './schemas.js';

export const tiltDescribeResource = tool(
  'tilt_describe_resource',
  'Get detailed information about a specific resource',
  TiltDescribeResourceInput.shape,
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

    // Get resource details using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    const rawResource = await client.describeResource(args.resourceName);
    const resource = cleanResource(rawResource as unknown as UIResource);

    const result = {
      ...resource,
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
