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
