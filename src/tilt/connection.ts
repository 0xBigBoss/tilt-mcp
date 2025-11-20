/**
 * TiltConnection - Session management with optimized caching
 * 
 * Manages connection to Tilt API server with:
 * - 10-second session cache
 * - Force refresh capability
 * - Explicit cache invalidation
 * - Proper error handling and propagation
 */

import { spawn } from 'child_process';
import {
  TiltNotInstalledError,
  TiltNotRunningError,
  TiltCommandTimeoutError,
} from './errors.js';

export interface TiltConnectionConfig {
  port?: number;
  host?: string;
  timeout?: number;
}

export class TiltConnection {
  private readonly port: number;
  private readonly host: string;
  private readonly timeout: number;

  // Cache state
  private sessionActive: boolean = false;
  private lastCheck: number = 0;
  private readonly checkInterval: number = 10000; // 10 seconds

  constructor(config: TiltConnectionConfig = {}) {
    this.port = config.port ?? 10350;
    this.host = config.host ?? 'localhost';
    this.timeout = config.timeout ?? 2000;
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
    const now = Date.now();

    // Use cached result if not forced and within interval
    if (!forceRefresh && now - this.lastCheck < this.checkInterval) {
      return this.sessionActive;
    }

    try {
      await this.execTilt(['get', 'session', '--port', this.port.toString(), '--host', this.host]);

      // Update cache on success
      this.sessionActive = true;
      this.lastCheck = now;
      return true;
    } catch (error) {
      // Invalidate cache on any error
      this.sessionActive = false;
      this.lastCheck = now;

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
  getConnectionInfo(): { port: number; host: string; timeout: number } {
    return {
      port: this.port,
      host: this.host,
      timeout: this.timeout,
    };
  }

  /**
   * Execute tilt command safely with argument array
   * NO shell interpolation - prevents command injection
   */
  private async execTilt(args: readonly string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('tilt', args as string[], {
        stdio: ['ignore', 'pipe', 'pipe'],
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
