// サブスクリプション・枠管理API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// プラン一覧取得
routes.get('/subscription/plans', async (c) => {
  const { DB } = c.env
  const plans = await DB.prepare(`
    SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY monthly_price ASC
  `).all()
  return c.json(plans.results || [])
})

// 追加枠パッケージ一覧取得
routes.get('/subscription/packages', async (c) => {
  const { DB } = c.env
  const packages = await DB.prepare(`
    SELECT * FROM slot_packages WHERE is_active = 1 ORDER BY price ASC
  `).all()
  return c.json(packages.results || [])
})

// 現在のサブスクリプション・枠情報取得
routes.get('/subscription/status', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離
  const orgId = user?.organization_id || 1
  
  // 組織のサブスクリプションを取得
  let subscription = await DB.prepare(`
    SELECT us.*, sp.plan_code, sp.plan_name, sp.monthly_price, sp.monthly_slots
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.organization_id = ? AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1
  `).bind(orgId).first()
  
  // サブスクリプションがない場合は初期作成（ベーシックプラン）
  if (!subscription) {
    const basicPlan = await DB.prepare(`
      SELECT id, monthly_slots FROM subscription_plans WHERE plan_code = 'basic'
    `).first()
    
    if (basicPlan) {
      const today = new Date()
      const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0) // 月末
      
      // 組織用サブスクリプションを作成
      const subResult = await DB.prepare(`
        INSERT INTO user_subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
        VALUES (?, ?, 'active', ?, ?)
      `).bind(orgId, basicPlan.id, today.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0]).run()
      
      const subscriptionId = subResult.meta?.last_row_id
      
      if (subscriptionId) {
        // 枠残高を初期化
        await DB.prepare(`
          INSERT INTO slot_balances (subscription_id, organization_id, monthly_slots_remaining, purchased_slots_remaining, last_monthly_reset)
          VALUES (?, ?, ?, 0, ?)
        `).bind(subscriptionId, orgId, basicPlan.monthly_slots || 1, today.toISOString().split('T')[0]).run()
      }
      
      subscription = await DB.prepare(`
        SELECT us.*, sp.plan_code, sp.plan_name, sp.monthly_price, sp.monthly_slots
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.id = ?
      `).bind(subscriptionId).first()
    }
  }
  
  // 枠残高を取得
  let balance = await DB.prepare(`
    SELECT * FROM slot_balances WHERE subscription_id = ?
  `).bind(subscription?.id).first()
  
  // 月次リセットチェック（切り替わり日処理）
  if (balance && subscription) {
    const today = new Date()
    const lastReset = balance.last_monthly_reset ? new Date(balance.last_monthly_reset) : null
    
    // 先月以前にリセットされていた場合、今月分をリセット
    if (!lastReset || lastReset.getMonth() !== today.getMonth() || lastReset.getFullYear() !== today.getFullYear()) {
      
      // 予約されたプラン変更があればここで適用
      if (subscription.scheduled_plan_id && subscription.scheduled_plan_date) {
        const scheduledDate = new Date(subscription.scheduled_plan_date)
        if (today >= scheduledDate) {
          // 新しいプランを取得
          const newPlan = await DB.prepare(`
            SELECT * FROM subscription_plans WHERE id = ?
          `).bind(subscription.scheduled_plan_id).first()
          
          if (newPlan) {
            // プランを更新し、予約をクリア
            await DB.prepare(`
              UPDATE user_subscriptions 
              SET plan_id = ?, scheduled_plan_id = NULL, scheduled_plan_date = NULL, 
                  current_period_start = ?, current_period_end = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(
              newPlan.id, 
              today.toISOString().split('T')[0],
              new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0],
              subscription.id
            ).run()
            
            // 新プランの枠数を使用（古い月次枠はリセット）
            subscription.monthly_slots = newPlan.monthly_slots
            subscription.plan_id = newPlan.id
            subscription.plan_name = newPlan.plan_name
            
            // プラン変更履歴を記録
            await DB.prepare(`
              INSERT INTO slot_usage_history (subscription_id, slot_type, action, slots_changed, balance_after, note)
              VALUES (?, 'monthly', 'plan_changed', 0, 0, ?)
            `).bind(subscription.id, `プランを${newPlan.plan_name}に変更`).run()
          }
        }
      }
      
      // プラン枠をリセット（追加購入枠はそのまま維持）
      // 重要：月次枠は毎月リセットされるが、追加購入枠は無期限で維持される
      // 無制限プラン（monthly_slots = -1）の場合は枠数を0に設定（枠管理は不要だが履歴のため）
      const resetSlots = subscription.monthly_slots === -1 ? 0 : subscription.monthly_slots
      await DB.prepare(`
        UPDATE slot_balances 
        SET monthly_slots_remaining = ?, last_monthly_reset = ?, updated_at = CURRENT_TIMESTAMP
        WHERE subscription_id = ?
      `).bind(resetSlots, today.toISOString().split('T')[0], subscription.id).run()
      
      // 期間を更新（current_period_endも更新）
      await DB.prepare(`
        UPDATE user_subscriptions
        SET current_period_start = ?, current_period_end = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        today.toISOString().split('T')[0],
        new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0],
        subscription.id
      ).run()
      
      // 付与履歴を記録（無制限プランの場合は特別なメッセージ）
      const grantNote = subscription.monthly_slots === -1 
        ? `${today.getFullYear()}年${today.getMonth() + 1}月分 - 無制限プラン`
        : `${today.getFullYear()}年${today.getMonth() + 1}月分の枠を付与（プラン枠リセット）`
      await DB.prepare(`
        INSERT INTO slot_usage_history (subscription_id, slot_type, action, slots_changed, balance_after, note)
        VALUES (?, 'monthly', 'granted', ?, ?, ?)
      `).bind(
        subscription.id, 
        resetSlots, 
        resetSlots,
        grantNote
      ).run()
      
      balance = await DB.prepare(`
        SELECT * FROM slot_balances WHERE subscription_id = ?
      `).bind(subscription.id).first()
      
      // subscriptionも再取得
      subscription = await DB.prepare(`
        SELECT us.*, sp.plan_code, sp.plan_name, sp.monthly_price, sp.monthly_slots
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.id = ?
      `).bind(subscription.id).first()
    }
  }
  
  // 今月の使用枠数を計算
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const usedThisMonth = await DB.prepare(`
    SELECT COUNT(*) as count FROM slot_usage_history
    WHERE subscription_id = ? AND action = 'consumed' AND created_at >= ?
  `).bind(subscription?.id, monthStart).first()
  
  // 次回切り替わり日を計算（現在の期間終了日の翌日）
  let nextResetDate = null
  if (subscription?.current_period_end) {
    const periodEnd = new Date(subscription.current_period_end)
    nextResetDate = new Date(periodEnd)
    nextResetDate.setDate(nextResetDate.getDate() + 1)
  } else {
    // デフォルトは来月1日
    const today = new Date()
    nextResetDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  }
  
  // 予約されたプラン情報を取得
  let scheduledPlan = null
  if (subscription?.scheduled_plan_id) {
    scheduledPlan = await DB.prepare(`
      SELECT * FROM subscription_plans WHERE id = ?
    `).bind(subscription.scheduled_plan_id).first()
  }
  
  // 無制限プランかどうかを判定 (monthly_slots = -1)
  const isUnlimited = subscription?.monthly_slots === -1
  
  // 組織の業務範囲とアドオン情報を取得
  const organization = await DB.prepare(`
    SELECT business_scope FROM organizations WHERE id = ?
  `).bind(orgId).first()
  
  const addons = await DB.prepare(`
    SELECT * FROM organization_addons WHERE organization_id = ? AND status = 'active'
  `).bind(orgId).all()
  
  const hasDualScope = addons.results?.some((a: any) => a.addon_type === 'dual_scope') || false
  
  return c.json({
    subscription: subscription || null,
    balance: balance || { monthly_slots_remaining: 0, purchased_slots_remaining: 0 },
    total_available: isUnlimited ? -1 : (balance?.monthly_slots_remaining || 0) + (balance?.purchased_slots_remaining || 0),
    used_this_month: usedThisMonth?.count || 0,
    next_reset_date: nextResetDate.toISOString().split('T')[0],
    current_period_start: subscription?.current_period_start || null,
    current_period_end: subscription?.current_period_end || null,
    scheduled_plan: scheduledPlan,
    scheduled_plan_date: subscription?.scheduled_plan_date || null,
    is_unlimited: isUnlimited,
    business_scope: organization?.business_scope || 'both',
    has_dual_scope: hasDualScope,
    addons: addons.results || []
  })
})

