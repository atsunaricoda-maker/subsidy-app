-- 成功報酬の支払い追跡フィールドを追加
ALTER TABLE cases ADD COLUMN success_fee_paid INTEGER DEFAULT 0;
ALTER TABLE cases ADD COLUMN success_fee_paid_at TEXT;
ALTER TABLE cases ADD COLUMN success_fee_transfer_reported INTEGER DEFAULT 0;
ALTER TABLE cases ADD COLUMN success_fee_transfer_reported_at TEXT;
