# MySQL Multi MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server that allows dynamic, named connections to MySQL/MariaDB databases with granular tools for all SQL operations.

**Architecture:** Flat tool architecture — every tool takes an explicit `connection` parameter. Config stored in `~/.mysql-multi-mcp/connections.json`. Lazy connection pooling via `mysql2/promise`. stdio transport.

**Tech Stack:** TypeScript, Node.js, ESM, `@modelcontextprotocol/sdk`, `mysql2`

**Spec:** `docs/superpowers/specs/2026-03-23-mysql-multi-mcp-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `package.json` | Project metadata, dependencies, bin entry, scripts |
| `tsconfig.json` | TypeScript config (ES2022, NodeNext) |
| `src/index.ts` | MCP server setup, tool registration, stdio transport, shutdown handler |
| `src/types.ts` | Shared TypeScript interfaces (ConnectionConfig, ConfigFile) |
| `src/config.ts` | Read/write `~/.mysql-multi-mcp/connections.json`, auto-create on first run |
| `src/connections.ts` | Lazy connection pool manager (get, create, destroy, shutdown) |
| `src/tools/connection-management.ts` | add-connection, remove-connection, list-connections, test-connection |
| `src/tools/query.ts` | query, execute |
| `src/tools/database-ops.ts` | list-databases, create-database, drop-database |
| `src/tools/table-ops.ts` | list-tables, describe-table, create-table, alter-table, drop-table |
| `src/tools/index-ops.ts` | create-index, drop-index |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/types.ts`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "mysql-multi-mcp",
  "version": "0.1.0",
  "description": "MCP server for dynamic, named MySQL/MariaDB connections",
  "type": "module",
  "bin": {
    "mysql-multi-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "keywords": ["mcp", "mysql", "mariadb", "database"],
  "license": "MIT"
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd I:/Node/MCP-dev/mysql-multi && npm install @modelcontextprotocol/sdk mysql2`
Run: `npm install -D typescript @types/node`

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create src/types.ts**

```typescript
export interface ConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
}

export interface ConfigFile {
  connections: Record<string, ConnectionConfig>;
}
```

- [ ] **Step 5: Verify build works**

Run: `cd I:/Node/MCP-dev/mysql-multi && npx tsc --noEmit`
Expected: No errors (types.ts only has interfaces)

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json src/types.ts package-lock.json
git commit -m "feat: project scaffolding with types"
```

---

### Task 2: Config Module

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: Implement config.ts**

```typescript
import { readFile, writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import type { ConfigFile, ConnectionConfig } from "./types.js";

const CONFIG_DIR = join(homedir(), ".mysql-multi-mcp");
const CONFIG_PATH = join(CONFIG_DIR, "connections.json");

export async function loadConfig(): Promise<ConfigFile> {
  try {
    const data = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(data) as ConfigFile;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      const defaultConfig: ConfigFile = { connections: {} };
      await saveConfig(defaultConfig);
      return defaultConfig;
    }
    throw new Error(`Failed to read config: ${err.message}`);
  }
}

export async function saveConfig(config: ConfigFile): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export async function getConnection(name: string): Promise<ConnectionConfig> {
  const config = await loadConfig();
  const conn = config.connections[name];
  if (!conn) {
    throw new Error(
      `Connection '${name}' not found. Use list-connections to see available connections.`
    );
  }
  return conn;
}

export async function addConnection(
  name: string,
  config: ConnectionConfig
): Promise<void> {
  const current = await loadConfig();
  if (current.connections[name]) {
    throw new Error(
      `Connection '${name}' already exists. Remove it first or choose a different name.`
    );
  }
  current.connections[name] = config;
  await saveConfig(current);
}

export async function removeConnection(name: string): Promise<void> {
  const current = await loadConfig();
  if (!current.connections[name]) {
    throw new Error(
      `Connection '${name}' not found. Use list-connections to see available connections.`
    );
  }
  delete current.connections[name];
  await saveConfig(current);
}
```

- [ ] **Step 2: Verify build**

Run: `cd I:/Node/MCP-dev/mysql-multi && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: config module for reading/writing connections.json"
```

---

### Task 3: Connection Pool Manager

**Files:**
- Create: `src/connections.ts`

- [ ] **Step 1: Implement connections.ts**

