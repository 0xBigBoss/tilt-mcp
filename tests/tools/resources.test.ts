/**
 * Tests for tilt_get_resources tool
 * 
 * Tests resource listing with optional filtering
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { createTiltCliFixture, type TiltCliFixture } from '../fixtures/tilt-cli-fixture.js';
import { tiltGetResources } from '../../src/tools/resources.js';

describe('tilt_get_resources tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach(f => f.cleanup());
    fixtures.length = 0;
  });

  it('returns all resources when no filter provided', async () => {
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
        },
        {
          metadata: { name: 'db' },
          status: { runtimeStatus: 'pending' }
        }
      ]
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData)
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      { tiltPort: fixture.port, tiltHost: fixture.host },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const output = JSON.parse(result.content[0].text);
    expect(output).toHaveLength(3);
    expect(output[0].metadata.name).toBe('web-app');
    expect(output[1].metadata.name).toBe('api');
    expect(output[2].metadata.name).toBe('db');
  });

  it('filters resources by name using filter parameter', async () => {
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

    const result = await tiltGetResources.handler(
      { 
        tiltPort: fixture.port, 
        tiltHost: fixture.host,
        filter: 'web'
      },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output).toHaveLength(1);
    expect(output[0].metadata.name).toBe('web-app');
  });

  it('filters resources by runtime status', async () => {
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
        },
        {
          metadata: { name: 'worker' },
          status: { runtimeStatus: 'error' }
        }
      ]
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData)
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      { 
        tiltPort: fixture.port, 
        tiltHost: fixture.host,
        filter: 'error'
      },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output).toHaveLength(2);
    expect(output.every((r: any) => r.status.runtimeStatus === 'error')).toBe(true);
  });

  it('returns empty array when no resources match filter', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [
        {
          metadata: { name: 'web-app' },
          status: { runtimeStatus: 'ok' }
        }
      ]
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData)
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      { 
        tiltPort: fixture.port, 
        tiltHost: fixture.host,
        filter: 'nonexistent'
      },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output).toEqual([]);
  });

  it('returns empty array when Tilt has no resources', async () => {
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

    const result = await tiltGetResources.handler(
      { tiltPort: fixture.port, tiltHost: fixture.host },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output).toEqual([]);
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltGetResources.handler(
        { tiltPort: fixture.port, tiltHost: fixture.host },
        { tiltBinaryPath: fixture.tiltBinary }
      )
    ).rejects.toThrow(/No active Tilt session|connection refused/i);
  });
});
