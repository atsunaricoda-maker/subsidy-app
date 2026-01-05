// API: 公募要領管理
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 監視URL一覧取得
routes.get('/subsidy-watch-urls', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT w.*, s.name as subsidy_name 
    FROM subsidy_watch_urls w
    LEFT JOIN subsidy_types s ON w.subsidy_type_id = s.id
    ORDER BY w.subsidy_type_id, w.id
  `).all()
  
  return c.json(result.results)
})

// 監視URL追加
routes.post('/subsidy-watch-urls', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO subsidy_watch_urls (subsidy_type_id, url, url_type, description)
    VALUES (?, ?, ?, ?)
  `).bind(
    data.subsidy_type_id,
    data.url,
    data.url_type || 'page',
    data.description || null
  ).run()
  
  return c.json({ id: result.meta.last_row_id })
})

// 監視URL削除
routes.delete('/subsidy-watch-urls/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare(`DELETE FROM subsidy_watch_urls WHERE id = ?`).bind(id).run()
  
  return c.json({ success: true })
})

// 更新チェック実行（手動 or Cron）
routes.post('/subsidy-check-updates', async (c) => {
  const { DB } = c.env
  
  // アクティブな監視URLを取得
  const watchUrls = await DB.prepare(`
    SELECT w.*, s.name as subsidy_name 
    FROM subsidy_watch_urls w
    LEFT JOIN subsidy_types s ON w.subsidy_type_id = s.id
    WHERE w.is_active = 1
  `).all()
  
  const results = []
  
  for (const watchUrl of (watchUrls.results || [])) {
    try {
      // URLをフェッチしてハッシュを計算
      const response = await fetch(watchUrl.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SubsidyChecker/1.0)'
        }
      })
      
      if (!response.ok) {
        results.push({
          url: watchUrl.url,
          status: 'error',
          message: `HTTP ${response.status}`
        })
        continue
      }
      
      const content = await response.text()
      
      // シンプルなハッシュ計算（コンテンツの長さ + 一部の内容）
      const contentHash = btoa(content.length.toString() + content.substring(0, 1000)).substring(0, 64)
      
      // Last-Modifiedヘッダー取得
      const lastModified = response.headers.get('Last-Modified') || null
      
      // 変更検知
      let changeDetected = false
      let changeType = null
      
      if (watchUrl.last_content_hash && watchUrl.last_content_hash !== contentHash) {
        changeDetected = true
        changeType = 'content_change'
      }
      
      if (watchUrl.last_modified_date && lastModified && watchUrl.last_modified_date !== lastModified) {
        changeDetected = true
        changeType = 'modified_date_change'
      }
      
      // 初回チェックの場合は変更なしとして記録
      if (!watchUrl.last_checked_at) {
        changeDetected = false
      }
      
      // 監視URLの状態を更新
      await DB.prepare(`
        UPDATE subsidy_watch_urls 
        SET last_checked_at = CURRENT_TIMESTAMP,
            last_content_hash = ?,
            last_modified_date = ?
        WHERE id = ?
      `).bind(contentHash, lastModified, watchUrl.id).run()
      
      // 変更が検知された場合、ログと通知を作成
      if (changeDetected) {
        // 更新ログ作成
        await DB.prepare(`
          INSERT INTO subsidy_update_logs 
          (watch_url_id, subsidy_type_id, change_type, old_value, new_value)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          watchUrl.id,
          watchUrl.subsidy_type_id,
          changeType,
          watchUrl.last_content_hash,
          contentHash
        ).run()
        
        // 管理者通知作成
        await DB.prepare(`
          INSERT INTO admin_notifications 
          (notification_type, title, message, related_id, related_table)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          'subsidy_update',
          `${watchUrl.subsidy_name}の公募要領が更新された可能性があります`,
          `監視URL: ${watchUrl.description || watchUrl.url}\n変更種別: ${changeType}`,
          watchUrl.id,
          'subsidy_watch_urls'
        ).run()
      }
      
      results.push({
        url: watchUrl.url,
        subsidy_name: watchUrl.subsidy_name,
        status: 'success',
        change_detected: changeDetected,
        change_type: changeType
      })
      
    } catch (error) {
      results.push({
        url: watchUrl.url,
        status: 'error',
        message: error.message
      })
    }
  }
  
  return c.json({
    checked_at: new Date().toISOString(),
    total: watchUrls.results?.length || 0,
    results
  })
})

