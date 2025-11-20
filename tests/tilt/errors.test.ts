import { describe, test, expect } from 'vitest';
import {
  TiltError,
  TiltNotInstalledError,
  TiltNotRunningError,
  TiltResourceNotFoundError,
  TiltCommandTimeoutError,
  TiltOutputExceededError,
} from '../../src/tilt/errors.js';

describe('TiltError', () => {
  test('is an instance of Error', () => {
    const error = new TiltError('Test error', 'TEST_ERROR');
    expect(error).toBeInstanceOf(Error);
  });

  test('sets message correctly', () => {
    const error = new TiltError('Test error message', 'TEST_ERROR');
    expect(error.message).toBe('Test error message');
  });

  test('sets code correctly', () => {
    const error = new TiltError('Test error', 'TEST_CODE');
    expect(error.code).toBe('TEST_CODE');
  });

  test('sets name to TiltError', () => {
    const error = new TiltError('Test error', 'TEST_ERROR');
    expect(error.name).toBe('TiltError');
  });

  test('includes details when provided', () => {
    const details = { foo: 'bar', count: 42 };
    const error = new TiltError('Test error', 'TEST_ERROR', details);
    expect(error.details).toEqual(details);
  });

  test('has undefined details when not provided', () => {
    const error = new TiltError('Test error', 'TEST_ERROR');
    expect(error.details).toBeUndefined();
  });

  test('captures stack trace', () => {
    const error = new TiltError('Test error', 'TEST_ERROR');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('TiltError');
  });
});

describe('TiltNotInstalledError', () => {
  test('extends TiltError', () => {
    const error = new TiltNotInstalledError();
    expect(error).toBeInstanceOf(TiltError);
    expect(error).toBeInstanceOf(Error);
  });

  test('has correct error code', () => {
    const error = new TiltNotInstalledError();
    expect(error.code).toBe('TILT_NOT_INSTALLED');
  });

  test('has correct name', () => {
    const error = new TiltNotInstalledError();
    expect(error.name).toBe('TiltNotInstalledError');
  });

  test('provides clear message about missing Tilt CLI', () => {
    const error = new TiltNotInstalledError();
    expect(error.message).toContain('Tilt CLI not found');
    expect(error.message).toContain('PATH');
  });

  test('includes installation instructions', () => {
    const error = new TiltNotInstalledError();
    expect(error.message.toLowerCase()).toContain('install');
    expect(error.message).toContain('https://docs.tilt.dev');
  });

  test('has empty details object', () => {
    const error = new TiltNotInstalledError();
    expect(error.details).toEqual({});
  });
});

describe('TiltNotRunningError', () => {
  test('extends TiltError', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error).toBeInstanceOf(TiltError);
    expect(error).toBeInstanceOf(Error);
  });

  test('has correct error code', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.code).toBe('TILT_NOT_RUNNING');
  });

  test('has correct name', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.name).toBe('TiltNotRunningError');
  });

  test('includes port and host in message', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.message).toContain('localhost:10350');
  });

  test('explains no active session', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.message).toContain('No active Tilt session');
  });

  test('provides actionable fix (run tilt up)', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.message).toContain('tilt up');
  });

  test('includes port in details', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.details.port).toBe(10350);
  });

  test('includes host in details', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.details.host).toBe('localhost');
  });

  test('works with custom port', () => {
    const error = new TiltNotRunningError(10351, '192.168.1.1');
    expect(error.message).toContain('192.168.1.1:10351');
    expect(error.details.port).toBe(10351);
    expect(error.details.host).toBe('192.168.1.1');
  });

  test('works with IPv6 host', () => {
    const error = new TiltNotRunningError(10350, '[::1]');
    expect(error.message).toContain('[::1]:10350');
    expect(error.details.host).toBe('[::1]');
  });
});

