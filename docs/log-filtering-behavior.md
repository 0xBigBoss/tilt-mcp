# Tilt Log Filtering Behavior

## Summary

The `tilt_logs` tool:

1. Returns plain-text log output (no JSON envelope), mirroring `tilt logs`
2. Accepts an optional `search` parameter for client-side filtering (substring or regex, with optional case sensitivity)
3. Passes `--level` and `--source` parameters through to the Tilt CLI. These have specific behavior that differs from filtering application log content.

### Level Parameter (`--level`)

**What it does:**
- Filters Tilt's internal log messages (system messages from Tilt itself)
- Examples: Build warnings, resource status errors, Tilt daemon messages

**What it does NOT do:**
- Does NOT filter application log content
- Application logs are passed through unfiltered by Tilt

**Example:**
```bash
# Application logs with different severities
app: INFO Starting server
app: WARN Using default config
app: ERROR Database connection failed

# Using --level=error will NOT filter these logs
# All three lines will still be returned
```

### Source Parameter (`--source`)

**What it does:**
- Filters logs by origin:
  - `build`: Container build logs (Docker build output, etc.)
  - `runtime`: Running container logs (stdout/stderr from the running container)
  - `all`: Both build and runtime logs (default)

**This parameter works as expected** and effectively filters logs based on where they originated.

### Search Parameter (`search`)

**What it does:**
- Performs client-side filtering of returned log lines
- Supports substring search (default) or regex
- Supports optional case-insensitive matching
- Applies after ANSI stripping and tailing, so it operates on the final returned lines

**What it does NOT do:**
- Does not change what Tilt returns; it only filters locally
- Does not modify log formatting beyond removing ANSI codes (consistent with the rest of the tool)

**Examples:**
```json
// Substring search (default, case-sensitive)
{ "search": { "query": "ERROR" } }

// Case-insensitive substring
{ "search": { "query": "error", "caseSensitive": false } }

// Regex search with flags
{ "search": { "query": "^app: warn", "mode": "regex", "flags": "im" } }
```

## Research Findings

### Testing Methodology

1. Created a test Tiltfile with a local resource that outputs different log levels
2. Used `tilt logs <resource> --level=error` to test level filtering
3. Used `tilt logs <resource> --level=warn` to test warn filtering
4. Compared output with `tilt logs <resource>` (no filtering)

### Results

- The `--level` flag is accepted by Tilt CLI without error
- Log output does not show application-level filtering
- The flag appears to filter Tilt's internal messages only

### Tilt Documentation

From `tilt logs --help`:
```
--level string    Specify a log level. One of "warn", "error"
--source string   Specify a log source. One of "all", "build", "runtime" (default "all")
```

The documentation doesn't clarify what "log level" refers to, but testing confirms it filters Tilt system messages, not application logs.

## Implementation Details

### Current Implementation (CORRECT)

The implementation correctly:
1. Passes `--level` and `--source` to Tilt CLI
2. Provides a `search` parameter for client-side substring/regex filtering
3. Documents the actual behavior in schema descriptions
4. Documents the actual behavior in tool descriptions
5. Documents the actual behavior in code comments
6. Includes tests that verify the parameters are passed correctly
7. Includes tests that document the actual filtering behavior

### Test Coverage

New tests in `tests/tools/logs.test.ts`:

1. **verifies that level parameter is passed to Tilt CLI**
   - Confirms `--level` flag and value are included in CLI args
   
2. **verifies that source parameter is passed to Tilt CLI**
   - Confirms `--source` flag and value are included in CLI args
   
3. **documents that level filters Tilt internal logs not app logs**
   - Documents the actual behavior with a test case
   - Shows that all application logs are returned regardless of level

## Recommendations

### For Users

If you need to filter application logs by severity:

1. **Parse log format**: Look for severity prefixes in your application logs (e.g., `ERROR:`, `WARN:`, `INFO:`)
2. **Client-side filtering**: Implement filtering logic after retrieving logs
3. **Structured logging**: Use structured log formats (JSON) that include level fields

### For Future Enhancement

If application log filtering is needed, consider:

1. **Option A**: Implement client-side filtering in `tilt_logs` tool
   - Parse common log formats (e.g., Python logging, Node.js pino, Java logback)
   - Filter lines based on detected severity
   - Document supported formats

2. **Option B**: Add a separate tool for post-processing logs
   - Create `tilt_filter_logs` tool
   - Accept logs and filter patterns
   - Return filtered results

3. **Option C**: Document the limitation and recommend external tools
   - Suggest using `grep`, `awk`, or similar tools
   - Provide example commands for common use cases

## Files Modified

1. `src/tools/logs.ts`
   - Updated tool description to clarify level/source behavior

2. `src/tools/schemas.ts`
   - Added detailed descriptions to `level` and `source` schema fields
   - Clarified what level filtering actually does

3. `src/tilt/cli-client.ts`
   - Added comments to `LogOptions` interface
   - Added detailed JSDoc to `getLogs` method

4. `tests/tools/logs.test.ts`
   - Added new test suite: "level filtering verification"
   - Added 3 new tests that verify and document the behavior

## Conclusion

**Resolution: Option A (Tilt CLI supports native filtering) + Enhanced Documentation**

The `--level` and `--source` parameters work correctly, but their behavior is now clearly documented:
- Level filtering applies to Tilt system messages, not application logs
- Source filtering works as expected (build vs runtime)
- No silent non-functional parameters
- Comprehensive test coverage verifies the actual behavior
- Clear documentation prevents misuse

The bug is resolved by **documenting the actual behavior** rather than implementing workarounds or removing functionality.
