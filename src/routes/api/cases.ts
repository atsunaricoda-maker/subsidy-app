// API: 案件管理（Cases）
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 案件一覧取得（顧客IDで絞り込み可能）
routes.get('/cases', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const clientId = c.req.query('client_id')
  const showArchived = c.req.query('archived') === 'true'
  const statusFilter = c.req.query('status') // 'inquiry', 'preparing', 'applying', 'adopted', 'rejected'
  const resultFilter = c.req.query('result') // 'approved', 'rejected', 'pending'
  
  // デバッグ: テナント情報をログ出力
  const tenantOrgId = c.get('tenantOrgId')
  const tenantSlug = c.get('tenantSlug')
  console.log('[DEBUG /api/cases] tenantOrgId:', tenantOrgId, 'tenantSlug:', tenantSlug, 'user:', user?.id, 'user.org_id:', user?.organization_id)
  
  // organization_idでテナント分離（|| 1 フォールバック廃止）
  const orgId = getEffectiveOrgId(c, user)
  console.log('[DEBUG /api/cases] effectiveOrgId:', orgId)
  
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  let query = `
    SELECT 
      cases.*,
      clients.name as client_name,
      clients.company_name,
      clients.email,
      clients.phone,
      subsidy_types.name as subsidy_type_name,
      admin_users.name as assigned_to_name
    FROM cases
    LEFT JOIN clients ON cases.client_id = clients.id
    LEFT JOIN subsidy_types ON cases.subsidy_type_id = subsidy_types.id
    LEFT JOIN admin_users ON cases.assigned_to = admin_users.username
    WHERE cases.organization_id = ?
  `
  
  // アーカイブフィルタ
  if (showArchived) {
    query += ` AND cases.is_archived = 1`
  } else {
    query += ` AND (cases.is_archived = 0 OR cases.is_archived IS NULL)`
  }
  
  // ステータスフィルタ
  if (statusFilter) {
    query += ` AND cases.status = '${statusFilter}'`
  }
  
  // 結果フィルタ
  if (resultFilter === 'approved') {
    query += ` AND cases.result = 'approved'`
  } else if (resultFilter === 'rejected') {
    query += ` AND cases.result = 'rejected'`
  } else if (resultFilter === 'pending') {
    query += ` AND (cases.result IS NULL AND cases.status = 'completed')`
  }
  
  if (clientId) {
    query += ` AND cases.client_id = ? ORDER BY cases.created_at DESC`
    const result = await DB.prepare(query).bind(orgId, clientId).all()
    return c.json(result.results)
  } else {
    query += ` ORDER BY cases.created_at DESC`
    const result = await DB.prepare(query).bind(orgId).all()
    return c.json(result.results)
  }
})

// 案件詳細取得
routes.get('/cases/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離（|| 1 フォールバック廃止）
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  const result = await DB.prepare(`
    SELECT 
      cases.*,
      clients.name as client_name,
      clients.company_name,
      clients.email,
      clients.phone,
      subsidy_types.name as subsidy_type_name,
      admin_users.name as assigned_to_name
    FROM cases
    LEFT JOIN clients ON cases.client_id = clients.id
    LEFT JOIN subsidy_types ON cases.subsidy_type_id = subsidy_types.id
    LEFT JOIN admin_users ON cases.assigned_to = admin_users.username
    WHERE cases.id = ? AND cases.organization_id = ?
  `).bind(id, orgId).first()
  
  if (!result) {
    return c.json({ error: 'Case not found' }, 404)
  }
  
  return c.json(result)
})

// 案件クイックビュー（モーダル用）
routes.get('/cases/:id/quick-view', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const tab = c.req.query('tab') || 'overview'
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離（|| 1 フォールバック廃止）
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // 案件基本情報
  const caseData = await DB.prepare(`
    SELECT 
      cases.*,
      clients.name as client_name,
      clients.company_name,
      clients.email,
      clients.phone,
      subsidy_types.name as subsidy_type_name,
      admin_users.name as assigned_to_name
    FROM cases
    LEFT JOIN clients ON cases.client_id = clients.id
    LEFT JOIN subsidy_types ON cases.subsidy_type_id = subsidy_types.id
    LEFT JOIN admin_users ON cases.assigned_to = admin_users.username
    WHERE cases.id = ? AND cases.organization_id = ?
  `).bind(id, orgId).first()
  
  if (!caseData) {
    return c.json({ error: 'Case not found' }, 404)
  }
  
  const result: any = { ...caseData }
  
  // タブごとに追加データを取得
  if (tab === 'documents') {
    // 案件のclient_idを取得
    const clientId = (caseData as any).client_id
    
    // case_id または client_id で書類を取得（案件に紐づく書類 + 顧客に紐づく共通書類）
    const docs = await DB.prepare(`
      SELECT id, client_id, case_id, document_type, file_name, file_path, file_size, uploaded_by, status, uploaded_at as created_at
      FROM documents 
      WHERE case_id = ? OR (client_id = ? AND case_id IS NULL)
      ORDER BY uploaded_at DESC
    `).bind(id, clientId).all()
    result.documents = docs.results || []
  }
  
  if (tab === 'timeline') {
    // 案件のclient_idを使ってコミュニケーション履歴を取得
    const clientId = (caseData as any).client_id
    
    // コミュニケーション履歴を取得（client_id経由）
    const communications = await DB.prepare(`
      SELECT 
        'communication' as type,
        message as action,
        sender_name as user,
        created_at,
        'fa-comment' as icon
      FROM communications 
      WHERE client_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `).bind(clientId).all()
    
    // 書類アップロード履歴（case_id経由）
    const uploads = await DB.prepare(`
      SELECT 
        'upload' as type,
        '書類アップロード: ' || file_name as action,
        uploaded_by as user,
        uploaded_at as created_at,
        'fa-upload' as icon
      FROM documents 
      WHERE case_id = ? 
      ORDER BY uploaded_at DESC 
      LIMIT 20
    `).bind(id).all()
    
    // マージしてソート
    const timeline = [
      ...(communications.results || []),
      ...(uploads.results || [])
    ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    result.timeline = timeline.slice(0, 20)
  }
  
  return c.json(result)
})

