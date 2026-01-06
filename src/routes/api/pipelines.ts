// パイプライン管理API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// ツリー構造でパイプラインテンプレート一覧取得
routes.get('/pipeline-templates', async (c) => {
  const { DB } = c.env
  const category = c.req.query('category')
  const subsidyTypeId = c.req.query('subsidy_type_id')
  const treeView = c.req.query('tree') === 'true'
  const masterOnly = c.req.query('master_only') === 'true'  // マスターテンプレートのみ
  const orgOnly = c.req.query('org_only') === 'true'  // 組織テンプレートのみ
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  // パイプラインテンプレートのクエリ
  // - マスターテンプレート (is_master_template = 1) は全組織で表示
  // - 組織テンプレート (is_master_template = 0) は該当組織のみ表示
  let query = `
    SELECT pt.*, 
           (SELECT COUNT(*) FROM pipeline_template_tasks WHERE template_id = pt.id) as task_count
    FROM pipeline_templates pt
    WHERE pt.is_active = 1
  `
  
  const params: any[] = []
  
  // マスターのみ/組織のみフィルター
  if (masterOnly) {
    query += ` AND pt.is_master_template = 1`
  } else if (orgOnly) {
    // 組織テンプレートのみ（マスターから複製したもの含む）
    if (orgId) {
      query += ` AND pt.is_master_template = 0 AND pt.organization_id = ?`
      params.push(orgId)
    } else {
      // 組織IDがない場合は空配列を返す
      return c.json([])
    }
  } else {
    // 両方表示: マスターテンプレート OR 自組織のテンプレート
    if (orgId) {
      query += ` AND (pt.is_master_template = 1 OR pt.organization_id = ?)`
      params.push(orgId)
    } else {
      // 組織IDがない場合はマスターテンプレートのみ
      query += ` AND pt.is_master_template = 1`
    }
  }
  
  // カテゴリでフィルタリング（パラメータバインディングでSQLインジェクション対策）
  // 許可されたカテゴリのみ
  const allowedCategories = ['subsidy', 'grant', 'license']
  if (category && allowedCategories.includes(category)) {
    query += ` AND pt.category = ?`
    params.push(category)
  }
  
  // 親のみを取得するフラグ（tree表示時は親からスタート）
  if (treeView) {
    query += ` ORDER BY pt.is_master_template DESC, COALESCE(pt.parent_id, pt.id), pt.parent_id IS NOT NULL, pt.display_order, pt.id`
  } else {
    query += ` ORDER BY pt.is_master_template DESC, pt.display_order, pt.id`
  }
  
  const templates = params.length > 0 
    ? await DB.prepare(query).bind(...params).all()
    : await DB.prepare(query).all()
  let results = templates.results || []
  
  // 申請種別IDが指定されている場合、紐付けられたパイプラインのみを返す
  if (subsidyTypeId) {
    const targetId = parseInt(subsidyTypeId)
    results = results.filter((t: any) => {
      // subsidy_type_idsがnullまたは空の場合は表示しない（明示的に紐付けが必要）
      if (!t.subsidy_type_ids) return false
      
      try {
        const ids = JSON.parse(t.subsidy_type_ids)
        if (Array.isArray(ids) && ids.length > 0) {
          return ids.includes(targetId)
        }
        return false // 空配列の場合も表示しない
      } catch {
        return false // JSON解析エラーの場合も表示しない
      }
    })
  }
  
  // ツリー構造に変換
  if (treeView) {
    const treeData = buildPipelineTree(results)
    return c.json(treeData)
  }
  
  return c.json(results)
})

