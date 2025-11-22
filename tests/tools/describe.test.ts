/**
 * Tests for tilt_describe_resource tool
 *
 * Tests detailed resource information retrieval with cleaned output format.
 * Output removes K8s boilerplate (apiVersion, kind, uid, ownerReferences, resourceVersion)
 * while preserving useful structure.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { tiltDescribeResource } from '../../src/tools/describe.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_describe_resource tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('returns cleaned resource without K8s boilerplate', async () => {
    const resourceDetail = {
      kind: 'UIResource',
      apiVersion: 'tilt.dev/v1alpha1',
      metadata: {
        name: 'web-app',
        uid: 'abc-123',
        resourceVersion: '12345',
        ownerReferences: [{ kind: 'Tiltfile', name: 'main' }],
        creationTimestamp: '2024-01-01T00:00:00Z',
        labels: { app: 'web-app', tier: 'frontend' },
      },
      status: {
        runtimeStatus: 'ok',
        buildHistory: [
          {
            startTime: '2024-01-01T00:01:00Z',
            finishTime: '2024-01-01T00:01:30Z',
          },
        ],
        k8sResourceInfo: {
          podName: 'web-app-pod',
          podStatus: 'Running',
        },
      },
      spec: {
        updateMode: 'auto',
      },
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourceDetail),
    });
    fixtures.push(fixture);

    const result = await tiltDescribeResource.handler(
      {
        resourceName: 'web-app',
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

    // Cleaned format: no kind, apiVersion, metadata wrapper
    expect(output.kind).toBeUndefined();
    expect(output.apiVersion).toBeUndefined();
    expect(output.metadata).toBeUndefined();

    // Direct fields from cleanResource
    expect(output.name).toBe('web-app');
    expect(output.labels).toEqual({ app: 'web-app', tier: 'frontend' });
    expect(output.status.runtimeStatus).toBe('ok');
    expect(output.status.buildHistory).toHaveLength(1);

    // Connection info preserved
    expect(output.connectionInfo.port).toBe(fixture.port);
    expect(output.connectionInfo.host).toBe(fixture.host);
  });

  it('truncates buildHistory to last 2 entries', async () => {
    const resourceDetail = {
      kind: 'UIResource',
      apiVersion: 'tilt.dev/v1alpha1',
      metadata: {
        name: 'build-heavy',
        labels: {},
      },
      status: {
        runtimeStatus: 'ok',
        buildHistory: [
          {
            startTime: '2024-01-01T00:01:00Z',
            finishTime: '2024-01-01T00:01:30Z',
          },
          {
            startTime: '2024-01-01T00:02:00Z',
            finishTime: '2024-01-01T00:02:30Z',
          },
          {
            startTime: '2024-01-01T00:03:00Z',
            finishTime: '2024-01-01T00:03:30Z',
          },
          {
            startTime: '2024-01-01T00:04:00Z',
            finishTime: '2024-01-01T00:04:30Z',
          },
        ],
      },
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourceDetail),
    });
    fixtures.push(fixture);

    const result = await tiltDescribeResource.handler(
      {
        resourceName: 'build-heavy',
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.status.buildHistory).toHaveLength(2);
    // Should keep the last 2 (most recent)
    expect(output.status.buildHistory[0].startTime).toBe(
      '2024-01-01T00:03:00Z',
    );
    expect(output.status.buildHistory[1].startTime).toBe(
      '2024-01-01T00:04:00Z',
    );
  });

  it('deduplicates endpoint links', async () => {
    const resourceDetail = {
      kind: 'UIResource',
      apiVersion: 'tilt.dev/v1alpha1',
      metadata: {
        name: 'api-gateway',
        labels: {},
      },
      status: {
        runtimeStatus: 'ok',
        endpointLinks: [
          { url: 'http://localhost:8080' },
          { url: 'http://localhost:8080/', name: 'API Gateway' },
          { url: 'http://localhost:8080' },
        ],
      },
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourceDetail),
    });
    fixtures.push(fixture);

    const result = await tiltDescribeResource.handler(
      {
        resourceName: 'api-gateway',
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    // Should dedupe to 1, preferring the named endpoint
    expect(output.status.endpointLinks).toHaveLength(1);
    expect(output.status.endpointLinks[0].name).toBe('API Gateway');
  });

  it('handles resource with minimal status', async () => {
    const resourceDetail = {
      kind: 'UIResource',
      apiVersion: 'tilt.dev/v1alpha1',
      metadata: {
        name: 'minimal-resource',
      },
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourceDetail),
    });
    fixtures.push(fixture);

    const result = await tiltDescribeResource.handler(
      {
        resourceName: 'minimal-resource',
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.name).toBe('minimal-resource');
    expect(output.labels).toEqual({});
    expect(output.status).toBeUndefined();
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltDescribeResource.handler(
        {
          resourceName: 'web-app',
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      ),
    ).rejects.toThrow(/No active Tilt session|connection refused/i);
  });

  it('uses default port and host when not provided', async () => {
    const resourceDetail = {
      kind: 'UIResource',
      metadata: { name: 'test', labels: { env: 'dev' } },
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourceDetail),
    });
    fixtures.push(fixture);

    const result = await tiltDescribeResource.handler(
      { resourceName: 'test' },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.name).toBe('test');
    expect(output.labels).toEqual({ env: 'dev' });
  });
});
