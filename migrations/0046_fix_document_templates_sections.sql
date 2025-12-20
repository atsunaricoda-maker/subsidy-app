-- Fix document_templates sections to use consistent format (title field)
-- Templates ID 9-22 use 'name' instead of 'title', this migration normalizes them

-- ID 9: 中小企業省力化投資補助金
UPDATE document_templates SET sections = '[{"id": "company_overview", "title": "1. 企業概要", "max_chars": 800, "description": "会社の基本情報、事業内容、従業員数等"},{"id": "current_issues", "title": "2. 現状の課題", "max_chars": 1000, "description": "人手不足、生産性の課題、業務上のボトルネック"},{"id": "investment_plan", "title": "3. 省力化投資計画", "max_chars": 1200, "description": "導入する設備・システム、選定理由"},{"id": "expected_effects", "title": "4. 期待される効果", "max_chars": 1000, "description": "労働時間削減、生産性向上の具体的数値目標"},{"id": "implementation_schedule", "title": "5. 実施スケジュール", "max_chars": 600, "description": "導入から運用開始までの計画"}]' WHERE id = 9;

-- ID 10: 中小企業新事業進出補助金
UPDATE document_templates SET sections = '[{"id": "company_profile", "title": "1. 企業概要", "max_chars": 800, "description": "現在の事業内容と強み"},{"id": "new_business", "title": "2. 新事業の概要", "max_chars": 1200, "description": "進出する新分野・新事業の内容"},{"id": "market_analysis", "title": "3. 市場分析", "max_chars": 1000, "description": "ターゲット市場の規模、成長性、競合状況"},{"id": "competitive_advantage", "title": "4. 競争優位性", "max_chars": 1000, "description": "既存事業のノウハウ活用、差別化ポイント"},{"id": "revenue_plan", "title": "5. 収益計画", "max_chars": 800, "description": "売上・利益目標、投資回収計画"}]' WHERE id = 10;

-- ID 11: 中小企業成長加速化補助金
UPDATE document_templates SET sections = '[{"id": "company_overview", "title": "1. 企業概要", "max_chars": 800, "description": "事業内容、業績推移、成長の軌跡"},{"id": "growth_strategy", "title": "2. 成長戦略", "max_chars": 1200, "description": "今後の成長ビジョンと戦略"},{"id": "investment_content", "title": "3. 投資内容", "max_chars": 1000, "description": "成長のための設備投資・人材投資の内容"},{"id": "market_expansion", "title": "4. 市場拡大計画", "max_chars": 1000, "description": "販路拡大、新市場開拓の計画"},{"id": "financial_plan", "title": "5. 財務計画", "max_chars": 800, "description": "売上・利益目標、資金計画"}]' WHERE id = 11;

-- ID 12: 事業承継・M&A補助金
UPDATE document_templates SET sections = '[{"id": "current_business", "title": "1. 現在の事業概要", "max_chars": 800, "description": "事業内容、業績、従業員数"},{"id": "succession_plan", "title": "2. 承継計画", "max_chars": 1000, "description": "承継の方法、後継者の情報、スケジュール"},{"id": "business_improvement", "title": "3. 事業改善計画", "max_chars": 1200, "description": "承継を機にした事業の改善・発展計画"},{"id": "investment_plan", "title": "4. 設備投資計画", "max_chars": 800, "description": "承継に伴う必要な設備投資"},{"id": "post_succession", "title": "5. 承継後の展望", "max_chars": 800, "description": "承継後の事業発展ビジョン"}]' WHERE id = 12;

