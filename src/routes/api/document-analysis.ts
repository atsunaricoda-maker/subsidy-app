// 書類解析・財務データ抽出API
// テナント分離: 自組織のクライアントのデータのみアクセス可能
// ClaudeとGeminiの両方に対応したOCR/Vision機能
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

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
    // site_settingsテーブルがない場合は環境変数のみ使用
  }
  
  return { claudeApiKey, geminiApiKey }
}

// Gemini Vision APIで画像解析（PDF対応）
async function analyzeImageWithGemini(imageBase64: string, mimeType: string, prompt: string, apiKey: string): Promise<string> {
  // GeminiはPDFも画像と同様に扱える
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        }
      })
    }
  )
  
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`Gemini API error: ${response.status} - ${errorBody.substring(0, 200)}`)
  }
  
  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// Claude Vision APIで画像解析（PDF対応）
async function analyzeImageWithClaude(imageBase64: string, mimeType: string, prompt: string, apiKey: string): Promise<string> {
  // ClaudeはPDFと画像で type が異なる
  const contentType = mimeType.includes('pdf') ? 'document' : 'image'
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          {
            type: contentType,
            source: {
              type: 'base64',
              media_type: mimeType,
              data: imageBase64
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
    const errorBody = await response.text().catch(() => '')
    throw new Error(`Claude API error: ${response.status} - ${errorBody.substring(0, 200)}`)
  }
  
  const data = await response.json()
  return data.content?.[0]?.text || ''
}

// 統合Vision API（Claude優先、Geminiフォールバック）
async function analyzeDocumentWithAI(
  imageBase64: string, 
  mimeType: string, 
  prompt: string, 
  claudeApiKey: string, 
  geminiApiKey: string
): Promise<{ result: string, usedModel: string }> {
  // Claude APIキーがある場合はClaudeを優先
  if (claudeApiKey) {
    try {
      console.log('Using Claude Vision API for document analysis')
      const result = await analyzeImageWithClaude(imageBase64, mimeType, prompt, claudeApiKey)
      return { result, usedModel: 'Claude' }
    } catch (claudeError) {
      console.error('Claude Vision API failed:', claudeError)
      
      // Geminiにフォールバック
      if (geminiApiKey) {
        console.log('Falling back to Gemini Vision API')
        const result = await analyzeImageWithGemini(imageBase64, mimeType, prompt, geminiApiKey)
        return { result, usedModel: 'Gemini (fallback)' }
      }
      throw claudeError
    }
  }
  
  // Claude APIキーがない場合はGeminiを使用
  if (geminiApiKey) {
    console.log('Using Gemini Vision API for document analysis')
    const result = await analyzeImageWithGemini(imageBase64, mimeType, prompt, geminiApiKey)
    return { result, usedModel: 'Gemini' }
  }
  
  throw new Error('AIのAPIキーが設定されていません。システム設定からClaude APIキーまたはGemini APIキーを設定してください。')
}

// R2から画像/PDFを取得してBase64に変換
async function getImageAsBase64(R2: any, filePath: string): Promise<{ base64: string, mimeType: string } | null> {
  try {
    const object = await R2.get(filePath)
    if (!object) return null
    
    const arrayBuffer = await object.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    
    // MIMEタイプを判定
    const ext = filePath.toLowerCase().split('.').pop()
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf'
    }
    const mimeType = mimeTypes[ext || ''] || 'image/jpeg'
    
    return { base64, mimeType }
  } catch (error) {
    console.error('Error getting image from R2:', error)
    return null
  }
}

// 書類タイプに基づく解析種別の判定
function getDocumentAnalysisType(documentType: string): string | null {
  const type = documentType.toLowerCase();
  if (type.includes('登記') || type.includes('謄本') || type.includes('履歴事項')) {
    return 'registry';
  }
  if (type.includes('決算') || type.includes('財務') || type.includes('貸借') || type.includes('損益') || type.includes('bs') || type.includes('pl')) {
    return 'financial_statement';
  }
  if (type.includes('確定申告') || type.includes('申告書')) {
    return 'tax_return';
  }
  return null;
}

