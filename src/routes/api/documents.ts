// API: 書類管理
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'
import { sendEmail, getEmailSettings, documentUploadedEmail } from '../../utils/email'

const routes = new Hono<AppEnv>()

// 顧客の書類一覧取得（後方互換性のため残す）
routes.get('/clients/:id/documents', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // organization_idでテナント分離 - クライアントが自組織のものか確認
  const clientCheck = await DB.prepare(`SELECT id FROM clients WHERE id = ? AND organization_id = ?`).bind(id, orgId).first()
  if (!clientCheck) {
    return c.json([])
  }
  
  // まず案件テーブルから取得を試みる
  const caseResult = await DB.prepare(`
    SELECT d.* FROM documents d
    INNER JOIN cases c ON d.case_id = c.id
    WHERE c.client_id = ? AND c.organization_id = ?
    ORDER BY d.uploaded_at DESC
  `).bind(id, orgId).all()
  
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
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // organization_idでテナント分離 - クライアントが自組織のものか確認
  const clientCheck = await DB.prepare(`SELECT id FROM clients WHERE id = ? AND organization_id = ?`).bind(id, orgId).first()
  if (!clientCheck) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }
  
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
      const client = await DB.prepare(`SELECT name, company_name, organization_id FROM clients WHERE id = ?`).bind(id).first() as any
      const clientName = client?.company_name || client?.name || '顧客'
      const clientOrgId = client?.organization_id
      await DB.prepare(`
        INSERT INTO admin_notifications (notification_type, title, message, related_id, related_table, organization_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        'document_upload',
        '書類がアップロードされました',
        `${clientName}様が「${documentType}」をアップロードしました`,
        id,
        'clients',
        clientOrgId
      ).run()
      
      // 管理者にメール通知を送信
      try {
        const emailSettings = await getEmailSettings(DB)
        if (emailSettings.enabled && emailSettings.apiKey) {
          // 案件情報と管理者のメールアドレスを取得
          const caseInfo = await DB.prepare(`
            SELECT c.case_number as case_name, o.slug, o.email as admin_email,
                   st.name as subsidy_name
            FROM cases c
            JOIN organizations o ON c.organization_id = o.id
            LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
            WHERE c.id = ?
          `).bind(caseId).first() as any
          
          if (caseInfo && caseInfo.admin_email) {
            const adminUrl = `https://${caseInfo.slug}.shinsei-raku.com/admin/clients/${id}`
            const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
            
            const emailContent = documentUploadedEmail({
              clientName,
              caseName: caseInfo.case_name || '（案件名なし）',
              documentName: file.name,
              documentType,
              uploadedAt: now,
              adminUrl
            })
            
            await sendEmail(emailSettings.apiKey, {
              to: caseInfo.admin_email,
              subject: emailContent.subject,
              html: emailContent.html
            }, emailSettings.fromEmail || undefined)
          }
        }
      } catch (emailError) {
        console.error('Failed to send document upload email:', emailError)
        // メール送信失敗しても書類アップロードは成功とする
      }
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

// 汎用ファイルアップロード（パイプラインタスク添付など）- 認証必須
routes.post('/documents/upload-file', async (c) => {
  const { R2 } = c.env
  const user = await getCurrentUser(c)
  
  // 認証チェック
  if (!user) {
    return c.json({ error: 'ログインが必要です' }, 401)
  }
  
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const uploadType = formData.get('upload_type') as string || 'general'
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }
    
    // 許可されたファイルタイプのみ
    const allowedTypes = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ]
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: '許可されていないファイル形式です' }, 400)
    }
    
    // ファイルサイズ制限（10MB）
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: 'File size exceeds 10MB limit' }, 400)
    }
    
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${uploadType}/${timestamp}_${safeName}`
    
    // R2にファイル保存
    await R2.put(filePath, file.stream(), {
      httpMetadata: {
        contentType: file.type
      }
    })
    
    // ダウンロード用URLを返す
    const downloadUrl = `/api/documents/download-file/${encodeURIComponent(filePath)}`
    
    return c.json({
      success: true,
      url: downloadUrl,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size
    })
  } catch (error) {
    console.error('Generic upload error:', error)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// 汎用ファイルダウンロード
routes.get('/documents/download-file/:path{.+}', async (c) => {
  const { R2 } = c.env
  const filePath = decodeURIComponent(c.req.param('path'))
  
  try {
    const object = await R2.get(filePath)
    
    if (!object) {
      return c.json({ error: 'File not found' }, 404)
    }
    
    const fileName = filePath.split('/').pop() || 'download'
    
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
      }
    })
  } catch (error) {
    console.error('Download error:', error)
    return c.json({ error: 'Download failed' }, 500)
  }
})

// ファイルダウンロード
routes.get('/documents/:id/download', async (c) => {
  const { DB, R2 } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // ドキュメント情報取得 - organization_idでテナント分離
  const doc = await DB.prepare(`
    SELECT d.* FROM documents d
    LEFT JOIN clients c ON d.client_id = c.id
    WHERE d.id = ? AND (c.organization_id = ? OR c.organization_id IS NULL)
  `).bind(id, orgId).first()
  
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
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // 案件情報取得 - organization_idでテナント分離
  const caseInfo = await DB.prepare(`
    SELECT c.*, cl.name as client_name, cl.company_name, st.name as subsidy_name
    FROM cases c
    LEFT JOIN clients cl ON c.client_id = cl.id
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ? AND c.organization_id = ?
  `).bind(caseId, orgId).first()
  
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
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // organization_idでテナント分離 - ドキュメントの所有者確認
  const docCheck = await DB.prepare(`
    SELECT d.id FROM documents d
    LEFT JOIN clients c ON d.client_id = c.id
    WHERE d.id = ? AND (c.organization_id = ? OR c.organization_id IS NULL)
  `).bind(id, orgId).first()
  
  if (!docCheck) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }
  
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
