// 請求書API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 請求書番号を生成
async function generateInvoiceNumber(DB: D1Database, organizationId: number): Promise<string> {
  const currentYear = new Date().getFullYear()
  
  // 組織の採番情報を取得または作成
  let seq = await DB.prepare(`
    SELECT * FROM invoice_sequences WHERE organization_id = ?
  `).bind(organizationId).first()
  
  if (!seq) {
    // 初回：採番レコードを作成
    await DB.prepare(`
      INSERT INTO invoice_sequences (organization_id, current_year, current_sequence, prefix)
      VALUES (?, ?, 1, 'INV')
    `).bind(organizationId, currentYear).run()
    return `INV-${currentYear}-0001`
  }
  
  let newSequence: number
  if ((seq as any).current_year !== currentYear) {
    // 年が変わったらリセット
    newSequence = 1
    await DB.prepare(`
      UPDATE invoice_sequences SET current_year = ?, current_sequence = 1, updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ?
    `).bind(currentYear, organizationId).run()
  } else {
    // 採番をインクリメント
    newSequence = ((seq as any).current_sequence || 0) + 1
    await DB.prepare(`
      UPDATE invoice_sequences SET current_sequence = ?, updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ?
    `).bind(newSequence, organizationId).run()
  }
  
  const prefix = (seq as any).prefix || 'INV'
  return `${prefix}-${currentYear}-${String(newSequence).padStart(4, '0')}`
}

// 振込待ちリスト取得（管理画面用）
routes.get('/invoices/pending-payments', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離（|| 1 フォールバック廃止）
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  try {
    // テーブルが存在するか確認
    const tableCheck = await DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'
    `).first()
    
    if (!tableCheck) {
      return c.json([])
    }
    
    // 発行済み(issued)または送付済み(sent)の請求書を取得（振込待ち状態）
    const invoices = await DB.prepare(`
      SELECT i.*, 
             c.name as client_name, 
             c.company_name,
             cs.case_number
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN cases cs ON i.case_id = cs.id
      WHERE i.status IN ('issued', 'sent')
        AND i.organization_id = ?
      ORDER BY 
        CASE WHEN i.due_date IS NULL THEN 1 ELSE 0 END,
        i.due_date ASC,
        i.created_at DESC
    `).bind(orgId).all()
    
    return c.json(invoices.results || [])
  } catch (error: any) {
    console.error('Error fetching pending payments:', error)
    if (error.message?.includes('no such table')) {
      return c.json([])
    }
    return c.json({ error: error.message || 'エラーが発生しました' }, 500)
  }
})

// 請求書一覧取得（案件別）
routes.get('/cases/:caseId/invoices', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('caseId')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  try {
    // まずテーブルが存在するか確認
    const tableCheck = await DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'
    `).first()
    
    if (!tableCheck) {
      // テーブルがなければ空配列を返す
      return c.json([])
    }
    
    // organization_idでテナント分離
    const invoices = await DB.prepare(`
      SELECT i.*, c.name as client_name, c.company_name as client_company
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.case_id = ? AND i.organization_id = ?
      ORDER BY i.created_at DESC
    `).bind(caseId, orgId).all()
    
    return c.json(invoices.results || [])
  } catch (error: any) {
    console.error('Error fetching invoices:', error)
    // テーブルがない場合も空配列を返す
    if (error.message?.includes('no such table')) {
      return c.json([])
    }
    return c.json({ error: error.message || 'エラーが発生しました' }, 500)
  }
})

// 請求書一覧取得（顧客ポータル用）
routes.get('/portal/invoices', async (c) => {
  const { DB } = c.env
  const clientId = c.req.query('client_id')
  const caseId = c.req.query('case_id')
  
  let query = `
    SELECT i.*, cs.case_number, st.name as subsidy_name
    FROM invoices i
    LEFT JOIN cases cs ON i.case_id = cs.id
    LEFT JOIN subsidy_types st ON cs.subsidy_type_id = st.id
    WHERE i.status != 'draft'
  `
  const params: any[] = []
  
  if (caseId) {
    query += ` AND i.case_id = ?`
    params.push(caseId)
  } else if (clientId) {
    query += ` AND i.client_id = ?`
    params.push(clientId)
  }
  
  query += ` ORDER BY i.issue_date DESC`
  
  const invoices = await DB.prepare(query).bind(...params).all()
  return c.json(invoices.results || [])
})

