-- 申請金額・採択金額カラムを追加
ALTER TABLE cases ADD COLUMN applied_amount INTEGER DEFAULT 0;  -- 申請金額
ALTER TABLE cases ADD COLUMN granted_amount INTEGER DEFAULT 0;  -- 採択金額
ALTER TABLE cases ADD COLUMN granted_at DATETIME;  -- 採択日
