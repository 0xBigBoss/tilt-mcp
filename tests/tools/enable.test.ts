/**
 * Tests for tilt_enable tool
 *
 * Tests enabling resources in Tilt
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { tiltEnable } from '../../src/tools/enable.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_enable tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('enables a resource successfully', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'enabled',
    });
    fixtures.push(fixture);

    const result = await tiltEnable.handler(
      {
        resourceName: 'web-app',
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
    expect(output.resourceName).toBe('web-app');
    expect(output.message).toContain('enabled');
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltEnable.handler(
        {
          resourceName: 'web-app',
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
      stdout: 'enabled',
    });
    fixtures.push(fixture);

    const result = await tiltEnable.handler(
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