// 枠を消費（ステータス変更時に呼ばれる）
routes.post('/subscription/consume-slot', async (c) => {
  const { DB } = c.env
  const { case_id } = await c.req.json()
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離
  const orgId = user?.organization_id || 1
  
  if (!case_id) {
    return c.json({ error: 'case_id is required' }, 400)
  }
  
  // 既にこの案件で枠を消費済みかチェック
  const alreadyConsumed = await DB.prepare(`
    SELECT id FROM slot_usage_history WHERE case_id = ? AND action = 'consumed'
  `).bind(case_id).first()
  
  if (alreadyConsumed) {
    return c.json({ success: true, message: 'Already consumed', already_consumed: true })
  }
  
  // サブスクリプション取得（プラン情報も含める）
  const subscription = await DB.prepare(`
    SELECT us.id, sb.monthly_slots_remaining, sb.purchased_slots_remaining, sp.monthly_slots
    FROM user_subscriptions us
    JOIN slot_balances sb ON us.id = sb.subscription_id
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.organization_id = ? AND us.status = 'active'
    LIMIT 1
  `).bind(orgId).first()
  
  if (!subscription) {
    return c.json({ error: 'No active subscription' }, 400)
  }
  
  // 無制限プランの場合は枠消費せずに成功を返す
  if (subscription.monthly_slots === -1) {
    // 履歴のみ記録（消費数0）
    await DB.prepare(`
      INSERT INTO slot_usage_history (subscription_id, case_id, slot_type, action, slots_changed, balance_after, note)
      VALUES (?, ?, 'unlimited', 'consumed', 0, -1, '無制限プラン - 枠消費なし')
    `).bind(subscription.id, case_id).run()
    
    return c.json({ success: true, message: 'Unlimited plan - no slot consumed', is_unlimited: true })
  }
  
  const totalAvailable = (subscription.monthly_slots_remaining || 0) + (subscription.purchased_slots_remaining || 0)
  
  if (totalAvailable <= 0) {
    return c.json({ error: 'No slots available', need_purchase: true }, 400)
  }
  
  // 月次枠から優先消費、なければ購入枠から消費
  let slotType = 'monthly'
  let newMonthly = subscription.monthly_slots_remaining
  let newPurchased = subscription.purchased_slots_remaining
  
  if (subscription.monthly_slots_remaining > 0) {
    newMonthly = subscription.monthly_slots_remaining - 1
  } else {
    slotType = 'purchased'
    newPurchased = subscription.purchased_slots_remaining - 1
  }
  
  // 枠を消費
  await DB.prepare(`
    UPDATE slot_balances 
    SET monthly_slots_remaining = ?, purchased_slots_remaining = ?, updated_at = CURRENT_TIMESTAMP
    WHERE subscription_id = ?
  `).bind(newMonthly, newPurchased, subscription.id).run()
  
  // 使用履歴を記録
  await DB.prepare(`
    INSERT INTO slot_usage_history (subscription_id, case_id, slot_type, action, slots_changed, balance_after, note)
    VALUES (?, ?, ?, 'consumed', -1, ?, '案件開始による枠消費')
  `).bind(subscription.id, case_id, slotType, newMonthly + newPurchased).run()
  
  return c.json({ 
    success: true, 
    slot_type_used: slotType,
    remaining: {
      monthly: newMonthly,
      purchased: newPurchased,
      total: newMonthly + newPurchased
    }
  })
})

