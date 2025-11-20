# Codex Review Feedback - Tilt MCP Project

**Review Date**: 2025-11-20
**Reviewer**: OpenAI Codex (yolocodex CLI)
**Model**: gpt-5.1-codex-max
**Documents Reviewed**: `.claude/CLAUDE.md`, `docs/mcp-configuration-proposal.md`

## Executive Summary

The review identified a solid foundation with the hybrid API/CLI architecture and comprehensive tool list, but raised critical concerns about:
- Unverified Tilt API endpoints and CLI commands
- Missing streaming/watch implementation details
- Incomplete testing and packaging plans
- Security and input validation specifics
- Process lifecycle management

## Detailed Feedback

### 1. Architecture Design and Approach

#### Strengths
- Hybrid API/CLI strategy provides good latency and availability balance
- Stdio transport appropriate for local CLI integration
- Connection layer with health caching (30s) reduces overhead

#### Concerns
- **Unverified API Endpoints**: Assumes `/api/status`, `tilt get all -o json`, and log query params exist without confirming against actual Tilt versions
- **Streaming Not Addressed**: No design for surfacing streaming logs or status watches over MCP notifications/resources
- **Stale Health Cache**: No per-call override or cache invalidation for operations requiring live sessions (e.g., `tilt logs`)

### 2. Completeness Issues

#### Missing or Incomplete
- **Streaming Implementation**: Explicitly marked "not yet implemented" with no specification for watch/notification flows
- **Missing Dependency**: `@anthropic-ai/claude-agent-sdk` omitted from dependency list despite being stated requirement
- **Testing Details**: High-level strategy without fixture shapes, CLI mocking boundaries, or multi-instance test coverage
- **Packaging Plan**: No npm publish strategy, distribution approach, or versioning strategy
- **Node Version**: Runtime Node.js version requirements not specified

### 3. Potential Issues and Concerns

#### Command/API Correctness
- **Version Compatibility**: `tilt get all -o json` and `/api/status` may not exist or differ by Tilt version
- **No Feature Matrix**: Missing compatibility table or version negotiation mechanism
- **Risk**: Implementation could fail against real Tilt installations

#### Connection Fallback Logic
- **Session State**: CLI fallback may still require running Tilt session; `ensureConnection()` may pick CLI then fail
- **No Preflight Checks**: Missing session-state verification before CLI operations
- **Recommendation**: Add active Tilt detection via API ping or `tilt doctor/status`

#### Discovery and Port Scanning
- **False Positives/Negatives**: Port scanning for discovery lacks timeout/error handling guidance
- **Environment Concerns**: No mitigation for environments where repeated port scanning is undesirable
- **Missing Bounds**: No clear limits on scan attempts or failure modes

#### Security
- **Input Sanitization**: Noted but not specified in detail
- **Command Injection**: Resource names passed to shell commands need strict validation
- **Recommendation**: Strict schemas, escape/arg-array execution only (no string shell concatenation)

#### Process Lifecycle
- **`tilt_up`/`tilt_down` Semantics**: Not defined for long-running processes
- **Concurrency Control**: No guidance on managing multiple Tilt instances or cleanup
- **Idempotency**: Not addressed for control operations

#### Configuration
- **Validation Missing**: No error handling for malformed `.tilt-mcp.json`
- **Conflict Resolution**: Conflicting env/file settings not addressed
- **No Schema**: Configuration file schema not specified

### 4. Suggestions for Improvement

#### Immediate Actions (Phase 1)
1. **Verify Tilt APIs**: Test actual Tilt API endpoints and CLI commands
   - Document compatibility table for Tilt versions
   - Add version check in connection layer before choosing routes
   - Create API/CLI feature matrix

2. **Add Missing Dependency**:
   ```json
   {
     "dependencies": {
       "@anthropic-ai/claude-agent-sdk": "^0.1.0",
       "@modelcontextprotocol/sdk": "^1.0.0",
       "zod": "^3.25.0"
     }
   }
   ```

3. **Session State Checks**:
   - Implement preflight check before CLI operations
   - Detect active Tilt via API ping or `tilt doctor/status`
   - Fail fast with clear guidance instead of silent failures

4. **Input Validation**:
   - Create strict Zod schemas for resource names and arguments
   - Use arg-array execution only (no string shell concatenation)
   - Implement timeout and circuit-breaker policies

#### Design Enhancements (Phase 2)
5. **MCP Streaming Design**:
   - Map Tilt watch/log streams to MCP notifications or resource updates
   - Define backpressure and timeout handling
   - Specify `follow` behavior explicitly for logs
   - Consider MCP notification mechanism for real-time updates

