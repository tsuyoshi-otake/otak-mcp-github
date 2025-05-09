import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Octokit } from 'octokit';
import type { Env, AuthContext } from './types';

/**
 * MCPエージェントクラス
 */
export class OtakMcpAgent {
  server: Server;
  octokit: Octokit | null = null;
  authContext: AuthContext | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'otak-mcp-github',
        version: '1.0.0'
      },
      {
        capabilities: {
          resources: {},
          tools: {}
        }
      }
    );
    
    // ツールの登録
    this.registerTools();
  }

  /**
   * ツールの登録
   */
  private registerTools() {
    // 基本的な計算ツール
    this.server.tool(
      'add',
      '2つの数値を足し算します',
      {
        a: {
          type: 'number',
          description: '1つ目の数値',
        },
        b: {
          type: 'number',
          description: '2つ目の数値',
        },
      },
      async (params: { a: number; b: number }) => {
        const { a, b } = params;
        const result = a + b;
        return {
          content: [
            { type: 'text', text: `計算結果: ${a} + ${b} = ${result}` }
          ]
        };
      }
    );

    // ユーザー情報ツール
    this.server.tool(
      'userInfo',
      'ユーザー情報を取得します',
      {},
      async () => {
        if (!this.authContext?.user) {
          return {
            content: [
              { type: 'text', text: 'ユーザーは認証されていません' }
            ],
            isError: true
          };
        }

        return {
          content: [
            { 
              type: 'text', 
              text: JSON.stringify(this.authContext.user, null, 2)
            }
          ]
        };
      }
    );
  }

  /**
   * GitHub APIを使用するツールを登録
   */
  registerGitHubTools(authContext: AuthContext) {
    this.authContext = authContext;
    
    // Octokitインスタンスを初期化
    if (authContext?.accessToken) {
      this.octokit = new Octokit({ auth: authContext.accessToken });
      
      // GitHub情報取得ツール (認証済みユーザーのみ)
      this.server.tool(
        'userInfoOctokit',
        'GitHubアカウント情報を取得します',
        {},
        async () => {
          try {
            const { data } = await this.octokit!.rest.users.getAuthenticated();
            return {
              content: [
                { 
                  type: 'text', 
                  text: JSON.stringify(
                    {
                      login: data.login,
                      name: data.name,
                      bio: data.bio,
                      publicRepos: data.public_repos,
                      followers: data.followers,
                      following: data.following,
                      createdAt: data.created_at
                    }, 
                    null, 
                    2
                  ) 
                }
              ]
            };
          } catch (error) {
            console.error('GitHub API エラー:', error);
            return {
              content: [
                { type: 'text', text: `エラーが発生しました: ${error}` }
              ],
              isError: true
            };
          }
        }
      );
    }
  }

  /**
   * SSEトランスポート用のハンドラー
   */
  serveSSE(path: string) {
    return {
      fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('session');

        // セッションIDがない場合は認証ページにリダイレクト
        if (!sessionId) {
          return new Response('認証が必要です。リダイレクトします...', {
            status: 302,
            headers: {
              'Location': `${url.origin}/authorize`
            }
          });
        }

        try {
          // セッション情報を取得
          const sessionData = await env.OAUTH_KV.get(`session:${sessionId}`);
          
          if (!sessionData) {
            return new Response('セッションが無効です。再認証してください。', {
              status: 302,
              headers: {
                'Location': `${url.origin}/authorize`
              }
            });
          }

          const tokenInfo = JSON.parse(sessionData);
          
          // 認証コンテキストを設定
          const authContext: AuthContext = {
            user: {
              id: tokenInfo.userData.id,
              login: tokenInfo.userData.login,
              name: tokenInfo.userData.name,
              avatarUrl: tokenInfo.userData.avatar_url
            },
            accessToken: tokenInfo.accessToken,
            sessionId
          };

          // GitHub関連ツールを登録
          this.registerGitHubTools(authContext);

          // SSEレスポンスの生成
          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          const encoder = new TextEncoder();
          
          // SSEヘッダーの設定
          const response = new Response(readable, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive'
            }
          });

          // Cloudflareのアイドルタイムアウト対策
          const heartbeatInterval = setInterval(() => {
            writer.write(encoder.encode(': heartbeat\n\n'));
          }, 30000);

          // 接続が閉じられたときのクリーンアップ
          ctx.waitUntil((async () => {
            try {
              // ServerとTransportの作成
              const transport = new StdioServerTransport();

              // 接続を開始
              await this.server.connect(transport);

              // クリーンアップ
              const cleanup = () => {
                clearInterval(heartbeatInterval);
                writer.close();
              };

              cleanup();
            } catch (error) {
              console.error('MCP SSE エラー:', error);
              clearInterval(heartbeatInterval);
              writer.close();
            }
          })());

          return response;
        } catch (error) {
          console.error('SSE 処理エラー:', error);
          return new Response(`エラーが発生しました: ${error}`, { status: 500 });
        }
      }
    };
  }
}

// エージェントのシングルトンインスタンス
export const mcpAgent = new OtakMcpAgent();