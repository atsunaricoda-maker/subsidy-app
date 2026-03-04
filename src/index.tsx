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
import masterPublicLegalPages from './routes/pages/master-public-legal'
import master_logsPages from './routes/pages/master-logs'
import master_plansPages from './routes/pages/master-plans'
import masterPages from './routes/pages/master'
import masterInquiriesPages from './routes/pages/master-inquiries'
import masterAnnouncementsPages from './routes/pages/master-announcements'
import masterGuidelinesPages from './routes/pages/master-guidelines'
import masterPipelinesPages from './routes/pages/master-pipelines'
import masterSubsidyTypesPages from './routes/pages/master-subsidy-types'
import pipelinesPages from './routes/pages/pipelines'
import pipelineBoardPages from './routes/pages/pipeline-board'
import portalPages from './routes/pages/portal'
import statisticsPages from './routes/pages/statistics'
import subsidy_typesPages from './routes/pages/subsidy-types'
import authPages from './routes/pages/auth'
import supportPages from './routes/pages/support'
import supportRoutes from './routes/api/support'
import emailRoutes from './routes/api/email'

const app = new Hono<AppEnv>()

// CORS設定 - 許可するオリジンを制限
app.use('/api/*', cors({
  origin: (origin) => {
    if (!origin) return origin // サーバーサイドリクエスト
    // 本番ドメインとサブドメインを許可
    if (origin.endsWith('.shinsei-raku.com') || origin === 'https://shinsei-raku.com') {
      return origin
    }
    // Cloudflare Pagesのプレビュー
    if (origin.endsWith('.subsidy-app.pages.dev') || origin === 'https://subsidy-app.pages.dev') {
      return origin
    }
    // 開発環境
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return origin
    }
    return null // その他のオリジンは拒否
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}))

