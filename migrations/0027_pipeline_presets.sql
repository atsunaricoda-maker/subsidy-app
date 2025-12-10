-- =====================================================
-- パイプラインテンプレート充実化
-- 補助金・助成金・許認可それぞれに最適化したパイプラインを追加
-- =====================================================

-- =====================================================
-- 1. 補助金系パイプライン（行政書士管轄）
-- =====================================================

-- ものづくり補助金 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('ものづくり補助金 標準パイプライン', 'ものづくり・商業・サービス生産性向上促進補助金の申請ワークフロー', 'subsidy', 0, 120, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '事前相談・要件確認', 'internal', '補助対象事業・経費の確認、申請要件の適合性チェック', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = 'ものづくり補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, 'GビズIDプライム取得支援', 'external', 'GビズIDプライムアカウントの取得サポート（未取得の場合）', 2, 0, 14, 1, 'client'
FROM pipeline_templates WHERE name = 'ものづくり補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '事業計画書作成', 'internal', '補助事業の具体的内容、革新性、将来の展望等を記載', 3, 7, 45, 1, 'admin'
FROM pipeline_templates WHERE name = 'ものづくり補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '数値目標・収支計画作成', 'internal', '付加価値額・給与支給総額等の計画値算出', 4, 30, 50, 1, 'admin'
FROM pipeline_templates WHERE name = 'ものづくり補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '決算書、確定申告書、見積書、カタログ等の収集', 5, 14, 55, 1, 'client'
FROM pipeline_templates WHERE name = 'ものづくり補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '加点項目対応', 'internal', '経営革新計画、事業継続力強化計画等の取得支援', 6, 30, 60, 0, 'admin'
FROM pipeline_templates WHERE name = 'ものづくり補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, 'Jグランツ電子申請', 'internal', '電子申請システムへの入力・提出', 7, 55, 60, 1, 'admin'
FROM pipeline_templates WHERE name = 'ものづくり補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '採択結果確認・交付申請', 'internal', '採択後の交付申請手続き', 8, 60, 90, 1, 'admin'
FROM pipeline_templates WHERE name = 'ものづくり補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '実績報告支援', 'internal', '事業完了後の実績報告書作成支援', 9, 90, 120, 1, 'admin'
FROM pipeline_templates WHERE name = 'ものづくり補助金 標準パイプライン';


-- 小規模事業者持続化補助金 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('小規模事業者持続化補助金 標準パイプライン', '販路開拓・生産性向上のための小規模事業者向け補助金', 'subsidy', 0, 60, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '要件確認・商工会議所確認', 'internal', '小規模事業者要件の確認、管轄商工会議所の確認', 1, 0, 5, 1, 'admin'
FROM pipeline_templates WHERE name = '小規模事業者持続化補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '経営計画書作成', 'internal', '企業概要、顧客ニーズ、市場動向、経営方針等の記載', 2, 5, 25, 1, 'admin'
FROM pipeline_templates WHERE name = '小規模事業者持続化補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '補助事業計画書作成', 'internal', '販路開拓等の取組内容、補助事業の効果の記載', 3, 15, 30, 1, 'admin'
FROM pipeline_templates WHERE name = '小規模事業者持続化補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '確定申告書、開業届、見積書等の収集', 4, 10, 35, 1, 'client'
FROM pipeline_templates WHERE name = '小規模事業者持続化補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '商工会議所での確認・押印', 'external', '事業支援計画書の発行依頼', 5, 30, 40, 1, 'client'
FROM pipeline_templates WHERE name = '小規模事業者持続化補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '電子申請', 'internal', 'Jグランツでの電子申請', 6, 40, 45, 1, 'admin'
FROM pipeline_templates WHERE name = '小規模事業者持続化補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '採択後フォロー・実績報告', 'internal', '採択後の報告書作成支援', 7, 45, 60, 1, 'admin'
FROM pipeline_templates WHERE name = '小規模事業者持続化補助金 標準パイプライン';


-- 事業承継・M&A補助金 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('事業承継・M&A補助金 標準パイプライン', '事業承継やM&Aを契機とした新たな取り組みを支援', 'subsidy', 0, 90, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '事業承継状況ヒアリング', 'internal', '承継形態（親族内/従業員/M&A）の確認、進捗状況確認', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = '事業承継・M&A補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '認定支援機関確認書取得', 'external', '認定経営革新等支援機関の確認書取得', 2, 7, 21, 1, 'client'
FROM pipeline_templates WHERE name = '事業承継・M&A補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '事業計画書作成', 'internal', '承継後の経営革新等の取組計画', 3, 14, 50, 1, 'admin'
FROM pipeline_templates WHERE name = '事業承継・M&A補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '承継関連書類、決算書、事業譲渡契約書等', 4, 21, 55, 1, 'client'
FROM pipeline_templates WHERE name = '事業承継・M&A補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '電子申請', 'internal', 'Jグランツでの電子申請', 5, 55, 60, 1, 'admin'
FROM pipeline_templates WHERE name = '事業承継・M&A補助金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '採択後対応・実績報告', 'internal', '交付申請、実績報告支援', 6, 60, 90, 1, 'admin'
FROM pipeline_templates WHERE name = '事業承継・M&A補助金 標準パイプライン';


-- =====================================================
-- 2. 助成金系パイプライン（社労士管轄）
-- =====================================================

-- キャリアアップ助成金パイプライン（既存テンプレートにタスク追加）
INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '対象労働者確認', 'internal', '有期契約労働者等の雇用状況確認、転換要件チェック', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = 'キャリアアップ助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, 'キャリアアップ計画書作成・届出', 'internal', '計画期間、目標、取組内容の計画書作成・労働局届出', 2, 7, 21, 1, 'admin'
FROM pipeline_templates WHERE name = 'キャリアアップ助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '就業規則整備', 'internal', '正社員転換制度等の規定整備、労基署届出', 3, 14, 35, 1, 'admin'
FROM pipeline_templates WHERE name = 'キャリアアップ助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '転換実施・賃金改定', 'external', '正社員等への転換実施、3%以上の賃金増額', 4, 35, 45, 1, 'client'
FROM pipeline_templates WHERE name = 'キャリアアップ助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '6ヶ月継続雇用確認', 'external', '転換後6ヶ月間の継続雇用・賃金支払い確認', 5, 45, 225, 1, 'client'
FROM pipeline_templates WHERE name = 'キャリアアップ助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '支給申請書作成・提出', 'internal', '支給申請書類一式の作成・労働局提出', 6, 225, 240, 1, 'admin'
FROM pipeline_templates WHERE name = 'キャリアアップ助成金 標準パイプライン';


-- 雇用調整助成金 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('雇用調整助成金 標準パイプライン', '経済上の理由により事業活動の縮小を余儀なくされた場合の休業等支援', 'grant', 0, 90, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '支給要件確認', 'internal', '売上減少要件、雇用保険適用事業所要件等の確認', 1, 0, 5, 1, 'admin'
FROM pipeline_templates WHERE name = '雇用調整助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '休業計画策定', 'internal', '休業規模、対象者、休業日数の計画策定', 2, 5, 14, 1, 'admin'
FROM pipeline_templates WHERE name = '雇用調整助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '労使協定締結', 'external', '休業に関する労使協定の締結', 3, 10, 21, 1, 'client'
FROM pipeline_templates WHERE name = '雇用調整助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '休業等実施計画届提出', 'internal', '管轄労働局への計画届提出', 4, 14, 21, 1, 'admin'
FROM pipeline_templates WHERE name = '雇用調整助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '休業実施・休業手当支払', 'external', '計画に基づく休業実施、休業手当の支払い', 5, 21, 60, 1, 'client'
FROM pipeline_templates WHERE name = '雇用調整助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '支給申請書作成', 'internal', '支給申請書、出勤簿、賃金台帳等の整理・作成', 6, 60, 75, 1, 'admin'
FROM pipeline_templates WHERE name = '雇用調整助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '労働局へ申請・審査対応', 'internal', '申請書提出、追加資料対応', 7, 75, 90, 1, 'admin'
FROM pipeline_templates WHERE name = '雇用調整助成金 標準パイプライン';


-- 人材開発支援助成金 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('人材開発支援助成金 標準パイプライン', '従業員の職業訓練を実施する事業主への助成', 'grant', 0, 120, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '訓練コース確認', 'internal', '特定訓練/一般訓練/教育訓練休暇等のコース選定', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = '人材開発支援助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '訓練計画作成', 'internal', '訓練内容、対象者、期間、費用の計画策定', 2, 7, 21, 1, 'admin'
FROM pipeline_templates WHERE name = '人材開発支援助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '計画届提出', 'internal', '訓練開始1ヶ月前までに労働局へ計画届提出', 3, 14, 30, 1, 'admin'
FROM pipeline_templates WHERE name = '人材開発支援助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '訓練実施', 'external', '計画に基づく訓練の実施', 4, 30, 90, 1, 'client'
FROM pipeline_templates WHERE name = '人材開発支援助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '訓練記録整備', 'external', '受講者名簿、訓練日誌等の記録整備', 5, 30, 95, 1, 'client'
FROM pipeline_templates WHERE name = '人材開発支援助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '支給申請書作成・提出', 'internal', '訓練終了後2ヶ月以内に支給申請', 6, 90, 120, 1, 'admin'
FROM pipeline_templates WHERE name = '人材開発支援助成金 標準パイプライン';


-- 両立支援等助成金 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('両立支援等助成金 標準パイプライン', '仕事と家庭の両立支援に取り組む事業主への助成', 'grant', 0, 180, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, 'コース選定・要件確認', 'internal', '出生時両立支援/育児休業等支援/介護離職防止支援等の選定', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = '両立支援等助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '就業規則整備', 'internal', '育児・介護休業規程等の整備・届出', 2, 7, 30, 1, 'admin'
FROM pipeline_templates WHERE name = '両立支援等助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '対象者面談・計画作成', 'external', '育休取得予定者との面談、休業・復帰計画作成', 3, 14, 45, 1, 'client'
FROM pipeline_templates WHERE name = '両立支援等助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '休業取得・職場復帰', 'external', '育児休業等の取得、原職復帰の実施', 4, 45, 150, 1, 'client'
FROM pipeline_templates WHERE name = '両立支援等助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '支給申請書作成・提出', 'internal', '復帰後6ヶ月経過後等に支給申請', 5, 150, 180, 1, 'admin'
FROM pipeline_templates WHERE name = '両立支援等助成金 標準パイプライン';


-- 特定求職者雇用開発助成金 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('特定求職者雇用開発助成金 標準パイプライン', '高齢者・障害者・母子家庭の母等の就職困難者を雇用する事業主への助成', 'grant', 0, 365, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '対象労働者・コース確認', 'internal', '特定就職困難者/生涯現役/被災者雇用開発等のコース確認', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = '特定求職者雇用開発助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, 'ハローワーク紹介確認', 'external', 'ハローワーク等の紹介による雇入れであることの確認', 2, 0, 14, 1, 'client'
FROM pipeline_templates WHERE name = '特定求職者雇用開発助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '雇用契約・労働条件確認', 'internal', '雇用期間、労働時間等の支給要件確認', 3, 7, 21, 1, 'admin'
FROM pipeline_templates WHERE name = '特定求職者雇用開発助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '6ヶ月雇用継続', 'external', '支給対象期（6ヶ月）の雇用継続', 4, 21, 200, 1, 'client'
FROM pipeline_templates WHERE name = '特定求職者雇用開発助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '第1期支給申請', 'internal', '第1期（雇入れ後6ヶ月）の支給申請', 5, 200, 230, 1, 'admin'
FROM pipeline_templates WHERE name = '特定求職者雇用開発助成金 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '第2期支給申請', 'internal', '第2期（雇入れ後1年）の支給申請', 6, 350, 365, 1, 'admin'
FROM pipeline_templates WHERE name = '特定求職者雇用開発助成金 標準パイプライン';


-- =====================================================
-- 3. 許認可系パイプライン（行政書士管轄）
-- =====================================================

-- 建設業許可 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('建設業許可 標準パイプライン', '建設業許可（知事許可・大臣許可）の新規取得申請', 'license', 0, 60, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '許可要件診断', 'internal', '経営業務管理責任者・専任技術者等の要件確認', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = '建設業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '業種選定', 'internal', '取得する建設業の業種（29業種から）選定', 2, 5, 10, 1, 'admin'
FROM pipeline_templates WHERE name = '建設業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '登記簿謄本、身分証明書、登記されていないことの証明書、実務経験証明書等', 3, 7, 30, 1, 'client'
FROM pipeline_templates WHERE name = '建設業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '財務諸表作成', 'internal', '建設業財務諸表への組替え', 4, 14, 35, 1, 'admin'
FROM pipeline_templates WHERE name = '建設業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '申請書類作成', 'internal', '許可申請書、営業所一覧、役員一覧等の作成', 5, 25, 40, 1, 'admin'
FROM pipeline_templates WHERE name = '建設業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '都道府県庁申請', 'internal', '申請書提出・手数料納付', 6, 40, 45, 1, 'admin'
FROM pipeline_templates WHERE name = '建設業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '審査対応・許可取得', 'internal', '補正対応、許可通知書受領', 7, 45, 60, 1, 'admin'
FROM pipeline_templates WHERE name = '建設業許可 標準パイプライン';


-- 飲食店営業許可 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('飲食店営業許可 標準パイプライン', '飲食店開業のための営業許可申請', 'license', 0, 30, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '事前相談・施設基準確認', 'internal', '営業施設基準の確認、保健所への事前相談', 1, 0, 5, 1, 'admin'
FROM pipeline_templates WHERE name = '飲食店営業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '食品衛生責任者確認', 'external', '食品衛生責任者資格の取得確認（未取得の場合は講習受講）', 2, 0, 14, 1, 'client'
FROM pipeline_templates WHERE name = '飲食店営業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '店舗図面、水質検査証明書、登記簿謄本等', 3, 5, 15, 1, 'client'
FROM pipeline_templates WHERE name = '飲食店営業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '申請書類作成', 'internal', '営業許可申請書の作成', 4, 10, 18, 1, 'admin'
FROM pipeline_templates WHERE name = '飲食店営業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '保健所申請', 'internal', '申請書提出・手数料納付', 5, 18, 20, 1, 'admin'
FROM pipeline_templates WHERE name = '飲食店営業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '施設検査立会い', 'internal', '保健所による施設検査への立会い', 6, 20, 25, 1, 'admin'
FROM pipeline_templates WHERE name = '飲食店営業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '許可証受領', 'internal', '営業許可証の受領、営業開始', 7, 25, 30, 1, 'admin'
FROM pipeline_templates WHERE name = '飲食店営業許可 標準パイプライン';


-- 宅地建物取引業免許 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('宅地建物取引業免許 標準パイプライン', '宅地建物取引業の免許申請', 'license', 0, 60, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '免許要件確認', 'internal', '欠格要件、事務所要件、専任宅建士要件の確認', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = '宅地建物取引業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '事務所準備', 'external', '事務所の契約、専用出入口・応接設備等の準備', 2, 0, 21, 1, 'client'
FROM pipeline_templates WHERE name = '宅地建物取引業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '身分証明書、登記されていないことの証明書、略歴書、宅建士証写し等', 3, 7, 30, 1, 'client'
FROM pipeline_templates WHERE name = '宅地建物取引業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '申請書類作成', 'internal', '免許申請書、事務所写真、専任宅建士設置証明等の作成', 4, 21, 35, 1, 'admin'
FROM pipeline_templates WHERE name = '宅地建物取引業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '都道府県庁申請', 'internal', '申請書提出・手数料納付', 5, 35, 40, 1, 'admin'
FROM pipeline_templates WHERE name = '宅地建物取引業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '保証協会加入手続き', 'external', '宅建協会or不動産協会への加入、弁済業務保証金分担金納付', 6, 40, 55, 1, 'client'
FROM pipeline_templates WHERE name = '宅地建物取引業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '免許証受領・営業開始届', 'internal', '免許証受領、営業開始届提出', 7, 55, 60, 1, 'admin'
FROM pipeline_templates WHERE name = '宅地建物取引業免許 標準パイプライン';


-- 古物商許可 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('古物商許可 標準パイプライン', '中古品売買のための古物商許可申請', 'license', 0, 45, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '取扱品目確認', 'internal', '13品目からの取扱品目選定、営業所確認', 1, 0, 5, 1, 'admin'
FROM pipeline_templates WHERE name = '古物商許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '欠格要件確認', 'internal', '許可欠格要件の該当有無確認', 2, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = '古物商許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '住民票、身分証明書、登記されていないことの証明書、略歴書等', 3, 5, 20, 1, 'client'
FROM pipeline_templates WHERE name = '古物商許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '申請書類作成', 'internal', '許可申請書、営業所見取図等の作成', 4, 15, 25, 1, 'admin'
FROM pipeline_templates WHERE name = '古物商許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '警察署申請', 'internal', '申請書提出・手数料納付', 5, 25, 28, 1, 'admin'
FROM pipeline_templates WHERE name = '古物商許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '許可証受領・プレート作成', 'internal', '許可証受領、古物商プレート作成', 6, 28, 45, 1, 'admin'
FROM pipeline_templates WHERE name = '古物商許可 標準パイプライン';


-- 産業廃棄物収集運搬業許可 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('産業廃棄物収集運搬業許可 標準パイプライン', '産業廃棄物の収集運搬業許可申請', 'license', 0, 90, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '許可要件確認', 'internal', '施設要件、能力要件、欠格要件の確認', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = '産業廃棄物収集運搬業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '講習会受講', 'external', '産廃収集運搬業の許可講習会受講（約2日間）', 2, 0, 30, 1, 'client'
FROM pipeline_templates WHERE name = '産業廃棄物収集運搬業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '車両・容器準備', 'external', '運搬車両の用意、収集運搬に適した容器の準備', 3, 7, 40, 1, 'client'
FROM pipeline_templates WHERE name = '産業廃棄物収集運搬業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '登記簿謄本、決算書、車検証、講習会修了証等', 4, 30, 50, 1, 'client'
FROM pipeline_templates WHERE name = '産業廃棄物収集運搬業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '申請書類作成', 'internal', '許可申請書、事業計画書、車両写真等の作成', 5, 40, 60, 1, 'admin'
FROM pipeline_templates WHERE name = '産業廃棄物収集運搬業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '都道府県申請', 'internal', '申請書提出・手数料納付（積替え保管なし:81,000円）', 6, 60, 65, 1, 'admin'
FROM pipeline_templates WHERE name = '産業廃棄物収集運搬業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '審査対応・許可取得', 'internal', '補正対応、許可証受領', 7, 65, 90, 1, 'admin'
FROM pipeline_templates WHERE name = '産業廃棄物収集運搬業許可 標準パイプライン';


-- 貨物自動車運送事業許可 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('貨物自動車運送事業許可 標準パイプライン', '一般貨物自動車運送事業の許可申請', 'license', 0, 180, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '許可要件確認', 'internal', '営業所・車庫・車両・資金・法令試験等の要件確認', 1, 0, 14, 1, 'admin'
FROM pipeline_templates WHERE name = '貨物自動車運送事業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '営業所・車庫確保', 'external', '営業所（休憩睡眠施設含む）、車庫の契約', 2, 7, 45, 1, 'client'
FROM pipeline_templates WHERE name = '貨物自動車運送事業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '車両確保（5台以上）', 'external', '事業用車両の確保（最低5台）', 3, 14, 60, 1, 'client'
FROM pipeline_templates WHERE name = '貨物自動車運送事業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '運行管理者・整備管理者選任', 'external', '運行管理者資格者・整備管理者の確保', 4, 21, 60, 1, 'client'
FROM pipeline_templates WHERE name = '貨物自動車運送事業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '登記簿謄本、残高証明書、車両関係書類、図面等', 5, 45, 75, 1, 'client'
FROM pipeline_templates WHERE name = '貨物自動車運送事業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '申請書類作成', 'internal', '許可申請書、事業計画書、運行管理体制等の作成', 6, 60, 90, 1, 'admin'
FROM pipeline_templates WHERE name = '貨物自動車運送事業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '運輸支局申請', 'internal', '申請書提出・手数料納付', 7, 90, 95, 1, 'admin'
FROM pipeline_templates WHERE name = '貨物自動車運送事業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '法令試験受験', 'external', '役員法令試験の受験（2ヶ月に1回実施）', 8, 95, 130, 1, 'client'
FROM pipeline_templates WHERE name = '貨物自動車運送事業許可 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '許可取得・届出', 'internal', '許可証受領、運輸開始届提出', 9, 130, 180, 1, 'admin'
FROM pipeline_templates WHERE name = '貨物自動車運送事業許可 標準パイプライン';


-- 旅行業登録 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('旅行業登録 標準パイプライン', '旅行業（第1種～第3種・地域限定）の登録申請', 'license', 0, 60, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '登録種別確認', 'internal', '第1種/第2種/第3種/地域限定の選定、基準資産額確認', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = '旅行業登録 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '旅行業務取扱管理者確保', 'external', '総合or国内旅行業務取扱管理者の確保', 2, 0, 21, 1, 'client'
FROM pipeline_templates WHERE name = '旅行業登録 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '営業保証金準備', 'external', '営業保証金の供託or旅行業協会加入準備', 3, 7, 35, 1, 'client'
FROM pipeline_templates WHERE name = '旅行業登録 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '登記簿謄本、定款、決算書、管理者資格証明等', 4, 14, 35, 1, 'client'
FROM pipeline_templates WHERE name = '旅行業登録 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '申請書類作成', 'internal', '登録申請書、旅行業約款等の作成', 5, 28, 40, 1, 'admin'
FROM pipeline_templates WHERE name = '旅行業登録 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '都道府県申請', 'internal', '申請書提出・登録手数料納付', 6, 40, 45, 1, 'admin'
FROM pipeline_templates WHERE name = '旅行業登録 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '登録完了・営業開始届', 'internal', '登録通知受領、営業保証金届出', 7, 45, 60, 1, 'admin'
FROM pipeline_templates WHERE name = '旅行業登録 標準パイプライン';


-- 介護事業所指定申請 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('介護事業所指定申請 標準パイプライン', '介護保険サービス事業所の指定申請', 'license', 0, 90, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, 'サービス種別・指定基準確認', 'internal', '訪問介護/通所介護/居宅介護支援等のサービス選定、人員基準確認', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = '介護事業所指定申請 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '法人設立/定款変更', 'external', '介護事業を行える法人格の確保、定款目的追加', 2, 0, 30, 0, 'client'
FROM pipeline_templates WHERE name = '介護事業所指定申請 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '事業所・設備準備', 'external', '事業所の契約、設備基準を満たす環境整備', 3, 14, 45, 1, 'client'
FROM pipeline_templates WHERE name = '介護事業所指定申請 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '人員確保・資格確認', 'external', '管理者、サービス提供責任者、介護福祉士等の確保', 4, 21, 50, 1, 'client'
FROM pipeline_templates WHERE name = '介護事業所指定申請 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '登記簿謄本、定款、資格証明書、雇用契約書、図面等', 5, 35, 55, 1, 'client'
FROM pipeline_templates WHERE name = '介護事業所指定申請 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '運営規程・各種マニュアル作成', 'internal', '運営規程、重要事項説明書、契約書等の作成', 6, 45, 60, 1, 'admin'
FROM pipeline_templates WHERE name = '介護事業所指定申請 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '申請書類作成', 'internal', '指定申請書、付表、添付書類の作成', 7, 55, 70, 1, 'admin'
FROM pipeline_templates WHERE name = '介護事業所指定申請 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '都道府県・市町村申請', 'internal', '指定申請書提出（毎月締切あり）', 8, 70, 75, 1, 'admin'
FROM pipeline_templates WHERE name = '介護事業所指定申請 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '指定取得・届出', 'internal', '指定通知書受領、介護保険事業所番号取得', 9, 75, 90, 1, 'admin'
FROM pipeline_templates WHERE name = '介護事業所指定申請 標準パイプライン';


-- 酒類販売業免許 パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, allow_external_tasks, progress_reflection)
VALUES ('酒類販売業免許 標準パイプライン', '酒類販売業（一般/通信販売）の免許申請', 'license', 0, 90, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '免許区分・要件確認', 'internal', '一般酒類小売業/通信販売酒類小売業の選定、要件確認', 1, 0, 7, 1, 'admin'
FROM pipeline_templates WHERE name = '酒類販売業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '酒類販売管理研修受講', 'external', '酒類販売管理研修の受講（初回は免許申請前に）', 2, 0, 21, 1, 'client'
FROM pipeline_templates WHERE name = '酒類販売業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '販売場所準備', 'external', '販売場所の契約、設備準備', 3, 7, 35, 1, 'client'
FROM pipeline_templates WHERE name = '酒類販売業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '必要書類収集', 'external', '登記簿謄本、決算書、賃貸借契約書、住民票、図面等', 4, 21, 45, 1, 'client'
FROM pipeline_templates WHERE name = '酒類販売業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '申請書類作成', 'internal', '免許申請書、販売業免許申請書次葉等の作成', 5, 35, 55, 1, 'admin'
FROM pipeline_templates WHERE name = '酒類販売業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '税務署申請', 'internal', '申請書提出・登録免許税準備', 6, 55, 60, 1, 'admin'
FROM pipeline_templates WHERE name = '酒類販売業免許 標準パイプライン';

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required, default_assignee_role)
SELECT id, '審査対応・免許取得', 'internal', '現地確認対応、免許通知書受領', 7, 60, 90, 1, 'admin'
FROM pipeline_templates WHERE name = '酒類販売業免許 標準パイプライン';
