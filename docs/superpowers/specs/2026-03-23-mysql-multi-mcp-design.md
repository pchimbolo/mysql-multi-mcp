# MySQL Multi MCP Server — Design Spec

## Overview

An MCP server that allows dynamic, named connections to MySQL/MariaDB databases. It exposes granular tools for SQL operations, DDL, and connection management. Works with any MCP-compatible IDE (VS Code, Cursor) or CLI tool (Claude Code, OpenCode) via stdio transport.

## Decisions

|-------------------|-----------------------------------------------------|-------------------------------------------------------|
|     Decision      |                       Choice                        |                       Rationale                       |
|-------------------|-----------------------------------------------------|-------------------------------------------------------|
| Language          | TypeScript (Node.js)                                | Most common for MCP servers, excellent mysql2 library |
| Distribution      | Local + npm (npx)                                   | Works locally during dev, publishable later           |
| Config storage    | JSON file at `~/.mysql-multi-mcp/connections.json`  | Persists across sessions, single known location       |
| Password handling | Plaintext in config                                 | Simple; user responsible for file permissions         |
| SSH tunnels       | Not now, designed for later                         | Direct TCP covers most use cases                      |
| Tool architecture | Flat — every tool takes explicit `connection` param | No implicit state, no risk of wrong-database queries  |
| Tool granularity  | Many granular tools                                 | Explicit, one tool per operation type                 |
|-------------------|-----------------------------------------------------|-------------------------------------------------------|

## Project Structure

```
mysql-multi/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point, MCP server setup
│   ├── config.ts             # Config file read/write
│   ├── connections.ts        # Connection pool manager
│   ├── tools/
│   │   ├── connection-management.ts   # add, remove, list, test connections
│   │   ├── query.ts                   # query (SELECT), execute (INSERT/UPDATE/DELETE/etc.)
│   │   ├── database-ops.ts            # create/drop/list databases
│   │   ├── table-ops.ts              # create/alter/drop/list/describe tables
│   │   └── index-ops.ts             # create/drop indexes
│   └── types.ts              # Shared types
```

## Config Format

File: `~/.mysql-multi-mcp/connections.json`

```json
{
  "connections": {
    "local-dev": {
      "host": "localhost",
      "port": 3306,
      "user": "root",
      "password": "secret",
      "database": "myapp_dev"
    },
    "staging": {
      "host": "staging-db.example.com",
      "port": 3306,
      "user": "readonly",
      "password": "pass123",
      "database": "myapp_staging"
    }
  }
}
```

- Top-level keys in `connections` are user-given names, used in all tool calls
- `database` is optional — if omitted, connection starts without a selected database
- Config file created automatically on first run with empty `connections` object
- File created with `0600` permissions on Unix; inherits user directory permissions on Windows

## Connection Pool Manager

- Pools created lazily on first use, cached for session lifetime
- Uses `mysql2` built-in connection pooling (default pool size: 5)
- When a connection config is removed, its pool is destroyed
- When a connection config is added, pool is created on next use
- Designed so SSH tunnel support can wrap the pool creation later without changing tool interfaces
- On process shutdown (SIGINT, SIGTERM), all pools are gracefully closed via `pool.end()`

## Tools

### Connection Management

| Tool | Parameters | Description |
|------|-----------|-------------|
| `add-connection` | `name`, `host`, `port`, `user`, `password`, `database?` | Adds to config file and persists. Errors if name already exists. |
| `remove-connection` | `name` | Removes from config, destroys pool |
| `list-connections` | _(none)_ | Lists all connection names with host/database (no passwords) |
| `test-connection` | `name` | Attempts to connect, returns success/failure |

### SQL Operations