```typescript
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";
import { getConnection } from "./config.js";

const pools = new Map<string, Pool>();

export async function getPool(name: string): Promise<Pool> {
  let pool = pools.get(name);
  if (pool) return pool;

  const config = await getConnection(name);
  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 5,
  });

  pools.set(name, pool);
  return pool;
}

export async function destroyPool(name: string): Promise<void> {
  const pool = pools.get(name);
  if (pool) {
    await pool.end();
    pools.delete(name);
  }
}

export async function shutdownAllPools(): Promise<void> {
  const promises = Array.from(pools.entries()).map(async ([name, pool]) => {
    await pool.end();
    pools.delete(name);
  });
  await Promise.all(promises);
}
```

- [ ] **Step 2: Verify build**

Run: `cd I:/Node/MCP-dev/mysql-multi && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/connections.ts
git commit -m "feat: lazy connection pool manager with shutdown"
```

---

### Task 4: Connection Management Tools

**Files:**
- Create: `src/tools/connection-management.ts`

- [ ] **Step 1: Implement connection-management.ts**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  loadConfig,
  addConnection as addConn,
  removeConnection as removeConn,
} from "../config.js";
import { getPool, destroyPool } from "../connections.js";

export function registerConnectionTools(server: McpServer): void {
  server.tool(
    "add-connection",
    "Add a new named database connection to the config",
    {
      name: z.string().describe("Unique name for this connection"),
      host: z.string().describe("Database host"),
      port: z.number().default(3306).describe("Database port"),
      user: z.string().describe("Database user"),
      password: z.string().describe("Database password"),
      database: z
        .string()
        .optional()
        .describe("Default database (optional)"),
    },
    async ({ name, host, port, user, password, database }) => {
      await addConn(name, { host, port, user, password, database });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: `Connection '${name}' added successfully.`,
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "remove-connection",
    "Remove a named database connection from the config",
    {
      name: z.string().describe("Name of the connection to remove"),
    },
    async ({ name }) => {
      await destroyPool(name);
      await removeConn(name);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: `Connection '${name}' removed successfully.`,
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "list-connections",
    "List all configured database connections (passwords hidden)",
    {},
    async () => {
      const config = await loadConfig();
      const connections: Record<
        string,
        { host: string; port: number; user: string; database?: string }
      > = {};
      for (const [name, conn] of Object.entries(config.connections)) {
        connections[name] = {
          host: conn.host,
          port: conn.port,
          user: conn.user,
          database: conn.database,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ connections }),
          },
        ],
      };
    }
  );

  server.tool(
    "test-connection",
    "Test a named database connection",
    {
      name: z.string().describe("Name of the connection to test"),
    },
    async ({ name }) => {
      try {
        const pool = await getPool(name);
        const [rows] = await pool.query("SELECT VERSION() as version");
        const version = (rows as any)[0]?.version ?? "unknown";
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `Connected to ${name} (MySQL ${version})`,
              }),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: err.message,
              }),
            },
          ],
        };
      }
    }
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd I:/Node/MCP-dev/mysql-multi && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/connection-management.ts
git commit -m "feat: connection management tools (add, remove, list, test)"
```

---

### Task 5: Query & Execute Tools

**Files:**
- Create: `src/tools/query.ts`

- [ ] **Step 1: Implement query.ts**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPool } from "../connections.js";

const DEFAULT_ROW_LIMIT = 1000;

export function registerQueryTools(server: McpServer): void {
  server.tool(
    "query",
    "Run a SELECT query and return rows as JSON",
    {
      connection: z.string().describe("Connection name"),
      sql: z.string().describe("SQL SELECT statement"),
      params: z
        .array(z.any())
        .optional()
        .describe("Positional parameters for ? placeholders"),
      limit: z
        .number()
        .optional()
        .describe(
          "Max rows to return (default 1000, 0 for no limit). Applied client-side."
        ),
    },
    async ({ connection, sql, params, limit }) => {
      const pool = await getPool(connection);
      const [rows, fields] = await pool.query(sql, params);
      const allRows = rows as any[];
      const maxRows = limit === 0 ? Infinity : (limit ?? DEFAULT_ROW_LIMIT);
      const truncated = allRows.length > maxRows;
      const resultRows = truncated ? allRows.slice(0, maxRows) : allRows;
      const fieldNames = fields
        ? (fields as any[]).map((f: any) => f.name)
        : [];

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              rows: resultRows,
              rowCount: resultRows.length,
              fields: fieldNames,
              truncated,
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "execute",
    "Run any SQL statement (INSERT, UPDATE, DELETE, DDL, etc.) and return affected rows",
    {
      connection: z.string().describe("Connection name"),
      sql: z.string().describe("SQL statement to execute"),
      params: z
        .array(z.any())
        .optional()
        .describe("Positional parameters for ? placeholders"),
    },
    async ({ connection, sql, params }) => {
      const pool = await getPool(connection);
      const [result] = await pool.query(sql, params);
      const res = result as any;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              affectedRows: res.affectedRows ?? 0,
              insertId: res.insertId ?? 0,
              message: res.message ?? "",
            }),
          },
        ],
      };
    }
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd I:/Node/MCP-dev/mysql-multi && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/query.ts
git commit -m "feat: query and execute tools with parameterized queries"
```

