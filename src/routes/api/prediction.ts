// フェーズ4: 採択率予測システム強化
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 詳細な採択率予測API
routes.post('/clients/:clientId/predict-adoption', async (c) => {
  const { DB } = c.env
  const env = c.env
  const clientId = c.req.param('clientId')
  
  // 顧客情報取得
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name, st.category, st.description as subsidy_description
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(clientId).first()
  
  if (!client) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  // 企業プロファイル取得
  const profile = await DB.prepare(`
    SELECT * FROM client_profiles WHERE client_id = ?
  `).bind(clientId).first()
  
  // ヒアリング回答取得
  const answers = await DB.prepare(`
    SELECT hq.question_key, hq.question_text, hq.category, ha.answer_text
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
  `).bind(clientId).all()
  
  // 採択事例取得（同じ補助金）
  const successCases = await DB.prepare(`
    SELECT * FROM success_cases 
    WHERE subsidy_type_id = ? AND is_public = 1
    ORDER BY fiscal_year DESC
    LIMIT 5
  `).bind(client.subsidy_type_id).all()
  
  // 公募要領取得
  const guideline = await DB.prepare(`
    SELECT * FROM subsidy_guidelines 
    WHERE subsidy_type_id = ? AND status = 'active'
    LIMIT 1
  `).bind(client.subsidy_type_id).first()
  
  // 生成文書の有無確認
  const generatedDocs = await DB.prepare(`
    SELECT COUNT(*) as count FROM generated_documents WHERE client_id = ?
  `).bind(clientId).first()
  
  const answeredQuestions = (answers.results || []).filter((a: any) => a.answer_text).length
  const totalQuestions = (answers.results || []).length || 1
  
  const prompt = `あなたは補助金審査の専門家です。以下の情報を基に、この企業の補助金採択可能性を詳細に分析してください。

【申請補助金】
- 名称: ${client.subsidy_name || '未選択'}
- カテゴリ: ${client.category || '不明'}
- 説明: ${client.subsidy_description || ''}
${guideline ? `
- 補助率: ${guideline.subsidy_rate || '不明'}
- 上限額: ${guideline.max_amount ? (guideline.max_amount / 10000) + '万円' : '不明'}
- 申請締切: ${guideline.application_end_date || '不明'}
` : ''}

【企業情報】
- 会社名: ${client.company_name || '未設定'}
- 担当者: ${client.name}
- 業種: ${profile?.industry || '不明'}
- 従業員数: ${profile?.employee_count || '不明'}人
- 年商: ${profile?.annual_revenue ? profile.annual_revenue + '万円' : '不明'}
- 設立年: ${profile?.establishment_year || '不明'}
- 所在地: ${profile?.region || '不明'}
- 経営課題: ${profile?.business_challenges || '不明'}
- 投資計画: ${profile?.investment_plans || '不明'}

【ヒアリング情報】（回答率: ${Math.round(answeredQuestions / totalQuestions * 100)}%）
${(answers.results || []).map((a: any) => `【${a.category}】${a.question_text}\n回答: ${a.answer_text || '（未回答）'}`).join('\n\n')}

【申請書作成状況】
- 生成済み文書数: ${generatedDocs?.count || 0}件

【類似企業の採択事例】（参考）
${(successCases.results || []).slice(0, 3).map((c: any, i: number) => `
事例${i+1}: ${c.company_industry}（${c.company_size}）
- 成功ポイント: ${c.success_summary}
- 成功要因: ${c.key_factors}
`).join('')}

上記を総合的に分析し、以下のJSON形式で回答してください：
{
  "adoption_probability": 0-100の整数（採択可能性%）,
  "confidence_level": "high" | "medium" | "low"（予測の確信度）,
  "overall_assessment": "S" | "A" | "B" | "C" | "D"（総合評価）,
  "score_breakdown": {
    "eligibility": { "score": 0-100, "comment": "申請資格に関するコメント" },
    "business_plan": { "score": 0-100, "comment": "事業計画に関するコメント" },
    "innovation": { "score": 0-100, "comment": "革新性に関するコメント" },
    "feasibility": { "score": 0-100, "comment": "実現可能性に関するコメント" },
    "expected_effect": { "score": 0-100, "comment": "期待効果に関するコメント" }
  },
  "strengths": ["強み1", "強み2", "強み3"],
  "weaknesses": ["弱み1", "弱み2"],
  "improvement_suggestions": [
    { "priority": "high" | "medium" | "low", "suggestion": "具体的な改善提案", "expected_impact": "改善による効果" }
  ],
  "similar_success_rate": "類似企業の採択率の目安（%）",
  "key_success_factors": ["採択に向けて特に重要なポイント1", "ポイント2"],
  "risk_factors": ["リスク要因1", "リスク要因2"],
  "recommended_actions": ["今すぐ実行すべきアクション1", "アクション2", "アクション3"]
}`

  try {
    const response = await callAI(prompt, env)
    
    // JSONを抽出してクリーニング
    let jsonStr = response
    // マークダウンのコードブロックを除去
    jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
    // 最初の { から最後の } までを抽出
    const startIdx = jsonStr.indexOf('{')
    const endIdx = jsonStr.lastIndexOf('}')
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1)
    }
    // 制御文字を除去
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ')
    
    if (jsonStr) {
      const result = JSON.parse(jsonStr)
      
      // 予測結果をDBに保存
      await DB.prepare(`
        INSERT OR REPLACE INTO subsidy_match_scores 
        (client_id, subsidy_type_id, match_score, adoption_probability, ai_recommendation, score_breakdown, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        clientId,
        client.subsidy_type_id,
        result.adoption_probability,
        result.adoption_probability,
        result.overall_assessment + ': ' + (result.improvement_suggestions?.[0]?.suggestion || ''),
        JSON.stringify(result.score_breakdown)
      ).run()
      
      return c.json({
        success: true,
        prediction: result,
        metadata: {
          client_id: clientId,
          subsidy_name: client.subsidy_name,
          analyzed_at: new Date().toISOString(),
          data_completeness: Math.round(answeredQuestions / totalQuestions * 100)
        }
      })
    }
    
    // JSON解析に失敗した場合のフォールバック
    return c.json({ 
      error: 'AI分析の解析に失敗しました',
      prediction: {
        adoption_probability: 50,
        confidence_level: 'low',
        overall_assessment: 'C',
        improvement_suggestions: [{ priority: 'high', suggestion: 'ヒアリング情報を充実させてください', expected_impact: '予測精度の向上' }]
      }
    }, 500)
  } catch (error: any) {
    console.error('Predict adoption error:', error?.message || error)
    
    // エラー時でもできる限り有用な情報を返す
    const dataCompleteness = Math.round(answeredQuestions / totalQuestions * 100)
    const hasProfile = !!(profile?.industry || profile?.employee_count)
    
    // 簡易的な評価を生成
    let estimatedProbability = 30 // ベース
    let assessment = 'D'
    
    if (dataCompleteness >= 80) {
      estimatedProbability += 30
      assessment = 'B'
    } else if (dataCompleteness >= 50) {
      estimatedProbability += 15
      assessment = 'C'
    }
    
    if (hasProfile) {
      estimatedProbability += 10
    }
    
    if (generatedDocs?.count > 0) {
      estimatedProbability += 10
    }
    
    return c.json({ 
      success: true,
      error: 'AI分析が一時的に利用できません。簡易評価を表示しています。',
      prediction: {
        adoption_probability: Math.min(estimatedProbability, 70),
        confidence_level: 'low',
        overall_assessment: assessment,
        score_breakdown: {
          eligibility: { score: hasProfile ? 50 : 20, comment: hasProfile ? '基本情報が登録されています' : '企業情報が不足しています' },
          business_plan: { score: dataCompleteness >= 50 ? 50 : 20, comment: `ヒアリング回答率: ${dataCompleteness}%` },
          innovation: { score: 30, comment: 'AI分析が必要です' },
          feasibility: { score: 30, comment: 'AI分析が必要です' },
          expected_effect: { score: 30, comment: 'AI分析が必要です' }
        },
        strengths: dataCompleteness >= 50 ? ['ヒアリング情報が一定量入力されています'] : ['現時点では特定できません'],
        weaknesses: [
          ...(hasProfile ? [] : ['企業プロファイルが未入力です']),
          ...(dataCompleteness < 50 ? ['ヒアリング情報が不足しています'] : []),
          ...(generatedDocs?.count === 0 ? ['申請書類が未作成です'] : [])
        ],
        improvement_suggestions: [
          ...(hasProfile ? [] : [{ priority: 'high', suggestion: '企業プロファイルを入力してください', expected_impact: '申請資格の確認が可能になります' }]),
          ...(dataCompleteness < 80 ? [{ priority: 'high', suggestion: 'ヒアリング質問に回答してください', expected_impact: '採択率予測の精度が向上します' }] : []),
          { priority: 'medium', suggestion: '後ほど再度AI分析を実行してください', expected_impact: 'より詳細な分析結果を取得できます' }
        ],
        similar_success_rate: 'AI分析が必要です',
        key_success_factors: ['ヒアリング情報の充実', '企業情報の詳細入力', '申請書類の準備'],
        risk_factors: ['情報不足による低評価', 'AI分析未完了'],
        recommended_actions: ['ヒアリング質問への回答を完了させる', '企業プロファイルを入力する', '後ほど再度分析を実行する']
      },
      metadata: {
        client_id: clientId,
        subsidy_name: client.subsidy_name,
        analyzed_at: new Date().toISOString(),
        data_completeness: dataCompleteness,
        is_fallback: true
      }
    })
  }
})

export default routes