// 請求書詳細取得
routes.get('/invoices/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // organization_idでテナント分離
  const invoice = await DB.prepare(`
    SELECT i.*, 
           c.name as client_name, c.company_name as client_company, c.email as client_email,
           cs.case_number, st.name as subsidy_name,
           o.name as org_name, o.email as org_email, o.phone as org_phone, o.address as org_address,
           o.bank_name, o.bank_branch, o.bank_account_type, o.bank_account_number, o.bank_account_holder,
           o.representative_name as org_representative
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN cases cs ON i.case_id = cs.id
    LEFT JOIN subsidy_types st ON cs.subsidy_type_id = st.id
    LEFT JOIN organizations o ON i.organization_id = o.id
    WHERE i.id = ? AND i.organization_id = ?
  `).bind(id, orgId).first() as any
  
  if (!invoice) {
    return c.json({ error: '請求書が見つかりません' }, 404)
  }
  
  // site_settingsから銀行情報・会社情報・インボイス番号を取得して補完
  try {
    const settings = await DB.prepare(`
      SELECT setting_key, setting_value FROM site_settings 
      WHERE setting_key IN ('bank_name', 'bank_branch', 'bank_account_type', 'bank_account_number', 'bank_account_holder', 'company_name', 'company_address', 'company_phone', 'company_email', 'company_representative', 'invoice_registration_number')
    `).all()
    
    const settingsMap: Record<string, string> = {}
    for (const s of (settings.results || [])) {
      settingsMap[(s as any).setting_key] = (s as any).setting_value
    }
    
    // organizationsの値がない場合はsite_settingsから補完
    invoice.bank_name = invoice.bank_name || settingsMap.bank_name || null
    invoice.bank_branch = invoice.bank_branch || settingsMap.bank_branch || null
    invoice.bank_account_type = invoice.bank_account_type || settingsMap.bank_account_type || null
    invoice.bank_account_number = invoice.bank_account_number || settingsMap.bank_account_number || null
    invoice.bank_account_holder = invoice.bank_account_holder || settingsMap.bank_account_holder || null
    invoice.org_name = invoice.org_name || settingsMap.company_name || null
    invoice.org_address = invoice.org_address || settingsMap.company_address || null
    invoice.org_phone = invoice.org_phone || settingsMap.company_phone || null
    invoice.org_email = invoice.org_email || settingsMap.company_email || null
    invoice.org_representative = invoice.org_representative || settingsMap.company_representative || null
    invoice.invoice_registration_number = settingsMap.invoice_registration_number || null
  } catch (e) {
    // site_settingsがない場合は無視
    console.error('Error fetching site_settings:', e)
  }
  
  return c.json(invoice)
})

