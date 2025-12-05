-- =============================================
-- 0015_payment_system.sql
-- 支払いシステム（銀行振込 + Stripe連携）
-- =============================================

-- システム設定テーブル（振込先情報など）
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type TEXT DEFAULT 'text', -- text, json, number, boolean
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 支払い履歴テーブル
CREATE TABLE IF NOT EXISTS payment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  payment_type TEXT NOT NULL, -- 'deposit' (手付金), 'final' (残金), 'other'
  amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL, -- 'credit_card', 'bank_transfer'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reported', 'confirmed', 'completed', 'failed'
  stripe_payment_intent_id TEXT, -- Stripe決済の場合
  stripe_session_id TEXT, -- Stripe Checkoutセッション
  bank_transfer_reported_at DATETIME, -- 振込完了報告日時
  bank_transfer_confirmed_at DATETIME, -- 振込確認日時
  confirmed_by INTEGER, -- 確認した管理者ID
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmed_by) REFERENCES admin_users(id)
);

-- 振込完了報告の追加カラム（clients テーブル）
ALTER TABLE clients ADD COLUMN deposit_transfer_reported INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN deposit_transfer_reported_at DATETIME;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_payment_history_client ON payment_history(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- 初期設定データ（銀行振込先情報）
INSERT OR IGNORE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('bank_name', '', 'text', '銀行名'),
('bank_branch', '', 'text', '支店名'),
('bank_account_type', '普通', 'text', '口座種別'),
('bank_account_number', '', 'text', '口座番号'),
('bank_account_holder', '', 'text', '口座名義'),
('stripe_enabled', 'false', 'boolean', 'Stripe決済の有効/無効'),
('company_name', '', 'text', '会社名（請求書用）'),
('company_address', '', 'text', '会社住所（請求書用）'),
('company_phone', '', 'text', '会社電話番号');
