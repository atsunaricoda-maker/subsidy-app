// API: 申請種別管理
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 助成金種別一覧取得（業務範囲でフィルタリング）
routes.get('/subsidy-types', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const categoryFilter = c.req.query('category') || ''
  
  // id = 0 は共通質問用の内部レコードなので除外
  let query = `SELECT * FROM subsidy_types WHERE id > 0`
  const params: string[] = []
  
  // カテゴリフィルターが指定されている場合
  if (categoryFilter) {
    // 旧カテゴリ名から新カテゴリ名へのマッピング
    let mappedCategory = categoryFilter
    if (categoryFilter === 'subsidy') mappedCategory = '行政書士管轄'
    else if (categoryFilter === 'grant') mappedCategory = '社労士管轄'
    else if (categoryFilter === 'license') mappedCategory = '許認可'
    
    query += ` AND category = ?`
    params.push(mappedCategory)
  } else {
    // 組織の業務範囲を取得してフィルタリング（カテゴリ指定がない場合のみ）
    if (user?.organization_id) {
      const org = await DB.prepare(`SELECT business_scope FROM organizations WHERE id = ?`)
        .bind(user.organization_id).first()
      
      if (org?.business_scope) {
        const scope = org.business_scope as string
        
        // カテゴリマッピング:
        // - grant (助成金) = 厚労省系 = 社労士管轄 (labor)
        // - subsidy (補助金) = 経産省系 = 行政書士管轄 (administrative)
        // - license (許認可) = 行政書士管轄 (administrative)
        
        if (scope === 'labor') {
          // 社労士: 助成金のみ
          query += ` AND (category IN ('grant', '雇用系', '助成金', '社労士管轄') OR category IS NULL)`
        } else if (scope === 'administrative') {
          // 行政書士: 補助金と許認可
          query += ` AND (category IN ('subsidy', 'license', 'IT系', '設備投資系', '一般', '補助金', '許認可', '行政書士管轄') OR category IS NULL)`
        }
        // 'both' の場合は全て表示
      }
    }
  }
  
  query += ` ORDER BY category, name`
  
  const result = params.length > 0 
    ? await DB.prepare(query).bind(...params).all()
    : await DB.prepare(query).all()
  
  return c.json(result.results)
})

// 助成金種別詳細取得
routes.get('/subsidy-types/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT * FROM subsidy_types WHERE id = ?
  `).bind(id).first()
  
  if (!result) {
    return c.json({ error: 'Subsidy type not found' }, 404)
  }
  
  return c.json(result)
})

// 助成金種別の必要書類取得
routes.get('/subsidy-types/:id/documents', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT * FROM subsidy_type_documents 
    WHERE subsidy_type_id = ? 
    ORDER BY display_order
  `).bind(id).all()
  
  return c.json(result.results)
})

// 助成金種別新規作成
routes.post('/subsidy-types', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO subsidy_types (name, description, category)
    VALUES (?, ?, ?)
  `).bind(
    data.name,
    data.description || null,
    data.category || null
  ).run()
  
  return c.json({ id: result.meta.last_row_id })
})

// 助成金種別に必要書類追加
routes.post('/subsidy-types/:id/documents', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO subsidy_type_documents 
    (subsidy_type_id, document_type, description, is_required, display_order)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    id,
    data.document_type,
    data.description || null,
    data.is_required !== undefined ? data.is_required : 1,
    data.display_order || 0
  ).run()
  
  return c.json({ id: result.meta.last_row_id })
})

// 助成金種別の必要書類削除
routes.delete('/subsidy-types/:subsidyId/documents/:docId', async (c) => {
  const { DB } = c.env
  const docId = c.req.param('docId')
  
  await DB.prepare(`
    DELETE FROM subsidy_type_documents WHERE id = ?
  `).bind(docId).run()
  
  return c.json({ success: true })
})

// 助成金種別削除（関連データも削除）
routes.delete('/subsidy-types/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // id = 0 は共通質問用なので削除不可
  if (id === '0') {
    return c.json({ error: '共通質問用のレコードは削除できません' }, 400)
  }
  
  try {
    // この補助金種別を使用している顧客数をチェック
    const clientsUsingThisType = await DB.prepare(`
      SELECT COUNT(*) as count FROM clients WHERE subsidy_type_id = ?
    `).bind(id).first()
    
    // 関連データを削除
    // 1. 必要書類
    await DB.prepare(`DELETE FROM subsidy_type_documents WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 2. ヒアリング質問
    await DB.prepare(`DELETE FROM hearing_questions WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 3. 補助金ガイドライン
    await DB.prepare(`DELETE FROM subsidy_guidelines WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 4. マッチングスコア（この補助金種別に関連するもの）
    await DB.prepare(`DELETE FROM subsidy_match_scores WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 5. 補助金監視URL
    await DB.prepare(`DELETE FROM subsidy_watch_urls WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 6. 顧客の補助金種別をNULLに更新（削除ではなく解除）
    await DB.prepare(`UPDATE clients SET subsidy_type_id = NULL WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 最後に補助金種別自体を削除
    await DB.prepare(`DELETE FROM subsidy_types WHERE id = ?`).bind(id).run()
    
    return c.json({ 
      success: true, 
      message: '助成金種別を削除しました',
      affected_clients: clientsUsingThisType?.count || 0
    })
  } catch (error) {
    console.error('Error deleting subsidy type:', error)
    return c.json({ error: '削除に失敗しました', details: String(error) }, 500)
  }
})

export default routes
