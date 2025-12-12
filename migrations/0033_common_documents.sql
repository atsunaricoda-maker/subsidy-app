-- 共通書類テーブル（顧客単位で管理、全案件で共有可能）
CREATE TABLE IF NOT EXISTS client_common_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  document_type TEXT NOT NULL,  -- 登記簿謄本、決算書、確定申告書など
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,  -- R2のパス
  file_size INTEGER,
  fiscal_year TEXT,  -- 決算書の場合の年度（例: 2023, 2024）
  valid_until DATE,  -- 有効期限（登記簿謄本は3ヶ月など）
  status TEXT NOT NULL DEFAULT 'active',  -- active, expired, replaced
  notes TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 共通書類タイプマスター
CREATE TABLE IF NOT EXISTS common_document_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,  -- 登記簿謄本、決算書、確定申告書など
  description TEXT,
  validity_months INTEGER,  -- 有効期間（月数）、NULLは無期限
  max_versions INTEGER DEFAULT 1,  -- 保持できる最大バージョン数（決算書は3期分など）
  is_required INTEGER DEFAULT 1,  -- 基本的に必要かどうか
  display_order INTEGER DEFAULT 0
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_common_docs_client ON client_common_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_common_docs_type ON client_common_documents(document_type);

-- 初期データ：共通書類タイプ
INSERT OR IGNORE INTO common_document_types (name, description, validity_months, max_versions, is_required, display_order) VALUES
  ('登記簿謄本', '3ヶ月以内に発行されたもの', 3, 1, 1, 1),
  ('決算書', '直近2〜3期分', NULL, 3, 1, 2),
  ('確定申告書', '直近のもの', 12, 1, 1, 3),
  ('納税証明書', '直近のもの', 3, 1, 0, 4),
  ('会社概要・パンフレット', '最新版', NULL, 1, 0, 5);
