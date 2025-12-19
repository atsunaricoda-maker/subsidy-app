// 従業員管理API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 従業員一覧取得
routes.get('/admin/users', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離
  const orgId = user?.organization_id || 1
  
  const users = await DB.prepare(`
    SELECT id, username, name, role, created_at 
    FROM admin_users 
    WHERE organization_id = ?
    ORDER BY created_at DESC
  `).bind(orgId).all()
  
  return c.json(users.results || [])
})

// 従業員追加
routes.post('/admin/users', async (c) => {
  const { DB } = c.env
  const { username, password, name, role } = await c.req.json()
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離
  const orgId = user?.organization_id || 1
  
  // ユーザー名の重複チェック（同じ組織内）
  const existing = await DB.prepare(`
    SELECT id FROM admin_users WHERE username = ? AND organization_id = ?
  `).bind(username, orgId).first()
  
  if (existing) {
    return c.json({ error: 'このユーザー名は既に使用されています' }, 400)
  }
  
  // ロールのバリデーション
  const validRole = ['admin', 'staff'].includes(role) ? role : 'staff'
  
  // ユーザー追加（organization_id付き）
  const result = await DB.prepare(`
    INSERT INTO admin_users (username, password_hash, name, organization_id, role)
    VALUES (?, ?, ?, ?, ?)
  `).bind(username, password, name, orgId, validRole).run()
  
  return c.json({ 
    success: true, 
    id: result.meta.last_row_id,
    message: '従業員を追加しました'
  })
})

// 従業員編集
routes.put('/admin/users/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { username, password, name, role } = await c.req.json()
  
  // ユーザー名の重複チェック（自分以外）
  const existing = await DB.prepare(`
    SELECT id FROM admin_users WHERE username = ? AND id != ?
  `).bind(username, id).first()
  
  if (existing) {
    return c.json({ error: 'このユーザー名は既に使用されています' }, 400)
  }
  
  // ロールのバリデーション（ID=1のメイン管理者はadminから変更不可）
  let validRole = ['admin', 'staff'].includes(role) ? role : 'staff'
  if (id === '1') {
    validRole = 'admin' // メイン管理者は常にadmin
  }
  
  // パスワードが空でない場合のみ更新
  if (password) {
    await DB.prepare(`
      UPDATE admin_users 
      SET username = ?, password_hash = ?, name = ?, role = ?
      WHERE id = ?
    `).bind(username, password, name, validRole, id).run()
  } else {
    await DB.prepare(`
      UPDATE admin_users 
      SET username = ?, name = ?, role = ?
      WHERE id = ?
    `).bind(username, name, validRole, id).run()
  }
  
  return c.json({ 
    success: true,
    message: '従業員情報を更新しました'
  })
})

// 従業員削除
routes.delete('/admin/users/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // admin（ID=1）は削除不可
  if (id === '1') {
    return c.json({ error: 'メイン管理者は削除できません' }, 400)
  }
  
  await DB.prepare(`
    DELETE FROM admin_users WHERE id = ?
  `).bind(id).run()
  
  return c.json({ 
    success: true,
    message: '従業員を削除しました'
  })
})

export default routes
