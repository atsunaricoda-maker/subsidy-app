// ヒアリング質問API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 補助金種別のヒアリング質問取得
routes.get('/hearing-questions/:subsidyTypeId', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.param('subsidyTypeId')
  
  // 共通質問を取得（subsidy_type_id = 0）
  const commonQuestions = await DB.prepare(`
    SELECT * FROM hearing_questions 
    WHERE subsidy_type_id = 0
    ORDER BY display_order ASC
  `).all()
  
  // 補助金固有の質問を取得
  const specificQuestions = await DB.prepare(`
    SELECT * FROM hearing_questions 
    WHERE subsidy_type_id = ?
    ORDER BY display_order ASC
  `).bind(subsidyTypeId).all()
  
  const commonQs = commonQuestions.results || []
  const specificQs = specificQuestions.results || []
  
  // 固有質問がない場合は共通質問のみ返す
  if (specificQs.length === 0) {
    return c.json(commonQs)
  }
  
  // 質問テキストの正規化関数（重複検出用）
  const normalizeText = (text: string) => {
    let normalized = text
      .replace(/導入後|実現後/g, '効果')
      .replace(/御社|貴社/g, '会社')
      .replace(/[？?！!、。・\s]/g, '')
      .toLowerCase()
    return normalized
  }
  
  // キーワードベースの重複チェック（同じカテゴリの類似質問を検出）
  const getKeywords = (text: string): string[] => {
    const keywords: string[] = []
    if (/事業内容/.test(text)) keywords.push('事業内容')
    if (/従業員/.test(text)) keywords.push('従業員')
    if (/年商|売上/.test(text)) keywords.push('売上')
    if (/創業|設立/.test(text)) keywords.push('設立年')
    if (/課題|困っている/.test(text)) keywords.push('課題')
    if (/影響/.test(text)) keywords.push('影響')
    if (/効果|期待/.test(text) && /どのような/.test(text)) keywords.push('期待効果')
    if (/予算/.test(text)) keywords.push('予算')
    if (/ビジョン|5年後|3年後/.test(text)) keywords.push('ビジョン')
    return keywords
  }
  
  // 共通質問でカバーされているキーワードを収集
  const commonKeywords = new Set<string>()
  commonQs.forEach(q => {
    getKeywords(q.question_text).forEach(k => commonKeywords.add(k))
  })
  
  // 共通質問の正規化されたテキストセットを作成
  const commonTextSet = new Set(commonQs.map(q => normalizeText(q.question_text)))
  
  // 案件別質問から重複を除外（共通質問と被るものは除外）
  const filteredSpecificQs = specificQs.filter(q => {
    // 正規化テキストで完全一致する場合は除外
    if (commonTextSet.has(normalizeText(q.question_text))) return false
    // キーワードが共通質問でカバーされている場合も除外
    const qKeywords = getKeywords(q.question_text)
    if (qKeywords.some(k => commonKeywords.has(k))) return false
    return true
  })
  
  // 共通質問を優先し、案件別質問の重複していないものを追加
  const mergedQuestions = [
    ...commonQs,  // 共通質問を優先（全件表示）
    ...filteredSpecificQs  // 案件別質問で重複していないもの
  ]
  
  // display_orderでソート
  mergedQuestions.sort((a, b) => a.display_order - b.display_order)
  
  return c.json(mergedQuestions)
})

// ヒアリング質問を全件取得（管理用）
routes.get('/hearing-questions', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.query('subsidy_type_id')
  
  let query = `
    SELECT hq.*, st.name as subsidy_type_name
    FROM hearing_questions hq
    LEFT JOIN subsidy_types st ON hq.subsidy_type_id = st.id
  `
  
  const params: any[] = []
  if (subsidyTypeId !== undefined) {
    query += ` WHERE hq.subsidy_type_id = ?`
    params.push(parseInt(subsidyTypeId) || 0)
  }
  
  query += ` ORDER BY hq.subsidy_type_id, hq.display_order`
  
  const result = await DB.prepare(query).bind(...params).all()
  return c.json(result.results || [])
})