-- ID 13: キャリアアップ助成金
UPDATE document_templates SET sections = '[{"id": "company_overview", "title": "1. 事業所概要", "max_chars": 800, "description": "事業内容、従業員構成、雇用形態の内訳"},{"id": "current_employment", "title": "2. 現在の雇用状況", "max_chars": 800, "description": "非正規雇用者の状況、課題"},{"id": "career_up_plan", "title": "3. キャリアアップ計画", "max_chars": 1200, "description": "正社員転換または処遇改善の具体的計画"},{"id": "training_plan", "title": "4. 教育訓練計画", "max_chars": 800, "description": "スキルアップのための研修内容"},{"id": "expected_effects", "title": "5. 期待される効果", "max_chars": 600, "description": "従業員のモチベーション向上、定着率改善等"}]' WHERE id = 13;

-- ID 14: 人材開発支援助成金
UPDATE document_templates SET sections = '[{"id": "company_overview", "title": "1. 事業所概要", "max_chars": 800, "description": "事業内容、従業員数、組織体制"},{"id": "training_needs", "title": "2. 訓練の必要性", "max_chars": 1000, "description": "現状のスキル課題、訓練が必要な理由"},{"id": "training_content", "title": "3. 訓練内容", "max_chars": 1200, "description": "訓練のカリキュラム、時間数、実施方法"},{"id": "target_employees", "title": "4. 対象者", "max_chars": 600, "description": "訓練対象となる従業員の情報"},{"id": "expected_outcomes", "title": "5. 期待される成果", "max_chars": 800, "description": "訓練後のスキル向上、生産性改善の見込み"}]' WHERE id = 14;

-- ID 15: 働き方改革推進支援助成金
UPDATE document_templates SET sections = '[{"id": "company_overview", "title": "1. 事業所概要", "max_chars": 800, "description": "事業内容、従業員数、現在の労働時間状況"},{"id": "current_issues", "title": "2. 現状の課題", "max_chars": 800, "description": "長時間労働、有給取得率等の課題"},{"id": "reform_plan", "title": "3. 働き方改革計画", "max_chars": 1200, "description": "労働時間短縮、有給促進等の具体策"},{"id": "investment_content", "title": "4. 導入する機器・システム", "max_chars": 800, "description": "生産性向上のための設備投資内容"},{"id": "target_values", "title": "5. 目標値", "max_chars": 600, "description": "労働時間削減目標、有給取得率目標等"}]' WHERE id = 15;

-- ID 16: 業務改善助成金
UPDATE document_templates SET sections = '[{"id": "company_overview", "title": "1. 事業所概要", "max_chars": 800, "description": "事業内容、従業員数、現在の賃金水準"},{"id": "wage_increase_plan", "title": "2. 賃金引上げ計画", "max_chars": 800, "description": "引上げ対象者、引上げ額、時期"},{"id": "productivity_improvement", "title": "3. 生産性向上計画", "max_chars": 1200, "description": "業務改善の具体的内容"},{"id": "equipment_investment", "title": "4. 設備投資計画", "max_chars": 1000, "description": "導入する機器・システムの内容と効果"},{"id": "expected_effects", "title": "5. 期待される効果", "max_chars": 600, "description": "生産性向上と賃金引上げの継続性"}]' WHERE id = 16;

-- ID 17: 両立支援等助成金
UPDATE document_templates SET sections = '[{"id": "company_overview", "title": "1. 事業所概要", "max_chars": 800, "description": "事業内容、従業員構成、男女比"},{"id": "current_situation", "title": "2. 現状", "max_chars": 800, "description": "育児・介護休業の取得状況"},{"id": "support_plan", "title": "3. 両立支援計画", "max_chars": 1200, "description": "育児・介護との両立支援の具体策"},{"id": "work_environment", "title": "4. 職場環境整備", "max_chars": 800, "description": "テレワーク導入、時短勤務等の環境整備"},{"id": "expected_effects", "title": "5. 期待される効果", "max_chars": 600, "description": "従業員の定着率向上、採用力強化等"}]' WHERE id = 17;

