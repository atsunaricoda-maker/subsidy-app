// API: 顧客管理
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 最近の活動を取得
routes.get('/recent-activity', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離（|| 1 フォールバック廃止）
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  try {
    // 最近のコミュニケーション
    const communications = await DB.prepare(`
      SELECT 
        comm.id,
        'communication' as type,
        CASE 
          WHEN comm.sender_type = 'client' THEN '顧客 ' || cl.name || ' からメッセージ'
          ELSE comm.sender_name || ' が ' || cl.name || ' へ返信'
        END as description,
        comm.created_at
      FROM communications comm
      JOIN clients cl ON comm.client_id = cl.id
      WHERE cl.organization_id = ?
      ORDER BY comm.created_at DESC
      LIMIT 5
    `).bind(orgId).all()
    
    // 最近のドキュメントアップロード
    const documents = await DB.prepare(`
      SELECT 
        d.id,
        CASE 
          WHEN d.status = 'approved' THEN 'document_approved'
          WHEN d.status = 'rejected' THEN 'document_rejected'
          ELSE 'document_upload'
        END as type,
        CASE 
          WHEN d.status = 'approved' THEN cl.name || ' の「' || d.document_type || '」を承認'
          WHEN d.status = 'rejected' THEN cl.name || ' の「' || d.document_type || '」を差戻し'
          ELSE cl.name || ' が「' || d.document_type || '」をアップロード'
        END as description,
        d.uploaded_at as created_at
      FROM documents d
      JOIN clients cl ON d.client_id = cl.id
      WHERE cl.organization_id = ?
      ORDER BY d.uploaded_at DESC
      LIMIT 5
    `).bind(orgId).all()
    
    // 最近登録された顧客
    const newClients = await DB.prepare(`
      SELECT 
        id,
        'new_client' as type,
        '新規顧客「' || name || '」を登録' as description,
        created_at
      FROM clients
      WHERE organization_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(orgId).all()
    
    // 全ての活動をマージしてソート
    const allActivities = [
      ...(communications.results || []),
      ...(documents.results || []),
      ...(newClients.results || [])
    ].sort((a: any, b: any) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }).slice(0, 15)
    
    return c.json(allActivities)
  } catch (error: any) {
    console.error('Error fetching recent activity:', error)
    return c.json([])
  }
})

// 顧客一覧取得（案件情報も含む）
routes.get('/clients', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const includeCases = c.req.query('include_cases') === 'true'
  
  // organization_idでテナント分離（|| 1 フォールバック廃止）
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // 補助金の公募要領情報もJOINして取得
  let query = `
    SELECT c.*, 
           sg.application_end_date,
           sg.max_amount,
           sg.subsidy_rate,
           sg.fiscal_year
    FROM clients c
    LEFT JOIN subsidy_guidelines sg ON c.subsidy_type_id = sg.subsidy_type_id AND sg.status = 'active'
    WHERE c.organization_id = ?
  `
  let params: any[] = [orgId]
  
  // adminロール以外は自分が担当の案件のみ表示
  if (user && user.role !== 'admin') {
    query += ` AND c.assigned_to = ?`
    params.push(user.username)
  }
  
  query += ` ORDER BY c.created_at DESC`
  
  const result = await DB.prepare(query).bind(...params).all()
  
  // 案件情報を含める場合
  if (includeCases && result.results) {
    const clientsWithCases = await Promise.all(result.results.map(async (client: any) => {
      const casesResult = await DB.prepare(`
        SELECT cases.*, subsidy_types.name as subsidy_type_name
        FROM cases
        LEFT JOIN subsidy_types ON cases.subsidy_type_id = subsidy_types.id
        WHERE cases.client_id = ?
        ORDER BY cases.created_at DESC
      `).bind(client.id).all()
      return {
        ...client,
        cases: casesResult.results || []
      }
    }))
    return c.json(clientsWithCases)
  }
  
  return c.json(result.results)
})

// 案件一覧として表示（従来のクライアント一覧の代替）
routes.get('/clients-with-cases', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離（|| 1 フォールバック廃止）
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // 案件ベースで一覧取得
  let query = `
    SELECT 
      cases.id as case_id,
      cases.case_number,
      cases.status,
      cases.subsidy_type_id,
      cases.assigned_to,
      cases.notes,
      cases.deposit_required,
      cases.deposit_amount,
      cases.deposit_paid,
      cases.success_fee_enabled,
      cases.success_fee_rate,
      cases.success_fee_amount,
      cases.access_token,
      cases.created_at,
      cases.updated_at,
      clients.id as client_id,
      clients.name,
      clients.company_name,
      clients.email,
      clients.phone,
      subsidy_types.name as subsidy_type_name,
      sg.application_end_date,
      sg.max_amount,
      sg.subsidy_rate,
      sg.fiscal_year,
      (SELECT COUNT(*) FROM invoices WHERE invoices.case_id = cases.id AND invoices.invoice_type = 'success_fee') as success_fee_invoice_count,
      (SELECT status FROM invoices WHERE invoices.case_id = cases.id AND invoices.invoice_type = 'success_fee' ORDER BY created_at DESC LIMIT 1) as success_fee_invoice_status
    FROM cases
    LEFT JOIN clients ON cases.client_id = clients.id
    LEFT JOIN subsidy_types ON cases.subsidy_type_id = subsidy_types.id
    LEFT JOIN subsidy_guidelines sg ON cases.subsidy_type_id = sg.subsidy_type_id AND sg.status = 'active'
    WHERE cases.organization_id = ?
  `
  let params: any[] = [orgId]
  
  // adminロール以外は自分が担当の案件のみ表示
  if (user && user.role !== 'admin') {
    query += ` AND cases.assigned_to = ?`
    params.push(user.username)
  }
  
  query += ` ORDER BY cases.created_at DESC`
  
  const result = await DB.prepare(query).bind(...params).all()
  
  return c.json(result.results)
})

// 統計情報取得
routes.get('/stats', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離（|| 1 フォールバック廃止）
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // 総顧客数
  const totalResult = await DB.prepare(`
    SELECT COUNT(*) as count FROM clients WHERE organization_id = ?
  `).bind(orgId).first()
  
  // ステータス別集計
  const statusResult = await DB.prepare(`
    SELECT status, COUNT(*) as count FROM clients WHERE organization_id = ? GROUP BY status
  `).bind(orgId).all()
  
  // 今月の新規顧客
  const thisMonth = new Date().toISOString().substring(0, 7)
  const newThisMonthResult = await DB.prepare(`
    SELECT COUNT(*) as count FROM clients 
    WHERE organization_id = ? AND strftime('%Y-%m', created_at) = ?
  `).bind(orgId, thisMonth).first()
  
  // 今月の完了件数
  const completedThisMonthResult = await DB.prepare(`
    SELECT COUNT(*) as count FROM clients 
    WHERE organization_id = ? AND status = 'completed' AND strftime('%Y-%m', updated_at) = ?
  `).bind(orgId, thisMonth).first()
  
  return c.json({
    total: totalResult.count,
    byStatus: statusResult.results,
    newThisMonth: newThisMonthResult.count,
    completedThisMonth: completedThisMonthResult.count
  })
})

// 顧客クイックビュー取得（モーダル用）
routes.get('/clients/:id/quick-view', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const tab = c.req.query('tab') || 'info'
  const user = await getCurrentUser(c)

  // organization_idでテナント分離
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }

  try {
    // 顧客基本情報を取得（テナント分離）
    const client = await DB.prepare(`
      SELECT * FROM clients WHERE id = ? AND organization_id = ?
    `).bind(id, orgId).first() as any

    if (!client) {
      return c.json({ error: 'Client not found' }, 404)
    }
    
    // 案件数を取得
    const caseCountResult = await DB.prepare(`
      SELECT COUNT(*) as count FROM cases WHERE client_id = ?
    `).bind(id).first() as any
    
    const baseData = {
      id: client.id,
      name: client.name,
      company_name: client.company_name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      notes: client.notes,
      created_at: client.created_at,
      case_count: caseCountResult?.count || 0
    }
    
    // タブに応じて追加データを取得
    if (tab === 'cases') {
      // 案件一覧
      const casesResult = await DB.prepare(`
        SELECT 
          c.id, c.case_number, c.status, c.result, c.approved_amount,
          c.created_at, c.access_token,
          st.name as subsidy_type_name
        FROM cases c
        LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
        WHERE c.client_id = ?
        ORDER BY c.created_at DESC
      `).bind(id).all()
      
      return c.json({
        ...baseData,
        cases: casesResult.results || []
      })
    }
    
    if (tab === 'documents') {
      // 書類一覧（client_idで直接取得、またはcasesテーブル経由）
      const docsResult = await DB.prepare(`
        SELECT 
          d.id, d.document_type, d.file_name, d.status, d.uploaded_at as created_at
        FROM documents d
        WHERE d.client_id = ?
        ORDER BY d.uploaded_at DESC
        LIMIT 20
      `).bind(id).all()
      
      return c.json({
        ...baseData,
        documents: docsResult.results || []
      })
    }
    
    // デフォルト: 基本情報のみ
    return c.json(baseData)
    
  } catch (error: any) {
    console.error('Client quick-view error:', error)
    return c.json({ error: error.message || 'Unknown error' }, 500)
  }
})

// 顧客詳細取得（案件一覧も含む）
routes.get('/clients/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)

  // organization_idでテナント分離
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }

  const client = await DB.prepare(`
    SELECT * FROM clients WHERE id = ? AND organization_id = ?
  `).bind(id, orgId).first()

  if (!client) {
    return c.json({ error: 'Client not found' }, 404)
  }
  
  // 案件一覧も取得
  const casesResult = await DB.prepare(`
    SELECT cases.*, subsidy_types.name as subsidy_type_name
    FROM cases
    LEFT JOIN subsidy_types ON cases.subsidy_type_id = subsidy_types.id
    WHERE cases.client_id = ?
    ORDER BY cases.created_at DESC
  `).bind(id).all()
  
  const cases = casesResult.results || []
  
  // adminロール以外は、顧客の担当者か、いずれかの案件の担当者である必要がある
  if (user && user.role !== 'admin') {
    const isClientAssignee = client.assigned_to === user.username
    const isCaseAssignee = cases.some((c: any) => c.assigned_to === user.username)
    
    // デバッグ用: マッチしない場合の詳細情報
    console.log('Access check:', {
      userUsername: user.username,
      userRole: user.role,
      clientAssignedTo: client.assigned_to,
      caseAssignees: cases.map((c: any) => c.assigned_to),
      isClientAssignee,
      isCaseAssignee
    })
    
    if (!isClientAssignee && !isCaseAssignee) {
      return c.json({ error: 'Access denied' }, 403)
    }
  }
  
  return c.json({
    ...client,
    cases: cases
  })
})

// 顧客新規登録（基本情報のみ。案件は別途 /api/cases で登録）
routes.post('/clients', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離（|| 1 フォールバック廃止）
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // 顧客用のアクセストークンを生成（レガシー互換用、実際の案件アクセスはcasesテーブルのトークンを使用）
  const accessToken = crypto.randomUUID().replace(/-/g, '').substring(0, 20)
  
  // 顧客基本情報のみ登録（案件情報は別途casesテーブルに登録）
  const result = await DB.prepare(`
    INSERT INTO clients (name, company_name, email, phone, address, assigned_staff, assigned_to, access_token, organization_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.name,
    data.company_name || null,
    data.email || null,
    data.phone || null,
    data.address || null,
    data.assigned_staff || null,
    data.assigned_to || null,
    accessToken,
    orgId
  ).run()
  
  return c.json({ 
    id: result.meta.last_row_id
  })
})

// 顧客情報更新
routes.put('/clients/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  const user = await getCurrentUser(c)

  // organization_idでテナント分離
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }

  // completedステータスへの変更はadminのみ許可
  if (data.status === 'completed' && user && user.role !== 'admin') {
    return c.json({ error: 'プロジェクトの完了処理は管理者のみ実行できます' }, 403)
  }

  await DB.prepare(`
    UPDATE clients
    SET name = ?, company_name = ?, email = ?, phone = ?,
        status = ?, assigned_staff = ?, assigned_to = ?, notes = ?, subsidy_type_id = ?,
        deposit_required = ?, deposit_amount = ?, withholding_tax = ?, contract_url = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).bind(
    data.name,
    data.company_name || null,
    data.email || null,
    data.phone || null,
    data.status,
    data.assigned_staff || null,
    data.assigned_to || null,
    data.notes || null,
    data.subsidy_type_id || null,
    data.deposit_required !== undefined ? data.deposit_required : 0,
    data.deposit_amount || 0,
    data.withholding_tax !== undefined ? data.withholding_tax : 0,
    data.contract_url || null,
    id,
    orgId
  ).run()

  return c.json({ success: true })
})

// 顧客部分更新（PATCH）
routes.patch('/clients/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  const user = await getCurrentUser(c)

  // organization_idでテナント分離
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }

  // 現在の顧客データを取得（テナント分離）
  const current = await DB.prepare('SELECT * FROM clients WHERE id = ? AND organization_id = ?').bind(id, orgId).first()
  if (!current) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  // 更新対象のフィールドのみマージ
  const updated = {
    name: data.name !== undefined ? data.name : current.name,
    company_name: data.company_name !== undefined ? data.company_name : current.company_name,
    email: data.email !== undefined ? data.email : current.email,
    phone: data.phone !== undefined ? data.phone : current.phone,
    address: data.address !== undefined ? data.address : current.address,
    notes: data.notes !== undefined ? data.notes : current.notes
  }
  
  await DB.prepare(`
    UPDATE clients 
    SET name = ?, company_name = ?, email = ?, phone = ?, address = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).bind(
    updated.name,
    updated.company_name,
    updated.email,
    updated.phone,
    updated.address,
    updated.notes,
    id,
    orgId
  ).run()

  return c.json({ success: true, message: '顧客情報を更新しました' })
})