// 枠残数チェック（ステータス変更前に呼ばれる）
routes.get('/subscription/check-slot', async (c) => {
  const { DB } = c.env
  const caseId = c.req.query('case_id')
  
  // 既にこの案件で枠を消費済みかチェック
  if (caseId) {
    const alreadyConsumed = await DB.prepare(`
      SELECT id FROM slot_usage_history WHERE case_id = ? AND action = 'consumed'
    `).bind(caseId).first()
    
    if (alreadyConsumed) {
      return c.json({ available: true, already_consumed: true, message: 'この案件は既に開始済みです' })
    }
  }
  
  // organization_idでテナント分離
  const user = await getCurrentUser(c)
  const orgId = user?.organization_id || 1
  
  // サブスクリプション取得（プラン情報も含める）
  const subscription = await DB.prepare(`
    SELECT sb.monthly_slots_remaining, sb.purchased_slots_remaining, sp.monthly_slots
    FROM user_subscriptions us
    JOIN slot_balances sb ON us.id = sb.subscription_id
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.organization_id = ? AND us.status = 'active'
    LIMIT 1
  `).bind(orgId).first()
  
  if (!subscription) {
    return c.json({ available: false, message: 'サブスクリプションがありません' })
  }
  
  // 無制限プランの場合
  if (subscription.monthly_slots === -1) {
    return c.json({
      available: true,
      is_unlimited: true,
      monthly_remaining: -1,
      purchased_remaining: subscription.purchased_slots_remaining || 0,
      total_remaining: -1,
      message: '無制限プラン - 枠の制限なし'
    })
  }
  
  const totalAvailable = (subscription.monthly_slots_remaining || 0) + (subscription.purchased_slots_remaining || 0)
  
  return c.json({
    available: totalAvailable > 0,
    is_unlimited: false,
    monthly_remaining: subscription.monthly_slots_remaining || 0,
    purchased_remaining: subscription.purchased_slots_remaining || 0,
    total_remaining: totalAvailable,
    message: totalAvailable > 0 ? `残り${totalAvailable}枠利用可能` : '枠がありません。追加購入が必要です。'
  })
})

