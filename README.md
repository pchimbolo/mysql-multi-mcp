# mysql-multi-mcp

An MCP (Model Context Protocol) server for managing multiple MySQL and MariaDB database connections. Connect to any number of databases by name, run queries, manage schemas, and dynamically add or remove connections — all from your AI-powered IDE or CLI tool.

## Features

- **Multiple named connections** — Connect to several MySQL/MariaDB databases simultaneously, each identified by a user-defined name (e.g. `local-dev`, `staging`, `prod-readonly`)
- **Dynamic connection management** — Add, remove, test, and list connections at runtime without restarting the server
- **Full SQL support** — Run any SQL statement: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, and all DDL operations
- **16 granular tools** — Dedicated tools for common operations (list tables, describe columns, create indexes, etc.) plus a catch-all `execute` tool for anything else
- **Parameterized queries** — Safe value binding via `?` placeholders to prevent SQL injection
- **Client-side row limiting** — SELECT queries return a maximum of 1000 rows by default (configurable per query, never modifies your SQL)
- **Persistent configuration** — Connection details saved to `~/.mysql-multi-mcp/connections.json` and persist across sessions
- **Lazy connection pooling** — Pools created on first use, cached for session lifetime, gracefully closed on shutdown
- **Works everywhere** — Compatible with any MCP client: VS Code, Cursor, Windsurf, Claude Code, Claude Desktop, OpenCode, and more

## Available Tools

### Connection Management

| Tool | Description |
|------|-------------|
| `add-connection` | Add a new named database connection (persists to config file) |
| `remove-connection` | Remove a connection and close its pool |
| `list-connections` | List all configured connections (passwords are never shown) |
| `test-connection` | Test connectivity and show the server version |

### SQL Operations

| Tool | Description |
|------|-------------|
| `query` | Run a SELECT query, returns rows as JSON with field names. Supports `params` for safe `?` placeholders and `limit` to control row count (default: 1000, set to 0 for unlimited) |
| `execute` | Run any SQL statement (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE, etc.). Returns `affectedRows` and `insertId`. This is the catch-all — if a dedicated tool doesn't exist, use `execute` |

### Database Operations

| Tool | Description |
|------|-------------|
| `list-databases` | Show all databases on the server |
| `create-database` | Create a new database (with optional charset and collation) |
| `drop-database` | Drop a database |

### Table Operations

| Tool | Description |
|------|-------------|
| `list-tables` | List all tables in a database |
| `describe-table` | Show column names, types, keys, and defaults for a table |
| `create-table` | Create a table (takes a full `CREATE TABLE` SQL statement) |
| `alter-table` | Alter a table (takes a full `ALTER TABLE` SQL statement) |
| `drop-table` | Drop a table |

### Index Operations

| Tool | Description |
|------|-------------|
| `create-index` | Create an index (takes a full `CREATE INDEX` SQL statement) |
| `drop-index` | Drop an index from a table |

Every tool that operates on a database takes a `connection` parameter — the name you gave the connection when you added it. There is no implicit "active connection" state, so there's no risk of accidentally running a query against the wrong database.

## Installation

### Prerequisites

- **Node.js** 18 or later
- **npm**
- Access to one or more MySQL or MariaDB databases

### From Source

```bash
git clone https://github.com/pchimbolo/mysql-multi-mcp.git
cd mysql-multi-mcp
npm install
npm run build
```

## Setup by IDE / CLI Tool

After building (or if using npx from a published package), configure your MCP client to run the server. Below are setup instructions for popular tools.

<details>
<summary><strong>Claude Code</strong></summary>

No config file needed. Run this command in your terminal:

```bash
claude mcp add mysql-multi -- node /absolute/path/to/mysql-multi-mcp/dist/index.js
```

