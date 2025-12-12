-- ヒアリング質問プリセット追加

-- ========================================
-- 社労士管轄の助成金
-- ========================================

-- キャリアアップ助成金（正社員化コース）ID:45
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(45, 'cu_seishain_count', '正社員転換を予定している有期契約労働者は何名ですか？', 'number', NULL, 1, 1),
(45, 'cu_seishain_type', '転換予定者の現在の雇用形態を教えてください', 'select', '["有期契約社員","パート・アルバイト","派遣社員","その他"]', 1, 2),
(45, 'cu_seishain_term', '転換予定者の勤続期間はどのくらいですか？', 'select', '["6ヶ月未満","6ヶ月以上1年未満","1年以上2年未満","2年以上3年未満","3年以上"]', 1, 3),
(45, 'cu_seishain_rule', '就業規則に正社員転換制度は規定されていますか？', 'select', '["規定済み","規定予定","規定なし","わからない"]', 1, 4),
(45, 'cu_seishain_wage', '転換後の賃金は転換前と比較して何%以上増加予定ですか？', 'select', '["3%以上","5%以上","10%以上","未定"]', 1, 5);

-- キャリアアップ助成金（賃金規定等改定コース）ID:46
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(46, 'cu_wage_count', '賃金規定の改定対象となる有期契約労働者は何名ですか？', 'number', NULL, 1, 1),
(46, 'cu_wage_table', '現在の賃金テーブルはありますか？', 'select', '["ある","作成予定","ない"]', 1, 2),
(46, 'cu_wage_rate', '賃金引上げ率は何%を予定していますか？', 'select', '["3%以上","5%以上","その他"]', 1, 3),
(46, 'cu_wage_target', '対象労働者全員を引き上げますか、一部ですか？', 'select', '["全員","一部"]', 1, 4),
(46, 'cu_wage_rule', '就業規則の賃金規定を改定予定ですか？', 'select', '["改定予定","改定済み","未定"]', 1, 5);

-- 中途採用等支援助成金 ID:38
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(38, 'chuto_plan', '中途採用を積極的に行う計画はありますか？', 'select', '["ある","検討中","まだない"]', 1, 1),
(38, 'chuto_count', '中途採用者の予定人数を教えてください', 'number', NULL, 1, 2),
(38, 'chuto_age', '中途採用者の想定年齢層を教えてください', 'checkbox', '["35歳未満","35歳以上45歳未満","45歳以上"]', 1, 3),
(38, 'chuto_ratio', '中途採用比率の目標値はありますか？', 'select', '["ある","設定予定","ない"]', 0, 4),
(38, 'chuto_training', '中途採用者向けの研修制度はありますか？', 'select', '["ある","導入予定","ない"]', 0, 5);

-- 介護離職防止支援助成金 ID:40
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(40, 'kaigo_rule', '介護休業制度は就業規則に規定されていますか？', 'select', '["規定済み","規定予定","規定なし"]', 1, 1),
(40, 'kaigo_employee', '介護休業を取得予定または取得した従業員はいますか？', 'select', '["いる","予定あり","いない"]', 1, 2),
(40, 'kaigo_flexible', '介護のための柔軟な働き方制度はありますか？', 'checkbox', '["短時間勤務","フレックスタイム","在宅勤務","時差出勤","なし"]', 1, 3),
(40, 'kaigo_return', '介護休業からの復帰支援制度はありますか？', 'select', '["ある","導入予定","ない"]', 0, 4),
(40, 'kaigo_consult', '従業員の介護に関する相談窓口はありますか？', 'select', '["ある","設置予定","ない"]', 0, 5);

-- 出生時両立支援コース ID:42
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(42, 'papa_record', '男性従業員の育児休業取得実績はありますか？', 'select', '["ある","ない"]', 1, 1),
(42, 'papa_plan', '育児休業取得予定の男性従業員はいますか？', 'select', '["いる","予定あり","いない"]', 1, 2),
(42, 'papa_days', '育児休業の取得日数の目標を教えてください', 'select', '["5日以上","2週間以上","1ヶ月以上","未設定"]', 1, 3),
(42, 'papa_env', '育児休業を取得しやすい職場環境づくりに取り組んでいますか？', 'select', '["取り組んでいる","取り組む予定","特に取り組んでいない"]', 1, 4),
(42, 'papa_system', '産後パパ育休（出生時育児休業）制度を導入していますか？', 'select', '["導入済み","導入予定","未導入"]', 1, 5);

