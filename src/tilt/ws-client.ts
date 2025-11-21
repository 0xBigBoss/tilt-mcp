/**
 * TiltWebSocketClient - Real-time WebSocket connection to Tilt
 *
 * Connects to Tilt's WebSocket API for real-time updates:
 * - Log lines from resources
 * - Resource status updates
 *
 * Features:
 * - Type-safe message handling with Zod validation
 * - Event callbacks for logs and resource updates
 * - Clean connection lifecycle management
 * - Error handling for connection failures
 */

import WebSocket from 'ws';
import { z } from 'zod';

/**
 * Configuration for WebSocket client
 */
export interface TiltWebSocketConfig {
  port?: number;
  host?: string;
}

/**
 * Log line received from Tilt WebSocket
 */
export interface LogLine {
  resource: string;
  text: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
}

/**
 * Resource update received from Tilt WebSocket
 */
export interface TiltResource {
  name: string;
  status?: string;
  buildStatus?: string;
  runtimeStatus?: string;
  pendingBuildSince?: string | null;
  lastDeployTime?: string | null;
  [key: string]: unknown;
}

// Zod schemas for message validation
const LogMessageSchema = z.object({
  type: z.literal('log'),
  resource: z.string(),
  text: z.string(),
  timestamp: z.string(),
  level: z.enum(['INFO', 'WARN', 'ERROR']),
});

const ResourceMessageSchema = z
  .object({
    type: z.literal('resource'),
    name: z.string(),
    status: z.string().optional(),
    buildStatus: z.string().optional(),
    runtimeStatus: z.string().optional(),
    pendingBuildSince: z.string().nullable().optional(),
    lastDeployTime: z.string().nullable().optional(),
  })
  .passthrough();

type LogCallback = (logLine: LogLine) => void;
type ResourceCallback = (resource: TiltResource) => void;
type ErrorCallback = (error: Error) => void;
type CloseCallback = () => void;

/**
 * WebSocket client for Tilt real-time API
 */
export class TiltWebSocketClient {
  private readonly port: number;
  private readonly host: string;
  private ws: WebSocket | null = null;
  private logCallbacks: Set<LogCallback> = new Set();
  private resourceCallbacks: Set<ResourceCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private closeCallbacks: Set<CloseCallback> = new Set();

  constructor(config: TiltWebSocketConfig = {}) {
    this.port = config.port ?? 10350;
    this.host = config.host ?? 'localhost';
  }

  /**
   * Get current configuration
   */
  getConfig(): { port: number; host: string } {
    return {
      port: this.port,
      host: this.host,
    };
  }

  /**
   * Connect to Tilt WebSocket API
   *
   * @param url - Optional custom WebSocket URL. If not provided, uses configured host:port
   * @throws Error if already connected or connection fails
   */
  async connect(url?: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      throw new Error('Already connected. Call disconnect() first.');
    }

    const wsUrl = url ?? `ws://${this.host}:${this.port}/ws/view`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      const onOpen = () => {
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        this.emitError(error);
        reject(error);
      };

      const cleanup = () => {
        this.ws?.removeListener('open', onOpen);
        this.ws?.removeListener('error', onError);
      };

      this.ws.on('open', onOpen);
      this.ws.on('error', onError);

      // Set up message handling after connection
      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        this.ws = null;
        this.emitClose();
      });
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Subscribe to log line events
   *
   * @param callback - Function called when a log line is received
   * @returns Unsubscribe function
   */
  onLogLine(callback: LogCallback): () => void {
    this.logCallbacks.add(callback);
    return () => {
      this.logCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to resource update events
   *
   * @param callback - Function called when a resource is updated
   * @returns Unsubscribe function
   */
  onResourceUpdate(callback: ResourceCallback): () => void {
    this.resourceCallbacks.add(callback);
    return () => {
      this.resourceCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to error events
   *
   * @param callback - Function called when an error occurs
   * @returns Unsubscribe function
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to close events
   *
   * @param callback - Function called when connection closes
   * @returns Unsubscribe function
   */
  onClose(callback: CloseCallback): () => void {
    this.closeCallbacks.add(callback);
    return () => {
      this.closeCallbacks.delete(callback);
    };
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: WebSocket.Data): void {
    const raw = data.toString();

    // Parse JSON - ignore malformed messages
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Silently ignore malformed JSON
      return;
    }

    // Check if it's an object with a type field
    if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
      return;
    }

    const message = parsed as { type: string };

    // Handle log messages
    if (message.type === 'log') {
      const result = LogMessageSchema.safeParse(parsed);
      if (result.success) {
        const logLine: LogLine = {
          resource: result.data.resource,
          text: result.data.text,
          timestamp: result.data.timestamp,
          level: result.data.level,
        };
        this.emitLogLine(logLine);
      }
      return;
    }

    // Handle resource messages
    if (message.type === 'resource') {
      const result = ResourceMessageSchema.safeParse(parsed);
      if (result.success) {
        const resource: TiltResource = {
          name: result.data.name,
          status: result.data.status,
          buildStatus: result.data.buildStatus,
          runtimeStatus: result.data.runtimeStatus,
          pendingBuildSince: result.data.pendingBuildSince,
          lastDeployTime: result.data.lastDeployTime,
        };
        this.emitResourceUpdate(resource);
      }
      return;
    }

    // Unknown message types are silently ignored
  }

  private emitLogLine(logLine: LogLine): void {
    for (const callback of this.logCallbacks) {
      callback(logLine);
    }
  }

  private emitResourceUpdate(resource: TiltResource): void {
    for (const callback of this.resourceCallbacks) {
      callback(resource);
    }
  }

  private emitError(error: Error): void {
    for (const callback of this.errorCallbacks) {
      callback(error);
    }
  }

  private emitClose(): void {
    for (const callback of this.closeCallbacks) {
      callback();
    }
  }
}
