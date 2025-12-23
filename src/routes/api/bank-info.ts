// API: システム設定（銀行振込先など）
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// システム設定取得・更新は /api/settings (line 1294, 1335) で統一
// 重複APIを削除してsite_settingsテーブルを使用

// 銀行振込先情報取得（顧客ポータル用 - テナント分離）
routes.get('/bank-info', async (c) => {
  const { DB } = c.env
  
  // サブドメインからテナント組織IDを取得
  const tenantOrgId = c.get('tenantOrgId')
  
  // テナントIDが取得できない場合はエラー
  if (!tenantOrgId) {
    return c.json({ error: '組織が特定できません' }, 400)
  }
  
  // organizationsテーブルから銀行情報を取得（テナント分離）
  const org = await DB.prepare(`
    SELECT 
      name as company_name,
      bank_name, 
      bank_branch, 
      bank_account_type, 
      bank_account_number, 
      bank_account_holder
    FROM organizations
    WHERE id = ?
  `).bind(tenantOrgId).first() as any
  
  if (!org) {
    return c.json({ error: '組織が見つかりません' }, 404)
  }
  
  return c.json({
    company_name: org.company_name || '',
    bank_name: org.bank_name || '',
    bank_branch: org.bank_branch || '',
    bank_account_type: org.bank_account_type || '普通',
    bank_account_number: org.bank_account_number || '',
    bank_account_holder: org.bank_account_holder || ''
  })
})

export default routes
