import { describe, expect, it } from 'bun:test';
import {
  FilterSchema,
  LabelSchema,
  ResourceNameSchema,
  TiltArgsInput,
  TiltDescribeResourceInput,
  TiltDisableInput,
  TiltDumpInput,
  TiltEnableInput,
  TiltfileArgsSchema,
  TiltGetResourcesInput,
  TiltLogsInput,
  TiltStatusInput,
  TiltTriggerInput,
  TiltWaitInput,
} from '../../src/tools/schemas.ts';

describe('ResourceNameSchema', () => {
  it('accepts valid Kubernetes resource names', () => {
    expect(() => ResourceNameSchema.parse('my-service')).not.toThrow();
    expect(() => ResourceNameSchema.parse('api-v2')).not.toThrow();
    expect(() => ResourceNameSchema.parse('frontend')).not.toThrow();
    expect(() => ResourceNameSchema.parse('backend-db-123')).not.toThrow();
  });

  it('accepts names with dots (DNS subdomain format)', () => {
    expect(() => ResourceNameSchema.parse('my.service')).not.toThrow();
    expect(() => ResourceNameSchema.parse('api.v2.production')).not.toThrow();
  });

  it('accepts single character names', () => {
    expect(() => ResourceNameSchema.parse('a')).not.toThrow();
    expect(() => ResourceNameSchema.parse('1')).not.toThrow();
  });

  it('rejects empty strings', () => {
    expect(() => ResourceNameSchema.parse('')).toThrow();
  });

  it('rejects names > 253 characters', () => {
    const longName = 'a'.repeat(254);
    expect(() => ResourceNameSchema.parse(longName)).toThrow();
  });

  it('rejects names starting with hyphen', () => {
    expect(() => ResourceNameSchema.parse('-my-service')).toThrow();
  });

  it('rejects names ending with hyphen', () => {
    expect(() => ResourceNameSchema.parse('my-service-')).toThrow();
  });

  it('rejects names with uppercase letters', () => {
    expect(() => ResourceNameSchema.parse('My-Service')).toThrow();
    expect(() => ResourceNameSchema.parse('API')).toThrow();
  });

  it('rejects names with underscores', () => {
    expect(() => ResourceNameSchema.parse('my_service')).toThrow();
  });

  it('rejects path traversal attempts', () => {
    expect(() => ResourceNameSchema.parse('../../../etc/passwd')).toThrow();
    expect(() => ResourceNameSchema.parse('..')).toThrow();
    expect(() => ResourceNameSchema.parse('.')).toThrow();
  });

  it('rejects special characters', () => {
    expect(() => ResourceNameSchema.parse('service@name')).toThrow();
    expect(() => ResourceNameSchema.parse('service/name')).toThrow();
    expect(() => ResourceNameSchema.parse('service;rm')).toThrow();
  });

  it('rejects shell injection attempts', () => {
    expect(() => ResourceNameSchema.parse('service`whoami`')).toThrow();
    expect(() => ResourceNameSchema.parse('service$(rm -rf /)')).toThrow();
    expect(() => ResourceNameSchema.parse('service && ls')).toThrow();
  });

  // TILT-001: Resource Name Validation
  it('accepts special Tilt resource name (Tiltfile)', () => {
    // Tilt uses (Tiltfile) as a special resource name
    expect(() => ResourceNameSchema.parse('(Tiltfile)')).not.toThrow();
  });

  it('rejects other names with parentheses', () => {
    // Only (Tiltfile) is allowed, not arbitrary parenthesized names
    expect(() => ResourceNameSchema.parse('(myresource)')).toThrow();
    expect(() => ResourceNameSchema.parse('(test)')).toThrow();
  });
});

