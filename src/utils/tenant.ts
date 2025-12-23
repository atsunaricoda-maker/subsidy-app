// マルチテナント（サブドメイン方式）ユーティリティ

// ホスト名からサブドメイン（slug）を抽出
export function extractSlugFromHost(host: string): string | null {
  if (!host) return null
  
  // ポート番号を除去
  const hostWithoutPort = host.split(':')[0]
  
  // 許可するベースドメイン
  const baseDomains = [
    'shinsei-raku.com',
    'subsidy-app.pages.dev',
    'localhost'
  ]
  
  // 開発環境（localhost、*.sandbox.novita.ai など）
  if (hostWithoutPort === 'localhost' || 
      hostWithoutPort.includes('sandbox.novita.ai') ||
      hostWithoutPort.includes('127.0.0.1')) {
    return null // 開発環境はサブドメインなしで動作
  }
  
  // ベースドメインの確認とサブドメイン抽出
  for (const baseDomain of baseDomains) {
    if (hostWithoutPort === baseDomain) {
      return null // ルートドメインはサブドメインなし
    }
    
    if (hostWithoutPort.endsWith('.' + baseDomain)) {
      const subdomain = hostWithoutPort.slice(0, -(baseDomain.length + 1))
      // wwwは無視
      if (subdomain === 'www') return null
      // 予約語チェック（defaultは組織として使用可能なので除外）
      const reserved = ['admin', 'master', 'api', 'app', 'login', 'signup', 'portal']
      if (reserved.includes(subdomain.toLowerCase())) return null
      return subdomain
    }
  }
  
  return null
}

// サブドメイン（slug）から組織情報を取得
export async function getOrganizationBySlug(DB: any, slug: string): Promise<any | null> {
  if (!slug) return null
  
  const org = await DB.prepare(`
    SELECT id, name, slug, email, status, trial_ends_at, business_scope
    FROM organizations 
    WHERE slug = ? AND status IN ('active', 'trial')
  `).bind(slug.toLowerCase()).first()
  
  return org
}

// リクエストコンテキストから組織IDを取得（ミドルウェア用）
export async function resolveOrganization(c: any): Promise<{ orgId: number | null; org: any | null; slug: string | null }> {
  // Workerからプロキシされた場合はX-Original-Hostを優先
  const originalHost = c.req.header('x-original-host') || ''
  const host = originalHost || c.req.header('host') || ''
  const slug = extractSlugFromHost(host)
  
  if (!slug) {
    // サブドメインなし = デフォルト組織または認証から取得
    return { orgId: null, org: null, slug: null }
  }
  
  const { DB } = c.env
  const org = await getOrganizationBySlug(DB, slug)
  
  if (!org) {
    return { orgId: null, org: null, slug }
  }
  
  return { orgId: org.id, org, slug }
}

// 組織のステータス確認
export function isOrganizationActive(org: any): boolean {
  if (!org) return false
  
  if (org.status === 'active') return true
  
  if (org.status === 'trial') {
    const trialEnds = new Date(org.trial_ends_at)
    return trialEnds > new Date()
  }
  
  return false
}
