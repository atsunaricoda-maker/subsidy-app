// 共通型定義

export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  GEMINI_API_KEY?: string;
  CRON_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PUBLIC_KEY?: string;
  RECAPTCHA_SECRET_KEY?: string;
  CLAUDE_API_KEY?: string;
  RESEND_API_KEY?: string;
  DEBUG_EMAIL_SECRET?: string;
}

export type Variables = {
  user?: {
    id: number;
    username: string;
    name: string;
    role: string;
    organization_id: number;
  };
  // マルチテナント用
  tenantOrg?: {
    id: number;
    name: string;
    slug: string;
    email: string;
    status: string;
    trial_ends_at: string;
    business_scope: string;
  };
  tenantOrgId?: number;
  tenantSlug?: string;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
}
