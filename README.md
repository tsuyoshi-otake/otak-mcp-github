# Otak MCP GitHub

A Model Context Protocol (MCP) server implementation with GitHub OAuth and API key authentication running on Cloudflare Workers.

## Features

- **Multiple Authentication Methods**
  - GitHub OAuth authentication: Browser-based authentication flow
  - API Key authentication: Header-based authentication (for clients like Roo Code)

- **Admin Dashboard**
  - API key issuance, management, and revocation
  - Admin user management
  - KV storage-based permission management

- **MCP Tools**
  - `add`: Tool to add two numbers
  - `userInfo`: Tool to retrieve authenticated user information

## Usage

### Accessing the Admin Dashboard

1. Access the admin dashboard in your browser:
   ```
   https://otak-mcp-github.tsuyoshi-otake.workers.dev/admin/login
   ```

2. Log in with GitHub (only users with admin privileges can access)

### Adding and Removing Admins

From the "Admin User Management" section of the dashboard:

1. **Adding an admin**: Enter a GitHub username and click "Add"
2. **Removing an admin**: Select an admin to remove and click "Delete"
   - You cannot remove yourself
   - You cannot remove the last admin

### Getting and Using API Keys

1. Generate an API key from the "API Key Issuance" section of the dashboard
2. Update your Roo Code configuration:

```json
"otak-mcp-github": {
  "url": "https://otak-mcp-github.tsuyoshi-otake.workers.dev/sse",
  "headers": {
    "Authorization": "Bearer YOUR_API_KEY"
  },
  "disabled": false,
  "alwaysAllow": []
}
```

## Implemented MCP Tools

### add

A tool to add two numbers

**Input Parameters**:
```json
{
  "a": 10,
  "b": 20
}
```

**Output Example**:
```
Result: 10 + 20 = 30
```

### userInfo

A tool to retrieve authenticated user information

**Input Parameters**: None

**Output Example**:
```json
{
  "login": "username",
  "id": 12345678,
  "name": "User Name",
  "avatar_url": "https://avatars.githubusercontent.com/u/12345678"
}
```

## Technical Details

### Architecture

- **Framework**: Cloudflare Workers
- **Data Storage**: Cloudflare KV
- **Authentication**: GitHub OAuth 2.0 + Custom API Keys

### KV Storage Usage

- **Admin List**: Stored in the `admin_users` key
- **Session Information**: Stored in the `admin-session:${sessionId}` key
- **API Key Information**: Stored in the `api-key:${hashedKey}` and `api-key-info:${apiKeyId}` keys

### Initialization Process

- The `initializeAdminUsers()` function runs on first deployment to set up the initial admin
- Existing admin settings are not overwritten

### Authentication Flow

#### GitHub OAuth Authentication Flow

1. User accesses `/admin/login`
2. Redirected to GitHub authentication page
3. After authentication, redirected to `/callback` (with `state=admin` parameter)
4. Callback handler verifies admin privileges
5. If admin, issues a session ID and redirects to admin dashboard

#### API Key Authentication Flow

1. Client makes a request with the `Authorization: Bearer YOUR_API_KEY` header
2. Server hashes the API key and verifies it
3. If the API key is valid, processes the request

## Security Considerations

- API keys are only displayed once when issued and must be stored securely
- Deactivated API keys cannot be reactivated; a new key must be issued
- Admin privileges should be granted carefully
- For production environments, ensure GitHub OAuth App settings are properly configured

## Deployment

1. Set up a Cloudflare account
2. Edit wrangler.jsonc with appropriate settings
3. Create a GitHub OAuth App and configure the callback URL
4. Deploy with the following command:

```bash
npx wrangler deploy
```

## Developer Information

### File Structure

- `src/index.ts`: Main entry point
- `src/github-handler.ts`: GitHub OAuth authentication handler
- `src/admin-handler.ts`: Admin dashboard handler
- `src/admin-utils.ts`: Admin-related utilities
- `src/api-keys.ts`: API key management functions
- `src/types.ts`: Type definitions

### Environment Variables

- `GITHUB_CLIENT_ID`: GitHub OAuth App client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth App client secret

### KV Storage

- `OAUTH_KV`: KV storage for authentication information and API key data

## License

MIT License