// 追加枠購入
routes.post('/subscription/purchase-slots', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // 管理者権限チェック
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'この操作は管理者のみ実行できます' }, 403)
  }
  
  // organization_idでテナント分離
  const orgId = user?.organization_id || 1
  const { package_id } = await c.req.json()
  
  if (!package_id) {
    return c.json({ error: 'package_id is required' }, 400)
  }
  
  // パッケージ情報取得
  const pkg = await DB.prepare(`
    SELECT * FROM slot_packages WHERE id = ? AND is_active = 1
  `).bind(package_id).first()
  
  if (!pkg) {
    return c.json({ error: 'Package not found' }, 404)
  }
  
  // サブスクリプション取得
  const subscription = await DB.prepare(`
    SELECT us.id, sb.purchased_slots_remaining
    FROM user_subscriptions us
    JOIN slot_balances sb ON us.id = sb.subscription_id
    WHERE us.organization_id = ? AND us.status = 'active'
    LIMIT 1
  `).bind(orgId).first()
  
  if (!subscription) {
    return c.json({ error: 'No active subscription' }, 400)
  }
  
  const newPurchased = (subscription.purchased_slots_remaining || 0) + pkg.slot_count
  
  // 購入枠を追加
  await DB.prepare(`
    UPDATE slot_balances 
    SET purchased_slots_remaining = ?, updated_at = CURRENT_TIMESTAMP
    WHERE subscription_id = ?
  `).bind(newPurchased, subscription.id).run()
  
  // 購入履歴を記録
  await DB.prepare(`
    INSERT INTO slot_purchases (subscription_id, package_id, slots_purchased, amount_paid, payment_status)
    VALUES (?, ?, ?, ?, 'completed')
  `).bind(subscription.id, package_id, pkg.slot_count, pkg.price).run()
  
  // 使用履歴を記録
  await DB.prepare(`
    INSERT INTO slot_usage_history (subscription_id, slot_type, action, slots_changed, balance_after, note)
    VALUES (?, 'purchased', 'purchased', ?, ?, ?)
  `).bind(subscription.id, pkg.slot_count, newPurchased, `${pkg.package_name}を購入`).run()
  
  return c.json({ 
    success: true, 
    slots_added: pkg.slot_count,
    new_purchased_balance: newPurchased,
    amount_paid: pkg.price
  })
})

