// API: 支払い管理
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 顧客の支払い履歴取得
routes.get('/clients/:clientId/payments', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // organization_idでテナント分離（clientが自組織のものか確認）
  const client = await DB.prepare(`SELECT id FROM clients WHERE id = ? AND organization_id = ?`).bind(clientId, orgId).first()
  if (!client) {
    return c.json([])
  }
  
  const payments = await DB.prepare(`
    SELECT ph.*, au.name as confirmed_by_name
    FROM payment_history ph
    LEFT JOIN admin_users au ON ph.confirmed_by = au.id
    WHERE ph.client_id = ?
    ORDER BY ph.created_at DESC
  `).bind(clientId).all()
  
  return c.json(payments.results || [])
})

// 振込完了報告（顧客用）
routes.post('/clients/:clientId/report-transfer', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  try {
    const data = await c.req.json()
    const caseId = data.case_id
    const paymentType = data.payment_type || 'deposit' // 'deposit' or 'success_fee'
    
    // 重複報告チェック: 同じクライアント・同じタイプで未確認の報告が既にないか確認
    const existingReport = await DB.prepare(`
      SELECT id FROM payment_history 
      WHERE client_id = ? AND payment_type = ? AND status = 'reported'
      ORDER BY created_at DESC LIMIT 1
    `).bind(clientId, paymentType).first()
    
    if (existingReport) {
      const typeLabel = paymentType === 'success_fee' ? '成功報酬' : '着手金'
      return c.json({ 
        error: `既に${typeLabel}の振込報告が送信されています。確認をお待ちください。` 
      }, 400)
    }
    
    // 金額を取得（案件から優先、なければクライアントから）
    let amount = data.amount || 0
    if (!amount && caseId) {
      const caseData = await DB.prepare(`
        SELECT deposit_amount, success_fee_amount, success_fee_rate, approved_amount FROM cases WHERE id = ?
      `).bind(caseId).first() as any
      if (paymentType === 'success_fee') {
        // 成功報酬の金額を計算
        if (caseData?.success_fee_amount > 0) {
          amount = caseData.success_fee_amount
        } else if (caseData?.success_fee_rate > 0 && caseData?.approved_amount > 0) {
          amount = Math.floor(caseData.approved_amount * caseData.success_fee_rate / 100)
        }
      } else {
        amount = caseData?.deposit_amount || 0
      }
    }
    if (!amount && paymentType === 'deposit') {
      const client = await DB.prepare(`
        SELECT deposit_amount FROM clients WHERE id = ?
      `).bind(clientId).first() as any
      amount = client?.deposit_amount || 0
    }
    
    // 支払い履歴を作成
    await DB.prepare(`
      INSERT INTO payment_history (client_id, payment_type, amount, payment_method, status, bank_transfer_reported_at, notes)
      VALUES (?, ?, ?, 'bank_transfer', 'reported', CURRENT_TIMESTAMP, ?)
    `).bind(clientId, paymentType, amount, data.notes || '').run()
    
    // 支払いタイプに応じてフラグを更新
    if (paymentType === 'success_fee') {
      // 成功報酬の振込報告
      if (caseId) {
        await DB.prepare(`
          UPDATE cases 
          SET success_fee_transfer_reported = 1, 
              success_fee_transfer_reported_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(caseId).run()
      }
    } else {
      // 着手金の振込報告
      await DB.prepare(`
        UPDATE clients 
        SET deposit_transfer_reported = 1, 
            deposit_transfer_reported_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(clientId).run()
      
      if (caseId) {
        await DB.prepare(`
          UPDATE cases 
          SET deposit_transfer_reported = 1, 
              deposit_transfer_reported_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(caseId).run()
      } else {
        await DB.prepare(`
          UPDATE cases 
          SET deposit_transfer_reported = 1, 
              deposit_transfer_reported_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE client_id = ?
        `).bind(clientId).run()
      }
    }
    
    // 管理者に入金報告の通知を作成
    const client = await DB.prepare(`SELECT name, company_name, organization_id FROM clients WHERE id = ?`).bind(clientId).first() as any
    const clientName = client?.company_name || client?.name || '顧客'
    const clientOrgId = client?.organization_id
    const amountFormatted = amount ? `${amount.toLocaleString()}円` : ''
    const typeLabel = paymentType === 'success_fee' ? '成功報酬' : '着手金'
    await DB.prepare(`
      INSERT INTO admin_notifications (notification_type, title, message, related_id, related_table, organization_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      'payment_report',
      `${typeLabel}の入金報告がありました`,
      `${clientName}様から${typeLabel}の入金報告がありました${amountFormatted ? `（${amountFormatted}）` : ''}。確認をお願いします。`,
      clientId,
      'clients',
      clientOrgId
    ).run()
    
    return c.json({ success: true, message: '振込完了報告を送信しました。確認まで少々お待ちください。' })
  } catch (error: any) {
    console.error('Report transfer error:', error)
    return c.json({ error: '振込報告の処理中にエラーが発生しました', details: error.message }, 500)
  }
})

// 支払い確認（管理者用）
routes.put('/payments/:paymentId/confirm', async (c) => {
  const { DB } = c.env
  const paymentId = c.req.param('paymentId')
  const user = await getCurrentUser(c)
  const { source } = await c.req.json().catch(() => ({ source: 'payment_history' }))
  
  if (!user) {
    return c.json({ error: '認証が必要です' }, 401)
  }
  
  // 請求書からの支払いの場合
  if (source === 'invoices') {
    try {
      // 請求書情報を取得
      const invoice = await DB.prepare(`SELECT case_id, invoice_type FROM invoices WHERE id = ?`).bind(paymentId).first() as any
      
      await DB.prepare(`
        UPDATE invoices 
        SET status = 'paid', 
            paid_at = CURRENT_TIMESTAMP,
            payment_confirmed_at = CURRENT_TIMESTAMP,
            payment_confirmed_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(user.id, paymentId).run()
      
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
      
      return c.json({ success: true, message: '請求書の入金を確認しました' })
    } catch (error: any) {
      return c.json({ error: error.message || '入金確認に失敗しました' }, 500)
    }
  }
  
  // 旧payment_historyからの支払いの場合
  const payment = await DB.prepare(`
    SELECT * FROM payment_history WHERE id = ?
  `).bind(paymentId).first() as any
  
  if (!payment) {
    return c.json({ error: '支払い情報が見つかりません' }, 404)
  }
  
  // 支払いを確認済みに更新
  await DB.prepare(`
    UPDATE payment_history 
    SET status = 'confirmed', 
        bank_transfer_confirmed_at = CURRENT_TIMESTAMP,
        confirmed_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(user.id, paymentId).run()
  
  // クライアントの支払いステータスを更新
  if (payment.payment_type === 'deposit') {
    await DB.prepare(`
      UPDATE clients 
      SET deposit_paid = 1, 
          deposit_paid_at = CURRENT_TIMESTAMP,
          deposit_payment_method = 'bank_transfer',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(payment.client_id).run()
    
    // 案件テーブルの支払いステータスも更新
    await DB.prepare(`
      UPDATE cases 
      SET deposit_paid = 1, 
          deposit_paid_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE client_id = ? AND deposit_required = 1 AND deposit_paid = 0
    `).bind(payment.client_id).run()
  }
  
  return c.json({ success: true, message: '支払いを確認しました' })
})

// 支払い待ち一覧（管理者用）
routes.get('/payments/pending', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  try {
    // 旧payment_historyからの未確認報告 - organization_idでテナント分離
    const oldPayments = await DB.prepare(`
      SELECT ph.*, c.name as client_name, c.company_name, 'payment_history' as source
      FROM payment_history ph
      JOIN clients c ON ph.client_id = c.id
      WHERE ph.status = 'reported' AND c.organization_id = ?
      ORDER BY ph.bank_transfer_reported_at ASC
    `).bind(orgId).all()
    
    // 新invoicesからの振込報告（payment_reported状態）- organization_idでテナント分離
    let invoicePayments: any[] = []
    try {
      const invoices = await DB.prepare(`
        SELECT 
          i.id,
          i.invoice_number,
          i.invoice_type as payment_type,
          i.total_amount as amount,
          i.payment_reported_at as bank_transfer_reported_at,
          i.item_name,
          i.case_id,
          c.name as client_name,
          c.company_name,
          cs.case_number,
          'invoices' as source
        FROM invoices i
        JOIN clients c ON i.client_id = c.id
        LEFT JOIN cases cs ON i.case_id = cs.id
        WHERE i.status = 'payment_reported' AND i.organization_id = ?
        ORDER BY i.payment_reported_at ASC
      `).bind(orgId).all()
      invoicePayments = invoices.results || []
    } catch (e) {
      // invoicesテーブルがない場合は空配列
    }
    
    // 両方のデータを結合してソート
    const allPayments = [
      ...(oldPayments.results || []),
      ...invoicePayments
    ].sort((a: any, b: any) => {
      const dateA = new Date(a.bank_transfer_reported_at || 0).getTime()
      const dateB = new Date(b.bank_transfer_reported_at || 0).getTime()
      return dateA - dateB
    })
    
    return c.json(allPayments)
  } catch (error: any) {
    console.error('Error fetching pending payments:', error)
    return c.json([])
  }
})

// 支払い履歴一覧（管理者用）
routes.get('/payments/history', async (c) => {
  const { DB } = c.env
  const type = c.req.query('type') || 'all'
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  try {
    // 旧payment_historyからの確認済み支払い - organization_idでテナント分離（パラメータバインド使用）
    let oldQuery = `
      SELECT 
        ph.id,
        ph.amount,
        ph.payment_type,
        ph.bank_transfer_confirmed_at as confirmed_at,
        c.name as client_name,
        c.company_name,
        cs.case_number,
        st.name as subsidy_type_name,
        'payment_history' as source,
        NULL as invoice_number,
        NULL as item_name
      FROM payment_history ph
      JOIN clients c ON ph.client_id = c.id
      LEFT JOIN cases cs ON cs.client_id = ph.client_id
      LEFT JOIN subsidy_types st ON cs.subsidy_type_id = st.id
      WHERE ph.status = 'confirmed' AND c.organization_id = ?
    `
    
    if (type === 'deposit') {
      oldQuery += ` AND ph.payment_type = 'deposit'`
    } else if (type === 'success_fee') {
      oldQuery += ` AND ph.payment_type = 'success_fee'`
    }
    
    oldQuery += ` GROUP BY ph.id`
    
    const oldPayments = await DB.prepare(oldQuery).bind(orgId).all()
    
    // invoicesテーブルからの確認済み支払い（status = 'paid'） - organization_idでテナント分離（パラメータバインド使用）
    let invoicePayments: any[] = []
    try {
      let invoiceQuery = `
        SELECT 
          i.id,
          i.total_amount as amount,
          i.invoice_type as payment_type,
          i.paid_at as confirmed_at,
          c.name as client_name,
          c.company_name,
          cs.case_number,
          st.name as subsidy_type_name,
          'invoices' as source,
          i.invoice_number,
          i.item_name
        FROM invoices i
        JOIN clients c ON i.client_id = c.id
        LEFT JOIN cases cs ON i.case_id = cs.id
        LEFT JOIN subsidy_types st ON cs.subsidy_type_id = st.id
        WHERE i.status = 'paid' AND i.organization_id = ?
      `
      
      if (type === 'deposit') {
        invoiceQuery += ` AND i.invoice_type = 'deposit'`
      } else if (type === 'success_fee') {
        invoiceQuery += ` AND i.invoice_type = 'success_fee'`
      }
      
      const invoices = await DB.prepare(invoiceQuery).bind(orgId).all()
      invoicePayments = invoices.results || []
    } catch (e) {
      // invoicesテーブルがない場合は空配列
    }
    
    // 両方のデータを結合して日付でソート
    const allPayments = [
      ...(oldPayments.results || []),
      ...invoicePayments
    ].sort((a: any, b: any) => {
      const dateA = new Date(a.confirmed_at || 0).getTime()
      const dateB = new Date(b.confirmed_at || 0).getTime()
      return dateB - dateA // 新しい順
    }).slice(0, 100)
    
    return c.json(allPayments)
  } catch (error: any) {
    console.error('Payment history error:', error)
    return c.json({ error: error.message || 'Failed to load payment history' }, 500)
  }
})

export default routes
