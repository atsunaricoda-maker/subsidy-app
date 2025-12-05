-- =====================================================
-- ヒアリング質問プリセット（補助金別）
-- 各補助金に特化した質問を追加
-- =====================================================

-- ===============================
-- 共通質問の強化（subsidy_type_id = 0）
-- 既存と重複しないものを追加
-- ===============================
INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
VALUES 
  -- 企業基本情報（追加）
  (0, 'common_industry_type', '業種を教えてください', 'select', '["製造業", "建設業", "小売業", "サービス業", "飲食業", "IT・情報通信業", "運輸・物流業", "医療・福祉", "その他"]', '企業情報', 1, 6, '該当する業種を選択してください', '製造業', 'company_overview'),
  
  (0, 'common_location', '事業所の所在地（都道府県）を教えてください', 'text', NULL, '企業情報', 1, 7, '主たる事業所の所在地', '神奈川県横浜市', 'company_overview'),

  -- 資金調達（追加）
  (0, 'common_financial_status', '現在の財務状況について教えてください', 'select', '["黒字経営", "収支トントン", "赤字だが改善傾向", "赤字継続中", "その他"]', '企業情報', 0, 8, '直近の決算状況', '黒字経営', 'company_overview'),

  (0, 'common_past_subsidy', '過去に補助金・助成金を受けたことはありますか？', 'select', '["ある", "ない"]', '企業情報', 0, 9, '過去の申請経験', 'ない', 'company_overview');

-- ===============================
-- IT導入補助金用質問
-- subsidy_type_id = 1 (IT導入補助金)
-- ===============================
-- 既存の質問を確認し、なければ追加
INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 1, 'it_target_tool', '導入を検討しているITツールを教えてください', 'select', '["受発注システム", "会計・財務システム", "顧客管理(CRM)", "生産管理システム", "在庫管理システム", "EC・オンライン販売", "テレワーク関連", "セキュリティ対策", "その他"]', 'IT計画', 1, 100, '導入を検討しているITツールのカテゴリ', '顧客管理(CRM)', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 1 AND question_key = 'it_target_tool');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 1, 'it_current_system', '現在利用しているITツール・システムはありますか？', 'textarea', NULL, 'IT計画', 1, 101, 'エクセル管理も含めて記載してください', '販売管理はエクセル、会計は弥生会計を使用', 'current_situation'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 1 AND question_key = 'it_current_system');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 1, 'it_digitalization_issues', 'IT活用・デジタル化における課題は何ですか？', 'textarea', NULL, '課題分析', 1, 102, '手作業が多い、データが連携していない、など', '各システムが連携しておらず、同じデータを複数入力している', 'current_situation'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 1 AND question_key = 'it_digitalization_issues');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 1, 'it_expected_efficiency', 'ITツール導入後に期待する業務効率化の効果を教えてください', 'textarea', NULL, '期待効果', 1, 103, '作業時間削減、ミス削減、売上向上など', '月20時間の入力作業削減、ミスによる手戻り工数の50%削減', 'expected_results'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 1 AND question_key = 'it_expected_efficiency');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 1, 'it_security_concern', 'セキュリティ対策について懸念はありますか？', 'select', '["ある（対策を検討したい）", "ある（既に対策済み）", "特にない", "わからない"]', 'IT計画', 0, 104, 'サイバーセキュリティの懸念', 'ある（対策を検討したい）', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 1 AND question_key = 'it_security_concern');

-- ===============================
-- ものづくり補助金用質問
-- subsidy_type_id = 2 (ものづくり補助金)
-- ===============================
INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 2, 'mono_product_plan', '開発・製造しようとしている製品・サービスを教えてください', 'textarea', NULL, '事業計画', 1, 100, '具体的な製品名、特徴、革新性を記載', '従来より30%軽量化した高強度アルミ部品。自動車業界向けに独自の加工技術で製造', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 2 AND question_key = 'mono_product_plan');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 2, 'mono_innovation', 'この製品・サービスの革新性・新規性は何ですか？', 'textarea', NULL, '事業計画', 1, 101, '既存製品との違い、技術的な特徴', '独自開発の熱処理技術により、従来品と比べ強度1.5倍、重量30%減を実現', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 2 AND question_key = 'mono_innovation');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 2, 'mono_target_market', '想定している市場・ターゲット顧客を教えてください', 'textarea', NULL, '事業計画', 1, 102, '販売先、市場規模、競合状況など', '自動車部品メーカー向け。国内市場規模約1000億円、競合はA社B社だが技術的優位性あり', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 2 AND question_key = 'mono_target_market');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 2, 'mono_equipment', '導入予定の設備・機械を教えてください', 'textarea', NULL, '設備投資', 1, 103, '機械名、メーカー、概算金額', '5軸マシニングセンタ（DMG MORI製）約3000万円、3Dプリンタ（EOS製）約1500万円', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 2 AND question_key = 'mono_equipment');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 2, 'mono_production_volume', '生産計画（生産量・販売見込み）を教えてください', 'textarea', NULL, '事業計画', 1, 104, '年間生産量、売上目標など', '初年度500個/年、3年目に2000個/年。売上目標3年後1億円', 'expected_results'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 2 AND question_key = 'mono_production_volume');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 2, 'mono_wage_increase', '賃上げ計画はありますか？', 'select', '["年率平均3%以上の賃上げを予定", "年率平均1.5%以上の賃上げを予定", "未定", "賃上げは難しい"]', '事業計画', 1, 105, 'ものづくり補助金の加点要件になります', '年率平均3%以上の賃上げを予定', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 2 AND question_key = 'mono_wage_increase');

