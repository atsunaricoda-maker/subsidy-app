-- 担当者管理の改善
-- assigned_staff（表示名）からassigned_to（username）に変更

-- 新しいカラム追加
ALTER TABLE clients ADD COLUMN assigned_to TEXT;

-- 既存のassigned_staffからassigned_toにデータ移行は不要
-- （既存データは表示名なのでusernameと一致しないため）

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON clients(assigned_to);

-- admin_usersテーブルにroleカラム追加（将来の拡張用）
ALTER TABLE admin_users ADD COLUMN role TEXT DEFAULT 'staff';

-- 既存のadminユーザーをadminロールに設定
UPDATE admin_users SET role = 'admin' WHERE id = 1;
