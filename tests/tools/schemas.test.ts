import { describe, test, expect } from 'vitest';
import {
  TiltBaseInput,
  ResourceNameSchema,
  LabelSchema,
  PortRangeSchema,
  FilterSchema,
  TiltfileArgsSchema,
  TiltDiscoverInput,
  TiltStatusInput,
  TiltGetResourcesInput,
  TiltDescribeResourceInput,
  TiltLogsInput,
  TiltTriggerInput,
  TiltEnableInput,
  TiltDisableInput,
  TiltArgsInput,
} from '../../src/tools/schemas';

describe('TiltBaseInput Schema', () => {
  describe('port validation', () => {
    test('accepts valid port numbers', () => {
      expect(() => TiltBaseInput.parse({ tiltPort: 1 })).not.toThrow();
      expect(() => TiltBaseInput.parse({ tiltPort: 8080 })).not.toThrow();
      expect(() => TiltBaseInput.parse({ tiltPort: 65535 })).not.toThrow();
    });

    test('accepts undefined port (optional)', () => {
      expect(() => TiltBaseInput.parse({})).not.toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: 'localhost' })).not.toThrow();
    });

    test('rejects port 0', () => {
      expect(() => TiltBaseInput.parse({ tiltPort: 0 })).toThrow();
    });

    test('rejects negative ports', () => {
      expect(() => TiltBaseInput.parse({ tiltPort: -1 })).toThrow();
      expect(() => TiltBaseInput.parse({ tiltPort: -8080 })).toThrow();
    });

    test('rejects port > 65535', () => {
      expect(() => TiltBaseInput.parse({ tiltPort: 65536 })).toThrow();
      expect(() => TiltBaseInput.parse({ tiltPort: 99999 })).toThrow();
    });

    test('rejects non-integer ports', () => {
      expect(() => TiltBaseInput.parse({ tiltPort: 80.5 })).toThrow();
      expect(() => TiltBaseInput.parse({ tiltPort: 3.14 })).toThrow();
    });

    test('rejects non-numeric ports', () => {
      expect(() => TiltBaseInput.parse({ tiltPort: '8080' })).toThrow();
      expect(() => TiltBaseInput.parse({ tiltPort: 'abc' })).toThrow();
    });
  });

  describe('host validation', () => {
    test('accepts valid hostnames', () => {
      expect(() => TiltBaseInput.parse({ tiltHost: 'localhost' })).not.toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: 'tilt-server' })).not.toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: 'api.example.com' })).not.toThrow();
    });

    test('accepts IPv4 addresses', () => {
      expect(() => TiltBaseInput.parse({ tiltHost: '127.0.0.1' })).not.toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: '192.168.1.1' })).not.toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: '10.0.0.1' })).not.toThrow();
    });

    test('accepts IPv6 addresses in bracket notation', () => {
      expect(() => TiltBaseInput.parse({ tiltHost: '[::1]' })).not.toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: '[fe80::1]' })).not.toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: '[2001:db8::1]' })).not.toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: '[::ffff:192.0.2.1]' })).not.toThrow();
    });

    test('accepts undefined host (optional)', () => {
      expect(() => TiltBaseInput.parse({})).not.toThrow();
      expect(() => TiltBaseInput.parse({ tiltPort: 10350 })).not.toThrow();
    });

    test('rejects IPv6 without brackets', () => {
      expect(() => TiltBaseInput.parse({ tiltHost: '::1' })).toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: 'fe80::1' })).toThrow();
    });

    test('rejects hosts with invalid characters', () => {
      expect(() => TiltBaseInput.parse({ tiltHost: 'host@name' })).toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: 'host/path' })).toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: 'host;rm -rf' })).toThrow();
    });

    test('rejects hosts with shell metacharacters', () => {
      expect(() => TiltBaseInput.parse({ tiltHost: 'host`whoami`' })).toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: 'host$(whoami)' })).toThrow();
      expect(() => TiltBaseInput.parse({ tiltHost: 'host&& rm -rf /' })).toThrow();
    });
  });
});

