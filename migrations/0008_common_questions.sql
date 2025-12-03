-- =====================================================
-- 共通ヒアリング質問（全補助金で使用）
-- subsidy_type_id = 0 は共通質問を意味する
-- =====================================================

-- SQLiteの外部キー制約を一時的に無効化
PRAGMA foreign_keys = OFF;

-- まず共通質問用の仮想補助金タイプを作成（ID=0として明示的に挿入）
INSERT OR IGNORE INTO subsidy_types (id, name, category, description) 
VALUES (0, '共通質問', 'システム', '全補助金で共通して使用する質問');

-- 共通質問を挿入
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
VALUES 
  -- 企業基本情報（共通）
  (0, 'common_company_overview', '御社の事業内容を教えてください', 'textarea', NULL, '企業情報', 1, 1, '主な事業、取扱製品・サービス、創業年、特徴などを具体的に記載してください', '当社は2005年創業の○○業で、主に△△を提供しています。従業員10名で地域密着型のサービスを展開しています。', 'company_overview'),
  
  (0, 'common_employee_count', '従業員数を教えてください', 'number', NULL, '企業情報', 1, 2, '正社員・パート・アルバイト含めた総数', '15', 'company_overview'),
  
  (0, 'common_annual_revenue', '直近の年商（売上高）を教えてください', 'number', NULL, '企業情報', 1, 3, '万円単位で入力してください（例: 5000万円なら「5000」）', '8000', 'company_overview'),
  
  (0, 'common_establishment_year', '創業・設立年を教えてください', 'text', NULL, '企業情報', 0, 4, '西暦で入力してください', '2005', 'company_overview'),
  
  (0, 'common_business_area', '主な事業エリア・商圏を教えてください', 'text', NULL, '企業情報', 0, 5, '例: 東京都内、関東一円、全国など', '神奈川県内を中心に関東一円', 'company_overview'),

  -- 課題・ニーズ（共通）
  (0, 'common_current_issues', '現在の業務で困っていること・課題は何ですか？', 'textarea', NULL, '課題分析', 1, 10, '業務効率、人手不足、売上低迷、設備老朽化など具体的に記載してください', '受注から納品までの業務が手作業中心で、ミスが多く残業も増えている。', 'current_situation'),
  
  (0, 'common_issue_impact', 'その課題によってどのような影響が出ていますか？', 'textarea', NULL, '課題分析', 1, 11, '時間的損失、コスト増、機会損失、顧客への影響など', '月に約30時間の残業が発生し、従業員の負担増と年間約100万円のコスト増となっている。', 'current_situation'),

  -- 補助金で実現したいこと（共通）
  (0, 'common_what_to_achieve', '今回の補助金で何を実現したいですか？', 'textarea', NULL, '事業計画', 1, 20, '導入したい設備・システム、取り組みたい事業など', '業務管理システムを導入して、受発注から請求までを一元管理し、業務効率化を図りたい。', 'implementation_plan'),
  
  (0, 'common_expected_effect', '実現後にどのような効果を期待していますか？', 'textarea', NULL, '期待効果', 1, 21, '業務効率化、コスト削減、売上向上など具体的な数値目標があれば記載', '残業時間を月30時間から10時間に削減し、年間60万円のコスト削減を見込む。', 'expected_results'),
  
  (0, 'common_investment_budget', '投資予算の目安を教えてください', 'text', NULL, '事業計画', 0, 22, '概算で構いません（例: 300万円程度）', '500万円程度', 'implementation_plan'),

  -- 将来ビジョン（共通）
  (0, 'common_future_vision', '3年後、5年後の御社のビジョンを教えてください', 'textarea', NULL, '将来計画', 1, 30, '成長目標、事業展開の方向性、目指す姿など', '3年後には売上1.5倍、5年後には新規事業を立ち上げ、地域No.1の○○企業を目指す。', 'future_plan');

-- 外部キー制約を再度有効化
PRAGMA foreign_keys = ON;
