/**
 * tilt_args tool
 *
 * Gets or sets Tiltfile args
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { TiltConnection } from '../tilt/connection.js';
import {
  TiltArgsInput,
  type TiltToolExtra,
  validateTiltArgsInput,
} from './schemas.js';

export const tiltArgs = tool(
  'tilt_args',
  'Set or clear Tiltfile arguments. Must provide either args (to set) or clear=true (to clear). Cannot be called without arguments.',
  TiltArgsInput.shape,
  async (args, _extra) => {
    // Validate that either args or clear is provided (prevents interactive editor)
    validateTiltArgsInput(args);

    const extra = (_extra ?? {}) as TiltToolExtra;
    const port = args.tiltPort ?? extra.tiltPort ?? 10350;
    const host = args.tiltHost ?? extra.tiltHost ?? 'localhost';
    const binaryPath = extra.tiltBinaryPath;

    // Check if session is active first
    const connection = new TiltConnection({
      port,
      host,
      binaryPath,
    });

    await connection.checkSession();

    // Execute args command using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    await client.setArgs(args.args, args.clear);

    let result: {
      success: boolean;
      args?: string[];
      message: string;
      connectionInfo: { port: number; host: string };
    };

    if (args.clear) {
      result = {
        success: true,
        message: 'Tiltfile args cleared successfully',
        connectionInfo: {
          port,
          host,
        },
      };
    } else {
      result = {
        success: true,
        args: args.args,
        message: `Tiltfile args set successfully`,
        connectionInfo: {
          port,
          host,
        },
      };
    }

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
