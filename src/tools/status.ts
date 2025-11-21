/**
 * tilt_status tool
 *
 * Gets overall Tilt session status with summary counts (not full resource list)
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { getDefaultTiltHost, getDefaultTiltPort } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import { deriveStatus, extractError } from '../tilt/transformers.js';
import type { UIResource } from '../tilt/types.js';
import { TiltStatusInput, type TiltToolExtra } from './schemas.js';

export const tiltStatus = tool(
  'tilt_status',
  'Get overall Tilt status and resource summary',
  TiltStatusInput.shape,
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

    const sessionActive = await connection.checkSession();

    // Get resources using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    const resources = (await client.getResources()) as unknown as UIResource[];

    // Compute summary counts
    const summary = {
      ok: 0,
      error: 0,
      pending: 0,
      building: 0,
      disabled: 0,
    };

    const errors: Array<{ name: string; error: string }> = [];

    for (const resource of resources) {
      const status = deriveStatus(resource);
      summary[status]++;

      if (status === 'error') {
        const errorMsg = extractError(resource);
        if (errorMsg) {
          errors.push({ name: resource.metadata.name, error: errorMsg });
        }
      }
    }

    const result = {
      sessionActive,
      resourceCount: resources.length,
      summary,
      errors,
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
