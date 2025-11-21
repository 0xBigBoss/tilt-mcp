/**
 * Tests for tilt_wait tool
 *
 * Tests waiting for resources to be ready
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { tiltWait } from '../../src/tools/wait.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_wait tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('waits for resources successfully', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'uiresource/web-app condition met',
    });
    fixtures.push(fixture);

    const result = await tiltWait.handler(
      {
        resources: ['web-app'],
        timeout: 30,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
    expect(output.resources).toEqual(['web-app']);
  });

  it('waits for all resources when none specified', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'all resources ready',
    });
    fixtures.push(fixture);

    const result = await tiltWait.handler(
      {
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    expect(result.content).toHaveLength(1);
    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltWait.handler(
        {
          resources: ['web-app'],
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
      stdout: '',
    });
    fixtures.push(fixture);

    const result = await tiltWait.handler(
      { resources: ['test'] },
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
