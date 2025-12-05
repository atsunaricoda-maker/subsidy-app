-- =============================================
-- 0016_case_management.sql
-- 案件管理機能の拡張
-- =============================================

-- 成果報酬関連カラムを追加
ALTER TABLE clients ADD COLUMN success_fee_enabled INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN success_fee_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN application_deadline DATE;

-- 許認可申請カテゴリを追加
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('建設業許可', '建設業を営むために必要な許可申請', '許認可'),
('宅建業免許', '宅地建物取引業を営むために必要な免許申請', '許認可'),
('産業廃棄物収集運搬業許可', '産業廃棄物の収集運搬を行うために必要な許可', '許認可'),
('飲食店営業許可', '飲食店を開業するために必要な許可', '許認可'),
('古物商許可', '中古品の売買を行うために必要な許可', '許認可'),
('旅館業許可', '旅館やホテルを営業するために必要な許可', '許認可'),
('介護事業指定申請', '介護保険サービス事業を行うための指定申請', '許認可'),
('運送業許可', '一般貨物自動車運送事業の許可申請', '許認可');

-- インデックス
CREATE INDEX IF NOT EXISTS idx_clients_deadline ON clients(application_deadline);
CREATE INDEX IF NOT EXISTS idx_clients_success_fee ON clients(success_fee_enabled);
