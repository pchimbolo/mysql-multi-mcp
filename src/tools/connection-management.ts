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
