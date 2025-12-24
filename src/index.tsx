import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import { generateSidebar, sidebarStyles, sidebarScripts } from './templates/sidebar'
import { extractSlugFromHost, getOrganizationBySlug, isOrganizationActive } from './utils/tenant'

// API Routes
import admin_usersRoutes from './routes/api/admin-users'
import ai_chatRoutes from './routes/api/ai-chat'
import aiRoutes from './routes/api/ai'
import announcementsRoutes from './routes/api/announcements'
import authRoutes from './routes/api/auth'
import backupRoutes from './routes/api/backup'
import bank_infoRoutes from './routes/api/bank-info'
import casesRoutes from './routes/api/cases'
import clientsRoutes from './routes/api/clients'
import common_documentsRoutes from './routes/api/common-documents'
import communicationsRoutes from './routes/api/communications'
import cronRoutes from './routes/api/cron'
import dashboard_statsRoutes from './routes/api/dashboard-stats'
import document_analysisRoutes from './routes/api/document-analysis'
import document_checklistRoutes from './routes/api/document-checklist'
import document_generationRoutes from './routes/api/document-generation'
import documentsRoutes from './routes/api/documents'
import edit_historyRoutes from './routes/api/edit-history'
import exportRoutes from './routes/api/export'
import guidelinesRoutes from './routes/api/guidelines'
import hearing_questionsRoutes from './routes/api/hearing-questions'
import invoicesRoutes from './routes/api/invoices'
import multi_matchingRoutes from './routes/api/multi-matching'
import paymentsRoutes from './routes/api/payments'
import pipelinesRoutes from './routes/api/pipelines'
import predictionRoutes from './routes/api/prediction'
import site_settingsRoutes from './routes/api/site-settings'
import stripe_subscriptionRoutes from './routes/api/stripe-subscription'
import stripeRoutes from './routes/api/stripe'
import subscriptionRoutes from './routes/api/subscription'
import subsidy_matchingRoutes from './routes/api/subsidy-matching'
import subsidy_typesRoutes from './routes/api/subsidy-types'
import success_casesRoutes from './routes/api/success-cases'
import organizationsRoutes from './routes/api/organizations'
import debugTenantRoutes from './routes/api/debug-tenant'
import admin_settingsPages from './routes/pages/admin-settings'
import admin_usersPages from './routes/pages/admin-users'
import backupPages from './routes/pages/backup'
import case_detailPages from './routes/pages/case-detail'
import casesPages from './routes/pages/cases'
import client_detailPages from './routes/pages/client-detail'
import clientsPages from './routes/pages/clients'
import dashboardPages from './routes/pages/dashboard'
import guidelinesPages from './routes/pages/guidelines'
import legalPages from './routes/pages/legal'
import master_adminsPages from './routes/pages/master-admins'
import master_billingPages from './routes/pages/master-billing'
import master_dataPages from './routes/pages/master-data'
import master_legalPages from './routes/pages/master-legal'
import master_logsPages from './routes/pages/master-logs'
import master_plansPages from './routes/pages/master-plans'
import masterPages from './routes/pages/master'
import masterInquiriesPages from './routes/pages/master-inquiries'
import masterAnnouncementsPages from './routes/pages/master-announcements'
import pipelinesPages from './routes/pages/pipelines'
import pipelineBoardPages from './routes/pages/pipeline-board'
import portalPages from './routes/pages/portal'
import statisticsPages from './routes/pages/statistics'
import subsidy_typesPages from './routes/pages/subsidy-types'
import authPages from './routes/pages/auth'
import supportPages from './routes/pages/support'
import supportRoutes from './routes/api/support'

const app = new Hono<AppEnv>()

// CORS設定
app.use('/api/*', cors())

