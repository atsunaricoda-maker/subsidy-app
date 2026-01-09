// AI機能 API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// DBからAIモデル名を取得するヘルパー関数
async function getAIModelName(DB: any, modelKey: string = 'ai_model_claude'): Promise<string> {
  const defaultModels: Record<string, string> = {
    'ai_model_claude': 'claude-haiku-4-5-20251001',
    'ai_model_claude_multimodal': 'claude-haiku-4-5-20251001',
    'ai_model_gemini': 'gemini-2.0-flash'
  }
  
  try {
    const result = await DB.prepare(`
      SELECT setting_value FROM site_settings WHERE setting_key = ?
    `).bind(modelKey).first()
    
    return (result as any)?.setting_value || defaultModels[modelKey] || defaultModels['ai_model_claude']
  } catch (e) {
    console.error('Failed to get AI model name:', e)
    return defaultModels[modelKey] || defaultModels['ai_model_claude']
  }
}

// Gemini API呼び出しヘルパー（モデル名を指定可能）
async function callGeminiAPI(prompt: string, apiKey: string, maxRetries = 3, maxChars?: number, modelName: string = 'gemini-2.0-flash'): Promise<string> {
  if (!apiKey) {
    throw new Error('Gemini APIキーが設定されていません')
  }
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // レート制限対策：リトライ時は待機（指数バックオフ）
      if (attempt > 0) {
        const waitTime = Math.min(3000 * Math.pow(2, attempt), 15000) // 3秒, 6秒, 12秒, 最大15秒
        console.log(`Gemini API retry ${attempt}/${maxRetries}, waiting ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              // 日本語は1文字≒1-2トークン、余裕を持って*3、上限は8192
              maxOutputTokens: maxChars ? Math.min(maxChars * 3, 8192) : 8192,
            }
          })
        }
      )
      
      // 429（レート制限）または5xx（サーバーエラー）の場合はリトライ
      if (response.status === 429 || response.status >= 500) {
        const errorBody = await response.text().catch(() => '')
        lastError = new Error(`Gemini API error: ${response.status} - ${errorBody.substring(0, 200)}`)
        console.error(`Gemini API attempt ${attempt + 1}/${maxRetries} failed: ${response.status}`, errorBody.substring(0, 500))
        continue
      }
      
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        // RESOURCE_EXHAUSTED（クォータ超過）もリトライ対象にする
        if (errorBody.includes('RESOURCE_EXHAUSTED') || errorBody.includes('quota')) {
          lastError = new Error(`Gemini API quota exceeded: ${response.status}`)
          console.error(`Gemini API quota exceeded, attempt ${attempt + 1}/${maxRetries}`)
          continue
        }
        throw new Error(`Gemini API error: ${response.status} - ${errorBody.substring(0, 200)}`)
      }
      
      const data = await response.json()
      
      // finishReasonをログ出力（デバッグ用）
      const finishReason = data.candidates?.[0]?.finishReason
      console.log(`Gemini API response - finishReason: ${finishReason}`)
      
      // MAX_TOKENSで打ち切られた場合は警告
      if (finishReason === 'MAX_TOKENS') {
        console.warn(`Gemini API response truncated due to MAX_TOKENS limit`)
      }
      
      return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      
    } catch (error) {
      lastError = error as Error
      console.error(`Gemini API attempt ${attempt + 1}/${maxRetries} error:`, error)
    }
  }
  
  throw lastError || new Error('Gemini API failed after retries')
}

// APIキー取得ヘルパー関数
async function getAPIKeys(env: any): Promise<{ claudeApiKey: string, geminiApiKey: string }> {
  const { DB, CLAUDE_API_KEY, GEMINI_API_KEY } = env
  
  let claudeApiKey = CLAUDE_API_KEY || ''
  let geminiApiKey = GEMINI_API_KEY || ''
  
  try {
    const aiSettings = await DB.prepare(`
      SELECT setting_key, setting_value FROM site_settings 
      WHERE setting_key IN ('claude_api_key', 'gemini_api_key')
    `).all()
    
    for (const setting of (aiSettings.results || [])) {
      if ((setting as any).setting_key === 'claude_api_key' && (setting as any).setting_value) {
        claudeApiKey = (setting as any).setting_value
      }
      if ((setting as any).setting_key === 'gemini_api_key' && (setting as any).setting_value) {
        geminiApiKey = (setting as any).setting_value
      }
    }
  } catch (e) {
    console.error('Failed to load AI settings:', e)
  }
  
  return { claudeApiKey, geminiApiKey }
}

// Claude API呼び出しヘルパー（モデル名を指定可能）
async function callClaudeAPI(prompt: string, apiKey: string, maxRetries = 3, maxChars?: number, modelName: string = 'claude-haiku-4-5-20251001'): Promise<string> {
  if (!apiKey) {
    return `【デモモード】\n\nClaude APIキーが設定されていないため、実際のAI生成は行われません。\n\nシステム設定からClaude APIキーを設定してください。`
  }
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // レート制限対策：リトライ時は待機（指数バックオフ）
      if (attempt > 0) {
        const waitTime = Math.min(3000 * Math.pow(2, attempt), 15000)
        console.log(`Claude API retry ${attempt}/${maxRetries}, waiting ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelName,
          // 日本語は1文字≒1-2トークン、余裕を持って*3、上限も拡大
          max_tokens: maxChars ? Math.min(maxChars * 3, 16384) : 8192,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      })
      
      // 429（レート制限）または5xx（サーバーエラー）の場合はリトライ
      if (response.status === 429 || response.status >= 500) {
        const errorBody = await response.text().catch(() => '')
        lastError = new Error(`Claude API error: ${response.status} - ${errorBody.substring(0, 200)}`)
        console.error(`Claude API attempt ${attempt + 1}/${maxRetries} failed: ${response.status}`, errorBody.substring(0, 500))
        continue
      }
      
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        if (errorBody.includes('rate_limit') || errorBody.includes('overloaded')) {
          lastError = new Error(`Claude API rate limited: ${response.status}`)
          console.error(`Claude API rate limited, attempt ${attempt + 1}/${maxRetries}`)
          continue
        }
        throw new Error(`Claude API error: ${response.status} - ${errorBody.substring(0, 200)}`)
      }
      
      const data = await response.json()
      
      // stop_reasonをログ出力（デバッグ用）
      console.log(`Claude API response - stop_reason: ${data.stop_reason}, usage: ${JSON.stringify(data.usage)}`)
      
      // max_tokensで打ち切られた場合は警告
      if (data.stop_reason === 'max_tokens') {
        console.warn(`Claude API response truncated due to max_tokens limit. Input tokens: ${data.usage?.input_tokens}, Output tokens: ${data.usage?.output_tokens}`)
      }
      
      return data.content?.[0]?.text || ''
      
    } catch (error) {
      lastError = error as Error
      console.error(`Claude API attempt ${attempt + 1}/${maxRetries} error:`, error)
    }
  }
  
  throw lastError || new Error('Claude API failed after retries')
}

