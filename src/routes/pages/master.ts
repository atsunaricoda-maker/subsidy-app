import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'
// マスター管理ダッシュボード
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// マスターログインページ
routes.get('/master/login', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>マスター管理ログイン</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-900 min-h-screen flex items-center justify-center">
        <div class="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-gray-700">
            <div class="text-center mb-8">
                <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-shield-alt text-3xl text-white"></i>
                </div>
                <h1 class="text-2xl font-bold text-white">マスター管理コンソール</h1>
                <p class="text-sm text-gray-400 mt-2">SaaS運営管理者専用</p>
            </div>
            
            <form id="loginForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">ユーザー名</label>
                    <input type="text" name="username" required 
                           class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">パスワード</label>
                    <input type="password" name="password" required 
                           class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
                <button type="submit" 
                        class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors">
                    <i class="fas fa-lock mr-2"></i>ログイン
                </button>
            </form>
            
            <div id="errorMessage" class="hidden mt-4 p-3 bg-red-900/50 text-red-300 rounded-lg text-sm border border-red-800"></div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                try {
                    const response = await axios.post('/master/login', data);
                    localStorage.setItem('master_token', response.data.token);
                    localStorage.setItem('master_name', response.data.name);
                    window.location.href = '/master';
                } catch (error) {
                    const errorDiv = document.getElementById('errorMessage');
                    errorDiv.textContent = 'ログインに失敗しました。認証情報を確認してください。';
                    errorDiv.classList.remove('hidden');
                }
            });
        </script>
    </body>
    </html>
  `)
})

// マスターログインAPI
routes.post('/master/login', async (c) => {
  const { DB } = c.env
  const { username, password } = await c.req.json()

  // ユーザー名でのみ検索（パスワードはアプリ側で検証）
  const admin = await DB.prepare(`
    SELECT * FROM master_admins WHERE username = ?
  `).bind(username).first() as any

  if (!admin) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  // パスワード検証（ハッシュ化済みかどうかで分岐）
  const { verifyPassword, isPasswordHashed } = await import('../../utils/password')
  const isValid = await verifyPassword(password, admin.password_hash)
  if (!isValid) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  // 平文パスワードの場合、ハッシュ化して更新
  if (!isPasswordHashed(admin.password_hash)) {
    try {
      const { hashPassword } = await import('../../utils/password')
      const hashed = await hashPassword(password)
      await DB.prepare(`UPDATE master_admins SET password_hash = ? WHERE id = ?`).bind(hashed, admin.id).run()
    } catch (e) {
      console.error('Failed to migrate master password:', e)
    }
  }

  const token = btoa(`master:${admin.id}:${Date.now()}`)

  return c.json({
    token,
    name: admin.name,
    role: admin.role
  })
})

// マスターダッシュボード
routes.get('/master', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>マスター管理 - ダッシュボード</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('dashboard')}
            
            <main class="flex-1 p-8">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-800">ダッシュボード</h1>
                    <p class="text-gray-600 mt-1">SaaS全体の状況を確認</p>
                </div>
                
                <!-- 統計カード -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">総法人数</p>
                                <p id="totalOrgs" class="text-3xl font-bold text-gray-800">-</p>
                            </div>
                            <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <i class="fas fa-building text-blue-600 text-xl"></i>
                            </div>
                        </div>
                        <p class="text-sm text-green-600 mt-2"><i class="fas fa-arrow-up mr-1"></i><span id="newOrgsMonth">-</span> 今月</p>
                    </div>
                    
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">アクティブ法人</p>
                                <p id="activeOrgs" class="text-3xl font-bold text-gray-800">-</p>
                            </div>
                            <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <i class="fas fa-check-circle text-green-600 text-xl"></i>
                            </div>
                        </div>
                        <p class="text-sm text-gray-500 mt-2">稼働中の契約</p>
                    </div>
                    
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">月間売上</p>
                                <p id="monthlyRevenue" class="text-3xl font-bold text-gray-800">-</p>
                            </div>
                            <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <i class="fas fa-yen-sign text-yellow-600 text-xl"></i>
                            </div>
                        </div>
                        <p class="text-sm text-gray-500 mt-2">定期契約ベース</p>
                    </div>
                    
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">総案件数</p>
                                <p id="totalCases" class="text-3xl font-bold text-gray-800">-</p>
                            </div>
                            <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <i class="fas fa-folder-open text-purple-600 text-xl"></i>
                            </div>
                        </div>
                        <p class="text-sm text-gray-500 mt-2">全法人合計</p>
                    </div>
                </div>
                
                <!-- プラン別分布 & 最近の法人 -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- プラン別分布 -->
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <h2 class="text-lg font-semibold mb-4">プラン別契約数</h2>
                        <div id="planDistribution" class="space-y-3">
                            <div class="animate-pulse h-8 bg-gray-200 rounded"></div>
                            <div class="animate-pulse h-8 bg-gray-200 rounded"></div>
                            <div class="animate-pulse h-8 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                    
                    <!-- 最近登録された法人 -->
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="text-lg font-semibold">最近の法人登録</h2>
                            <a href="/master/organizations" class="text-blue-600 hover:underline text-sm">すべて見る →</a>
                        </div>
                        <div id="recentOrgs" class="space-y-3">
                            <div class="animate-pulse h-16 bg-gray-200 rounded"></div>
                            <div class="animate-pulse h-16 bg-gray-200 rounded"></div>
                            <div class="animate-pulse h-16 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${masterSidebarScripts}
            
            async function loadDashboard() {
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.get('/api/master/dashboard', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = response.data;
                    
                    document.getElementById('totalOrgs').textContent = data.total_organizations;
                    document.getElementById('activeOrgs').textContent = data.active_organizations;
                    document.getElementById('newOrgsMonth').textContent = '+' + data.new_organizations_this_month;
                    document.getElementById('monthlyRevenue').textContent = '¥' + data.monthly_revenue.toLocaleString();
                    document.getElementById('totalCases').textContent = data.total_cases.toLocaleString();
                    
                    // プラン分布
                    const planHtml = data.plan_distribution.map(p => \`
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span class="font-medium">\${p.plan_name || '未設定'}</span>
                            <span class="text-lg font-bold text-blue-600">\${p.count}社</span>
                        </div>
                    \`).join('');
                    document.getElementById('planDistribution').innerHTML = planHtml || '<p class="text-gray-500">データがありません</p>';
                    
                    // 最近の法人
                    const orgsHtml = data.recent_organizations.map(o => \`
                        <a href="/master/organizations/\${o.id}" class="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="font-medium">\${o.name}</p>
                                    <p class="text-sm text-gray-500">\${o.email}</p>
                                </div>
                                <span class="text-xs px-2 py-1 rounded-full \${o.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">\${o.status === 'active' ? '稼働中' : o.status}</span>
                            </div>
                        </a>
                    \`).join('');
                    document.getElementById('recentOrgs').innerHTML = orgsHtml || '<p class="text-gray-500">データがありません</p>';
                    
                } catch (error) {
                    console.error('Dashboard load error:', error);
                }
            }
            
            loadDashboard();
        </script>
    </body>
    </html>
  `)
})

export default routes