// パイプラインをツリー構造に変換するヘルパー関数
function buildPipelineTree(templates: any[]): any[] {
  const map = new Map<number, any>()
  const roots: any[] = []
  
  // まず全てのテンプレートをマップに登録
  for (const t of templates) {
    map.set(t.id, { ...t, children: [] })
  }
  
  // 親子関係を構築
  for (const t of templates) {
    const node = map.get(t.id)
    if (t.parent_id && map.has(t.parent_id)) {
      const parent = map.get(t.parent_id)
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  
  return roots
}

// パイプラインテンプレート詳細取得
routes.get('/pipeline-templates/:id', async (c) => {
  const { DB } = c.env
  const templateId = c.req.param('id')
  
  // パイプラインテンプレートは全組織共通のマスターデータ
  const template = await DB.prepare(`
    SELECT * FROM pipeline_templates WHERE id = ?
  `).bind(templateId).first()
  
  if (!template) {
    return c.json({ error: 'テンプレートが見つかりません' }, 404)
  }
  
  const tasks = await DB.prepare(`
    SELECT * FROM pipeline_template_tasks 
    WHERE template_id = ? 
    ORDER BY sort_order ASC
  `).bind(templateId).all()
  
  return c.json({
    ...template,
    tasks: tasks.results || []
  })
})

// パイプラインテンプレート作成
routes.post('/pipeline-templates', async (c) => {
  try {
    const { DB } = c.env
    const user = await getCurrentUser(c)
    const orgId = getEffectiveOrgId(c, user)
    
    const data = await c.req.json()
    
    // マスターテンプレートの場合は is_master = true が必要
    // 組織テンプレートの場合は organization_id が必要
    const isMaster = data.is_master_template === true || data.is_master_template === 1
    const templateOrgId = isMaster ? null : (orgId || null)
    
    // subsidy_type_idsをJSON文字列に変換
    const subsidyTypeIds = data.subsidy_type_ids && Array.isArray(data.subsidy_type_ids) && data.subsidy_type_ids.length > 0
      ? JSON.stringify(data.subsidy_type_ids)
      : null
    
    const result = await DB.prepare(`
      INSERT INTO pipeline_templates 
      (name, description, category, service_start_offset, service_end_offset, 
       requires_approval, allow_external_tasks, progress_reflection, created_by, subsidy_type_ids,
       parent_id, display_order, is_master_template, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.name,
      data.description || '',
      data.category || 'license',
      parseInt(data.service_start_offset) || 0,
      parseInt(data.service_end_offset) || 30,
      data.requires_approval ? 1 : 0,
      data.allow_external_tasks ? 1 : 0,
      data.progress_reflection !== false ? 1 : 0,
      data.created_by || null,
      subsidyTypeIds,
      data.parent_id || null,
      parseInt(data.display_order) || 0,
      isMaster ? 1 : 0,
      templateOrgId
    ).run()
    
    const templateId = result.meta.last_row_id
    
    // タスクがある場合は追加
    if (data.tasks && Array.isArray(data.tasks)) {
      for (let i = 0; i < data.tasks.length; i++) {
        const task = data.tasks[i]
        if (!task.task_name) continue // タスク名がない場合はスキップ
        
        await DB.prepare(`
          INSERT INTO pipeline_template_tasks 
          (template_id, task_name, task_type, description, sort_order, 
           days_offset_start, days_offset_end, is_required, default_assignee_role,
           attachment_url, attachment_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          templateId,
          task.task_name,
          task.task_type || 'internal',
          task.description || '',
          i + 1,
          parseInt(task.days_offset_start) || 0,
          parseInt(task.days_offset_end) || 7,
          task.is_required !== false ? 1 : 0,
          task.default_assignee_role || null,
          task.attachment_url || null,
          task.attachment_name || null
        ).run()
      }
    }
    
    return c.json({ 
      success: true, 
      id: templateId,
      message: 'パイプラインテンプレートを作成しました' 
    })
  } catch (error: any) {
    console.error('Pipeline template create error:', error)
    return c.json({ 
      success: false, 
      error: error.message || 'パイプラインテンプレートの作成に失敗しました'
    }, 500)
  }
})

// パイプラインテンプレート更新
routes.put('/pipeline-templates/:id', async (c) => {
  try {
    const { DB } = c.env
    const templateId = c.req.param('id')
    const user = await getCurrentUser(c)
    const orgId = getEffectiveOrgId(c, user)
    
    // テンプレートの存在確認と権限チェック
    const existing = await DB.prepare(`
      SELECT id, is_master_template, organization_id FROM pipeline_templates WHERE id = ?
    `).bind(templateId).first() as any
    
    if (!existing) {
      return c.json({ error: 'テンプレートが見つかりません' }, 404)
    }
    
    // マスターテンプレートは組織側から編集不可（マスター管理画面からのみ）
    // 組織テンプレートは該当組織のみ編集可能
    if (!existing.is_master_template && existing.organization_id && orgId && existing.organization_id !== orgId) {
      return c.json({ error: 'このテンプレートを編集する権限がありません' }, 403)
    }
    
    const data = await c.req.json()
    
    // subsidy_type_idsをJSON文字列に変換
    const subsidyTypeIds = data.subsidy_type_ids && Array.isArray(data.subsidy_type_ids) && data.subsidy_type_ids.length > 0
      ? JSON.stringify(data.subsidy_type_ids)
      : null
    
    await DB.prepare(`
      UPDATE pipeline_templates SET
      name = ?, description = ?, category = ?, 
      service_start_offset = ?, service_end_offset = ?,
      requires_approval = ?, allow_external_tasks = ?, progress_reflection = ?,
      subsidy_type_ids = ?, parent_id = ?, display_order = ?,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      data.name,
      data.description || '',
      data.category || 'license',
      parseInt(data.service_start_offset) || 0,
      parseInt(data.service_end_offset) || 30,
      data.requires_approval ? 1 : 0,
      data.allow_external_tasks ? 1 : 0,
      data.progress_reflection !== false ? 1 : 0,
      subsidyTypeIds,
      data.parent_id || null,
      parseInt(data.display_order) || 0,
      templateId
    ).run()
    
    // タスクを更新（一旦削除して再作成）
    if (data.tasks && Array.isArray(data.tasks)) {
      await DB.prepare(`DELETE FROM pipeline_template_tasks WHERE template_id = ?`).bind(templateId).run()
      
      for (let i = 0; i < data.tasks.length; i++) {
        const task = data.tasks[i]
        if (!task.task_name) continue // タスク名がない場合はスキップ
        
        await DB.prepare(`
          INSERT INTO pipeline_template_tasks 
          (template_id, task_name, task_type, description, sort_order, 
           days_offset_start, days_offset_end, is_required, default_assignee_role,
           attachment_url, attachment_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          templateId,
          task.task_name,
          task.task_type || 'internal',
          task.description || '',
          i + 1,
          parseInt(task.days_offset_start) || 0,
          parseInt(task.days_offset_end) || 7,
          task.is_required !== false ? 1 : 0,
          task.default_assignee_role || null,
          task.attachment_url || null,
          task.attachment_name || null
        ).run()
      }
    }
    
    return c.json({ 
      success: true,
      message: 'パイプラインテンプレートを更新しました' 
    })
  } catch (error: any) {
    console.error('Pipeline template update error:', error)
    return c.json({ 
      success: false, 
      error: error.message || 'パイプラインテンプレートの更新に失敗しました'
    }, 500)
  }
})

