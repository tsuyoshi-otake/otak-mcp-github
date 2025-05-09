# MCP (Model Context Protocol) Transports

MCP is a protocol for linking LLMs (Large Language Models) with external tools. Multiple "Transports" (communication methods) are defined.

## 1. stdio Transport

**Overview**: The earliest and minimal configuration of MCP. It uses "standard input/output (stdin/stdout)" for inter-process communication.
**Use cases**: For simple starts in testing or local execution.

## 2. HTTP Transport

**Overview**: A method that uses HTTP endpoints for request/response.
**Use cases**: Convenient for network-based integration and operation with Docker/Kubernetes.

## 3. SSE Transport (Server-Sent Events)

**Overview**: Achieves "server → client" directional streaming communication (event-driven) over HTTP. The client first makes a request to /sse, and the server pushes events or messages.
**Use cases**: For cases requiring sequential responses or state management.

## 4. Streamable HTTP Transport (New method)

**Overview**: An HTTP-based streaming transport, newly being standardized, partly to address the challenges of SSE.
**Use cases**: Under adjustment; for future standardization.

## Summary Table

| Name             | Overview                                                | Notes                      |
|------------------|---------------------------------------------------------|----------------------------|
| stdio            | Minimal configuration using standard input/output       | Basic, suitable for local  |
| HTTP             | Normal HTTP request/response                            | Versatile, API-oriented    |
| SSE              | One-way notification from server to client              | State persistence, stream response |
| Streamable HTTP  | New standard aiming for bidirectional, multiplexed communication | Future mainstream candidate |

## Additional Notes

- Transports are being expanded as the MCP specification evolves.
- Support status differs for each MCP server implementation, so it's essential to check official documentation or release notes when using them.

## Related Documents (English/Developer)

- https://github.com/modelcontextprotocol
- https://modelcontextprotocol.io/introduction

*As of 2025, Smile Chatbot Assistant supports HTTP and SSE.*

## Implementation: Deploying an MCP Server with SSE on Cloudflare Workers

### Overview: MCP and Server-Sent Events on Cloudflare Workers

The Model Context Protocol (MCP) can be deployed remotely using Cloudflare Workers with Server-Sent Events (SSE) for streaming data from server to client. In this setup:

- MCP clients connect to an MCP server's SSE endpoint (typically at `/sse`)
- The connection remains open to receive streamed events (tool outputs, progress updates, resource data)
- Clients send requests (tool invocations) via HTTP POST to the server (at a separate endpoint)
- SSE functions as a one-way channel from server to client

Cloudflare Workers is particularly well-suited for hosting MCP servers because:
- It can maintain persistent connections and stream events
- The runtime supports streaming HTTP responses needed for SSE
- Cloudflare's edge network provides global low-latency access

When deployed, your MCP server will be accessible at your Worker URL (e.g., `your-worker.workers.dev/sse`).

### Implementations Supporting SSE on Cloudflare Workers

Cloudflare's Agents SDK provides built-in support for MCP servers on Workers, abstracting much of the SSE handling complexity:

```typescript
import MyMcpAgent from "./my-mcp-server";  // your MCP server implementation
import MyAuthHandler from "./auth-handler";  // (optional) authentication handler

export default new OAuthProvider({
  apiHandlers: {
    "/sse": MyMcpAgent.serveSSE("/sse"),  // Serve MCP over SSE transport
    "/mcp": MyMcpAgent.serve("/mcp"),     // Serve new Streamable HTTP transport (optional)
  },
  defaultHandler: MyAuthHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
});
```

The configuration above:
- Sets up the legacy SSE transport at `/sse`
- Optionally includes the newer Streamable HTTP transport at `/mcp`
- Supports both traditional SSE clients and newer streaming HTTP clients
- Includes OAuth authentication endpoints if needed

Cloudflare's SDK was updated in early 2025 to support both transports concurrently, ensuring backward compatibility.

### Implementing SSE Transport in Cloudflare Workers

To implement SSE in a Cloudflare Worker, your code needs to:

1. Handle the SSE endpoint route (e.g., `/sse`)
2. Send a response with appropriate SSE headers 
3. Create a streamable body that remains open
4. Write events to the response stream in SSE format, flushing as they become available

