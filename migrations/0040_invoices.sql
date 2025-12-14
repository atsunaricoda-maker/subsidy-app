-- =====================================================
-- 請求書管理システム
-- 手付金請求書・成功報酬請求書の発行・管理
-- =====================================================

-- 請求書テーブル
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 関連情報
  organization_id INTEGER NOT NULL,        -- 発行元組織
  case_id INTEGER NOT NULL,                -- 関連案件
  client_id INTEGER NOT NULL,              -- 請求先顧客
  
  -- 請求書基本情報
  invoice_number TEXT NOT NULL,            -- 請求書番号 (例: INV-2025-0001)
  invoice_type TEXT NOT NULL,              -- 'deposit' (手付金) or 'success_fee' (成功報酬)
  
  -- 金額情報
  subtotal INTEGER NOT NULL,               -- 小計（税抜）
  tax_rate INTEGER DEFAULT 10,             -- 消費税率 (%)
  tax_amount INTEGER DEFAULT 0,            -- 消費税額
  withholding_tax INTEGER DEFAULT 0,       -- 源泉徴収税額
  total_amount INTEGER NOT NULL,           -- 請求金額合計
  
  -- 日付情報
  issue_date DATE NOT NULL,                -- 発行日
  due_date DATE NOT NULL,                  -- 支払期限
  
  -- 品目情報
  item_name TEXT NOT NULL,                 -- 品目名 (例: "IT導入補助金申請 着手金")
  item_description TEXT,                   -- 品目詳細
  
  -- 成功報酬の場合の追加情報
  granted_amount INTEGER,                  -- 採択金額（成功報酬計算用）
  fee_rate REAL,                           -- 報酬率 (%)
  
  -- ステータス
  status TEXT NOT NULL DEFAULT 'draft',    -- draft, issued, paid, cancelled
  
  -- 支払い情報
  paid_at DATETIME,                        -- 支払日
  paid_amount INTEGER,                     -- 支払額
  payment_reported_at DATETIME,            -- 振込報告日時
  payment_confirmed_at DATETIME,           -- 入金確認日時
  payment_confirmed_by INTEGER,            -- 確認した管理者ID
  
  -- 備考
  notes TEXT,                              -- 備考欄
  internal_memo TEXT,                      -- 内部メモ（顧客には非表示）
  
  -- タイムスタンプ
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (payment_confirmed_by) REFERENCES admin_users(id)
);

-- 請求書番号の採番管理テーブル
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL UNIQUE,
  current_year INTEGER NOT NULL,
  current_sequence INTEGER NOT NULL DEFAULT 0,
  prefix TEXT DEFAULT 'INV',               -- 請求書番号のプレフィックス
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_invoices_organization ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_case ON invoices(case_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
