/**
 * TiltCliClient - Safe CLI command execution
 *
 * Wraps Tilt CLI commands with:
 * - Safe execution (spawn with args[], no shell)
 * - Timeout handling (kill process, throw error)
 * - Buffer limits (10MB default, 50MB for logs)
 * - Error parsing (ENOENT, connection refused, not found)
 * - In-process log tailing (no shell pipes)
 */

import { spawn } from 'node:child_process';
import { getDefaultTiltHost, getDefaultTiltPort } from './config.js';
import {
  TiltCommandTimeoutError,
  TiltNotInstalledError,
  TiltNotRunningError,
  TiltOutputExceededError,
  TiltResourceNotFoundError,
} from './errors.js';

export interface ExecOptions {
  timeout?: number; // Max execution time (ms)
  maxBuffer?: number; // Max stdout/stderr size (bytes)
}

export interface LogOptions {
  follow?: boolean;
  tailLines?: number; // Limit to N most recent lines
  level?: 'warn' | 'error';
  source?: 'all' | 'build' | 'runtime';
}

export interface TiltCliClientConfig {
  port?: number;
  host?: string;
  binaryPath?: string;
}

export interface Resource {
  metadata: {
    name: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ResourceDetail {
  kind: string;
  metadata: {
    name: string;
    [key: string]: unknown;
  };
  status?: {
    buildHistory?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class TiltCliClient {
  private readonly port: number;
  private readonly host: string;
  private readonly binaryPath: string;

  constructor(config: TiltCliClientConfig = {}) {
    this.port = config.port ?? getDefaultTiltPort();
    this.host = config.host ?? getDefaultTiltHost();
    this.binaryPath = config.binaryPath ?? 'tilt';
  }

  /**
   * Get client configuration info
   */
  getClientInfo(): {
    port: number;
    host: string;
    binaryPath: string;
  } {
    return {
      port: this.port,
      host: this.host,
      binaryPath: this.binaryPath,
    };
  }

  /**
   * Execute tilt command safely with argument array
   * NO shell interpolation - prevents command injection
   *
   * @param args - Command arguments array
   * @param options - Execution options (timeout, maxBuffer)
   * @returns Command stdout
   * @throws TiltNotInstalledError if tilt binary not found
   * @throws TiltCommandTimeoutError if command exceeds timeout
   * @throws TiltOutputExceededError if output exceeds maxBuffer
   * @throws TiltNotRunningError if cannot connect to Tilt
   * @throws TiltResourceNotFoundError if resource not found
   */
  async execTilt(
    args: readonly string[],
    options: ExecOptions = {},
  ): Promise<string> {
    // Use Infinity to skip timeout (for follow mode), not 0 which kills immediately
    // Default to 30s if not provided
    const timeout = options.timeout ?? 30000;
    const maxBuffer = options.maxBuffer ?? 10 * 1024 * 1024; // 10MB

    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, args as string[], {
        stdio: ['ignore', 'pipe', 'pipe'],
        // NO shell: true - prevents command injection
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      // Only set timeout if not Infinity (skip for follow mode)
      const timer =
        timeout !== Infinity
          ? setTimeout(() => {
              killed = true;
              proc.kill('SIGTERM');
            }, timeout)
          : undefined;

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.length > maxBuffer) {
          if (timer !== undefined) {
            clearTimeout(timer);
          }
          killed = true;
          proc.kill('SIGTERM');
          reject(new TiltOutputExceededError(maxBuffer));
        }
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('error', (error: NodeJS.ErrnoException) => {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        if (error.code === 'ENOENT') {
          reject(new TiltNotInstalledError());
        } else {
          reject(error);
        }
      });

      proc.on('close', (code: number | null) => {
        if (timer !== undefined) {
          clearTimeout(timer);
        }

        if (killed) {
          reject(new TiltCommandTimeoutError(args.join(' '), timeout));
          return;
        }

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(this.parseCliError(stderr, code));
        }
      });
    });
  }

  /**
   * Parse CLI error output to throw appropriate error type
   */
  private parseCliError(stderr: string, code: number | null): Error {
    if (stderr.includes('connection refused') || stderr.includes('dial tcp')) {
      return new TiltNotRunningError(this.port, this.host);
    }
    if (stderr.includes('not found')) {
      const match = stderr.match(/resource "([^"]+)" not found/);
      if (match) {
        return new TiltResourceNotFoundError(match[1]);
      }
    }
    return new Error(`Tilt command failed (exit ${code}): ${stderr}`);
  }

  /**
   * Get list of resources with optional label filtering
   *
   * @param labels - Optional array of label selectors
   * @returns Array of resources
   */
  async getResources(labels?: string[]): Promise<Resource[]> {
    const args = [
      'get',
      'uiresources',
      '-o',
      'json',
      '--port',
      this.port.toString(),
      '--host',
      this.host,
    ];

    if (labels && labels.length > 0) {
      args.push('-l', labels.join(','));
    }

    const output = await this.execTilt(args);
    const result = JSON.parse(output) as { items?: Resource[] };
    return result.items || [];
  }

