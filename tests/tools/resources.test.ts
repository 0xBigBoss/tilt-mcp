/**
 * Tests for tilt_get_resources tool
 *
 * Tests resource listing with optional filtering
 */

import { afterEach, describe, expect, it } from 'bun:test';
import type { SlimResource } from '../../src/tilt/transformers.js';
import { tiltGetResources } from '../../src/tools/resources.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_get_resources tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('returns all resources when no filter provided', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [
        {
          metadata: { name: 'web-app' },
          status: { runtimeStatus: 'ok' },
        },
        {
          metadata: { name: 'api' },
          status: { runtimeStatus: 'error' },
        },
        {
          metadata: { name: 'db' },
          status: { runtimeStatus: 'pending' },
        },
      ],
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      { verbose: true },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const output = JSON.parse(result.content[0].text);
    expect(output.resources).toHaveLength(3);
    expect(output.resources[0].metadata.name).toBe('web-app');
    expect(output.resources[1].metadata.name).toBe('api');
    expect(output.resources[2].metadata.name).toBe('db');
    expect(output.pagination.total).toBe(3);
    expect(output.pagination.hasMore).toBe(false);
  });

  it('filters resources by name using filter parameter', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [
        {
          metadata: { name: 'web-app' },
          status: { runtimeStatus: 'ok' },
        },
        {
          metadata: { name: 'api' },
          status: { runtimeStatus: 'error' },
        },
      ],
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      {
        filter: 'web',
        verbose: true,
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resources).toHaveLength(1);
    expect(output.resources[0].metadata.name).toBe('web-app');
    expect(output.pagination.total).toBe(1);
  });

  it('filters resources by runtime status using text filter', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [
        {
          metadata: { name: 'web-app' },
          status: { runtimeStatus: 'ok' },
        },
        {
          metadata: { name: 'api' },
          status: { runtimeStatus: 'error' },
        },
        {
          metadata: { name: 'worker' },
          status: { runtimeStatus: 'error' },
        },
      ],
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      {
        filter: 'api',
        verbose: true,
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resources).toHaveLength(1);
    expect(output.resources[0].metadata.name).toBe('api');
  });

  it('returns empty array when no resources match filter', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [
        {
          metadata: { name: 'web-app' },
          status: { runtimeStatus: 'ok' },
        },
      ],
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      {
        filter: 'nonexistent',
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resources).toEqual([]);
    expect(output.pagination.total).toBe(0);
    expect(output.pagination.hasMore).toBe(false);
  });

  it('returns empty array when Tilt has no resources', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [],
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      {},
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resources).toEqual([]);
    expect(output.pagination.total).toBe(0);
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltGetResources.handler(
        {},
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      ),
    ).rejects.toThrow(/No active Tilt session|connection refused/i);
  });

  it('returns slim resources by default (verbose=false)', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [
        {
          apiVersion: 'tilt.dev/v1alpha1',
          kind: 'UIResource',
          metadata: {
            name: 'web-app',
            uid: 'test-uid',
            creationTimestamp: '2024-01-01T00:00:00Z',
            resourceVersion: '1',
            labels: { app: 'web' },
          },
          spec: {},
          status: {
            runtimeStatus: 'ok',
            updateStatus: 'ok',
            conditions: [
              {
                type: 'Ready',
                status: 'True',
                lastTransitionTime: '2024-01-01T00:00:00Z',
              },
              {
                type: 'UpToDate',
                status: 'True',
                lastTransitionTime: '2024-01-01T00:00:00Z',
              },
            ],
            endpointLinks: [{ url: 'http://localhost:3001' }],
            specs: [{ id: 'web-app', type: 'local' }],
            hasPendingChanges: false,
          },
        },
      ],
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      {},
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resources).toHaveLength(1);

    // Should be slim format
    const resource = output.resources[0] as SlimResource;
    expect(resource.name).toBe('web-app');
    expect(resource.type).toBe('local');
    expect(resource.status).toBe('ok');
    expect(resource.ready).toBe(true);
    expect(resource.upToDate).toBe(true);
    expect(resource.hasPendingChanges).toBe(false);
    expect(resource.endpoint).toBe('http://localhost:3001');
    expect(resource.labels).toEqual(['app']);
    expect(resource.runtimeStatus).toBe('ok');

    // Should NOT have full K8s metadata
    expect((resource as Record<string, unknown>).metadata).toBeUndefined();
    expect((resource as Record<string, unknown>).apiVersion).toBeUndefined();
    expect((resource as Record<string, unknown>).kind).toBeUndefined();
    expect((resource as Record<string, unknown>).spec).toBeUndefined();

    // Should have pagination
    expect(output.pagination.total).toBe(1);
    expect(output.pagination.limit).toBe(20);
    expect(output.pagination.offset).toBe(0);
    expect(output.pagination.hasMore).toBe(false);
  });

  it('returns full verbose resources when verbose=true', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [
        {
          apiVersion: 'tilt.dev/v1alpha1',
          kind: 'UIResource',
          metadata: {
            name: 'web-app',
            uid: 'test-uid',
            creationTimestamp: '2024-01-01T00:00:00Z',
            resourceVersion: '1',
            labels: { app: 'web' },
          },
          spec: {},
          status: {
            runtimeStatus: 'ok',
            updateStatus: 'ok',
            conditions: [
              {
                type: 'Ready',
                status: 'True',
                lastTransitionTime: '2024-01-01T00:00:00Z',
              },
              {
                type: 'UpToDate',
                status: 'True',
                lastTransitionTime: '2024-01-01T00:00:00Z',
              },
            ],
            endpointLinks: [{ url: 'http://localhost:3001' }],
            specs: [{ id: 'web-app', type: 'local' }],
            hasPendingChanges: false,
          },
        },
      ],
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      { verbose: true },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resources).toHaveLength(1);

    // Should be full K8s format
    const resource = output.resources[0];
    expect(resource.metadata.name).toBe('web-app');
    expect(resource.metadata.uid).toBe('test-uid');
    expect(resource.apiVersion).toBe('tilt.dev/v1alpha1');
    expect(resource.kind).toBe('UIResource');
    expect(resource.status.runtimeStatus).toBe('ok');
    expect(resource.status.conditions).toHaveLength(2);
  });

  it('filters resources by computed status', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [
        {
          apiVersion: 'tilt.dev/v1alpha1',
          kind: 'UIResource',
          metadata: { name: 'ok-resource' },
          status: {
            runtimeStatus: 'ok',
            conditions: [
              { type: 'Ready', status: 'True' },
              { type: 'UpToDate', status: 'True' },
            ],
          },
        },
        {
          apiVersion: 'tilt.dev/v1alpha1',
          kind: 'UIResource',
          metadata: { name: 'error-resource' },
          status: {
            runtimeStatus: 'error',
            conditions: [
              { type: 'Ready', status: 'False', reason: 'UpdateError' },
            ],
          },
        },
        {
          apiVersion: 'tilt.dev/v1alpha1',
          kind: 'UIResource',
          metadata: { name: 'another-ok' },
          status: {
            runtimeStatus: 'ok',
            conditions: [
              { type: 'Ready', status: 'True' },
              { type: 'UpToDate', status: 'True' },
            ],
          },
        },
      ],
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      { status: 'error' },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resources).toHaveLength(1);
    expect(output.resources[0].name).toBe('error-resource');
    expect(output.pagination.total).toBe(1);
  });

  it('returns all resources when status is all', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [
        {
          apiVersion: 'tilt.dev/v1alpha1',
          kind: 'UIResource',
          metadata: { name: 'ok-resource' },
          status: {
            runtimeStatus: 'ok',
            conditions: [
              { type: 'Ready', status: 'True' },
              { type: 'UpToDate', status: 'True' },
            ],
          },
        },
        {
          apiVersion: 'tilt.dev/v1alpha1',
          kind: 'UIResource',
          metadata: { name: 'error-resource' },
          status: { runtimeStatus: 'error' },
        },
      ],
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      { status: 'all' },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resources).toHaveLength(2);
    expect(output.pagination.total).toBe(2);
  });

  it('paginates results with limit and offset', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResource',
      metadata: { name: `resource-${i}` },
      status: {
        runtimeStatus: 'ok',
        conditions: [
          { type: 'Ready', status: 'True' },
          { type: 'UpToDate', status: 'True' },
        ],
      },
    }));

    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items,
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    const result = await tiltGetResources.handler(
      { limit: 2, offset: 1 },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resources).toHaveLength(2);
    expect(output.resources[0].name).toBe('resource-1');
    expect(output.resources[1].name).toBe('resource-2');
    expect(output.pagination.total).toBe(5);
    expect(output.pagination.limit).toBe(2);
    expect(output.pagination.offset).toBe(1);
    expect(output.pagination.hasMore).toBe(true);
  });

  it('includes pagination metadata in response', async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResource',
      metadata: { name: `resource-${i}` },
      status: {
        runtimeStatus: 'ok',
        conditions: [
          { type: 'Ready', status: 'True' },
          { type: 'UpToDate', status: 'True' },
        ],
      },
    }));

    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items,
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    // Default pagination (limit=20, offset=0)
    const result = await tiltGetResources.handler(
      {},
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resources).toHaveLength(20);
    expect(output.pagination).toEqual({
      total: 25,
      limit: 20,
      offset: 0,
      hasMore: true,
    });
  });
});
