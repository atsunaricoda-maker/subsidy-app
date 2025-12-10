-- ============================================
-- ヒアリング質問プリセット追加
-- question_keyを含めた正しい形式
-- ============================================

-- 65歳超雇用推進助成金 (ID: 11)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(11, 'age65_course', '申請するコースを選択してください', 'select', '["65歳超継続雇用促進コース","高年齢者評価制度等雇用管理改善コース","高年齢者無期雇用転換コース"]', 1, 1, '取り組み内容に応じて選択', '申請内容'),
(11, 'age65_current_retirement', '現在の定年年齢は？', 'select', '["60歳","61〜64歳","65歳","66歳以上","定年なし"]', 2, 1, '就業規則上の定年', '現状確認'),
(11, 'age65_new_retirement', '引上げ後の定年年齢は？', 'select', '["65歳","66〜69歳","70歳","定年廃止"]', 3, 1, '変更後の定年', '計画内容'),
(11, 'age65_senior_count', '60歳以上の従業員数は？', 'number', NULL, 4, 1, '対象となる高年齢者数', '従業員情報'),
(11, 'age65_continuous_employment', '希望者全員の継続雇用制度はありますか？', 'radio', '["はい","いいえ","導入予定"]', 5, 1, '70歳までの就業確保', '制度確認');

-- 特定求職者雇用開発助成金 (ID: 12)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(12, 'tokutei_target_category', '雇用する対象者の区分は？', 'select', '["高年齢者（60〜64歳）","母子家庭の母","障害者","就職氷河期世代","生活保護受給者"]', 1, 1, '該当する区分を選択', '対象者情報'),
(12, 'tokutei_hellowork', 'ハローワーク等からの紹介は受けていますか？', 'radio', '["はい","いいえ","これから紹介を受ける"]', 2, 1, '紹介状が必要', '手続き確認'),
(12, 'tokutei_employment_type', '雇用形態は？', 'select', '["正社員（無期フルタイム）","契約社員（有期フルタイム）","パートタイム"]', 3, 1, '週所定労働時間に影響', '雇用条件'),
(12, 'tokutei_working_hours', '週所定労働時間は？', 'select', '["30時間以上","20時間以上30時間未満","20時間未満"]', 4, 1, '助成額に影響', '雇用条件'),
(12, 'tokutei_rehire_check', '過去に同じ対象者を雇用したことはありますか？', 'radio', '["はい","いいえ"]', 5, 1, '再雇用は対象外の場合あり', '確認事項');

-- トライアル雇用助成金 (ID: 13)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(13, 'trial_target', 'トライアル雇用の対象者は？', 'select', '["若年者（35歳未満）","中高年齢者","障害者","母子家庭の母","就職困難者"]', 1, 1, '対象者の区分', '対象者情報'),
(13, 'trial_hellowork', 'ハローワークからの紹介は受けていますか？', 'radio', '["はい","いいえ","これから受ける予定"]', 2, 1, '紹介状必須', '手続き確認'),
(13, 'trial_after_plan', 'トライアル期間終了後の雇用予定は？', 'select', '["正社員として本採用","契約社員として雇用継続","未定"]', 3, 1, '常用雇用への移行が目的', '計画'),
(13, 'trial_employment_history', '対象者の直近の就労状況は？', 'select', '["2年以内に2回以上離職","1年超の無職期間あり","学卒未就職","その他"]', 4, 1, '対象要件の確認', '確認事項');

-- 働き方改革推進支援助成金 (ID: 15)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(15, 'workstyle_course', '申請するコースを選択してください', 'select', '["労働時間短縮・年休促進支援コース","勤務間インターバル導入コース","労働時間適正管理推進コース","団体推進コース"]', 1, 1, '取り組み内容に応じて選択', '申請内容'),
(15, 'workstyle_overtime_limit', '現在の36協定の上限時間は？', 'select', '["月45時間以下","月45時間超60時間以下","月60時間超80時間以下","月80時間超"]', 2, 1, '時間外労働の現状', '現状確認'),
(15, 'workstyle_initiatives', '導入予定の取り組みは？', 'checkbox', '["労務管理ソフト導入","勤怠管理システム導入","就業規則変更","研修実施","専門家によるコンサル"]', 3, 1, '複数選択可', '計画内容'),
(15, 'workstyle_paid_leave_rate', '年次有給休暇の取得率は？', 'select', '["70%以上","50%以上70%未満","50%未満"]', 4, 1, '改善目標の参考', '現状確認'),
(15, 'workstyle_goals', '成果目標として設定できる項目は？', 'checkbox', '["時間外労働時間の削減","年休取得日数の増加","勤務間インターバルの導入","特別休暇の新設"]', 5, 1, '達成目標を選択', '目標設定');