-- ===============================
-- キャリアアップ助成金用質問
-- subsidy_type_id = 3 (キャリアアップ助成金)
-- ===============================
INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 3, 'career_target_employee', '正社員転換を検討している従業員の情報を教えてください', 'textarea', NULL, '従業員情報', 1, 100, '人数、現在の雇用形態、勤続期間など', 'パートタイマー2名（勤続2年、1年半）。両名とも正社員登用を希望', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 3 AND question_key = 'career_target_employee');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 3, 'career_current_status', '対象従業員の現在の雇用形態を教えてください', 'select', '["有期契約労働者", "パートタイマー", "派遣労働者", "無期雇用派遣"]', '従業員情報', 1, 101, '正社員転換前の雇用形態', '有期契約労働者', 'company_overview'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 3 AND question_key = 'career_current_status');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 3, 'career_conversion_type', '希望する正社員転換のコースを教えてください', 'select', '["正社員化コース", "賃金規定等改定コース", "賃金規定等共通化コース", "賞与・退職金制度導入コース", "社会保険適用時処遇改善コース"]', '転換計画', 1, 102, '利用を検討しているコース', '正社員化コース', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 3 AND question_key = 'career_conversion_type');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 3, 'career_wage_increase', '転換後の賃金はどのように設定する予定ですか？', 'textarea', NULL, '転換計画', 1, 103, '転換前後の賃金、賃金増加率など', '時給1100円から月給22万円（3%以上の賃上げ）。賞与年2回支給予定', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 3 AND question_key = 'career_wage_increase');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 3, 'career_plan_status', 'キャリアアップ計画書は作成済みですか？', 'select', '["作成済み（労働局に提出済み）", "作成済み（未提出）", "作成中", "未作成"]', '書類準備', 1, 104, '計画書の作成状況', '未作成', 'documentation'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 3 AND question_key = 'career_plan_status');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 3, 'career_employment_rules', '就業規則に正社員転換制度は規定されていますか？', 'select', '["規定されている", "規定されていない", "わからない"]', '書類準備', 1, 105, '就業規則の整備状況', '規定されていない', 'documentation'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 3 AND question_key = 'career_employment_rules');

-- ===============================
-- 事業再構築補助金用質問
-- subsidy_type_id = 4 (事業再構築補助金)
-- ===============================
INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 4, 'recon_new_business', '新たに取り組む事業内容を教えてください', 'textarea', NULL, '事業計画', 1, 100, '新規事業の内容、既存事業との関連', '既存の飲食店に加え、冷凍食品のEC販売事業を開始。店舗の調理技術を活かした冷凍惣菜を開発', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 4 AND question_key = 'recon_new_business');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 4, 'recon_type', '申請する事業類型を教えてください', 'select', '["新市場進出", "事業転換", "業種転換", "業態転換", "事業再編"]', '事業計画', 1, 101, '事業再構築の類型', '新市場進出', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 4 AND question_key = 'recon_type');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 4, 'recon_market_analysis', '新規事業の市場規模・成長性を教えてください', 'textarea', NULL, '事業計画', 1, 102, '市場データ、競合分析など', '冷凍食品市場は年率5%成長、2025年には3兆円規模に。特に高品質冷凍惣菜の需要増', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 4 AND question_key = 'recon_market_analysis');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 4, 'recon_sales_decline', '売上減少の状況を教えてください', 'textarea', NULL, '課題分析', 1, 103, 'コロナ前後の売上比較、減少理由など', '2019年比で売上30%減少。来店客数減少に加え、宴会需要が回復していない', 'current_situation'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 4 AND question_key = 'recon_sales_decline');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 4, 'recon_investment_plan', '設備投資計画を教えてください', 'textarea', NULL, '設備投資', 1, 104, '導入予定の設備、金額など', '急速冷凍機1500万円、EC用受注システム300万円、配送用冷凍設備500万円', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 4 AND question_key = 'recon_investment_plan');

