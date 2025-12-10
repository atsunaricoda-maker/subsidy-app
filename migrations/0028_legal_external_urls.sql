-- =====================================================
-- 法務設定に外部URL設定を追加
-- 既存HPがある場合はそのURLにリンク、ない場合は内部ページを使用
-- =====================================================

-- プライバシーポリシーの外部URL
INSERT OR IGNORE INTO site_settings (setting_key, setting_value, setting_type, description)
VALUES ('privacy_policy_url', '', 'url', '既存HPのプライバシーポリシーURL（空欄の場合は内部ページを使用）');

-- 利用規約の外部URL
INSERT OR IGNORE INTO site_settings (setting_key, setting_value, setting_type, description)
VALUES ('terms_url', '', 'url', '既存HPの利用規約URL（空欄の場合は内部ページを使用）');

-- 特定商取引法に基づく表記の外部URL
INSERT OR IGNORE INTO site_settings (setting_key, setting_value, setting_type, description)
VALUES ('legal_notice_url', '', 'url', '既存HPの特定商取引法表記URL（空欄の場合は内部ページを使用）');

-- 会社HPのURL（トップページ）
INSERT OR IGNORE INTO site_settings (setting_key, setting_value, setting_type, description)
VALUES ('company_website_url', '', 'url', '会社・事務所のホームページURL');