-- 産業雇用安定助成金 (ID: 16)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(16, 'sangyo_secondment_type', '出向の形態は？', 'select', '["在籍型出向（雇用関係維持）","移籍型出向"]', 1, 1, '在籍型が対象', '出向形態'),
(16, 'sangyo_reason', '出向の理由は？', 'select', '["事業縮小による雇用維持","スキルアップ・人材育成","新規事業への転換準備","その他"]', 2, 1, '出向の目的', '背景'),
(16, 'sangyo_period', '出向期間の予定は？', 'select', '["3ヶ月以内","3ヶ月超6ヶ月以内","6ヶ月超1年以内","1年超"]', 3, 1, '出向計画期間', '計画'),
(16, 'sangyo_destination', '出向先は決まっていますか？', 'radio', '["はい","いいえ（マッチング支援希望）"]', 4, 1, '産業雇用安定センター活用可', '確認事項'),
(16, 'sangyo_insurance_period', '出向元での雇用保険加入期間は？', 'select', '["6ヶ月以上1年未満","1年以上"]', 5, 1, '被保険者期間', '要件確認');

-- 両立支援等助成金 (ID: 9) - 追加質問
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(9, 'ryoritsu_childcare_period', '育児休業の取得予定期間は？', 'text', NULL, 4, 1, '例：3ヶ月、6ヶ月、1年など', '計画内容'),
(9, 'ryoritsu_return_style', '職場復帰後の就業形態は？', 'select', '["フルタイム","時短勤務","在宅勤務併用"]', 5, 1, '復職後の働き方', '計画内容');

-- 人材開発支援助成金 (ID: 10) - 追加質問
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(10, 'jinzai_participants', '訓練を受ける従業員数は？', 'number', NULL, 4, 1, '受講予定人数', '計画内容'),
(10, 'jinzai_estimated_cost', '訓練に係る経費の見込みは？', 'text', NULL, 5, 1, '講師料、教材費、外部研修費用等', '費用');

-- 中小企業省力化投資補助金 (ID: 17)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(17, 'shoryokuka_employee_count', '従業員数は？', 'select', '["5人以下","6〜20人","21〜50人","51〜100人","101人以上"]', 1, 1, '補助上限額に影響', '企業情報'),
(17, 'shoryokuka_product_category', '導入予定の省力化製品カテゴリは？', 'select', '["清掃ロボット","配膳ロボット","検品システム","自動倉庫","券売機・精算機","その他"]', 2, 1, 'カタログ登録製品から選択', '製品情報'),
(17, 'shoryokuka_target_task', '導入により削減したい業務は？', 'text', NULL, 3, 1, '具体的な省力化効果', '目的'),
(17, 'shoryokuka_location', '事業場の所在地は？', 'text', NULL, 4, 1, '製品設置場所', '事業場情報'),
(17, 'shoryokuka_gbizid', 'GビズIDは取得済みですか？', 'radio', '["取得済み","申請中","未取得"]', 5, 1, '電子申請に必要', '手続き確認');

-- 中小企業新事業進出補助金 (ID: 18)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(18, 'shinjigyo_new_business', '新たに進出する事業分野は？', 'text', NULL, 1, 1, '新事業の概要', '事業計画'),
(18, 'shinjigyo_relation', '既存事業との関連性は？', 'select', '["全く新しい分野","関連分野への展開","既存技術の応用"]', 2, 1, '事業転換の程度', '事業計画'),
(18, 'shinjigyo_investment', '投資予定金額は？', 'select', '["500万円未満","500万〜1000万円","1000万〜3000万円","3000万円以上"]', 3, 1, '補助上限との兼ね合い', '費用'),
(18, 'shinjigyo_support', '認定支援機関との連携は？', 'radio', '["支援を受けている","これから相談予定","未定"]', 4, 1, '計画策定支援', '支援機関'),
(18, 'shinjigyo_sales_target', '新事業の売上目標は？', 'text', NULL, 5, 1, '3〜5年後の見込み', '事業計画');