Or add it to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "mysql-multi": {
      "command": "node",
      "args": ["/absolute/path/to/mysql-multi-mcp/dist/index.js"]
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code / VS Code Insiders</strong></summary>

Add to your **User Settings** (`settings.json`) or **Workspace Settings** (`.vscode/settings.json`):

```json
{
  "mcp": {
    "servers": {
      "mysql-multi": {
        "command": "node",
        "args": ["/absolute/path/to/mysql-multi-mcp/dist/index.js"]
      }
    }
  }
}
```

Alternatively, create a `.vscode/mcp.json` file in your project root:

```json
{
  "servers": {
    "mysql-multi": {
      "command": "node",
      "args": ["/absolute/path/to/mysql-multi-mcp/dist/index.js"]
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

Create or edit `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "mysql-multi": {
      "command": "node",
      "args": ["/absolute/path/to/mysql-multi-mcp/dist/index.js"]
    }
  }
}
```

</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to your Windsurf MCP config (`~/.windsurf/mcp.json` or via Windsurf Settings > MCP):

```json
{
  "mcpServers": {
    "mysql-multi": {
      "command": "node",
      "args": ["/absolute/path/to/mysql-multi-mcp/dist/index.js"]
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Edit your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mysql-multi": {
      "command": "node",
      "args": ["/absolute/path/to/mysql-multi-mcp/dist/index.js"]
    }
  }
}
```

</details>

<details>
<summary><strong>OpenCode</strong></summary>

Add to your OpenCode configuration (`opencode.json` or similar):

```json
{
  "mcpServers": {
    "mysql-multi": {
      "command": "node",
      "args": ["/absolute/path/to/mysql-multi-mcp/dist/index.js"]
    }
  }
}
```

</details>

> **Note:** Replace `/absolute/path/to/mysql-multi-mcp/dist/index.js` with the actual absolute path to the built `dist/index.js` file on your system. On Windows, use forward slashes (e.g. `C:/Users/you/mysql-multi-mcp/dist/index.js`).

## Configuration

Database connections are stored in `~/.mysql-multi-mcp/connections.json`. This file is created automatically on first run.

You can manage connections in two ways:

### 1. Via MCP Tools (Recommended)

Ask your AI assistant to add a connection:

> "Add a MySQL connection called `local-dev` at localhost:3306 with user `root` and password `secret`, default database `myapp`"

The AI will call the `add-connection` tool, and the connection is immediately available and persisted.

### 2. Edit the Config File Directly

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

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `host` | Yes | Database hostname or IP |
| `port` | Yes | Database port (typically 3306) |
| `user` | Yes | Database username |
| `password` | Yes | Database password |
| `database` | No | Default database. If omitted, you must specify `database` on table/index tools, or use fully qualified table names. |

## Usage Examples

Once configured, you can ask your AI assistant things like:

- "List all connections" — calls `list-connections`
- "Test the staging connection" — calls `test-connection`
- "Show me all tables in the local-dev database" — calls `list-tables`
- "Describe the users table on staging" — calls `describe-table`
- "Select the first 10 rows from orders on local-dev" — calls `query`
- "Insert a new user into local-dev" — calls `execute`
- "Create a new table called `audit_log` on staging" — calls `create-table`
- "Add an index on `users.email` on local-dev" — calls `create-index`
- "Add a new connection called `prod-readonly` at prod-db.example.com" — calls `add-connection`

## Output Format

All tools return structured JSON:

| Tool Type | Response Shape |
|-----------|---------------|
| `query` | `{ "rows": [...], "rowCount": N, "fields": ["col1", "col2"], "truncated": false }` |
| `execute` | `{ "affectedRows": N, "insertId": N, "message": "..." }` |
| `test-connection` | `{ "success": true, "message": "Connected to local-dev (MySQL 8.0.32)" }` |
| `list-connections` | `{ "connections": { "name": { "host", "port", "user", "database" } } }` |
| DDL tools | `{ "success": true, "message": "..." }` |

## Security Considerations

- **Passwords in config:** Stored in plaintext in `~/.mysql-multi-mcp/connections.json`. The file is created with `0600` permissions on Unix (owner read/write only). On Windows, it inherits the user directory's permissions. You are responsible for securing this file.
- **Passwords in output:** The `list-connections` tool never exposes passwords. Error messages from MySQL are passed through as-is (they do not contain passwords).
- **No SQL restrictions:** This server is intentionally permissive — it's a power tool for developers. Any SQL statement that the connected database user has privileges to run can be executed. Security is delegated to MySQL's own permission system. Use read-only database users for connections where write access isn't needed.
- **Parameterized queries:** The `query` and `execute` tools support `params` (a positional array for `?` placeholders) for safe value binding.

## Limitations

- **No SSH tunnel support** — Only direct TCP connections are supported. If your database is behind a firewall, you'll need to set up an SSH tunnel externally (e.g. via `ssh -L`). The architecture is designed so SSH tunnel support can be added later without breaking changes.
- **No TLS/SSL configuration** — The server uses `mysql2`'s default connection behavior. Custom CA certificates or client certificates are not yet configurable.
- **Passwords stored in plaintext** — There is no built-in secret management, encryption, or environment variable expansion. Protect the config file with filesystem permissions.
- **Config file concurrency** — If multiple MCP server instances (e.g. one in VS Code and one in Claude Code) modify connections simultaneously, the last writer wins. This is fine for single-user use.
- **Connection pool size is fixed** — Each connection uses a pool of 5 connections. This is not currently configurable per connection.
- **Row limit is client-side** — The `query` tool fetches all rows from MySQL and truncates in memory. Very large result sets will still consume memory before truncation. For large tables, add a `LIMIT` clause in your SQL.
- **No transaction support** — There is no `BEGIN`/`COMMIT`/`ROLLBACK` session management. Each query/execute call uses its own connection from the pool. You can still run transaction statements via `execute`, but they must be self-contained.
- **BLOB columns** — Binary data in query results is returned as Buffer objects serialized to JSON, which may not be useful. Consider using `HEX()` or `TO_BASE64()` in your SQL for binary columns.

## Development

```bash
# Watch mode (recompile on changes)
npm run dev

# Build once
npm run build

# Run the server directly (for testing with MCP inspector, etc.)
npm start
```

## License

Apache-2.0
