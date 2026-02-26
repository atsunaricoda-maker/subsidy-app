// パスワードハッシュ化ユーティリティ
// Cloudflare Workers対応（Web Crypto APIを使用）

// ソルト生成
function generateSalt(length: number = 16): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// PBKDF2でハッシュ化
async function pbkdf2Hash(password: string, salt: string, iterations: number = 100000): Promise<string> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)
  const saltBuffer = encoder.encode(salt)
  
  // パスワードをキーとしてインポート
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  )
  
  // PBKDF2でハッシュを導出
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 256ビット = 32バイト
  )
  
  // ArrayBufferを16進文字列に変換
  const hashArray = new Uint8Array(derivedBits)
  return Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * パスワードをハッシュ化
 * 形式: $pbkdf2$iterations$salt$hash
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt(16)
  const iterations = 100000
  const hash = await pbkdf2Hash(password, salt, iterations)
  
  return `$pbkdf2$${iterations}$${salt}$${hash}`
}

/**
 * パスワードを検証
 * @param password 入力されたパスワード
 * @param storedHash データベースに保存されたハッシュ値
 * @returns 一致すればtrue
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // 旧形式（平文）の場合は直接比較（ログイン時に自動ハッシュ化される）
  if (!storedHash.startsWith('$pbkdf2$')) {
    console.warn('SECURITY: Plaintext password comparison used. Password will be migrated on next login.')
    return password === storedHash
  }
  
  // ハッシュ形式をパース: $pbkdf2$iterations$salt$hash
  const parts = storedHash.split('$')
  if (parts.length !== 5) {
    return false
  }
  
  const [, , iterationsStr, salt, hash] = parts
  const iterations = parseInt(iterationsStr, 10)
  
  // 入力パスワードをハッシュ化して比較
  const inputHash = await pbkdf2Hash(password, salt, iterations)
  
  // タイミング攻撃対策: 定数時間比較
  return timingSafeEqual(inputHash, hash)
}

/**
 * タイミング攻撃対策の定数時間比較
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * パスワードがハッシュ化されているか確認
 */
export function isPasswordHashed(storedHash: string): boolean {
  return storedHash.startsWith('$pbkdf2$')
}
