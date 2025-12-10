-- 無制限プラン追加
-- 作成日: 2024-12-10

-- user_subscriptionsテーブルに予約プラン用のカラムを追加（存在しない場合）
ALTER TABLE user_subscriptions ADD COLUMN scheduled_plan_id INTEGER;
ALTER TABLE user_subscriptions ADD COLUMN scheduled_plan_date DATE;

-- 無制限プランを追加 (monthly_slots = -1 で無制限を表現)
INSERT INTO subscription_plans (plan_code, plan_name, monthly_price, monthly_slots, description) VALUES
('unlimited', '無制限プラン', 30000, -1, '月額30,000円 - 案件数無制限');
