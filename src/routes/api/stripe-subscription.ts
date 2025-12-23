// Stripe サブスクリプション・追加枠購入API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// ランダムパスワード生成
function generatePassword(length: number = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Stripe Price ID設定（テスト環境）
const STRIPE_PRICES = {
  // プラン別Price ID
  plans: {
    basic: 'price_1SeEJaHHmXlTI7JB3BgmuFge',      // ¥3,000/月 - 月1枠
    standard: 'price_1SeEJbHHmXlTI7JBZh4Y0JLo',   // ¥5,000/月 - 月3枠
    premium: 'price_1SeEJcHHmXlTI7JBkFdHea9D',    // ¥10,000/月 - 月10枠
    business: 'price_1SeEJcHHmXlTI7JBxRPXqMqa',   // ¥30,000/月 - 月30枠
    enterprise: 'price_1SeEJdHHmXlTI7JBCuGRjpBk'  // ¥100,000/月 - 月100枠
  },
  // 追加枠Price ID
  slots: {
    slot_1: { price_id: 'price_1SeEJdHHmXlTI7JBhAQuNtYY', slots: 1, amount: 1500 },    // ¥1,500/枠
    slot_3: { price_id: 'price_1SeEJdHHmXlTI7JBLidNMEmf', slots: 3, amount: 3000 },    // ¥3,000/3枠 (¥1,000/枠)
    slot_10: { price_id: 'price_1SeEJeHHmXlTI7JBzWIBapUn', slots: 10, amount: 9000 }   // ¥9,000/10枠 (¥900/枠)
  },
  // 管轄オプション
  addons: {
    dual_scope: 'price_1SeEJeHHmXlTI7JBONrn5ImQ'  // ¥2,000/月 - 両方管轄オプション
  }
}

// サブスクリプション用Stripe Checkout Session作成
routes.post('/stripe/create-subscription-checkout', async (c) => {
  const { DB, STRIPE_SECRET_KEY } = c.env as any
  const user = await getCurrentUser(c)
  
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'この操作は管理者のみ実行できます' }, 403)
  }
  
  if (!STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe決済は現在設定されていません' }, 400)
  }
  
  const { plan_code, plan_id } = await c.req.json()
  
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // plan_idが指定された場合はDBからplan_codeを取得
  let resolvedPlanCode = plan_code
  if (plan_id && !plan_code) {
    const plan = await DB.prepare(`SELECT plan_code FROM subscription_plans WHERE id = ?`).bind(plan_id).first() as any
    if (plan) {
      resolvedPlanCode = plan.plan_code
    }
  }
  
  if (!resolvedPlanCode || !STRIPE_PRICES.plans[resolvedPlanCode as keyof typeof STRIPE_PRICES.plans]) {
    return c.json({ error: '無効なプランです。plan_code: ' + resolvedPlanCode }, 400)
  }
  
  const priceId = STRIPE_PRICES.plans[resolvedPlanCode as keyof typeof STRIPE_PRICES.plans]
  
  // 組織情報を取得
  const org = await DB.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(orgId).first() as any
  
  // 現在のサブスクリプションを取得
  const currentSub = await DB.prepare(`
    SELECT us.*, sp.plan_code as current_plan_code
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.organization_id = ? AND us.status = 'active'
    LIMIT 1
  `).bind(orgId).first() as any
  
  try {
    // 既存のStripe Customerがあるか確認、なければ作成
    let stripeCustomerId = org?.stripe_customer_id
    
    if (!stripeCustomerId) {
      // Stripe Customer作成
      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'name': org?.name || '組織名未設定',
          'email': user.email || '',
          'metadata[organization_id]': String(orgId)
        }).toString()
      })
      const customer = await customerResponse.json() as any
      
      if (customer.error) {
        return c.json({ error: customer.error.message }, 400)
      }
      
      stripeCustomerId = customer.id
      
      // 組織にStripe Customer IDを保存
      await DB.prepare(`
        UPDATE organizations SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(stripeCustomerId, orgId).run()
    }
    
    // 既存のサブスクリプションがある場合は変更、ない場合は新規作成
    const baseUrl = new URL(c.req.url).origin
    
    const checkoutParams: Record<string, string> = {
      'customer': stripeCustomerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'mode': 'subscription',
      'success_url': `${baseUrl}/admin/subscription?session_id={CHECKOUT_SESSION_ID}&status=success`,
      'cancel_url': `${baseUrl}/admin/subscription?status=cancelled`,
      'metadata[organization_id]': String(orgId),
      'metadata[plan_code]': resolvedPlanCode,
      'metadata[type]': 'subscription',
      'subscription_data[metadata][organization_id]': String(orgId),
      'subscription_data[metadata][plan_code]': resolvedPlanCode
    }
    
    // 試用期間を設定（新規の場合）
    if (!currentSub || !currentSub.stripe_subscription_id) {
      checkoutParams['subscription_data[trial_period_days]'] = '14'
    }
    
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(checkoutParams).toString()
    })
    
    const session = await response.json() as any
    
    if (session.error) {
      console.error('Stripe error:', session.error)
      return c.json({ error: session.error.message }, 400)
    }
    
    return c.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    })
  } catch (error: any) {
    console.error('Stripe session creation error:', error)
    return c.json({ error: '決済セッションの作成に失敗しました' }, 500)
  }
})

// 追加枠購入用Stripe Checkout Session作成
routes.post('/stripe/create-slot-checkout', async (c) => {
  const { DB, STRIPE_SECRET_KEY } = c.env as any
  const user = await getCurrentUser(c)
  
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'この操作は管理者のみ実行できます' }, 403)
  }
  
  if (!STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe決済は現在設定されていません' }, 400)
  }
  
  const { slot_package } = await c.req.json()
  
  if (!slot_package || !STRIPE_PRICES.slots[slot_package as keyof typeof STRIPE_PRICES.slots]) {
    return c.json({ error: '無効な枠パッケージです' }, 400)
  }
  
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  const slotInfo = STRIPE_PRICES.slots[slot_package as keyof typeof STRIPE_PRICES.slots]
  
  // 組織情報を取得
  const org = await DB.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(orgId).first() as any
  
  try {
    // 既存のStripe Customerがあるか確認
    let stripeCustomerId = org?.stripe_customer_id
    
    if (!stripeCustomerId) {
      // Stripe Customer作成
      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'name': org?.name || '組織名未設定',
          'email': user.email || '',
          'metadata[organization_id]': String(orgId)
        }).toString()
      })
      const customer = await customerResponse.json() as any
      
      if (customer.error) {
        return c.json({ error: customer.error.message }, 400)
      }
      
      stripeCustomerId = customer.id
      
      await DB.prepare(`
        UPDATE organizations SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(stripeCustomerId, orgId).run()
    }
    
    const baseUrl = new URL(c.req.url).origin
    
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'customer': stripeCustomerId,
        'line_items[0][price]': slotInfo.price_id,
        'line_items[0][quantity]': '1',
        'mode': 'payment',
        'success_url': `${baseUrl}/admin/subscription?session_id={CHECKOUT_SESSION_ID}&status=slot_success&slots=${slotInfo.slots}`,
        'cancel_url': `${baseUrl}/admin/subscription?status=cancelled`,
        'metadata[organization_id]': String(orgId),
        'metadata[type]': 'slot_purchase',
        'metadata[slots]': String(slotInfo.slots),
        'metadata[slot_package]': slot_package
      }).toString()
    })
    
    const session = await response.json() as any
    
    if (session.error) {
      console.error('Stripe error:', session.error)
      return c.json({ error: session.error.message }, 400)
    }
    
    return c.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      slots: slotInfo.slots,
      amount: slotInfo.amount
    })
  } catch (error: any) {
    console.error('Stripe session creation error:', error)
    return c.json({ error: '決済セッションの作成に失敗しました' }, 500)
  }
})

