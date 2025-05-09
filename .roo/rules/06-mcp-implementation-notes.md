# MCP Implementation Notes: API Key Authenticated MCP Server on Cloudflare Workers

This document provides detailed information on the design and implementation of an MCP server built on Cloudflare Workers.

## 1. Architecture Overview

### 1.1 Overall Configuration

The MCP server consists of the following components:

- **Authentication System**
  - GitHub OAuth Authentication (for browsers)
  - API Key Authentication (for programs)
- **Admin Panel**
  - API Key Management
  - Admin User Management
- **MCP Tool Implementation**
  - Calculation Tool
  - User Information Retrieval Tool

### 1.2 Data Storage

Cloudflare KV is used to store the following data:

- **Admin List**: `admin_users` key
- **Session Information**: `admin-session:${sessionId}` and `session:${sessionId}` keys
- **API Key Information**: `api-key:${hashedKey}` and `api-key-info:${apiKeyId}` keys

## 2. Authentication System

### 2.1 GitHub OAuth Authentication

GitHub OAuth authentication is implemented with the following flow:

1. User accesses `/admin/login`
2. Redirected to GitHub's authentication page
3. After authentication, redirected to `/callback` (with `state=admin` parameter)
4. The callback handler verifies the user's admin privileges
5. If the user is an admin, a session ID is issued, and the user is redirected to the admin panel

```mermaid
sequenceDiagram
    User->>MCPServer: Accesses /admin/login
    MCPServer->>GitHub: Redirects to OAuth authentication page
    User->>GitHub: Enters authentication information
    GitHub->>MCPServer: Redirects to /callback
    MCPServer->>KVStorage: Checks admin privileges
    KVStorage->>MCPServer: Privilege information
    MCPServer->>User: Redirects to admin panel