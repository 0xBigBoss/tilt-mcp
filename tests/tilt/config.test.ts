/**
 * Tilt Config Tests
 *
 * Tests for environment variable support in connection defaults.
 * Priority: explicit args > extra config > env vars > built-in defaults
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  getDefaultPortRange,
  getDefaultTiltHost,
  getDefaultTiltPort,
} from '../../src/tilt/config.js';

describe('Tilt Config', () => {
  // Store original env values
  const originalPort = process.env.TILT_PORT;
  const originalHost = process.env.TILT_HOST;

  beforeEach(() => {
    // Clear env vars before each test
    delete process.env.TILT_PORT;
    delete process.env.TILT_HOST;
  });

  afterEach(() => {
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

  describe('getDefaultTiltPort()', () => {
    test('returns 10350 when TILT_PORT is not set', () => {
      expect(getDefaultTiltPort()).toBe(10350);
    });

    test('returns parsed TILT_PORT when set to valid number', () => {
      process.env.TILT_PORT = '17350';
      expect(getDefaultTiltPort()).toBe(17350);
    });

    test('returns 10350 when TILT_PORT is empty string', () => {
      process.env.TILT_PORT = '';
      expect(getDefaultTiltPort()).toBe(10350);
    });

    test('returns 10350 when TILT_PORT is non-numeric', () => {
      process.env.TILT_PORT = 'invalid';
      expect(getDefaultTiltPort()).toBe(10350);
    });

    test('returns 10350 when TILT_PORT is negative', () => {
      process.env.TILT_PORT = '-1';
      expect(getDefaultTiltPort()).toBe(10350);
    });

    test('returns 10350 when TILT_PORT is zero', () => {
      process.env.TILT_PORT = '0';
      expect(getDefaultTiltPort()).toBe(10350);
    });

    test('returns 10350 when TILT_PORT exceeds 65535', () => {
      process.env.TILT_PORT = '70000';
      expect(getDefaultTiltPort()).toBe(10350);
    });

    test('returns valid port at boundary (1)', () => {
      process.env.TILT_PORT = '1';
      expect(getDefaultTiltPort()).toBe(1);
    });

    test('returns valid port at boundary (65535)', () => {
      process.env.TILT_PORT = '65535';
      expect(getDefaultTiltPort()).toBe(65535);
    });

    test('returns 10350 when TILT_PORT has decimal', () => {
      process.env.TILT_PORT = '10350.5';
      expect(getDefaultTiltPort()).toBe(10350);
    });

    // Issue 2: Loose Port Parsing - strict validation tests
    test('returns 10350 when TILT_PORT has trailing non-numeric characters', () => {
      process.env.TILT_PORT = '10350abc';
      expect(getDefaultTiltPort()).toBe(10350);
    });

    test('returns 10350 when TILT_PORT is scientific notation', () => {
      process.env.TILT_PORT = '1e4';
      expect(getDefaultTiltPort()).toBe(10350);
    });

    test('returns parsed port when TILT_PORT has whitespace', () => {
      process.env.TILT_PORT = ' 17350 ';
      expect(getDefaultTiltPort()).toBe(17350);
    });
  });

  describe('getDefaultTiltHost()', () => {
    test('returns localhost when TILT_HOST is not set', () => {
      expect(getDefaultTiltHost()).toBe('localhost');
    });

    test('returns TILT_HOST when set', () => {
      process.env.TILT_HOST = '192.168.1.100';
      expect(getDefaultTiltHost()).toBe('192.168.1.100');
    });

    test('returns localhost when TILT_HOST is empty string', () => {
      process.env.TILT_HOST = '';
      expect(getDefaultTiltHost()).toBe('localhost');
    });

    test('returns custom hostname', () => {
      process.env.TILT_HOST = 'tilt.local';
      expect(getDefaultTiltHost()).toBe('tilt.local');
    });

    test('returns IPv6 address', () => {
      process.env.TILT_HOST = '::1';
      expect(getDefaultTiltHost()).toBe('::1');
    });
  });

  describe('getDefaultPortRange()', () => {
    test('returns [10350, 10354] when TILT_PORT is not set', () => {
      expect(getDefaultPortRange()).toEqual([10350, 10354]);
    });

    test('returns range starting from TILT_PORT when set', () => {
      process.env.TILT_PORT = '17350';
      expect(getDefaultPortRange()).toEqual([17350, 17354]);
    });

    test('respects custom range size', () => {
      process.env.TILT_PORT = '20000';
      expect(getDefaultPortRange(2)).toEqual([20000, 20002]);
    });

    test('uses default port when TILT_PORT is invalid', () => {
      process.env.TILT_PORT = 'invalid';
      expect(getDefaultPortRange()).toEqual([10350, 10354]);
    });

    // Issue 3: Port Range Overflow - clamps to 65535
    test('clamps end port to 65535 when TILT_PORT is near max', () => {
      process.env.TILT_PORT = '65534';
      expect(getDefaultPortRange(4)).toEqual([65534, 65535]);
    });

    test('clamps to single port when TILT_PORT is 65535', () => {
      process.env.TILT_PORT = '65535';
      expect(getDefaultPortRange(4)).toEqual([65535, 65535]);
    });

    test('returns normal range when well within bounds', () => {
      process.env.TILT_PORT = '10350';
      expect(getDefaultPortRange(4)).toEqual([10350, 10354]);
    });
  });
});
