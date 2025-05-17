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
---

# otak-mcp-pmbok

This project is an MCP server designed to answer questions about the Project Management Body of Knowledge (PMBOK) using a Retrieval-Augmented Generation (RAG) approach. It leverages Cloudflare Workers AI and Vectorize.

## Overview

Based on the `otak-mcp-test` structure, this Worker imports PMBOK content (from [`otak-mcp-pmbok/pmbok.md`](otak-mcp-pmbok/pmbok.md)), chunks and vectorizes it upon the first request, and stores the embeddings in a Cloudflare Vectorize index (`pmbok-index`). It provides an MCP tool (`ask_pmbok`) to query this knowledge base.

## Features

*   **MCP Server:** Implementation using `@modelcontextprotocol/sdk`.
*   **Transports:** Supports Streamable HTTP (`/mcp`). SSE might work but is untested for this specific RAG implementation.
*   **RAG Pipeline:**
    *   Uses Cloudflare Workers AI (`@cf/baai/bge-base-en-v1.5`) for text embeddings.
    *   Uses Cloudflare Vectorize for similarity search.
    *   Uses Cloudflare Workers AI (`@cf/meta/llama-3-8b-instruct`) for answer generation based on retrieved context.
*   **Provided Tools:**
    *   `ask_pmbok`: Answers questions about PMBOK based on the content in [`pmbok.md`](otak-mcp-pmbok/pmbok.md).
        *   Input Schema: `{ query: string }`

## Setup and Execution

Similar to `otak-mcp-test`, but navigate to the [`otak-mcp-pmbok`](otak-mcp-pmbok) directory.

### 1. Install Dependencies

```bash
cd otak-mcp-pmbok
npm install
```

### 2. Create Vectorize Index (if not done automatically by deploy)

The Worker expects a Vectorize index named `pmbok-index`. If the first deployment fails due to a missing index, create it manually:

```bash
# Ensure you are in the otak-mcp-pmbok directory
npx wrangler vectorize create pmbok-index --dimensions=768 --metric=cosine
```
*(Note: The embedding model `@cf/baai/bge-base-en-v1.5` outputs 768 dimensions, and `cosine` is suitable for text similarity.)*

### 3. Deployment

```bash
# Ensure you are in the otak-mcp-pmbok directory
npm run deploy
# or
npx wrangler deploy
```
The first request after deployment will trigger the vectorization and indexing process, which might take some time.

### 4. Testing

Use the MCP Inspector (`npx @modelcontextprotocol/inspector`) to connect to the deployed Worker's `/mcp` endpoint (e.g., `https://otak-mcp-pmbok.your-subdomain.workers.dev/mcp`) and test the `ask_pmbok` tool.

## Configuration

Configuration is managed in [`otak-mcp-pmbok/wrangler.toml`](otak-mcp-pmbok/wrangler.toml). Key additions include:

*   `rules`: Defines how to load `.md` files as text.
*   `ai`: Binding for Cloudflare Workers AI.
*   `vectorize`: Binding for the `pmbok-index` Vectorize index.

## Source Code (`otak-mcp-pmbok/src`)

*   **[`index.ts`](otak-mcp-pmbok/src/index.ts):** Main Worker entry point, routes requests to the Durable Object.
*   **[`MyMcp.ts`](otak-mcp-pmbok/src/MyMcp.ts):** Implements the Durable Object, MCP server, RAG pipeline, and the `ask_pmbok` tool. Handles dynamic vectorization and indexing on first load.
*   **[`types/assets.d.ts`](otak-mcp-pmbok/src/types/assets.d.ts):** TypeScript definitions for importing `.md` files.

## Debugging

Use `wrangler tail` to view real-time logs:

```bash
npx wrangler tail otak-mcp-pmbok --format pretty
```

---

# otak-mcp-commander

This project is a C# implementation of an MCP server that provides various system command and file operation tools using the `ModelContextProtocol` library. It uses stdio as its transport mechanism, making it suitable for embedded use cases where direct process communication is needed.

## Overview

`otak-mcp-commander` is a .NET-based MCP server that runs as a console application and communicates via standard input/output. It provides several utility tools for file operations, command execution, and logging that can be invoked through the Model Context Protocol.

## Features

*   **MCP Server:** Implementation using the `ModelContextProtocol` .NET library.
*   **Transport:** Stdio-based communication (`WithStdioServerTransport`).
*   **Provided Tools:**
    *   `GetCurrentDirectory`: Returns the current working directory.
    *   `ListFiles`: Lists files and directories in a specified path.
    *   `ExecuteCommand`: Executes a command-line command and returns its output.
    *   `WriteLog`: Writes a message to the log file.
    *   `TailLog`: Retrieves the latest lines from the log file.
    *   `GetLogPath`: Returns the path to the log file.

## Tech Stack

*   [.NET 9.0](https://dotnet.microsoft.com/) (Runtime and SDK)
*   [ASP.NET Core](https://docs.microsoft.com/aspnet/core) (Web framework)
*   [ModelContextProtocol](https://www.nuget.org/packages/ModelContextProtocol/) (MCP library for .NET)

## Setup and Execution

### 1. Prerequisites

*   .NET 9.0 SDK or later installed

### 2. Build the Project

Navigate to the project directory and build the application:

```bash
cd otak-mcp-commander
dotnet build
```

### 3. Run the MCP Server

```bash
dotnet run
```

This starts the MCP server, which listens on stdin for incoming requests and responds via stdout.

### 4. Connect to the Server

To communicate with the server, you need to write a client that can send JSON-RPC formatted messages to the server's stdin and read responses from its stdout. The server expects JSON-RPC 2.0 format messages.

Example request format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "GetCurrentDirectory",
  "params": {}
}
```


## Source Code

*   **[`Program.cs`](otak-mcp-commander/Program.cs):** Main entry point that configures and starts the MCP server.
*   **[`CommanderTool.cs`](otak-mcp-commander/CommanderTool.cs):** Implements the MCP tools and their execution logic.