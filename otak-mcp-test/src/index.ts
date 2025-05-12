import { MyMCP } from './MyMcp.js';

export { MyMCP };

interface Env {
    MCP_OBJECT: DurableObjectNamespace;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // URLから末尾のスラッシュを削除
        const cleanPath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;

        try {
            // /sse または /sse/message エンドポイントの場合は SSE で応答する
            if (cleanPath === '/sse' || cleanPath === '/sse/message') {
                // @ts-ignore - McpAgentの静的メソッドの型推論の問題を回避
                return MyMCP.serveSSE('/sse').fetch(request, env, ctx); // ベースパスは /sse のまま
            }

            // /mcp エンドポイントの場合は Streamable HTTP で応答する
            if (cleanPath === '/mcp') {
                // @ts-ignore - McpAgentの静的メソッドの型推論の問題を回避
                return MyMCP.serve('/mcp').fetch(request, env, ctx);
            }

            // その他のリクエストは404を返す
            return new Response('Not Found', { status: 404 });
        } catch (error: any) {
            console.error('Error in worker fetch:', error);
            // エラーの詳細を返す（デバッグ用）
            return new Response(`Worker Error: ${error.message}\n${error.stack}`, { status: 500 });
        }
    }
};
