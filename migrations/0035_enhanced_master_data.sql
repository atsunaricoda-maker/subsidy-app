-- マスターデータの充実化
-- 作成日: 2024-12-12

-- ============================================
-- 行政書士管轄の補助金を追加
-- ============================================

-- 中小企業デジタル化応援隊事業
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('中小企業デジタル化応援隊事業', '中小企業のデジタル化をIT専門家が支援する事業', '行政書士管轄');

-- 事業再構築補助金
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('事業再構築補助金', '新分野展開、業態転換、事業・業種転換等を支援', '行政書士管轄');

-- 創業助成金（東京都）
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('創業助成金', '都内で創業予定者または創業後5年未満の中小企業者等への助成', '行政書士管轄');

-- 販路開拓助成金
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('販路開拓助成金', '中小企業の販路開拓を支援する助成金', '行政書士管轄');

-- ものづくり・商業・サービス生産性向上促進補助金（グリーン枠）
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('ものづくり補助金（グリーン枠）', '温室効果ガス削減に資する革新的製品・サービス開発等の取組を支援', '行政書士管轄');

-- 中小企業経営力強化資金
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('中小企業経営強化税制', '設備投資を行う中小企業の税制優遇措置', '行政書士管轄');

-- ============================================
-- 社労士管轄の助成金を追加
-- ============================================

-- 地域雇用開発助成金
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('地域雇用開発助成金', '雇用機会が不足している地域で事業所を設置し、地域の求職者を雇用する事業主への助成', '社労士管轄');

-- 中途採用等支援助成金
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('中途採用等支援助成金', '中途採用者の雇用管理制度を整備し、中途採用の拡大を図る事業主への助成', '社労士管轄');

-- 障害者雇用安定助成金
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('障害者雇用安定助成金', '障害者の雇用を促進するための取組を行う事業主への助成', '社労士管轄');

-- 介護離職防止支援助成金
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('介護離職防止支援助成金', '仕事と介護の両立支援に取り組む事業主への助成', '社労士管轄');

-- 育児休業等支援コース
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('育児休業等支援コース', '育児休業の円滑な取得・職場復帰の取組を行う事業主への助成', '社労士管轄');

-- 男性育休取得促進助成金
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('出生時両立支援コース', '男性労働者の育児休業取得を促進する事業主への助成', '社労士管轄');

-- 勤務間インターバル導入コース
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('勤務間インターバル導入コース', '勤務間インターバル制度を導入する事業主への助成', '社労士管轄');

-- 労働時間短縮・年休促進支援コース
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('労働時間短縮・年休促進支援コース', '労働時間の短縮や年次有給休暇取得促進に取り組む事業主への助成', '社労士管轄');

-- 正社員化コース（キャリアアップ助成金のサブ）
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('キャリアアップ助成金（正社員化コース）', '非正規雇用労働者を正社員に転換する事業主への助成', '社労士管轄');

-- 賃金規定等改定コース
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('キャリアアップ助成金（賃金規定等改定コース）', '非正規雇用労働者の賃金規定を改定する事業主への助成', '社労士管轄');

-- ============================================
-- 許認可の種類を追加
-- ============================================

-- 電気工事業登録
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('電気工事業登録', '電気工事業を営むために必要な登録', '許認可');

-- 解体工事業登録
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('解体工事業登録', '解体工事業を営むために必要な登録', '許認可');

-- 警備業認定
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('警備業認定', '警備業を営むために必要な認定', '許認可');

-- 人材紹介業許可
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('有料職業紹介事業許可', '有料で職業紹介事業を行うための許可', '許認可');

-- 一般貸切旅客自動車運送事業許可
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('一般貸切旅客自動車運送事業許可', '貸切バス事業を営むための許可', '許認可');

-- 倉庫業登録
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('倉庫業登録', '倉庫業を営むために必要な登録', '許認可');

-- 金融商品取引業登録
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('金融商品取引業登録', '金融商品取引業を行うための登録', '許認可');

-- 宅建業免許更新
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('宅建業免許更新', '宅地建物取引業免許の更新手続き', '許認可');

-- 風俗営業許可
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('風俗営業許可', '風俗営業を行うための許可', '許認可');

-- 深夜酒類提供飲食店届出
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('深夜酒類提供飲食店届出', '深夜に酒類を提供する飲食店の届出', '許認可');

-- 特定建設業許可
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('特定建設業許可', '元請として大規模工事を行うための建設業許可', '許認可');

-- 一般建設業許可
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('一般建設業許可', '軽微な工事以外の建設工事を行うための許可', '許認可');

-- 測量業者登録
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('測量業者登録', '測量業を営むための登録', '許認可');

-- 建築士事務所登録
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('建築士事務所登録', '建築士事務所を開設するための登録', '許認可');

-- 医薬品販売業許可
INSERT OR IGNORE INTO subsidy_types (name, description, category) VALUES
('医薬品販売業許可', '医薬品を販売するための許可', '許認可');

-- ============================================
-- パイプラインテンプレートを追加
-- ============================================

-- 事業再構築補助金 パイプライン
INSERT INTO pipeline_templates (name, description, category)
VALUES ('事業再構築補助金 標準パイプライン', '事業再構築補助金申請の標準的な進行管理', 'subsidy');

-- 中途採用等支援助成金 パイプライン
INSERT INTO pipeline_templates (name, description, category)
VALUES ('中途採用等支援助成金 標準パイプライン', '中途採用等支援助成金申請の標準的な進行管理', 'grant');

-- 電気工事業登録 パイプライン
INSERT INTO pipeline_templates (name, description, category)
VALUES ('電気工事業登録 標準パイプライン', '電気工事業登録申請の標準的な進行管理', 'license');

-- 有料職業紹介事業許可 パイプライン
INSERT INTO pipeline_templates (name, description, category)
VALUES ('有料職業紹介事業許可 標準パイプライン', '有料職業紹介事業許可申請の標準的な進行管理', 'license');

-- 正社員化コース パイプライン
INSERT INTO pipeline_templates (name, description, category)
VALUES ('キャリアアップ助成金（正社員化）標準パイプライン', '正社員化コース申請の標準的な進行管理', 'grant');

-- 勤務間インターバル導入コース パイプライン
INSERT INTO pipeline_templates (name, description, category)
VALUES ('勤務間インターバル導入コース 標準パイプライン', '勤務間インターバル導入コース申請の標準的な進行管理', 'grant');

-- 警備業認定 パイプライン
INSERT INTO pipeline_templates (name, description, category)
VALUES ('警備業認定 標準パイプライン', '警備業認定申請の標準的な進行管理', 'license');

-- 創業助成金 パイプライン
INSERT INTO pipeline_templates (name, description, category)
VALUES ('創業助成金 標準パイプライン', '創業助成金申請の標準的な進行管理', 'subsidy');

-- 解体工事業登録 パイプライン
INSERT INTO pipeline_templates (name, description, category)
VALUES ('解体工事業登録 標準パイプライン', '解体工事業登録申請の標準的な進行管理', 'license');

-- 出生時両立支援コース パイプライン
INSERT INTO pipeline_templates (name, description, category)
VALUES ('出生時両立支援コース 標準パイプライン', '出生時両立支援コース申請の標準的な進行管理', 'grant');
