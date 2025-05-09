# How to Build and Host Remote MCP Servers on Cloudflare

*Published May 2, 2025 by Lynn Mikami*

The evolution of Large Language Models (LLMs) into sophisticated AI agents capable of executing tasks marks a significant leap in artificial intelligence. However, the true power of these agents is unlocked when they can reliably and securely interact with the outside world – accessing APIs, querying databases, executing code, and leveraging specialized tools. The Model Context Protocol (MCP) emerges as a crucial standard, defining how these agents (MCP Clients) discover, authenticate with, and utilize tools provided by MCP Servers.

While running MCP tools locally alongside an agent is feasible for simple cases, hosting them on a remote server offers a paradigm shift in terms of security, manageability, scalability, and capability. A remote MCP server acts as a controlled gateway, allowing agents to leverage powerful functionalities without compromising security or requiring complex local setups. Cloudflare Workers, with its globally distributed serverless compute platform, robust security features, and seamless developer experience, presents an ideal environment for deploying these critical remote MCP infrastructure components.

## The Imperative for Remote MCP Servers: Technical Motivations

Hosting MCP servers remotely isn't merely a deployment choice; it's often a technical necessity driven by several factors:

### Security Isolation and Control

This is paramount. Remote servers act as a trust boundary.

- **Authentication/Authorization**: Centralized enforcement ensures only legitimate clients/users access tools. Granular permissions (e.g., based on user roles derived from OAuth tokens) can restrict access to specific tools or actions within tools.
- **Network Segregation**: Tools interacting with internal APIs, private databases, or sensitive infrastructure can be exposed selectively through the MCP server without exposing the internal systems directly to the internet or the agent's environment. The Worker acts as a reverse proxy with added intelligence.
- **Input Sanitization & Validation**: The server provides a critical point to validate and sanitize inputs received from the agent before passing them to backend systems or tool implementations, mitigating injection risks.

### Centralized Management and Maintainability

- **Single Source of Truth**: Tool logic resides in one place, simplifying updates, bug fixes, and versioning. Pushing an update to the Worker instantly makes it available to all connected clients.
- **Dependency Management**: Complex tool dependencies (libraries, SDKs, specific runtimes) are managed on the server, freeing the client environment from these requirements.
- **Configuration Management**: API keys, database credentials, and other sensitive configurations needed by tools are securely stored using Worker Secrets, never exposed to the client.

### Scalability and Performance

- **Serverless Scaling**: Cloudflare Workers automatically scales compute resources based on incoming request volume, handling unpredictable loads without manual intervention.
- **Global Distribution**: Deploying the Worker to Cloudflare's edge network minimizes latency for agents connecting from anywhere in the world.
- **Resource Pooling**: Computationally intensive tools can leverage the server's resources, rather than straining the client's machine. Asynchronous processing using Queues can handle long-running tasks without blocking the agent interaction.

### State Management

While MCP itself is primarily stateless regarding tool invocation, many tools require persistent state across multiple calls or users (e.g., session data, user preferences, ongoing computations). Remote servers can leverage Cloudflare's storage solutions (KV Store, Durable Objects, D1 Databases) to manage this state effectively, something difficult to achieve reliably in a purely client-side setup.

### Abstraction and Encapsulation

The MCP server can abstract complex backend logic or legacy systems, presenting a clean, standardized tool interface to the agent, regardless of the underlying implementation complexity.

## Understanding the Model Context Protocol (MCP) Core Components

Before building, let's solidify our understanding of MCP:

- **MCP Client**: The AI agent or application (e.g., Claude, Cursor, a custom LLM application) that needs to use external tools.
- **MCP Server**: The service (in our case, a Cloudflare Worker) that hosts and exposes tools according to the MCP specification.
- **Tools**: Specific functionalities exposed by the server (e.g., calculator, database_query, send_email). Each tool typically has a definition (name, description, input schema, output schema) that the client uses to understand how to invoke it.
- **Transport**: The communication mechanism. MCP commonly uses Server-Sent Events (SSE) over HTTP/S for real-time, unidirectional communication from server to client. This allows the server to stream responses, progress updates, or multiple tool results back to the client efficiently. The standard endpoint path is often /sse.
- **Authorization**: The mechanism for securing tool access. While MCP defines an authorization framework, the implementation often relies on standard protocols like OAuth 2.0, where the client obtains an access token that is presented to the MCP server with each request.