describe('TiltResourceNotFoundError', () => {
  test('extends TiltError', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error).toBeInstanceOf(TiltError);
    expect(error).toBeInstanceOf(Error);
  });

  test('has correct error code', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.code).toBe('TILT_RESOURCE_NOT_FOUND');
  });

  test('has correct name', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.name).toBe('TiltResourceNotFoundError');
  });

  test('includes resource name in message', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.message).toContain('my-service');
  });

  test('explains resource does not exist', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.message).toContain('not found');
    expect(error.message).toContain('Resource');
  });

  test('provides actionable fix (check name, list resources)', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.message).toMatch(/list.*resources|check.*name/i);
  });

  test('includes resource name in details', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.details.resourceName).toBe('my-service');
  });

  test('works with different resource names', () => {
    const error = new TiltResourceNotFoundError('api-backend');
    expect(error.message).toContain('api-backend');
    expect(error.details.resourceName).toBe('api-backend');
  });
});

describe('TiltCommandTimeoutError', () => {
  test('extends TiltError', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error).toBeInstanceOf(TiltError);
    expect(error).toBeInstanceOf(Error);
  });

  test('has correct error code', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.code).toBe('TILT_COMMAND_TIMEOUT');
  });

  test('has correct name', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.name).toBe('TiltCommandTimeoutError');
  });

  test('includes command in message', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.message).toContain('get resources');
  });

  test('includes timeout duration in message', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.message).toContain('30000');
  });

  test('explains command timed out', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.message).toMatch(/timed out|timeout/i);
  });

  test('includes command in details', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.details.command).toBe('get resources');
  });

  test('includes timeout in details', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.details.timeoutMs).toBe(30000);
  });

  test('works with different commands and timeouts', () => {
    const error = new TiltCommandTimeoutError('describe resource/foo', 5000);
    expect(error.message).toContain('describe resource/foo');
    expect(error.message).toContain('5000');
    expect(error.details.command).toBe('describe resource/foo');
    expect(error.details.timeoutMs).toBe(5000);
  });
});

describe('TiltOutputExceededError', () => {
  test('extends TiltError', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error).toBeInstanceOf(TiltError);
    expect(error).toBeInstanceOf(Error);
  });

  test('has correct error code', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.code).toBe('TILT_OUTPUT_EXCEEDED');
  });

  test('has correct name', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.name).toBe('TiltOutputExceededError');
  });

  test('includes max buffer size in message', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.message).toContain('10485760');
  });

  test('explains output exceeded buffer', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.message).toMatch(/exceeded|buffer/i);
  });

  test('provides actionable fix (filter output, increase limit)', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.message).toMatch(/filter|limit|reduce/i);
  });

  test('includes max buffer size in details', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.details.maxBufferBytes).toBe(10485760);
  });

  test('works with different buffer sizes', () => {
    const error = new TiltOutputExceededError(52428800);
    expect(error.message).toContain('52428800');
    expect(error.details.maxBufferBytes).toBe(52428800);
  });
});

describe('Error type checking', () => {
  test('TiltError can be identified by code', () => {
    const error = new TiltError('test', 'CUSTOM_CODE');
    expect(error.code).toBe('CUSTOM_CODE');
  });

  test('All error types have unique codes', () => {
    const errors = [
      new TiltNotInstalledError(),
      new TiltNotRunningError(10350, 'localhost'),
      new TiltResourceNotFoundError('test'),
      new TiltCommandTimeoutError('test', 1000),
      new TiltOutputExceededError(1000),
    ];

    const codes = errors.map(e => e.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  test('All error types are properly typed', () => {
    const notInstalled: TiltNotInstalledError = new TiltNotInstalledError();
    const notRunning: TiltNotRunningError = new TiltNotRunningError(10350, 'localhost');
    const notFound: TiltResourceNotFoundError = new TiltResourceNotFoundError('test');
    const timeout: TiltCommandTimeoutError = new TiltCommandTimeoutError('test', 1000);
    const exceeded: TiltOutputExceededError = new TiltOutputExceededError(1000);

    // Type assertions - these should compile
    expect(notInstalled).toBeInstanceOf(TiltNotInstalledError);
    expect(notRunning).toBeInstanceOf(TiltNotRunningError);
    expect(notFound).toBeInstanceOf(TiltResourceNotFoundError);
    expect(timeout).toBeInstanceOf(TiltCommandTimeoutError);
    expect(exceeded).toBeInstanceOf(TiltOutputExceededError);
  });
});