-- ID 18: 雇用調整助成金
UPDATE document_templates SET sections = '[{"id": "company_overview", "title": "1. 事業所概要", "max_chars": 800, "description": "事業内容、従業員数、売上状況"},{"id": "business_decline", "title": "2. 事業活動の縮小状況", "max_chars": 1000, "description": "売上減少の状況と原因"},{"id": "leave_plan", "title": "3. 休業計画", "max_chars": 1000, "description": "休業の対象者、期間、日数"},{"id": "employment_maintenance", "title": "4. 雇用維持の方針", "max_chars": 800, "description": "休業により解雇を回避する計画"},{"id": "recovery_plan", "title": "5. 事業回復の見通し", "max_chars": 800, "description": "事業回復に向けた取り組み"}]' WHERE id = 18;

-- ID 19: 特定求職者雇用開発助成金
UPDATE document_templates SET sections = '[{"id": "company_overview", "title": "1. 事業所概要", "max_chars": 800, "description": "事業内容、従業員構成"},{"id": "recruitment_plan", "title": "2. 採用計画", "max_chars": 800, "description": "採用予定者の属性、人数、職種"},{"id": "job_description", "title": "3. 業務内容", "max_chars": 1000, "description": "担当業務の詳細、必要なスキル"},{"id": "support_system", "title": "4. 定着支援体制", "max_chars": 800, "description": "メンター制度、研修等のサポート体制"},{"id": "expected_contribution", "title": "5. 期待する貢献", "max_chars": 600, "description": "採用者に期待する役割と成長見込み"}]' WHERE id = 19;

-- ID 20: 創業助成金
UPDATE document_templates SET sections = '[{"id": "founder_profile", "title": "1. 創業者プロフィール", "max_chars": 800, "description": "経歴、スキル、創業の動機"},{"id": "business_concept", "title": "2. 事業コンセプト", "max_chars": 1000, "description": "事業内容、提供する価値"},{"id": "market_analysis", "title": "3. 市場分析", "max_chars": 1200, "description": "ターゲット市場、顧客ニーズ、競合分析"},{"id": "business_model", "title": "4. ビジネスモデル", "max_chars": 1000, "description": "収益構造、価格設定、販売チャネル"},{"id": "financial_plan", "title": "5. 資金計画", "max_chars": 1000, "description": "必要資金、資金調達方法、収支計画"},{"id": "growth_vision", "title": "6. 成長ビジョン", "max_chars": 800, "description": "3年後、5年後の事業展望"}]' WHERE id = 20;

-- ID 21: 販路開拓助成金
UPDATE document_templates SET sections = '[{"id": "company_overview", "title": "1. 企業概要", "max_chars": 800, "description": "事業内容、主力商品・サービス"},{"id": "current_sales", "title": "2. 現在の販売状況", "max_chars": 800, "description": "既存の販路、売上構成"},{"id": "new_channel_plan", "title": "3. 新規販路開拓計画", "max_chars": 1200, "description": "開拓する販路、ターゲット顧客"},{"id": "marketing_strategy", "title": "4. マーケティング戦略", "max_chars": 1000, "description": "プロモーション方法、展示会出展等"},{"id": "sales_target", "title": "5. 売上目標", "max_chars": 600, "description": "新規販路からの売上目標、達成時期"}]' WHERE id = 21;

-- ID 22: ものづくり補助金（グリーン枠）
UPDATE document_templates SET sections = '[{"id": "company_overview", "title": "1. 企業概要", "max_chars": 800, "description": "事業内容、製造プロセス概要"},{"id": "environmental_issues", "title": "2. 環境課題", "max_chars": 1000, "description": "現在のCO2排出量、環境負荷の現状"},{"id": "green_investment", "title": "3. グリーン投資計画", "max_chars": 1200, "description": "導入する環境配慮型設備の内容"},{"id": "co2_reduction", "title": "4. CO2削減効果", "max_chars": 1000, "description": "投資によるCO2削減量の見込み"},{"id": "economic_effect", "title": "5. 経済効果", "max_chars": 800, "description": "コスト削減、生産性向上の見込み"}]' WHERE id = 22;