| Tool | Parameters | Description |
|------|-----------|-------------|
| `query` | `connection`, `sql`, `params?`, `limit?` | Runs SELECT, returns rows as JSON. Default limit: 1000 rows (client-side truncation — never modifies the SQL). Response includes `"truncated": true` when rows are cut. `limit: 0` means no limit. `params` is a positional array for `?` placeholders (e.g. `[1, "foo"]`). |
| `execute` | `connection`, `sql`, `params?` | Runs any SQL (INSERT/UPDATE/DELETE/TRUNCATE/DDL/etc.) and returns `affectedRows`, `insertId`. The dedicated DDL tools below are convenience wrappers; `execute` is the catch-all. `params` is a positional array for `?` placeholders. |

### Database Operations

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list-databases` | `connection` | `SHOW DATABASES` |
| `create-database` | `connection`, `database`, `charset?`, `collation?` | `CREATE DATABASE` |
| `drop-database` | `connection`, `database` | `DROP DATABASE` |

### Table Operations

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list-tables` | `connection`, `database?` | `SHOW TABLES` (uses connection's default database if omitted) |
| `describe-table` | `connection`, `table`, `database?` | `DESCRIBE table` — columns, types, keys, defaults |
| `create-table` | `connection`, `sql` | Takes full `CREATE TABLE` statement |
| `alter-table` | `connection`, `sql` | Takes full `ALTER TABLE` statement |
| `drop-table` | `connection`, `table`, `database?` | `DROP TABLE` |

### Index Operations

| Tool | Parameters | Description |
|------|-----------|-------------|
| `create-index` | `connection`, `sql` | Takes full `CREATE INDEX` statement |
| `drop-index` | `connection`, `table`, `index_name`, `database?` | `DROP INDEX` |

## Output Format

All tools return structured JSON via MCP text content.

- **`query`**: `{ "rows": [...], "rowCount": N, "fields": ["col1", "col2"], "truncated": false }`
- **`test-connection`**: `{ "success": true, "message": "Connected to local-dev (MySQL 8.0.32)" }` or `{ "success": false, "error": "..." }`
- **`execute`**: `{ "affectedRows": N, "insertId": N, "message": "..." }`
- **`list-connections`**: `{ "connections": { "name": { "host": "...", "port": N, "user": "...", "database": "..." } } }` (passwords omitted)
- **DDL/database tools**: `{ "success": true, "message": "..." }`

## Error Handling

- Unknown connection name: `"Connection 'foo' not found. Use list-connections to see available connections."`
- Connection failure (host unreachable, auth failed): MySQL error message with error code
- SQL syntax errors: MySQL error message as-is (useful for AI self-correction)
- Config file permission/parse errors: clear description of the issue
- Duplicate connection name on `add-connection`: `"Connection 'foo' already exists. Remove it first or choose a different name."`

## Security

- `list-connections` never exposes passwords
- No built-in SQL restrictions — server is intentionally permissive; security delegated to MySQL's permission system
- Parameterized queries supported via `params` on `query` and `execute` tools
- Config file created with restrictive permissions

## Build & Run

- **Module format:** ESM (`"type": "module"` in package.json)
- **Build:** `tsc` compiles `src/` to `dist/`
- **Entry point:** `dist/index.js` with a `#!/usr/bin/env node` shebang
- **bin field:** `"mysql-multi-mcp": "dist/index.js"` in package.json for npx support
- **MCP client config example:**
  ```json
  {
    "mcpServers": {
      "mysql-multi": {
        "command": "npx",
        "args": ["-y", "mysql-multi-mcp"]
      }
    }
  }
  ```
  Or for local development:
  ```json
  {
    "mcpServers": {
      "mysql-multi": {
        "command": "node",
        "args": ["I:/Node/MCP-dev/mysql-multi/dist/index.js"]
      }
    }
  }
  ```

## Concurrent Access

Multiple MCP server instances (e.g. one in VS Code, one in Claude Code) may read/write the same config file simultaneously. The server uses a read-before-write approach — last writer wins. This is an accepted limitation for a single-user developer tool.

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `mysql2` — MySQL/MariaDB client with promise API

## Future Considerations

- SSH tunnel support can be added by extending the connection config with `ssh` options and wrapping pool creation — no tool interface changes needed
- Additional tools (e.g., `show-create-table`, `explain-query`) can be added without breaking existing tools
