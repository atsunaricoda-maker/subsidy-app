-- =====================================================
-- マルチテナント対応 & 新料金プラン
-- =====================================================

-- 1. 組織（法人/テナント）テーブル
CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    representative_name TEXT,
    business_type TEXT DEFAULT 'office',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'cancelled', 'trial')),
    trial_ends_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. マスター管理者テーブル
CREATE TABLE IF NOT EXISTS master_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'master' CHECK(role IN ('master', 'support', 'viewer')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 既存テーブルに organization_id を追加
ALTER TABLE admin_users ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE clients ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE cases ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE documents ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE communications ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE hearing_answers ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE user_subscriptions ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE slot_balances ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE slot_usage_history ADD COLUMN organization_id INTEGER REFERENCES organizations(id);

-- 4. subscription_plans に max_staff カラム追加
ALTER TABLE subscription_plans ADD COLUMN max_staff INTEGER DEFAULT 1;

-- 5. 既存プランの max_staff 設定
UPDATE subscription_plans SET max_staff = 1 WHERE plan_code = 'basic';
UPDATE subscription_plans SET max_staff = 3 WHERE plan_code = 'standard';
UPDATE subscription_plans SET max_staff = 5 WHERE plan_code = 'premium';
UPDATE subscription_plans SET max_staff = -1 WHERE plan_code = 'unlimited';

-- 6. 既存の unlimited を要相談に変更
UPDATE subscription_plans 
SET plan_name = '要相談プラン', 
    description = '大企業向け・個別見積もり',
    monthly_price = 0,
    is_active = 0
WHERE plan_code = 'unlimited';

-- 7. Business プラン追加
INSERT INTO subscription_plans (plan_code, plan_name, description, monthly_price, monthly_slots, max_staff, is_active)
VALUES (
    'business',
    'Business',
    '法人・複数拠点向け',
    30000,
    30,
    10,
    1
);

-- 8. Enterprise プラン追加
INSERT INTO subscription_plans (plan_code, plan_name, description, monthly_price, monthly_slots, max_staff, is_active)
VALUES (
    'enterprise',
    'Enterprise',
    '大規模法人向け',
    100000,
    100,
    30,
    1
);

-- 9. デフォルト組織を作成（既存データ用）
INSERT INTO organizations (id, name, slug, email, status)
VALUES (1, 'デフォルト組織', 'default', 'admin@example.com', 'active');

-- 10. 既存データにデフォルト組織を紐付け
UPDATE admin_users SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE clients SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE cases SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE documents SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE communications SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE user_subscriptions SET organization_id = 1 WHERE organization_id IS NULL;

-- 11. マスター管理者の初期アカウント作成
INSERT INTO master_admins (username, password_hash, name, email, role)
VALUES ('master', 'master123', 'マスター管理者', 'master@subsidy-app.com', 'master');

-- 12. インデックス作成
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_admin_users_org ON admin_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_cases_org ON cases(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_org ON user_subscriptions(organization_id);
