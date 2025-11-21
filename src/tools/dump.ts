/**
 * tilt_dump tool
 *
 * Dumps Tilt engine state
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { getDefaultTiltHost, getDefaultTiltPort } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import { TiltDumpInput, type TiltToolExtra } from './schemas.js';

export const tiltDump = tool(
  'tilt_dump',
  'Dump Tilt engine state',
  TiltDumpInput.shape,
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

    await connection.checkSession();

    // Dump engine state using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    const format = args.format ?? 'json';
    const output = await client.dumpEngine();

    let data: unknown;
    try {
      data = JSON.parse(output);
    } catch {
      data = output;
    }

    const result = {
      success: true,
      format,
      data,
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
