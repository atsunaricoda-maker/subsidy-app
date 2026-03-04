// デバッグ用: テナント分離の状態確認
// 本番環境では無効化推奨
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// テナント状態確認（認証必須 + admin限定）
routes.get('/debug/tenant-status', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)

  // 認証チェック - 管理者のみアクセス可能
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const effectiveOrgId = getEffectiveOrgId(c, user)

  // ミドルウェアから取得されたテナント情報
  const tenantOrgId = c.get('tenantOrgId')
  const tenantSlug = c.get('tenantSlug')

  return c.json({
    middleware: {
      tenantOrgId,
      tenantSlug
    },
    user: {
      id: user.id,
      username: user.username,
      organization_id: user.organization_id
    },
    effectiveOrgId
    // 組織一覧やデータ分布は非公開（情報漏洩防止）
  })
})

export default routes
