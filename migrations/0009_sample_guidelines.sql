-- =====================================================
-- サンプル公募要領データ
-- =====================================================

-- IT導入補助金 2025年度
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  1, '2025', '通年公募',
  '2025-03-01', '2025-12-15',
  4500000, 50000, '1/2〜2/3',
  '中小企業・小規模事業者等（飲食、宿泊、卸・小売、運輸、医療、介護、保育等のサービス業の他、製造業や建設業等も対象）',
  'ソフトウェア購入費、クラウド利用料（最大2年分）、導入関連費、ハードウェア購入費',
  'active',
  'https://it-shien.smrj.go.jp/'
);

-- ものづくり補助金 2025年度
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  2, '2025', '第18次',
  '2025-01-10', '2025-03-28',
  12500000, 1000000, '1/2〜2/3',
  '中小企業者（製造業、建設業、運輸業、卸売業、サービス業、小売業等）',
  '機械装置・システム構築費、技術導入費、専門家経費、運搬費、クラウドサービス利用費、原材料費、外注費、知的財産権等関連経費',
  'active',
  'https://portal.monodukuri-hojo.jp/'
);

-- 小規模事業者持続化補助金 2025年度
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  5, '2025', '第16回',
  '2025-02-01', '2025-05-20',
  2000000, 0, '2/3',
  '小規模事業者（商業・サービス業は常時使用従業員5人以下、製造業その他は20人以下）',
  '機械装置等費、広報費、ウェブサイト関連費、展示会等出展費、旅費、開発費、資料購入費、雑役務費、借料、設備処分費、委託・外注費',
  'active',
  'https://s23.jizokukahojokin.info/'
);

-- キャリアアップ助成金 2025年度
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  3, '2025', '令和6年度',
  '2025-04-01', '2026-03-31',
  800000, 285000, '定額',
  '雇用保険適用事業所の事業主で、有期雇用労働者等を雇用している事業主',
  '正社員化コース：有期→正規 80万円/人、無期→正規 40万円/人',
  'active',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/part_haken/jigyounushi/career.html'
);

-- 雇用調整助成金 2025年度
INSERT OR REPLACE INTO subsidy_guidelines (
  subsidy_type_id, fiscal_year, version,
  application_start_date, application_end_date,
  max_amount, min_amount, subsidy_rate,
  eligibility_requirements, target_expenses, status, source_url
) VALUES (
  4, '2025', '通常制度',
  '2025-04-01', '2026-03-31',
  8490, 0, '2/3〜9/10',
  '経済上の理由により事業活動の縮小を余儀なくされた事業主',
  '休業手当、教育訓練費、出向元事業主の負担額',
  'active',
  'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/pageL07.html'
);
