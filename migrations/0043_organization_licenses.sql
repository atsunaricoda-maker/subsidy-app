-- 組織テーブルに資格情報カラムを追加
-- 行政書士法・社労士法に準拠した業務範囲管理

-- 資格情報カラム
ALTER TABLE organizations ADD COLUMN gyoseishoshi_license_number TEXT;
ALTER TABLE organizations ADD COLUMN gyoseishoshi_license_name TEXT;
ALTER TABLE organizations ADD COLUMN gyoseishoshi_registered_at TEXT;

ALTER TABLE organizations ADD COLUMN sharoshi_license_number TEXT;
ALTER TABLE organizations ADD COLUMN sharoshi_license_name TEXT;
ALTER TABLE organizations ADD COLUMN sharoshi_registered_at TEXT;

-- 業務範囲設定
-- 'licensed_full': 資格者が代行作成可能
-- 'client_self': 顧客が自己作成（AIアドバイスのみ）
-- 'both': 案件ごとに選択可能
ALTER TABLE organizations ADD COLUMN document_creation_mode TEXT DEFAULT 'client_self';

-- 資格確認済みフラグ（管理者が確認した場合にtrue）
ALTER TABLE organizations ADD COLUMN license_verified INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN license_verified_at TEXT;
ALTER TABLE organizations ADD COLUMN license_verified_by TEXT;

-- 法的免責事項への同意
ALTER TABLE organizations ADD COLUMN legal_disclaimer_agreed INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN legal_disclaimer_agreed_at TEXT;

-- 顧客向け書類作成同意テーブル
CREATE TABLE IF NOT EXISTS client_document_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    case_id INTEGER,
    consent_type TEXT NOT NULL, -- 'self_creation': 自己作成同意, 'proxy_creation': 代行作成同意
    consent_text TEXT NOT NULL, -- 同意した免責事項の全文
    ip_address TEXT,
    user_agent TEXT,
    consented_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (case_id) REFERENCES cases(id)
);

-- 生成書類テーブル（既存のgenerated_documentsを拡張）
-- 誰が作成したか（staff/client）、資格者作成かどうかを記録
ALTER TABLE generated_documents ADD COLUMN created_by_type TEXT DEFAULT 'staff'; -- 'staff' or 'client'
ALTER TABLE generated_documents ADD COLUMN is_licensed_creation INTEGER DEFAULT 0; -- 資格者による代行作成か
ALTER TABLE generated_documents ADD COLUMN client_consent_id INTEGER; -- 顧客同意への参照
