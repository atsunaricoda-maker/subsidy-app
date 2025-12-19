// 補助金マッチングAPI
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 企業プロファイル取得/作成
routes.get('/clients/:clientId/profile', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const profile = await DB.prepare(`
    SELECT * FROM client_profiles WHERE client_id = ?
  `).bind(clientId).first()
  
  return c.json(profile || {})
})

routes.put('/clients/:clientId/profile', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  
  // 既存プロファイル確認
  const existing = await DB.prepare(`
    SELECT id FROM client_profiles WHERE client_id = ?
  `).bind(clientId).first()
  
  if (existing) {
    await DB.prepare(`
      UPDATE client_profiles SET
        industry = ?, employee_count = ?, annual_revenue = ?,
        establishment_year = ?, region = ?,
        business_challenges = ?, investment_plans = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE client_id = ?
    `).bind(
      data.industry,
      data.employee_count,
      data.annual_revenue,
      data.establishment_year,
      data.region,
      JSON.stringify(data.business_challenges || []),
      JSON.stringify(data.investment_plans || []),
      clientId
    ).run()
  } else {
    await DB.prepare(`
      INSERT INTO client_profiles 
      (client_id, industry, employee_count, annual_revenue, establishment_year, region, business_challenges, investment_plans)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      clientId,
      data.industry,
      data.employee_count,
      data.annual_revenue,
      data.establishment_year,
      data.region,
      JSON.stringify(data.business_challenges || []),
      JSON.stringify(data.investment_plans || [])
    ).run()
  }
  
  return c.json({ success: true })
})

// 補助金マッチング実行
routes.post('/clients/:clientId/match-subsidies', async (c) => {
  const { DB } = c.env
  const env = c.env
  const clientId = c.req.param('clientId')
  
  // 顧客プロファイル取得
  const profile = await DB.prepare(`
    SELECT * FROM client_profiles WHERE client_id = ?
  `).bind(clientId).first()
  
  // ヒアリング回答取得
  const answers = await DB.prepare(`
    SELECT hq.question_text, ha.answer_text
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
  `).bind(clientId).all()
  
  // 全補助金種別取得
  const subsidies = await DB.prepare(`
    SELECT st.*, sg.max_amount, sg.min_amount, sg.subsidy_rate, sg.application_end_date
    FROM subsidy_types st
    LEFT JOIN subsidy_guidelines sg ON st.id = sg.subsidy_type_id AND sg.status = 'active'
  `).all()
  
  const matchResults = []
  
  for (const subsidy of (subsidies.results || [])) {
    // AIでマッチングスコアを計算
    const prompt = `以下の企業情報と補助金の適合性を0-100のスコアで評価し、JSON形式で回答してください。

【企業情報】
- 業種: ${profile?.industry || '不明'}
- 従業員数: ${profile?.employee_count || '不明'}
- 年商: ${profile?.annual_revenue ? profile.annual_revenue + '万円' : '不明'}
- 所在地: ${profile?.region || '不明'}
- 経営課題: ${profile?.business_challenges || '不明'}
- 投資計画: ${profile?.investment_plans || '不明'}

【ヒアリング情報】
${(answers.results || []).map((a: any) => `${a.question_text}: ${a.answer_text || '未回答'}`).join('\n')}

【補助金情報】
- 名称: ${subsidy.name}
- カテゴリ: ${subsidy.category}
- 説明: ${subsidy.description}
- 上限額: ${subsidy.max_amount ? (subsidy.max_amount / 10000) + '万円' : '不明'}
- 補助率: ${subsidy.subsidy_rate || '不明'}

以下のJSON形式で回答してください：
{
  "score": 0-100の整数,
  "adoption_probability": 0-100の整数（採択可能性%）,
  "recommendation": "この企業にこの補助金をお勧めする理由または懸念点（100文字以内）",
  "key_points": ["ポイント1", "ポイント2"]
}`

    try {
      const response = await callAI(prompt, env)
      
      // JSONを抽出してクリーニング
      let jsonStr = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
      const startIdx = jsonStr.indexOf('{')
      const endIdx = jsonStr.lastIndexOf('}')
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonStr = jsonStr.substring(startIdx, endIdx + 1)
      }
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ')
      
      if (jsonStr) {
        const result = JSON.parse(jsonStr)
        
        // スコアを保存
        await DB.prepare(`
          INSERT OR REPLACE INTO subsidy_match_scores 
          (client_id, subsidy_type_id, match_score, adoption_probability, ai_recommendation, score_breakdown)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          clientId,
          subsidy.id,
          result.score,
          result.adoption_probability,
          result.recommendation,
          JSON.stringify(result.key_points)
        ).run()
        
        matchResults.push({
          subsidy_id: subsidy.id,
          subsidy_name: subsidy.name,
          category: subsidy.category,
          ...result
        })
      }
    } catch (error) {
      // エラーの場合はデフォルトスコア
      matchResults.push({
        subsidy_id: subsidy.id,
        subsidy_name: subsidy.name,
        category: subsidy.category,
        score: 50,
        recommendation: '自動評価に失敗しました。手動で確認してください。'
      })
    }
  }
  
  // スコア順にソート
  matchResults.sort((a, b) => (b.score || 0) - (a.score || 0))
  
  return c.json(matchResults)
})

// マッチングスコア取得
routes.get('/clients/:clientId/match-scores', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const result = await DB.prepare(`
    SELECT sms.*, st.name as subsidy_name, st.category
    FROM subsidy_match_scores sms
    JOIN subsidy_types st ON sms.subsidy_type_id = st.id
    WHERE sms.client_id = ?
    ORDER BY sms.match_score DESC
  `).bind(clientId).all()
  
  return c.json(result.results)
})

export default routes
