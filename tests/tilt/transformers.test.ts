/**
 * Tests for Tilt response transformer utilities
 */
import { describe, expect, it } from 'bun:test';
import {
  cleanResource,
  dedupeEndpoints,
  deriveStatus,
  extractError,
  extractPrimaryEndpoint,
  stripAnsiCodes,
  toSlimResource,
} from '../../src/tilt/transformers';
import type { EndpointLink, UIResource } from '../../src/tilt/types';

// ============================================================================
// Test Fixtures
// ============================================================================

function createBaseResource(overrides: Partial<UIResource> = {}): UIResource {
  return {
    apiVersion: 'tilt.dev/v1alpha1',
    kind: 'UIResource',
    metadata: {
      name: 'test-resource',
      uid: 'test-uid',
      creationTimestamp: '2024-01-01T00:00:00Z',
      resourceVersion: '1',
      labels: {},
    },
    spec: {},
    status: {
      runtimeStatus: 'ok',
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
    },
    ...overrides,
  };
}

function createResourceWithStatus(
  statusOverrides: Partial<UIResource['status']>,
  metadataOverrides: Partial<UIResource['metadata']> = {},
): UIResource {
  return createBaseResource({
    metadata: {
      name: 'test-resource',
      uid: 'test-uid',
      creationTimestamp: '2024-01-01T00:00:00Z',
      resourceVersion: '1',
      labels: {},
      ...metadataOverrides,
    },
    status: {
      runtimeStatus: 'ok',
      ...statusOverrides,
    },
  });
}

// ============================================================================
// stripAnsiCodes tests
// ============================================================================

describe('stripAnsiCodes', () => {
  it('strips ANSI color codes from text', () => {
    const input = '\x1b[31mError:\x1b[0m Something went wrong';
    const result = stripAnsiCodes(input);
    expect(result).toBe('Error: Something went wrong');
  });

  it('preserves plain text without ANSI codes', () => {
    const input = 'Plain text without any ANSI codes';
    const result = stripAnsiCodes(input);
    expect(result).toBe(input);
  });

  it('handles empty string', () => {
    expect(stripAnsiCodes('')).toBe('');
  });

  it('strips multiple ANSI codes', () => {
    const input =
      '\x1b[32m[INFO]\x1b[0m \x1b[1mBold\x1b[0m \x1b[4mUnderline\x1b[0m';
    const result = stripAnsiCodes(input);
    expect(result).toBe('[INFO] Bold Underline');
  });
});

// ============================================================================
// deriveStatus tests
// ============================================================================

