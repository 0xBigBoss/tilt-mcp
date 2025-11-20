/**
 * Tests for tilt_logs tool
 * 
 * Tests log retrieval with filtering and tailing
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { createTiltCliFixture, type TiltCliFixture } from '../fixtures/tilt-cli-fixture.js';
import { tiltLogs } from '../../src/tools/logs.js';

describe('tilt_logs tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach(f => f.cleanup());
    fixtures.length = 0;
  });

  it('returns logs for a resource', async () => {
    const logOutput = 'line 1\nline 2\nline 3\n';

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: logOutput
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      { resourceName: 'web-app', tiltPort: fixture.port, tiltHost: fixture.host },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const output = JSON.parse(result.content[0].text);
    expect(output.logs).toBe(logOutput);
    expect(output.resourceName).toBe('web-app');
    expect(output.connectionInfo.port).toBe(fixture.port);
    expect(output.connectionInfo.host).toBe(fixture.host);
  });

  it('returns tailed logs when tailLines specified', async () => {
    const logOutput = 'line 1\nline 2\nline 3\nline 4\nline 5\n';

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: logOutput
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      { resourceName: 'web-app', tailLines: 2, tiltPort: fixture.port, tiltHost: fixture.host },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.logs).toBe('line 4\nline 5\n');
    expect(output.options.tailLines).toBe(2);
  });

  it('includes filter options in response', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'error log\n'
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      { 
        resourceName: 'web-app',
        level: 'error',
        source: 'runtime',
        tiltPort: fixture.port,
        tiltHost: fixture.host
      },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.options.level).toBe('error');
    expect(output.options.source).toBe('runtime');
  });

  it('handles minimal logs', async () => {
    const logOutput = 'single line\n';

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: logOutput
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      { resourceName: 'web-app', tiltPort: fixture.port, tiltHost: fixture.host },
      { tiltBinaryPath: fixture.tiltBinary }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.logs).toBe(logOutput);
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltLogs.handler(
        { resourceName: 'web-app', tiltPort: fixture.port, tiltHost: fixture.host },
        { tiltBinaryPath: fixture.tiltBinary }
      )
    ).rejects.toThrow(/No active Tilt session|connection refused/i);
  });

  it('uses default port and host when not provided', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'test logs\n'
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      { resourceName: 'web-app' },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.logs).toBe('test logs\n');
  });
});
