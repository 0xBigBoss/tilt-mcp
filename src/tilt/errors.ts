/**
 * Tilt Error Taxonomy
 *
 * Base error class and specific error types for all Tilt CLI failures.
 * Each error includes:
 * - Clear description of what went wrong
 * - Why it happened (if known)
 * - How to fix it (actionable steps)
 * - Relevant details for debugging
 */

/**
 * Base error class for all Tilt-related errors.
 * Extends Error with error code and optional details object.
 */
export class TiltError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TiltError';
    this.code = code;
    this.details = details;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, TiltError.prototype);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Tilt CLI executable not found in PATH.
 *
 * What: The 'tilt' command could not be executed (ENOENT error)
 * Why: Tilt is not installed or not in PATH
 * Fix: Install Tilt from https://docs.tilt.dev
 */
export class TiltNotInstalledError extends TiltError {
  constructor() {
    super(
      'Tilt CLI not found in PATH. Install Tilt from https://docs.tilt.dev and ensure it is in your PATH.',
      'TILT_NOT_INSTALLED',
      {},
    );
    this.name = 'TiltNotInstalledError';
    Object.setPrototypeOf(this, TiltNotInstalledError.prototype);
  }
}

/**
 * No active Tilt session at the specified host:port.
 *
 * What: Cannot connect to Tilt API server
 * Why: No 'tilt up' session running, or wrong host/port
 * Fix: Run 'tilt up' first, or verify correct port
 */
export class TiltNotRunningError extends TiltError {
  constructor(port: number, host: string) {
    super(
      `No active Tilt session on ${host}:${port}. Run 'tilt up' first or verify the correct port.`,
      'TILT_NOT_RUNNING',
      { port, host },
    );
    this.name = 'TiltNotRunningError';
    Object.setPrototypeOf(this, TiltNotRunningError.prototype);
  }
}

/**
 * Requested resource does not exist in Tilt.
 *
 * What: Resource name not found in current Tilt session
 * Why: Typo in name, or resource not defined in Tiltfile
 * Fix: Check resource name spelling, or list available resources
 */
export class TiltResourceNotFoundError extends TiltError {
  constructor(resourceName: string) {
    super(
      `Resource "${resourceName}" not found. Use tilt_get_resources to list available resources or verify the name.`,
      'TILT_RESOURCE_NOT_FOUND',
      { resourceName },
    );
    this.name = 'TiltResourceNotFoundError';
    Object.setPrototypeOf(this, TiltResourceNotFoundError.prototype);
  }
}

/**
 * Tilt CLI command exceeded timeout duration.
 *
 * What: Command did not complete within allowed time
 * Why: Tilt is unresponsive, network issues, or command is too slow
 * Fix: Check Tilt health, increase timeout, or simplify query
 */
export class TiltCommandTimeoutError extends TiltError {
  constructor(command: string, timeoutMs: number) {
    super(
      `Tilt command '${command}' timed out after ${timeoutMs}ms. Check Tilt health or increase timeout.`,
      'TILT_COMMAND_TIMEOUT',
      { command, timeoutMs },
    );
    this.name = 'TiltCommandTimeoutError';
    Object.setPrototypeOf(this, TiltCommandTimeoutError.prototype);
  }
}

/**
 * Tilt CLI output exceeded maximum buffer size.
 *
 * What: Command output was too large to buffer in memory
 * Why: Logs or resource list is very large
 * Fix: Use filters to reduce output, increase maxBuffer, or use pagination
 */
export class TiltOutputExceededError extends TiltError {
  constructor(maxBufferBytes: number) {
    super(
      `Tilt command output exceeded maximum buffer size of ${maxBufferBytes} bytes. Use filters to reduce output or increase the buffer limit.`,
      'TILT_OUTPUT_EXCEEDED',
      { maxBufferBytes },
    );
    this.name = 'TiltOutputExceededError';
    Object.setPrototypeOf(this, TiltOutputExceededError.prototype);
  }
}