describe('ResourceNameSchema', () => {
  test('accepts valid Kubernetes resource names', () => {
    expect(() => ResourceNameSchema.parse('my-service')).not.toThrow();
    expect(() => ResourceNameSchema.parse('api-v2')).not.toThrow();
    expect(() => ResourceNameSchema.parse('frontend')).not.toThrow();
    expect(() => ResourceNameSchema.parse('backend-db-123')).not.toThrow();
  });

  test('accepts names with dots (DNS subdomain format)', () => {
    expect(() => ResourceNameSchema.parse('my.service')).not.toThrow();
    expect(() => ResourceNameSchema.parse('api.v2.production')).not.toThrow();
  });

  test('accepts single character names', () => {
    expect(() => ResourceNameSchema.parse('a')).not.toThrow();
    expect(() => ResourceNameSchema.parse('1')).not.toThrow();
  });

  test('rejects empty strings', () => {
    expect(() => ResourceNameSchema.parse('')).toThrow();
  });

  test('rejects names > 253 characters', () => {
    const longName = 'a'.repeat(254);
    expect(() => ResourceNameSchema.parse(longName)).toThrow();
  });

  test('rejects names starting with hyphen', () => {
    expect(() => ResourceNameSchema.parse('-my-service')).toThrow();
  });

  test('rejects names ending with hyphen', () => {
    expect(() => ResourceNameSchema.parse('my-service-')).toThrow();
  });

  test('rejects names with uppercase letters', () => {
    expect(() => ResourceNameSchema.parse('My-Service')).toThrow();
    expect(() => ResourceNameSchema.parse('API')).toThrow();
  });

  test('rejects names with underscores', () => {
    expect(() => ResourceNameSchema.parse('my_service')).toThrow();
  });

  test('rejects path traversal attempts', () => {
    expect(() => ResourceNameSchema.parse('../../../etc/passwd')).toThrow();
    expect(() => ResourceNameSchema.parse('..')).toThrow();
    expect(() => ResourceNameSchema.parse('.')).toThrow();
  });

  test('rejects special characters', () => {
    expect(() => ResourceNameSchema.parse('service@name')).toThrow();
    expect(() => ResourceNameSchema.parse('service/name')).toThrow();
    expect(() => ResourceNameSchema.parse('service;rm')).toThrow();
  });

  test('rejects shell injection attempts', () => {
    expect(() => ResourceNameSchema.parse('service`whoami`')).toThrow();
    expect(() => ResourceNameSchema.parse('service$(rm -rf /)')).toThrow();
    expect(() => ResourceNameSchema.parse('service && ls')).toThrow();
  });
});

describe('LabelSchema', () => {
  test('accepts valid labels', () => {
    expect(() => LabelSchema.parse('app')).not.toThrow();
    expect(() => LabelSchema.parse('tier-frontend')).not.toThrow();
    expect(() => LabelSchema.parse('VERSION-123')).not.toThrow();
  });

  test('accepts alphanumeric labels', () => {
    expect(() => LabelSchema.parse('app123')).not.toThrow();
    expect(() => LabelSchema.parse('ABC')).not.toThrow();
    expect(() => LabelSchema.parse('123')).not.toThrow();
  });

  test('accepts single character labels', () => {
    expect(() => LabelSchema.parse('a')).not.toThrow();
    expect(() => LabelSchema.parse('1')).not.toThrow();
  });

  test('rejects labels starting with hyphen', () => {
    expect(() => LabelSchema.parse('-app')).toThrow();
  });

  test('rejects labels ending with hyphen', () => {
    expect(() => LabelSchema.parse('app-')).toThrow();
  });

  test('rejects labels with special characters', () => {
    expect(() => LabelSchema.parse('app_name')).toThrow();
    expect(() => LabelSchema.parse('app.name')).toThrow();
    expect(() => LabelSchema.parse('app@name')).toThrow();
  });

  test('rejects empty labels', () => {
    expect(() => LabelSchema.parse('')).toThrow();
  });
});

describe('PortRangeSchema', () => {
  test('accepts valid port ranges', () => {
    expect(() => PortRangeSchema.parse([10350, 10354])).not.toThrow();
    expect(() => PortRangeSchema.parse([1, 65535])).not.toThrow();
    expect(() => PortRangeSchema.parse([8080, 8080])).not.toThrow(); // Same port
  });

  test('rejects start port > end port', () => {
    expect(() => PortRangeSchema.parse([10354, 10350])).toThrow(/Start port must be <= end port/);
    expect(() => PortRangeSchema.parse([8080, 8079])).toThrow(/Start port must be <= end port/);
  });

  test('rejects invalid port numbers in range', () => {
    expect(() => PortRangeSchema.parse([0, 100])).toThrow();
    expect(() => PortRangeSchema.parse([100, 65536])).toThrow();
    expect(() => PortRangeSchema.parse([-1, 100])).toThrow();
  });

  test('rejects non-integer ports', () => {
    expect(() => PortRangeSchema.parse([80.5, 90])).toThrow();
    expect(() => PortRangeSchema.parse([80, 90.5])).toThrow();
  });

  test('rejects wrong tuple size', () => {
    expect(() => PortRangeSchema.parse([8080])).toThrow();
    expect(() => PortRangeSchema.parse([8080, 8090, 8100])).toThrow();
  });
});

