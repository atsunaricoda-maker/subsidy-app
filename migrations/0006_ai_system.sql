-- =====================================================
-- AIアシスタントシステム拡張
-- フェーズ1-3: ヒアリング、文書生成、編集機能
-- =====================================================

-- ===============================
-- 1. ヒアリング質問テンプレート
-- ===============================

-- 補助金ごとのヒアリング質問マスタ
CREATE TABLE IF NOT EXISTS hearing_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_type_id INTEGER NOT NULL,
  
  question_key TEXT NOT NULL,           -- 質問の識別キー（例: company_overview, business_plan）
  question_text TEXT NOT NULL,          -- 質問文
  question_type TEXT DEFAULT 'text',    -- text, textarea, select, number, date
  options TEXT,                         -- selectの場合の選択肢（JSON）
  
  category TEXT,                        -- 質問カテゴリ（企業情報, 事業計画, 設備投資 等）
  is_required INTEGER DEFAULT 1,        -- 必須質問か
  display_order INTEGER DEFAULT 0,      -- 表示順序
  
  help_text TEXT,                       -- 入力のヒント・説明
  example_answer TEXT,                  -- 回答例
  
  -- 申請書のどのセクションに対応するか
  document_section TEXT,                -- 対応する申請書セクション
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (subsidy_type_id) REFERENCES subsidy_types(id) ON DELETE CASCADE
);

-- 顧客ごとのヒアリング回答
CREATE TABLE IF NOT EXISTS hearing_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  
  answer_text TEXT,                     -- 回答内容
  answer_json TEXT,                     -- 複雑な回答（JSON）
  
  -- AIによる分析結果
  ai_analysis TEXT,                     -- AIによる回答の分析・強みの抽出
  ai_suggestions TEXT,                  -- AIからの改善提案
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES hearing_questions(id) ON DELETE CASCADE
);

-- AIチャット履歴
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  
  role TEXT NOT NULL,                   -- user, assistant, system
  content TEXT NOT NULL,                -- メッセージ内容
  
  -- メタデータ
  context_type TEXT,                    -- hearing, document_generation, general
  related_question_id INTEGER,          -- 関連するヒアリング質問
  
  -- AIの分析結果（assistantの場合）
  extracted_info TEXT,                  -- 抽出された情報（JSON）
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- ===============================
-- 2. 文書テンプレート管理
-- ===============================

-- 申請書テンプレート
CREATE TABLE IF NOT EXISTS document_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_type_id INTEGER NOT NULL,
  
  template_name TEXT NOT NULL,          -- テンプレート名
  template_version TEXT,                -- バージョン
  
  -- テンプレート構造（JSON）
  sections TEXT NOT NULL,               -- セクション構成
  -- 例: [{"id": "company_overview", "title": "企業概要", "max_chars": 1000}, ...]
  
  -- 生成設定
  ai_prompt_base TEXT,                  -- AI生成用の基本プロンプト
  
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (subsidy_type_id) REFERENCES subsidy_types(id) ON DELETE CASCADE
);

-- 生成された文書
CREATE TABLE IF NOT EXISTS generated_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  
  document_title TEXT NOT NULL,         -- 文書タイトル
  status TEXT DEFAULT 'draft',          -- draft, review, final
  
  -- 各セクションの内容（JSON）
  sections_content TEXT,                -- {"company_overview": "...", "business_plan": "..."}
  
  -- メタデータ
  ai_model_used TEXT,                   -- 使用したAIモデル
  generation_params TEXT,               -- 生成パラメータ（JSON）
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES document_templates(id)
);

-- 文書セクションの編集履歴
CREATE TABLE IF NOT EXISTS document_section_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  section_id TEXT NOT NULL,             -- セクションID
  
  previous_content TEXT,                -- 編集前の内容
  new_content TEXT NOT NULL,            -- 編集後の内容
  
  edit_type TEXT,                       -- manual, ai_regenerate, ai_suggestion
  editor_name TEXT,                     -- 編集者名
  editor_comment TEXT,                  -- コメント
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (document_id) REFERENCES generated_documents(id) ON DELETE CASCADE
);

