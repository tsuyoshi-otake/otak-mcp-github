# otak-mcp-test

This is a test project for a Model Context Protocol (MCP) server built using Cloudflare Workers and Durable Objects. It supports both Server-Sent Events (SSE) and Streamable HTTP transports.

## Overview

This project provides a basic implementation example of an MCP server. It runs on Cloudflare Workers, utilizes Durable Objects to manage state, and provides MCP tools. SQLite storage is enabled.

## Features

*   **MCP Server:** Implementation of an MCP server using `@modelcontextprotocol/sdk`.
*   **Transports:**
    *   Server-Sent Events (SSE) (`/sse` endpoint)
    *   Streamable HTTP (`/mcp` endpoint)
*   **Provided Tools:**
    *   `dice_roll`: Returns the result of rolling a die with the specified number of sides (default is 6).
        *   Input Schema: `{ sides?: number }` (1-100)
    *   `weather`: Returns weather information (currently mock data) for the specified city.
        *   Input Schema: `{ city: string }`

## Tech Stack

*   [Cloudflare Workers](https://workers.cloudflare.com/)
*   [Cloudflare Durable Objects](https://developers.cloudflare.com/workers/learning/using-durable-objects/) (SQLite backend)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Zod](https://zod.dev/) (for schema validation)
*   [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
*   [agents](https://www.npmjs.com/package/agents) (McpAgent)
*   [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (Development and deployment tool)

## Setup and Execution

### 1. Install Dependencies

Navigate to the project directory ([`otak-mcp-test`](otak-mcp-test)) and install the dependencies.

```bash
cd otak-mcp-test
npm install
```

### 2. Local Development

Start the local development server using Wrangler.

```bash
npm start
# or
npx wrangler dev
```

This runs the Worker locally and automatically reflects changes.

### 3. Deployment

Deploy the Worker to Cloudflare.

```bash
npm run deploy
# or
npx wrangler deploy
```

### 4. SSE Test

Use the provided script ([`test-sse.js`](otak-mcp-test/test-sse.js:1)) to test the SSE endpoint of the local or deployed Worker.

```bash
npm run test:sse <URL>
```

Replace `<URL>` with the URL of the local development server (e.g., `http://localhost:8787/sse`) or the deployed Worker URL (e.g., `https://your-worker-name.your-subdomain.workers.dev/sse`).

## Endpoints

*   **SSE:** `https://<YOUR_WORKER_URL>/sse`
*   **Streamable HTTP:** `https://<YOUR_WORKER_URL>/mcp`

Replace `<YOUR_WORKER_URL>` with the URL of your deployed Worker.

## Configuration

Worker configuration is done in the [`otak-mcp-test/wrangler.jsonc`](otak-mcp-test/wrangler.jsonc:1) file. Key settings include:

*   `name`: Worker name
*   `main`: Entry point file ([`src/index.ts`](otak-mcp-test/src/index.ts:1))
*   `compatibility_date`, `compatibility_flags`: Worker compatibility settings
*   `durable_objects`: Durable Object binding settings (`MCP_OBJECT` is bound to the `MyMCP` class)
*   `migrations`: Durable Object migration settings (e.g., enabling SQLite)

## Source Code (`otak-mcp-test/src`)

*   **[`index.ts`](otak-mcp-test/src/index.ts:1):**
    *   The main entry point for the Cloudflare Worker.
    *   Handles incoming requests and routes them based on the path (`/sse` or `/mcp`).
    *   Delegates request processing to the [`MyMCP`](otak-mcp-test/src/MyMcp.ts:1) Durable Object.
*   **[`MyMcp.ts`](otak-mcp-test/src/MyMcp.ts:1):**
    *   Implementation of the `MyMCP` Durable Object class.
    *   Extends `McpAgent` and initializes `McpServer`.
    *   Defines the available MCP tools (`dice_roll`, `weather`) and handles their execution logic.

## Debugging

To view real-time logs from the deployed Worker, use the `wrangler tail` command.

```bash
npx wrangler tail otak-mcp-test --format pretty
# Or for detailed JSON format
npx wrangler tail otak-mcp-test --format json
```

### MCP Inspector

The `@modelcontextprotocol/inspector` GUI tool is useful for testing the MCP server.

```bash
npx @modelcontextprotocol/inspector
```

After launching, access it in your browser at `http://127.0.0.1:6274`.

*   **Transport Type:** Select `SSE` or `Streamable HTTP`.
*   **URL:** Enter the Worker's endpoint URL (e.g., `https://<YOUR_WORKER_URL>/sse` or `https://<YOUR_WORKER_URL>/mcp`).
*   **Connect:** Click to connect.
*   **List Tools:** View the list of available tools.
*   **Run Tool:** Execute a tool with specified parameters.

For more detailed debugging techniques, refer to [`.roo/rules/1-debug.md`](.roo/rules/1-debug.md:1).