import { z } from 'zod';

/**
 * Base schema for all Tilt tool inputs
 * Validates port and host parameters
 */
export const TiltBaseInput = z.object({
  tiltPort: z.number().int().min(1).max(65535).optional(),
  tiltHost: z
    .string()
    .regex(
      /^([a-zA-Z0-9.-]+|\[[0-9a-fA-F:.]+\])$/,
      'Invalid host format'
    )
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
    'Must be valid Kubernetes resource name'
  );

/**
 * Label schema - Kubernetes label format
 * Alphanumeric with hyphens, cannot start or end with hyphen
 */
export const LabelSchema = z
  .string()
  .regex(
    /^[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?$/,
    'Invalid label format'
  );

/**
 * Port range schema - tuple of [start, end] ports
 * Start must be <= end
 */
export const PortRangeSchema = z
  .tuple([
    z.number().int().min(1).max(65535),
    z.number().int().min(1).max(65535),
  ])
  .refine(
    ([start, end]) => start <= end,
    'Start port must be <= end port'
  );

/**
 * Filter schema - safe characters only
 * Prevents command injection via filter strings
 * Allows alphanumeric, dots, underscores, equals, commas, spaces, hyphens
 */
export const FilterSchema = z
  .string()
  .max(256)
  .regex(
    /^[a-zA-Z0-9._=,\s-]*$/,
    'Filter contains invalid characters'
  );

/**
 * Tiltfile args schema - safe arguments only
 * Prevents command injection via Tiltfile arguments
 * Allows alphanumeric, dots, underscores, equals, hyphens, slashes
 */
export const TiltfileArgsSchema = z.array(
  z
    .string()
    .max(256)
    .regex(/^[a-zA-Z0-9._=/-]+$/, 'Invalid arg format')
);

/**
 * Tool-specific schemas
 */

export const TiltDiscoverInput = TiltBaseInput.extend({
  portRange: PortRangeSchema.optional().default([10350, 10354]),
});

export const TiltStatusInput = TiltBaseInput;

export const TiltGetResourcesInput = TiltBaseInput.extend({
  filter: FilterSchema.optional(),
  labels: z.array(LabelSchema).optional(),
});

export const TiltDescribeResourceInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
});

export const TiltLogsInput = TiltBaseInput.extend({
  resourceName: ResourceNameSchema,
  follow: z.boolean().optional(),
  tailLines: z.number().int().positive().max(10000).optional(),
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
  args: TiltfileArgsSchema,
});
