/**
 * WebSocket Server Test Fixture
 *
 * Creates a mock WebSocket server for testing TiltWebSocketClient
 * Simulates Tilt's WebSocket API behavior
 */

import net, { type AddressInfo } from 'node:net';
import { type WebSocket, WebSocketServer } from 'ws';

export interface WsServerFixture {
  url: string;
  port: number;
  sendMessage: (data: unknown) => void;
  sendLogLine: (resource: string, text: string) => void;
  sendResourceUpdate: (resource: TiltResourceMessage) => void;
  getConnections: () => number;
  close: () => Promise<void>;
  lastConnection: WebSocket | null;
}

export interface TiltResourceMessage {
  name: string;
  status?: string;
  buildStatus?: string;
  runtimeStatus?: string;
  pendingBuildSince?: string | null;
  lastDeployTime?: string | null;
  [key: string]: unknown;
}

export interface TiltLogMessage {
  type: 'log';
  resource: string;
  text: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

export async function createWsServerFixture(): Promise<WsServerFixture> {
  const port = await findFreePort();
  const url = `ws://127.0.0.1:${port}/ws/view`;

  const wss = new WebSocketServer({ port, path: '/ws/view' });
  const connections: Set<WebSocket> = new Set();
  let lastConnection: WebSocket | null = null;

  wss.on('connection', (ws) => {
    connections.add(ws);
    lastConnection = ws;

    ws.on('close', () => {
      connections.delete(ws);
    });
  });

  const sendMessage = (data: unknown) => {
    const message = JSON.stringify(data);
    for (const ws of connections) {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    }
  };

  const sendLogLine = (resource: string, text: string) => {
    const logMessage: TiltLogMessage = {
      type: 'log',
      resource,
      text,
      timestamp: new Date().toISOString(),
      level: 'INFO',
    };
    sendMessage(logMessage);
  };

  const sendResourceUpdate = (resource: TiltResourceMessage) => {
    sendMessage({
      type: 'resource',
      ...resource,
    });
  };

  const close = async () => {
    // Force terminate all connections immediately
    for (const ws of connections) {
      ws.terminate();
    }
    connections.clear();
    lastConnection = null;

    // Close server with timeout to prevent hanging
    await Promise.race([
      new Promise<void>((resolve) => {
        wss.close(() => resolve());
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 100)),
    ]);
  };

  return {
    url,
    port,
    sendMessage,
    sendLogLine,
    sendResourceUpdate,
    getConnections: () => connections.size,
    close,
    get lastConnection() {
      return lastConnection;
    },
  };
}
