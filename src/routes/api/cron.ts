// フェーズ4: Cronジョブ（公募要領自動監視）
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// Cronトリガーエンドポイント（Cloudflare Workers Cron Triggers用）
routes.get('/cron/check-guideline-updates', async (c) => {
  const { DB } = c.env
  const cronSecret = c.req.header('X-Cron-Secret')
  
  // セキュリティチェック（本番環境では必須）
  // if (cronSecret !== c.env.CRON_SECRET) {
  //   return c.json({ error: 'Unauthorized' }, 401)
  // }
  
  // 監視対象URLを取得
  const watchUrls = await DB.prepare(`
    SELECT w.*, s.name as subsidy_name 
    FROM subsidy_watch_urls w
    LEFT JOIN subsidy_types s ON w.subsidy_type_id = s.id
    WHERE w.is_active = 1
  `).all()
  
  const results = []
  let changesDetected = 0
  
  for (const watchUrl of (watchUrls.results || [])) {
    try {
      // URLをフェッチ
      const response = await fetch(watchUrl.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SubsidyChecker/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })
      
      if (!response.ok) {
        results.push({
          url_id: watchUrl.id,
          url: watchUrl.url,
          status: 'error',
          message: `HTTP ${response.status}`
        })
        continue
      }
      
      const content = await response.text()
      
      // コンテンツハッシュ計算（改善版）
      const contentHash = btoa(unescape(encodeURIComponent(
        content.length.toString() + 
        content.replace(/\s+/g, ' ').substring(0, 2000)
      ))).substring(0, 64)
      
      const lastModified = response.headers.get('Last-Modified')
      
      // 変更検知
      let changeDetected = false
      let changeType = null
      
      if (watchUrl.last_content_hash && watchUrl.last_content_hash !== contentHash) {
        changeDetected = true
        changeType = 'content_change'
      }
      
      if (watchUrl.last_modified_date && lastModified && watchUrl.last_modified_date !== lastModified) {
        changeDetected = true
        changeType = changeType ? 'both' : 'modified_date_change'
      }
      
      // 初回チェックは変更なしとして記録
      if (!watchUrl.last_checked_at) {
        changeDetected = false
      }
      
      // 監視URL状態更新
      await DB.prepare(`
        UPDATE subsidy_watch_urls 
        SET last_checked_at = CURRENT_TIMESTAMP,
            last_content_hash = ?,
            last_modified_date = ?
        WHERE id = ?
      `).bind(contentHash, lastModified, watchUrl.id).run()
      
      // 変更検知時
      if (changeDetected) {
        changesDetected++
        
        // 更新ログ作成
        await DB.prepare(`
          INSERT INTO subsidy_update_logs 
          (watch_url_id, subsidy_type_id, change_type, old_value, new_value, status)
          VALUES (?, ?, ?, ?, ?, 'pending')
        `).bind(
          watchUrl.id,
          watchUrl.subsidy_type_id,
          changeType,
          watchUrl.last_content_hash,
          contentHash
        ).run()
        
        // 管理者通知
        await DB.prepare(`
          INSERT INTO admin_notifications 
          (notification_type, title, message, related_id, related_table, priority)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          'subsidy_update',
          `【重要】${watchUrl.subsidy_name}の公募要領が更新されました`,
          `監視URL: ${watchUrl.description || watchUrl.url}\n変更種別: ${changeType}\n\n早急に内容を確認し、必要に応じてシステムの情報を更新してください。`,
          watchUrl.id,
          'subsidy_watch_urls',
          'high'
        ).run()
      }
      
      results.push({
        url_id: watchUrl.id,
        url: watchUrl.url,
        subsidy_name: watchUrl.subsidy_name,
        status: 'success',
        change_detected: changeDetected,
        change_type: changeType
      })
      
    } catch (error: any) {
      results.push({
        url_id: watchUrl.id,
        url: watchUrl.url,
        status: 'error',
        message: error.message
      })
    }
  }
  
  // Cron実行ログ
  const logMessage = `Cron実行完了: ${watchUrls.results?.length || 0}件チェック、${changesDetected}件の変更を検知`
  
  return c.json({
    success: true,
    executed_at: new Date().toISOString(),
    total_checked: watchUrls.results?.length || 0,
    changes_detected: changesDetected,
    results,
    log: logMessage
  })
})

// Cron実行履歴取得
routes.get('/cron/history', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT 
      date(detected_at) as date,
      COUNT(*) as changes_count,
      GROUP_CONCAT(DISTINCT subsidy_type_id) as affected_subsidies
    FROM subsidy_update_logs
    GROUP BY date(detected_at)
    ORDER BY date DESC
    LIMIT 30
  `).all()
  
  return c.json(result.results)
})

export default routes
