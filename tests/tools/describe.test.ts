/**
 * Tests for tilt_describe_resource tool
 * 
 * Tests detailed resource information retrieval
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { createTiltCliFixture, type TiltCliFixture } from '../fixtures/tilt-cli-fixture.js';
import { tiltDescribeResource } from '../../src/tools/describe.js';

describe('tilt_describe_resource tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach(f => f.cleanup());
    fixtures.length = 0;
  });

  it('returns detailed resource information', async () => {
    const resourceDetail = {
      kind: 'UIResource',
      apiVersion: 'tilt.dev/v1alpha1',
      metadata: {
        name: 'web-app',
        uid: 'abc-123',
        creationTimestamp: '2024-01-01T00:00:00Z'
      },
      status: {
        runtimeStatus: 'ok',
        buildHistory: [
          { startTime: '2024-01-01T00:01:00Z', finishTime: '2024-01-01T00:01:30Z' }
        ],
        k8sResourceInfo: {
          podName: 'web-app-pod',
          podStatus: 'Running'
        }
      },
      spec: {
        updateMode: 'auto'
      }
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourceDetail)
    });
    fixtures.push(fixture);

    const result = await tiltDescribeResource.handler(
      { resourceName: 'web-app', tiltPort: fixture.port, tiltHost: fixture.host },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const output = JSON.parse(result.content[0].text);
    expect(output.resource.kind).toBe('UIResource');
    expect(output.resource.metadata.name).toBe('web-app');
    expect(output.resource.status.runtimeStatus).toBe('ok');
    expect(output.resource.status.buildHistory).toHaveLength(1);
    expect(output.connectionInfo.port).toBe(fixture.port);
    expect(output.connectionInfo.host).toBe(fixture.host);
  });

  it('handles resource with minimal status', async () => {
    const resourceDetail = {
      kind: 'UIResource',
      apiVersion: 'tilt.dev/v1alpha1',
      metadata: {
        name: 'minimal-resource'
      }
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourceDetail)
    });
    fixtures.push(fixture);

    const result = await tiltDescribeResource.handler(
      { resourceName: 'minimal-resource', tiltPort: fixture.port, tiltHost: fixture.host },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resource.metadata.name).toBe('minimal-resource');
    expect(output.resource.status).toBeUndefined();
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltDescribeResource.handler(
        { resourceName: 'web-app', tiltPort: fixture.port, tiltHost: fixture.host },
        { tiltBinaryPath: fixture.tiltBinary }
      )
    ).rejects.toThrow(/No active Tilt session|connection refused/i);
  });

  it('uses default port and host when not provided', async () => {
    const resourceDetail = {
      kind: 'UIResource',
      metadata: { name: 'test' }
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourceDetail)
    });
    fixtures.push(fixture);

    const result = await tiltDescribeResource.handler(
      { resourceName: 'test' },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resource.metadata.name).toBe('test');
  });
});
