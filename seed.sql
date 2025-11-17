-- テストデータ

-- テスト顧客
INSERT INTO clients (name, company_name, email, phone, access_token, status, assigned_staff, notes) VALUES
  ('山田太郎', '株式会社テスト商事', 'yamada@test.com', '03-1234-5678', 'test-token-001', 'consulting', '佐藤', '初回ヒアリング完了'),
  ('鈴木花子', '合同会社イノベーション', 'suzuki@innovation.com', '090-1234-5678', 'test-token-002', 'preparing', '田中', '書類準備中'),
  ('佐藤一郎', '佐藤工業株式会社', 'sato@sato-kogyo.com', '06-9876-5432', 'test-token-003', 'inquiry', '佐藤', '問い合わせ対応待ち');

-- テスト書類
INSERT INTO documents (client_id, document_type, file_name, file_path, file_size, uploaded_by, status) VALUES
  (1, '登記簿謄本', 'toukibo_yamada.pdf', 'documents/1/toukibo_yamada.pdf', 524288, 'client', 'approved'),
  (1, '決算書', 'kessan_yamada.pdf', 'documents/1/kessan_yamada.pdf', 1048576, 'client', 'pending'),
  (2, '登記簿謄本', 'toukibo_suzuki.pdf', 'documents/2/toukibo_suzuki.pdf', 612345, 'client', 'approved');

-- テストやり取り記録
INSERT INTO communications (client_id, message, sender_type, sender_name) VALUES
  (1, '助成金申請について相談したいのですが', 'client', '山田太郎'),
  (1, 'ご連絡ありがとうございます。まずは御社の状況をお聞かせください。', 'staff', '佐藤'),
  (1, '従業員は10名で、IT導入補助金を検討しています', 'client', '山田太郎'),
  (2, '書類をアップロードしました', 'client', '鈴木花子'),
  (2, '確認いたしました。決算書も追加でお願いします。', 'staff', '田中');
