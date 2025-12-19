// API: 書類管理
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 顧客の書類一覧取得（後方互換性のため残す）
routes.get('/clients/:id/documents', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // まず案件テーブルから取得を試みる
  const caseResult = await DB.prepare(`
    SELECT d.* FROM documents d
    INNER JOIN cases c ON d.case_id = c.id
    WHERE c.client_id = ?
    ORDER BY d.uploaded_at DESC
  `).bind(id).all()
  
  if (caseResult.results && caseResult.results.length > 0) {
    return c.json(caseResult.results)
  }
  
  // フォールバック: 直接client_idで検索
  const result = await DB.prepare(`
    SELECT * FROM documents WHERE client_id = ? ORDER BY uploaded_at DESC
  `).bind(id).all()
  
  return c.json(result.results)
})

// 書類アップロード（実際のファイルをR2に保存）
routes.post('/clients/:id/documents/upload', async (c) => {
  const { DB, R2 } = c.env
  const id = c.req.param('id')
  
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('document_type') as string
    const uploadedBy = formData.get('uploaded_by') as string
    const caseId = formData.get('case_id') as string
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }
    
    if (!documentType) {
      return c.json({ error: 'No document_type provided' }, 400)
    }
    
    // R2にファイル保存
    const timestamp = Date.now()
    const fileName = `${timestamp}-${file.name}`
    const filePath = `documents/${id}/${fileName}`
    
    await R2.put(filePath, file.stream(), {
      httpMetadata: {
        contentType: file.type
      }
    })
    
    // メタデータをD1に保存（case_id を含める）
    const result = await DB.prepare(`
      INSERT INTO documents (client_id, case_id, document_type, file_name, file_path, file_size, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      caseId || null,
      documentType,
      file.name,
      filePath,
      file.size,
      uploadedBy || 'client'
    ).run()
    
    // 顧客からのアップロードの場合、管理者に通知を作成
    if (uploadedBy === 'client') {
      const client = await DB.prepare(`SELECT name, company_name FROM clients WHERE id = ?`).bind(id).first()
      const clientName = client?.company_name || client?.name || '顧客'
      await DB.prepare(`
        INSERT INTO admin_notifications (notification_type, title, message, related_id, related_table)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        'document_upload',
        '書類がアップロードされました',
        `${clientName}様が「${documentType}」をアップロードしました`,
        id,
        'clients'
      ).run()
    }
    
    return c.json({ 
      id: result.meta.last_row_id,
      file_path: filePath
    })
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// ファイルダウンロード
routes.get('/documents/:id/download', async (c) => {
  const { DB, R2 } = c.env
  const id = c.req.param('id')
  
  // ドキュメント情報取得
  const doc = await DB.prepare(`
    SELECT * FROM documents WHERE id = ?
  `).bind(id).first()
  
  if (!doc) {
    return c.json({ error: 'Document not found' }, 404)
  }
  
  // R2からファイル取得
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

// 案件の書類一括ダウンロード（ZIP）
routes.get('/cases/:id/documents/download-all', async (c) => {
  const { DB, R2 } = c.env
  const caseId = c.req.param('id')
  
  // 案件情報取得
  const caseInfo = await DB.prepare(`
    SELECT c.*, cl.name as client_name, cl.company_name, st.name as subsidy_name
    FROM cases c
    LEFT JOIN clients cl ON c.client_id = cl.id
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(caseId).first()
  
  if (!caseInfo) {
    return c.json({ error: 'Case not found' }, 404)
  }
  
  // 案件に紐づく書類を取得（case_idまたはclient_idで取得）
  let documents: any = { results: [] }
  try {
    documents = await DB.prepare(`
      SELECT * FROM documents 
      WHERE case_id = ? OR (case_id IS NULL AND client_id = ?)
    `).bind(caseId, caseInfo.client_id).all()
  } catch (e) {
    console.error('Error fetching documents:', e)
  }
  
  // 顧客の共通書類も取得（テーブルが存在しない場合はスキップ）
  let commonDocs: any = { results: [] }
  try {
    commonDocs = await DB.prepare(`
      SELECT cd.*, cdt.name as type_name
      FROM client_common_documents cd
      LEFT JOIN common_document_types cdt ON cd.document_type = cdt.name
      WHERE cd.client_id = ? AND cd.status = 'active'
    `).bind(caseInfo.client_id).all()
  } catch (e) {
    console.error('Error fetching common documents:', e)
    // テーブルが存在しない場合は空配列
  }
  
  const allDocs = [
    ...(documents.results || []).map((d: any) => ({ ...d, isCommon: false })),
    ...(commonDocs.results || []).map((d: any) => ({ ...d, isCommon: true }))
  ]
  
  if (allDocs.length === 0) {
    return c.json({ error: 'No documents found for this case', success: false }, 404)
  }
  
  // Cloudflare WorkersではJSZipが重いため、ファイルリストをJSON返却
  const fileList: any[] = []
  
  for (const doc of allDocs) {
    const filePath = doc.file_path
    if (!filePath) continue
    
    try {
      const object = await R2.get(filePath)
      
      if (object) {
        const arrayBuffer = await object.arrayBuffer()
        
        // ArrayBufferを直接Base64に変換（btoa/atoaを使わずに安全に変換）
        const bytes = new Uint8Array(arrayBuffer)
        
        // ファイルサイズ制限チェック（10MB以上はスキップ）
        if (bytes.length > 10 * 1024 * 1024) {
          console.warn(`File ${doc.file_name} is too large (${bytes.length} bytes), skipping`)
          continue
        }
        
        // チャンクごとに文字列に変換（スタックオーバーフロー回避）
        let binaryString = ''
        const chunkSize = 1024  // 小さなチャンクで処理
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
          for (let j = 0; j < chunk.length; j++) {
            binaryString += String.fromCharCode(chunk[j])
          }
        }
        const base64 = btoa(binaryString)
        
        // フォルダ構成: 共通書類/書類タイプ/ファイル または 案件名_補助金名/書類タイプ/ファイル
        const caseFolderName = `${caseInfo.company_name || caseInfo.client_name || '案件'}_${caseInfo.subsidy_name || '申請'}`.replace(/[\\/:*?"<>|]/g, '_')
        const folderPath = doc.isCommon 
          ? `共通書類/${doc.type_name || doc.document_type || 'その他'}` 
          : `${caseFolderName}/${doc.document_type || 'その他'}`
        
        fileList.push({
          name: `${folderPath}/${doc.file_name}`,
          data: base64,
          contentType: object.httpMetadata?.contentType || 'application/octet-stream'
        })
      }
    } catch (error) {
      console.error(`Error processing file ${doc.file_name}:`, error)
      // エラーが発生したファイルはスキップして続行
    }
  }
  
  // クライアント側でZIP生成するためのデータを返す
  const clientName = caseInfo.company_name || caseInfo.client_name || '顧客'
  const subsidyName = caseInfo.subsidy_name || '案件'
  
  return c.json({
    success: true,
    zipFileName: `${clientName}_${subsidyName}_書類一式.zip`,
    files: fileList,
    totalFiles: fileList.length
  })
})

// 書類ステータス更新
routes.put('/documents/:id/status', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { status } = await c.req.json()
  
  console.log(`Updating document ${id} status to ${status}`)
  
  const result = await DB.prepare(`
    UPDATE documents SET status = ? WHERE id = ?
  `).bind(status, id).run()
  
  console.log('Update result:', JSON.stringify(result))
  
  // 更新後のデータを確認
  const updated = await DB.prepare(`SELECT id, status FROM documents WHERE id = ?`).bind(id).first()
  console.log('Updated document:', JSON.stringify(updated))
  
  return c.json({ success: true, updated })
})

export default routes