describe('LabelSchema', () => {
  it('accepts valid labels', () => {
    expect(() => LabelSchema.parse('app')).not.toThrow();
    expect(() => LabelSchema.parse('tier-frontend')).not.toThrow();
    expect(() => LabelSchema.parse('VERSION-123')).not.toThrow();
  });

  it('accepts alphanumeric labels', () => {
    expect(() => LabelSchema.parse('app123')).not.toThrow();
    expect(() => LabelSchema.parse('ABC')).not.toThrow();
    expect(() => LabelSchema.parse('123')).not.toThrow();
  });

  it('accepts single character labels', () => {
    expect(() => LabelSchema.parse('a')).not.toThrow();
    expect(() => LabelSchema.parse('1')).not.toThrow();
  });

  it('rejects labels starting with hyphen', () => {
    expect(() => LabelSchema.parse('-app')).toThrow();
  });

  it('rejects labels ending with hyphen', () => {
    expect(() => LabelSchema.parse('app-')).toThrow();
  });

  it('rejects labels with special characters', () => {
    expect(() => LabelSchema.parse('app_name')).toThrow();
    expect(() => LabelSchema.parse('app.name')).toThrow();
    expect(() => LabelSchema.parse('app@name')).toThrow();
  });

  it('rejects empty labels', () => {
    expect(() => LabelSchema.parse('')).toThrow();
  });
});

describe('FilterSchema', () => {
  it('accepts safe filter strings', () => {
    expect(() => FilterSchema.parse('app=frontend')).not.toThrow();
    expect(() => FilterSchema.parse('tier=web,env=prod')).not.toThrow();
    expect(() => FilterSchema.parse('version.1_0')).not.toThrow();
    expect(() => FilterSchema.parse('key-name=value-123')).not.toThrow();
  });

  it('accepts empty strings', () => {
    expect(() => FilterSchema.parse('')).not.toThrow();
  });

  it('accepts spaces', () => {
    expect(() => FilterSchema.parse('app = frontend')).not.toThrow();
  });

  it('rejects strings > 256 characters', () => {
    const longFilter = 'a=b,'.repeat(100); // > 256 chars
    expect(() => FilterSchema.parse(longFilter)).toThrow();
  });

  it('rejects shell metacharacters', () => {
    expect(() => FilterSchema.parse('app=frontend;rm -rf /')).toThrow(
      /invalid characters/,
    );
    expect(() => FilterSchema.parse('app=`whoami`')).toThrow(
      /invalid characters/,
    );
    expect(() => FilterSchema.parse('app=$(ls)')).toThrow(/invalid characters/);
  });

  it('rejects special characters', () => {
    expect(() => FilterSchema.parse('app=frontend&tier=web')).toThrow(
      /invalid characters/,
    );
    expect(() => FilterSchema.parse('app=frontend|tier=web')).toThrow(
      /invalid characters/,
    );
    expect(() => FilterSchema.parse('app=frontend<tier')).toThrow(
      /invalid characters/,
    );
  });

  it('rejects path traversal attempts', () => {
    expect(() => FilterSchema.parse('../../../etc')).toThrow(
      /invalid characters/,
    );
  });
});

describe('TiltfileArgsSchema', () => {
  it('accepts safe argument arrays', () => {
    expect(() => TiltfileArgsSchema.parse(['--arg1=value1'])).not.toThrow();
    expect(() =>
      TiltfileArgsSchema.parse(['--config=./config.yaml']),
    ).not.toThrow();
    expect(() =>
      TiltfileArgsSchema.parse(['arg1', 'arg2', 'arg3']),
    ).not.toThrow();
  });

  it('accepts arguments with hyphens and underscores', () => {
    expect(() => TiltfileArgsSchema.parse(['--my-arg'])).not.toThrow();
    expect(() => TiltfileArgsSchema.parse(['my_value'])).not.toThrow();
  });

  it('accepts paths with slashes', () => {
    expect(() => TiltfileArgsSchema.parse(['path/to/file'])).not.toThrow();
    expect(() => TiltfileArgsSchema.parse(['/absolute/path'])).not.toThrow();
  });

  it('accepts empty array', () => {
    expect(() => TiltfileArgsSchema.parse([])).not.toThrow();
  });

  it('rejects arguments > 256 characters', () => {
    const longArg = 'a'.repeat(257);
    expect(() => TiltfileArgsSchema.parse([longArg])).toThrow();
  });

  it('rejects shell metacharacters', () => {
    expect(() => TiltfileArgsSchema.parse(['arg;rm -rf /'])).toThrow(
      /Invalid arg format/,
    );
    expect(() => TiltfileArgsSchema.parse(['arg`whoami`'])).toThrow(
      /Invalid arg format/,
    );
    expect(() => TiltfileArgsSchema.parse(['arg$(ls)'])).toThrow(
      /Invalid arg format/,
    );
  });

  it('rejects special characters', () => {
    expect(() => TiltfileArgsSchema.parse(['arg&value'])).toThrow(
      /Invalid arg format/,
    );
    expect(() => TiltfileArgsSchema.parse(['arg|value'])).toThrow(
      /Invalid arg format/,
    );
    expect(() => TiltfileArgsSchema.parse(['arg<value'])).toThrow(
      /Invalid arg format/,
    );
  });

  it('rejects spaces in arguments', () => {
    expect(() => TiltfileArgsSchema.parse(['arg with spaces'])).toThrow(
      /Invalid arg format/,
    );
  });
});

