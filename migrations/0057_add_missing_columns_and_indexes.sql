-- 0057: 不足カラムの追加とインデックスの最適化
-- cases テーブルに不足しているカラムを追加
ALTER TABLE cases ADD COLUMN deposit_tax_included INTEGER DEFAULT 0;
ALTER TABLE cases ADD COLUMN success_fee_tax_included INTEGER DEFAULT 0;

-- user_subscriptions テーブルに stripe_customer_id を追加
ALTER TABLE user_subscriptions ADD COLUMN stripe_customer_id TEXT;

-- パフォーマンス改善: 頻繁に使用されるカラムにインデックスを追加
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_archived_result ON cases(is_archived, result);
CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(email);
CREATE INDEX IF NOT EXISTS idx_payment_history_client_status ON payment_history(client_id, status);
