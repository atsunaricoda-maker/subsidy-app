-- =====================================================
-- 書類解析・財務データ管理システム
-- 登記簿謄本・財務諸表・確定申告書からの自動抽出
-- =====================================================

-- ===============================
-- 1. 企業基本情報（登記簿謄本から抽出）
-- ===============================

CREATE TABLE IF NOT EXISTS company_registry_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL UNIQUE,
  document_id INTEGER,                    -- 元の書類ID
  
  -- 基本情報
  company_name TEXT,                      -- 会社名（商号）
  company_name_kana TEXT,                 -- 会社名フリガナ
  corporate_number TEXT,                  -- 法人番号
  head_office_address TEXT,               -- 本店所在地
  establishment_date TEXT,                -- 設立日
  capital_amount INTEGER,                 -- 資本金（円）
  business_purpose TEXT,                  -- 事業目的（JSON配列）
  
  -- 代表者情報
  representative_name TEXT,               -- 代表者名
  representative_title TEXT,              -- 役職（代表取締役等）
  representative_address TEXT,            -- 代表者住所
  
  -- 役員情報（JSON配列）
  directors TEXT,                         -- 役員構成 [{"name": "...", "title": "...", "appointed_date": "..."}]
  
  -- 株式情報
  total_shares INTEGER,                   -- 発行可能株式総数
  issued_shares INTEGER,                  -- 発行済株式総数
  share_transfer_restriction TEXT,        -- 株式譲渡制限
  
  -- 抽出メタデータ
  extraction_confidence REAL,             -- 抽出信頼度（0-1）
  extraction_date DATETIME,               -- 抽出日時
  verified INTEGER DEFAULT 0,             -- 顧客確認済みフラグ
  verified_at DATETIME,                   -- 確認日時
  manual_corrections TEXT,                -- 手動修正箇所（JSON）
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
);

-- ===============================
-- 2. 財務諸表データ（決算書から抽出）
-- ===============================

CREATE TABLE IF NOT EXISTS financial_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  document_id INTEGER,                    -- 元の書類ID
  fiscal_year TEXT NOT NULL,              -- 決算期（例: 2024年3月期）
  fiscal_period INTEGER,                  -- 第N期
  
  -- 損益計算書(PL)項目
  revenue INTEGER,                        -- 売上高
  cost_of_sales INTEGER,                  -- 売上原価
  gross_profit INTEGER,                   -- 売上総利益
  selling_admin_expenses INTEGER,         -- 販売費及び一般管理費
  operating_income INTEGER,               -- 営業利益
  non_operating_income INTEGER,           -- 営業外収益
  non_operating_expenses INTEGER,         -- 営業外費用
  ordinary_income INTEGER,                -- 経常利益
  extraordinary_income INTEGER,           -- 特別利益
  extraordinary_loss INTEGER,             -- 特別損失
  income_before_tax INTEGER,              -- 税引前当期純利益
  corporate_tax INTEGER,                  -- 法人税等
  net_income INTEGER,                     -- 当期純利益
  
  -- 販管費内訳（補助金申請で重要）
  personnel_expenses INTEGER,             -- 人件費
  depreciation INTEGER,                   -- 減価償却費
  rent_expenses INTEGER,                  -- 地代家賃
  advertising_expenses INTEGER,           -- 広告宣伝費
  rd_expenses INTEGER,                    -- 研究開発費
  other_expenses INTEGER,                 -- その他経費
  
  -- 貸借対照表(BS)項目 - 資産の部
  current_assets INTEGER,                 -- 流動資産
  cash_and_deposits INTEGER,              -- 現金及び預金
  accounts_receivable INTEGER,            -- 売掛金
  inventory INTEGER,                      -- 棚卸資産
  fixed_assets INTEGER,                   -- 固定資産
  tangible_assets INTEGER,                -- 有形固定資産
  intangible_assets INTEGER,              -- 無形固定資産
  investments INTEGER,                    -- 投資その他の資産
  total_assets INTEGER,                   -- 資産合計
  
  -- 貸借対照表(BS)項目 - 負債の部
  current_liabilities INTEGER,            -- 流動負債
  accounts_payable INTEGER,               -- 買掛金
  short_term_loans INTEGER,               -- 短期借入金
  fixed_liabilities INTEGER,              -- 固定負債
  long_term_loans INTEGER,                -- 長期借入金
  total_liabilities INTEGER,              -- 負債合計
  
  -- 貸借対照表(BS)項目 - 純資産の部
  capital_stock INTEGER,                  -- 資本金
  capital_surplus INTEGER,                -- 資本剰余金
  retained_earnings INTEGER,              -- 利益剰余金
  total_net_assets INTEGER,               -- 純資産合計
  
  -- その他情報
  employee_count INTEGER,                 -- 従業員数
  average_salary INTEGER,                 -- 平均給与
  
  -- 抽出メタデータ
  extraction_confidence REAL,
  extraction_date DATETIME,
  verified INTEGER DEFAULT 0,
  verified_at DATETIME,
  manual_corrections TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
  UNIQUE(client_id, fiscal_year)
);

