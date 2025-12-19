// 文書生成API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'
import { callAI, extractTextFromDocument, getAIModelName } from './ai'

const routes = new Hono<AppEnv>()

// テンプレート一覧取得
routes.get('/document-templates', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT dt.*, st.name as subsidy_name
    FROM document_templates dt
    LEFT JOIN subsidy_types st ON dt.subsidy_type_id = st.id
    WHERE dt.is_active = 1
    ORDER BY dt.subsidy_type_id
  `).all()
  
  return c.json(result.results)
})

// 補助金種別のテンプレート取得
routes.get('/document-templates/by-subsidy/:subsidyTypeId', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.param('subsidyTypeId')
  
  const result = await DB.prepare(`
    SELECT * FROM document_templates 
    WHERE subsidy_type_id = ? AND is_active = 1
    LIMIT 1
  `).bind(subsidyTypeId).first()
  
  return c.json(result)
})

// 生成済み文書一覧
routes.get('/clients/:clientId/generated-documents', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const result = await DB.prepare(`
    SELECT gd.*, dt.template_name
    FROM generated_documents gd
    LEFT JOIN document_templates dt ON gd.template_id = dt.id
    WHERE gd.client_id = ?
    ORDER BY gd.created_at DESC
  `).bind(clientId).all()
  
  return c.json(result.results)
})

// 文書詳細取得
routes.get('/generated-documents/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const doc = await DB.prepare(`
    SELECT gd.*, dt.template_name, dt.sections as template_sections
    FROM generated_documents gd
    LEFT JOIN document_templates dt ON gd.template_id = dt.id
    WHERE gd.id = ?
  `).bind(id).first()
  
  return c.json(doc)
})

// AI文書生成
routes.post('/clients/:clientId/generate-document', async (c) => {
  const { DB, CLAUDE_API_KEY } = c.env
  const env = c.env
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  
  // 顧客情報取得
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(clientId).first()
  
  if (!client) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  // テンプレート取得（templateId または template_id に対応）
  const templateId = data.templateId || data.template_id
  const template = await DB.prepare(`
    SELECT * FROM document_templates WHERE id = ?
  `).bind(templateId).first()
  
  if (!template) {
    return c.json({ error: 'テンプレートが見つかりません' }, 404)
  }
  
  // 公募要領情報取得
  const guidelines = await DB.prepare(`
    SELECT * FROM subsidy_guidelines 
    WHERE subsidy_type_id = ? AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
  `).bind(client.subsidy_type_id).first()
  
  // ヒアリング回答取得（案件IDが指定されている場合はその案件のみ）
  const caseId = data.caseId || data.case_id
  let answers
  if (caseId) {
    // 案件に紐づくヒアリング回答のみ取得
    answers = await DB.prepare(`
      SELECT hq.question_key, hq.question_text, hq.category, ha.answer_text
      FROM hearing_answers ha
      JOIN hearing_questions hq ON ha.question_id = hq.id
      WHERE ha.case_id = ?
      ORDER BY hq.display_order
    `).bind(caseId).all()
  } else {
    // 後方互換性: case_idがない場合はclient_idで取得
    answers = await DB.prepare(`
      SELECT hq.question_key, hq.question_text, hq.category, ha.answer_text
      FROM hearing_answers ha
      JOIN hearing_questions hq ON ha.question_id = hq.id
      WHERE ha.client_id = ?
      ORDER BY hq.display_order
    `).bind(clientId).all()
  }
  
  // 採択事例取得
  const successCases = await DB.prepare(`
    SELECT success_summary, key_factors 
    FROM success_cases 
    WHERE subsidy_type_id = ? AND is_public = 1
    LIMIT 3
  `).bind(client.subsidy_type_id).all()
  
  // 提出書類の取得とテキスト抽出
  const { R2 } = c.env
  const uploadedDocs = await DB.prepare(`
    SELECT id, document_type, file_name, file_path, status
    FROM documents 
    WHERE client_id = ? AND status IN ('pending', 'approved')
    ORDER BY uploaded_at DESC
  `).bind(clientId).all()
  
  // 重要書類のテキスト抽出（並列処理で高速化）
  const documentExtractions: string[] = []
  const importantDocTypes = ['決算書', '登記簿謄本', '財務諸表', '会社概要', '事業計画', '見積書', '貸借対照表', '損益計算書']
  
  if (uploadedDocs.results && uploadedDocs.results.length > 0) {
    const extractionPromises = (uploadedDocs.results as any[])
      .filter((doc: any) => {
        // 重要書類のみ抽出対象
        return importantDocTypes.some(t => doc.document_type?.includes(t)) || doc.file_name?.endsWith('.pdf')
      })
      .slice(0, 5) // 最大5件まで
      .map(async (doc: any) => {
        // DB設定からClaude APIキーとモデル名を取得
        let claudeKey = CLAUDE_API_KEY || ''
        let multimodalModel = 'claude-haiku-4-5-20251001'
        try {
          const keyResult = await DB.prepare(`
            SELECT setting_value FROM site_settings WHERE setting_key = 'claude_api_key'
          `).first()
          if (keyResult?.setting_value) {
            claudeKey = (keyResult as any).setting_value
          }
          multimodalModel = await getAIModelName(DB, 'ai_model_claude_multimodal')
        } catch (e) {
          console.error('Failed to get Claude API key:', e)
        }
        
        const extracted = await extractTextFromDocument(
          R2,
          doc.file_path,
          doc.document_type,
          doc.file_name,
          claudeKey,
          multimodalModel
        )
        return `【${doc.document_type}（${doc.file_name}）】\n${extracted}`
      })
    
    const results = await Promise.allSettled(extractionPromises)
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        documentExtractions.push(result.value)
      }
    })
  }
  
  const sections = JSON.parse(template.sections)
  const generatedSections: Record<string, string> = {}
  
  // 補助金情報を整形
  const g = guidelines as any
  const guidelinesInfo = guidelines ? `
【補助金制度情報】
- 補助金名: ${client.subsidy_name}
- 年度・公募回: ${g?.fiscal_year || ''}年度 ${g?.version || ''}
- 補助率: ${g?.subsidy_rate || '未設定'}
- 補助上限額: ${g?.max_amount ? `${(g.max_amount / 10000).toLocaleString()}万円` : '未設定'}
- 補助下限額: ${g?.min_amount ? `${(g.min_amount / 10000).toLocaleString()}万円` : '未設定'}
- 対象経費: ${g?.target_expenses || '未設定'}
- 対象者要件: ${g?.eligibility_requirements || '未設定'}
- 申請期限: ${g?.application_end_date || '未設定'}` : `
【補助金制度情報】
- 補助金名: ${client.subsidy_name}
- その他詳細情報: 未登録`
  
  // 各セクションをAIで生成（レート制限回避のため間隔を空ける）
  let sectionIndex = 0
  for (const section of sections) {
    // 2番目以降のセクションは3秒待機（レート制限回避）
    if (sectionIndex > 0) {
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    sectionIndex++
    
    // セクション別の専用プロンプトを定義
    const sectionSpecificPrompts: Record<string, string> = {
      'company_overview': `【このセクションの目的】
企業の信頼性と事業基盤の強さを審査員にアピールする。

【必須記載事項】
・会社の基本情報（設立年、従業員数、年商、所在地）
・主要事業内容と強み
・これまでの実績や経験

【記載禁止事項】
・課題や問題点（次のセクションで記載）
・導入予定のITツールの詳細（別セクションで記載）
・将来の目標（別セクションで記載）

【文体】
客観的な事実を淡々と記載。自社の強みを控えめながらも確実に伝える。`,

      'current_situation': `【このセクションの目的】
現状の業務課題を明確にし、IT導入の必要性・緊急性を訴える。

【必須記載事項】
・具体的な業務上の課題（数値で示す：時間、コスト、エラー率など）
・課題が経営に与える悪影響
・なぜ今IT導入が必要なのかの理由

【記載禁止事項】
・会社概要の繰り返し（前セクションで記載済み）
・解決策の詳細（次セクションで記載）
・導入後の効果（別セクションで記載）

【文体】
課題の深刻さを具体的な数値で示し、解決の緊急性を伝える。`,

      'implementation_plan': `【このセクションの目的】
導入するITツールと実施計画の具体性・実現可能性を示す。

【必須記載事項】
・導入予定のITツール名と選定理由
・導入スケジュール（いつまでに何を行うか）
・投資予算と内訳
・導入体制（誰が担当するか）

【記載禁止事項】
・課題の説明の繰り返し（前セクションで記載済み）
・効果の詳細（次セクションで記載）
・企業概要の繰り返し

【文体】
計画の具体性と実現可能性を示す。スケジュールは明確に。`,

      'expected_results': `【このセクションの目的】
IT導入による具体的な効果を定量的に示し、投資対効果を明確にする。

【必須記載事項】
・定量的効果（削減時間、コスト削減額、生産性向上率など具体的数値）
・定性的効果（顧客満足度、従業員満足度など）
・投資回収の見込み

【記載禁止事項】
・課題の説明の繰り返し
・導入計画の繰り返し
・将来展望（次セクションで記載）

【文体】
効果は必ず数値で示す。「〜が期待される」ではなく「〜を達成する」と断定的に。`,

      'future_plan': `【このセクションの目的】
IT導入を起点とした中長期的な成長ビジョンを示し、事業の発展性をアピール。

【必須記載事項】
・3年後、5年後の売上目標など具体的な成長目標
・IT導入が成長にどう貢献するか
・地域経済・雇用への貢献（あれば）

【記載禁止事項】
・課題の説明の繰り返し
・導入効果の繰り返し（前セクションで記載済み）
・企業概要の繰り返し

【文体】
将来への意欲と具体的なビジョンを示す。成長への確信を伝える。`
    }

    // セクション固有のプロンプトを取得（なければデフォルト）
    const sectionSpecific = sectionSpecificPrompts[section.id] || `【このセクションの目的】
${section.description}

【記載のポイント】
・他のセクションと内容が重複しないよう注意
・具体的な数値やデータを含める`

    const sectionPrompt = `${template.ai_prompt_base}

★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
【最重要ルール】ヒアリング回答に記載された情報のみを使用すること
・ヒアリング回答にない情報は絶対に創作・推測しない
・具体的な数値（金額、人数、時間等）はヒアリング回答から引用
・ヒアリングに記載がない項目は「記載なし」として省略する
★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

【顧客情報】
- 会社名: ${client.company_name || '未設定'}
- 申請補助金: ${client.subsidy_name}
${guidelinesInfo}

【ヒアリング回答】※この内容のみを情報源として使用すること
${(answers.results || []).map((a: any) => `【${a.category}】${a.question_text}\n回答: ${a.answer_text || '未回答'}`).join('\n\n')}

【採択事例の成功ポイント（参考）】※文体や構成の参考のみ、内容は使用しない
${(successCases.results || []).map((c: any, i: number) => `事例${i+1}: ${c.success_summary}`).join('\n')}

【提出書類から抽出した情報】
${documentExtractions.length > 0 ? documentExtractions.join('\n\n') : '（書類未提出または抽出対象なし）'}

========================================
【生成するセクション】${section.title}
========================================

${sectionSpecific}

★★★ 文字数制限：${Math.floor(section.max_chars * 0.8)}〜${section.max_chars}文字 ★★★

【出力ルール - 厳守】
1. 文字数は${Math.floor(section.max_chars * 0.8)}文字前後
2. セクション番号やタイトルは出力しない（内容のみ）
3. ★マークダウン記法は絶対禁止★（*、**、#、-、などの記号を装飾目的で使わない）
4. 箇条書きは「・」のみ使用可（*, -, などは禁止）
5. 上記「記載禁止事項」に該当する内容は絶対に書かない
6. 他セクションとの重複を避け、このセクション固有の内容のみ記載
7. ★ヒアリング回答にない情報は絶対に書かない★

【文書品質】
・連続する空行禁止
・冗長な前置きを省き本題から開始
・断定的な文体で記載`

    try {
      let content = await callAI(sectionPrompt, env, 2, section.max_chars)
      
      // マークダウン記法を除去
      if (content) {
        content = content
          .replace(/\*\*([^*]+)\*\*/g, '$1')  // **太字** → 太字
          .replace(/\*([^*]+)\*/g, '$1')      // *斜体* → 斜体
          .replace(/^#+\s*/gm, '')            // # 見出し → 見出し
          .replace(/^[-*]\s+/gm, '・')        // - や * の箇条書き → ・
          .replace(/^\d+\.\s+/gm, '')         // 1. 番号付き → 削除
          .trim()
      }
      
      // 文字数チェック：超過している場合は警告を追加
      if (content && content.length > section.max_chars) {
        const overCount = content.length - section.max_chars
        content = `【文字数超過】現在${content.length}文字（上限${section.max_chars}文字を${overCount}文字超過）\n編集して${section.max_chars}文字以内に収めてください。\n\n---\n\n${content}`
      }
      
      generatedSections[section.id] = content || `【生成エラー】セクション「${section.title}」の生成結果が空でした。再生成をお試しください。`
    } catch (error: any) {
      console.error(`Section ${section.id} generation error:`, error)
      const errorMessage = error?.message || '不明なエラー'
      const isRateLimited = errorMessage.includes('429')
      
      if (isRateLimited) {
        generatedSections[section.id] = `【API制限】このセクションは一時的に生成できませんでした。\n\n「再生成」ボタンをクリックするか、数分後に再度お試しください。\n\n以下に手動で内容を入力することもできます：\n\n《${section.title}》\n・${section.description}\n・推奨文字数: ${section.max_chars}文字以内`
      } else {
        generatedSections[section.id] = `【生成エラー】セクション「${section.title}」の生成に失敗しました。\n\n原因: ${errorMessage}\n\nヒアリング回答を追加してから再度お試しいただくか、手動で内容を入力してください。`
      }
    }
  }
  
  // 生成文書を保存
  const subsidyName = (client as any).subsidy_name || '補助金'
  const companyName = (client as any).company_name || (client as any).name || '未設定'
  const documentTitle = `${subsidyName} 事業計画書 - ${companyName}`
  
  // 使用モデル名を取得（設定から）
  const usedModel = await getAIModelName(DB, 'ai_model_claude')
  
  const result = await DB.prepare(`
    INSERT INTO generated_documents 
    (client_id, template_id, document_title, sections_content, ai_model_used, case_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    clientId,
    data.template_id,
    documentTitle,
    JSON.stringify(generatedSections),
    usedModel,
    caseId || null
  ).run()
  
  return c.json({ 
    id: result.meta.last_row_id,
    sections: generatedSections
  })
})

