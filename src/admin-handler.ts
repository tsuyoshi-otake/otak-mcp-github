import { Octokit } from 'octokit';
import { generateApiKey, listApiKeys, deactivateApiKey } from './api-keys';
import { isAdminUser, getAdminUsers, addAdminUser, removeAdminUser } from './admin-utils';
import type { Env, TokenInfo } from './types';

/**
 * Admin dashboard handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    console.log('Admin Panel - Request:', { pathname, method: request.method });
    
    // Admin dashboard access
    if (pathname === '/admin') {
      // Get session ID and verify admin status
      const sessionId = url.searchParams.get('session') || '';
      const isAdmin = await verifyAdminSession(sessionId, env);
      
      if (!isAdmin) {
        // Redirect to admin login page if not admin
        return Response.redirect(`${url.origin}/admin/login`, 302);
      }
      
      // Show admin dashboard if admin
      return showAdminDashboard(sessionId, url.origin, env);
    }
    
    // Admin login page
    if (pathname === '/admin/login') {
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>MCP Admin Login</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
              .button { display: inline-block; background: #2ea44f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; }
              h1 { color: #24292e; }
              .warning { color: #d73a49; }
            </style>
          </head>
          <body>
            <h1>MCP Admin Login</h1>
            <p>Please log in with GitHub to access admin features.</p>
            <p class="warning">Note: Only users with admin privileges can access this page.</p>
            <a href="/admin/authorize" class="button">Login with GitHub</a>
          </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
        },
      });
    }
    
    // Admin authorization endpoint
    if (pathname === '/admin/authorize') {
      // Debug: Build auth URL
      const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
      
      // Note: The callback URL must exactly match what's registered in the GitHub OAuth App
      const callbackUrl = `${url.origin}/callback`;
      
      githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID || 'Ov23liaYps1kAN6BVYEn');
      githubAuthUrl.searchParams.set('redirect_uri', callbackUrl);
      githubAuthUrl.searchParams.set('scope', 'read:user');
      githubAuthUrl.searchParams.set('state', 'admin');  // Indicates this is an admin authentication
      
      console.log('GitHub Auth URL:', githubAuthUrl.toString());
      console.log('Callback URL:', callbackUrl);
      
      return Response.redirect(githubAuthUrl.toString(), 302);
    }
    
    // Add admin user
    if (pathname === '/admin/users/add' && request.method === 'POST') {
      // Get session ID and verify admin status
      const sessionId = url.searchParams.get('session') || '';
      const adminData = await getAdminData(sessionId, env);
      
      if (!adminData) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      try {
        // Get POST data
        const formData = await request.formData();
        const username = formData.get('username')?.toString() || '';
        
        if (!username) {
          return new Response('Username is required', { status: 400 });
        }
        
        // Add admin user
        const success = await addAdminUser(env, username);
        
        if (!success) {
          return new Response('Failed to add admin user', { status: 500 });
        }
        
        // Redirect to admin dashboard
        return Response.redirect(`${url.origin}/admin?session=${sessionId}&message=admin_added`, 302);
      } catch (error) {
        console.error('Add admin error:', error);
        return new Response('An error occurred while adding admin user', { status: 500 });
      }
    }
    
    // Remove admin user
    if (pathname === '/admin/users/remove' && request.method === 'POST') {
      // Get session ID and verify admin status
      const sessionId = url.searchParams.get('session') || '';
      const adminData = await getAdminData(sessionId, env);
      
      if (!adminData) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      try {
        // Get POST data
        const formData = await request.formData();
        const username = formData.get('username')?.toString() || '';
        
        if (!username) {
          return new Response('Username is required', { status: 400 });
        }
        
        // Prevent self-removal
        if (username === adminData.userData.login) {
          return new Response('You cannot remove yourself as an admin', { status: 400 });
        }
        
        // Remove admin user
        const success = await removeAdminUser(env, username);
        
        if (!success) {
          return new Response('Failed to remove admin user', { status: 500 });
        }
        
        // Redirect to admin dashboard
        return Response.redirect(`${url.origin}/admin?session=${sessionId}&message=admin_removed`, 302);
      } catch (error) {
        console.error('Remove admin error:', error);
        return new Response('An error occurred while removing admin user', { status: 500 });
      }
    }
    
    // Generate API key
    if (pathname === '/admin/api-keys/generate' && request.method === 'POST') {
      // Get session ID and verify admin status
      const sessionId = url.searchParams.get('session') || '';
      const adminData = await getAdminData(sessionId, env);
      
      if (!adminData) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      try {
        // Get POST data
        const formData = await request.formData();
        const keyName = formData.get('name')?.toString() || 'New API Key';
        const expiresInDays = parseInt(formData.get('expires')?.toString() || '365', 10);
        
        // Generate API key
        const { apiKey, apiKeyInfo } = await generateApiKey(
          env,
          keyName,
          {
            id: adminData.userData.id,
            login: adminData.userData.login,
            name: adminData.userData.name
          },
          ['all'],
          expiresInDays
        );
        
        // Display generated API key
        return new Response(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>API Key Generated</title>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
                .success { color: #22863a; }
                .key-box { background: #f6f8fa; padding: 15px; border-radius: 6px; font-family: monospace; word-break: break-all; }
                .warning { color: #b08800; margin-top: 20px; }
              </style>
            </head>
            <body>
              <h1 class="success">API Key Generated</h1>
              <p>The following API key has been generated. This key will be displayed <strong>only once</strong>. Store it in a secure location.</p>
              
              <h2>API Key Information</h2>
              <p><strong>Name:</strong> ${apiKeyInfo.name}</p>
              <p><strong>Created:</strong> ${new Date(apiKeyInfo.createdAt).toLocaleString()}</p>
              <p><strong>Expires:</strong> ${new Date(apiKeyInfo.expiresAt).toLocaleString()}</p>
              
              <h2>API Key</h2>
              <div class="key-box">${apiKey}</div>
              
              <p class="warning">Warning: This key will never be displayed again. Make sure to save it in a secure location.</p>
              
              <p><a href="/admin?session=${sessionId}">Return to Admin Dashboard</a></p>
            </body>
          </html>
        `, {
          headers: {
            'Content-Type': 'text/html; charset=UTF-8',
          },
        });
      } catch (error) {
        console.error('API key generation error:', error);
        return new Response('An error occurred while generating API key', { status: 500 });
      }
    }
    
    // Deactivate API key
    if (pathname === '/admin/api-keys/deactivate' && request.method === 'POST') {
      // Get session ID and verify admin status
      const sessionId = url.searchParams.get('session') || '';
      const adminData = await getAdminData(sessionId, env);
      
      if (!adminData) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      try {
        // Get POST data
        const formData = await request.formData();
        const apiKeyId = formData.get('key_id')?.toString() || '';
        
        if (!apiKeyId) {
          return new Response('API key ID is required', { status: 400 });
        }
        
        // Deactivate API key
        const success = await deactivateApiKey(
          apiKeyId,
          adminData.userData.id,
          env
        );
        
        if (!success) {
          return new Response('Failed to deactivate API key', { status: 400 });
        }
        
        // Redirect to admin dashboard
        return Response.redirect(`${url.origin}/admin?session=${sessionId}&message=deactivated`, 302);
      } catch (error) {
        console.error('API key deactivation error:', error);
        return new Response('An error occurred while deactivating API key', { status: 500 });
      }
    }
    
    // Return 404 for other paths
    return new Response('Not Found', { status: 404 });
  }
};

/**
 * Verify admin session
 */
