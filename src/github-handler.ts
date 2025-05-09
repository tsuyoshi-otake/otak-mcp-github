import { Octokit } from 'octokit';
import { isAdminUser, initializeAdminUsers } from './admin-utils';
import type { Env, TokenInfo } from './types';

/**
 * GitHubのOAuth処理を行うハンドラー
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // デバッグ情報
    console.log('GitHub Handler - リクエスト:', { pathname, method: request.method });

    // 初期管理者の設定（初回のみ）
    // 注意: 最初のデプロイ時に初期管理者が設定されます
    ctx.waitUntil(initializeAdminUsers(env, 'tsuyoshi-otake'));

    // コールバックURLの処理
    if (pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      
      if (!code) {
        return new Response('認証コードがありません', { status: 400 });
      }

      console.log('コールバック処理開始:', { code: code.substring(0, 5) + '...', state });

      // GitHubからアクセストークンを取得
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID || 'Ov23liaYps1kAN6BVYEn',  // フォールバック値を設定
          client_secret: env.GITHUB_CLIENT_SECRET || 'e9770b25a47656a2869a33f0746e5a776889cbd9',  // フォールバック値を設定
          code,
        }),
      });

      console.log('トークンリクエスト送信:', {
        client_id: env.GITHUB_CLIENT_ID || 'Ov23liaYps1kAN6BVYEn',
        has_secret: Boolean(env.GITHUB_CLIENT_SECRET || 'e9770b25a47656a2869a33f0746e5a776889cbd9')
      });

      const tokenData = await tokenResponse.json<{ access_token: string }>();
      
      // アクセストークンが取得できなかった場合
      if (!tokenData.access_token) {
        console.error('トークン取得失敗:', tokenData);
        return new Response('アクセストークンの取得に失敗しました', { status: 500 });
      }

      console.log('トークン取得成功');

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

      // セッションIDを生成
      const sessionId = crypto.randomUUID();
      
      // 管理者認証の場合
      if (state === 'admin') {
        console.log('管理者認証処理:', userData.login);
        
        // 管理者ユーザーかどうか確認
        const isAdmin = await isAdminUser(env, userData.login);
        if (!isAdmin) {
          console.log('管理者権限なし:', userData.login);
          return new Response(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>アクセス拒否</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
                  .error { color: #d73a49; }
                </style>
              </head>
              <body>
                <h1 class="error">アクセス拒否</h1>
                <p>管理者ページへのアクセス権限がありません。</p>
                <p>ユーザー名: ${userData.login}</p>
                <a href="/">ホームページに戻る</a>
              </body>
            </html>
          `, {
            status: 403,
            headers: {
              'Content-Type': 'text/html; charset=UTF-8',
            },
          });
        }
        
        // セッション情報をKVに保存（24時間有効）
        await env.OAUTH_KV.put(`admin-session:${sessionId}`, JSON.stringify(tokenInfo), { expirationTtl: 86400 });
        
        // 管理画面にリダイレクト
        return Response.redirect(`${url.origin}/admin?session=${sessionId}`, 302);
      }
      
      // 通常の認証の場合
      // セッション情報をKVに保存（24時間有効）
      await env.OAUTH_KV.put(`session:${sessionId}`, JSON.stringify(tokenInfo), { expirationTtl: 86400 });

      // SSEエンドポイントにリダイレクト
      return Response.redirect(`${url.origin}/sse?session=${sessionId}`, 302);
    }
    
    // 認証エンドポイント
    if (pathname === '/authorize') {
      const clientId = env.GITHUB_CLIENT_ID || 'Ov23liaYps1kAN6BVYEn';  // フォールバック値を設定
      console.log('認証リクエスト:', { clientId, origin: url.origin });

      const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
      githubAuthUrl.searchParams.set('client_id', clientId);
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
          <p>このサーバーはGitHub OAuth認証またはAPIキーを使用したMCPサーバーです。</p>
          <p>MCPクライアントからアクセスするには<code>/sse</code>エンドポイントを使用してください。</p>
          <p>APIキーを取得するには<a href="/admin/login">管理者ページ</a>にアクセスしてください。</p>
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