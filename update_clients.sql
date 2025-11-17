-- 既存顧客に助成金種別を設定
UPDATE clients SET subsidy_type_id = 1 WHERE id = 1;  -- 山田太郎 → IT導入補助金
UPDATE clients SET subsidy_type_id = 2 WHERE id = 2;  -- 鈴木花子 → ものづくり補助金
UPDATE clients SET subsidy_type_id = 3 WHERE id = 3;  -- 佐藤一郎 → キャリアアップ助成金
