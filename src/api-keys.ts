import type { Env, ApiKeyInfo } from './types';

// APIキー用のKVプレフィックス
const API_KEY_PREFIX = 'api-key:';
const API_KEY_INFO_PREFIX = 'api-key-info:';

/**
 * 新しいAPIキーを生成する
 */
export async function generateApiKey(
  env: Env,
  name: string,
  createdBy: { id: number; login: string; name: string },
  permissions: string[] = ['all'],
  expiresInDays: number = 365
): Promise<{ apiKey: string; apiKeyInfo: ApiKeyInfo }> {
  // ランダムなAPIキーを生成
  const apiKeyId = crypto.randomUUID();
  
  // ランダムなシークレットを生成
  const apiKeySecret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  const apiKey = `mcp_${apiKeyId}_${apiKeySecret}`;
  
  // APIキー情報を作成
  const now = Date.now();
  const expiresAt = now + (expiresInDays * 24 * 60 * 60 * 1000);
  
  // APIキーのハッシュを計算（保存用）
  const hashedKey = await hashApiKey(apiKey);
  
  const apiKeyInfo: ApiKeyInfo = {
    id: apiKeyId,
    key: hashedKey,
    createdAt: now,
    expiresAt,
    createdBy,
    name,
    permissions,
    isActive: true
  };
  
  // APIキー情報をKVに保存
  await env.OAUTH_KV.put(`${API_KEY_INFO_PREFIX}${apiKeyId}`, JSON.stringify(apiKeyInfo));
  
  // APIキーハッシュをIDでインデックス化
  await env.OAUTH_KV.put(`${API_KEY_PREFIX}${hashedKey}`, apiKeyId);
  
  return { apiKey, apiKeyInfo };
}

/**
 * APIキーを検証する
 */
export async function validateApiKey(apiKey: string, env: Env): Promise<{ valid: boolean; apiKeyInfo?: ApiKeyInfo }> {
  try {
    if (!apiKey || !apiKey.startsWith('mcp_')) {
      return { valid: false };
    }
    
    // APIキーのハッシュを計算
    const hashedKey = await hashApiKey(apiKey);
    
    // APIキーIDを取得
    const apiKeyId = await env.OAUTH_KV.get(`${API_KEY_PREFIX}${hashedKey}`);
    if (!apiKeyId) {
      return { valid: false };
    }
    
    // APIキー情報を取得
    const apiKeyInfoStr = await env.OAUTH_KV.get(`${API_KEY_INFO_PREFIX}${apiKeyId}`);
    if (!apiKeyInfoStr) {
      return { valid: false };
    }
    
    const apiKeyInfo = JSON.parse(apiKeyInfoStr) as ApiKeyInfo;
    
    // 有効期限と状態をチェック
    if (!apiKeyInfo.isActive || apiKeyInfo.expiresAt < Date.now()) {
      return { valid: false };
    }
    
    // 最終アクセス日時を更新
    apiKeyInfo.lastAccessed = Date.now();
    await env.OAUTH_KV.put(`${API_KEY_INFO_PREFIX}${apiKeyId}`, JSON.stringify(apiKeyInfo));
    
    return { valid: true, apiKeyInfo };
  } catch (error) {
    console.error('APIキー検証エラー:', error);
    return { valid: false };
  }
}

/**
 * 特定のユーザーのAPIキー一覧を取得する
 */
export async function listApiKeys(userId: number, env: Env): Promise<ApiKeyInfo[]> {
  const keys: ApiKeyInfo[] = [];
  
  // KVストレージ内のすべてのAPIキーを取得
  const { keys: allKeys } = await env.OAUTH_KV.list({ prefix: API_KEY_INFO_PREFIX });
  
  for (const { name } of allKeys) {
    const apiKeyInfoStr = await env.OAUTH_KV.get(name);
    if (apiKeyInfoStr) {
      const apiKeyInfo = JSON.parse(apiKeyInfoStr) as ApiKeyInfo;
      
      // 指定したユーザーのAPIキーのみフィルタリング
      if (apiKeyInfo.createdBy.id === userId) {
        // 機密情報を除去（APIキーハッシュは含めない）
        const { key, ...safeApiKeyInfo } = apiKeyInfo;
        keys.push(safeApiKeyInfo as ApiKeyInfo);
      }
    }
  }
  
  return keys;
}

/**
 * APIキーを無効化する
 */
export async function deactivateApiKey(apiKeyId: string, userId: number, env: Env): Promise<boolean> {
  const apiKeyInfoStr = await env.OAUTH_KV.get(`${API_KEY_INFO_PREFIX}${apiKeyId}`);
  if (!apiKeyInfoStr) {
    return false;
  }
  
  const apiKeyInfo = JSON.parse(apiKeyInfoStr) as ApiKeyInfo;
  
  // 所有者チェック
  if (apiKeyInfo.createdBy.id !== userId) {
    return false;
  }
  
  // APIキーを無効化
  apiKeyInfo.isActive = false;
  await env.OAUTH_KV.put(`${API_KEY_INFO_PREFIX}${apiKeyId}`, JSON.stringify(apiKeyInfo));
  
  return true;
}

/**
 * APIキーをハッシュ化する
 * Web Crypto APIを使用してSHA-256ハッシュを生成
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}