// 請求書作成
routes.post('/cases/:caseId/invoices', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('caseId')
  const data = await c.req.json()
  
  try {
    const user = await getCurrentUser(c)
    const orgId = getEffectiveOrgId(c, user)
    if (!orgId) {
      return c.json({ error: '組織が特定できません' }, 401)
    }
    
    // テーブルが存在しない場合は作成
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        case_id INTEGER NOT NULL,
        client_id INTEGER NOT NULL,
        invoice_number TEXT NOT NULL,
        invoice_type TEXT NOT NULL,
        subtotal INTEGER NOT NULL,
        tax_rate INTEGER DEFAULT 10,
        tax_amount INTEGER DEFAULT 0,
        withholding_tax INTEGER DEFAULT 0,
        total_amount INTEGER NOT NULL,
        issue_date DATE,
        due_date DATE,
        item_name TEXT NOT NULL,
        item_description TEXT,
        granted_amount INTEGER,
        fee_rate REAL,
        status TEXT NOT NULL DEFAULT 'draft',
        paid_at DATETIME,
        paid_amount INTEGER,
        payment_reported_at DATETIME,
        payment_confirmed_at DATETIME,
        payment_confirmed_by INTEGER,
        notes TEXT,
        internal_memo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    
    // 案件情報を取得
    const caseData = await DB.prepare(`
      SELECT cs.*, c.id as client_id, c.company_name, st.name as subsidy_name
      FROM cases cs
      LEFT JOIN clients c ON cs.client_id = c.id
      LEFT JOIN subsidy_types st ON cs.subsidy_type_id = st.id
      WHERE cs.id = ?
    `).bind(caseId).first()
    
    if (!caseData) {
      return c.json({ error: '案件が見つかりません' }, 404)
    }
    
    // 請求書番号を生成（シンプルなタイムスタンプベース）
    const now = new Date()
    const year = now.getFullYear()
    const seq = now.getTime().toString().slice(-6)
    const invoiceNumber = `INV-${year}-${seq}`
    
    // 金額計算
    const subtotal = data.subtotal || 0
    const taxRate = data.tax_rate ?? 10
    const taxAmount = Math.floor(subtotal * taxRate / 100)
    const withholdingTax = data.withholding_tax || 0
    const totalAmount = subtotal + taxAmount - withholdingTax
    
    // デフォルトの支払期限（発行日から14日後）
    const issueDate = data.issue_date || new Date().toISOString().split('T')[0]
    const dueDate = data.due_date || (() => {
      const d = new Date(issueDate)
      d.setDate(d.getDate() + 14)
      return d.toISOString().split('T')[0]
    })()
    
    // 品目名の自動生成
    let itemName = data.item_name
    if (!itemName) {
      const subsidyName = (caseData as any).subsidy_name || '補助金・助成金'
      itemName = data.invoice_type === 'deposit' 
        ? `${subsidyName}申請 着手金`
        : `${subsidyName}申請 成功報酬`
    }
    
    const result = await DB.prepare(`
      INSERT INTO invoices (
        organization_id, case_id, client_id, invoice_number, invoice_type,
        subtotal, tax_rate, tax_amount, withholding_tax, total_amount,
        issue_date, due_date, item_name, item_description, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orgId,
      caseId,
      (caseData as any).client_id,
      invoiceNumber,
      data.invoice_type || 'deposit',
      subtotal,
      taxRate,
      taxAmount,
      withholdingTax,
      totalAmount,
      issueDate,
      dueDate,
      itemName,
      data.item_description || null,
      data.status || 'draft',
      data.notes || null
    ).run()
    
    return c.json({
      success: true,
      id: result.meta?.last_row_id,
      invoice_number: invoiceNumber,
      message: '請求書を作成しました'
    })
  } catch (error: any) {
    console.error('Error creating invoice:', error)
    return c.json({ error: error.message || '請求書の作成に失敗しました' }, 500)
  }
})

// 請求書更新
routes.put('/invoices/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // organization_idでテナント分離 - 存在確認
  const existing = await DB.prepare(`SELECT id FROM invoices WHERE id = ? AND organization_id = ?`).bind(id, orgId).first()
  if (!existing) {
    return c.json({ error: '請求書が見つかりません' }, 404)
  }
  
  // 金額再計算
  const subtotal = data.subtotal || 0
  const taxRate = data.tax_rate ?? 10
  const taxAmount = data.tax_included ? 0 : Math.floor(subtotal * taxRate / 100)
  const withholdingTax = data.withholding_tax || 0
  const totalAmount = subtotal + taxAmount - withholdingTax
  
  await DB.prepare(`
    UPDATE invoices SET
      subtotal = ?,
      tax_rate = ?,
      tax_amount = ?,
      withholding_tax = ?,
      total_amount = ?,
      issue_date = COALESCE(?, issue_date),
      due_date = COALESCE(?, due_date),
      item_name = COALESCE(?, item_name),
      item_description = ?,
      notes = ?,
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).bind(
    subtotal,
    taxRate,
    taxAmount,
    withholdingTax,
    totalAmount,
    data.issue_date || null,
    data.due_date || null,
    data.item_name || null,
    data.item_description || null,
    data.notes || null,
    data.status || null,
    id,
    orgId
  ).run()
  
  return c.json({ success: true, message: '請求書を更新しました' })
})

