import { z } from 'zod';

/**
 * Extra configuration passed to tool handlers
 * Used for default values when not specified in args
 */
export interface TiltToolExtra {
  tiltPort?: number;
  tiltHost?: string;
  tiltBinaryPath?: string;
}

/**
 * Base schema for all Tilt tool inputs
 * Connection is configured via MCP/.mcp.json or environment.
 */
export const TiltBaseInput = z.object({}).passthrough();

/**
 * Resource name schema - follows Kubernetes naming conventions
 * with special case for Tilt-specific resource names
 *
 * Standard names:
 * - Must be lowercase alphanumeric with hyphens and dots
 * - Cannot start or end with hyphen
 * - Max 253 characters
 *
 * Special Tilt names:
 * - (Tiltfile) - the main Tiltfile resource
 */
export const ResourceNameSchema = z
  .string()
  .min(1)
  .max(253)
  .refine((name) => {
    // Special case: (Tiltfile) is a valid Tilt resource name
    if (name === '(Tiltfile)') {
      return true;
    }
    // Standard Kubernetes DNS-1123 naming
    return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/.test(
      name,
    );
  }, 'Must be valid Kubernetes resource name or special Tilt resource name');

/**
 * Label schema - Kubernetes label format
 * Alphanumeric with hyphens, cannot start or end with hyphen
 */
export const LabelSchema = z
  .string()
  .regex(/^[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?$/, 'Invalid label format');

/**
 * Filter schema - safe characters only
 * Prevents command injection via filter strings
 * Allows alphanumeric, dots, underscores, equals, commas, spaces, hyphens
 */
export const FilterSchema = z
  .string()
  .max(256)
  .regex(/^[a-zA-Z0-9._=,\s-]*$/, 'Filter contains invalid characters');

/**
 * Tiltfile args schema - safe arguments only
 * Prevents command injection via Tiltfile arguments
 * Allows alphanumeric, dots, underscores, equals, hyphens, slashes
 */
export const TiltfileArgsSchema = z.array(
  z
    .string()
    .max(256)
    .regex(/^[a-zA-Z0-9._=/-]+$/, 'Invalid arg format'),
);

/**
 * Client-side log search filtering
 * Supports substring or regex matching
 */
export const LogSearchSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(512)
    .describe('Text to search for in log lines. Required.'),
  mode: z
    .enum(['substring', 'regex'])
    .optional()
    .default('substring')
    .describe('Search mode: substring (default) or regex.'),
  caseSensitive: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether search is case-sensitive. Default true.'),
  flags: z
    .string()
    .regex(
      /^[imsuy]*$/,
      'Invalid regex flags; allowed flags: i, m, s, u, y (global flag is not supported).',
    )
    .optional()
    .describe(
      'Regex flags to apply when mode="regex". Global flag is disallowed to avoid stateful matching.',
    ),
});

export type LogSearch = z.infer<typeof LogSearchSchema>;

/**
 * Tool-specific schemas
 */

export const TiltStatusInput = TiltBaseInput;

/**
 * Status filter values for resource filtering
 * 'all' returns all resources regardless of status
 */
export const StatusFilterSchema = z.enum([
  'ok',
  'error',
  'pending',
  'building',
  'disabled',
  'all',
]);

export const TiltGetResourcesInput = TiltBaseInput.extend({
  filter: FilterSchema.optional(),
  labels: z.array(LabelSchema).optional(),
  verbose: z.boolean().optional().default(false),
  status: StatusFilterSchema.optional().default('all'),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

export const TiltDescribeResourceInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
});

export const TiltLogsInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
  // Note: 'follow' mode removed - MCP tools must return a response and cannot stream
  tailLines: z
    .number()
    .int()
    .positive()
    .max(10000)
    .optional()
    .default(100)
    .describe(
      'Number of most recent log lines to return (max 10000, default 100)',
    ),
  level: z
    .enum(['warn', 'error'])
    .optional()
    .describe(
      'Filter Tilt internal messages by severity. NOTE: This filters Tilt system messages ' +
        '(e.g., build warnings, resource errors), NOT application log content. ' +
        'Application logs are returned unfiltered.',
    ),
  source: z
    .enum(['all', 'build', 'runtime'])
    .optional()
    .describe(
      'Filter logs by origin: "build" (container build logs), "runtime" (running container logs), ' +
        'or "all" (both). Default is "all".',
    ),
});

export const TiltTriggerInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
});

export const TiltEnableInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
});

export const TiltDisableInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
});

export const TiltArgsInput = TiltBaseInput.extend({
  mode: z
    .enum(['get', 'set', 'clear'])
    .optional()
    .describe(
      'Operation mode: "get" to view current args, "set" to set args, "clear" to clear args. If not specified, behavior is inferred from other parameters (legacy mode).',
    ),
  args: TiltfileArgsSchema.optional().describe(
    'Args to set. Required when mode="set" or when mode is not specified and clear is not true.',
  ),
  clear: z
    .boolean()
    .optional()
    .describe(
      'Clear all args. Required if mode is not specified and args is not provided. Cannot be used with mode parameter.',
    ),
});

/**
 * Validates TiltArgsInput to ensure proper parameter combinations.
 * Use this for runtime validation - the schema itself allows optional fields
 * because ZodEffects (from .refine()) doesn't work with tool().shape.
 */
export function validateTiltArgsInput(
  data: z.infer<typeof TiltArgsInput>,
): void {
  // If mode is specified, validate it's not mixed with legacy flags
  if (data.mode) {
    if (data.clear !== undefined) {
      throw new Error(
        'Cannot mix "mode" parameter with "clear" flag. Use mode="clear" instead.',
      );
    }
    if (data.mode === 'get' && data.args !== undefined) {
      throw new Error(
        'Cannot mix mode="get" with "args" parameter. Use mode="get" without args to view current arguments.',
      );
    }
    if (data.mode === 'clear' && data.args !== undefined) {
      throw new Error(
        'Cannot mix mode="clear" with "args" parameter. Use mode="clear" without args.',
      );
    }
    if (data.mode === 'set' && (!data.args || data.args.length === 0)) {
      throw new Error(
        'mode="set" requires non-empty "args" parameter to be provided.',
      );
    }
    return; // Mode validation complete
  }

  // Legacy validation: either args or clear must be provided
  if (data.clear !== true && (!data.args || data.args.length === 0)) {
    throw new Error(
      'Either args (non-empty) or clear=true must be provided. ' +
        'Running tilt args without arguments opens an interactive editor.',
    );
  }
}

export const TiltWaitInput = TiltBaseInput.extend({
  resources: z.array(ResourceNameSchema).optional(),
  timeout: z.number().int().positive().max(600).optional(),
  condition: z.string().optional().default('Ready'),
});

export const TiltDumpInput = TiltBaseInput.extend({
  format: z.enum(['json', 'yaml']).optional().default('json'),
});
