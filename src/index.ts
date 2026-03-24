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