// 請求書ステータス更新（管理画面から）
routes.put('/invoices/:id/status', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { status } = await c.req.json()
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  if (!['draft', 'issued', 'sent', 'payment_reported', 'paid', 'cancelled'].includes(status)) {
    return c.json({ error: '無効なステータスです' }, 400)
  }
  
  const paidAt = status === 'paid' ? new Date().toISOString() : null
  
  // organization_idでテナント分離
  await DB.prepare(`
    UPDATE invoices SET 
      status = ?, 
      paid_at = COALESCE(?, paid_at),
      updated_at = CURRENT_TIMESTAMP 
    WHERE id = ? AND organization_id = ?
  `).bind(status, paidAt, id, orgId).run()
  
  // 入金確認時は関連する案件のdeposit_paidも更新
  if (status === 'paid') {
    const invoice = await DB.prepare(`SELECT case_id, invoice_type FROM invoices WHERE id = ?`).bind(id).first() as any
    if (invoice && invoice.case_id && invoice.invoice_type === 'deposit') {
      await DB.prepare(`
        UPDATE cases SET 
          deposit_paid = 1, 
          deposit_paid_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(invoice.case_id).run()
    }
  }
  
  return c.json({ success: true, message: 'ステータスを更新しました' })
})

// 請求書の振込報告（顧客ポータルから）
routes.put('/invoices/:id/report-transfer', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    const data = await c.req.json()
    
    // 請求書情報を取得
    const invoice = await DB.prepare(`
      SELECT id, case_id, client_id, invoice_type, total_amount, status, organization_id
      FROM invoices WHERE id = ?
    `).bind(id).first() as any
    
    if (!invoice) {
      return c.json({ error: '請求書が見つかりません' }, 404)
    }
    
    // 既に入金済みの場合はエラー
    if (invoice.status === 'paid') {
      return c.json({ error: 'この請求書は既に入金確認済みです' }, 400)
    }
    
    // ステータスを振込報告済みに更新
    await DB.prepare(`
      UPDATE invoices SET 
        status = 'payment_reported', 
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(id).run()
    
    // 案件の振込報告フラグも更新
    if (invoice.case_id) {
      if (invoice.invoice_type === 'success_fee') {
        await DB.prepare(`
          UPDATE cases SET 
            success_fee_transfer_reported = 1, 
            success_fee_transfer_reported_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(invoice.case_id).run()
      } else {
        await DB.prepare(`
          UPDATE cases SET 
            deposit_transfer_reported = 1, 
            deposit_transfer_reported_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(invoice.case_id).run()
      }
    }
    
    // 支払い履歴を作成
    if (invoice.client_id) {
      await DB.prepare(`
        INSERT INTO payment_history (client_id, payment_type, amount, payment_method, status, bank_transfer_reported_at, notes)
        VALUES (?, ?, ?, 'bank_transfer', 'reported', CURRENT_TIMESTAMP, ?)
      `).bind(
        invoice.client_id, 
        invoice.invoice_type || 'other', 
        invoice.total_amount,
        data.notes || '請求書からの振込報告'
      ).run()
    }
    
    // 管理者に通知を作成
    const client = invoice.client_id 
      ? await DB.prepare(`SELECT name, company_name FROM clients WHERE id = ?`).bind(invoice.client_id).first() as any
      : null
    const clientName = client?.company_name || client?.name || '顧客'
    const typeLabel = invoice.invoice_type === 'success_fee' ? '成功報酬' : 
                      invoice.invoice_type === 'deposit' ? '着手金' : '請求'
    
    await DB.prepare(`
      INSERT INTO admin_notifications (notification_type, title, message, related_id, related_table, organization_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      'payment_report',
      `${typeLabel}の振込報告がありました`,
      `${clientName}様から${typeLabel}の振込報告がありました（¥${invoice.total_amount.toLocaleString()}）。確認をお願いします。`,
      id,
      'invoices',
      invoice.organization_id
    ).run()
    
    return c.json({ success: true, message: '振込完了報告を送信しました' })
  } catch (error: any) {
    console.error('Invoice report transfer error:', error)
    return c.json({ error: '振込報告の処理中にエラーが発生しました', details: error.message }, 500)
  }
})

// 請求書発行（ステータスをissuedに変更）
routes.post('/invoices/:id/issue', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // organization_idでテナント分離
  await DB.prepare(`
    UPDATE invoices SET status = 'issued', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?
  `).bind(id, orgId).run()
  
  return c.json({ success: true, message: '請求書を発行しました' })
})

// 振込報告（顧客ポータルから）
routes.post('/invoices/:id/report-payment', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare(`
    UPDATE invoices SET 
      status = 'payment_reported',
      payment_reported_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(id).run()
  
  // 通知を作成
  const invoice = await DB.prepare(`SELECT * FROM invoices WHERE id = ?`).bind(id).first()
  if (invoice) {
    await DB.prepare(`
      INSERT INTO admin_notifications (notification_type, title, message, related_id, related_table)
      VALUES ('payment_report', '振込報告', ?, ?, 'invoices')
    `).bind(
      `請求書 ${(invoice as any).invoice_number} の振込報告がありました`,
      id
    ).run()
  }
  
  return c.json({ success: true, message: '振込報告を送信しました' })
})

// 入金確認（管理者から）
routes.post('/invoices/:id/confirm-payment', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  const data = await c.req.json()
  
  // 請求書情報を取得
  const invoice = await DB.prepare(`SELECT case_id, invoice_type FROM invoices WHERE id = ?`).bind(id).first() as any
  
  await DB.prepare(`
    UPDATE invoices SET 
      status = 'paid',
      paid_at = CURRENT_TIMESTAMP,
      paid_amount = COALESCE(?, total_amount),
      payment_confirmed_at = CURRENT_TIMESTAMP,
      payment_confirmed_by = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.paid_amount || null,
    user?.id || null,
    id
  ).run()
  
  // 手付金請求書の場合、案件のdeposit_paidも更新
  if (invoice && invoice.case_id && invoice.invoice_type === 'deposit') {
    await DB.prepare(`
      UPDATE cases SET 
        deposit_paid = 1, 
        deposit_paid_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(invoice.case_id).run()
  }
  
  return c.json({ success: true, message: '入金を確認しました' })
})

// 請求書削除
routes.delete('/invoices/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // 発行済みの請求書は削除不可（キャンセルのみ）+ organization_idチェック
  const invoice = await DB.prepare(`SELECT status FROM invoices WHERE id = ? AND organization_id = ?`).bind(id, orgId).first()
  if (!invoice) {
    return c.json({ error: '請求書が見つかりません' }, 404)
  }
  if ((invoice as any).status !== 'draft') {
    return c.json({ error: '発行済みの請求書は削除できません。キャンセルしてください。' }, 400)
  }
  
  await DB.prepare(`DELETE FROM invoices WHERE id = ? AND organization_id = ?`).bind(id, orgId).run()
  return c.json({ success: true, message: '請求書を削除しました' })
})

// 請求書キャンセル
routes.post('/invoices/:id/cancel', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // organization_idでテナント分離
  await DB.prepare(`
    UPDATE invoices SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?
  `).bind(id, orgId).run()
  
  return c.json({ success: true, message: '請求書をキャンセルしました' })
})

// 請求書PDF生成（HTML形式で返す - ブラウザで印刷してPDF化）
routes.get('/invoices/:id/pdf', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const invoice = await DB.prepare(`
    SELECT i.*, 
           c.name as client_name, c.company_name as client_company,
           cs.case_number, st.name as subsidy_name,
           o.name as org_name, o.email as org_email, o.phone as org_phone, o.address as org_address,
           o.bank_name, o.bank_branch, o.bank_account_type, o.bank_account_number, o.bank_account_holder,
           o.representative_name as org_representative
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN cases cs ON i.case_id = cs.id
    LEFT JOIN subsidy_types st ON cs.subsidy_type_id = st.id
    LEFT JOIN organizations o ON i.organization_id = o.id
    WHERE i.id = ?
  `).bind(id).first()
  
  if (!invoice) {
    return c.json({ error: '請求書が見つかりません' }, 404)
  }
  
  const inv = invoice as any
  
  // site_settingsから銀行情報・会社情報・インボイス番号を補完
  try {
    const settings = await DB.prepare(`
      SELECT setting_key, setting_value FROM site_settings 
      WHERE setting_key IN ('bank_name', 'bank_branch', 'bank_account_type', 'bank_account_number', 'bank_account_holder', 'company_name', 'company_address', 'company_phone', 'company_email', 'company_representative', 'invoice_registration_number')
    `).all()
    
    const settingsMap: Record<string, string> = {}
    for (const s of (settings.results || [])) {
      settingsMap[(s as any).setting_key] = (s as any).setting_value
    }
    
    inv.bank_name = inv.bank_name || settingsMap.bank_name || null
    inv.bank_branch = inv.bank_branch || settingsMap.bank_branch || null
    inv.bank_account_type = inv.bank_account_type || settingsMap.bank_account_type || null
    inv.bank_account_number = inv.bank_account_number || settingsMap.bank_account_number || null
    inv.bank_account_holder = inv.bank_account_holder || settingsMap.bank_account_holder || null
    inv.org_name = inv.org_name || settingsMap.company_name || null
    inv.org_address = inv.org_address || settingsMap.company_address || null
    inv.org_phone = inv.org_phone || settingsMap.company_phone || null
    inv.org_email = inv.org_email || settingsMap.company_email || null
    inv.org_representative = inv.org_representative || settingsMap.company_representative || null
    inv.invoice_registration_number = settingsMap.invoice_registration_number || null
  } catch (e) {
    console.error('Error fetching site_settings for PDF:', e)
  }
  
  const invoiceTypeLabel = inv.invoice_type === 'deposit' ? '着手金' : '成功報酬'
  
  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }
  
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>請求書 ${inv.invoice_number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #333;
            background: #fff;
        }
        .invoice-container {
            max-width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 10mm 12mm;
            background: white;
        }
        @media print {
            @page {
                size: A4;
                margin: 8mm;
            }
            body { background: white; }
            .invoice-container { 
                padding: 0;
                min-height: auto;
            }
            .no-print { display: none !important; }
        }
        .header { text-align: center; margin-bottom: 15px; }
        .header h1 { 
            font-size: 24px; 
            font-weight: bold;
            letter-spacing: 6px;
            border-bottom: 2px double #333;
            padding-bottom: 8px;
            display: inline-block;
        }
        .invoice-number { 
            text-align: right; 
            margin: 12px 0;
            font-size: 10px;
        }
        .parties { display: flex; justify-content: space-between; margin-bottom: 15px; }
        .client { flex: 1; }
        .client-name { 
            font-size: 16px; 
            font-weight: bold;
            border-bottom: 1px solid #333;
            padding-bottom: 4px;
            margin-bottom: 4px;
        }
        .client-name::after { content: " 御中"; font-size: 12px; }
        .issuer { 
            text-align: right; 
            font-size: 10px;
            line-height: 1.6;
        }
        .issuer-name { font-size: 12px; font-weight: bold; margin-bottom: 3px; }
        .total-box {
            background: #f5f5f5;
            border: 2px solid #333;
            padding: 10px 15px;
            margin: 12px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .total-label { font-size: 12px; font-weight: bold; }
        .total-amount { font-size: 20px; font-weight: bold; }
        .total-amount::before { content: "¥"; }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
        }
        .details-table th, .details-table td {
            border: 1px solid #ddd;
            padding: 6px 8px;
            text-align: left;
            font-size: 10px;
        }
        .details-table th {
            background: #f0f0f0;
            font-weight: bold;
        }
        .details-table .amount { text-align: right; }
        .bank-info {
            background: #f9f9f9;
            border: 1px solid #ddd;
            padding: 10px;
            margin: 12px 0;
        }
        .bank-info h3 { 
            font-size: 11px; 
            margin-bottom: 6px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 4px;
        }
        .bank-info table { width: 100%; font-size: 10px; }
        .bank-info td { padding: 2px 8px; }
        .bank-info td:first-child { width: 70px; color: #666; }
        .notes { margin-top: 12px; font-size: 10px; color: #666; }
        .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        .print-btn:hover { background: #1d4ed8; }
        .invoice-reg-box {
            margin: 12px 0;
            padding: 10px;
            background: #f0f9ff;
            border: 1px solid #0284c7;
            border-radius: 4px;
        }
        .due-date-box {
            margin: 12px 0;
            padding: 8px 10px;
            background: #fff3cd;
            border-radius: 4px;
            font-size: 11px;
        }
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">
        🖨️ 印刷 / PDF保存
    </button>
    
    <div class="invoice-container">
        <div class="header">
            <h1>請 求 書</h1>
        </div>
        
        <div class="invoice-number">
            <div>請求書番号: ${inv.invoice_number}</div>
            <div>発行日: ${formatDate(inv.issue_date)}</div>
        </div>
        
        <div class="parties">
            <div class="client">
                <div class="client-name">${inv.client_company || inv.client_name || '（顧客名）'}</div>
            </div>
            <div class="issuer">
                <div class="issuer-name">${inv.org_name || '（発行元）'}</div>
                ${inv.org_address ? `<div>${inv.org_address}</div>` : ''}
                ${inv.org_phone ? `<div>TEL: ${inv.org_phone}</div>` : ''}
                ${inv.org_email ? `<div>Email: ${inv.org_email}</div>` : ''}
                ${inv.org_representative ? `<div>代表: ${inv.org_representative}</div>` : ''}
            </div>
        </div>
        
        <div class="total-box">
            <div class="total-label">ご請求金額</div>
            <div class="total-amount">${inv.total_amount?.toLocaleString() || 0}</div>
        </div>
        
        <table class="details-table">
            <thead>
                <tr>
                    <th style="width: 50%">品目</th>
                    <th style="width: 15%" class="amount">数量</th>
                    <th style="width: 15%" class="amount">単価</th>
                    <th style="width: 20%" class="amount">金額</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <strong>${inv.item_name || invoiceTypeLabel}</strong>
                        ${inv.item_description ? `<br><small style="color: #666">${inv.item_description}</small>` : ''}
                        ${inv.case_number ? `<br><small style="color: #666">案件番号: ${inv.case_number}</small>` : ''}
                    </td>
                    <td class="amount">1</td>
                    <td class="amount">¥${inv.subtotal?.toLocaleString() || 0}</td>
                    <td class="amount">¥${inv.subtotal?.toLocaleString() || 0}</td>
                </tr>
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" class="amount">小計</td>
                    <td class="amount">¥${inv.subtotal?.toLocaleString() || 0}</td>
                </tr>
                ${inv.tax_amount > 0 ? `
                <tr>
                    <td colspan="3" class="amount">消費税 (${inv.tax_rate || 10}%)</td>
                    <td class="amount">¥${inv.tax_amount?.toLocaleString() || 0}</td>
                </tr>
                ` : ''}
                ${inv.withholding_tax > 0 ? `
                <tr>
                    <td colspan="3" class="amount">源泉徴収税</td>
                    <td class="amount">-¥${inv.withholding_tax?.toLocaleString() || 0}</td>
                </tr>
                ` : ''}
                <tr style="background: #f5f5f5; font-weight: bold;">
                    <td colspan="3" class="amount">合計</td>
                    <td class="amount">¥${inv.total_amount?.toLocaleString() || 0}</td>
                </tr>
            </tfoot>
        </table>
        
        <div class="bank-info">
            <h3>🏦 お振込先</h3>
            <table>
                <tr>
                    <td>銀行名</td>
                    <td><strong>${inv.bank_name || '（未設定）'}</strong></td>
                </tr>
                <tr>
                    <td>支店名</td>
                    <td><strong>${inv.bank_branch || '（未設定）'}</strong></td>
                </tr>
                <tr>
                    <td>口座種別</td>
                    <td>${inv.bank_account_type || '普通'}</td>
                </tr>
                <tr>
                    <td>口座番号</td>
                    <td><strong>${inv.bank_account_number || '（未設定）'}</strong></td>
                </tr>
                <tr>
                    <td>口座名義</td>
                    <td><strong>${inv.bank_account_holder || '（未設定）'}</strong></td>
                </tr>
            </table>
        </div>
        
        ${inv.invoice_registration_number ? `
        <div class="invoice-reg-box">
            <div style="font-size: 10px; color: #0369a1; margin-bottom: 3px;">
                📋 適格請求書発行事業者登録番号
            </div>
            <div style="font-size: 12px; font-weight: bold; font-family: monospace; color: #0c4a6e;">
                ${inv.invoice_registration_number}
            </div>
        </div>
        ` : ''}
        
        <div class="due-date-box">
            <strong>📅 お支払期限: ${formatDate(inv.due_date)}</strong>
        </div>
        
        ${inv.notes ? `
        <div class="notes">
            <strong>備考:</strong><br>
            ${inv.notes.replace(/\n/g, '<br>')}
        </div>
        ` : ''}
    </div>
</body>
</html>
  `
  
  return c.html(html)
})

export default routes