-- 事業承継・M&A補助金 (ID: 20)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(20, 'jigyoshokei_type', '事業承継の類型は？', 'select', '["親族内承継","従業員承継（MBO）","第三者承継（M&A）","経営者交代後の設備投資"]', 1, 1, '申請類型を選択', '承継形態'),
(20, 'jigyoshokei_owner_age', '現経営者の年齢は？', 'select', '["60歳未満","60〜64歳","65〜69歳","70歳以上"]', 2, 1, '承継の緊急度', '経営者情報'),
(20, 'jigyoshokei_successor', '後継者は決まっていますか？', 'radio', '["決定済み","候補者あり","未定（M&A検討）"]', 3, 1, '承継計画の段階', '承継計画'),
(20, 'jigyoshokei_consultation', '専門家への相談状況は？', 'select', '["税理士","M&A仲介会社","事業承継・引継ぎ支援センター","相談していない"]', 4, 1, '支援機関の活用', '支援機関'),
(20, 'jigyoshokei_challenges', '承継にあたっての課題は？', 'checkbox', '["株式・資産の移転","従業員の雇用維持","取引先との関係","借入金の処理","後継者育成"]', 5, 1, '複数選択可', '課題');

-- 建設業許可 (ID: 21)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(21, 'kensetsu_license_type', '申請する許可の種類は？', 'select', '["一般建設業","特定建設業"]', 1, 1, '下請代金4500万円以上は特定', '許可種類'),
(21, 'kensetsu_gyoshu', '申請する業種は？', 'checkbox', '["土木一式","建築一式","大工","左官","とび・土工","電気","管","タイル・れんが","鋼構造物","鉄筋","舗装","塗装","防水","内装仕上","その他"]', 2, 1, '29業種から選択', '業種'),
(21, 'kensetsu_keiei_experience', '経営業務管理責任者の経験年数は？', 'select', '["5年以上","5年未満"]', 3, 1, '建設業の経営経験', '人的要件'),
(21, 'kensetsu_technical_qualifications', '専任技術者の資格は？', 'text', NULL, 4, 1, '1級・2級施工管理技士、建築士等', '人的要件'),
(21, 'kensetsu_office_type', '営業所の形態は？', 'select', '["自社所有","賃貸（事務所利用可）","自宅兼事務所"]', 5, 1, '独立した事務所が必要', '営業所'),
(21, 'kensetsu_social_insurance', '社会保険に加入していますか？', 'radio', '["全て加入","一部未加入","未加入"]', 6, 1, '令和2年10月から加入必須', '保険');

-- 飲食店営業許可 (ID: 22)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(22, 'inshoku_business_type', '営業形態は？', 'select', '["レストラン・食堂","居酒屋・バー","カフェ・喫茶店","弁当・惣菜販売","テイクアウト専門","その他"]', 1, 1, '許可の種類に影響', '事業形態'),
(22, 'inshoku_hygiene_manager', '食品衛生責任者は決まっていますか？', 'radio', '["資格保持者がいる","講習を受講予定","調理師免許保持者がいる"]', 2, 1, '必須資格', '人的要件'),
(22, 'inshoku_shop_status', '店舗の状況は？', 'select', '["新規内装工事予定","居抜き物件","工事済み"]', 3, 1, '設備基準の確認', '店舗'),
(22, 'inshoku_seats', '客席数は？', 'number', NULL, 4, 1, '設備基準の判断', '店舗'),
(22, 'inshoku_late_night', '深夜営業（0時以降）の予定は？', 'radio', '["あり","なし"]', 5, 1, '深夜酒類提供届出が必要', '営業時間');

