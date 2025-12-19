// お知らせ管理API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// お知らせ一覧取得（管理者用）
routes.get('/announcements', async (c) => {
  const { DB } = c.env
  const includeInactive = c.req.query('include_inactive') === 'true'
  
  let query = `SELECT * FROM announcements`
  if (!includeInactive) {
    query += ` WHERE is_active = 1`
  }
  query += ` ORDER BY created_at DESC`
  
  const announcements = await DB.prepare(query).all()
  return c.json(announcements.results || [])
})

// 顧客向けお知らせ取得
routes.get('/clients/:clientId/announcements', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const now = new Date().toISOString()
  
  const announcements = await DB.prepare(`
    SELECT a.*, 
           CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END as is_read
    FROM announcements a
    LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.client_id = ?
    WHERE a.is_active = 1
    AND (a.target_type = 'all' OR a.target_type = 'client' 
         OR (a.target_type = 'specific' AND a.target_ids LIKE ?))
    AND (a.start_date IS NULL OR a.start_date <= ?)
    AND (a.end_date IS NULL OR a.end_date >= ?)
    ORDER BY a.created_at DESC
  `).bind(clientId, `%${clientId}%`, now, now).all()
  
  return c.json(announcements.results || [])
})

// お知らせ作成
routes.post('/announcements', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO announcements 
    (title, content, type, target_type, target_ids, start_date, end_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.title,
    data.content,
    data.type || 'info',
    data.target_type || 'all',
    data.target_ids || null,
    data.start_date || null,
    data.end_date || null,
    data.created_by || null
  ).run()
  
  return c.json({ 
    success: true,
    id: result.meta.last_row_id,
    message: 'お知らせを作成しました' 
  })
})

// お知らせ既読
routes.post('/announcements/:id/read', async (c) => {
  const { DB } = c.env
  const announcementId = c.req.param('id')
  const { client_id, admin_user_id } = await c.req.json()
  
  await DB.prepare(`
    INSERT OR IGNORE INTO announcement_reads (announcement_id, client_id, admin_user_id)
    VALUES (?, ?, ?)
  `).bind(announcementId, client_id || null, admin_user_id || null).run()
  
  return c.json({ success: true })
})

export default routes
