import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPool } from "../connections.js";
import { escapeIdentifier } from "../sql-utils.js";

function qualifyTable(table: string, database?: string): string {
  return database
    ? `${escapeIdentifier(database)}.${escapeIdentifier(table)}`
    : escapeIdentifier(table);
}

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
      if (database) sql = `SHOW TABLES FROM ${escapeIdentifier(database)}`;
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
      const [rows] = await pool.query(
        `DESCRIBE ${qualifyTable(table, database)}`
      );
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
      await pool.query(`DROP TABLE ${qualifyTable(table, database)}`);
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
