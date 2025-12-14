-- Add Stripe-related columns to organizations table
ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT;

-- Add Stripe subscription ID to user_subscriptions table (if not exists)
-- Note: This might fail if the column already exists, which is fine
ALTER TABLE user_subscriptions ADD COLUMN stripe_subscription_id TEXT;

-- Add stripe_price_id to subscription_plans table (if not exists)
ALTER TABLE subscription_plans ADD COLUMN stripe_price_id TEXT;