// ステータス更新
routes.put('/cases/:id/status', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { status } = await c.req.json()
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // 現在のステータスを取得
  const currentCase = await DB.prepare(`SELECT status, organization_id FROM cases WHERE id = ?`).bind(id).first() as any
  
  if (!currentCase) {
    return c.json({ error: '案件が見つかりません' }, 404)
  }
  
  // テナント分離チェック
  if (currentCase.organization_id !== orgId) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }
  
  // 「見込み(inquiry)」から他のステータスに変更する場合、枠を消費
  if (currentCase.status === 'inquiry' && status !== 'inquiry') {
    // 既に枠を消費済みかチェック
    const alreadyConsumed = await DB.prepare(`
      SELECT id FROM slot_usage_history WHERE case_id = ? AND action = 'consumed'
    `).bind(id).first()
    
    if (!alreadyConsumed) {
      // サブスクリプション取得（テナント分離: organization_id で検索）
      const subscription = await DB.prepare(`
        SELECT us.id, sb.monthly_slots_remaining, sb.purchased_slots_remaining
        FROM user_subscriptions us
        JOIN slot_balances sb ON us.id = sb.subscription_id
        WHERE us.organization_id = ? AND us.status = 'active'
        LIMIT 1
      `).bind(orgId).first() as any
      
      if (subscription) {
        const totalAvailable = (subscription.monthly_slots_remaining || 0) + (subscription.purchased_slots_remaining || 0)
        
        if (totalAvailable <= 0) {
          return c.json({ 
            error: '利用可能な枠がありません。追加枠を購入してください。', 
            need_purchase: true,
            slot_error: true 
          }, 400)
        }
        
        // 月次枠から優先消費、なければ購入枠から消費
        let slotType = 'monthly'
        let newMonthly = subscription.monthly_slots_remaining
        let newPurchased = subscription.purchased_slots_remaining
        
        if (subscription.monthly_slots_remaining > 0) {
          newMonthly = subscription.monthly_slots_remaining - 1
        } else {
          slotType = 'purchased'
          newPurchased = subscription.purchased_slots_remaining - 1
        }
        
        // 枠を消費
        await DB.prepare(`
          UPDATE slot_balances 
          SET monthly_slots_remaining = ?, purchased_slots_remaining = ?, updated_at = CURRENT_TIMESTAMP
          WHERE subscription_id = ?
        `).bind(newMonthly, newPurchased, subscription.id).run()
        
        // 使用履歴を記録
        await DB.prepare(`
          INSERT INTO slot_usage_history (subscription_id, case_id, slot_type, action, slots_changed, balance_after, note, organization_id)
          VALUES (?, ?, ?, 'consumed', -1, ?, '案件開始による枠消費（見込み→進行中）', ?)
        `).bind(subscription.id, id, slotType, newMonthly + newPurchased, orgId).run()
      }
      // サブスクリプションがない場合は枠消費をスキップ（初期状態対応）
    }
  }
  
  await DB.prepare(`
    UPDATE cases SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(status, id).run()
  
  return c.json({ success: true })
})

// アクセストークンで案件取得（顧客ポータル用）
routes.get('/cases/token/:token', async (c) => {
  const { DB } = c.env
  const token = c.req.param('token')
  
  const result = await DB.prepare(`
    SELECT 
      cases.*,
      clients.id as client_id,
      clients.name as client_name,
      clients.company_name,
      clients.email,
      clients.phone,
      subsidy_types.name as subsidy_type_name
    FROM cases
    LEFT JOIN clients ON cases.client_id = clients.id
    LEFT JOIN subsidy_types ON cases.subsidy_type_id = subsidy_types.id
    WHERE cases.access_token = ?
  `).bind(token).first()
  
  if (!result) {
    return c.json({ error: 'Case not found' }, 404)
  }
  
  return c.json(result)
})

// 新規案件作成
routes.post('/cases', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離（|| 1 フォールバック廃止）
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  console.log('Creating case with data:', JSON.stringify(data))
  
  // アクセストークンを生成
  const accessToken = crypto.randomUUID().replace(/-/g, '').substring(0, 20)
  
  // 案件番号を生成（CASE-YYYYMMDD-NNNN形式）
  const now = new Date()
  const dateStr = now.getFullYear().toString() + 
                  String(now.getMonth() + 1).padStart(2, '0') + 
                  String(now.getDate()).padStart(2, '0')
  const countResult = await DB.prepare(`
    SELECT COUNT(*) as count FROM cases WHERE case_number LIKE ? AND organization_id = ?
  `).bind(`CASE-${dateStr}-%`, orgId).first()
  const caseNumber = `CASE-${dateStr}-${String((countResult?.count || 0) + 1).padStart(4, '0')}`
  
  const result = await DB.prepare(`
    INSERT INTO cases (
      client_id, case_number, subsidy_type_id, status, assigned_to, notes,
      deposit_required, deposit_amount, withholding_tax,
      success_fee_enabled, success_fee_rate, success_fee_amount,
      contract_url, access_token, organization_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.client_id,
    caseNumber,
    data.subsidy_type_id || null,
    data.status || 'inquiry',
    data.assigned_to || null,
    data.notes || null,
    data.deposit_required ? 1 : 0,
    data.deposit_amount || 0,
    data.withholding_tax ? 1 : 0,
    data.success_fee_enabled ? 1 : 0,
    data.success_fee_rate || 0,
    data.success_fee_amount || 0,
    data.contract_url || null,
    accessToken,
    orgId
  ).run()
  
  const caseId = result.meta.last_row_id
  
  // 補助金種別に必要書類が設定されていない場合、デフォルト書類を自動追加
  if (data.subsidy_type_id) {
    const existingDocs = await DB.prepare(`
      SELECT COUNT(*) as count FROM subsidy_type_documents WHERE subsidy_type_id = ?
    `).bind(data.subsidy_type_id).first()
    
    if (existingDocs?.count === 0) {
      // デフォルトの基本書類を追加
      const defaultDocs = [
        { document_type: '登記簿謄本', description: '3ヶ月以内に発行されたもの', is_required: 1, display_order: 1 },
        { document_type: '決算書', description: '直近2期分', is_required: 1, display_order: 2 },
        { document_type: '確定申告書', description: '直近のもの', is_required: 1, display_order: 3 },
        { document_type: '事業計画書', description: '申請用', is_required: 1, display_order: 4 },
        { document_type: '見積書', description: '対象経費の見積書', is_required: 0, display_order: 5 }
      ]
      
      for (const doc of defaultDocs) {
        await DB.prepare(`
          INSERT INTO subsidy_type_documents (subsidy_type_id, document_type, description, is_required, display_order)
          VALUES (?, ?, ?, ?, ?)
        `).bind(data.subsidy_type_id, doc.document_type, doc.description, doc.is_required, doc.display_order).run()
      }
    }
  }
  
  // パイプラインテンプレートが選択された場合、タスクを自動生成
  if (data.pipeline_template_id) {
    try {
      // テンプレート情報を取得
      const template = await DB.prepare(`
        SELECT * FROM pipeline_templates WHERE id = ?
      `).bind(data.pipeline_template_id).first()
      
      if (template) {
        // テンプレートからタスクを取得
        const templateTasks = await DB.prepare(`
          SELECT * FROM pipeline_template_tasks 
          WHERE template_id = ? 
          ORDER BY sort_order ASC
        `).bind(data.pipeline_template_id).all()
        
        const today = new Date()
        
        // 1. まずclient_pipelinesにパイプラインを作成
        const pipelineResult = await DB.prepare(`
          INSERT INTO client_pipelines (
            client_id, case_id, template_id, pipeline_name, service_start_date, service_end_date, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          data.client_id,
          caseId,
          data.pipeline_template_id,
          template.name,
          today.toISOString().split('T')[0],
          new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          'active'
        ).run()
        
        const pipelineId = pipelineResult.meta.last_row_id
        
        // 2. 各タスクをclient_pipeline_tasksに追加
        for (const task of templateTasks.results || []) {
          const startDate = new Date(today)
          startDate.setDate(startDate.getDate() + (task.days_offset_start || 0))
          
          const endDate = new Date(today)
          endDate.setDate(endDate.getDate() + (task.days_offset_end || 7))
          
          await DB.prepare(`
            INSERT INTO client_pipeline_tasks (
              pipeline_id, template_task_id, task_name, task_type, description,
              sort_order, start_date, end_date, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            pipelineId,
            task.id,
            task.task_name,
            task.task_type || 'internal',
            task.description || '',
            task.sort_order || 0,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0],
            'pending'
          ).run()
        }
        
        console.log('Pipeline created for case:', caseId, 'pipeline_id:', pipelineId)
      }
    } catch (pipelineError) {
      console.error('Error creating pipeline:', pipelineError)
      // パイプライン作成に失敗してもケース作成は続行
    }
  }
  
  // 手付金が設定されている場合、請求書を自動作成
  if (data.deposit_required && data.deposit_amount > 0) {
    try {
      // invoicesテーブルが存在しない場合は作成
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
      
      // 請求書番号を生成
      const now = new Date()
      const invoiceYear = now.getFullYear()
      const invoiceSeq = now.getTime().toString().slice(-6)
      const invoiceNumber = `INV-${invoiceYear}-${invoiceSeq}`
      
      // 消費税計算（10%）
      const subtotal = data.deposit_amount
      const taxRate = 10
      const taxAmount = Math.floor(subtotal * taxRate / 100)
      const totalAmount = subtotal + taxAmount
      
      // 発行日・支払期限
      const issueDate = now.toISOString().split('T')[0]
      const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      // 補助金名を取得して品目名を生成
      let itemName = '補助金申請サポート 着手金'
      if (data.subsidy_type_id) {
        const subsidyType = await DB.prepare(`SELECT name FROM subsidy_types WHERE id = ?`).bind(data.subsidy_type_id).first()
        if (subsidyType?.name) {
          itemName = `${subsidyType.name} 着手金`
        }
      }
      
      await DB.prepare(`
        INSERT INTO invoices (
          organization_id, case_id, client_id, invoice_number, invoice_type,
          subtotal, tax_rate, tax_amount, withholding_tax, total_amount,
          issue_date, due_date, item_name, status
        ) VALUES (?, ?, ?, ?, 'deposit', ?, ?, ?, 0, ?, ?, ?, ?, 'issued')
      `).bind(
        orgId,
        caseId,
        data.client_id,
        invoiceNumber,
        subtotal,
        taxRate,
        taxAmount,
        totalAmount,
        issueDate,
        dueDate,
        itemName
      ).run()
      
      console.log('Deposit invoice created for case:', caseId, 'invoice_number:', invoiceNumber)
    } catch (invoiceError) {
      console.error('Error creating deposit invoice:', invoiceError)
      // 請求書作成に失敗してもケース作成は続行
    }
  }
  
  return c.json({ 
    id: caseId,
    case_number: caseNumber,
    access_token: accessToken
  })
})

