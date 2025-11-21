/**
 * tilt_get_resources tool
 *
 * Lists all resources managed by Tilt with optional filtering and pagination
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { getDefaultTiltHost, getDefaultTiltPort } from '../tilt/config.js';
import { deriveStatus, toSlimResource } from '../tilt/transformers.js';
import type { UIResource } from '../tilt/types.js';
import { TiltGetResourcesInput, type TiltToolExtra } from './schemas.js';

export const tiltGetResources = tool(
  'tilt_get_resources',
  'List all resources managed by Tilt with optional filtering and pagination',
  TiltGetResourcesInput.shape,
  async (args, _extra) => {
    const extra = (_extra ?? {}) as TiltToolExtra;
    const port = args.tiltPort ?? extra.tiltPort ?? getDefaultTiltPort();
    const host = args.tiltHost ?? extra.tiltHost ?? getDefaultTiltHost();
    const binaryPath = extra.tiltBinaryPath;

    // Get resources using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    let resources = (await client.getResources(
      args.labels,
    )) as unknown as UIResource[];

    // Apply client-side name filtering if filter parameter provided
    if (args.filter) {
      const filterLower = args.filter.toLowerCase();
      resources = resources.filter((resource: UIResource) => {
        const name = resource.metadata?.name?.toLowerCase() ?? '';
        return name.includes(filterLower);
      });
    }

    // Apply status filter
    if (args.status && args.status !== 'all') {
      resources = resources.filter((resource: UIResource) => {
        return deriveStatus(resource) === args.status;
      });
    }

    // Apply pagination
    const total = resources.length;
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;
    const paginatedResources = resources.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    // Transform to slim format unless verbose requested
    const outputResources = args.verbose
      ? paginatedResources
      : paginatedResources.map((r) => toSlimResource(r));

    // Include pagination metadata
    const result = {
      resources: outputResources,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
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
