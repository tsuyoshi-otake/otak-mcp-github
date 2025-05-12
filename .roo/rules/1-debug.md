# Cloudflare Workers & MCP Server Debugging Techniques

This document outlines effective techniques for debugging Cloudflare Workers, particularly when developing Model Context Protocol (MCP) servers using Durable Objects and the `agents` package.

## 1. Real-time Log Tailing with `wrangler tail`

The `wrangler tail` command is indispensable for observing real-time logs from your deployed Worker. This provides immediate feedback on requests, responses, console logs within your Worker, and, crucially, any exceptions thrown.

**Basic Usage:**
```bash
npx wrangler tail <YOUR_WORKER_NAME>
```

**Enhanced Logging:**

*   **Pretty Format (for readability):**
    ```bash
    npx wrangler tail <YOUR_WORKER_NAME> --format pretty
    ```
*   **JSON Format (for detailed, structured logs):** This format is highly recommended when debugging exceptions, as it often includes the full exception object with stack traces.
    ```bash
    npx wrangler tail <YOUR_WORKER_NAME> --format json
    ```
*   **Saving Logs to a File while Tailing (PowerShell):** To keep a persistent record of logs while also viewing them live, use `Tee-Object`.
    ```powershell
    npx wrangler tail <YOUR_WORKER_NAME> --format json | Tee-Object -FilePath worker_logs.log
    ```
    (Replace `worker_logs.log` with your desired filename.)

**Interpreting Logs:**
*   Look for `outcome: "exception"` in JSON logs. The `exceptions` array will contain details.
*   Check `console.log` statements you've added in your Worker code ([`MyMcp.ts`](otak-mcp-test/src/MyMcp.ts:1), [`index.ts`](otak-mcp-test/src/index.ts:1)).
*   Pay attention to the `event.request.url` and `event.response.status` to understand which requests are failing.

## 2. Incremental Testing with `curl`

For testing specific HTTP endpoints (like `/sse` or `/mcp`) directly, `curl` is a powerful tool. It allows you to send requests with custom headers and data, bypassing browser complexities or client-side tools initially.

**Basic GET Request:**
```bash
curl "https://<YOUR_WORKER_URL>/<ENDPOINT>"
```

**Verbose Output (`-v`):** Shows request and response headers, useful for debugging HTTP-level issues.
```bash
curl -v "https://<YOUR_WORKER_URL>/<ENDPOINT>"
```

**SSE Testing (`-N` for no buffering):**
```bash
curl -N "https://<YOUR_WORKER_URL>/sse" -H "Accept: text/event-stream" -H "Mcp-Session-Id: <YOUR_SESSION_ID>"
```
*   The `Mcp-Session-Id` header is often required by MCP servers. Use a UUID.

**Streamable HTTP (MCP) POST Request:**
```bash
curl "https://<YOUR_WORKER_URL>/mcp" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "Mcp-Session-Id: <YOUR_SESSION_ID>" \
     -d '{"jsonrpc": "2.0", "method": "<TOOL_NAME>", "params": {"param1": "value1"}, "id": 1}'
```
*   Ensure the JSON-RPC payload (`-d`) is correctly formatted.

**Strategy:**
*   Start with simple `curl` requests to verify basic connectivity and routing.
*   Gradually add headers and data payloads as required by the protocol.
*   Always check `wrangler tail` logs in conjunction with `curl` requests to see server-side behavior.

## 3. MCP Inspector

The `@modelcontextprotocol/inspector` is a GUI tool specifically designed for testing MCP servers.

**Launch:**
```bash
npx @modelcontextprotocol/inspector
```
Access it at `http://127.0.0.1:6274`.

**Usage:**
*   Select the **Transport Type** (SSE or Streamable HTTP).
*   Enter the full **URL** of your deployed MCP endpoint (e.g., `https://<YOUR_WORKER_URL>/sse` or `https://<YOUR_WORKER_URL>/mcp`).
*   Click **Connect**.
*   Use **List Tools** to verify tool discovery.
*   Use **Run Tool** to test specific tool execution with parameters.

**Benefits:**
*   Simulates a real MCP client.
*   Helps identify issues with tool definitions, parameter schemas, or handler logic.
*   Provides its own client-side logs, which can be correlated with `wrangler tail` server logs.

## 4. Iterative Code Changes and Deployment

When an error is identified (especially from `wrangler tail` logs):

1.  **Isolate the Problem:** Try to pinpoint the exact code section causing the issue. Comment out blocks of code (like tool definitions, or specific logic within `fetch` or `init` methods) to narrow down the source.
2.  **Make Small, Focused Changes:** Modify one aspect of the code at a time.
3.  **Deploy Frequently:** After each small change, redeploy using `npx wrangler deploy`. This allows you to quickly see if the change resolved the issue or introduced new ones.
4.  **Test After Each Deployment:** Use `curl` or MCP Inspector to re-test the specific scenario that was failing.

## 5. Configuration File Management (`wrangler.jsonc` or `wrangler.toml`)

Incorrect configuration is a common source of errors, especially with Durable Objects.

*   **Durable Object Bindings:** Ensure `durable_objects.bindings` correctly maps the binding name used in your code (e.g., `env.MCP_OBJECT`) to the exported class name (e.g., `MyMCP`).
*   **Migrations:**
    *   When introducing a new Durable Object class or changing its storage type (e.g., to enable SQLite), migrations are crucial.
    *   For SQLite: Use `new_sqlite_classes: ["YourClassName"]` instead of `new_classes`.
    *   If converting an existing class to SQLite, you might need to first delete the old class data using a `deleted_classes: ["YourOldClassName"]` migration, then re-introduce it with `new_sqlite_classes`. This was a key step in resolving the "This Durable Object is not backed by SQLite storage" error.
    *   Pay attention to `wrangler deploy` warnings regarding migrations.
*   **`compatibility_date` and `compatibility_flags`:** Ensure these are set appropriately for the features you're using (e.g., `nodejs_compat` if using Node.js APIs).

## 6. Dependency Management

*   **Version Mismatches:** As seen with `zod`, library versions can cause subtle issues if your code relies on an API شكل from a different version than what's installed or what a dependent package (like `agents`) expects.
    *   Check `package.json` and `node_modules/<package>/package.json` to understand version dependencies.
    *   If a blog post or example uses a specific version, try aligning your project's versions if you encounter compatibility problems.
*   **Clean Installs:** If type errors persist unexpectedly, deleting `node_modules` and `package-lock.json` (or `yarn.lock`) and running `npm install` (or `yarn install`) יכול sometimes resolve inconsistencies.

## 7. TypeScript Configuration (`tsconfig.json`)

*   Ensure `module`, `moduleResolution`, and flags like `esModuleInterop` or `allowSyntheticDefaultImports` are compatible with your libraries and how they export modules. For example, `esModuleInterop: true` can help with importing CommonJS-style modules into ES Modules.
*   The combination `"moduleResolution": "Node16"` and `"module": "Node16"` is often a good default for modern Node.js/Worker projects.

By systematically applying these techniques, you can effectively diagnose and resolve issues when developing Cloudflare Workers and MCP servers.