// 文書セクション更新
routes.put('/generated-documents/:id/sections/:sectionId', async (c) => {
  const { DB } = c.env
  const docId = c.req.param('id')
  const sectionId = c.req.param('sectionId')
  
  try {
    const data = await c.req.json()
    
    // 現在の文書取得
    const doc = await DB.prepare(`
      SELECT * FROM generated_documents WHERE id = ?
    `).bind(docId).first()
    
    if (!doc) {
      return c.json({ error: '文書が見つかりません' }, 404)
    }
    
    const sectionsContent = JSON.parse(doc.sections_content || '{}')
    const previousContent = sectionsContent[sectionId] || ''
    
    // 編集履歴を保存
    await DB.prepare(`
      INSERT INTO document_section_edits 
      (document_id, section_id, previous_content, new_content, edit_type, editor_name, editor_comment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      docId,
      sectionId,
      previousContent,
      data.content || '',
      data.edit_type || 'manual',
      data.editor_name || null,
      data.editor_comment || null
    ).run()
    
    // セクション内容を更新
    sectionsContent[sectionId] = data.content
    
    await DB.prepare(`
      UPDATE generated_documents 
      SET sections_content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(JSON.stringify(sectionsContent), docId).run()
    
    return c.json({ success: true })
  } catch (error: any) {
    console.error('Section update error:', error)
    return c.json({ error: `保存に失敗しました: ${error?.message || '不明なエラー'}` }, 500)
  }
})

// 文書削除
routes.delete('/generated-documents/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // 編集履歴も削除
  await DB.prepare(`
    DELETE FROM document_section_edits WHERE document_id = ?
  `).bind(id).run()
  
  // 文書を削除
  await DB.prepare(`
    DELETE FROM generated_documents WHERE id = ?
  `).bind(id).run()
  
  return c.json({ success: true })
})

