-- 業務範囲カラムを追加（labor: 社労士, administrative: 行政書士, both: 両方）
-- 注: business_typeは既存カラム（office等）、business_scopeが新規

-- organizationsテーブルにbusiness_scopeカラム追加
ALTER TABLE organizations ADD COLUMN business_scope TEXT DEFAULT 'labor';

-- 追加オプション料金管理テーブル
CREATE TABLE IF NOT EXISTS organization_addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    addon_type TEXT NOT NULL, -- 'dual_scope' (両方利用)
    price INTEGER NOT NULL DEFAULT 2000, -- 追加料金
    status TEXT DEFAULT 'active', -- 'active', 'cancelled'
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    cancelled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- subsidy_typesにcategoryカラムを追加（助成金/補助金/許認可の区別）
-- カラムが既に存在する場合はスキップ（SQLiteにはIF NOT EXISTSがないため、エラーを無視）
-- ALTER TABLE subsidy_types ADD COLUMN category TEXT DEFAULT 'subsidy';
-- category: 'subsidy' (助成金・社労士), 'grant' (補助金・行政書士), 'license' (許認可・行政書士)

-- subsidy_guidelinesにもcategoryを追加
-- ALTER TABLE subsidy_guidelines ADD COLUMN category TEXT DEFAULT 'subsidy';
