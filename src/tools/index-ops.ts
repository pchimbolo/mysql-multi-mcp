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
