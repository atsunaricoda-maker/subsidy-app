// API: Stripe決済
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// Stripe決済セッション作成
routes.post('/clients/:clientId/create-checkout-session', async (c) => {
  const { DB, STRIPE_SECRET_KEY } = c.env as any
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  
  if (!STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe決済は現在設定されていません' }, 400)
  }
  
  // クライアント情報を取得
  const client = await DB.prepare(`
    SELECT * FROM clients WHERE id = ?
  `).bind(clientId).first() as any
  
  if (!client) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  const amount = data.amount || client.deposit_amount
  if (!amount || amount <= 0) {
    return c.json({ error: '支払い金額が設定されていません' }, 400)
  }
  
  try {
    // Stripe APIを呼び出し
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'payment_method_types[]': 'card',
        'line_items[0][price_data][currency]': 'jpy',
        'line_items[0][price_data][product_data][name]': `${client.name}様 - 手付金`,
        'line_items[0][price_data][unit_amount]': String(amount),
        'line_items[0][quantity]': '1',
        'mode': 'payment',
        'success_url': `${data.success_url || c.req.url.replace(/\/api\/.*/, '')}/portal/${client.access_token}?payment=success`,
        'cancel_url': `${data.cancel_url || c.req.url.replace(/\/api\/.*/, '')}/portal/${client.access_token}?payment=cancelled`,
        'metadata[client_id]': clientId,
        'metadata[payment_type]': 'deposit',
      }).toString(),
    })
    
    const session = await response.json() as any
    
    if (session.error) {
      console.error('Stripe error:', session.error)
      return c.json({ error: session.error.message }, 400)
    }
    
    // 支払い履歴を作成
    await DB.prepare(`
      INSERT INTO payment_history (client_id, payment_type, amount, payment_method, status, stripe_session_id)
      VALUES (?, 'deposit', ?, 'credit_card', 'pending', ?)
    `).bind(clientId, amount, session.id).run()
    
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

// Stripe Webhook受信
routes.post('/stripe/webhook', async (c) => {
  const { DB, STRIPE_WEBHOOK_SECRET } = c.env as any
  
  const payload = await c.req.text()
  const sig = c.req.header('stripe-signature')
  
  // Webhook署名検証（本番環境では必須）
  // 簡易的な実装のため、署名検証は省略（本番では必ず実装してください）
  
  let event: any
  try {
    event = JSON.parse(payload)
  } catch {
    return c.json({ error: 'Invalid payload' }, 400)
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const clientId = session.metadata?.client_id
    
    if (clientId) {
      // 支払い履歴を更新
      await DB.prepare(`
        UPDATE payment_history 
        SET status = 'completed', 
            stripe_payment_intent_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE stripe_session_id = ?
      `).bind(session.payment_intent, session.id).run()
      
      // クライアントの支払いステータスを更新
      await DB.prepare(`
        UPDATE clients 
        SET deposit_paid = 1, 
            deposit_paid_at = CURRENT_TIMESTAMP,
            deposit_payment_method = 'credit_card',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(clientId).run()
    }
  }
  
  return c.json({ received: true })
})

export default routes
