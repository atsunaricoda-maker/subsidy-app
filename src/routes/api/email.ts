// メール送信API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'
import { sendEmail } from '../../utils/email'

const routes = new Hono<AppEnv>()

// テストメール送信
routes.post('/email/test', async (c) => {
  const user = await getCurrentUser(c)
  if (!user) {
    return c.json({ error: '認証が必要です' }, 401)
  }
  
  const { api_key, from_email, to_email } = await c.req.json()
  
  if (!api_key) {
    return c.json({ error: 'APIキーが必要です' }, 400)
  }
  
  if (!to_email) {
    return c.json({ error: '送信先メールアドレスが必要です' }, 400)
  }
  
  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #2563eb; font-size: 24px; margin: 0; }
        .success { background: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; text-align: center; }
        .success i { font-size: 48px; color: #10b981; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>✅ メール設定テスト</h1>
          </div>
          <div class="success">
            <p style="font-size: 18px; font-weight: bold; margin: 0;">メール送信が正常に動作しています！</p>
          </div>
          <p style="margin-top: 20px; text-align: center;">
            このメールが届いていれば、メール通知機能は正しく設定されています。
          </p>
        </div>
        <div class="footer">
          申請らく - 補助金申請サポートシステム<br>
          このメールはテスト送信です。
        </div>
      </div>
    </body>
    </html>
  `
  
  const result = await sendEmail(api_key, {
    to: to_email,
    subject: '【申請らく】メール設定テスト',
    html: testHtml,
    from: from_email || undefined
  }, from_email || undefined)
  
  return c.json(result)
})

// 手動メール送信（ポータルURL案内など）
routes.post('/email/send-portal-access', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  const { case_id, message } = await c.req.json()
  
  if (!case_id) {
    return c.json({ error: '案件IDが必要です' }, 400)
  }
  
  try {
    // メール設定を取得
    const settings = await DB.prepare(`
      SELECT setting_key, setting_value FROM site_settings 
      WHERE setting_key IN ('resend_api_key', 'email_from', 'email_notifications_enabled')
    `).all()
    
    const settingsMap: Record<string, string> = {}
    for (const row of settings.results as any[]) {
      settingsMap[row.setting_key] = row.setting_value
    }
    
    if (!settingsMap['email_notifications_enabled'] || settingsMap['email_notifications_enabled'] !== 'true') {
      return c.json({ error: 'メール通知が無効になっています' }, 400)
    }
    
    if (!settingsMap['resend_api_key']) {
      return c.json({ error: 'メールAPIキーが設定されていません' }, 400)
    }
    
    // 案件情報を取得
    const caseInfo = await DB.prepare(`
      SELECT c.name as case_name, c.access_token,
             cl.name as client_name, cl.email as client_email,
             o.slug
      FROM cases c
      JOIN clients cl ON c.client_id = cl.id
      JOIN organizations o ON c.organization_id = o.id
      WHERE c.id = ? AND c.organization_id = ?
    `).bind(case_id, orgId).first() as any
    
    if (!caseInfo) {
      return c.json({ error: '案件が見つかりません' }, 404)
    }
    
    if (!caseInfo.client_email) {
      return c.json({ error: '顧客のメールアドレスが設定されていません' }, 400)
    }
    
    const portalUrl = `https://${caseInfo.slug}.shinsei-raku.com/portal/${caseInfo.access_token}`
    
    // ポータルアクセス案内メールを送信
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #2563eb; font-size: 24px; margin: 0; }
          .info-box { background: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
          .button { display: inline-block; background: #2563eb; color: #fff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h1>🔑 顧客ポータルのご案内</h1>
            </div>
            <p>${caseInfo.client_name} 様</p>
            <p>補助金申請の進捗確認・書類提出ができる顧客ポータルをご案内いたします。</p>
            
            <div class="info-box">
              <p style="margin: 0;"><strong>案件名:</strong> ${caseInfo.case_name}</p>
            </div>
            
            <p>以下のボタンからポータルにアクセスできます。<br>
            このリンクはお客様専用です。他の方と共有しないようご注意ください。</p>
            
            ${message ? `<p><strong>担当者からのメッセージ:</strong><br>${message}</p>` : ''}
            
            <p style="text-align: center; margin-top: 30px;">
              <a href="${portalUrl}" class="button">顧客ポータルにアクセス</a>
            </p>
            
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              ※ リンクが機能しない場合は、以下のURLをブラウザに直接貼り付けてください:<br>
              ${portalUrl}
            </p>
          </div>
          <div class="footer">
            申請らく - 補助金申請サポートシステム<br>
            このメールは自動送信されています。
          </div>
        </div>
      </body>
      </html>
    `
    
    const result = await sendEmail(settingsMap['resend_api_key'], {
      to: caseInfo.client_email,
      subject: `【申請らく】顧客ポータルのご案内: ${caseInfo.case_name}`,
      html
    }, settingsMap['email_from'] || undefined)
    
    return c.json(result)
  } catch (error: any) {
    console.error('Send portal access email error:', error)
    return c.json({ error: error.message }, 500)
  }
})

export default routes