// 顧客削除（adminのみ）
routes.delete('/clients/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  const keepCustomer = c.req.query('keep_customer') === 'true'

  // adminのみ削除可能
  if (!user || user.role !== 'admin') {
    return c.json({ error: '顧客の削除は管理者のみ実行できます' }, 403)
  }

  // organization_idでテナント分離
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }

  // 削除対象が自組織の顧客か確認
  const clientCheck = await DB.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').bind(id, orgId).first()
  if (!clientCheck) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  try {
    if (keepCustomer) {
      // 案件情報のみリセット（顧客情報は保持）
      // casesテーブルの案件を削除（案件に紐づくデータはCASCADEで削除される）
      await DB.prepare(`DELETE FROM cases WHERE client_id = ?`).bind(id).run()
      
      // 旧形式のデータも削除（client_idで直接紐づいているもの）
      await DB.prepare(`DELETE FROM documents WHERE client_id = ?`).bind(id).run()
      await DB.prepare(`DELETE FROM communications WHERE client_id = ?`).bind(id).run()
      await DB.prepare(`DELETE FROM hearing_answers WHERE client_id = ?`).bind(id).run()
      await DB.prepare(`DELETE FROM client_pipelines WHERE client_id = ?`).bind(id).run()
      await DB.prepare(`DELETE FROM generated_documents WHERE client_id = ?`).bind(id).run()
      
      // 顧客の案件情報をリセット（旧形式の互換性のため）
      await DB.prepare(`
        UPDATE clients SET
          subsidy_type_id = NULL,
          status = 'inquiry',
          deposit_required = 0,
          deposit_amount = 0,
          deposit_paid = 0,
          deposit_paid_at = NULL,
          deposit_transfer_reported = 0,
          deposit_transfer_reported_at = NULL,
          notes = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(id).run()
      
      return c.json({ 
        success: true,
        message: '案件情報をリセットしました（顧客情報は保持）'
      })
    } else {
      // 顧客を完全削除（関連データも削除される：ON DELETE CASCADE）
      await DB.prepare(`DELETE FROM clients WHERE id = ?`).bind(id).run()
      
      return c.json({ 
        success: true,
        message: '顧客を削除しました'
      })
    }
  } catch (error: any) {
    console.error('Delete client error:', error)
    return c.json({ error: error.message || '削除に失敗しました' }, 500)
  }
})

export default routes
