// 認証関連ユーティリティ

// ユーザー情報取得ヘルパー関数（organization_id含む）
// サブドメインのテナント組織IDがある場合、それを優先
export async function getCurrentUser(c: any) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return null
  
  // サブドメインからテナント組織IDを取得
  const tenantOrgId = c.get('tenantOrgId')
  
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
        // テナントIDがある場合、そのテナントのユーザーのみ許可
        let query = `SELECT id, username, name, role, organization_id FROM admin_users WHERE id = ?`
        const bindings: any[] = [userId]
        
        if (tenantOrgId) {
          query += ` AND organization_id = ?`
          bindings.push(tenantOrgId)
        }
        
        const user = await DB.prepare(query).bind(...bindings).first()
        if (user) {
          return { ...user, role: user.role || 'admin' }
        }
        
        // テナントIDが指定されていてユーザーが見つからない場合はnull
        if (tenantOrgId) {
          return null
        }
      }
    }
    
    // 古い形式のフォールバック: username:role
    const [username] = decoded.split(':')
    if (username) {
      let query = `SELECT id, username, name, role, organization_id FROM admin_users WHERE username = ?`
      const bindings: any[] = [username]
      
      if (tenantOrgId) {
        query += ` AND organization_id = ?`
        bindings.push(tenantOrgId)
      }
      
      const user = await DB.prepare(query).bind(...bindings).first()
      if (user) {
        return { ...user, role: user.role || 'admin' }
      }
      
      // テナントIDがない場合のみデフォルト
      if (!tenantOrgId) {
        return { username, role: 'staff', organization_id: 1 }
      }
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
