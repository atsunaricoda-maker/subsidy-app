-- =====================================================
-- admin_notifications と announcement_reads に
-- organization_id カラムを追加（不足していたカラム）
-- =====================================================

-- admin_notifications に organization_id カラムを追加
-- 複数のAPIで通知作成時に organization_id を使用しているが
-- テーブル定義にカラムが存在しなかった
ALTER TABLE admin_notifications ADD COLUMN organization_id INTEGER REFERENCES organizations(id);

-- admin_notifications に priority カラムを追加
-- cron.ts等で priority を使用しているが定義なし
ALTER TABLE admin_notifications ADD COLUMN priority TEXT DEFAULT 'normal';

-- announcement_reads に organization_id カラムを追加
-- 組織ごとのお知らせ既読管理で必要
ALTER TABLE announcement_reads ADD COLUMN organization_id INTEGER REFERENCES organizations(id);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_admin_notifications_org ON admin_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_org ON announcement_reads(organization_id);
