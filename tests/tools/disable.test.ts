/**
 * Tests for tilt_disable tool
 *
 * Tests disabling resources in Tilt
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { tiltDisable } from '../../src/tools/disable.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_disable tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('disables a resource successfully', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'disabled',
    });
    fixtures.push(fixture);

    const result = await tiltDisable.handler(
      { resourceName: 'web-app' },
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
    expect(output.resourceName).toBe('web-app');
    expect(output.message).toContain('disabled');
  });

  it('returns resource state when verbose is true', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify({
        kind: 'UIResource',
        metadata: { name: 'web-app', labels: { tier: 'backend' } },
        status: {
          disableStatus: { state: 'Disabled' },
          conditions: [{ type: 'Ready', status: 'False' }],
        },
      }),
    });
    fixtures.push(fixture);

    const result = await tiltDisable.handler(
      { resourceName: 'web-app', verbose: true },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
    expect(output.resourceState.name).toBe('web-app');
    expect(output.resourceState.status.disableStatus.state).toBe('Disabled');
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltDisable.handler(
        { resourceName: 'web-app' },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      ),
    ).rejects.toThrow(/No active Tilt session|connection refused/i);
  });

  it('uses default port and host when not provided', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'disabled',
    });
    fixtures.push(fixture);

    const result = await tiltDisable.handler(
      { resourceName: 'web-app' },
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
