// API: 共通書類（顧客単位、全案件で共有）
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 共通書類タイプ一覧取得
routes.get('/common-document-types', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT * FROM common_document_types ORDER BY display_order ASC
  `).all()
  
  return c.json(result.results || [])
})

// 共通書類タイプの初期化・更新（決算書3期分対応など）
routes.post('/common-document-types/initialize', async (c) => {
  const { DB } = c.env
  
  // デフォルトの共通書類タイプ
  const defaultTypes = [
    { name: '登記簿謄本', description: '法人登記簿謄本（3ヶ月以内）', validity_months: 3, max_versions: 1, display_order: 1 },
    { name: '決算書', description: '損益計算書・貸借対照表（最大3期分保存可能）', validity_months: null, max_versions: 3, display_order: 2 },
    { name: '確定申告書', description: '法人税確定申告書（最大3期分保存可能）', validity_months: null, max_versions: 3, display_order: 3 },
    { name: '会社概要', description: '会社案内・パンフレット等', validity_months: null, max_versions: 1, display_order: 4 },
    { name: '印鑑証明書', description: '法人印鑑証明書（3ヶ月以内）', validity_months: 3, max_versions: 1, display_order: 5 },
    { name: '納税証明書', description: '納税証明書（3ヶ月以内）', validity_months: 3, max_versions: 1, display_order: 6 },
    { name: '定款', description: '会社定款', validity_months: null, max_versions: 1, display_order: 7 },
    { name: '役員名簿', description: '役員一覧', validity_months: null, max_versions: 1, display_order: 8 }
  ]
  
  let updated = 0
  let inserted = 0
  
  for (const type of defaultTypes) {
    // 既存チェック
    const existing = await DB.prepare(`
      SELECT id FROM common_document_types WHERE name = ?
    `).bind(type.name).first()
    
    if (existing) {
      // 既存の場合は更新（max_versions, validity_months, description）
      await DB.prepare(`
        UPDATE common_document_types 
        SET max_versions = ?, validity_months = ?, description = ?, display_order = ?
        WHERE name = ?
      `).bind(type.max_versions, type.validity_months, type.description, type.display_order, type.name).run()
      updated++
    } else {
      // 新規追加
      await DB.prepare(`
        INSERT INTO common_document_types (name, description, validity_months, max_versions, display_order)
        VALUES (?, ?, ?, ?, ?)
      `).bind(type.name, type.description, type.validity_months, type.max_versions, type.display_order).run()
      inserted++
    }
  }
  
  return c.json({ 
    success: true, 
    message: `共通書類タイプを初期化しました（新規: ${inserted}件、更新: ${updated}件）`,
    inserted,
    updated
  })
})

// 顧客の共通書類一覧取得
routes.get('/clients/:clientId/common-documents', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const result = await DB.prepare(`
    SELECT cd.*, cdt.validity_months, cdt.max_versions, cdt.description as type_description
    FROM client_common_documents cd
    LEFT JOIN common_document_types cdt ON cd.document_type = cdt.name
    WHERE cd.client_id = ? AND cd.status = 'active'
    ORDER BY cdt.display_order ASC, cd.uploaded_at DESC
  `).bind(clientId).all()
  
  return c.json(result.results || [])
})

// 共通書類アップロード
routes.post('/clients/:clientId/common-documents', async (c) => {
  const { DB, R2 } = c.env
  const clientId = c.req.param('clientId')
  
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('document_type') as string
    const fiscalYear = formData.get('fiscal_year') as string || null
    const notes = formData.get('notes') as string || null
    
    if (!file || !documentType) {
      return c.json({ error: 'ファイルと書類種別は必須です' }, 400)
    }
    
    // 書類タイプの設定を取得
    const docTypeConfig = await DB.prepare(`
      SELECT * FROM common_document_types WHERE name = ?
    `).bind(documentType).first() as any
    
    // 有効期限を計算
    let validUntil = null
    if (docTypeConfig?.validity_months) {
      const date = new Date()
      date.setMonth(date.getMonth() + docTypeConfig.validity_months)
      validUntil = date.toISOString().split('T')[0]
    }
    
    // 最大バージョン数を超える場合、古いものを置換
    if (docTypeConfig?.max_versions) {
      const existingDocs = await DB.prepare(`
        SELECT id FROM client_common_documents 
        WHERE client_id = ? AND document_type = ? AND status = 'active'
        ORDER BY uploaded_at ASC
      `).bind(clientId, documentType).all()
      
      const docs = existingDocs.results || []
      if (docs.length >= docTypeConfig.max_versions) {
        // 古いドキュメントを置換済みにする
        const toReplace = docs.slice(0, docs.length - docTypeConfig.max_versions + 1)
        for (const doc of toReplace) {
          await DB.prepare(`
            UPDATE client_common_documents SET status = 'replaced' WHERE id = ?
          `).bind((doc as any).id).run()
        }
      }
    }
    
    // R2にアップロード
    const fileName = file.name
    const arrayBuffer = await file.arrayBuffer()
    const filePath = `common-docs/${clientId}/${Date.now()}_${fileName}`
    
    await R2.put(filePath, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    })
    
    // DBに登録
    const result = await DB.prepare(`
      INSERT INTO client_common_documents 
      (client_id, document_type, file_name, file_path, file_size, fiscal_year, valid_until, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      clientId,
      documentType,
      fileName,
      filePath,
      file.size,
      fiscalYear,
      validUntil,
      notes
    ).run()
    
    return c.json({ 
      success: true, 
      id: result.meta.last_row_id,
      valid_until: validUntil
    })
  } catch (error: any) {
    console.error('Common document upload error:', error)
    return c.json({ error: error.message || 'アップロードに失敗しました' }, 500)
  }
})

// 共通書類ダウンロード
routes.get('/common-documents/:id/download', async (c) => {
  const { DB, R2 } = c.env
  const id = c.req.param('id')
  
  const doc = await DB.prepare(`
    SELECT * FROM client_common_documents WHERE id = ?
  `).bind(id).first() as any
  
  if (!doc) {
    return c.json({ error: 'Document not found' }, 404)
  }
  
  const object = await R2.get(doc.file_path)
  
  if (!object) {
    return c.json({ error: 'File not found in storage' }, 404)
  }
  
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${doc.file_name}"`
    }
  })
})

// 共通書類削除（ステータスをinactiveに）
routes.delete('/common-documents/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare(`
    UPDATE client_common_documents SET status = 'replaced' WHERE id = ?
  `).bind(id).run()
  
  return c.json({ success: true })
})

// 共通書類の有効期限チェック・更新
routes.post('/clients/:clientId/common-documents/check-validity', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  // 期限切れの書類を expired に更新
  await DB.prepare(`
    UPDATE client_common_documents 
    SET status = 'expired' 
    WHERE client_id = ? AND status = 'active' AND valid_until IS NOT NULL AND valid_until < date('now')
  `).bind(clientId).run()
  
  return c.json({ success: true })
})

export default routes
