// 認証API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

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

// サインアップAPI
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
  
  const existingUsername = await DB.prepare(`SELECT id FROM admin_users WHERE username = ?`).bind(data.username).first()
  if (existingUsername) {
    return c.json({ error: 'このユーザー名は既に使用されています' }, 400)
  }
  
  const existingEmail = await DB.prepare(`SELECT id FROM organizations WHERE email = ?`).bind(data.email).first()
  if (existingEmail) {
    return c.json({ error: 'このメールアドレスは既に登録されています' }, 400)
  }
  
  try {
    // トライアル期間（14日間）
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    
    // 業務範囲のバリデーション
    const businessScope = data.business_scope || 'labor'
    if (!['labor', 'administrative', 'both'].includes(businessScope)) {
      return c.json({ error: '業務範囲の選択が不正です' }, 400)
    }
    
    // 1. 組織を作成
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
    
    // 2. 管理者アカウントを作成
    await DB.prepare(`
      INSERT INTO admin_users (username, password_hash, name, role, organization_id)
      VALUES (?, ?, ?, 'admin', ?)
    `).bind(data.username, data.password, data.admin_name, orgId).run()
    
    // 3. サブスクリプションを作成（トライアル）
    const plan = await DB.prepare(`SELECT * FROM subscription_plans WHERE id = ?`).bind(data.plan_id).first()
    if (plan) {
      const periodEnd = new Date()
      periodEnd.setDate(periodEnd.getDate() + 14) // トライアル期間
      
      const subResult = await DB.prepare(`
        INSERT INTO user_subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
        VALUES (?, ?, 'active', date('now'), ?)
      `).bind(orgId, data.plan_id, periodEnd.toISOString().split('T')[0]).run()
      
      const subscriptionId = subResult.meta?.last_row_id
      
      // 4. 初期枠を付与（トライアル中はプランの枠数を付与）
      await DB.prepare(`
        INSERT INTO slot_balances (subscription_id, organization_id, monthly_slots_remaining, purchased_slots_remaining)
        VALUES (?, ?, ?, 0)
      `).bind(subscriptionId, orgId, plan.monthly_slots).run()
    }
    
    // 5. 両方利用の場合はアドオンを追加（+2000円）
    if (businessScope === 'both') {
      await DB.prepare(`
        INSERT INTO organization_addons (organization_id, addon_type, price)
        VALUES (?, 'dual_scope', 2000)
      `).bind(orgId).run()
    }
    
    // トークン生成
    const token = btoa(`${orgId}:${data.username}:${Date.now()}`)
    
    return c.json({
      success: true,
      organization_id: orgId,
      organization_name: data.organization_name,
      username: data.username,
      admin_name: data.admin_name,
      token,
      trial_ends_at: trialEndsAt,
      message: '登録が完了しました！14日間の無料トライアルをお楽しみください。'
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
  
  const user = await DB.prepare(`
    SELECT au.*, o.name as organization_name, o.status as org_status
    FROM admin_users au
    LEFT JOIN organizations o ON au.organization_id = o.id
    WHERE au.username = ? AND au.password_hash = ?
  `).bind(username, password).first()
  
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
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
    organization_name: user.organization_name
  })
})

// ログアウトAPI
routes.post('/auth/logout', (c) => {
  return c.json({ success: true })
})

export default routes