// AI による公募要領情報の自動抽出
routes.post('/subsidy-guidelines/:subsidyTypeId/ai-extract', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.param('subsidyTypeId')
  const { url } = await c.req.json()
  
  if (!url) {
    return c.json({ error: 'URLが指定されていません' }, 400)
  }
  
  try {
    // URLからコンテンツを取得
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9'
      }
    })
    
    if (!response.ok) {
      return c.json({ error: `URLの取得に失敗しました: HTTP ${response.status}` }, 400)
    }
    
    const html = await response.text()
    
    // HTMLからテキストを抽出（簡易的なパース）
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 15000) // トークン制限のため
    
    // 補助金情報を取得
    const subsidyType = await DB.prepare(`
      SELECT * FROM subsidy_types WHERE id = ?
    `).bind(subsidyTypeId).first()
    
    // 現在の公募要領情報を取得
    const currentGuideline = await DB.prepare(`
      SELECT * FROM subsidy_guidelines 
      WHERE subsidy_type_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).bind(subsidyTypeId).first()
    
    // AIプロンプト作成
    const prompt = `あなたは補助金・助成金の専門家です。以下のウェブページの内容から、補助金の公募要領情報を抽出してください。

【補助金名】
${subsidyType?.name || '不明'}

【ウェブページの内容】
${textContent}

【抽出してほしい情報】
以下の情報をJSON形式で出力してください。情報が見つからない場合はnullを入れてください。

{
  "fiscal_year": "年度（例: 2025年度、令和7年度）",
  "version": "公募回・バージョン（例: 第1次公募、通年公募、第18次）",
  "application_start_date": "申請開始日（YYYY-MM-DD形式）",
  "application_end_date": "申請締切日（YYYY-MM-DD形式）",
  "max_amount": "補助上限額（円単位の数値のみ、例: 4500000）",
  "min_amount": "補助下限額（円単位の数値のみ）",
  "subsidy_rate": "補助率（例: 1/2、2/3、1/2〜2/3）",
  "eligibility_requirements": "対象者・要件（100文字以内で要約）",
  "target_expenses": "対象経費（100文字以内で要約）",
  "changes_detected": "前回からの主な変更点（あれば記載、なければnull）",
  "confidence": "抽出の確信度（high/medium/low）",
  "notes": "その他重要な情報や注意点"
}

重要：
- 金額は必ず円単位の数値のみで出力（万円の場合は10000を掛けて変換）
- 日付は必ずYYYY-MM-DD形式
- 情報が明確に読み取れない場合はnullを設定
- JSONのみを出力し、他の説明は不要`

    // Claude AIを呼び出し
    const aiText = await callAI(prompt, c.env)
    
    // JSONを抽出
    let extracted = null
    try {
      // JSONブロックを探す
      const jsonMatch = aiText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.error('JSON parse error:', e)
    }
    
    if (!extracted) {
      return c.json({ error: 'AIからの応答を解析できませんでした', raw: aiText }, 500)
    }
    
    // 現在のデータと比較して差分を検出
    const changes = []
    if (currentGuideline) {
      if (extracted.fiscal_year && extracted.fiscal_year !== currentGuideline.fiscal_year) {
        changes.push({ field: '年度', old: currentGuideline.fiscal_year, new: extracted.fiscal_year })
      }
      if (extracted.version && extracted.version !== currentGuideline.version) {
        changes.push({ field: '公募回', old: currentGuideline.version, new: extracted.version })
      }
      if (extracted.application_end_date && extracted.application_end_date !== currentGuideline.application_end_date) {
        changes.push({ field: '申請締切', old: currentGuideline.application_end_date, new: extracted.application_end_date })
      }
      if (extracted.max_amount && extracted.max_amount !== currentGuideline.max_amount) {
        changes.push({ field: '上限額', old: currentGuideline.max_amount, new: extracted.max_amount })
      }
      if (extracted.subsidy_rate && extracted.subsidy_rate !== currentGuideline.subsidy_rate) {
        changes.push({ field: '補助率', old: currentGuideline.subsidy_rate, new: extracted.subsidy_rate })
      }
    }
    
    return c.json({
      success: true,
      subsidy_type: subsidyType,
      current_guideline: currentGuideline,
      extracted,
      changes,
      has_changes: changes.length > 0 || !currentGuideline,
      source_url: url
    })
    
  } catch (error) {
    console.error('AI extraction error:', error)
    return c.json({ error: `抽出中にエラーが発生しました: ${error.message}` }, 500)
  }
})

// AI抽出結果で公募要領を更新
routes.post('/subsidy-guidelines/:subsidyTypeId/ai-update', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.param('subsidyTypeId')
  const data = await c.req.json()
  
  try {
    // 既存のactiveな公募要領を取得
    const existing = await DB.prepare(`
      SELECT id FROM subsidy_guidelines 
      WHERE subsidy_type_id = ? AND status = 'active'
      AND fiscal_year = ? AND version = ?
    `).bind(subsidyTypeId, data.fiscal_year, data.version || null).first()
    
    if (existing) {
      // 既存レコードを更新
      await DB.prepare(`
        UPDATE subsidy_guidelines SET
          application_start_date = ?,
          application_end_date = ?,
          max_amount = ?,
          min_amount = ?,
          subsidy_rate = ?,
          eligibility_requirements = ?,
          target_expenses = ?,
          source_url = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        data.application_start_date || null,
        data.application_end_date || null,
        data.max_amount || null,
        data.min_amount || null,
        data.subsidy_rate || null,
        data.eligibility_requirements || null,
        data.target_expenses || null,
        data.source_url || null,
        existing.id
      ).run()
      
      return c.json({ success: true, action: 'updated', id: existing.id })
    } else {
      // 新規作成
      const result = await DB.prepare(`
        INSERT INTO subsidy_guidelines (
          subsidy_type_id, fiscal_year, version,
          application_start_date, application_end_date,
          max_amount, min_amount, subsidy_rate,
          eligibility_requirements, target_expenses,
          status, source_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).bind(
        subsidyTypeId,
        data.fiscal_year || null,
        data.version || null,
        data.application_start_date || null,
        data.application_end_date || null,
        data.max_amount || null,
        data.min_amount || null,
        data.subsidy_rate || null,
        data.eligibility_requirements || null,
        data.target_expenses || null,
        data.source_url || null
      ).run()
      
      return c.json({ success: true, action: 'created', id: result.meta.last_row_id })
    }
  } catch (error) {
    console.error('AI update error:', error)
    return c.json({ error: `更新に失敗しました: ${error.message}` }, 500)
  }
})

// 更新ログ一覧取得
routes.get('/subsidy-update-logs', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT l.*, s.name as subsidy_name, w.url, w.description as url_description
    FROM subsidy_update_logs l
    LEFT JOIN subsidy_types s ON l.subsidy_type_id = s.id
    LEFT JOIN subsidy_watch_urls w ON l.watch_url_id = w.id
    ORDER BY l.detected_at DESC
    LIMIT 100
  `).all()
  
  return c.json(result.results)
})