// 解析タイプ別のプロンプト生成
function getAnalysisPrompt(analysisType: string): string {
  if (analysisType === 'registry') {
    return `この登記簿謄本（履歴事項全部証明書）から、以下の情報を抽出してJSON形式で返してください。
数値は数字のみ（カンマなし）、日付は YYYY-MM-DD 形式で返してください。
読み取れない項目は null としてください。

必要な情報:
- company_name: 会社名（商号）
- company_name_kana: 会社名のフリガナ（読み取れない場合は null）
- corporate_number: 法人番号（13桁、読み取れない場合は null）
- head_office_address: 本店所在地
- establishment_date: 設立年月日（YYYY-MM-DD形式）
- capital_amount: 資本金の額（数値のみ、円単位）
- business_purpose: 目的/事業内容（配列形式）
- representative_name: 代表者氏名
- representative_title: 代表者の役職（代表取締役、代表社員など）
- directors: 役員一覧（配列形式、各要素は {name: 氏名, title: 役職}）
- total_shares: 発行可能株式総数（数値のみ）
- issued_shares: 発行済株式の総数（数値のみ）

JSON形式のみで回答してください。説明文は不要です。`
  } else if (analysisType === 'financial_statement') {
    return `この財務諸表（決算書/貸借対照表/損益計算書）から、以下の情報を抽出してJSON形式で返してください。
金額は数値のみ（カンマなし、円単位）で返してください。
読み取れない項目は null としてください。

必要な情報:
- fiscal_year: 決算期（例: 2024年3月期 → "2024-03"）
- revenue: 売上高
- cost_of_sales: 売上原価
- gross_profit: 売上総利益
- selling_admin_expenses: 販売費及び一般管理費
- operating_income: 営業利益
- ordinary_income: 経常利益
- net_income: 当期純利益
- personnel_expenses: 人件費
- depreciation: 減価償却費
- total_assets: 総資産
- current_assets: 流動資産
- fixed_assets: 固定資産
- total_liabilities: 負債合計
- current_liabilities: 流動負債
- fixed_liabilities: 固定負債
- total_net_assets: 純資産合計
- capital_stock: 資本金
- retained_earnings: 利益剰余金
- employee_count: 従業員数

JSON形式のみで回答してください。説明文は不要です。`
  } else if (analysisType === 'tax_return') {
    return `この確定申告書から、以下の情報を抽出してJSON形式で返してください。
金額は数値のみ（カンマなし、円単位）で返してください。
読み取れない項目は null としてください。

必要な情報:
- tax_year: 申告年度（例: 令和5年 → "2023"）
- business_income: 事業所得
- total_income: 総所得金額
- total_expenses: 必要経費合計
- salary_wages: 給料賃金
- depreciation_expense: 減価償却費
- taxable_income: 課税所得金額
- income_tax: 所得税額
- employee_count: 従業員数（専従者を含む）

JSON形式のみで回答してください。説明文は不要です。`
  }
  return ''
}

// JSONレスポンスをパース
function parseAIResponse(response: string): any {
  try {
    // JSONブロックを抽出（```json ... ``` 形式の場合）
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim()
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('Failed to parse AI response as JSON:', error)
    return null
  }
}

// 書類解析をトリガー - テナント分離（Claude/Gemini対応）
routes.post('/documents/:id/analyze', async (c) => {
  const { DB, R2 } = c.env;
  const documentId = c.req.param('id');
  const user = await getCurrentUser(c);
  const orgId = getEffectiveOrgId(c, user);
  
  try {
    // 書類情報を取得（テナント分離）
    const document = await DB.prepare(`
      SELECT d.*, c.name as client_name 
      FROM documents d
      JOIN clients c ON d.client_id = c.id
      WHERE d.id = ? AND c.organization_id = ?
    `).bind(documentId, orgId).first();
    
    if (!document) {
      return c.json({ error: '書類が見つかりません' }, 404);
    }
    
    const analysisType = getDocumentAnalysisType(document.document_type as string);
    if (!analysisType) {
      return c.json({ error: 'この書類タイプは自動解析に対応していません' }, 400);
    }
    
    // 解析ログを作成
    await DB.prepare(`
      INSERT INTO document_analysis_logs (client_id, document_id, document_type, analysis_status)
      VALUES (?, ?, ?, 'processing')
    `).bind(document.client_id, documentId, analysisType).run();
    
    let extractedData: any = {};
    let warnings: string[] = [];
    let usedModel = 'none';
    
    // APIキーを取得
    const { claudeApiKey, geminiApiKey } = await getAPIKeys(c.env);
    
    // APIキーがある場合はAI解析を実行
    if (claudeApiKey || geminiApiKey) {
      // R2から書類を取得
      const imageData = await getImageAsBase64(R2, document.file_path as string);
      
      if (imageData) {
        const prompt = getAnalysisPrompt(analysisType);
        
        try {
          const aiResult = await analyzeDocumentWithAI(
            imageData.base64,
            imageData.mimeType,
            prompt,
            claudeApiKey,
            geminiApiKey
          );
          
          usedModel = aiResult.usedModel;
          const parsedData = parseAIResponse(aiResult.result);
          
          if (parsedData) {
            extractedData = parsedData;
            warnings.push(`${usedModel} で自動解析しました。内容を確認してください。`);
          } else {
            warnings.push('AI解析結果のパースに失敗しました。手動で入力してください。');
            extractedData = getDefaultExtractedData(analysisType);
          }
        } catch (aiError: any) {
          console.error('AI analysis failed:', aiError);
          warnings.push(`AI解析に失敗しました: ${aiError.message}`);
          extractedData = getDefaultExtractedData(analysisType);
        }
      } else {
        warnings.push('書類ファイルの取得に失敗しました。');
        extractedData = getDefaultExtractedData(analysisType);
      }
    } else {
      // APIキーがない場合はデフォルトデータ
      warnings.push('AIのAPIキーが設定されていません。システム設定からClaude APIキーまたはGemini APIキーを設定してください。');
      extractedData = getDefaultExtractedData(analysisType);
    }
    
    // 解析ログを更新
    await DB.prepare(`
      UPDATE document_analysis_logs 
      SET analysis_status = 'completed',
          extracted_data = ?,
          warnings = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE document_id = ? AND analysis_status = 'processing'
    `).bind(
      JSON.stringify(extractedData),
      JSON.stringify(warnings),
      documentId
    ).run();
    
    return c.json({
      success: true,
      document_id: documentId,
      analysis_type: analysisType,
      extracted_data: extractedData,
      warnings,
      used_model: usedModel,
      message: usedModel !== 'none' 
        ? `${usedModel} で書類を解析しました。内容を確認・修正してください。`
        : '書類の解析準備が完了しました。データを確認・入力してください。',
      requires_verification: true
    });
  } catch (error: any) {
    console.error('Document analysis error:', error);
    return c.json({ error: '書類の解析に失敗しました', details: error.message }, 500);
  }
});