// 統合AI API呼び出し（Claude優先、Geminiフォールバック）
async function callAI(prompt: string, env: any, maxRetries = 3, maxChars?: number): Promise<string> {
  const { DB } = env
  const { claudeApiKey, geminiApiKey } = await getAPIKeys(env)
  
  // Claude APIキーがある場合はClaudeを優先
  if (claudeApiKey) {
    try {
      const modelName = await getAIModelName(DB, 'ai_model_claude')
      console.log('Using Claude API (primary)')
      return await callClaudeAPI(prompt, claudeApiKey, maxRetries, maxChars, modelName)
    } catch (claudeError) {
      console.error('Claude API failed, attempting Gemini fallback:', claudeError)
      
      // Geminiフォールバック
      if (geminiApiKey) {
        const geminiModel = await getAIModelName(DB, 'ai_model_gemini')
        console.log(`Falling back to Gemini API (${geminiModel})`)
        return await callGeminiAPI(prompt, geminiApiKey, maxRetries, maxChars, geminiModel)
      }
      
      throw claudeError
    }
  }
  
  // Claude APIキーがない場合はGeminiを試行
  if (geminiApiKey) {
    const geminiModel = await getAIModelName(DB, 'ai_model_gemini')
    console.log(`Claude API key not set, using Gemini API (${geminiModel})`)
    return await callGeminiAPI(prompt, geminiApiKey, maxRetries, maxChars, geminiModel)
  }
  
  throw new Error('AIのAPIキーが設定されていません。システム設定からClaude APIキーまたはGemini APIキーを設定してください。')
}