---

### Task 6: Database Operations Tools

**Files:**
- Create: `src/tools/database-ops.ts`

- [ ] **Step 1: Implement database-ops.ts**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPool } from "../connections.js";

export function registerDatabaseTools(server: McpServer): void {
  server.tool(
    "list-databases",
    "List all databases on the server",
    {
      connection: z.string().describe("Connection name"),
    },
    async ({ connection }) => {
      const pool = await getPool(connection);
      const [rows] = await pool.query("SHOW DATABASES");
      const databases = (rows as any[]).map(
        (r) => r.Database ?? r.database ?? Object.values(r)[0]
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ databases }),
          },
        ],
      };
    }
  );

  server.tool(
    "create-database",
    "Create a new database",
    {
      connection: z.string().describe("Connection name"),
      database: z.string().describe("Database name to create"),
      charset: z
        .string()
        .optional()
        .describe("Character set (e.g. utf8mb4)"),
      collation: z
        .string()
        .optional()
        .describe("Collation (e.g. utf8mb4_unicode_ci)"),
    },
    async ({ connection, database, charset, collation }) => {
      const pool = await getPool(connection);
      let sql = `CREATE DATABASE \`${database}\``;
      if (charset) sql += ` CHARACTER SET ${charset}`;
      if (collation) sql += ` COLLATE ${collation}`;
      await pool.query(sql);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: `Database '${database}' created.`,
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "drop-database",
    "Drop a database",
    {
      connection: z.string().describe("Connection name"),
      database: z.string().describe("Database name to drop"),
    },
    async ({ connection, database }) => {
      const pool = await getPool(connection);
      await pool.query(`DROP DATABASE \`${database}\``);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: `Database '${database}' dropped.`,
            }),
          },
        ],
      };
    }
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd I:/Node/MCP-dev/mysql-multi && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/database-ops.ts
git commit -m "feat: database operations tools (list, create, drop)"
```

---

### Task 7: Table Operations Tools

**Files:**
- Create: `src/tools/table-ops.ts`

- [ ] **Step 1: Implement table-ops.ts**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPool } from "../connections.js";

export function registerTableTools(server: McpServer): void {
  server.tool(
    "list-tables",
    "List all tables in a database",
    {
      connection: z.string().describe("Connection name"),
      database: z
        .string()
        .optional()
        .describe("Database name (uses connection default if omitted)"),
    },
    async ({ connection, database }) => {
      const pool = await getPool(connection);
      let sql = "SHOW TABLES";
      if (database) sql = `SHOW TABLES FROM \`${database}\``;
      const [rows] = await pool.query(sql);
      const tables = (rows as any[]).map((r) => Object.values(r)[0]);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ tables }),
          },
        ],
      };
    }
  );

  server.tool(
    "describe-table",
    "Describe a table's columns, types, keys, and defaults",
    {
      connection: z.string().describe("Connection name"),
      table: z.string().describe("Table name"),
      database: z
        .string()
        .optional()
        .describe("Database name (uses connection default if omitted)"),
    },
    async ({ connection, table, database }) => {
      const pool = await getPool(connection);
      const qualifiedTable = database
        ? `\`${database}\`.\`${table}\``
        : `\`${table}\``;
      const [rows] = await pool.query(`DESCRIBE ${qualifiedTable}`);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ columns: rows }),
          },
        ],
      };
    }
  );

  server.tool(
    "create-table",
    "Create a table using a full CREATE TABLE SQL statement",
    {
      connection: z.string().describe("Connection name"),
      sql: z.string().describe("Full CREATE TABLE statement"),
    },
    async ({ connection, sql }) => {
      const pool = await getPool(connection);
      await pool.query(sql);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: "Table created.",
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "alter-table",
    "Alter a table using a full ALTER TABLE SQL statement",
    {
      connection: z.string().describe("Connection name"),
      sql: z.string().describe("Full ALTER TABLE statement"),
    },
    async ({ connection, sql }) => {
      const pool = await getPool(connection);
      await pool.query(sql);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: "Table altered.",
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "drop-table",
    "Drop a table",
    {
      connection: z.string().describe("Connection name"),
      table: z.string().describe("Table name"),
      database: z
        .string()
        .optional()
        .describe("Database name (uses connection default if omitted)"),
    },
    async ({ connection, table, database }) => {
      const pool = await getPool(connection);
      const qualifiedTable = database
        ? `\`${database}\`.\`${table}\``
        : `\`${table}\``;
      await pool.query(`DROP TABLE ${qualifiedTable}`);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: `Table '${table}' dropped.`,
            }),
          },
        ],
      };
    }
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd I:/Node/MCP-dev/mysql-multi && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/table-ops.ts
git commit -m "feat: table operations tools (list, describe, create, alter, drop)"
```

---

### Task 8: Index Operations Tools

**Files:**
- Create: `src/tools/index-ops.ts`

- [ ] **Step 1: Implement index-ops.ts**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPool } from "../connections.js";

export function registerIndexTools(server: McpServer): void {
  server.tool(
    "create-index",
    "Create an index using a full CREATE INDEX SQL statement",
    {
      connection: z.string().describe("Connection name"),
      sql: z.string().describe("Full CREATE INDEX statement"),
    },
    async ({ connection, sql }) => {
      const pool = await getPool(connection);
      await pool.query(sql);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: "Index created.",
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "drop-index",
    "Drop an index from a table",
    {
      connection: z.string().describe("Connection name"),
      table: z.string().describe("Table the index belongs to"),
      index_name: z.string().describe("Name of the index to drop"),
      database: z
        .string()
        .optional()
        .describe("Database name (uses connection default if omitted)"),
    },
    async ({ connection, table, index_name, database }) => {
      const pool = await getPool(connection);
      const qualifiedTable = database
        ? `\`${database}\`.\`${table}\``
        : `\`${table}\``;
      await pool.query(`DROP INDEX \`${index_name}\` ON ${qualifiedTable}`);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: `Index '${index_name}' dropped from '${table}'.`,
            }),
          },
        ],
      };
    }
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd I:/Node/MCP-dev/mysql-multi && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/index-ops.ts
git commit -m "feat: index operations tools (create, drop)"
```

---

### Task 9: Server Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement src/index.ts**

```typescript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerConnectionTools } from "./tools/connection-management.js";
import { registerQueryTools } from "./tools/query.js";
import { registerDatabaseTools } from "./tools/database-ops.js";
import { registerTableTools } from "./tools/table-ops.js";
import { registerIndexTools } from "./tools/index-ops.js";
import { shutdownAllPools } from "./connections.js";