-- ===============================
-- 小規模事業者持続化補助金用質問
-- subsidy_type_id = 5 (小規模事業者持続化補助金)
-- ===============================
INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 5, 'shouki_sales_plan', '販路開拓の取り組み内容を教えてください', 'textarea', NULL, '事業計画', 1, 100, '新規顧客獲得、販促活動など', 'SNS広告とECサイト構築による新規顧客獲得。地域外への販売拡大を目指す', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 5 AND question_key = 'shouki_sales_plan');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 5, 'shouki_product_service', '補助金で強化したい商品・サービスを教えてください', 'textarea', NULL, '事業計画', 1, 101, '主力商品、新商品開発など', '自社開発のオリジナルスイーツ。パッケージリニューアルとギフト需要向け商品開発', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 5 AND question_key = 'shouki_product_service');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 5, 'shouki_target_customer', 'ターゲット顧客を教えてください', 'textarea', NULL, '事業計画', 1, 102, '想定する顧客層、市場', '30〜50代の女性、健康志向の高い層。贈答用需要も見込む', 'implementation_plan'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 5 AND question_key = 'shouki_target_customer');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 5, 'shouki_application_type', '申請する類型を教えてください', 'select', '["通常枠", "賃金引上げ枠", "卒業枠", "後継者支援枠", "創業枠"]', '申請情報', 1, 103, '補助上限額が異なります', '通常枠', 'documentation'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 5 AND question_key = 'shouki_application_type');

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT 5, 'shouki_chamb_member', '商工会・商工会議所の会員ですか？', 'select', '["会員である", "会員でない（今後加入予定）", "会員でない（加入予定なし）"]', '申請情報', 1, 104, '商工会議所等からの支援を受けられます', '会員である', 'company_overview'
WHERE NOT EXISTS (SELECT 1 FROM hearing_questions WHERE subsidy_type_id = 5 AND question_key = 'shouki_chamb_member');

-- ===============================
-- 両立支援等助成金用質問
-- (社労士管轄 - 育児・介護関連)
-- ===============================
INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT id, 'ryoritsu_target_employee', '育児休業・介護休業を取得予定の従業員情報を教えてください', 'textarea', NULL, '従業員情報', 1, 100, '人数、性別、予定時期など', '男性社員1名が配偶者の出産に伴い育児休業を取得予定（2024年4月〜）', 'implementation_plan'
FROM subsidy_types WHERE name = '両立支援等助成金';

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT id, 'ryoritsu_course', '申請を検討しているコースを教えてください', 'select', '["出生時両立支援コース", "介護離職防止支援コース", "育児休業等支援コース"]', '申請情報', 1, 101, '利用するコース', '出生時両立支援コース', 'implementation_plan'
FROM subsidy_types WHERE name = '両立支援等助成金';

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT id, 'ryoritsu_work_rules', '育児・介護休業規程は整備されていますか？', 'select', '["整備済み", "整備中", "未整備"]', '書類準備', 1, 102, '就業規則の整備状況', '整備済み', 'documentation'
FROM subsidy_types WHERE name = '両立支援等助成金';

-- ===============================
-- 人材開発支援助成金用質問
-- ===============================
INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT id, 'jinzai_training_plan', '実施予定の訓練内容を教えてください', 'textarea', NULL, '訓練計画', 1, 100, '訓練の内容、期間、対象者数など', 'ITスキル向上のためのプログラミング研修。3ヶ月間、5名を対象に外部講師による研修', 'implementation_plan'
FROM subsidy_types WHERE name = '人材開発支援助成金';

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT id, 'jinzai_course', '申請を検討しているコースを教えてください', 'select', '["人材育成支援コース", "教育訓練休暇等付与コース", "人への投資促進コース", "事業展開等リスキリング支援コース"]', '申請情報', 1, 101, '利用するコース', '人材育成支援コース', 'implementation_plan'
FROM subsidy_types WHERE name = '人材開発支援助成金';

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT id, 'jinzai_training_provider', '訓練の実施機関を教えてください', 'textarea', NULL, '訓練計画', 1, 102, '研修機関名、講師情報など', '○○ITスクール（認定職業訓練施設）', 'implementation_plan'
FROM subsidy_types WHERE name = '人材開発支援助成金';

-- ===============================
-- 業務改善助成金用質問
-- ===============================
INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT id, 'gyomu_current_wage', '現在の事業場内最低賃金を教えてください', 'number', NULL, '賃金情報', 1, 100, '時給（円）', '950', 'company_overview'
FROM subsidy_types WHERE name = '業務改善助成金';

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT id, 'gyomu_wage_increase', '引き上げ後の事業場内最低賃金を教えてください', 'number', NULL, '賃金情報', 1, 101, '時給（円）', '1000', 'implementation_plan'
FROM subsidy_types WHERE name = '業務改善助成金';

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT id, 'gyomu_equipment', '導入予定の設備・機器を教えてください', 'textarea', NULL, '設備投資', 1, 102, '生産性向上のための設備', 'POSレジシステム導入、在庫管理ソフト、業務用複合機', 'implementation_plan'
FROM subsidy_types WHERE name = '業務改善助成金';

INSERT OR IGNORE INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
SELECT id, 'gyomu_target_workers', '賃金引上げ対象となる労働者数を教えてください', 'number', NULL, '賃金情報', 1, 103, '引き上げ対象者数', '5', 'company_overview'
FROM subsidy_types WHERE name = '業務改善助成金';