// プラン変更（次回切り替わり日から適用）
routes.post('/subscription/change-plan', async (c) => {
  const { DB } = c.env
  const { plan_id } = await c.req.json()
  const user = await getCurrentUser(c)
  
  // 管理者権限チェック
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'この操作は管理者のみ実行できます' }, 403)
  }
  
  // organization_idでテナント分離
  const orgId = user?.organization_id || 1
  
  if (!plan_id) {
    return c.json({ error: 'plan_id is required' }, 400)
  }
  
  const plan = await DB.prepare(`
    SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1
  `).bind(plan_id).first()
  
  if (!plan) {
    return c.json({ error: 'Plan not found' }, 404)
  }
  
  // 現在のサブスクリプションを取得
  const currentSub = await DB.prepare(`
    SELECT * FROM user_subscriptions WHERE organization_id = ? AND status = 'active' LIMIT 1
  `).bind(orgId).first()
  
  if (!currentSub) {
    return c.json({ error: 'No active subscription' }, 400)
  }
  
  // 次回切り替わり日を計算
  let nextResetDate
  if (currentSub.current_period_end) {
    const periodEnd = new Date(currentSub.current_period_end)
    nextResetDate = new Date(periodEnd)
    nextResetDate.setDate(nextResetDate.getDate() + 1)
  } else {
    const today = new Date()
    nextResetDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  }
  
  // 予約プランとして保存（次回切り替わり日に適用）
  await DB.prepare(`
    UPDATE user_subscriptions 
    SET scheduled_plan_id = ?, scheduled_plan_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE organization_id = ? AND status = 'active'
  `).bind(plan_id, nextResetDate.toISOString().split('T')[0], orgId).run()
  
  return c.json({ 
    success: true, 
    new_plan: plan,
    scheduled_date: nextResetDate.toISOString().split('T')[0],
    message: `${nextResetDate.toLocaleDateString('ja-JP')}からプランが変更されます`
  })
})

// 予約プランのキャンセル
routes.post('/subscription/cancel-scheduled-plan', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // 管理者権限チェック
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'この操作は管理者のみ実行できます' }, 403)
  }
  
  // organization_idでテナント分離
  const orgId = user?.organization_id || 1
  
  await DB.prepare(`
    UPDATE user_subscriptions 
    SET scheduled_plan_id = NULL, scheduled_plan_date = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE organization_id = ? AND status = 'active'
  `).bind(orgId).run()
  
  return c.json({ success: true, message: 'プラン変更の予約をキャンセルしました' })
})

// 両方利用オプションを追加
routes.post('/subscription/add-dual-scope', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  if (!user) {
    return c.json({ error: '認証が必要です' }, 401)
  }
  
  // 管理者権限チェック
  if (user.role !== 'admin') {
    return c.json({ error: 'この操作は管理者のみ実行できます' }, 403)
  }
  
  const orgId = user.organization_id
  if (!orgId) {
    return c.json({ error: '組織が見つかりません' }, 400)
  }
  
  // 既にアドオンがあるか確認
  const existingAddon = await DB.prepare(`
    SELECT id FROM organization_addons 
    WHERE organization_id = ? AND addon_type = 'dual_scope' AND status = 'active'
  `).bind(orgId).first()
  
  if (existingAddon) {
    return c.json({ error: '既に両方利用オプションが有効です' }, 400)
  }
  
  // 組織の業務範囲を更新
  await DB.prepare(`
    UPDATE organizations 
    SET business_scope = 'both', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(orgId).run()
  
  // アドオンを追加
  await DB.prepare(`
    INSERT INTO organization_addons (organization_id, addon_type, price, status)
    VALUES (?, 'dual_scope', 2000, 'active')
  `).bind(orgId).run()
  
  return c.json({ success: true, message: '両方利用オプションを追加しました' })
})

// 使用履歴取得
routes.get('/subscription/history', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // organization_idでテナント分離
  const orgId = user?.organization_id || 1
  
  const subscription = await DB.prepare(`
    SELECT id FROM user_subscriptions WHERE organization_id = ? AND status = 'active' LIMIT 1
  `).bind(orgId).first()
  
  if (!subscription) {
    return c.json([])
  }
  
  const history = await DB.prepare(`
    SELECT suh.*, c.case_number, cl.name as client_name
    FROM slot_usage_history suh
    LEFT JOIN cases c ON suh.case_id = c.id
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE suh.subscription_id = ?
    ORDER BY suh.created_at DESC
    LIMIT 50
  `).bind(subscription.id).all()
  
  return c.json(history.results || [])
})

export default routes
