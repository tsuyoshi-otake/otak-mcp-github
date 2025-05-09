import githubHandler from './github-handler';
import adminHandler from './admin-handler';
import { validateApiKey } from './api-keys';
import type { Env, TokenInfo } from './types';

/**
 * ツール呼び出しリクエストの型定義
 */
interface ToolCallRequest {
  id: string;
  method: string;
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

/**
 * otak-mcp-github
 * GitHub OAuth認証またはAPIキーを使用したMCPサーバー
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 管理画面関連のパスはadminHandlerに転送
    if (pathname.startsWith('/admin')) {
      return adminHandler.fetch(request, env, ctx);
    }
    
    // CORS設定
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
      'Access-Control-Max-Age': '86400',
    };
    
    // OPTIONSリクエストの場合はCORSヘッダーのみ返す
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // SSEエンドポイント
    if (pathname.startsWith('/sse')) {
      // 認証情報を確認（APIキーまたはセッションID）
      const authHeader = request.headers.get('Authorization');
      const sessionId = url.searchParams.get('session');
      
      // 認証の種類とその結果を保持する変数
      let authType = 'none';
      let authData: TokenInfo | null = null;
      let userId: number | null = null;
      
      // APIキー認証
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const apiKey = authHeader.substring(7);
        const { valid, apiKeyInfo } = await validateApiKey(apiKey, env);
        
        if (valid && apiKeyInfo) {
          authType = 'apikey';
          authData = {
            accessToken: '',  // APIキー認証ではGitHubトークンは使用しない
            userData: {
              login: apiKeyInfo.createdBy.login,
              id: apiKeyInfo.createdBy.id,
              name: apiKeyInfo.createdBy.name,
              avatar_url: ''  // APIキー認証では画像URLは使用しない
            }
          };
          userId = apiKeyInfo.createdBy.id;
          
          console.log('APIキー認証成功:', {
            keyId: apiKeyInfo.id,
            keyName: apiKeyInfo.name,
            userId: apiKeyInfo.createdBy.id
          });
        }
      }
      
      // セッションID認証（APIキー認証が失敗した場合のみ）
      if (authType === 'none' && sessionId) {
        const sessionData = await env.OAUTH_KV.get(`session:${sessionId}`);
        if (sessionData) {
          try {
            authData = JSON.parse(sessionData) as TokenInfo;
            authType = 'session';
            userId = authData.userData.id;
            
            console.log('セッション認証成功:', {
              sessionId,
              userId: authData.userData.id,
              login: authData.userData.login
            });
          } catch (error) {
            console.error('セッションデータ解析エラー:', error);
          }
        }
      }
      
      // 認証情報がない場合
      if (authType === 'none') {
        // Accept ヘッダーのチェックを行うが、ブラウザ直接アクセスも許可する
        const acceptHeader = request.headers.get('Accept') || '';
        const isDirectBrowserAccess = url.searchParams.has('direct') || 
                                    request.headers.get('User-Agent')?.includes('Mozilla/');
        
        console.log('未認証SSEリクエスト:', { 
          acceptHeader,
          isDirectBrowserAccess,
          userAgent: request.headers.get('User-Agent'),
          hasAuthHeader: !!authHeader,
          hasSession: !!sessionId
        });

        // ブラウザ直接アクセスの場合はGitHub認証にリダイレクト
        if (isDirectBrowserAccess) {
          return Response.redirect(`${url.origin}/authorize`, 302);
        }
        
        // APIクライアントの場合は401エラー
        return new Response('Unauthorized: API key or session required', { 
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain',
            'WWW-Authenticate': 'Bearer realm="MCP Server"'
          }
        });
      }
      
      // ブラウザかMCPクライアントかをチェック
      const acceptHeader = request.headers.get('Accept') || '';
      const acceptsEventStream = acceptHeader.includes('text/event-stream');
      const isDirectBrowserAccess = url.searchParams.has('direct') || 
                                request.headers.get('User-Agent')?.includes('Mozilla/');
      
      // ブラウザ直接アクセスでない場合のみ、Accept ヘッダーをチェック
      if (!acceptsEventStream && !isDirectBrowserAccess) {
        console.log('不適切なAcceptヘッダー:', acceptHeader);
        return new Response('Not Acceptable: Expected Accept: text/event-stream', { 
          status: 406,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain'
          }
        });
      }

      // SSEストリームを設定
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      const response = new Response(readable, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });

      // Cloudflareのアイドルタイムアウト対策
      const heartbeatInterval = setInterval(() => {
        writer.write(encoder.encode(": heartbeat\n\n"));
      }, 30000);

      // イベントストリームの処理
      ctx.waitUntil((async () => {
        try {
          // ブラウザ直接アクセス用のメッセージ（デバッグ/確認用）
          if (isDirectBrowserAccess) {
            writer.write(encoder.encode(`data: {"type":"debug_info","message":"認証タイプ: ${authType}, ユーザーID: ${userId}"}\n\n`));
          }
          
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

          // POSTリクエストがあれば、それはツール呼び出しとして処理
          if (request.method === 'POST') {
            try {
              // リクエストボディをJSONとしてパース
              const rawData = await request.json();
              
              // 型の安全性のためのチェック
              const isValidRequest = (data: unknown): data is ToolCallRequest => {
                return typeof data === 'object' && 
                  data !== null && 
                  'id' in data && 
                  'method' in data && 
                  'params' in data &&
                  typeof (data as any).params === 'object' &&
                  'name' in (data as any).params &&
                  'arguments' in (data as any).params;
              };
              
              if (!isValidRequest(rawData)) {
                throw new Error('Invalid request format');
              }
              
              const data = rawData as ToolCallRequest;
              console.log('ツール呼び出し:', data);
              
              if (data.method === 'call_tool') {
                const { name, arguments: args } = data.params;
                
                // ツールの実行
                if (name === 'add' && typeof args.a !== 'undefined' && typeof args.b !== 'undefined') {
                  const result = Number(args.a) + Number(args.b);
                  writer.write(encoder.encode(`data: ${JSON.stringify({
                    type: "mcp_tool_invocation_response",
                    invocationId: data.id,
                    result: {
                      content: [
                        { type: "text", text: `計算結果: ${args.a} + ${args.b} = ${result}` }
                      ]
                    }
                  })}\n\n`));
                } else if (name === 'userInfo') {
                  writer.write(encoder.encode(`data: ${JSON.stringify({
                    type: "mcp_tool_invocation_response",
                    invocationId: data.id,
                    result: {
                      content: [
                        { 
                          type: "text", 
                          text: authData ? JSON.stringify(authData.userData, null, 2) : "未認証" 
                        }
                      ]
                    }
                  })}\n\n`));
                } else {
                  writer.write(encoder.encode(`data: ${JSON.stringify({
                    type: "mcp_error",
                    invocationId: data.id,
                    code: -32601,
                    message: `Unknown tool: ${name}`
                  })}\n\n`));
                }
              }
            } catch (error) {
              console.error('JSONパースエラー:', error);
              writer.write(encoder.encode(`data: ${JSON.stringify({
                type: "mcp_error",
                code: -32700,
                message: "Invalid JSON or request format"
              })}\n\n`));
            }
          }
          
          // ブラウザ直接アクセスの場合は、ユーザー情報を自動的に表示
          if (isDirectBrowserAccess && authData) {
            writer.write(encoder.encode(`data: ${JSON.stringify({
              type: "user_info",
              userData: authData.userData,
              authType: authType
            })}\n\n`));
          }
          
          // 長時間接続を維持（実運用では適切なクリーンアップメカニズムが必要）
          // ここでは10分で切断するデモ実装
          setTimeout(() => {
            clearInterval(heartbeatInterval);
            writer.close();
          }, 600000);
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