// マルチテナントミドルウェア：サブドメインから組織を判別
app.use('*', async (c, next) => {
  // Workerからプロキシされた場合はX-Original-Hostを優先
  const originalHost = c.req.header('x-original-host') || ''
  const host = originalHost || c.req.header('host') || ''
  const slug = extractSlugFromHost(host)
  
  // サブドメインがある場合、組織を解決
  if (slug) {
    const { DB } = c.env
    const org = await getOrganizationBySlug(DB, slug)
    
    if (!org) {
      // 組織が見つからない場合
      const path = c.req.path
      // APIはエラーを返す
      if (path.startsWith('/api/')) {
        return c.json({ error: '組織が見つかりません', slug }, 404)
      }
      // ページはエラーページを表示
      return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>組織が見つかりません - 申請らくらく君</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 min-h-screen flex items-center justify-center">
          <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
            <div class="text-6xl mb-4">💼</div>
            <h1 class="text-2xl font-bold text-gray-800 mb-2">組織が見つかりません</h1>
            <p class="text-gray-600 mb-6">
              <code class="bg-gray-100 px-2 py-1 rounded">${slug}.shinsei-raku.com</code> は登録されていません。
            </p>
            <div class="space-y-3">
              <a href="https://shinsei-raku.com/signup" class="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition">
                <i class="fas fa-user-plus mr-2"></i>新規登録はこちら
              </a>
              <a href="https://shinsei-raku.com" class="block w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 transition">
                トップページへ
              </a>
            </div>
          </div>
        </body>
        </html>
      `, 404)
    }
    
    // 組織のステータス確認
    if (!isOrganizationActive(org)) {
      const path = c.req.path
      if (path.startsWith('/api/')) {
        return c.json({ error: '組織の利用が停止されています', status: org.status }, 403)
      }
      return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>利用停止中 - 申請らくらく君</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 min-h-screen flex items-center justify-center">
          <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
            <div class="text-6xl mb-4">⚠️</div>
            <h1 class="text-2xl font-bold text-gray-800 mb-2">利用停止中</h1>
            <p class="text-gray-600 mb-6">
              この組織の利用は現在停止されています。<br>
              お心当たりのある場合は管理者にお問い合わせください。
            </p>
          </div>
        </body>
        </html>
      `, 403)
    }
    
    // 組織情報をコンテキストに保存
    c.set('tenantOrg', org)
    c.set('tenantOrgId', org.id)
    c.set('tenantSlug', slug)
  } else {
    // サブドメインなし（shinsei-raku.com）の場合
    // マスター管理者専用なので、マスター関連ページ以外はブロック
    const path = c.req.path
    const allowedPaths = [
      '/master',
      '/signup',
      '/portal',
      '/api/master',
      '/api/site-settings',
      '/api/signup',
      '/api/portal',
      '/api/find-organization',
      '/terms',
      '/privacy',
      '/legal',
      '/commercial-law',
      '/favicon.ico',
      '/robots.txt'
    ]
    
    // 許可されたパスかチェック
    const isAllowed = allowedPaths.some(allowed => path === allowed || path.startsWith(allowed + '/'))
    
    if (!isAllowed && path !== '/') {
      // マスター関連以外のページにアクセスしようとした場合
      if (path.startsWith('/api/')) {
        return c.json({ 
          error: 'サブドメインが指定されていません。組織のサブドメイン（例: your-company.shinsei-raku.com）からアクセスしてください。',
          redirect: null
        }, 400)
      }
      
      // 一般ページへのアクセスはエラーページを表示
      return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>サブドメインが必要です - 申請らくらく君</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        </head>
        <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center p-4">
          <div class="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full">
            <div class="text-center mb-8">
              <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i class="fas fa-building text-blue-600 text-3xl"></i>
              </div>
              <h1 class="text-2xl font-bold text-gray-800 mb-3">組織のサブドメインからアクセスしてください</h1>
              <p class="text-gray-600">
                このページを利用するには、組織専用のURLからアクセスする必要があります。
              </p>
            </div>
            
            <!-- 既存ユーザー向け：サブドメイン検索 -->
            <div class="bg-blue-50 rounded-xl p-5 mb-6">
              <h2 class="font-bold text-gray-800 mb-3 flex items-center">
                <i class="fas fa-search text-blue-600 mr-2"></i>
                既にアカウントをお持ちの方
              </h2>
              <p class="text-sm text-gray-600 mb-4">登録メールアドレスから組織URLを検索できます</p>
              <div class="flex gap-2">
                <input type="email" id="searchEmail" placeholder="メールアドレスを入力" 
                  class="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">
                <button onclick="searchOrganization()" id="searchBtn"
                  class="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm whitespace-nowrap">
                  <i class="fas fa-search mr-1"></i>検索
                </button>
              </div>
              <div id="searchResult" class="mt-4 hidden"></div>
            </div>
            
            <!-- アクセスURL例 -->
            <div class="bg-gray-50 rounded-lg p-4 mb-6">
              <p class="text-sm text-gray-500 mb-2">アクセスURL例：</p>
              <code class="text-blue-600 font-mono text-sm">https://your-company.shinsei-raku.com</code>
            </div>
            
            <!-- アクションボタン -->
            <div class="space-y-3">
              <a href="/signup" class="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-medium text-center">
                <i class="fas fa-user-plus mr-2"></i>新規登録はこちら
              </a>
              <a href="/" class="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition text-center">
                トップページへ戻る
              </a>
            </div>
          </div>
          
          <script>
            async function searchOrganization() {
              const email = document.getElementById('searchEmail').value.trim();
              const resultDiv = document.getElementById('searchResult');
              const btn = document.getElementById('searchBtn');
              
              if (!email) {
                alert('メールアドレスを入力してください');
                return;
              }
              
              btn.disabled = true;
              btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>検索中...';
              resultDiv.classList.add('hidden');
              
              try {
                const response = await fetch('/api/find-organization', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                resultDiv.classList.remove('hidden');
                
                if (data.found && data.organizations && data.organizations.length > 0) {
                  let html = '<div class="space-y-2">';
                  html += '<p class="text-sm text-green-700 font-medium"><i class="fas fa-check-circle mr-1"></i>以下の組織が見つかりました：</p>';
                  data.organizations.forEach(org => {
                    const url = 'https://' + org.slug + '.shinsei-raku.com/login';
                    html += '<a href="' + url + '" class="flex items-center justify-between p-3 bg-white border border-green-200 rounded-lg hover:bg-green-50 transition group">';
                    html += '<div>';
                    html += '<div class="font-medium text-gray-800">' + org.name + '</div>';
                    html += '<div class="text-xs text-gray-500">' + org.slug + '.shinsei-raku.com</div>';
                    html += '</div>';
                    html += '<i class="fas fa-arrow-right text-green-600 group-hover:translate-x-1 transition-transform"></i>';
                    html += '</a>';
                  });
                  html += '</div>';
                  resultDiv.innerHTML = html;
                } else {
                  resultDiv.innerHTML = '<div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800"><i class="fas fa-exclamation-triangle mr-2"></i>このメールアドレスで登録された組織は見つかりませんでした。新規登録をお試しください。</div>';
                }
              } catch (error) {
                resultDiv.classList.remove('hidden');
                resultDiv.innerHTML = '<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"><i class="fas fa-times-circle mr-2"></i>検索中にエラーが発生しました。しばらくしてからお試しください。</div>';
              } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-search mr-1"></i>検索';
              }
            }
            
            // Enterキーで検索
            document.getElementById('searchEmail').addEventListener('keypress', function(e) {
              if (e.key === 'Enter') searchOrganization();
            });
          </script>
        </body>
        </html>
      `, 400)
    }
  }
  
  await next()
})

// メールアドレスから組織を検索するAPI（サブドメインなしでもアクセス可能）
app.post('/api/find-organization', async (c) => {
  const { DB } = c.env
  const { email } = await c.req.json()
  
  if (!email || typeof email !== 'string') {
    return c.json({ found: false, error: 'メールアドレスを入力してください' }, 400)
  }
  
  try {
    // admin_usersテーブルからメールアドレスで組織を検索
    const users = await DB.prepare(`
      SELECT DISTINCT o.id, o.name, o.slug
      FROM admin_users au
      JOIN organizations o ON au.organization_id = o.id
      WHERE au.email = ? AND o.status IN ('active', 'trial')
    `).bind(email.toLowerCase().trim()).all()
    
    // 組織のメールアドレスでも検索
    const orgs = await DB.prepare(`
      SELECT id, name, slug
      FROM organizations
      WHERE email = ? AND status IN ('active', 'trial')
    `).bind(email.toLowerCase().trim()).all()
    
    // 結果をマージ（重複除去）
    const allOrgs = [...(users.results || []), ...(orgs.results || [])]
    const uniqueOrgs = allOrgs.filter((org, index, self) => 
      index === self.findIndex(o => o.id === org.id)
    )
    
    if (uniqueOrgs.length > 0) {
      return c.json({ 
        found: true, 
        organizations: uniqueOrgs.map(o => ({ name: o.name, slug: o.slug }))
      })
    }
    
    return c.json({ found: false })
  } catch (error) {
    console.error('Find organization error:', error)
    return c.json({ found: false, error: '検索中にエラーが発生しました' }, 500)
  }
})

// Mount routes
app.route('/api', admin_usersRoutes)
app.route('/api', ai_chatRoutes)
app.route('/api', aiRoutes)
app.route('/api', announcementsRoutes)
app.route('/api', authRoutes)
app.route('/api', backupRoutes)
app.route('/api', bank_infoRoutes)
app.route('/api', casesRoutes)
app.route('/api', clientsRoutes)
app.route('/api', common_documentsRoutes)
app.route('/api', communicationsRoutes)
app.route('/api', cronRoutes)
app.route('/api', dashboard_statsRoutes)
app.route('/api', document_analysisRoutes)
app.route('/api', document_checklistRoutes)
app.route('/api', document_generationRoutes)
app.route('/api', documentsRoutes)
app.route('/api', edit_historyRoutes)
app.route('/api', exportRoutes)
app.route('/api', guidelinesRoutes)
app.route('/api', hearing_questionsRoutes)
app.route('/api', invoicesRoutes)
app.route('/api', multi_matchingRoutes)
app.route('/api', paymentsRoutes)
app.route('/api', pipelinesRoutes)
app.route('/api', predictionRoutes)
app.route('/api', site_settingsRoutes)
app.route('/api', stripe_subscriptionRoutes)
app.route('/api', stripeRoutes)
app.route('/api', subscriptionRoutes)
app.route('/api', subsidy_matchingRoutes)
app.route('/api', subsidy_typesRoutes)
app.route('/api', success_casesRoutes)
app.route('/api', organizationsRoutes)
app.route('/api', debugTenantRoutes)
app.route('/api', supportRoutes)
app.route('', admin_settingsPages)
app.route('', admin_usersPages)
app.route('', backupPages)
app.route('', case_detailPages)
app.route('', casesPages)
app.route('', client_detailPages)
app.route('', clientsPages)
app.route('', dashboardPages)
app.route('', guidelinesPages)
app.route('', legalPages)
app.route('', master_adminsPages)
app.route('', master_billingPages)
app.route('', master_dataPages)
app.route('', master_legalPages)
app.route('', master_logsPages)
app.route('', master_plansPages)
app.route('', masterPages)
app.route('', masterInquiriesPages)
app.route('', masterAnnouncementsPages)
// site_settingsの/master/*ページルートをルートレベルでもマウント
app.route('', site_settingsRoutes)
app.route('', pipelinesPages)
app.route('', pipelineBoardPages)
app.route('', portalPages)
app.route('', statisticsPages)
app.route('', subsidy_typesPages)
app.route('', authPages)
app.route('', supportPages)

// Re-export templates for use in routes
export { generateSidebar, sidebarStyles, sidebarScripts }

export default app
