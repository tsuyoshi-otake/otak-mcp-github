import githubHandler from './github-handler';
import type { Env } from './types';

/**
 * otak-mcp-github
 * GitHub OAuth認証を使用したMCPサーバー
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // SSEエンドポイント
    if (pathname.startsWith('/sse')) {
      // SSEストリームを設定
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      const response = new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });

      // セッションIDを取得
      const sessionId = url.searchParams.get('session');
      if (!sessionId) {
        return Response.redirect(`${url.origin}/authorize`, 302);
      }

      // セッション情報を取得
      const sessionData = await env.OAUTH_KV.get(`session:${sessionId}`);
      if (!sessionData) {
        return Response.redirect(`${url.origin}/authorize`, 302);
      }

      // Cloudflareのアイドルタイムアウト対策
      const heartbeatInterval = setInterval(() => {
        writer.write(encoder.encode(": heartbeat\n\n"));
      }, 30000);

      // イベントストリームの処理
      ctx.waitUntil((async () => {
        try {
          // セッション情報
          const tokenInfo = JSON.parse(sessionData);
          
          // ツール一覧を送信
          writer.write(encoder.encode(`data: ${JSON.stringify({
            type: "mcp_tool_list_response",
            tools: [
              {
                name: "add",
                description: "2つの数値を足し算します",
                inputSchema: {
                  type: "object",
                  properties: {
                    a: { type: "number", description: "1つ目の数値" },
                    b: { type: "number", description: "2つ目の数値" }
                  },
                  required: ["a", "b"]
                }
              },
              {
                name: "userInfo",
                description: "認証されたユーザー情報を取得します",
                inputSchema: {
                  type: "object",
                  properties: {}
                }
              }
            ]
          })}\n\n`));

          // クライアントのリクエストを待機（実際のMCPサーバーではここでツール実行要求を処理）
          
          // 一定時間後にクリーンアップ（デモ用）
          setTimeout(() => {
            clearInterval(heartbeatInterval);
            writer.close();
          }, 60000);
        } catch (error) {
          console.error('SSE エラー:', error);
          clearInterval(heartbeatInterval);
          writer.close();
        }
      })());

      return response;
    }

    // その他のリクエストはGitHub OAuth認証ハンドラーへ
    return githubHandler.fetch(request, env, ctx);
  }
};
