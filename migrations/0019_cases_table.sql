-- 案件テーブル（1顧客に対して複数案件を持てる）
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  case_number TEXT,  -- 案件番号（自動生成: CASE-2024-0001 形式）
  subsidy_type_id INTEGER,  -- 申請する助成金種別
  status TEXT NOT NULL DEFAULT 'inquiry',  -- inquiry, consulting, preparing, applying, completed, cancelled
  assigned_to INTEGER,  -- 担当者ID
  notes TEXT,  -- メモ
  -- 手付金・決済関連
  deposit_required INTEGER DEFAULT 0,
  deposit_amount INTEGER DEFAULT 0,
  deposit_paid INTEGER DEFAULT 0,
  deposit_paid_at DATETIME,
  deposit_transfer_reported INTEGER DEFAULT 0,
  deposit_transfer_reported_at DATETIME,
  -- 成功報酬関連
  success_fee_enabled INTEGER DEFAULT 0,
  success_fee_rate REAL DEFAULT 0,
  success_fee_amount INTEGER DEFAULT 0,
  withholding_tax INTEGER DEFAULT 0,
  -- 契約関連
  contract_url TEXT,  -- 電子契約URL
  -- ポータルアクセス用トークン
  access_token TEXT UNIQUE,
  -- プライバシーポリシー同意
  privacy_policy_agreed INTEGER DEFAULT 0,
  privacy_policy_agreed_at DATETIME,
  -- タイムスタンプ
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (subsidy_type_id) REFERENCES subsidy_types(id),
  FOREIGN KEY (assigned_to) REFERENCES admin_users(id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_cases_client_id ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_access_token ON cases(access_token);
CREATE INDEX IF NOT EXISTS idx_cases_subsidy_type_id ON cases(subsidy_type_id);

-- 既存データの移行: clientsテーブルから案件情報をcasesテーブルにコピー
INSERT INTO cases (
  client_id, subsidy_type_id, status, assigned_to, notes,
  deposit_required, deposit_amount, deposit_paid, deposit_paid_at,
  deposit_transfer_reported, deposit_transfer_reported_at,
  success_fee_enabled, success_fee_rate, success_fee_amount, withholding_tax,
  contract_url, access_token, privacy_policy_agreed, privacy_policy_agreed_at,
  created_at, updated_at
)
SELECT 
  id, subsidy_type_id, status, assigned_to, notes,
  COALESCE(deposit_required, 0), COALESCE(deposit_amount, 0), 
  COALESCE(deposit_paid, 0), deposit_paid_at,
  COALESCE(deposit_transfer_reported, 0), deposit_transfer_reported_at,
  COALESCE(success_fee_enabled, 0), COALESCE(success_fee_rate, 0), 
  COALESCE(success_fee_amount, 0), COALESCE(withholding_tax, 0),
  contract_url, access_token, 
  COALESCE(privacy_policy_agreed, 0), privacy_policy_agreed_at,
  created_at, updated_at
FROM clients
WHERE access_token IS NOT NULL;

-- 関連テーブルにcase_idカラムを追加
-- documentsテーブル
ALTER TABLE documents ADD COLUMN case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE;

-- communicationsテーブル
ALTER TABLE communications ADD COLUMN case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE;

-- hearing_answersテーブル
ALTER TABLE hearing_answers ADD COLUMN case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE;

-- client_pipelinesテーブル
ALTER TABLE client_pipelines ADD COLUMN case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE;

-- paymentsテーブル（存在する場合）
-- ALTER TABLE payments ADD COLUMN case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE;

-- generated_documentsテーブル
ALTER TABLE generated_documents ADD COLUMN case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE;

-- 既存データにcase_idを設定（client_idをベースに）
UPDATE documents SET case_id = (SELECT id FROM cases WHERE cases.client_id = documents.client_id LIMIT 1) WHERE case_id IS NULL;
UPDATE communications SET case_id = (SELECT id FROM cases WHERE cases.client_id = communications.client_id LIMIT 1) WHERE case_id IS NULL;
UPDATE hearing_answers SET case_id = (SELECT id FROM cases WHERE cases.client_id = hearing_answers.client_id LIMIT 1) WHERE case_id IS NULL;
UPDATE client_pipelines SET case_id = (SELECT id FROM cases WHERE cases.client_id = client_pipelines.client_id LIMIT 1) WHERE case_id IS NULL;
UPDATE generated_documents SET case_id = (SELECT id FROM cases WHERE cases.client_id = generated_documents.client_id LIMIT 1) WHERE case_id IS NULL;
