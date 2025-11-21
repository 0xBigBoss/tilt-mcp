# Tilt MCP Demo Tiltfile
# Demonstrates local_resource capabilities for development workflows

# Build the TypeScript project
local_resource(
    "build",
    cmd = "bun run build",
    labels = ["build"],
    resource_deps = ["install"],
    deps = [
        "package.json",
        "src",
        "tsconfig.json",
    ],
)

# Run tests with watch mode
local_resource(
    "test",
    auto_init = True,
    cmd = "bun test",
    labels = ["test"],
    resource_deps = ["install"],
    trigger_mode = TRIGGER_MODE_AUTO,
    deps = [
        "src",
        "tests",
    ],
)

# Type checking
local_resource(
    "typecheck",
    auto_init = False,
    cmd = "bun run typecheck",
    labels = ["quality"],
    resource_deps = ["install"],
    trigger_mode = TRIGGER_MODE_MANUAL,
    deps = [
        "src",
        "tsconfig.json",
    ],
)

# Linting
local_resource(
    "lint",
    auto_init = False,
    cmd = "bun run lint",
    labels = ["quality"],
    resource_deps = ["install"],
    trigger_mode = TRIGGER_MODE_MANUAL,
    deps = [
        "src",
        "tests",
    ],
)

# Example: Simulate a database or background service
local_resource(
    "mock-tilt-service",
    auto_init = True,
    labels = ["services"],
    serve_cmd = """
echo '
    console.log("Mock Tilt service running...");
    Bun.serve({
        port: 0,
        fetch(req) {
            return new Response("Hello from Tilt!");
        },
    })
' | bun run -
""",
)

# Dependency installation watcher
local_resource(
    "install",
    cmd = "bun install",
    labels = ["deps"],
    trigger_mode = TRIGGER_MODE_AUTO,
    deps = [
        "package.json",
        "package-lock.json",
    ],
)

# Documentation generator (manual trigger)
local_resource(
    "docs",
    auto_init = False,
    cmd = "bun run docs",
    labels = ["docs"],
    trigger_mode = TRIGGER_MODE_MANUAL,
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

