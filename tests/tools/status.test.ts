/**
 * Tests for tilt_status tool
 * 
 * Tests overall Tilt session status
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { createTiltCliFixture, type TiltCliFixture } from '../fixtures/tilt-cli-fixture.js';
import { tiltStatus } from '../../src/tools/status.js';

describe('tilt_status tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach(f => f.cleanup());
    fixtures.length = 0;
  });

  it('returns session status with resource list', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [
        {
          metadata: { name: 'web-app' },
          status: { runtimeStatus: 'ok' }
        },
        {
          metadata: { name: 'api' },
          status: { runtimeStatus: 'error' }
        }
      ]
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData)
    });
    fixtures.push(fixture);

    const result = await tiltStatus.handler(
      { tiltPort: fixture.port, tiltHost: fixture.host },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const output = JSON.parse(result.content[0].text);
    expect(output.sessionActive).toBe(true);
    expect(output.resourceCount).toBe(2);
    expect(output.resources).toHaveLength(2);
    expect(output.resources[0].metadata.name).toBe('web-app');
    expect(output.connectionInfo.port).toBe(fixture.port);
    expect(output.connectionInfo.host).toBe(fixture.host);
  });

  it('returns empty resource list when no resources exist', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: []
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData)
    });
    fixtures.push(fixture);

    const result = await tiltStatus.handler(
      { tiltPort: fixture.port, tiltHost: fixture.host },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.sessionActive).toBe(true);
    expect(output.resourceCount).toBe(0);
    expect(output.resources).toEqual([]);
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltStatus.handler(
        { tiltPort: fixture.port, tiltHost: fixture.host },
        { tiltBinaryPath: fixture.tiltBinary }
      )
    ).rejects.toThrow(/No active Tilt session|connection refused/i);
  });

  it('uses default port and host when not provided', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: []
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData)
    });
    fixtures.push(fixture);

    const result = await tiltStatus.handler(
      {},
      { 
        tiltBinaryPath: fixture.tiltBinary,
        // Override default with fixture values via env
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.sessionActive).toBe(true);
  });
});
