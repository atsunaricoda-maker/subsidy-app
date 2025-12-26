// 認証API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'
import { hashPassword, verifyPassword, isPasswordHashed } from '../../utils/password'

const routes = new Hono<AppEnv>()

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

// サインアップAPI（シンプル版：14日間トライアル + 1件枠付与）
routes.post('/signup', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
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