-- ===============================
-- 3. 採択事例データベース
-- ===============================

CREATE TABLE IF NOT EXISTS success_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_type_id INTEGER NOT NULL,
  
  -- 企業情報
  company_industry TEXT,                -- 業種
  company_size TEXT,                    -- 企業規模（従業員数帯）
  company_region TEXT,                  -- 地域
  
  -- 申請情報
  fiscal_year TEXT,                     -- 申請年度
  application_amount INTEGER,           -- 申請額
  approved_amount INTEGER,              -- 採択額
  
  -- 成功のポイント（匿名化されたサマリー）
  success_summary TEXT,                 -- 採択のポイント要約
  key_factors TEXT,                     -- 成功要因（JSON）
  
  -- 申請書の構造的特徴（匿名化）
  document_structure_analysis TEXT,     -- 文書構造の分析（JSON）
  
  is_public INTEGER DEFAULT 0,          -- 公開可能か
  source TEXT,                          -- データソース
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (subsidy_type_id) REFERENCES subsidy_types(id) ON DELETE CASCADE
);

-- ===============================
-- 4. 補助金マッチング用データ
-- ===============================

-- 企業プロファイル（マッチング用）
CREATE TABLE IF NOT EXISTS client_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  
  -- 企業属性
  industry TEXT,                        -- 業種
  employee_count INTEGER,               -- 従業員数
  annual_revenue INTEGER,               -- 年商（万円）
  establishment_year INTEGER,           -- 設立年
  region TEXT,                          -- 所在地域
  
  -- 事業課題・ニーズ
  business_challenges TEXT,             -- 経営課題（JSON配列）
  investment_plans TEXT,                -- 投資計画（JSON配列）
  
  -- AIによる分析
  ai_profile_summary TEXT,              -- AIによるプロファイル要約
  recommended_subsidies TEXT,           -- 推奨補助金（JSON）
  
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 補助金適合性スコア
CREATE TABLE IF NOT EXISTS subsidy_match_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  subsidy_type_id INTEGER NOT NULL,
  
  match_score INTEGER,                  -- マッチングスコア（0-100）
  score_breakdown TEXT,                 -- スコア内訳（JSON）
  
  ai_recommendation TEXT,               -- AIからの推奨コメント
  adoption_probability INTEGER,         -- 採択可能性（%）
  
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (subsidy_type_id) REFERENCES subsidy_types(id) ON DELETE CASCADE,
  UNIQUE(client_id, subsidy_type_id)
);

-- ===============================
-- インデックス
-- ===============================