// Stripe Webhook（サブスクリプション・追加枠用）
routes.post('/stripe/subscription-webhook', async (c) => {
  const { DB, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = c.env as any
  
  const payload = await c.req.text()
  const sig = c.req.header('stripe-signature')
  
  let event: any
  try {
    event = JSON.parse(payload)
  } catch {
    return c.json({ error: 'Invalid payload' }, 400)
  }
  
  console.log('Stripe webhook event:', event.type)
  
  // checkout.session.completed イベント処理
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const type = session.metadata?.type
    
    // ========================================
    // 新規サインアップ処理
    // ========================================
    if (type === 'new_signup') {
      const slug = session.metadata?.slug
      const email = session.metadata?.email
      const organizationName = session.metadata?.organization_name
      const adminName = session.metadata?.admin_name
      const phone = session.metadata?.phone
      const planId = session.metadata?.plan_id
      const planCode = session.metadata?.plan_code
      const businessScope = session.metadata?.business_scope || 'labor'
      const stripeCustomerId = session.customer
      const stripeSubscriptionId = session.subscription
      
      console.log('Processing new signup:', { slug, email, organizationName, planCode })
      
      // 既に組織が作成されていないか確認
      const existingOrg = await DB.prepare(`SELECT id FROM organizations WHERE slug = ?`).bind(slug).first()
      if (existingOrg) {
        console.log('Organization already exists, skipping creation')
        return c.json({ received: true })
      }
      
      try {
        // トライアル期間（14日間）
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        
        // 1. 組織を作成
        const orgResult = await DB.prepare(`
          INSERT INTO organizations (name, slug, email, phone, status, trial_ends_at, business_scope, stripe_customer_id)
          VALUES (?, ?, ?, ?, 'trial', ?, ?, ?)
        `).bind(
          organizationName,
          slug,
          email,
          phone || null,
          trialEndsAt,
          businessScope,
          stripeCustomerId
        ).run()
        
        const orgId = orgResult.meta?.last_row_id
        console.log('Created organization:', orgId)
        
        // 2. 初期パスワードを生成
        const initialPassword = generatePassword(12)
        
        // ユーザー名をメールアドレスの@前部分から生成
        let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')
        if (username.length < 3) username = 'admin'
        
        // ユーザー名重複チェック（同一組織内）
        const existingUser = await DB.prepare(`
          SELECT id FROM admin_users WHERE username = ? AND organization_id = ?
        `).bind(username, orgId).first()
        if (existingUser) {
          username = username + '_' + Date.now().toString().slice(-4)
        }
        
        // 3. 管理者アカウントを作成
        await DB.prepare(`
          INSERT INTO admin_users (username, password_hash, name, email, role, organization_id)
          VALUES (?, ?, ?, ?, 'admin', ?)
        `).bind(username, initialPassword, adminName, email, orgId).run()
        
        console.log('Created admin user:', username)
        
        // 4. プラン情報を取得してサブスクリプション作成
        const plan = await DB.prepare(`SELECT * FROM subscription_plans WHERE id = ?`).bind(planId).first() as any
        if (plan) {
          const periodEnd = new Date()
          periodEnd.setDate(periodEnd.getDate() + 14) // トライアル期間
          
          const subResult = await DB.prepare(`
            INSERT INTO user_subscriptions (organization_id, plan_id, status, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end)
            VALUES (?, ?, 'active', ?, ?, date('now'), ?)
          `).bind(orgId, planId, stripeSubscriptionId, stripeCustomerId, periodEnd.toISOString().split('T')[0]).run()
          
          const subscriptionId = subResult.meta?.last_row_id
          
          // 5. 初期枠を付与
          if (subscriptionId) {
            await DB.prepare(`
              INSERT INTO slot_balances (subscription_id, organization_id, monthly_slots_remaining, purchased_slots_remaining, last_monthly_reset)
              VALUES (?, ?, ?, 0, date('now'))
            `).bind(subscriptionId, orgId, plan.monthly_slots === -1 ? 0 : plan.monthly_slots).run()
          }
          
          console.log('Created subscription and slot balance')
        }
        
        // 6. 両方業務の場合はアドオンを記録
        if (businessScope === 'both') {
          try {
            await DB.prepare(`
              INSERT INTO organization_addons (organization_id, addon_type, price)
              VALUES (?, 'dual_scope', 2000)
            `).bind(orgId).run()
          } catch (e) {
            console.log('Addon table might not exist, skipping')
          }
        }
        
        // 7. 登録完了情報を一時保存（signup-completeページで使用）
        await DB.prepare(`
          INSERT INTO signup_sessions (session_id, organization_id, slug, email, username, initial_password, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(session.id, orgId, slug, email, username, initialPassword).run()
        
        console.log('Signup completed successfully for:', slug)
        
      } catch (error: any) {
        console.error('Error creating organization from signup:', error)
      }
      
      return c.json({ received: true })
    }
    
    // ========================================
    // 既存組織のサブスクリプション・追加枠処理
    // ========================================
    const orgId = session.metadata?.organization_id
    
    if (!orgId) {
      console.error('No organization_id in metadata')
      return c.json({ received: true })
    }
    
    if (type === 'subscription') {
      // サブスクリプション開始処理
      const planCode = session.metadata?.plan_code
      const stripeSubscriptionId = session.subscription
      
      // プラン情報を取得
      const plan = await DB.prepare(`
        SELECT * FROM subscription_plans WHERE plan_code = ?
      `).bind(planCode).first()
      
      if (plan) {
        // 既存のサブスクリプションを取得
        const existingSub = await DB.prepare(`
          SELECT * FROM user_subscriptions WHERE organization_id = ? AND status = 'active'
        `).bind(orgId).first()
        
        const today = new Date()
        const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        
        if (existingSub) {
          // 既存サブスクリプションを更新
          await DB.prepare(`
            UPDATE user_subscriptions 
            SET plan_id = ?, stripe_subscription_id = ?, stripe_customer_id = ?,
                current_period_start = ?, current_period_end = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(
            plan.id, stripeSubscriptionId, session.customer,
            today.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0],
            existingSub.id
          ).run()
          
          // 枠残高をリセット
          await DB.prepare(`
            UPDATE slot_balances 
            SET monthly_slots_remaining = ?, last_monthly_reset = ?, updated_at = CURRENT_TIMESTAMP
            WHERE subscription_id = ?
          `).bind(plan.monthly_slots === -1 ? 0 : plan.monthly_slots, today.toISOString().split('T')[0], existingSub.id).run()
        } else {
          // 新規サブスクリプション作成
          const subResult = await DB.prepare(`
            INSERT INTO user_subscriptions (organization_id, plan_id, status, stripe_subscription_id, stripe_customer_id, current_period_start, current_period_end)
            VALUES (?, ?, 'active', ?, ?, ?, ?)
          `).bind(orgId, plan.id, stripeSubscriptionId, session.customer, today.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0]).run()
          
          const subscriptionId = subResult.meta?.last_row_id
          
          if (subscriptionId) {
            await DB.prepare(`
              INSERT INTO slot_balances (subscription_id, organization_id, monthly_slots_remaining, purchased_slots_remaining, last_monthly_reset)
              VALUES (?, ?, ?, 0, ?)
            `).bind(subscriptionId, orgId, plan.monthly_slots === -1 ? 0 : plan.monthly_slots, today.toISOString().split('T')[0]).run()
          }
        }
        
        // 履歴を記録
        await DB.prepare(`
          INSERT INTO slot_usage_history (subscription_id, slot_type, action, slots_changed, balance_after, note)
          VALUES ((SELECT id FROM user_subscriptions WHERE organization_id = ? AND status = 'active'), 'monthly', 'subscription_started', 0, 0, ?)
        `).bind(orgId, `Stripe経由で${plan.plan_name}を開始`).run()
      }
    } else if (type === 'slot_purchase') {
      // 追加枠購入処理
      const slots = parseInt(session.metadata?.slots || '0')
      
      if (slots > 0) {
        // サブスクリプション取得
        const subscription = await DB.prepare(`
          SELECT us.id, sb.purchased_slots_remaining
          FROM user_subscriptions us
          JOIN slot_balances sb ON us.id = sb.subscription_id
          WHERE us.organization_id = ? AND us.status = 'active'
          LIMIT 1
        `).bind(orgId).first() as any
        
        if (subscription) {
          const newPurchased = (subscription.purchased_slots_remaining || 0) + slots
          
          // 購入枠を追加
          await DB.prepare(`
            UPDATE slot_balances 
            SET purchased_slots_remaining = ?, updated_at = CURRENT_TIMESTAMP
            WHERE subscription_id = ?
          `).bind(newPurchased, subscription.id).run()
          
          // 購入履歴を記録
          await DB.prepare(`
            INSERT INTO slot_purchases (subscription_id, slots_purchased, amount_paid, payment_status, stripe_payment_intent_id)
            VALUES (?, ?, ?, 'completed', ?)
          `).bind(subscription.id, slots, session.amount_total, session.payment_intent).run()
          
          // 使用履歴を記録
          await DB.prepare(`
            INSERT INTO slot_usage_history (subscription_id, slot_type, action, slots_changed, balance_after, note)
            VALUES (?, 'purchased', 'purchased', ?, ?, ?)
          `).bind(subscription.id, slots, newPurchased, `Stripe経由で${slots}枠を購入`).run()
        }
      }
    }
  }
  
  // サブスクリプション更新イベント
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object
    const orgId = subscription.metadata?.organization_id
    
    if (orgId) {
      // ステータス更新
      const status = subscription.status === 'active' ? 'active' : 
                     subscription.status === 'canceled' ? 'cancelled' : subscription.status
      
      await DB.prepare(`
        UPDATE user_subscriptions 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE stripe_subscription_id = ?
      `).bind(status, subscription.id).run()
    }
  }
  
  // サブスクリプションキャンセルイベント
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object
    
    await DB.prepare(`
      UPDATE user_subscriptions 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE stripe_subscription_id = ?
    `).bind(subscription.id).run()
  }
  
  // 請求書支払い成功イベント（月次更新時）
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object
    const subscriptionId = invoice.subscription
    
    if (subscriptionId) {
      const sub = await DB.prepare(`
        SELECT us.*, sp.monthly_slots
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.stripe_subscription_id = ?
      `).bind(subscriptionId).first() as any
      
      if (sub) {
        const today = new Date()
        const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        
        // 期間と枠をリセット
        await DB.prepare(`
          UPDATE user_subscriptions 
          SET current_period_start = ?, current_period_end = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(today.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0], sub.id).run()
        
        await DB.prepare(`
          UPDATE slot_balances 
          SET monthly_slots_remaining = ?, last_monthly_reset = ?, updated_at = CURRENT_TIMESTAMP
          WHERE subscription_id = ?
        `).bind(sub.monthly_slots === -1 ? 0 : sub.monthly_slots, today.toISOString().split('T')[0], sub.id).run()
      }
    }
  }
  
  return c.json({ received: true })
})

// ========================================
// 新規登録用Stripe Checkout（認証不要）
// ========================================
routes.post('/stripe/create-signup-checkout', async (c) => {
  const { DB, STRIPE_SECRET_KEY } = c.env as any
  
  if (!STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe決済は現在設定されていません' }, 400)
  }
  
  const data = await c.req.json()
  
  // バリデーション
  if (!data.organization_name || !data.email || !data.admin_name || !data.slug || !data.plan_id) {
    return c.json({ error: '必須項目を入力してください' }, 400)
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
  
  // メール重複チェック
  const existingEmail = await DB.prepare(`SELECT id FROM organizations WHERE email = ?`).bind(data.email).first()
  if (existingEmail) {
    return c.json({ error: 'このメールアドレスは既に登録されています' }, 400)
  }
  
  // プラン情報を取得
  const plan = await DB.prepare(`SELECT * FROM subscription_plans WHERE id = ?`).bind(data.plan_id).first() as any
  if (!plan) {
    return c.json({ error: '無効なプランです' }, 400)
  }
  
  const planCode = plan.plan_code
  if (!STRIPE_PRICES.plans[planCode as keyof typeof STRIPE_PRICES.plans]) {
    return c.json({ error: 'このプランはStripe決済に対応していません' }, 400)
  }
  
  const priceId = STRIPE_PRICES.plans[planCode as keyof typeof STRIPE_PRICES.plans]
  const businessScope = data.business_scope || 'labor'
  
  try {
    // Stripe Customer作成
    const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'name': data.organization_name,
        'email': data.email,
        'metadata[signup_slug]': slug,
        'metadata[admin_name]': data.admin_name,
        'metadata[phone]': data.phone || '',
        'metadata[business_scope]': businessScope
      }).toString()
    })
    const customer = await customerResponse.json() as any
    
    if (customer.error) {
      console.error('Stripe customer creation error:', customer.error)
      return c.json({ error: customer.error.message }, 400)
    }
    
    const stripeCustomerId = customer.id
    const baseUrl = new URL(c.req.url).origin
    
    // Checkout Session作成（14日無料トライアル付きサブスク）
    const checkoutParams: Record<string, string> = {
      'customer': stripeCustomerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'mode': 'subscription',
      'success_url': `${baseUrl}/signup-complete?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${baseUrl}/signup?cancelled=true`,
      'subscription_data[trial_period_days]': '14',
      'subscription_data[metadata][type]': 'new_signup',
      'subscription_data[metadata][organization_name]': data.organization_name,
      'subscription_data[metadata][slug]': slug,
      'subscription_data[metadata][email]': data.email,
      'subscription_data[metadata][admin_name]': data.admin_name,
      'subscription_data[metadata][phone]': data.phone || '',
      'subscription_data[metadata][plan_id]': String(data.plan_id),
      'subscription_data[metadata][plan_code]': planCode,
      'subscription_data[metadata][business_scope]': businessScope,
      'metadata[type]': 'new_signup',
      'metadata[organization_name]': data.organization_name,
      'metadata[slug]': slug,
      'metadata[email]': data.email,
      'metadata[admin_name]': data.admin_name,
      'metadata[phone]': data.phone || '',
      'metadata[plan_id]': String(data.plan_id),
      'metadata[plan_code]': planCode,
      'metadata[business_scope]': businessScope
    }
    
    // 両方業務の場合、アドオンも追加
    if (businessScope === 'both' && STRIPE_PRICES.addons.dual_scope) {
      checkoutParams['line_items[1][price]'] = STRIPE_PRICES.addons.dual_scope
      checkoutParams['line_items[1][quantity]'] = '1'
    }
    
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(checkoutParams).toString()
    })
    
    const session = await response.json() as any
    
    if (session.error) {
      console.error('Stripe checkout session error:', session.error)
      return c.json({ error: session.error.message }, 400)
    }
    
    return c.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    })
  } catch (error: any) {
    console.error('Stripe signup checkout error:', error)
    return c.json({ error: '決済セッションの作成に失敗しました' }, 500)
  }
})

// Stripe Customer Portal セッション作成（顧客が支払い方法を管理）
routes.post('/stripe/create-portal-session', async (c) => {
  const { DB, STRIPE_SECRET_KEY } = c.env as any
  const user = await getCurrentUser(c)
  
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'この操作は管理者のみ実行できます' }, 403)
  }
  
  if (!STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe決済は現在設定されていません' }, 400)
  }
  
  const orgId = getEffectiveOrgId(c, user)
  if (!orgId) {
    return c.json({ error: '組織が特定できません' }, 401)
  }
  
  // 組織情報を取得
  const org = await DB.prepare(`SELECT stripe_customer_id FROM organizations WHERE id = ?`).bind(orgId).first() as any
  
  if (!org?.stripe_customer_id) {
    return c.json({ error: 'Stripeの顧客情報がありません。まずプランを選択してください。' }, 400)
  }
  
  try {
    const baseUrl = new URL(c.req.url).origin
    
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'customer': org.stripe_customer_id,
        'return_url': `${baseUrl}/admin/subscription`
      }).toString()
    })
    
    const session = await response.json() as any
    
    if (session.error) {
      return c.json({ error: session.error.message }, 400)
    }
    
    return c.json({
      success: true,
      portal_url: session.url
    })
  } catch (error: any) {
    console.error('Stripe portal session error:', error)
    return c.json({ error: 'ポータルセッションの作成に失敗しました' }, 500)
  }
})

export default routes