-- 労働時間短縮・年休促進支援コース ID:44
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(44, 'worktime_current', '現在の所定労働時間を教えてください', 'select', '["週40時間以上","週40時間未満","不明"]', 1, 1),
(44, 'worktime_leave', '年次有給休暇の平均取得日数を教えてください', 'select', '["5日未満","5日以上10日未満","10日以上"]', 1, 2),
(44, 'worktime_hour', '時間単位の年次有給休暇制度はありますか？', 'select', '["ある","導入予定","ない"]', 1, 3),
(44, 'worktime_special', '特別休暇制度はありますか？', 'checkbox', '["病気休暇","ボランティア休暇","教育訓練休暇","その他","なし"]', 0, 4),
(44, 'worktime_goal', '労働時間の削減目標はありますか？', 'text', NULL, 0, 5);

-- 勤務間インターバル導入コース ID:43
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(43, 'interval_status', '勤務間インターバル制度を導入していますか？', 'select', '["導入済み","導入予定","未導入"]', 1, 1),
(43, 'interval_hours', '導入予定のインターバル時間を教えてください', 'select', '["9時間以上11時間未満","11時間以上","未定"]', 1, 2),
(43, 'interval_count', '対象となる従業員数を教えてください', 'number', NULL, 1, 3),
(43, 'interval_current', '現在の平均的な勤務終了から翌日勤務開始までの時間は？', 'select', '["8時間未満","8時間以上11時間未満","11時間以上"]', 1, 4),
(43, 'interval_overtime', '残業が多い部署や職種はありますか？', 'text', NULL, 0, 5);

-- 地域雇用開発助成金 ID:37
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(37, 'chiiki_location', '事業所の所在地（都道府県・市区町村）を教えてください', 'text', NULL, 1, 1),
(37, 'chiiki_area', '雇用機会が不足している地域での事業ですか？', 'select', '["はい","いいえ","わからない"]', 1, 2),
(37, 'chiiki_hire', '新規雇用予定の人数を教えてください', 'number', NULL, 1, 3),
(37, 'chiiki_invest', '設備投資の予定金額を教えてください', 'select', '["300万円未満","300万円以上1000万円未満","1000万円以上"]', 1, 4),
(37, 'chiiki_local', '地域の求職者を積極的に雇用する計画はありますか？', 'select', '["ある","検討中","ない"]', 1, 5);

-- 育児休業等支援コース ID:41
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(41, 'ikukyu_employee', '育児休業取得予定または取得中の従業員はいますか？', 'select', '["いる","予定あり","いない"]', 1, 1),
(41, 'ikukyu_return', '育児休業からの円滑な復帰支援制度はありますか？', 'select', '["ある","導入予定","ない"]', 1, 2),
(41, 'ikukyu_substitute', '代替要員の確保方法を教えてください', 'select', '["新規雇用","社内配置転換","派遣社員活用","未定"]', 1, 3),
(41, 'ikukyu_contact', '育休取得者への情報提供や面談は行っていますか？', 'select', '["行っている","行う予定","行っていない"]', 1, 4),
(41, 'ikukyu_short', '短時間勤務制度は整備されていますか？', 'select', '["整備済み","整備予定","未整備"]', 1, 5);

-- 障害者雇用安定助成金 ID:39
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(39, 'shogai_record', '障害者の雇用実績はありますか？', 'select', '["ある","ない"]', 1, 1),
(39, 'shogai_type', '雇用予定の障害者の障害種別を教えてください', 'checkbox', '["身体障害","知的障害","精神障害","発達障害","その他"]', 1, 2),
(39, 'shogai_env', '障害者が働きやすい職場環境の整備は行っていますか？', 'select', '["行っている","行う予定","行っていない"]', 1, 3),
(39, 'shogai_counselor', '障害者職業生活相談員は配置していますか？', 'select', '["配置済み","配置予定","未配置"]', 0, 4),
(39, 'shogai_coach', 'ジョブコーチ支援を受けたことはありますか？', 'select', '["ある","受ける予定","ない"]', 0, 5);

-- ========================================
-- 行政書士管轄の補助金
-- ========================================

