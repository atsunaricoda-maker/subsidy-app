-- パイプラインテンプレート管理用テーブル
-- Phase 1: パイプラインテンプレートとタスク管理

-- パイプラインテンプレート
CREATE TABLE IF NOT EXISTS pipeline_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general', -- 'subsidy' (補助金), 'grant' (助成金), 'general'
    service_start_offset INTEGER DEFAULT 0, -- サービス開始日オフセット（申請日からの日数）
    service_end_offset INTEGER DEFAULT 30, -- サービス終了日オフセット（申請日からの日数）
    is_active INTEGER DEFAULT 1,
    requires_approval INTEGER DEFAULT 0, -- 承認が必要か
    allow_external_tasks INTEGER DEFAULT 0, -- 外部タスクを許可するか
    progress_reflection INTEGER DEFAULT 1, -- 進捗を反映するか
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- パイプラインテンプレートのタスク
CREATE TABLE IF NOT EXISTS pipeline_template_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    task_name TEXT NOT NULL,
    task_type TEXT DEFAULT 'internal', -- 'internal' (自社), 'external' (顧客), 'both'
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    days_offset_start INTEGER DEFAULT 0, -- タスク開始日オフセット（サービス開始日からの日数）
    days_offset_end INTEGER DEFAULT 7, -- タスク終了日オフセット（サービス開始日からの日数）
    is_required INTEGER DEFAULT 1, -- 必須タスクか
    default_assignee_role TEXT, -- デフォルトの担当者ロール
    notification_settings TEXT, -- 通知設定 (JSON)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES pipeline_templates(id) ON DELETE CASCADE
);

-- クライアントに適用されたパイプライン
CREATE TABLE IF NOT EXISTS client_pipelines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    template_id INTEGER,
    pipeline_name TEXT NOT NULL,
    service_start_date DATE,
    service_end_date DATE,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused', 'cancelled'
    progress_percentage INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES pipeline_templates(id)
);

-- クライアントパイプラインのタスク
CREATE TABLE IF NOT EXISTS client_pipeline_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pipeline_id INTEGER NOT NULL,
    template_task_id INTEGER,
    task_name TEXT NOT NULL,
    task_type TEXT DEFAULT 'internal', -- 'internal', 'external', 'both'
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'skipped'
    progress_percentage INTEGER DEFAULT 0,
    assigned_to INTEGER,
    assigned_to_name TEXT,
    completed_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pipeline_id) REFERENCES client_pipelines(id) ON DELETE CASCADE,
    FOREIGN KEY (template_task_id) REFERENCES pipeline_template_tasks(id),
    FOREIGN KEY (assigned_to) REFERENCES admin_users(id)
);

-- タスク履歴（進捗変更履歴）
CREATE TABLE IF NOT EXISTS task_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT,
    old_progress INTEGER,
    new_progress INTEGER,
    changed_by TEXT,
    change_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES client_pipeline_tasks(id) ON DELETE CASCADE
);

-- お知らせ管理
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- 'info', 'warning', 'urgent', 'maintenance'
    target_type TEXT DEFAULT 'all', -- 'all', 'client', 'admin', 'specific'
    target_ids TEXT, -- 特定顧客IDのカンマ区切りリスト
    is_active INTEGER DEFAULT 1,
    start_date DATETIME,
    end_date DATETIME,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- お知らせの既読管理
CREATE TABLE IF NOT EXISTS announcement_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    announcement_id INTEGER NOT NULL,
    client_id INTEGER,
    admin_user_id INTEGER,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

-- 顧客追加設定フィールド（手付金、源泉徴収など）
-- clients テーブルに追加カラム
ALTER TABLE clients ADD COLUMN deposit_required INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN deposit_amount INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN deposit_paid INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN deposit_paid_at DATETIME;
ALTER TABLE clients ADD COLUMN deposit_payment_method TEXT;
ALTER TABLE clients ADD COLUMN withholding_tax INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN contract_url TEXT;
ALTER TABLE clients ADD COLUMN privacy_policy_agreed INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN privacy_policy_agreed_at DATETIME;

