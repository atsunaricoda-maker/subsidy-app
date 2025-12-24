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
    
    // ルートドメインのトップページ（/）はポータルページを表示
    if (path === '/') {
      return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>申請らくらく君 - 補助金・助成金申請サポートSaaS</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
          <style>
            .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .feature-card:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
            .feature-card { transition: all 0.3s ease; }
          </style>
        </head>
        <body class="bg-gray-50">
          <!-- ヘッダー -->
          <header class="bg-white shadow-sm sticky top-0 z-50">
            <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center">
                  <i class="fas fa-file-invoice-dollar text-white text-lg"></i>
                </div>
                <span class="text-xl font-bold text-gray-800">申請らくらく君</span>
              </div>
              <div class="flex items-center gap-3">
                <a href="#login-section" class="text-gray-600 hover:text-gray-800 px-4 py-2">ログイン</a>
                <a href="/signup" class="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition font-medium">
                  新規登録
                </a>
              </div>
            </div>
          </header>
          
          <!-- ヒーローセクション -->
          <section class="gradient-bg text-white py-20">
            <div class="max-w-6xl mx-auto px-4 text-center">
              <h1 class="text-4xl md:text-5xl font-bold mb-6">
                補助金・助成金申請を<br class="md:hidden">もっとシンプルに
              </h1>
              <p class="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                行政書士・士業事務所向けの補助金申請管理SaaS。<br>
                顧客管理から書類作成、進捗管理まで一元化できます。
              </p>
              <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/signup" class="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg">
                  <i class="fas fa-rocket mr-2"></i>無料で始める
                </a>
                <a href="#features" class="border-2 border-white/50 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition">
                  <i class="fas fa-info-circle mr-2"></i>詳しく見る
                </a>
              </div>
            </div>
          </section>
          
          <!-- 特徴セクション -->
          <section id="features" class="py-20">
            <div class="max-w-6xl mx-auto px-4">
              <h2 class="text-3xl font-bold text-center text-gray-800 mb-4">主な機能</h2>
              <p class="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
                補助金申請業務に必要な機能をオールインワンで提供
              </p>
              
              <div class="grid md:grid-cols-3 gap-8">
                <div class="feature-card bg-white p-8 rounded-2xl shadow-sm">
                  <div class="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-5">
                    <i class="fas fa-users text-blue-600 text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">顧客・案件管理</h3>
                  <p class="text-gray-600">顧客情報と案件を紐づけて一元管理。進捗状況もリアルタイムで把握できます。</p>
                </div>
                
                <div class="feature-card bg-white p-8 rounded-2xl shadow-sm">
                  <div class="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-5">
                    <i class="fas fa-tasks text-green-600 text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">進捗ボード</h3>
                  <p class="text-gray-600">カンバン形式で案件の進捗を可視化。ドラッグ&ドロップで簡単にステータス変更。</p>
                </div>
                
                <div class="feature-card bg-white p-8 rounded-2xl shadow-sm">
                  <div class="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-5">
                    <i class="fas fa-file-alt text-purple-600 text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">書類管理</h3>
                  <p class="text-gray-600">申請に必要な書類をクラウドで管理。チェックリストで漏れを防止します。</p>
                </div>
                
                <div class="feature-card bg-white p-8 rounded-2xl shadow-sm">
                  <div class="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mb-5">
                    <i class="fas fa-chart-line text-orange-600 text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">統計・レポート</h3>
                  <p class="text-gray-600">採択率や売上の推移をグラフで確認。データに基づいた経営判断を支援。</p>
                </div>
                
                <div class="feature-card bg-white p-8 rounded-2xl shadow-sm">
                  <div class="w-14 h-14 bg-pink-100 rounded-xl flex items-center justify-center mb-5">
                    <i class="fas fa-link text-pink-600 text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">顧客ポータル</h3>
                  <p class="text-gray-600">顧客専用ページで進捗を共有。問い合わせ対応の手間を削減できます。</p>
                </div>
                
                <div class="feature-card bg-white p-8 rounded-2xl shadow-sm">
                  <div class="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center mb-5">
                    <i class="fas fa-robot text-cyan-600 text-2xl"></i>
                  </div>
                  <h3 class="text-xl font-bold text-gray-800 mb-3">AI支援機能</h3>
                  <p class="text-gray-600">AIが書類作成や申請内容のチェックをサポート。作業効率を大幅に向上。</p>
                </div>
              </div>
            </div>
          </section>
          
          <!-- 料金セクション -->
          <section class="py-20 bg-white">
            <div class="max-w-6xl mx-auto px-4">
              <h2 class="text-3xl font-bold text-center text-gray-800 mb-4">料金プラン</h2>
              <p class="text-gray-600 text-center mb-12">案件数に応じた柔軟なプラン設定</p>
              
              <div class="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div class="border-2 border-gray-200 rounded-2xl p-6 text-center hover:border-blue-300 transition">
                  <h3 class="font-bold text-gray-800 mb-2">ベーシック</h3>
                  <div class="text-3xl font-bold text-gray-800 mb-1">¥3,000<span class="text-base font-normal text-gray-500">/月</span></div>
                  <p class="text-sm text-gray-500 mb-4">月1枠まで</p>
                  <p class="text-sm text-gray-600">お試しに最適</p>
                </div>
                
                <div class="border-2 border-blue-500 rounded-2xl p-6 text-center relative bg-blue-50">
                  <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full">人気</div>
                  <h3 class="font-bold text-gray-800 mb-2">スタンダード</h3>
                  <div class="text-3xl font-bold text-blue-600 mb-1">¥5,000<span class="text-base font-normal text-gray-500">/月</span></div>
                  <p class="text-sm text-gray-500 mb-4">月3枠まで</p>
                  <p class="text-sm text-gray-600">小規模事務所向け</p>
                </div>
                
                <div class="border-2 border-gray-200 rounded-2xl p-6 text-center hover:border-blue-300 transition">
                  <h3 class="font-bold text-gray-800 mb-2">プレミアム</h3>
                  <div class="text-3xl font-bold text-gray-800 mb-1">¥10,000<span class="text-base font-normal text-gray-500">/月</span></div>
                  <p class="text-sm text-gray-500 mb-4">月10枠まで</p>
                  <p class="text-sm text-gray-600">成長中の事務所向け</p>
                </div>
              </div>
              
              <p class="text-center text-sm text-gray-500 mt-6">
                ※ Business（月30枠）、Enterprise（月100枠）プランもございます。
                <a href="/signup" class="text-blue-600 hover:underline">詳しくはお問い合わせください</a>
              </p>
            </div>
          </section>
          
          <!-- ログインセクション -->
          <section id="login-section" class="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
            <div class="max-w-xl mx-auto px-4">
              <div class="bg-white rounded-2xl shadow-xl p-8">
                <h2 class="text-2xl font-bold text-center text-gray-800 mb-2">既にアカウントをお持ちの方</h2>
                <p class="text-gray-600 text-center mb-6">メールアドレスから組織を検索してログイン</p>
                
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">登録メールアドレス</label>
                    <div class="flex gap-2">
                      <input type="email" id="searchEmail" placeholder="example@company.com" 
                        class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                      <button onclick="searchOrganization()" id="searchBtn"
                        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium whitespace-nowrap">
                        <i class="fas fa-search mr-2"></i>検索
                      </button>
                    </div>
                  </div>
                  
                  <div id="searchResult" class="hidden"></div>
                  
                  <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                      <div class="w-full border-t border-gray-200"></div>
                    </div>
                    <div class="relative flex justify-center text-sm">
                      <span class="px-4 bg-white text-gray-500">または</span>
                    </div>
                  </div>
                  
                  <div class="bg-gray-50 rounded-lg p-4">
                    <p class="text-sm text-gray-600 mb-2">組織URLを直接入力：</p>
                    <div class="flex items-center gap-2">
                      <span class="text-gray-400">https://</span>
                      <input type="text" id="directSlug" placeholder="your-company" 
                        class="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">
                      <span class="text-gray-400">.shinsei-raku.com</span>
                    </div>
                    <button onclick="goToOrganization()" class="w-full mt-3 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition text-sm">
                      <i class="fas fa-arrow-right mr-2"></i>移動する
                    </button>
                  </div>
                </div>
              </div>
              
              <p class="text-center mt-6 text-gray-600">
                アカウントをお持ちでない方は
                <a href="/signup" class="text-blue-600 hover:underline font-medium">新規登録</a>
              </p>
            </div>
          </section>
          
          <!-- フッター -->
          <footer class="bg-gray-800 text-white py-12">
            <div class="max-w-6xl mx-auto px-4">
              <div class="grid md:grid-cols-4 gap-8 mb-8">
                <div>
                  <div class="flex items-center gap-2 mb-4">
                    <div class="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center">
                      <i class="fas fa-file-invoice-dollar text-white text-sm"></i>
                    </div>
                    <span class="font-bold">申請らくらく君</span>
                  </div>
                  <p class="text-gray-400 text-sm">補助金・助成金申請をもっとシンプルに</p>
                </div>
                
                <div>
                  <h4 class="font-bold mb-4">サービス</h4>
                  <ul class="space-y-2 text-gray-400 text-sm">
                    <li><a href="#features" class="hover:text-white transition">機能一覧</a></li>
                    <li><a href="/signup" class="hover:text-white transition">新規登録</a></li>
                    <li><a href="#login-section" class="hover:text-white transition">ログイン</a></li>
                  </ul>
                </div>
                
                <div>
                  <h4 class="font-bold mb-4">サポート</h4>
                  <ul class="space-y-2 text-gray-400 text-sm">
                    <li><a href="/master/login" class="hover:text-white transition">管理者ログイン</a></li>
                  </ul>
                </div>
                
                <div>
                  <h4 class="font-bold mb-4">法的情報</h4>
                  <ul class="space-y-2 text-gray-400 text-sm">
                    <li><a href="/terms" class="hover:text-white transition">利用規約</a></li>
                    <li><a href="/privacy" class="hover:text-white transition">プライバシーポリシー</a></li>
                    <li><a href="/commercial-law" class="hover:text-white transition">特定商取引法に基づく表記</a></li>
                  </ul>
                </div>
              </div>
              
              <div class="border-t border-gray-700 pt-8 text-center text-gray-400 text-sm">
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
                  let html = '<div class="space-y-2">';
                  html += '<p class="text-sm text-green-700 font-medium"><i class="fas fa-check-circle mr-1"></i>以下の組織が見つかりました：</p>';
                  data.organizations.forEach(org => {
                    const url = 'https://' + org.slug + '.shinsei-raku.com/login';
                    html += '<a href="' + url + '" class="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition group">';
                    html += '<div>';
                    html += '<div class="font-bold text-gray-800">' + org.name + '</div>';
                    html += '<div class="text-sm text-gray-500">' + org.slug + '.shinsei-raku.com</div>';
                    html += '</div>';
                    html += '<span class="bg-green-600 text-white px-4 py-2 rounded-lg group-hover:bg-green-700 transition"><i class="fas fa-sign-in-alt mr-1"></i>ログイン</span>';
                    html += '</a>';
                  });
                  html += '</div>';
                  resultDiv.innerHTML = html;
                } else {
                  resultDiv.innerHTML = '<div class="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800"><i class="fas fa-exclamation-triangle mr-2"></i>このメールアドレスで登録された組織は見つかりませんでした。<a href="/signup" class="underline font-medium">新規登録</a>をお試しください。</div>';
                }
              } catch (error) {
                resultDiv.classList.remove('hidden');
                resultDiv.innerHTML = '<div class="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800"><i class="fas fa-times-circle mr-2"></i>検索中にエラーが発生しました。</div>';
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
            
            // Enterキーで検索
            document.getElementById('searchEmail').addEventListener('keypress', function(e) {
              if (e.key === 'Enter') searchOrganization();
            });
            document.getElementById('directSlug').addEventListener('keypress', function(e) {
              if (e.key === 'Enter') goToOrganization();
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