-- ===============================
-- 3. 確定申告書データ（個人事業主用）
-- ===============================

CREATE TABLE IF NOT EXISTS tax_return_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  document_id INTEGER,
  tax_year TEXT NOT NULL,                 -- 申告年度（例: 令和5年分）
  
  -- 収入金額
  business_income INTEGER,                -- 事業所得（営業等）
  agricultural_income INTEGER,            -- 農業所得
  real_estate_income INTEGER,             -- 不動産所得
  salary_income INTEGER,                  -- 給与所得
  miscellaneous_income INTEGER,           -- 雑所得
  total_income INTEGER,                   -- 合計所得金額
  
  -- 必要経費の内訳
  total_expenses INTEGER,                 -- 必要経費合計
  salary_wages INTEGER,                   -- 給料賃金
  outsourcing_cost INTEGER,               -- 外注工賃
  depreciation_expense INTEGER,           -- 減価償却費
  interest_discount INTEGER,              -- 利子割引料
  rent_cost INTEGER,                      -- 地代家賃
  utility_cost INTEGER,                   -- 水道光熱費
  communication_cost INTEGER,             -- 通信費
  advertising_cost INTEGER,               -- 広告宣伝費
  consumables_cost INTEGER,               -- 消耗品費
  
  -- 所得金額
  taxable_income INTEGER,                 -- 課税所得金額
  income_tax INTEGER,                     -- 所得税額
  
  -- 青色申告特別控除
  blue_return_deduction INTEGER,          -- 青色申告特別控除額
  
  -- その他情報
  employee_count INTEGER,                 -- 専従者数
  family_employee_count INTEGER,          -- 青色事業専従者数
  
  -- 抽出メタデータ
  extraction_confidence REAL,
  extraction_date DATETIME,
  verified INTEGER DEFAULT 0,
  verified_at DATETIME,
  manual_corrections TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
  UNIQUE(client_id, tax_year)
);

-- ===============================
-- 4. 自動計算された財務指標
-- ===============================

CREATE TABLE IF NOT EXISTS financial_indicators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  fiscal_year TEXT NOT NULL,
  source_type TEXT NOT NULL,              -- 'financial_statement' or 'tax_return'
  
  -- 生産性指標
  labor_productivity INTEGER,             -- 労働生産性（付加価値額/従業員数）
  added_value INTEGER,                    -- 付加価値額（営業利益+人件費+減価償却費）
  added_value_rate REAL,                  -- 付加価値率（付加価値額/売上高）
  per_capita_sales INTEGER,               -- 一人当たり売上高
  
  -- 収益性指標
  gross_profit_margin REAL,               -- 売上総利益率
  operating_profit_margin REAL,           -- 営業利益率
  ordinary_profit_margin REAL,            -- 経常利益率
  net_profit_margin REAL,                 -- 当期純利益率
  roe REAL,                               -- 自己資本利益率
  roa REAL,                               -- 総資産利益率
  
  -- 安全性指標
  equity_ratio REAL,                      -- 自己資本比率
  current_ratio REAL,                     -- 流動比率
  quick_ratio REAL,                       -- 当座比率
  debt_ratio REAL,                        -- 負債比率
  
  -- 効率性指標
  asset_turnover REAL,                    -- 総資産回転率
  receivable_turnover REAL,               -- 売掛金回転率
  inventory_turnover REAL,                -- 棚卸資産回転率
  
  -- 成長性指標（前期比）
  revenue_growth_rate REAL,               -- 売上高成長率
  operating_income_growth_rate REAL,      -- 営業利益成長率
  net_income_growth_rate REAL,            -- 純利益成長率
  
  -- 補助金申請で重要な指標
  wage_increase_rate REAL,                -- 賃上げ率（前期比）
  investment_rate REAL,                   -- 設備投資率
  
  calculation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  UNIQUE(client_id, fiscal_year, source_type)
);

-- ===============================
-- 5. 書類解析履歴
-- ===============================

