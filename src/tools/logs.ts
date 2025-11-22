/**
 * tilt_logs tool
 *
 * Gets logs from a resource with optional filtering and tailing
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { TiltCliClient } from '../tilt/cli-client.js';
import { resolveTiltTarget } from '../tilt/config.js';
import { TiltConnection } from '../tilt/connection.js';
import { stripAnsiCodes } from '../tilt/transformers.js';
import { TiltResourceNotFoundError } from '../tilt/errors.js';
import {
  TiltLogsInput,
  type LogSearch,
  type TiltToolExtra,
} from './schemas.js';

function dedupeFlags(flags: string): string {
  const seen = new Set<string>();
  for (const flag of flags) {
    seen.add(flag);
  }
  return Array.from(seen).join('');
}

function buildLogMatcher(search: LogSearch): (line: string) => boolean {
  const mode = search.mode ?? 'substring';
  const caseSensitive = search.caseSensitive ?? true;

  if (mode === 'regex') {
    const baseFlags = search.flags ?? '';
    const flags =
      caseSensitive || baseFlags.includes('i')
        ? baseFlags
        : `${baseFlags}i`;

    const finalFlags = dedupeFlags(flags);

    let regex: RegExp;
    try {
      regex = new RegExp(search.query, finalFlags);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid search regex: ${message}`);
    }

    return (line) => regex.test(line);
  }

  const query = caseSensitive ? search.query : search.query.toLowerCase();
  return (line) => {
    const target = caseSensitive ? line : line.toLowerCase();
    return target.includes(query);
  };
}

function filterLogs(logs: string, search?: LogSearch): string {
  if (!search) return logs;
  if (!logs) return '';

  const hasTrailingNewline = logs.endsWith('\n');
  const lines = hasTrailingNewline
    ? logs.slice(0, -1).split('\n')
    : logs.split('\n');

  const matcher = buildLogMatcher(search);
  const filtered = lines.filter((line) => matcher(line));

  if (filtered.length === 0) {
    return '';
  }

  const joined = filtered.join('\n');
  return hasTrailingNewline ? `${joined}\n` : joined;
}

export const tiltLogs = tool(
  'tilt_logs',
  'Read logs from a specific resource with optional tailing, Tilt-level filtering, and client-side search. ' +
    'Returns plain text log output (same as Tilt CLI). The level parameter filters Tilt internal messages (build/resource warnings/errors), ' +
    'not application log content. The source parameter filters by log origin (build vs runtime).',
  TiltLogsInput.shape,
  async (args, _extra) => {
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

    // Get logs using CLI client
    const client = new TiltCliClient({
      port,
      host,
      binaryPath,
    });

    // Validate resource exists before attempting to get logs
    const resources = await client.getResources();
    const resourceExists = resources.some(
      (r) => r.metadata.name === args.resourceName,
    );

    if (!resourceExists) {
      throw new TiltResourceNotFoundError(args.resourceName);
    }

    const logOptions = {
      // Note: follow mode disabled - MCP tools must return a response
      follow: false,
      tailLines: args.tailLines ?? 100,
      level: args.level,
      source: args.source,
    };

    const rawLogs = await client.getLogs(args.resourceName, logOptions);
    const cleanedLogs = stripAnsiCodes(rawLogs);
    const filteredLogs = filterLogs(cleanedLogs, args.search);

    return {
      content: [
        {
          type: 'text' as const,
          text: filteredLogs,
        },
      ],
    };
  },
);
