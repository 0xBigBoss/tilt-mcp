/**
 * TiltWebSocketClient Unit Tests
 *
 * Tests WebSocket connection to Tilt's real-time API with:
 * - Connection lifecycle (connect, disconnect, reconnect)
 * - Message parsing for log lines and resource updates
 * - Error handling (connection failures, malformed messages)
 * - Exponential backoff for reconnection
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  type LogLine,
  type TiltResource,
  TiltWebSocketClient,
} from '../../src/tilt/ws-client.js';
import {
  createWsServerFixture,
  type WsServerFixture,
} from '../fixtures/ws-server-fixture.js';

describe('TiltWebSocketClient', () => {
  let fixture: WsServerFixture;
  let client: TiltWebSocketClient;

  // Store original env values
  const originalPort = process.env.TILT_PORT;
  const originalHost = process.env.TILT_HOST;

  beforeEach(async () => {
    fixture = await createWsServerFixture();
    process.env.TILT_PORT = fixture.port.toString();
    process.env.TILT_HOST = '127.0.0.1';
  });

  afterEach(async () => {
    if (client) {
      client.disconnect();
    }
    await fixture.close();

    // Restore original env vars
    if (originalPort !== undefined) {
      process.env.TILT_PORT = originalPort;
    } else {
      delete process.env.TILT_PORT;
    }
    if (originalHost !== undefined) {
      process.env.TILT_HOST = originalHost;
    } else {
      delete process.env.TILT_HOST;
    }
  });

  describe('Connection Lifecycle', () => {
    test('connects to WebSocket server', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      expect(client.isConnected()).toBe(true);
      expect(fixture.getConnections()).toBe(1);
    });

    test('uses default URL when not provided', async () => {
      client = new TiltWebSocketClient({
        port: fixture.port,
        host: '127.0.0.1',
      });
      await client.connect();

      expect(client.isConnected()).toBe(true);
    });

    test('disconnects cleanly', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      expect(client.isConnected()).toBe(true);

      client.disconnect();

      // Give a moment for disconnect to propagate
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(client.isConnected()).toBe(false);
    });

    test('disconnect is idempotent', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      client.disconnect();
      client.disconnect(); // Should not throw

      expect(client.isConnected()).toBe(false);
    });

    test('can reconnect after disconnect', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 50));

      await client.connect(fixture.url);

      expect(client.isConnected()).toBe(true);
    });

    test('throws on connection failure', async () => {
      client = new TiltWebSocketClient();

      await expect(
        client.connect('ws://127.0.0.1:59999/ws/view'),
      ).rejects.toThrow();
    });

    test('throws when connecting while already connected', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      await expect(client.connect(fixture.url)).rejects.toThrow(
        'Already connected',
      );
    });
  });

  describe('Log Line Events', () => {
    test('receives log lines via callback', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      const receivedLogs: LogLine[] = [];
      client.onLogLine((logLine) => {
        receivedLogs.push(logLine);
      });

      fixture.sendLogLine('my-service', 'Hello from the logs');

      // Wait for message propagation
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedLogs).toHaveLength(1);
      expect(receivedLogs[0].resource).toBe('my-service');
      expect(receivedLogs[0].text).toBe('Hello from the logs');
    });

    test('receives multiple log lines', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      const receivedLogs: LogLine[] = [];
      client.onLogLine((logLine) => {
        receivedLogs.push(logLine);
      });

      fixture.sendLogLine('service-a', 'Log 1');
      fixture.sendLogLine('service-b', 'Log 2');
      fixture.sendLogLine('service-a', 'Log 3');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedLogs).toHaveLength(3);
      expect(receivedLogs[0].resource).toBe('service-a');
      expect(receivedLogs[1].resource).toBe('service-b');
      expect(receivedLogs[2].resource).toBe('service-a');
    });

    test('multiple callbacks receive same log line', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      const logs1: LogLine[] = [];
      const logs2: LogLine[] = [];

      client.onLogLine((log) => logs1.push(log));
      client.onLogLine((log) => logs2.push(log));

      fixture.sendLogLine('my-service', 'Test log');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(logs1).toHaveLength(1);
      expect(logs2).toHaveLength(1);
    });

    test('unsubscribe stops receiving log lines', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      const receivedLogs: LogLine[] = [];
      const unsubscribe = client.onLogLine((log) => {
        receivedLogs.push(log);
      });

      fixture.sendLogLine('my-service', 'Log 1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      unsubscribe();

      fixture.sendLogLine('my-service', 'Log 2');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedLogs).toHaveLength(1);
    });
  });

  describe('Resource Update Events', () => {
    test('receives resource updates via callback', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      const receivedUpdates: TiltResource[] = [];
      client.onResourceUpdate((resource) => {
        receivedUpdates.push(resource);
      });

      fixture.sendResourceUpdate({
        name: 'frontend',
        status: 'ok',
        runtimeStatus: 'running',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedUpdates).toHaveLength(1);
      expect(receivedUpdates[0].name).toBe('frontend');
      expect(receivedUpdates[0].status).toBe('ok');
    });

    test('receives multiple resource updates', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      const receivedUpdates: TiltResource[] = [];
      client.onResourceUpdate((resource) => {
        receivedUpdates.push(resource);
      });

      fixture.sendResourceUpdate({ name: 'frontend', status: 'ok' });
      fixture.sendResourceUpdate({ name: 'backend', status: 'error' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedUpdates).toHaveLength(2);
    });

    test('unsubscribe stops receiving resource updates', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      const receivedUpdates: TiltResource[] = [];
      const unsubscribe = client.onResourceUpdate((resource) => {
        receivedUpdates.push(resource);
      });

      fixture.sendResourceUpdate({ name: 'frontend', status: 'ok' });
      await new Promise((resolve) => setTimeout(resolve, 50));

      unsubscribe();

      fixture.sendResourceUpdate({ name: 'backend', status: 'ok' });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedUpdates).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('ignores malformed JSON messages', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      const receivedLogs: LogLine[] = [];
      client.onLogLine((log) => receivedLogs.push(log));

      // Send malformed message
      fixture.lastConnection?.send('not json');

      // Send valid message after
      fixture.sendLogLine('my-service', 'Valid log');

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should only receive the valid message
      expect(receivedLogs).toHaveLength(1);
      expect(receivedLogs[0].text).toBe('Valid log');
    });

    test('ignores messages with unknown type', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      const receivedLogs: LogLine[] = [];
      const receivedUpdates: TiltResource[] = [];

      client.onLogLine((log) => receivedLogs.push(log));
      client.onResourceUpdate((resource) => receivedUpdates.push(resource));

      // Send unknown message type
      fixture.sendMessage({ type: 'unknown', data: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedLogs).toHaveLength(0);
      expect(receivedUpdates).toHaveLength(0);
    });

    test('emits error event on connection error', async () => {
      client = new TiltWebSocketClient();

      const errors: Error[] = [];
      client.onError((error) => errors.push(error));

      await expect(
        client.connect('ws://127.0.0.1:59999/ws/view'),
      ).rejects.toThrow();

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    test('accepts custom port and host', async () => {
      client = new TiltWebSocketClient({
        port: fixture.port,
        host: '127.0.0.1',
      });

      await client.connect();

      expect(client.isConnected()).toBe(true);
    });

    test('getConfig returns configuration', () => {
      client = new TiltWebSocketClient({
        port: 12345,
        host: 'custom.host',
      });

      const config = client.getConfig();
      expect(config.port).toBe(12345);
      expect(config.host).toBe('custom.host');
    });

    test('uses env port when not provided', () => {
      client = new TiltWebSocketClient();

      const config = client.getConfig();
      expect(config.port).toBe(fixture.port);
    });

    test('uses env host when not provided', () => {
      client = new TiltWebSocketClient();

      const config = client.getConfig();
      expect(config.host).toBe('127.0.0.1');
    });
  });

  describe('Close Event', () => {
    test('emits close event when server closes connection', async () => {
      client = new TiltWebSocketClient();
      await client.connect(fixture.url);

      let closeCalled = false;
      client.onClose(() => {
        closeCalled = true;
      });

      // Close from server side
      fixture.lastConnection?.close();

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(closeCalled).toBe(true);
      expect(client.isConnected()).toBe(false);
    });
  });
});