CREATE TABLE IF NOT EXISTS document_analysis_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  
  document_type TEXT NOT NULL,            -- 'registry', 'financial_statement', 'tax_return'
  analysis_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  
  -- 解析結果
  extracted_data TEXT,                    -- 抽出された全データ（JSON）
  confidence_scores TEXT,                 -- 各フィールドの信頼度（JSON）
  warnings TEXT,                          -- 警告・注意点（JSON配列）
  errors TEXT,                            -- エラー情報（JSON配列）
  
  -- 処理情報
  ai_model_used TEXT,                     -- 使用したAIモデル
  processing_time_ms INTEGER,             -- 処理時間
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- ===============================
-- 6. 事業計画テンプレート・記入例
-- ===============================

CREATE TABLE IF NOT EXISTS business_plan_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subsidy_type_id INTEGER NOT NULL,
  
  section_key TEXT NOT NULL,              -- セクションID
  section_name TEXT NOT NULL,             -- セクション名
  section_order INTEGER DEFAULT 0,        -- 表示順
  
  -- テンプレート内容
  template_text TEXT,                     -- テンプレート文（穴埋め形式）
  example_text TEXT,                      -- 記入例
  
  -- ガイダンス
  writing_guide TEXT,                     -- 書き方ガイド
  key_points TEXT,                        -- 重要ポイント（JSON配列）
  common_mistakes TEXT,                   -- よくある間違い（JSON配列）
  
  -- 採択事例からの学習データ
  successful_patterns TEXT,               -- 採択事例のパターン（JSON）
  keyword_suggestions TEXT,               -- 推奨キーワード（JSON配列）
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (subsidy_type_id) REFERENCES subsidy_types(id) ON DELETE CASCADE
);

-- ===============================
-- 7. ヒアリングセッション管理
-- ===============================

CREATE TABLE IF NOT EXISTS hearing_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  
  session_type TEXT DEFAULT 'general',    -- general, business_plan, financial_review
  session_status TEXT DEFAULT 'active',   -- active, completed, paused
  
  -- セッション進捗
  current_section TEXT,                   -- 現在のセクション
  completed_sections TEXT,                -- 完了セクション（JSON配列）
  total_questions INTEGER,
  answered_questions INTEGER,
  
  -- AI分析結果
  ai_summary TEXT,                        -- AIによるヒアリング要約
  extracted_key_points TEXT,              -- 抽出されたキーポイント（JSON）
  suggested_improvements TEXT,            -- 改善提案（JSON）
  
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- ===============================
-- インデックス
-- ===============================

