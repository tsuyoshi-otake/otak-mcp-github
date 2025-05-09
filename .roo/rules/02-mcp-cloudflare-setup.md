# Quick Setup Guide: MCP Server on Cloudflare Workers

This guide provides step-by-step instructions for creating and deploying an MCP server on Cloudflare Workers using official templates.

## 1. Pick the Right Starter Template

| Template | Purpose | Auth | Default SSE URL |
|----------|---------|------|----------------|
| remote‑mcp‑server | Smallest, no‑login demo you can extend | none | /sse |
| remote‑mcp‑github‑oauth | Adds GitHub OAuth (login & per‑user scopes) | GitHub OAuth 2.0 | /sse |

Both are published as Wrangler templates, so you never have to clone the GitHub repo manually.

## 2. Create a Project Locally

```bash
# public server (no auth)
npm create cloudflare@latest my-mcp \
      --template=cloudflare/ai/demos/remote-mcp-authless

# OR GitHub‑login variant
npm create cloudflare@latest my-mcp-github \
      --template=cloudflare/ai/demos/remote-mcp-github-oauth
```

This scaffolds the Worker, installs dependencies, and writes wrangler.toml.

## 3. Run it on Localhost

```bash
cd my-mcp
npm start          # runs wrangler dev
```

The server streams events at http://localhost:8787/sse. Use any MCP‑capable client (e.g. `npx @modelcontextprotocol/inspector`) and point it at that URL to list tools and invoke them.

## 4. Add or Modify Tools

Open `src/tools/*.ts` (there's a sample "math" tool). Return plain objects; the SDK serializes them into SSE events automatically.

## 5. Deploy to Cloudflare

```bash
npx wrangler deploy
```

You'll get a URL like `https://my-mcp.<account>.workers.dev/sse`.

## 6. (If Using GitHub OAuth) Wire Up Authentication

Create two GitHub OAuth Apps:
- local: callback `http://localhost:8787/callback`
- prod: callback `https://my‑mcp.<account>.workers.dev/callback`

Add secrets:

```bash
# local
echo 'GITHUB_CLIENT_ID=...'     >> .dev.vars
echo 'GITHUB_CLIENT_SECRET=...' >> .dev.vars

# production
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

Redeploy; clients will be redirected to GitHub, then back to `/callback`, and finally to `/sse` once the OAuth flow finishes.

## 7. How SSE is Wired Up

The template already mounts the stream like this:

```typescript
if (pathname.startsWith('/sse')) {
  return MyMcpAgent.serveSSE('/sse').fetch(request, env, ctx);
}
```

You can optionally add the new Streamable HTTP transport on `/mcp` for bidirectional streaming:

```typescript
if (pathname.startsWith('/mcp')) {
  return MyMcpAgent.serve('/mcp').fetch(request, env, ctx);
}
```

Both transports work side‑by‑side, so older clients that only speak SSE keep working.

## 8. Testing from Real Agents

- **Cloudflare AI Playground** – paste the `/sse` URL in the "MCP Server URL" box.  
- **Claude Desktop / Cursor / Windsurf** – install the local proxy:

```jsonc
"mcpServers": {
  "my‑tools": {
    "command": "npx",
    "args": ["mcp-remote", "https://my-mcp.<account>.workers.dev/sse"]
  }
}
```

Restart the client and ask the model to use one of your tools (e.g. "run the math tool to add 23 and 19").

## 9. Production Tips

| Need | Recommendation |
|------|----------------|
| Idle timeout | Send a keep‑alive comment every 30s (`writer.write(': ping\\n\\n')`) to avoid Cloudflare's 100s idle 524 timeout. |
| Logging & tracing | Add `console.log` inside each tool; view logs with `wrangler tail`. |
| Stateful sessions | Use Durable Objects or KV for per‑user data. |
| Upgrade path | Support both `/sse` and `/mcp` now; you can drop `/sse` once all clients migrate to Streamable HTTP. |

## Next Steps

- Add real business tools in `src/tools`.
- Tighten scopes in the GitHub OAuth handler (look at `src/github-handler.ts`).
- Swap GitHub for any other OAuth 2 provider by replacing the handler.