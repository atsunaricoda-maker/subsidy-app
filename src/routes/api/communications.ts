// API: やり取り記録
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// やり取り記録一覧取得
routes.get('/clients/:id/communications', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // organization_idでテナント分離 - クライアントが自組織のものか確認
  const clientCheck = await DB.prepare(`SELECT id FROM clients WHERE id = ? AND organization_id = ?`).bind(id, orgId).first()
  if (!clientCheck) {
    return c.json([])
  }
  
  const result = await DB.prepare(`
    SELECT * FROM communications WHERE client_id = ? ORDER BY created_at ASC
  `).bind(id).all()
  
  return c.json(result.results)
})

// やり取り記録追加
routes.post('/clients/:id/communications', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // organization_idでテナント分離 - クライアントが自組織のものか確認
  const clientCheck = await DB.prepare(`SELECT id FROM clients WHERE id = ? AND organization_id = ?`).bind(id, orgId).first()
  if (!clientCheck) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }
  
  const result = await DB.prepare(`
    INSERT INTO communications (client_id, case_id, message, sender_type, sender_name)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    id,
    data.case_id || null,
    data.message,
    data.sender_type,
    data.sender_name
  ).run()
  
  // 顧客からのメッセージの場合、管理者に通知を作成
  if (data.sender_type === 'client') {
    const client = await DB.prepare(`SELECT name, company_name, organization_id FROM clients WHERE id = ?`).bind(id).first() as any
    const clientName = client?.company_name || client?.name || '顧客'
    const clientOrgId = client?.organization_id
    await DB.prepare(`
      INSERT INTO admin_notifications (notification_type, title, message, related_id, related_table, organization_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      'new_message',
      '新しいメッセージ',
      `${clientName}様から新しいメッセージが届きました`,
      id,
      'clients',
      clientOrgId
    ).run()
  }
  
  return c.json({ 
    id: result.meta.last_row_id 
  })
})

export default routes
