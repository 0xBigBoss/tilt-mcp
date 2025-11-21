/**
 * Tilt Connection Configuration
 *
 * Provides default values for Tilt connection parameters.
 * Reads from environment variables with fallback to built-in defaults.
 *
 * Priority: explicit args > extra config > env vars > built-in defaults
 */

// Built-in defaults
const DEFAULT_PORT = 10350;
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT_RANGE_SIZE = 4;

/**
 * Get default Tilt port from environment or built-in default.
 * Validates that TILT_PORT is a valid port number (1-65535).
 *
 * @returns Default port number
 */
export function getDefaultTiltPort(): number {
  const envPort = process.env.TILT_PORT;

  if (!envPort) {
    return DEFAULT_PORT;
  }

  // Strict numeric validation - reject if not all digits (with optional leading/trailing whitespace)
  const trimmed = envPort.trim();
  if (!/^\d+$/.test(trimmed)) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(trimmed, 10);

  // Validate: must be an integer between 1 and 65535
  if (
    Number.isNaN(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > 65535
  ) {
    return DEFAULT_PORT;
  }

  return parsed;
}

/**
 * Get default Tilt host from environment or built-in default.
 *
 * @returns Default host string
 */
export function getDefaultTiltHost(): string {
  const envHost = process.env.TILT_HOST;

  if (!envHost) {
    return DEFAULT_HOST;
  }

  return envHost;
}

/**
 * Get default port range for discovery scanning.
 * Range starts from the default port and extends by the specified size.
 * End port is clamped to 65535 to prevent invalid port numbers.
 *
 * @param rangeSize - Number of ports to scan after the starting port (default: 4)
 * @returns Tuple of [startPort, endPort]
 */
export function getDefaultPortRange(
  rangeSize: number = DEFAULT_PORT_RANGE_SIZE,
): [number, number] {
  const startPort = getDefaultTiltPort();
  const endPort = Math.min(startPort + rangeSize, 65535);
  return [startPort, endPort];
}
