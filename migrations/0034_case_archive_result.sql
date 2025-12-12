-- 案件のアーカイブ機能と採択/不採択結果の追加
-- 作成日: 2024-12-12

-- 案件にアーカイブフラグを追加
ALTER TABLE cases ADD COLUMN is_archived INTEGER DEFAULT 0;

-- 案件に結果（採択/不採択）フィールドを追加
-- result: 'approved'(採択), 'rejected'(不採択), NULL(未確定)
ALTER TABLE cases ADD COLUMN result TEXT;

-- 採択金額（実際に採択された金額）
ALTER TABLE cases ADD COLUMN approved_amount INTEGER;

-- 結果確定日
ALTER TABLE cases ADD COLUMN result_date DATE;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_cases_is_archived ON cases(is_archived);
CREATE INDEX IF NOT EXISTS idx_cases_result ON cases(result);