-- ものづくり補助金（グリーン枠）ID:35
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(35, 'mono_green_plan', '温室効果ガス削減に資する設備投資を予定していますか？', 'select', '["予定している","検討中","予定なし"]', 1, 1),
(35, 'mono_green_amount', '投資予定金額を教えてください', 'select', '["1000万円未満","1000万円以上3000万円未満","3000万円以上"]', 1, 2),
(35, 'mono_green_co2', 'CO2削減目標はありますか？', 'select', '["ある","設定予定","ない"]', 1, 3),
(35, 'mono_green_equip', 'どのような設備を導入予定ですか？', 'checkbox', '["省エネ設備","再生可能エネルギー設備","電気自動車","その他"]', 1, 4),
(35, 'mono_green_cert', '環境認証（ISO14001等）の取得状況を教えてください', 'select', '["取得済み","取得予定","未取得"]', 0, 5);

-- 中小企業デジタル化応援隊事業 ID:31
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(31, 'digital_issue', 'デジタル化に関する課題を教えてください', 'checkbox', '["業務効率化","テレワーク導入","EC・ネット販売","顧客管理","その他"]', 1, 1),
(31, 'digital_staff', 'IT専門人材は社内にいますか？', 'select', '["いる","いない"]', 1, 2),
(31, 'digital_tools', '現在利用しているITツールはありますか？', 'checkbox', '["会計ソフト","勤怠管理","顧客管理","グループウェア","なし"]', 1, 3),
(31, 'digital_budget', 'デジタル化の予算規模を教えてください', 'select', '["50万円未満","50万円以上100万円未満","100万円以上"]', 0, 4),
(31, 'digital_support', '外部専門家の支援を受けたいですか？', 'select', '["受けたい","検討中","必要ない"]', 1, 5);

-- 中小企業経営強化税制 ID:36
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(36, 'tax_amount', '設備投資の予定金額を教えてください', 'select', '["160万円未満","160万円以上1000万円未満","1000万円以上"]', 1, 1),
(36, 'tax_type', '投資予定の設備の種類を教えてください', 'checkbox', '["機械装置","工具","器具備品","建物附属設備","ソフトウェア"]', 1, 2),
(36, 'tax_plan', '経営力向上計画の認定を受けていますか？', 'select', '["受けている","申請予定","受けていない"]', 1, 3),
(36, 'tax_goal', '生産性向上の具体的な目標はありますか？', 'text', NULL, 0, 4),
(36, 'tax_timing', '投資予定時期を教えてください', 'select', '["3ヶ月以内","6ヶ月以内","1年以内","未定"]', 1, 5);

-- 事業再構築補助金 ID:32
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(32, 'saikouchiku_type', '新分野展開・事業転換・業種転換のいずれを検討していますか？', 'select', '["新分野展開","事業転換","業種転換","業態転換","事業再編"]', 1, 1),
(32, 'saikouchiku_sales', 'コロナ以降の売上状況を教えてください', 'select', '["10%以上減少","10%未満の減少","変化なし","増加"]', 1, 2),
(32, 'saikouchiku_plan', '新事業の具体的な計画はありますか？', 'select', '["具体的にある","構想段階","まだない"]', 1, 3),
(32, 'saikouchiku_amount', '投資予定金額を教えてください', 'select', '["1000万円未満","1000万円以上5000万円未満","5000万円以上"]', 1, 4),
(32, 'saikouchiku_support', '認定経営革新等支援機関との連携はありますか？', 'select', '["連携済み","連携予定","まだない"]', 1, 5),
(32, 'saikouchiku_ratio', '新事業で想定している売上比率を教えてください', 'select', '["10%以上","30%以上","50%以上"]', 1, 6);

-- 創業助成金 ID:33
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(33, 'sougyo_timing', '創業予定時期を教えてください', 'select', '["すでに創業済み","3ヶ月以内","6ヶ月以内","1年以内"]', 1, 1),
(33, 'sougyo_business', '創業予定の業種を教えてください', 'text', NULL, 1, 2),
(33, 'sougyo_fund', '創業に必要な資金の調達状況を教えてください', 'select', '["自己資金のみ","融資予定あり","出資予定あり","未定"]', 1, 3),
(33, 'sougyo_plan', '事業計画書は作成していますか？', 'select', '["作成済み","作成中","未作成"]', 1, 4),
(33, 'sougyo_training', '創業に関する研修やセミナーを受講しましたか？', 'select', '["受講済み","受講予定","受講していない"]', 0, 5);