describe('TiltStatusInput Schema', () => {
  it('accepts empty input', () => {
    expect(() => TiltStatusInput.parse({})).not.toThrow();
  });
});

describe('TiltGetResourcesInput Schema', () => {
  it('accepts filter and labels', () => {
    const input = {
      filter: 'app=frontend',
      labels: ['tier-web', 'env-prod'],
    };
    expect(() => TiltGetResourcesInput.parse(input)).not.toThrow();
  });

  it('accepts empty input', () => {
    expect(() => TiltGetResourcesInput.parse({})).not.toThrow();
  });

  it('validates filter', () => {
    expect(() =>
      TiltGetResourcesInput.parse({ filter: 'app=frontend;rm -rf /' }),
    ).toThrow();
  });

  it('validates labels array', () => {
    expect(() =>
      TiltGetResourcesInput.parse({ labels: ['valid-label', '_invalid'] }),
    ).toThrow();
  });

  it('accepts verbose parameter', () => {
    expect(() => TiltGetResourcesInput.parse({ verbose: true })).not.toThrow();
    expect(() => TiltGetResourcesInput.parse({ verbose: false })).not.toThrow();
  });

  it('defaults verbose to false', () => {
    const result = TiltGetResourcesInput.parse({});
    expect(result.verbose).toBe(false);
  });

  it('accepts status parameter', () => {
    expect(() => TiltGetResourcesInput.parse({ status: 'ok' })).not.toThrow();
    expect(() =>
      TiltGetResourcesInput.parse({ status: 'error' }),
    ).not.toThrow();
    expect(() =>
      TiltGetResourcesInput.parse({ status: 'pending' }),
    ).not.toThrow();
    expect(() =>
      TiltGetResourcesInput.parse({ status: 'building' }),
    ).not.toThrow();
    expect(() =>
      TiltGetResourcesInput.parse({ status: 'disabled' }),
    ).not.toThrow();
    expect(() => TiltGetResourcesInput.parse({ status: 'all' })).not.toThrow();
  });

  it('defaults status to all', () => {
    const result = TiltGetResourcesInput.parse({});
    expect(result.status).toBe('all');
  });

  it('rejects invalid status values', () => {
    expect(() => TiltGetResourcesInput.parse({ status: 'running' })).toThrow();
    expect(() => TiltGetResourcesInput.parse({ status: 'stopped' })).toThrow();
  });

  it('accepts limit and offset', () => {
    expect(() =>
      TiltGetResourcesInput.parse({ limit: 10, offset: 5 }),
    ).not.toThrow();
    expect(() => TiltGetResourcesInput.parse({ limit: 1 })).not.toThrow();
    expect(() => TiltGetResourcesInput.parse({ limit: 100 })).not.toThrow();
    expect(() => TiltGetResourcesInput.parse({ offset: 0 })).not.toThrow();
  });

  it('defaults limit to 20 and offset to 0', () => {
    const result = TiltGetResourcesInput.parse({});
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('rejects invalid limit values', () => {
    expect(() => TiltGetResourcesInput.parse({ limit: 0 })).toThrow();
    expect(() => TiltGetResourcesInput.parse({ limit: -1 })).toThrow();
    expect(() => TiltGetResourcesInput.parse({ limit: 101 })).toThrow();
    expect(() => TiltGetResourcesInput.parse({ limit: 1.5 })).toThrow();
  });

  it('rejects invalid offset values', () => {
    expect(() => TiltGetResourcesInput.parse({ offset: -1 })).toThrow();
    expect(() => TiltGetResourcesInput.parse({ offset: 0.5 })).toThrow();
  });
});

describe('TiltDescribeResourceInput Schema', () => {
  it('accepts valid resourceName', () => {
    expect(() =>
      TiltDescribeResourceInput.parse({ resourceName: 'my-service' }),
    ).not.toThrow();
  });

  it('requires resourceName', () => {
    expect(() => TiltDescribeResourceInput.parse({})).toThrow();
  });

  it('validates resourceName', () => {
    expect(() =>
      TiltDescribeResourceInput.parse({ resourceName: '../../../etc/passwd' }),
    ).toThrow();
  });
});

describe('TiltLogsInput Schema', () => {
  it('accepts all log options', () => {
    const input = {
      resourceName: 'my-service',
      // Note: follow removed from schema - MCP tools cannot stream
      tailLines: 100,
      level: 'error' as const,
      source: 'runtime' as const,
      search: {
        query: 'ERROR',
        mode: 'regex' as const,
        caseSensitive: false,
        flags: 'im',
      },
    };
    expect(() => TiltLogsInput.parse(input)).not.toThrow();
  });

  it('accepts minimal input', () => {
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'my-service' }),
    ).not.toThrow();
  });

  it('requires resourceName', () => {
    expect(() => TiltLogsInput.parse({})).toThrow();
  });

  it('validates tailLines is positive', () => {
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', tailLines: 0 }),
    ).toThrow();
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', tailLines: -10 }),
    ).toThrow();
  });

  it('validates tailLines max value', () => {
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', tailLines: 10001 }),
    ).toThrow();
  });

  it('accepts valid tailLines', () => {
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', tailLines: 1 }),
    ).not.toThrow();
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', tailLines: 10000 }),
    ).not.toThrow();
  });

  it('defaults tailLines to 100', () => {
    const result = TiltLogsInput.parse({ resourceName: 'svc' });
    expect(result.tailLines).toBe(100);
  });

  it('validates level enum', () => {
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', level: 'warn' }),
    ).not.toThrow();
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', level: 'error' }),
    ).not.toThrow();
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', level: 'info' }),
    ).toThrow();
  });

  it('validates source enum', () => {
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', source: 'all' }),
    ).not.toThrow();
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', source: 'build' }),
    ).not.toThrow();
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', source: 'runtime' }),
    ).not.toThrow();
    expect(() =>
      TiltLogsInput.parse({ resourceName: 'svc', source: 'invalid' }),
    ).toThrow();
  });

  it('accepts substring search and defaults mode/case', () => {
    const result = TiltLogsInput.parse({
      resourceName: 'svc',
      search: { query: 'ERROR' },
    });
    expect(result.search?.mode).toBe('substring');
    expect(result.search?.caseSensitive).toBe(true);
  });

  it('validates search flags', () => {
    expect(() =>
      TiltLogsInput.parse({
        resourceName: 'svc',
        search: { query: '.*', mode: 'regex', flags: 'im' },
      }),
    ).not.toThrow();

    expect(() =>
      TiltLogsInput.parse({
        resourceName: 'svc',
        search: { query: '.*', mode: 'regex', flags: 'gi' },
      }),
    ).toThrow();
  });
});