// 更新ログのステータス更新
routes.put('/subsidy-update-logs/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE subsidy_update_logs 
    SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, notes = ?
    WHERE id = ?
  `).bind(data.status, data.reviewed_by, data.notes || null, id).run()
  
  return c.json({ success: true })
})

// 通知一覧取得
routes.get('/admin/notifications', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json([])
  }
  
  const unreadOnly = c.req.query('unread_only') === 'true'
  
  // organization_idでテナント分離（自組織の通知のみ取得）
  let query = `SELECT * FROM admin_notifications WHERE organization_id = ?`
  if (unreadOnly) {
    query += ` AND is_read = 0`
  }
  query += ` ORDER BY created_at DESC LIMIT 50`
  
  const result = await DB.prepare(query).bind(orgId).all()
  let notifications = result.results || []
  
  // 支払い報告通知の場合、関連する請求書が既にpaid状態ならフィルタリング
  const paymentNotifications = notifications.filter((n: any) => 
    n.notification_type === 'payment_report' && n.related_table === 'invoices' && n.related_id
  )
  
  if (paymentNotifications.length > 0) {
    const invoiceIds = paymentNotifications.map((n: any) => n.related_id)
    try {
      // 既にpaid状態の請求書IDを取得
      const paidInvoices = await DB.prepare(`
        SELECT id FROM invoices WHERE id IN (${invoiceIds.join(',')}) AND status = 'paid'
      `).all()
      const paidIds = new Set((paidInvoices.results || []).map((inv: any) => inv.id))
      
      // paid状態の請求書に関連する通知を除外
      notifications = notifications.filter((n: any) => {
        if (n.notification_type === 'payment_report' && n.related_table === 'invoices' && n.related_id) {
          return !paidIds.has(n.related_id)
        }
        return true
      })
    } catch (e) {
      // エラーの場合はそのまま返す
    }
  }
  
  return c.json(notifications)
})

// 通知を既読にする
routes.put('/admin/notifications/:id/read', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE admin_notifications 
    SET is_read = 1, read_by = ?, read_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(data.read_by, id).run()
  
  return c.json({ success: true })
})

// 未読通知数取得
routes.get('/admin/notifications/unread-count', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ count: 0 })
  }
  
  // organization_idでテナント分離
  const result = await DB.prepare(`
    SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0 AND organization_id = ?
  `).bind(orgId).first()
  
  return c.json({ count: result?.count || 0 })
})

// 種類別未読通知数取得
routes.get('/admin/notifications/summary', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ new_message: 0, document_upload: 0, payment_report: 0, other: 0 })
  }
  
  // organization_idでテナント分離（自組織の未読通知のみ取得）
  const allNotifications = await DB.prepare(`
    SELECT id, notification_type, related_table, related_id
    FROM admin_notifications 
    WHERE is_read = 0 AND organization_id = ?
  `).bind(orgId).all()
  
  let notifications = allNotifications.results || []
  
  // 支払い報告通知で、既にpaid状態の請求書に関連するものを除外
  const paymentNotifications = notifications.filter((n: any) => 
    n.notification_type === 'payment_report' && n.related_table === 'invoices' && n.related_id
  )
  
  if (paymentNotifications.length > 0) {
    const invoiceIds = paymentNotifications.map((n: any) => n.related_id)
    try {
      const paidInvoices = await DB.prepare(`
        SELECT id FROM invoices WHERE id IN (${invoiceIds.join(',')}) AND status = 'paid'
      `).all()
      const paidIds = new Set((paidInvoices.results || []).map((inv: any) => inv.id))
      
      notifications = notifications.filter((n: any) => {
        if (n.notification_type === 'payment_report' && n.related_table === 'invoices' && n.related_id) {
          return !paidIds.has(n.related_id)
        }
        return true
      })
    } catch (e) {
      // エラーの場合はそのまま
    }
  }
  
  // 結果をオブジェクトに変換
  const summary: Record<string, number> = {
    new_message: 0,
    document_upload: 0,
    payment_report: 0,
    other: 0
  }
  
  for (const n of notifications as any[]) {
    if (n.notification_type === 'new_message') {
      summary.new_message++
    } else if (n.notification_type === 'document_upload') {
      summary.document_upload++
    } else if (n.notification_type === 'payment_report') {
      summary.payment_report++
    } else {
      summary.other++
    }
  }
  
  const total = Object.values(summary).reduce((a, b) => a + b, 0)
  
  return c.json({ ...summary, total })
})

// 通知を一括既読にする
routes.put('/admin/notifications/read-all', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  const { notification_type, read_by } = data
  
  if (notification_type) {
    await DB.prepare(`
      UPDATE admin_notifications 
      SET is_read = 1, read_by = ?, read_at = CURRENT_TIMESTAMP
      WHERE is_read = 0 AND notification_type = ?
    `).bind(read_by, notification_type).run()
  } else {
    await DB.prepare(`
      UPDATE admin_notifications 
      SET is_read = 1, read_by = ?, read_at = CURRENT_TIMESTAMP
      WHERE is_read = 0
    `).bind(read_by).run()
  }
  
  return c.json({ success: true })
})

// 公募要領詳細情報 CRUD
routes.get('/subsidy-guidelines', async (c) => {
  const { DB } = c.env
  
  // 申請期限が過ぎているものを自動的に終了ステータスに更新
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  await DB.prepare(`
    UPDATE subsidy_guidelines 
    SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'active' 
    AND application_end_date IS NOT NULL 
    AND application_end_date < ?
  `).bind(today).run()
  
  const result = await DB.prepare(`
    SELECT g.*, s.name as subsidy_name 
    FROM subsidy_guidelines g
    LEFT JOIN subsidy_types s ON g.subsidy_type_id = s.id
    ORDER BY g.subsidy_type_id, g.fiscal_year DESC
  `).all()
  
  return c.json(result.results)
})

routes.get('/subsidy-guidelines/:subsidyTypeId', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.param('subsidyTypeId')
  
  const result = await DB.prepare(`
    SELECT * FROM subsidy_guidelines 
    WHERE subsidy_type_id = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(subsidyTypeId).first()
  
  return c.json(result || null)
})

