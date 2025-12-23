// AIチャットAPI
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'
import { callAIForChat } from './ai'

const routes = new Hono<AppEnv>()

// チャット履歴取得
routes.get('/clients/:clientId/ai-chat', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  // organization_idでテナント分離 - クライアントが自組織のものか確認
  const clientCheck = await DB.prepare(`SELECT id FROM clients WHERE id = ? AND organization_id = ?`).bind(clientId, orgId).first()
  if (!clientCheck && orgId) {
    return c.json([]) // 他テナントのクライアントにはアクセス不可
  }
  
  const result = await DB.prepare(`
    SELECT * FROM ai_chat_history 
    WHERE client_id = ?
    ORDER BY created_at ASC
  `).bind(clientId).all()
  
  return c.json(result.results)
})

// AIチャット送信
routes.post('/clients/:clientId/ai-chat', async (c) => {
  const { DB } = c.env
  const env = c.env
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  // organization_idでテナント分離 - クライアントが自組織のものか確認
  const clientCheck = await DB.prepare(`SELECT id FROM clients WHERE id = ? AND organization_id = ?`).bind(clientId, orgId).first()
  if (!clientCheck && orgId) {
    return c.json({ error: 'アクセス権限がありません' }, 403)
  }
  
  // ユーザーメッセージを保存
  await DB.prepare(`
    INSERT INTO ai_chat_history (client_id, role, content, context_type)
    VALUES (?, 'user', ?, ?)
  `).bind(clientId, data.message, data.context_type || 'hearing').run()
  
  // 顧客情報と補助金情報を取得
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(clientId).first()
  
  // 過去のチャット履歴を取得
  const chatHistory = await DB.prepare(`
    SELECT role, content FROM ai_chat_history 
    WHERE client_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).bind(clientId).all()
  
  // ヒアリング回答を取得
  const answers = await DB.prepare(`
    SELECT hq.question_text, ha.answer_text
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
  `).bind(clientId).all()
  
  // プロンプト構築（モードに応じて切り替え）
  let systemPrompt = ''
  
  if (data.context_type === 'review' && data.document_content) {
    // 文書添削モード
    systemPrompt = `あなたは補助金申請書の添削を行う専門家です。

【重要な回答ルール】
- マークダウン記法（**太字**、# 見出し、- 箇条書き）は使わないでください
- 自然な日本語の文章で回答してください
- 箇条書きが必要な場合は「・」や「1. 2. 3.」を使ってください
- 具体的な改善案を提示してください
- 修正後の文章例も示してください

【顧客情報】
顧客名: ${client?.name || '未設定'}
会社名: ${client?.company_name || '未設定'}
申請予定の補助金: ${client?.subsidy_name || '未設定'}

【添削対象の文書】
タイトル: ${data.document_title || '無題'}
内容:
${data.document_content}

【直近の会話履歴】
${(chatHistory.results || []).reverse().map((m: any) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`).join('\n')}

上記の文書について、ユーザーの指示に従って添削・改善提案を行ってください。`
  } else {
    // 通常のヒアリングモード
    systemPrompt = `あなたは補助金申請を支援する親切なアドバイザーです。

【重要な回答ルール】
- マークダウン記法（**太字**、# 見出し、- 箇条書き）は使わないでください
- 自然な日本語の文章で回答してください
- 箇条書きが必要な場合は「・」や「1. 2. 3.」を使ってください
- 堅すぎず、親しみやすい口調で話してください
- 回答は簡潔に、要点を絞ってください（長くなりすぎないように）

【顧客情報】
顧客名: ${client?.name || '未設定'}
会社名: ${client?.company_name || '未設定'}
申請予定の補助金: ${client?.subsidy_name || '未設定'}

【これまでのヒアリング回答】
${(answers.results || []).map((a: any) => `Q: ${a.question_text}\nA: ${a.answer_text || '未回答'}`).join('\n\n')}

【直近の会話履歴】
${(chatHistory.results || []).reverse().map((m: any) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`).join('\n')}

上記を踏まえて、ユーザーの質問に分かりやすく回答してください。`
  }

  const prompt = `${systemPrompt}\n\nユーザー: ${data.message}`
  
  try {
    // Claude優先、Geminiフォールバック
    const aiResponse = await callAIForChat(prompt, env)
    
    // AIレスポンスを保存
    await DB.prepare(`
      INSERT INTO ai_chat_history (client_id, role, content, context_type)
      VALUES (?, 'assistant', ?, ?)
    `).bind(clientId, aiResponse, data.context_type || 'hearing').run()
    
    return c.json({ response: aiResponse })
  } catch (error: any) {
    console.error('AI chat error:', error)
    return c.json({ error: 'AI応答の生成に失敗しました', response: error?.message?.includes('APIキー') ? error.message : '申し訳ありません。一時的にAI機能が利用できません。しばらくしてからお試しください。' })
  }
})

// AI回答提案API
routes.post('/clients/:clientId/ai-suggest', async (c) => {
  try {
    const { DB } = c.env
    const env = c.env
    const clientId = c.req.param('clientId')
    const data = await c.req.json()
    
    // 顧客情報と既存回答を取得
    const client = await DB.prepare(`
      SELECT c.*, st.name as subsidy_name
      FROM clients c
      LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
      WHERE c.id = ?
    `).bind(clientId).first() as any
    
    const answers = await DB.prepare(`
      SELECT hq.question_text, ha.answer_text
      FROM hearing_answers ha
      JOIN hearing_questions hq ON ha.question_id = hq.id
      WHERE ha.client_id = ?
    `).bind(clientId).all()
    
    // プロファイル情報を取得
    const profile = await DB.prepare(`
      SELECT * FROM client_profiles WHERE client_id = ?
    `).bind(clientId).first() as any
    
    // プロファイル情報を整形
    let profileInfo = ''
    if (profile) {
      const profileItems = []
      if (profile.company_name) profileItems.push(`会社名: ${profile.company_name}`)
      if (profile.representative_name) profileItems.push(`代表者名: ${profile.representative_name}`)
      if (profile.employee_count) profileItems.push(`従業員数: ${profile.employee_count}名`)
      if (profile.business_description) profileItems.push(`事業内容: ${profile.business_description}`)
      if (profileItems.length > 0) {
        profileInfo = `\n【会社情報】\n${profileItems.join('\n')}`
      }
    }
    
    const prompt = `あなたは補助金申請の回答作成を支援するアシスタントです。

【重要なルール】
- マークダウン記法は使わないでください
- 自然な日本語の文章で回答してください
- 補助金申請に適した具体的で説得力のある文章を書いてください
- 200〜300字程度で簡潔に回答してください
- 〇〇や△△などのプレースホルダーは使用せず、一般的な例を入れてください

【顧客基本情報】
会社名: ${client?.company_name || '未設定'}
申請予定の補助金: ${client?.subsidy_name || '未設定'}
${profileInfo}

【既存の回答】
${(answers.results || []).map((a: any) => `${a.question_text}: ${a.answer_text || '未回答'}`).join('\n')}

以下の質問に対する回答例を作成してください。

質問: ${data.question_text}`

    // Claude優先、Geminiフォールバック
    const suggestion = await callAIForChat(prompt, env)
    return c.json({ suggestion })
    
  } catch (error: any) {
    console.error('AI suggest error:', error)
    return c.json({ 
      suggestion: error?.message?.includes('APIキー') 
        ? `【設定エラー】${error.message}` 
        : `【エラー】AI提案の生成に失敗しました。\n\n原因: ${error?.message || '不明なエラー'}\n\n手動で回答を入力するか、後でもう一度お試しください。`
    })
  }
})

export default routes