Here's a simplified example using Cloudflare Workers' Streams API:

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/sse") {
      // Create a pair of streams for reading and writing
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Write an initial event
      writer.write(encoder.encode(`data: {"message": "SSE stream initialized"}\n\n`));

      // Periodically send events (replace with real tool output logic)
      const intervalId = setInterval(() => {
        const data = JSON.stringify({ timestamp: new Date().toISOString() });
        writer.write(encoder.encode(`data: ${data}\n\n`));
      }, 5000);

      // Listen for client disconnection to clean up
      writable.closed.then(() => {
        clearInterval(intervalId);
      });

      // Return the streaming response with appropriate headers
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache"
        }
      });
    }

    // Fallback for other routes
    return new Response("Not found", { status: 404 });
  }
};
```

Key aspects of this implementation:
- Uses `TransformStream` to create readable/writable streams
- Sets essential headers: `Content-Type: text/event-stream` and `Cache-Control: no-cache`
- Formats SSE messages with proper `data:` lines and double newlines (`\n\n`)
- Handles client disconnection cleanup

### Handling Client-to-Server Messages

Since SSE is unidirectional (server-to-client only), bidirectional communication requires separate channels:

#### Traditional MCP Pattern (Two-Channel)
- Client opens an SSE connection to `/sse` to receive events
- Client sends tool invocation requests via separate HTTP POST (e.g., to `/sse/messages`)
- Two separate channels for incoming events and outgoing commands

#### Cloudflare's Streamable HTTP Transport (Unified)
- Uses a single endpoint for both directions (e.g., `/mcp`)
- Connection starts as regular HTTP request and can upgrade to SSE stream if needed
- Server can respond immediately for quick operations or switch to streaming
- Enables bidirectional communication over one request
- Using `MyMcpAgent.serve('/mcp')` handles this automatically in the SDK

### Example: SSE Endpoint Response Format

SSE messages must follow this format:

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type": "mcp_tool_list_response", "tools": [ {...} ]}

data: {"type": "mcp_tool_invocation_response", "invocationId": "123", "result": { ... }}

data: {"type": "mcp_error", "message": "Tool execution failed"}
```

Each `data:` block represents one event, and the blank line after each block is required. In MCP, the JSON payloads typically indicate different message types (tool lists, invocation results, errors, etc.).

### Caveats and Best Practices for SSE on Cloudflare Workers

When deploying an MCP server with SSE on Cloudflare Workers, consider these important factors:

1. **Worker Limits:**
   - No explicit duration limit on streaming responses
   - Workers should not consume CPU unnecessarily while idle
   - Use asynchronous patterns that yield between events

2. **Idle Timeouts:**
   - Cloudflare may terminate requests with HTTP 524 after ~100 seconds of inactivity
   - Send periodic keep-alive messages: `writer.write(encoder.encode(": heartbeat\n\n"));`
   - These comment lines (starting with `:`) keep connections alive but are ignored by clients

3. **Headers and Compression:**
   - `Connection` headers cannot be set in Workers (and aren't needed)
   - Always set `Content-Type: text/event-stream` and `Cache-Control: no-cache`
   - Cloudflare handles content encoding automatically

4. **Flushing and Chunking:**
   - Each `writer.write()` immediately queues data to be sent
   - No manual flushing is needed; Workers runtime handles streaming
   - Ensure proper `\n\n` sequence to delimit events

5. **Client Reconnection:**
   - SSE clients automatically attempt to reconnect if the connection breaks
   - Use Durable Objects or other storage to maintain session state
   - Cloudflare's MCP SDK uses Durable Objects for session persistence

6. **Testing:**
   - Use `wrangler dev` or dashboard "Quick Edit" to test SSE streaming
   - Browser dev tools can show stream writing or Worker errors
   - Test with actual MCP clients to verify compatibility

### References and Resources

- [Cloudflare MCP Documentation: Model Context Protocol Overview](https://developers.cloudflare.com/mcp)
- [Cloudflare Blog: Bringing streamable HTTP transport to MCP](https://blog.cloudflare.com/streamable-http-mcp)
- [Cloudflare Blog: Build and deploy remote MCP servers](https://blog.cloudflare.com/deploy-mcp-workers)
- [Cloudflare Workers Docs: Limits and behavior](https://developers.cloudflare.com/workers/limits)
- [Stack Overflow: Implementing SSE in Cloudflare Workers](https://stackoverflow.com/questions/cloudflare-workers-sse)
- [Cloudflare Community: SSE and 524 errors](https://community.cloudflare.com/t/sse-524-errors)
- [GitHub Example: Cloudflare Workers SSE Implementation](https://gist.github.com/sse-worker-example)

By following these guidelines, you can deploy a robust MCP server on Cloudflare Workers that leverages SSE for real-time, event-driven communication to AI agents, with the performance and scalability benefits of Cloudflare's edge network.