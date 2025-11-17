-- 顧客テーブル
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  access_token TEXT UNIQUE NOT NULL,  -- 顧客専用アクセスURL用トークン
  status TEXT NOT NULL DEFAULT 'inquiry',  -- inquiry(見込み), consulting(相談中), preparing(書類準備中), applying(申請中), completed(完了), cancelled(キャンセル)
  assigned_staff TEXT,  -- 担当スタッフ名
  notes TEXT,  -- メモ
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 書類テーブル
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  document_type TEXT NOT NULL,  -- 書類の種類（登記簿謄本、決算書、etc）
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,  -- R2のパス
  file_size INTEGER,
  uploaded_by TEXT NOT NULL,  -- 'client' or 'staff'
  status TEXT NOT NULL DEFAULT 'pending',  -- pending(未確認), approved(承認), rejected(差し戻し)
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- やり取り記録テーブル
CREATE TABLE IF NOT EXISTS communications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  sender_type TEXT NOT NULL,  -- 'client' or 'staff'
  sender_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 必要書類チェックリストテンプレート
CREATE TABLE IF NOT EXISTS document_checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_type TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_clients_access_token ON clients(access_token);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_communications_client_id ON communications(client_id);

-- 初期データ：必要書類チェックリスト
INSERT INTO document_checklist (document_type, description, display_order) VALUES
  ('登記簿謄本', '3ヶ月以内に発行されたもの', 1),
  ('決算書', '直近2期分', 2),
  ('労働保険概算・確定保険料申告書', '最新のもの', 3),
  ('賃金台帳', '直近3ヶ月分', 4),
  ('出勤簿', '直近3ヶ月分', 5),
  ('就業規則', '最新版', 6);