6. **Testing Strategy**:
   - Create fixtures for API/CLI outputs
   - Implement contract tests against pinned Tilt version
   - Add integration tests for multiple instances and port overrides
   - Define CLI mocking boundaries
   - Test failure modes comprehensively

7. **Process Lifecycle Management**:
   - Define idempotency for `tilt_up`/`tilt_down`
   - Implement log capture and cancellation
   - Ensure only one managed process per server
   - Add graceful shutdown handling

8. **Configuration Validation**:
   - Create JSON schema for `.tilt-mcp.json`
   - Implement validation on startup
   - Define clear precedence rules and conflict resolution
   - Add helpful error messages for misconfigurations

#### Production Readiness (Phase 3)
9. **Packaging and Distribution**:
   - Define npm package structure
   - Implement semantic versioning strategy
   - Create release process and changelog
   - Document installation and upgrade paths

10. **Observability**:
    - Add structured logging for tool invocations
    - Track connection method, duration, and Tilt version
    - Implement metrics for health checks and failures
    - Create error taxonomy with user-facing messages

### 5. Missing Considerations

#### Authentication and Security
- **Remote API Access**: Authentication/TLS for remote Tilt API (if ever used)
- **Certificate Handling**: TLS certificate validation and opt-out for plain HTTP
- **Secure Defaults**: Ensure secure-by-default configuration

#### Error Handling
- **Error Taxonomy**: Distinguish between error types:
  - "Tilt not running"
  - "CLI missing"
  - "Resource not found"
  - "Permission denied"
  - "Timeout"
- **User Messages**: Clear, actionable error messages
- **Recovery Guidance**: Suggest remediation steps

#### Configuration Management
- **Runtime Reload**: Define per-call vs. startup-only configuration behavior
- **Schema Validation**: Validate config files on load
- **Hot Reload**: Consider supporting config changes without restart

#### Resource Limits
- **Log Size Limits**: Maximum log size for retrieval operations
- **Stream Duration**: Timeout for long-running log streams
- **Safe Defaults**: Prevent runaway processes
- **Memory Management**: Handle large log buffers

#### Cross-Platform Support
- **OS Compatibility**: Test on macOS, Linux, Windows
- **Shell Differences**: Handle bash vs. zsh vs. PowerShell
- **Path Handling**: Platform-specific path separators

#### Documentation
- **API Reference**: Complete API documentation for all tools
- **Usage Examples**: Real-world usage scenarios
- **Troubleshooting Guide**: Common issues and solutions
- **Migration Guide**: Upgrading between versions

## Action Items Summary

### Critical (Must Address Before Implementation)
- [ ] Verify Tilt API endpoints and CLI commands against actual Tilt installation
- [ ] Add `@anthropic-ai/claude-agent-sdk` to dependencies
- [ ] Design MCP streaming mechanism for logs and status watches
- [ ] Implement input validation with strict schemas
- [ ] Add session-state preflight checks

### High Priority (Phase 1)
- [ ] Create Tilt version compatibility matrix
- [ ] Implement comprehensive error handling and taxonomy
- [ ] Add configuration file schema and validation
- [ ] Define process lifecycle management for `tilt_up`/`tilt_down`
- [ ] Specify testing fixtures and mocking boundaries

### Medium Priority (Phase 2)
- [ ] Add observability (structured logging and metrics)
- [ ] Implement resource limits and timeouts
- [ ] Create packaging and distribution plan
- [ ] Add authentication/TLS support for remote API
- [ ] Document cross-platform considerations

### Low Priority (Phase 3)
- [ ] Hot reload configuration support
- [ ] Advanced streaming features (backpressure, buffering)
- [ ] Performance optimization and benchmarking
- [ ] Extended monitoring and diagnostics

## Next Steps

1. **Immediate**: Address critical action items before beginning implementation
2. **Validation**: Test against actual Tilt installation to verify assumptions
3. **Iteration**: Update proposal with findings and refined designs
4. **Review**: Re-review updated proposal before proceeding to Phase 1 implementation

## Conclusion

The project has a strong conceptual foundation with the hybrid API/CLI approach and comprehensive tool coverage. However, several critical details need validation and specification before implementation begins. Addressing the streaming design, input validation, and Tilt API verification will significantly reduce implementation risk.

**Recommendation**: Pause before implementation to address critical action items and validate Tilt API/CLI assumptions.
