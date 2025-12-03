-- =====================================================
-- 公募要領管理システム拡張
-- =====================================================

-- 1. 公募要領の詳細情報テーブル
CREATE TABLE IF NOT EXISTS subsidy_guidelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_type_id INTEGER NOT NULL,
  
  -- 基本情報
  fiscal_year TEXT,                    -- 年度（例: "令和6年度"）
  version TEXT,                        -- バージョン（例: "第1次公募"）
  
  -- 申請期間
  application_start_date TEXT,         -- 申請開始日
  application_end_date TEXT,           -- 申請締切日
  
  -- 補助金額
  max_amount INTEGER,                  -- 上限額（円）
  min_amount INTEGER,                  -- 下限額（円）
  subsidy_rate TEXT,                   -- 補助率（例: "1/2", "2/3"）
  
  -- 要件（JSON形式で柔軟に保存）
  eligibility_requirements TEXT,       -- 申請資格要件（JSON）
  target_expenses TEXT,                -- 補助対象経費（JSON）
  
  -- 申請書の構成
  document_sections TEXT,              -- 申請書のセクション構成（JSON）
  character_limits TEXT,               -- 各セクションの文字数制限（JSON）
  
  -- ステータス
  status TEXT DEFAULT 'active',        -- active, expired, upcoming
  
  -- 元データ
  source_url TEXT,                     -- 公式サイトURL
  pdf_url TEXT,                        -- 公募要領PDFのURL
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (subsidy_type_id) REFERENCES subsidy_types(id) ON DELETE CASCADE
);

-- 2. 監視対象URL管理テーブル
CREATE TABLE IF NOT EXISTS subsidy_watch_urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_type_id INTEGER NOT NULL,
  
  url TEXT NOT NULL,                   -- 監視対象URL
  url_type TEXT DEFAULT 'page',        -- page, pdf, api
  description TEXT,                    -- 説明（例: "IT導入補助金 公式サイト"）
  
  -- 前回チェック時の状態
  last_checked_at DATETIME,            -- 最終チェック日時
  last_content_hash TEXT,              -- ページ内容のハッシュ値
  last_modified_date TEXT,             -- Last-Modifiedヘッダー値
  last_pdf_filename TEXT,              -- 最新PDFファイル名
  
  is_active INTEGER DEFAULT 1,         -- 監視有効/無効
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (subsidy_type_id) REFERENCES subsidy_types(id) ON DELETE CASCADE
);

-- 3. 更新検知履歴テーブル
CREATE TABLE IF NOT EXISTS subsidy_update_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_url_id INTEGER NOT NULL,
  subsidy_type_id INTEGER NOT NULL,
  
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 検知日時
  change_type TEXT,                    -- new_pdf, content_change, new_version
  change_summary TEXT,                 -- 変更概要（AI生成）
  
  old_value TEXT,                      -- 変更前の値
  new_value TEXT,                      -- 変更後の値
  
  -- 対応状況
  status TEXT DEFAULT 'pending',       -- pending, reviewed, applied, ignored
  reviewed_by TEXT,                    -- 確認した管理者
  reviewed_at DATETIME,                -- 確認日時
  notes TEXT,                          -- メモ
  
  FOREIGN KEY (watch_url_id) REFERENCES subsidy_watch_urls(id) ON DELETE CASCADE,
  FOREIGN KEY (subsidy_type_id) REFERENCES subsidy_types(id) ON DELETE CASCADE
);

-- 4. 管理者への通知テーブル
CREATE TABLE IF NOT EXISTS admin_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  notification_type TEXT NOT NULL,     -- subsidy_update, system, etc
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  related_id INTEGER,                  -- 関連するレコードID
  related_table TEXT,                  -- 関連テーブル名
  
  is_read INTEGER DEFAULT 0,           -- 既読フラグ
  read_by TEXT,
  read_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_guidelines_subsidy_type ON subsidy_guidelines(subsidy_type_id);
CREATE INDEX IF NOT EXISTS idx_guidelines_status ON subsidy_guidelines(status);
CREATE INDEX IF NOT EXISTS idx_watch_urls_subsidy_type ON subsidy_watch_urls(subsidy_type_id);
CREATE INDEX IF NOT EXISTS idx_watch_urls_active ON subsidy_watch_urls(is_active);
CREATE INDEX IF NOT EXISTS idx_update_logs_status ON subsidy_update_logs(status);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON admin_notifications(is_read);

-- =====================================================
-- 初期データ: 主要補助金の監視URL
-- =====================================================

-- IT導入補助金
INSERT INTO subsidy_watch_urls (subsidy_type_id, url, url_type, description) VALUES
  (1, 'https://it-shien.smrj.go.jp/', 'page', 'IT導入補助金 公式サイト'),
  (1, 'https://it-shien.smrj.go.jp/applicant/', 'page', 'IT導入補助金 申請者向けページ');

-- ものづくり補助金
INSERT INTO subsidy_watch_urls (subsidy_type_id, url, url_type, description) VALUES
  (2, 'https://portal.monodukuri-hojo.jp/', 'page', 'ものづくり補助金 ポータルサイト');

-- キャリアアップ助成金
INSERT INTO subsidy_watch_urls (subsidy_type_id, url, url_type, description) VALUES
  (3, 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html', 'page', 'キャリアアップ助成金 厚労省ページ');

-- 雇用調整助成金
INSERT INTO subsidy_watch_urls (subsidy_type_id, url, url_type, description) VALUES
  (4, 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/pageL07.html', 'page', '雇用調整助成金 厚労省ページ');

-- 小規模事業者持続化補助金
INSERT INTO subsidy_watch_urls (subsidy_type_id, url, url_type, description) VALUES
  (5, 'https://r3.jizokukahojokin.info/', 'page', '持続化補助金 公式サイト');

