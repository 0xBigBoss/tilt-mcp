import { describe, expect, it } from 'bun:test';
import {
  TiltError,
  TiltNotInstalledError,
  TiltNotRunningError,
  TiltResourceNotFoundError,
  TiltCommandTimeoutError,
  TiltOutputExceededError,
} from '../../src/tilt/errors.ts';

describe('TiltError', () => {
  it('is an instance of Error', () => {
    const error = new TiltError('Test error', 'TEST_ERROR');
    expect(error).toBeInstanceOf(Error);
  });

  it('sets message correctly', () => {
    const error = new TiltError('Test error message', 'TEST_ERROR');
    expect(error.message).toBe('Test error message');
  });

  it('sets code correctly', () => {
    const error = new TiltError('Test error', 'TEST_CODE');
    expect(error.code).toBe('TEST_CODE');
  });

  it('sets name to TiltError', () => {
    const error = new TiltError('Test error', 'TEST_ERROR');
    expect(error.name).toBe('TiltError');
  });

  it('includes details when provided', () => {
    const details = { foo: 'bar', count: 42 };
    const error = new TiltError('Test error', 'TEST_ERROR', details);
    expect(error.details).toEqual(details);
  });

  it('has undefined details when not provided', () => {
    const error = new TiltError('Test error', 'TEST_ERROR');
    expect(error.details).toBeUndefined();
  });

  it('captures stack trace', () => {
    const error = new TiltError('Test error', 'TEST_ERROR');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('TiltError');
  });
});

describe('TiltNotInstalledError', () => {
  it('extends TiltError', () => {
    const error = new TiltNotInstalledError();
    expect(error).toBeInstanceOf(TiltError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has correct error code', () => {
    const error = new TiltNotInstalledError();
    expect(error.code).toBe('TILT_NOT_INSTALLED');
  });

  it('has correct name', () => {
    const error = new TiltNotInstalledError();
    expect(error.name).toBe('TiltNotInstalledError');
  });

  it('provides clear message about missing Tilt CLI', () => {
    const error = new TiltNotInstalledError();
    expect(error.message).toContain('Tilt CLI not found');
    expect(error.message).toContain('PATH');
  });

  it('includes installation instructions', () => {
    const error = new TiltNotInstalledError();
    expect(error.message.toLowerCase()).toContain('install');
    expect(error.message).toContain('https://docs.tilt.dev');
  });

  it('has empty details object', () => {
    const error = new TiltNotInstalledError();
    expect(error.details).toEqual({});
  });
});

describe('TiltNotRunningError', () => {
  it('extends TiltError', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error).toBeInstanceOf(TiltError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has correct error code', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.code).toBe('TILT_NOT_RUNNING');
  });

  it('has correct name', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.name).toBe('TiltNotRunningError');
  });

  it('includes port and host in message', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.message).toContain('localhost:10350');
  });

  it('explains no active session', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.message).toContain('No active Tilt session');
  });

  it('provides actionable fix (run tilt up)', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.message).toContain('tilt up');
  });

  it('includes port in details', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.details.port).toBe(10350);
  });

  it('includes host in details', () => {
    const error = new TiltNotRunningError(10350, 'localhost');
    expect(error.details.host).toBe('localhost');
  });

  it('works with custom port', () => {
    const error = new TiltNotRunningError(10351, '192.168.1.1');
    expect(error.message).toContain('192.168.1.1:10351');
    expect(error.details.port).toBe(10351);
    expect(error.details.host).toBe('192.168.1.1');
  });

  it('works with IPv6 host', () => {
    const error = new TiltNotRunningError(10350, '[::1]');
    expect(error.message).toContain('[::1]:10350');
    expect(error.details.host).toBe('[::1]');
  });
});

describe('TiltResourceNotFoundError', () => {
  it('extends TiltError', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error).toBeInstanceOf(TiltError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has correct error code', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.code).toBe('TILT_RESOURCE_NOT_FOUND');
  });

  it('has correct name', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.name).toBe('TiltResourceNotFoundError');
  });

  it('includes resource name in message', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.message).toContain('my-service');
  });

  it('explains resource does not exist', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.message).toContain('not found');
    expect(error.message).toContain('Resource');
  });

  it('provides actionable fix (check name, list resources)', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.message).toMatch(/list.*resources|check.*name/i);
  });

  it('includes resource name in details', () => {
    const error = new TiltResourceNotFoundError('my-service');
    expect(error.details.resourceName).toBe('my-service');
  });

  it('works with different resource names', () => {
    const error = new TiltResourceNotFoundError('api-backend');
    expect(error.message).toContain('api-backend');
    expect(error.details.resourceName).toBe('api-backend');
  });
});

describe('TiltCommandTimeoutError', () => {
  it('extends TiltError', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error).toBeInstanceOf(TiltError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has correct error code', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.code).toBe('TILT_COMMAND_TIMEOUT');
  });

  it('has correct name', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.name).toBe('TiltCommandTimeoutError');
  });

  it('includes command in message', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.message).toContain('get resources');
  });

  it('includes timeout duration in message', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.message).toContain('30000');
  });

  it('explains command timed out', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.message).toMatch(/timed out|timeout/i);
  });

  it('includes command in details', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.details.command).toBe('get resources');
  });

  it('includes timeout in details', () => {
    const error = new TiltCommandTimeoutError('get resources', 30000);
    expect(error.details.timeoutMs).toBe(30000);
  });

  it('works with different commands and timeouts', () => {
    const error = new TiltCommandTimeoutError('describe resource/foo', 5000);
    expect(error.message).toContain('describe resource/foo');
    expect(error.message).toContain('5000');
    expect(error.details.command).toBe('describe resource/foo');
    expect(error.details.timeoutMs).toBe(5000);
  });
});

describe('TiltOutputExceededError', () => {
  it('extends TiltError', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error).toBeInstanceOf(TiltError);
    expect(error).toBeInstanceOf(Error);
  });

  it('has correct error code', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.code).toBe('TILT_OUTPUT_EXCEEDED');
  });

  it('has correct name', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.name).toBe('TiltOutputExceededError');
  });

  it('includes max buffer size in message', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.message).toContain('10485760');
  });

  it('explains output exceeded buffer', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.message).toMatch(/exceeded|buffer/i);
  });

  it('provides actionable fix (filter output, increase limit)', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.message).toMatch(/filter|limit|reduce/i);
  });

  it('includes max buffer size in details', () => {
    const error = new TiltOutputExceededError(10485760);
    expect(error.details.maxBufferBytes).toBe(10485760);
  });

  it('works with different buffer sizes', () => {
    const error = new TiltOutputExceededError(52428800);
    expect(error.message).toContain('52428800');
    expect(error.details.maxBufferBytes).toBe(52428800);
  });
});

describe('Error type checking', () => {
  it('TiltError can be identified by code', () => {
    const error = new TiltError('test', 'CUSTOM_CODE');
    expect(error.code).toBe('CUSTOM_CODE');
  });

  it('All error types have unique codes', () => {
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

  it('All error types are properly typed', () => {
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
