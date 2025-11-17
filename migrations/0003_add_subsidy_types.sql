-- 助成金種別テーブル
CREATE TABLE IF NOT EXISTS subsidy_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- IT系、雇用系、設備投資系など
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 助成金種別ごとの必要書類テーブル（中間テーブル）
CREATE TABLE IF NOT EXISTS subsidy_type_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_type_id INTEGER NOT NULL,
  document_type TEXT NOT NULL,
  description TEXT,
  is_required INTEGER DEFAULT 1,  -- 必須=1、任意=0
  display_order INTEGER DEFAULT 0,
  FOREIGN KEY (subsidy_type_id) REFERENCES subsidy_types(id) ON DELETE CASCADE
);

-- clientsテーブルに助成金種別IDを追加
ALTER TABLE clients ADD COLUMN subsidy_type_id INTEGER;

-- サンプル助成金種別データ
INSERT INTO subsidy_types (name, description, category) VALUES
  ('IT導入補助金', 'ITツール導入の費用を補助', 'IT系'),
  ('ものづくり補助金', '革新的な製品・サービス開発を支援', '設備投資系'),
  ('キャリアアップ助成金', '非正規雇用労働者のキャリアアップを支援', '雇用系'),
  ('雇用調整助成金', '経済上の理由により事業活動の縮小を余儀なくされた事業主を支援', '雇用系'),
  ('小規模事業者持続化補助金', '小規模事業者の販路開拓等を支援', '一般');

-- IT導入補助金の必要書類
INSERT INTO subsidy_type_documents (subsidy_type_id, document_type, description, display_order) VALUES
  (1, '登記簿謄本', '3ヶ月以内に発行されたもの', 1),
  (1, '決算書', '直近2期分', 2),
  (1, 'ITツール見積書', 'ベンダーからの見積書', 3),
  (1, 'IT導入計画書', '導入するITツールと効果', 4),
  (1, '経営計画書', '今後3年間の計画', 5);

-- ものづくり補助金の必要書類
INSERT INTO subsidy_type_documents (subsidy_type_id, document_type, description, display_order) VALUES
  (2, '登記簿謄本', '3ヶ月以内に発行されたもの', 1),
  (2, '決算書', '直近2期分', 2),
  (2, '事業計画書', '革新的な取り組み内容', 3),
  (2, '設備投資計画書', '導入する機械設備の詳細', 4),
  (2, '見積書', '設備の見積書', 5),
  (2, '技術資料', '技術的な裏付け資料', 6);

-- キャリアアップ助成金の必要書類
INSERT INTO subsidy_type_documents (subsidy_type_id, document_type, description, display_order) VALUES
  (3, '登記簿謄本', '3ヶ月以内に発行されたもの', 1),
  (3, '就業規則', '最新版', 2),
  (3, '賃金台帳', '直近3ヶ月分', 3),
  (3, '出勤簿', '直近3ヶ月分', 4),
  (3, '労働条件通知書', '対象労働者分', 5),
  (3, 'キャリアアップ計画書', '訓練計画等', 6);

-- 雇用調整助成金の必要書類
INSERT INTO subsidy_type_documents (subsidy_type_id, document_type, description, display_order) VALUES
  (4, '登記簿謄本', '3ヶ月以内に発行されたもの', 1),
  (4, '決算書', '直近1期分', 2),
  (4, '休業計画書', '休業の予定', 3),
  (4, '労働者名簿', '全従業員分', 4),
  (4, '賃金台帳', '直近3ヶ月分', 5),
  (4, '出勤簿', '直近3ヶ月分', 6);

-- 小規模事業者持続化補助金の必要書類
INSERT INTO subsidy_type_documents (subsidy_type_id, document_type, description, display_order) VALUES
  (5, '登記簿謄本', '3ヶ月以内に発行されたもの', 1),
  (5, '決算書', '直近1期分', 2),
  (5, '経営計画書', '販路開拓の計画', 3),
  (5, '補助事業計画書', '取り組み内容の詳細', 4),
  (5, '見積書', '経費の見積書', 5);

-- 既存顧客にデフォルトでIT導入補助金を設定（任意）
-- UPDATE clients SET subsidy_type_id = 1 WHERE subsidy_type_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_subsidy_type_documents ON subsidy_type_documents(subsidy_type_id);
CREATE INDEX IF NOT EXISTS idx_clients_subsidy_type ON clients(subsidy_type_id);
