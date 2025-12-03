-- 小規模事業者持続化補助金用の文書テンプレート
INSERT INTO document_templates (subsidy_type_id, template_name, template_version, sections, ai_prompt_base)
VALUES (
  5,
  '小規模事業者持続化補助金 経営計画書・補助事業計画書',
  'v2024',
  '[
    {"id": "company_overview", "title": "1. 企業概要", "max_chars": 1500, "description": "会社の沿革、経営理念、主な事業内容"},
    {"id": "market_analysis", "title": "2. 顧客ニーズと市場の動向", "max_chars": 2000, "description": "ターゲット顧客、市場環境、競合状況の分析"},
    {"id": "current_situation", "title": "3. 自社や自社の提供する商品・サービスの強み", "max_chars": 2000, "description": "競合との差別化ポイント、独自の強み"},
    {"id": "management_direction", "title": "4. 経営方針・目標と今後のプラン", "max_chars": 2000, "description": "中長期的な経営の方向性、売上目標"},
    {"id": "business_plan", "title": "5. 補助事業で行う事業名・内容", "max_chars": 2500, "description": "具体的な販路開拓・業務効率化の取り組み内容"},
    {"id": "expected_effect", "title": "6. 補助事業の効果", "max_chars": 1500, "description": "売上向上、新規顧客獲得などの期待効果"}
  ]',
  'あなたは補助金申請書作成の専門家です。以下のヒアリング情報を基に、小規模事業者持続化補助金の経営計画書・補助事業計画書セクションを作成してください。

【重要な出力ルール】
- マークダウン記法は使用しないでください
- 箇条書きは「・」「①②③」などを使用してください
- 具体的な数値（売上目標、顧客数など）を含めてください
- 審査員が納得できる論理的で説得力のある文章を心がけてください
- 地域に根ざした小規模事業者としての特徴を活かしてください'
);

-- 事業再構築補助金用の文書テンプレート（新規追加）
INSERT INTO subsidy_types (name, category, description) 
VALUES (
  '事業再構築補助金',
  '事業転換系',
  'ポストコロナ・ウィズコロナ時代の経済社会の変化に対応するため、中小企業等の思い切った事業再構築を支援する補助金'
);

INSERT INTO document_templates (subsidy_type_id, template_name, template_version, sections, ai_prompt_base)
VALUES (
  (SELECT id FROM subsidy_types WHERE name = '事業再構築補助金'),
  '事業再構築補助金 事業計画書',
  'v2024',
  '[
    {"id": "company_overview", "title": "1. 補助事業の具体的取組内容", "max_chars": 3000, "description": "現在の事業概要、事業再構築の必要性、具体的な取り組み内容"},
    {"id": "market_analysis", "title": "2. 将来の展望（事業化に向けて想定される市場および期待される効果）", "max_chars": 2500, "description": "ターゲット市場の規模、市場ニーズ、競合分析、自社のポジショニング"},
    {"id": "business_model", "title": "3. 本事業で取得する主な資産", "max_chars": 1500, "description": "導入設備、システム、その他の資産の詳細"},
    {"id": "implementation_plan", "title": "4. 収益計画", "max_chars": 2000, "description": "売上・利益計画、付加価値額の算出根拠"},
    {"id": "schedule", "title": "5. 実施スケジュール", "max_chars": 1000, "description": "事業実施の具体的なスケジュールとマイルストーン"}
  ]',
  'あなたは補助金申請書作成の専門家です。以下のヒアリング情報を基に、事業再構築補助金の事業計画書セクションを作成してください。

【重要な出力ルール】
- マークダウン記法は使用しないでください
- 箇条書きは「・」「①②③」などを使用してください
- 事業再構築の必要性と新規性を明確に示してください
- 市場規模や成長性を具体的な数値で示してください
- 既存事業との相乗効果や差別化ポイントを強調してください'
);