// マルチテナントミドルウェア：サブドメインから組織を判別
app.use('*', async (c, next) => {
  // Workerからプロキシされた場合はX-Original-Hostを優先
  const originalHost = c.req.header('x-original-host') || ''
  const host = originalHost || c.req.header('host') || ''
  const slug = extractSlugFromHost(host)
  const path = c.req.path
  
  // プラットフォーム法務ページ（/master/privacy-policy, /master/terms, /master/legal）は
  // サブドメインがあっても組織解決をスキップして通過させる
  const platformPublicPaths = ['/master/privacy-policy', '/master/terms', '/master/legal']
  if (platformPublicPaths.includes(path)) {
    return next()
  }
  
  // サブドメインがある場合、組織を解決
  if (slug) {
    const { DB } = c.env
    const org = await getOrganizationBySlug(DB, slug)
    
    if (!org) {
      // 組織が見つからない場合
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
              <code class="bg-gray-100 px-2 py-1 rounded">${slug.replace(/[<>"'&]/g, '')}.shinsei-raku.com</code> は登録されていません。
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
      '/privacy-policy',
      '/legal',
      '/favicon.ico',
      '/robots.txt'
    ]
    
    // 許可されたパスかチェック
    const isAllowed = allowedPaths.some(allowed => path === allowed || path.startsWith(allowed + '/'))
    
    // ルートドメインのトップページ（/）はポータルページを表示
    if (path === '/') {
      return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>申請らくらく君 - 補助金・助成金申請サポートSaaS</title>
          <meta name="description" content="行政書士・士業事務所向けの補助金申請管理SaaS。顧客管理から書類作成、進捗管理まで一元化。">
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
          <style>
            @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
            .float-animation { animation: float 3s ease-in-out infinite; }
            .fade-in-up { animation: fadeInUp 0.8s ease-out forwards; }
            .delay-100 { animation-delay: 0.1s; }
            .delay-200 { animation-delay: 0.2s; }
            .delay-300 { animation-delay: 0.3s; }
            .gradient-blue { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #0ea5e9 100%); }
            .gradient-blue-light { background: linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%); }
            .text-gradient { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
            .glass-effect { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); }
            .feature-card { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
            .feature-card:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 25px 50px -12px rgba(59, 130, 246, 0.25); }
            .hero-pattern { background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); }
            .blob { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; }
          </style>
        </head>
        <body class="bg-white">
          <!-- ヘッダー -->
          <header class="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-gray-100">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="flex items-center justify-between h-16 md:h-20">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 md:w-12 md:h-12 gradient-blue rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <i class="fas fa-file-invoice-dollar text-white text-lg md:text-xl"></i>
                  </div>
                  <div>
                    <span class="text-xl md:text-2xl font-bold text-gradient">申請らくらく君</span>
                    <span class="hidden md:inline text-xs text-gray-400 ml-2">by SaaS</span>
                  </div>
                </div>
                <nav class="hidden md:flex items-center gap-8">
                  <a href="#features" class="text-gray-600 hover:text-blue-600 transition font-medium">機能</a>
                  <a href="#pricing" class="text-gray-600 hover:text-blue-600 transition font-medium">料金</a>
                  <a href="#login-section" class="text-gray-600 hover:text-blue-600 transition font-medium">ログイン</a>
                </nav>
                <div class="flex items-center gap-3">
                  <a href="#login-section" class="hidden sm:inline-flex text-blue-600 hover:text-blue-700 px-4 py-2 font-medium transition">
                    ログイン
                  </a>
                  <a href="/signup" class="gradient-blue text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium text-sm md:text-base">
                    <i class="fas fa-rocket mr-2"></i>無料で始める
                  </a>
                </div>
              </div>
            </div>
          </header>
          
          <!-- ヒーローセクション -->
          <section class="relative min-h-screen flex items-center overflow-hidden pt-20" style="background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #0284c7 100%);">
            <!-- 装飾要素 -->
            <div class="absolute top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl"></div>
            <div class="absolute bottom-20 right-10 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl"></div>
            
            <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
              <div class="grid lg:grid-cols-2 gap-12 items-center">
                <!-- 左側：テキスト -->
                <div class="text-center lg:text-left">
                  <div class="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium mb-6 fade-in-up">
                    <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    業務効率化に特化したSaaS
                  </div>
                  <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight fade-in-up delay-100" style="text-shadow: 0 2px 10px rgba(0,0,0,0.3);">
                    補助金申請の<br>
                    <span style="color: #7dd3fc;">書類管理をもっと楽に</span>
                  </h1>
                  <p class="text-lg md:text-xl text-white mb-8 max-w-xl mx-auto lg:mx-0 fade-in-up delay-200" style="text-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                    行政書士・士業事務所向けの補助金申請管理SaaS。<br class="hidden md:inline">
                    顧客管理から書類整理、進捗管理まで一元化。<br class="hidden md:inline">
                    <strong>面倒な事務作業を大幅に削減</strong>できます。
                  </p>
                  <div class="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start fade-in-up delay-300">
                    <a href="/signup" class="group bg-white text-blue-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-xl flex items-center justify-center gap-2">
                      <i class="fas fa-rocket group-hover:animate-bounce"></i>
                      無料で始める
                    </a>
                    <a href="#features" class="group border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                      <i class="fas fa-play-circle"></i>
                      詳しく見る
                    </a>
                  </div>
                  
                  <!-- 効率化に特化した数値 -->
                  <div class="mt-10 grid grid-cols-3 gap-4 fade-in-up delay-300">
                    <div class="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                      <div class="text-2xl md:text-3xl font-bold text-white">50%</div>
                      <div class="text-sm text-blue-100">書類整理時間削減</div>
                    </div>
                    <div class="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                      <div class="text-2xl md:text-3xl font-bold text-white">80%</div>
                      <div class="text-sm text-blue-100">検索時間削減</div>
                    </div>
                    <div class="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                      <div class="text-2xl md:text-3xl font-bold text-white">0件</div>
                      <div class="text-sm text-blue-100">書類の紛失</div>
                    </div>
                  </div>
                </div>
                
                <!-- 右側：イメージ（イラスト風UI） -->
                <div class="relative hidden lg:block">
                  <div class="relative z-10">
                    <!-- メインビジュアル：書類管理ダッシュボード風 -->
                    <div class="bg-white rounded-2xl shadow-2xl p-6 float-animation" style="min-width: 480px;">
                      <!-- ヘッダー -->
                      <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                            <i class="fas fa-folder-open text-white"></i>
                          </div>
                          <div>
                            <div class="font-bold text-gray-800">書類管理</div>
                            <div class="text-xs text-gray-500">IT導入補助金 2025</div>
                          </div>
                        </div>
                        <span class="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium">進行中</span>
                      </div>
                      <!-- 書類リスト -->
                      <div class="space-y-3">
                        <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div class="w-8 h-8 bg-blue-100 rounded flex items-center justify-center"><i class="fas fa-file-pdf text-blue-600 text-sm"></i></div>
                          <div class="flex-1"><div class="text-sm font-medium text-gray-700">事業計画書.pdf</div><div class="text-xs text-gray-400">2.4 MB • 更新: 12/24</div></div>
                          <i class="fas fa-check-circle text-green-500"></i>
                        </div>
                        <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div class="w-8 h-8 bg-purple-100 rounded flex items-center justify-center"><i class="fas fa-file-excel text-purple-600 text-sm"></i></div>
                          <div class="flex-1"><div class="text-sm font-medium text-gray-700">見積書一覧.xlsx</div><div class="text-xs text-gray-400">1.1 MB • 更新: 12/23</div></div>
                          <i class="fas fa-check-circle text-green-500"></i>
                        </div>
                        <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div class="w-8 h-8 bg-orange-100 rounded flex items-center justify-center"><i class="fas fa-file-image text-orange-600 text-sm"></i></div>
                          <div class="flex-1"><div class="text-sm font-medium text-gray-700">会社概要資料.pptx</div><div class="text-xs text-gray-400">5.8 MB • 更新: 12/22</div></div>
                          <i class="fas fa-check-circle text-green-500"></i>
                        </div>
                        <div class="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div class="w-8 h-8 bg-yellow-100 rounded flex items-center justify-center"><i class="fas fa-file-alt text-yellow-600 text-sm"></i></div>
                          <div class="flex-1"><div class="text-sm font-medium text-gray-700">納税証明書.pdf</div><div class="text-xs text-yellow-600">未アップロード</div></div>
                          <i class="fas fa-exclamation-circle text-yellow-500"></i>
                        </div>
                      </div>
                      <!-- 進捗バー -->
                      <div class="mt-6">
                        <div class="flex justify-between text-xs text-gray-500 mb-2">
                          <span>書類準備状況</span>
                          <span class="font-medium text-blue-600">75%</span>
                        </div>
                        <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style="width: 75%"></div>
                        </div>
                      </div>
                    </div>
                    <!-- オーバーレイカード：書類管理 -->
                    <div class="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl">
                      <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <i class="fas fa-cloud-upload-alt text-blue-600 text-xl"></i>
                        </div>
                        <div>
                          <div class="text-sm text-gray-500">クラウド管理</div>
                          <div class="text-xl font-bold text-gray-800">いつでもアクセス</div>
                        </div>
                      </div>
                    </div>
                    <!-- オーバーレイカード：時間削減 -->
                    <div class="absolute -top-4 -right-4 bg-white p-4 rounded-xl shadow-xl">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <i class="fas fa-clock text-green-600"></i>
                        </div>
                        <div>
                          <div class="text-xs text-gray-500">作業時間</div>
                          <div class="text-lg font-bold text-green-600">50%削減</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- スクロールインジケーター -->
            <div class="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/80 animate-bounce">
              <i class="fas fa-chevron-down text-2xl"></i>
            </div>
          </section>
          
          <!-- 課題セクション -->
          <section class="py-20 bg-gray-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="text-center mb-16">
                <span class="inline-block bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-sm font-medium mb-4">こんな課題ありませんか？</span>
                <h2 class="text-3xl md:text-4xl font-bold text-gray-900">補助金申請業務の<span class="text-gradient">悩み</span>を解決</h2>
              </div>
              
              <div class="grid md:grid-cols-3 gap-8">
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all">
                  <div class="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mb-5">
                    <i class="fas fa-folder-open text-red-500 text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">書類管理が煩雑</h3>
                  <p class="text-gray-600">顧客ごとに必要書類が異なり、どこに何があるか分からなくなる...</p>
                </div>
                
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all">
                  <div class="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mb-5">
                    <i class="fas fa-clock text-orange-500 text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">進捗が見えない</h3>
                  <p class="text-gray-600">複数案件を同時進行すると、どの案件がどの段階か把握が困難...</p>
                </div>
                
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all">
                  <div class="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center mb-5">
                    <i class="fas fa-comments text-yellow-600 text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">顧客対応に時間</h3>
                  <p class="text-gray-600">「今どうなってますか？」の問い合わせ対応で業務が中断...</p>
                </div>
              </div>
              
              <div class="text-center mt-12">
                <div class="inline-flex items-center gap-2 text-blue-600 font-medium">
                  <i class="fas fa-arrow-down text-2xl animate-bounce"></i>
                  <span>申請らくらく君がすべて解決します</span>
                </div>
              </div>
            </div>
          </section>
          
          <!-- 特徴セクション -->
          <section id="features" class="py-24 bg-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="text-center mb-16">
                <span class="inline-block bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-sm font-medium mb-4">Features</span>
                <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">必要な機能を<span class="text-gradient">オールインワン</span>で</h2>
                <p class="text-gray-600 max-w-2xl mx-auto text-lg">
                  補助金申請業務に必要なすべての機能を、使いやすいインターフェースで提供します
                </p>
              </div>
              
              <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div class="feature-card bg-gradient-to-br from-blue-50 to-white p-8 rounded-2xl border border-blue-100">
                  <div class="w-16 h-16 gradient-blue rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
                    <i class="fas fa-users text-white text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">顧客・案件管理</h3>
                  <p class="text-gray-600 mb-4">顧客情報と案件を紐づけて一元管理。進捗状況もリアルタイムで把握できます。</p>
                  <ul class="text-sm text-gray-500 space-y-2">
                    <li class="flex items-center gap-2"><i class="fas fa-check text-blue-500"></i>顧客データベース</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-blue-500"></i>案件紐づけ管理</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-blue-500"></i>検索・フィルター機能</li>
                  </ul>
                </div>
                
                <div class="feature-card bg-gradient-to-br from-green-50 to-white p-8 rounded-2xl border border-green-100">
                  <div class="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-green-500/30">
                    <i class="fas fa-tasks text-white text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">進捗ボード</h3>
                  <p class="text-gray-600 mb-4">カンバン形式で案件の進捗を一目で把握。複数案件の状況を同時に管理できます。</p>
                  <ul class="text-sm text-gray-500 space-y-2">
                    <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i>カンバンボード</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i>ステータス管理</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-green-500"></i>締切アラート</li>
                  </ul>
                </div>
                
                <div class="feature-card bg-gradient-to-br from-purple-50 to-white p-8 rounded-2xl border border-purple-100">
                  <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30">
                    <i class="fas fa-file-alt text-white text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">書類管理</h3>
                  <p class="text-gray-600 mb-4">申請に必要な書類をクラウドで管理。チェックリストで漏れを防止します。</p>
                  <ul class="text-sm text-gray-500 space-y-2">
                    <li class="flex items-center gap-2"><i class="fas fa-check text-purple-500"></i>クラウド保存</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-purple-500"></i>チェックリスト</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-purple-500"></i>バージョン管理</li>
                  </ul>
                </div>
                
                <div class="feature-card bg-gradient-to-br from-orange-50 to-white p-8 rounded-2xl border border-orange-100">
                  <div class="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-orange-500/30">
                    <i class="fas fa-chart-line text-white text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">統計・レポート</h3>
                  <p class="text-gray-600 mb-4">案件数や処理状況をグラフで確認。業務の見える化で効率アップ。</p>
                  <ul class="text-sm text-gray-500 space-y-2">
                    <li class="flex items-center gap-2"><i class="fas fa-check text-orange-500"></i>案件状況分析</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-orange-500"></i>月次レポート</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-orange-500"></i>業務量可視化</li>
                  </ul>
                </div>
                
                <div class="feature-card bg-gradient-to-br from-pink-50 to-white p-8 rounded-2xl border border-pink-100">
                  <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-pink-500/30">
                    <i class="fas fa-link text-white text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">顧客ポータル</h3>
                  <p class="text-gray-600 mb-4">顧客専用ページで進捗を共有。問い合わせ対応の手間を削減できます。</p>
                  <ul class="text-sm text-gray-500 space-y-2">
                    <li class="flex items-center gap-2"><i class="fas fa-check text-pink-500"></i>専用URL発行</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-pink-500"></i>リアルタイム共有</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-pink-500"></i>メッセージ機能</li>
                  </ul>
                </div>
                
                <div class="feature-card bg-gradient-to-br from-cyan-50 to-white p-8 rounded-2xl border border-cyan-100">
                  <div class="w-16 h-16 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/30">
                    <i class="fas fa-robot text-white text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">AI支援機能</h3>
                  <p class="text-gray-600 mb-4">AIが書類作成や申請内容のチェックをサポート。作業効率を大幅に向上。</p>
                  <ul class="text-sm text-gray-500 space-y-2">
                    <li class="flex items-center gap-2"><i class="fas fa-check text-cyan-500"></i>書類自動生成</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-cyan-500"></i>内容チェック</li>
                    <li class="flex items-center gap-2"><i class="fas fa-check text-cyan-500"></i>補助金マッチング</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
          
          <!-- ダッシュボードプレビュー -->
          <section class="py-24 gradient-blue-light">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <span class="inline-block bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-sm font-medium mb-4">Dashboard</span>
                  <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-6">直感的な<span class="text-gradient">ダッシュボード</span></h2>
                  <p class="text-gray-600 text-lg mb-8">
                    すべての情報を一画面で把握。案件の進捗、今日のタスク、重要な通知をリアルタイムで確認できます。
                  </p>
                  <ul class="space-y-4">
                    <li class="flex items-start gap-4">
                      <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        <i class="fas fa-tachometer-alt text-blue-600"></i>
                      </div>
                      <div>
                        <h4 class="font-bold text-gray-800">リアルタイム更新</h4>
                        <p class="text-gray-600 text-sm">データは自動更新。常に最新の状態を確認できます。</p>
                      </div>
                    </li>
                    <li class="flex items-start gap-4">
                      <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        <i class="fas fa-mobile-alt text-green-600"></i>
                      </div>
                      <div>
                        <h4 class="font-bold text-gray-800">レスポンシブ対応</h4>
                        <p class="text-gray-600 text-sm">PC、タブレット、スマホどこからでもアクセス可能。</p>
                      </div>
                    </li>
                    <li class="flex items-start gap-4">
                      <div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        <i class="fas fa-cog text-purple-600"></i>
                      </div>
                      <div>
                        <h4 class="font-bold text-gray-800">カスタマイズ可能</h4>
                        <p class="text-gray-600 text-sm">表示項目を自由に設定。自分だけのダッシュボードに。</p>
                      </div>
                    </li>
                  </ul>
                </div>
                <div class="relative">
                  <!-- ダッシュボード風UI -->
                  <div class="bg-white rounded-2xl shadow-2xl overflow-hidden" style="min-width: 520px;">
                    <!-- ダッシュボードヘッダー -->
                    <div class="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                            <i class="fas fa-chart-pie text-white"></i>
                          </div>
                          <span class="text-white font-bold">ダッシュボード</span>
                        </div>
                        <div class="flex gap-2">
                          <span class="bg-white/20 text-white text-xs px-3 py-1 rounded-full">12月</span>
                        </div>
                      </div>
                    </div>
                    <!-- 統計カード -->
                    <div class="p-6">
                      <div class="grid grid-cols-3 gap-4 mb-6">
                        <div class="bg-blue-50 p-4 rounded-xl text-center">
                          <div class="text-2xl font-bold text-blue-600">24</div>
                          <div class="text-xs text-gray-500">進行中案件</div>
                        </div>
                        <div class="bg-green-50 p-4 rounded-xl text-center">
                          <div class="text-2xl font-bold text-green-600">18</div>
                          <div class="text-xs text-gray-500">今月完了</div>
                        </div>
                        <div class="bg-purple-50 p-4 rounded-xl text-center">
                          <div class="text-2xl font-bold text-purple-600">156</div>
                          <div class="text-xs text-gray-500">管理書類</div>
                        </div>
                      </div>
                      <!-- 案件リスト -->
                      <div class="text-sm font-medium text-gray-700 mb-3">直近の案件</div>
                      <div class="space-y-2">
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div class="flex items-center gap-3">
                            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span class="text-sm text-gray-700">株式会社ABC - IT導入補助金</span>
                          </div>
                          <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">申請中</span>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div class="flex items-center gap-3">
                            <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span class="text-sm text-gray-700">有限会社XYZ - 事業再構築</span>
                          </div>
                          <span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">書類準備</span>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div class="flex items-center gap-3">
                            <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span class="text-sm text-gray-700">DEF株式会社 - 小規模持続化</span>
                          </div>
                          <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">採択待ち</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- オーバーレイカード -->
                  <div class="absolute -bottom-6 -right-6 bg-white p-4 rounded-xl shadow-xl">
                    <div class="flex items-center gap-3">
                      <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <i class="fas fa-check-double text-white text-xl"></i>
                      </div>
                      <div>
                        <div class="text-2xl font-bold text-gray-800">書類漏れ0</div>
                        <div class="text-sm text-gray-500">チェック機能で安心</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          
          <!-- 料金セクション -->
          <section id="pricing" class="py-24 bg-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="text-center mb-16">
                <span class="inline-block bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-sm font-medium mb-4">Pricing</span>
                <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">シンプルな<span class="text-gradient">料金プラン</span></h2>
                <p class="text-gray-600 max-w-2xl mx-auto text-lg">
                  案件数に応じた柔軟なプラン設定。必要な分だけお支払い。
                </p>
              </div>
              
              <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <!-- ベーシック -->
                <div class="bg-white border-2 border-gray-200 rounded-3xl p-8 hover:border-blue-300 hover:shadow-xl transition-all duration-300">
                  <div class="text-center mb-8">
                    <h3 class="text-xl font-bold text-gray-800 mb-2">ベーシック</h3>
                    <div class="text-4xl font-bold text-gray-900 mb-1">¥3,000<span class="text-lg font-normal text-gray-500">/月</span></div>
                    <p class="text-gray-500">月1枠まで</p>
                  </div>
                  <ul class="space-y-4 mb-8">
                    <li class="flex items-center gap-3 text-gray-600">
                      <i class="fas fa-check text-blue-500"></i>顧客管理
                    </li>
                    <li class="flex items-center gap-3 text-gray-600">
                      <i class="fas fa-check text-blue-500"></i>案件管理
                    </li>
                    <li class="flex items-center gap-3 text-gray-600">
                      <i class="fas fa-check text-blue-500"></i>進捗ボード
                    </li>
                    <li class="flex items-center gap-3 text-gray-600">
                      <i class="fas fa-check text-blue-500"></i>基本サポート
                    </li>
                  </ul>
                  <a href="/signup" class="block w-full text-center py-3 border-2 border-blue-600 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition">
                    始める
                  </a>
                </div>
                
                <!-- スタンダード（人気） -->
                <div class="relative bg-gradient-to-b from-blue-600 to-blue-700 rounded-3xl p-8 text-white transform md:scale-105 shadow-2xl shadow-blue-500/30">
                  <div class="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span class="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold px-4 py-1 rounded-full shadow-lg">
                      <i class="fas fa-star mr-1"></i>人気No.1
                    </span>
                  </div>
                  <div class="text-center mb-8 pt-4">
                    <h3 class="text-xl font-bold mb-2">スタンダード</h3>
                    <div class="text-4xl font-bold mb-1">¥5,000<span class="text-lg font-normal text-blue-200">/月</span></div>
                    <p class="text-blue-200">月3枠まで</p>
                  </div>
                  <ul class="space-y-4 mb-8">
                    <li class="flex items-center gap-3">
                      <i class="fas fa-check text-cyan-300"></i>ベーシックの全機能
                    </li>
                    <li class="flex items-center gap-3">
                      <i class="fas fa-check text-cyan-300"></i>書類管理
                    </li>
                    <li class="flex items-center gap-3">
                      <i class="fas fa-check text-cyan-300"></i>顧客ポータル
                    </li>
                    <li class="flex items-center gap-3">
                      <i class="fas fa-check text-cyan-300"></i>優先サポート
                    </li>
                  </ul>
                  <a href="/signup" class="block w-full text-center py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition shadow-lg">
                    始める
                  </a>
                </div>
                
                <!-- プレミアム -->
                <div class="bg-white border-2 border-gray-200 rounded-3xl p-8 hover:border-blue-300 hover:shadow-xl transition-all duration-300">
                  <div class="text-center mb-8">
                    <h3 class="text-xl font-bold text-gray-800 mb-2">プレミアム</h3>
                    <div class="text-4xl font-bold text-gray-900 mb-1">¥10,000<span class="text-lg font-normal text-gray-500">/月</span></div>
                    <p class="text-gray-500">月10枠まで</p>
                  </div>
                  <ul class="space-y-4 mb-8">
                    <li class="flex items-center gap-3 text-gray-600">
                      <i class="fas fa-check text-blue-500"></i>スタンダードの全機能
                    </li>
                    <li class="flex items-center gap-3 text-gray-600">
                      <i class="fas fa-check text-blue-500"></i>AI支援機能
                    </li>
                    <li class="flex items-center gap-3 text-gray-600">
                      <i class="fas fa-check text-blue-500"></i>統計・レポート
                    </li>
                    <li class="flex items-center gap-3 text-gray-600">
                      <i class="fas fa-check text-blue-500"></i>専任サポート
                    </li>
                  </ul>
                  <a href="/signup" class="block w-full text-center py-3 border-2 border-blue-600 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition">
                    始める
                  </a>
                </div>
              </div>
              
              <p class="text-center text-gray-500 mt-8">
                ※ Business（月30枠/¥30,000）、Enterprise（月100枠/¥100,000）プランもございます。
              </p>
            </div>
          </section>
          
          <!-- ログインセクション -->
          <section id="login-section" class="py-24 gradient-blue-light">
            <div class="max-w-xl mx-auto px-4">
              <div class="bg-white rounded-3xl shadow-2xl p-8 md:p-10">
                <div class="text-center mb-8">
                  <div class="w-16 h-16 gradient-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                    <i class="fas fa-sign-in-alt text-white text-2xl"></i>
                  </div>
                  <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-2">ログイン</h2>
                  <p class="text-gray-600">メールアドレスから組織を検索</p>
                </div>
                
                <div class="space-y-6">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">登録メールアドレス</label>
                    <div class="flex gap-3">
                      <input type="email" id="searchEmail" placeholder="example@company.com" 
                        class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition">
                      <button onclick="searchOrganization()" id="searchBtn"
                        class="px-6 py-3 gradient-blue text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium whitespace-nowrap">
                        <i class="fas fa-search mr-2"></i>検索
                      </button>
                    </div>
                  </div>
                  
                  <div id="searchResult" class="hidden"></div>
                  
                  <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                      <div class="w-full border-t-2 border-gray-100"></div>
                    </div>
                    <div class="relative flex justify-center text-sm">
                      <span class="px-4 bg-white text-gray-400">または</span>
                    </div>
                  </div>
                  
                  <div class="bg-gray-50 rounded-xl p-5">
                    <p class="text-sm text-gray-600 mb-3 font-medium">組織URLを直接入力</p>
                    <div class="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-xl p-2">
                      <span class="text-gray-400 pl-2 text-sm">https://</span>
                      <input type="text" id="directSlug" placeholder="your-company" 
                        class="flex-1 py-2 outline-none text-sm">
                      <span class="text-gray-400 text-sm">.shinsei-raku.com</span>
                    </div>
                    <button onclick="goToOrganization()" class="w-full mt-4 px-4 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition font-medium">
                      <i class="fas fa-arrow-right mr-2"></i>移動する
                    </button>
                  </div>
                </div>
              </div>
              
              <p class="text-center mt-8 text-gray-600">
                アカウントをお持ちでない方は
                <a href="/signup" class="text-blue-600 hover:underline font-bold">新規登録</a>
              </p>
            </div>
          </section>
          
          <!-- CTA セクション -->
          <section class="py-20 gradient-blue relative overflow-hidden">
            <div class="absolute inset-0 hero-pattern"></div>
            <div class="relative max-w-4xl mx-auto px-4 text-center">
              <h2 class="text-3xl md:text-4xl font-bold text-white mb-6">
                補助金申請業務を、もっとシンプルに
              </h2>
              <p class="text-xl text-blue-100 mb-8">
                今すぐ無料で始めて、業務効率化を実感してください
              </p>
              <a href="/signup" class="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-xl">
                <i class="fas fa-rocket"></i>
                無料で始める
              </a>
            </div>
          </section>
          
          <!-- フッター -->
          <footer class="bg-gray-900 text-white py-16">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="grid md:grid-cols-4 gap-12 mb-12">
                <div>
                  <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 gradient-blue rounded-xl flex items-center justify-center">
                      <i class="fas fa-file-invoice-dollar text-white"></i>
                    </div>
                    <span class="text-xl font-bold">申請らくらく君</span>
                  </div>
                  <p class="text-gray-400">補助金・助成金申請をもっとシンプルに。士業事務所のDXを支援します。</p>
                </div>
                
                <div>
                  <h4 class="font-bold mb-6 text-lg">サービス</h4>
                  <ul class="space-y-3 text-gray-400">
                    <li><a href="#features" class="hover:text-white transition">機能一覧</a></li>
                    <li><a href="#pricing" class="hover:text-white transition">料金プラン</a></li>
                    <li><a href="/signup" class="hover:text-white transition">新規登録</a></li>
                  </ul>
                </div>
                
                <div>
                  <h4 class="font-bold mb-6 text-lg">サポート</h4>
                  <ul class="space-y-3 text-gray-400">
                    <li><a href="#login-section" class="hover:text-white transition">ログイン</a></li>
                    <li><a href="/master/login" class="hover:text-white transition">管理者ログイン</a></li>
                  </ul>
                </div>
                
                <div>
                  <h4 class="font-bold mb-6 text-lg">法的情報</h4>
                  <ul class="space-y-3 text-gray-400">
                    <li><a href="/master/terms" class="hover:text-white transition">利用規約</a></li>
                    <li><a href="/master/privacy-policy" class="hover:text-white transition">プライバシーポリシー</a></li>
                    <li><a href="/master/legal" class="hover:text-white transition">特定商取引法に基づく表記</a></li>
                  </ul>
                </div>
              </div>
              
              <div class="border-t border-gray-800 pt-8 text-center text-gray-500">
                © 2024 申請らくらく君 All rights reserved.
              </div>
            </div>
          </footer>
          
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
              btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>検索中...';
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
                  let html = '<div class="space-y-3">';
                  html += '<p class="text-sm text-green-700 font-medium flex items-center gap-2"><i class="fas fa-check-circle"></i>以下の組織が見つかりました</p>';
                  data.organizations.forEach(org => {
                    const url = 'https://' + org.slug + '.shinsei-raku.com/login';
                    html += '<a href="' + url + '" class="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl hover:border-green-400 hover:shadow-lg transition-all group">';
                    html += '<div>';
                    html += '<div class="font-bold text-gray-800">' + org.name + '</div>';
                    html += '<div class="text-sm text-gray-500">' + org.slug + '.shinsei-raku.com</div>';
                    html += '</div>';
                    html += '<span class="bg-green-600 text-white px-5 py-2 rounded-lg group-hover:bg-green-700 transition font-medium"><i class="fas fa-sign-in-alt mr-2"></i>ログイン</span>';
                    html += '</a>';
                  });
                  html += '</div>';
                  resultDiv.innerHTML = html;
                } else {
                  resultDiv.innerHTML = '<div class="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-800 flex items-start gap-3"><i class="fas fa-exclamation-triangle mt-1"></i><div>このメールアドレスで登録された組織は見つかりませんでした。<a href="/signup" class="underline font-bold">新規登録</a>をお試しください。</div></div>';
                }
              } catch (error) {
                resultDiv.classList.remove('hidden');
                resultDiv.innerHTML = '<div class="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-800 flex items-center gap-3"><i class="fas fa-times-circle"></i>検索中にエラーが発生しました。</div>';
              } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-search mr-2"></i>検索';
              }
            }
            
            function goToOrganization() {
              const slug = document.getElementById('directSlug').value.trim().toLowerCase();
              if (!slug) {
                alert('組織IDを入力してください');
                return;
              }
              window.location.href = 'https://' + slug + '.shinsei-raku.com/login';
            }
            
            document.getElementById('searchEmail').addEventListener('keypress', function(e) {
              if (e.key === 'Enter') searchOrganization();
            });
            document.getElementById('directSlug').addEventListener('keypress', function(e) {
              if (e.key === 'Enter') goToOrganization();
            });
            
            // スムーススクロール
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
              anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              });
            });
          </script>
        </body>
        </html>
      `)
    }
    
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
app.route('/api', emailRoutes)
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
app.route('', masterPublicLegalPages)
app.route('', master_logsPages)
app.route('', master_plansPages)
app.route('', masterPages)
app.route('', masterInquiriesPages)
app.route('', masterAnnouncementsPages)
app.route('', masterGuidelinesPages)
app.route('', masterPipelinesPages)
app.route('', masterSubsidyTypesPages)
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
