// フェーズ4: バックアップ機能（JSONインポート/エクスポート）
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// JSON形式で全データをエクスポート
routes.get('/backup/export', async (c) => {
  const { DB } = c.env
  
  try {
    // 各テーブルからデータを取得（存在するテーブルのみ）
    // テーブルが存在しない場合はエラーをキャッチして空配列を返す
    const safeQuery = async (query: string) => {
      try {
        return await DB.prepare(query).all()
      } catch (e) {
        return { results: [] }
      }
    }

    const [
      adminUsers,
      subsidyTypes,
      subsidyTypeDocuments,
      documentChecklist,
      clients,
      documents,
      communications,
      subsidyGuidelines,
      subsidyWatchUrls,
      subsidyUpdateLogs,
      adminNotifications,
      hearingQuestions,
      hearingAnswers,
      aiChatHistory,
      documentTemplates,
      generatedDocuments,
      documentSectionEdits,
      successCases,
      clientProfiles,
      subsidyMatchScores
    ] = await Promise.all([
      safeQuery('SELECT * FROM admin_users'),
      safeQuery('SELECT * FROM subsidy_types'),
      safeQuery('SELECT * FROM subsidy_type_documents'),
      safeQuery('SELECT * FROM document_checklist'),
      safeQuery('SELECT * FROM clients'),
      safeQuery('SELECT * FROM documents'),
      safeQuery('SELECT * FROM communications'),
      safeQuery('SELECT * FROM subsidy_guidelines'),
      safeQuery('SELECT * FROM subsidy_watch_urls'),
      safeQuery('SELECT * FROM subsidy_update_logs'),
      safeQuery('SELECT * FROM admin_notifications'),
      safeQuery('SELECT * FROM hearing_questions'),
      safeQuery('SELECT * FROM hearing_answers'),
      safeQuery('SELECT * FROM ai_chat_history'),
      safeQuery('SELECT * FROM document_templates'),
      safeQuery('SELECT * FROM generated_documents'),
      safeQuery('SELECT * FROM document_section_edits'),
      safeQuery('SELECT * FROM success_cases'),
      safeQuery('SELECT * FROM client_profiles'),
      safeQuery('SELECT * FROM subsidy_match_scores')
    ])

    const backupData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      app_name: '申請らくらく君',
      tables: {
        admin_users: adminUsers.results || [],
        subsidy_types: subsidyTypes.results || [],
        subsidy_type_documents: subsidyTypeDocuments.results || [],
        document_checklist: documentChecklist.results || [],
        clients: clients.results || [],
        documents: documents.results || [],
        communications: communications.results || [],
        subsidy_guidelines: subsidyGuidelines.results || [],
        subsidy_watch_urls: subsidyWatchUrls.results || [],
        subsidy_update_logs: subsidyUpdateLogs.results || [],
        admin_notifications: adminNotifications.results || [],
        hearing_questions: hearingQuestions.results || [],
        hearing_answers: hearingAnswers.results || [],
        ai_chat_history: aiChatHistory.results || [],
        document_templates: documentTemplates.results || [],
        generated_documents: generatedDocuments.results || [],
        document_section_edits: documentSectionEdits.results || [],
        success_cases: successCases.results || [],
        client_profiles: clientProfiles.results || [],
        subsidy_match_scores: subsidyMatchScores.results || []
      },
      summary: {
        total_admin_users: (adminUsers.results || []).length,
        total_subsidy_types: (subsidyTypes.results || []).length,
        total_clients: (clients.results || []).length,
        total_documents: (documents.results || []).length,
        total_generated_documents: (generatedDocuments.results || []).length,
        total_success_cases: (successCases.results || []).length
      }
    }

    // JSONファイルとしてダウンロード可能なレスポンスを返す
    const filename = `subsidy_app_backup_${new Date().toISOString().split('T')[0]}.json`
    
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

// バックアップ情報取得（サマリーのみ）
routes.get('/backup/info', async (c) => {
  const { DB } = c.env
  
  try {
    const [
      adminUsersCount,
      subsidyTypesCount,
      clientsCount,
      documentsCount,
      generatedDocsCount,
      successCasesCount
    ] = await Promise.all([
      DB.prepare('SELECT COUNT(*) as count FROM admin_users').first(),
      DB.prepare('SELECT COUNT(*) as count FROM subsidy_types').first(),
      DB.prepare('SELECT COUNT(*) as count FROM clients').first(),
      DB.prepare('SELECT COUNT(*) as count FROM documents').first(),
      DB.prepare('SELECT COUNT(*) as count FROM generated_documents').first(),
      DB.prepare('SELECT COUNT(*) as count FROM success_cases').first()
    ])

    return c.json({
      summary: {
        admin_users: adminUsersCount?.count || 0,
        subsidy_types: subsidyTypesCount?.count || 0,
        clients: clientsCount?.count || 0,
        documents: documentsCount?.count || 0,
        generated_documents: generatedDocsCount?.count || 0,
        success_cases: successCasesCount?.count || 0
      },
      last_checked: new Date().toISOString()
    })
  } catch (error: any) {
    return c.json({ error: 'バックアップ情報の取得に失敗しました' }, 500)
  }
})

// JSON形式でデータをインポート（復元）
routes.post('/backup/import', async (c) => {
  const { DB } = c.env
  
  try {
    const backupData = await c.req.json()
    
    // バックアップデータの検証
    if (!backupData.version || !backupData.tables) {
      return c.json({ error: '無効なバックアップファイルです' }, 400)
    }

    const results = {
      success: true,
      imported: {} as Record<string, number>,
      errors: [] as string[]
    }

    // トランザクション的な処理（D1はネイティブトランザクションをサポートしていないため、順次処理）
    const tables = backupData.tables

    // インポート順序（外部キー制約を考慮）
    const importOrder = [
      'admin_users',
      'subsidy_types',
      'subsidy_type_documents',
      'document_checklist',
      'clients',
      'documents',
      'communications',
      'subsidy_guidelines',
      'subsidy_watch_urls',
      'subsidy_update_logs',
      'admin_notifications',
      'hearing_questions',
      'hearing_answers',
      'ai_chat_history',
      'document_templates',
      'generated_documents',
      'document_section_edits',
      'success_cases',
      'client_profiles',
      'subsidy_match_scores'
    ]

    for (const tableName of importOrder) {
      const records = tables[tableName]
      if (!records || !Array.isArray(records) || records.length === 0) {
        results.imported[tableName] = 0
        continue
      }

      try {
        // 既存データを削除（オプション: merge_modeがfalseの場合）
        // デフォルトは上書きモード
        await DB.prepare(`DELETE FROM ${tableName}`).run()

        let importedCount = 0
        for (const record of records) {
          const columns = Object.keys(record)
          const values = Object.values(record)
          const placeholders = columns.map(() => '?').join(', ')
          
          try {
            await DB.prepare(`
              INSERT INTO ${tableName} (${columns.join(', ')}) 
              VALUES (${placeholders})
            `).bind(...values).run()
            importedCount++
          } catch (insertError: any) {
            // 重複エラーなどは無視して続行
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
