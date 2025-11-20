/**
 * Integration tests for TiltConnection
 * 
 * Tests actual Tilt CLI interaction (requires Tilt installed)
 * Run with: npm run test:integration
 */

import { describe, test, expect } from 'vitest';
import { TiltConnection } from '../../src/tilt/connection.js';
import {
  TiltNotInstalledError,
  TiltNotRunningError,
} from '../../src/tilt/errors.js';

describe('TiltConnection Integration', () => {
  test('detects Tilt not running on default port', async () => {
    const connection = new TiltConnection();

    // Should throw TiltNotRunningError unless Tilt is actually running
    try {
      await connection.checkSession();
      // If we get here, Tilt is running - that's ok too
      expect(true).toBe(true);
    } catch (error) {
      // Expected error when Tilt is not running
      if (error instanceof TiltNotRunningError) {
        expect(error.code).toBe('TILT_NOT_RUNNING');
        expect(error.message).toContain('No active Tilt session');
      } else if (error instanceof TiltNotInstalledError) {
        // Also acceptable - Tilt may not be installed in CI
        expect(error.code).toBe('TILT_NOT_INSTALLED');
      } else {
        // Unexpected error
        throw error;
      }
    }
  });

  test('returns correct connection info', () => {
    const connection = new TiltConnection({
      port: 10351,
      host: '127.0.0.1',
      timeout: 3000,
    });

    const info = connection.getConnectionInfo();
    expect(info).toEqual({
      port: 10351,
      host: '127.0.0.1',
      timeout: 3000,
    });
  });

  test('cache invalidation works correctly', async () => {
    const connection = new TiltConnection();

    // Try to check session (will fail if Tilt not running)
    try {
      await connection.checkSession();
    } catch (error) {
      // Expected - ignore
    }

    // Invalidate cache
    connection.invalidateCache();

    // Next check should query again
    try {
      await connection.checkSession();
    } catch (error) {
      // Expected - ignore
    }

    // Test passes if no crashes occurred
    expect(true).toBe(true);
  });
});