async function verifyAdminSession(sessionId: string, env: Env): Promise<boolean> {
  if (!sessionId) {
    return false;
  }
  
  // Get session information
  const sessionData = await env.OAUTH_KV.get(`admin-session:${sessionId}`);
  if (!sessionData) {
    return false;
  }
  
  try {
    const tokenInfo = JSON.parse(sessionData) as TokenInfo;
    
    // Check if user is admin
    return await isAdminUser(env, tokenInfo.userData.login);
  } catch (error) {
    console.error('Admin session verification error:', error);
    return false;
  }
}

/**
 * Get admin data
 */
async function getAdminData(sessionId: string, env: Env): Promise<TokenInfo | null> {
  if (!sessionId) {
    return null;
  }
  
  // Get session information
  const sessionData = await env.OAUTH_KV.get(`admin-session:${sessionId}`);
  if (!sessionData) {
    return null;
  }
  
  try {
    const tokenInfo = JSON.parse(sessionData) as TokenInfo;
    
    // Check if user is admin
    const isAdmin = await isAdminUser(env, tokenInfo.userData.login);
    if (!isAdmin) {
      return null;
    }
    
    return tokenInfo;
  } catch (error) {
    console.error('Admin data retrieval error:', error);
    return null;
  }
}

/**
 * Show admin dashboard
 */
