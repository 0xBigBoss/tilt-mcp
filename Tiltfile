# Tilt MCP Demo Tiltfile
# Demonstrates local_resource capabilities for development workflows

# Build the TypeScript project
local_resource(
    'build',
    cmd='npm run build',
    deps=['src', 'package.json', 'tsconfig.json'],
    labels=['build'],
)

# Run tests with watch mode
local_resource(
    'test',
    cmd='npm test',
    deps=['src', 'tests'],
    labels=['test'],
    auto_init=True,
    trigger_mode=TRIGGER_MODE_AUTO,
)

# Type checking
local_resource(
    'typecheck',
    cmd='npm run typecheck',
    deps=['src', 'tsconfig.json'],
    labels=['quality'],
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
)

# Linting
local_resource(
    'lint',
    cmd='npm run lint',
    deps=['src', 'tests'],
    labels=['quality'],
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
)

# MCP Server (development mode)
local_resource(
    'mcp-server',
    serve_cmd='npm run dev',
    deps=['src', 'package.json'],
    labels=['server'],
    resource_deps=['build'],
    readiness_probe=probe(
        period_secs=5,
        exec=exec_action(['sh', '-c', 'pgrep -f "node.*mcp-server" > /dev/null'])
    ),
)

# Example: Simulate a database or background service
local_resource(
    'mock-tilt-service',
    serve_cmd='node scripts/mock-service.js',
    labels=['services'],
    auto_init=True,
)

# Dependency installation watcher
local_resource(
    'install',
    cmd='npm install',
    deps=['package.json', 'package-lock.json'],
    labels=['deps'],
    trigger_mode=TRIGGER_MODE_AUTO,
)

# Documentation generator (manual trigger)
local_resource(
    'docs',
    cmd='npm run docs',
    labels=['docs'],
    auto_init=False,
    trigger_mode=TRIGGER_MODE_MANUAL,
)

print("""
╔══════════════════════════════════════════════════════════════╗
║           Tilt MCP Development Environment                   ║
╚══════════════════════════════════════════════════════════════╝

Resources organized by labels:
  - build:    TypeScript compilation
  - test:     Automated testing
  - quality:  Type checking and linting (manual)
  - server:   MCP server in dev mode
  - services: Mock services for testing
  - deps:     Dependency management
  - docs:     Documentation generation (manual)

Quick commands:
  - Press 'space' to open Tilt UI
  - Click resource name to view logs
  - Use trigger button for manual resources
""")
