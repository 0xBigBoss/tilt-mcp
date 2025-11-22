/**
 * tilt_args tool
 *
 * Gets or sets Tiltfile args
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { resolveTiltTarget } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import {
  TiltArgsInput,
  type TiltToolExtra,
  validateTiltArgsInput,
} from './schemas.js';

export const tiltArgs = tool(
  'tilt_args',
  'Get, set, or clear Tiltfile arguments. Use mode="get" to view current args, mode="set" with args to set new args, or mode="clear" to clear args. Legacy usage: provide args (to set) or clear=true (to clear).',
  TiltArgsInput.shape,
  async (args, _extra) => {
    // Validate parameter combinations
    validateTiltArgsInput(args);

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

    // Execute args command using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    // Determine operation mode
    let mode: 'get' | 'set' | 'clear';
    if (args.mode) {
      mode = args.mode;
    } else if (args.clear) {
      mode = 'clear';
    } else {
      mode = 'set';
    }

    let result: {
      success: boolean;
      args?: string[];
      message: string;
      connectionInfo: { port: number; host: string };
    };

    if (mode === 'get') {
      const currentArgs = await client.getArgs();
      result = {
        success: true,
        args: currentArgs,
        message: 'Current Tiltfile args retrieved successfully',
        connectionInfo: {
          port,
          host,
        },
      };
    } else if (mode === 'clear') {
      await client.setArgs(undefined, true);
      result = {
        success: true,
        message: 'Tiltfile args cleared successfully',
        connectionInfo: {
          port,
          host,
        },
      };
    } else {
      // mode === 'set'
      await client.setArgs(args.args, false);
      result = {
        success: true,
        args: args.args,
        message: 'Tiltfile args set successfully',
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
