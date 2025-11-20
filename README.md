# Tilt MCP Server

MCP (Model Context Protocol) server for Tilt CLI integration, providing AI assistants with access to Tilt development workflows.

## Project Status

**Phase 1: In Development**

This project is currently in active development. The initial setup is complete and the project structure is in place.

## Features (Planned)

- **Session Discovery**: Find and connect to running Tilt instances
- **Status Monitoring**: Get real-time status of resources
- **Resource Management**: List, describe, and trigger Tilt resources
- **Log Access**: Stream logs from Tilt resources
- **WebSocket Streaming**: Real-time updates via Tilt's API server

## Prerequisites

- Node.js 20.x or later
- Tilt CLI (v0.35.0 or later)
- TypeScript 5.3+
- Bun 1.3+ (used for the test runner)

## Installation

```bash
npm install
```

## Development

### Build

```bash
npm run build
```

### Run in Development Mode

```bash
npm run dev
```

### Testing

```bash
# Run all tests (uses Bun)
npm test          # or: bun test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

## Project Structure

```
tilt-mcp/
├── src/
│   ├── server.ts          # MCP server entry point
│   ├── tools/             # MCP tool implementations
│   └── tilt/              # Tilt CLI client and utilities
├── tests/
│   ├── tools/             # Tool tests
│   ├── tilt/              # Client tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test fixtures
├── docs/                  # Design documents and specs
└── dist/                  # Compiled output
```

## Documentation

- [Phase 1 Implementation Plan](docs/phase1-plan.md)
- [Phase 1 Readiness Checklist](docs/phase1-readiness.md)

## License

MIT

## Contributing

This project is in early development. Contribution guidelines will be added soon.
