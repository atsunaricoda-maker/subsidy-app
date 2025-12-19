// フェーズ4: 複数補助金マッチング強化
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 全補助金との詳細マッチング分析
routes.post('/clients/:clientId/comprehensive-matching', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  // 顧客情報取得
  const client = await DB.prepare(`
    SELECT * FROM clients WHERE id = ?
  `).bind(clientId).first()
  
  if (!client) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  // 企業プロファイル
  const profile = await DB.prepare(`
    SELECT * FROM client_profiles WHERE client_id = ?
  `).bind(clientId).first()
  
  // ヒアリング回答
  const answers = await DB.prepare(`
    SELECT hq.question_text, hq.category, ha.answer_text
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
  `).bind(clientId).all()
  
  // 全補助金種別と公募要領
  const subsidies = await DB.prepare(`
    SELECT st.*, sg.max_amount, sg.min_amount, sg.subsidy_rate, 
           sg.application_start_date, sg.application_end_date, sg.status as guideline_status
    FROM subsidy_types st
    LEFT JOIN subsidy_guidelines sg ON st.id = sg.subsidy_type_id AND sg.status = 'active'
  `).all()
  
  const prompt = `あなたは補助金コンサルタントの専門家です。以下の企業情報を基に、利用可能な全ての補助金との適合性を詳細に分析してください。

【企業情報】
- 会社名: ${client.company_name || '未設定'}
- 業種: ${profile?.industry || '不明'}
- 従業員数: ${profile?.employee_count || '不明'}人
- 年商: ${profile?.annual_revenue ? profile.annual_revenue + '万円' : '不明'}
- 設立年: ${profile?.establishment_year || '不明'}年
- 所在地: ${profile?.region || '不明'}
- 経営課題: ${profile?.business_challenges || '不明'}
- 投資計画: ${profile?.investment_plans || '不明'}

【ヒアリング情報】
${(answers.results || []).map((a: any) => `【${a.category}】${a.question_text}\n回答: ${a.answer_text || '未回答'}`).join('\n\n')}

【利用可能な補助金一覧】
${(subsidies.results || []).map((s: any) => `
- ${s.name}（${s.category}）
  説明: ${s.description || ''}
  補助率: ${s.subsidy_rate || '不明'}
  上限額: ${s.max_amount ? (s.max_amount / 10000) + '万円' : '不明'}
  申請期間: ${s.application_start_date || '?'} 〜 ${s.application_end_date || '?'}
`).join('')}

企業に最も適した補助金を上位3件選び、以下のJSON形式のみで回答してください。
必ずJSONのみを出力してください。説明文や前置きは一切不要です。recommendationsは必ず3件以下にしてください。

{"company_summary":"企業の特徴（50字以内）","recommendations":[{"subsidy_name":"補助金名","match_score":50,"adoption_probability":50,"application_complexity":"普通","rank":1,"reasons":["理由1"],"concerns":["懸念点1"],"estimated_amount":"100万円","compatibility":{"eligibility":{"met":true,"detail":"申請資格あり"},"timing":{"status":"申請可能"}}}],"overall_strategy":"補助金活用戦略（50字以内）","priority_actions":["アクション1","アクション2"]}`

  try {
    const response = await callAI(prompt, c.env)
    
    // JSONを抽出してクリーニング
    let jsonStr = response
    jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
    const startIdx = jsonStr.indexOf('{')
    const endIdx = jsonStr.lastIndexOf('}')
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1)
    }
    // 制御文字と問題のある文字を除去
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ')
    // 改行を削除してJSONを整形
    jsonStr = jsonStr.replace(/\n/g, ' ').replace(/\r/g, ' ')
    // 複数スペースを1つに
    jsonStr = jsonStr.replace(/\s+/g, ' ')
    
    let result = null
    try {
      result = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('JSON parse error, trying to fix:', parseError)
      // 一般的なJSON修正を試みる
      jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
      result = JSON.parse(jsonStr)
    }
    
    if (result) {
      
      // 各補助金のスコアをDBに保存
      for (const rec of (result.recommendations || [])) {
        const subsidy = (subsidies.results || []).find((s: any) => s.name === rec.subsidy_name)
        if (subsidy) {
          await DB.prepare(`
            INSERT OR REPLACE INTO subsidy_match_scores 
            (client_id, subsidy_type_id, match_score, adoption_probability, ai_recommendation, score_breakdown, calculated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            clientId,
            subsidy.id,
            rec.match_score || 50,
            rec.adoption_probability || rec.match_score || 50,
            rec.reasons?.join(', ') || '',
            JSON.stringify(rec.compatibility || {})
          ).run()
        }
      }
      
      return c.json({
        success: true,
        analysis: result,
        metadata: {
          client_id: clientId,
          analyzed_at: new Date().toISOString(),
          subsidies_analyzed: subsidies.results?.length || 0
        }
      })
    }
    
    // JSON解析失敗時のフォールバック
    return c.json({
      success: true,
      analysis: {
        company_summary: '企業情報を分析中です。詳細な分析にはヒアリング情報の充実が必要です。',
        recommendations: (subsidies.results || []).slice(0, 5).map((s: any, i: number) => ({
          subsidy_name: s.name,
          match_score: 50,
          adoption_probability: 50,
          rank: i + 1,
          compatibility: {
            eligibility: { met: true, detail: '詳細確認が必要です' },
            business_fit: { score: 50, detail: 'ヒアリング情報をもとに再分析してください' },
            timing: { status: '要確認', deadline_days: null }
          },
          reasons: ['基本的な要件は満たしている可能性があります'],
          concerns: ['詳細情報が不足しているため正確な判定ができません'],
          preparation_steps: ['ヒアリング質問に回答してください', '企業プロファイルを充実させてください'],
          estimated_amount: '要算出',
          application_complexity: '普通'
        })),
        overall_strategy: 'まずはヒアリング質問への回答を完了させ、企業プロファイルを充実させてください。その後、再度分析を実行することでより精度の高い結果が得られます。',
        priority_actions: ['ヒアリング質問に回答する', '企業プロファイルを更新する', '再度総合分析を実行する']
      },
      metadata: {
        client_id: clientId,
        analyzed_at: new Date().toISOString(),
        subsidies_analyzed: subsidies.results?.length || 0,
        partial: true
      }
    })
  } catch (error: any) {
    console.error('Comprehensive matching error:', error)
    
    // エラー時でもできる限り有用なフォールバックを返す
    const subsidyList = (subsidies.results || []).slice(0, 3)
    
    return c.json({
      success: true,
      error: 'AI分析が一時的に利用できません。基本的な補助金情報を表示しています。',
      analysis: {
        company_summary: client.company_name ? `${client.company_name}様の補助金候補` : '補助金候補一覧',
        recommendations: subsidyList.map((s: any, i: number) => ({
          subsidy_name: s.name,
          match_score: 50,
          adoption_probability: 50,
          application_complexity: '普通',
          rank: i + 1,
          reasons: [`${s.category}カテゴリの補助金です`, s.description ? s.description.substring(0, 50) + '...' : '詳細は公募要領をご確認ください'],
          concerns: ['詳細な適合性分析にはAI分析が必要です'],
          estimated_amount: s.max_amount ? `最大${(s.max_amount / 10000).toLocaleString()}万円` : '要確認',
          compatibility: { eligibility: { met: true, detail: '要確認' }, timing: { status: '要確認' } }
        })),
        overall_strategy: 'AI分析が一時的に利用できないため、基本的な補助金情報を表示しています。後ほど再度「総合分析」を実行してください。',
        priority_actions: [
          'ヒアリング質問への回答を完了させる',
          '企業プロファイルを充実させる', 
          '後ほど再度総合分析を実行する'
        ]
      },
      metadata: {
        client_id: clientId,
        analyzed_at: new Date().toISOString(),
        subsidies_analyzed: subsidies.results?.length || 0,
        is_fallback: true,
        error_type: error?.message?.includes('429') ? 'rate_limit' : 'unknown'
      }
    })
  }
})

export default routes