  /**
   * Get detailed information about a specific resource
   *
   * @param resourceName - Name of the resource
   * @returns Resource detail object
   */
  async describeResource(resourceName: string): Promise<ResourceDetail> {
    const args = [
      'get',
      `uiresource/${resourceName}`,
      '-o',
      'json',
      '--port',
      this.port.toString(),
      '--host',
      this.host,
    ];

    const output = await this.execTilt(args);
    return JSON.parse(output) as ResourceDetail;
  }

  /**
   * Get logs for a resource with optional filtering and tailing
   *
   * @param resourceName - Name of the resource
   * @param options - Log options (level, source, tailLines, follow)
   * @returns Log output
   */
  async getLogs(
    resourceName: string,
    options: LogOptions = {},
  ): Promise<string> {
    const args = [
      'logs',
      resourceName,
      '--port',
      this.port.toString(),
      '--host',
      this.host,
    ];

    if (options.level) args.push('--level', options.level);
    if (options.source) args.push('--source', options.source);

    // For follow mode, use Infinity timeout so process doesn't get killed
    // For non-follow mode, use default 30s timeout
    const output = await this.execTilt(args, {
      timeout: options.follow ? Infinity : 30000,
      maxBuffer: 50 * 1024 * 1024, // 50MB for logs
    });

    // In-process tailing (safe, no shell)
    if (options.tailLines && !options.follow) {
      return this.tailLines(output, options.tailLines);
    }

    return output;
  }

  /**
   * Trigger a manual update for a resource
   *
   * @param resourceName - Name of the resource to trigger
   */
  async trigger(resourceName: string): Promise<void> {
    const args = [
      'trigger',
      resourceName,
      '--port',
      this.port.toString(),
      '--host',
      this.host,
    ];

    await this.execTilt(args);
  }

  /**
   * Enable a resource
   *
   * @param resourceName - Name of the resource to enable
   */
  async enable(resourceName: string): Promise<void> {
    const args = [
      'enable',
      resourceName,
      '--port',
      this.port.toString(),
      '--host',
      this.host,
    ];

    await this.execTilt(args);
  }

  /**
   * Disable a resource
   *
   * @param resourceName - Name of the resource to disable
   */
  async disable(resourceName: string): Promise<void> {
    const args = [
      'disable',
      resourceName,
      '--port',
      this.port.toString(),
      '--host',
      this.host,
    ];

    await this.execTilt(args);
  }

  /**
   * Set or clear Tiltfile args
   *
   * @param tiltfileArgs - Optional array of args to set
   * @param clear - If true, clear all args
   */
  async setArgs(tiltfileArgs?: string[], clear?: boolean): Promise<void> {
    // CRITICAL: Running `tilt args` without arguments opens an interactive editor
    // which would hang the process. We must have either --clear or args to set.
    if (!clear && (!tiltfileArgs || tiltfileArgs.length === 0)) {
      throw new Error(
        'setArgs requires either clear=true or at least one argument. ' +
          'Running tilt args without arguments opens an interactive editor.',
      );
    }

    const args = ['args', '--port', this.port.toString(), '--host', this.host];

    if (clear) {
      args.push('--clear');
    } else if (tiltfileArgs && tiltfileArgs.length > 0) {
      args.push('--', ...tiltfileArgs);
    }

    await this.execTilt(args);
  }

  /**
   * Wait for resources to reach ready state
   *
   * @param resources - Optional array of resource names to wait for
   * @param timeout - Timeout in seconds
   * @param condition - Condition to wait for (default: Ready)
   * @returns Command output
   */
  async wait(
    resources?: string[],
    timeout?: number,
    condition: string = 'Ready',
  ): Promise<string> {
    const args = [
      'wait',
      '--for',
      `condition=${condition}`,
      '--port',
      this.port.toString(),
      '--host',
      this.host,
    ];

    if (timeout !== undefined) {
      args.push('--timeout', `${timeout}s`);
    }

    if (resources && resources.length > 0) {
      // Tilt wait requires uiresource/name format
      args.push(...resources.map((r) => `uiresource/${r}`));
    } else {
      args.push('--all');
    }

    // Use longer timeout for wait command
    const execTimeout = timeout ? (timeout + 5) * 1000 : 120000;
    return this.execTilt(args, { timeout: execTimeout });
  }

  /**
   * Dump Tilt engine state
   *
   * @returns Engine state as string (JSON)
   */
  async dumpEngine(): Promise<string> {
    const args = [
      'dump',
      'engine',
      '--port',
      this.port.toString(),
      '--host',
      this.host,
    ];

    return this.execTilt(args);
  }

  /**
   * Tail lines in-process (NO shell pipes)
   * Cross-platform, deterministic, secure
   *
   * @param text - Full text to tail
   * @param count - Number of lines to keep from end
   * @returns Tailed text
   */
  tailLines(text: string, count: number): string {
    if (count <= 0) return '';

    const lines = text.split('\n');

    // Handle trailing newline: if text ends with \n, split creates an extra empty element
    // We need to preserve this for correct behavior
    const hasTrailingNewline = text.endsWith('\n');
    const effectiveLines = hasTrailingNewline ? lines.slice(0, -1) : lines;

    const startIndex = Math.max(0, effectiveLines.length - count);
    const result = effectiveLines.slice(startIndex).join('\n');

    return hasTrailingNewline ? `${result}\n` : result;
  }
}
