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
