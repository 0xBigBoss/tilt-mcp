/**
 * Tests for tilt_discover tool
 *
 * Tests port scanning and Tilt instance discovery
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { tiltDiscover } from '../../src/tools/discover.js';
import {
  createTiltCliFixture,
  type TiltCliFixture,
} from '../fixtures/tilt-cli-fixture.js';

describe('tilt_discover tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach((f) => f.cleanup());
    fixtures.length = 0;
  });

  it('discovers single running Tilt instance', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'healthy' });
    fixtures.push(fixture);

    const result = await tiltDiscover.handler(
      { portRange: [fixture.port, fixture.port] },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltHost: fixture.host,
      },
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const output = JSON.parse(result.content[0].text);
    expect(output.instances).toHaveLength(1);
    expect(output.instances[0].host).toBe(fixture.host);
    expect(output.instances[0].port).toBe(fixture.port);
    expect(output.instances[0].sessionActive).toBe(true);
    expect(output.warning).toBeUndefined();
    expect(output.message).toBeUndefined();
  });

  it('discovers only accessible Tilt instances in range', async () => {
    const fixture1 = await createTiltCliFixture({ behavior: 'healthy' });
    const fixture2 = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture1, fixture2);

    const minPort = Math.min(fixture1.port, fixture2.port);
    const maxPort = Math.max(fixture1.port, fixture2.port);

    const result = await tiltDiscover.handler(
      { portRange: [minPort, maxPort] },
      {
        tiltBinaryPath: fixture1.tiltBinary,
        tiltHost: fixture1.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    // Should only find fixture1 (healthy), not fixture2 (refused)
    expect(output.instances).toHaveLength(1);
    expect(output.instances[0].port).toBe(fixture1.port);
    expect(output.warning).toBeUndefined();
    expect(output.message).toBeUndefined();
  });

  it('returns empty array when no instances found', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    const result = await tiltDiscover.handler(
      { portRange: [fixture.port, fixture.port] },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.instances).toEqual([]);
    expect(output.warning).toBeUndefined();
    expect(output.message).toBeUndefined();
  });

  it('uses default port range [10350, 10354]', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'healthy' });
    fixtures.push(fixture);

    const result = await tiltDiscover.handler(
      {},
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltHost: fixture.host,
      },
    );

    // Should scan default range even if no instances found
    const output = JSON.parse(result.content[0].text);
    expect(output.instances).toBeDefined();
    expect(Array.isArray(output.instances)).toBe(true);
  });

  it('skips ports that timeout', async () => {
    const fixture1 = await createTiltCliFixture({ behavior: 'healthy' });
    const fixture2 = await createTiltCliFixture({ behavior: 'hang' });
    fixtures.push(fixture1, fixture2);

    const minPort = Math.min(fixture1.port, fixture2.port);
    const maxPort = Math.max(fixture1.port, fixture2.port);

    const result = await tiltDiscover.handler(
      { portRange: [minPort, maxPort] },
      {
        tiltBinaryPath: fixture1.tiltBinary,
        tiltHost: fixture1.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    // Should only find the healthy one, skip the hanging one
    expect(output.instances).toHaveLength(1);
    expect(output.instances[0].port).toBe(fixture1.port);
    expect(output.warning).toBeUndefined();
    expect(output.message).toBeUndefined();
  });

  // Issue 1: Priority Chain Violation - args > extra > env > defaults
  it('respects explicit args.tiltHost over extra.tiltHost', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'healthy' });
    fixtures.push(fixture);

    const result = await tiltDiscover.handler(
      {
        tiltHost: fixture.host,
        portRange: [fixture.port, fixture.port],
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltHost: 'wrong-host.invalid',
      },
    );

    const output = JSON.parse(result.content[0].text);
    // Should find instance because args.tiltHost overrides extra.tiltHost
    expect(output.instances).toHaveLength(1);
    expect(output.instances[0].host).toBe(fixture.host);
  });

  it('respects explicit args.tiltPort over extra.tiltPort', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'healthy' });
    fixtures.push(fixture);

    const result = await tiltDiscover.handler(
      {
        tiltPort: fixture.port,
        tiltHost: fixture.host,
        portRange: [fixture.port, fixture.port],
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltPort: 99999, // Invalid port that should be ignored
      },
    );

    const output = JSON.parse(result.content[0].text);
    // Should find instance because args.tiltPort is used
    expect(output.instances).toHaveLength(1);
    expect(output.instances[0].port).toBe(fixture.port);
  });

  it('falls back to extra.tiltHost when args.tiltHost not provided', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'healthy' });
    fixtures.push(fixture);

    const result = await tiltDiscover.handler(
      {
        portRange: [fixture.port, fixture.port],
      },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    expect(output.instances).toHaveLength(1);
    expect(output.instances[0].host).toBe(fixture.host);
  });

  // TILT-005: Multiple Tilt Sessions Not Guarded
  it('warns when multiple active instances are discovered', async () => {
    // Create a fixture that responds on two consecutive ports
    // We'll create one fixture and manually scan adjacent ports
    const fixture = await createTiltCliFixture({ behavior: 'healthy' });
    fixtures.push(fixture);

    // Simulate the scenario by creating a fixture that accepts any port
    // by making state expectedPort undefined (will skip port validation)
    const fs = await import('node:fs');
    const statePath = fixture.statePath;
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    // Remove port check to simulate multiple instances in range
    delete state.expectedPort;
    fs.writeFileSync(statePath, JSON.stringify(state));

    // Now scan a range that includes multiple ports
    const startPort = fixture.port;
    const endPort = fixture.port + 1; // Two ports in range

    const result = await tiltDiscover.handler(
      { portRange: [startPort, endPort] },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    // Should find both ports as "active" (same fixture responds to both)
    expect(output.instances).toHaveLength(2);
    // Should include a warning about multiple instances
    expect(output.warning).toBeDefined();
    expect(output.warning).toMatch(/multiple.*instances|more than one/i);
    expect(output.message).toMatch(/specify.*port|environment variable/i);
  });

  it('does not warn when only one instance is discovered', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'healthy' });
    fixtures.push(fixture);

    const result = await tiltDiscover.handler(
      { portRange: [fixture.port, fixture.port] },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltHost: fixture.host,
      },
    );

    const output = JSON.parse(result.content[0].text);
    // Consistent format: always return object with instances array
    expect(output.instances).toHaveLength(1);
    expect(output.warning).toBeUndefined();
    expect(output.message).toBeUndefined();
  });
});
