// お知らせ管理API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// お知らせ一覧取得（管理者用）- 認証必須
routes.get('/announcements', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // 認証チェック（マスター管理者のみアクセス可能）
  if (!user || !user.is_master_admin) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }
  
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

// お知らせ作成 - 認証必須（マスター管理者のみ）
routes.post('/announcements', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // 認証チェック（マスター管理者のみ作成可能）
  if (!user || !user.is_master_admin) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }
  
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
    user.id
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
  const { client_id, admin_user_id, organization_id } = await c.req.json()
  
  await DB.prepare(`
    INSERT OR IGNORE INTO announcement_reads (announcement_id, client_id, admin_user_id, organization_id)
    VALUES (?, ?, ?, ?)
  `).bind(announcementId, client_id || null, admin_user_id || null, organization_id || null).run()
  
  return c.json({ success: true })
})

// 組織向けお知らせ取得（ダッシュボード用）
routes.get('/organizations/:orgId/announcements', async (c) => {
  const { DB } = c.env
  const orgId = c.req.param('orgId')
  
  const now = new Date().toISOString()
  
  try {
    const announcements = await DB.prepare(`
      SELECT a.*, 
             CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END as is_read
      FROM announcements a
      LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.organization_id = ?
      WHERE a.is_active = 1
      AND (a.target_type = 'all' OR a.target_type = 'organization' 
           OR (a.target_type = 'specific_org' AND (',' || a.target_ids || ',') LIKE '%,' || ? || ',%'))
      AND (a.start_date IS NULL OR datetime(a.start_date) <= datetime(?))
      AND (a.end_date IS NULL OR datetime(a.end_date) >= datetime(?))
      ORDER BY a.created_at DESC
      LIMIT 10
    `).bind(orgId, orgId, now, now).all()
    
    return c.json(announcements.results || [])
  } catch (error) {
    console.error('Announcements fetch error:', error)
    return c.json([])
  }
})

// お知らせ更新 - 認証必須（マスター管理者のみ）
routes.put('/announcements/:id', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // 認証チェック（マスター管理者のみ更新可能）
  if (!user || !user.is_master_admin) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }
  
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE announcements 
    SET title = ?, content = ?, type = ?, target_type = ?, target_ids = ?, 
        start_date = ?, end_date = ?, is_active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    data.title,
    data.content,
    data.type || 'info',
    data.target_type || 'all',
    data.target_ids || null,
    data.start_date || null,
    data.end_date || null,
    data.is_active !== undefined ? data.is_active : 1,
    id
  ).run()
  
  return c.json({ success: true, message: 'お知らせを更新しました' })
})

// お知らせ削除 - 認証必須（マスター管理者のみ）
routes.delete('/announcements/:id', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // 認証チェック（マスター管理者のみ削除可能）
  if (!user || !user.is_master_admin) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }
  
  const id = c.req.param('id')
  
  await DB.prepare('DELETE FROM announcement_reads WHERE announcement_id = ?').bind(id).run()
  await DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run()
  
  return c.json({ success: true, message: 'お知らせを削除しました' })
})

export default routes
