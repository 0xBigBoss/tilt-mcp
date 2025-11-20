/**
 * Tests for tilt_discover tool
 *
 * Tests port scanning and Tilt instance discovery
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { createTiltCliFixture, type TiltCliFixture } from '../fixtures/tilt-cli-fixture.js';
import { tiltDiscover } from '../../src/tools/discover.js';

describe('tilt_discover tool', () => {
  const fixtures: TiltCliFixture[] = [];

  afterEach(() => {
    fixtures.forEach(f => f.cleanup());
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
      }
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    
    const output = JSON.parse(result.content[0].text);
    expect(output).toHaveLength(1);
    expect(output[0].host).toBe(fixture.host);
    expect(output[0].port).toBe(fixture.port);
    expect(output[0].sessionActive).toBe(true);
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
      }
    );

    const output = JSON.parse(result.content[0].text);
    // Should only find fixture1 (healthy), not fixture2 (refused)
    expect(output).toHaveLength(1);
    expect(output[0].port).toBe(fixture1.port);
  });

  it('returns empty array when no instances found', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'refused' });
    fixtures.push(fixture);

    const result = await tiltDiscover.handler(
      { portRange: [fixture.port, fixture.port] },
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltHost: fixture.host,
      }
    );

    const output = JSON.parse(result.content[0].text);
    expect(output).toEqual([]);
  });

  it('uses default port range [10350, 10354]', async () => {
    const fixture = await createTiltCliFixture({ behavior: 'healthy' });
    fixtures.push(fixture);

    const result = await tiltDiscover.handler(
      {},
      {
        tiltBinaryPath: fixture.tiltBinary,
        tiltHost: fixture.host,
      }
    );

    // Should scan default range even if no instances found
    const output = JSON.parse(result.content[0].text);
    expect(Array.isArray(output)).toBe(true);
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
      }
    );

    const output = JSON.parse(result.content[0].text);
    // Should only find the healthy one, skip the hanging one
    expect(output).toHaveLength(1);
    expect(output[0].port).toBe(fixture1.port);
  });
});
