-- サイト設定テーブル（法的表記等）
CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'text', -- text, html, json
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT
);

-- 初期データ: 事業者情報
INSERT OR IGNORE INTO site_settings (setting_key, setting_value, setting_type, description) VALUES
('company_name', '', 'text', '事業者名（法人名/屋号）'),
('company_name_kana', '', 'text', '事業者名（フリガナ）'),
('representative_name', '', 'text', '代表者名'),
('postal_code', '', 'text', '郵便番号'),
('address', '', 'text', '所在地'),
('phone', '', 'text', '電話番号'),
('email', '', 'text', 'メールアドレス'),
('business_hours', '平日 9:00〜18:00', 'text', '営業時間'),
('registration_number', '', 'text', '適格請求書発行事業者登録番号');

-- 初期データ: 振込先情報
INSERT OR IGNORE INTO site_settings (setting_key, setting_value, setting_type, description) VALUES
('bank_name', '', 'text', '銀行名'),
('bank_branch', '', 'text', '支店名'),
('bank_account_type', '普通', 'text', '口座種別'),
('bank_account_number', '', 'text', '口座番号'),
('bank_account_holder', '', 'text', '口座名義');

-- 初期データ: 特定商取引法表記
INSERT OR IGNORE INTO site_settings (setting_key, setting_value, setting_type, description) VALUES
('legal_price_info', 'サービス料金は各プランページに記載の通りです。表示価格は税込みです。', 'text', '販売価格について'),
('legal_payment_method', 'クレジットカード決済、銀行振込', 'text', '支払方法'),
('legal_payment_timing', 'クレジットカード：お申込み時に決済 / 銀行振込：請求書発行後14日以内', 'text', '支払時期'),
('legal_service_start', 'お申込み手続き完了後、即時ご利用いただけます。', 'text', 'サービス提供時期'),
('legal_cancel_policy', '月額プランは解約申請月の末日までご利用可能です。日割り返金は行っておりません。', 'text', '返品・キャンセルについて'),
('legal_additional_cost', '別途通信費等がかかる場合があります。', 'text', '追加費用について');

-- 初期データ: 利用規約・プライバシーポリシー
INSERT OR IGNORE INTO site_settings (setting_key, setting_value, setting_type, description) VALUES
('terms_of_service', '', 'html', '利用規約（HTML）'),
('privacy_policy', '', 'html', 'プライバシーポリシー（HTML）'),
('terms_updated_at', '', 'text', '利用規約最終更新日'),
('privacy_updated_at', '', 'text', 'プライバシーポリシー最終更新日');

-- 初期データ: サイト基本情報
INSERT OR IGNORE INTO site_settings (setting_key, setting_value, setting_type, description) VALUES
('site_name', '申請革命', 'text', 'サービス名'),
('site_description', '補助金・助成金・許認可申請を効率化するクラウドサービス', 'text', 'サービス説明'),
('site_url', 'https://subsidy-app.pages.dev', 'text', 'サイトURL'),
('copyright_year', '2024', 'text', 'コピーライト開始年');
