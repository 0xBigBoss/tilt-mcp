/**
 * Tests for tilt_logs tool
 *
 * Tests log retrieval with filtering and tailing
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { tiltLogs } from '../../src/tools/logs.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_logs tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('returns logs for a resource', async () => {
    const logOutput = 'line 1\nline 2\nline 3\n';

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: logOutput,
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      {
        resourceName: 'web-app',
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
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
      stdout: logOutput,
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      {
        resourceName: 'web-app',
        tailLines: 2,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.logs).toBe('line 4\nline 5\n');
    expect(output.options.tailLines).toBe(2);
  });

  it('includes filter options in response', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'error log\n',
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      {
        resourceName: 'web-app',
        level: 'error',
        source: 'runtime',
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.options.level).toBe('error');
    expect(output.options.source).toBe('runtime');
  });

  describe('level filtering verification', () => {
    it('verifies that level parameter is passed to Tilt CLI', async () => {
      // This test verifies the CLI args include --level
      const logOutput = 'build log line 1\nbuild log line 2\n';

      const fixture = await createTiltCliFixture({
        behavior: 'healthy',
        stdout: logOutput,
      });
      fixtures.push(fixture);

      await tiltLogs.handler(
        {
          resourceName: 'web-app',
          level: 'error',
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
        { tiltBinaryPath: fixture.tiltBinary },
      );

      // Verify the CLI was called with correct args
      const events = fixture.readEvents();
      const logsSpawn = events.spawns.find((s) => s.args[0] === 'logs');
      expect(logsSpawn).toBeDefined();
      expect(logsSpawn?.args).toContain('--level');
      const levelIndex = logsSpawn?.args.indexOf('--level') ?? -1;
      expect(logsSpawn?.args[levelIndex + 1]).toBe('error');
    });

    it('verifies that source parameter is passed to Tilt CLI', async () => {
      // This test verifies the CLI args include --source
      const logOutput = 'runtime log\n';

      const fixture = await createTiltCliFixture({
        behavior: 'healthy',
        stdout: logOutput,
      });
      fixtures.push(fixture);

      await tiltLogs.handler(
        {
          resourceName: 'web-app',
          source: 'build',
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
        { tiltBinaryPath: fixture.tiltBinary },
      );

      // Verify the CLI was called with correct args
      const events = fixture.readEvents();
      const logsSpawn = events.spawns.find((s) => s.args[0] === 'logs');
      expect(logsSpawn).toBeDefined();
      expect(logsSpawn?.args).toContain('--source');
      const sourceIndex = logsSpawn?.args.indexOf('--source') ?? -1;
      expect(logsSpawn?.args[sourceIndex + 1]).toBe('build');
    });

    it('documents that level filters Tilt internal logs not app logs', async () => {
      // IMPORTANT: The --level flag filters Tilt's internal log messages
      // (e.g., warnings/errors from Tilt itself about builds, resource status)
      // NOT the actual application log content.
      //
      // Application logs are passed through unfiltered by Tilt.
      // If you want to filter application logs by severity, you must:
      // 1. Parse the log format (e.g., look for ERROR:, WARN: prefixes)
      // 2. Implement client-side filtering
      //
      // This test documents the current behavior.

      const allLogs =
        'app: INFO message\napp: ERROR message\napp: DEBUG message\n';

      const fixture = await createTiltCliFixture({
        behavior: 'healthy',
        stdout: allLogs,
      });
      fixtures.push(fixture);

      const result = await tiltLogs.handler(
        {
          resourceName: 'web-app',
          level: 'error',
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
        { tiltBinaryPath: fixture.tiltBinary },
      );

      const output = JSON.parse(result.content[0].text);
      // All logs are returned because --level filters Tilt logs, not app logs
      expect(output.logs).toBe(allLogs);
    });
  });

  it('handles minimal logs', async () => {
    const logOutput = 'single line\n';

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: logOutput,
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      {
        resourceName: 'web-app',
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.logs).toBe(logOutput);
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltLogs.handler(
        {
          resourceName: 'web-app',
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
        { tiltBinaryPath: fixture.tiltBinary },
      ),
    ).rejects.toThrow(/No active Tilt session|connection refused/i);
  });

  it('uses default port and host when not provided', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'test logs\n',
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      { resourceName: 'web-app' },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.logs).toBe('test logs\n');
  });

  it('strips ANSI codes from log output', async () => {
    // Log output with ANSI color codes
    const logWithAnsi =
      '\x1b[32mINFO\x1b[0m Starting server\n\x1b[31mERROR\x1b[0m Connection failed\n';
    const expectedClean = 'INFO Starting server\nERROR Connection failed\n';

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: logWithAnsi,
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      {
        resourceName: 'web-app',
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.logs).toBe(expectedClean);
  });

  it('uses default tailLines of 100', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: 'test logs\n',
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      {
        resourceName: 'web-app',
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
      { tiltBinaryPath: fixture.tiltBinary },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.options.tailLines).toBe(100);
  });
});
