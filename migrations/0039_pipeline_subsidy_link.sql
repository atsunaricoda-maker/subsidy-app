-- パイプラインテンプレートと申請種別の紐付け
-- 申請種別ごとにデフォルトのパイプラインを設定できるようにする

-- pipeline_templatesテーブルにsubsidy_type_idカラムを追加
ALTER TABLE pipeline_templates ADD COLUMN subsidy_type_id INTEGER REFERENCES subsidy_types(id);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_subsidy ON pipeline_templates(subsidy_type_id);