describe('FilterSchema', () => {
  test('accepts safe filter strings', () => {
    expect(() => FilterSchema.parse('app=frontend')).not.toThrow();
    expect(() => FilterSchema.parse('tier=web,env=prod')).not.toThrow();
    expect(() => FilterSchema.parse('version.1_0')).not.toThrow();
    expect(() => FilterSchema.parse('key-name=value-123')).not.toThrow();
  });

  test('accepts empty strings', () => {
    expect(() => FilterSchema.parse('')).not.toThrow();
  });

  test('accepts spaces', () => {
    expect(() => FilterSchema.parse('app = frontend')).not.toThrow();
  });

  test('rejects strings > 256 characters', () => {
    const longFilter = 'a=b,'.repeat(100); // > 256 chars
    expect(() => FilterSchema.parse(longFilter)).toThrow();
  });

  test('rejects shell metacharacters', () => {
    expect(() => FilterSchema.parse('app=frontend;rm -rf /')).toThrow(/invalid characters/);
    expect(() => FilterSchema.parse('app=`whoami`')).toThrow(/invalid characters/);
    expect(() => FilterSchema.parse('app=$(ls)')).toThrow(/invalid characters/);
  });

  test('rejects special characters', () => {
    expect(() => FilterSchema.parse('app=frontend&tier=web')).toThrow(/invalid characters/);
    expect(() => FilterSchema.parse('app=frontend|tier=web')).toThrow(/invalid characters/);
    expect(() => FilterSchema.parse('app=frontend<tier')).toThrow(/invalid characters/);
  });

  test('rejects path traversal attempts', () => {
    expect(() => FilterSchema.parse('../../../etc')).toThrow(/invalid characters/);
  });
});

describe('TiltfileArgsSchema', () => {
  test('accepts safe argument arrays', () => {
    expect(() => TiltfileArgsSchema.parse(['--arg1=value1'])).not.toThrow();
    expect(() => TiltfileArgsSchema.parse(['--config=./config.yaml'])).not.toThrow();
    expect(() => TiltfileArgsSchema.parse(['arg1', 'arg2', 'arg3'])).not.toThrow();
  });

  test('accepts arguments with hyphens and underscores', () => {
    expect(() => TiltfileArgsSchema.parse(['--my-arg'])).not.toThrow();
    expect(() => TiltfileArgsSchema.parse(['my_value'])).not.toThrow();
  });

  test('accepts paths with slashes', () => {
    expect(() => TiltfileArgsSchema.parse(['path/to/file'])).not.toThrow();
    expect(() => TiltfileArgsSchema.parse(['/absolute/path'])).not.toThrow();
  });

  test('accepts empty array', () => {
    expect(() => TiltfileArgsSchema.parse([])).not.toThrow();
  });

  test('rejects arguments > 256 characters', () => {
    const longArg = 'a'.repeat(257);
    expect(() => TiltfileArgsSchema.parse([longArg])).toThrow();
  });

  test('rejects shell metacharacters', () => {
    expect(() => TiltfileArgsSchema.parse(['arg;rm -rf /'])).toThrow(/Invalid arg format/);
    expect(() => TiltfileArgsSchema.parse(['arg`whoami`'])).toThrow(/Invalid arg format/);
    expect(() => TiltfileArgsSchema.parse(['arg$(ls)'])).toThrow(/Invalid arg format/);
  });

  test('rejects special characters', () => {
    expect(() => TiltfileArgsSchema.parse(['arg&value'])).toThrow(/Invalid arg format/);
    expect(() => TiltfileArgsSchema.parse(['arg|value'])).toThrow(/Invalid arg format/);
    expect(() => TiltfileArgsSchema.parse(['arg<value'])).toThrow(/Invalid arg format/);
  });

  test('rejects spaces in arguments', () => {
    expect(() => TiltfileArgsSchema.parse(['arg with spaces'])).toThrow(/Invalid arg format/);
  });
});

describe('TiltDiscoverInput Schema', () => {
  test('accepts base input with portRange', () => {
    const input = { portRange: [10350, 10354] as [number, number] };
    expect(() => TiltDiscoverInput.parse(input)).not.toThrow();
  });

  test('uses default portRange when not provided', () => {
    const result = TiltDiscoverInput.parse({});
    expect(result.portRange).toEqual([10350, 10354]);
  });

  test('accepts custom portRange', () => {
    const input = { portRange: [8000, 9000] as [number, number] };
    const result = TiltDiscoverInput.parse(input);
    expect(result.portRange).toEqual([8000, 9000]);
  });

  test('validates portRange', () => {
    expect(() => TiltDiscoverInput.parse({ portRange: [9000, 8000] })).toThrow();
  });
});