describe('TiltTriggerInput Schema', () => {
  it('accepts valid resourceName', () => {
    expect(() =>
      TiltTriggerInput.parse({ resourceName: 'my-service' }),
    ).not.toThrow();
  });

  it('requires resourceName', () => {
    expect(() => TiltTriggerInput.parse({})).toThrow();
  });
});

describe('TiltEnableInput Schema', () => {
  it('accepts valid resourceName', () => {
    expect(() =>
      TiltEnableInput.parse({ resourceName: 'my-service' }),
    ).not.toThrow();
  });

  it('requires resourceName', () => {
    expect(() => TiltEnableInput.parse({})).toThrow();
  });
});

describe('TiltDisableInput Schema', () => {
  it('accepts valid resourceName', () => {
    expect(() =>
      TiltDisableInput.parse({ resourceName: 'my-service' }),
    ).not.toThrow();
  });

  it('requires resourceName', () => {
    expect(() => TiltDisableInput.parse({})).toThrow();
  });
});

describe('TiltArgsInput Schema', () => {
  it('accepts valid args array', () => {
    const input = { args: ['--config=./tilt.yaml', '--debug'] };
    expect(() => TiltArgsInput.parse(input)).not.toThrow();
  });

  it('accepts empty args (validation happens in tool handler)', () => {
    // Schema accepts empty args - the tool handler validates
    expect(() => TiltArgsInput.parse({ args: [] })).not.toThrow();
  });

  it('accepts clear flag', () => {
    expect(() => TiltArgsInput.parse({ clear: true })).not.toThrow();
  });

  it('accepts empty input (validation happens in tool handler)', () => {
    // Schema accepts empty - the tool handler validates to prevent interactive editor
    expect(() => TiltArgsInput.parse({})).not.toThrow();
  });

  it('validates args for shell injection', () => {
    expect(() => TiltArgsInput.parse({ args: ['arg;rm -rf /'] })).toThrow();
  });

  it('accepts clear=false with non-empty args', () => {
    expect(() =>
      TiltArgsInput.parse({ args: ['frontend'], clear: false }),
    ).not.toThrow();
  });
});