// 案件更新
routes.put('/cases/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    const data = await c.req.json()
    const user = await getCurrentUser(c)
    const organizationId = getEffectiveOrgId(c, user)
    if (!organizationId) {
      return c.json({ error: '組織が特定できません' }, 401)
    }
    
    // ステータス変更時の枠消費チェック
    if (data.status) {
      // 現在のステータスを取得
      const currentCase = await DB.prepare(`SELECT status FROM cases WHERE id = ?`).bind(id).first()
      
      // 「見込み(inquiry)」から他のステータスに変更する場合、枠を消費
      if (currentCase && currentCase.status === 'inquiry' && data.status !== 'inquiry') {
        // 既に枠を消費済みかチェック
        const alreadyConsumed = await DB.prepare(`
          SELECT id FROM slot_usage_history WHERE case_id = ? AND action = 'consumed'
        `).bind(id).first()
        
        if (!alreadyConsumed) {
          // サブスクリプション取得（テナント分離: organization_id で検索）
          const subscription = await DB.prepare(`
            SELECT us.id, sb.monthly_slots_remaining, sb.purchased_slots_remaining
            FROM user_subscriptions us
            JOIN slot_balances sb ON us.id = sb.subscription_id
            WHERE us.organization_id = ? AND us.status = 'active'
            LIMIT 1
          `).bind(organizationId).first()
          
          if (subscription) {
            const totalAvailable = (subscription.monthly_slots_remaining || 0) + (subscription.purchased_slots_remaining || 0)
            
            if (totalAvailable <= 0) {
              return c.json({ 
                error: '利用可能な枠がありません。追加枠を購入してください。', 
                need_purchase: true,
                slot_error: true 
              }, 400)
            }
            
            // 月次枠から優先消費、なければ購入枠から消費
            let slotType = 'monthly'
            let newMonthly = subscription.monthly_slots_remaining
            let newPurchased = subscription.purchased_slots_remaining
            
            if (subscription.monthly_slots_remaining > 0) {
              newMonthly = subscription.monthly_slots_remaining - 1
            } else {
              slotType = 'purchased'
              newPurchased = subscription.purchased_slots_remaining - 1
            }
            
            // 枠を消費
            await DB.prepare(`
              UPDATE slot_balances 
              SET monthly_slots_remaining = ?, purchased_slots_remaining = ?, updated_at = CURRENT_TIMESTAMP
              WHERE subscription_id = ?
            `).bind(newMonthly, newPurchased, subscription.id).run()
            
            // 使用履歴を記録
            await DB.prepare(`
              INSERT INTO slot_usage_history (subscription_id, case_id, slot_type, action, slots_changed, balance_after, note)
              VALUES (?, ?, ?, 'consumed', -1, ?, '案件開始による枠消費（見込み→進行中）')
            `).bind(subscription.id, id, slotType, newMonthly + newPurchased).run()
          }
          // サブスクリプションがない場合は枠消費をスキップ（初期状態対応）
        }
      }
    }
    
    // 「完了する」ボタンでis_archived: trueが明示的に指定された場合のみアーカイブする
    // ステータス変更では自動アーカイブしない（完了前に入力された採択金額・不採択情報は保持される）
    
    await DB.prepare(`
      UPDATE cases SET
        subsidy_type_id = COALESCE(?, subsidy_type_id),
        status = COALESCE(?, status),
        assigned_to = COALESCE(?, assigned_to),
        notes = COALESCE(?, notes),
        deposit_required = COALESCE(?, deposit_required),
        deposit_amount = COALESCE(?, deposit_amount),
        deposit_paid = COALESCE(?, deposit_paid),
        withholding_tax = COALESCE(?, withholding_tax),
        success_fee_enabled = COALESCE(?, success_fee_enabled),
        success_fee_rate = COALESCE(?, success_fee_rate),
        success_fee_amount = COALESCE(?, success_fee_amount),
        contract_url = COALESCE(?, contract_url),
        applied_amount = COALESCE(?, applied_amount),
        granted_amount = COALESCE(?, granted_amount),
        granted_at = COALESCE(?, granted_at),
        is_archived = COALESCE(?, is_archived),
        result = COALESCE(?, result),
        approved_amount = COALESCE(?, approved_amount),
        result_date = COALESCE(?, result_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      data.subsidy_type_id !== undefined ? data.subsidy_type_id : null,
      data.status !== undefined ? data.status : null,
      data.assigned_to !== undefined ? data.assigned_to : null,
      data.notes !== undefined ? data.notes : null,
      data.deposit_required !== undefined ? (data.deposit_required ? 1 : 0) : null,
      data.deposit_amount !== undefined ? data.deposit_amount : null,
      data.deposit_paid !== undefined ? (data.deposit_paid ? 1 : 0) : null,
      data.withholding_tax !== undefined ? (data.withholding_tax ? 1 : 0) : null,
      data.success_fee_enabled !== undefined ? (data.success_fee_enabled ? 1 : 0) : null,
      data.success_fee_rate !== undefined ? data.success_fee_rate : null,
      data.success_fee_amount !== undefined ? data.success_fee_amount : null,
      data.contract_url !== undefined ? data.contract_url : null,
      data.applied_amount !== undefined ? data.applied_amount : null,
      data.granted_amount !== undefined ? data.granted_amount : null,
      data.granted_at !== undefined ? data.granted_at : null,
      // 明示的にis_archivedが指定された場合のみ変更
      data.is_archived !== undefined ? (data.is_archived ? 1 : 0) : null,
      data.result !== undefined ? data.result : null,
      data.approved_amount !== undefined ? data.approved_amount : null,
      data.result_date !== undefined ? data.result_date : null,
      id
    ).run()
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error updating case:', error)
    return c.json({ error: 'ステータスの更新に失敗しました: ' + (error.message || 'Unknown error') }, 500)
  }
})

// 案件削除
routes.delete('/cases/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  
  // adminのみ削除可能
  if (!user || user.role !== 'admin') {
    return c.json({ error: '案件の削除は管理者のみ実行できます' }, 403)
  }
  
  // 案件の状態を確認
  const caseData: any = await DB.prepare(`
    SELECT status, deposit_paid, deposit_amount
    FROM cases WHERE id = ?
  `).bind(id).first()
  
  if (!caseData) {
    return c.json({ error: '案件が見つかりません' }, 404)
  }
  
  // 削除不可の条件をチェック
  const nonDeletableStatuses = ['submitted', 'under_review', 'approved', 'completed', 'rejected']
  
  if (nonDeletableStatuses.includes(caseData.status)) {
    const statusLabels: Record<string, string> = {
      'submitted': '申請済み',
      'under_review': '審査中',
      'approved': '採択',
      'completed': '完了',
      'rejected': '不採択'
    }
    return c.json({ 
      error: `ステータスが「${statusLabels[caseData.status] || caseData.status}」の案件は削除できません` 
    }, 400)
  }
  
  // 着手金が支払い済みの場合は削除不可
  if (caseData.deposit_paid && caseData.deposit_amount > 0) {
    return c.json({ 
      error: '着手金が支払い済みの案件は削除できません。案件をアーカイブすることをお勧めします。' 
    }, 400)
  }
  
  try {
    // 案件に紐づく関連データを明示的に削除（順序が重要：子テーブルから先に）
    
    // 1. client_pipelinesに関連するtasksを削除
    const pipelines = await DB.prepare(`SELECT id FROM client_pipelines WHERE case_id = ?`).bind(id).all()
    if (pipelines.results && pipelines.results.length > 0) {
      for (const pipeline of pipelines.results) {
        await DB.prepare(`DELETE FROM client_pipeline_tasks WHERE pipeline_id = ?`).bind(pipeline.id).run()
      }
    }
    
    // 2. 通知を削除
    await DB.prepare(`DELETE FROM admin_notifications WHERE case_id = ?`).bind(id).run()
    
    // 3. その他の関連データを削除
    await DB.prepare(`DELETE FROM documents WHERE case_id = ?`).bind(id).run()
    await DB.prepare(`DELETE FROM communications WHERE case_id = ?`).bind(id).run()
    await DB.prepare(`DELETE FROM hearing_answers WHERE case_id = ?`).bind(id).run()
    await DB.prepare(`DELETE FROM client_pipelines WHERE case_id = ?`).bind(id).run()
    await DB.prepare(`DELETE FROM generated_documents WHERE case_id = ?`).bind(id).run()
    
    // 4. 案件自体を削除
    await DB.prepare(`DELETE FROM cases WHERE id = ?`).bind(id).run()
    
    return c.json({ success: true })
  } catch (error: any) {
    console.error('Delete case error:', error)
    return c.json({ error: error.message || '案件の削除に失敗しました' }, 500)
  }
})

// 案件の書類一覧取得
routes.get('/cases/:id/documents', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('id')
  
  // 案件情報を取得してclient_idを得る
  const caseData = await DB.prepare(`SELECT client_id FROM cases WHERE id = ?`).bind(caseId).first()
  
  if (!caseData) {
    return c.json([])
  }
  
  // case_id が一致する書類、または case_id が NULL で client_id が一致する書類を取得
  const result = await DB.prepare(`
    SELECT * FROM documents 
    WHERE case_id = ? 
       OR (case_id IS NULL AND client_id = ?)
    ORDER BY uploaded_at DESC
  `).bind(caseId, caseData.client_id).all()
  
  return c.json(result.results || [])
})

// 案件のパイプライン取得
routes.get('/cases/:id/pipelines', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('id')
  
  // まず案件に紐づくパイプラインを取得
  const pipelines = await DB.prepare(`
    SELECT * FROM client_pipelines WHERE case_id = ?
  `).bind(caseId).all()
  
  if (!pipelines.results || pipelines.results.length === 0) {
    // パイプラインがない場合は空配列を返す
    return c.json([])
  }
  
  // パイプラインのタスクを取得
  const pipelineIds = pipelines.results.map((p: any) => p.id)
  const tasks = await DB.prepare(`
    SELECT cpt.*, au.name as assignee_name
    FROM client_pipeline_tasks cpt
    LEFT JOIN admin_users au ON cpt.assigned_to = au.id
    WHERE cpt.pipeline_id IN (${pipelineIds.join(',')})
    ORDER BY cpt.sort_order ASC, cpt.id ASC
  `).all()
  
  return c.json(tasks.results || [])
})

// 案件にパイプラインテンプレートを適用
routes.post('/cases/:id/apply-pipeline', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('id')
  const { template_id } = await c.req.json()
  
  if (!template_id) {
    return c.json({ error: 'template_id is required' }, 400)
  }
  
  // テンプレート情報を取得
  const template = await DB.prepare(`
    SELECT * FROM pipeline_templates WHERE id = ?
  `).bind(template_id).first()
  
  if (!template) {
    return c.json({ error: 'Template not found' }, 404)
  }
  
  // テンプレートのタスクを取得
  const templateTasks = await DB.prepare(`
    SELECT * FROM pipeline_template_tasks WHERE template_id = ? ORDER BY sort_order ASC
  `).bind(template_id).all()
  
  // 案件情報を取得（client_idが必要）
  const caseData = await DB.prepare(`SELECT client_id FROM cases WHERE id = ?`).bind(caseId).first()
  if (!caseData) {
    return c.json({ error: 'Case not found' }, 404)
  }
  
  const today = new Date()
  
  // 1. まずclient_pipelinesにパイプラインを作成
  const pipelineResult = await DB.prepare(`
    INSERT INTO client_pipelines (
      client_id, case_id, template_id, pipeline_name, service_start_date, service_end_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    caseData.client_id,
    caseId,
    template_id,
    template.name,
    today.toISOString().split('T')[0],
    new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    'active'
  ).run()
  
  const pipelineId = pipelineResult.meta.last_row_id
  
  // 2. 各タスクをclient_pipeline_tasksに追加
  if (templateTasks.results && templateTasks.results.length > 0) {
    for (const task of templateTasks.results) {
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() + (task.days_offset_start || 0))
      
      const endDate = new Date(today)
      endDate.setDate(endDate.getDate() + (task.days_offset_end || 7))
      
      await DB.prepare(`
        INSERT INTO client_pipeline_tasks (
          pipeline_id, template_task_id, task_name, task_type, description,
          sort_order, start_date, end_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        pipelineId,
        task.id,
        task.task_name,
        task.task_type || 'internal',
        task.description || '',
        task.sort_order || 0,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        'pending'
      ).run()
    }
  }
  
  return c.json({ success: true, message: 'Pipeline applied', pipeline_id: pipelineId })
})

// 案件のコミュニケーション取得
routes.get('/cases/:id/communications', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('id')
  
  // まず案件からclient_idを取得
  const caseData = await DB.prepare(`SELECT client_id FROM cases WHERE id = ?`).bind(caseId).first() as any
  
  if (!caseData) {
    return c.json([])
  }
  
  // case_idまたはclient_id（case_idがnullの場合）でやり取りを取得
  const result = await DB.prepare(`
    SELECT * FROM communications 
    WHERE case_id = ? OR (case_id IS NULL AND client_id = ?)
    ORDER BY created_at ASC
  `).bind(caseId, caseData.client_id).all()
  
  return c.json(result.results)
})

// 案件のコミュニケーション追加
routes.post('/cases/:id/communications', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('id')
  const { message, sender_type, sender_name } = await c.req.json()
  
  // 案件からclient_idを取得
  const caseData = await DB.prepare(`SELECT client_id FROM cases WHERE id = ?`).bind(caseId).first()
  if (!caseData) {
    return c.json({ error: 'Case not found' }, 404)
  }
  
  const result = await DB.prepare(`
    INSERT INTO communications (client_id, case_id, message, sender_type, sender_name)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    caseData.client_id,
    caseId,
    message,
    sender_type || 'staff',
    sender_name || 'スタッフ'
  ).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// 案件のヒアリング回答取得
routes.get('/cases/:id/hearing-answers', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('id')
  
  // 案件からsubsidy_type_idとclient_idを取得
  const caseData = await DB.prepare(`SELECT subsidy_type_id, client_id FROM cases WHERE id = ?`).bind(caseId).first() as { subsidy_type_id: number | null, client_id: number } | null
  if (!caseData) {
    return c.json({ error: 'Case not found' }, 404)
  }
  
  const subsidyTypeId = caseData.subsidy_type_id || 0
  const clientId = caseData.client_id
  
  // 共通質問（subsidy_type_id = 0）と案件固有の質問を取得
  const questions = await DB.prepare(`
    SELECT 
      id as question_id,
      question_key,
      question_text,
      question_type,
      options,
      category,
      is_required,
      display_order as sort_order,
      help_text,
      example_answer,
      subsidy_type_id
    FROM hearing_questions 
    WHERE subsidy_type_id = ? OR subsidy_type_id = 0
    ORDER BY subsidy_type_id ASC, display_order ASC
  `).bind(subsidyTypeId).all()
  
  // 共通質問の回答（client_idで検索、case_idがNULLのもの優先）
  const commonAnswers = await DB.prepare(`
    SELECT question_id, answer_text, created_at as answered_at
    FROM hearing_answers 
    WHERE client_id = ? AND (case_id IS NULL OR case_id = 0)
  `).bind(clientId).all()
  
  // 案件固有の回答（case_idで検索）
  const caseAnswers = await DB.prepare(`
    SELECT question_id, answer_text, created_at as answered_at
    FROM hearing_answers 
    WHERE case_id = ?
  `).bind(caseId).all()
  
  // 回答をマップに変換
  const commonAnswerMap = new Map((commonAnswers.results || []).map((a: any) => [a.question_id, a]))
  const caseAnswerMap = new Map((caseAnswers.results || []).map((a: any) => [a.question_id, a]))
  
  // 質問と回答をマージ
  const result = (questions.results || []).map((q: any) => {
    // 共通質問（subsidy_type_id = 0）は共通回答から、それ以外は案件固有の回答から取得
    const answer = q.subsidy_type_id === 0 
      ? commonAnswerMap.get(q.question_id) 
      : caseAnswerMap.get(q.question_id)
    
    return {
      ...q,
      answer_text: answer?.answer_text || null,
      answered_at: answer?.answered_at || null
    }
  })
  
  return c.json(result)
})

// 案件のヒアリング回答保存（共通質問と案件固有質問を区別）
routes.post('/cases/:id/hearing-answers', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('id')
  const data = await c.req.json()
  
  // 案件からclient_idを取得
  const caseData = await DB.prepare(`SELECT client_id FROM cases WHERE id = ?`).bind(caseId).first() as { client_id: number } | null
  if (!caseData) {
    return c.json({ error: 'Case not found' }, 404)
  }
  
  const clientId = caseData.client_id
  let savedCount = 0
  let commonSavedCount = 0
  
  // 回答を保存する関数
  const saveAnswer = async (questionId: number, answerText: string) => {
    // 質問の種別を確認（共通質問かどうか）
    const question = await DB.prepare(`
      SELECT subsidy_type_id FROM hearing_questions WHERE id = ?
    `).bind(questionId).first() as { subsidy_type_id: number } | null
    
    if (!question) return false
    
    const isCommonQuestion = question.subsidy_type_id === 0
    
    if (isCommonQuestion) {
      // 共通質問はclient_idのみで保存（case_id = NULL）
      // 既存の回答を確認（client_idのみで検索）
      const existing = await DB.prepare(`
        SELECT id FROM hearing_answers WHERE client_id = ? AND question_id = ? AND (case_id IS NULL OR case_id = 0)
      `).bind(clientId, questionId).first()
      
      if (existing) {
        await DB.prepare(`
          UPDATE hearing_answers 
          SET answer_text = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(answerText, (existing as any).id).run()
      } else {
        await DB.prepare(`
          INSERT INTO hearing_answers (client_id, question_id, answer_text, case_id)
          VALUES (?, ?, ?, NULL)
        `).bind(clientId, questionId, answerText).run()
      }
      commonSavedCount++
    } else {
      // 案件固有の質問はcase_idも含めて保存
      const existing = await DB.prepare(`
        SELECT id FROM hearing_answers WHERE case_id = ? AND question_id = ?
      `).bind(caseId, questionId).first()
      
      if (existing) {
        await DB.prepare(`
          UPDATE hearing_answers 
          SET answer_text = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(answerText, (existing as any).id).run()
      } else {
        await DB.prepare(`
          INSERT INTO hearing_answers (client_id, case_id, question_id, answer_text)
          VALUES (?, ?, ?, ?)
        `).bind(clientId, caseId, questionId, answerText).run()
      }
    }
    
    savedCount++
    return true
  }
  
  // 複数回答の一括保存
  if (data.answers && Array.isArray(data.answers)) {
    for (const answer of data.answers) {
      if (answer.answer_text && answer.answer_text.trim()) {
        await saveAnswer(answer.question_id, answer.answer_text)
      }
    }
  } else if (data.question_id && data.answer_text) {
    // 単一回答の保存
    await saveAnswer(data.question_id, data.answer_text)
  }
  
  return c.json({ 
    success: true, 
    saved_count: savedCount,
    common_saved_count: commonSavedCount,
    message: `${savedCount}件の回答を保存しました（うち共通質問: ${commonSavedCount}件）`
  })
})

// 案件の書類チェックリスト取得
routes.get('/cases/:id/document-checklist', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('id')
  
  // 案件からsubsidy_type_idを取得
  const caseData = await DB.prepare(`SELECT subsidy_type_id FROM cases WHERE id = ?`).bind(caseId).first()
  if (!caseData || !caseData.subsidy_type_id) {
    // デフォルトのチェックリスト
    const defaultResult = await DB.prepare(`
      SELECT * FROM document_checklist ORDER BY display_order ASC
    `).all()
    return c.json(defaultResult.results)
  }
  
  // 補助金種別に紐づくチェックリスト
  const result = await DB.prepare(`
    SELECT * FROM subsidy_type_documents WHERE subsidy_type_id = ? ORDER BY display_order ASC
  `).bind(caseData.subsidy_type_id).all()
  
  if (result.results && result.results.length > 0) {
    return c.json(result.results)
  }
  
  // フォールバック
  const defaultResult = await DB.prepare(`
    SELECT * FROM document_checklist ORDER BY display_order ASC
  `).all()
  return c.json(defaultResult.results)
})

// ================================
// 顧客ポータル用 API
// ================================

// ポータル: 組織の資格ステータス取得（案件経由）
routes.get('/portal/license-status', async (c) => {
  const { DB } = c.env
  const caseId = c.req.query('case_id')
  
  if (!caseId) {
    return c.json({ error: 'case_id is required' }, 400)
  }
  
  // 案件から組織IDを取得
  const caseData = await DB.prepare(`
    SELECT c.organization_id
    FROM cases c
    WHERE c.id = ?
  `).bind(caseId).first() as any
  
  if (!caseData) {
    return c.json({ error: 'Case not found' }, 404)
  }
  
  // 組織の資格情報を取得
  const org = await DB.prepare(`
    SELECT 
      gyoseishoshi_license_number,
      sharoshi_license_number,
      document_creation_mode,
      license_verified,
      legal_disclaimer_agreed
    FROM organizations
    WHERE id = ?
  `).bind(caseData.organization_id).first() as any
  
  if (!org) {
    // 組織がない場合はデフォルトで顧客自己作成モード
    return c.json({
      hasGyoseishoshi: false,
      hasSharoshi: false,
      isLicensed: false,
      isVerified: false,
      documentCreationMode: 'client_self',
      effectiveMode: 'client_self',
      canCreateDocumentsForClient: false
    })
  }
  
  // 資格ステータスを判定
  const hasGyoseishoshi = !!org.gyoseishoshi_license_number
  const hasSharoshi = !!org.sharoshi_license_number
  const isLicensed = hasGyoseishoshi || hasSharoshi
  const isVerified = org.license_verified === 1
  
  // 書類作成モードの判定
  let effectiveMode = org.document_creation_mode || 'client_self'
  
  // 資格がない場合は強制的に顧客自己作成モード
  if (!isLicensed) {
    effectiveMode = 'client_self'
  }
  
  return c.json({
    hasGyoseishoshi,
    hasSharoshi,
    isLicensed,
    isVerified,
    documentCreationMode: org.document_creation_mode,
    effectiveMode,
    canCreateDocumentsForClient: isLicensed && isVerified && effectiveMode !== 'client_self'
  })
})

// ポータル: 書類作成同意を記録
routes.post('/portal/document-consent', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { case_id, consent_type, consent_text } = body
  
  if (!case_id || !consent_type || !consent_text) {
    return c.json({ error: 'case_id, consent_type, and consent_text are required' }, 400)
  }
  
  // 案件からclient_idを取得
  const caseData = await DB.prepare(`
    SELECT client_id FROM cases WHERE id = ?
  `).bind(case_id).first() as any
  
  if (!caseData) {
    return c.json({ error: 'Case not found' }, 404)
  }
  
  // 同意を記録
  await DB.prepare(`
    INSERT INTO client_document_consents (client_id, case_id, consent_type, consent_text, consented_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(caseData.client_id, case_id, consent_type, consent_text).run()
  
  return c.json({ success: true })
})

// 案件の書類テンプレート一覧取得（AI生成対象：事業計画書など）
routes.get('/cases/:id/document-templates', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('id')
  
  // 案件の補助金タイプを取得
  const caseData = await DB.prepare(`
    SELECT subsidy_type_id FROM cases WHERE id = ?
  `).bind(caseId).first() as any
  
  if (!caseData || !caseData.subsidy_type_id) {
    return c.json({ templates: [] })
  }
  
  // 補助金タイプに紐づく「事業計画書テンプレート」（AI生成対象）を取得
  // document_templatesテーブルから取得（subsidy_type_documentsは必要書類リスト）
  const templates = await DB.prepare(`
    SELECT 
      id,
      template_name as name,
      template_version as version,
      sections,
      ai_prompt_base as description
    FROM document_templates
    WHERE subsidy_type_id = ? AND is_active = 1
    ORDER BY id ASC
  `).bind(caseData.subsidy_type_id).all()
  
  return c.json({ templates: templates.results || [] })
})

// 案件の生成済み書類一覧取得
routes.get('/cases/:id/generated-documents', async (c) => {
  const { DB } = c.env
  const caseId = c.req.param('id')
  const isLicensed = c.req.query('is_licensed')
  const status = c.req.query('status')
  
  let query = `
    SELECT 
      id, case_id, 
      COALESCE(document_type, document_title) as name,
      document_title,
      file_path, status,
      created_by_type, is_licensed_creation, created_at, updated_at
    FROM generated_documents
    WHERE case_id = ?
  `
  const params: any[] = [caseId]
  
  if (isLicensed === '1') {
    query += ` AND is_licensed_creation = 1`
  } else if (isLicensed === '0') {
    query += ` AND (is_licensed_creation = 0 OR is_licensed_creation IS NULL)`
  }
  
  if (status) {
    query += ` AND status = ?`
    params.push(status)
  }
  
  query += ` ORDER BY created_at DESC`
  
  const result = await DB.prepare(query).bind(...params).all()
  
  return c.json({ documents: result.results || [] })
})

// 生成書類のプレビュー
routes.get('/generated-documents/:id/preview', async (c) => {
  const { DB } = c.env
  const docId = c.req.param('id')
  
  const doc = await DB.prepare(`
    SELECT * FROM generated_documents WHERE id = ?
  `).bind(docId).first() as any
  
  if (!doc) {
    return c.json({ error: 'Document not found' }, 404)
  }
  
  // タイトルを取得
  const title = doc.document_type || doc.document_title || '無題の書類'
  
  // コンテンツを取得（sections_contentまたはcontent）
  let contentHtml = ''
  
  if (doc.sections_content) {
    try {
      const sections = JSON.parse(doc.sections_content)
      // セクションラベルのマッピング
      const sectionLabels: Record<string, string> = {
        'company_overview': '1. 会社概要・事業概要',
        'innovation_plan': '2. 革新的な取組内容',
        'equipment_plan': '3. 設備投資計画',
        'expected_results': '4. 期待される成果',
        'implementation_schedule': '5. 実施スケジュール',
        'business_plan': '事業計画',
        'financial_plan': '資金計画'
      }
      
      contentHtml = Object.entries(sections).map(([key, value]) => {
        const label = sectionLabels[key] || key
        const content = String(value).replace(/\\n/g, '<br>')
        return '<div class="section"><h2>' + label + '</h2><div class="content">' + content + '</div></div>'
      }).join('')
    } catch (e) {
      contentHtml = '<p>セクションの解析に失敗しました</p>'
    }
  } else if (doc.content) {
    contentHtml = doc.content.replace(/\\n/g, '<br>')
  } else {
    contentHtml = '<p class="empty">コンテンツはまだ生成されていません</p>'
  }
  
  // ステータスラベル
  const statusLabel = doc.status === 'draft' ? '下書き' : doc.status === 'final' ? '完成' : doc.status
  const createdAt = new Date(doc.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - プレビュー</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif; }
    .section { margin-bottom: 2rem; padding: 1.5rem; background: #f9fafb; border-radius: 0.5rem; }
    .section h2 { font-size: 1.25rem; font-weight: bold; color: #1f2937; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #3b82f6; }
    .section .content { color: #374151; line-height: 1.8; white-space: pre-wrap; }
    .empty { color: #9ca3af; text-align: center; padding: 2rem; }
    @media print { .no-print { display: none; } .section { break-inside: avoid; } }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div class="max-w-4xl mx-auto p-6">
    <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">${title}</h1>
          <p class="text-sm text-gray-500 mt-1">作成日: ${createdAt}</p>
          <p class="text-sm text-gray-500">ステータス: ${statusLabel}</p>
        </div>
        <div class="no-print flex gap-2">
          <button onclick="window.print()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            <i class="fas fa-print mr-1"></i>印刷
          </button>
          <a href="/api/generated-documents/${doc.id}/download" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <i class="fas fa-download mr-1"></i>ダウンロード
          </a>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-lg shadow-sm p-6">${contentHtml}</div>
    <div class="text-center text-sm text-gray-400 mt-6 no-print">このプレビューは印刷可能です</div>
  </div>
</body>
</html>`
  
  return c.html(html)
})

// 生成書類のダウンロード
routes.get('/generated-documents/:id/download', async (c) => {
  const { DB } = c.env
  const docId = c.req.param('id')
  
  const doc = await DB.prepare(`
    SELECT * FROM generated_documents WHERE id = ?
  `).bind(docId).first() as any
  
  if (!doc) {
    return c.json({ error: 'Document not found' }, 404)
  }
  
  // タイトルを取得
  const title = doc.document_type || doc.document_title || '書類'
  
  // コンテンツを取得（sections_contentまたはcontent）
  let textContent = ''
  
  if (doc.sections_content) {
    try {
      const sections = JSON.parse(doc.sections_content)
      const sectionLabels: Record<string, string> = {
        'company_overview': '1. 会社概要・事業概要',
        'innovation_plan': '2. 革新的な取組内容',
        'equipment_plan': '3. 設備投資計画',
        'expected_results': '4. 期待される成果',
        'implementation_schedule': '5. 実施スケジュール',
        'business_plan': '事業計画',
        'financial_plan': '資金計画'
      }
      
      textContent = `${title}\n作成日: ${doc.created_at}\n${'='.repeat(50)}\n\n`
      
      for (const [key, value] of Object.entries(sections)) {
        const label = sectionLabels[key] || key
        textContent += `【${label}】\n${String(value).replace(/\\n/g, '\n')}\n\n`
      }
    } catch (e) {
      textContent = 'セクションの解析に失敗しました'
    }
  } else if (doc.content) {
    textContent = doc.content
  } else {
    textContent = 'コンテンツがありません'
  }
  
  // ファイル名をURLエンコード
  const filename = encodeURIComponent(`${title}.txt`)
  
  return new Response(textContent, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`
    }
  })
})

// 生成書類の承認
routes.post('/generated-documents/:id/approve', async (c) => {
  const { DB } = c.env
  const docId = c.req.param('id')
  
  await DB.prepare(`
    UPDATE generated_documents
    SET status = 'approved', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(docId).run()
  
  return c.json({ success: true })
})

// 生成書類の修正依頼
routes.post('/generated-documents/:id/revision', async (c) => {
  const { DB } = c.env
  const docId = c.req.param('id')
  const { comment } = await c.req.json()
  
  await DB.prepare(`
    UPDATE generated_documents
    SET status = 'revision_requested', revision_comment = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(comment, docId).run()
  
  return c.json({ success: true })
})

// 生成書類の詳細取得
routes.get('/generated-documents/:id', async (c) => {
  const { DB } = c.env
  const docId = c.req.param('id')
  
  const doc = await DB.prepare(`
    SELECT * FROM generated_documents WHERE id = ?
  `).bind(docId).first()
  
  if (!doc) {
    return c.json({ error: 'Document not found' }, 404)
  }
  
  return c.json({ document: doc })
})

// 生成書類の更新
routes.put('/generated-documents/:id', async (c) => {
  const { DB } = c.env
  const docId = c.req.param('id')
  const body = await c.req.json()
  
  const updates: string[] = []
  const values: any[] = []
  
  if (body.sections_content !== undefined) {
    updates.push('sections_content = ?')
    values.push(body.sections_content)
  }
  if (body.content !== undefined) {
    updates.push('content = ?')
    values.push(body.content)
  }
  if (body.status !== undefined) {
    updates.push('status = ?')
    values.push(body.status)
  }
  
  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP')
  values.push(docId)
  
  await DB.prepare(`
    UPDATE generated_documents
    SET ${updates.join(', ')}
    WHERE id = ?
  `).bind(...values).run()
  
  return c.json({ success: true })
})

// AI書類添削
routes.post('/ai/refine-document', async (c) => {
  const { DB } = c.env
  const { section_key, content, case_id } = await c.req.json()
  
  if (!content || !content.trim()) {
    return c.json({ error: 'Content is required' }, 400)
  }
  
  // セクションラベル
  const sectionLabels: Record<string, string> = {
    'company_overview': '会社概要・事業概要',
    'innovation_plan': '革新的な取組内容',
    'innovation': '革新的な取組内容',
    'equipment_plan': '設備投資計画',
    'expected_results': '期待される成果',
    'implementation_schedule': '実施スケジュール',
    'future_outlook': '将来の展望・期待される効果',
    'schedule': '実施スケジュール',
    'content': '本文'
  }
  
  const sectionName = sectionLabels[section_key] || section_key
  
  // ケース情報を取得（補助金の種類など）
  let subsidyType = '補助金'
  if (case_id) {
    const caseInfo = await DB.prepare(`
      SELECT subsidy_type FROM cases WHERE id = ?
    `).bind(case_id).first() as any
    if (caseInfo) {
      subsidyType = caseInfo.subsidy_type || '補助金'
    }
  }
  
  const prompt = `あなたは補助金申請書類の専門家です。${subsidyType}の申請書類を添削・改善します。

以下の観点で添削してください：
1. 審査員に伝わりやすい明確な表現になっているか
2. 具体的な数値やデータが含まれているか
3. 補助金の審査基準に沿った内容になっているか
4. 論理的な構成になっているか
5. 専門用語の適切な使用

【重要】
- 元の内容の意図を保ちながら改善してください
- 添削後の文章のみを出力してください（説明は不要）
- 文体は「です・ます調」を維持してください

【${sectionName}】の以下の文章を添削してください：

${content}`

  try {
    // callAIを使用（Claude優先、Geminiフォールバック）
    const { callAI } = await import('./ai')
    const refined = await callAI(prompt, c.env)
    
    return c.json({ refined, original: content })
  } catch (error) {
    console.error('AI refine error:', error)
    return c.json({ error: 'Failed to refine document' }, 500)
  }
})

export default routes

// デバッグ用: 案件のorganization_id分布を確認
routes.get('/cases/debug/org-distribution', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // 管理者のみアクセス可能
  if (!user || user.role !== 'admin') {
    return c.json({ error: '管理者権限が必要です' }, 403)
  }
  
  const tenantOrgId = c.get('tenantOrgId')
  
  // 組織別の案件数を取得
  const distribution = await DB.prepare(`
    SELECT 
      organization_id,
      COUNT(*) as case_count,
      (SELECT name FROM organizations WHERE id = cases.organization_id) as org_name
    FROM cases
    GROUP BY organization_id
    ORDER BY organization_id
  `).all()
  
  // NULL organization_idの案件数
  const nullOrgCases = await DB.prepare(`
    SELECT COUNT(*) as count FROM cases WHERE organization_id IS NULL
  `).first()
  
  return c.json({
    current_tenant_org_id: tenantOrgId,
    user_org_id: user?.organization_id,
    distribution: distribution.results,
    null_org_count: nullOrgCases?.count || 0
  })
})
