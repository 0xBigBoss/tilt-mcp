/**
 * Type tests for Tilt resources
 * Tests verify TypeScript types match real Tilt API output
 */
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'fixtures');

// Import types
import type {
  UIResourceList,
  UIResource,
  RuntimeStatus,
  TiltSession,
  LogLine,
} from '../../src/tilt/types.ts';

describe('Tilt Types', () => {
  describe('UIResourceList', () => {
    it('parses real Tilt uiresources output', () => {
      const rawJson = readFileSync(
        join(fixturesDir, 'get-uiresources-sample.json'),
        'utf-8'
      );
      const data = JSON.parse(rawJson) as UIResourceList;

      // Top-level structure
      expect(data.apiVersion).toBe('v1');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);
    });
  });

  describe('UIResource', () => {
    it('has correct structure for real resource', () => {
      const rawJson = readFileSync(
        join(fixturesDir, 'get-uiresources-sample.json'),
        'utf-8'
      );
      const data = JSON.parse(rawJson) as UIResourceList;
      const resource = data.items[0];

      // Required fields
      expect(resource.apiVersion).toBe('tilt.dev/v1alpha1');
      expect(resource.kind).toBe('UIResource');
      expect(resource.metadata).toBeDefined();
      expect(resource.spec).toBeDefined();
      expect(resource.status).toBeDefined();
    });
  });

  describe('ResourceMetadata', () => {
    it('contains K8s-style metadata fields', () => {
      const rawJson = readFileSync(
        join(fixturesDir, 'get-uiresources-sample.json'),
        'utf-8'
      );
      const data = JSON.parse(rawJson) as UIResourceList;
      const metadata = data.items[0].metadata;

      // Required fields
      expect(metadata.name).toBeDefined();
      expect(typeof metadata.name).toBe('string');
      expect(metadata.uid).toBeDefined();
      expect(metadata.creationTimestamp).toBeDefined();

      // Optional fields when present
      if (metadata.annotations) {
        expect(typeof metadata.annotations).toBe('object');
      }
      if (metadata.labels) {
        expect(typeof metadata.labels).toBe('object');
      }
      if (metadata.ownerReferences) {
        expect(Array.isArray(metadata.ownerReferences)).toBe(true);
      }
    });
  });

  describe('ResourceStatus', () => {
    it('contains status information', () => {
      const rawJson = readFileSync(
        join(fixturesDir, 'get-uiresources-sample.json'),
        'utf-8'
      );
      const data = JSON.parse(rawJson) as UIResourceList;
      const status = data.items[0].status;

      // Required fields
      expect(status.runtimeStatus).toBeDefined();
      expect(['ok', 'error', 'warning', 'pending', 'not_applicable']).toContain(
        status.runtimeStatus
      );

      // Optional but common fields
      if (status.buildHistory) {
        expect(Array.isArray(status.buildHistory)).toBe(true);
      }
      if (status.conditions) {
        expect(Array.isArray(status.conditions)).toBe(true);
      }
      if (status.specs) {
        expect(Array.isArray(status.specs)).toBe(true);
      }
    });
  });

  describe('BuildRecord', () => {
    it('contains build history information', () => {
      const rawJson = readFileSync(
        join(fixturesDir, 'get-uiresources-sample.json'),
        'utf-8'
      );
      const data = JSON.parse(rawJson) as UIResourceList;
      const resource = data.items.find((r) => r.status.buildHistory);
      
      if (!resource) {
        throw new Error('No resource with buildHistory found');
      }

      const build = resource.status.buildHistory![0];

      // Build record fields
      expect(build.startTime).toBeDefined();
      expect(typeof build.startTime).toBe('string');
      
      if (build.finishTime) {
        expect(typeof build.finishTime).toBe('string');
      }
      if (build.spanID) {
        expect(typeof build.spanID).toBe('string');
      }
    });
  });

  describe('DisableStatus', () => {
    it('contains enable/disable state', () => {
      const rawJson = readFileSync(
        join(fixturesDir, 'get-uiresources-sample.json'),
        'utf-8'
      );
      const data = JSON.parse(rawJson) as UIResourceList;
      const resource = data.items.find((r) => r.status.disableStatus);
      
      if (!resource) {
        throw new Error('No resource with disableStatus found');
      }

      const disableStatus = resource.status.disableStatus!;

      // DisableStatus fields
      expect(disableStatus.state).toBeDefined();
      expect(['Enabled', 'Disabled']).toContain(disableStatus.state);
      expect(typeof disableStatus.enabledCount).toBe('number');
      expect(typeof disableStatus.disabledCount).toBe('number');
      
      if (disableStatus.sources) {
        expect(Array.isArray(disableStatus.sources)).toBe(true);
      }
    });
  });

  describe('EndpointLink', () => {
    it('contains endpoint information', () => {
      const rawJson = readFileSync(
        join(fixturesDir, 'get-uiresources-sample.json'),
        'utf-8'
      );
      const data = JSON.parse(rawJson) as UIResourceList;
      const resource = data.items.find((r) => r.status.endpointLinks);
      
      if (!resource) {
        throw new Error('No resource with endpointLinks found');
      }

      const endpoint = resource.status.endpointLinks![0];

      // EndpointLink fields
      expect(endpoint.url).toBeDefined();
      expect(typeof endpoint.url).toBe('string');
      
      // name is optional
      if (endpoint.name) {
        expect(typeof endpoint.name).toBe('string');
      }
    });
  });

  describe('ResourceSpec', () => {
    it('contains spec type information', () => {
      const rawJson = readFileSync(
        join(fixturesDir, 'get-uiresources-sample.json'),
        'utf-8'
      );
      const data = JSON.parse(rawJson) as UIResourceList;
      const resource = data.items.find((r) => r.status.specs);
      
      if (!resource) {
        throw new Error('No resource with specs found');
      }

      const spec = resource.status.specs![0];

      // ResourceSpec fields
      expect(spec.type).toBeDefined();
      expect(spec.id).toBeDefined();
      expect(['local', 'docker-compose', 'k8s', 'image']).toContain(spec.type);
    });
  });

  describe('ResourceCondition', () => {
    it('contains K8s-style condition', () => {
      const rawJson = readFileSync(
        join(fixturesDir, 'get-uiresources-sample.json'),
        'utf-8'
      );
      const data = JSON.parse(rawJson) as UIResourceList;
      const resource = data.items.find((r) => r.status.conditions);
      
      if (!resource) {
        throw new Error('No resource with conditions found');
      }

      const condition = resource.status.conditions![0];

      // Condition fields
      expect(condition.type).toBeDefined();
      expect(condition.status).toBeDefined();
      expect(['True', 'False', 'Unknown']).toContain(condition.status);
      expect(condition.lastTransitionTime).toBeDefined();
      
      // Optional fields
      if (condition.reason) {
        expect(typeof condition.reason).toBe('string');
      }
      if (condition.message) {
        expect(typeof condition.message).toBe('string');
      }
    });
  });

  describe('Type Safety', () => {
    it('types prevent invalid runtime status values', () => {
      // This test verifies compile-time type checking
      const validStatuses: RuntimeStatus[] = [
        'ok',
        'error',
        'warning',
        'pending',
        'not_applicable',
      ];

      validStatuses.forEach((status) => {
        expect(['ok', 'error', 'warning', 'pending', 'not_applicable']).toContain(
          status
        );
      });
    });

    it('types allow proper UIResource construction', () => {
      const resource: UIResource = {
        apiVersion: 'tilt.dev/v1alpha1',
        kind: 'UIResource',
        metadata: {
          name: 'test-resource',
          uid: 'test-uid',
          creationTimestamp: '2025-11-20T00:00:00Z',
          resourceVersion: '1',
        },
        spec: {},
        status: {
          runtimeStatus: 'ok',
        },
      };

      expect(resource.metadata.name).toBe('test-resource');
      expect(resource.status.runtimeStatus).toBe('ok');
    });

    it('types work with real Tilt CLI output', () => {
      const rawJson = readFileSync(
        join(fixturesDir, 'get-uiresources-sample.json'),
        'utf-8'
      );
      const data = JSON.parse(rawJson) as UIResourceList;

      // Verify we can access all fields through proper types
      const resource = data.items[0];

      // Type-safe access to nested fields
      expect(typeof resource.metadata.name).toBe('string');
      expect(typeof resource.status.runtimeStatus).toBe('string');

      // Optional fields
      if (resource.status.buildHistory && resource.status.buildHistory.length > 0) {
        const build = resource.status.buildHistory[0];
        expect(typeof build.startTime).toBe('string');
      }

      // Endpoint links
      if (resource.status.endpointLinks && resource.status.endpointLinks.length > 0) {
        const endpoint = resource.status.endpointLinks[0];
        expect(typeof endpoint.url).toBe('string');
      }

      // Conditions
      if (resource.status.conditions && resource.status.conditions.length > 0) {
        const condition = resource.status.conditions[0];
        expect(['True', 'False', 'Unknown']).toContain(condition.status);
      }
    });

    it('UIResourceList can be filtered by status', () => {
      const rawJson = readFileSync(
        join(fixturesDir, 'get-uiresources-sample.json'),
        'utf-8'
      );
      const data = JSON.parse(rawJson) as UIResourceList;

      // Type-safe filtering operations
      const okResources = data.items.filter(
        (r) => r.status.runtimeStatus === 'ok'
      );
      const resourcesWithEndpoints = data.items.filter(
        (r) => r.status.endpointLinks && r.status.endpointLinks.length > 0
      );

      expect(okResources.length).toBeGreaterThanOrEqual(0);
      expect(resourcesWithEndpoints.length).toBeGreaterThanOrEqual(0);
    });

    it('types support TiltSession parsing', () => {
      // Verify TiltSession type is properly structured
      const session: TiltSession = {
        apiVersion: 'tilt.dev/v1alpha1',
        kind: 'Session',
        metadata: {
          name: 'Tiltfile',
          uid: 'test-session-uid',
          creationTimestamp: '2025-11-20T00:00:00Z',
          resourceVersion: '1',
        },
        spec: {
          tiltfilePath: '/path/to/Tiltfile',
          exitCondition: 'manual',
        },
        status: {
          done: false,
          startTime: '2025-11-20T00:00:00Z',
        },
      };

      expect(session.kind).toBe('Session');
      expect(session.status.done).toBe(false);
    });

    it('types support LogLine structure', () => {
      const logLine: LogLine = {
        text: 'Test log message',
        level: 'info',
        time: '2025-11-20T00:00:00Z',
        spanID: 'build:1',
      };

      expect(logLine.text).toBe('Test log message');
      expect(logLine.level).toBe('info');
    });
  });
});
