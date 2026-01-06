-- 主要な補助金パイプラインテンプレートを追加
-- ものづくり補助金、省力化投資補助金、その他を追加

-- ものづくり補助金 標準パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, progress_reflection, is_master_template)
VALUES ('ものづくり補助金 標準パイプライン', '革新的な製品・サービス開発や生産プロセスの省力化のための設備投資を支援する補助金申請の標準パイプライン', 'subsidy', 0, 90, 1, 1, 1, 1);

-- ものづくり補助金のタスク
INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT last_insert_rowid(), '初回ヒアリング・申請要件確認', 'internal', '事業内容、設備投資計画、補助対象経費の確認', 1, 0, 3, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '事業計画書（様式1）作成', 'internal', '補助事業の具体的内容、将来の展望等を記載', 2, 3, 20, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '数値目標設定・経営計画策定', 'internal', '付加価値額、給与支給総額等の目標設定', 3, 5, 15, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '設備投資計画・見積取得', 'external', '導入設備の仕様確定、複数社からの見積取得', 4, 7, 25, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '賃金引上げ計画の策定', 'internal', '事業場内最低賃金、給与支給総額の引上げ計画', 5, 10, 20, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '加点項目の確認・準備', 'internal', '成長性加点、政策加点、災害等加点の確認', 6, 10, 25, 0;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '添付書類の収集', 'external', '決算書、納税証明書、登記簿謄本等の収集', 7, 15, 30, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '申請書類の最終レビュー', 'internal', '事業計画書、経費明細等の整合性チェック', 8, 25, 35, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), 'GビズIDによる電子申請', 'internal', 'jGrants経由での電子申請手続き', 9, 35, 40, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '採択結果待ち', 'internal', '審査結果の確認（約2〜3ヶ月）', 10, 40, 90, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '交付申請手続き', 'internal', '採択後の交付申請書類の準備・提出', 11, 45, 60, 1;

-- 省力化投資補助金 標準パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, progress_reflection, is_master_template)
VALUES ('省力化投資補助金 標準パイプライン', '人手不足解消のための省力化投資を支援するカタログ型補助金の申請パイプライン', 'subsidy', 0, 45, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '初回ヒアリング・対象製品確認', 'internal', '人手不足の状況確認、カタログ製品の選定', 1, 0, 3, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), 'カタログ登録製品の選定', 'both', '省力化製品カタログから導入製品を選定', 2, 3, 10, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '販売事業者との連携', 'internal', 'カタログ登録販売事業者との契約準備', 3, 5, 15, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '賃金引上げ計画の策定', 'internal', '賃金引上げ要件の確認と計画策定', 4, 10, 20, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '必要書類の収集', 'external', '決算書、納税証明書、従業員情報等', 5, 10, 25, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '申請書類の作成', 'internal', '申請フォームへの入力・書類準備', 6, 20, 30, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '電子申請', 'internal', 'jGrants経由での電子申請', 7, 30, 35, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '採択結果確認', 'internal', '審査結果の確認', 8, 35, 45, 1;

