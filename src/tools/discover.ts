/**
 * tilt_discover tool
 *
 * Discovers running Tilt instances by scanning ports
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { getDefaultTiltHost, getDefaultTiltPort } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import { TiltDiscoverInput, type TiltToolExtra } from './schemas.js';

interface DiscoveredInstance {
  host: string;
  port: number;
  sessionActive: boolean;
  version?: string;
}

interface DiscoveryResult {
  instances: DiscoveredInstance[];
  warning?: string;
  message?: string;
}

export const tiltDiscover = tool(
  'tilt_discover',
  'Discover running Tilt instances by scanning common ports. Connection host/port should be set in MCP configuration (.mcp.json or environment). When multiple instances are found, specify an explicit port in configuration to avoid connecting to the wrong instance.',
  TiltDiscoverInput.shape,
  async (args, _extra) => {
    const extra = (_extra ?? {}) as TiltToolExtra;

    // Priority: args > extra > env > defaults
    const host =
      (args as { tiltHost?: string }).tiltHost ??
      extra.tiltHost ??
      getDefaultTiltHost();
    const binaryPath = extra.tiltBinaryPath;

    // For portRange, if not provided in args, use default range
    // but respect extra.tiltPort for the starting port
    let portRange: [number, number];
    if (args.portRange) {
      portRange = args.portRange;
    } else {
      // Determine starting port with priority: args override for backward compatibility, else extra > env > default
      const startPort =
        (args as { tiltPort?: number }).tiltPort ??
        extra.tiltPort ??
        getDefaultTiltPort();
      const endPort = Math.min(startPort + 4, 65535);
      portRange = [startPort, endPort];
    }

    const [startPort, endPort] = portRange;

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

    // Always return consistent DiscoveryResult format
    const responseData: DiscoveryResult = {
      instances: discovered,
    };

    // Add warning and message only when multiple instances are found
    if (discovered.length > 1) {
      responseData.warning = 'Multiple active Tilt instances detected';
      responseData.message =
        'Multiple Tilt instances are running. To avoid connecting to the wrong instance, specify an explicit port using the tiltPort argument or set the TILT_PORT environment variable.';
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(responseData, null, 2),
        },
      ],
    };
  },
);