// 文書ステータス更新
routes.put('/generated-documents/:id/status', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE generated_documents 
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(data.status, id).run()
  
  return c.json({ success: true })
})

// セクション再生成
routes.post('/generated-documents/:id/regenerate-section', async (c) => {
  const { DB, CLAUDE_API_KEY } = c.env
  const env = c.env
  const docId = c.req.param('id')
  const data = await c.req.json()
  
  // 文書とテンプレート取得
  const doc = await DB.prepare(`
    SELECT gd.*, dt.sections as template_sections, dt.ai_prompt_base
    FROM generated_documents gd
    JOIN document_templates dt ON gd.template_id = dt.id
    WHERE gd.id = ?
  `).bind(docId).first()
  
  if (!doc) {
    return c.json({ error: '文書が見つかりません' }, 404)
  }
  
  const sections = JSON.parse(doc.template_sections)
  const section = sections.find((s: any) => s.id === data.section_id)
  
  if (!section) {
    return c.json({ error: 'セクションが見つかりません' }, 404)
  }
  
  // 顧客情報取得
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(doc.client_id).first()
  
  // ヒアリング回答取得（文書に紐づくcase_idがある場合はその案件のみ）
  let answers
  if (doc.case_id) {
    answers = await DB.prepare(`
      SELECT hq.question_text, hq.category, ha.answer_text
      FROM hearing_answers ha
      JOIN hearing_questions hq ON ha.question_id = hq.id
      WHERE ha.case_id = ?
    `).bind(doc.case_id).all()
  } else {
    answers = await DB.prepare(`
      SELECT hq.question_text, hq.category, ha.answer_text
      FROM hearing_answers ha
      JOIN hearing_questions hq ON ha.question_id = hq.id
      WHERE ha.client_id = ?
    `).bind(doc.client_id).all()
  }
  
  // セクション別の専用プロンプトを定義
  const sectionSpecificPrompts: Record<string, string> = {
    'company_overview': `【このセクションの目的】
企業の信頼性と事業基盤の強さを審査員にアピールする。

【必須記載事項】
・会社の基本情報（設立年、従業員数、年商、所在地）
・主要事業内容と強み
・これまでの実績や経験

【記載禁止事項】
・課題や問題点（次のセクションで記載）
・導入予定のITツールの詳細（別セクションで記載）
・将来の目標（別セクションで記載）

【文体】
客観的な事実を淡々と記載。自社の強みを控えめながらも確実に伝える。`,

    'current_situation': `【このセクションの目的】
現状の業務課題を明確にし、IT導入の必要性・緊急性を訴える。

【必須記載事項】
・具体的な業務上の課題（数値で示す：時間、コスト、エラー率など）
・課題が経営に与える悪影響
・なぜ今IT導入が必要なのかの理由

【記載禁止事項】
・会社概要の繰り返し（前セクションで記載済み）
・解決策の詳細（次セクションで記載）
・導入後の効果（別セクションで記載）

【文体】
課題の深刻さを具体的な数値で示し、解決の緊急性を伝える。`,

    'implementation_plan': `【このセクションの目的】
導入するITツールと実施計画の具体性・実現可能性を示す。

【必須記載事項】
・導入予定のITツール名と選定理由
・導入スケジュール（いつまでに何を行うか）
・投資予算と内訳
・導入体制（誰が担当するか）

【記載禁止事項】
・課題の説明の繰り返し（前セクションで記載済み）
・効果の詳細（次セクションで記載）
・企業概要の繰り返し

【文体】
計画の具体性と実現可能性を示す。スケジュールは明確に。`,

    'expected_results': `【このセクションの目的】
IT導入による具体的な効果を定量的に示し、投資対効果を明確にする。

【必須記載事項】
・定量的効果（削減時間、コスト削減額、生産性向上率など具体的数値）
・定性的効果（顧客満足度、従業員満足度など）
・投資回収の見込み

【記載禁止事項】
・課題の説明の繰り返し
・導入計画の繰り返し
・将来展望（次セクションで記載）

【文体】
効果は必ず数値で示す。「〜が期待される」ではなく「〜を達成する」と断定的に。`,

    'future_plan': `【このセクションの目的】
IT導入を起点とした中長期的な成長ビジョンを示し、事業の発展性をアピール。

【必須記載事項】
・3年後、5年後の売上目標など具体的な成長目標
・IT導入が成長にどう貢献するか
・地域経済・雇用への貢献（あれば）

【記載禁止事項】
・課題の説明の繰り返し
・導入効果の繰り返し（前セクションで記載済み）
・企業概要の繰り返し

【文体】
将来への意欲と具体的なビジョンを示す。成長への確信を伝える。`
  }

  // セクション固有のプロンプトを取得
  const sectionSpecific = sectionSpecificPrompts[data.section_id] || `【このセクションの目的】
${section.description}

【記載のポイント】
・他のセクションと内容が重複しないよう注意
・具体的な数値やデータを含める`

  const prompt = `${doc.ai_prompt_base}

★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
【最重要ルール】ヒアリング回答に記載された情報のみを使用すること
・ヒアリング回答にない情報は絶対に創作・推測しない
・具体的な数値（金額、人数、時間等）はヒアリング回答から引用
・ヒアリングに記載がない項目は「記載なし」として省略する
★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

【顧客情報】
- 会社名: ${client?.company_name || '未設定'}
- 申請補助金: ${client?.subsidy_name}

【ヒアリング回答】※この内容のみを情報源として使用すること
${(answers.results || []).map((a: any) => `【${a.category}】${a.question_text}\n回答: ${a.answer_text || '未回答'}`).join('\n\n')}

========================================
【生成するセクション】${section.title}
========================================

${sectionSpecific}

${data.additional_instructions ? `
########################################
【ユーザーからの追加指示 - 最優先で反映】
${data.additional_instructions}
########################################
` : ''}

★★★ 文字数制限：${Math.floor(section.max_chars * 0.8)}〜${section.max_chars}文字 ★★★

【出力ルール - 厳守】
1. 文字数は${Math.floor(section.max_chars * 0.8)}文字前後
2. セクション番号やタイトルは出力しない（内容のみ）
3. ★マークダウン記法は絶対禁止★（*、**、#、-、などの記号を装飾目的で使わない）
4. 箇条書きは「・」のみ使用可（*, -, などは禁止）
5. 上記「記載禁止事項」に該当する内容は絶対に書かない
6. 他セクションとの重複を避け、このセクション固有の内容のみ記載
7. ★ヒアリング回答にない情報は絶対に書かない★

【文書品質】
・連続する空行禁止
・冗長な前置きを省き本題から開始
・断定的な文体で記載`

  try {
    let content = await callAI(prompt, env, 2, section.max_chars)
    
    // マークダウン記法を除去
    if (content) {
      content = content
        .replace(/\*\*([^*]+)\*\*/g, '$1')  // **太字** → 太字
        .replace(/\*([^*]+)\*/g, '$1')      // *斜体* → 斜体
        .replace(/^#+\s*/gm, '')            // # 見出し → 見出し
        .replace(/^[-*]\s+/gm, '・')        // - や * の箇条書き → ・
        .replace(/^\d+\.\s+/gm, '')         // 1. 番号付き → 削除
        .trim()
    }
    
    // 文字数チェック：超過している場合は警告を追加
    if (content && content.length > section.max_chars) {
      const overCount = content.length - section.max_chars
      content = `【文字数超過】現在${content.length}文字（上限${section.max_chars}文字を${overCount}文字超過）\n編集して${section.max_chars}文字以内に収めてください。\n\n---\n\n${content}`
    }
    
    // セクション内容を更新
    const sectionsContent = JSON.parse(doc.sections_content || '{}')
    const previousContent = sectionsContent[data.section_id]
    sectionsContent[data.section_id] = content
    
    // 編集履歴を保存
    await DB.prepare(`
      INSERT INTO document_section_edits 
      (document_id, section_id, previous_content, new_content, edit_type, editor_name)
      VALUES (?, ?, ?, ?, 'ai_regenerate', ?)
    `).bind(docId, data.section_id, previousContent, content, data.editor_name || 'AI').run()
    
    await DB.prepare(`
      UPDATE generated_documents 
      SET sections_content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(JSON.stringify(sectionsContent), docId).run()
    
    return c.json({ content })
  } catch (error: any) {
    console.error('Regenerate section error:', error)
    const errorMessage = error?.message || '不明なエラー'
    const isRateLimited = errorMessage.includes('429')
    
    if (isRateLimited) {
      return c.json({ 
        error: 'API制限に達しました。数分後に再度お試しください。',
        fallback: `【API制限】このセクションは一時的に生成できませんでした。\n\n「再生成」ボタンをクリックするか、数分後に再度お試しください。`
      }, 200)
    }
    
    return c.json({ error: `再生成に失敗しました: ${errorMessage}` }, 500)
  }
})

export default routes
