-- 管理者ユーザーテーブル
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- デフォルト管理者（パスワード: admin123）
INSERT INTO admin_users (username, password_hash, name) VALUES
  ('admin', 'admin123', '管理者');

CREATE INDEX IF NOT EXISTS idx_admin_username ON admin_users(username);