describe('TiltWaitInput Schema', () => {
  it('accepts resources array', () => {
    const input = { resources: ['frontend', 'backend'] };
    expect(() => TiltWaitInput.parse(input)).not.toThrow();
  });

  it('accepts timeout', () => {
    const input = { timeout: 60 };
    expect(() => TiltWaitInput.parse(input)).not.toThrow();
  });

  it('accepts condition', () => {
    const input = { condition: 'Ready' };
    expect(() => TiltWaitInput.parse(input)).not.toThrow();
  });

  it('accepts empty input', () => {
    expect(() => TiltWaitInput.parse({})).not.toThrow();
  });

  it('defaults condition to Ready', () => {
    const result = TiltWaitInput.parse({});
    expect(result.condition).toBe('Ready');
  });

  it('validates timeout is positive', () => {
    expect(() => TiltWaitInput.parse({ timeout: 0 })).toThrow();
    expect(() => TiltWaitInput.parse({ timeout: -10 })).toThrow();
  });

  it('validates timeout max value', () => {
    expect(() => TiltWaitInput.parse({ timeout: 601 })).toThrow();
  });

  it('validates resource names', () => {
    expect(() =>
      TiltWaitInput.parse({ resources: ['valid', '../../../etc/passwd'] }),
    ).toThrow();
  });
});

describe('TiltDumpInput Schema', () => {
  it('accepts json format', () => {
    const input = { format: 'json' };
    expect(() => TiltDumpInput.parse(input)).not.toThrow();
  });

  it('accepts yaml format', () => {
    const input = { format: 'yaml' };
    expect(() => TiltDumpInput.parse(input)).not.toThrow();
  });

  it('accepts empty input', () => {
    expect(() => TiltDumpInput.parse({})).not.toThrow();
  });

  it('defaults format to json', () => {
    const result = TiltDumpInput.parse({});
    expect(result.format).toBe('json');
  });

  it('rejects invalid format', () => {
    expect(() => TiltDumpInput.parse({ format: 'xml' })).toThrow();
  });
});
