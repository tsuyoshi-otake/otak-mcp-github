# Practical Guide: Secure MCP Implementation with Cloudflare and GitHub OAuth

This guide demonstrates how to implement a secure Model Context Protocol (MCP) server on Cloudflare Workers using GitHub OAuth authentication, eliminating the need to store authentication credentials locally.

## Introduction: The Authentication Challenge

MCP (Model Context Protocol) is extremely useful for connecting AI models with external tools and APIs. However, traditional implementations require storing authentication credentials locally, which creates security and management challenges.

Cloudflare provides a solution that addresses these issues by enabling MCP implementation without storing authentication credentials on local devices.

## The Cloudflare Solution

Cloudflare offers tools to build remotely-operating MCP servers, as explained in their [official blog post](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/).

Traditionally, MCP runs on the user's local environment as shown below, requiring local storage of authentication credentials:

![Traditional local MCP execution](https://example.com/local-mcp-diagram.png)
*Figure 1: Traditional local MCP execution*

Using Cloudflare tools, you can build an MCP server on Cloudflare that requires OAuth 2.0 authentication (e.g., GitHub auth) when accessed, eliminating the need for local authentication credentials:

![Remote MCP server on Cloudflare](https://example.com/cloudflare-mcp-diagram.png)
*Figure 2: Remote MCP server built on Cloudflare*

This approach offers several benefits:
- **Enhanced security**: No need to store authentication credentials locally, reducing data leak risks
- **Simplified management and deployment**: Centralized credential management makes deployment to multiple users easier
- **Web application integration**: MCP functionality can be more easily provided as part of web applications

## Step-by-Step Implementation Guide

Let's build an MCP server with GitHub OAuth 2.0 authentication using Cloudflare's official documentation:

### 1. Create and Deploy the MCP Server Project

First, navigate to an appropriate working directory and run the following command to create a project:

```bash
npm create cloudflare@latest -- my-mcp-server-github-auth --template=cloudflare/ai/demos/remote-mcp-github-oauth
```

- If asked "You're in an existing git repository. Do you want to use git for version control?", select "Yes"
- If asked "Do you want to deploy your application?", select "No" (we'll deploy manually later)

This creates a new Cloudflare Workers project (my-mcp-server-github-auth) based on the specified template. You can view the template source code [here](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-github-oauth).

Open the created project in your preferred editor.

Next, create a Cloudflare Workers KV to store OAuth tokens and other data. In the terminal, navigate to the project directory and run:

```bash
cd my-mcp-server-github-auth
wrangler kv namespace create "OAUTH_KV"
```

Upon success, you'll see the KV ID displayed. Copy this ID.

```
🌀 Creating namespace with title "my-mcp-server-github-auth-OAUTH_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{
  "kv_namespaces": [
    {
      "binding": "OAUTH_KV",
      "id": "<KV_ID>" # Copy this ID
    }
  ]
}
```

Open the `wrangler.jsonc` file in your editor, locate the `kv_namespaces` section, and replace the `id` value with the ID you copied:

```jsonc
// wrangler.jsonc example
"kv_namespaces": [
    {
        "binding": "OAUTH_KV",
        "id": "<Copied KV_ID>" // Replace this
    }
],
```

Finally, run the following command to deploy your MCP server to Cloudflare:

```bash
npm run deploy
```

Upon successful deployment, you'll see a Cloudflare Workers URL (e.g., https://my-mcp-server-github-auth.your-account.workers.dev). Make note of this URL for later use.

### 2. Create a GitHub OAuth App

Next, create an OAuth application in GitHub by accessing:

https://github.com/settings/developers

![GitHub Developer settings](https://example.com/github-dev-settings.png)
*Figure 4: GitHub Developer settings*

In the "OAuth Apps" section, click the "New OAuth App" button.
Enter the following information:
- Application name: A descriptive name (e.g., My MCP Server Auth)
- Homepage URL: The Cloudflare Workers URL you noted earlier (e.g., https://my-mcp-server-github-auth.your-account.workers.dev)
- Authorization callback URL: The Cloudflare Workers URL with `/callback` appended (e.g., https://my-mcp-server-github-auth.your-account.workers.dev/callback)

Click the "Register application" button.

After creation, you'll see the application details page:
- Client ID: Note the displayed Client ID
- Client secrets: Click "Generate a new client secret" to generate a new secret and note the displayed value (this value is only shown once)

Return to your editor and run the following commands in the terminal to securely store the noted Client ID and Client Secret as Cloudflare Workers secrets:

```bash
# Store Client ID
wrangler secret put GITHUB_CLIENT_ID
# When prompted, enter the noted Client ID

# Store Client Secret
wrangler secret put GITHUB_CLIENT_SECRET
# When prompted, enter the noted Client Secret
```

These secrets will be accessible as environment variables from your deployed Worker.

### 3. Test with MCP Inspector

Let's test your deployed MCP server using MCP Inspector, a debugging tool for MCP.

Run the following command in your terminal to launch MCP Inspector:

```bash
npx @modelcontextprotocol/inspector@latest
```

After launch, you'll see a URL to access MCP Inspector in your browser.

In the MCP Inspector interface, configure it as follows:
- Transport Type: Select "SSE"
- URL: The Cloudflare Workers URL with `/sse` appended (e.g., https://my-mcp-server-github-auth.your-account.workers.dev/sse)

Click the "Connect" button.

You'll be redirected to the GitHub authentication screen. When prompted for permission to access the created OAuth App, click the "Authorize [application name]" button.

After successful authentication, you'll return to the MCP Inspector screen with an established connection to the MCP server.

Click the "List Tools" button to see the tools available on this MCP server. At the time of writing, the template defines the following tools:
- add: A tool to add two numbers
- userInfoOctokit: A tool to retrieve user information from the authenticated GitHub account
- generateImage: An image generation tool (disabled by default)

Try the `add` tool by entering appropriate values and clicking the "Run" button to see the calculation result.

Next, try the `userInfoOctokit` tool. This tool uses Octokit, a JavaScript library for interacting with the GitHub API, to retrieve user information from the authenticated GitHub account. Enter appropriate values and click the "Run" button to confirm that you can retrieve GitHub user information without storing authentication credentials locally.

You've now successfully used a remote MCP server via GitHub authentication without storing authentication credentials locally, and operated the GitHub API as well.

### 4. Additional Notes

To use this from tools like Cursor, you can configure the following JSON:

```json
{
  "mcpServers": {
    "<Any tool name>": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "<Your Cloudflare Workers URL with '/sse' appended>"
      ]
    }
  }
}
```

For a quick test from a web-based MCP client, you can use Cloudflare's provided playground:

[Workers AI LLM Playground](https://workers.cloudflare.com/ai/playground)

In the playground, configure:
- Model: Select an MCP-capable model like llama-3.3-70b-instruct-fp8-fast
- Enter MCP Server URL: Your Cloudflare Workers URL with `/sse` appended

Click the "Connect" button and authenticate as before to establish the connection.

## Conclusion

By utilizing Cloudflare's tools, you can easily build a remote MCP server with integrated OAuth authentication, freeing yourself from the hassle of local authentication credential management. This greatly expands the scope of MCP utilization and enables safer, more manageable implementation of AI integration features.

Beyond GitHub authentication, you can also support other OAuth providers. This mechanism is very powerful and has various applications, such as adding MCP functionality to your own products.

---

*This guide was adapted from a Classmethod blog post published on 2025.04.08*