## Building a Public Remote MCP Server (No Authentication)

Let's dissect the process and structure of creating a basic, publicly accessible MCP server using the Cloudflare template.

### 1. Project Initialization

```bash
npm create cloudflare@latest my-mcp-server -- --template=cloudflare/ai/demos/remote-mcp-authless
cd my-mcp-server
```

### 2. Examining the Project Structure

- **wrangler.toml**: The configuration file for the Cloudflare Worker. Defines the worker's name, compatibility date, entry point (src/index.ts), and potentially bindings (like secrets, KV namespaces).

```toml
name = "my-mcp-server"
main = "src/index.ts"
compatibility_date = "YYYY-MM-DD" # Use a recent date

# Example of adding a binding later
# [[kv_namespaces]]
# binding = "TOOL_STATE"
# id = "your_kv_namespace_id"
```

- **package.json**: Defines project dependencies, including @cloudflare/workers-types for TypeScript definitions and potentially MCP helper libraries.
- **tsconfig.json**: TypeScript configuration.
- **src/**: Contains the Worker's source code.
  - **index.ts**: The main entry point specified in wrangler.toml. This file typically sets up the MCP server instance and defines the tools.
  - **tools/**: Often, tool implementations are organized into separate files within a tools directory for better modularity.

### 3. Core Logic in src/index.ts (Conceptual Example)

```typescript
import { McpServer, Tool } from '@modelcontextprotocol/server'; // Hypothetical library import

// Define a simple calculator tool
const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Performs basic arithmetic operations.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['operation', 'a', 'b'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      result: { type: 'number' },
      error: { type: 'string', nullable: true },
    },
    required: ['result', 'error'],
  },
  async execute(input: { operation: string; a: number; b: number }): Promise<{ result: number | null, error: string | null }> {
    try {
      switch (input.operation) {
        case 'add': return { result: input.a + input.b, error: null };
        case 'subtract': return { result: input.a - input.b, error: null };
        case 'multiply': return { result: input.a * input.b, error: null };
        case 'divide':
          if (input.b === 0) {
            return { result: null, error: 'Division by zero is not allowed.' };
          }
          return { result: input.a / input.b, error: null };
        default:
          return { result: null, error: `Unknown operation: ${input.operation}` };
      }
    } catch (e: any) {
      console.error("Calculator tool error:", e);
      return { result: null, error: e.message || 'An unexpected error occurred.' };
    }
  }
};

// Initialize the MCP Server instance
const mcpServer = new McpServer({
  // No authentication handler needed for public server
});

// Register the tool
mcpServer.addTool(calculatorTool);
// Potentially add more tools here...

// Define the Worker fetch handler
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // The McpServer library would typically provide a method
    // to handle incoming requests and route them appropriately
    // based on the URL path (e.g., /sse for MCP communication)
    return mcpServer.handleRequest(request); // Conceptual handling
  }
};
```

Note: The exact library (@modelcontextprotocol/server) and API might differ based on the specific Cloudflare template or community libraries used. This illustrates the core concepts.

### 4. The Role of Server-Sent Events (SSE)

When a client connects to the /sse endpoint, a persistent HTTP connection is established. The server keeps this connection open and sends data packets prefixed with data: . Each packet typically contains a JSON payload representing an MCP message (e.g., tool result, error, progress update).

```
Client Connects: GET /sse HTTP/1.1
Server Responds:
 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type": "mcp_tool_list_response", "tools": [{"name": "calculator", ...}]}

data: {"type": "mcp_tool_invocation_response", "invocationId": "123", "result": {"result": 42, "error": null}}

data: {"type": "mcp_error_response", "message": "Tool execution failed"}
```

The client-side MCP library parses these events. SSE is efficient for this server-push model, avoiding the overhead of repeated polling.

### 5. Local Development and Deployment

- **npm start**: Uses wrangler dev internally to run the Worker code locally, simulating the Cloudflare environment. It watches for file changes and reloads automatically. Crucially, it loads environment variables from .dev.vars.
- **npx wrangler deploy**: Bundles the TypeScript code into JavaScript, uploads it to Cloudflare, and provisions the necessary resources. It uses secrets configured via wrangler secret put for the production environment.

## Implementing Secure Access: Authentication with OAuth 2.0

Adding authentication transforms the public server into a controlled environment. The remote-mcp-github-oauth template demonstrates the Authorization Code Grant flow, a standard and secure OAuth 2.0 pattern.

### 1. Project Initialization

```bash
npm create cloudflare@latest my-mcp-server-auth -- --template=cloudflare/ai/demos/remote-mcp-github-oauth
cd my-mcp-server-auth
```

### 2. The OAuth 2.0 Authorization Code Flow in MCP

1. **Client Initiates Connection**: The MCP Client (e.g., via mcp-remote or directly if supported) attempts to connect to the server's /sse endpoint.
2. **Server Detects No Auth**: The MCP server (specifically, the OAuthProvider middleware in the template) detects the lack of a valid access token associated with the request.
3. **Redirect to Authorization Endpoint**: The server redirects the user's browser (often opened by the client tool like mcp-remote) to its own /authorize endpoint.
4. **Redirect to OAuth Provider**: The /authorize endpoint constructs the authorization URL for the OAuth provider (e.g., GitHub) including:
   - client_id: The ID of the registered OAuth App.
   - redirect_uri: The callback URL on the MCP server (e.g., https://.../callback).
   - response_type=code: Indicates the Authorization Code Grant flow.
   - scope: Requested permissions (e.g., read:user).
   - state: A random, unguessable string to prevent CSRF attacks. The server should store this temporarily and verify it later.
5. **User Authentication & Consent**: The user logs into the OAuth provider (if not already) and grants permission to the MCP server application.
6. **Provider Redirects with Code**: The OAuth provider redirects the user's browser back to the MCP server's redirect_uri (/callback) with an authorization code and the original state parameter.
7. **Server Exchanges Code for Token**: The /callback handler on the MCP server:
   - Verifies the received state parameter against the one stored earlier.
   - Makes a secure, server-to-server request to the OAuth provider's /token endpoint, sending its client_id, client_secret, the received code, and the redirect_uri.
   - Receives an access_token (and potentially a refresh_token) from the provider.
8. **Server Associates Token with Client**: The MCP server now needs a way to link this access_token to the original MCP client connection. This mechanism can vary. Often, the server might issue its own session token or JWT back to the client-side component (like mcp-remote) that initiated the flow, which is then used for subsequent /sse connections. The access token itself might be stored server-side, associated with this session.
9. **Authenticated Client Connection**: The MCP client reconnects to /sse, this time presenting the necessary credential (session token or perhaps the access token directly, depending on design).
10. **Server Validates Token**: The OAuthProvider middleware intercepts the request, validates the presented credential (e.g., verifies the session token or checks the access_token with the OAuth provider if necessary), and allows the connection to proceed to the apiHandler (the actual MCP tool router).
11. **Tool Invocation**: Subsequent tool calls over the established SSE connection are implicitly authenticated via the validated session/token.

### 3. Template Code Structure (remote-mcp-github-oauth)

The src/index.ts in the auth template sets up this flow:

```typescript
import { McpServer, OAuthProvider, Tool } from '@modelcontextprotocol/server'; // Hypothetical
import GitHubHandler from './github-handler'; // Implements GitHub-specific logic

// Define tools (as before)
const myTool: Tool = { /* ... */ };

