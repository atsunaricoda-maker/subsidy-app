// マスター管理ダッシュボード
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// マスター用サイドバー
function generateMasterSidebar(activePage: string = '') {
  const isActive = (page: string) => activePage === page ? 'active' : '';
  
  return `
    <aside id="sidebar" class="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-gray-800 to-gray-900 text-white transform -translate-x-full lg:translate-x-0 lg:static transition-transform duration-300 z-50 flex flex-col">
        <div class="p-4 border-b border-gray-700 flex-shrink-0">
            <h1 class="text-xl font-bold flex items-center gap-2">
                <i class="fas fa-shield-alt"></i>
                <span>マスター管理</span>
            </h1>
            <p class="text-xs text-gray-400 mt-1">SaaS Management Console</p>
        </div>
        
        <nav class="p-4 space-y-1 flex-1 overflow-y-auto">
            <a href="/master" class="sidebar-link ${isActive('dashboard')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-tachometer-alt w-5"></i>
                <span>ダッシュボード</span>
            </a>
            
            <div class="pt-4 pb-2">
                <p class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">法人管理</p>
            </div>
            <a href="/master/organizations" class="sidebar-link ${isActive('organizations')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-building w-5"></i>
                <span>法人一覧</span>
            </a>
            <a href="/master/organizations/new" class="sidebar-link ${isActive('new-org')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-plus-circle w-5"></i>
                <span>新規法人登録</span>
            </a>
            
            <div class="pt-4 pb-2">
                <p class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">プラン・課金</p>
            </div>
            <a href="/master/plans" class="sidebar-link ${isActive('plans')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-tags w-5"></i>
                <span>プラン管理</span>
            </a>
            <a href="/master/billing" class="sidebar-link ${isActive('billing')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-file-invoice-dollar w-5"></i>
                <span>売上・請求</span>
            </a>
            
            <div class="pt-4 pb-2">
                <p class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">マスターデータ</p>
            </div>
            <a href="/master/hearing-questions" class="sidebar-link ${isActive('hearing')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-clipboard-list w-5"></i>
                <span>ヒアリング質問</span>
            </a>
            <a href="/master/ai-prompts" class="sidebar-link ${isActive('prompts')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-robot w-5"></i>
                <span>AIプロンプト</span>
            </a>
            <a href="/master/document-templates" class="sidebar-link ${isActive('templates')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-file-alt w-5"></i>
                <span>文書テンプレート</span>
            </a>
            
            <div class="pt-4 pb-2">
                <p class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">システム設定</p>
            </div>
            <a href="/master/ai-models" class="sidebar-link ${isActive('ai-models')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-brain w-5"></i>
                <span>AIモデル設定</span>
            </a>
            <a href="/master/legal-settings" class="sidebar-link ${isActive('legal')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-balance-scale w-5"></i>
                <span>法的表記・会社情報</span>
            </a>
            <a href="/master/admins" class="sidebar-link ${isActive('admins')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-user-shield w-5"></i>
                <span>マスター管理者</span>
            </a>
            <a href="/master/logs" class="sidebar-link ${isActive('logs')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-history w-5"></i>
                <span>操作ログ</span>
            </a>
        </nav>
        
        <div class="p-4 border-t border-gray-700 flex-shrink-0">
            <button onclick="masterLogout()" class="w-full flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                <i class="fas fa-sign-out-alt"></i>
                <span>ログアウト</span>
            </button>
        </div>
    </aside>
    
    <style>
        .sidebar-link.active {
            background: rgba(59, 130, 246, 0.3);
            border-left: 3px solid #3B82F6;
        }
        .sidebar-link:hover {
            background: rgba(255,255,255,0.1);
        }
    </style>
  `;
}

// マスター用共通スクリプト
const masterSidebarScripts = `
    function masterLogout() {
        localStorage.removeItem('master_token');
        localStorage.removeItem('master_name');
        window.location.href = '/master/login';
    }
    
    function checkMasterAuth() {
        const token = localStorage.getItem('master_token');
        if (!token) {
            window.location.href = '/master/login';
            return false;
        }
        return true;
    }
    
    // 認証チェック
    checkMasterAuth();
`;

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
                    const response = await axios.post('/api/master/login', data);
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
  
  const admin = await DB.prepare(`
    SELECT * FROM master_admins WHERE username = ? AND password_hash = ?
  `).bind(username, password).first()
  
  if (!admin) {
    return c.json({ error: 'Invalid credentials' }, 401)
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
