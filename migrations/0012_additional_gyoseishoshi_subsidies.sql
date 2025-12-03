-- =====================================================
-- 2025年最新 行政書士管轄の補助金追加
-- =====================================================

-- 新しい補助金タイプを追加
INSERT OR IGNORE INTO subsidy_types (name, category, description) VALUES
  ('中小企業省力化投資補助金', '行政書士管轄', '人手不足解消のための省力化設備導入を支援'),
  ('中小企業新事業進出補助金', '行政書士管轄', '新市場・高付加価値事業への進出を支援'),
  ('中小企業成長加速化補助金', '行政書士管轄', '売上高100億円を目指す中小企業の大規模投資を支援'),
  ('事業承継・M&A補助金', '行政書士管轄', 'M&Aや事業承継後の設備投資・経営革新を支援');

-- 中小企業省力化投資補助金（カタログ型・一般型）
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = '中小企業省力化投資補助金'),
  '2025', '第2回公募',
  '2025-04-01', '2026-03-31',
  15000000, 0, '1/2',
  '人手不足の状態にある中小企業・小規模事業者',
  'カタログ型：IoT、ロボット等の汎用製品（カタログ掲載製品） / 一般型：オーダーメイド設備（補助上限1.5億円）、ロボット、AI、IoT等の導入',
  'active',
  'https://shoryokuka.smrj.go.jp/'
);

-- 中小企業新事業進出補助金（事業再構築補助金の後継）
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = '中小企業新事業進出補助金'),
  '2025', '第1回公募',
  '2025-04-01', '2025-12-31',
  90000000, 1000000, '1/2',
  '新たな事業分野への進出を目指す中小企業・小規模事業者（既存事業と異なる製品・サービスを新たな顧客に提供する事業）',
  '建物費、機械装置・システム構築費、技術導入費、専門家経費、運搬費、クラウドサービス利用費、外注費、知的財産権等関連経費、研修費、広告宣伝・販売促進費',
  'active',
  'https://seisansei.smrj.go.jp/subsidy_guide/subsidy_info/new_business_subsidy.html'
);

-- 中小企業成長加速化補助金
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = '中小企業成長加速化補助金'),
  '2025', '第1回公募',
  '2025-04-01', '2025-12-31',
  500000000, 100000000, '1/2',
  '売上高100億円を目指す中小企業で「100億宣言」を行っている事業者、投資額1億円以上（税抜）、一定の賃上げ要件を満たすこと',
  '工場新設、生産性向上設備の導入、自動化・デジタル化のための設備投資、機械装置費、建物費、技術導入費、専門家経費等',
  'active',
  'https://seisansei.smrj.go.jp/subsidy_guide/subsidy_info/growth_acceleration_subsidy.html'
);

-- 事業承継・M&A補助金
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = '事業承継・M&A補助金'),
  '2025', '第12次公募',
  '2025-08-22', '2025-09-19',
  20000000, 0, '1/2〜2/3',
  '【経営革新枠】5年以内に親族内承継・従業員承継を予定 【M&A枠】M&Aにより経営資源を譲受・譲渡する事業者',
  '経営革新枠：設備投資、店舗・事務所の改築費用等（上限800〜1,000万円） / M&A枠：M&A時の専門家費用、設備投資等（上限600〜2,000万円） / 廃業・再チャレンジ枠：廃業に係る費用（上限150万円）',
  'active',
  'https://jsh.go.jp/'
);
