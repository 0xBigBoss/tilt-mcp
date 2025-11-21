/**
 * Smoke test to verify project setup is correct
 */
import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('Project Setup', () => {
  it('package.json exists and has correct configuration', () => {
    const pkgPath = join(projectRoot, 'package.json');
    expect(existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    // Must be ES module
    expect(pkg.type).toBe('module');

    // Required scripts
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.build).toBe(
      'bun build src/server.ts --outdir dist --target bun',
    );
    expect(pkg.scripts.dev).toBe('bun --watch src/server.ts');
    expect(pkg.scripts.start).toBe('bun dist/server.js');
    expect(pkg.scripts.test).toBe('bun test');
    expect(pkg.scripts['test:watch']).toBe('bun test --watch');
    expect(pkg.scripts['test:integration']).toBe('bun test tests/integration');
    expect(pkg.scripts.typecheck).toBe('tsgo --noEmit');
    expect(pkg.scripts.lint).toBe('biome check src tests');
    expect(pkg.scripts['lint:fix']).toBe('biome check --write src tests');

    // Required dependencies
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
    expect(pkg.dependencies['@anthropic-ai/claude-agent-sdk']).toBeDefined();
    expect(pkg.dependencies.ws).toBeDefined();
    expect(pkg.dependencies.zod).toBeDefined();

    // Required dev dependencies (Bun-first, no tsx or @types/node)
    expect(pkg.devDependencies).toBeDefined();
    expect(pkg.devDependencies['@types/ws']).toBeDefined();
    expect(pkg.devDependencies.typescript).toBeDefined();
    expect(pkg.devDependencies['bun-types']).toBeDefined();
    expect(pkg.devDependencies['@biomejs/biome']).toBeDefined();
  });

  it('tsconfig.json exists with strict configuration', () => {
    const tsconfigPath = join(projectRoot, 'tsconfig.json');
    expect(existsSync(tsconfigPath)).toBe(true);

    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    expect(tsconfig.compilerOptions).toBeDefined();
    expect(tsconfig.compilerOptions.target).toBe('ES2022');
    expect(tsconfig.compilerOptions.module).toBe('ES2022');
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.outDir).toBe('./dist');
    expect(tsconfig.compilerOptions.rootDir).toBe('./src');
  });

  it('biome configuration exists', () => {
    const biomePath = join(projectRoot, 'biome.json');
    expect(existsSync(biomePath)).toBe(true);

    const biomeConfig = JSON.parse(readFileSync(biomePath, 'utf-8'));
    expect(biomeConfig.$schema).toContain('biomejs.dev');
  });

  it('gitignore exists with required entries', () => {
    const gitignorePath = join(projectRoot, '.gitignore');
    expect(existsSync(gitignorePath)).toBe(true);

    const gitignore = readFileSync(gitignorePath, 'utf-8');
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('dist');
    expect(gitignore).toContain('coverage');
  });

  it('required directories exist', () => {
    expect(existsSync(join(projectRoot, 'src', 'tools'))).toBe(true);
    expect(existsSync(join(projectRoot, 'src', 'tilt'))).toBe(true);
    expect(existsSync(join(projectRoot, 'tests', 'tools'))).toBe(true);
    expect(existsSync(join(projectRoot, 'tests', 'tilt'))).toBe(true);
    expect(existsSync(join(projectRoot, 'tests', 'integration'))).toBe(true);
    expect(existsSync(join(projectRoot, 'tests', 'fixtures'))).toBe(true);
  });
});
