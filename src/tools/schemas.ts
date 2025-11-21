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
 * Validates port and host parameters
 */
export const TiltBaseInput = z.object({
  tiltPort: z.number().int().min(1).max(65535).optional(),
  tiltHost: z
    .string()
    .regex(/^([a-zA-Z0-9.-]+|\[[0-9a-fA-F:.]+\])$/, 'Invalid host format')
    .optional(),
});

/**
 * Resource name schema - follows Kubernetes naming conventions
 * Must be lowercase alphanumeric with hyphens and dots
 * Cannot start or end with hyphen
 * Max 253 characters
 */
export const ResourceNameSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(
    /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/,
    'Must be valid Kubernetes resource name',
  );

/**
 * Label schema - Kubernetes label format
 * Alphanumeric with hyphens, cannot start or end with hyphen
 */
export const LabelSchema = z
  .string()
  .regex(/^[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?$/, 'Invalid label format');

/**
 * Port range schema - tuple of [start, end] ports
 * Start must be <= end
 */
export const PortRangeSchema = z
  .tuple([
    z.number().int().min(1).max(65535),
    z.number().int().min(1).max(65535),
  ])
  .refine(([start, end]) => start <= end, 'Start port must be <= end port');

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
 * Tool-specific schemas
 */

export const TiltDiscoverInput = TiltBaseInput.extend({
  portRange: PortRangeSchema.optional(),
});

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
  tailLines: z.number().int().positive().max(10000).optional().default(100),
  level: z.enum(['warn', 'error']).optional(),
  source: z.enum(['all', 'build', 'runtime']).optional(),
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
  args: TiltfileArgsSchema.optional().describe(
    'Args to set. Required unless clear=true.',
  ),
  clear: z
    .boolean()
    .optional()
    .describe('Clear all args. Required if args is not provided.'),
});

/**
 * Validates TiltArgsInput to ensure either args or clear is provided.
 * Use this for runtime validation - the schema itself allows optional fields
 * because ZodEffects (from .refine()) doesn't work with tool().shape.
 */
export function validateTiltArgsInput(
  data: z.infer<typeof TiltArgsInput>,
): void {
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