-- 販路開拓助成金 ID:34
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(34, 'hanro_method', '販路開拓の方法を教えてください', 'checkbox', '["展示会出展","ECサイト構築","広告宣伝","海外展開","その他"]', 1, 1),
(34, 'hanro_amount', '販路開拓の投資予定金額を教えてください', 'select', '["50万円未満","50万円以上200万円未満","200万円以上"]', 1, 2),
(34, 'hanro_goal', '新規顧客獲得の目標はありますか？', 'select', '["具体的にある","検討中","ない"]', 1, 3),
(34, 'hanro_exp', '展示会等への出展経験はありますか？', 'select', '["ある","ない"]', 0, 4),
(34, 'hanro_area', '販路開拓の対象地域を教えてください', 'checkbox', '["国内（地域限定）","国内（全国）","海外"]', 1, 5);

-- ========================================
-- 許認可
-- ========================================

-- 電気工事業登録 ID:47
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(47, 'denki_chief', '主任電気工事士の資格保有者はいますか？', 'select', '["いる","採用予定","いない"]', 1, 1),
(47, 'denki_type', '電気工事の種類を教えてください', 'checkbox', '["一般用電気工作物","自家用電気工作物","両方"]', 1, 2),
(47, 'denki_office', '営業所の所在地を教えてください', 'text', NULL, 1, 3),
(47, 'denki_kensetsu', '他の建設業許可を取得していますか？', 'select', '["取得済み","取得予定","取得していない"]', 0, 4),
(47, 'denki_exp', '電気工事の実務経験年数を教えてください', 'select', '["3年未満","3年以上5年未満","5年以上"]', 1, 5);

-- 解体工事業登録 ID:48
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(48, 'kaitai_tech', '技術管理者の要件を満たす方はいますか？', 'select', '["いる","採用予定","いない"]', 1, 1),
(48, 'kaitai_amount', '解体工事の請負金額の想定を教えてください', 'select', '["500万円未満","500万円以上"]', 1, 2),
(48, 'kaitai_kensetsu', '建設業許可（土木・建築・解体）を取得していますか？', 'select', '["取得済み","取得予定","取得していない"]', 1, 3),
(48, 'kaitai_exp', '解体工事の実務経験はありますか？', 'select', '["8年以上","1年以上","なし"]', 1, 4),
(48, 'kaitai_sanpai', '産業廃棄物収集運搬業の許可はありますか？', 'select', '["ある","取得予定","ない"]', 0, 5);

-- 警備業認定 ID:49
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(49, 'keibi_type', '警備業務の種類を教えてください', 'checkbox', '["施設警備","交通誘導","運搬警備","身辺警備"]', 1, 1),
(49, 'keibi_shidou', '警備員指導教育責任者の資格保有者はいますか？', 'select', '["いる","採用予定","いない"]', 1, 2),
(49, 'keibi_kekkaku', '欠格事由に該当する方はいませんか？', 'select', '["該当者なし","確認が必要","わからない"]', 1, 3),
(49, 'keibi_count', '警備員の採用予定人数を教えてください', 'number', NULL, 1, 4),
(49, 'keibi_office', '営業所の確保状況を教えてください', 'select', '["確保済み","確保予定","未定"]', 1, 5);

-- 有料職業紹介事業許可 ID:50
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(50, 'shokukai_koushu', '職業紹介責任者講習を受講しましたか？', 'select', '["受講済み","受講予定","未受講"]', 1, 1),
(50, 'shokukai_gyoshu', '紹介予定の職種を教えてください', 'text', NULL, 1, 2),
(50, 'shokukai_area', '事業所の面積は20㎡以上ありますか？', 'select', '["20㎡以上","20㎡未満","確認が必要"]', 1, 3),
(50, 'shokukai_shisan', '資産要件（基準資産500万円以上）を満たしていますか？', 'select', '["満たしている","満たす予定","わからない"]', 1, 4),
(50, 'shokukai_privacy', '個人情報保護の体制は整備していますか？', 'select', '["整備済み","整備予定","未整備"]', 1, 5);

