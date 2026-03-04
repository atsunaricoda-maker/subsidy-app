ALTER TABLE admin_notifications ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
ALTER TABLE admin_notifications ADD COLUMN priority TEXT DEFAULT 'normal';
ALTER TABLE announcement_reads ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_org ON admin_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_org ON announcement_reads(organization_id);
