/* eslint-disable @typescript-eslint/await-thenable */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createTiltCliFixture, TiltCliFixture } from '../fixtures/tilt-cli-fixture.ts';
import { TiltConnection } from '../../src/tilt/connection.ts';
import {
  TiltCommandTimeoutError,
  TiltNotInstalledError,
  TiltNotRunningError,
} from '../../src/tilt/errors.ts';

describe('TiltConnection', () => {
  let fixture: TiltCliFixture | undefined;

  const buildConnection = (overrides: Partial<ConstructorParameters<typeof TiltConnection>[0]> = {}) => {
    if (!fixture) {
      throw new Error('Fixture not initialized');
    }

    return new TiltConnection({
      port: fixture.port,
      host: fixture.host,
      timeout: 500,
      binaryPath: fixture.tiltBinary,
      cacheIntervalMs: 25,
      ...overrides,
    });
  };

  beforeEach(async () => {
    fixture = await createTiltCliFixture();
  });

  afterEach(() => {
    fixture?.cleanup();
    fixture = undefined;
  });

  describe('Session detection', () => {
    it('detects active Tilt session', async () => {
      const connection = buildConnection();

      const result = await connection.checkSession();

      expect(result).toBe(true);
      const events = fixture!.readEvents();
      expect(events.spawns.length).toBe(1);
    });

    it('throws TiltNotInstalledError when tilt binary is missing', async () => {
      const connection = new TiltConnection({
        port: fixture!.port,
        host: fixture!.host,
        timeout: 100,
        binaryPath: '/path/that/does/not/exist/tilt',
      });

      await expect(connection.checkSession()).rejects.toThrow(TiltNotInstalledError);
    });

    it('throws TiltNotRunningError when connection is refused', async () => {
      fixture!.setBehavior('refused');
      const connection = buildConnection();

      await expect(connection.checkSession()).rejects.toThrow(TiltNotRunningError);
      const events = fixture!.readEvents();
      expect(events.spawns.length).toBe(1);
    });
  });

  describe('Cache behavior', () => {
    it('uses cached result within interval', async () => {
      const connection = buildConnection({ cacheIntervalMs: 50 });

      await connection.checkSession();
      await connection.checkSession();

      const events = fixture!.readEvents();
      expect(events.spawns.length).toBe(1);
    });

    it('refreshes after cache expiration', async () => {
      const connection = buildConnection({ cacheIntervalMs: 30 });

      await connection.checkSession();
      await new Promise(resolve => setTimeout(resolve, 40));
      await connection.checkSession();

      const events = fixture!.readEvents();
      expect(events.spawns.length).toBe(2);
    });

    it('forceRefresh bypasses cache', async () => {
      const connection = buildConnection();

      await connection.checkSession();
      await connection.checkSession(true);

      const events = fixture!.readEvents();
      expect(events.spawns.length).toBe(2);
    });
  });

  describe('Explicit cache invalidation', () => {
    it('invalidateCache forces next check to query', async () => {
      const connection = buildConnection();

      await connection.checkSession();
      connection.invalidateCache();
      await connection.checkSession();

      const events = fixture!.readEvents();
      expect(events.spawns.length).toBe(2);
    });

    it('invalidates cache on error and retries on next call', async () => {
      const connection = buildConnection();
      await connection.checkSession();

      fixture!.setBehavior('refused');
      await expect(connection.checkSession(true)).rejects.toThrow(TiltNotRunningError);

      fixture!.setBehavior('healthy');
      await connection.checkSession(true);

      const events = fixture!.readEvents();
      expect(events.spawns.length).toBe(3);
    });
  });

  describe('Connection info', () => {
    it('returns connection configuration including binary and cache interval', () => {
      const connection = buildConnection({ cacheIntervalMs: 45, timeout: 500 });

      const info = connection.getConnectionInfo();

      expect(info).toEqual({
        port: fixture!.port,
        host: fixture!.host,
        timeout: 500,
        binaryPath: fixture!.tiltBinary,
        cacheIntervalMs: 45,
      });
    });

    it('uses default values when not specified', () => {
      const connection = new TiltConnection();
      const info = connection.getConnectionInfo();

      expect(info.port).toBe(10350);
      expect(info.host).toBe('localhost');
      expect(info.timeout).toBe(2000);
      expect(info.binaryPath).toBe('tilt');
      expect(info.cacheIntervalMs).toBe(10000);
    });
  });

  describe('Timeout handling', () => {
    it('kills process on timeout and throws TiltCommandTimeoutError', async () => {
      fixture!.setBehavior('hang', { hangMs: 20000 });
      const connection = buildConnection({ timeout: 500 });

      await expect(connection.checkSession()).rejects.toThrow(TiltCommandTimeoutError);

      const events = fixture!.readEvents();
      expect(events.spawns.length).toBe(1);
      expect(events.signals.some(event => event.signal === 'SIGTERM')).toBe(true);
    });
  });
});
