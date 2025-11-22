import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  requireTiltHost,
  requireTiltPort,
  resolveTiltTarget,
} from '../../src/tilt/config.js';

describe('Tilt Config', () => {
  const originalPort = process.env.TILT_PORT;
  const originalHost = process.env.TILT_HOST;

  beforeEach(() => {
    delete process.env.TILT_PORT;
    delete process.env.TILT_HOST;
  });

  afterEach(() => {
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

  describe('requireTiltPort()', () => {
    test('throws when no override or environment variable is provided', () => {
      expect(() => requireTiltPort()).toThrow(/TILT_PORT is not set/);
    });

    test('returns validated override when provided', () => {
      expect(requireTiltPort(17350)).toBe(17350);
    });

    test('throws when override is out of range', () => {
      expect(() => requireTiltPort(0)).toThrow(/Invalid Tilt port/);
      expect(() => requireTiltPort(70000)).toThrow(/Invalid Tilt port/);
    });

    test('parses and validates TILT_PORT from environment', () => {
      process.env.TILT_PORT = '17350';
      expect(requireTiltPort()).toBe(17350);
    });

    test('trims whitespace when reading TILT_PORT', () => {
      process.env.TILT_PORT = ' 17350 ';
      expect(requireTiltPort()).toBe(17350);
    });

    test('rejects non-numeric or empty TILT_PORT values', () => {
      process.env.TILT_PORT = '';
      expect(() => requireTiltPort()).toThrow(/TILT_PORT is empty/);
      process.env.TILT_PORT = '10350abc';
      expect(() => requireTiltPort()).toThrow(/must be an integer/);
      process.env.TILT_PORT = '10350.5';
      expect(() => requireTiltPort()).toThrow(/must be an integer/);
      process.env.TILT_PORT = '70000';
      expect(() => requireTiltPort()).toThrow(/Invalid Tilt port/);
    });
  });

  describe('requireTiltHost()', () => {
    test('returns localhost when no override or environment variable is provided', () => {
      expect(requireTiltHost()).toBe('localhost');
    });

    test('returns validated override when provided', () => {
      expect(requireTiltHost('192.168.1.100')).toBe('192.168.1.100');
    });

    test('throws when override is empty', () => {
      expect(() => requireTiltHost('  ')).toThrow(/Tilt host is empty/);
    });

    test('reads and trims TILT_HOST from environment', () => {
      process.env.TILT_HOST = ' tilt.local ';
      expect(requireTiltHost()).toBe('tilt.local');
    });

    test('returns localhost when TILT_HOST is missing or empty', () => {
      expect(requireTiltHost()).toBe('localhost');
      process.env.TILT_HOST = '   ';
      expect(requireTiltHost()).toBe('localhost');
    });
  });

  describe('resolveTiltTarget()', () => {
    test('combines host and port overrides', () => {
      const target = resolveTiltTarget({ port: 30000, host: 'example.com' });
      expect(target).toEqual({ port: 30000, host: 'example.com' });
    });

    test('reads from environment when overrides are omitted', () => {
      process.env.TILT_PORT = '15000';
      process.env.TILT_HOST = 'localhost';
      const target = resolveTiltTarget();
      expect(target).toEqual({ port: 15000, host: 'localhost' });
    });

    test('throws when TILT_PORT is missing, defaults host to localhost', () => {
      expect(() => resolveTiltTarget()).toThrow(/TILT_PORT is not set/);
      process.env.TILT_PORT = '15000';
      const target = resolveTiltTarget();
      expect(target).toEqual({ port: 15000, host: 'localhost' });
    });
  });
});