async function showAdminDashboard(sessionId: string, origin: string, env: Env): Promise<Response> {
  // Get admin data
  const adminData = await getAdminData(sessionId, env);
  
  if (!adminData) {
    return Response.redirect(`${origin}/admin/login`, 302);
  }
  
  // Get admin list
  const adminUsers = await getAdminUsers(env);
  
  // Get user's API keys
  const apiKeys = await listApiKeys(adminData.userData.id, env);
  
  // Get message parameter from URL
  const urlObj = new URL(`${origin}/admin?session=${sessionId}`);
  const message = urlObj.searchParams.get('message');
  
  // Message HTML
  let messageHtml = '';
  if (message === 'deactivated') {
    messageHtml = `<div class="message success">API key has been deactivated.</div>`;
  } else if (message === 'admin_added') {
    messageHtml = `<div class="message success">Admin user has been added.</div>`;
  } else if (message === 'admin_removed') {
    messageHtml = `<div class="message success">Admin user has been removed.</div>`;
  }
  
  // Admin dashboard HTML
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>MCP Admin Dashboard</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: system-ui, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; line-height: 1.6; }
          .button { display: inline-block; background: #2ea44f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; border: none; cursor: pointer; }
          .button.delete { background: #d73a49; }
          h1 { color: #24292e; }
          .user-info { display: flex; align-items: center; margin-bottom: 20px; }
          .user-info img { width: 50px; height: 50px; border-radius: 25px; margin-right: 15px; }
          .user-info h1 { margin-bottom: 5px; }
          .user-info p { margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          table th, table td { padding: 12px; text-align: left; border-bottom: 1px solid #e1e4e8; }
          form { margin: 20px 0; padding: 20px; background: #f6f8fa; border-radius: 6px; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 8px; font-weight: 600; }
          input, select { width: 100%; padding: 8px; border: 1px solid #e1e4e8; border-radius: 6px; }
          .message { padding: 10px; margin-bottom: 20px; border-radius: 6px; }
          .message.success { background-color: #dcffe4; color: #22863a; }
          .admin-section { margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="user-info">
          <img src="${adminData.userData.avatar_url}" alt="${adminData.userData.name}" />
          <div>
            <h1>MCP Admin Dashboard</h1>
            <p>Welcome, ${adminData.userData.name}</p>
          </div>
        </div>
        
        ${messageHtml}
        
        <h2>Issue API Key</h2>
        <form action="/admin/api-keys/generate?session=${sessionId}" method="POST">
          <div class="form-group">
            <label for="name">API Key Name (Description)</label>
            <input type="text" id="name" name="name" placeholder="e.g., Development Environment API Key" required>
          </div>
          <div class="form-group">
            <label for="expires">Expiration</label>
            <select id="expires" name="expires">
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365" selected>1 year</option>
              <option value="730">2 years</option>
            </select>
          </div>
          <button type="submit" class="button">Issue API Key</button>
        </form>
        
        <h2>Issued API Keys</h2>
        ${apiKeys.length === 0 ? '<p>No API keys have been issued.</p>' : `
          <table>
            <thead>
              <tr>
                <th>Key Name</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Last Accessed</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${apiKeys.map(key => `
                <tr>
                  <td>${key.name}</td>
                  <td>${new Date(key.createdAt).toLocaleString()}</td>
                  <td>${new Date(key.expiresAt).toLocaleString()}</td>
                  <td>${key.lastAccessed ? new Date(key.lastAccessed).toLocaleString() : 'Never used'}</td>
                  <td>${key.isActive ? 'Active' : 'Inactive'}</td>
                  <td>
                    ${key.isActive ? `
                      <form action="/admin/api-keys/deactivate?session=${sessionId}" method="POST" onsubmit="return confirm('Are you sure you want to deactivate this API key? This action cannot be undone.');">
                        <input type="hidden" name="key_id" value="${key.id}">
                        <button type="submit" class="button delete">Deactivate</button>
                      </form>
                    ` : 'Deactivated'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
        
        <div class="admin-section">
          <h2>Admin User Management</h2>
          <p>Current admins: ${adminUsers.join(', ')}</p>
          
          <form action="/admin/users/add?session=${sessionId}" method="POST" style="display: inline-block; width: 48%; margin-right: 2%;">
            <div class="form-group">
              <label for="add-username">Add Admin</label>
              <input type="text" id="add-username" name="username" placeholder="GitHub username" required>
            </div>
            <button type="submit" class="button">Add</button>
          </form>
          
          <form action="/admin/users/remove?session=${sessionId}" method="POST" style="display: inline-block; width: 48%;">
            <div class="form-group">
              <label for="remove-username">Remove Admin</label>
              <select id="remove-username" name="username" required>
                ${adminUsers.filter(user => user !== adminData.userData.login).map(user => `
                  <option value="${user}">${user}</option>
                `).join('')}
                ${adminUsers.filter(user => user !== adminData.userData.login).length === 0 ? 
                  '<option value="" disabled>No removable admins</option>' : ''}
              </select>
            </div>
            <button type="submit" class="button delete" ${adminUsers.filter(user => user !== adminData.userData.login).length === 0 ? 'disabled' : ''}>Remove</button>
          </form>
        </div>
        
        <h2>API Connection Guide</h2>
        <p>How to access the REST API:</p>
        <pre style="background: #f6f8fa; padding: 15px; border-radius: 6px; overflow-x: auto;">
# Example request with API key
curl -H "Authorization: Bearer YOUR_API_KEY" ${origin}/sse

# Roo Code MCP configuration example
{
  "otak-mcp-github": {
    "url": "${origin}/sse",
    "headers": {
      "Authorization": "Bearer YOUR_API_KEY"
    },
    "disabled": false,
    "alwaysAllow": []
  }
}
</pre>
      </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
    },
  });
}