-- Master settings table for platform-level configuration
-- Used for platform legal pages (/master/legal, /master/terms, /master/privacy-policy)

CREATE TABLE IF NOT EXISTS master_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'text',
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default platform business information
INSERT INTO master_settings (setting_key, setting_value, setting_type, description) VALUES
    ('platform_company_name', '申請らくらく君 運営事務局', 'text', 'プラットフォーム運営会社名'),
    ('platform_representative', '', 'text', '代表者名'),
    ('platform_postal_code', '', 'text', '郵便番号'),
    ('platform_address', '', 'text', '所在地'),
    ('platform_phone', '', 'text', '電話番号'),
    ('platform_email', 'support@shinsei-raku.com', 'text', 'メールアドレス'),
    ('platform_business_hours', '平日 10:00〜18:00（土日祝・年末年始を除く）', 'text', '営業時間'),
    ('platform_invoice_number', '', 'text', '適格請求書発行事業者登録番号');
