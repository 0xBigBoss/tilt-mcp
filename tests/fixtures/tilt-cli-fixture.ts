import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import net, { type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type SessionBehavior = 'healthy' | 'refused' | 'hang' | 'invalid-json';

interface TiltFixtureState {
  expectedPort: number;
  expectedHost: string;
  sessionBehavior: SessionBehavior;
  sessionStdout: string;
  sessionStderr: string;
  hangMs: number;
}

export interface TiltCliFixture {
  port: number;
  host: string;
  tiltBinary: string;
  statePath: string;
  eventsPath: string;
  setBehavior: (
    behavior: SessionBehavior,
    overrides?: Partial<TiltFixtureState>,
  ) => void;
  readEvents: () => TiltFixtureEvents;
  cleanup: () => void;
}

export interface TiltFixtureEvents {
  spawns: { args: string[]; timestamp: number }[];
  signals: { signal: string; timestamp: number }[];
}

function buildTiltShimSource(statePath: string, eventsPath: string): string {
  return `#!/usr/bin/env node
const { existsSync, readFileSync, writeFileSync } = require('node:fs');

const statePath = ${JSON.stringify(statePath)};
const eventsPath = ${JSON.stringify(eventsPath)};

function readState() {
  const content = readFileSync(statePath, 'utf8');
  return JSON.parse(content);
}

function readEvents() {
  if (!existsSync(eventsPath)) {
    return { spawns: [], signals: [] };
  }
  try {
    const content = readFileSync(eventsPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return { spawns: [], signals: [] };
  }
}

function recordEvent(event) {
  const events = readEvents();
  if (event.type === 'spawn') {
    events.spawns.push({ args: event.args, timestamp: Date.now() });
  }
  if (event.type === 'signal') {
    events.signals.push({ signal: event.signal, timestamp: Date.now() });
  }
  writeFileSync(eventsPath, JSON.stringify(events));
}

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  process.on('SIGTERM', () => {
    recordEvent({ type: 'signal', signal: 'SIGTERM' });
    process.exit(143);
  });

  const args = process.argv.slice(2);
  recordEvent({ type: 'spawn', args });

  const state = readState();

  const portIndex = args.indexOf('--port');
  const hostIndex = args.indexOf('--host');
  const portArg = portIndex !== -1 ? parseInt(args[portIndex + 1] || '', 10) : undefined;
  const hostArg = hostIndex !== -1 ? args[hostIndex + 1] : undefined;

  // Validate port/host for all commands
  if (typeof state.expectedPort === 'number' && portArg !== undefined && portArg !== state.expectedPort) {
    exitWithError(\`dial tcp \${hostArg}:\${portArg}: connection refused (expected port \${state.expectedPort})\`);
  }

  if (typeof state.expectedHost === 'string' && hostArg && hostArg !== state.expectedHost) {
    exitWithError(\`dial tcp \${hostArg}:\${portArg}: connection refused (expected host \${state.expectedHost})\`);
  }

  // Handle different behaviors based on state
  switch (state.sessionBehavior) {
    case 'refused':
      exitWithError(state.sessionStderr ?? 'dial tcp: connection refused');
    case 'invalid-json':
      process.stdout.write('not json');
      process.exit(0);
    case 'hang':
      // Keep process alive until the parent kills it (simulates CLI stall)
      setInterval(() => {}, 1000);
      return;
    case 'healthy':
      // Handle specific commands
      if (args[0] === 'get' && args[1] === 'session') {
        process.stdout.write(state.sessionStdout ?? '{"kind":"Session"}');
        process.exit(0);
      }
      if (args[0] === 'get' && args[1] === 'uiresources') {
        // Try to use sessionStdout if it looks like JSON
        let output = state.sessionStdout;
        if (!output || (output && !output.trim().startsWith('{'))) {
          // sessionStdout is not JSON (probably log text), use default resource list
          output = JSON.stringify({
            kind: 'UIResourceList',
            items: [
              { metadata: { name: 'web-app' } },
              { metadata: { name: 'test-service' } },
              { metadata: { name: '(Tiltfile)' } },
            ],
          });
        }
        process.stdout.write(output);
        process.exit(0);
      }
      if (args[0] === 'get' && args[1]?.startsWith('uiresource/')) {
        process.stdout.write(state.sessionStdout ?? '{"kind":"UIResource","metadata":{"name":"test"}}');
        process.exit(0);
      }
      if (args[0] === 'get' && args[1]?.startsWith('tiltfile/')) {
        process.stdout.write(state.sessionStdout ?? '{"kind":"Tiltfile","metadata":{"name":"(Tiltfile)"},"spec":{"args":[]}}');
        process.exit(0);
      }
      if (args[0] === 'logs') {
        process.stdout.write(state.sessionStdout ?? 'log output');
        process.exit(0);
      }
      if (args[0] === 'trigger') {
        process.stdout.write(state.sessionStdout ?? 'triggered');
        process.exit(0);
      }
      if (args[0] === 'enable') {
        process.stdout.write(state.sessionStdout ?? 'enabled');
        process.exit(0);
      }
      if (args[0] === 'disable') {
        process.stdout.write(state.sessionStdout ?? 'disabled');
        process.exit(0);
      }
      if (args[0] === 'args') {
        process.stdout.write(state.sessionStdout ?? '');
        process.exit(0);
      }
      if (args[0] === 'wait') {
        process.stdout.write(state.sessionStdout ?? '');
        process.exit(0);
      }
      if (args[0] === 'dump' && args[1] === 'engine') {
        process.stdout.write(state.sessionStdout ?? '{"engine":"state"}');
        process.exit(0);
      }
      // Fall through for unhandled commands
      break;
    default:
      exitWithError('Unsupported sessionBehavior: ' + state.sessionBehavior);
  }

  exitWithError('Unsupported tilt command: ' + args.join(' '));
}

main();
`;
}

function buildFixtureState(
  host: string,
  port: number,
  behavior: SessionBehavior,
): TiltFixtureState {
  return {
    expectedHost: host,
    expectedPort: port,
    sessionBehavior: behavior,
    sessionStdout: '{"kind":"Session"}',
    sessionStderr: `dial tcp ${host}:${port}: connection refused`,
    hangMs: 60000,
  };
}

function writeState(statePath: string, state: TiltFixtureState): void {
  writeFileSync(statePath, JSON.stringify(state));
}

function readEvents(eventsPath: string): TiltFixtureEvents {
  if (!existsSync(eventsPath)) {
    return { spawns: [], signals: [] };
  }
  const content = readFileSync(eventsPath, 'utf8');
  try {
    return JSON.parse(content) as TiltFixtureEvents;
  } catch {
    return { spawns: [], signals: [] };
  }
}

function findFreePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, host, () => {
      const address = server.address() as AddressInfo;
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

export async function createTiltCliFixture(
  options: {
    host?: string;
    behavior?: SessionBehavior;
    hangMs?: number;
    stdout?: string;
    stderr?: string;
  } = {},
): Promise<TiltCliFixture> {
  const host = options.host ?? '127.0.0.1';
  const port = await findFreePort(host);
  const behavior = options.behavior ?? 'healthy';

  const dir = mkdtempSync(join(tmpdir(), 'tilt-cli-fixture-'));
  const statePath = join(dir, 'state.json');
  const eventsPath = join(dir, 'events.json');
  const tiltBinary = join(dir, 'tilt');

  let currentState = buildFixtureState(host, port, behavior);
  if (options.hangMs !== undefined) {
    currentState.hangMs = options.hangMs;
  }
  if (options.stdout) {
    currentState.sessionStdout = options.stdout;
  }
  if (options.stderr) {
    currentState.sessionStderr = options.stderr;
  }
  writeState(statePath, currentState);
  writeFileSync(eventsPath, JSON.stringify({ spawns: [], signals: [] }));

  const shimSource = buildTiltShimSource(statePath, eventsPath);
  writeFileSync(tiltBinary, shimSource, { encoding: 'utf8' });
  chmodSync(tiltBinary, 0o755);

  const setBehavior = (
    sessionBehavior: SessionBehavior,
    overrides: Partial<TiltFixtureState> = {},
  ) => {
    currentState = { ...currentState, ...overrides, sessionBehavior };
    writeState(statePath, currentState);
  };

  const cleanup = () => {
    rmSync(dir, { recursive: true, force: true });
  };

  return {
    port,
    host,
    tiltBinary,
    statePath,
    eventsPath,
    setBehavior,
    readEvents: () => readEvents(eventsPath),
    cleanup,
  };
}
