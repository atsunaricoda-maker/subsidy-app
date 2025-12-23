// フェーズ4: バックアップ機能（JSONインポート/エクスポート）
// テナント分離: 自組織のデータのみエクスポート/インポート可能
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// JSON形式で自組織のデータをエクスポート
routes.get('/backup/export', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  if (!orgId) {
    return c.json({ error: '組織情報が取得できません' }, 403)
  }
  
  try {
    // テナント分離: 自組織のデータのみ取得
    const safeQuery = async (query: string, params: any[] = []) => {
      try {
        if (params.length > 0) {
          return await DB.prepare(query).bind(...params).all()
        }
        return await DB.prepare(query).all()
      } catch (e) {
        return { results: [] }
      }
    }

    // 自組織のクライアントIDを取得
    const clientIds = await safeQuery(
      'SELECT id FROM clients WHERE organization_id = ?',
      [orgId]
    )
    const clientIdList = (clientIds.results || []).map((c: any) => c.id)
    
    // クライアントIDがない場合は空データを返す
    if (clientIdList.length === 0) {
      const backupData = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        organization_id: orgId,
        app_name: '申請らくらく君',
        tables: {
          clients: [],
          documents: [],
          communications: [],
          hearing_answers: [],
          ai_chat_history: [],
          generated_documents: [],
          document_section_edits: [],
          client_profiles: [],
          subsidy_match_scores: [],
          cases: [],
          invoices: [],
          payment_history: [],
          client_pipelines: [],
          pipeline_tasks: []
        },
        summary: {
          total_clients: 0,
          total_documents: 0,
          total_generated_documents: 0,
          total_cases: 0
        }
      }
      
      const filename = `subsidy_app_backup_${orgId}_${new Date().toISOString().split('T')[0]}.json`
      return new Response(JSON.stringify(backupData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    }
    
    const clientIdPlaceholders = clientIdList.map(() => '?').join(',')

    const [
      clients,
      documents,
      communications,
      hearingAnswers,
      aiChatHistory,
      generatedDocuments,
      documentSectionEdits,
      clientProfiles,
      subsidyMatchScores,
      cases,
      invoices,
      paymentHistory,
      clientPipelines,
      pipelineTasks
    ] = await Promise.all([
      // 自組織のクライアントのみ
      safeQuery('SELECT * FROM clients WHERE organization_id = ?', [orgId]),
      // 自組織のクライアントに紐づくドキュメント
      safeQuery(`SELECT * FROM documents WHERE client_id IN (${clientIdPlaceholders})`, clientIdList),
      // 自組織のクライアントに紐づくコミュニケーション
      safeQuery(`SELECT * FROM communications WHERE client_id IN (${clientIdPlaceholders})`, clientIdList),
      // 自組織のクライアントに紐づくヒアリング回答
      safeQuery(`SELECT * FROM hearing_answers WHERE client_id IN (${clientIdPlaceholders})`, clientIdList),
      // 自組織のクライアントに紐づくAIチャット履歴
      safeQuery(`SELECT * FROM ai_chat_history WHERE client_id IN (${clientIdPlaceholders})`, clientIdList),
      // 自組織のクライアントに紐づく生成文書
      safeQuery(`SELECT * FROM generated_documents WHERE client_id IN (${clientIdPlaceholders})`, clientIdList),
      // 自組織のクライアントに紐づく編集履歴（generated_documents経由）
      safeQuery(`SELECT dse.* FROM document_section_edits dse 
                 JOIN generated_documents gd ON dse.document_id = gd.id 
                 WHERE gd.client_id IN (${clientIdPlaceholders})`, clientIdList),
      // 自組織のクライアントに紐づくプロファイル
      safeQuery(`SELECT * FROM client_profiles WHERE client_id IN (${clientIdPlaceholders})`, clientIdList),
      // 自組織のクライアントに紐づくマッチングスコア
      safeQuery(`SELECT * FROM subsidy_match_scores WHERE client_id IN (${clientIdPlaceholders})`, clientIdList),
      // 自組織の案件
      safeQuery('SELECT * FROM cases WHERE organization_id = ?', [orgId]),
      // 自組織の案件に紐づく請求書
      safeQuery('SELECT i.* FROM invoices i JOIN cases c ON i.case_id = c.id WHERE c.organization_id = ?', [orgId]),
      // 自組織のクライアントに紐づく支払い履歴
      safeQuery(`SELECT * FROM payment_history WHERE client_id IN (${clientIdPlaceholders})`, clientIdList),
      // 自組織のクライアントに紐づくパイプライン
      safeQuery(`SELECT * FROM client_pipelines WHERE client_id IN (${clientIdPlaceholders})`, clientIdList),
      // 自組織のクライアントに紐づくパイプラインタスク
      safeQuery(`SELECT pt.* FROM pipeline_tasks pt 
                 JOIN client_pipelines cp ON pt.pipeline_id = cp.id 
                 WHERE cp.client_id IN (${clientIdPlaceholders})`, clientIdList)
    ])

    const backupData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      organization_id: orgId,
      app_name: '申請らくらく君',
      tables: {
        clients: clients.results || [],
        documents: documents.results || [],
        communications: communications.results || [],
        hearing_answers: hearingAnswers.results || [],
        ai_chat_history: aiChatHistory.results || [],
        generated_documents: generatedDocuments.results || [],
        document_section_edits: documentSectionEdits.results || [],
        client_profiles: clientProfiles.results || [],
        subsidy_match_scores: subsidyMatchScores.results || [],
        cases: cases.results || [],
        invoices: invoices.results || [],
        payment_history: paymentHistory.results || [],
        client_pipelines: clientPipelines.results || [],
        pipeline_tasks: pipelineTasks.results || []
      },
      summary: {
        total_clients: (clients.results || []).length,
        total_documents: (documents.results || []).length,
        total_generated_documents: (generatedDocuments.results || []).length,
        total_cases: (cases.results || []).length
      }
    }

    // JSONファイルとしてダウンロード可能なレスポンスを返す
    const filename = `subsidy_app_backup_${orgId}_${new Date().toISOString().split('T')[0]}.json`
    
    return new Response(JSON.stringify(backupData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error: any) {
    console.error('Backup export error:', error)
    return c.json({ error: 'バックアップの作成に失敗しました', details: error.message }, 500)
  }
})

// バックアップ情報取得（サマリーのみ）- テナント分離
routes.get('/backup/info', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  if (!orgId) {
    return c.json({ error: '組織情報が取得できません' }, 403)
  }
  
  try {
    const [
      clientsCount,
      documentsCount,
      generatedDocsCount,
      casesCount
    ] = await Promise.all([
      DB.prepare('SELECT COUNT(*) as count FROM clients WHERE organization_id = ?').bind(orgId).first(),
      DB.prepare(`SELECT COUNT(*) as count FROM documents d 
                  JOIN clients c ON d.client_id = c.id 
                  WHERE c.organization_id = ?`).bind(orgId).first(),
      DB.prepare(`SELECT COUNT(*) as count FROM generated_documents gd 
                  JOIN clients c ON gd.client_id = c.id 
                  WHERE c.organization_id = ?`).bind(orgId).first(),
      DB.prepare('SELECT COUNT(*) as count FROM cases WHERE organization_id = ?').bind(orgId).first()
    ])

    return c.json({
      organization_id: orgId,
      summary: {
        clients: clientsCount?.count || 0,
        documents: documentsCount?.count || 0,
        generated_documents: generatedDocsCount?.count || 0,
        cases: casesCount?.count || 0
      },
      last_checked: new Date().toISOString()
    })
  } catch (error: any) {
    return c.json({ error: 'バックアップ情報の取得に失敗しました' }, 500)
  }
})

