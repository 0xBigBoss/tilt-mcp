/**
 * Tests for tilt_dump tool
 *
 * Tests dumping Tilt engine state
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { tiltDump } from '../../src/tools/dump.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_dump tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('dumps engine state as JSON', async () => {
    const engineState = { engine: 'state', resources: [] };
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(engineState),
    });
    fixtures.push(fixture);

    const result = await tiltDump.handler(
      {
        format: 'json',
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
    expect(output.format).toBe('json');
    expect(output.data).toEqual(engineState);
  });

  it('defaults to JSON format', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: '{"engine":"state"}',
    });
    fixtures.push(fixture);

    const result = await tiltDump.handler(
      {
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
    expect(output.format).toBe('json');
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltDump.handler(
        {
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
        { tiltBinaryPath: fixture.tiltBinary },
      ),
    ).rejects.toThrow(/No active Tilt session|connection refused/i);
  });

  it('uses default port and host when not provided', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: '{"test":true}',
    });
    fixtures.push(fixture);

    const result = await tiltDump.handler(
      {},
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
