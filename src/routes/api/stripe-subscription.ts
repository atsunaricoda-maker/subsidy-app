// Stripe サブスクリプション・追加枠購入API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

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
  
  const orgId = user.organization_id || 1
  
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
  
  const orgId = user.organization_id || 1
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
    const orgId = session.metadata?.organization_id
    const type = session.metadata?.type
    
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
  
  const orgId = user.organization_id || 1
  
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
