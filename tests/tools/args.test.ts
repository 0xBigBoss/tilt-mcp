/**
 * Tests for tilt_args tool
 *
 * Tests getting/setting Tiltfile args
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { tiltArgs } from '../../src/tools/args.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_args tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('sets args successfully', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: '',
    });
    fixtures.push(fixture);

    const result = await tiltArgs.handler(
      {
        args: ['frontend', 'backend'],
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
    expect(output.args).toEqual(['frontend', 'backend']);
  });

  it('clears args successfully', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: '',
    });
    fixtures.push(fixture);

    const result = await tiltArgs.handler(
      {
        clear: true,
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    expect(result.content).toHaveLength(1);
    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
    expect(output.message).toContain('cleared');
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltArgs.handler(
        {
          args: ['test'],
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      ),
    ).rejects.toThrow(/No active Tilt session|connection refused/i);
  });

  it('throws error when neither args nor clear is provided', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: '',
    });
    fixtures.push(fixture);

    // The schema validation should reject this before it reaches the CLI
    await expect(
      tiltArgs.handler(
        {
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      ),
    ).rejects.toThrow(/mode="get"|interactive editor|tilt args without arguments/i);
  });

  it('throws error when args is empty array', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: '',
    });
    fixtures.push(fixture);

    await expect(
      tiltArgs.handler(
        {
          args: [],
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      ),
    ).rejects.toThrow(/mode="set"|tilt args without arguments|interactive editor/i);
  });

  it('uses default port and host when not provided', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: '',
    });
    fixtures.push(fixture);

    const result = await tiltArgs.handler(
      { args: ['test'] },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
  });

  // TILT-003: Cannot View Current Tiltfile Args
  it('returns current args when called in read-only mode', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify({
        apiVersion: 'tilt.dev/v1alpha1',
        kind: 'Tiltfile',
        metadata: { name: '(Tiltfile)' },
        spec: {
          args: ['frontend', 'backend'],
          path: '/test/Tiltfile',
        },
      }),
    });
    fixtures.push(fixture);

    const result = await tiltArgs.handler(
      {
        mode: 'get',
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    expect(result.content).toHaveLength(1);
    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
    expect(output.args).toEqual(['frontend', 'backend']);
    expect(output.message).toMatch(/current.*args/i);
  });

  it('returns empty array when no args are set in read-only mode', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify({
        apiVersion: 'tilt.dev/v1alpha1',
        kind: 'Tiltfile',
        metadata: { name: '(Tiltfile)' },
        spec: {
          args: [],
          path: '/test/Tiltfile',
        },
      }),
    });
    fixtures.push(fixture);

    const result = await tiltArgs.handler(
      {
        mode: 'get',
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
    expect(output.args).toEqual([]);
  });

  it('allows mode="set" as explicit alternative to providing args', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: '',
    });
    fixtures.push(fixture);

    const result = await tiltArgs.handler(
      {
        mode: 'set',
        args: ['service1', 'service2'],
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
    expect(output.args).toEqual(['service1', 'service2']);
  });

  it('allows mode="clear" as explicit alternative to clear flag', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: '',
    });
    fixtures.push(fixture);

    const result = await tiltArgs.handler(
      {
        mode: 'clear',
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
    expect(output.message).toContain('cleared');
  });

  it('validates that mode and legacy flags are not mixed', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: '',
    });
    fixtures.push(fixture);

    // mode + args should fail
    await expect(
      tiltArgs.handler(
        {
          mode: 'get',
          args: ['test'],
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      ),
    ).rejects.toThrow(/cannot.*mix|mode.*with/i);

    // mode + clear should fail
    await expect(
      tiltArgs.handler(
        {
          mode: 'get',
          clear: true,
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      ),
    ).rejects.toThrow(/cannot.*mix|mode.*with/i);
  });
});
