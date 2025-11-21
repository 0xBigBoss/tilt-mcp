/**
 * tilt_discover tool
 *
 * Discovers running Tilt instances by scanning ports
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltConnection } from '../tilt/connection.js';
import { TiltDiscoverInput, type TiltToolExtra } from './schemas.js';

interface DiscoveredInstance {
  host: string;
  port: number;
  sessionActive: boolean;
  version?: string;
}

export const tiltDiscover = tool(
  'tilt_discover',
  'Discover running Tilt instances by scanning common ports',
  TiltDiscoverInput.shape,
  async (args, _extra) => {
    const extra = (_extra ?? {}) as TiltToolExtra;
    const portRange = args.portRange || [10350, 10354];
    const [startPort, endPort] = portRange;
    const host = extra.tiltHost ?? 'localhost';
    const binaryPath = extra.tiltBinaryPath;

    const discovered: DiscoveredInstance[] = [];

    // Scan each port in range
    for (let port = startPort; port <= endPort; port++) {
      const connection = new TiltConnection({
        port,
        host,
        binaryPath,
        timeout: 1000, // Short timeout for discovery
        cacheIntervalMs: 0, // No caching during discovery
      });

      try {
        await connection.checkSession();

        // Session is active
        discovered.push({
          host,
          port,
          sessionActive: true,
        });
      } catch (_error) {}
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(discovered, null, 2),
        },
      ],
    };
  },
);