// Setup the core MCP logic handler
const MyMCPRouter = new McpServer();
MyMCPRouter.addTool(myTool);

// Setup the OAuth Provider wrapper
export default new OAuthProvider({
  apiRoute: "/sse",           // Path for authenticated MCP communication
  apiHandler: MyMCPRouter,   // Handler for authenticated requests to /sse

  defaultHandler: GitHubHandler, // Handler for unauthenticated requests (starts OAuth flow)

  // OAuth endpoints managed by this Worker
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token", // Note: This is the Worker's endpoint, not GitHub's
  clientRegistrationEndpoint: "/register", // For dynamic client registration (less common)
  callbackEndpoint: "/callback", // Added for clarity, often configured within the handler

  // Configuration for the OAuth provider (passed to GitHubHandler)
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  // ... other provider-specific config
});
```

The GitHubHandler (or equivalent for other providers) would contain the logic for:
- Building the GitHub authorization URL.
- Handling the /callback request, verifying the state.
- Exchanging the code for an access_token by calling GitHub's token endpoint.
- Managing how the obtained token is associated with the client connection.

### 4. Security Considerations for OAuth

- **State Parameter**: Absolutely essential to prevent Cross-Site Request Forgery (CSRF). Generate a strong random string, store it temporarily (e.g., in KV with a short TTL or encrypted in a cookie), and validate it on callback.
- **Client Secrets**: Protect GITHUB_CLIENT_SECRET rigorously using wrangler secret. Never commit it to version control or expose it client-side.
- **HTTPS**: All communication must occur over HTTPS. Cloudflare handles this automatically for deployed workers.
- **Redirect URI Validation**: OAuth providers strictly enforce registered redirect URIs. Ensure the URIs in your GitHub OAuth App settings exactly match those used by your Worker (including localhost for development and the workers.dev URL for production).
- **Token Handling**: Decide how the client presents its authenticated status. Directly sending the provider's access_token in an Authorization: Bearer <token> header is common for stateless APIs, but for stateful SSE connections, a server-issued session mechanism might be preferred after the initial OAuth exchange. Avoid storing sensitive tokens in insecure client-side locations.
- **Scope Limitation**: Request only the minimum necessary OAuth scopes (e.g., read:user just to identify the user, not repo access unless a tool specifically needs it).

### 5. Adapting to Other OAuth Providers

Replace GitHubHandler with a handler specific to the new provider (e.g., GoogleHandler, Auth0Handler). This involves:
- Using the correct authorization and token endpoint URLs for the provider.
- Adjusting scope parameters.
- Parsing the user profile information correctly from the provider's API (if needed for authorization logic).
- Setting the corresponding CLIENT_ID and CLIENT_SECRET via Wrangler secrets.

## Advanced Testing and Client Integration

Beyond the MCP Inspector, robust testing involves connecting actual clients.

### 1. mcp-remote Deep Dive

How does npx mcp-remote <server_url> work?

1. **Local Server**: It starts a lightweight local server that listens for connections from the MCP client (like Claude) using traditional methods (e.g., standard input/output, local sockets).
2. **Proxy Connection**: When the local client connects, mcp-remote initiates an SSE connection to the specified remote <server_url>/sse.
3. **Authentication Handling**: If the remote server requires authentication and redirects to /authorize, mcp-remote detects this. It typically launches the system's default web browser, directing it to the authorization URL.
4. **Callback Interception**: After the user authenticates and the OAuth provider redirects to the remote server's /callback, the server processes the code exchange. The mechanism for getting the resulting session/token back to the waiting mcp-remote instance can vary – it might involve polling, a local webserver started by mcp-remote to receive a redirect, or other techniques depending on the framework.
5. **Message Tunneling**: Once authenticated, mcp-remote simply relays MCP messages: parsing JSON from the local client and sending it over SSE to the remote server, and parsing SSE data: events from the remote server and sending the JSON payload to the local client.

### 2. Potential Connection Issues

- **CORS**: If the MCP client runs in a browser and connects directly (without mcp-remote), the MCP server Worker needs to return appropriate CORS headers (Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers) in its response, especially for the preflight OPTIONS request.
- **Authentication Failures**: Incorrect client secrets, mismatched redirect URIs, expired codes, or invalid state parameters will break the OAuth flow. Check Worker logs (wrangler tail) and the browser's developer console during the auth process.
- **Network Policies**: Firewalls or proxies might block SSE connections or traffic to .workers.dev URLs.
- **Token Expiration**: Access tokens expire. Implement refresh token logic if long-lived sessions are needed without requiring frequent re-authentication (though this adds complexity).

### 3. Alternative Testing

- **curl for SSE**: You can manually inspect the SSE stream:
  ```bash
  curl -N -H "Accept: text/event-stream" https://your-auth-worker.user.workers.dev/sse
  # (This will likely trigger the auth flow if not authenticated)
  # To test an authenticated endpoint if using Bearer tokens:
  curl -N -H "Accept: text/event-stream" -H "Authorization: Bearer YOUR_ACCESS_TOKEN" https://.../sse
  ```
- **Programmatic Clients**: Write simple test clients using Node.js (eventsource package) or Python (sseclient-py, requests) to script interactions and assertions.

## Leveraging Cloudflare Worker Bindings

Enhance your MCP server using platform features:

- **Secrets**: Essential for storing API keys, CLIENT_SECRETs, database passwords. Accessed via env.MY_SECRET.
- **KV Store (env.KV_NAMESPACE)**: Ideal for storing session data related to the OAuth flow, user preferences for tools, short-lived state, or caching results. Low-latency key-value storage.
- **Durable Objects**: Provide strongly consistent storage and coordination. Useful for tools requiring transactional state per user or per object (e.g., a collaborative document editing tool exposed via MCP). Each MCP client or session could potentially interact with its own Durable Object instance.
- **Queues (env.MY_QUEUE)**: For offloading long-running tool executions. The initial MCP tool execution can return an immediate "processing" response, enqueue the task details, and another Worker (or the same one triggered by the queue) can perform the work asynchronously. The result could be pushed back later via another mechanism or stored for polling.
- **D1 Databases (env.DB)**: Cloudflare's serverless SQL database. Perfect for tools needing relational data storage and querying capabilities.

## Monitoring, Logging, and Best Practices

- **Logging**: Use console.log, console.error within your Worker code. View logs in near real-time using wrangler tail or access historical logs via the Cloudflare dashboard. Structure your logs for easier parsing.
- **Error Handling**: Implement robust error handling within tool execute methods. Return meaningful error messages via the MCP error response format. Catch unexpected exceptions in the main fetch handler.
- **Input Validation**: Never trust input from the client. Use libraries like Zod or JSON Schema validation within your tool's execute method to rigorously validate the input against the inputSchema before proceeding.
- **Rate Limiting**: Protect your server and downstream APIs by implementing rate limiting. This can be done using KV Store to track request counts per user/token or using Cloudflare's Rate Limiting product.
- **Idempotency**: Design tools to be idempotent where possible, especially if they perform mutations. If a client retries a request due to network issues, it shouldn't cause duplicate actions.
- **Keep Templates Updated**: Cloudflare frequently updates templates and libraries. Regularly check for and incorporate updates for security patches and new features.

## Conclusion: Building the Future of Agent Interaction

Remote MCP servers hosted on Cloudflare Workers represent a sophisticated, secure, and scalable architecture for empowering AI agents. By moving beyond simple local tools, developers can create robust gateways that connect LLMs to complex systems, private data, and powerful functionalities. Understanding the nuances of the MCP protocol, mastering OAuth 2.0 flows, effectively utilizing Worker bindings for state and secrets, and adhering to security best practices are key to building reliable agent infrastructure.

The combination of MCP's standardized interaction patterns and Cloudflare's serverless platform provides a potent foundation for the next generation of AI applications, enabling agents to act as truly capable assistants and automators in diverse digital environments. As the ecosystem evolves, expect further refinements in tooling, libraries, and best practices, making the development of these critical components even more streamlined and powerful.