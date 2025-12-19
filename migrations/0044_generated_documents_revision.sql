-- 生成書類テーブルに修正依頼関連カラムを追加
ALTER TABLE generated_documents ADD COLUMN revision_comment TEXT;
ALTER TABLE generated_documents ADD COLUMN document_type TEXT;
ALTER TABLE generated_documents ADD COLUMN file_path TEXT;
ALTER TABLE generated_documents ADD COLUMN content TEXT;