CREATE INDEX IF NOT EXISTS idx_company_registry_client ON company_registry_data(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_statements_client ON financial_statements(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_statements_year ON financial_statements(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_tax_return_client ON tax_return_data(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_indicators_client ON financial_indicators(client_id);
CREATE INDEX IF NOT EXISTS idx_document_analysis_logs_client ON document_analysis_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_document_analysis_logs_doc ON document_analysis_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_business_plan_templates_subsidy ON business_plan_templates(subsidy_type_id);
CREATE INDEX IF NOT EXISTS idx_hearing_sessions_client ON hearing_sessions(client_id);

-- ===============================
-- 初期データ: 事業計画テンプレート（IT導入補助金）
-- ===============================

INSERT INTO business_plan_templates (subsidy_type_id, section_key, section_name, section_order, template_text, example_text, writing_guide, key_points) VALUES
(1, 'company_overview', '企業概要', 1,
'【企業名】{{company_name}}
【所在地】{{address}}
【設立】{{establishment_date}}
【資本金】{{capital_amount}}円
【従業員数】{{employee_count}}名
【事業内容】
{{business_description}}

【企業の強み】
{{company_strengths}}',

'【企業名】株式会社サンプル製作所
【所在地】愛知県名古屋市中区栄1-1-1
【設立】2005年4月1日
【資本金】1,000万円
【従業員数】25名
【事業内容】
自動車部品の精密切削加工を主力事業とし、大手自動車メーカー向けに高精度なエンジン部品を供給しています。創業以来、品質第一の方針のもと、加工精度±0.01mmの高い技術力を維持しています。

【企業の強み】
・独自開発の5軸加工技術による複雑形状への対応
・ISO9001認証取得による品質管理体制
・熟練技術者による一貫生産体制',

'企業概要は審査員が最初に目にする部分です。以下のポイントを意識してください：
1. 事業内容は具体的に（何を、誰に、どのように）
2. 数字で表現できるものは数字で
3. 他社との違い、強みを明確に',
'["事業内容を具体的に記載", "数値で表現できる強みを記載", "業界内でのポジションを明確に"]'),

(1, 'current_issues', '現状の課題', 2,
'【業務上の課題】
{{current_issues}}

【課題による影響】
- 時間的影響: {{time_impact}}
- コスト影響: {{cost_impact}}
- 品質・顧客への影響: {{quality_impact}}

【課題の原因分析】
{{cause_analysis}}',

'【業務上の課題】
現在、受発注業務はFAXと電話が中心で、以下の問題が発生しています：
1. 受注情報の手入力による転記ミス（月平均5件）
2. 在庫確認のための電話対応（1日平均2時間）
3. 納期回答の遅延（平均3時間）

【課題による影響】
- 時間的影響: 月間約40時間の残業が発生
- コスト影響: 人件費換算で年間約80万円のコスト増
- 品質・顧客への影響: 誤納品による信頼低下、クレーム対応コスト

【課題の原因分析】
・システム化されていない手作業中心の業務フロー
・リアルタイムな在庫情報の欠如
・部門間の情報共有不足',

'課題は具体的かつ定量的に記載することが重要です：
1. 「困っている」ではなく「月○時間のロス」と数値化
2. 課題と影響の因果関係を明確に
3. 根本原因の分析を忘れずに',
'["課題を数値で定量化", "課題と影響の因果関係を明示", "解決の必要性を論理的に説明"]'),

(1, 'implementation_plan', 'IT導入計画', 3,
'【導入予定のITツール】
ツール名: {{tool_name}}
ベンダー: {{vendor_name}}
主な機能: {{main_functions}}

【導入スケジュール】
{{implementation_schedule}}

【導入体制】
プロジェクト責任者: {{project_manager}}
導入担当者: {{implementation_team}}
ベンダー支援体制: {{vendor_support}}',

'【導入予定のITツール】
ツール名: クラウド型受発注管理システム「○○システム」
ベンダー: 株式会社△△ソリューションズ
主な機能: 
- Web受発注機能（24時間受付）
- リアルタイム在庫管理
- 自動納期回答
- 売上・在庫分析レポート

【導入スケジュール】
2024年4月: 要件定義・初期設定
2024年5月: データ移行・テスト運用
2024年6月: 本番稼働・運用開始
2024年7月: 効果検証・運用最適化

【導入体制】
プロジェクト責任者: 代表取締役 山田太郎
導入担当者: 営業部 鈴木一郎、製造部 田中花子
ベンダー支援体制: 導入コンサルタント派遣（月2回）、ヘルプデスク対応',

'導入計画は「実現可能性」が審査されます：
1. スケジュールは現実的に
2. 体制は社内の誰が担当するか明確に
3. ベンダーとの役割分担を記載',
'["導入スケジュールを具体的に", "社内体制を明確に", "リスク対策も記載"]'),

(1, 'expected_results', '期待される効果', 4,
'【定量的効果】
1. 業務時間削減: {{time_reduction}}
2. コスト削減: {{cost_reduction}}
3. 売上向上: {{revenue_increase}}
4. エラー削減: {{error_reduction}}

【定性的効果】
{{qualitative_effects}}

【効果測定方法】
{{measurement_method}}',

'【定量的効果】
1. 業務時間削減: 受発注業務 月40時間 → 月10時間（75%削減）
2. コスト削減: 残業代削減 年間80万円、紙・FAX費用削減 年間10万円
3. 売上向上: 営業時間確保による新規顧客獲得 年間売上5%増（500万円）
4. エラー削減: 転記ミス 月5件 → 0件、誤納品 0件達成

【定性的効果】
- 顧客満足度の向上（即時納期回答による）
- 従業員のストレス軽減
- データに基づく経営判断の実現
- 働き方改革の推進

【効果測定方法】
- 導入前後の業務時間を記録・比較
- 月次でのエラー件数トラッキング
- 顧客アンケートの実施（四半期ごと）',

'効果は「投資対効果」が明確になるように：
1. 可能な限り数値化
2. 補助金額に見合う効果を示す
3. 測定方法を具体的に示すことで実現可能性をアピール',
'["効果は具体的な数値で", "投資対効果を明確に", "測定方法も記載"]');

-- ===============================
-- 初期データ: 事業計画テンプレート（ものづくり補助金）
-- ===============================

INSERT INTO business_plan_templates (subsidy_type_id, section_key, section_name, section_order, template_text, example_text, writing_guide, key_points) VALUES
(2, 'innovation_plan', '革新的な取り組み', 2,
'【革新的サービス・製品の概要】
{{innovation_overview}}

【革新性のポイント】
{{innovation_points}}

【技術的優位性】
{{technical_advantages}}

【市場における新規性】
{{market_novelty}}',

'【革新的サービス・製品の概要】
AI画像認識技術を活用した外観検査システムを導入し、従来は熟練検査員の目視に頼っていた品質検査工程を自動化します。これにより、検査精度の向上と検査時間の大幅短縮を実現します。

【革新性のポイント】
1. 深層学習による微細欠陥の検出（従来比10倍の精度）
2. リアルタイム検査による全数検査の実現
3. 検査データの蓄積による継続的な精度向上

【技術的優位性】
・独自開発の照明技術との組み合わせにより、反射の影響を最小化
・検査員のノウハウをAIに学習させた独自アルゴリズム
・既存生産ラインへの後付け導入が可能なコンパクト設計

【市場における新規性】
同業他社では未だ目視検査が主流であり、本システムの導入により業界に先駆けた品質保証体制を構築。これにより、品質要求の厳しい医療機器・航空宇宙産業への参入が可能となる。',

'革新性は審査の最重要ポイントです：
1. 「新しい」だけでなく「なぜ新しいか」を説明
2. 技術的な根拠を示す
3. 競合との差別化を明確に',
'["革新性を具体的に説明", "技術的優位性を示す", "市場における位置づけを明確に"]'),

(2, 'equipment_plan', '設備投資計画', 3,
'【導入設備の詳細】
設備名: {{equipment_name}}
メーカー: {{manufacturer}}
型式: {{model}}
主要スペック: {{specifications}}
導入台数: {{quantity}}
設置場所: {{location}}

【設備選定理由】
{{selection_reason}}

【設備投資額】
本体価格: {{equipment_cost}}円
付帯工事: {{installation_cost}}円
合計: {{total_cost}}円',

'【導入設備の詳細】
設備名: AI外観検査システム
メーカー: 株式会社○○テクノロジー
型式: AIS-3000X
主要スペック: 
- 検査速度: 100個/分
- 検出精度: 99.9%
- 対応サイズ: φ5mm～φ100mm
- 検出可能欠陥: 傷、打痕、変色、寸法不良
導入台数: 1台
設置場所: 本社工場 検査エリア

【設備選定理由】
1. 業界最高水準の検出精度（他社製品は95%程度）
2. 既存ラインへの設置が容易
3. カスタマイズ対応可能（当社製品に最適化）
4. 充実した導入後サポート体制

【設備投資額】
本体価格: 25,000,000円
付帯工事: 3,000,000円
ソフトウェアカスタマイズ: 2,000,000円
合計: 30,000,000円',

'設備投資計画は「妥当性」が審査されます：
1. なぜその設備を選んだか（比較検討）
2. スペックと事業目的の整合性
3. 投資額の妥当性（相見積もり等）',
'["設備選定の理由を明確に", "スペックを具体的に記載", "投資額の妥当性を示す"]'),

(2, 'expected_results', '事業効果', 4,
'【生産性向上効果】
付加価値額（現状）: {{current_added_value}}円
付加価値額（計画）: {{planned_added_value}}円
向上率: {{improvement_rate}}%

【具体的な効果】
{{specific_effects}}

【3〜5年後の事業展望】
{{future_outlook}}',

'【生産性向上効果】
付加価値額（現状）: 80,000,000円
付加価値額（計画）: 96,000,000円
向上率: 20%

【具体的な効果】
1. 検査工程の自動化
   - 検査員2名分の省人化（年間人件費 800万円削減）
   - 検査時間 50%短縮（生産能力 30%向上）

2. 品質向上
   - 不良品流出率 0.1% → 0.01%
   - クレーム対応コスト 年間100万円削減
   
3. 新規市場開拓
   - 医療機器市場への参入（年間売上 2,000万円見込み）
   - 航空宇宙産業との取引開始交渉中

【3〜5年後の事業展望】
本設備の導入を皮切りに、生産工程全体のスマートファクトリー化を推進。
3年後: AI検査ノウハウを活用した検査受託サービス開始
5年後: 売上高 30%増、従業員 10名増加を目指す。',

'補助金審査では「付加価値額の向上」が必須要件です：
1. 付加価値額の計算式を理解する
2. 現状→計画の数値を明確に
3. 根拠となる効果を積み上げる',
'["付加価値額の向上を数値で示す", "効果の根拠を明確に", "将来ビジョンを描く"]');
