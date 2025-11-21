/**
 * Tests for tilt_status tool
 *
 * Tests overall Tilt session status
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { tiltStatus } from '../../src/tools/status.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_status tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('returns session status with summary counts', async () => {
    const resourcesData = {
      apiVersion: 'tilt.dev/v1alpha1',
      kind: 'UIResourceList',
      items: [
        {
          metadata: { name: 'web-app' },
          status: {
            runtimeStatus: 'ok',
            conditions: [
              { type: 'Ready', status: 'True' },
              { type: 'UpToDate', status: 'True' },
            ],
          },
        },
        {
          metadata: { name: 'api' },
          status: {
            runtimeStatus: 'error',
            conditions: [
              {
                type: 'Ready',
                status: 'False',
                reason: 'UpdateError',
                message: 'Build failed',
              },
            ],
          },
        },
        {
          metadata: { name: 'worker' },
          status: {
            runtimeStatus: 'pending',
            updateStatus: 'pending',
          },
        },
      ],
    };

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify(resourcesData),
    });
    fixtures.push(fixture);

    const result = await tiltStatus.handler(
      { tiltPort: fixture.port, tiltHost: fixture.host },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const output = JSON.parse(result.content[0].text);
    expect(output.sessionActive).toBe(true);
    expect(output.resourceCount).toBe(3);
    expect(output.summary).toEqual({
      ok: 1,
      error: 1,
      pending: 1,
      building: 0,
      disabled: 0,
    });
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toEqual({ name: 'api', error: 'Build failed' });
    expect(output.connectionInfo.port).toBe(fixture.port);
    expect(output.connectionInfo.host).toBe(fixture.host);
    // Should NOT have full resources array
    expect(output.resources).toBeUndefined();
  });

  it('returns empty summary when no resources exist', async () => {
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

    const result = await tiltStatus.handler(
      { tiltPort: fixture.port, tiltHost: fixture.host },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.sessionActive).toBe(true);
    expect(output.resourceCount).toBe(0);
    expect(output.summary).toEqual({
      ok: 0,
      error: 0,
      pending: 0,
      building: 0,
      disabled: 0,
    });
    expect(output.errors).toEqual([]);
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltStatus.handler(
        { tiltPort: fixture.port, tiltHost: fixture.host },
        { tiltBinaryPath: fixture.tiltBinary },
      ),
    ).rejects.toThrow(/No active Tilt session|connection refused/i);
  });

  it('uses default port and host when not provided', async () => {
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

    const result = await tiltStatus.handler(
      {},
      {
        tiltBinaryPath: fixture.tiltBinary,
        // Override default with fixture values via env
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.sessionActive).toBe(true);
  });
});
