/**
 * 環境変数の型定義
 */
export interface Env {
  // GitHub OAuth設定
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  
  // KVストレージ
  OAUTH_KV: KVNamespace;
}

/**
 * トークン情報の型定義
 */
export interface TokenInfo {
  // GitHubアクセストークン
  accessToken: string;
  
  // ユーザー情報
  userData: {
    login: string;
    id: number;
    name: string;
    avatar_url: string;
  };
}

/**
 * 認証コンテキストの型定義
 */
export interface AuthContext {
  // ユーザー情報
  user: {
    id: number;
    login: string;
    name: string;
    avatarUrl: string;
  };
  
  // アクセストークン
  accessToken: string;
  
  // セッションID
  sessionId: string;
}