-- 宅地建物取引業免許 (ID: 23)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(23, 'takken_license_type', '申請する免許の種類は？', 'select', '["都道府県知事免許（1都道府県）","国土交通大臣免許（複数都道府県）"]', 1, 1, '事務所の所在地による', '免許種類'),
(23, 'takken_specialist', '専任の宅地建物取引士は？', 'select', '["確保済み","採用予定","代表者が取得予定"]', 2, 1, '5人に1人以上必要', '人的要件'),
(23, 'takken_deposit_method', '営業保証金の供託方法は？', 'select', '["現金供託（1000万円）","保証協会加入（60万円）"]', 3, 1, '開業資金に影響', '資金'),
(23, 'takken_business_scope', '取り扱う予定の業務は？', 'checkbox', '["売買仲介","賃貸仲介","売買（自社物件）","賃貸管理"]', 4, 1, '事業計画', '事業内容'),
(23, 'takken_office_status', '事務所は確保していますか？', 'radio', '["確保済み","物件探し中","自宅兼事務所予定"]', 5, 1, '独立した事務所が必要', '事務所');

-- 古物商許可 (ID: 25)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(25, 'kobutsu_item_types', '取り扱う古物の種類は？', 'checkbox', '["美術品","衣類","時計・宝飾品","自動車","オートバイ","自転車","写真機","事務機器","機械工具","道具類","皮革・ゴム製品","書籍","金券類"]', 1, 1, '13品目から選択', '取扱品目'),
(25, 'kobutsu_sales_type', '営業形態は？', 'select', '["店舗販売","ネット販売（ECサイト）","買取専門","せり売り"]', 2, 1, '届出内容に影響', '事業形態'),
(25, 'kobutsu_online_sales', 'ネット販売を行いますか？', 'radio', '["行う","行わない"]', 3, 1, 'URL届出が必要', '確認事項'),
(25, 'kobutsu_disqualification', '申請者（代表者）に欠格事由はありませんか？', 'radio', '["該当なし","確認が必要"]', 4, 1, '過去5年の犯罪歴等', '確認事項');

-- 酒類販売業免許 (ID: 26)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(26, 'sake_license_type', '申請する免許の種類は？', 'select', '["一般酒類小売業免許（店舗販売）","通信販売酒類小売業免許（ネット販売）","酒類卸売業免許"]', 1, 1, '販売形態による', '免許種類'),
(26, 'sake_products', '販売予定の酒類は？', 'checkbox', '["ビール","清酒","焼酎","ワイン","ウイスキー","その他洋酒","地酒・クラフトビール"]', 2, 1, '仕入計画', '取扱商品'),
(26, 'sake_location', '販売場所は？', 'select', '["専門店（酒屋）","コンビニ・スーパー内","飲食店併設","ネット専業"]', 3, 1, '免許の種類に影響', '事業形態'),
(26, 'sake_funding', '資金繰りの状況は？', 'select', '["十分な自己資金あり","融資予定","検討中"]', 4, 1, '経営基盤の確認', '資金'),
(26, 'sake_experience', '酒類販売の経験は？', 'radio', '["あり","なし"]', 5, 1, '酒類販売管理者', '経験');

-- 労働者派遣事業許可 (ID: 30)
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, display_order, is_required, help_text, category) VALUES
(30, 'haken_industry', '派遣予定の業種は？', 'checkbox', '["事務","IT・エンジニア","製造","物流・軽作業","販売・サービス","医療・介護","その他"]', 1, 1, '派遣先業種', '事業計画'),
(30, 'haken_responsible_person', '派遣元責任者は決まっていますか？', 'radio', '["講習修了者がいる","講習受講予定","未定"]', 2, 1, '3年以上の経験必要', '人的要件'),
(30, 'haken_assets', '資産要件は満たしていますか？', 'select', '["2000万円以上あり","増資予定","要確認"]', 3, 1, '基準資産額2000万円', '財務要件'),
(30, 'haken_office_size', '事務所の広さは？', 'select', '["20㎡以上","20㎡未満"]', 4, 1, '面積要件あり', '事務所'),
(30, 'haken_career_support', '派遣労働者のキャリア形成支援制度は？', 'radio', '["整備済み","整備予定","未検討"]', 5, 1, '許可要件', '制度');
