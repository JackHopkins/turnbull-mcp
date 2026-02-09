import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { allTools } from "./tools/index.js";
import { shutdownPool } from "./connections/postgres.js";
import { shutdownMysql } from "./connections/mysql.js";

const server = new McpServer({
  name: "turnbull-mcp",
  version: "1.0.0",
});

// Register all tools
for (const tool of allTools) {
  const schemaShape = tool.inputSchema.shape;
  server.tool(
    tool.name,
    tool.description,
    schemaShape,
    async (params: Record<string, any>) => {
      try {
        const result = await tool.handler(params);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: error.message || "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}

// Graceful shutdown
async function shutdown() {
  await Promise.all([shutdownPool(), shutdownMysql()]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Turnbull MCP server started on stdio");
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
