/**
 * Tests for tilt_wait tool
 *
 * Tests waiting for resources to be ready
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { tiltWait } from '../../src/tools/wait.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_wait tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('waits for resources successfully', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'uiresource/web-app condition met',
    });
    fixtures.push(fixture);

    const result = await tiltWait.handler(
      {
        resources: ['web-app'],
        timeout: 30,
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
    expect(output.success).toBe(true);
    expect(output.resources).toEqual(['web-app']);
    expect(output.output).toBeUndefined(); // Should not include raw CLI output
  });

  it('returns status summary when verbose is true', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: JSON.stringify({
        kind: 'UIResourceList',
        items: [
          {
            metadata: { name: 'web-app' },
            status: {
              conditions: [
                { type: 'Ready', status: 'True' },
                { type: 'UpToDate', status: 'True' },
              ],
            },
          },
          {
            metadata: { name: 'api' },
            status: {
              conditions: [{ type: 'Ready', status: 'False' }],
              updateStatus: 'pending',
            },
          },
        ],
      }),
    });
    fixtures.push(fixture);

    const result = await tiltWait.handler(
      { resources: ['web-app', 'api'], verbose: true },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.resourceStatuses).toHaveLength(2);
    expect(output.resourceStatuses[0]).toMatchObject({
      name: 'web-app',
      status: 'ok',
      ready: true,
    });
    expect(output.resourceStatuses[1]).toMatchObject({
      name: 'api',
      status: 'pending',
      ready: false,
    });
  });

  it('waits for all resources when none specified', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'all resources ready',
    });
    fixtures.push(fixture);

    const result = await tiltWait.handler(
      {},
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    expect(result.content).toHaveLength(1);
    const output = JSON.parse(result.content[0].text);
    expect(output.success).toBe(true);
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltWait.handler(
        {
          resources: ['web-app'],
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
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: '',
    });
    fixtures.push(fixture);

    const result = await tiltWait.handler(
      { resources: ['test'] },
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