-- 小規模事業者持続化補助金用のヒアリング質問（任意回答）
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
VALUES 
  (5, 'business_history', '創業からの歩みや、事業を始めたきっかけを教えてください', 'textarea', NULL, '企業情報', 0, 1, '創業の経緯、理念、これまでの主な出来事など', '2010年に地域の食材の魅力を伝えたいという思いから、地元産野菜を使った惣菜店を開業しました。', 'company_overview'),
  (5, 'main_products', '主力の商品・サービスを教えてください', 'textarea', NULL, '企業情報', 1, 2, '売上の中心となる商品やサービス', '地元農家から直接仕入れた旬の野菜を使った手作り惣菜。特に煮物と漬物が人気です。', 'company_overview'),
  (5, 'target_customer', 'メインの顧客層はどのような方ですか？', 'textarea', NULL, '市場分析', 1, 10, '年齢層、性別、地域、購買動機など', '50〜70代の女性が中心。健康志向で、添加物を気にする方が多いです。', 'market_analysis'),
  (5, 'competitor_analysis', '競合となる店舗やサービスはありますか？', 'textarea', NULL, '市場分析', 0, 11, '競合の特徴、自社との違い', '近隣にスーパー2店舗、コンビニ3店舗。大手は価格で勝負、当店は手作り・無添加で差別化。', 'market_analysis'),
  (5, 'business_strength', '他社にはない御社の強みは何ですか？', 'textarea', NULL, '強み分析', 1, 20, '技術、ノウハウ、立地、人材など', '30年以上の調理経験を持つ店主の技術と、農家との直接取引による新鮮な食材の仕入れルート。', 'current_situation'),
  (5, 'sales_channel_plan', '今回の補助金で取り組みたい販路開拓の内容を教えてください', 'textarea', NULL, '補助事業', 1, 30, 'ホームページ作成、チラシ、展示会出展など', 'ホームページを新規作成し、オンライン予約・通販機能を追加。SNSでの情報発信も強化したい。', 'business_plan'),
  (5, 'expected_sales_increase', '取り組みによってどのくらい売上増加を見込んでいますか？', 'text', NULL, '期待効果', 1, 40, '金額または割合で', '現在月商80万円を、1年後に100万円（25%増）を目標としています。', 'expected_effect'),
  (5, 'new_customer_target', '新たに獲得したい顧客層はありますか？', 'textarea', NULL, '期待効果', 0, 41, '現在リーチできていない層', '30〜40代の働く女性。時短ニーズに応える惣菜セットを開発し、ネット注文で対応したい。', 'expected_effect');

-- 事業再構築補助金用のヒアリング質問（任意回答）
INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, category, is_required, display_order, help_text, example_answer, document_section)
VALUES 
  ((SELECT id FROM subsidy_types WHERE name = '事業再構築補助金'), 'current_business', '現在の主な事業内容を教えてください', 'textarea', NULL, '企業情報', 1, 1, '売上構成、主要顧客など', '飲食店向けの業務用食材卸売が主力（売上の80%）。コロナで売上が40%減少。', 'company_overview'),
  ((SELECT id FROM subsidy_types WHERE name = '事業再構築補助金'), 'restructure_reason', '事業再構築が必要な理由を教えてください', 'textarea', NULL, '再構築理由', 1, 10, 'コロナの影響、市場変化など', '飲食店の廃業・営業縮小により、既存の卸売ビジネスモデルでは成長が見込めない状況。', 'company_overview'),
  ((SELECT id FROM subsidy_types WHERE name = '事業再構築補助金'), 'new_business_plan', '新たに取り組む事業の内容を教えてください', 'textarea', NULL, '新規事業', 1, 20, '新製品、新サービス、新市場など', '一般消費者向けのECサイトを開設し、冷凍食品の製造・直販事業を開始する。', 'company_overview'),
  ((SELECT id FROM subsidy_types WHERE name = '事業再構築補助金'), 'market_size', '新規事業の対象市場の規模を教えてください', 'textarea', NULL, '市場分析', 0, 30, '市場規模、成長率など', '国内冷凍食品市場は約1兆円規模で、年率3%で成長中。特にEC経由の購入が急増。', 'market_analysis'),
  ((SELECT id FROM subsidy_types WHERE name = '事業再構築補助金'), 'competitive_advantage', '新規事業での競合優位性は何ですか？', 'textarea', NULL, '市場分析', 1, 31, '差別化ポイント、参入障壁', '業務用で培った大量調理のノウハウと、既存の仕入れネットワークを活かした低コスト製造。', 'market_analysis'),
  ((SELECT id FROM subsidy_types WHERE name = '事業再構築補助金'), 'investment_plan', '設備投資の計画を教えてください', 'textarea', NULL, '投資計画', 1, 40, '導入設備、金額など', '急速冷凍機（500万円）、真空包装機（200万円）、EC用在庫管理システム（100万円）を導入予定。', 'business_model'),
  ((SELECT id FROM subsidy_types WHERE name = '事業再構築補助金'), 'sales_target', '新規事業の売上目標を教えてください', 'textarea', NULL, '収益計画', 1, 50, '3〜5年後の目標', '1年目：3000万円、3年目：8000万円、5年目：1.5億円を目標。', 'implementation_plan');