-- 新事業進出補助金（中小企業新事業進出促進補助金）標準パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, progress_reflection, is_master_template)
VALUES ('新事業進出補助金 標準パイプライン', '中小企業の新分野展開、業態転換等を支援する補助金の申請パイプライン', 'subsidy', 0, 60, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '初回ヒアリング・事業計画確認', 'internal', '新事業の内容、市場性、実現可能性の確認', 1, 0, 3, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '事業類型の選定', 'internal', '新分野展開、業態転換、事業再編等の類型確認', 2, 3, 7, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '事業計画書の作成', 'internal', '補助事業の内容、収益計画、市場分析等', 3, 7, 30, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '経費明細・見積取得', 'external', '設備費、広告宣伝費等の見積収集', 4, 10, 35, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '認定経営革新等支援機関の確認書取得', 'internal', '金融機関等からの確認書取得', 5, 20, 40, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '添付書類の収集', 'external', '決算書、納税証明書、登記事項証明書等', 6, 25, 45, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '申請書類の最終確認', 'internal', '全書類の整合性チェック', 7, 40, 50, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '電子申請', 'internal', 'jGrants経由での電子申請', 8, 50, 55, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '採択結果待ち', 'internal', '審査結果の確認', 9, 55, 60, 1;

-- 中小企業経営強化税制 活用支援パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, progress_reflection, is_master_template)
VALUES ('経営強化税制 活用支援パイプライン', '中小企業経営強化税制（即時償却・税額控除）の活用支援パイプライン', 'subsidy', 0, 45, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '初回ヒアリング・設備投資計画確認', 'internal', '設備投資内容、適用類型の確認', 1, 0, 3, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '適用要件の確認', 'internal', 'A類型/B類型/C類型/D類型の確認', 2, 3, 7, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '経営力向上計画の作成', 'internal', '計画書の作成（A類型は工業会証明要）', 3, 7, 25, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '工業会証明書の取得（A類型）', 'external', 'メーカー経由で工業会証明書を取得', 4, 10, 30, 0;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '申請書類の準備', 'internal', '経営力向上計画申請書、添付書類の準備', 5, 20, 35, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '主務大臣への申請', 'internal', '所管省庁への計画認定申請', 6, 35, 40, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '認定書の受領', 'internal', '経営力向上計画認定書の受領', 7, 40, 45, 1;

-- 働き方改革推進支援助成金 標準パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, progress_reflection, is_master_template)
VALUES ('働き方改革推進支援助成金 標準パイプライン', '労働時間短縮、年休取得促進等の働き方改革を支援する助成金の申請パイプライン', 'grant', 0, 60, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '初回ヒアリング・現状確認', 'internal', '労働時間、年休取得状況等の現状確認', 1, 0, 3, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '適用コースの選定', 'internal', '労働時間短縮・年休促進支援/勤務間インターバル等', 2, 3, 7, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '成果目標の設定', 'internal', '時間外労働削減、年休取得日数増加等の目標設定', 3, 7, 14, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '取組内容・経費の確定', 'external', '労務管理用機器、研修等の見積取得', 4, 10, 25, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '交付申請書の作成', 'internal', '交付申請書、事業実施計画書の作成', 5, 20, 35, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '労働局への交付申請', 'internal', '都道府県労働局への申請手続き', 6, 35, 40, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '交付決定通知の受領', 'internal', '交付決定通知書の受領', 7, 40, 50, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '取組の実施', 'both', '計画に基づく取組の実施', 8, 50, 55, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '支給申請', 'internal', '実績報告・支給申請手続き', 9, 55, 60, 1;

-- トライアル雇用助成金 標準パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, progress_reflection, is_master_template)
VALUES ('トライアル雇用助成金 標準パイプライン', '職業経験不足等により就職困難な求職者を試行的に雇用する際の助成金申請パイプライン', 'grant', 0, 45, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '初回ヒアリング・対象者確認', 'internal', 'トライアル雇用対象者の要件確認', 1, 0, 3, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), 'ハローワークへの求人申込', 'internal', 'トライアル雇用求人の申込手続き', 2, 3, 10, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '対象者の面接・採用', 'external', 'ハローワーク紹介による採用選考', 3, 10, 20, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '実施計画書の作成', 'internal', 'トライアル雇用実施計画書の作成', 4, 15, 25, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '計画書の提出', 'internal', 'ハローワークへの計画書提出（雇用開始から2週間以内）', 5, 20, 30, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), 'トライアル期間の実施', 'both', '3ヶ月間のトライアル雇用実施', 6, 25, 35, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '結果報告書・支給申請', 'internal', 'トライアル雇用結果報告書の提出・支給申請', 7, 35, 45, 1;

-- 65歳超雇用推進助成金 標準パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, progress_reflection, is_master_template)
VALUES ('65歳超雇用推進助成金 標準パイプライン', '高年齢者の雇用推進のための就業規則改定等を支援する助成金の申請パイプライン', 'grant', 0, 60, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '初回ヒアリング・現状確認', 'internal', '現行の定年制度、継続雇用制度の確認', 1, 0, 3, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '適用コースの選定', 'internal', '65歳超継続雇用促進/高年齢者無期雇用転換等', 2, 3, 7, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '就業規則改定案の作成', 'internal', '定年引上げ、継続雇用延長等の規則改定', 3, 7, 25, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '労使協定の締結（必要時）', 'external', '従業員代表との協議・協定締結', 4, 20, 35, 0;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '就業規則の届出', 'internal', '労働基準監督署への届出', 5, 30, 40, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '支給申請書類の準備', 'internal', '申請書、添付書類の準備', 6, 40, 50, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '高齢・障害・求職者雇用支援機構への申請', 'internal', 'JEEDへの支給申請', 7, 50, 55, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '支給決定・入金確認', 'internal', '支給決定通知の受領、入金確認', 8, 55, 60, 1;

-- 地域観光事業支援補助金 標準パイプライン
INSERT INTO pipeline_templates (name, description, category, service_start_offset, service_end_offset, is_active, requires_approval, progress_reflection, is_master_template)
VALUES ('地域観光事業支援補助金 標準パイプライン', '観光事業者向けの地域活性化支援補助金の申請パイプライン', 'subsidy', 0, 45, 1, 1, 1, 1);

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '初回ヒアリング・事業内容確認', 'internal', '観光事業の内容、補助対象経費の確認', 1, 0, 3, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '自治体要綱の確認', 'internal', '都道府県・市区町村の補助要綱確認', 2, 3, 7, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '事業計画書の作成', 'internal', '事業内容、効果見込み、収支計画の作成', 3, 7, 25, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '見積書・経費明細の準備', 'external', '補助対象経費の見積取得', 4, 15, 30, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '申請書類の作成', 'internal', '申請書、添付書類の準備', 5, 25, 35, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '申請手続き', 'internal', '自治体窓口への申請', 6, 35, 40, 1;

INSERT INTO pipeline_template_tasks (template_id, task_name, task_type, description, sort_order, days_offset_start, days_offset_end, is_required)
SELECT (SELECT MAX(id) FROM pipeline_templates), '交付決定・事業実施', 'both', '交付決定後の事業実施', 7, 40, 45, 1;

-- 既存テンプレートのis_master_templateフラグを更新（まだ設定されていないもの）
UPDATE pipeline_templates SET is_master_template = 1 WHERE organization_id IS NULL AND is_master_template IS NULL;
