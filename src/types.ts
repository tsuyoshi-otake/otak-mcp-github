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

/**
 * APIキー情報の型定義
 */
export interface ApiKeyInfo {
  // APIキー識別子
  id: string;
  
  // APIキー（ハッシュ化されたもの）
  key: string;
  
  // 作成日時
  createdAt: number;
  
  // 有効期限（UNIXタイムスタンプ）
  expiresAt: number;
  
  // 作成したユーザー
  createdBy: {
    id: number;
    login: string;
    name: string;
  };
  
  // 最終アクセス日時
  lastAccessed?: number;
  
  // APIキーの名前（説明）
  name: string;
  
  // APIキーの権限
  permissions: string[];
  
  // 有効かどうか
  isActive: boolean;
}