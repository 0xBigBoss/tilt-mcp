/**
 * TiltConnection - Session management with optimized caching
 *
 * Manages connection to Tilt API server with:
 * - 10-second session cache
 * - Force refresh capability
 * - Explicit cache invalidation
 * - Proper error handling and propagation
 */

import { spawn } from 'node:child_process';
import { getDefaultTiltHost, getDefaultTiltPort } from './config.js';
import {
  TiltCommandTimeoutError,
  TiltNotInstalledError,
  TiltNotRunningError,
} from './errors.js';

export interface TiltConnectionConfig {
  port?: number;
  host?: string;
  timeout?: number;
  binaryPath?: string;
  env?: NodeJS.ProcessEnv;
  cacheIntervalMs?: number;
}

export class TiltConnection {
  private readonly port: number;
  private readonly host: string;
  private readonly timeout: number;
  private readonly binaryPath: string;
  private readonly env?: NodeJS.ProcessEnv;

  // Cache state
  private sessionActive: boolean = false;
  private lastCheck: number = 0;
  private readonly checkInterval: number;

  constructor(config: TiltConnectionConfig = {}) {
    this.port = config.port ?? getDefaultTiltPort();
    this.host = config.host ?? getDefaultTiltHost();
    this.timeout = config.timeout ?? 2000;
    this.binaryPath = config.binaryPath ?? 'tilt';
    this.env = config.env;
    this.checkInterval = config.cacheIntervalMs ?? 10000; // default 10 seconds
  }

  /**
   * Check if Tilt session is active
   *
   * @param forceRefresh - Bypass cache and query immediately
   * @returns true if session is active
   * @throws TiltNotInstalledError if tilt command not found
   * @throws TiltNotRunningError if no active session
   */
  async checkSession(forceRefresh: boolean = false): Promise<boolean> {
    // Use cached result if not forced and within interval
    if (!forceRefresh && Date.now() - this.lastCheck < this.checkInterval) {
      return this.sessionActive;
    }

    try {
      await this.execTilt([
        'get',
        'session',
        '--port',
        this.port.toString(),
        '--host',
        this.host,
      ]);

      // Update cache on success
      this.sessionActive = true;
      this.lastCheck = Date.now();
      return true;
    } catch (error) {
      // Invalidate cache on any error
      this.sessionActive = false;
      this.lastCheck = Date.now();

      // Re-throw the error
      throw error;
    }
  }

  /**
   * Invalidate session cache explicitly
   * Forces next checkSession() to query Tilt
   */
  invalidateCache(): void {
    this.sessionActive = false;
    this.lastCheck = 0;
  }

  /**
   * Get connection configuration info
   */
  getConnectionInfo(): {
    port: number;
    host: string;
    timeout: number;
    binaryPath: string;
    cacheIntervalMs: number;
  } {
    return {
      port: this.port,
      host: this.host,
      timeout: this.timeout,
      binaryPath: this.binaryPath,
      cacheIntervalMs: this.checkInterval,
    };
  }

  /**
   * Execute tilt command safely with argument array
   * NO shell interpolation - prevents command injection
   */
  private async execTilt(args: readonly string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, args as string[], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...this.env },
        // NO shell: true - prevents command injection
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
      }, this.timeout);

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (error.code === 'ENOENT') {
          reject(new TiltNotInstalledError());
        } else {
          reject(error);
        }
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);

        if (killed) {
          reject(new TiltCommandTimeoutError(args.join(' '), this.timeout));
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
    return new Error(`Tilt command failed (exit ${code}): ${stderr}`);
  }
}
