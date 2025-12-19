// フェーズ4: エクスポート機能（PDF/Word）
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 文書エクスポートAPI（HTML形式 - PDF/Word変換用）
routes.get('/generated-documents/:id/export', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const format = c.req.query('format') || 'html'
  
  // 文書取得（テンプレートの補助金タイプから補助金名を取得）
  const doc = await DB.prepare(`
    SELECT gd.*, dt.template_name, dt.sections as template_sections,
           c.name as client_name, c.company_name,
           COALESCE(st_template.name, st_client.name) as subsidy_name
    FROM generated_documents gd
    JOIN document_templates dt ON gd.template_id = dt.id
    JOIN clients c ON gd.client_id = c.id
    LEFT JOIN subsidy_types st_template ON dt.subsidy_type_id = st_template.id
    LEFT JOIN subsidy_types st_client ON c.subsidy_type_id = st_client.id
    WHERE gd.id = ?
  `).bind(id).first()
  
  if (!doc) {
    return c.json({ error: '文書が見つかりません' }, 404)
  }
  
  const sections = JSON.parse(doc.template_sections || '[]')
  const content = JSON.parse(doc.sections_content || '{}')
  
  // コンテンツを整形する関数（より簡潔で公式文書らしく）
  const formatContent = (text: string): string => {
    if (!text) return ''
    // 警告メッセージを削除
    let formatted = text.replace(/【文字数超過】[^\n]*\n-+\n\n/g, '')
    // 過剰な空行を削除
    formatted = formatted.replace(/\n{3,}/g, '\n\n')
    formatted = formatted.trim()
    // 各行の先頭・末尾の無駄な空白を削除
    formatted = formatted.split('\n').map(line => line.trim()).join('\n')
    // 連続する空行は1つだけ残す
    formatted = formatted.replace(/\n\n+/g, '\n\n')
    
    const paragraphs = formatted.split(/\n\n+/)
    return paragraphs.map(p => {
      // 箇条書きの処理
      if (p.match(/^[・●○▪▫‣⁃►▶■□◆◇★☆（①②③④⑤⑥⑦⑧⑨⑩]/m)) {
        const lines = p.split('\n').filter(l => l.trim())
        return '<ul class="doc-list">' + lines.map(line => {
          const trimmed = line.replace(/^[・●○▪▫‣⁃►▶■□◆◇★☆]\s*/, '').replace(/^[（][0-9①②③④⑤⑥⑦⑧⑨⑩]+[）]\s*/, '').trim()
          if (trimmed) return '<li>' + trimmed + '</li>'
          return ''
        }).filter(l => l).join('') + '</ul>'
      }
      // 通常段落
      const cleanText = p.split('\n').filter(l => l.trim()).join('')
      if (cleanText) return '<p>' + cleanText + '</p>'
      return ''
    }).filter(p => p).join('')
  }
  
  const today = new Date()
  const dateStr = '令和' + (today.getFullYear() - 2018) + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日'
  
  // HTML形式で生成（正式な事業計画書スタイル - 官公庁提出向け）
  const htmlContent = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.document_title}</title>
  <style>
    @page { size: A4; margin: 20mm 18mm 15mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Yu Mincho', 'Hiragino Mincho ProN', 'MS PMincho', 'Times New Roman', serif;
      font-size: 10.5pt;
      line-height: 1.65;
      color: #000;
      background: #fff;
      max-width: 210mm;
      margin: 0 auto;
      padding: 12mm 15mm;
    }
    .doc-header {
      text-align: center;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 2px solid #000;
    }
    .doc-header h1 {
      font-size: 18pt;
      font-weight: bold;
      color: #000;
      margin-bottom: 12px;
      letter-spacing: 0.15em;
    }
    .meta-table {
      width: 100%;
      max-width: 420px;
      margin: 0 auto;
      border-collapse: collapse;
      font-size: 10pt;
    }
    .meta-table td {
      padding: 2px 6px;
      vertical-align: top;
    }
    .meta-table td:first-child {
      width: 95px;
      text-align: right;
      padding-right: 8px;
      white-space: nowrap;
    }
    .meta-table td:last-child {
      text-align: left;
    }
    .section {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .section-title {
      background: #1a365d;
      color: #fff;
      padding: 5px 10px;
      margin-bottom: 6px;
      font-size: 10.5pt;
      font-weight: bold;
    }
    .section-body {
      padding: 0 3px;
      text-align: justify;
      text-justify: inter-ideograph;
    }
    .section-body p {
      margin-bottom: 0.5em;
      text-indent: 1em;
    }
    .section-body p:last-child { margin-bottom: 0; }
    .doc-list {
      margin: 0.4em 0 0.4em 1.5em;
      padding: 0;
      list-style: none;
    }
    .doc-list li {
      margin-bottom: 0.25em;
      padding-left: 1.2em;
      text-indent: -1.2em;
    }
    .doc-list li::before {
      content: "・";
      margin-right: 0.15em;
    }
    .doc-footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #666;
      font-size: 9pt;
      color: #333;
      text-align: right;
    }
    @media print {
      body { padding: 0; background: #fff; }
      .section-title {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    @media screen {
      body {
        box-shadow: 0 0 8px rgba(0,0,0,0.1);
        margin: 8px auto;
      }
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <h1>事 業 計 画 書</h1>
    <table class="meta-table">
      <tr><td>申請者：</td><td>${doc.company_name || doc.client_name}</td></tr>
      <tr><td>申請補助金：</td><td>${doc.subsidy_name || '未設定'}</td></tr>
      <tr><td>作成日：</td><td>${dateStr}</td></tr>
    </table>
  </div>
  ${sections.map((section: any) => {
    const sectionContent = content[section.id] || ''
    const formattedContent = formatContent(sectionContent)
    return `
  <div class="section">
    <div class="section-title">${section.title}</div>
    <div class="section-body">${formattedContent}</div>
  </div>`
  }).join('')}
  <div class="doc-footer">${dateStr} 作成</div>
</body>
</html>`

  if (format === 'json') {
    return c.json({
      title: doc.document_title,
      client_name: doc.client_name,
      company_name: doc.company_name,
      subsidy_name: doc.subsidy_name,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      status: doc.status,
      sections: sections.map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        max_chars: s.max_chars,
        content: content[s.id] || '',
        char_count: (content[s.id] || '').length
      }))
    })
  }
  
  // HTML形式で返す（ブラウザで印刷 → PDF保存可能）
  return c.html(htmlContent)
})

// 複数文書の一括エクスポート
routes.post('/clients/:clientId/export-all-documents', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  // 顧客の全文書取得
  const docs = await DB.prepare(`
    SELECT gd.*, dt.template_name, dt.sections as template_sections
    FROM generated_documents gd
    JOIN document_templates dt ON gd.template_id = dt.id
    WHERE gd.client_id = ?
    ORDER BY gd.created_at DESC
  `).bind(clientId).all()
  
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(clientId).first()
  
  if (!client) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  return c.json({
    client: {
      id: client.id,
      name: client.name,
      company_name: client.company_name,
      subsidy_name: client.subsidy_name
    },
    documents: (docs.results || []).map((doc: any) => {
      const sections = JSON.parse(doc.template_sections || '[]')
      const content = JSON.parse(doc.sections_content || '{}')
      return {
        id: doc.id,
        title: doc.document_title,
        template_name: doc.template_name,
        status: doc.status,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        sections: sections.map((s: any) => ({
          id: s.id,
          title: s.title,
          content: content[s.id] || '',
          char_count: (content[s.id] || '').length,
          max_chars: s.max_chars
        })),
        total_chars: Object.values(content).reduce((sum: number, c: any) => sum + (c?.length || 0), 0)
      }
    }),
    exported_at: new Date().toISOString()
  })
})

export default routes