// パイプラインテンプレート削除
routes.delete('/pipeline-templates/:id', async (c) => {
  const { DB } = c.env
  const templateId = c.req.param('id')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  // テンプレートの存在確認と権限チェック
  const existing = await DB.prepare(`
    SELECT id, is_master_template, organization_id FROM pipeline_templates WHERE id = ?
  `).bind(templateId).first() as any
  
  if (!existing) {
    return c.json({ error: 'テンプレートが見つかりません' }, 404)
  }
  
  // マスターテンプレートは組織側から削除不可
  // 組織テンプレートは該当組織のみ削除可能
  if (!existing.is_master_template && existing.organization_id && orgId && existing.organization_id !== orgId) {
    return c.json({ error: 'このテンプレートを削除する権限がありません' }, 403)
  }
  
  // テンプレートを無効化（論理削除）
  await DB.prepare(`
    UPDATE pipeline_templates SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(templateId).run()
  
  return c.json({ 
    success: true,
    message: 'パイプラインテンプレートを削除しました' 
  })
})

// マスターテンプレートを組織用にコピー（複製）
routes.post('/pipeline-templates/:id/duplicate', async (c) => {
  try {
    const { DB } = c.env
    const templateId = c.req.param('id')
    const user = await getCurrentUser(c)
    const orgId = getEffectiveOrgId(c, user)
    
    if (!orgId) {
      return c.json({ error: '組織が特定できません' }, 401)
    }
    
    // 元テンプレートを取得
    const source = await DB.prepare(`
      SELECT * FROM pipeline_templates WHERE id = ? AND is_active = 1
    `).bind(templateId).first() as any
    
    if (!source) {
      return c.json({ error: '複製元のテンプレートが見つかりません' }, 404)
    }
    
    // 新しい組織テンプレートを作成
    const newName = source.name + ' (カスタマイズ)'
    const result = await DB.prepare(`
      INSERT INTO pipeline_templates 
      (name, description, category, service_start_offset, service_end_offset, 
       requires_approval, allow_external_tasks, progress_reflection, created_by, subsidy_type_ids,
       parent_id, display_order, is_master_template, organization_id, copied_from_template_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(
      newName,
      source.description || '',
      source.category,
      source.service_start_offset,
      source.service_end_offset,
      source.requires_approval,
      source.allow_external_tasks,
      source.progress_reflection,
      user?.id || null,
      source.subsidy_type_ids,
      null, // 複製されたテンプレートは親なし
      0,
      orgId,
      templateId // 複製元のIDを記録（copied_from_template_id）
    ).run()
    
    const newTemplateId = result.meta.last_row_id
    
    // タスクも複製
    const tasks = await DB.prepare(`
      SELECT * FROM pipeline_template_tasks WHERE template_id = ? ORDER BY sort_order ASC
    `).bind(templateId).all()
    
    for (const task of (tasks.results || []) as any[]) {
      await DB.prepare(`
        INSERT INTO pipeline_template_tasks 
        (template_id, task_name, task_type, description, sort_order, 
         days_offset_start, days_offset_end, is_required, default_assignee_role,
         attachment_url, attachment_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newTemplateId,
        task.task_name,
        task.task_type,
        task.description,
        task.sort_order,
        task.days_offset_start,
        task.days_offset_end,
        task.is_required,
        task.default_assignee_role,
        task.attachment_url,
        task.attachment_name
      ).run()
    }
    
    return c.json({ 
      success: true, 
      id: newTemplateId,
      message: 'テンプレートを複製しました。カスタマイズして使用できます。' 
    })
  } catch (error: any) {
    console.error('Pipeline template duplicate error:', error)
    return c.json({ 
      success: false, 
      error: error.message || 'テンプレートの複製に失敗しました'
    }, 500)
  }
})

// クライアントにパイプラインを適用
routes.post('/clients/:clientId/apply-pipeline', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const { template_id, service_start_date } = await c.req.json()
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  // テナント分離: クライアントが自組織のものか確認
  if (orgId) {
    const clientCheck = await DB.prepare(`SELECT id FROM clients WHERE id = ? AND organization_id = ?`).bind(clientId, orgId).first()
    if (!clientCheck) {
      return c.json({ error: 'アクセス権限がありません' }, 403)
    }
  }
  
  // テンプレート取得
  const template = await DB.prepare(`
    SELECT * FROM pipeline_templates WHERE id = ? AND is_active = 1
  `).bind(template_id).first()
  
  if (!template) {
    return c.json({ error: 'テンプレートが見つかりません' }, 404)
  }
  
  // 開始日を設定
  const startDate = service_start_date ? new Date(service_start_date) : new Date()
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + (template.service_end_offset || 30))
  
  // パイプライン作成
  const pipelineResult = await DB.prepare(`
    INSERT INTO client_pipelines 
    (client_id, template_id, pipeline_name, service_start_date, service_end_date, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).bind(
    clientId,
    template_id,
    template.name,
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  ).run()
  
  const pipelineId = pipelineResult.meta.last_row_id
  
  // テンプレートタスクを取得してクライアントタスクを作成
  const templateTasks = await DB.prepare(`
    SELECT * FROM pipeline_template_tasks 
    WHERE template_id = ? 
    ORDER BY sort_order ASC
  `).bind(template_id).all()
  
  for (const task of (templateTasks.results || [])) {
    const taskStart = new Date(startDate)
    taskStart.setDate(taskStart.getDate() + (task.days_offset_start || 0))
    
    const taskEnd = new Date(startDate)
    taskEnd.setDate(taskEnd.getDate() + (task.days_offset_end || 7))
    
    await DB.prepare(`
      INSERT INTO client_pipeline_tasks 
      (pipeline_id, template_task_id, task_name, task_type, description, 
       sort_order, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      pipelineId,
      task.id,
      task.task_name,
      task.task_type,
      task.description,
      task.sort_order,
      taskStart.toISOString().split('T')[0],
      taskEnd.toISOString().split('T')[0]
    ).run()
  }
  
  return c.json({ 
    success: true,
    pipeline_id: pipelineId,
    message: 'パイプラインを適用しました' 
  })
})

// クライアントのパイプライン一覧取得
// 顧客の案件一覧取得（顧客ポータル用）
// 完了してアーカイブされた案件は除外（サービス進捗から消える）
routes.get('/clients/:clientId/cases', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const showArchived = c.req.query('show_archived') === 'true'
  
  let query = `
    SELECT 
      cases.*,
      subsidy_types.name as subsidy_type_name,
      admin_users.name as assigned_to_name
    FROM cases
    LEFT JOIN subsidy_types ON cases.subsidy_type_id = subsidy_types.id
    LEFT JOIN admin_users ON cases.assigned_to = admin_users.username
    WHERE cases.client_id = ?
  `
  
  // デフォルトでアーカイブ済み（完了）案件を除外
  if (!showArchived) {
    query += ` AND (cases.is_archived = 0 OR cases.is_archived IS NULL)`
  }
  
  query += ` ORDER BY cases.created_at DESC`
  
  const cases = await DB.prepare(query).bind(clientId).all()
  
  return c.json(cases.results || [])
})

// 全アクティブパイプライン取得（案件進捗ボード用）
routes.get('/pipelines/all-active', async (c) => {
  const { DB } = c.env
  
  try {
  const user = await getCurrentUser(c)
  
  // 組織IDで絞り込み（必須）
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // アクティブな案件のパイプラインをタスク付きで取得（テナント分離必須）
  const pipelines = await DB.prepare(`
    SELECT cp.*, 
           pt.name as template_name,
           c.case_number as case_title,
           cl.name as client_name,
           cl.company_name as client_company,
           st.name as subsidy_name
    FROM client_pipelines cp
    LEFT JOIN pipeline_templates pt ON cp.template_id = pt.id
    LEFT JOIN cases c ON cp.case_id = c.id
    LEFT JOIN clients cl ON cp.client_id = cl.id
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE (c.is_archived = 0 OR c.is_archived IS NULL)
      AND cp.status = 'active'
      AND cl.organization_id = ?
    ORDER BY cp.created_at DESC
    LIMIT 50
  `).bind(orgId).all()
  
  // 各パイプラインのタスクを取得
  const result = []
  for (const pipeline of (pipelines.results || [])) {
    const tasks = await DB.prepare(`
      SELECT id, task_name, task_type, status, end_date, description, sort_order
      FROM client_pipeline_tasks
      WHERE pipeline_id = ?
      ORDER BY sort_order ASC
    `).bind(pipeline.id).all()
    
    result.push({
      ...pipeline,
      tasks: tasks.results || []
    })
  }
  
  return c.json(result)
  } catch (error: any) {
    console.error('Pipeline all-active error:', error)
    return c.json({ error: 'パイプライン取得に失敗しました', details: error.message }, 500)
  }
})

// 顧客のパイプライン一覧取得（顧客ポータル用）
// 完了してアーカイブされた案件のパイプラインは除外（サービス進捗から消える）
routes.get('/clients/:clientId/pipelines', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const showArchived = c.req.query('show_archived') === 'true'
  const caseId = c.req.query('case_id')
  
  let query = `
    SELECT cp.*, pt.name as template_name,
           st.name as subsidy_name,
           (SELECT COUNT(*) FROM client_pipeline_tasks WHERE pipeline_id = cp.id) as total_tasks,
           (SELECT COUNT(*) FROM client_pipeline_tasks WHERE pipeline_id = cp.id AND status = 'completed') as completed_tasks
    FROM client_pipelines cp
    LEFT JOIN pipeline_templates pt ON cp.template_id = pt.id
    LEFT JOIN cases ON cp.case_id = cases.id
    LEFT JOIN subsidy_types st ON cases.subsidy_type_id = st.id
    WHERE cp.client_id = ?
  `
  
  const params: any[] = [clientId]
  
  // 案件IDで絞り込み
  if (caseId) {
    query += ` AND cp.case_id = ?`
    params.push(caseId)
  }
  
  // デフォルトでアーカイブ済み（完了）案件のパイプラインを除外
  if (!showArchived) {
    query += ` AND (cases.is_archived = 0 OR cases.is_archived IS NULL OR cp.case_id IS NULL)`
  }
  
  query += ` ORDER BY cp.created_at DESC`
  
  const pipelines = await DB.prepare(query).bind(...params).all()
  
  return c.json(pipelines.results || [])
})

// パイプラインタスク一覧取得
routes.get('/pipelines/:pipelineId/tasks', async (c) => {
  const { DB } = c.env
  const pipelineId = c.req.param('pipelineId')
  
  const tasks = await DB.prepare(`
    SELECT cpt.*, au.name as assignee_name
    FROM client_pipeline_tasks cpt
    LEFT JOIN admin_users au ON cpt.assigned_to = au.id
    WHERE cpt.pipeline_id = ?
    ORDER BY cpt.sort_order ASC
  `).bind(pipelineId).all()
  
  return c.json(tasks.results || [])
})

// タスク更新
routes.put('/pipeline-tasks/:taskId', async (c) => {
  const { DB } = c.env
  const taskId = c.req.param('taskId')
  const data = await c.req.json()
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  // 現在の状態を取得（テナント分離: クライアント経由で組織をチェック）
  const currentTask = await DB.prepare(`
    SELECT cpt.*, cl.organization_id
    FROM client_pipeline_tasks cpt
    JOIN client_pipelines cp ON cpt.pipeline_id = cp.id
    JOIN clients cl ON cp.client_id = cl.id
    WHERE cpt.id = ?
  `).bind(taskId).first() as any
  
  if (!currentTask) {
    return c.json({ error: 'タスクが見つかりません' }, 404)
  }
  
  // テナント分離チェック
  if (orgId && currentTask.organization_id !== orgId) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }
  
  // 進捗率に応じてステータスを自動設定
  let autoStatus = data.status
  if (data.progress_percentage !== undefined) {
    const progress = parseInt(data.progress_percentage, 10)
    if (progress === 0) {
      autoStatus = 'pending'  // 0% → 未着手
    } else if (progress >= 100) {
      autoStatus = 'completed'  // 100% → 完了
    } else {
      autoStatus = 'in_progress'  // 1-99% → 進行中
    }
  }
  
  // 更新
  await DB.prepare(`
    UPDATE client_pipeline_tasks SET
    status = COALESCE(?, status),
    progress_percentage = COALESCE(?, progress_percentage),
    assigned_to = ?,
    notes = COALESCE(?, notes),
    completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    autoStatus || null,
    data.progress_percentage !== undefined ? data.progress_percentage : null,
    data.assigned_to || null,
    data.notes || null,
    autoStatus || null,
    taskId
  ).run()
  
  // 履歴を記録
  if (data.status !== currentTask.status || data.progress_percentage !== currentTask.progress_percentage) {
    await DB.prepare(`
      INSERT INTO task_history 
      (task_id, old_status, new_status, old_progress, new_progress, changed_by, change_note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      taskId,
      currentTask.status,
      data.status || currentTask.status,
      currentTask.progress_percentage,
      data.progress_percentage || currentTask.progress_percentage,
      data.changed_by || null,
      data.change_note || null
    ).run()
  }
  
  // パイプラインの進捗を更新
  const pipelineTasks = await DB.prepare(`
    SELECT status FROM client_pipeline_tasks WHERE pipeline_id = ?
  `).bind(currentTask.pipeline_id).all()
  
  const totalTasks = pipelineTasks.results?.length || 1
  const completedTasks = pipelineTasks.results?.filter((t: any) => t.status === 'completed').length || 0
  const progressPercentage = Math.round((completedTasks / totalTasks) * 100)
  
  await DB.prepare(`
    UPDATE client_pipelines SET 
    progress_percentage = ?,
    status = CASE WHEN ? = 100 THEN 'completed' ELSE status END,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(progressPercentage, progressPercentage, currentTask.pipeline_id).run()
  
  return c.json({ 
    success: true,
    message: 'タスクを更新しました',
    pipeline_progress: progressPercentage
  })
})

// パイプラインにタスクを追加
routes.post('/pipeline-tasks', async (c) => {
  try {
    const { DB } = c.env
    const data = await c.req.json()
    const user = await getCurrentUser(c)
    const orgId = getEffectiveOrgId(c, user)
    
    if (!data.pipeline_id || !data.task_name) {
      return c.json({ error: 'pipeline_id と task_name は必須です' }, 400)
    }
    
    // パイプラインが存在するか確認（テナント分離: クライアント経由で組織をチェック）
    const pipeline = await DB.prepare(`
      SELECT cp.*, cl.organization_id
      FROM client_pipelines cp
      JOIN clients cl ON cp.client_id = cl.id
      WHERE cp.id = ?
    `).bind(data.pipeline_id).first() as any
    
    if (!pipeline) {
      return c.json({ error: 'パイプラインが見つかりません' }, 404)
    }
    
    // テナント分離チェック
    if (orgId && pipeline.organization_id !== orgId) {
      return c.json({ error: 'アクセス権限がありません' }, 403)
    }
    
    // 挿入位置を計算
    const insertAfter = parseInt(data.insert_after) || 0
    let newSortOrder: number
    
    if (insertAfter === 0) {
      // 先頭に挿入: 既存タスクのsort_orderを全て+1
      await DB.prepare(`
        UPDATE client_pipeline_tasks 
        SET sort_order = sort_order + 1 
        WHERE pipeline_id = ?
      `).bind(data.pipeline_id).run()
      newSortOrder = 1
    } else {
      // 指定位置の後に挿入: insertAfterより大きいsort_orderを+1
      await DB.prepare(`
        UPDATE client_pipeline_tasks 
        SET sort_order = sort_order + 1 
        WHERE pipeline_id = ? AND sort_order > ?
      `).bind(data.pipeline_id, insertAfter).run()
      newSortOrder = insertAfter + 1
    }
    
    // タスクを追加
    const result = await DB.prepare(`
      INSERT INTO client_pipeline_tasks 
      (pipeline_id, task_name, task_type, description, sort_order, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      data.pipeline_id,
      data.task_name,
      data.task_type || 'internal',
      data.description || '',
      newSortOrder,
      data.start_date || null,
      data.end_date || null
    ).run()
    
    // パイプラインの進捗を再計算
    const pipelineTasks = await DB.prepare(`
      SELECT status FROM client_pipeline_tasks WHERE pipeline_id = ?
    `).bind(data.pipeline_id).all()
    
    const totalTasks = pipelineTasks.results?.length || 1
    const completedTasks = pipelineTasks.results?.filter((t: any) => t.status === 'completed').length || 0
    const progressPercentage = Math.round((completedTasks / totalTasks) * 100)
    
    await DB.prepare(`
      UPDATE client_pipelines SET 
      progress_percentage = ?,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(progressPercentage, data.pipeline_id).run()
    
    return c.json({ 
      success: true,
      id: result.meta.last_row_id,
      message: 'タスクを追加しました'
    })
  } catch (error: any) {
    console.error('Error adding pipeline task:', error)
    return c.json({ error: error.message || 'タスクの追加に失敗しました' }, 500)
  }
})

// 顧客がタスクを完了する（顧客ポータル用）
routes.post('/portal/tasks/:taskId/complete', async (c) => {
  const { DB } = c.env
  const taskId = c.req.param('taskId')
  const data = await c.req.json()
  const clientId = data.client_id
  
  if (!clientId) {
    return c.json({ error: 'client_id is required' }, 400)
  }
  
  // タスクを取得し、顧客対応タスクかつ該当顧客のものか確認
  const task = await DB.prepare(`
    SELECT t.*, p.client_id 
    FROM client_pipeline_tasks t
    JOIN client_pipelines p ON t.pipeline_id = p.id
    WHERE t.id = ?
  `).bind(taskId).first()
  
  if (!task) {
    return c.json({ error: 'タスクが見つかりません' }, 404)
  }
  
  if (task.client_id != clientId) {
    return c.json({ error: '権限がありません' }, 403)
  }
  
  // 顧客対応タスク（external または both）のみ完了可能
  if (task.task_type !== 'external' && task.task_type !== 'both') {
    return c.json({ error: 'このタスクは顧客側で完了できません' }, 400)
  }
  
  // ステータスを完了に更新
  await DB.prepare(`
    UPDATE client_pipeline_tasks SET
    status = 'completed',
    completed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(taskId).run()
  
  // 履歴を記録
  await DB.prepare(`
    INSERT INTO task_history 
    (task_id, old_status, new_status, old_progress, new_progress, changed_by, change_note)
    VALUES (?, ?, 'completed', ?, 100, ?, '顧客ポータルから完了')
  `).bind(
    taskId,
    task.status,
    task.progress_percentage || 0,
    '顧客'
  ).run()
  
  // パイプラインの進捗を更新
  const pipelineTasks = await DB.prepare(`
    SELECT status FROM client_pipeline_tasks WHERE pipeline_id = ?
  `).bind(task.pipeline_id).all()
  
  const totalTasks = pipelineTasks.results?.length || 1
  const completedTasks = pipelineTasks.results?.filter((t: any) => t.status === 'completed').length || 0
  const progressPercentage = Math.round((completedTasks / totalTasks) * 100)
  
  await DB.prepare(`
    UPDATE client_pipelines SET 
    progress_percentage = ?,
    status = CASE WHEN ? = 100 THEN 'completed' ELSE status END,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(progressPercentage, progressPercentage, task.pipeline_id).run()
  
  return c.json({ 
    success: true,
    message: 'タスクを完了しました',
    pipeline_progress: progressPercentage
  })
})

export default routes
