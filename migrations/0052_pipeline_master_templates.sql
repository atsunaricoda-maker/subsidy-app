-- パイプラインテンプレートのマスターテンプレート対応
-- マスター管理でパイプラインを中央管理し、組織は閲覧・複製のみ可能にする
-- 注: parent_id, display_order は既存のため追加しない

-- マスターテンプレートフラグを追加
ALTER TABLE pipeline_templates ADD COLUMN is_master_template INTEGER DEFAULT 0;

-- 組織ID（組織ごとのテンプレート管理用、NULLならマスターテンプレート）
ALTER TABLE pipeline_templates ADD COLUMN organization_id INTEGER REFERENCES organizations(id);

-- 複製元テンプレートID（マスターから複製した場合の参照）
ALTER TABLE pipeline_templates ADD COLUMN copied_from_template_id INTEGER REFERENCES pipeline_templates(id);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_master ON pipeline_templates(is_master_template);
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_org ON pipeline_templates(organization_id);

-- 既存のテンプレートをマスターテンプレートに変換（組織IDがない既存のものはマスターとして扱う）
UPDATE pipeline_templates SET is_master_template = 1 WHERE organization_id IS NULL;
