import { Octokit } from 'octokit';
import type { Env, TokenInfo } from './types';

/**
 * GitHubのOAuth処理を行うハンドラー
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // コールバックURLの処理
    if (pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('認証コードがありません', { status: 400 });
      }

      // GitHubからアクセストークンを取得
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenResponse.json<{ access_token: string }>();
      
      // アクセストークンが取得できなかった場合
      if (!tokenData.access_token) {
        return new Response('アクセストークンの取得に失敗しました', { status: 500 });
      }

      // Octokit APIクライアントを初期化
      const octokit = new Octokit({ auth: tokenData.access_token });
      
      // ユーザー情報を取得
      const { data: userData } = await octokit.rest.users.getAuthenticated();

      // トークン情報をセッションに保存
      const tokenInfo: TokenInfo = {
        accessToken: tokenData.access_token,
        userData: {
          login: userData.login,
          id: userData.id,
          name: userData.name || userData.login,
          avatar_url: userData.avatar_url,
        },
      };

      // セッションIDを生成（ここでは単純なランダムな文字列を使用）
      const sessionId = crypto.randomUUID();
      
      // セッション情報をKVに保存（24時間有効）
      await env.OAUTH_KV.put(`session:${sessionId}`, JSON.stringify(tokenInfo), { expirationTtl: 86400 });

      // SSEエンドポイントにリダイレクト
      return Response.redirect(`${url.origin}/sse?session=${sessionId}`, 302);
    }

    // 認証エンドポイント
    if (pathname === '/authorize') {
      const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
      githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      githubAuthUrl.searchParams.set('redirect_uri', `${url.origin}/callback`);
      githubAuthUrl.searchParams.set('scope', 'read:user');
      
      return Response.redirect(githubAuthUrl.toString(), 302);
    }

    // メインページ
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Otak MCP GitHub</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
            .button { display: inline-block; background: #2ea44f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; }
          </style>
        </head>
        <body>
          <h1>Otak MCP GitHub</h1>
          <p>このサーバーはGitHub OAuth認証を使用したMCPサーバーです。</p>
          <p>MCPクライアントからアクセスするには<code>/sse</code>エンドポイントを使用してください。</p>
          <a href="/authorize" class="button">GitHubでログイン</a>
        </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
      },
    });
  }
};