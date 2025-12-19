// API: システム設定（銀行振込先など）
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// システム設定取得・更新は /api/settings (line 1294, 1335) で統一
// 重複APIを削除してsite_settingsテーブルを使用

// 銀行振込先情報取得（公開API - 顧客ポータル用）
routes.get('/bank-info', async (c) => {
  const { DB } = c.env
  
  // site_settingsテーブルから取得
  const settings = await DB.prepare(`
    SELECT setting_key, setting_value
    FROM site_settings
    WHERE setting_key IN ('bank_name', 'bank_branch', 'bank_account_type', 'bank_account_number', 'bank_account_holder', 'company_name')
  `).all()
  
  const result: Record<string, string> = {}
  for (const row of (settings.results || []) as any[]) {
    result[row.setting_key] = row.setting_value || ''
  }
  
  return c.json(result)
})

export default routes
