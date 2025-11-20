import { describe, expect, it } from 'bun:test';
import { createTiltCliFixture } from '../fixtures/tilt-cli-fixture.ts';
import { TiltConnection } from '../../src/tilt/connection.ts';

describe('TiltConnection integration (tilt fixture)', () => {
  it('checks session against an isolated tilt fixture on a free port', async () => {
    const fixture = await createTiltCliFixture();

    try {
      const connection = new TiltConnection({
        port: fixture.port,
        host: fixture.host,
        binaryPath: fixture.tiltBinary,
        timeout: 500,
      });

      const result = await connection.checkSession();
      expect(result).toBe(true);

      const events = fixture.readEvents();
      expect(events.spawns.length).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });

  it('isolates multiple fixtures without port conflicts', async () => {
    const first = await createTiltCliFixture();
    const second = await createTiltCliFixture();

    try {
      expect(first.port).not.toBe(second.port);

      const connectionOne = new TiltConnection({
        port: first.port,
        host: first.host,
        binaryPath: first.tiltBinary,
      });

      const connectionTwo = new TiltConnection({
        port: second.port,
        host: second.host,
        binaryPath: second.tiltBinary,
      });

      await connectionOne.checkSession();
      await connectionTwo.checkSession();

      expect(first.readEvents().spawns.length).toBe(1);
      expect(second.readEvents().spawns.length).toBe(1);
    } finally {
      first.cleanup();
      second.cleanup();
    }
  });
});