const server = new McpServer({
  name: "mysql-multi-mcp",
  version: "0.1.0",
});

registerConnectionTools(server);
registerQueryTools(server);
registerDatabaseTools(server);
registerTableTools(server);
registerIndexTools(server);

const transport = new StdioServerTransport();

process.on("SIGINT", async () => {
  await shutdownAllPools();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdownAllPools();
  process.exit(0);
});

await server.connect(transport);
```

- [ ] **Step 2: Build the project**

Run: `cd I:/Node/MCP-dev/mysql-multi && npm run build`
Expected: Compiles successfully to `dist/`

- [ ] **Step 3: Verify dist/index.js exists**

Run: `ls I:/Node/MCP-dev/mysql-multi/dist/index.js`
Expected: File exists

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: MCP server entry point with stdio transport and graceful shutdown"
```

---

### Task 10: Build Verification & Final Commit

**Files:**
- None new — full build and smoke test

- [ ] **Step 1: Clean build**

Run: `cd I:/Node/MCP-dev/mysql-multi && rm -rf dist && npm run build`
Expected: Clean compilation, no errors

- [ ] **Step 2: Verify all dist files exist**

Run: `ls I:/Node/MCP-dev/mysql-multi/dist/`
Expected: `index.js`, `config.js`, `connections.js`, `types.js`, `tools/` directory

Run: `ls I:/Node/MCP-dev/mysql-multi/dist/tools/`
Expected: `connection-management.js`, `query.js`, `database-ops.js`, `table-ops.js`, `index-ops.js`

- [ ] **Step 3: Verify the server starts without errors**

Run: `cd I:/Node/MCP-dev/mysql-multi && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | node dist/index.js`
Expected: JSON response with server capabilities (may hang waiting for more input — that's fine, just verify it doesn't crash)

- [ ] **Step 4: Commit everything**

```bash
git add -A
git commit -m "feat: complete mysql-multi-mcp server v0.1.0"
```
