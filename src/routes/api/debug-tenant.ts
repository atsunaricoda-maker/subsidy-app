// デバッグ用: テナント分離の状態確認
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// テナント状態確認
routes.get('/debug/tenant-status', async (c) => {
  const { DB } = c.env
  
  // ミドルウェアから取得されたテナント情報
  const tenantOrgId = c.get('tenantOrgId')
  const tenantSlug = c.get('tenantSlug')
  const tenantOrg = c.get('tenantOrg')
  
  // ホスト情報
  const originalHost = c.req.header('x-original-host') || ''
  const host = c.req.header('host') || ''
  
  // ユーザー情報
  const user = await getCurrentUser(c)
  const effectiveOrgId = getEffectiveOrgId(c, user)
  
  // 組織一覧
  const orgs = await DB.prepare(`SELECT id, name, slug, status FROM organizations`).all()
  
  // 案件のorganization_id分布
  const caseDistribution = await DB.prepare(`
    SELECT organization_id, COUNT(*) as count 
    FROM cases 
    GROUP BY organization_id
  `).all()
  
  return c.json({
    headers: {
      'x-original-host': originalHost,
      'host': host
    },
    middleware: {
      tenantOrgId,
      tenantSlug,
      tenantOrg
    },
    user: user ? {
      id: user.id,
      username: user.username,
      organization_id: user.organization_id
    } : null,
    effectiveOrgId,
    organizations: orgs.results,
    caseDistribution: caseDistribution.results
  })
})

export default routes