CREATE INDEX IF NOT EXISTS idx_hearing_questions_subsidy ON hearing_questions(subsidy_type_id);
CREATE INDEX IF NOT EXISTS idx_hearing_answers_client ON hearing_answers(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_client ON ai_chat_history(client_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_client ON generated_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_success_cases_subsidy ON success_cases(subsidy_type_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_client ON client_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_match_scores_client ON subsidy_match_scores(client_id);

-- ===============================
-- 初期データ: IT導入補助金のヒアリング質問
-- ===============================

INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, category, is_required, display_order, help_text, example_answer, document_section) VALUES
-- 企業基本情報
(1, 'company_overview', '御社の事業内容を教えてください', 'textarea', '企業情報', 1, 1, '主な事業、取扱製品・サービス、特徴などを具体的に記載してください', '当社は1985年創業の金属加工メーカーで、自動車部品の精密切削加工を主力事業としています。', 'company_overview'),
(1, 'employee_count', '従業員数を教えてください', 'number', '企業情報', 1, 2, '正社員・パート含めた総数', '25', 'company_overview'),
(1, 'annual_revenue', '直近の年商（売上高）を教えてください', 'number', '企業情報', 1, 3, '万円単位で入力してください', '35000', 'company_overview'),

-- 現状の課題
(1, 'current_issues', '現在の業務で困っていること・課題は何ですか？', 'textarea', '課題分析', 1, 10, '具体的な業務上の課題、非効率な点などを記載してください', '受発注業務が手作業で、FAXや電話での注文が多く、転記ミスや確認漏れが頻発している。', 'current_situation'),
(1, 'issue_impact', 'その課題によってどのような影響が出ていますか？', 'textarea', '課題分析', 1, 11, '時間的損失、コスト増、顧客への影響など', '月に約20時間の残業が発生し、年間で約50万円のコスト増となっている。', 'current_situation'),

-- IT導入計画
(1, 'target_it_tool', '導入を検討しているITツールの種類は？', 'select', 'IT計画', 1, 20, NULL, NULL, 'implementation_plan'),
(1, 'expected_effect', '導入後にどのような効果を期待していますか？', 'textarea', 'IT計画', 1, 21, '業務効率化、コスト削減、売上向上など具体的に', '受発注業務の自動化により、月20時間の残業削減と転記ミスゼロを目指す。', 'expected_results'),
(1, 'implementation_schedule', '導入スケジュールの希望はありますか？', 'text', 'IT計画', 0, 22, '○月までに導入したい等', '来年3月までに本稼働させたい', 'implementation_plan'),

-- 将来ビジョン
(1, 'future_vision', '3年後、5年後の御社のビジョンを教えてください', 'textarea', '将来計画', 1, 30, 'IT導入後の成長イメージ、目標など', 'デジタル化を進め、生産性を30%向上させ、新規顧客を20社獲得する。', 'future_plan');

-- IT導入補助金のヒアリング質問の選択肢
UPDATE hearing_questions SET options = '["受発注システム", "会計・財務システム", "顧客管理(CRM)", "生産管理システム", "在庫管理システム", "EC・オンライン販売", "テレワーク関連", "セキュリティ対策", "その他"]' 
WHERE question_key = 'target_it_tool' AND subsidy_type_id = 1;

-- ===============================
-- 初期データ: ものづくり補助金のヒアリング質問
-- ===============================

INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, category, is_required, display_order, help_text, example_answer, document_section) VALUES
-- 企業情報
(2, 'company_overview', '御社の事業内容と強みを教えてください', 'textarea', '企業情報', 1, 1, '創業からの歴史、主力製品、技術的な強みなど', '創業50年の精密部品メーカー。航空宇宙産業向けの高精度加工技術が強み。', 'company_overview'),
(2, 'company_strength', '他社と比較した御社の競争優位性は？', 'textarea', '企業情報', 1, 2, '独自技術、特許、顧客基盤など', '独自開発の5軸加工技術により、競合他社では対応できない複雑形状の加工が可能。', 'company_overview'),

-- 革新的な取り組み
(2, 'innovation_content', '今回の補助事業で取り組む革新的な内容は？', 'textarea', '事業計画', 1, 10, '新製品開発、新サービス、生産プロセスの革新など', 'AIを活用した品質検査システムの導入により、検査工程を自動化し不良品流出ゼロを実現する。', 'innovation_plan'),
(2, 'technical_challenge', '技術的な課題とその解決方法は？', 'textarea', '事業計画', 1, 11, '克服すべき技術課題と対策', '微細な傷の検出が課題。深層学習による画像認識技術を導入し解決する。', 'innovation_plan'),

-- 設備投資
(2, 'equipment_detail', '導入予定の設備・システムの詳細', 'textarea', '設備投資', 1, 20, '機械名、メーカー、スペック等', 'XX社製 AI外観検査システム Model-A（処理速度: 100個/分、検出精度: 99.9%）', 'equipment_plan'),
(2, 'investment_amount', '設備投資の総額（見込み）', 'number', '設備投資', 1, 21, '万円単位', '3500', 'equipment_plan'),

-- 事業効果
(2, 'productivity_improvement', '生産性向上の目標値', 'textarea', '期待効果', 1, 30, '付加価値額、生産性の向上率など具体的数値', '付加価値額を年間1,000万円増加、生産性を15%向上させる。', 'expected_results'),
(2, 'market_expansion', '販路拡大・新市場開拓の計画', 'textarea', '期待効果', 0, 31, '新規顧客、新市場への展開計画', '品質保証体制の強化により、医療機器市場への参入を目指す。', 'expected_results');

-- ===============================
-- 初期データ: 文書テンプレート
-- ===============================

INSERT INTO document_templates (subsidy_type_id, template_name, template_version, sections, ai_prompt_base) VALUES
(1, 'IT導入補助金 事業計画書', 'v2024', 
'[
  {"id": "company_overview", "title": "1. 企業概要", "max_chars": 1500, "description": "企業の基本情報、事業内容、沿革"},
  {"id": "current_situation", "title": "2. 現状の課題", "max_chars": 2000, "description": "業務上の課題、IT化の必要性"},
  {"id": "implementation_plan", "title": "3. IT導入計画", "max_chars": 2500, "description": "導入するITツール、導入スケジュール"},
  {"id": "expected_results", "title": "4. 導入効果", "max_chars": 2000, "description": "期待される効果、数値目標"},
  {"id": "future_plan", "title": "5. 将来展望", "max_chars": 1000, "description": "IT導入後の成長戦略"}
]',
'あなたは補助金申請書作成の専門家です。以下のヒアリング情報を基に、IT導入補助金の申請書セクションを作成してください。
審査員が納得できる具体的な数値と論理的な説明を含めてください。');

INSERT INTO document_templates (subsidy_type_id, template_name, template_version, sections, ai_prompt_base) VALUES
(2, 'ものづくり補助金 事業計画書', 'v2024',
'[
  {"id": "company_overview", "title": "1. 企業概要", "max_chars": 2000, "description": "企業の基本情報、強み、競争優位性"},
  {"id": "innovation_plan", "title": "2. 革新的な取り組み", "max_chars": 3000, "description": "新製品・サービス開発、革新性"},
  {"id": "equipment_plan", "title": "3. 設備投資計画", "max_chars": 2000, "description": "導入設備の詳細、技術的特徴"},
  {"id": "expected_results", "title": "4. 事業効果", "max_chars": 2500, "description": "生産性向上、付加価値額増加の見込み"},
  {"id": "implementation_schedule", "title": "5. 実施スケジュール", "max_chars": 1000, "description": "事業実施の具体的スケジュール"}
]',
'あなたは補助金申請書作成の専門家です。以下のヒアリング情報を基に、ものづくり補助金の申請書セクションを作成してください。
革新性、技術的優位性、具体的な数値目標を明確に示してください。');

-- ===============================
-- 初期データ: 採択事例サンプル
-- ===============================

INSERT INTO success_cases (subsidy_type_id, company_industry, company_size, company_region, fiscal_year, application_amount, approved_amount, success_summary, key_factors, is_public) VALUES
(1, '製造業', '20-50人', '愛知県', '令和5年度', 1500000, 1500000, 
'受発注システム導入により業務効率化を実現。月40時間の残業削減と転記ミス撲滅を達成。',
'["課題と効果の数値が明確", "導入後のビジョンが具体的", "投資対効果が明示されている"]', 1),

(1, 'サービス業', '10-20人', '東京都', '令和5年度', 800000, 800000,
'クラウド会計システムとCRM導入で顧客管理と経理業務を効率化。月20時間の業務削減。',
'["小規模企業でも取り組みやすい計画", "段階的な導入スケジュール", "費用対効果が明確"]', 1),

(2, '製造業', '50-100人', '大阪府', '令和5年度', 35000000, 35000000,
'AI外観検査システム導入で不良品検出率99.9%を達成。品質向上と人件費削減を両立。',
'["革新性が明確", "技術的裏付けがある", "具体的な数値目標", "他社との差別化"]', 1),

(2, '製造業', '20-50人', '新潟県', '令和5年度', 20000000, 20000000,
'5軸マシニングセンタ導入で複雑形状加工に対応。航空宇宙産業への参入を実現。',
'["新市場開拓の具体的計画", "設備投資と売上増加の関連性", "技術的優位性の説明"]', 1);

