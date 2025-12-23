// フェーズ4: ダッシュボード統計API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 管理者ダッシュボード用統計API
routes.get('/dashboard/stats', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  try {
  // 顧客統計（organization_idでフィルタ）
  const clientStats = await DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'inquiry' THEN 1 ELSE 0 END) as inquiry,
      SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) as preparing,
      SUM(CASE WHEN status = 'applying' THEN 1 ELSE 0 END) as applying,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM clients
    WHERE organization_id = ?
  `).bind(orgId).first()
  
  // 今月の統計（organization_idでフィルタ）
  const thisMonth = new Date().toISOString().substring(0, 7)
  const monthlyStats = await DB.prepare(`
    SELECT 
      COUNT(*) as new_clients,
      (SELECT COUNT(*) FROM clients WHERE organization_id = ? AND status = 'completed' AND strftime('%Y-%m', updated_at) = ?) as completed_this_month
    FROM clients WHERE organization_id = ? AND strftime('%Y-%m', created_at) = ?
  `).bind(orgId, thisMonth, orgId, thisMonth).first()
  
  // 今月の案件実績（organization_idでフィルタ）
  const monthlyCaseStats = await DB.prepare(`
    SELECT 
      SUM(CASE WHEN is_archived = 1 AND strftime('%Y-%m', updated_at) = ? THEN 1 ELSE 0 END) as monthly_completed,
      SUM(CASE WHEN result = 'approved' AND strftime('%Y-%m', updated_at) = ? THEN 1 ELSE 0 END) as monthly_approved,
      SUM(CASE WHEN result = 'rejected' AND strftime('%Y-%m', updated_at) = ? THEN 1 ELSE 0 END) as monthly_rejected,
      SUM(CASE WHEN result = 'approved' AND strftime('%Y-%m', updated_at) = ? THEN COALESCE(approved_amount, 0) ELSE 0 END) as monthly_approved_amount,
      SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END) as total_archived
    FROM cases
    WHERE organization_id = ?
  `).bind(thisMonth, thisMonth, thisMonth, thisMonth, orgId).first() as any
  
  // 生成文書統計（organization_idでフィルタ - casesテーブル経由）
  let docStats: any = { total: 0, draft: 0, review: 0, final: 0 }
  try {
    docStats = await DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN gd.status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN gd.status = 'review' THEN 1 ELSE 0 END) as review,
        SUM(CASE WHEN gd.status = 'final' THEN 1 ELSE 0 END) as final
      FROM generated_documents gd
      JOIN cases c ON gd.case_id = c.id
      WHERE c.organization_id = ?
    `).bind(orgId).first() || docStats
  } catch (e) {
    // テーブルが存在しない場合はスキップ
  }
  
  // マッチングスコア統計（organization_idでフィルタ - clientsテーブル経由）
  let matchStats: any = { avg_score: 0, avg_probability: 0, total_analyses: 0 }
  try {
    matchStats = await DB.prepare(`
      SELECT 
        AVG(sms.match_score) as avg_score,
        AVG(sms.adoption_probability) as avg_probability,
        COUNT(*) as total_analyses
      FROM subsidy_match_scores sms
      JOIN clients cl ON sms.client_id = cl.id
      WHERE cl.organization_id = ?
    `).bind(orgId).first() || matchStats
  } catch (e) {
    // テーブルが存在しない場合はスキップ
  }
  
  // 公募要領更新通知
  let pendingUpdates: any = { count: 0 }
  try {
    pendingUpdates = await DB.prepare(`
      SELECT COUNT(*) as count FROM subsidy_update_logs WHERE status = 'pending'
    `).first() || pendingUpdates
  } catch (e) {
    // テーブルが存在しない場合はスキップ
  }
  
  // 未読通知数（organization_idでテナント分離）
  let unreadNotifications: any = { count: 0 }
  try {
    unreadNotifications = await DB.prepare(`
      SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0 AND (organization_id = ? OR organization_id IS NULL)
    `).bind(orgId).first() || unreadNotifications
  } catch (e) {
    // テーブルが存在しない場合はスキップ
  }
  
  // 今月の採択率を計算
  const monthlyCompleted = monthlyCaseStats?.monthly_completed || 0
  const monthlyApproved = monthlyCaseStats?.monthly_approved || 0
  const monthlyRejected = monthlyCaseStats?.monthly_rejected || 0
  const monthlyTotal = monthlyApproved + monthlyRejected
  const monthlyRate = monthlyTotal > 0 ? Math.round((monthlyApproved / monthlyTotal) * 100) : 0
  
  return c.json({
    clients: clientStats,
    monthly: monthlyStats,
    documents: docStats,
    matching: {
      average_score: Math.round(matchStats?.avg_score || 0),
      average_probability: Math.round(matchStats?.avg_probability || 0),
      total_analyses: matchStats?.total_analyses || 0
    },
    alerts: {
      pending_guideline_updates: pendingUpdates?.count || 0,
      unread_notifications: unreadNotifications?.count || 0
    },
    monthly_cases: {
      completed: monthlyCompleted,
      approved: monthlyApproved,
      rejected: monthlyRejected,
      approved_amount: monthlyCaseStats?.monthly_approved_amount || 0,
      rate: monthlyRate,
      total_archived: monthlyCaseStats?.total_archived || 0
    },
    current_month: thisMonth,
    generated_at: new Date().toISOString()
  })
  } catch (error: any) {
    console.error('Dashboard stats error:', error)
    return c.json({ 
      error: 'ダッシュボード統計の取得に失敗しました',
      details: error.message 
    }, 500)
  }
})

export default routes