routes.post('/subsidy-guidelines', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO subsidy_guidelines (
      subsidy_type_id, fiscal_year, version,
      application_start_date, application_end_date,
      max_amount, min_amount, subsidy_rate,
      eligibility_requirements, target_expenses,
      document_sections, character_limits,
      status, source_url, pdf_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.subsidy_type_id,
    data.fiscal_year || null,
    data.version || null,
    data.application_start_date || null,
    data.application_end_date || null,
    data.max_amount || null,
    data.min_amount || null,
    data.subsidy_rate || null,
    data.eligibility_requirements ? JSON.stringify(data.eligibility_requirements) : null,
    data.target_expenses ? JSON.stringify(data.target_expenses) : null,
    data.document_sections ? JSON.stringify(data.document_sections) : null,
    data.character_limits ? JSON.stringify(data.character_limits) : null,
    data.status || 'active',
    data.source_url || null,
    data.pdf_url || null
  ).run()
  
  return c.json({ id: result.meta.last_row_id })
})

routes.put('/subsidy-guidelines/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE subsidy_guidelines SET
      fiscal_year = ?, version = ?,
      application_start_date = ?, application_end_date = ?,
      max_amount = ?, min_amount = ?, subsidy_rate = ?,
      eligibility_requirements = ?, target_expenses = ?,
      document_sections = ?, character_limits = ?,
      status = ?, source_url = ?, pdf_url = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.fiscal_year || null,
    data.version || null,
    data.application_start_date || null,
    data.application_end_date || null,
    data.max_amount || null,
    data.min_amount || null,
    data.subsidy_rate || null,
    data.eligibility_requirements ? JSON.stringify(data.eligibility_requirements) : null,
    data.target_expenses ? JSON.stringify(data.target_expenses) : null,
    data.document_sections ? JSON.stringify(data.document_sections) : null,
    data.character_limits ? JSON.stringify(data.character_limits) : null,
    data.status || 'active',
    data.source_url || null,
    data.pdf_url || null,
    id
  ).run()
  
  return c.json({ success: true })
})

// 公募要領削除API
routes.delete('/subsidy-guidelines/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare(`DELETE FROM subsidy_guidelines WHERE id = ?`).bind(id).run()
  
  return c.json({ success: true })
})

// 公募要領ステータス切り替えAPI
routes.patch('/subsidy-guidelines/:id/status', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { status } = await c.req.json()
  
  await DB.prepare(`
    UPDATE subsidy_guidelines SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(status, id).run()
  
  return c.json({ success: true })
})

export default routes
