/**
 * Tests for TiltConnection class
 *
 * Validates session caching, invalidation, and error handling
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  TiltNotInstalledError,
  TiltNotRunningError,
  TiltCommandTimeoutError,
} from '../../src/tilt/errors.js';

// Mock child_process at the top level - BEFORE any imports that use it
vi.mock('child_process', () => {
  return {
    spawn: vi.fn(),
  };
});

// Now import the module under test
const { TiltConnection } = await import('../../src/tilt/connection.js');
const { spawn } = await import('child_process');

/**
 * Create a mock process that succeeds
 */
function createMockProcess(stdout: string = '{"kind": "Session"}', exitCode: number = 0) {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();

  // Simulate async behavior
  process.nextTick(() => {
    if (stdout) {
      proc.stdout.emit('data', Buffer.from(stdout));
    }
    proc.emit('close', exitCode);
  });

  return proc;
}

/**
 * Create a mock process that errors immediately
 */
function createErrorProcess(error: NodeJS.ErrnoException) {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();

  process.nextTick(() => {
    proc.emit('error', error);
  });

  return proc;
}

/**
 * Create a mock process with stderr output
 */
function createStderrProcess(stderr: string, exitCode: number = 1) {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();

  process.nextTick(() => {
    proc.stderr.emit('data', Buffer.from(stderr));
    proc.emit('close', exitCode);
  });

  return proc;
}

describe('TiltConnection', () => {
  let connection: InstanceType<typeof TiltConnection>;

  beforeEach(() => {
    connection = new TiltConnection({ port: 10350, host: 'localhost', timeout: 2000 });
    vi.clearAllMocks();
  });

  describe('Session Detection', () => {
    test('detects active Tilt session', async () => {
      vi.mocked(spawn).mockReturnValue(createMockProcess());

      const result = await connection.checkSession();
      
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        'tilt',
        ['get', 'session', '--port', '10350', '--host', 'localhost'],
        expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] })
      );
    });

    test('throws TiltNotInstalledError when tilt command not found', async () => {
      const error: NodeJS.ErrnoException = new Error('spawn tilt ENOENT');
      error.code = 'ENOENT';
      vi.mocked(spawn).mockReturnValue(createErrorProcess(error));

      await expect(connection.checkSession()).rejects.toThrow(TiltNotInstalledError);
    });

    test('throws TiltNotRunningError when connection refused', async () => {
      vi.mocked(spawn).mockReturnValue(
        createStderrProcess('dial tcp 127.0.0.1:10350: connection refused')
      );

      await expect(connection.checkSession()).rejects.toThrow(TiltNotRunningError);
    });
  });

  describe('Cache Behavior', () => {
    test('uses cached result within 10-second interval', async () => {
      vi.mocked(spawn).mockReturnValue(createMockProcess());

      // First call
      await connection.checkSession();
      expect(spawn).toHaveBeenCalledTimes(1);

      // Second call immediately (should use cache)
      await connection.checkSession();
      
      // Still only called once
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    test('refreshes after 10-second cache expiration', async () => {
      vi.useFakeTimers();

      vi.mocked(spawn).mockReturnValue(createMockProcess());

      // First call
      await connection.checkSession();
      expect(spawn).toHaveBeenCalledTimes(1);

      // Advance time by 11 seconds (past cache interval)
      vi.advanceTimersByTime(11000);

      vi.mocked(spawn).mockReturnValue(createMockProcess());

      // Second call after cache expiration
      await connection.checkSession();

      // Should have called spawn twice
      expect(spawn).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    test('forceRefresh bypasses cache', async () => {
      vi.mocked(spawn).mockReturnValue(createMockProcess());

      // First call
      await connection.checkSession();
      expect(spawn).toHaveBeenCalledTimes(1);

      vi.mocked(spawn).mockReturnValue(createMockProcess());

      // Force refresh
      await connection.checkSession(true);

      // Should have called spawn twice
      expect(spawn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Explicit Cache Invalidation', () => {
    test('invalidateCache forces next check to query', async () => {
      vi.mocked(spawn).mockReturnValue(createMockProcess());

      // First call
      await connection.checkSession();
      expect(spawn).toHaveBeenCalledTimes(1);

      // Invalidate cache
      connection.invalidateCache();

      vi.mocked(spawn).mockReturnValue(createMockProcess());

      // Next call should query again (not use cache)
      await connection.checkSession();

      expect(spawn).toHaveBeenCalledTimes(2);
    });

    test('invalidates cache on error', async () => {
      vi.useFakeTimers();

      vi.mocked(spawn).mockReturnValue(createMockProcess());

      // First call succeeds
      await connection.checkSession();

      vi.mocked(spawn).mockReturnValue(
        createStderrProcess('connection refused')
      );

      // Second call fails (force refresh to bypass cache)
      await expect(connection.checkSession(true)).rejects.toThrow(TiltNotRunningError);

      // Move time forward to ensure we're past any cache window
      vi.advanceTimersByTime(100);

      vi.mocked(spawn).mockReturnValue(createMockProcess());

      // Third call should query again because forceRefresh bypasses cache
      await connection.checkSession(true);

      // Should have spawned 3 times total (initial, error, refresh)
      expect(spawn).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });

  describe('Connection Info', () => {
    test('returns connection configuration', () => {
      const info = connection.getConnectionInfo();
      
      expect(info).toEqual({
        port: 10350,
        host: 'localhost',
        timeout: 2000,
      });
    });

    test('uses default values when not specified', () => {
      const defaultConnection = new TiltConnection();
      const info = defaultConnection.getConnectionInfo();
      
      expect(info.port).toBe(10350);
      expect(info.host).toBe('localhost');
      expect(info.timeout).toBe(2000);
    });
  });

  describe('Timeout Handling', () => {
    test('kills process on timeout', async () => {
      vi.useFakeTimers();

      // Create a process that never completes
      const proc = new EventEmitter() as any;
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = vi.fn();

      vi.mocked(spawn).mockReturnValue(proc);

      const promise = connection.checkSession();

      // Advance time past timeout (this will trigger the kill)
      await vi.advanceTimersByTimeAsync(2100);

      // Now emit close event to complete the promise
      proc.emit('close', null);

      // Wait a tick for the promise to settle
      await new Promise(resolve => process.nextTick(resolve));

      // Process should be killed
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');

      await expect(promise).rejects.toThrow(TiltCommandTimeoutError);

      vi.useRealTimers();
    });
  });
});
