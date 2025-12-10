-- 料金プラン・枠管理システム
-- 作成日: 2024-12-10

-- 料金プランマスタ
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_code TEXT UNIQUE NOT NULL, -- 'basic', 'standard', 'premium'
    plan_name TEXT NOT NULL,
    monthly_price INTEGER NOT NULL, -- 月額料金（円）
    monthly_slots INTEGER NOT NULL, -- 毎月付与される枠数
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 追加枠パッケージマスタ
CREATE TABLE IF NOT EXISTS slot_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_code TEXT UNIQUE NOT NULL, -- 'single', 'triple', 'bulk'
    package_name TEXT NOT NULL,
    slot_count INTEGER NOT NULL, -- 枠数
    price INTEGER NOT NULL, -- 価格（円）
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 組織/ユーザーのサブスクリプション情報
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- admin_usersのid（NULLの場合はシステム全体）
    plan_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'cancelled', 'suspended'
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    current_period_start DATE,
    current_period_end DATE,
    cancelled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

-- 枠の残数管理
CREATE TABLE IF NOT EXISTS slot_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER,
    monthly_slots_remaining INTEGER DEFAULT 0, -- 月次枠の残り（月末リセット）
    purchased_slots_remaining INTEGER DEFAULT 0, -- 購入枠の残り（無期限）
    last_monthly_reset DATE, -- 最後に月次リセットした日
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id)
);

-- 枠の使用履歴
CREATE TABLE IF NOT EXISTS slot_usage_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER,
    case_id INTEGER,
    slot_type TEXT NOT NULL, -- 'monthly' or 'purchased'
    action TEXT NOT NULL, -- 'consumed' (消費), 'granted' (付与), 'purchased' (購入)
    slots_changed INTEGER NOT NULL, -- 変化した枠数（消費は負、付与/購入は正）
    balance_after INTEGER, -- 操作後の残高
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id),
    FOREIGN KEY (case_id) REFERENCES cases(id)
);

-- 追加枠購入履歴
CREATE TABLE IF NOT EXISTS slot_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER,
    package_id INTEGER,
    slots_purchased INTEGER NOT NULL,
    amount_paid INTEGER NOT NULL, -- 支払い金額
    payment_method TEXT, -- 'stripe', 'bank_transfer', etc.
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    stripe_payment_intent_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id),
    FOREIGN KEY (package_id) REFERENCES slot_packages(id)
);

-- 初期データ: 料金プラン
INSERT INTO subscription_plans (plan_code, plan_name, monthly_price, monthly_slots, description) VALUES
('basic', 'ベーシックプラン', 3000, 1, '月額3,000円 - 毎月1件分の枠を無料進呈'),
('standard', 'スタンダードプラン', 5000, 3, '月額5,000円 - 毎月3件分の枠を無料進呈'),
('premium', 'プレミアムプラン', 10000, 10, '月額10,000円 - 毎月10件分の枠を無料進呈');

-- 初期データ: 追加枠パッケージ
INSERT INTO slot_packages (package_code, package_name, slot_count, price, description) VALUES
('single', '1枠パック', 1, 1500, '1枠 1,500円（無期限）'),
('triple', '3枠パック', 3, 3000, '3枠 3,000円（1枠あたり1,000円でお得！）'),
('bulk', '10枠パック', 10, 9000, '10枠 9,000円（1枠あたり900円で最もお得！）');

-- インデックス
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_slot_balances_subscription ON slot_balances(subscription_id);
CREATE INDEX IF NOT EXISTS idx_slot_usage_history_subscription ON slot_usage_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_slot_usage_history_case ON slot_usage_history(case_id);
