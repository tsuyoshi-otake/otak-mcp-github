# MCP Authorization and Authentication

This document covers the authorization and authentication options for Model Context Protocol (MCP) servers on Cloudflare Workers, based on Cloudflare's official documentation.

## Overview

When building an MCP server, you need both authentication (allowing users to login) and authorization (allowing them to grant the MCP client access to resources on their account). MCP uses a subset of OAuth 2.1 for authorization, which allows users to grant limited access to resources without sharing API keys or other credentials.

Cloudflare provides an OAuth Provider Library that implements the provider side of the OAuth 2.1 protocol, making it easy to add authorization to your MCP server.

## Authorization Options

There are three main approaches to implementing authorization in your MCP server:

### 1. Your MCP Server Handles Authorization Itself

Your MCP server running on Cloudflare can handle the complete OAuth flow without third-party involvement:

```javascript
export default new OAuthProvider({
  apiRoute: "/mcp",
  // Your MCP server:
  apiHandler: MyMCPServer.Router,
  // Your handler for authentication and authorization:
  defaultHandler: MyAuthHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```

The authorization flow works as follows:
1. MCP client generates `code_verifier` and `code_challenge`
2. User logs in and authorizes access
3. MCP client exchanges the authorization code for an access token
4. MCP client uses the access token in subsequent requests

Note: Even when your MCP server handles authorization itself, you can still rely on an external authentication service to authenticate users. You need to implement your own authentication handler for this purpose.

### 2. Third-party OAuth Provider

Your MCP server can integrate with a third-party OAuth provider like GitHub or Google:

```javascript
import MyAuthHandler from "./auth-handler";

export default new OAuthProvider({
  apiRoute: "/mcp",
  // Your MCP server:
  apiHandler: MyMCPServer.Router,
  // Replace with your own handler for the third-party provider:
  defaultHandler: MyAuthHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```

When using a third-party OAuth provider, the flow is slightly different:
1. The MCP client initiates an OAuth request to your MCP server
2. Your MCP server redirects the user to the third-party authorization endpoint
3. After authorization, the third-party redirects back to your MCP server
4. Your MCP server exchanges the code for a third-party access token
5. Your MCP server generates its own bound MCP token
6. The MCP client exchanges the code for an MCP access token

### 3. Bring Your Own OAuth Provider

If your application already implements an OAuth Provider or you use services like Stytch, Auth0, or WorkOS, you can integrate with them similarly to the third-party OAuth provider approach.

These services can help you:
- Allow users to authenticate through email, social logins, SSO, and MFA
- Define scopes and permissions that map to your MCP tools
- Present users with consent pages for requested permissions
- Enforce permissions so agents can only invoke permitted tools

#### Stytch Example

Stytch can be used to allow users to sign in with email, Google login or enterprise SSO and authorize AI agents to access resources based on the user's role and permissions. Users will see a consent page outlining the permissions the agent is requesting.

#### Auth0 Example

Auth0 can authenticate users through email, social logins, or enterprise SSO to interact with their data through AI agents. In this implementation, access tokens are automatically refreshed during long-running interactions.

#### WorkOS Example

WorkOS's AuthKit can authenticate users and manage the permissions granted to AI agents. The MCP server can dynamically expose tools based on the user's role and access rights.

## Using Authentication Context in Your MCP Server

When a user authenticates to your MCP server, their identity information and tokens are made available through the `props` parameter:

```javascript
export class MyMCP extends McpAgent<Env, unknown, AuthContext> {
  async init() {
    this.server.tool("userInfo", "Get user information", {}, async () => ({
      content: [{ type: "text", text: `Hello, ${this.props.claims.name || "user"}!` }],
    }));
  }
}
```

The authentication context can be used for:
- Accessing user-specific data using the user ID (`this.props.claims.sub`)
- Checking user permissions before performing operations
- Customizing responses based on user preferences or attributes
- Using authentication tokens to make requests to external services
- Ensuring consistency across different interfaces

## Implementing Permission-Based Access for MCP Tools

You can implement fine-grained authorization controls for your MCP tools based on user permissions:

```javascript
// Create a wrapper function to check permissions
function requirePermission(permission, handler) {
  return async (request, context) => {
    // Check if user has the required permission
    const userPermissions = context.props.permissions || [];
    if (!userPermissions.includes(permission)) {
      return {
        content: [{ type: "text", text: `Permission denied: requires ${permission}` }],
        status: 403
      };
    }

    // If permission check passes, execute the handler
    return handler(request, context);
  };
}

// Use the wrapper with your MCP tools
async init() {
  // Basic tools available to all authenticated users
  this.server.tool("basicTool", "Available to all users", {}, async () => {
    // Implementation for all users
  });

  // Protected tool using the permission wrapper
  this.server.tool(
    "adminAction",
    "Administrative action requiring special permission",
    { /* parameters */ },
    requirePermission("admin", async (req) => {
      // Only executes if user has "admin" permission
      return {
        content: [{ type: "text", text: "Admin action completed" }]
      };
    })
  );

  // Conditionally register tools based on user permissions
  if (this.props.permissions?.includes("special_feature")) {
    this.server.tool("specialTool", "Special feature", {}, async () => {
      // This tool only appears for users with the special_feature permission
    });
  }
}
```

Benefits of this approach:
- Authorization checks at the tool level ensure proper access control
- Permission checks can be defined once and reused across tools
- Clear feedback is provided to users when permission is denied
- You can choose to only present tools that the agent is able to call

## Next Steps

- Learn how to use the [Workers OAuth Provider Library](https://developers.cloudflare.com/workers/tutorials/oauth-with-workers/)
- Explore third-party OAuth provider integration using the [GitHub example MCP server](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-github-oauth)

---

*Source: [Cloudflare Docs - MCP Authorization](https://developers.cloudflare.com/agents/model-context-protocol/authorization/)*