// 認証関連ユーティリティ
import type { Context } from 'hono'
import type { AppEnv } from '../types'

type AuthUser = {
  id: number
  username: string
  name: string
  role: string
  organization_id: number
}

// 有効な組織IDを取得（テナント分離のための重要な関数）
// 1. サブドメインのテナントIDがある場合、それを使用
// 2. ユーザーが認証されている場合、ユーザーの組織IDを使用
// 3. どちらもない場合はnullを返す
export function getEffectiveOrgId(c: Context<AppEnv>, user: AuthUser | null): number | null {
  // サブドメインからテナント組織IDを優先（最も安全）
  const tenantOrgId = c.get('tenantOrgId')
  if (tenantOrgId) {
    return tenantOrgId
  }
  
  // ユーザーの組織IDを使用
  if (user?.organization_id) {
    return user.organization_id
  }
  
  // 組織IDが特定できない場合はnull
  return null
}

// ユーザー情報取得ヘルパー関数（organization_id含む）
// サブドメインのテナント組織IDがある場合、それを優先（最も重要な変更）
export async function getCurrentUser(c: Context<AppEnv>): Promise<AuthUser | null> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return null
  
  // サブドメインからテナント組織IDを取得
  // これがある場合、必ずこのテナントIDを使う（クロステナントアクセス防止）
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
          // 重要：サブドメインのテナントIDがある場合、必ずそれを使用
          // これによりトークンに埋め込まれたorganization_idに関係なく
          // サブドメインのテナントのデータのみ取得可能になる
          const effectiveOrgId = tenantOrgId || (user.organization_id as number)
          return { id: user.id as number, username: user.username as string, name: user.name as string, role: (user.role as string) || 'admin', organization_id: effectiveOrgId }
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
      const bindings: (string | number)[] = [username]

      if (tenantOrgId) {
        query += ` AND organization_id = ?`
        bindings.push(tenantOrgId)
      }

      const user = await DB.prepare(query).bind(...bindings).first()
      if (user) {
        const effectiveOrgId = tenantOrgId || (user.organization_id as number)
        return { id: user.id as number, username: user.username as string, name: user.name as string, role: (user.role as string) || 'admin', organization_id: effectiveOrgId }
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