-- 一般貸切旅客自動車運送事業許可 ID:51
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(51, 'bus_unkou', '運行管理者の資格保有者はいますか？', 'select', '["いる","採用予定","いない"]', 1, 1),
(51, 'bus_seibi', '整備管理者の資格保有者はいますか？', 'select', '["いる","採用予定","いない"]', 1, 2),
(51, 'bus_vehicle', '車両の保有台数（予定含む）を教えてください', 'number', NULL, 1, 3),
(51, 'bus_office', '営業所・車庫の確保状況を教えてください', 'select', '["確保済み","確保予定","未定"]', 1, 4),
(51, 'bus_fund', '所要資金の調達状況を教えてください', 'select', '["調達済み","調達予定","未定"]', 1, 5);

-- 倉庫業登録 ID:52
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(52, 'souko_type', '倉庫の種類を教えてください', 'select', '["普通倉庫","冷蔵倉庫","水面倉庫","その他"]', 1, 1),
(52, 'souko_area', '倉庫の面積を教えてください', 'select', '["100㎡未満","100㎡以上500㎡未満","500㎡以上"]', 1, 2),
(52, 'souko_own', '倉庫の所有形態を教えてください', 'select', '["自己所有","賃借","取得予定"]', 1, 3),
(52, 'souko_manager', '倉庫管理主任者の選任予定はありますか？', 'select', '["選任済み","選任予定","未定"]', 1, 4),
(52, 'souko_cargo', '保管予定の貨物の種類を教えてください', 'text', NULL, 1, 5);

-- 金融商品取引業登録 ID:53
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(53, 'kinyu_type', '登録を希望する業務の種類を教えてください', 'select', '["第一種","第二種","投資助言・代理業","投資運用業"]', 1, 1),
(53, 'kinyu_capital', '資本金・純財産額の要件を満たしていますか？', 'select', '["満たしている","満たす予定","わからない"]', 1, 2),
(53, 'kinyu_staff', '金融商品取引業の経験者はいますか？', 'select', '["いる","採用予定","いない"]', 1, 3),
(53, 'kinyu_compliance', 'コンプライアンス体制は整備していますか？', 'select', '["整備済み","整備予定","未整備"]', 1, 4),
(53, 'kinyu_office', '主たる営業所の所在地を教えてください', 'text', NULL, 1, 5);

-- 宅建業免許更新 ID:54
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(54, 'takken_expire', '現在の免許の有効期限を教えてください', 'date', NULL, 1, 1),
(54, 'takken_sennin', '宅地建物取引士は専任で設置されていますか？', 'select', '["設置済み","変更予定","確認が必要"]', 1, 2),
(54, 'takken_record', '過去5年間の取引実績はありますか？', 'select', '["ある","ない"]', 1, 3),
(54, 'takken_hosho', '営業保証金または保証協会への加入状況を教えてください', 'select', '["営業保証金供託","保証協会加入","確認が必要"]', 1, 4),
(54, 'takken_change', '事務所の変更はありますか？', 'select', '["変更なし","変更あり","変更予定"]', 1, 5);

-- 風俗営業許可 ID:55
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(55, 'fuzoku_type', '営業形態を教えてください', 'select', '["キャバレー等","料理店","ダンスホール","パチンコ店","ゲームセンター","その他"]', 1, 1),
(55, 'fuzoku_area', '営業所の用途地域を教えてください', 'select', '["商業地域","準工業地域","その他","わからない"]', 1, 2),
(55, 'fuzoku_distance', '学校・病院等の保護対象施設との距離は確認しましたか？', 'select', '["確認済み","確認予定","未確認"]', 1, 3),
(55, 'fuzoku_manager', '管理者の選任予定はありますか？', 'select', '["選任済み","選任予定","未定"]', 1, 4),
(55, 'fuzoku_zumen', '営業所の図面は作成済みですか？', 'select', '["作成済み","作成予定","未作成"]', 1, 5);

-- 深夜酒類提供飲食店届出 ID:56
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(56, 'shinya_start', '営業開始予定時期を教えてください', 'date', NULL, 1, 1),
(56, 'shinya_area', '営業所の用途地域を教えてください', 'select', '["商業地域","準工業地域","工業地域","その他","わからない"]', 1, 2),
(56, 'shinya_seat', '客席の面積を教えてください', 'select', '["10㎡未満","10㎡以上30㎡未満","30㎡以上"]', 1, 3),
(56, 'shinya_eisei', '食品衛生責任者は確保していますか？', 'select', '["確保済み","確保予定","未定"]', 1, 4),
(56, 'shinya_zumen', '営業所の平面図は作成済みですか？', 'select', '["作成済み","作成予定","未作成"]', 1, 5);

