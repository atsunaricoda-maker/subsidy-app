// メール送信ユーティリティ
// Resend API を使用（Cloudflare Workers対応）

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Resend APIを使ってメールを送信
 */
export async function sendEmail(
  apiKey: string,
  options: EmailOptions,
  fromEmail?: string
): Promise<EmailResult> {
  if (!apiKey) {
    console.log('Email skipped: No API key configured')
    return { success: false, error: 'メール送信APIキーが設定されていません' }
  }

  const from = options.from || fromEmail || 'noreply@shinsei-raku.com'

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      }),
    })

    const data = await response.json() as any

    if (!response.ok) {
      console.error('Email send failed:', data)
      return { 
        success: false, 
        error: data.message || 'メール送信に失敗しました' 
      }
    }

    console.log('Email sent successfully:', data.id)
    return { success: true, messageId: data.id }
  } catch (error: any) {
    console.error('Email send error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * DBからメール設定を取得
 */
export async function getEmailSettings(DB: D1Database): Promise<{
  apiKey: string | null
  fromEmail: string | null
  enabled: boolean
}> {
  try {
    const settings = await DB.prepare(`
      SELECT setting_key, setting_value FROM site_settings 
      WHERE setting_key IN ('resend_api_key', 'email_from', 'email_notifications_enabled')
    `).all()

    const settingsMap: Record<string, string> = {}
    for (const row of settings.results as any[]) {
      settingsMap[row.setting_key] = row.setting_value
    }

    return {
      apiKey: settingsMap['resend_api_key'] || null,
      fromEmail: settingsMap['email_from'] || null,
      enabled: settingsMap['email_notifications_enabled'] === 'true'
    }
  } catch (error) {
    console.error('Failed to get email settings:', error)
    return { apiKey: null, fromEmail: null, enabled: false }
  }
}

// ============================================
// メールテンプレート
// ============================================

const baseTemplate = (content: string, footerText?: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #2563eb; font-size: 24px; margin: 0; }
    .content { margin-bottom: 30px; }
    .button { display: inline-block; background: #2563eb; color: #fff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; }
    .button:hover { background: #1d4ed8; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    .info-box { background: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-in-progress { background: #dbeafe; color: #1e40af; }
    .status-completed { background: #d1fae5; color: #065f46; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      ${footerText || '申請らく - 補助金申請サポートシステム'}<br>
      このメールは自動送信されています。
    </div>
  </div>
</body>
</html>
`

/**
 * ステータス変更通知メール
 */
export function statusChangeEmail(params: {
  clientName: string
  caseName: string
  oldStatus: string
  newStatus: string
  portalUrl: string
  message?: string
}): { subject: string; html: string } {
  const statusLabels: Record<string, string> = {
    'new': '新規',
    'document_collecting': '書類収集中',
    'document_reviewing': '書類確認中',
    'applying': '申請中',
    'under_review': '審査中',
    'approved': '採択',
    'rejected': '不採択',
    'completed': '完了',
    'cancelled': 'キャンセル'
  }

  const statusClasses: Record<string, string> = {
    'new': 'status-pending',
    'document_collecting': 'status-in-progress',
    'document_reviewing': 'status-in-progress',
    'applying': 'status-in-progress',
    'under_review': 'status-in-progress',
    'approved': 'status-completed',
    'rejected': 'status-rejected',
    'completed': 'status-completed',
    'cancelled': 'status-rejected'
  }

  const oldLabel = statusLabels[params.oldStatus] || params.oldStatus
  const newLabel = statusLabels[params.newStatus] || params.newStatus
  const statusClass = statusClasses[params.newStatus] || 'status-pending'

  const content = `
    <div class="header">
      <h1>📋 申請ステータスが更新されました</h1>
    </div>
    <div class="content">
      <p>${params.clientName} 様</p>
      <p>ご申請いただいている案件のステータスが更新されました。</p>
      
      <div class="info-box">
        <p style="margin: 0 0 10px 0;"><strong>案件名:</strong> ${params.caseName}</p>
        <p style="margin: 0;">
          <strong>ステータス:</strong> 
          ${oldLabel} → <span class="${statusClass} status-badge">${newLabel}</span>
        </p>
      </div>
      
      ${params.message ? `<p><strong>担当者からのメッセージ:</strong><br>${params.message}</p>` : ''}
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="${params.portalUrl}" class="button">ポータルで詳細を確認</a>
      </p>
    </div>
  `

  return {
    subject: `【申請らく】ステータス更新: ${params.caseName}`,
    html: baseTemplate(content)
  }
}

/**
 * 書類アップロード完了通知（管理者向け）
 */
export function documentUploadedEmail(params: {
  clientName: string
  caseName: string
  documentName: string
  documentType: string
  uploadedAt: string
  adminUrl: string
}): { subject: string; html: string } {
  const content = `
    <div class="header">
      <h1>📄 新しい書類がアップロードされました</h1>
    </div>
    <div class="content">
      <p>顧客から新しい書類がアップロードされました。</p>
      
      <div class="info-box">
        <p style="margin: 0 0 10px 0;"><strong>顧客名:</strong> ${params.clientName}</p>
        <p style="margin: 0 0 10px 0;"><strong>案件名:</strong> ${params.caseName}</p>
        <p style="margin: 0 0 10px 0;"><strong>書類名:</strong> ${params.documentName}</p>
        <p style="margin: 0 0 10px 0;"><strong>書類種別:</strong> ${params.documentType}</p>
        <p style="margin: 0;"><strong>アップロード日時:</strong> ${params.uploadedAt}</p>
      </div>
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="${params.adminUrl}" class="button">管理画面で確認</a>
      </p>
    </div>
  `

  return {
    subject: `【申請らく】書類アップロード: ${params.clientName} - ${params.documentName}`,
    html: baseTemplate(content)
  }
}

/**
 * 書類確認依頼通知（顧客向け）
 */
export function documentRequestEmail(params: {
  clientName: string
  caseName: string
  requiredDocuments: string[]
  deadline?: string
  portalUrl: string
  message?: string
}): { subject: string; html: string } {
  const documentList = params.requiredDocuments
    .map(doc => `<li>${doc}</li>`)
    .join('')

  const content = `
    <div class="header">
      <h1>📝 書類のご提出をお願いします</h1>
    </div>
    <div class="content">
      <p>${params.clientName} 様</p>
      <p>補助金申請に必要な書類のご提出をお願いいたします。</p>
      
      <div class="info-box">
        <p style="margin: 0 0 10px 0;"><strong>案件名:</strong> ${params.caseName}</p>
        ${params.deadline ? `<p style="margin: 0;"><strong>提出期限:</strong> ${params.deadline}</p>` : ''}
      </div>
      
      <p><strong>必要書類:</strong></p>
      <ul>
        ${documentList}
      </ul>
      
      ${params.message ? `<p><strong>担当者からのメッセージ:</strong><br>${params.message}</p>` : ''}
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="${params.portalUrl}" class="button">ポータルから書類をアップロード</a>
      </p>
    </div>
  `

  return {
    subject: `【申請らく】書類提出のお願い: ${params.caseName}`,
    html: baseTemplate(content)
  }
}

/**
 * ポータルアクセス案内メール
 */
export function portalAccessEmail(params: {
  clientName: string
  caseName: string
  portalUrl: string
  message?: string
}): { subject: string; html: string } {
  const content = `
    <div class="header">
      <h1>🔑 顧客ポータルのご案内</h1>
    </div>
    <div class="content">
      <p>${params.clientName} 様</p>
      <p>補助金申請の進捗確認・書類提出ができる顧客ポータルをご案内いたします。</p>
      
      <div class="info-box">
        <p style="margin: 0;"><strong>案件名:</strong> ${params.caseName}</p>
      </div>
      
      <p>以下のボタンからポータルにアクセスできます。<br>
      このリンクはお客様専用です。他の方と共有しないようご注意ください。</p>
      
      ${params.message ? `<p><strong>担当者からのメッセージ:</strong><br>${params.message}</p>` : ''}
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="${params.portalUrl}" class="button">顧客ポータルにアクセス</a>
      </p>
      
      <p style="font-size: 12px; color: #666; margin-top: 20px;">
        ※ リンクが機能しない場合は、以下のURLをブラウザに直接貼り付けてください:<br>
        ${params.portalUrl}
      </p>
    </div>
  `

  return {
    subject: `【申請らく】顧客ポータルのご案内: ${params.caseName}`,
    html: baseTemplate(content)
  }
}

/**
 * 申請完了通知
 */
export function applicationCompletedEmail(params: {
  clientName: string
  caseName: string
  subsidyName: string
  result: 'approved' | 'rejected'
  amount?: number
  message?: string
  portalUrl: string
}): { subject: string; html: string } {
  const isApproved = params.result === 'approved'
  
  const content = `
    <div class="header">
      <h1>${isApproved ? '🎉 採択のお知らせ' : '📋 審査結果のお知らせ'}</h1>
    </div>
    <div class="content">
      <p>${params.clientName} 様</p>
      <p>ご申請いただいておりました補助金の審査結果をお知らせいたします。</p>
      
      <div class="info-box">
        <p style="margin: 0 0 10px 0;"><strong>案件名:</strong> ${params.caseName}</p>
        <p style="margin: 0 0 10px 0;"><strong>補助金名:</strong> ${params.subsidyName}</p>
        <p style="margin: 0;">
          <strong>結果:</strong> 
          <span class="${isApproved ? 'status-completed' : 'status-rejected'} status-badge">
            ${isApproved ? '採択' : '不採択'}
          </span>
        </p>
        ${isApproved && params.amount ? `<p style="margin: 10px 0 0 0;"><strong>交付予定額:</strong> ${params.amount.toLocaleString()}円</p>` : ''}
      </div>
      
      ${isApproved ? `
        <p>おめでとうございます！引き続き、交付に向けた手続きをサポートいたします。</p>
      ` : `
        <p>残念ながら今回は採択となりませんでした。次回の申請に向けて、引き続きサポートいたします。</p>
      `}
      
      ${params.message ? `<p><strong>担当者からのメッセージ:</strong><br>${params.message}</p>` : ''}
      
      <p style="text-align: center; margin-top: 30px;">
        <a href="${params.portalUrl}" class="button">ポータルで詳細を確認</a>
      </p>
    </div>
  `

  return {
    subject: `【申請らく】${isApproved ? '採択' : '審査結果'}のお知らせ: ${params.caseName}`,
    html: baseTemplate(content)
  }
}
