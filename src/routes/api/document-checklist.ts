// API: 必要書類チェックリスト
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 旧チェックリスト（互換性のため残す）
routes.get('/document-checklist', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT * FROM document_checklist ORDER BY display_order
  `).all()
  
  return c.json(result.results)
})

// 顧客の助成金種別に基づくチェックリスト
routes.get('/clients/:id/document-checklist', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // 顧客の助成金種別を取得
  const client = await DB.prepare(`
    SELECT subsidy_type_id FROM clients WHERE id = ?
  `).bind(id).first()
  
  if (!client || !client.subsidy_type_id) {
    // 助成金種別が設定されていない場合は旧チェックリストを返す
    const result = await DB.prepare(`
      SELECT * FROM document_checklist ORDER BY display_order
    `).all()
    return c.json(result.results)
  }
  
  // 助成金種別の必要書類を取得
  const result = await DB.prepare(`
    SELECT * FROM subsidy_type_documents 
    WHERE subsidy_type_id = ? 
    ORDER BY display_order
  `).bind(client.subsidy_type_id).all()
  
  return c.json(result.results)
})

export default routes
