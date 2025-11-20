/**
 * Smoke test to verify project setup is correct
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

describe('Project Setup', () => {
  test('package.json exists and has correct configuration', () => {
    const pkgPath = join(projectRoot, 'package.json');
    expect(existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    
    // Must be ES module
    expect(pkg.type).toBe('module');
    
    // Required scripts
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.build).toBe('tsc');
    expect(pkg.scripts.dev).toBe('tsx watch src/server.ts');
    expect(pkg.scripts.start).toBe('node dist/server.js');
    expect(pkg.scripts.test).toBe('vitest');
    expect(pkg.scripts['test:watch']).toBe('vitest --watch');
    expect(pkg.scripts['test:integration']).toBe('vitest --run tests/integration');
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit');
    expect(pkg.scripts.lint).toBe('eslint src tests');
    expect(pkg.scripts['lint:fix']).toBe('eslint src tests --fix');
    
    // Required dependencies
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
    expect(pkg.dependencies['@anthropic-ai/claude-agent-sdk']).toBeDefined();
    expect(pkg.dependencies['ws']).toBeDefined();
    expect(pkg.dependencies['zod']).toBeDefined();
    
    // Required dev dependencies
    expect(pkg.devDependencies).toBeDefined();
    expect(pkg.devDependencies['@types/node']).toBeDefined();
    expect(pkg.devDependencies['@types/ws']).toBeDefined();
    expect(pkg.devDependencies['typescript']).toBeDefined();
    expect(pkg.devDependencies['tsx']).toBeDefined();
    expect(pkg.devDependencies['vitest']).toBeDefined();
    expect(pkg.devDependencies['eslint']).toBeDefined();
    expect(pkg.devDependencies['@typescript-eslint/eslint-plugin']).toBeDefined();
    expect(pkg.devDependencies['@typescript-eslint/parser']).toBeDefined();
  });

  test('tsconfig.json exists with strict configuration', () => {
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

  test('eslint configuration exists', () => {
    const eslintPath = join(projectRoot, '.eslintrc.json');
    expect(existsSync(eslintPath)).toBe(true);
    
    const eslintConfig = JSON.parse(readFileSync(eslintPath, 'utf-8'));
    expect(eslintConfig.parser).toBe('@typescript-eslint/parser');
    expect(eslintConfig.plugins).toContain('@typescript-eslint');
  });

  test('gitignore exists with required entries', () => {
    const gitignorePath = join(projectRoot, '.gitignore');
    expect(existsSync(gitignorePath)).toBe(true);
    
    const gitignore = readFileSync(gitignorePath, 'utf-8');
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('dist');
    expect(gitignore).toContain('coverage');
  });

  test('required directories exist', () => {
    expect(existsSync(join(projectRoot, 'src', 'tools'))).toBe(true);
    expect(existsSync(join(projectRoot, 'src', 'tilt'))).toBe(true);
    expect(existsSync(join(projectRoot, 'tests', 'tools'))).toBe(true);
    expect(existsSync(join(projectRoot, 'tests', 'tilt'))).toBe(true);
    expect(existsSync(join(projectRoot, 'tests', 'integration'))).toBe(true);
    expect(existsSync(join(projectRoot, 'tests', 'fixtures'))).toBe(true);
  });
});
