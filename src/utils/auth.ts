// 認証関連ユーティリティ

// ユーザー情報取得ヘルパー関数（organization_id含む）
export async function getCurrentUser(c: any) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return null
  
  try {
    const token = authHeader.replace('Bearer ', '')
    let decoded = token
    try {
      decoded = atob(token)
    } catch {
      // Base64デコード失敗時はそのまま使用
    }
    
    const parts = decoded.split(':')
    const { DB } = c.env
    
    // 新形式: userId:orgId:timestamp
    if (parts.length >= 2) {
      const userId = parseInt(parts[0])
      if (!isNaN(userId)) {
        const user = await DB.prepare(`
          SELECT id, username, name, role, organization_id FROM admin_users WHERE id = ?
        `).bind(userId).first()
        if (user) {
          return { ...user, role: user.role || 'admin' }
        }
      }
    }
    
    // 古い形式のフォールバック: username:role
    const [username] = decoded.split(':')
    if (username) {
      const user = await DB.prepare(`
        SELECT id, username, name, role, organization_id FROM admin_users WHERE username = ?
      `).bind(username).first()
      if (user) {
        return { ...user, role: user.role || 'admin' }
      }
      return { username, role: 'staff', organization_id: 1 } // デフォルト組織
    }
    return null
  } catch {
    return null
  }
}

// トークン生成
export function generateToken(userId: number, organizationId: number): string {
  return btoa(`${userId}:${organizationId}:${Date.now()}`)
}
