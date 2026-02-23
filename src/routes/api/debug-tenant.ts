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
  
  // 顧客のorganization_id分布
  const clientDistribution = await DB.prepare(`
    SELECT organization_id, COUNT(*) as count 
    FROM clients 
    GROUP BY organization_id
  `).all()
  
  // 顧客数（effectiveOrgIdでフィルタ）
  let filteredClientCount = null
  if (effectiveOrgId) {
    const fc = await DB.prepare(`SELECT COUNT(*) as count FROM clients WHERE organization_id = ?`).bind(effectiveOrgId).first()
    filteredClientCount = fc?.count ?? 0
  }
  
  // subsidy_guidelinesテーブルの状態
  let guidelinesInfo = null
  try {
    const gl = await DB.prepare(`SELECT COUNT(*) as count FROM subsidy_guidelines`).first()
    guidelinesInfo = { count: gl?.count ?? 0 }
  } catch (e: any) {
    guidelinesInfo = { error: e.message }
  }
  
  // clients APIクエリのテスト（LEFT JOINを含む）
  let clientsQueryTest = null
  if (effectiveOrgId) {
    try {
      const testResult = await DB.prepare(`
        SELECT c.id, c.name, c.organization_id, c.subsidy_type_id,
               sg.application_end_date,
               sg.max_amount
        FROM clients c
        LEFT JOIN subsidy_guidelines sg ON c.subsidy_type_id = sg.subsidy_type_id AND sg.status = 'active'
        WHERE c.organization_id = ?
        ORDER BY c.created_at DESC
        LIMIT 5
      `).bind(effectiveOrgId).all()
      clientsQueryTest = {
        success: true,
        count: testResult.results?.length ?? 0,
        sample: testResult.results?.slice(0, 3)
      }
    } catch (e: any) {
      clientsQueryTest = { success: false, error: e.message }
    }
  }
  
  return c.json({
    headers: {
      'x-original-host': originalHost,
      'host': host
    },
    middleware: {
      tenantOrgId,
      tenantOrgIdType: typeof tenantOrgId,
      tenantSlug,
      tenantOrg
    },
    user: user ? {
      id: user.id,
      username: user.username,
      organization_id: user.organization_id,
      organization_id_type: typeof user.organization_id,
      role: user.role
    } : null,
    effectiveOrgId,
    effectiveOrgIdType: typeof effectiveOrgId,
    organizations: orgs.results,
    clientDistribution: clientDistribution.results,
    caseDistribution: caseDistribution.results,
    filteredClientCount,
    guidelinesInfo,
    clientsQueryTest
  })
})

export default routes
