# Official Cloudflare Documentation: Building a Remote MCP Server

This file contains reference information from Cloudflare's official documentation for deploying MCP servers on Cloudflare Workers.

## Overview

Cloudflare provides two main approaches for deploying an MCP server:

1. **Public MCP server** - No authentication required, anyone can connect and use the server
2. **Authenticated MCP server** - Users must sign in before accessing tools, with ability to control permissions

## Deployment Options

### Option 1: Deploy to Workers Button

The fastest way to deploy an MCP server is using Cloudflare's "Deploy to Workers" button:

1. Visit the [example MCP server repository](https://github.com/cloudflare/example-mcp-server)
2. Click the "Deploy to Workers" button
3. Follow the guided setup process

This will:
- Create a new git repository on your GitHub or GitLab account
- Configure automatic deployment to Cloudflare when changes are pushed
- Deploy the server to your workers.dev subdomain (e.g., `remote-mcp-server-authless.your-account.workers.dev/sse`)

### Option 2: CLI Setup

Alternatively, you can use the command line:

```bash
# Create new MCP server without authentication
npm create cloudflare@latest -- my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless

# Navigate to the project directory
cd my-mcp-server

# Start local development server
npm start
```

Your MCP server will be running at `http://localhost:8787/sse`.

## Testing Your MCP Server

### Using MCP Inspector

```bash
# Run MCP Inspector in a new terminal
npx @modelcontextprotocol/inspector@latest

# Open the inspector in your browser
open http://localhost:5173
```

In the inspector, enter your MCP server URL and click "Connect" to see available tools.

### Deploying to Production

```bash
# Deploy to Cloudflare Workers
npx wrangler@latest deploy
```

## Connecting AI Clients Through a Local Proxy

You can use the `mcp-remote` proxy to connect clients like Claude Desktop to your remote MCP server:

```json
{
  "mcpServers": {
    "math": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-worker-name.your-account.workers.dev/sse"
      ]
    }
  }
}
```

Restart the client after updating the configuration, then ask it to use one of your tools (e.g., "Could you use the math tool to add 23 and 19?").

## Adding Authentication with GitHub OAuth

### Step 1: Create a new authenticated MCP server

```bash
# Create new MCP server with GitHub OAuth authentication
npm create cloudflare@latest -- my-mcp-server-github-auth --template=cloudflare/ai/demos/remote-mcp-github-oauth

# Navigate to the project directory
cd my-mcp-server-github-auth

# Deploy the server
npx wrangler@latest deploy
```

The main difference in this template is the `GitHubHandler` configured in `src/index.ts`:

```typescript
import GitHubHandler from "./github-handler";

export default new OAuthProvider({
  apiRoute: "/sse",
  apiHandler: MyMCP.Router,
  defaultHandler: GitHubHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```

### Step 2: Create GitHub OAuth Apps

You need to create two GitHub OAuth Apps - one for local development and one for production:

#### Local Development OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App with:
   - Application name: My MCP Server (local)
   - Homepage URL: http://localhost:8787
   - Authorization callback URL: http://localhost:8787/callback
3. Add credentials to `.dev.vars` file:

```bash
touch .dev.vars
echo 'GITHUB_CLIENT_ID="your-client-id"' >> .dev.vars
echo 'GITHUB_CLIENT_SECRET="your-client-secret"' >> .dev.vars
```

#### Production OAuth App

1. Create another OAuth App with:
   - Application name: My MCP Server (production)
   - Homepage URL: Your workers.dev URL (e.g., worker-name.account-name.workers.dev)
   - Authorization callback URL: Your workers.dev URL with /callback (e.g., worker-name.account-name.workers.dev/callback)
2. Add credentials as secrets using Wrangler:

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

### Testing the Authentication Flow

When connecting to your authenticated MCP server:
1. Users will be redirected to GitHub to sign in
2. After authorizing the app, they'll return to your MCP server
3. Their session will be authenticated for making tool calls

## Next Steps

- Add custom tools to your MCP server
- Customize authentication and authorization logic
- Set up fine-grained permissions based on user identities

---

*Source: [Cloudflare Docs - Build a Remote MCP server](https://developers.cloudflare.com/agents/guides/build-remote-mcp-server/)*