-- 特定建設業許可 ID:57
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(57, 'tokken_type', '許可を受けたい業種を教えてください', 'checkbox', '["土木一式","建築一式","電気","管","その他"]', 1, 1),
(57, 'tokken_kanri', '監理技術者の資格保有者はいますか？', 'select', '["いる","採用予定","いない"]', 1, 2),
(57, 'tokken_capital', '資本金は4000万円以上ありますか？', 'select', '["4000万円以上","4000万円未満"]', 1, 3),
(57, 'tokken_shisan', '財産的基礎（自己資本4000万円以上）を満たしていますか？', 'select', '["満たしている","満たす予定","わからない"]', 1, 4),
(57, 'tokken_shitauke', '下請契約の予定金額を教えてください', 'select', '["4500万円以上","4500万円未満"]', 1, 5);

-- 一般建設業許可 ID:58
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(58, 'ippan_type', '許可を受けたい業種を教えてください', 'checkbox', '["土木一式","建築一式","大工","左官","とび・土工","電気","管","その他"]', 1, 1),
(58, 'ippan_keiei', '経営業務管理責任者の要件を満たす方はいますか？', 'select', '["いる","採用予定","いない"]', 1, 2),
(58, 'ippan_sennin', '専任技術者の要件を満たす方はいますか？', 'select', '["いる","採用予定","いない"]', 1, 3),
(58, 'ippan_shisan', '財産的基礎（500万円以上）を満たしていますか？', 'select', '["満たしている","満たす予定","わからない"]', 1, 4),
(58, 'ippan_kekkaku', '欠格要件に該当する方はいませんか？', 'select', '["該当者なし","確認が必要","わからない"]', 1, 5);

-- 測量業者登録 ID:59
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(59, 'sokuryou_shikaku', '測量士または測量士補の資格保有者はいますか？', 'select', '["いる","採用予定","いない"]', 1, 1),
(59, 'sokuryou_record', '測量業務の実績はありますか？', 'select', '["ある","ない"]', 1, 2),
(59, 'sokuryou_joukin', '営業所に測量士を常勤で配置できますか？', 'select', '["配置可能","配置予定","困難"]', 1, 3),
(59, 'sokuryou_kiki', '測量機器は保有していますか？', 'select', '["保有している","購入予定","リース予定"]', 0, 4),
(59, 'sokuryou_type', '主な測量業務の種類を教えてください', 'checkbox', '["基本測量","公共測量","その他の測量"]', 1, 5);

-- 建築士事務所登録 ID:60
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(60, 'kenchiku_class', '登録を希望する事務所の級を教えてください', 'select', '["一級建築士事務所","二級建築士事務所","木造建築士事務所"]', 1, 1),
(60, 'kenchiku_kanri', '管理建築士の要件を満たす方はいますか？', 'select', '["いる","採用予定","いない"]', 1, 2),
(60, 'kenchiku_exp', '管理建築士の建築士事務所での実務経験年数を教えてください', 'select', '["3年以上","3年未満"]', 1, 3),
(60, 'kenchiku_koushu', '管理建築士講習は修了していますか？', 'select', '["修了済み","受講予定","未受講"]', 1, 4),
(60, 'kenchiku_gyomu', '業務の種類を教えてください', 'checkbox', '["設計","工事監理","建築に関する調査・鑑定","その他"]', 1, 5);

-- 医薬品販売業許可 ID:61
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order) VALUES
(61, 'iyaku_type', '販売する医薬品の種類を教えてください', 'select', '["一般用医薬品のみ","要指導医薬品含む","医療用医薬品含む"]', 1, 1),
(61, 'iyaku_staff', '薬剤師または登録販売者は確保していますか？', 'select', '["確保済み","確保予定","未定"]', 1, 2),
(61, 'iyaku_area', '店舗の面積を教えてください', 'select', '["13.2㎡未満","13.2㎡以上"]', 1, 3),
(61, 'iyaku_storage', '医薬品の保管設備は整備していますか？', 'select', '["整備済み","整備予定","未整備"]', 1, 4),
(61, 'iyaku_hanbai', '販売形態を教えてください', 'select', '["店舗販売","配置販売","卸売販売"]', 1, 5);
