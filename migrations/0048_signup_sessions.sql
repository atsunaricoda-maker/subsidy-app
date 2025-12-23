-- 新規登録セッションテーブル（Stripe決済完了後の情報引継ぎ用）
CREATE TABLE IF NOT EXISTS signup_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,         -- Stripe Session ID
    organization_id INTEGER,                  -- 作成された組織ID
    slug TEXT NOT NULL,                       -- サブドメイン
    email TEXT NOT NULL,                      -- メールアドレス
    username TEXT NOT NULL,                   -- 生成されたユーザー名
    initial_password TEXT NOT NULL,           -- 初期パスワード
    is_used INTEGER DEFAULT 0,                -- 使用済みフラグ
    created_at TEXT DEFAULT (datetime('now')),
    used_at TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_signup_sessions_session_id ON signup_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_signup_sessions_slug ON signup_sessions(slug);
