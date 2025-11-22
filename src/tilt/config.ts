/**
 * Tilt Connection Configuration
 *
 * Resolves Tilt connection settings from explicit overrides or environment variables.
 * Required: TILT_PORT (via .mcp.json env or shell export)
 * Optional: TILT_HOST (defaults to 'localhost' if not set)
 */

const MIN_PORT = 1;
const MAX_PORT = 65535;

function validatePort(port: number, source: string): number {
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(
      `Invalid Tilt port from ${source}: expected integer between ${MIN_PORT} and ${MAX_PORT}`,
    );
  }
  return port;
}

function readEnvVar(key: string): string {
  const value = process.env[key];
  if (value === undefined) {
    throw new Error(
      `${key} is not set. Configure it in your .mcp.json server env or export it in the environment.`,
    );
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error(
      `${key} is empty. Provide a non-empty value via .mcp.json server env or the environment.`,
    );
  }
  return trimmed;
}

function parsePortFromEnv(): number {
  const raw = readEnvVar('TILT_PORT');
  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `TILT_PORT must be an integer between ${MIN_PORT} and ${MAX_PORT}`,
    );
  }
  const parsed = Number.parseInt(raw, 10);
  return validatePort(parsed, 'TILT_PORT');
}

function parseHostFromEnv(): string {
  const value = process.env['TILT_HOST'];
  if (value === undefined || value.trim() === '') {
    return 'localhost';
  }
  return value.trim();
}

export function requireTiltPort(portOverride?: number): number {
  if (portOverride !== undefined) {
    return validatePort(portOverride, 'override');
  }
  return parsePortFromEnv();
}

export function requireTiltHost(hostOverride?: string): string {
  if (hostOverride !== undefined) {
    const trimmed = hostOverride.trim();
    if (trimmed === '') {
      throw new Error(
        'Override for Tilt host is empty. Set TILT_HOST with a non-empty value via .mcp.json environment.',
      );
    }
    return trimmed;
  }
  return parseHostFromEnv();
}

export function resolveTiltTarget(overrides?: {
  port?: number;
  host?: string;
}): { port: number; host: string } {
  return {
    port: requireTiltPort(overrides?.port),
    host: requireTiltHost(overrides?.host),
  };
}
