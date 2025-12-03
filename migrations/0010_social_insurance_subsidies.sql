-- =====================================================
-- 社労士管轄の助成金追加
-- =====================================================

-- 新しい補助金タイプを追加
INSERT OR IGNORE INTO subsidy_types (name, category, description) VALUES
  ('両立支援等助成金', '雇用系', '育児・介護休業の取得促進を支援'),
  ('人材開発支援助成金', '雇用系', '従業員の職業訓練・教育を支援'),
  ('65歳超雇用推進助成金', '雇用系', '高齢者の雇用継続・促進を支援'),
  ('特定求職者雇用開発助成金', '雇用系', '高齢者・障害者等の雇用を支援'),
  ('トライアル雇用助成金', '雇用系', '試行雇用による就職支援'),
  ('業務改善助成金', '雇用系', '最低賃金引上げと設備投資を支援'),
  ('働き方改革推進支援助成金', '雇用系', '労働時間短縮・有給取得促進を支援'),
  ('産業雇用安定助成金', '雇用系', '在籍型出向による雇用維持を支援');

-- 両立支援等助成金
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = '両立支援等助成金'),
  '2025', '令和6年度',
  '2025-04-01', '2026-03-31',
  600000, 300000, '定額',
  '雇用保険適用事業所で、育児休業・介護休業制度を就業規則に規定している事業主',
  '出生時両立支援コース（子の出生後8週間以内に育休取得）: 第1種20万円、第2種60万円 / 介護離職防止支援コース: 休業取得時30万円、職場復帰時30万円 / 育児休業等支援コース: 休業取得時30万円、職場復帰時30万円',
  'active',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kodomo/shokuba_kosodate/ryouritsu01/'
);

-- 人材開発支援助成金
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = '人材開発支援助成金'),
  '2025', '令和6年度',
  '2025-04-01', '2026-03-31',
  10000000, 0, '45%〜75%',
  '雇用保険適用事業所で、職業訓練計画を作成し労働局の認定を受けた事業主',
  '人材育成支援コース: 経費助成45〜60%、賃金助成760円/時 / 教育訓練休暇等付与コース: 30万円 / 人への投資促進コース: 経費助成75%、賃金助成960円/時 / 事業展開等リスキリング支援コース: 経費助成75%、賃金助成960円/時',
  'active',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1.html'
);

-- 65歳超雇用推進助成金
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = '65歳超雇用推進助成金'),
  '2025', '令和6年度',
  '2025-04-01', '2026-03-31',
  1600000, 300000, '定額',
  '65歳以上への定年引上げ、定年廃止、継続雇用制度導入等を行う事業主',
  '65歳超継続雇用促進コース: 定年65歳以上へ引上げ15〜30万円、定年廃止40万円、66〜69歳継続雇用15〜40万円、70歳以上継続雇用30〜160万円 / 高年齢者評価制度等雇用管理改善コース: 経費の60%（上限50万円） / 高年齢者無期雇用転換コース: 30万円/人',
  'active',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000139692.html'
);

-- 特定求職者雇用開発助成金
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = '特定求職者雇用開発助成金'),
  '2025', '令和6年度',
  '2025-04-01', '2026-03-31',
  2400000, 300000, '定額',
  'ハローワーク等の紹介により、高齢者・障害者・母子家庭の母等を継続雇用する事業主',
  '特定就職困難者コース: 高齢者（60〜64歳）60万円、母子家庭の母等60万円、身体・知的障害者120万円、重度障害者等240万円 / 発達障害者・難治性疾患患者雇用開発コース: 中小企業120万円 / 就職氷河期世代安定雇用実現コース: 60万円 / 生活保護受給者等雇用開発コース: 60万円',
  'active',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/tokutei_konnan.html'
);

-- トライアル雇用助成金
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = 'トライアル雇用助成金'),
  '2025', '令和6年度',
  '2025-04-01', '2026-03-31',
  50000, 40000, '定額（月額）',
  'ハローワーク等の紹介により、職業経験不足等で就職困難な求職者を試行雇用する事業主',
  '一般トライアルコース: 月額4万円（最長3か月） / 障害者トライアルコース: 月額最大8万円（精神障害者は最長12か月） / 若年・女性建設労働者トライアルコース: 月額4万円（最長3か月）',
  'active',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/trial_koyou.html'
);

-- 業務改善助成金
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = '業務改善助成金'),
  '2025', '令和6年度',
  '2025-04-01', '2026-03-31',
  6000000, 300000, '75%〜90%',
  '事業場内最低賃金を一定額以上引き上げ、設備投資等を行う中小企業・小規模事業者',
  '賃金引上げ額30円以上: 上限30万円〜 / 賃金引上げ額45円以上: 上限70万円〜 / 賃金引上げ額60円以上: 上限90万円〜 / 賃金引上げ額90円以上: 上限170万円〜600万円（引上げ人数により変動） / 対象経費: 機械設備、POSシステム、コンサルティング費用等',
  'active',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/zigyonushi/shienjigyou/03.html'
);

-- 働き方改革推進支援助成金
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = '働き方改革推進支援助成金'),
  '2025', '令和6年度',
  '2025-04-01', '2026-03-31',
  7300000, 250000, '75%',
  '労働時間短縮、年次有給休暇取得促進等に取り組む中小企業事業主',
  '労働時間短縮・年休促進支援コース: 上限25〜730万円 / 勤務間インターバル導入コース: 上限40〜340万円 / 労働時間適正管理推進コース: 上限100万円 / 団体推進コース: 上限500万円 / 対象経費: 労務管理機器・ソフト、専門家謝金、就業規則作成費等',
  'active',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120692.html'
);

-- 産業雇用安定助成金
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  (SELECT id FROM subsidy_types WHERE name = '産業雇用安定助成金'),
  '2025', '令和6年度',
  '2025-04-01', '2026-03-31',
  0, 0, '2/3〜9/10',
  '新型コロナ等の影響により事業活動の一時的縮小を余儀なくされた事業主が、在籍型出向により労働者の雇用維持を図る場合',
  '雇用維持支援コース: 出向運営経費（賃金、教育訓練費、労務管理費等）の2/3〜9/10 + 出向初期経費10万円/人（加算あり） / スキルアップ支援コース: 出向運営経費の2/3〜9/10 + 出向初期経費15万円/人',
  'active',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000082805_00008.html'
);