// JSON形式で自組織のデータをインポート（復元）- テナント分離
routes.post('/backup/import', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  if (!orgId) {
    return c.json({ error: '組織情報が取得できません' }, 403)
  }
  
  try {
    const backupData = await c.req.json()
    
    // バックアップデータの検証
    if (!backupData.version || !backupData.tables) {
      return c.json({ error: '無効なバックアップファイルです' }, 400)
    }
    
    // 異なる組織のバックアップはインポート不可
    if (backupData.organization_id && backupData.organization_id !== orgId) {
      return c.json({ error: '他の組織のバックアップはインポートできません' }, 403)
    }

    const results = {
      success: true,
      imported: {} as Record<string, number>,
      errors: [] as string[]
    }

    const tables = backupData.tables

    // インポート順序（外部キー制約を考慮）
    // 注意: organization_idを持つテーブルは自組織のIDで上書き
    const importOrder = [
      'clients',
      'documents',
      'communications',
      'hearing_answers',
      'ai_chat_history',
      'generated_documents',
      'document_section_edits',
      'client_profiles',
      'subsidy_match_scores',
      'cases',
      'invoices',
      'payment_history',
      'client_pipelines',
      'pipeline_tasks'
    ]

    // 既存の自組織データを削除（オプション）
    const clearExisting = backupData.clear_existing !== false
    
    if (clearExisting) {
      // 自組織のクライアントIDを取得して関連データを削除
      const existingClients = await DB.prepare(
        'SELECT id FROM clients WHERE organization_id = ?'
      ).bind(orgId).all()
      
      const existingClientIds = (existingClients.results || []).map((c: any) => c.id)
      
      if (existingClientIds.length > 0) {
        const placeholders = existingClientIds.map(() => '?').join(',')
        
        // 関連テーブルから削除（逆順）
        try {
          await DB.prepare(`DELETE FROM pipeline_tasks WHERE pipeline_id IN (SELECT id FROM client_pipelines WHERE client_id IN (${placeholders}))`).bind(...existingClientIds).run()
          await DB.prepare(`DELETE FROM client_pipelines WHERE client_id IN (${placeholders})`).bind(...existingClientIds).run()
          await DB.prepare(`DELETE FROM payment_history WHERE client_id IN (${placeholders})`).bind(...existingClientIds).run()
          await DB.prepare(`DELETE FROM document_section_edits WHERE document_id IN (SELECT id FROM generated_documents WHERE client_id IN (${placeholders}))`).bind(...existingClientIds).run()
          await DB.prepare(`DELETE FROM generated_documents WHERE client_id IN (${placeholders})`).bind(...existingClientIds).run()
          await DB.prepare(`DELETE FROM subsidy_match_scores WHERE client_id IN (${placeholders})`).bind(...existingClientIds).run()
          await DB.prepare(`DELETE FROM client_profiles WHERE client_id IN (${placeholders})`).bind(...existingClientIds).run()
          await DB.prepare(`DELETE FROM ai_chat_history WHERE client_id IN (${placeholders})`).bind(...existingClientIds).run()
          await DB.prepare(`DELETE FROM hearing_answers WHERE client_id IN (${placeholders})`).bind(...existingClientIds).run()
          await DB.prepare(`DELETE FROM communications WHERE client_id IN (${placeholders})`).bind(...existingClientIds).run()
          await DB.prepare(`DELETE FROM documents WHERE client_id IN (${placeholders})`).bind(...existingClientIds).run()
        } catch (e) {
          console.warn('Error clearing related data:', e)
        }
        
        // 案件関連
        await DB.prepare('DELETE FROM invoices WHERE case_id IN (SELECT id FROM cases WHERE organization_id = ?)').bind(orgId).run()
        await DB.prepare('DELETE FROM cases WHERE organization_id = ?').bind(orgId).run()
        
        // クライアント削除
        await DB.prepare('DELETE FROM clients WHERE organization_id = ?').bind(orgId).run()
      }
    }

    // IDマッピング（古いID → 新しいID）
    const clientIdMap = new Map<number, number>()
    const caseIdMap = new Map<number, number>()
    const generatedDocIdMap = new Map<number, number>()
    const pipelineIdMap = new Map<number, number>()

    for (const tableName of importOrder) {
      const records = tables[tableName]
      if (!records || !Array.isArray(records) || records.length === 0) {
        results.imported[tableName] = 0
        continue
      }

      try {
        let importedCount = 0
        
        for (const record of records) {
          try {
            // organization_idを自組織のIDで上書き
            if ('organization_id' in record) {
              record.organization_id = orgId
            }
            
            // client_idのマッピング
            if ('client_id' in record && clientIdMap.has(record.client_id)) {
              record.client_id = clientIdMap.get(record.client_id)
            }
            
            // case_idのマッピング
            if ('case_id' in record && caseIdMap.has(record.case_id)) {
              record.case_id = caseIdMap.get(record.case_id)
            }
            
            // document_idのマッピング（generated_documents用）
            if ('document_id' in record && generatedDocIdMap.has(record.document_id)) {
              record.document_id = generatedDocIdMap.get(record.document_id)
            }
            
            // pipeline_idのマッピング
            if ('pipeline_id' in record && pipelineIdMap.has(record.pipeline_id)) {
              record.pipeline_id = pipelineIdMap.get(record.pipeline_id)
            }
            
            // IDを除外して挿入（自動採番）
            const oldId = record.id
            delete record.id
            
            const columns = Object.keys(record)
            const values = Object.values(record)
            const placeholders = columns.map(() => '?').join(', ')
            
            const result = await DB.prepare(`
              INSERT INTO ${tableName} (${columns.join(', ')}) 
              VALUES (${placeholders})
            `).bind(...values).run()
            
            const newId = result.meta.last_row_id
            
            // IDマッピングを保存
            if (tableName === 'clients' && oldId && newId) {
              clientIdMap.set(oldId, newId as number)
            } else if (tableName === 'cases' && oldId && newId) {
              caseIdMap.set(oldId, newId as number)
            } else if (tableName === 'generated_documents' && oldId && newId) {
              generatedDocIdMap.set(oldId, newId as number)
            } else if (tableName === 'client_pipelines' && oldId && newId) {
              pipelineIdMap.set(oldId, newId as number)
            }
            
            importedCount++
          } catch (insertError: any) {
            console.warn(`Insert error for ${tableName}:`, insertError.message)
          }
        }
        
        results.imported[tableName] = importedCount
      } catch (tableError: any) {
        results.errors.push(`${tableName}: ${tableError.message}`)
      }
    }

    if (results.errors.length > 0) {
      results.success = false
    }

    return c.json({
      ...results,
      organization_id: orgId,
      message: results.success 
        ? 'バックアップの復元が完了しました' 
        : '一部のデータの復元に失敗しました',
      restored_at: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Backup import error:', error)
    return c.json({ error: 'バックアップの復元に失敗しました', details: error.message }, 500)
  }
})

export default routes