// デフォルトの抽出データを返す
function getDefaultExtractedData(analysisType: string): any {
  if (analysisType === 'registry') {
    return {
      company_name: '',
      company_name_kana: '',
      corporate_number: '',
      head_office_address: '',
      establishment_date: '',
      capital_amount: null,
      business_purpose: [],
      representative_name: '',
      representative_title: '代表取締役',
      directors: [],
      total_shares: null,
      issued_shares: null
    };
  } else if (analysisType === 'financial_statement') {
    return {
      fiscal_year: '',
      revenue: null,
      cost_of_sales: null,
      gross_profit: null,
      selling_admin_expenses: null,
      operating_income: null,
      ordinary_income: null,
      net_income: null,
      personnel_expenses: null,
      depreciation: null,
      total_assets: null,
      total_liabilities: null,
      total_net_assets: null,
      employee_count: null
    };
  } else if (analysisType === 'tax_return') {
    return {
      tax_year: '',
      business_income: null,
      total_income: null,
      total_expenses: null,
      salary_wages: null,
      depreciation_expense: null,
      taxable_income: null,
      income_tax: null,
      employee_count: null
    };
  }
  return {};
}

// 登記簿データの保存・更新 - テナント分離
routes.post('/clients/:id/registry-data', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  const data = await c.req.json();
  const user = await getCurrentUser(c);
  const orgId = getEffectiveOrgId(c, user);
  
  try {
    // テナント分離: 自組織のクライアントか確認
    const clientCheck = await DB.prepare(`
      SELECT id FROM clients WHERE id = ? AND organization_id = ?
    `).bind(clientId, orgId).first();
    
    if (!clientCheck && orgId) {
      return c.json({ error: 'アクセス権限がありません' }, 403);
    }
    
    // 既存データをチェック
    const existing = await DB.prepare(`
      SELECT id FROM company_registry_data WHERE client_id = ?
    `).bind(clientId).first();
    
    if (existing) {
      // 更新
      await DB.prepare(`
        UPDATE company_registry_data SET
          company_name = ?,
          company_name_kana = ?,
          corporate_number = ?,
          head_office_address = ?,
          establishment_date = ?,
          capital_amount = ?,
          business_purpose = ?,
          representative_name = ?,
          representative_title = ?,
          representative_address = ?,
          directors = ?,
          total_shares = ?,
          issued_shares = ?,
          share_transfer_restriction = ?,
          document_id = ?,
          verified = ?,
          verified_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE verified_at END,
          manual_corrections = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE client_id = ?
      `).bind(
        data.company_name,
        data.company_name_kana,
        data.corporate_number,
        data.head_office_address,
        data.establishment_date,
        data.capital_amount,
        JSON.stringify(data.business_purpose || []),
        data.representative_name,
        data.representative_title,
        data.representative_address,
        JSON.stringify(data.directors || []),
        data.total_shares,
        data.issued_shares,
        data.share_transfer_restriction,
        data.document_id,
        data.verified ? 1 : 0,
        data.verified ? 1 : 0,
        data.manual_corrections ? JSON.stringify(data.manual_corrections) : null,
        clientId
      ).run();
    } else {
      // 新規作成
      await DB.prepare(`
        INSERT INTO company_registry_data (
          client_id, company_name, company_name_kana, corporate_number,
          head_office_address, establishment_date, capital_amount, business_purpose,
          representative_name, representative_title, representative_address,
          directors, total_shares, issued_shares, share_transfer_restriction,
          document_id, verified, verified_at, extraction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        clientId,
        data.company_name,
        data.company_name_kana,
        data.corporate_number,
        data.head_office_address,
        data.establishment_date,
        data.capital_amount,
        JSON.stringify(data.business_purpose || []),
        data.representative_name,
        data.representative_title,
        data.representative_address,
        JSON.stringify(data.directors || []),
        data.total_shares,
        data.issued_shares,
        data.share_transfer_restriction,
        data.document_id,
        data.verified ? 1 : 0,
        data.verified ? new Date().toISOString() : null
      ).run();
    }
    
    return c.json({ success: true, message: '登記簿データを保存しました' });
  } catch (error: any) {
    console.error('Registry data save error:', error);
    return c.json({ error: '登記簿データの保存に失敗しました', details: error.message }, 500);
  }
});

// 登記簿データの取得 - テナント分離
routes.get('/clients/:id/registry-data', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  const user = await getCurrentUser(c);
  const orgId = getEffectiveOrgId(c, user);
  
  try {
    // テナント分離: 自組織のクライアントか確認
    const clientCheck = await DB.prepare(`
      SELECT id FROM clients WHERE id = ? AND organization_id = ?
    `).bind(clientId, orgId).first();
    
    if (!clientCheck && orgId) {
      return c.json(null);
    }
    
    const data = await DB.prepare(`
      SELECT * FROM company_registry_data WHERE client_id = ?
    `).bind(clientId).first();
    
    if (!data) {
      return c.json(null);
    }
    
    // JSONフィールドをパース
    return c.json({
      ...data,
      business_purpose: data.business_purpose ? JSON.parse(data.business_purpose as string) : [],
      directors: data.directors ? JSON.parse(data.directors as string) : [],
      manual_corrections: data.manual_corrections ? JSON.parse(data.manual_corrections as string) : null
    });
  } catch (error: any) {
    return c.json({ error: '登記簿データの取得に失敗しました' }, 500);
  }
});

// 財務諸表データの保存・更新 - テナント分離
routes.post('/clients/:id/financial-statements', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  const data = await c.req.json();
  const user = await getCurrentUser(c);
  const orgId = getEffectiveOrgId(c, user);
  
  try {
    // テナント分離: 自組織のクライアントか確認
    const clientCheck = await DB.prepare(`
      SELECT id FROM clients WHERE id = ? AND organization_id = ?
    `).bind(clientId, orgId).first();
    
    if (!clientCheck && orgId) {
      return c.json({ error: 'アクセス権限がありません' }, 403);
    }
    
    // 既存データをチェック（同じ決算期）
    const existing = await DB.prepare(`
      SELECT id FROM financial_statements WHERE client_id = ? AND fiscal_year = ?
    `).bind(clientId, data.fiscal_year).first();
    
    if (existing) {
      // 更新
      await DB.prepare(`
        UPDATE financial_statements SET
          fiscal_period = ?, document_id = ?,
          revenue = ?, cost_of_sales = ?, gross_profit = ?,
          selling_admin_expenses = ?, operating_income = ?,
          non_operating_income = ?, non_operating_expenses = ?,
          ordinary_income = ?, extraordinary_income = ?, extraordinary_loss = ?,
          income_before_tax = ?, corporate_tax = ?, net_income = ?,
          personnel_expenses = ?, depreciation = ?, rent_expenses = ?,
          advertising_expenses = ?, rd_expenses = ?, other_expenses = ?,
          current_assets = ?, cash_and_deposits = ?, accounts_receivable = ?,
          inventory = ?, fixed_assets = ?, tangible_assets = ?,
          intangible_assets = ?, investments = ?, total_assets = ?,
          current_liabilities = ?, accounts_payable = ?, short_term_loans = ?,
          fixed_liabilities = ?, long_term_loans = ?, total_liabilities = ?,
          capital_stock = ?, capital_surplus = ?, retained_earnings = ?,
          total_net_assets = ?, employee_count = ?, average_salary = ?,
          verified = ?, verified_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE verified_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        data.fiscal_period, data.document_id,
        data.revenue, data.cost_of_sales, data.gross_profit,
        data.selling_admin_expenses, data.operating_income,
        data.non_operating_income, data.non_operating_expenses,
        data.ordinary_income, data.extraordinary_income, data.extraordinary_loss,
        data.income_before_tax, data.corporate_tax, data.net_income,
        data.personnel_expenses, data.depreciation, data.rent_expenses,
        data.advertising_expenses, data.rd_expenses, data.other_expenses,
        data.current_assets, data.cash_and_deposits, data.accounts_receivable,
        data.inventory, data.fixed_assets, data.tangible_assets,
        data.intangible_assets, data.investments, data.total_assets,
        data.current_liabilities, data.accounts_payable, data.short_term_loans,
        data.fixed_liabilities, data.long_term_loans, data.total_liabilities,
        data.capital_stock, data.capital_surplus, data.retained_earnings,
        data.total_net_assets, data.employee_count, data.average_salary,
        data.verified ? 1 : 0, data.verified ? 1 : 0,
        existing.id
      ).run();
    } else {
      // 新規作成
      await DB.prepare(`
        INSERT INTO financial_statements (
          client_id, fiscal_year, fiscal_period, document_id,
          revenue, cost_of_sales, gross_profit,
          selling_admin_expenses, operating_income,
          non_operating_income, non_operating_expenses,
          ordinary_income, extraordinary_income, extraordinary_loss,
          income_before_tax, corporate_tax, net_income,
          personnel_expenses, depreciation, rent_expenses,
          advertising_expenses, rd_expenses, other_expenses,
          current_assets, cash_and_deposits, accounts_receivable,
          inventory, fixed_assets, tangible_assets,
          intangible_assets, investments, total_assets,
          current_liabilities, accounts_payable, short_term_loans,
          fixed_liabilities, long_term_loans, total_liabilities,
          capital_stock, capital_surplus, retained_earnings,
          total_net_assets, employee_count, average_salary,
          verified, verified_at, extraction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        clientId, data.fiscal_year, data.fiscal_period, data.document_id,
        data.revenue, data.cost_of_sales, data.gross_profit,
        data.selling_admin_expenses, data.operating_income,
        data.non_operating_income, data.non_operating_expenses,
        data.ordinary_income, data.extraordinary_income, data.extraordinary_loss,
        data.income_before_tax, data.corporate_tax, data.net_income,
        data.personnel_expenses, data.depreciation, data.rent_expenses,
        data.advertising_expenses, data.rd_expenses, data.other_expenses,
        data.current_assets, data.cash_and_deposits, data.accounts_receivable,
        data.inventory, data.fixed_assets, data.tangible_assets,
        data.intangible_assets, data.investments, data.total_assets,
        data.current_liabilities, data.accounts_payable, data.short_term_loans,
        data.fixed_liabilities, data.long_term_loans, data.total_liabilities,
        data.capital_stock, data.capital_surplus, data.retained_earnings,
        data.total_net_assets, data.employee_count, data.average_salary,
        data.verified ? 1 : 0, data.verified ? new Date().toISOString() : null
      ).run();
    }
    
    // 財務指標を自動計算
    await calculateFinancialIndicators(DB, clientId, data.fiscal_year, 'financial_statement', data);
    
    return c.json({ success: true, message: '財務諸表データを保存しました' });
  } catch (error: any) {
    console.error('Financial statement save error:', error);
    return c.json({ error: '財務諸表データの保存に失敗しました', details: error.message }, 500);
  }
});

// 財務諸表データの取得 - テナント分離
routes.get('/clients/:id/financial-statements', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  const user = await getCurrentUser(c);
  const orgId = getEffectiveOrgId(c, user);
  
  try {
    // テナント分離: 自組織のクライアントか確認
    const clientCheck = await DB.prepare(`
      SELECT id FROM clients WHERE id = ? AND organization_id = ?
    `).bind(clientId, orgId).first();
    
    if (!clientCheck && orgId) {
      return c.json([]);
    }
    
    const data = await DB.prepare(`
      SELECT * FROM financial_statements 
      WHERE client_id = ? 
      ORDER BY fiscal_year DESC
    `).bind(clientId).all();
    
    return c.json(data.results || []);
  } catch (error: any) {
    return c.json({ error: '財務諸表データの取得に失敗しました' }, 500);
  }
});

// 財務指標の自動計算関数
async function calculateFinancialIndicators(
  DB: D1Database, 
  clientId: string, 
  fiscalYear: string, 
  sourceType: string,
  data: any
) {
  try {
    // 付加価値額の計算（中小企業庁方式）
    // 付加価値額 = 営業利益 + 人件費 + 減価償却費
    const addedValue = (data.operating_income || 0) + (data.personnel_expenses || 0) + (data.depreciation || 0);
    
    // 労働生産性 = 付加価値額 / 従業員数
    const laborProductivity = data.employee_count ? Math.round(addedValue / data.employee_count) : null;
    
    // 付加価値率 = 付加価値額 / 売上高
    const addedValueRate = data.revenue ? addedValue / data.revenue : null;
    
    // 一人当たり売上高
    const perCapitaSales = data.employee_count && data.revenue ? Math.round(data.revenue / data.employee_count) : null;
    
    // 収益性指標
    const grossProfitMargin = data.revenue ? (data.gross_profit || 0) / data.revenue : null;
    const operatingProfitMargin = data.revenue ? (data.operating_income || 0) / data.revenue : null;
    const ordinaryProfitMargin = data.revenue ? (data.ordinary_income || 0) / data.revenue : null;
    const netProfitMargin = data.revenue ? (data.net_income || 0) / data.revenue : null;
    
    // 安全性指標
    const equityRatio = data.total_assets ? (data.total_net_assets || 0) / data.total_assets : null;
    const currentRatio = data.current_liabilities ? (data.current_assets || 0) / data.current_liabilities : null;
    const debtRatio = data.total_net_assets ? (data.total_liabilities || 0) / data.total_net_assets : null;
    
    // ROE = 当期純利益 / 自己資本
    const roe = data.total_net_assets ? (data.net_income || 0) / data.total_net_assets : null;
    
    // ROA = 当期純利益 / 総資産
    const roa = data.total_assets ? (data.net_income || 0) / data.total_assets : null;
    
    // 既存データをチェック
    const existing = await DB.prepare(`
      SELECT id FROM financial_indicators 
      WHERE client_id = ? AND fiscal_year = ? AND source_type = ?
    `).bind(clientId, fiscalYear, sourceType).first();
    
    if (existing) {
      await DB.prepare(`
        UPDATE financial_indicators SET
          labor_productivity = ?,
          added_value = ?,
          added_value_rate = ?,
          per_capita_sales = ?,
          gross_profit_margin = ?,
          operating_profit_margin = ?,
          ordinary_profit_margin = ?,
          net_profit_margin = ?,
          equity_ratio = ?,
          current_ratio = ?,
          debt_ratio = ?,
          roe = ?,
          roa = ?,
          calculation_date = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        laborProductivity, addedValue, addedValueRate, perCapitaSales,
        grossProfitMargin, operatingProfitMargin, ordinaryProfitMargin, netProfitMargin,
        equityRatio, currentRatio, debtRatio, roe, roa,
        existing.id
      ).run();
    } else {
      await DB.prepare(`
        INSERT INTO financial_indicators (
          client_id, fiscal_year, source_type,
          labor_productivity, added_value, added_value_rate, per_capita_sales,
          gross_profit_margin, operating_profit_margin, ordinary_profit_margin, net_profit_margin,
          equity_ratio, current_ratio, debt_ratio, roe, roa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        clientId, fiscalYear, sourceType,
        laborProductivity, addedValue, addedValueRate, perCapitaSales,
        grossProfitMargin, operatingProfitMargin, ordinaryProfitMargin, netProfitMargin,
        equityRatio, currentRatio, debtRatio, roe, roa
      ).run();
    }
  } catch (error) {
    console.error('Financial indicators calculation error:', error);
  }
}

// 財務指標の取得 - テナント分離
routes.get('/clients/:id/financial-indicators', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  const user = await getCurrentUser(c);
  const orgId = getEffectiveOrgId(c, user);
  
  try {
    // テナント分離: 自組織のクライアントか確認
    const clientCheck = await DB.prepare(`
      SELECT id FROM clients WHERE id = ? AND organization_id = ?
    `).bind(clientId, orgId).first();
    
    if (!clientCheck && orgId) {
      return c.json([]);
    }
    
    const indicators = await DB.prepare(`
      SELECT * FROM financial_indicators 
      WHERE client_id = ? 
      ORDER BY fiscal_year DESC
    `).bind(clientId).all();
    
    return c.json(indicators.results || []);
  } catch (error: any) {
    return c.json({ error: '財務指標の取得に失敗しました' }, 500);
  }
});

// 確定申告書データの保存・更新 - テナント分離
routes.post('/clients/:id/tax-return', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  const data = await c.req.json();
  const user = await getCurrentUser(c);
  const orgId = getEffectiveOrgId(c, user);
  
  try {
    // テナント分離: 自組織のクライアントか確認
    const clientCheck = await DB.prepare(`
      SELECT id FROM clients WHERE id = ? AND organization_id = ?
    `).bind(clientId, orgId).first();
    
    if (!clientCheck && orgId) {
      return c.json({ error: 'アクセス権限がありません' }, 403);
    }
    
    const existing = await DB.prepare(`
      SELECT id FROM tax_return_data WHERE client_id = ? AND tax_year = ?
    `).bind(clientId, data.tax_year).first();
    
    if (existing) {
      await DB.prepare(`
        UPDATE tax_return_data SET
          document_id = ?,
          business_income = ?, agricultural_income = ?,
          real_estate_income = ?, salary_income = ?,
          miscellaneous_income = ?, total_income = ?,
          total_expenses = ?, salary_wages = ?,
          outsourcing_cost = ?, depreciation_expense = ?,
          interest_discount = ?, rent_cost = ?,
          utility_cost = ?, communication_cost = ?,
          advertising_cost = ?, consumables_cost = ?,
          taxable_income = ?, income_tax = ?,
          blue_return_deduction = ?,
          employee_count = ?, family_employee_count = ?,
          verified = ?, verified_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE verified_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        data.document_id,
        data.business_income, data.agricultural_income,
        data.real_estate_income, data.salary_income,
        data.miscellaneous_income, data.total_income,
        data.total_expenses, data.salary_wages,
        data.outsourcing_cost, data.depreciation_expense,
        data.interest_discount, data.rent_cost,
        data.utility_cost, data.communication_cost,
        data.advertising_cost, data.consumables_cost,
        data.taxable_income, data.income_tax,
        data.blue_return_deduction,
        data.employee_count, data.family_employee_count,
        data.verified ? 1 : 0, data.verified ? 1 : 0,
        existing.id
      ).run();
    } else {
      await DB.prepare(`
        INSERT INTO tax_return_data (
          client_id, tax_year, document_id,
          business_income, agricultural_income,
          real_estate_income, salary_income,
          miscellaneous_income, total_income,
          total_expenses, salary_wages,
          outsourcing_cost, depreciation_expense,
          interest_discount, rent_cost,
          utility_cost, communication_cost,
          advertising_cost, consumables_cost,
          taxable_income, income_tax,
          blue_return_deduction,
          employee_count, family_employee_count,
          verified, verified_at, extraction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        clientId, data.tax_year, data.document_id,
        data.business_income, data.agricultural_income,
        data.real_estate_income, data.salary_income,
        data.miscellaneous_income, data.total_income,
        data.total_expenses, data.salary_wages,
        data.outsourcing_cost, data.depreciation_expense,
        data.interest_discount, data.rent_cost,
        data.utility_cost, data.communication_cost,
        data.advertising_cost, data.consumables_cost,
        data.taxable_income, data.income_tax,
        data.blue_return_deduction,
        data.employee_count, data.family_employee_count,
        data.verified ? 1 : 0, data.verified ? new Date().toISOString() : null
      ).run();
    }
    
    return c.json({ success: true, message: '確定申告書データを保存しました' });
  } catch (error: any) {
    console.error('Tax return save error:', error);
    return c.json({ error: '確定申告書データの保存に失敗しました', details: error.message }, 500);
  }
});

// 確定申告書データの取得 - テナント分離
routes.get('/clients/:id/tax-return', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  const user = await getCurrentUser(c);
  const orgId = getEffectiveOrgId(c, user);
  
  try {
    // テナント分離: 自組織のクライアントか確認
    const clientCheck = await DB.prepare(`
      SELECT id FROM clients WHERE id = ? AND organization_id = ?
    `).bind(clientId, orgId).first();
    
    if (!clientCheck && orgId) {
      return c.json([]);
    }
    
    const data = await DB.prepare(`
      SELECT * FROM tax_return_data 
      WHERE client_id = ? 
      ORDER BY tax_year DESC
    `).bind(clientId).all();
    
    return c.json(data.results || []);
  } catch (error: any) {
    return c.json({ error: '確定申告書データの取得に失敗しました' }, 500);
  }
});

// 事業計画テンプレート取得
routes.get('/business-plan-templates/:subsidyTypeId', async (c) => {
  const { DB } = c.env;
  const subsidyTypeId = c.req.param('subsidyTypeId');
  
  try {
    const templates = await DB.prepare(`
      SELECT * FROM business_plan_templates 
      WHERE subsidy_type_id = ?
      ORDER BY section_order ASC
    `).bind(subsidyTypeId).all();
    
    // JSONフィールドをパース
    const result = (templates.results || []).map((t: any) => ({
      ...t,
      key_points: t.key_points ? JSON.parse(t.key_points) : [],
      common_mistakes: t.common_mistakes ? JSON.parse(t.common_mistakes) : [],
      successful_patterns: t.successful_patterns ? JSON.parse(t.successful_patterns) : null,
      keyword_suggestions: t.keyword_suggestions ? JSON.parse(t.keyword_suggestions) : []
    }));
    
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: 'テンプレートの取得に失敗しました' }, 500);
  }
});

// 顧客の抽出データサマリー取得（基本情報フィールド埋め用）- テナント分離
routes.get('/clients/:id/extracted-data-summary', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  const user = await getCurrentUser(c);
  const orgId = getEffectiveOrgId(c, user);
  
  try {
    // テナント分離: 自組織のクライアントか確認
    const clientCheck = await DB.prepare(`
      SELECT id FROM clients WHERE id = ? AND organization_id = ?
    `).bind(clientId, orgId).first();
    
    if (!clientCheck && orgId) {
      return c.json({ registry: null, financial_statement: null, tax_return: null, financial_indicators: null, summary: {} });
    }
    
    // 登記簿データ
    const registry = await DB.prepare(`
      SELECT * FROM company_registry_data WHERE client_id = ?
    `).bind(clientId).first();
    
    // 最新の財務諸表
    const financial = await DB.prepare(`
      SELECT * FROM financial_statements 
      WHERE client_id = ? 
      ORDER BY fiscal_year DESC LIMIT 1
    `).bind(clientId).first();
    
    // 最新の確定申告書
    const taxReturn = await DB.prepare(`
      SELECT * FROM tax_return_data 
      WHERE client_id = ? 
      ORDER BY tax_year DESC LIMIT 1
    `).bind(clientId).first();
    
    // 財務指標
    const indicators = await DB.prepare(`
      SELECT * FROM financial_indicators 
      WHERE client_id = ? 
      ORDER BY fiscal_year DESC LIMIT 1
    `).bind(clientId).first();
    
    return c.json({
      registry: registry ? {
        ...registry,
        business_purpose: registry.business_purpose ? JSON.parse(registry.business_purpose as string) : [],
        directors: registry.directors ? JSON.parse(registry.directors as string) : []
      } : null,
      financial_statement: financial,
      tax_return: taxReturn,
      financial_indicators: indicators,
      summary: {
        company_name: registry?.company_name || null,
        address: registry?.head_office_address || null,
        establishment_date: registry?.establishment_date || null,
        capital_amount: registry?.capital_amount || null,
        representative_name: registry?.representative_name || null,
        employee_count: financial?.employee_count || taxReturn?.employee_count || null,
        annual_revenue: financial?.revenue || taxReturn?.business_income || null,
        operating_income: financial?.operating_income || null,
        labor_productivity: indicators?.labor_productivity || null,
        added_value: indicators?.added_value || null
      }
    });
  } catch (error: any) {
    return c.json({ error: 'データサマリーの取得に失敗しました' }, 500);
  }
});

// 選択的インポート（特定テーブルのみ）
routes.post('/backup/import-selective', async (c) => {
  const { DB } = c.env
  
  try {
    const { tables: selectedTables, data, merge_mode = false } = await c.req.json()
    
    if (!selectedTables || !Array.isArray(selectedTables) || !data?.tables) {
      return c.json({ error: '無効なリクエストです' }, 400)
    }

    const results = {
      success: true,
      imported: {} as Record<string, number>,
      errors: [] as string[]
    }

    for (const tableName of selectedTables) {
      const records = data.tables[tableName]
      if (!records || !Array.isArray(records) || records.length === 0) {
        results.imported[tableName] = 0
        continue
      }

      try {
        // マージモードでない場合は既存データを削除
        if (!merge_mode) {
          await DB.prepare(`DELETE FROM ${tableName}`).run()
        }

        let importedCount = 0
        for (const record of records) {
          const columns = Object.keys(record)
          const values = Object.values(record)
          const placeholders = columns.map(() => '?').join(', ')
          
          try {
            if (merge_mode) {
              // マージモード: INSERT OR REPLACE
              await DB.prepare(`
                INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) 
                VALUES (${placeholders})
              `).bind(...values).run()
            } else {
              await DB.prepare(`
                INSERT INTO ${tableName} (${columns.join(', ')}) 
                VALUES (${placeholders})
              `).bind(...values).run()
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
      message: results.success 
        ? '選択したデータの復元が完了しました' 
        : '一部のデータの復元に失敗しました',
      restored_at: new Date().toISOString()
    })
  } catch (error: any) {
    return c.json({ error: '選択的インポートに失敗しました', details: error.message }, 500)
  }
})

export default routes
