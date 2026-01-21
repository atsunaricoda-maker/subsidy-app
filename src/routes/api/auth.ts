// 認証API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'
import { hashPassword, verifyPassword, isPasswordHashed } from '../../utils/password'
import { sendEmail, getEmailSettings } from '../../utils/email'

const routes = new Hono<AppEnv>()

// 6桁の認証コード生成
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// メール送信テストAPI（デバッグ用）
routes.post('/test-email', async (c) => {
  const { DB } = c.env
  const { email, test_secret } = await c.req.json()
  
  // シークレットキーで保護
  if (test_secret !== 'DEBUG_EMAIL_TEST_2024') {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  if (!email) {
    return c.json({ error: 'Email required' }, 400)
  }
  
  try {
    const emailSettings = await getEmailSettings(DB)
    console.log('[TEST-EMAIL] Settings:', { 
      hasApiKey: !!emailSettings.apiKey, 
      fromEmail: emailSettings.fromEmail 
    })
    
    if (!emailSettings.apiKey) {
      return c.json({ 
        success: false, 
        error: 'No API key configured',
        settings: { hasApiKey: false, fromEmail: emailSettings.fromEmail }
      })
    }
    
    const result = await sendEmail(emailSettings.apiKey, {
      to: email,
      subject: '【テスト】申請らくらく君 メール送信テスト',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">メール送信テスト</h2>
          <p>このメールは申請らくらく君のメール送信テストです。</p>
          <p>送信時刻: ${new Date().toISOString()}</p>
        </div>
      `,
      from: 'onboarding@resend.dev'
    })
    
    console.log('[TEST-EMAIL] Result:', result)
    
    return c.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      settings: { hasApiKey: true, fromEmail: emailSettings.fromEmail }
    })
  } catch (error: any) {
    console.error('[TEST-EMAIL] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

// slug重複チェックAPI
routes.get('/check-slug', async (c) => {
  const { DB } = c.env
  const slug = c.req.query('slug')
  
  if (!slug) {
    return c.json({ available: false, error: 'slugが指定されていません' }, 400)
  }
  
  // 予約語チェック
  const reservedSlugs = ['admin', 'master', 'api', 'www', 'app', 'login', 'signup', 'default']
  if (reservedSlugs.includes(slug.toLowerCase())) {
    return c.json({ available: false, reason: 'reserved' })
  }
  
  const existing = await DB.prepare(`SELECT id FROM organizations WHERE slug = ?`).bind(slug).first()
  
  return c.json({ available: !existing })
})

// reCAPTCHA検証ヘルパー関数
async function verifyRecaptcha(token: string, secretKey: string): Promise<{success: boolean, score?: number, error?: string}> {
  if (!token) {
    return { success: false, error: 'reCAPTCHAトークンがありません' }
  }
  
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secretKey}&response=${token}`
    })
    
    const result = await response.json() as any
    console.log('reCAPTCHA verification result:', result)
    
    if (!result.success) {
      return { success: false, error: 'reCAPTCHA検証に失敗しました' }
    }
    
    // スコアが0.5未満の場合はボットと判定
    if (result.score < 0.5) {
      console.warn('Low reCAPTCHA score:', result.score)
      return { success: false, score: result.score, error: 'セキュリティ検証に失敗しました。しばらく時間をおいてから再度お試しください。' }
    }
    
    return { success: true, score: result.score }
  } catch (error) {
    console.error('reCAPTCHA verification error:', error)
    return { success: false, error: 'セキュリティ検証中にエラーが発生しました' }
  }
}

// サインアップAPI（シンプル版：14日間トライアル + 1件枠付与）
routes.post('/signup', async (c) => {
  const { DB, RECAPTCHA_SECRET_KEY } = c.env
  const data = await c.req.json()
  
  // reCAPTCHA検証（シークレットキーが設定されている場合のみ）
  const recaptchaSecretKey = RECAPTCHA_SECRET_KEY || '6LcKKr8qAAAAAH-_QIIABuXKmCeCVMCXPvBFAXwt'
  if (data.recaptcha_token) {
    const recaptchaResult = await verifyRecaptcha(data.recaptcha_token, recaptchaSecretKey)
    if (!recaptchaResult.success) {
      console.warn('reCAPTCHA failed for signup:', recaptchaResult)
      return c.json({ error: recaptchaResult.error || 'セキュリティ検証に失敗しました' }, 400)
    }
    console.log('reCAPTCHA passed with score:', recaptchaResult.score)
  } else {
    // トークンがない場合は拒否（セキュリティ強化）
    console.warn('No reCAPTCHA token provided')
    return c.json({ error: 'セキュリティ検証が必要です。ページを再読み込みしてお試しください。' }, 400)
  }
  
  // バリデーション
  if (!data.organization_name || !data.email || !data.username || !data.password || !data.admin_name || !data.slug) {
    return c.json({ error: '必須項目を入力してください' }, 400)
  }
  
  if (data.password.length < 6) {
    return c.json({ error: 'パスワードは6文字以上で入力してください' }, 400)
  }
  
  // slugのバリデーション
  const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (!slug || slug.length < 3) {
    return c.json({ error: 'サブドメインは3文字以上で入力してください' }, 400)
  }
  
  // 予約語チェック
  const reservedSlugs = ['admin', 'master', 'api', 'www', 'app', 'login', 'signup', 'default']
  if (reservedSlugs.includes(slug)) {
    return c.json({ error: 'このサブドメインは予約されています' }, 400)
  }
  
  // slug重複チェック
  const existingSlug = await DB.prepare(`SELECT id FROM organizations WHERE slug = ?`).bind(slug).first()
  if (existingSlug) {
    return c.json({ error: 'このサブドメインは既に使用されています' }, 400)
  }
  
  const existingEmail = await DB.prepare(`SELECT id FROM organizations WHERE email = ?`).bind(data.email).first()
  if (existingEmail) {
    return c.json({ error: 'このメールアドレスは既に登録されています' }, 400)
  }
  
  // ユーザー名の重複チェック（グローバルでユニーク制約があるため）
  const existingUsername = await DB.prepare(`SELECT id FROM admin_users WHERE username = ?`).bind(data.username).first()
  if (existingUsername) {
    return c.json({ error: 'このユーザー名は既に使用されています。別のユーザー名をお試しください。' }, 400)
  }
  
  // メール認証済みチェック（セキュリティ強化）
  try {
    const verifiedEmail = await DB.prepare(`
      SELECT * FROM pending_verifications 
      WHERE email = ? AND verified_at IS NOT NULL AND verified_at > datetime('now', '-30 minutes')
    `).bind(data.email).first()
    
    if (!verifiedEmail) {
      return c.json({ error: 'メールアドレスの認証が完了していません。認証コードを取得して認証を完了してください。' }, 400)
    }
  } catch (e) {
    // pending_verificationsテーブルが存在しない場合はスキップ（初期セットアップ時）
    console.log('Verification table check skipped:', e)
  }
  
  try {
    // トライアル期間（14日間）
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    
    // 業務範囲のバリデーション
    const businessScope = data.business_scope || 'labor'
    if (!['labor', 'administrative', 'both'].includes(businessScope)) {
      return c.json({ error: '業務範囲の選択が不正です' }, 400)
    }
    
    // 1. 組織を作成（トライアルモード）
    const orgResult = await DB.prepare(`
      INSERT INTO organizations (name, slug, email, phone, status, trial_ends_at, business_scope)
      VALUES (?, ?, ?, ?, 'trial', ?, ?)
    `).bind(
      data.organization_name,
      slug,
      data.email,
      data.phone || null,
      trialEndsAt,
      businessScope
    ).run()
    
    const orgId = orgResult.meta?.last_row_id
    
    // 2. 管理者アカウントを作成（パスワードをハッシュ化）
    const hashedPassword = await hashPassword(data.password)
    await DB.prepare(`
      INSERT INTO admin_users (username, password_hash, name, role, organization_id)
      VALUES (?, ?, ?, 'admin', ?)
    `).bind(data.username, hashedPassword, data.admin_name, orgId).run()
    
    // 3. トライアル用サブスクリプションを作成
    const periodEnd = new Date()
    periodEnd.setDate(periodEnd.getDate() + 14) // 14日間
    
    // トライアルプラン（plan_code='trial'）を取得
    const trialPlan = await DB.prepare(`SELECT id FROM subscription_plans WHERE plan_code = 'trial'`).first() as any
    const TRIAL_PLAN_ID = trialPlan?.id || 7 // フォールバック: ID 7
    
    const subResult = await DB.prepare(`
      INSERT INTO user_subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
      VALUES (?, ?, 'trial', date('now'), ?)
    `).bind(orgId, TRIAL_PLAN_ID, periodEnd.toISOString().split('T')[0]).run()
    
    const subscriptionId = subResult.meta?.last_row_id
    
    // 4. トライアル枠を1件付与
    await DB.prepare(`
      INSERT INTO slot_balances (subscription_id, organization_id, monthly_slots_remaining, purchased_slots_remaining, last_monthly_reset)
      VALUES (?, ?, 1, 0, date('now'))
    `).bind(subscriptionId, orgId).run()
    
    // トークン生成
    const token = btoa(`${orgId}:${data.username}:${Date.now()}`)
    
    return c.json({
      success: true,
      organization_id: orgId,
      organization_name: data.organization_name,
      organization_slug: slug,
      username: data.username,
      admin_name: data.admin_name,
      token,
      trial_ends_at: trialEndsAt,
      trial_slots: 1,
      message: '登録が完了しました！14日間の無料トライアル（1件分）をご利用いただけます。'
    })
    
  } catch (error: any) {
    console.error('Signup error:', error)
    return c.json({ error: '登録に失敗しました: ' + error.message }, 500)
  }
})

// メール認証コード送信API（Step 1）
routes.post('/signup/send-verification', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  console.log('[SEND-VERIFICATION] Request received for email:', data.email)
  
  // reCAPTCHA検証
  const recaptchaSecretKey = c.env.RECAPTCHA_SECRET_KEY || '6LcKKr8qAAAAAH-_QIIABuXKmCeCVMCXPvBFAXwt'
  if (data.recaptcha_token) {
    const recaptchaResult = await verifyRecaptcha(data.recaptcha_token, recaptchaSecretKey)
    if (!recaptchaResult.success) {
      console.warn('[SEND-VERIFICATION] reCAPTCHA failed:', recaptchaResult)
      return c.json({ error: recaptchaResult.error || 'セキュリティ検証に失敗しました' }, 400)
    }
    console.log('[SEND-VERIFICATION] reCAPTCHA passed, score:', recaptchaResult.score)
  } else {
    return c.json({ error: 'セキュリティ検証が必要です' }, 400)
  }
  
  // バリデーション
  if (!data.email) {
    return c.json({ error: 'メールアドレスを入力してください' }, 400)
  }
  
  // メールアドレス形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(data.email)) {
    return c.json({ error: '有効なメールアドレスを入力してください' }, 400)
  }
  
  // メールアドレス重複チェック
  const existingEmail = await DB.prepare(`SELECT id FROM organizations WHERE email = ?`).bind(data.email).first()
  if (existingEmail) {
    return c.json({ error: 'このメールアドレスは既に登録されています' }, 400)
  }
  
  // 認証コード生成
  const verificationCode = generateVerificationCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10分後に期限切れ
  
  try {
    // pending_verificationsテーブルを作成（存在しない場合）
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS pending_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        verification_code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        verified_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    
    // 既存の認証コードを削除して新しいコードを挿入
    await DB.prepare(`DELETE FROM pending_verifications WHERE email = ?`).bind(data.email).run()
    await DB.prepare(`
      INSERT INTO pending_verifications (email, verification_code, expires_at)
      VALUES (?, ?, ?)
    `).bind(data.email, verificationCode, expiresAt).run()
    
    // メール送信
    const emailSettings = await getEmailSettings(DB)
    console.log('[SEND-VERIFICATION] Email settings:', { 
      hasApiKey: !!emailSettings.apiKey, 
      fromEmail: emailSettings.fromEmail,
      enabled: emailSettings.enabled 
    })
    
    if (emailSettings.apiKey) {
      console.log('[SEND-VERIFICATION] Sending email to:', data.email)
      const emailResult = await sendEmail(emailSettings.apiKey, {
        to: data.email,
        subject: '【申請らくらく君】メールアドレス認証コード',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">メールアドレス認証</h2>
            <p>申請らくらく君への登録ありがとうございます。</p>
            <p>以下の認証コードを入力して、登録を完了してください。</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">${verificationCode}</span>
            </div>
            <p style="color: #6b7280; font-size: 14px;">※このコードは10分間有効です。</p>
            <p style="color: #6b7280; font-size: 14px;">※心当たりがない場合は、このメールを無視してください。</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px;">申請らくらく君 - 補助金・助成金申請管理システム</p>
          </div>
        `,
        // Resendではドメイン認証済みのメールアドレスのみ使用可能
        // 認証済みドメインがない場合はResendのデフォルトを使用
        from: 'onboarding@resend.dev'
      })
      console.log('[SEND-VERIFICATION] Email send result:', emailResult)
      
      // メール送信失敗時のエラーハンドリング
      if (!emailResult.success) {
        console.error('[SEND-VERIFICATION] Email failed:', emailResult.error)
        // Resendのドメイン未認証エラーの場合、特別なメッセージを返す
        if (emailResult.error?.includes('verify a domain')) {
          return c.json({ 
            error: 'メール送信の設定が完了していません。管理者にお問い合わせください。',
            debug_hint: 'Resend domain verification required'
          }, 500)
        }
        // その他のメール送信エラー
        return c.json({ 
          error: '認証コードの送信に失敗しました。しばらく時間をおいてから再度お試しください。',
          debug_hint: emailResult.error
        }, 500)
      }
    } else {
      console.log('[SEND-VERIFICATION] Email skipped: No API key. Code:', verificationCode)
      // API Keyが設定されていない場合はエラーを返す
      return c.json({ 
        error: 'メール送信の設定が完了していません。管理者にお問い合わせください。',
        debug_hint: 'No Resend API key configured'
      }, 500)
    }
    
    // デバッグ用：認証コードをログに出力
    console.log(`[EMAIL VERIFICATION] Code sent to ${data.email}: ${verificationCode}`)
    
    // メール送信結果をログに含める（デバッグ時のみ参考）
    const emailSent = emailSettings.apiKey ? true : false
    
    return c.json({ 
      success: true, 
      message: emailSent 
        ? '認証コードを送信しました。メールをご確認ください。' 
        : '認証コードを生成しました（メール送信はスキップされました）'
    })
    
  } catch (error: any) {
    console.error('Send verification error:', error)
    return c.json({ error: '認証コードの送信に失敗しました' }, 500)
  }
})

// メール認証コード確認API（Step 2）
routes.post('/signup/verify-email', async (c) => {
  const { DB } = c.env
  const { email, code } = await c.req.json()
  
  if (!email || !code) {
    return c.json({ error: 'メールアドレスと認証コードを入力してください' }, 400)
  }
  
  try {
    // 認証コード確認
    const pending = await DB.prepare(`
      SELECT * FROM pending_verifications 
      WHERE email = ? AND verification_code = ? AND expires_at > datetime('now') AND verified_at IS NULL
    `).bind(email, code).first()
    
    if (!pending) {
      return c.json({ error: '認証コードが無効または期限切れです' }, 400)
    }
    
    // 認証済みマークを付ける
    await DB.prepare(`
      UPDATE pending_verifications SET verified_at = CURRENT_TIMESTAMP WHERE email = ?
    `).bind(email).run()
    
    return c.json({ 
      success: true, 
      message: 'メールアドレスが認証されました',
      email_verified: true
    })
    
  } catch (error: any) {
    console.error('Verify email error:', error)
    return c.json({ error: '認証に失敗しました' }, 500)
  }
})

// ログインAPI
routes.post('/auth/login', async (c) => {
  const { DB } = c.env
  const { username, password } = await c.req.json()
  
  // サブドメインからテナント組織IDを取得
  const tenantOrgId = c.get('tenantOrgId')
  
  // ユーザー取得クエリ（パスワードは後で検証するため、ここでは条件に含めない）
  let query = `
    SELECT au.*, o.name as organization_name, o.status as org_status, o.slug as organization_slug
    FROM admin_users au
    LEFT JOIN organizations o ON au.organization_id = o.id
    WHERE au.username = ?
  `
  
  // サブドメインがある場合、その組織のユーザーのみ許可
  if (tenantOrgId) {
    query += ` AND au.organization_id = ?`
  }
  
  const bindValues = tenantOrgId 
    ? [username, tenantOrgId]
    : [username]
  
  const user = await DB.prepare(query).bind(...bindValues).first() as any
  
  if (!user) {
    // サブドメインがある場合はより具体的なエラーメッセージ
    if (tenantOrgId) {
      return c.json({ error: 'このサブドメインで有効なアカウントではありません' }, 401)
    }
    return c.json({ error: 'ユーザー名またはパスワードが正しくありません' }, 401)
  }
  
  // パスワードを検証（ハッシュ化されたパスワードと平文パスワードの両方に対応）
  const isPasswordValid = await verifyPassword(password, user.password_hash)
  if (!isPasswordValid) {
    return c.json({ error: 'ユーザー名またはパスワードが正しくありません' }, 401)
  }
  
  // 旧形式（平文）のパスワードの場合、ハッシュ化して更新
  if (!isPasswordHashed(user.password_hash)) {
    try {
      const hashedPassword = await hashPassword(password)
      await DB.prepare(`UPDATE admin_users SET password_hash = ? WHERE id = ?`).bind(hashedPassword, user.id).run()
      console.log(`Password migrated to hash for user: ${username}`)
    } catch (e) {
      console.error('Failed to migrate password:', e)
    }
  }
  
  // 組織が停止中の場合はログインを拒否
  if (user.org_status === 'suspended') {
    return c.json({ error: 'このアカウントは停止されています。管理者にお問い合わせください。' }, 403)
  }
  
  if (user.org_status === 'cancelled') {
    return c.json({ error: 'このアカウントは解約されています。' }, 403)
  }
  
  // 簡易的なトークン生成（本番環境ではJWTなどを使用）
  const token = btoa(`${user.id}:${user.organization_id}:${Date.now()}`)
  
  return c.json({
    token,
    name: user.name,
    username: user.username,
    role: user.role || 'staff',
    organization_id: user.organization_id,
    organization_name: user.organization_name,
    organization_slug: user.organization_slug
  })
})

// ログアウトAPI
routes.post('/auth/logout', (c) => {
  return c.json({ success: true })
})

export default routes
