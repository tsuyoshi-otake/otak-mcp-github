import type { Env } from './types';

// KVストレージのキー
const ADMIN_USERS_KEY = 'admin_users';

/**
 * KVストレージから管理者リストを取得する
 */
export async function getAdminUsers(env: Env): Promise<string[]> {
  try {
    // KVから管理者リストを取得
    const adminListJson = await env.OAUTH_KV.get(ADMIN_USERS_KEY);
    
    // 管理者リストが存在しない場合は空の配列を返す
    if (!adminListJson) {
      console.log('管理者リストが見つかりません。初期化が必要です。');
      return [];
    }
    
    // JSONをパースして返す
    const adminUsers = JSON.parse(adminListJson) as string[];
    console.log('管理者リスト取得:', adminUsers);
    return adminUsers;
  } catch (error) {
    console.error('管理者リスト取得エラー:', error);
    return [];
  }
}

/**
 * KVストレージに管理者リストを保存する
 */
export async function saveAdminUsers(env: Env, adminUsers: string[]): Promise<boolean> {
  try {
    // 管理者リストをJSONに変換してKVに保存
    await env.OAUTH_KV.put(ADMIN_USERS_KEY, JSON.stringify(adminUsers));
    console.log('管理者リスト保存:', adminUsers);
    return true;
  } catch (error) {
    console.error('管理者リスト保存エラー:', error);
    return false;
  }
}

/**
 * 管理者リストを初期化する（初回のみ実行）
 */
export async function initializeAdminUsers(env: Env, initialAdmin: string): Promise<boolean> {
  try {
    // 既存の管理者リストを取得
    const existingAdmins = await getAdminUsers(env);
    
    // 既に管理者リストが存在する場合は何もしない
    if (existingAdmins.length > 0) {
      console.log('管理者リストは既に初期化されています:', existingAdmins);
      return true;
    }
    
    // 初期管理者リストを保存
    const success = await saveAdminUsers(env, [initialAdmin]);
    console.log('管理者リスト初期化:', initialAdmin, success ? '成功' : '失敗');
    return success;
  } catch (error) {
    console.error('管理者リスト初期化エラー:', error);
    return false;
  }
}

/**
 * 管理者を追加する
 */
export async function addAdminUser(env: Env, username: string): Promise<boolean> {
  try {
    // 既存の管理者リストを取得
    const adminUsers = await getAdminUsers(env);
    
    // 既に管理者リストに含まれている場合は何もしない
    if (adminUsers.includes(username)) {
      console.log('ユーザーは既に管理者です:', username);
      return true;
    }
    
    // 管理者リストに追加して保存
    adminUsers.push(username);
    const success = await saveAdminUsers(env, adminUsers);
    console.log('管理者追加:', username, success ? '成功' : '失敗');
    return success;
  } catch (error) {
    console.error('管理者追加エラー:', error);
    return false;
  }
}

/**
 * 管理者を削除する
 */
export async function removeAdminUser(env: Env, username: string): Promise<boolean> {
  try {
    // 既存の管理者リストを取得
    const adminUsers = await getAdminUsers(env);
    
    // 管理者リストに含まれていない場合は何もしない
    if (!adminUsers.includes(username)) {
      console.log('ユーザーは管理者ではありません:', username);
      return true;
    }
    
    // 管理者が1人だけの場合は削除できない
    if (adminUsers.length <= 1) {
      console.log('最後の管理者は削除できません');
      return false;
    }
    
    // 管理者リストから削除して保存
    const newAdminUsers = adminUsers.filter(admin => admin !== username);
    const success = await saveAdminUsers(env, newAdminUsers);
    console.log('管理者削除:', username, success ? '成功' : '失敗');
    return success;
  } catch (error) {
    console.error('管理者削除エラー:', error);
    return false;
  }
}

/**
 * ユーザーが管理者かどうかを確認する
 */
export async function isAdminUser(env: Env, username: string): Promise<boolean> {
  try {
    // 管理者リストを取得
    const adminUsers = await getAdminUsers(env);
    
    // 管理者リストに含まれているかどうかを返す
    const isAdmin = adminUsers.includes(username);
    console.log('管理者確認:', username, isAdmin ? '管理者です' : '管理者ではありません');
    return isAdmin;
  } catch (error) {
    console.error('管理者確認エラー:', error);
    return false;
  }
}