-- サンプルパイプラインテンプレート（IT導入補助金用）
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, requires_approval, progress_reflection) 
VALUES 
('IT導入補助金 標準パイプライン', 'IT導入補助金申請の標準的なワークフロー', 'subsidy', 0, 60, 1, 1),
('キャリアアップ助成金 標準パイプライン', 'キャリアアップ助成金申請の標準ワークフロー', 'grant', 0, 90, 1, 1),
('補助金申請 簡易パイプライン', '小規模な補助金申請向けの簡易ワークフロー', 'subsidy', 0, 30, 0, 1);

-- IT導入補助金用タスク
INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required) 
VALUES 
(1, '登記簿謄本の確認', 'external', '最新の登記簿謄本をアップロードしてください', 1, 0, 7, 1),
(1, '財務諸表の提出', 'external', '直近2期分の決算書をアップロードしてください', 2, 0, 7, 1),
(1, '申請資格の確認', 'internal', '登記簿謄本・財務諸表から申請資格を確認', 3, 7, 14, 1),
(1, 'ヒアリングシート回答', 'external', '事業計画に関するヒアリングシートに回答', 4, 7, 21, 1),
(1, '事業計画書作成', 'internal', 'ヒアリング内容を基に事業計画書を作成', 5, 21, 35, 1),
(1, '見積書取得', 'external', 'ITツール導入業者から見積書を取得', 6, 14, 28, 1),
(1, '申請書類レビュー', 'internal', '申請書類一式の最終確認', 7, 35, 42, 1),
(1, '電子申請', 'internal', 'jGrants等で電子申請を実行', 8, 42, 45, 1),
(1, '採択結果待ち', 'internal', '採択結果を待機（約1-2ヶ月）', 9, 45, 90, 0),
(1, '交付申請', 'internal', '採択後の交付申請手続き', 10, 90, 120, 1);

-- キャリアアップ助成金用タスク
INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required) 
VALUES 
(2, '労働保険確認', 'internal', '労働保険加入状況の確認', 1, 0, 3, 1),
(2, '就業規則確認', 'external', '現行の就業規則をアップロード', 2, 0, 7, 1),
(2, '給与台帳準備', 'external', '対象従業員の給与台帳を準備', 3, 0, 7, 1),
(2, 'キャリアアップ計画書作成', 'internal', '計画書の作成と提出', 4, 7, 14, 1),
(2, '計画認定待ち', 'internal', '労働局からの計画認定を待機', 5, 14, 30, 0),
(2, '正社員転換実施', 'external', '対象従業員の正社員転換手続き', 6, 30, 60, 1),
(2, '6ヶ月継続勤務確認', 'internal', '転換後6ヶ月の継続勤務を確認', 7, 60, 240, 1),
(2, '支給申請書類準備', 'internal', '支給申請に必要な書類を準備', 8, 240, 250, 1),
(2, '支給申請提出', 'internal', '労働局へ支給申請を提出', 9, 250, 255, 1);

-- 簡易パイプライン用タスク
INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required) 
VALUES 
(3, '必要書類の収集', 'external', '申請に必要な書類を収集', 1, 0, 7, 1),
(3, '申請書作成', 'internal', '申請書の作成', 2, 7, 14, 1),
(3, '申請提出', 'internal', '申請書の提出', 3, 14, 21, 1),
(3, '結果確認', 'internal', '審査結果の確認', 4, 21, 60, 0);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_pipeline_templates_category ON pipeline_templates(category);
CREATE INDEX IF NOT EXISTS idx_pipeline_template_tasks_template ON pipeline_template_tasks(template_id);
CREATE INDEX IF NOT EXISTS idx_client_pipelines_client ON client_pipelines(client_id);
CREATE INDEX IF NOT EXISTS idx_client_pipeline_tasks_pipeline ON client_pipeline_tasks(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON announcement_reads(announcement_id);
