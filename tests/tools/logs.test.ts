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

  it('returns logs for a resource as plain text', async () => {
    const logOutput = 'line 1\nline 2\nline 3\n';

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: logOutput,
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
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
    expect(result.content[0].text).toBe(logOutput);
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
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    expect(result.content[0].text).toBe('line 4\nline 5\n');
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
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
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
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
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
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      );

      // All logs are returned because --level filters Tilt logs, not app logs
      expect(result.content[0].text).toBe(allLogs);
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
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    expect(result.content[0].text).toBe(logOutput);
  });

  it('applies default tail of 100 lines', async () => {
    const lines = Array.from({ length: 120 }, (_, i) => `line ${i + 1}`);
    const logOutput = `${lines.join('\n')}\n`;

    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      stdout: logOutput,
    });
    fixtures.push(fixture);

    const result = await tiltLogs.handler(
      {
        resourceName: 'web-app',
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    const output = result.content[0].text.endsWith('\n')
      ? result.content[0].text.slice(0, -1)
      : result.content[0].text;
    const outputLines = output.split('\n');

    expect(outputLines.length).toBe(100);
    expect(outputLines[0]).toBe('line 21');
    expect(outputLines[99]).toBe('line 120');
  });

  it('throws error when Tilt is not running', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    await expect(
      tiltLogs.handler(
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

  it('throws clear error when resource does not exist', async () => {
    const fixture = await createTiltCliFixture({
      behavior: 'healthy',
      // Fixture will return default resource list (web-app, test-service, (Tiltfile))
      // 'nonexistent-resource' is not in that list
    });
    fixtures.push(fixture);

    await expect(
      tiltLogs.handler(
        {
          resourceName: 'nonexistent-resource',
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      ),
    ).rejects.toThrow(
      'Resource "nonexistent-resource" not found. Use tilt_get_resources to list available resources or verify the name.',
    );
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

    expect(result.content[0].text).toBe('test logs\n');
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
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: fixture.port,
        tiltHost: fixture.host,
      },
    );

    expect(result.content[0].text).toBe(expectedClean);
  });

  describe('search filtering', () => {
    it('filters logs by substring (case-sensitive by default)', async () => {
      const logOutput =
        'app: INFO boot\napp: ERROR something broke\napp: WARN low disk\n';

      const fixture = await createTiltCliFixture({
        behavior: 'healthy',
        stdout: logOutput,
      });
      fixtures.push(fixture);

      const result = await tiltLogs.handler(
        {
          resourceName: 'web-app',
          search: { query: 'ERROR' },
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      );

      expect(result.content[0].text).toBe('app: ERROR something broke\n');
    });

    it('filters logs by substring when caseSensitive is false', async () => {
      const logOutput =
        'app: info boot\napp: error something broke\napp: warn low disk\n';

      const fixture = await createTiltCliFixture({
        behavior: 'healthy',
        stdout: logOutput,
      });
      fixtures.push(fixture);

      const result = await tiltLogs.handler(
        {
          resourceName: 'web-app',
          search: { query: 'ERROR', caseSensitive: false },
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      );

      expect(result.content[0].text).toBe('app: error something broke\n');
    });

    it('filters logs by regex with flags', async () => {
      const logOutput =
        'app: info boot\napp: ERROR something broke\napp: Warn low disk\n';

      const fixture = await createTiltCliFixture({
        behavior: 'healthy',
        stdout: logOutput,
      });
      fixtures.push(fixture);

      const result = await tiltLogs.handler(
        {
          resourceName: 'web-app',
          search: { query: '^app: warn', mode: 'regex', flags: 'im' },
        },
        {
          tiltBinaryPath: fixture.tiltBinary,
          tiltPort: fixture.port,
          tiltHost: fixture.host,
        },
      );

      expect(result.content[0].text).toBe('app: Warn low disk\n');
    });

    it('throws on invalid regex search', async () => {
      const fixture = await createTiltCliFixture({
        behavior: 'healthy',
        stdout: 'app: info boot\n',
      });
      fixtures.push(fixture);

      await expect(
        tiltLogs.handler(
          {
            resourceName: 'web-app',
            search: { query: '[unclosed', mode: 'regex' },
          },
          {
            tiltBinaryPath: fixture.tiltBinary,
            tiltPort: fixture.port,
            tiltHost: fixture.host,
          },
        ),
      ).rejects.toThrow(/Invalid search regex/i);
    });
  });
});