// ヒアリング質問を新規作成
routes.post('/hearing-questions', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  // display_orderを取得
  const maxOrderResult = await DB.prepare(`
    SELECT MAX(display_order) as max_order FROM hearing_questions WHERE subsidy_type_id = ?
  `).bind(data.subsidy_type_id).first()
  const maxOrder = (maxOrderResult as any)?.max_order || 0
  
  const result = await DB.prepare(`
    INSERT INTO hearing_questions 
    (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.subsidy_type_id,
    data.question_key || `q_${Date.now()}`,
    data.question_text,
    data.question_type || 'text',
    data.options ? JSON.stringify(data.options) : null,
    data.category || null,
    data.is_required !== undefined ? (data.is_required ? 1 : 0) : 1,
    maxOrder + 1,
    data.help_text || null,
    data.example_answer || null,
    data.document_section || null
  ).run()
  
  return c.json({ success: true, id: result.meta.last_row_id, message: 'ヒアリング質問を作成しました' })
})

// ヒアリング質問を更新
routes.put('/hearing-questions/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE hearing_questions SET
      question_text = ?,
      question_type = ?,
      options = ?,
      category = ?,
      is_required = ?,
      display_order = ?,
      help_text = ?,
      example_answer = ?,
      document_section = ?
    WHERE id = ?
  `).bind(
    data.question_text,
    data.question_type || 'text',
    data.options ? JSON.stringify(data.options) : null,
    data.category || null,
    data.is_required !== undefined ? (data.is_required ? 1 : 0) : 1,
    data.display_order || 0,
    data.help_text || null,
    data.example_answer || null,
    data.document_section || null,
    id
  ).run()
  
  return c.json({ success: true, message: 'ヒアリング質問を更新しました' })
})

// ヒアリング質問を削除
routes.delete('/hearing-questions/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // 関連する回答も削除される（CASCADE）
  await DB.prepare(`DELETE FROM hearing_questions WHERE id = ?`).bind(id).run()
  
  return c.json({ success: true, message: 'ヒアリング質問を削除しました' })
})

// ヒアリング質問の並び替え
routes.put('/hearing-questions/reorder', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  // data.orders = [{ id: 1, display_order: 0 }, { id: 2, display_order: 1 }, ...]
  for (const item of data.orders) {
    await DB.prepare(`
      UPDATE hearing_questions SET display_order = ? WHERE id = ?
    `).bind(item.display_order, item.id).run()
  }
  
  return c.json({ success: true, message: '並び替えを保存しました' })
})

// 顧客のヒアリング回答取得
routes.get('/clients/:clientId/hearing-answers', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  // テナント分離: クライアントが自組織のものか確認
  if (orgId) {
    const clientCheck = await DB.prepare(`SELECT id FROM clients WHERE id = ? AND organization_id = ?`).bind(clientId, orgId).first()
    if (!clientCheck) {
      return c.json([]) // 他テナントのクライアントにはアクセス不可
    }
  }
  
  const result = await DB.prepare(`
    SELECT ha.*, hq.question_key, hq.question_text, hq.category
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
    ORDER BY hq.display_order
  `).bind(clientId).all()
  
  return c.json(result.results)
})

