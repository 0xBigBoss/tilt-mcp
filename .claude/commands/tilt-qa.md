# Tilt QA Demonstration and Bug Report

Run a comprehensive quality assurance session for the Tilt MCP integration, testing all tools and identifying bugs.

## Instructions

Execute the following QA workflow systematically, documenting results at each step:

### Phase 1: Discovery and Initial Status

1. **Check Overall Status**
   - Use `tilt_status` to get system-wide status
   - Document: resources count, overall state, any warnings
   - ❌ **Bug check**: Missing data? Incorrect formatting? Errors?

### Phase 2: Resource Operations

3. **List Resources**
   - Use `tilt_get_resources` with different filters:
     - All resources (default)
     - Filter by status (ok, error, pending, building)
     - With verbose output
     - With pagination (limit/offset)
   - Document: resources found, their states, response times
   - ❌ **Bug check**: Pagination issues? Filtering broken? Missing fields?

4. **Describe Resources**
   - Use `tilt_describe_resource` on 2-3 different resources
   - Test with different resource types if available
   - Document: detail level, completeness, formatting
   - ❌ **Bug check**: Invalid resource names handling? Incomplete data? Errors?

### Phase 3: Logs and Monitoring

5. **Read Logs**
   - Use `tilt_logs` (plain-text output) with various options:
     - Default tail (100 lines)
     - Different tail line counts (50, 200)
     - Filter by source (build, runtime, all)
     - Filter by level (warn, error) — note: filters Tilt system messages only
     - Client-side search:
       - Substring match (case-sensitive and case-insensitive)
       - Regex with flags (e.g., `im`), ensure invalid regex throws clear error
   - Document: log output, filtering effectiveness, search behavior, performance
   - ❌ **Bug check**: Missing logs? Incorrect filtering? Search not applied? Timeout issues? Errors not descriptive for bad regex?

### Phase 4: Resource Control

6. **Trigger Updates**
   - Use `tilt_trigger` on a resource (choose one safely)
   - Document: trigger response, resource state change
   - ❌ **Bug check**: Trigger fails? No feedback? State inconsistency?

7. **Enable/Disable Resources**
   - Use `tilt_disable` on a resource
   - Verify state changed using `tilt_describe_resource`
   - Use `tilt_enable` to re-enable
   - Verify state restored
   - Document: state transitions, response times
   - ❌ **Bug check**: State not changing? Errors? Inconsistent behavior?

### Phase 5: Advanced Features

8. **Wait Operations**
   - Use `tilt_wait` on one or more resources
   - Test with different timeouts
   - Document: wait behavior, timeout handling
   - ❌ **Bug check**: Timeout not respected? Hang indefinitely? Incorrect ready state?

9. **Tiltfile Arguments**
   - Use `tilt_args` to view current arguments
   - Set new arguments if safe to do so
   - Clear arguments
   - Document: argument handling, effects on resources
   - ❌ **Bug check**: Args not applied? Clear fails? Incorrect parsing?

### Phase 6: Error Handling and Edge Cases

10. **Test Error Conditions**
    - Call `tilt_describe_resource` with invalid resource name
    - Call `tilt_logs` with invalid resource name
    - Call `tilt_logs` with invalid search regex and confirm explicit failure
    - Test with Tilt not running (if possible to test safely)
    - Document: error messages, error handling quality
    - ❌ **Bug check**: Poor error messages? Crashes? Undefined behavior?

## Bug Report Format

After completing all phases, create a structured bug report with the following sections:

### Executive Summary
- Total tools tested: X
- Tools working correctly: X
- Bugs found: X
- Critical issues: X
- Severity breakdown

### Critical Bugs (Blocks core functionality)
For each bug:
- **Bug ID**: TILT-XXX
- **Tool**: tool_name
- **Summary**: One-line description
- **Steps to Reproduce**: Numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Impact**: How this affects users
- **Severity**: Critical/High/Medium/Low

### Medium/Low Priority Bugs
Same format as above

### Quality Issues (Not bugs but improvements needed)
- Inconsistent error messages
- Missing validation
- Poor user experience
- Documentation gaps

### Successful Test Cases
Document what works correctly to establish baseline

### Recommendations
1. Priority fixes (in order)
2. Testing improvements needed
3. Documentation updates required

## Success Criteria

- ✅ All 9 Tilt MCP tools tested
- ✅ Error conditions tested for each tool
- ✅ Performance documented
- ✅ Bug report generated with severity levels
- ✅ Reproduction steps for each bug

## Notes

- Run this QA session against a **non-production** Tilt instance
- Document exact versions of tools, Tilt CLI, and dependencies
- Take screenshots or save logs for critical bugs
- Test on the actual environment where bugs occur
- Be systematic - complete each phase before moving to the next