describe('deriveStatus', () => {
  it('returns ok when Ready and UpToDate conditions are True', () => {
    const resource = createResourceWithStatus({
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
    });
    expect(deriveStatus(resource)).toBe('ok');
  });

  it('returns disabled when disableStatus state is Disabled', () => {
    const resource = createResourceWithStatus({
      disableStatus: { state: 'Disabled', enabledCount: 0, disabledCount: 1 },
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
    });
    expect(deriveStatus(resource)).toBe('disabled');
  });

  it('returns error when Ready condition has UpdateError reason', () => {
    const resource = createResourceWithStatus({
      conditions: [
        {
          type: 'Ready',
          status: 'False',
          reason: 'UpdateError',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
        {
          type: 'UpToDate',
          status: 'False',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(deriveStatus(resource)).toBe('error');
  });

  it('returns error when UpToDate condition has UpdateError reason', () => {
    const resource = createResourceWithStatus({
      conditions: [
        {
          type: 'Ready',
          status: 'False',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
        {
          type: 'UpToDate',
          status: 'False',
          reason: 'UpdateError',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(deriveStatus(resource)).toBe('error');
  });

  it('returns error when runtimeStatus is error', () => {
    const resource = createResourceWithStatus({
      runtimeStatus: 'error',
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
    });
    expect(deriveStatus(resource)).toBe('error');
  });

  it('returns building when updateStatus is in_progress', () => {
    const resource = createResourceWithStatus({
      updateStatus: 'in_progress',
      conditions: [
        {
          type: 'Ready',
          status: 'False',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
        {
          type: 'UpToDate',
          status: 'False',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(deriveStatus(resource)).toBe('building');
  });

  it('returns pending when updateStatus is pending', () => {
    const resource = createResourceWithStatus({
      updateStatus: 'pending',
      conditions: [
        {
          type: 'Ready',
          status: 'False',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
        {
          type: 'UpToDate',
          status: 'False',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(deriveStatus(resource)).toBe('pending');
  });

  it('returns pending when hasPendingChanges is true', () => {
    const resource = createResourceWithStatus({
      hasPendingChanges: true,
      conditions: [
        {
          type: 'Ready',
          status: 'False',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
        {
          type: 'UpToDate',
          status: 'False',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(deriveStatus(resource)).toBe('pending');
  });

  it('returns pending when conditions are missing', () => {
    const resource = createResourceWithStatus({
      conditions: [],
    });
    expect(deriveStatus(resource)).toBe('pending');
  });
});

// ============================================================================
// dedupeEndpoints tests
// ============================================================================

describe('dedupeEndpoints', () => {
  it('returns empty array for undefined input', () => {
    expect(dedupeEndpoints(undefined)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(dedupeEndpoints([])).toEqual([]);
  });

  it('returns unique endpoints', () => {
    const links: EndpointLink[] = [
      { url: 'http://localhost:3000' },
      { url: 'http://localhost:3001' },
    ];
    const result = dedupeEndpoints(links);
    expect(result).toHaveLength(2);
  });

  it('removes duplicate URLs', () => {
    const links: EndpointLink[] = [
      { url: 'http://localhost:3000' },
      { url: 'http://localhost:3000' },
    ];
    const result = dedupeEndpoints(links);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('http://localhost:3000');
  });

  it('prefers named endpoints over unnamed duplicates', () => {
    const links: EndpointLink[] = [
      { url: 'http://localhost:3000' },
      { url: 'http://localhost:3000', name: 'web-ui' },
    ];
    const result = dedupeEndpoints(links);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('web-ui');
  });

  it('normalizes trailing slashes when deduping', () => {
    const links: EndpointLink[] = [
      { url: 'http://localhost:3000/' },
      { url: 'http://localhost:3000' },
    ];
    const result = dedupeEndpoints(links);
    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// extractPrimaryEndpoint tests
// ============================================================================

describe('extractPrimaryEndpoint', () => {
  it('returns undefined when no endpoint links', () => {
    const resource = createResourceWithStatus({ endpointLinks: undefined });
    expect(extractPrimaryEndpoint(resource)).toBeUndefined();
  });

  it('returns undefined when endpoint links is empty', () => {
    const resource = createResourceWithStatus({ endpointLinks: [] });
    expect(extractPrimaryEndpoint(resource)).toBeUndefined();
  });

  it('returns first endpoint when no named endpoint', () => {
    const resource = createResourceWithStatus({
      endpointLinks: [
        { url: 'http://localhost:3000' },
        { url: 'http://localhost:3001' },
      ],
    });
    expect(extractPrimaryEndpoint(resource)).toBe('http://localhost:3000');
  });

  it('returns named endpoint over unnamed', () => {
    const resource = createResourceWithStatus({
      endpointLinks: [
        { url: 'http://localhost:3000' },
        { url: 'http://localhost:3001', name: 'api' },
      ],
    });
    expect(extractPrimaryEndpoint(resource)).toBe('http://localhost:3001');
  });
});

// ============================================================================
// extractError tests
// ============================================================================

describe('extractError', () => {
  it('returns undefined when no error', () => {
    const resource = createResourceWithStatus({
      conditions: [
        {
          type: 'Ready',
          status: 'True',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(extractError(resource)).toBeUndefined();
  });

  it('extracts error from condition with UpdateError reason', () => {
    const resource = createResourceWithStatus({
      conditions: [
        {
          type: 'Ready',
          status: 'False',
          reason: 'UpdateError',
          message: 'Build failed: exit code 1',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
    });
    expect(extractError(resource)).toBe('Build failed: exit code 1');
  });

  it('extracts error from build history', () => {
    const resource = createResourceWithStatus({
      conditions: [],
      buildHistory: [
        {
          startTime: '2024-01-01T00:00:00Z',
          finishTime: '2024-01-01T00:01:00Z',
          error: 'Compilation error in main.go',
        },
      ],
    });
    expect(extractError(resource)).toBe('Compilation error in main.go');
  });

  it('prefers condition error over build history error', () => {
    const resource = createResourceWithStatus({
      conditions: [
        {
          type: 'UpToDate',
          status: 'False',
          reason: 'UpdateError',
          message: 'Condition error',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
      buildHistory: [
        {
          startTime: '2024-01-01T00:00:00Z',
          error: 'Build history error',
        },
      ],
    });
    expect(extractError(resource)).toBe('Condition error');
  });
});

// ============================================================================
// toSlimResource tests
// ============================================================================

describe('toSlimResource', () => {
  it('produces correct slim format for ok resource', () => {
    const resource = createResourceWithStatus(
      {
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
        specs: [{ id: 'test', type: 'local' }],
        endpointLinks: [{ url: 'http://localhost:3000', name: 'web' }],
        lastDeployTime: '2024-01-01T00:05:00Z',
        runtimeStatus: 'ok',
      },
      { name: 'my-service', labels: { 'tilt.dev/resource': 'true' } },
    );

    const slim = toSlimResource(resource);

    expect(slim.name).toBe('my-service');
    expect(slim.type).toBe('local');
    expect(slim.status).toBe('ok');
    expect(slim.ready).toBe(true);
    expect(slim.upToDate).toBe(true);
    expect(slim.hasPendingChanges).toBe(false);
    expect(slim.endpoint).toBe('http://localhost:3000');
    expect(slim.labels).toContain('tilt.dev/resource');
    expect(slim.lastError).toBeUndefined();
    expect(slim.lastDeployTime).toBe('2024-01-01T00:05:00Z');
    expect(slim.runtimeStatus).toBe('ok');
  });

  it('includes lastError for error status', () => {
    const resource = createResourceWithStatus({
      conditions: [
        {
          type: 'Ready',
          status: 'False',
          reason: 'UpdateError',
          message: 'Build failed',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
    });

    const slim = toSlimResource(resource);

    expect(slim.status).toBe('error');
    expect(slim.lastError).toBe('Build failed');
  });

  it('returns unknown type when specs are missing', () => {
    const resource = createResourceWithStatus({
      specs: undefined,
    });

    const slim = toSlimResource(resource);
    expect(slim.type).toBe('unknown');
  });

  it('handles resource with pending changes', () => {
    const resource = createResourceWithStatus({
      hasPendingChanges: true,
      conditions: [
        {
          type: 'Ready',
          status: 'True',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
        {
          type: 'UpToDate',
          status: 'False',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
    });

    const slim = toSlimResource(resource);
    expect(slim.hasPendingChanges).toBe(true);
    expect(slim.status).toBe('pending');
  });
});

// ============================================================================
// cleanResource tests
// ============================================================================

describe('cleanResource', () => {
  it('removes K8s boilerplate but keeps essential fields', () => {
    const resource = createBaseResource();
    const cleaned = cleanResource(resource);

    expect(cleaned.name).toBe('test-resource');
    expect(cleaned.labels).toEqual({});
    expect(cleaned).not.toHaveProperty('apiVersion');
    expect(cleaned).not.toHaveProperty('kind');
    expect(cleaned).not.toHaveProperty('metadata');
  });

  it('preserves labels', () => {
    const resource = createResourceWithStatus(
      {},
      { labels: { app: 'web', env: 'dev' } },
    );
    const cleaned = cleanResource(resource);

    expect(cleaned.labels).toEqual({ app: 'web', env: 'dev' });
  });

  it('dedupes endpoint links in status', () => {
    const resource = createResourceWithStatus({
      endpointLinks: [
        { url: 'http://localhost:3000' },
        { url: 'http://localhost:3000', name: 'web' },
      ],
    });

    const cleaned = cleanResource(resource);
    const status = cleaned.status as Record<string, unknown>;
    const endpoints = status.endpointLinks as EndpointLink[];

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].name).toBe('web');
  });

  it('truncates build history to last 2 entries', () => {
    const resource = createResourceWithStatus({
      buildHistory: [
        { startTime: '2024-01-01T00:00:00Z' },
        { startTime: '2024-01-01T00:01:00Z' },
        { startTime: '2024-01-01T00:02:00Z' },
        { startTime: '2024-01-01T00:03:00Z' },
        { startTime: '2024-01-01T00:04:00Z' },
      ],
    });

    const cleaned = cleanResource(resource);
    const status = cleaned.status as Record<string, unknown>;
    const buildHistory = status.buildHistory as Array<unknown>;

    expect(buildHistory).toHaveLength(2);
  });

  it('preserves full status when nothing to clean', () => {
    const resource = createResourceWithStatus({
      runtimeStatus: 'ok',
      conditions: [
        {
          type: 'Ready',
          status: 'True',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
    });

    const cleaned = cleanResource(resource);
    expect(cleaned.status).toBeDefined();
  });
});