describe('TiltStatusInput Schema', () => {
  test('accepts empty input', () => {
    expect(() => TiltStatusInput.parse({})).not.toThrow();
  });

  test('accepts base input fields', () => {
    expect(() => TiltStatusInput.parse({ tiltPort: 10350, tiltHost: 'localhost' })).not.toThrow();
  });
});

describe('TiltGetResourcesInput Schema', () => {
  test('accepts filter and labels', () => {
    const input = {
      filter: 'app=frontend',
      labels: ['tier-web', 'env-prod'],
    };
    expect(() => TiltGetResourcesInput.parse(input)).not.toThrow();
  });

  test('accepts empty input', () => {
    expect(() => TiltGetResourcesInput.parse({})).not.toThrow();
  });

  test('validates filter', () => {
    expect(() => TiltGetResourcesInput.parse({ filter: 'app=frontend;rm -rf /' })).toThrow();
  });

  test('validates labels array', () => {
    expect(() => TiltGetResourcesInput.parse({ labels: ['valid-label', '_invalid'] })).toThrow();
  });
});

describe('TiltDescribeResourceInput Schema', () => {
  test('accepts valid resourceName', () => {
    expect(() => TiltDescribeResourceInput.parse({ resourceName: 'my-service' })).not.toThrow();
  });

  test('requires resourceName', () => {
    expect(() => TiltDescribeResourceInput.parse({})).toThrow();
  });

  test('validates resourceName', () => {
    expect(() => TiltDescribeResourceInput.parse({ resourceName: '../../../etc/passwd' })).toThrow();
  });
});

describe('TiltLogsInput Schema', () => {
  test('accepts all log options', () => {
    const input = {
      resourceName: 'my-service',
      follow: true,
      tailLines: 100,
      level: 'error' as const,
      source: 'runtime' as const,
    };
    expect(() => TiltLogsInput.parse(input)).not.toThrow();
  });

  test('accepts minimal input', () => {
    expect(() => TiltLogsInput.parse({ resourceName: 'my-service' })).not.toThrow();
  });

  test('requires resourceName', () => {
    expect(() => TiltLogsInput.parse({})).toThrow();
  });

  test('validates tailLines is positive', () => {
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', tailLines: 0 })).toThrow();
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', tailLines: -10 })).toThrow();
  });

  test('validates tailLines max value', () => {
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', tailLines: 10001 })).toThrow();
  });

  test('accepts valid tailLines', () => {
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', tailLines: 1 })).not.toThrow();
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', tailLines: 10000 })).not.toThrow();
  });

  test('validates level enum', () => {
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', level: 'warn' })).not.toThrow();
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', level: 'error' })).not.toThrow();
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', level: 'info' })).toThrow();
  });

  test('validates source enum', () => {
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', source: 'all' })).not.toThrow();
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', source: 'build' })).not.toThrow();
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', source: 'runtime' })).not.toThrow();
    expect(() => TiltLogsInput.parse({ resourceName: 'svc', source: 'invalid' })).toThrow();
  });
});

describe('TiltTriggerInput Schema', () => {
  test('accepts valid resourceName', () => {
    expect(() => TiltTriggerInput.parse({ resourceName: 'my-service' })).not.toThrow();
  });

  test('requires resourceName', () => {
    expect(() => TiltTriggerInput.parse({})).toThrow();
  });
});

describe('TiltEnableInput Schema', () => {
  test('accepts valid resourceName', () => {
    expect(() => TiltEnableInput.parse({ resourceName: 'my-service' })).not.toThrow();
  });

  test('requires resourceName', () => {
    expect(() => TiltEnableInput.parse({})).toThrow();
  });
});

describe('TiltDisableInput Schema', () => {
  test('accepts valid resourceName', () => {
    expect(() => TiltDisableInput.parse({ resourceName: 'my-service' })).not.toThrow();
  });

  test('requires resourceName', () => {
    expect(() => TiltDisableInput.parse({})).toThrow();
  });
});

describe('TiltArgsInput Schema', () => {
  test('accepts valid args array', () => {
    const input = { args: ['--config=./tilt.yaml', '--debug'] };
    expect(() => TiltArgsInput.parse(input)).not.toThrow();
  });

  test('accepts empty args', () => {
    expect(() => TiltArgsInput.parse({ args: [] })).not.toThrow();
  });

  test('validates args', () => {
    expect(() => TiltArgsInput.parse({ args: ['arg;rm -rf /'] })).toThrow();
  });
});
