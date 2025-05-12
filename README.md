# otak-mcp-test

これは、Cloudflare Workers と Durable Objects を使用して構築された Model Context Protocol (MCP) サーバーのテストプロジェクトです。Server-Sent Events (SSE) と Streamable HTTP の両方のトランスポートをサポートしています。

## 概要

このプロジェクトは、MCP サーバーの基本的な実装例を提供します。Cloudflare Workers 上で動作し、Durable Objects を利用して状態を管理し、MCP ツールを提供します。SQLite ストレージが有効化されています。

## 機能

*   **MCP サーバー:** `@modelcontextprotocol/sdk` を使用した MCP サーバーの実装。
*   **トランスポート:**
    *   Server-Sent Events (SSE) (`/sse` エンドポイント)
    *   Streamable HTTP (`/mcp` エンドポイント)
*   **提供ツール:**
    *   `dice_roll`: 指定された面数（デフォルトは6）のサイコロを振った結果を返します。
        *   入力スキーマ: `{ sides?: number }` (1-100)
    *   `weather`: 指定された都市の天気情報（現在はモックデータ）を返します。
        *   入力スキーマ: `{ city: string }`

## 技術スタック

*   [Cloudflare Workers](https://workers.cloudflare.com/)
*   [Cloudflare Durable Objects](https://developers.cloudflare.com/workers/learning/using-durable-objects/) (SQLite バックエンド)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Zod](https://zod.dev/) (スキーマ検証用)
*   [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
*   [agents](https://www.npmjs.com/package/agents) (McpAgent)
*   [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (開発・デプロイツール)

## セットアップと実行

### 1. 依存関係のインストール

プロジェクトディレクトリ ([`otak-mcp-test`](otak-mcp-test)) に移動し、依存関係をインストールします。

```bash
cd otak-mcp-test
npm install
```

### 2. ローカル開発

Wrangler を使用してローカル開発サーバーを起動します。

```bash
npm start
# または
npx wrangler dev
```

これにより、ローカルで Worker が実行され、変更が自動的に反映されます。

### 3. デプロイ

Cloudflare に Worker をデプロイします。

```bash
npm run deploy
# または
npx wrangler deploy
```

### 4. SSE テスト

提供されているスクリプト ([`test-sse.js`](otak-mcp-test/test-sse.js:1)) を使用して、ローカルまたはデプロイされた Worker の SSE エンドポイントをテストできます。

```bash
npm run test:sse <URL>
```

`<URL>` には、ローカル開発サーバーの URL (例: `http://localhost:8787/sse`) またはデプロイされた Worker の URL (例: `https://your-worker-name.your-subdomain.workers.dev/sse`) を指定します。

## エンドポイント

*   **SSE:** `https://<YOUR_WORKER_URL>/sse`
*   **Streamable HTTP:** `https://<YOUR_WORKER_URL>/mcp`

`<YOUR_WORKER_URL>` は、デプロイされた Worker の URL に置き換えてください。

## 設定

Worker の設定は [`otak-mcp-test/wrangler.jsonc`](otak-mcp-test/wrangler.jsonc:1) ファイルで行われます。主な設定項目は以下の通りです。

*   `name`: Worker の名前
*   `main`: エントリーポイントファイル ([`src/index.ts`](otak-mcp-test/src/index.ts:1))
*   `compatibility_date`, `compatibility_flags`: Worker の互換性設定
*   `durable_objects`: Durable Object のバインディング設定 (`MCP_OBJECT` が `MyMCP` クラスにバインドされています)
*   `migrations`: Durable Object のマイグレーション設定 (SQLite の有効化など)

## ソースコード (`otak-mcp-test/src`)

*   **[`index.ts`](otak-mcp-test/src/index.ts:1):**
    *   Cloudflare Worker のメインエントリーポイントです。
    *   受信リクエストを処理し、パス (`/sse` または `/mcp`) に基づいてルーティングします。
    *   リクエスト処理を [`MyMCP`](otak-mcp-test/src/MyMcp.ts:1) Durable Object に委譲します。
*   **[`MyMcp.ts`](otak-mcp-test/src/MyMcp.ts:1):**
    *   `MyMCP` Durable Object クラスの実装です。
    *   `McpAgent` を拡張し、`McpServer` を初期化します。
    *   利用可能な MCP ツール (`dice_roll`, `weather`) を定義し、その実行ロジックを処理します。
## デバッグ

デプロイされた Worker のリアルタイムログを確認するには、`wrangler tail` コマンドを使用します。

```bash
npx wrangler tail otak-mcp-test --format pretty
# または JSON 形式で詳細を確認
npx wrangler tail otak-mcp-test --format json
### MCP Inspector

MCP サーバーのテストには、`@modelcontextprotocol/inspector` GUI ツールが便利です。

```bash
npx @modelcontextprotocol/inspector
```

起動後、ブラウザで `http://127.0.0.1:6274` にアクセスします。

*   **Transport Type:** `SSE` または `Streamable HTTP` を選択します。
*   **URL:** Worker のエンドポイント URL (例: `https://<YOUR_WORKER_URL>/sse` または `https://<YOUR_WORKER_URL>/mcp`) を入力します。
*   **Connect:** 接続します。
*   **List Tools:** 提供されているツール一覧を確認できます。
*   **Run Tool:** パラメータを指定してツールを実行できます。
```

詳細なデバッグ手法については、[`.roo/rules/1-debug.md`](.roo/rules/1-debug.md:1) を参照してください。