-- パイプラインテンプレートと申請種別の紐付け
-- subsidy_type_idsカラムを追加（JSON形式で複数のIDを保存可能）

-- パイプラインテンプレートに申請種別IDリストカラムを追加
ALTER TABLE pipeline_templates ADD COLUMN subsidy_type_ids TEXT DEFAULT NULL;

-- 既存のパイプラインテンプレートに申請種別を紐付け（カテゴリベースで自動設定）
-- 補助金系（subsidy）のパイプライン → 行政書士管轄の申請種別
-- 助成金系（grant）のパイプライン → 社労士管轄の申請種別
-- 許認可系（license）のパイプライン → 許認可申請種別

-- Note: 実際の紐付けは管理画面から手動で行うため、デフォルトは空のまま
