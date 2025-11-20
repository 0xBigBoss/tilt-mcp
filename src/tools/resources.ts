/**
 * tilt_get_resources tool
 * 
 * Lists all resources managed by Tilt with optional filtering
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltGetResourcesInput } from './schemas.js';
import { TiltCliClient } from '../tilt/cli-client.js';

export const tiltGetResources = tool(
  'tilt_get_resources',
  'List all resources managed by Tilt with optional filtering',
  TiltGetResourcesInput.shape,
  async (args, extra) => {
    const port = args.tiltPort ?? (extra as any)?.tiltPort ?? 10350;
    const host = args.tiltHost ?? (extra as any)?.tiltHost ?? 'localhost';
    const binaryPath = (extra as any)?.tiltBinaryPath;

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
      resources = resources.filter((resource: any) => {
        const name = resource.metadata?.name?.toLowerCase() || '';
        const status = resource.status?.runtimeStatus?.toLowerCase() || '';
        
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
  }
);
