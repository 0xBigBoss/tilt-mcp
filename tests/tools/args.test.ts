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
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
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
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
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
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
        { tiltBinaryPath: fixture.tiltBinary },
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
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
        { tiltBinaryPath: fixture.tiltBinary },
      ),
    ).rejects.toThrow(/args.*or.*clear|clear.*or.*args/i);
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
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
        { tiltBinaryPath: fixture.tiltBinary },
      ),
    ).rejects.toThrow(/args.*or.*clear|clear.*or.*args/i);
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
});
