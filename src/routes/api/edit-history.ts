// 編集履歴API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 文書の編集履歴取得
routes.get('/generated-documents/:id/edit-history', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT * FROM document_section_edits 
    WHERE document_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(id).all()
  
  return c.json(result.results)
})

// AI分析：セクション品質チェック
routes.post('/generated-documents/:id/analyze-quality', async (c) => {
  const { DB } = c.env
  const env = c.env
  const id = c.req.param('id')
  
  // 文書取得
  const doc = await DB.prepare(`
    SELECT gd.*, dt.sections as template_sections
    FROM generated_documents gd
    JOIN document_templates dt ON gd.template_id = dt.id
    WHERE gd.id = ?
  `).bind(id).first()
  
  if (!doc) {
    return c.json({ error: '文書が見つかりません' }, 404)
  }
  
  const sections = JSON.parse(doc.template_sections || '[]')
  const content = JSON.parse(doc.sections_content || '{}')
  
  const prompt = `以下の補助金申請書の品質を分析してください。
各セクションについて、10点満点でスコアと改善点を日本語で回答してください。

${sections.map((s: any) => `
【${s.title}】(上限${s.max_chars}文字)
${content[s.id] || '未入力'}
`).join('\n')}

JSON形式で回答してください：
{
  "overall_score": 全体スコア(10点満点),
  "sections": {
    "セクションID": {
      "score": スコア(10点満点),
      "issues": ["問題点1", "問題点2"],
      "improvements": ["改善提案1", "改善提案2"]
    }
  },
  "summary": "全体の総評（100文字以内）"
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
      return c.json(result)
    }
    return c.json({ error: 'AI分析の解析に失敗しました' }, 500)
  } catch (error) {
    return c.json({ error: 'AI分析に失敗しました' }, 500)
  }
})

export default routes
