-- パイプラインタスクテンプレートに添付ファイル機能を追加

-- pipeline_template_tasks テーブルに添付ファイル関連カラムを追加
ALTER TABLE pipeline_template_tasks ADD COLUMN attachment_url TEXT;
ALTER TABLE pipeline_template_tasks ADD COLUMN attachment_name TEXT;

-- client_pipeline_tasks テーブルにも添付ファイル関連カラムを追加
ALTER TABLE client_pipeline_tasks ADD COLUMN attachment_url TEXT;
ALTER TABLE client_pipeline_tasks ADD COLUMN attachment_name TEXT;
