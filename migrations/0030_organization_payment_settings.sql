-- =====================================================
-- 組織ごとの決済設定を追加
-- 振込口座情報・Stripe設定をマスター管理者が設定可能に
-- =====================================================

-- 組織に決済関連カラムを追加
ALTER TABLE organizations ADD COLUMN bank_name TEXT;
ALTER TABLE organizations ADD COLUMN bank_branch TEXT;
ALTER TABLE organizations ADD COLUMN bank_account_type TEXT DEFAULT '普通';
ALTER TABLE organizations ADD COLUMN bank_account_number TEXT;
ALTER TABLE organizations ADD COLUMN bank_account_holder TEXT;
ALTER TABLE organizations ADD COLUMN stripe_account_id TEXT;
ALTER TABLE organizations ADD COLUMN stripe_enabled INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN payment_method TEXT DEFAULT 'bank_transfer';
ALTER TABLE organizations ADD COLUMN payment_notes TEXT;
