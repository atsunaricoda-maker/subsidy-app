// フェーズ4: エクスポート機能（PDF/Word/CSV）
// テナント分離: 自組織のデータのみエクスポート可能
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// ============================================
// CSVエクスポート機能
// ============================================

// CSVエスケープ関数
function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
  if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

// CSV行を生成
function toCSVRow(values: any[]): string {
  return values.map(escapeCSV).join(',')
}

// 日付フォーマット
function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return dateStr
  }
}

// ステータスラベル
const statusLabels: Record<string, string> = {
  'inquiry': '見込み',
  'new': '新規',
  'document_collecting': '書類収集中',
  'document_reviewing': '書類確認中',
  'preparing': '準備中',
  'applying': '申請中',
  'under_review': '審査中',
  'approved': '採択',
  'rejected': '不採択',
  'completed': '完了',
  'cancelled': 'キャンセル'
}

// 顧客一覧CSVエクスポート
routes.get('/export/clients/csv', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  try {
    const clients = await DB.prepare(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.phone,
        c.address,
        c.notes,
        c.created_at,
        st.name as subsidy_type_name,
        (SELECT COUNT(*) FROM cases WHERE client_id = c.id) as case_count
      FROM clients c
      LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
      WHERE c.organization_id = ?
      ORDER BY c.created_at DESC
    `).bind(orgId).all()
    
    // CSVヘッダー
    const headers = ['ID', '顧客名/企業名', 'メールアドレス', '電話番号', '住所', '補助金種別', '案件数', '備考', '登録日']
    
    // CSVデータ
    const rows = (clients.results || []).map((client: any) => [
      client.id,
      client.name,
      client.email || '',
      client.phone || '',
      client.address || '',
      client.subsidy_type_name || '',
      client.case_count || 0,
      client.notes || '',
      formatDate(client.created_at)
    ])
    
    // CSV生成（BOM付きUTF-8でExcel対応）
    const BOM = '\uFEFF'
    const csv = BOM + [toCSVRow(headers), ...rows.map(toCSVRow)].join('\r\n')
    
    const filename = `顧客一覧_${new Date().toISOString().split('T')[0]}.csv`
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      }
    })
  } catch (error: any) {
    console.error('Export clients CSV error:', error)
    return c.json({ error: 'エクスポートに失敗しました' }, 500)
  }
})

// 案件一覧CSVエクスポート
routes.get('/export/cases/csv', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  try {
    const cases = await DB.prepare(`
      SELECT 
        cs.id,
        cs.case_number,
        cs.status,
        cs.deposit_amount,
        cs.success_fee_amount,
        cs.deadline,
        cs.notes,
        cs.created_at,
        cs.updated_at,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        st.name as subsidy_type_name
      FROM cases cs
      LEFT JOIN clients c ON cs.client_id = c.id
      LEFT JOIN subsidy_types st ON cs.subsidy_type_id = st.id
      WHERE cs.organization_id = ?
      ORDER BY cs.created_at DESC
    `).bind(orgId).all()
    
    // CSVヘッダー
    const headers = ['案件ID', '案件番号', '顧客名/企業名', '補助金種別', 'ステータス', '着手金', '成功報酬', '締切日', 'メール', '電話番号', '備考', '登録日', '更新日']
    
    // CSVデータ
    const rows = (cases.results || []).map((cs: any) => [
      cs.id,
      cs.case_number || '',
      cs.client_name || '',
      cs.subsidy_type_name || '',
      statusLabels[cs.status] || cs.status || '',
      cs.deposit_amount || '',
      cs.success_fee_amount || '',
      formatDate(cs.deadline),
      cs.client_email || '',
      cs.client_phone || '',
      cs.notes || '',
      formatDate(cs.created_at),
      formatDate(cs.updated_at)
    ])
    
    // CSV生成（BOM付きUTF-8でExcel対応）
    const BOM = '\uFEFF'
    const csv = BOM + [toCSVRow(headers), ...rows.map(toCSVRow)].join('\r\n')
    
    const filename = `案件一覧_${new Date().toISOString().split('T')[0]}.csv`
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      }
    })
  } catch (error: any) {
    console.error('Export cases CSV error:', error)
    return c.json({ error: 'エクスポートに失敗しました' }, 500)
  }
})

// 請求書一覧CSVエクスポート
routes.get('/export/invoices/csv', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  try {
    const invoices = await DB.prepare(`
      SELECT 
        i.id,
        i.invoice_number,
        i.invoice_type,
        i.status,
        i.subtotal,
        i.tax_amount,
        i.total_amount,
        i.issue_date,
        i.due_date,
        i.paid_at,
        i.item_name,
        i.notes,
        c.name as client_name,
        cs.case_number as case_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN cases cs ON i.case_id = cs.id
      WHERE i.organization_id = ?
      ORDER BY i.created_at DESC
    `).bind(orgId).all()
    
    const invoiceTypeLabels: Record<string, string> = {
      'deposit': '着手金',
      'success_fee': '成功報酬',
      'monthly': '月額料金',
      'other': 'その他'
    }
    
    const invoiceStatusLabels: Record<string, string> = {
      'draft': '下書き',
      'issued': '発行済',
      'sent': '送付済',
      'payment_reported': '振込報告済',
      'paid': '入金済',
      'cancelled': 'キャンセル'
    }
    
    // CSVヘッダー
    const headers = ['請求書番号', '顧客名/企業名', '案件名', '種別', 'ステータス', '品目', '小計', '消費税', '合計金額', '発行日', '支払期限', '入金日', '備考']
    
    // CSVデータ
    const rows = (invoices.results || []).map((inv: any) => [
      inv.invoice_number || '',
      inv.client_name || '',
      inv.case_name || '',
      invoiceTypeLabels[inv.invoice_type] || inv.invoice_type || '',
      invoiceStatusLabels[inv.status] || inv.status || '',
      inv.item_name || '',
      inv.subtotal || 0,
      inv.tax_amount || 0,
      inv.total_amount || 0,
      formatDate(inv.issue_date),
      formatDate(inv.due_date),
      formatDate(inv.paid_at),
      inv.notes || ''
    ])
    
    // CSV生成（BOM付きUTF-8でExcel対応）
    const BOM = '\uFEFF'
    const csv = BOM + [toCSVRow(headers), ...rows.map(toCSVRow)].join('\r\n')
    
    const filename = `請求書一覧_${new Date().toISOString().split('T')[0]}.csv`
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      }
    })
  } catch (error: any) {
    console.error('Export invoices CSV error:', error)
    return c.json({ error: 'エクスポートに失敗しました' }, 500)
  }
})

// 文書エクスポートAPI（HTML形式 - PDF/Word変換用）
routes.get('/generated-documents/:id/export', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const format = c.req.query('format') || 'html'
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  // テナント分離: 自組織のクライアントに紐づく文書のみ取得可能
  const doc = await DB.prepare(`
    SELECT gd.*, dt.template_name, dt.sections as template_sections,
           c.name as client_name, c.organization_id,
           COALESCE(st_template.name, st_client.name) as subsidy_name
    FROM generated_documents gd
    JOIN document_templates dt ON gd.template_id = dt.id
    JOIN clients c ON gd.client_id = c.id
    LEFT JOIN subsidy_types st_template ON dt.subsidy_type_id = st_template.id
    LEFT JOIN subsidy_types st_client ON c.subsidy_type_id = st_client.id
    WHERE gd.id = ? AND c.organization_id = ?
  `).bind(id, orgId).first()
  
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
      <tr><td>申請者：</td><td>${doc.client_name}</td></tr>
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
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  // テナント分離: 自組織のクライアントのみアクセス可能
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ? AND c.organization_id = ?
  `).bind(clientId, orgId).first()
  
  if (!client) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  // 顧客の全文書取得
  const docs = await DB.prepare(`
    SELECT gd.*, dt.template_name, dt.sections as template_sections
    FROM generated_documents gd
    JOIN document_templates dt ON gd.template_id = dt.id
    WHERE gd.client_id = ?
    ORDER BY gd.created_at DESC
  `).bind(clientId).all()
  
  return c.json({
    client: {
      id: client.id,
      name: client.name,
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
