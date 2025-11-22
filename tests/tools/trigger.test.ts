/**
 * Tests for tilt_trigger tool
 *
 * Tests manual resource triggering
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { tiltTrigger } from '../../src/tools/trigger.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_trigger tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('triggers a resource successfully', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'triggered',
    });
    fixtures.push(fixture);

    const result = await tiltTrigger.handler(
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
    expect(output.message).toContain('triggered');
    expect(output.connectionInfo.port).toBe(fixture.port);
    expect(output.connectionInfo.host).toBe(fixture.host);
  });

  it('returns resource state when verbose is true', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify({
        kind: 'UIResource',
        metadata: { name: 'api', labels: { team: 'platform' } },
        status: {
          conditions: [{ type: 'Ready', status: 'True' }],
          updateStatus: 'in_progress',
        },
      }),
    });
    fixtures.push(fixture);

    const result = await tiltTrigger.handler(
      { resourceName: 'api', verbose: true },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resourceState.name).toBe('api');
    expect(output.resourceState.status.updateStatus).toBe('in_progress');
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltTrigger.handler(
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
      stdout: 'triggered',
    });
    fixtures.push(fixture);

    const result = await tiltTrigger.handler(
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
