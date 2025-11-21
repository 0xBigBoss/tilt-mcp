/**
 * tilt_get_resources tool
 *
 * Lists all resources managed by Tilt with optional filtering
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { type Resource, TiltCliClient } from '../tilt/cli-client.js';
import { TiltGetResourcesInput, type TiltToolExtra } from './schemas.js';

export const tiltGetResources = tool(
  'tilt_get_resources',
  'List all resources managed by Tilt with optional filtering',
  TiltGetResourcesInput.shape,
  async (args, _extra) => {
    const extra = (_extra ?? {}) as TiltToolExtra;
    const port = args.tiltPort ?? extra.tiltPort ?? 10350;
    const host = args.tiltHost ?? extra.tiltHost ?? 'localhost';
    const binaryPath = extra.tiltBinaryPath;

    // Get resources using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    let resources = await client.getResources(args.labels);

    // Apply client-side filtering if filter parameter provided
    if (args.filter) {
      const filterLower = args.filter.toLowerCase();
      resources = resources.filter((resource: Resource) => {
        const name = resource.metadata?.name?.toLowerCase() ?? '';
        const status =
          (
            resource as { status?: { runtimeStatus?: string } }
          ).status?.runtimeStatus?.toLowerCase() ?? '';

        return name.includes(filterLower) || status.includes(filterLower);
      });
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(resources, null, 2),
        },
      ],
    };
  },
);