// ヒアリング回答保存（複数対応）
routes.post('/clients/:clientId/hearing-answers', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  // テナント分離: クライアントが自組織のものか確認
  if (orgId) {
    const clientCheck = await DB.prepare(`SELECT id FROM clients WHERE id = ? AND organization_id = ?`).bind(clientId, orgId).first()
    if (!clientCheck) {
      return c.json({ error: 'アクセス権限がありません' }, 403)
    }
  }
  
  // question_keyとclient_profilesフィールドのマッピング
  const profileFieldMapping: Record<string, string> = {
    'employee_count': 'employee_count',
    'common_employee_count': 'employee_count',
    'annual_revenue': 'annual_revenue',
    'common_annual_revenue': 'annual_revenue',
    'establishment_year': 'establishment_year',
    'common_establishment_year': 'establishment_year',
    'company_overview': 'industry',  // 事業内容から業種を推定
    'common_company_overview': 'industry',
    'common_business_area': 'region',
    'current_issues': 'business_challenges',
    'common_current_issues': 'business_challenges',
    'common_what_to_achieve': 'investment_plans',
    'target_it_tool': 'investment_plans',
  }
  
  // プロファイル更新用データを収集
  const profileUpdates: Record<string, string> = {}
  
  // 回答を保存し、プロファイル更新データを収集する関数
  const saveAnswerAndCollectProfile = async (questionId: number, answerText: string) => {
    // 質問のquestion_keyを取得
    const question = await DB.prepare(`
      SELECT question_key FROM hearing_questions WHERE id = ?
    `).bind(questionId).first() as { question_key: string } | null
    
    if (question && profileFieldMapping[question.question_key] && answerText) {
      const field = profileFieldMapping[question.question_key]
      profileUpdates[field] = answerText
    }
    
    // 回答を保存
    const existing = await DB.prepare(`
      SELECT id FROM hearing_answers WHERE client_id = ? AND question_id = ?
    `).bind(clientId, questionId).first()
    
    if (existing) {
      await DB.prepare(`
        UPDATE hearing_answers 
        SET answer_text = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(answerText, (existing as any).id).run()
    } else {
      await DB.prepare(`
        INSERT INTO hearing_answers (client_id, question_id, answer_text)
        VALUES (?, ?, ?)
      `).bind(clientId, questionId, answerText).run()
    }
  }
  
  // 複数回答の一括保存
  if (data.answers && Array.isArray(data.answers)) {
    for (const answer of data.answers) {
      await saveAnswerAndCollectProfile(answer.question_id, answer.answer_text)
    }
  } else {
    // 単一回答の保存（後方互換性）
    await saveAnswerAndCollectProfile(data.question_id, data.answer_text)
  }
  
  // client_profilesを自動更新
  if (Object.keys(profileUpdates).length > 0) {
    const existingProfile = await DB.prepare(`
      SELECT id FROM client_profiles WHERE client_id = ?
    `).bind(clientId).first()
    
    if (existingProfile) {
      // 既存プロファイルを更新（null以外のフィールドのみ）
      const updates: string[] = []
      const values: any[] = []
      
      for (const [field, value] of Object.entries(profileUpdates)) {
        if (field === 'employee_count' || field === 'annual_revenue') {
          // 数値フィールド
          const numValue = parseInt(value.replace(/[^0-9]/g, ''))
          if (!isNaN(numValue)) {
            updates.push(`${field} = ?`)
            values.push(numValue)
          }
        } else if (field === 'establishment_year') {
          // 年のフィールド
          const yearMatch = value.match(/(\d{4})/)
          if (yearMatch) {
            updates.push(`${field} = ?`)
            values.push(parseInt(yearMatch[1]))
          }
        } else {
          updates.push(`${field} = ?`)
          values.push(value)
        }
      }
      
      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP')
        values.push(clientId)
        await DB.prepare(`
          UPDATE client_profiles SET ${updates.join(', ')} WHERE client_id = ?
        `).bind(...values).run()
      }
    } else {
      // 新規プロファイル作成
      const fields = ['client_id']
      const placeholders = ['?']
      const values: any[] = [clientId]
      
      for (const [field, value] of Object.entries(profileUpdates)) {
        fields.push(field)
        placeholders.push('?')
        
        if (field === 'employee_count' || field === 'annual_revenue') {
          const numValue = parseInt(value.replace(/[^0-9]/g, ''))
          values.push(isNaN(numValue) ? null : numValue)
        } else if (field === 'establishment_year') {
          const yearMatch = value.match(/(\d{4})/)
          values.push(yearMatch ? parseInt(yearMatch[1]) : null)
        } else {
          values.push(value)
        }
      }
      
      await DB.prepare(`
        INSERT INTO client_profiles (${fields.join(', ')}) VALUES (${placeholders.join(', ')})
      `).bind(...values).run()
    }
  }
  
  return c.json({ 
    saved: data.answers ? data.answers.length : 1,
    profile_updated: Object.keys(profileUpdates).length > 0
  })
})

export default routes