// チャット用AI呼び出し（Claude優先、Geminiフォールバック）
async function callAIForChat(prompt: string, env: any): Promise<string> {
  return callAI(prompt, env, 3)
}

// マルチモーダルClaude API呼び出し（画像/PDF対応、モデル名指定可能）
async function callClaudeAPIWithFile(prompt: string, fileData: ArrayBuffer, mimeType: string, apiKey: string, modelName: string = 'claude-haiku-4-5-20251001'): Promise<string> {
  if (!apiKey) {
    return `【デモモード】書類解析はAPIキーが必要です。システム設定からClaude APIキーを設定してください。`
  }
  
  // ArrayBufferをBase64に変換
  const base64Data = btoa(
    new Uint8Array(fileData).reduce((data, byte) => data + String.fromCharCode(byte), '')
  )
  
  // Claude APIはPDF/画像をサポート
  // Claude 3 Haiku/Sonnet/OpusはPDF対応（直接インライン）
  const mediaType = mimeType.includes('pdf') ? 'application/pdf' : mimeType
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          {
            type: mimeType.includes('pdf') ? 'document' : 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Claude multimodal API error:', response.status, errorText)
    throw new Error(`Claude API error: ${response.status}`)
  }
  
  const data = await response.json()
  return data.content?.[0]?.text || ''
}

// 書類からテキストを抽出する関数（Claude使用）
async function extractTextFromDocument(
  r2: R2Bucket,
  filePath: string,
  documentType: string,
  fileName: string,
  claudeApiKey: string,
  modelName: string = 'claude-haiku-4-5-20251001'
): Promise<string> {
  try {
    const object = await r2.get(filePath)
    if (!object) {
      return ''
    }
    
    const arrayBuffer = await object.arrayBuffer()
    const mimeType = object.httpMetadata?.contentType || 'application/octet-stream'
    
    // サポートされるファイル形式をチェック（Claude対応形式）
    const supportedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ]
    
    if (!supportedMimeTypes.some(t => mimeType.includes(t.split('/')[1]))) {
      return `【${documentType}】ファイル形式（${mimeType}）はテキスト抽出に対応していません。`
    }
    
    const extractionPrompt = `この書類（${documentType}: ${fileName}）の内容を詳細にテキスト化してください。

【抽出すべき情報】
- 会社情報（会社名、住所、代表者名など）
- 数値情報（売上、利益、従業員数、資本金など）
- 日付情報（設立日、決算期など）
- 事業内容や業種
- その他重要な情報

【出力形式】
- 重要な項目は「項目名: 値」の形式で
- 箇条書きで整理
- 不明瞭な部分は「（読み取り困難）」と記載
- マークダウン記法は使用しないでください`

    return await callClaudeAPIWithFile(extractionPrompt, arrayBuffer, mimeType, claudeApiKey, modelName)
  } catch (error) {
    console.error(`Document extraction error for ${filePath}:`, error)
    return `【${documentType}】テキスト抽出に失敗しました。`
  }
}

// 関数エクスポート（他のルートファイルから利用可能）
export { callAI, callAIForChat, callClaudeAPI, callGeminiAPI, callClaudeAPIWithFile, extractTextFromDocument, getAIModelName, getAPIKeys }

export default routes
