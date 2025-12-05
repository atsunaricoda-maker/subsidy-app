import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定
app.use('/api/*', cors())

// ===============================
// 認証機能
// ===============================

// ログインページ
app.get('/login', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ログイン - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex items-center justify-center">
            <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                <div class="text-center mb-8">
                    <i class="fas fa-file-invoice-dollar text-5xl text-blue-600 mb-4"></i>
                    <h1 class="text-2xl font-bold text-gray-800">助成金申請管理システム</h1>
                    <p class="text-sm text-gray-600 mt-2">管理者ログイン</p>
                </div>
                
                <form id="loginForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">ユーザー名</label>
                        <input type="text" name="username" required 
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">パスワード</label>
                        <input type="password" name="password" required 
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button type="submit" 
                            class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                        ログイン
                    </button>
                </form>
                
                <div class="mt-6 p-4 bg-blue-50 rounded-lg text-sm">
                    <p class="font-medium text-blue-800 mb-2">デモ用ログイン情報：</p>
                    <p class="text-blue-700">ユーザー名: <code class="bg-white px-2 py-1 rounded">admin</code></p>
                    <p class="text-blue-700">パスワード: <code class="bg-white px-2 py-1 rounded">admin123</code></p>
                </div>
                
                <div id="errorMessage" class="hidden mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm"></div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                try {
                    const response = await axios.post('/api/auth/login', data);
                    localStorage.setItem('admin_token', response.data.token);
                    localStorage.setItem('admin_name', response.data.name);
                    localStorage.setItem('admin_username', response.data.username);
                    localStorage.setItem('admin_role', response.data.role);
                    window.location.href = '/';
                } catch (error) {
                    const errorDiv = document.getElementById('errorMessage');
                    errorDiv.textContent = 'ログインに失敗しました。ユーザー名またはパスワードが正しくありません。';
                    errorDiv.classList.remove('hidden');
                }
            });
        </script>
    </body>
    </html>
  `)
})

// ログインAPI
app.post('/api/auth/login', async (c) => {
  const { DB } = c.env
  const { username, password } = await c.req.json()
  
  const user = await DB.prepare(`
    SELECT * FROM admin_users WHERE username = ? AND password_hash = ?
  `).bind(username, password).first()
  
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }
  
  // 簡易的なトークン生成（本番環境ではJWTなどを使用）
  const token = btoa(`${user.id}:${Date.now()}`)
  
  return c.json({
    token,
    name: user.name,
    username: user.username,
    role: user.role || 'staff'
  })
})

// ログアウトAPI
app.post('/api/auth/logout', (c) => {
  return c.json({ success: true })
})

// ユーザー情報取得ヘルパー関数
async function getCurrentUser(c: any) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return null
  
  try {
    const token = authHeader.replace('Bearer ', '')
    // トークンはBase64エンコードされている: id:timestamp (例: MToxNzY0OTQ4NDYwOTY3 -> 1:1764948460967)
    let decoded = token
    try {
      decoded = atob(token)
    } catch {
      // Base64デコード失敗時はそのまま使用
    }
    
    const parts = decoded.split(':')
    if (parts.length === 2) {
      const userId = parseInt(parts[0])
      if (!isNaN(userId)) {
        // DBからユーザー情報を取得
        const { DB } = c.env
        const user = await DB.prepare(`
          SELECT id, username, name, 'admin' as role FROM admin_users WHERE id = ?
        `).bind(userId).first()
        if (user) {
          return user
        }
      }
    }
    // 古い形式のフォールバック: username:role
    const [username, role] = decoded.split(':')
    return { username, role: role || 'staff' }
  } catch {
    return null
  }
}

// ===============================
// 従業員管理API
// ===============================

// 従業員一覧取得
app.get('/api/admin/users', async (c) => {
  const { DB } = c.env
  
  const users = await DB.prepare(`
    SELECT id, username, name, created_at 
    FROM admin_users 
    ORDER BY created_at DESC
  `).all()
  
  return c.json(users.results || [])
})

// 従業員追加
app.post('/api/admin/users', async (c) => {
  const { DB } = c.env
  const { username, password, name } = await c.req.json()
  
  // ユーザー名の重複チェック
  const existing = await DB.prepare(`
    SELECT id FROM admin_users WHERE username = ?
  `).bind(username).first()
  
  if (existing) {
    return c.json({ error: 'このユーザー名は既に使用されています' }, 400)
  }
  
  // ユーザー追加
  const result = await DB.prepare(`
    INSERT INTO admin_users (username, password_hash, name)
    VALUES (?, ?, ?)
  `).bind(username, password, name).run()
  
  return c.json({ 
    success: true, 
    id: result.meta.last_row_id,
    message: '従業員を追加しました'
  })
})

// 従業員編集
app.put('/api/admin/users/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { username, password, name } = await c.req.json()
  
  // ユーザー名の重複チェック（自分以外）
  const existing = await DB.prepare(`
    SELECT id FROM admin_users WHERE username = ? AND id != ?
  `).bind(username, id).first()
  
  if (existing) {
    return c.json({ error: 'このユーザー名は既に使用されています' }, 400)
  }
  
  // パスワードが空でない場合のみ更新
  if (password) {
    await DB.prepare(`
      UPDATE admin_users 
      SET username = ?, password_hash = ?, name = ?
      WHERE id = ?
    `).bind(username, password, name, id).run()
  } else {
    await DB.prepare(`
      UPDATE admin_users 
      SET username = ?, name = ?
      WHERE id = ?
    `).bind(username, name, id).run()
  }
  
  return c.json({ 
    success: true,
    message: '従業員情報を更新しました'
  })
})

// 従業員削除
app.delete('/api/admin/users/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // admin（ID=1）は削除不可
  if (id === '1') {
    return c.json({ error: 'メイン管理者は削除できません' }, 400)
  }
  
  await DB.prepare(`
    DELETE FROM admin_users WHERE id = ?
  `).bind(id).run()
  
  return c.json({ 
    success: true,
    message: '従業員を削除しました'
  })
})

// ===============================
// 管理者画面
// ===============================

// 管理者トップページ
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>助成金申請管理システム - 管理者</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            .sidebar-link { transition: all 0.2s; }
            .sidebar-link:hover { background-color: rgba(255,255,255,0.1); }
            .sidebar-link.active { background-color: rgba(255,255,255,0.2); border-left: 3px solid white; }
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            <!-- 左サイドバー -->
            <aside id="sidebar" class="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-blue-800 to-blue-900 text-white transform -translate-x-full lg:translate-x-0 lg:static transition-transform duration-300 z-50">
                <div class="p-4 border-b border-blue-700">
                    <h1 class="text-xl font-bold flex items-center gap-2">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <span>助成金管理</span>
                    </h1>
                    <p class="text-xs text-blue-300 mt-1">Subsidy Manager</p>
                </div>
                
                <nav class="p-4 space-y-1">
                    <a href="/" class="sidebar-link active flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-home w-5"></i>
                        <span>ダッシュボード</span>
                    </a>
                    
                    <div class="pt-4 pb-2">
                        <p class="px-4 text-xs font-semibold text-blue-400 uppercase tracking-wider">顧客管理</p>
                    </div>
                    <a href="/" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-tachometer-alt w-5"></i>
                        <span>ダッシュボード</span>
                    </a>
                    <a href="/clients" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-users w-5"></i>
                        <span>顧客管理</span>
                    </a>
                    <a href="/cases" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-folder-open w-5"></i>
                        <span>案件一覧</span>
                    </a>
                    <a href="#" onclick="openNewCaseModal(); return false;" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-plus-circle w-5"></i>
                        <span>新規案件登録</span>
                    </a>
                    
                    <div class="pt-4 pb-2">
                        <p class="px-4 text-xs font-semibold text-blue-400 uppercase tracking-wider">申請種別</p>
                    </div>
                    <a href="/subsidy-types?category=行政書士管轄" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-building w-5"></i>
                        <span>補助金一覧</span>
                        <span class="ml-auto text-xs bg-blue-700 px-2 py-0.5 rounded">行政書士</span>
                    </a>
                    <a href="/subsidy-types?category=社労士管轄" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-hand-holding-usd w-5"></i>
                        <span>助成金一覧</span>
                        <span class="ml-auto text-xs bg-green-700 px-2 py-0.5 rounded">社労士</span>
                    </a>
                    <a href="/subsidy-types?category=許認可" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-stamp w-5"></i>
                        <span>許認可申請</span>
                        <span class="ml-auto text-xs bg-purple-700 px-2 py-0.5 rounded">許認可</span>
                    </a>
                    <a href="/admin/pipelines" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-project-diagram w-5"></i>
                        <span>パイプライン管理</span>
                    </a>
                    <a href="/admin/statistics" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-chart-line w-5"></i>
                        <span>統計情報</span>
                    </a>
                    
                    <div class="pt-4 pb-2">
                        <p class="px-4 text-xs font-semibold text-blue-400 uppercase tracking-wider">設定</p>
                    </div>
                    <a href="/admin/guidelines" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-book-open w-5"></i>
                        <span>公募要領管理</span>
                    </a>
                    <a href="/admin/users" id="sidebarEmployeeLink" class="sidebar-link hidden flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-users-cog w-5"></i>
                        <span>従業員管理</span>
                    </a>
                    <a href="/admin/payments" id="sidebarPaymentsLink" class="sidebar-link hidden flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-credit-card w-5"></i>
                        <span>支払い確認</span>
                        <span id="pendingPaymentsBadge" class="hidden ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">0</span>
                    </a>
                    <a href="/admin/settings" id="sidebarSettingsLink" class="sidebar-link hidden flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-cog w-5"></i>
                        <span>システム設定</span>
                    </a>
                    <a href="/admin/backup" id="sidebarBackupLink" class="sidebar-link hidden flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-database w-5"></i>
                        <span>バックアップ</span>
                    </a>
                </nav>
                
                <!-- ユーザー情報 -->
                <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-700 bg-blue-900">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p id="sidebarAdminName" class="text-sm font-medium truncate">管理者</p>
                            <p class="text-xs text-blue-300">管理者モード</p>
                        </div>
                        <button onclick="logout()" class="text-blue-300 hover:text-white" title="ログアウト">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>
            </aside>
            
            <!-- サイドバーオーバーレイ（モバイル用） -->
            <div id="sidebarOverlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden lg:hidden"></div>
            
            <!-- メインコンテンツ -->
            <main class="flex-1 min-h-screen">
                <!-- トップバー -->
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">ダッシュボード</h2>
                        </div>
                        <div class="flex items-center gap-3">
                            <button onclick="loadData()" class="text-gray-500 hover:text-gray-700" title="更新">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                            <span id="adminName" class="text-sm text-gray-600 hidden sm:inline">
                                <i class="fas fa-user-shield mr-1"></i>
                                管理者モード
                            </span>
                        </div>
                    </div>
                </header>
                
                <div class="p-4 lg:p-6">
                    <!-- ステータスカード -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 mb-6" id="statusCards">
                        <a href="/cases?status=inquiry" class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border-l-4 border-yellow-400 hover:shadow-md transition cursor-pointer block">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-gray-500 text-xs lg:text-sm mb-1">見込み</div>
                                    <div class="text-2xl lg:text-3xl font-bold text-yellow-500" id="count-inquiry">-</div>
                                </div>
                                <i class="fas fa-search text-yellow-200 text-2xl lg:text-3xl"></i>
                            </div>
                        </a>
                        <a href="/cases?status=preparing" class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border-l-4 border-orange-400 hover:shadow-md transition cursor-pointer block">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-gray-500 text-xs lg:text-sm mb-1">書類準備</div>
                                    <div class="text-2xl lg:text-3xl font-bold text-orange-500" id="count-preparing">-</div>
                                </div>
                                <i class="fas fa-folder-open text-orange-200 text-2xl lg:text-3xl"></i>
                            </div>
                        </a>
                        <a href="/cases?status=applying" class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border-l-4 border-purple-400 hover:shadow-md transition cursor-pointer block">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-gray-500 text-xs lg:text-sm mb-1">申請中</div>
                                    <div class="text-2xl lg:text-3xl font-bold text-purple-500" id="count-applying">-</div>
                                </div>
                                <i class="fas fa-paper-plane text-purple-200 text-2xl lg:text-3xl"></i>
                            </div>
                        </a>
                        <a href="/cases?status=completed" class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border-l-4 border-green-400 hover:shadow-md transition cursor-pointer block">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-gray-500 text-xs lg:text-sm mb-1">完了</div>
                                    <div class="text-2xl lg:text-3xl font-bold text-green-500" id="count-completed">-</div>
                                </div>
                                <i class="fas fa-check-circle text-green-200 text-2xl lg:text-3xl"></i>
                            </div>
                        </a>
                    </div>

                    <!-- 検索・フィルター -->
                    <div class="bg-white rounded-xl shadow-sm p-4 mb-6">
                        <div class="flex flex-col sm:flex-row gap-3">
                            <select id="filterStatus" class="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                <option value="">全ステータス</option>
                                <option value="inquiry">見込み</option>
                                <option value="preparing">書類準備中</option>
                                <option value="applying">申請中</option>
                                <option value="completed">完了</option>
                            </select>
                            <div class="flex-1 relative">
                                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input type="text" id="searchQuery" placeholder="顧客名・会社名で検索..." 
                                       class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            </div>
                            <button onclick="openNewCaseModal()" 
                                    class="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap">
                                <i class="fas fa-plus mr-2"></i>新規案件登録
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <!-- 左側：顧客一覧 -->
                        <div class="xl:col-span-2">
                            <!-- 申請期限アラート -->
                            <div id="deadlineAlertSection" class="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl shadow-sm p-4 mb-6 hidden border border-red-100">
                                <h2 class="text-base font-bold mb-3 text-red-600 flex items-center gap-2">
                                    <i class="fas fa-exclamation-triangle"></i>申請期限が近い案件
                                </h2>
                                <div id="deadlineAlertList" class="space-y-2"></div>
                            </div>

                            <!-- 顧客一覧 -->
                            <div class="bg-white rounded-xl shadow-sm">
                                <div class="p-4 border-b border-gray-100 flex items-center justify-between">
                                    <h2 class="text-base font-bold text-gray-800">顧客一覧</h2>
                                    <span id="clientCount" class="text-sm text-gray-500">-件</span>
                                </div>
                                <div id="clientsList" class="divide-y divide-gray-100">
                                    <div class="text-center py-12 text-gray-500">
                                        <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
                                        <div>読み込み中...</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 右側：お知らせ・クイックアクション -->
                        <div class="space-y-6">
                            <!-- 最近の活動 -->
                            <div class="bg-white rounded-xl shadow-sm p-4">
                                <h2 class="text-base font-bold mb-4 flex items-center gap-2">
                                    <i class="fas fa-history text-purple-600"></i>最近の活動
                                </h2>
                                <div id="recentActivity" class="space-y-3 text-sm">
                                    <div class="text-gray-500 text-center py-4">読み込み中...</div>
                                </div>
                            </div>
                            
                            <!-- クイックアクション -->
                            <div class="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-sm p-4 text-white">
                                <h2 class="text-base font-bold mb-3 flex items-center gap-2">
                                    <i class="fas fa-bolt"></i>クイックアクション
                                </h2>
                                <div class="space-y-2">
                                    <button onclick="openNewCaseModal()" class="w-full bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm text-left flex items-center gap-2">
                                        <i class="fas fa-plus-circle w-5"></i>新規案件登録
                                    </button>
                                    <a href="/clients" class="block w-full bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                                        <i class="fas fa-users w-5"></i>顧客管理
                                    </a>
                                    <a href="/subsidy-types" class="block w-full bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                                        <i class="fas fa-list w-5"></i>申請種別一覧
                                    </a>
                                    <a href="/admin/statistics" class="block w-full bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                                        <i class="fas fa-chart-line w-5"></i>統計情報
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <!-- 新規案件登録モーダル -->
        <div id="newCaseModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-4 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <h3 class="text-xl font-bold mb-4">
                    <i class="fas fa-plus-circle text-blue-600 mr-2"></i>新規案件登録
                </h3>
                <form id="newCaseForm" class="space-y-4">
                    <!-- 顧客選択セクション -->
                    <div class="border rounded-lg p-4 bg-blue-50 space-y-3">
                        <h4 class="font-medium text-sm text-blue-800 flex items-center gap-2">
                            <i class="fas fa-user"></i>顧客情報
                        </h4>
                        <div class="flex gap-3">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="customer_type" value="existing" checked onchange="toggleCustomerType()" class="text-blue-600">
                                <span class="text-sm">既存顧客から選択</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="customer_type" value="new" onchange="toggleCustomerType()" class="text-blue-600">
                                <span class="text-sm">新規顧客として登録</span>
                            </label>
                        </div>
                        
                        <!-- 既存顧客選択 -->
                        <div id="existingCustomerSection">
                            <label class="block text-sm font-medium mb-1">顧客を選択 *</label>
                            <select name="existing_client_id" id="existingClientSelect" class="w-full px-3 py-2 border rounded-lg">
                                <option value="">顧客を選択してください</option>
                            </select>
                        </div>
                        
                        <!-- 新規顧客入力 -->
                        <div id="newCustomerSection" class="hidden space-y-3">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium mb-1">顧客名 *</label>
                                    <input type="text" name="name" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">会社名</label>
                                    <input type="text" name="company_name" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">メールアドレス</label>
                                    <input type="email" name="email" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">電話番号</label>
                                    <input type="tel" name="phone" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 申請種別選択 -->
                    <div>
                        <label class="block text-sm font-medium mb-1">申請種別 *</label>
                        <div class="relative">
                            <input type="text" id="subsidySearchInput" 
                                   placeholder="🔍 補助金・助成金・許認可名で検索..." 
                                   class="w-full px-3 py-2 border rounded-lg mb-1"
                                   oninput="filterSubsidyOptions()">
                            <select name="subsidy_type_id" id="newClientSubsidyType" required 
                                    class="w-full px-3 py-2 border rounded-lg" size="6">
                                <option value="">選択してください</option>
                            </select>
                            <div id="selectedSubsidyName" class="text-xs text-green-600 mt-1 hidden">
                                <i class="fas fa-check-circle mr-1"></i><span></span>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">担当者</label>
                        <select name="assigned_to" id="newClientAssignedTo" class="w-full px-3 py-2 border rounded-lg">
                            <option value="">未割り当て</option>
                        </select>
                    </div>
                    
                    <!-- 契約・報酬設定 -->
                    <div class="border rounded-lg p-4 bg-gray-50 space-y-4">
                        <h4 class="font-medium text-sm text-gray-700 flex items-center gap-2">
                            <i class="fas fa-file-contract text-blue-600"></i>契約・報酬設定
                        </h4>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- 手付金設定 -->
                            <div>
                                <label class="flex items-center gap-2 mb-2">
                                    <input type="checkbox" name="deposit_required" id="depositRequired" class="rounded text-blue-600" onchange="toggleDepositFields()">
                                    <span class="text-sm font-medium">手付金が必要</span>
                                </label>
                                <div id="depositFields" class="hidden space-y-2">
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">手付金額（円）</label>
                                        <input type="number" name="deposit_amount" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 50000">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 成果報酬設定 -->
                            <div>
                                <label class="flex items-center gap-2 mb-2">
                                    <input type="checkbox" name="success_fee_enabled" id="successFeeEnabled" class="rounded text-blue-600" onchange="toggleSuccessFeeFields()">
                                    <span class="text-sm font-medium">成果報酬あり</span>
                                </label>
                                <div id="successFeeFields" class="hidden space-y-2">
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">成果報酬率（%）</label>
                                        <input type="number" name="success_fee_percentage" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 10" min="0" max="100" step="0.1">
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="flex items-center gap-2 mb-2">
                                    <input type="checkbox" name="withholding_tax" class="rounded text-blue-600">
                                    <span class="text-sm font-medium">源泉徴収あり</span>
                                </label>
                                <p class="text-xs text-gray-500">報酬から源泉徴収を行う場合</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-1">申請期限</label>
                                <input type="date" name="application_end_date" class="w-full px-3 py-2 border rounded-lg text-sm">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-1">電子契約URL</label>
                            <input type="url" name="contract_url" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://...">
                            <p class="text-xs text-gray-500 mt-1">CloudSign、freeeサインなどの電子契約URL</p>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">メモ</label>
                        <textarea name="notes" rows="2" class="w-full px-3 py-2 border rounded-lg"></textarea>
                    </div>
                    
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 text-base">
                            <i class="fas fa-save mr-2"></i>案件を登録
                        </button>
                        <button type="button" onclick="closeNewCaseModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400 text-base">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // サイドバートグル
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                sidebar.classList.toggle('-translate-x-full');
                overlay.classList.toggle('hidden');
            }
            
            // 手付金フィールドのトグル
            function toggleDepositFields() {
                const checkbox = document.getElementById('depositRequired');
                const fields = document.getElementById('depositFields');
                if (checkbox.checked) {
                    fields.classList.remove('hidden');
                } else {
                    fields.classList.add('hidden');
                }
            }
            
            // 成果報酬フィールドのトグル
            function toggleSuccessFeeFields() {
                const checkbox = document.getElementById('successFeeEnabled');
                const fields = document.getElementById('successFeeFields');
                if (checkbox.checked) {
                    fields.classList.remove('hidden');
                } else {
                    fields.classList.add('hidden');
                }
            }
            
            // 顧客タイプの切り替え（既存/新規）
            function toggleCustomerType() {
                const type = document.querySelector('input[name="customer_type"]:checked').value;
                const existingSection = document.getElementById('existingCustomerSection');
                const newSection = document.getElementById('newCustomerSection');
                
                if (type === 'existing') {
                    existingSection.classList.remove('hidden');
                    newSection.classList.add('hidden');
                } else {
                    existingSection.classList.add('hidden');
                    newSection.classList.remove('hidden');
                }
            }
            
            // 新規案件登録モーダル
            function openNewCaseModal() {
                document.getElementById('newCaseModal').classList.remove('hidden');
                loadExistingClients();
                loadSubsidyTypes();
                loadAdminUsers();
            }
            
            function closeNewCaseModal() {
                document.getElementById('newCaseModal').classList.add('hidden');
                document.getElementById('newCaseForm').reset();
                document.getElementById('existingCustomerSection').classList.remove('hidden');
                document.getElementById('newCustomerSection').classList.add('hidden');
                document.getElementById('depositFields').classList.add('hidden');
                document.getElementById('successFeeFields').classList.add('hidden');
            }
            
            // 既存顧客リストを読み込み
            async function loadExistingClients() {
                try {
                    const response = await axios.get('/api/clients');
                    const select = document.getElementById('existingClientSelect');
                    select.innerHTML = '<option value="">顧客を選択してください</option>';
                    response.data.forEach(client => {
                        const option = document.createElement('option');
                        option.value = client.id;
                        option.textContent = client.company_name ? \`\${client.name}（\${client.company_name}）\` : client.name;
                        select.appendChild(option);
                    });
                } catch (error) {
                    console.error('Error loading clients:', error);
                }
            }
            
            // 互換性のため古い関数名も維持
            function openNewClientModal() { openNewCaseModal(); }
            function closeNewClientModal() { closeNewCaseModal(); }
            
            // ステータスでフィルター
            function filterByStatus(status) {
                document.getElementById('filterStatus').value = status;
                filterClients();
            }
            
            // 認証チェック
            function checkAuth() {
                const token = localStorage.getItem('admin_token');
                const adminName = localStorage.getItem('admin_name');
                
                if (!token) {
                    window.location.href = '/login';
                    return false;
                }
                
                if (adminName) {
                    document.getElementById('adminName').innerHTML = \`
                        <i class="fas fa-user-shield mr-1"></i>
                        \${adminName}
                    \`;
                    const sidebarName = document.getElementById('sidebarAdminName');
                    if (sidebarName) sidebarName.textContent = adminName;
                }
                
                return true;
            }
            
            function logout() {
                if (confirm('ログアウトしますか？')) {
                    localStorage.removeItem('admin_token');
                    localStorage.removeItem('admin_name');
                    window.location.href = '/login';
                }
            }
            
            // 認証確認
            if (!checkAuth()) {
                // リダイレクト処理は checkAuth 内で実行
            }
            
            // adminロールのみ従業員管理・バックアップ・支払い・設定リンク表示
            const adminRole = localStorage.getItem('admin_role');
            if (adminRole === 'admin') {
                const employeeLink = document.getElementById('sidebarEmployeeLink');
                const backupLink = document.getElementById('sidebarBackupLink');
                const paymentsLink = document.getElementById('sidebarPaymentsLink');
                const settingsLink = document.getElementById('sidebarSettingsLink');
                if (employeeLink) {
                    employeeLink.classList.remove('hidden');
                }
                if (backupLink) {
                    backupLink.classList.remove('hidden');
                }
                if (paymentsLink) {
                    paymentsLink.classList.remove('hidden');
                    // 支払い待ち件数を取得
                    loadPendingPaymentsCount();
                }
                if (settingsLink) {
                    settingsLink.classList.remove('hidden');
                }
            }
            
            // 支払い待ち件数を取得
            async function loadPendingPaymentsCount() {
                try {
                    const response = await axios.get('/api/payments/pending');
                    const count = response.data.length;
                    const badge = document.getElementById('pendingPaymentsBadge');
                    if (badge && count > 0) {
                        badge.textContent = count;
                        badge.classList.remove('hidden');
                    }
                } catch (error) {
                    console.error('Error loading pending payments count:', error);
                }
            }
        
            const STATUS_LABELS = {
                inquiry: '見込み',
                consulting: '相談中',
                preparing: '書類準備中',
                applying: '申請中',
                completed: '完了',
                cancelled: 'キャンセル'
            };

            const STATUS_COLORS = {
                inquiry: 'bg-yellow-100 text-yellow-800',
                consulting: 'bg-blue-100 text-blue-800',
                preparing: 'bg-orange-100 text-orange-800',
                applying: 'bg-purple-100 text-purple-800',
                completed: 'bg-green-100 text-green-800',
                cancelled: 'bg-gray-100 text-gray-800'
            };

            let allClients = [];
            let subsidyTypes = [];
            let allUsers = [];

            // Axios設定：認証ヘッダーを自動付与
            axios.defaults.headers.common['Authorization'] = \`Bearer \${localStorage.getItem('admin_username')}:\${localStorage.getItem('admin_role')}\`;

            // データ読み込み
            async function loadData() {
                try {
                    const response = await axios.get('/api/clients');
                    allClients = response.data;
                    updateStatusCards();
                    updateStatistics();
                    renderClients(allClients);
                    renderDeadlineAlerts(allClients);
                    loadRecentActivity();
                } catch (error) {
                    console.error('Error loading data:', error);
                    document.getElementById('clientsList').innerHTML = 
                        '<div class="text-center py-8 text-red-500">データの読み込みに失敗しました</div>';
                }
            }
            
            // 最近の活動を読み込む
            async function loadRecentActivity() {
                try {
                    const response = await axios.get('/api/recent-activity');
                    const activities = response.data;
                    
                    const container = document.getElementById('recentActivity');
                    
                    if (!activities || activities.length === 0) {
                        container.innerHTML = '<div class="text-gray-500 text-center py-4">最近の活動はありません</div>';
                        return;
                    }
                    
                    const activityIcons = {
                        'new_client': { icon: 'fa-user-plus', color: 'text-green-500', bg: 'bg-green-100' },
                        'document_upload': { icon: 'fa-upload', color: 'text-blue-500', bg: 'bg-blue-100' },
                        'status_change': { icon: 'fa-exchange-alt', color: 'text-purple-500', bg: 'bg-purple-100' },
                        'communication': { icon: 'fa-comment', color: 'text-yellow-500', bg: 'bg-yellow-100' },
                        'document_approved': { icon: 'fa-check-circle', color: 'text-green-500', bg: 'bg-green-100' },
                        'document_rejected': { icon: 'fa-times-circle', color: 'text-red-500', bg: 'bg-red-100' }
                    };
                    
                    container.innerHTML = activities.slice(0, 10).map(activity => {
                        const actStyle = activityIcons[activity.type] || { icon: 'fa-circle', color: 'text-gray-500', bg: 'bg-gray-100' };
                        const timeAgo = formatTimeAgo(activity.created_at);
                        
                        return \`
                            <div class="flex items-start gap-3 p-2 rounded hover:bg-gray-50 transition">
                                <div class="w-8 h-8 rounded-full \${actStyle.bg} flex items-center justify-center flex-shrink-0">
                                    <i class="fas \${actStyle.icon} \${actStyle.color} text-xs"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-gray-700 leading-tight">\${activity.description}</p>
                                    <p class="text-xs text-gray-400 mt-0.5">\${timeAgo}</p>
                                </div>
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading recent activity:', error);
                    document.getElementById('recentActivity').innerHTML = 
                        '<div class="text-gray-500 text-center py-4">読み込みエラー</div>';
                }
            }
            
            // 時間の相対表示
            function formatTimeAgo(dateStr) {
                const date = new Date(dateStr);
                const now = new Date();
                const diffMs = now - date;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMins / 60);
                const diffDays = Math.floor(diffHours / 24);
                
                if (diffMins < 1) return 'たった今';
                if (diffMins < 60) return diffMins + '分前';
                if (diffHours < 24) return diffHours + '時間前';
                if (diffDays < 7) return diffDays + '日前';
                return date.toLocaleDateString('ja-JP');
            }
            
            // 申請期限アラート表示
            function renderDeadlineAlerts(clients) {
                const section = document.getElementById('deadlineAlertSection');
                const container = document.getElementById('deadlineAlertList');
                
                // 期限が14日以内の案件を抽出（完了・却下以外）
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const urgentClients = clients.filter(client => {
                    if (!client.application_end_date) return false;
                    if (client.status === 'completed' || client.status === 'rejected') return false;
                    
                    const deadline = new Date(client.application_end_date);
                    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 && diffDays <= 14;
                }).sort((a, b) => {
                    return new Date(a.application_end_date).getTime() - new Date(b.application_end_date).getTime();
                });
                
                if (urgentClients.length === 0) {
                    section.classList.add('hidden');
                    return;
                }
                
                section.classList.remove('hidden');
                
                container.innerHTML = urgentClients.map(client => {
                    const subsidyType = subsidyTypes.find(s => s.id === client.subsidy_type_id);
                    const deadline = new Date(client.application_end_date);
                    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    let urgencyClass = '';
                    let urgencyText = '';
                    if (diffDays <= 3) {
                        urgencyClass = 'border-l-4 border-l-red-600 bg-red-50';
                        urgencyText = \`<span class="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold animate-pulse">あと\${diffDays}日!</span>\`;
                    } else if (diffDays <= 7) {
                        urgencyClass = 'border-l-4 border-l-orange-500 bg-orange-50';
                        urgencyText = \`<span class="bg-orange-500 text-white px-2 py-1 rounded text-xs font-bold">あと\${diffDays}日</span>\`;
                    } else {
                        urgencyClass = 'border-l-4 border-l-yellow-500 bg-yellow-50';
                        urgencyText = \`<span class="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold">あと\${diffDays}日</span>\`;
                    }
                    
                    return \`
                        <div class="p-3 rounded \${urgencyClass} flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                \${urgencyText}
                                <div>
                                    <div class="font-bold">\${client.name}</div>
                                    <div class="text-sm text-gray-600">
                                        \${subsidyType?.name || '補助金未設定'} | 期限: \${client.application_end_date}
                                    </div>
                                </div>
                            </div>
                            <a href="/client/\${client.id}" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                                詳細
                            </a>
                        </div>
                    \`;
                }).join('');
            }
            
            // 助成金種別読み込み
            async function loadSubsidyTypes() {
                try {
                    const response = await axios.get('/api/subsidy-types');
                    subsidyTypes = response.data;
                    
                    renderSubsidyOptions();
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
            }
            
            // 補助金オプションをカテゴリ別にレンダリング
            function renderSubsidyOptions(filter = '') {
                const select = document.getElementById('newClientSubsidyType');
                if (!select) return;
                
                // カテゴリでグループ化
                const grouped = {};
                subsidyTypes.forEach(type => {
                    const cat = type.category || 'その他';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(type);
                });
                
                // フィルタリング
                const filterLower = filter.toLowerCase();
                let html = '<option value="">選択してください</option>';
                
                Object.entries(grouped).forEach(([category, types]) => {
                    const filteredTypes = types.filter(t => 
                        !filter || 
                        t.name.toLowerCase().includes(filterLower) || 
                        category.toLowerCase().includes(filterLower)
                    );
                    
                    if (filteredTypes.length > 0) {
                        html += \`<optgroup label="📁 \${category}">\`;
                        filteredTypes.forEach(type => {
                            html += \`<option value="\${type.id}">\${type.name}</option>\`;
                        });
                        html += '</optgroup>';
                    }
                });
                
                select.innerHTML = html;
                
                // 選択時に表示を更新
                select.onchange = function() {
                    const selectedOption = this.options[this.selectedIndex];
                    const display = document.getElementById('selectedSubsidyName');
                    if (this.value && selectedOption) {
                        display.classList.remove('hidden');
                        display.querySelector('span').textContent = selectedOption.text;
                    } else {
                        display.classList.add('hidden');
                    }
                };
            }
            
            // 補助金検索フィルター
            function filterSubsidyOptions() {
                const input = document.getElementById('subsidySearchInput');
                renderSubsidyOptions(input.value);
            }
            
            // 従業員一覧読み込み
            async function loadUsers() {
                try {
                    const response = await axios.get('/api/admin/users');
                    allUsers = response.data;
                    
                    // 新規登録・編集フォームのセレクトボックスに追加
                    const select = document.getElementById('newClientAssignedTo');
                    const editSelect = document.getElementById('editClientAssignedTo');
                    const options = '<option value="">未割り当て</option>' +
                        allUsers.map(user => \`<option value="\${user.username}">\${user.name}</option>\`).join('');
                    if (select) select.innerHTML = options;
                    if (editSelect) editSelect.innerHTML = options;
                } catch (error) {
                    console.error('Error loading users:', error);
                }
            }
            
            // 統計情報更新
            function updateStatistics() {
                const now = new Date();
                const thisMonth = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}\`;
                
                // 総顧客数
                const total = allClients.length;
                document.getElementById('stat-total').textContent = total;
                
                // 今月の新規顧客
                const newThisMonth = allClients.filter(c => {
                    const created = c.created_at.substring(0, 7);
                    return created === thisMonth;
                }).length;
                document.getElementById('stat-new-month').textContent = newThisMonth;
                
                // 今月の完了件数
                const completedThisMonth = allClients.filter(c => {
                    if (c.status !== 'completed') return false;
                    const updated = c.updated_at.substring(0, 7);
                    return updated === thisMonth;
                }).length;
                document.getElementById('stat-completed-month').textContent = completedThisMonth;
            }

            // ステータスカード更新
            function updateStatusCards() {
                const counts = {
                    inquiry: 0,
                    consulting: 0,
                    preparing: 0,
                    applying: 0,
                    completed: 0
                };
                
                allClients.forEach(client => {
                    if (counts[client.status] !== undefined) {
                        counts[client.status]++;
                    }
                });

                Object.keys(counts).forEach(status => {
                    const el = document.getElementById(\`count-\${status}\`);
                    if (el) el.textContent = counts[status];
                });
            }

            // 顧客一覧表示
            function renderClients(clients) {
                const container = document.getElementById('clientsList');
                
                if (clients.length === 0) {
                    container.innerHTML = '<div class="text-center py-8 text-gray-500">顧客が登録されていません</div>';
                    return;
                }

                // 申請期限の残り日数を計算する関数
                function getDeadlineInfo(endDate) {
                    if (!endDate) return null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const deadline = new Date(endDate);
                    const diffTime = deadline.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0) {
                        return { text: '期限切れ', class: 'bg-gray-400 text-white', urgent: false };
                    } else if (diffDays <= 7) {
                        return { text: \`残り\${diffDays}日\`, class: 'bg-red-600 text-white animate-pulse', urgent: true };
                    } else if (diffDays <= 14) {
                        return { text: \`残り\${diffDays}日\`, class: 'bg-orange-500 text-white', urgent: true };
                    } else if (diffDays <= 30) {
                        return { text: \`残り\${diffDays}日\`, class: 'bg-yellow-500 text-white', urgent: false };
                    } else {
                        return { text: \`残り\${diffDays}日\`, class: 'bg-green-500 text-white', urgent: false };
                    }
                }
                
                container.innerHTML = clients.map(client => {
                    const subsidyType = subsidyTypes.find(s => s.id === client.subsidy_type_id);
                    const portalUrl = \`\${window.location.origin}/portal/\${client.access_token}\`;
                    const deadlineInfo = getDeadlineInfo(client.application_end_date);
                    return \`
                    <div class="border-b last:border-b-0 py-4 hover:bg-gray-50 \${deadlineInfo?.urgent ? 'border-l-4 border-l-red-500 pl-3' : ''}">
                        <!-- PC版表示 -->
                        <div class="hidden md:flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center gap-3 mb-2 flex-wrap">
                                    <h3 class="text-lg font-bold">\${client.name}</h3>
                                    <span class="px-3 py-1 rounded-full text-xs font-medium \${STATUS_COLORS[client.status]}">
                                        \${STATUS_LABELS[client.status]}
                                    </span>
                                    \${subsidyType ? \`<span class="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">\${subsidyType.name}</span>\` : ''}
                                    \${deadlineInfo ? \`<span class="px-2 py-1 rounded text-xs font-bold \${deadlineInfo.class}"><i class="fas fa-clock mr-1"></i>\${deadlineInfo.text}</span>\` : ''}
                                </div>
                                <div class="text-sm text-gray-600 space-y-1">
                                    \${client.company_name ? \`<div><i class="fas fa-building w-4"></i> \${client.company_name}</div>\` : ''}
                                    \${client.email ? \`<div><i class="fas fa-envelope w-4"></i> \${client.email}</div>\` : ''}
                                    \${client.phone ? \`<div><i class="fas fa-phone w-4"></i> \${client.phone}</div>\` : ''}
                                    \${client.assigned_staff ? \`<div><i class="fas fa-user w-4"></i> 担当: \${client.assigned_staff}</div>\` : ''}
                                    \${client.application_end_date ? \`<div><i class="fas fa-calendar-alt w-4"></i> 申請期限: \${client.application_end_date}\${client.subsidy_rate ? \` | 補助率: \${client.subsidy_rate}\` : ''}\${client.max_amount ? \` | 上限: \${(client.max_amount / 10000).toLocaleString()}万円\` : ''}</div>\` : ''}
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <a href="/client/\${client.id}" 
                                   class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                    <i class="fas fa-eye mr-1"></i>詳細
                                </a>
                                <button onclick="copyPortalUrl('\${portalUrl}', '\${client.name}')"
                                        class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm">
                                    <i class="fas fa-copy mr-1"></i>URL
                                </button>
                                <a href="/portal/\${client.access_token}" target="_blank"
                                   class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                                    <i class="fas fa-external-link-alt mr-1"></i>ポータル
                                </a>
                                \${localStorage.getItem('admin_role') === 'admin' ? \`
                                <button onclick="deleteClient(\${client.id}, '\${client.name}')"
                                        class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm">
                                    <i class="fas fa-trash mr-1"></i>削除
                                </button>
                                \` : ''}
                            </div>
                        </div>
                        
                        <!-- スマホ版表示（カード形式） -->
                        <div class="md:hidden space-y-3">
                            <div class="flex items-start justify-between">
                                <div class="flex-1">
                                    <h3 class="text-base font-bold mb-1">\${client.name}</h3>
                                    \${client.company_name ? \`<div class="text-sm text-gray-600">\${client.company_name}</div>\` : ''}
                                </div>
                                <div class="flex flex-col items-end gap-1">
                                    <span class="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap \${STATUS_COLORS[client.status]}">
                                        \${STATUS_LABELS[client.status]}
                                    </span>
                                    \${deadlineInfo ? \`<span class="px-2 py-1 rounded text-xs font-bold \${deadlineInfo.class}"><i class="fas fa-clock mr-1"></i>\${deadlineInfo.text}</span>\` : ''}
                                </div>
                            </div>
                            \${subsidyType ? \`<div class="inline-block px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">\${subsidyType.name}</div>\` : ''}
                            <div class="text-sm text-gray-600 space-y-1">
                                \${client.email ? \`<div><i class="fas fa-envelope w-4"></i> \${client.email}</div>\` : ''}
                                \${client.phone ? \`<div><i class="fas fa-phone w-4"></i> \${client.phone}</div>\` : ''}
                                \${client.assigned_staff ? \`<div><i class="fas fa-user w-4"></i> 担当: \${client.assigned_staff}</div>\` : ''}
                                \${client.application_end_date ? \`<div><i class="fas fa-calendar-alt w-4"></i> 期限: \${client.application_end_date}</div>\` : ''}
                            </div>
                            <div class="grid \${localStorage.getItem('admin_role') === 'admin' ? 'grid-cols-4' : 'grid-cols-3'} gap-2">
                                <a href="/client/\${client.id}" 
                                   class="bg-blue-600 text-white px-3 py-3 rounded-lg hover:bg-blue-700 text-sm text-center">
                                    <i class="fas fa-eye block mb-1"></i>
                                    <span class="text-xs">詳細</span>
                                </a>
                                <button onclick="copyPortalUrl('\${portalUrl}', '\${client.name}')"
                                        class="bg-purple-600 text-white px-3 py-3 rounded-lg hover:bg-purple-700 text-sm">
                                    <i class="fas fa-copy block mb-1"></i>
                                    <span class="text-xs">URL</span>
                                </button>
                                <a href="/portal/\${client.access_token}" target="_blank"
                                   class="bg-green-600 text-white px-3 py-3 rounded-lg hover:bg-green-700 text-sm text-center">
                                    <i class="fas fa-external-link-alt block mb-1"></i>
                                    <span class="text-xs">ポータル</span>
                                </a>
                                \${localStorage.getItem('admin_role') === 'admin' ? \`
                                <button onclick="deleteClient(\${client.id}, '\${client.name}')"
                                        class="bg-red-600 text-white px-3 py-3 rounded-lg hover:bg-red-700 text-sm">
                                    <i class="fas fa-trash block mb-1"></i>
                                    <span class="text-xs">削除</span>
                                </button>
                                \` : ''}
                            </div>
                        </div>
                    </div>
                \`;
                }).join('');
            }
            
            // ポータルURLコピー機能
            function copyPortalUrl(url, clientName) {
                navigator.clipboard.writeText(url).then(() => {
                    showToast(\`\${clientName}様のポータルURLをコピーしました！\`);
                }).catch(err => {
                    console.error('コピーに失敗しました:', err);
                    alert('URLのコピーに失敗しました。手動でコピーしてください: ' + url);
                });
            }
            
            // 顧客削除
            async function deleteClient(clientId, clientName) {
                if (!confirm(\`\${clientName}様の情報を削除してもよろしいですか？\n\nこの操作は取り消せません。\n関連する書類やコミュニケーション履歴もすべて削除されます。\`)) {
                    return;
                }
                
                try {
                    await axios.delete(\`/api/clients/\${clientId}\`);
                    showToast(\`\${clientName}様の情報を削除しました\`);
                    loadData(); // リロード
                } catch (error) {
                    alert('削除に失敗しました: ' + (error.response?.data?.error || error.message));
                    console.error('Delete error:', error);
                }
            }
            
            // トースト通知表示
            function showToast(message) {
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto bg-green-600 text-white px-4 md:px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
                toast.innerHTML = \`
                    <div class="flex items-center gap-2">
                        <i class="fas fa-check-circle"></i>
                        <span class="text-sm md:text-base">\${message}</span>
                    </div>
                \`;
                document.body.appendChild(toast);
                
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transition = 'opacity 0.3s';
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }

            // フィルター・検索
            function filterClients() {
                const status = document.getElementById('filterStatus').value;
                const query = document.getElementById('searchQuery').value.toLowerCase();
                
                let filtered = allClients;
                
                if (status) {
                    filtered = filtered.filter(c => c.status === status);
                }
                
                if (query) {
                    filtered = filtered.filter(c => 
                        c.name.toLowerCase().includes(query) || 
                        (c.company_name && c.company_name.toLowerCase().includes(query))
                    );
                }
                
                renderClients(filtered);
            }

            document.getElementById('filterStatus').addEventListener('change', filterClients);
            document.getElementById('searchQuery').addEventListener('input', filterClients);

            // 新規顧客登録
            function openNewClientModal() {
                document.getElementById('newClientModal').classList.remove('hidden');
            }

            function closeNewClientModal() {
                document.getElementById('newClientModal').classList.add('hidden');
                document.getElementById('newClientForm').reset();
            }

            document.getElementById('newClientForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                // チェックボックスの値を変換
                data.deposit_required = document.getElementById('depositRequired')?.checked ? 1 : 0;
                data.withholding_tax = document.getElementById('withholdingTax')?.checked ? 1 : 0;
                
                // 数値フィールドを変換
                if (data.deposit_amount) {
                    data.deposit_amount = parseInt(data.deposit_amount) || 0;
                }
                
                try {
                    await axios.post('/api/clients', data);
                    closeNewClientModal();
                    loadData();
                } catch (error) {
                    alert('登録に失敗しました');
                    console.error(error);
                }
            });

            // 初期読み込み
            loadSubsidyTypes();
            loadUsers();
            loadData();
        </script>
    </body>
    </html>
  `)
})

// ===============================
// API: 顧客管理
// ===============================

// 最近の活動を取得
app.get('/api/recent-activity', async (c) => {
  const { DB } = c.env
  
  try {
    // 最近のコミュニケーション
    const communications = await DB.prepare(`
      SELECT 
        comm.id,
        'communication' as type,
        CASE 
          WHEN comm.sender_type = 'client' THEN '顧客 ' || cl.name || ' からメッセージ'
          ELSE comm.sender_name || ' が ' || cl.name || ' へ返信'
        END as description,
        comm.created_at
      FROM communications comm
      JOIN clients cl ON comm.client_id = cl.id
      ORDER BY comm.created_at DESC
      LIMIT 5
    `).all()
    
    // 最近のドキュメントアップロード
    const documents = await DB.prepare(`
      SELECT 
        d.id,
        CASE 
          WHEN d.status = 'approved' THEN 'document_approved'
          WHEN d.status = 'rejected' THEN 'document_rejected'
          ELSE 'document_upload'
        END as type,
        CASE 
          WHEN d.status = 'approved' THEN cl.name || ' の「' || d.document_type || '」を承認'
          WHEN d.status = 'rejected' THEN cl.name || ' の「' || d.document_type || '」を差戻し'
          ELSE cl.name || ' が「' || d.document_type || '」をアップロード'
        END as description,
        d.uploaded_at as created_at
      FROM documents d
      JOIN clients cl ON d.client_id = cl.id
      ORDER BY d.uploaded_at DESC
      LIMIT 5
    `).all()
    
    // 最近登録された顧客
    const newClients = await DB.prepare(`
      SELECT 
        id,
        'new_client' as type,
        '新規顧客「' || name || '」を登録' as description,
        created_at
      FROM clients
      ORDER BY created_at DESC
      LIMIT 5
    `).all()
    
    // 全ての活動をマージしてソート
    const allActivities = [
      ...(communications.results || []),
      ...(documents.results || []),
      ...(newClients.results || [])
    ].sort((a: any, b: any) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }).slice(0, 15)
    
    return c.json(allActivities)
  } catch (error: any) {
    console.error('Error fetching recent activity:', error)
    return c.json([])
  }
})

// 顧客一覧取得
app.get('/api/clients', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  // 補助金の公募要領情報もJOINして取得
  let query = `
    SELECT c.*, 
           sg.application_end_date,
           sg.max_amount,
           sg.subsidy_rate,
           sg.fiscal_year
    FROM clients c
    LEFT JOIN subsidy_guidelines sg ON c.subsidy_type_id = sg.subsidy_type_id AND sg.status = 'active'
  `
  let params: string[] = []
  
  // adminロール以外は自分が担当の案件のみ表示
  if (user && user.role !== 'admin') {
    query += ` WHERE c.assigned_to = ?`
    params.push(user.username)
  }
  
  query += ` ORDER BY c.created_at DESC`
  
  const result = params.length > 0 
    ? await DB.prepare(query).bind(...params).all()
    : await DB.prepare(query).all()
  
  return c.json(result.results)
})

// 統計情報取得
app.get('/api/stats', async (c) => {
  const { DB } = c.env
  
  // 総顧客数
  const totalResult = await DB.prepare(`
    SELECT COUNT(*) as count FROM clients
  `).first()
  
  // ステータス別集計
  const statusResult = await DB.prepare(`
    SELECT status, COUNT(*) as count FROM clients GROUP BY status
  `).all()
  
  // 今月の新規顧客
  const thisMonth = new Date().toISOString().substring(0, 7)
  const newThisMonthResult = await DB.prepare(`
    SELECT COUNT(*) as count FROM clients 
    WHERE strftime('%Y-%m', created_at) = ?
  `).bind(thisMonth).first()
  
  // 今月の完了件数
  const completedThisMonthResult = await DB.prepare(`
    SELECT COUNT(*) as count FROM clients 
    WHERE status = 'completed' AND strftime('%Y-%m', updated_at) = ?
  `).bind(thisMonth).first()
  
  return c.json({
    total: totalResult.count,
    byStatus: statusResult.results,
    newThisMonth: newThisMonthResult.count,
    completedThisMonth: completedThisMonthResult.count
  })
})

// 顧客詳細取得
app.get('/api/clients/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  
  const client = await DB.prepare(`
    SELECT * FROM clients WHERE id = ?
  `).bind(id).first()
  
  if (!client) {
    return c.json({ error: 'Client not found' }, 404)
  }
  
  // adminロール以外は自分が担当の案件のみアクセス可能
  if (user && user.role !== 'admin' && client.assigned_to !== user.username) {
    return c.json({ error: 'Access denied' }, 403)
  }
  
  return c.json(client)
})

// 顧客新規登録
app.post('/api/clients', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  // ランダムなアクセストークン生成
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
  
  const result = await DB.prepare(`
    INSERT INTO clients (name, company_name, email, phone, access_token, assigned_staff, assigned_to, notes, subsidy_type_id, deposit_required, deposit_amount, withholding_tax, contract_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.name,
    data.company_name || null,
    data.email || null,
    data.phone || null,
    token,
    data.assigned_staff || null,
    data.assigned_to || null,
    data.notes || null,
    data.subsidy_type_id || null,
    data.deposit_required ? 1 : 0,
    data.deposit_amount || 0,
    data.withholding_tax ? 1 : 0,
    data.contract_url || null
  ).run()
  
  return c.json({ 
    id: result.meta.last_row_id,
    access_token: token
  })
})

// 顧客情報更新
app.put('/api/clients/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  const user = await getCurrentUser(c)
  
  // completedステータスへの変更はadminのみ許可
  if (data.status === 'completed' && user && user.role !== 'admin') {
    return c.json({ error: 'プロジェクトの完了処理は管理者のみ実行できます' }, 403)
  }
  
  await DB.prepare(`
    UPDATE clients 
    SET name = ?, company_name = ?, email = ?, phone = ?, 
        status = ?, assigned_staff = ?, assigned_to = ?, notes = ?, subsidy_type_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.name,
    data.company_name || null,
    data.email || null,
    data.phone || null,
    data.status,
    data.assigned_staff || null,
    data.assigned_to || null,
    data.notes || null,
    data.subsidy_type_id || null,
    id
  ).run()
  
  return c.json({ success: true })
})

// 顧客部分更新（PATCH）
app.patch('/api/clients/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  // 現在の顧客データを取得
  const current = await DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first()
  if (!current) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  // 更新対象のフィールドのみマージ
  const updated = {
    name: data.name !== undefined ? data.name : current.name,
    company_name: data.company_name !== undefined ? data.company_name : current.company_name,
    email: data.email !== undefined ? data.email : current.email,
    phone: data.phone !== undefined ? data.phone : current.phone,
    status: data.status !== undefined ? data.status : current.status,
    assigned_staff: data.assigned_staff !== undefined ? data.assigned_staff : current.assigned_staff,
    assigned_to: data.assigned_to !== undefined ? data.assigned_to : current.assigned_to,
    notes: data.notes !== undefined ? data.notes : current.notes,
    subsidy_type_id: data.subsidy_type_id !== undefined ? data.subsidy_type_id : current.subsidy_type_id,
    deposit_required: data.deposit_required !== undefined ? data.deposit_required : current.deposit_required,
    deposit_amount: data.deposit_amount !== undefined ? data.deposit_amount : current.deposit_amount,
    withholding_tax: data.withholding_tax !== undefined ? data.withholding_tax : current.withholding_tax,
    contract_url: data.contract_url !== undefined ? data.contract_url : current.contract_url
  }
  
  await DB.prepare(`
    UPDATE clients 
    SET name = ?, company_name = ?, email = ?, phone = ?, 
        status = ?, assigned_staff = ?, assigned_to = ?, notes = ?, subsidy_type_id = ?,
        deposit_required = ?, deposit_amount = ?, withholding_tax = ?, contract_url = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    updated.name,
    updated.company_name,
    updated.email,
    updated.phone,
    updated.status,
    updated.assigned_staff,
    updated.assigned_to,
    updated.notes,
    updated.subsidy_type_id,
    updated.deposit_required,
    updated.deposit_amount,
    updated.withholding_tax,
    updated.contract_url,
    id
  ).run()
  
  return c.json({ success: true, message: '顧客情報を更新しました' })
})

// 顧客削除（adminのみ）
app.delete('/api/clients/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const user = await getCurrentUser(c)
  
  // adminのみ削除可能
  if (!user || user.role !== 'admin') {
    return c.json({ error: '顧客の削除は管理者のみ実行できます' }, 403)
  }
  
  // 関連データも削除される（ON DELETE CASCADE）
  await DB.prepare(`
    DELETE FROM clients WHERE id = ?
  `).bind(id).run()
  
  return c.json({ 
    success: true,
    message: '顧客を削除しました'
  })
})

// ===============================
// API: 書類管理
// ===============================

// 顧客の書類一覧取得
app.get('/api/clients/:id/documents', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT * FROM documents WHERE client_id = ? ORDER BY uploaded_at DESC
  `).bind(id).all()
  
  return c.json(result.results)
})

// 書類アップロード（実際のファイルをR2に保存）
app.post('/api/clients/:id/documents/upload', async (c) => {
  const { DB, R2 } = c.env
  const id = c.req.param('id')
  
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('document_type') as string
    const uploadedBy = formData.get('uploaded_by') as string
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }
    
    if (!documentType) {
      return c.json({ error: 'No document_type provided' }, 400)
    }
    
    // R2にファイル保存
    const timestamp = Date.now()
    const fileName = `${timestamp}-${file.name}`
    const filePath = `documents/${id}/${fileName}`
    
    await R2.put(filePath, file.stream(), {
      httpMetadata: {
        contentType: file.type
      }
    })
    
    // メタデータをD1に保存
    const result = await DB.prepare(`
      INSERT INTO documents (client_id, document_type, file_name, file_path, file_size, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      documentType,
      file.name,
      filePath,
      file.size,
      uploadedBy || 'client'
    ).run()
    
    return c.json({ 
      id: result.meta.last_row_id,
      file_path: filePath
    })
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// ファイルダウンロード
app.get('/api/documents/:id/download', async (c) => {
  const { DB, R2 } = c.env
  const id = c.req.param('id')
  
  // ドキュメント情報取得
  const doc = await DB.prepare(`
    SELECT * FROM documents WHERE id = ?
  `).bind(id).first()
  
  if (!doc) {
    return c.json({ error: 'Document not found' }, 404)
  }
  
  // R2からファイル取得
  const object = await R2.get(doc.file_path)
  
  if (!object) {
    return c.json({ error: 'File not found in storage' }, 404)
  }
  
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${doc.file_name}"`
    }
  })
})

// 書類ステータス更新
app.put('/api/documents/:id/status', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { status } = await c.req.json()
  
  await DB.prepare(`
    UPDATE documents SET status = ? WHERE id = ?
  `).bind(status, id).run()
  
  return c.json({ success: true })
})

// ===============================
// API: やり取り記録
// ===============================

// やり取り記録一覧取得
app.get('/api/clients/:id/communications', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT * FROM communications WHERE client_id = ? ORDER BY created_at ASC
  `).bind(id).all()
  
  return c.json(result.results)
})

// やり取り記録追加
app.post('/api/clients/:id/communications', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO communications (client_id, message, sender_type, sender_name)
    VALUES (?, ?, ?, ?)
  `).bind(
    id,
    data.message,
    data.sender_type,
    data.sender_name
  ).run()
  
  return c.json({ 
    id: result.meta.last_row_id 
  })
})

// ===============================
// API: 必要書類チェックリスト
// ===============================

// 旧チェックリスト（互換性のため残す）
app.get('/api/document-checklist', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT * FROM document_checklist ORDER BY display_order
  `).all()
  
  return c.json(result.results)
})

// 顧客の助成金種別に基づくチェックリスト
app.get('/api/clients/:id/document-checklist', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // 顧客の助成金種別を取得
  const client = await DB.prepare(`
    SELECT subsidy_type_id FROM clients WHERE id = ?
  `).bind(id).first()
  
  if (!client || !client.subsidy_type_id) {
    // 助成金種別が設定されていない場合は旧チェックリストを返す
    const result = await DB.prepare(`
      SELECT * FROM document_checklist ORDER BY display_order
    `).all()
    return c.json(result.results)
  }
  
  // 助成金種別の必要書類を取得
  const result = await DB.prepare(`
    SELECT * FROM subsidy_type_documents 
    WHERE subsidy_type_id = ? 
    ORDER BY display_order
  `).bind(client.subsidy_type_id).all()
  
  return c.json(result.results)
})

// ===============================
// API: 申請種別管理
// ===============================

// 助成金種別一覧取得
app.get('/api/subsidy-types', async (c) => {
  const { DB } = c.env
  const includeHidden = c.req.query('include_hidden') === 'true'
  
  // id = 0 は共通質問用の内部レコードなので除外
  // 社労士管轄は一旦非表示（include_hidden=trueで表示可能）
  let query = `SELECT * FROM subsidy_types WHERE id > 0`
  if (!includeHidden) {
    query += ` AND (category IS NULL OR category != '社労士管轄')`
  }
  query += ` ORDER BY category, name`
  
  const result = await DB.prepare(query).all()
  
  return c.json(result.results)
})

// 助成金種別の必要書類取得
app.get('/api/subsidy-types/:id/documents', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT * FROM subsidy_type_documents 
    WHERE subsidy_type_id = ? 
    ORDER BY display_order
  `).bind(id).all()
  
  return c.json(result.results)
})

// 助成金種別新規作成
app.post('/api/subsidy-types', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO subsidy_types (name, description, category)
    VALUES (?, ?, ?)
  `).bind(
    data.name,
    data.description || null,
    data.category || null
  ).run()
  
  return c.json({ id: result.meta.last_row_id })
})

// 助成金種別に必要書類追加
app.post('/api/subsidy-types/:id/documents', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO subsidy_type_documents 
    (subsidy_type_id, document_type, description, is_required, display_order)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    id,
    data.document_type,
    data.description || null,
    data.is_required !== undefined ? data.is_required : 1,
    data.display_order || 0
  ).run()
  
  return c.json({ id: result.meta.last_row_id })
})

// 助成金種別の必要書類削除
app.delete('/api/subsidy-types/:subsidyId/documents/:docId', async (c) => {
  const { DB } = c.env
  const docId = c.req.param('docId')
  
  await DB.prepare(`
    DELETE FROM subsidy_type_documents WHERE id = ?
  `).bind(docId).run()
  
  return c.json({ success: true })
})

// 助成金種別削除（関連データも削除）
app.delete('/api/subsidy-types/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // id = 0 は共通質問用なので削除不可
  if (id === '0') {
    return c.json({ error: '共通質問用のレコードは削除できません' }, 400)
  }
  
  try {
    // この補助金種別を使用している顧客数をチェック
    const clientsUsingThisType = await DB.prepare(`
      SELECT COUNT(*) as count FROM clients WHERE subsidy_type_id = ?
    `).bind(id).first()
    
    // 関連データを削除
    // 1. 必要書類
    await DB.prepare(`DELETE FROM subsidy_type_documents WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 2. ヒアリング質問
    await DB.prepare(`DELETE FROM hearing_questions WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 3. 補助金ガイドライン
    await DB.prepare(`DELETE FROM subsidy_guidelines WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 4. マッチングスコア（この補助金種別に関連するもの）
    await DB.prepare(`DELETE FROM subsidy_match_scores WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 5. 補助金監視URL
    await DB.prepare(`DELETE FROM subsidy_watch_urls WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 6. 顧客の補助金種別をNULLに更新（削除ではなく解除）
    await DB.prepare(`UPDATE clients SET subsidy_type_id = NULL WHERE subsidy_type_id = ?`).bind(id).run()
    
    // 最後に補助金種別自体を削除
    await DB.prepare(`DELETE FROM subsidy_types WHERE id = ?`).bind(id).run()
    
    return c.json({ 
      success: true, 
      message: '助成金種別を削除しました',
      affected_clients: clientsUsingThisType?.count || 0
    })
  } catch (error) {
    console.error('Error deleting subsidy type:', error)
    return c.json({ error: '削除に失敗しました', details: String(error) }, 500)
  }
})

// ===============================
// 申請種別管理画面
// ===============================

app.get('/subsidy-types', async (c) => {
  const { DB } = c.env
  
  // id = 0 は共通質問用の内部レコードなので除外
  const subsidyTypes = await DB.prepare(`
    SELECT * FROM subsidy_types WHERE id > 0 ORDER BY category, name
  `).all()
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>申請種別管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <header class="bg-blue-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <a href="/" class="text-sm hover:underline mb-2 block">
                                <i class="fas fa-arrow-left mr-1"></i>トップに戻る
                            </a>
                            <h1 class="text-2xl font-bold">
                                <i class="fas fa-file-contract mr-2"></i>
                                申請種別管理
                            </h1>
                        </div>
                        <button onclick="logout()" class="text-sm hover:underline">
                            <i class="fas fa-sign-out-alt mr-1"></i>
                            ログアウト
                        </button>
                    </div>
                </div>
            </header>

            <div class="container mx-auto px-4 py-8">
                <!-- 新規作成ボタン -->
                <div class="mb-6">
                    <button onclick="openNewSubsidyModal()" 
                            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                        <i class="fas fa-plus mr-2"></i>新しい助成金種別を追加
                    </button>
                </div>

                <!-- 助成金種別一覧（カテゴリ別） -->
                <div id="subsidyTypesList">
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
                        <div>読み込み中...</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 新規助成金作成モーダル -->
        <div id="newSubsidyModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div class="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 my-8">
                <h3 class="text-xl font-bold mb-4">新しい助成金種別を作成</h3>
                <form id="newSubsidyForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">助成金名 *</label>
                        <input type="text" name="name" required 
                               placeholder="例：事業再構築補助金"
                               class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">カテゴリ（管轄）</label>
                        <select name="category" class="w-full px-3 py-2 border rounded-lg">
                            <option value="行政書士管轄">行政書士管轄（補助金）</option>
                            <option value="社労士管轄">社労士管轄（助成金）</option>
                            <option value="許認可">許認可申請</option>
                            <option value="事業転換系">事業転換系</option>
                            <option value="その他">その他</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">説明</label>
                        <textarea name="description" rows="2" 
                                  placeholder="この助成金の概要説明"
                                  class="w-full px-3 py-2 border rounded-lg"></textarea>
                    </div>
                    
                    <hr class="my-4">
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">
                            必要書類 *
                            <span class="text-xs text-gray-500 ml-2">（最低1つは必要です）</span>
                        </label>
                        <div id="documentsList" class="space-y-3 mb-3">
                            <!-- 書類入力フィールドがここに追加されます -->
                        </div>
                        <button type="button" onclick="addDocumentField()" 
                                class="text-blue-600 hover:text-blue-700 text-sm">
                            <i class="fas fa-plus-circle mr-1"></i>書類を追加
                        </button>
                    </div>
                    
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                            作成
                        </button>
                        <button type="button" onclick="closeNewSubsidyModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 助成金詳細・編集モーダル -->
        <div id="editSubsidyModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div class="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 my-8">
                <h3 class="text-xl font-bold mb-4">助成金種別の詳細・編集</h3>
                <div id="editSubsidyContent">
                    <!-- 内容が動的に挿入されます -->
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // 認証チェック
            function checkAuth() {
                const token = localStorage.getItem('admin_token');
                if (!token) {
                    window.location.href = '/login';
                    return false;
                }
                return true;
            }
            
            function logout() {
                if (confirm('ログアウトしますか？')) {
                    localStorage.removeItem('admin_token');
                    localStorage.removeItem('admin_name');
                    window.location.href = '/login';
                }
            }
            
            if (!checkAuth()) {}

            let subsidyTypes = [];
            let documentFieldCount = 0;

            // 助成金種別一覧読み込み（管理画面では非表示含む全て表示）
            async function loadSubsidyTypes() {
                try {
                    const response = await axios.get('/api/subsidy-types?include_hidden=true');
                    subsidyTypes = response.data;
                    renderSubsidyTypes();
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
            }

            // カテゴリの色設定
            const CATEGORY_COLORS = {
                '行政書士管轄': { 
                    bg: 'bg-emerald-50', 
                    border: 'border-emerald-500', 
                    badge: 'bg-emerald-100 text-emerald-800',
                    header: 'bg-emerald-600',
                    icon: 'fa-file-signature'
                },
                '社労士管轄': { 
                    bg: 'bg-blue-50', 
                    border: 'border-blue-500', 
                    badge: 'bg-blue-100 text-blue-800',
                    header: 'bg-blue-600',
                    icon: 'fa-users'
                },
                '事業転換系': { 
                    bg: 'bg-purple-50', 
                    border: 'border-purple-500', 
                    badge: 'bg-purple-100 text-purple-800',
                    header: 'bg-purple-600',
                    icon: 'fa-exchange-alt'
                },
                '許認可': { 
                    bg: 'bg-indigo-50', 
                    border: 'border-indigo-500', 
                    badge: 'bg-indigo-100 text-indigo-800',
                    header: 'bg-indigo-600',
                    icon: 'fa-stamp'
                },
                'その他': { 
                    bg: 'bg-gray-50', 
                    border: 'border-gray-400', 
                    badge: 'bg-gray-100 text-gray-800',
                    header: 'bg-gray-600',
                    icon: 'fa-folder'
                }
            };
            
            // 申請種別表示
            function renderSubsidyTypes() {
                const container = document.getElementById('subsidyTypesList');
                
                if (subsidyTypes.length === 0) {
                    container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">まだ申請種別が登録されていません</div>';
                    return;
                }

                // カテゴリ別にグループ化
                const grouped = {};
                subsidyTypes.forEach(subsidy => {
                    const cat = subsidy.category || 'その他';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(subsidy);
                });
                
                // カテゴリの表示順序（存在するカテゴリをすべて表示）
                const knownCategories = ['行政書士管轄', '社労士管轄', '許認可', '事業転換系', 'その他'];
                // DBに存在するが上記にないカテゴリも追加
                const allCategories = [...new Set([...knownCategories, ...Object.keys(grouped)])];
                const categoryOrder = allCategories.filter(cat => grouped[cat]);
                
                // 非表示カテゴリ（顧客向けには表示しない）
                const hiddenCategories = ['社労士管轄'];
                
                let html = '';
                categoryOrder.forEach(category => {
                    if (!grouped[category]) return;
                    
                    const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS['その他'];
                    const items = grouped[category];
                    const isHidden = hiddenCategories.includes(category);
                    
                    html += \`
                        <div class="mb-8 \${isHidden ? 'opacity-60' : ''}">
                            <div class="\${colors.header} text-white px-4 py-3 rounded-t-lg flex items-center gap-2">
                                <i class="fas \${colors.icon}"></i>
                                <h2 class="text-lg font-bold">\${category}</h2>
                                \${isHidden ? '<span class="bg-yellow-400 text-yellow-900 px-2 py-1 rounded text-xs font-bold"><i class="fas fa-eye-slash mr-1"></i>非表示中</span>' : ''}
                                <span class="ml-auto bg-white/20 px-2 py-1 rounded text-sm">\${items.length}件</span>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 \${colors.bg} rounded-b-lg border-2 \${colors.border} border-t-0">
                                \${items.map(subsidy => \`
                                    <div class="bg-white rounded-lg shadow p-4 hover:shadow-lg transition border-l-4 \${colors.border}">
                                        <div class="flex items-start justify-between mb-2">
                                            <div class="flex-1">
                                                <h3 class="font-bold text-gray-800">\${subsidy.name}</h3>
                                                <p class="text-sm text-gray-600 mt-1">\${subsidy.description || '説明なし'}</p>
                                            </div>
                                        </div>
                                        <div class="flex gap-2 mt-3">
                                            <button onclick="viewSubsidyDetail(\${subsidy.id})" 
                                                    class="flex-1 bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 text-sm">
                                                <i class="fas fa-eye mr-1"></i>詳細・編集
                                            </button>
                                            <button data-subsidy-id="\${subsidy.id}" data-subsidy-name="\${subsidy.name.replace(/"/g, '&quot;')}"
                                                    onclick="deleteSubsidyType(this.dataset.subsidyId, this.dataset.subsidyName)" 
                                                    class="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 text-sm"
                                                    title="この補助金種別を削除">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                    \`;
                });
                
                container.innerHTML = html;
            }

            // 新規作成モーダル開く
            function openNewSubsidyModal() {
                document.getElementById('newSubsidyModal').classList.remove('hidden');
                document.getElementById('documentsList').innerHTML = '';
                documentFieldCount = 0;
                // 最初の書類フィールドを追加
                addDocumentField();
            }

            function closeNewSubsidyModal() {
                document.getElementById('newSubsidyModal').classList.add('hidden');
                document.getElementById('newSubsidyForm').reset();
            }

            // 書類フィールド追加
            function addDocumentField() {
                documentFieldCount++;
                const container = document.getElementById('documentsList');
                const fieldHtml = \`
                    <div class="border rounded-lg p-3 bg-gray-50" data-doc-id="\${documentFieldCount}">
                        <div class="flex gap-2 mb-2">
                            <input type="text" 
                                   name="doc_type_\${documentFieldCount}" 
                                   placeholder="書類名（例：登記簿謄本）"
                                   required
                                   class="flex-1 px-3 py-2 border rounded-lg text-sm">
                            <button type="button" onclick="removeDocumentField(\${documentFieldCount})" 
                                    class="text-red-600 hover:text-red-700 px-2">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <input type="text" 
                               name="doc_desc_\${documentFieldCount}" 
                               placeholder="説明（例：3ヶ月以内に発行されたもの）"
                               class="w-full px-3 py-2 border rounded-lg text-sm">
                    </div>
                \`;
                container.insertAdjacentHTML('beforeend', fieldHtml);
            }

            function removeDocumentField(id) {
                const field = document.querySelector(\`[data-doc-id="\${id}"]\`);
                if (field) {
                    field.remove();
                }
            }

            // 新規助成金作成
            document.getElementById('newSubsidyForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                
                // 基本情報
                const subsidyData = {
                    name: formData.get('name'),
                    category: formData.get('category'),
                    description: formData.get('description')
                };
                
                // 書類リスト収集
                const documents = [];
                for (let i = 1; i <= documentFieldCount; i++) {
                    const docType = formData.get(\`doc_type_\${i}\`);
                    const docDesc = formData.get(\`doc_desc_\${i}\`);
                    if (docType) {
                        documents.push({
                            document_type: docType,
                            description: docDesc || '',
                            display_order: documents.length + 1
                        });
                    }
                }
                
                if (documents.length === 0) {
                    alert('最低1つは書類を追加してください');
                    return;
                }
                
                try {
                    // 助成金種別作成
                    const subsidyResponse = await axios.post('/api/subsidy-types', subsidyData);
                    const subsidyId = subsidyResponse.data.id;
                    
                    // 書類を追加
                    for (const doc of documents) {
                        await axios.post(\`/api/subsidy-types/\${subsidyId}/documents\`, doc);
                    }
                    
                    alert('助成金種別を作成しました');
                    closeNewSubsidyModal();
                    loadSubsidyTypes();
                } catch (error) {
                    alert('作成に失敗しました');
                    console.error(error);
                }
            });

            // 助成金詳細表示
            async function viewSubsidyDetail(id) {
                try {
                    const [subsidyResponse, docsResponse] = await Promise.all([
                        axios.get(\`/api/subsidy-types\`),
                        axios.get(\`/api/subsidy-types/\${id}/documents\`)
                    ]);
                    
                    const subsidy = subsidyResponse.data.find(s => s.id === id);
                    const documents = docsResponse.data;
                    
                    const content = \`
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-1">助成金名</label>
                                <div class="text-lg font-bold">\${subsidy.name}</div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">カテゴリ</label>
                                <span class="px-3 py-1 rounded bg-blue-100 text-blue-800 text-sm">
                                    \${subsidy.category}
                                </span>
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">説明</label>
                                <p class="text-gray-700">\${subsidy.description || '説明なし'}</p>
                            </div>
                            
                            <hr class="my-4">
                            
                            <div>
                                <div class="flex items-center justify-between mb-3">
                                    <label class="block text-sm font-medium">必要書類一覧</label>
                                    <button onclick="addNewDocument(\${id})" 
                                            class="text-blue-600 hover:text-blue-700 text-sm">
                                        <i class="fas fa-plus-circle mr-1"></i>書類を追加
                                    </button>
                                </div>
                                <div id="documentDetailList" class="space-y-2">
                                    \${documents.map((doc, index) => \`
                                        <div class="border rounded-lg p-3 bg-gray-50 flex items-start justify-between">
                                            <div class="flex-1">
                                                <div class="font-medium text-sm">\${index + 1}. \${doc.document_type}</div>
                                                <div class="text-xs text-gray-500">\${doc.description || '説明なし'}</div>
                                            </div>
                                            <button onclick="deleteDocument(\${id}, \${doc.id})" 
                                                    class="text-red-600 hover:text-red-700 text-sm ml-2">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    \`).join('')}
                                </div>
                            </div>
                            
                            <hr class="my-4">
                            
                            <div class="flex gap-2 pt-4">
                                <button onclick="closeEditSubsidyModal()" 
                                        class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
                                    閉じる
                                </button>
                                <button data-subsidy-id="\${subsidy.id}" data-subsidy-name="\${subsidy.name.replace(/"/g, '&quot;')}"
                                        onclick="deleteSubsidyType(this.dataset.subsidyId, this.dataset.subsidyName); closeEditSubsidyModal();" 
                                        class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">
                                    <i class="fas fa-trash mr-2"></i>この補助金種別を削除
                                </button>
                            </div>
                        </div>
                    \`;
                    
                    document.getElementById('editSubsidyContent').innerHTML = content;
                    document.getElementById('editSubsidyModal').classList.remove('hidden');
                    
                } catch (error) {
                    alert('詳細の読み込みに失敗しました');
                    console.error(error);
                }
            }

            function closeEditSubsidyModal() {
                document.getElementById('editSubsidyModal').classList.add('hidden');
            }

            // 書類追加
            async function addNewDocument(subsidyId) {
                const docType = prompt('書類名を入力してください\\n例：登記簿謄本');
                if (!docType) return;
                
                const docDesc = prompt('説明を入力してください（任意）\\n例：3ヶ月以内に発行されたもの');
                
                try {
                    await axios.post(\`/api/subsidy-types/\${subsidyId}/documents\`, {
                        document_type: docType,
                        description: docDesc || '',
                        display_order: 999
                    });
                    
                    // 再表示
                    viewSubsidyDetail(subsidyId);
                } catch (error) {
                    alert('追加に失敗しました');
                    console.error(error);
                }
            }

            // 書類削除
            async function deleteDocument(subsidyId, docId) {
                if (!confirm('この書類を削除しますか？')) return;
                
                try {
                    await axios.delete(\`/api/subsidy-types/\${subsidyId}/documents/\${docId}\`);
                    
                    // 再表示
                    viewSubsidyDetail(subsidyId);
                    loadSubsidyTypes();
                } catch (error) {
                    alert('削除に失敗しました');
                    console.error(error);
                }
            }

            // 補助金種別削除
            async function deleteSubsidyType(id, name) {
                const confirmMessage = \`「\${name}」を削除しますか？\n\n⚠️ 警告: この操作は取り消せません。\n\n削除されるデータ:\n- この補助金種別の必要書類\n- この補助金種別用のヒアリング質問\n- 補助金ガイドライン\n- マッチングスコア\n\n※ この補助金種別を使用している顧客は、補助金種別が未設定になります。\`;
                
                if (!confirm(confirmMessage)) return;
                
                // 二重確認
                const finalConfirm = prompt(\`本当に削除する場合は「\${name}」と入力してください:\`);
                if (finalConfirm !== name) {
                    alert('入力が一致しないため、削除をキャンセルしました');
                    return;
                }
                
                try {
                    const response = await axios.delete(\`/api/subsidy-types/\${id}\`);
                    
                    if (response.data.affected_clients > 0) {
                        alert(\`「\${name}」を削除しました。\n\${response.data.affected_clients}件の顧客の補助金種別が未設定になりました。\`);
                    } else {
                        alert(\`「\${name}」を削除しました。\`);
                    }
                    
                    loadSubsidyTypes();
                } catch (error) {
                    if (error.response?.data?.error) {
                        alert(\`削除に失敗しました: \${error.response.data.error}\`);
                    } else {
                        alert('削除に失敗しました');
                    }
                    console.error(error);
                }
            }

            // 初期読み込み
            loadSubsidyTypes();
        </script>
    </body>
    </html>
  `)
})

// ===============================
// 顧客詳細画面
// ===============================

app.get('/client/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const client = await DB.prepare(`
    SELECT * FROM clients WHERE id = ?
  `).bind(id).first()
  
  if (!client) {
    return c.text('Client not found', 404)
  }
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${client.name} - 顧客詳細</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <header class="bg-blue-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <a href="/" class="text-sm hover:underline mb-2 block">
                                <i class="fas fa-arrow-left mr-1"></i>一覧に戻る
                            </a>
                            <h1 class="text-2xl font-bold">${client.name} の詳細</h1>
                        </div>
                        <button onclick="logout()" class="text-sm hover:underline">
                            <i class="fas fa-sign-out-alt mr-1"></i>
                            ログアウト
                        </button>
                    </div>
                </div>
            </header>

            <div class="container mx-auto px-4 py-8">
                <!-- タブナビゲーション -->
                <div class="bg-white rounded-lg shadow mb-6">
                    <div class="border-b flex overflow-x-auto">
                        <button onclick="switchClientTab('overview')" id="client-tab-overview" 
                                class="px-6 py-3 font-medium text-blue-600 border-b-2 border-blue-600 whitespace-nowrap">
                            <i class="fas fa-user mr-2"></i>基本情報
                        </button>
                        <button onclick="switchClientTab('ai')" id="client-tab-ai" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-robot mr-2"></i>AIアシスタント
                        </button>
                        <button onclick="switchClientTab('documents')" id="client-tab-documents" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-file-alt mr-2"></i>生成文書
                        </button>
                    </div>
                </div>

                <!-- 基本情報タブ -->
                <div id="client-content-overview" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- 顧客情報 -->
                    <div class="lg:col-span-1">
                        <div class="bg-white rounded-lg shadow p-6 mb-6">
                            <h2 class="text-lg font-bold mb-4">顧客情報</h2>
                            <div class="space-y-3 text-sm" id="clientInfo"></div>
                            <button onclick="editClient()" class="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                                <i class="fas fa-edit mr-2"></i>編集
                            </button>
                            <button onclick="deleteCurrentClient()" id="deleteClientBtn" class="hidden mt-2 w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
                                <i class="fas fa-trash mr-2"></i>削除
                            </button>
                        </div>

                        <!-- 書類進捗 -->
                        <div class="bg-white rounded-lg shadow p-6">
                            <h2 class="text-lg font-bold mb-2">
                                <i class="fas fa-folder-open mr-2 text-blue-600"></i>必要書類
                            </h2>
                            <div id="documentProgress" class="mb-3"></div>
                            <div id="documentChecklist" class="space-y-2 mb-4"></div>
                            
                            <h3 class="text-sm font-bold text-gray-700 mb-2 pt-3 border-t">
                                <i class="fas fa-file-upload mr-1"></i>アップロード済み
                            </h3>
                            <div id="documentsList" class="max-h-48 overflow-y-auto"></div>
                        </div>
                    </div>

                    <!-- やり取り記録 -->
                    <div class="lg:col-span-2">
                        <div class="bg-white rounded-lg shadow p-6">
                            <h2 class="text-lg font-bold mb-4">やり取り記録</h2>
                            <div id="communicationsList" class="space-y-4 mb-6 max-h-96 overflow-y-auto"></div>
                            
                            <form id="messageForm" class="flex gap-2">
                                <input type="text" id="messageInput" placeholder="メッセージを入力..." 
                                       class="flex-1 px-4 py-2 border rounded-lg" required>
                                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                                    送信
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- AIアシスタントタブ -->
                <div id="client-content-ai" class="hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- ヒアリング -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-lg font-bold mb-4">
                            <i class="fas fa-comments mr-2 text-purple-600"></i>AIヒアリング
                        </h2>
                        <p class="text-sm text-gray-600 mb-4">AIアシスタントが補助金申請に必要な情報をヒアリングします。</p>
                        
                        <div id="aiChatContainer" class="border rounded-lg mb-4 h-80 overflow-y-auto p-4 bg-gray-50">
                            <div class="text-center text-gray-500 py-8">
                                <i class="fas fa-robot text-4xl mb-2 text-purple-400"></i>
                                <p>AIアシスタントとの会話を開始してください</p>
                            </div>
                        </div>
                        
                        <form id="aiChatForm" class="flex gap-2">
                            <input type="text" id="aiChatInput" placeholder="メッセージを入力..." 
                                   class="flex-1 px-4 py-2 border rounded-lg" required>
                            <button type="submit" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </form>
                    </div>

                    <!-- ヒアリング回答一覧 -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-lg font-bold mb-4">
                            <i class="fas fa-clipboard-list mr-2 text-blue-600"></i>ヒアリング項目
                        </h2>
                        <div id="hearingQuestionsList" class="space-y-4 max-h-96 overflow-y-auto">
                            <div class="text-center text-gray-500 py-4">
                                <i class="fas fa-spinner fa-spin"></i> 読み込み中...
                            </div>
                        </div>
                    </div>

                    <!-- 採択率予測（フェーズ4強化） -->
                    <div class="lg:col-span-2 bg-white rounded-lg shadow p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-lg font-bold">
                                <i class="fas fa-chart-line mr-2 text-orange-600"></i>採択率予測
                            </h2>
                            <button onclick="runAdoptionPrediction()" class="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm">
                                <i class="fas fa-calculator mr-1"></i>詳細予測実行
                            </button>
                        </div>
                        <div id="adoptionPredictionResult" class="space-y-4">
                            <div class="text-center text-gray-500 py-8">
                                「詳細予測実行」ボタンを押すと、AIが採択可能性を詳細に分析します。
                            </div>
                        </div>
                    </div>

                    <!-- 補助金マッチング（フェーズ4強化） -->
                    <div class="lg:col-span-2 bg-white rounded-lg shadow p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-lg font-bold">
                                <i class="fas fa-search-dollar mr-2 text-green-600"></i>複数補助金マッチング
                            </h2>
                            <div class="flex gap-2">
                                <button onclick="runComprehensiveMatching()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
                                    <i class="fas fa-brain mr-1"></i>総合分析
                                </button>
                                <button onclick="runSubsidyMatching()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                                    <i class="fas fa-sync mr-1"></i>簡易マッチング
                                </button>
                            </div>
                        </div>
                        <div id="matchingResults" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div class="text-center text-gray-500 py-8 col-span-full">
                                「総合分析」で全補助金との適合性を詳細分析、「簡易マッチング」で素早くスコアを確認できます。
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 生成文書タブ -->
                <div id="client-content-documents" class="hidden space-y-6">
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-lg font-bold">
                                <i class="fas fa-file-signature mr-2 text-indigo-600"></i>AI文書生成
                            </h2>
                            <button onclick="openGenerateDocumentModal()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
                                <i class="fas fa-magic mr-1"></i>新規生成
                            </button>
                        </div>
                        <div id="generatedDocumentsList" class="space-y-4">
                            <div class="text-center text-gray-500 py-8">
                                <i class="fas fa-file-alt text-4xl mb-2 text-gray-300"></i>
                                <p>まだ生成された文書はありません</p>
                                <p class="text-sm mt-2">「新規生成」ボタンで申請書を自動生成できます</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 文書生成モーダル -->
        <div id="generateDocumentModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
                <h3 class="text-xl font-bold mb-4">
                    <i class="fas fa-magic mr-2 text-indigo-600"></i>AI文書生成
                </h3>
                <form id="generateDocumentForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">テンプレート <span class="text-red-500">*</span></label>
                        <select id="templateSelect" class="w-full px-3 py-2 border rounded-lg" required>
                            <option value="">選択してください</option>
                        </select>
                        <p id="templateDescription" class="text-xs text-gray-500 mt-1"></p>
                    </div>
                    
                    <!-- ヒアリング状況 -->
                    <div class="bg-blue-50 rounded-lg p-4">
                        <h4 class="text-sm font-medium mb-2">
                            <i class="fas fa-clipboard-check mr-1 text-blue-600"></i>ヒアリング状況
                        </h4>
                        <div id="hearingStatus" class="text-sm text-gray-600">
                            <i class="fas fa-spinner fa-spin"></i> 確認中...
                        </div>
                    </div>
                    
                    <!-- 参照する採択事例 -->
                    <div class="bg-green-50 rounded-lg p-4">
                        <h4 class="text-sm font-medium mb-2">
                            <i class="fas fa-trophy mr-1 text-green-600"></i>参照する採択事例
                        </h4>
                        <div id="successCasesPreview" class="text-sm text-gray-600">
                            <i class="fas fa-spinner fa-spin"></i> 読み込み中...
                        </div>
                    </div>
                    
                    <!-- 生成オプション -->
                    <div>
                        <label class="block text-sm font-medium mb-2">生成オプション</label>
                        <div class="space-y-2">
                            <label class="flex items-center gap-2">
                                <input type="checkbox" id="optDetailedNumbers" checked class="rounded">
                                <span class="text-sm">具体的な数値を強調</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" id="optCompetitiveAdvantage" checked class="rounded">
                                <span class="text-sm">競争優位性を明確化</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" id="optFutureVision" checked class="rounded">
                                <span class="text-sm">将来ビジョンを強調</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                        <i class="fas fa-lightbulb text-yellow-600 mr-1"></i>
                        <strong>ヒント：</strong>ヒアリング情報が多いほど、より精度の高い申請書が生成されます。
                        生成後は「プロ編集モード」で詳細な修正が可能です。
                    </div>
                    
                    <div class="flex gap-2 pt-4">
                        <button type="submit" id="generateDocBtn" class="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700">
                            <i class="fas fa-magic mr-1"></i>生成開始
                        </button>
                        <button type="button" onclick="closeGenerateDocumentModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 文書詳細モーダル -->
        <div id="documentDetailModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold" id="documentDetailTitle">文書詳細</h3>
                    <button onclick="closeDocumentDetailModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div id="documentDetailContent"></div>
            </div>
        </div>

        <!-- 顧客編集モーダル -->
        <div id="editClientModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onclick="closeEditModal()">
            <div class="bg-white rounded-lg p-4 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-bold">顧客情報編集</h3>
                    <button onclick="closeEditModal()" class="text-gray-500 hover:text-gray-700 text-2xl leading-none">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="editClientForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">顧客名 *</label>
                        <input type="text" name="name" id="edit_name" required class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">会社名</label>
                        <input type="text" name="company_name" id="edit_company_name" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">メールアドレス</label>
                        <input type="email" name="email" id="edit_email" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">電話番号</label>
                        <input type="tel" name="phone" id="edit_phone" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">申請する助成金</label>
                        <div class="relative">
                            <input type="text" id="editSubsidySearchInput" 
                                   placeholder="🔍 補助金名で検索..." 
                                   class="w-full px-3 py-2 border rounded-lg mb-1"
                                   oninput="filterEditSubsidyOptions()">
                            <select name="subsidy_type_id" id="edit_subsidy_type_id" class="w-full px-3 py-2 border rounded-lg" size="5">
                                <option value="">選択してください</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">ステータス</label>
                        <select name="status" id="edit_status" class="w-full px-3 py-2 border rounded-lg">
                            <option value="inquiry">見込み</option>
                            <option value="consulting">相談中</option>
                            <option value="preparing">書類準備中</option>
                            <option value="applying">申請中</option>
                            <option value="completed">完了</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">担当者</label>
                        <select name="assigned_to" id="editClientAssignedTo" class="w-full px-3 py-2 border rounded-lg">
                            <option value="">未割り当て</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">メモ</label>
                        <textarea name="notes" id="edit_notes" rows="3" class="w-full px-3 py-2 border rounded-lg"></textarea>
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 text-base">
                            更新
                        </button>
                        <button type="button" onclick="closeEditModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400 text-base">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // 認証チェック
            function checkAuth() {
                const token = localStorage.getItem('admin_token');
                if (!token) {
                    window.location.href = '/login';
                    return false;
                }
                return true;
            }
            
            function logout() {
                if (confirm('ログアウトしますか？')) {
                    localStorage.removeItem('admin_token');
                    localStorage.removeItem('admin_name');
                    window.location.href = '/login';
                }
            }
            
            // 認証確認
            if (!checkAuth()) {
                // リダイレクト処理は checkAuth 内で実行
            }
            
            // Axios設定：認証ヘッダーを自動付与
            axios.defaults.headers.common['Authorization'] = \`Bearer \${localStorage.getItem('admin_username')}:\${localStorage.getItem('admin_role')}\`;
        
            const CLIENT_ID = ${id};
            const STATUS_LABELS = {
                inquiry: '見込み',
                consulting: '相談中',
                preparing: '書類準備中',
                applying: '申請中',
                completed: '完了'
            };
            
            let currentClient = null;
            let subsidyTypes = [];
            let allUsers = [];

            async function loadSubsidyTypes() {
                try {
                    const response = await axios.get('/api/subsidy-types');
                    subsidyTypes = response.data;
                    
                    renderEditSubsidyOptions();
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
            }
            
            // 編集フォーム用：補助金オプションをカテゴリ別にレンダリング
            function renderEditSubsidyOptions(filter = '') {
                const select = document.getElementById('edit_subsidy_type_id');
                if (!select) return;
                
                // カテゴリでグループ化
                const grouped = {};
                subsidyTypes.forEach(type => {
                    const cat = type.category || 'その他';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(type);
                });
                
                // フィルタリング
                const filterLower = filter.toLowerCase();
                let html = '<option value="">選択してください</option>';
                
                Object.entries(grouped).forEach(([category, types]) => {
                    const filteredTypes = types.filter(t => 
                        !filter || 
                        t.name.toLowerCase().includes(filterLower) || 
                        category.toLowerCase().includes(filterLower)
                    );
                    
                    if (filteredTypes.length > 0) {
                        html += \`<optgroup label="📁 \${category}">\`;
                        filteredTypes.forEach(type => {
                            html += \`<option value="\${type.id}">\${type.name}</option>\`;
                        });
                        html += '</optgroup>';
                    }
                });
                
                select.innerHTML = html;
            }
            
            // 編集フォーム用：補助金検索フィルター
            function filterEditSubsidyOptions() {
                const input = document.getElementById('editSubsidySearchInput');
                const currentValue = document.getElementById('edit_subsidy_type_id').value;
                renderEditSubsidyOptions(input.value);
                // 現在の値を維持
                document.getElementById('edit_subsidy_type_id').value = currentValue;
            }
            
            async function loadUsers() {
                try {
                    const response = await axios.get('/api/admin/users');
                    allUsers = response.data;
                    
                    // 編集フォームのセレクトボックスに追加
                    const select = document.getElementById('editClientAssignedTo');
                    select.innerHTML = '<option value="">未割り当て</option>' +
                        allUsers.map(user => \`<option value="\${user.username}">\${user.name}</option>\`).join('');
                } catch (error) {
                    console.error('Error loading users:', error);
                }
            }

            async function loadClient() {
                try {
                    console.log('Loading client...');
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}\`);
                    currentClient = response.data;
                    console.log('Client loaded:', currentClient);
                    
                    const subsidyType = subsidyTypes.find(s => s.id === currentClient.subsidy_type_id);
                    const assignedUser = allUsers.find(u => u.username === currentClient.assigned_to);
                    const portalUrl = \`\${window.location.origin}/portal/\${currentClient.access_token}\`;
                    
                    document.getElementById('clientInfo').innerHTML = \`
                        <div><strong>会社名:</strong> \${currentClient.company_name || '-'}</div>
                        <div><strong>メール:</strong> \${currentClient.email || '-'}</div>
                        <div><strong>電話:</strong> \${currentClient.phone || '-'}</div>
                        <div><strong>申請助成金:</strong> \${subsidyType ? subsidyType.name : '-'}</div>
                        <div><strong>ステータス:</strong> \${STATUS_LABELS[currentClient.status]}</div>
                        <div><strong>担当者:</strong> \${assignedUser ? assignedUser.name : '未割り当て'}</div>
                        <div><strong>メモ:</strong> \${currentClient.notes || '-'}</div>
                        <div class="mt-3 pt-3 border-t">
                            <strong class="block mb-2">顧客ポータルURL:</strong>
                            <div class="flex gap-2">
                                <input type="text" 
                                       value="\${portalUrl}" 
                                       readonly 
                                       class="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm">
                                <button onclick="copyPortalUrl('\${portalUrl}', '\${currentClient.name}')" 
                                        class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 whitespace-nowrap">
                                    <i class="fas fa-copy mr-1"></i>コピー
                                </button>
                            </div>
                            <a href="/portal/\${currentClient.access_token}" target="_blank" 
                               class="text-blue-600 hover:underline text-sm mt-1 inline-block">
                                <i class="fas fa-external-link-alt mr-1"></i>ポータルを開く
                            </a>
                        </div>
                    \`;
                    
                    // adminのみ削除ボタン表示
                    if (localStorage.getItem('admin_role') === 'admin') {
                        document.getElementById('deleteClientBtn').classList.remove('hidden');
                    }
                } catch (error) {
                    console.error('Error loading client:', error);
                    document.getElementById('clientInfo').innerHTML = '<div class="text-red-600">顧客情報の読み込みに失敗しました</div>';
                }
            }
            
            // 顧客削除
            async function deleteCurrentClient() {
                if (!currentClient) return;
                
                if (!confirm(\`\${currentClient.name}様の情報を削除してもよろしいですか？\n\nこの操作は取り消せません。\n関連する書類やコミュニケーション履歴もすべて削除されます。\`)) {
                    return;
                }
                
                try {
                    await axios.delete(\`/api/clients/\${CLIENT_ID}\`);
                    alert(\`\${currentClient.name}様の情報を削除しました\`);
                    window.location.href = '/'; // トップページに戻る
                } catch (error) {
                    alert('削除に失敗しました: ' + (error.response?.data?.error || error.message));
                    console.error('Delete error:', error);
                }
            }
            
            // AIレスポンスを読みやすく整形する関数
            function formatAIResponse(text) {
                if (!text) return '';
                // マークダウン記法を除去してプレーンテキストに変換
                var result = text;
                // 太字 **text** を除去
                result = result.split('**').join('');
                // 見出し # を除去（行頭の#と空白を削除）
                result = result.replace(/^#+\\s*/gm, '');
                // 箇条書き - や * を日本語の・に変換
                result = result.replace(/^[\\-\\*]\\s+/gm, '・');
                // バッククォートを除去
                var bt = String.fromCharCode(96);
                while (result.indexOf(bt) !== -1) {
                    result = result.replace(bt, '');
                }
                // 連続する改行を整理
                while (result.indexOf('\\n\\n\\n') !== -1) {
                    result = result.replace('\\n\\n\\n', '\\n\\n');
                }
                return result.trim();
            }
            
            // ポータルURLコピー機能
            function copyPortalUrl(url, clientName) {
                navigator.clipboard.writeText(url).then(() => {
                    showToast(\`\${clientName}様のポータルURLをコピーしました！\`);
                }).catch(err => {
                    console.error('コピーに失敗しました:', err);
                    alert('URLのコピーに失敗しました。手動でコピーしてください: ' + url);
                });
            }
            
            // トースト通知表示
            function showToast(message) {
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                toast.innerHTML = \`
                    <div class="flex items-center gap-2">
                        <i class="fas fa-check-circle"></i>
                        <span>\${message}</span>
                    </div>
                \`;
                document.body.appendChild(toast);
                
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transition = 'opacity 0.3s';
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }

            async function loadDocuments() {
                // 必要書類チェックリストと既にアップロードされた書類を取得
                const [checklistRes, docsRes] = await Promise.all([
                    axios.get(\`/api/clients/\${CLIENT_ID}/document-checklist\`),
                    axios.get(\`/api/clients/\${CLIENT_ID}/documents\`)
                ]);
                
                const checklist = checklistRes.data;
                const docs = docsRes.data;
                const uploadedTypes = new Set(docs.map(d => d.document_type));
                
                // 必須書類のカウント
                const requiredDocs = checklist.filter(item => item.is_required);
                const uploadedRequired = requiredDocs.filter(item => uploadedTypes.has(item.document_type)).length;
                const totalRequired = requiredDocs.length;
                const progressPercent = totalRequired > 0 ? Math.round((uploadedRequired / totalRequired) * 100) : 0;
                
                // 進捗表示
                const progressContainer = document.getElementById('documentProgress');
                progressContainer.innerHTML = \`
                    <div class="flex items-center justify-between text-sm mb-1">
                        <span class="text-gray-600">必須書類の提出状況</span>
                        <span class="font-bold \${progressPercent === 100 ? 'text-green-600' : 'text-blue-600'}">\${uploadedRequired}/\${totalRequired}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="h-2 rounded-full transition-all \${progressPercent === 100 ? 'bg-green-500' : 'bg-blue-500'}" style="width: \${progressPercent}%"></div>
                    </div>
                \`;
                
                // チェックリスト表示（未提出の書類を強調）
                const checklistContainer = document.getElementById('documentChecklist');
                const pendingDocs = checklist.filter(item => !uploadedTypes.has(item.document_type));
                
                if (pendingDocs.length === 0) {
                    checklistContainer.innerHTML = \`
                        <div class="text-center py-3 bg-green-50 rounded-lg">
                            <i class="fas fa-check-circle text-green-500 text-xl mb-1"></i>
                            <p class="text-sm text-green-700 font-medium">全ての書類が提出済みです</p>
                        </div>
                    \`;
                } else {
                    checklistContainer.innerHTML = \`
                        <div class="text-xs text-gray-500 mb-2">未提出の書類:</div>
                        \${pendingDocs.map(item => \`
                            <div class="flex items-center gap-2 p-2 bg-gray-50 rounded border \${item.is_required ? 'border-red-200' : 'border-gray-200'}">
                                <i class="fas fa-circle text-xs \${item.is_required ? 'text-red-400' : 'text-gray-300'}"></i>
                                <span class="text-sm flex-1">\${item.document_type}</span>
                                \${item.is_required ? '<span class="text-xs text-red-500 font-medium">必須</span>' : '<span class="text-xs text-gray-400">任意</span>'}
                            </div>
                        \`).join('')}
                    \`;
                }
                
                // アップロード済み書類一覧
                const container = document.getElementById('documentsList');
                if (docs.length === 0) {
                    container.innerHTML = '<div class="text-sm text-gray-500 py-2">まだ書類がありません</div>';
                    return;
                }
                
                container.innerHTML = docs.map(doc => \`
                    <div class="border-b py-2 last:border-b-0">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                                <div class="font-medium text-sm truncate">\${doc.document_type}</div>
                                <div class="text-xs text-gray-500 truncate">\${doc.file_name}</div>
                            </div>
                            <span class="flex-shrink-0 text-xs px-2 py-0.5 rounded-full \${
                                doc.status === 'approved' ? 'bg-green-100 text-green-800' :
                                doc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                            }">
                                \${doc.status === 'approved' ? '✓' : doc.status === 'rejected' ? '✗' : '...'}
                            </span>
                        </div>
                        <div class="flex items-center gap-2 mt-1">
                            <a href="/api/documents/\${doc.id}/download" 
                               class="text-blue-600 hover:text-blue-800 text-xs">
                                <i class="fas fa-download mr-1"></i>DL
                            </a>
                            \${doc.status !== 'approved' ? \`
                                <button onclick="updateDocumentStatus(\${doc.id}, 'approved')" 
                                        class="text-xs text-green-600 hover:text-green-800">
                                    <i class="fas fa-check mr-1"></i>承認
                                </button>
                            \` : ''}
                            \${doc.status !== 'rejected' ? \`
                                <button onclick="updateDocumentStatus(\${doc.id}, 'rejected')" 
                                        class="text-xs text-red-600 hover:text-red-800">
                                    <i class="fas fa-times mr-1"></i>差戻
                                </button>
                            \` : ''}
                        </div>
                    </div>
                \`).join('');
            }
            
            async function updateDocumentStatus(docId, status) {
                try {
                    await axios.put(\`/api/documents/\${docId}/status\`, { status });
                    loadDocuments();
                } catch (error) {
                    alert('ステータス更新に失敗しました');
                    console.error(error);
                }
            }

            async function loadCommunications() {
                const response = await axios.get(\`/api/clients/\${CLIENT_ID}/communications\`);
                const comms = response.data;
                
                const container = document.getElementById('communicationsList');
                if (comms.length === 0) {
                    container.innerHTML = '<div class="text-sm text-gray-500">まだやり取りがありません</div>';
                    return;
                }
                
                container.innerHTML = comms.map(comm => {
                    const isStaff = comm.sender_type === 'staff';
                    return \`
                        <div class="flex \${isStaff ? 'justify-end' : 'justify-start'}">
                            <div class="max-w-xs \${isStaff ? 'bg-blue-100' : 'bg-gray-100'} rounded-lg p-3">
                                <div class="font-medium text-sm mb-1">\${comm.sender_name}</div>
                                <div class="text-sm">\${comm.message}</div>
                                <div class="text-xs text-gray-500 mt-1">\${new Date(comm.created_at).toLocaleString('ja-JP')}</div>
                            </div>
                        </div>
                    \`;
                }).join('');
                
                container.scrollTop = container.scrollHeight;
            }

            document.getElementById('messageForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const message = document.getElementById('messageInput').value;
                const adminName = localStorage.getItem('admin_name') || 'スタッフ';
                
                await axios.post(\`/api/clients/\${CLIENT_ID}/communications\`, {
                    message,
                    sender_type: 'staff',
                    sender_name: adminName
                });
                
                document.getElementById('messageInput').value = '';
                loadCommunications();
            });

            function editClient() {
                if (!currentClient) return;
                
                // フォームに現在の値を設定
                document.getElementById('edit_name').value = currentClient.name || '';
                document.getElementById('edit_company_name').value = currentClient.company_name || '';
                document.getElementById('edit_email').value = currentClient.email || '';
                document.getElementById('edit_phone').value = currentClient.phone || '';
                document.getElementById('edit_subsidy_type_id').value = currentClient.subsidy_type_id || '';
                document.getElementById('edit_status').value = currentClient.status || 'inquiry';
                document.getElementById('editClientAssignedTo').value = currentClient.assigned_to || '';
                document.getElementById('edit_notes').value = currentClient.notes || '';
                
                // 非adminは完了ステータスを選択できない
                const statusSelect = document.getElementById('edit_status');
                const completedOption = statusSelect.querySelector('option[value="completed"]');
                if (localStorage.getItem('admin_role') !== 'admin' && completedOption) {
                    completedOption.disabled = true;
                    completedOption.textContent = '完了（管理者のみ）';
                    
                    // もし現在completedなら警告
                    if (currentClient.status === 'completed') {
                        statusSelect.disabled = true;
                        statusSelect.title = 'このプロジェクトは完了済みです。変更する場合は管理者に連絡してください。';
                    }
                }
                
                document.getElementById('editClientModal').classList.remove('hidden');
            }
            
            function closeEditModal() {
                document.getElementById('editClientModal').classList.add('hidden');
            }
            
            document.getElementById('editClientForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const submitBtn = e.target.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                
                try {
                    // ローディング表示
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>更新中...';
                    
                    const formData = new FormData(e.target);
                    const data = Object.fromEntries(formData);
                    
                    console.log('=== 更新前の状態 ===');
                    console.log('現在のステータス:', currentClient.status);
                    console.log('送信するデータ:', data);
                    console.log('新しいステータス:', data.status);
                    
                    const response = await axios.put(\`/api/clients/\${CLIENT_ID}\`, data);
                    
                    console.log('=== 更新レスポンス ===', response.data);
                    
                    closeEditModal();
                    await loadClient();
                    
                    console.log('=== 更新後の状態 ===');
                    console.log('更新後のステータス:', currentClient.status);
                    
                    showToast('顧客情報を更新しました！');
                } catch (error) {
                    console.error('=== 更新エラー ===', error);
                    alert('更新に失敗しました: ' + (error.response?.data?.error || error.message));
                } finally {
                    // ボタンを元に戻す
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            });

            // タブ切り替え
            function switchClientTab(tab) {
                ['overview', 'ai', 'documents'].forEach(t => {
                    const content = document.getElementById('client-content-' + t);
                    const tabBtn = document.getElementById('client-tab-' + t);
                    if (content) content.classList.add('hidden');
                    if (tabBtn) {
                        tabBtn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
                        tabBtn.classList.add('text-gray-500');
                    }
                });
                const activeContent = document.getElementById('client-content-' + tab);
                const activeTab = document.getElementById('client-tab-' + tab);
                if (activeContent) activeContent.classList.remove('hidden');
                if (activeTab) {
                    activeTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
                    activeTab.classList.remove('text-gray-500');
                }
                
                // タブ固有のデータ読み込み
                if (tab === 'ai') {
                    loadHearingQuestions();
                    loadAiChatHistory();
                    loadMatchScores();
                } else if (tab === 'documents') {
                    loadGeneratedDocuments();
                }
            }

            // ===============================
            // AI機能
            // ===============================
            
            // AIチャット
            async function loadAiChatHistory() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/ai-chat\`);
                    const chats = response.data;
                    
                    const container = document.getElementById('aiChatContainer');
                    if (chats.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center text-gray-500 py-8">
                                <i class="fas fa-robot text-4xl mb-2 text-purple-400"></i>
                                <p>こんにちは！補助金申請のお手伝いをします。</p>
                                <p class="text-sm mt-2">何でも聞いてください。</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    container.innerHTML = chats.map(chat => \`
                        <div class="flex \${chat.role === 'user' ? 'justify-end' : 'justify-start'} mb-3">
                            <div class="max-w-[80%] \${chat.role === 'user' ? 'bg-blue-100' : 'bg-purple-100'} rounded-lg p-3">
                                <div class="flex items-center gap-2 mb-1">
                                    <i class="fas \${chat.role === 'user' ? 'fa-user' : 'fa-robot'} text-sm \${chat.role === 'user' ? 'text-blue-600' : 'text-purple-600'}"></i>
                                    <span class="text-xs font-medium">\${chat.role === 'user' ? 'あなた' : 'AIアシスタント'}</span>
                                </div>
                                <div class="text-sm whitespace-pre-wrap">\${chat.content}</div>
                            </div>
                        </div>
                    \`).join('');
                    
                    container.scrollTop = container.scrollHeight;
                } catch (error) {
                    console.error('AI chat load error:', error);
                }
            }
            
            document.getElementById('aiChatForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = document.getElementById('aiChatInput');
                const message = input.value.trim();
                if (!message) return;
                
                input.value = '';
                input.disabled = true;
                
                // ユーザーメッセージを即座に表示
                const container = document.getElementById('aiChatContainer');
                container.innerHTML += \`
                    <div class="flex justify-end mb-2">
                        <div class="max-w-[85%] bg-blue-100 rounded-lg px-3 py-2">
                            <div class="text-sm text-gray-700">\${message}</div>
                        </div>
                    </div>
                    <div class="flex justify-start mb-2" id="aiTyping">
                        <div class="bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
                            <i class="fas fa-circle-notch fa-spin text-purple-400 text-xs"></i>
                            <span class="text-xs text-purple-400 ml-1">回答中...</span>
                        </div>
                    </div>
                \`;
                container.scrollTop = container.scrollHeight;
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/ai-chat\`, {
                        message,
                        context_type: 'hearing'
                    });
                    
                    document.getElementById('aiTyping').remove();
                    
                    const formattedResponse = formatAIResponse(response.data.response);
                    container.innerHTML += \`
                        <div class="flex justify-start mb-2">
                            <div class="max-w-[85%] bg-purple-50 rounded-lg p-3 border border-purple-100">
                                <div class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">\${formattedResponse}</div>
                            </div>
                        </div>
                    \`;
                    container.scrollTop = container.scrollHeight;
                } catch (error) {
                    document.getElementById('aiTyping')?.remove();
                    alert('AI応答の取得に失敗しました');
                }
                
                input.disabled = false;
                input.focus();
            });
            
            // ヒアリング質問
            async function loadHearingQuestions() {
                if (!currentClient?.subsidy_type_id) {
                    document.getElementById('hearingQuestionsList').innerHTML = \`
                        <div class="text-center text-gray-500 py-4">
                            <p>補助金種別が選択されていません</p>
                        </div>
                    \`;
                    return;
                }
                
                try {
                    const [questionsRes, answersRes] = await Promise.all([
                        axios.get(\`/api/hearing-questions/\${currentClient.subsidy_type_id}\`),
                        axios.get(\`/api/clients/\${CLIENT_ID}/hearing-answers\`)
                    ]);
                    
                    const questions = questionsRes.data;
                    const answers = answersRes.data;
                    const answersMap = {};
                    answers.forEach(a => { answersMap[a.question_id] = a.answer_text; });
                    
                    const container = document.getElementById('hearingQuestionsList');
                    if (questions.length === 0) {
                        container.innerHTML = '<div class="text-center text-gray-500 py-4">質問テンプレートがありません</div>';
                        return;
                    }
                    
                    // カテゴリごとにグループ化
                    const grouped = {};
                    questions.forEach(q => {
                        if (!grouped[q.category]) grouped[q.category] = [];
                        grouped[q.category].push(q);
                    });
                    
                    container.innerHTML = Object.entries(grouped).map(([category, qs]) => \`
                        <div class="border rounded-lg p-3 mb-3">
                            <h3 class="font-medium text-sm text-gray-700 mb-2">
                                <i class="fas fa-folder mr-1"></i>\${category}
                            </h3>
                            \${qs.map(q => \`
                                <div class="ml-4 mb-2 last:mb-0">
                                    <div class="flex items-start gap-2">
                                        <i class="fas \${answersMap[q.id] ? 'fa-check-circle text-green-500' : 'fa-circle text-gray-300'} mt-1"></i>
                                        <div class="flex-1">
                                            <div class="text-sm font-medium">
                                                \${q.question_text}
                                                \${q.is_required ? 
                                                    '<span class="ml-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded">必須</span>' : 
                                                    '<span class="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">任意</span>'}
                                            </div>
                                            \${answersMap[q.id] ? \`<div class="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">\${answersMap[q.id]}</div>\` : ''}
                                        </div>
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Hearing questions load error:', error);
                }
            }
            
            // マッチングスコア
            async function loadMatchScores() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/match-scores\`);
                    const scores = response.data;
                    
                    if (scores.length === 0) return;
                    
                    const container = document.getElementById('matchingResults');
                    container.innerHTML = scores.map(s => \`
                        <div class="border rounded-lg p-4 \${s.match_score >= 70 ? 'border-green-300 bg-green-50' : s.match_score >= 50 ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}">
                            <div class="flex justify-between items-start mb-2">
                                <span class="font-medium">\${s.subsidy_name}</span>
                                <span class="text-2xl font-bold \${s.match_score >= 70 ? 'text-green-600' : s.match_score >= 50 ? 'text-yellow-600' : 'text-gray-600'}">\${s.match_score}</span>
                            </div>
                            <div class="text-xs text-gray-500 mb-2">\${s.category}</div>
                            <p class="text-sm text-gray-700">\${s.ai_recommendation || ''}</p>
                            \${s.adoption_probability ? \`<div class="mt-2 text-xs text-gray-500">採択可能性: 約\${s.adoption_probability}%</div>\` : ''}
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Match scores load error:', error);
                }
            }
            
            async function runSubsidyMatching() {
                const container = document.getElementById('matchingResults');
                container.innerHTML = '<div class="text-center py-8 col-span-full"><i class="fas fa-spinner fa-spin text-2xl text-green-600"></i><p class="mt-2">AIが分析中...</p></div>';
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/match-subsidies\`);
                    const results = response.data;
                    
                    container.innerHTML = results.map(r => \`
                        <div class="border rounded-lg p-4 \${r.score >= 70 ? 'border-green-300 bg-green-50' : r.score >= 50 ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}">
                            <div class="flex justify-between items-start mb-2">
                                <span class="font-medium">\${r.subsidy_name}</span>
                                <span class="text-2xl font-bold \${r.score >= 70 ? 'text-green-600' : r.score >= 50 ? 'text-yellow-600' : 'text-gray-600'}">\${r.score}</span>
                            </div>
                            <div class="text-xs text-gray-500 mb-2">\${r.category}</div>
                            <p class="text-sm text-gray-700">\${r.recommendation || ''}</p>
                            \${r.adoption_probability ? \`<div class="mt-2 text-xs text-gray-500">採択可能性: 約\${r.adoption_probability}%</div>\` : ''}
                        </div>
                    \`).join('');
                    
                    showToast('マッチング分析が完了しました');
                } catch (error) {
                    container.innerHTML = '<div class="text-center text-red-500 py-8 col-span-full">分析に失敗しました</div>';
                }
            }
            
            // フェーズ4: 詳細採択率予測
            async function runAdoptionPrediction() {
                const container = document.getElementById('adoptionPredictionResult');
                container.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-orange-600"></i><p class="mt-2">AIが詳細分析中...（30秒程度かかります）</p></div>';
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/predict-adoption\`);
                    const { prediction, metadata } = response.data;
                    
                    const assessmentColors = {
                        'S': 'bg-green-600', 'A': 'bg-blue-600', 'B': 'bg-yellow-600', 'C': 'bg-orange-600', 'D': 'bg-red-600'
                    };
                    
                    container.innerHTML = \`
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 text-center">
                                <div class="text-4xl font-bold text-orange-600 mb-1">\${prediction.adoption_probability}%</div>
                                <div class="text-sm text-gray-600">採択可能性</div>
                                <div class="text-xs text-gray-500 mt-1">確信度: \${prediction.confidence_level === 'high' ? '高' : prediction.confidence_level === 'medium' ? '中' : '低'}</div>
                            </div>
                            <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
                                <div class="text-4xl font-bold \${assessmentColors[prediction.overall_assessment]} text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-1">\${prediction.overall_assessment}</div>
                                <div class="text-sm text-gray-600">総合評価</div>
                            </div>
                            <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
                                <div class="text-2xl font-bold text-green-600 mb-1">\${metadata.data_completeness}%</div>
                                <div class="text-sm text-gray-600">データ完成度</div>
                            </div>
                        </div>
                        
                        <!-- スコア内訳 -->
                        <div class="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 class="font-bold text-sm mb-3"><i class="fas fa-chart-bar mr-1"></i>評価項目別スコア</h4>
                            <div class="space-y-2">
                                \${Object.entries(prediction.score_breakdown || {}).map(([key, data]) => \`
                                    <div class="flex items-center gap-2">
                                        <span class="w-24 text-xs text-gray-600">\${key === 'eligibility' ? '申請資格' : key === 'business_plan' ? '事業計画' : key === 'innovation' ? '革新性' : key === 'feasibility' ? '実現可能性' : key === 'expected_effect' ? '期待効果' : key}</span>
                                        <div class="flex-1 bg-gray-200 rounded-full h-4">
                                            <div class="h-4 rounded-full \${data.score >= 70 ? 'bg-green-500' : data.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}" style="width: \${data.score}%"></div>
                                        </div>
                                        <span class="w-8 text-xs font-bold">\${data.score}</span>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                        
                        <!-- 強み・弱み -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div class="bg-green-50 rounded-lg p-4">
                                <h4 class="font-bold text-sm mb-2 text-green-700"><i class="fas fa-thumbs-up mr-1"></i>強み</h4>
                                <ul class="text-sm space-y-1">
                                    \${(prediction.strengths || []).map(s => \`<li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-1"></i>\${s}</li>\`).join('')}
                                </ul>
                            </div>
                            <div class="bg-red-50 rounded-lg p-4">
                                <h4 class="font-bold text-sm mb-2 text-red-700"><i class="fas fa-exclamation-triangle mr-1"></i>改善点</h4>
                                <ul class="text-sm space-y-1">
                                    \${(prediction.weaknesses || []).map(w => \`<li class="flex items-start gap-2"><i class="fas fa-times text-red-500 mt-1"></i>\${w}</li>\`).join('')}
                                </ul>
                            </div>
                        </div>
                        
                        <!-- 改善提案 -->
                        <div class="bg-yellow-50 rounded-lg p-4 mb-4">
                            <h4 class="font-bold text-sm mb-2 text-yellow-700"><i class="fas fa-lightbulb mr-1"></i>改善提案</h4>
                            <div class="space-y-2">
                                \${(prediction.improvement_suggestions || []).map(s => \`
                                    <div class="flex items-start gap-2 bg-white rounded p-2">
                                        <span class="px-2 py-0.5 rounded text-xs \${s.priority === 'high' ? 'bg-red-100 text-red-700' : s.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}">\${s.priority === 'high' ? '高' : s.priority === 'medium' ? '中' : '低'}</span>
                                        <div class="flex-1">
                                            <div class="text-sm font-medium">\${s.suggestion}</div>
                                            <div class="text-xs text-gray-500">\${s.expected_impact}</div>
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                        
                        <!-- 推奨アクション -->
                        <div class="bg-blue-50 rounded-lg p-4">
                            <h4 class="font-bold text-sm mb-2 text-blue-700"><i class="fas fa-tasks mr-1"></i>今すぐ実行すべきアクション</h4>
                            <ol class="text-sm space-y-1 list-decimal list-inside">
                                \${(prediction.recommended_actions || []).map(a => \`<li>\${a}</li>\`).join('')}
                            </ol>
                        </div>
                    \`;
                    
                    showToast('採択率予測が完了しました');
                } catch (error) {
                    container.innerHTML = '<div class="text-center text-red-500 py-8">分析に失敗しました。もう一度お試しください。</div>';
                }
            }
            
            // フェーズ4: 総合マッチング分析
            async function runComprehensiveMatching() {
                const container = document.getElementById('matchingResults');
                container.innerHTML = '<div class="text-center py-8 col-span-full"><i class="fas fa-spinner fa-spin text-2xl text-indigo-600"></i><p class="mt-2">全補助金との適合性を総合分析中...</p></div>';
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/comprehensive-matching\`);
                    const { analysis, metadata } = response.data;
                    
                    // 企業サマリー
                    let html = \`
                        <div class="col-span-full bg-indigo-50 rounded-lg p-4 mb-4">
                            <h4 class="font-bold text-sm mb-2 text-indigo-700"><i class="fas fa-building mr-1"></i>企業分析サマリー</h4>
                            <p class="text-sm">\${analysis.company_summary}</p>
                        </div>
                        <div class="col-span-full bg-purple-50 rounded-lg p-4 mb-4">
                            <h4 class="font-bold text-sm mb-2 text-purple-700"><i class="fas fa-lightbulb mr-1"></i>推奨戦略</h4>
                            <p class="text-sm">\${analysis.overall_strategy}</p>
                            <div class="mt-2 flex flex-wrap gap-2">
                                \${(analysis.priority_actions || []).map(a => \`<span class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">\${a}</span>\`).join('')}
                            </div>
                        </div>
                    \`;
                    
                    // 補助金推奨リスト
                    html += (analysis.recommendations || []).sort((a, b) => a.rank - b.rank).map(r => \`
                        <div class="border rounded-lg p-4 \${r.match_score >= 70 ? 'border-green-300 bg-green-50' : r.match_score >= 50 ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <span class="font-medium">\${r.subsidy_name}</span>
                                    <span class="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">推奨順位: \${r.rank}位</span>
                                </div>
                                <span class="text-2xl font-bold \${r.match_score >= 70 ? 'text-green-600' : r.match_score >= 50 ? 'text-yellow-600' : 'text-gray-600'}">\${r.match_score}</span>
                            </div>
                            <div class="text-xs text-gray-500 mb-2">
                                採択可能性: \${r.adoption_probability}% | 
                                申請難易度: \${r.application_complexity} |
                                想定補助額: \${r.estimated_amount}
                            </div>
                            <div class="flex flex-wrap gap-1 mb-2">
                                \${r.compatibility?.eligibility?.met ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">✓ 申請資格あり</span>' : '<span class="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">✗ 要確認</span>'}
                                <span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">\${r.compatibility?.timing?.status || '確認中'}</span>
                            </div>
                            <div class="text-sm mb-2">
                                <strong class="text-green-700">推奨理由:</strong>
                                <ul class="list-disc list-inside text-xs text-gray-600 mt-1">
                                    \${(r.reasons || []).map(reason => \`<li>\${reason}</li>\`).join('')}
                                </ul>
                            </div>
                            \${(r.concerns || []).length > 0 ? \`
                                <div class="text-sm">
                                    <strong class="text-red-700">懸念点:</strong>
                                    <ul class="list-disc list-inside text-xs text-gray-600 mt-1">
                                        \${r.concerns.map(c => \`<li>\${c}</li>\`).join('')}
                                    </ul>
                                </div>
                            \` : ''}
                        </div>
                    \`).join('');
                    
                    container.innerHTML = html;
                    showToast(\`総合分析完了: \${metadata.subsidies_analyzed}件の補助金を分析しました\`);
                } catch (error) {
                    container.innerHTML = '<div class="text-center text-red-500 py-8 col-span-full">分析に失敗しました</div>';
                }
            }
            
            // ===============================
            // 文書生成
            // ===============================
            
            let documentTemplates = [];
            
            async function loadDocumentTemplates() {
                try {
                    const response = await axios.get('/api/document-templates');
                    documentTemplates = response.data;
                    
                    const select = document.getElementById('templateSelect');
                    select.innerHTML = '<option value="">選択してください</option>' +
                        documentTemplates.map(t => \`<option value="\${t.id}">\${t.template_name}</option>\`).join('');
                } catch (error) {
                    console.error('Templates load error:', error);
                }
            }
            
            async function loadGeneratedDocuments() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/generated-documents\`);
                    const docs = response.data;
                    
                    const container = document.getElementById('generatedDocumentsList');
                    if (docs.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center text-gray-500 py-8">
                                <i class="fas fa-file-alt text-4xl mb-2 text-gray-300"></i>
                                <p>まだ生成された文書はありません</p>
                                <p class="text-sm mt-2">「新規生成」ボタンで申請書を自動生成できます</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    const statusLabels = {
                        draft: { label: '下書き', class: 'bg-gray-100 text-gray-800' },
                        review: { label: 'レビュー中', class: 'bg-yellow-100 text-yellow-800' },
                        final: { label: '確定', class: 'bg-green-100 text-green-800' }
                    };
                    
                    container.innerHTML = docs.map(doc => \`
                        <div class="border rounded-lg p-4 hover:shadow-md transition">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h3 class="font-medium">\${doc.document_title}</h3>
                                    <p class="text-sm text-gray-500">\${doc.template_name}</p>
                                </div>
                                <span class="px-2 py-1 rounded text-xs \${statusLabels[doc.status]?.class || ''}">\${statusLabels[doc.status]?.label || doc.status}</span>
                            </div>
                            <div class="text-xs text-gray-400 mb-3">
                                作成: \${new Date(doc.created_at).toLocaleString('ja-JP')}
                                \${doc.updated_at !== doc.created_at ? \` / 更新: \${new Date(doc.updated_at).toLocaleString('ja-JP')}\` : ''}
                            </div>
                            <div class="flex gap-2">
                                <button onclick="viewDocument(\${doc.id})" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm">
                                    <i class="fas fa-eye mr-1"></i>詳細・編集
                                </button>
                                <button onclick="deleteGeneratedDocument(\${doc.id})" 
                                        class="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm"
                                        title="削除"
                                        data-title="\${doc.document_title}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Generated documents load error:', error);
                }
            }
            
            async function openGenerateDocumentModal() {
                document.getElementById('generateDocumentModal').classList.remove('hidden');
                await loadDocumentTemplates();
                await loadHearingStatusForGeneration();
                await loadSuccessCasesPreview();
            }
            
            function closeGenerateDocumentModal() {
                document.getElementById('generateDocumentModal').classList.add('hidden');
            }
            
            // ヒアリング状況を読み込み
            async function loadHearingStatusForGeneration() {
                const container = document.getElementById('hearingStatus');
                try {
                    const answersRes = await axios.get(\`/api/clients/\${CLIENT_ID}/hearing-answers\`);
                    const answers = answersRes.data || [];
                    
                    if (answers.length === 0) {
                        container.innerHTML = \`
                            <div class="flex items-center gap-2 text-yellow-700">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span>ヒアリング回答がありません。AIチャットで情報を入力してください。</span>
                            </div>
                        \`;
                    } else {
                        const categories = {};
                        answers.forEach(a => {
                            if (!categories[a.category]) categories[a.category] = 0;
                            if (a.answer_text) categories[a.category]++;
                        });
                        
                        container.innerHTML = \`
                            <div class="flex items-center gap-2 text-green-700 mb-2">
                                <i class="fas fa-check-circle"></i>
                                <span>\${answers.filter(a => a.answer_text).length}件のヒアリング回答が登録済み</span>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                \${Object.entries(categories).map(([cat, count]) => \`
                                    <span class="px-2 py-1 bg-white rounded text-xs">\${cat}: \${count}件</span>
                                \`).join('')}
                            </div>
                        \`;
                    }
                } catch (error) {
                    container.innerHTML = '<span class="text-gray-500">読み込みエラー</span>';
                }
            }
            
            // 採択事例プレビューを読み込み
            async function loadSuccessCasesPreview() {
                const container = document.getElementById('successCasesPreview');
                if (!currentClient?.subsidy_type_id) {
                    container.innerHTML = '<span class="text-gray-500">補助金種別が選択されていません</span>';
                    return;
                }
                
                try {
                    const response = await axios.get(\`/api/success-cases?subsidy_type_id=\${currentClient.subsidy_type_id}\`);
                    const cases = response.data || [];
                    
                    if (cases.length === 0) {
                        container.innerHTML = '<span class="text-gray-500">参照可能な採択事例がありません</span>';
                    } else {
                        container.innerHTML = \`
                            <p class="mb-2">\${cases.length}件の採択事例を参照して生成します：</p>
                            <ul class="space-y-1 text-xs">
                                \${cases.slice(0, 3).map(c => \`
                                    <li class="flex items-start gap-2">
                                        <i class="fas fa-star text-yellow-500 mt-0.5"></i>
                                        <span>\${c.success_summary?.substring(0, 80)}...</span>
                                    </li>
                                \`).join('')}
                            </ul>
                        \`;
                    }
                } catch (error) {
                    container.innerHTML = '<span class="text-gray-500">読み込みエラー</span>';
                }
            }
            
            document.getElementById('generateDocumentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const templateId = document.getElementById('templateSelect').value;
                if (!templateId) {
                    alert('テンプレートを選択してください');
                    return;
                }
                
                const btn = document.getElementById('generateDocBtn');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>生成中... (数十秒かかります)';
                
                // 生成オプションを収集
                const options = {
                    detailed_numbers: document.getElementById('optDetailedNumbers').checked,
                    competitive_advantage: document.getElementById('optCompetitiveAdvantage').checked,
                    future_vision: document.getElementById('optFutureVision').checked
                };
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/generate-document\`, {
                        template_id: parseInt(templateId),
                        options: options
                    });
                    
                    closeGenerateDocumentModal();
                    showToast('文書が生成されました！');
                    loadGeneratedDocuments();
                    
                    // 生成した文書を表示
                    viewDocument(response.data.id);
                } catch (error) {
                    alert('文書生成に失敗しました: ' + (error.response?.data?.error || error.message));
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-magic mr-1"></i>生成開始';
                }
            });
            
            let currentViewingDocId = null;
            
            async function deleteGeneratedDocument(docId) {
                if (!confirm('この文書を削除しますか？\\n\\nこの操作は取り消せません。')) {
                    return;
                }
                
                try {
                    await axios.delete(\`/api/generated-documents/\${docId}\`);
                    showToast('文書を削除しました');
                    loadGeneratedDocuments();
                } catch (error) {
                    console.error('Delete error:', error);
                    showToast('削除に失敗しました', 'error');
                }
            }
            
            async function viewDocument(docId) {
                currentViewingDocId = docId;
                try {
                    const response = await axios.get(\`/api/generated-documents/\${docId}\`);
                    const doc = response.data;
                    
                    document.getElementById('documentDetailTitle').textContent = doc.document_title;
                    
                    const sections = JSON.parse(doc.template_sections || '[]');
                    const content = JSON.parse(doc.sections_content || '{}');
                    
                    const statusOptions = ['draft', 'review', 'final'];
                    const statusLabels = { draft: '下書き', review: 'レビュー中', final: '確定' };
                    
                    document.getElementById('documentDetailContent').innerHTML = \`
                        <!-- プロ編集ツールバー -->
                        <div class="bg-indigo-50 rounded-lg p-4 mb-6">
                            <h4 class="font-bold text-sm mb-3">
                                <i class="fas fa-tools mr-1 text-indigo-600"></i>プロ編集ツール
                            </h4>
                            <div class="flex flex-wrap gap-2">
                                <div class="flex items-center gap-2">
                                    <label class="text-sm">ステータス:</label>
                                    <select onchange="updateDocumentStatus(\${doc.id}, this.value)" class="border rounded px-3 py-1 text-sm">
                                        \${statusOptions.map(s => \`<option value="\${s}" \${doc.status === s ? 'selected' : ''}>\${statusLabels[s]}</option>\`).join('')}
                                    </select>
                                </div>
                                <button onclick="showSuccessCaseComparison()" class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                                    <i class="fas fa-trophy mr-1"></i>採択事例と比較
                                </button>
                                <button onclick="showEditHistory(\${doc.id})" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                                    <i class="fas fa-history mr-1"></i>編集履歴
                                </button>
                                <button onclick="exportDocument(\${doc.id})" class="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">
                                    <i class="fas fa-download mr-1"></i>エクスポート
                                </button>
                                <button onclick="deleteGeneratedDocumentFromDetail(\${doc.id})" 
                                        class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                                    <i class="fas fa-trash mr-1"></i>削除
                                </button>
                            </div>
                        </div>
                        
                        <!-- 採択事例比較パネル（デフォルト非表示） -->
                        <div id="successCaseComparisonPanel" class="hidden bg-green-50 rounded-lg p-4 mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <h4 class="font-bold text-sm">
                                    <i class="fas fa-balance-scale mr-1 text-green-600"></i>採択事例との比較分析
                                </h4>
                                <button onclick="hideSuccessCaseComparison()" class="text-gray-500 hover:text-gray-700">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div id="successCaseComparisonContent">
                                <i class="fas fa-spinner fa-spin"></i> 分析中...
                            </div>
                        </div>
                        
                        <!-- 編集履歴パネル（デフォルト非表示） -->
                        <div id="editHistoryPanel" class="hidden bg-blue-50 rounded-lg p-4 mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <h4 class="font-bold text-sm">
                                    <i class="fas fa-history mr-1 text-blue-600"></i>編集履歴
                                </h4>
                                <button onclick="hideEditHistory()" class="text-gray-500 hover:text-gray-700">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div id="editHistoryContent">
                                <i class="fas fa-spinner fa-spin"></i> 読み込み中...
                            </div>
                        </div>
                        
                        <!-- セクション一覧 -->
                        <div class="space-y-6">
                            \${sections.map(section => {
                                const sectionContent = content[section.id] || '';
                                const charCount = sectionContent.length;
                                const charPercentage = Math.min(100, Math.round((charCount / section.max_chars) * 100));
                                const charColor = charPercentage > 90 ? 'text-red-600' : charPercentage > 70 ? 'text-yellow-600' : 'text-green-600';
                                
                                return \`
                                <div class="border rounded-lg p-4">
                                    <div class="flex justify-between items-center mb-2">
                                        <h3 class="font-bold text-lg">\${section.title}</h3>
                                        <div class="flex gap-2">
                                            <button onclick="compareWithSuccessCase('\${section.id}')" 
                                                    class="text-green-600 hover:text-green-800 text-sm" title="採択事例と比較">
                                                <i class="fas fa-search-plus mr-1"></i>比較
                                            </button>
                                            <button onclick="regenerateSection(\${doc.id}, '\${section.id}')" 
                                                    class="text-purple-600 hover:text-purple-800 text-sm">
                                                <i class="fas fa-sync mr-1"></i>再生成
                                            </button>
                                            <button onclick="editSection(\${doc.id}, '\${section.id}')" 
                                                    class="text-blue-600 hover:text-blue-800 text-sm">
                                                <i class="fas fa-edit mr-1"></i>編集
                                            </button>
                                        </div>
                                    </div>
                                    <div class="flex justify-between items-center mb-2">
                                        <p class="text-xs text-gray-500">\${section.description}</p>
                                        <span class="text-xs \${charColor}">
                                            \${charCount.toLocaleString()} / \${section.max_chars.toLocaleString()}文字 (\${charPercentage}%)
                                        </span>
                                    </div>
                                    <div id="section-content-\${section.id}" class="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded border">
                                        \${sectionContent || '<span class="text-gray-400">未生成</span>'}
                                    </div>
                                    <div id="section-edit-\${section.id}" class="hidden">
                                        <textarea class="w-full border rounded p-3 text-sm" rows="10">\${sectionContent}</textarea>
                                        <div class="flex justify-between items-center mt-2">
                                            <span id="edit-char-count-\${section.id}" class="text-xs text-gray-500">\${charCount}文字</span>
                                            <div class="flex gap-2">
                                                <button onclick="saveSection(\${doc.id}, '\${section.id}')" class="bg-blue-600 text-white px-4 py-2 rounded text-sm">保存</button>
                                                <button onclick="cancelEditSection('\${section.id}')" class="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm">キャンセル</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            \`}).join('')}
                        </div>
                    \`;
                    
                    document.getElementById('documentDetailModal').classList.remove('hidden');
                } catch (error) {
                    alert('文書の読み込みに失敗しました');
                }
            }
            
            // 採択事例比較機能
            async function showSuccessCaseComparison() {
                const panel = document.getElementById('successCaseComparisonPanel');
                const content = document.getElementById('successCaseComparisonContent');
                panel.classList.remove('hidden');
                
                content.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 採択事例を分析中...';
                
                try {
                    const casesRes = await axios.get(\`/api/success-cases?subsidy_type_id=\${currentClient?.subsidy_type_id || ''}\`);
                    const cases = casesRes.data || [];
                    
                    if (cases.length === 0) {
                        content.innerHTML = '<p class="text-gray-500">比較可能な採択事例がありません。</p>';
                        return;
                    }
                    
                    content.innerHTML = \`
                        <div class="space-y-3">
                            \${cases.slice(0, 5).map((c, i) => \`
                                <div class="bg-white rounded-lg p-3 border border-green-200">
                                    <div class="flex items-center gap-2 mb-2">
                                        <i class="fas fa-trophy text-yellow-500"></i>
                                        <span class="font-medium text-sm">事例\${i + 1}: \${c.company_industry || '不明'} (\${c.company_size || '不明'})</span>
                                        <span class="text-xs text-gray-500">\${c.fiscal_year || ''}</span>
                                    </div>
                                    <p class="text-sm text-gray-700 mb-2">\${c.success_summary || ''}</p>
                                    \${c.key_factors ? \`
                                        <div class="text-xs text-green-700">
                                            <strong>成功要因:</strong> \${JSON.parse(c.key_factors).join(', ')}
                                        </div>
                                    \` : ''}
                                </div>
                            \`).join('')}
                        </div>
                        <div class="mt-4 p-3 bg-yellow-50 rounded-lg text-sm">
                            <i class="fas fa-lightbulb text-yellow-600 mr-1"></i>
                            <strong>ヒント:</strong> 採択事例の成功要因を参考に、自社の強みを明確に記載しましょう。
                        </div>
                    \`;
                } catch (error) {
                    content.innerHTML = '<p class="text-red-500">採択事例の読み込みに失敗しました。</p>';
                }
            }
            
            function hideSuccessCaseComparison() {
                document.getElementById('successCaseComparisonPanel').classList.add('hidden');
            }
            
            // 編集履歴表示
            async function showEditHistory(docId) {
                const panel = document.getElementById('editHistoryPanel');
                const content = document.getElementById('editHistoryContent');
                panel.classList.remove('hidden');
                
                content.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 編集履歴を読み込み中...';
                
                try {
                    const response = await axios.get(\`/api/generated-documents/\${docId}/edit-history\`);
                    const history = response.data || [];
                    
                    if (history.length === 0) {
                        content.innerHTML = '<p class="text-gray-500">編集履歴がありません。</p>';
                        return;
                    }
                    
                    const editTypeLabels = {
                        manual: { label: '手動編集', class: 'bg-blue-100 text-blue-800' },
                        ai_regenerate: { label: 'AI再生成', class: 'bg-purple-100 text-purple-800' },
                        ai_suggestion: { label: 'AI提案', class: 'bg-green-100 text-green-800' }
                    };
                    
                    content.innerHTML = \`
                        <div class="space-y-2 max-h-60 overflow-y-auto">
                            \${history.map(h => \`
                                <div class="bg-white rounded p-2 border text-sm">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="px-2 py-0.5 rounded text-xs \${editTypeLabels[h.edit_type]?.class || 'bg-gray-100'}">\${editTypeLabels[h.edit_type]?.label || h.edit_type}</span>
                                        <span class="text-gray-600">\${h.section_id}</span>
                                        <span class="text-xs text-gray-400">\${new Date(h.created_at).toLocaleString('ja-JP')}</span>
                                    </div>
                                    <div class="text-xs text-gray-500">編集者: \${h.editor_name || '不明'}</div>
                                </div>
                            \`).join('')}
                        </div>
                    \`;
                } catch (error) {
                    content.innerHTML = '<p class="text-gray-500">編集履歴の読み込みに失敗しました。</p>';
                }
            }
            
            function hideEditHistory() {
                document.getElementById('editHistoryPanel').classList.add('hidden');
            }
            
            // セクション別採択事例比較
            function compareWithSuccessCase(sectionId) {
                alert(\`セクション「\${sectionId}」の採択事例比較機能は、今後のアップデートで追加予定です。\n\n現在は「採択事例と比較」ボタンで全体比較をご利用ください。\`);
            }
            
            // 詳細画面から文書削除
            async function deleteGeneratedDocumentFromDetail(docId) {
                if (!confirm('この文書を削除しますか？\\n\\nこの操作は取り消せません。')) {
                    return;
                }
                
                try {
                    await axios.delete(\`/api/generated-documents/\${docId}\`);
                    showToast('文書を削除しました');
                    closeDocumentDetailModal();
                    loadGeneratedDocuments();
                } catch (error) {
                    console.error('Delete error:', error);
                    showToast('削除に失敗しました', 'error');
                }
            }
            
            // 文書エクスポート（フェーズ4）
            function exportDocument(docId) {
                // HTML形式でエクスポート（印刷 → PDF保存可能）
                window.open(\`/api/generated-documents/\${docId}/export?format=html\`, '_blank');
                showToast('新しいタブで文書が開きました。印刷メニュー（Ctrl+P）からPDFに保存できます。');
            }
            
            // 全文書エクスポート
            async function exportAllDocuments() {
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/export-all-documents\`);
                    const data = response.data;
                    
                    // JSONとしてダウンロード
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = \`\${data.client.company_name || data.client.name}_documents_\${new Date().toISOString().split('T')[0]}.json\`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    showToast('全文書をエクスポートしました');
                } catch (error) {
                    alert('エクスポートに失敗しました');
                }
            }
            
            function closeDocumentDetailModal() {
                document.getElementById('documentDetailModal').classList.add('hidden');
            }
            
            async function updateDocumentStatus(docId, status) {
                try {
                    await axios.put(\`/api/generated-documents/\${docId}/status\`, { status });
                    showToast('ステータスを更新しました');
                    loadGeneratedDocuments();
                } catch (error) {
                    alert('更新に失敗しました');
                }
            }
            
            function editSection(docId, sectionId) {
                document.getElementById('section-content-' + sectionId).classList.add('hidden');
                document.getElementById('section-edit-' + sectionId).classList.remove('hidden');
            }
            
            function cancelEditSection(sectionId) {
                document.getElementById('section-content-' + sectionId).classList.remove('hidden');
                document.getElementById('section-edit-' + sectionId).classList.add('hidden');
            }
            
            async function saveSection(docId, sectionId) {
                const textarea = document.querySelector('#section-edit-' + sectionId + ' textarea');
                const content = textarea.value;
                
                try {
                    await axios.put(\`/api/generated-documents/\${docId}/sections/\${sectionId}\`, {
                        content,
                        edit_type: 'manual',
                        editor_name: localStorage.getItem('admin_name') || 'admin'
                    });
                    
                    document.getElementById('section-content-' + sectionId).textContent = content;
                    cancelEditSection(sectionId);
                    showToast('保存しました');
                } catch (error) {
                    alert('保存に失敗しました');
                }
            }
            
            async function regenerateSection(docId, sectionId) {
                const instruction = prompt('追加の指示があれば入力してください（空欄可）:');
                
                const container = document.getElementById('section-content-' + sectionId);
                container.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 再生成中...';
                
                try {
                    const response = await axios.post(\`/api/generated-documents/\${docId}/regenerate-section\`, {
                        section_id: sectionId,
                        additional_instructions: instruction,
                        editor_name: localStorage.getItem('admin_name') || 'admin'
                    });
                    
                    container.textContent = response.data.content;
                    showToast('再生成しました');
                } catch (error) {
                    container.innerHTML = '<span class="text-red-500">再生成に失敗しました</span>';
                }
            }

            Promise.all([loadSubsidyTypes(), loadUsers()]).then(() => {
                loadClient();
                loadDocuments();
                loadCommunications();
            });
        </script>
    </body>
    </html>
  `)
})

// ===============================
// 顧客ポータル
// ===============================

app.get('/portal/:token', async (c) => {
  const { DB } = c.env
  const token = c.req.param('token')
  
  const client = await DB.prepare(`
    SELECT * FROM clients WHERE access_token = ?
  `).bind(token).first()
  
  if (!client) {
    return c.text('Invalid access token', 403)
  }
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>顧客ポータル - ${client.name}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <header class="bg-green-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-3 md:py-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="text-lg md:text-2xl font-bold">
                                <i class="fas fa-user-circle mr-1 md:mr-2"></i>
                                ${client.name} 様
                            </h1>
                            <p class="text-xs md:text-sm mt-1">助成金申請の書類提出とやり取り</p>
                        </div>
                        <button onclick="openNewApplicationModal()" 
                                class="bg-white text-green-600 px-3 py-2 rounded-lg hover:bg-green-50 text-sm font-medium flex items-center gap-2 shadow">
                            <i class="fas fa-plus-circle"></i>
                            <span class="hidden sm:inline">新規申込</span>
                        </button>
                    </div>
                    <!-- ポータルメニュー -->
                    <nav class="flex gap-2 mt-3 overflow-x-auto pb-1">
                        <a href="#status" onclick="scrollToSection('statusSection')" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm whitespace-nowrap">
                            <i class="fas fa-home mr-1"></i>申請状況
                        </a>
                        <a href="#documents" onclick="switchPortalTab('documents'); scrollToSection('documentSection')" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm whitespace-nowrap">
                            <i class="fas fa-file-upload mr-1"></i>書類提出
                        </a>
                        <a href="#hearing" onclick="scrollToSection('hearingSection')" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm whitespace-nowrap">
                            <i class="fas fa-clipboard-list mr-1"></i>ヒアリング
                        </a>
                        <a href="#communications" onclick="switchPortalTab('communications'); scrollToSection('documentSection')" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm whitespace-nowrap">
                            <i class="fas fa-comments mr-1"></i>やり取り
                        </a>
                        <a href="/privacy-policy" target="_blank" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm whitespace-nowrap">
                            <i class="fas fa-shield-alt mr-1"></i>プライバシーポリシー
                        </a>
                        <a href="/legal" target="_blank" class="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm whitespace-nowrap">
                            <i class="fas fa-gavel mr-1"></i>特定商取引法
                        </a>
                    </nav>
                </div>
            </header>

            <div class="container mx-auto px-4 py-4 lg:py-6">
                <!-- お知らせバナー -->
                <div id="announcementBanner" class="hidden mb-4">
                    <!-- お知らせが動的に挿入される -->
                </div>
                
                <!-- PC: 2カラムレイアウト / モバイル: 縦並び -->
                <div class="lg:grid lg:grid-cols-12 lg:gap-6">
                    
                    <!-- 左カラム: ステータス + パイプライン進捗 + ヒアリング質問 -->
                    <div class="lg:col-span-8 space-y-4 lg:space-y-6">
                        <!-- 現在のステータスとパイプライン進捗 -->
                        <div id="statusSection" class="bg-white rounded-lg shadow p-4">
                            <div class="flex items-center justify-between mb-4">
                                <div class="flex items-center gap-3">
                                    <div class="text-2xl" id="statusIcon"></div>
                                    <div>
                                        <div class="text-lg font-bold" id="statusText"></div>
                                        <div class="text-xs text-gray-600" id="statusDescription"></div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs text-gray-500">回答進捗（必須質問基準）</div>
                                    <div id="hearingProgress" class="text-sm font-medium text-indigo-600">必須: 0/0問</div>
                                </div>
                            </div>
                            <div class="mt-3 w-full bg-indigo-200 rounded-full h-2">
                                <div id="hearingProgressBar" class="bg-indigo-600 h-2 rounded-full transition-all" style="width: 0%"></div>
                            </div>
                            
                            <!-- パイプライン進捗 -->
                            <div id="pipelineProgressSection" class="mt-4 pt-4 border-t hidden">
                                <div class="flex items-center justify-between mb-2">
                                    <h3 class="text-sm font-medium text-gray-700">
                                        <i class="fas fa-tasks mr-1 text-green-600"></i>サービス進捗状況
                                    </h3>
                                    <span id="pipelineProgressText" class="text-sm font-bold text-green-600">0%</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-3">
                                    <div id="pipelineProgressBar" class="bg-gradient-to-r from-green-500 to-teal-500 h-3 rounded-full transition-all" style="width: 0%"></div>
                                </div>
                                <div id="pipelineTasksList" class="mt-3 space-y-2 text-sm">
                                    <!-- タスク一覧が表示される -->
                                </div>
                            </div>
                            
                            <!-- 手付金・契約セクション -->
                            <div id="depositSection" class="mt-4 pt-4 border-t hidden">
                                <div class="flex items-center justify-between mb-3">
                                    <h3 class="text-sm font-medium text-gray-700">
                                        <i class="fas fa-credit-card mr-1 text-blue-600"></i>手付金・契約
                                    </h3>
                                    <span id="depositStatusBadge" class="text-xs px-2 py-1 rounded-full"></span>
                                </div>
                                
                                <div id="depositContent" class="space-y-3">
                                    <!-- 手付金情報が表示される -->
                                </div>
                            </div>
                        </div>

                        <!-- ヒアリング質問セクション -->
                        <div id="hearingSection" class="bg-white rounded-lg shadow p-4 lg:p-6">
                            <div class="flex items-center justify-between mb-4">
                                <h2 class="text-lg font-bold">
                                    <i class="fas fa-clipboard-list mr-2 text-indigo-600"></i>ヒアリング質問
                                </h2>
                                <button onclick="saveAllHearingAnswers()" 
                                        class="bg-indigo-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-indigo-700">
                                    <i class="fas fa-save mr-1"></i>保存
                                </button>
                            </div>
                            
                            <!-- カテゴリ別タブ -->
                            <div class="mb-4 border-b">
                                <div id="hearingCategoryTabs" class="flex overflow-x-auto gap-1">
                                    <div class="text-gray-500 text-sm py-2">読み込み中...</div>
                                </div>
                            </div>
                            
                            <!-- 質問一覧 (スクロール可能) -->
                            <div id="hearingQuestionsList" class="space-y-4 max-h-[60vh] lg:max-h-[70vh] overflow-y-auto pr-2">
                                <div class="text-center py-8 text-gray-500">
                                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                    <p>ヒアリング質問を読み込み中...</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 右カラム: 書類 + やり取り -->
                    <div id="documentSection" class="lg:col-span-4 mt-4 lg:mt-0">
                        <div class="lg:sticky lg:top-4 space-y-4">
                            <!-- タブで切り替え: 書類 / やり取り -->
                            <div class="bg-white rounded-lg shadow">
                                <div class="flex border-b">
                                    <button onclick="switchPortalTab('documents')" id="tabDocuments"
                                            class="flex-1 px-4 py-2 text-sm font-medium border-b-2 border-green-600 text-green-600">
                                        <i class="fas fa-upload mr-1"></i>書類
                                    </button>
                                    <button onclick="switchPortalTab('communications')" id="tabCommunications"
                                            class="flex-1 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                                        <i class="fas fa-comments mr-1"></i>やり取り
                                    </button>
                                </div>
                                
                                <!-- 書類アップロードタブ -->
                                <div id="panelDocuments" class="p-4">
                                    <div class="mb-3">
                                        <h3 class="text-sm font-medium mb-2">
                                            <i class="fas fa-folder-open mr-1 text-green-600"></i>必要書類
                                            <span class="text-xs text-gray-500 font-normal ml-1">（タップでアップロード）</span>
                                        </h3>
                                        <div id="checklistItems" class="space-y-1.5"></div>
                                    </div>

                                    <div>
                                        <h3 class="text-sm font-medium mb-2">
                                            <i class="fas fa-check-circle mr-1 text-green-600"></i>アップロード済み
                                        </h3>
                                        <div id="uploadedDocuments" class="max-h-40 overflow-y-auto text-sm"></div>
                                    </div>
                                </div>
                                
                                <!-- 書類アップロードモーダル -->
                                <div id="documentUploadModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
                                    <div class="bg-white rounded-xl w-full max-w-sm shadow-xl">
                                        <div class="flex items-center justify-between p-4 border-b bg-green-600 text-white rounded-t-xl">
                                            <h3 id="uploadModalTitle" class="font-bold text-sm">
                                                <i class="fas fa-upload mr-2"></i>書類アップロード
                                            </h3>
                                            <button onclick="closeUploadModal()" class="text-white hover:text-green-200">
                                                <i class="fas fa-times text-lg"></i>
                                            </button>
                                        </div>
                                        <div class="p-4">
                                            <div id="dropZone" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors hover:border-green-500 hover:bg-green-50 cursor-pointer">
                                                <i class="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
                                                <p class="text-sm text-gray-600 mb-3">ファイルをドラッグ&ドロップ</p>
                                                <input type="file" id="fileInput" class="hidden" multiple>
                                                <input type="hidden" id="selectedDocumentType" value="">
                                                <button onclick="document.getElementById('fileInput').click()" 
                                                        class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                                                    <i class="fas fa-folder-open mr-1"></i>ファイルを選択
                                                </button>
                                            </div>
                                            <p class="text-xs text-gray-500 mt-3 text-center">
                                                対応形式: PDF, Word, Excel, 画像ファイル
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <!-- やり取りタブ -->
                                <div id="panelCommunications" class="p-4 hidden">
                                    <div id="clientCommunications" class="space-y-2 mb-3 max-h-48 overflow-y-auto text-sm"></div>
                                    
                                    <form id="clientMessageForm" class="flex gap-2">
                                        <input type="text" id="clientMessageInput" 
                                               placeholder="メッセージを入力..." 
                                               class="flex-1 px-3 py-2 border rounded-lg text-sm" required>
                                        <button type="submit" 
                                                class="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700">
                                            <i class="fas fa-paper-plane"></i>
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- AIアシスタント フローティングボタン -->
            <div class="fixed bottom-4 right-4 z-40">
                <button onclick="openAiModal()" 
                        class="bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 flex items-center gap-2">
                    <i class="fas fa-robot text-xl"></i>
                    <span class="hidden sm:inline text-sm font-medium">AIに相談</span>
                </button>
            </div>

            <!-- AIアシスタント モーダル -->
            <div id="aiModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-end sm:items-center justify-center">
                <div class="bg-white w-full sm:w-[500px] sm:max-w-lg sm:rounded-lg sm:m-4 rounded-t-2xl max-h-[85vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b bg-purple-600 text-white sm:rounded-t-lg rounded-t-2xl">
                        <h3 class="font-bold"><i class="fas fa-robot mr-2"></i>AIアシスタント</h3>
                        <button onclick="closeAiModal()" class="text-white hover:text-purple-200">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div id="portalAiChat" class="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-[300px]">
                        <div class="text-center text-gray-500 py-8">
                            <i class="fas fa-robot text-4xl mb-3 text-purple-400"></i>
                            <p class="font-medium">補助金申請のお手伝いをします</p>
                            <p class="text-sm mt-2">質問への回答方法や、書類の書き方など<br>なんでもお気軽にご相談ください</p>
                        </div>
                    </div>
                    
                    <div class="p-4 border-t bg-white sm:rounded-b-lg">
                        <form id="portalAiChatForm" class="flex gap-2">
                            <input type="text" id="portalAiChatInput" 
                                   placeholder="質問を入力してください..." 
                                   class="flex-1 px-4 py-3 border rounded-lg text-base" required>
                            <button type="submit" 
                                    class="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- AI提案モーダル（質問個別） -->
            <div id="aiSuggestModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-lg rounded-lg max-h-[80vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b">
                        <h3 class="font-bold text-purple-600"><i class="fas fa-magic mr-2"></i>AI回答提案</h3>
                        <button onclick="closeAiSuggestModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-4 border-b bg-gray-50">
                        <div class="text-sm text-gray-600 mb-1">質問:</div>
                        <div id="suggestQuestionText" class="font-medium"></div>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto p-4">
                        <div id="suggestContent" class="text-center py-8 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                            <p>AIが回答を考えています...</p>
                        </div>
                    </div>
                    
                    <div id="suggestActions" class="p-4 border-t bg-gray-50 hidden">
                        <div class="flex gap-2">
                            <button onclick="applySuggestion()" class="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
                                <i class="fas fa-check mr-1"></i>この回答を使う
                            </button>
                            <button onclick="regenerateSuggestion()" class="px-4 py-2 border rounded-lg hover:bg-gray-100">
                                <i class="fas fa-redo"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- テンプレート選択モーダル -->
            <div id="templateModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-lg rounded-lg max-h-[70vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b">
                        <h3 class="font-bold text-blue-600"><i class="fas fa-list-alt mr-2"></i>テンプレートから選択</h3>
                        <button onclick="closeTemplateModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-4 border-b bg-gray-50">
                        <div class="text-sm text-gray-600 mb-1">質問:</div>
                        <div id="templateQuestionText" class="font-medium"></div>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto p-4">
                        <div id="templateList" class="space-y-2"></div>
                    </div>
                </div>
            </div>
            
            <!-- 書類データ入力モーダル（登記簿/財務諸表/確定申告書） -->
            <div id="dataInputModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-end sm:items-center justify-center">
                <div class="bg-white w-full sm:w-[600px] sm:max-w-2xl sm:rounded-lg sm:m-4 rounded-t-2xl max-h-[90vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b bg-blue-600 text-white sm:rounded-t-lg rounded-t-2xl">
                        <h3 id="dataInputTitle" class="font-bold"><i class="fas fa-edit mr-2"></i>データ入力・確認</h3>
                        <button onclick="closeDataInputModal()" class="text-white hover:text-blue-200">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-4 bg-blue-50 border-b">
                        <div class="flex items-start gap-2">
                            <i class="fas fa-info-circle text-blue-600 mt-0.5"></i>
                            <div class="text-sm text-blue-800">
                                <p class="font-medium">アップロードした書類を基に、以下の情報を入力・確認してください。</p>
                                <p class="text-xs mt-1">この情報は補助金申請書の自動作成や財務指標の計算に使用されます。</p>
                            </div>
                        </div>
                    </div>
                    
                    <div id="dataInputContent" class="flex-1 overflow-y-auto p-4">
                        <!-- 動的にフォームが挿入される -->
                    </div>
                    
                    <div class="p-4 border-t bg-gray-50 flex gap-2">
                        <button onclick="closeDataInputModal()" class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100">
                            後で入力する
                        </button>
                        <button onclick="saveDataInput()" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            <i class="fas fa-save mr-1"></i>保存して確定
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- 財務指標表示モーダル -->
            <div id="financialIndicatorsModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-2xl rounded-lg max-h-[80vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-t-lg">
                        <h3 class="font-bold"><i class="fas fa-chart-line mr-2"></i>自動計算された財務指標</h3>
                        <button onclick="closeFinancialIndicatorsModal()" class="text-white hover:text-green-200">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div id="financialIndicatorsContent" class="flex-1 overflow-y-auto p-4">
                        <!-- 財務指標が表示される -->
                    </div>
                    
                    <div class="p-4 border-t">
                        <button onclick="closeFinancialIndicatorsModal()" class="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- 新規申込モーダル -->
            <div id="newApplicationModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-end sm:items-center justify-center">
                <div class="bg-white w-full sm:w-[500px] sm:max-w-lg sm:rounded-lg sm:m-4 rounded-t-2xl max-h-[90vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b bg-green-600 text-white sm:rounded-t-lg rounded-t-2xl">
                        <h3 class="font-bold"><i class="fas fa-plus-circle mr-2"></i>新規申込</h3>
                        <button onclick="closeNewApplicationModal()" class="text-white hover:text-green-200">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto p-4">
                        <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                            <div class="flex items-start gap-2">
                                <i class="fas fa-info-circle text-blue-600 mt-0.5"></i>
                                <div class="text-sm text-blue-800">
                                    <p class="font-medium">新しい補助金・助成金をお申し込みいただけます</p>
                                    <p class="mt-1">ご希望の補助金を選択して、必要事項をご記入ください。</p>
                                </div>
                            </div>
                        </div>
                        
                        <form id="newApplicationForm" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-1">申請する補助金・助成金 *</label>
                                <select name="subsidy_type_id" id="applicationSubsidyType" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500">
                                    <option value="">選択してください</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-1">申込の目的・相談内容</label>
                                <textarea name="notes" rows="3" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" placeholder="申請したい理由や、ご相談したい内容をご記入ください"></textarea>
                            </div>
                            
                            <div class="pt-2">
                                <label class="flex items-start gap-2">
                                    <input type="checkbox" name="privacy_agreed" required class="mt-1 rounded text-green-600">
                                    <span class="text-sm text-gray-600">
                                        <a href="/privacy-policy" target="_blank" class="text-green-600 underline">プライバシーポリシー</a>に同意します
                                    </span>
                                </label>
                            </div>
                        </form>
                    </div>
                    
                    <div class="p-4 border-t bg-gray-50 flex gap-2 sm:rounded-b-lg">
                        <button onclick="closeNewApplicationModal()" class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100">
                            キャンセル
                        </button>
                        <button onclick="submitNewApplication()" class="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                            <i class="fas fa-paper-plane mr-1"></i>申込む
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // タブ切り替え関数
            function switchPortalTab(tab) {
                const tabDocs = document.getElementById('tabDocuments');
                const tabComms = document.getElementById('tabCommunications');
                const panelDocs = document.getElementById('panelDocuments');
                const panelComms = document.getElementById('panelCommunications');
                
                if (tab === 'documents') {
                    tabDocs.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-green-600 text-green-600';
                    tabComms.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700';
                    panelDocs.classList.remove('hidden');
                    panelComms.classList.add('hidden');
                } else {
                    tabDocs.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700';
                    tabComms.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-green-600 text-green-600';
                    panelDocs.classList.add('hidden');
                    panelComms.classList.remove('hidden');
                }
            }
            
            // セクションへスクロール
            function scrollToSection(sectionId) {
                const section = document.getElementById(sectionId);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return false;
            }
            
            // AIレスポンスを読みやすく整形する関数
            function formatAIResponse(text) {
                if (!text) return '';
                var result = text;
                // 太字 **text** を除去
                result = result.split('**').join('');
                // 見出し # を除去
                result = result.replace(/^#+\\s*/gm, '');
                // 箇条書きを日本語の・に変換
                result = result.replace(/^[\\-\\*]\\s+/gm, '・');
                // バッククォートを除去
                var bt = String.fromCharCode(96);
                while (result.indexOf(bt) !== -1) {
                    result = result.replace(bt, '');
                }
                // 連続する改行を整理
                while (result.indexOf('\\n\\n\\n') !== -1) {
                    result = result.replace('\\n\\n\\n', '\\n\\n');
                }
                return result.trim();
            }
            
            const CLIENT_ID = ${client.id};
            const STATUS_INFO = {
                inquiry: { icon: '🔍', text: '見込み', desc: 'まずはお話を聞かせてください' },
                consulting: { icon: '💬', text: '相談中', desc: '詳細をヒアリングしています' },
                preparing: { icon: '📝', text: '書類準備中', desc: '必要書類をアップロードしてください' },
                applying: { icon: '📤', text: '申請中', desc: '申請手続きを進めています' },
                completed: { icon: '✅', text: '完了', desc: 'お疲れ様でした！' }
            };

            async function loadStatus() {
                const response = await axios.get(\`/api/clients/\${CLIENT_ID}\`);
                const client = response.data;
                const info = STATUS_INFO[client.status];
                
                document.getElementById('statusIcon').textContent = info.icon;
                document.getElementById('statusText').textContent = info.text;
                document.getElementById('statusDescription').textContent = info.desc;
            }
            
            // お知らせを読み込む
            async function loadAnnouncements() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/announcements\`);
                    const announcements = response.data;
                    
                    if (announcements.length === 0) {
                        document.getElementById('announcementBanner').classList.add('hidden');
                        return;
                    }
                    
                    const container = document.getElementById('announcementBanner');
                    container.classList.remove('hidden');
                    
                    const typeStyles = {
                        info: { bg: 'bg-blue-50 border-blue-200', icon: 'fa-info-circle text-blue-600', text: 'text-blue-800' },
                        warning: { bg: 'bg-yellow-50 border-yellow-200', icon: 'fa-exclamation-triangle text-yellow-600', text: 'text-yellow-800' },
                        urgent: { bg: 'bg-red-50 border-red-200', icon: 'fa-exclamation-circle text-red-600', text: 'text-red-800' },
                        maintenance: { bg: 'bg-gray-50 border-gray-200', icon: 'fa-tools text-gray-600', text: 'text-gray-800' }
                    };
                    
                    container.innerHTML = announcements.map(a => {
                        const style = typeStyles[a.type] || typeStyles.info;
                        return \`
                            <div class="rounded-lg border p-3 mb-2 \${style.bg} \${a.is_read ? 'opacity-70' : ''}">
                                <div class="flex items-start gap-3">
                                    <i class="fas \${style.icon} mt-0.5"></i>
                                    <div class="flex-1">
                                        <div class="font-medium \${style.text}">\${a.title}</div>
                                        <div class="text-sm \${style.text} mt-1">\${a.content}</div>
                                    </div>
                                    \${!a.is_read ? \`
                                        <button onclick="markAnnouncementRead(\${a.id})" class="text-xs text-gray-500 hover:text-gray-700">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    \` : ''}
                                </div>
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading announcements:', error);
                }
            }
            
            async function markAnnouncementRead(announcementId) {
                try {
                    await axios.post(\`/api/announcements/\${announcementId}/read\`, {
                        client_id: CLIENT_ID
                    });
                    loadAnnouncements();
                } catch (error) {
                    console.error('Error marking announcement read:', error);
                }
            }
            
            // パイプライン進捗を読み込む
            async function loadPipelineProgress() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/pipelines\`);
                    const pipelines = response.data;
                    
                    if (pipelines.length === 0) {
                        document.getElementById('pipelineProgressSection').classList.add('hidden');
                        return;
                    }
                    
                    // アクティブなパイプラインを取得（最新のもの）
                    const activePipeline = pipelines.find(p => p.status === 'active') || pipelines[0];
                    
                    const section = document.getElementById('pipelineProgressSection');
                    section.classList.remove('hidden');
                    
                    // 進捗率を更新
                    const progress = activePipeline.progress_percentage || 0;
                    document.getElementById('pipelineProgressText').textContent = progress + '%';
                    document.getElementById('pipelineProgressBar').style.width = progress + '%';
                    
                    // タスク一覧を取得
                    const tasksResponse = await axios.get(\`/api/pipelines/\${activePipeline.id}/tasks\`);
                    const tasks = tasksResponse.data;
                    
                    const tasksContainer = document.getElementById('pipelineTasksList');
                    
                    if (tasks.length === 0) {
                        tasksContainer.innerHTML = '<div class="text-gray-500 text-center py-2">タスクがありません</div>';
                        return;
                    }
                    
                    const statusStyles = {
                        pending: { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'fa-circle' },
                        in_progress: { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'fa-spinner fa-spin' },
                        completed: { bg: 'bg-green-100', text: 'text-green-600', icon: 'fa-check' },
                        skipped: { bg: 'bg-gray-100', text: 'text-gray-400', icon: 'fa-minus' }
                    };
                    
                    const taskTypeLabels = {
                        internal: '自社対応',
                        external: '顧客対応',
                        both: '共同'
                    };
                    
                    tasksContainer.innerHTML = tasks.slice(0, 5).map((task, index) => {
                        const style = statusStyles[task.status] || statusStyles.pending;
                        const isCustomerTask = task.task_type === 'external' || task.task_type === 'both';
                        
                        return \`
                            <div class="flex items-center gap-2 p-2 rounded \${style.bg}">
                                <div class="w-6 h-6 rounded-full flex items-center justify-center \${task.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'} text-white text-xs">
                                    <i class="fas \${style.icon}"></i>
                                </div>
                                <div class="flex-1">
                                    <div class="font-medium \${style.text}">\${task.task_name}</div>
                                    <div class="text-xs text-gray-500">
                                        \${isCustomerTask ? '<span class="text-orange-600"><i class="fas fa-user mr-1"></i>顧客対応</span> · ' : ''}
                                        \${task.end_date ? '期限: ' + task.end_date : ''}
                                    </div>
                                </div>
                                \${task.status === 'pending' && isCustomerTask ? \`
                                    <span class="text-xs px-2 py-1 bg-orange-100 text-orange-600 rounded">対応待ち</span>
                                \` : ''}
                            </div>
                        \`;
                    }).join('');
                    
                    if (tasks.length > 5) {
                        tasksContainer.innerHTML += \`
                            <div class="text-center text-xs text-gray-500 mt-2">
                                他 \${tasks.length - 5} 件のタスクがあります
                            </div>
                        \`;
                    }
                } catch (error) {
                    console.error('Error loading pipeline progress:', error);
                }
            }
            
            // 手付金・契約情報を読み込む
            async function loadDepositInfo() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}\`);
                    const client = response.data;
                    
                    const section = document.getElementById('depositSection');
                    const badge = document.getElementById('depositStatusBadge');
                    const content = document.getElementById('depositContent');
                    
                    if (!section) return;
                    
                    // 手付金が不要な場合は非表示
                    if (!client.deposit_required) {
                        section.classList.add('hidden');
                        return;
                    }
                    
                    section.classList.remove('hidden');
                    
                    // ステータスバッジ
                    if (client.deposit_paid) {
                        badge.className = 'text-xs px-2 py-1 rounded-full bg-green-100 text-green-700';
                        badge.innerHTML = '<i class="fas fa-check mr-1"></i>支払い済み';
                    } else {
                        badge.className = 'text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700';
                        badge.innerHTML = '<i class="fas fa-clock mr-1"></i>未払い';
                    }
                    
                    // 金額フォーマット
                    const amount = (client.deposit_amount || 0).toLocaleString();
                    
                    if (client.deposit_paid) {
                        // 支払い済みの場合
                        content.innerHTML = \`
                            <div class="bg-green-50 rounded-lg p-4">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                                        <i class="fas fa-check text-white"></i>
                                    </div>
                                    <div>
                                        <div class="font-bold text-green-800">¥\${amount}</div>
                                        <div class="text-xs text-green-600">
                                            \${client.deposit_paid_at ? new Date(client.deposit_paid_at).toLocaleDateString('ja-JP') + ' にお支払い完了' : 'お支払い完了'}
                                        </div>
                                    </div>
                                </div>
                                <div class="text-xs text-gray-500">
                                    支払方法: \${client.deposit_payment_method || '不明'}
                                </div>
                            </div>
                            \${client.contract_url ? \`
                                <a href="\${client.contract_url}" target="_blank" class="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-blue-700 hover:bg-blue-100">
                                    <i class="fas fa-file-signature"></i>
                                    <span class="text-sm font-medium">電子契約書を確認</span>
                                    <i class="fas fa-external-link-alt ml-auto text-xs"></i>
                                </a>
                            \` : ''}
                        \`;
                    } else if (client.deposit_transfer_reported) {
                        // 振込報告済み・確認待ちの場合
                        badge.className = 'text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700';
                        badge.innerHTML = '<i class="fas fa-hourglass-half mr-1"></i>確認中';
                        
                        content.innerHTML = \`
                            <div class="bg-blue-50 rounded-lg p-4">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                                        <i class="fas fa-hourglass-half text-white"></i>
                                    </div>
                                    <div>
                                        <div class="font-bold text-blue-800">¥\${amount}</div>
                                        <div class="text-xs text-blue-600">
                                            振込報告済み - 確認をお待ちください
                                        </div>
                                    </div>
                                </div>
                                <div class="text-xs text-gray-500 mt-2">
                                    <i class="fas fa-clock mr-1"></i>
                                    報告日時: \${client.deposit_transfer_reported_at ? new Date(client.deposit_transfer_reported_at).toLocaleString('ja-JP') : '-'}
                                </div>
                            </div>
                            <div class="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                                <i class="fas fa-info-circle text-blue-500 mr-1"></i>
                                担当者が振込を確認後、ステータスが更新されます。
                            </div>
                            \${client.contract_url ? \`
                                <a href="\${client.contract_url}" target="_blank" class="flex items-center gap-2 p-3 mt-3 bg-blue-50 rounded-lg text-blue-700 hover:bg-blue-100">
                                    <i class="fas fa-file-signature"></i>
                                    <span class="text-sm font-medium">電子契約書を確認</span>
                                    <i class="fas fa-external-link-alt ml-auto text-xs"></i>
                                </a>
                            \` : ''}
                        \`;
                    } else {
                        // 未払いの場合
                        content.innerHTML = \`
                            <div class="bg-yellow-50 rounded-lg p-4">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                                        <i class="fas fa-yen-sign text-white"></i>
                                    </div>
                                    <div>
                                        <div class="font-bold text-yellow-800">¥\${amount}</div>
                                        <div class="text-xs text-yellow-600">手付金のお支払いをお願いいたします</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mt-3 space-y-2">
                                <p class="text-sm font-medium text-gray-700">お支払い方法</p>
                                <button onclick="showPaymentModal('credit')" class="w-full flex items-center gap-3 p-3 bg-white border rounded-lg hover:bg-gray-50">
                                    <div class="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                                        <i class="fas fa-credit-card text-blue-600"></i>
                                    </div>
                                    <div class="flex-1 text-left">
                                        <div class="text-sm font-medium">クレジットカード</div>
                                        <div class="text-xs text-gray-500">VISA, Mastercard, JCB</div>
                                    </div>
                                    <i class="fas fa-chevron-right text-gray-400"></i>
                                </button>
                                <button onclick="showPaymentModal('bank')" class="w-full flex items-center gap-3 p-3 bg-white border rounded-lg hover:bg-gray-50">
                                    <div class="w-8 h-8 rounded bg-green-100 flex items-center justify-center">
                                        <i class="fas fa-university text-green-600"></i>
                                    </div>
                                    <div class="flex-1 text-left">
                                        <div class="text-sm font-medium">銀行振込</div>
                                        <div class="text-xs text-gray-500">お振込先情報を表示</div>
                                    </div>
                                    <i class="fas fa-chevron-right text-gray-400"></i>
                                </button>
                            </div>
                            
                            \${client.contract_url ? \`
                                <a href="\${client.contract_url}" target="_blank" class="flex items-center gap-2 p-3 mt-3 bg-blue-50 rounded-lg text-blue-700 hover:bg-blue-100">
                                    <i class="fas fa-file-signature"></i>
                                    <span class="text-sm font-medium">電子契約書を確認</span>
                                    <i class="fas fa-external-link-alt ml-auto text-xs"></i>
                                </a>
                            \` : ''}
                        \`;
                    }
                } catch (error) {
                    console.error('Error loading deposit info:', error);
                }
            }
            
            // 銀行振込情報を取得
            let bankInfo = {};
            async function loadBankInfo() {
                try {
                    const response = await axios.get('/api/bank-info');
                    bankInfo = response.data;
                } catch (error) {
                    console.error('Error loading bank info:', error);
                }
            }
            loadBankInfo();
            
            // 支払いモーダル表示
            async function showPaymentModal(method) {
                const amount = document.querySelector('#depositContent .font-bold')?.textContent || '¥0';
                
                if (method === 'credit') {
                    // Stripeが有効か確認
                    try {
                        const settingsRes = await axios.get('/api/settings');
                        if (settingsRes.data.stripe_enabled) {
                            // Stripe決済セッション作成
                            showMessage('決済ページを準備しています...', 'info');
                            const response = await axios.post(\`/api/clients/\${CLIENT_ID}/create-checkout-session\`, {
                                success_url: window.location.origin,
                                cancel_url: window.location.origin
                            });
                            if (response.data.checkout_url) {
                                window.location.href = response.data.checkout_url;
                            }
                        } else {
                            alert('クレジットカード決済機能は現在ご利用いただけません。\\n\\nお手数ですが、銀行振込をご利用ください。');
                        }
                    } catch (error) {
                        console.error('Stripe error:', error);
                        alert('決済の準備中にエラーが発生しました。\\n銀行振込をご利用いただくか、担当者までお問い合わせください。');
                    }
                } else if (method === 'bank') {
                    showBankTransferModal(amount);
                }
            }
            
            // 銀行振込モーダル
            function showBankTransferModal(amount) {
                const modal = document.createElement('div');
                modal.id = 'bankTransferModal';
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                modal.innerHTML = \`
                    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div class="p-4 border-b flex justify-between items-center">
                            <h3 class="text-lg font-bold">銀行振込でのお支払い</h3>
                            <button onclick="closeBankTransferModal()" class="text-gray-400 hover:text-gray-600">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="p-4 space-y-4">
                            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                                <h4 class="font-bold text-green-800 mb-3">
                                    <i class="fas fa-university mr-2"></i>振込先情報
                                </h4>
                                <table class="w-full text-sm">
                                    <tr>
                                        <td class="py-1 text-gray-600">銀行名</td>
                                        <td class="py-1 font-medium">\${bankInfo.bank_name || '（未設定）'}</td>
                                    </tr>
                                    <tr>
                                        <td class="py-1 text-gray-600">支店名</td>
                                        <td class="py-1 font-medium">\${bankInfo.bank_branch || '（未設定）'}</td>
                                    </tr>
                                    <tr>
                                        <td class="py-1 text-gray-600">口座種別</td>
                                        <td class="py-1 font-medium">\${bankInfo.bank_account_type || '普通'}</td>
                                    </tr>
                                    <tr>
                                        <td class="py-1 text-gray-600">口座番号</td>
                                        <td class="py-1 font-medium">\${bankInfo.bank_account_number || '（未設定）'}</td>
                                    </tr>
                                    <tr>
                                        <td class="py-1 text-gray-600">口座名義</td>
                                        <td class="py-1 font-medium">\${bankInfo.bank_account_holder || '（未設定）'}</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <div class="flex items-center gap-2 text-yellow-800">
                                    <i class="fas fa-yen-sign"></i>
                                    <span class="font-bold">お振込み金額: \${amount}</span>
                                </div>
                            </div>
                            
                            <div class="text-sm text-gray-600">
                                <p class="mb-2"><i class="fas fa-info-circle text-blue-500 mr-1"></i>お振込み後、下のボタンから完了報告をお願いします。</p>
                            </div>
                            
                            <button id="reportTransferBtn" onclick="reportBankTransfer()" class="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                                <i class="fas fa-check mr-2"></i>振込完了を報告する
                            </button>
                        </div>
                    </div>
                \`;
                document.body.appendChild(modal);
            }
            
            function closeBankTransferModal() {
                const modal = document.getElementById('bankTransferModal');
                if (modal) modal.remove();
            }
            
            // 振込完了報告
            async function reportBankTransfer() {
                if (!confirm('振込完了を報告しますか？\\n\\n※まだお振込みが完了していない場合は、振込完了後に報告してください。')) {
                    return;
                }
                
                // ボタンを無効化して二重送信防止
                const btn = document.getElementById('reportTransferBtn');
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>送信中...';
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                }
                
                let reportSuccess = false;
                
                try {
                    const clientRes = await axios.get(\`/api/clients/\${CLIENT_ID}\`);
                    const amount = clientRes.data.deposit_amount || 0;
                    
                    await axios.post(\`/api/clients/\${CLIENT_ID}/report-transfer\`, {
                        payment_type: 'deposit',
                        amount: amount,
                        notes: '顧客ポータルから報告'
                    });
                    
                    reportSuccess = true;
                } catch (error) {
                    console.error('Error reporting transfer:', error);
                    const errorMsg = error.response?.data?.error || error.response?.data?.details || error.message || '不明なエラー';
                    const statusCode = error.response?.status || 'N/A';
                    console.error('Error details:', { statusCode, errorMsg, fullError: error.response?.data });
                    alert(\`報告の送信に失敗しました。\\n\\nエラー: \${errorMsg}\\nステータス: \${statusCode}\\n\\nお手数ですが、担当者に直接ご連絡ください。\`);
                    
                    // エラー時はボタンを復活
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-check mr-2"></i>振込完了を報告する';
                        btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                    return;
                }
                
                // 報告成功後の処理（エラーがあっても無視）
                if (reportSuccess) {
                    try { closeBankTransferModal(); } catch(e) { console.warn('closeBankTransferModal error:', e); }
                    try { showMessage('振込完了報告を送信しました。確認までしばらくお待ちください。', 'success'); } catch(e) { console.warn('showMessage error:', e); }
                    try { await loadDepositInfo(); } catch(e) { console.warn('loadDepositInfo error:', e); }
                    
                    // 万が一showMessageが失敗した場合の代替
                    alert('振込完了報告を送信しました。確認までしばらくお待ちください。');
                }
            }

            async function loadChecklist() {
                // 顧客の助成金種別に基づくチェックリストを取得
                const response = await axios.get(\`/api/clients/\${CLIENT_ID}/document-checklist\`);
                const items = response.data;
                
                const docsResponse = await axios.get(\`/api/clients/\${CLIENT_ID}/documents\`);
                const uploadedDocs = docsResponse.data;
                const uploadedTypes = new Set(uploadedDocs.map(d => d.document_type));
                
                document.getElementById('checklistItems').innerHTML = items.map(item => {
                    const isUploaded = uploadedTypes.has(item.document_type);
                    return \`
                        <div onclick="openUploadModal('\${item.document_type.replace(/'/g, "\\\\'")}', \${isUploaded})" 
                             class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all \${isUploaded ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200 hover:bg-green-50 hover:border-green-300'}">
                            <div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center \${isUploaded ? 'bg-green-500' : 'bg-gray-300'}">
                                <i class="fas \${isUploaded ? 'fa-check' : 'fa-plus'} text-white text-xs"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <span class="text-sm \${isUploaded ? 'text-green-700 font-medium' : 'text-gray-700'}">\${item.document_type}</span>
                                \${item.is_required ? '<span class="ml-1 text-xs text-red-500">*必須</span>' : ''}
                            </div>
                            <i class="fas fa-chevron-right text-xs \${isUploaded ? 'text-green-400' : 'text-gray-400'}"></i>
                        </div>
                    \`;
                }).join('');
            }
            
            function openUploadModal(documentType, isUploaded) {
                document.getElementById('selectedDocumentType').value = documentType;
                document.getElementById('uploadModalTitle').innerHTML = \`
                    <i class="fas fa-\${isUploaded ? 'sync-alt' : 'upload'} mr-2"></i>\${documentType}
                \`;
                document.getElementById('documentUploadModal').classList.remove('hidden');
            }
            
            function closeUploadModal() {
                document.getElementById('documentUploadModal').classList.add('hidden');
                document.getElementById('fileInput').value = '';
            }

            async function loadDocuments() {
                const response = await axios.get(\`/api/clients/\${CLIENT_ID}/documents\`);
                const docs = response.data;
                
                const container = document.getElementById('uploadedDocuments');
                if (docs.length === 0) {
                    container.innerHTML = '<div class="text-sm text-gray-500 py-4">まだ書類がありません</div>';
                    return;
                }
                
                container.innerHTML = docs.map(doc => \`
                    <div class="border rounded p-2 mb-1.5 flex items-center justify-between">
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-xs truncate">\${doc.document_type}</div>
                            <div class="text-xs text-gray-400 truncate">\${doc.file_name}</div>
                        </div>
                        <div class="flex items-center gap-1.5 ml-2">
                            <span class="text-xs px-1.5 py-0.5 rounded \${
                                doc.status === 'approved' ? 'bg-green-100 text-green-700' :
                                doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                            }">
                                \${doc.status === 'approved' ? '✓' : doc.status === 'rejected' ? '✗' : '...'}
                            </span>
                            <a href="/api/documents/\${doc.id}/download" class="text-green-600 hover:text-green-800 text-xs">
                                <i class="fas fa-download"></i>
                            </a>
                        </div>
                    </div>
                \`).join('');
            }

            async function loadCommunications() {
                const response = await axios.get(\`/api/clients/\${CLIENT_ID}/communications\`);
                const comms = response.data;
                
                const container = document.getElementById('clientCommunications');
                if (comms.length === 0) {
                    container.innerHTML = '<div class="text-sm text-gray-500">まだやり取りがありません</div>';
                    return;
                }
                
                container.innerHTML = comms.map(comm => {
                    const isClient = comm.sender_type === 'client';
                    return \`
                        <div class="flex \${isClient ? 'justify-end' : 'justify-start'}">
                            <div class="max-w-[85%] \${isClient ? 'bg-green-100' : 'bg-gray-100'} rounded-lg px-2.5 py-1.5">
                                <div class="text-xs">\${comm.message}</div>
                                <div class="text-xs text-gray-400 mt-0.5">\${comm.sender_name} · \${new Date(comm.created_at).toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'})}</div>
                            </div>
                        </div>
                    \`;
                }).join('');
                
                container.scrollTop = container.scrollHeight;
            }

            document.getElementById('clientMessageForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const message = document.getElementById('clientMessageInput').value;
                
                await axios.post(\`/api/clients/\${CLIENT_ID}/communications\`, {
                    message,
                    sender_type: 'client',
                    sender_name: '${client.name}'
                });
                
                document.getElementById('clientMessageInput').value = '';
                loadCommunications();
            });

            document.getElementById('fileInput').addEventListener('change', async (e) => {
                const files = e.target.files;
                const documentType = document.getElementById('selectedDocumentType').value;
                
                if (!documentType) {
                    showMessage('error', '書類の種類が選択されていません');
                    return;
                }
                
                if (files.length === 0) return;
                
                // アップロード開始を表示
                showMessage('info', 'アップロード中...');
                
                // 実際のファイルアップロード（R2使用）
                try {
                    let successCount = 0;
                    for (const file of files) {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('document_type', documentType);
                        formData.append('uploaded_by', 'client');
                        
                        const response = await axios.post(\`/api/clients/\${CLIENT_ID}/documents/upload\`, formData, {
                            headers: {
                                'Content-Type': 'multipart/form-data'
                            }
                        });
                        
                        if (response.status === 200 && response.data) {
                            successCount++;
                        }
                    }
                    
                    showMessage('success', \`「\${documentType}」をアップロードしました！\`);
                    document.getElementById('fileInput').value = '';
                    closeUploadModal();
                    await loadDocuments();
                    await loadChecklist();
                    
                    // 特定の書類タイプの場合、データ入力モーダルを表示
                    const docType = documentType.toLowerCase();
                    if (docType.includes('登記') || docType.includes('謄本') || docType.includes('履歴事項')) {
                        showDataInputModal('registry', documentType);
                    } else if (docType.includes('決算') || docType.includes('財務') || docType.includes('貸借') || docType.includes('損益')) {
                        showDataInputModal('financial', documentType);
                    } else if (docType.includes('確定申告')) {
                        showDataInputModal('tax_return', documentType);
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    if (error.response) {
                        showMessage('error', \`アップロードエラー: \${error.response.data.error || '不明なエラー'}\`);
                    } else {
                        showMessage('error', 'ネットワークエラーが発生しました。もう一度お試しください。');
                    }
                }
            });

            // ドラッグ&ドロップ機能（モーダル内）
            const dropZone = document.getElementById('dropZone');
            
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-green-500', 'bg-green-100');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-green-500', 'bg-green-100');
            });
            
            dropZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-green-500', 'bg-green-100');
                
                const documentType = document.getElementById('selectedDocumentType').value;
                if (!documentType) {
                    showMessage('error', '書類の種類が選択されていません');
                    return;
                }
                
                const files = e.dataTransfer.files;
                if (files.length === 0) return;
                
                // アップロード開始を表示
                showMessage('info', 'アップロード中...');
                
                try {
                    let successCount = 0;
                    for (const file of files) {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('document_type', documentType);
                        formData.append('uploaded_by', 'client');
                        
                        const response = await axios.post(\`/api/clients/\${CLIENT_ID}/documents/upload\`, formData, {
                            headers: {
                                'Content-Type': 'multipart/form-data'
                            }
                        });
                        
                        if (response.status === 200 && response.data) {
                            successCount++;
                        }
                    }
                    
                    showMessage('success', \`「\${documentType}」をアップロードしました！\`);
                    closeUploadModal();
                    await loadDocuments();
                    await loadChecklist();
                    
                    // 特定の書類タイプの場合、データ入力モーダルを表示
                    const docType = documentType.toLowerCase();
                    if (docType.includes('登記') || docType.includes('謄本') || docType.includes('履歴事項')) {
                        showDataInputModal('registry', documentType);
                    } else if (docType.includes('決算') || docType.includes('財務') || docType.includes('貸借') || docType.includes('損益')) {
                        showDataInputModal('financial', documentType);
                    } else if (docType.includes('確定申告')) {
                        showDataInputModal('tax_return', documentType);
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    if (error.response) {
                        showMessage('error', \`アップロードエラー: \${error.response.data.error || '不明なエラー'}\`);
                    } else {
                        showMessage('error', 'ネットワークエラーが発生しました。もう一度お試しください。');
                    }
                }
            });
            
            // モーダル外クリックで閉じる
            document.getElementById('documentUploadModal').addEventListener('click', (e) => {
                if (e.target.id === 'documentUploadModal') {
                    closeUploadModal();
                }
            });

            // メッセージ表示関数
            function showMessage(type, message) {
                const colors = {
                    success: 'bg-green-600',
                    error: 'bg-red-600',
                    info: 'bg-blue-600'
                };
                const icons = {
                    success: 'fa-check-circle',
                    error: 'fa-exclamation-circle',
                    info: 'fa-info-circle'
                };
                
                // 既存のメッセージを削除
                const existing = document.getElementById('uploadMessage');
                if (existing) existing.remove();
                
                const toast = document.createElement('div');
                toast.id = 'uploadMessage';
                toast.className = \`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto \${colors[type]} text-white px-4 md:px-6 py-3 rounded-lg shadow-lg z-50\`;
                toast.innerHTML = \`
                    <div class="flex items-center gap-2">
                        <i class="fas \${icons[type]}"></i>
                        <span class="text-sm md:text-base">\${message}</span>
                    </div>
                \`;
                document.body.appendChild(toast);
                
                if (type !== 'info') {
                    setTimeout(() => {
                        toast.style.opacity = '0';
                        toast.style.transition = 'opacity 0.3s';
                        setTimeout(() => toast.remove(), 300);
                    }, 3000);
                }
            }

            // ===============================
            // ヒアリング質問機能
            // ===============================
            
            let hearingQuestions = [];
            let hearingAnswers = {};
            let currentCategory = null;
            
            async function loadHearingQuestions() {
                try {
                    // 顧客の助成金種別を取得
                    const clientRes = await axios.get(\`/api/clients/\${CLIENT_ID}\`);
                    const client = clientRes.data;
                    
                    if (!client.subsidy_type_id) {
                        document.getElementById('hearingQuestionsList').innerHTML = \`
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-info-circle text-2xl mb-2"></i>
                                <p>まだ助成金種別が設定されていません。</p>
                                <p class="text-sm mt-2">担当者にお問い合わせください。</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    // ヒアリング質問を取得
                    const questionsRes = await axios.get(\`/api/hearing-questions/\${client.subsidy_type_id}\`);
                    hearingQuestions = questionsRes.data;
                    
                    // 既存の回答を取得
                    const answersRes = await axios.get(\`/api/clients/\${CLIENT_ID}/hearing-answers\`);
                    hearingAnswers = {};
                    (answersRes.data || []).forEach(a => {
                        hearingAnswers[a.question_id] = a.answer_text;
                    });
                    
                    // カテゴリを抽出してタブを作成
                    const categories = [...new Set(hearingQuestions.map(q => q.category))];
                    if (categories.length > 0) {
                        currentCategory = categories[0];
                        renderCategoryTabs(categories);
                        renderQuestions();
                        updateProgress();
                    } else {
                        document.getElementById('hearingQuestionsList').innerHTML = \`
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-check-circle text-2xl mb-2 text-green-500"></i>
                                <p>この助成金種別にはヒアリング質問が設定されていません。</p>
                            </div>
                        \`;
                    }
                } catch (error) {
                    console.error('Error loading hearing questions:', error);
                    document.getElementById('hearingQuestionsList').innerHTML = \`
                        <div class="text-center py-8 text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>ヒアリング質問の読み込みに失敗しました。</p>
                        </div>
                    \`;
                }
            }
            
            function renderCategoryTabs(categories) {
                const container = document.getElementById('hearingCategoryTabs');
                container.innerHTML = categories.map(cat => \`
                    <button onclick="switchHearingCategory('\${cat}')" 
                            class="px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors \${currentCategory === cat ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
                        \${cat}
                        <span class="ml-1 text-xs px-1.5 py-0.5 rounded-full \${getCategoryProgressColor(cat)}">
                            \${getCategoryProgress(cat)}
                        </span>
                    </button>
                \`).join('');
            }
            
            function getCategoryProgress(category) {
                const catQuestions = hearingQuestions.filter(q => q.category === category);
                const answered = catQuestions.filter(q => hearingAnswers[q.id] && hearingAnswers[q.id].trim()).length;
                return \`\${answered}/\${catQuestions.length}\`;
            }
            
            function getCategoryProgressColor(category) {
                const catQuestions = hearingQuestions.filter(q => q.category === category);
                const answered = catQuestions.filter(q => hearingAnswers[q.id] && hearingAnswers[q.id].trim()).length;
                if (answered === catQuestions.length) return 'bg-green-100 text-green-800';
                if (answered > 0) return 'bg-yellow-100 text-yellow-800';
                return 'bg-gray-100 text-gray-600';
            }
            
            function switchHearingCategory(category) {
                currentCategory = category;
                const categories = [...new Set(hearingQuestions.map(q => q.category))];
                renderCategoryTabs(categories);
                renderQuestions();
            }
            
            function renderQuestions() {
                const container = document.getElementById('hearingQuestionsList');
                const filteredQuestions = hearingQuestions.filter(q => q.category === currentCategory);
                
                if (filteredQuestions.length === 0) {
                    container.innerHTML = '<div class="text-center py-8 text-gray-500">このカテゴリに質問はありません。</div>';
                    return;
                }
                
                container.innerHTML = filteredQuestions.map((q, index) => \`
                    <div class="border rounded-lg p-4 \${hearingAnswers[q.id] ? 'bg-green-50 border-green-200' : 'bg-white'}">
                        <div class="flex items-start gap-3 mb-3">
                            <span class="flex-shrink-0 w-8 h-8 rounded-full \${hearingAnswers[q.id] ? 'bg-green-500' : 'bg-indigo-500'} text-white flex items-center justify-center text-sm font-medium">
                                \${hearingAnswers[q.id] ? '<i class="fas fa-check"></i>' : (index + 1)}
                            </span>
                            <div class="flex-1">
                                <div class="font-medium text-gray-800 mb-1">
                                    \${q.question_text}
                                    \${q.is_required ? 
                                        '<span class="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">必須</span>' : 
                                        '<span class="ml-2 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded">任意</span>'}
                                </div>
                                \${q.description ? \`<div class="text-sm text-gray-500">\${q.description}</div>\` : ''}
                            </div>
                        </div>
                        \${renderAnswerInput(q)}
                    </div>
                \`).join('');
            }
            
            function renderAnswerInput(question) {
                const currentAnswer = hearingAnswers[question.id] || '';
                const inputType = question.input_type || 'textarea';
                
                // ヘルプテキスト（書き方ガイド）
                const helpSection = question.help_text ? \`
                    <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div class="flex items-start gap-2">
                            <i class="fas fa-lightbulb text-blue-500 mt-0.5"></i>
                            <div class="text-sm text-blue-700">\${question.help_text}</div>
                        </div>
                    </div>
                \` : '';
                
                // 記入例
                const exampleSection = question.example_answer ? \`
                    <details class="mb-3 group">
                        <summary class="text-sm text-gray-500 cursor-pointer hover:text-indigo-600 select-none">
                            <i class="fas fa-file-alt mr-1"></i>記入例を見る
                        </summary>
                        <div class="mt-2 p-3 bg-gray-50 border rounded-lg text-sm text-gray-700">
                            <div class="whitespace-pre-wrap">\${question.example_answer}</div>
                            <button onclick="useExampleById(\${question.id})" 
                                    class="mt-2 text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
                                <i class="fas fa-copy mr-1"></i>この例文をベースに使う
                            </button>
                        </div>
                    </details>
                \` : '';
                
                // 入力ボタン群
                const actionButtons = \`
                    <div class="flex flex-wrap gap-1 mt-2">
                        <button onclick="openAiSuggestModal(\${question.id})" 
                                class="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
                            <i class="fas fa-magic mr-1"></i>AI提案
                        </button>
                        <button onclick="openTemplateModal(\${question.id})" 
                                class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            <i class="fas fa-list-alt mr-1"></i>テンプレ
                        </button>
                        <button onclick="showWritingGuide(\${question.id})" 
                                class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                            <i class="fas fa-book mr-1"></i>書き方ガイド
                        </button>
                    </div>
                \`;
                
                if (inputType === 'select' && question.options) {
                    const options = JSON.parse(question.options);
                    return \`
                        <select onchange="updateHearingAnswer(\${question.id}, this.value)" 
                                class="w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="">選択してください</option>
                            \${options.map(opt => \`<option value="\${opt}" \${currentAnswer === opt ? 'selected' : ''}>\${opt}</option>\`).join('')}
                        </select>
                    \`;
                } else if (inputType === 'number') {
                    return \`
                        <input type="number" value="\${currentAnswer}" 
                               onchange="updateHearingAnswer(\${question.id}, this.value)"
                               placeholder="数値を入力..."
                               class="w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    \`;
                } else {
                    return \`
                        \${helpSection}
                        \${exampleSection}
                        <textarea id="answer-\${question.id}" onchange="updateHearingAnswer(\${question.id}, this.value)"
                                  placeholder="回答を入力してください..."
                                  rows="3"
                                  class="w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none">\${currentAnswer}</textarea>
                        \${actionButtons}
                    \`;
                }
            }
            
            // 記入例をテキストエリアにコピー
            function useExampleById(questionId) {
                const question = hearingQuestions.find(q => q.id === questionId);
                if (!question || !question.example_answer) return;
                
                const textarea = document.getElementById(\`answer-\${questionId}\`);
                if (textarea) {
                    textarea.value = question.example_answer;
                    updateHearingAnswer(questionId, question.example_answer);
                    showMessage('success', '記入例を適用しました。必要に応じて編集してください。');
                }
            }
            
            // 書き方ガイドモーダル表示
            async function showWritingGuide(questionId) {
                const question = hearingQuestions.find(q => q.id === questionId);
                if (!question) return;
                
                // 事業計画テンプレートからガイド情報を取得（あれば）
                let guideContent = '';
                
                try {
                    const response = await axios.get(\`/api/business-plan-templates/\${currentSubsidyTypeId || 1}\`);
                    const templates = response.data;
                    const matchingTemplate = templates.find(t => t.section_key === question.document_section);
                    
                    if (matchingTemplate) {
                        guideContent = \`
                            <div class="space-y-4">
                                \${matchingTemplate.writing_guide ? \`
                                    <div class="bg-blue-50 p-4 rounded-lg">
                                        <h4 class="font-bold text-blue-700 mb-2"><i class="fas fa-pen mr-1"></i>書き方のポイント</h4>
                                        <div class="text-sm text-blue-800 whitespace-pre-wrap">\${matchingTemplate.writing_guide}</div>
                                    </div>
                                \` : ''}
                                
                                \${matchingTemplate.key_points && matchingTemplate.key_points.length ? \`
                                    <div class="bg-green-50 p-4 rounded-lg">
                                        <h4 class="font-bold text-green-700 mb-2"><i class="fas fa-check-circle mr-1"></i>重要ポイント</h4>
                                        <ul class="space-y-1">
                                            \${matchingTemplate.key_points.map(p => \`<li class="flex items-start gap-2 text-sm text-green-800"><i class="fas fa-check text-green-500 mt-1"></i>\${p}</li>\`).join('')}
                                        </ul>
                                    </div>
                                \` : ''}
                                
                                \${matchingTemplate.common_mistakes && matchingTemplate.common_mistakes.length ? \`
                                    <div class="bg-red-50 p-4 rounded-lg">
                                        <h4 class="font-bold text-red-700 mb-2"><i class="fas fa-exclamation-triangle mr-1"></i>よくある間違い</h4>
                                        <ul class="space-y-1">
                                            \${matchingTemplate.common_mistakes.map(m => \`<li class="flex items-start gap-2 text-sm text-red-800"><i class="fas fa-times text-red-500 mt-1"></i>\${m}</li>\`).join('')}
                                        </ul>
                                    </div>
                                \` : ''}
                                
                                \${matchingTemplate.example_text ? \`
                                    <div class="bg-gray-50 p-4 rounded-lg">
                                        <h4 class="font-bold text-gray-700 mb-2"><i class="fas fa-file-alt mr-1"></i>完成例</h4>
                                        <div class="text-sm text-gray-700 whitespace-pre-wrap border-l-4 border-gray-300 pl-3">\${matchingTemplate.example_text}</div>
                                    </div>
                                \` : ''}
                            </div>
                        \`;
                    }
                } catch (error) {
                    console.error('ガイド取得エラー:', error);
                }
                
                // フォールバック
                if (!guideContent) {
                    guideContent = \`
                        <div class="space-y-4">
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <h4 class="font-bold text-blue-700 mb-2"><i class="fas fa-pen mr-1"></i>一般的な書き方のコツ</h4>
                                <ul class="space-y-2 text-sm text-blue-800">
                                    <li class="flex items-start gap-2"><i class="fas fa-check text-blue-500 mt-1"></i>具体的な数字を入れる（○○%削減、○○時間短縮など）</li>
                                    <li class="flex items-start gap-2"><i class="fas fa-check text-blue-500 mt-1"></i>課題と解決策の因果関係を明確に</li>
                                    <li class="flex items-start gap-2"><i class="fas fa-check text-blue-500 mt-1"></i>5W1H（いつ、どこで、誰が、何を、なぜ、どのように）を意識</li>
                                    <li class="flex items-start gap-2"><i class="fas fa-check text-blue-500 mt-1"></i>専門用語は噛み砕いて説明</li>
                                </ul>
                            </div>
                            \${question.help_text ? \`
                                <div class="bg-yellow-50 p-4 rounded-lg">
                                    <h4 class="font-bold text-yellow-700 mb-2"><i class="fas fa-lightbulb mr-1"></i>この質問について</h4>
                                    <div class="text-sm text-yellow-800">\${question.help_text}</div>
                                </div>
                            \` : ''}
                        </div>
                    \`;
                }
                
                // モーダルを再利用（AI提案モーダルを流用）
                const modal = document.getElementById('aiSuggestModal');
                document.getElementById('suggestQuestionText').textContent = question.question_text;
                document.getElementById('suggestContent').innerHTML = guideContent;
                document.getElementById('suggestActions').classList.add('hidden');
                modal.querySelector('h3').innerHTML = '<i class="fas fa-book mr-2"></i>書き方ガイド';
                modal.classList.remove('hidden');
            }
            
            function updateHearingAnswer(questionId, value) {
                hearingAnswers[questionId] = value;
                updateProgress();
                // カテゴリタブの進捗も更新
                const categories = [...new Set(hearingQuestions.map(q => q.category))];
                renderCategoryTabs(categories);
            }
            
            function updateProgress() {
                // 必須質問の進捗
                const requiredQuestions = hearingQuestions.filter(q => q.is_required);
                const requiredAnswered = requiredQuestions.filter(q => hearingAnswers[q.id] && hearingAnswers[q.id].trim()).length;
                const requiredTotal = requiredQuestions.length;
                const requiredPercent = requiredTotal > 0 ? Math.round((requiredAnswered / requiredTotal) * 100) : 0;
                
                // 任意質問の進捗
                const optionalQuestions = hearingQuestions.filter(q => !q.is_required);
                const optionalAnswered = optionalQuestions.filter(q => hearingAnswers[q.id] && hearingAnswers[q.id].trim()).length;
                const optionalTotal = optionalQuestions.length;
                
                // 表示更新
                let progressText = \`必須: \${requiredAnswered}/\${requiredTotal}問\`;
                if (optionalTotal > 0) {
                    progressText += \` ｜ 任意: \${optionalAnswered}/\${optionalTotal}問\`;
                }
                document.getElementById('hearingProgress').textContent = progressText;
                document.getElementById('hearingProgressBar').style.width = \`\${requiredPercent}%\`;
                
                // 必須完了でバーの色を変更
                const progressBar = document.getElementById('hearingProgressBar');
                if (requiredPercent === 100) {
                    progressBar.classList.remove('bg-indigo-600');
                    progressBar.classList.add('bg-green-500');
                } else {
                    progressBar.classList.remove('bg-green-500');
                    progressBar.classList.add('bg-indigo-600');
                }
            }
            
            async function saveAllHearingAnswers() {
                showMessage('info', '回答を保存中...');
                
                try {
                    const answersToSave = Object.entries(hearingAnswers)
                        .filter(([_, value]) => value && value.trim())
                        .map(([questionId, answerText]) => ({
                            question_id: parseInt(questionId),
                            answer_text: answerText
                        }));
                    
                    if (answersToSave.length === 0) {
                        showMessage('error', '保存する回答がありません');
                        return;
                    }
                    
                    await axios.post(\`/api/clients/\${CLIENT_ID}/hearing-answers\`, {
                        answers: answersToSave
                    });
                    
                    showMessage('success', \`\${answersToSave.length}件の回答を保存しました！\`);
                    
                    // 質問リストを再描画して状態を更新
                    renderQuestions();
                    const categories = [...new Set(hearingQuestions.map(q => q.category))];
                    renderCategoryTabs(categories);
                } catch (error) {
                    console.error('Save error:', error);
                    showMessage('error', '回答の保存に失敗しました');
                }
            }
            
            async function autoFillWithAI() {
                // 未回答の質問があるか確認
                const unansweredQuestions = hearingQuestions.filter(q => !hearingAnswers[q.id] || !hearingAnswers[q.id].trim());
                
                if (unansweredQuestions.length === 0) {
                    showMessage('success', 'すべての質問に回答済みです！');
                    return;
                }
                
                // AIチャットで相談を促す
                const input = document.getElementById('portalAiChatInput');
                input.value = \`以下の質問について、どのように回答すればよいか教えてください：\\n\\n\${unansweredQuestions.slice(0, 3).map((q, i) => \`\${i+1}. \${q.question_text}\`).join('\\n')}\`;
                input.focus();
                
                // AIチャットセクションにスクロール
                document.getElementById('portalAiChat').scrollIntoView({ behavior: 'smooth' });
                
                showMessage('info', 'AIアシスタントに質問の回答方法を相談しましょう');
            }

            // ===============================
            // AIチャット機能
            // ===============================
            
            async function loadPortalAiChat() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/ai-chat\`);
                    const chats = response.data;
                    
                    const container = document.getElementById('portalAiChat');
                    if (chats.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center text-gray-500 py-8">
                                <i class="fas fa-robot text-4xl mb-2 text-purple-400"></i>
                                <p>こんにちは！補助金申請のお手伝いをします。</p>
                                <p class="text-sm mt-2">ご質問やお困りのことがあればお聞かせください。</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    container.innerHTML = chats.map(chat => \`
                        <div class="flex \${chat.role === 'user' ? 'justify-end' : 'justify-start'} mb-3">
                            <div class="max-w-[80%] \${chat.role === 'user' ? 'bg-green-100' : 'bg-purple-100'} rounded-lg p-3">
                                <div class="flex items-center gap-2 mb-1">
                                    <i class="fas \${chat.role === 'user' ? 'fa-user' : 'fa-robot'} text-sm \${chat.role === 'user' ? 'text-green-600' : 'text-purple-600'}"></i>
                                    <span class="text-xs font-medium">\${chat.role === 'user' ? 'あなた' : 'AIアシスタント'}</span>
                                </div>
                                <div class="text-sm whitespace-pre-wrap">\${chat.content}</div>
                            </div>
                        </div>
                    \`).join('');
                    
                    container.scrollTop = container.scrollHeight;
                } catch (error) {
                    console.error('AI chat load error:', error);
                }
            }
            
            document.getElementById('portalAiChatForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = document.getElementById('portalAiChatInput');
                const message = input.value.trim();
                if (!message) return;
                
                input.value = '';
                input.disabled = true;
                
                // ユーザーメッセージを即座に表示
                const container = document.getElementById('portalAiChat');
                container.innerHTML += \`
                    <div class="flex justify-end mb-2">
                        <div class="max-w-[85%] bg-green-100 rounded-lg px-3 py-2">
                            <div class="text-sm text-gray-700">\${message}</div>
                        </div>
                    </div>
                    <div class="flex justify-start mb-2" id="portalAiTyping">
                        <div class="bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
                            <i class="fas fa-circle-notch fa-spin text-purple-400 text-xs"></i>
                            <span class="text-xs text-purple-400 ml-1">回答中...</span>
                        </div>
                    </div>
                \`;
                container.scrollTop = container.scrollHeight;
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/ai-chat\`, {
                        message,
                        context_type: 'client_portal'
                    });
                    
                    document.getElementById('portalAiTyping').remove();
                    
                    const formattedResponse = formatAIResponse(response.data.response);
                    container.innerHTML += \`
                        <div class="flex justify-start mb-3">
                            <div class="max-w-[85%] bg-purple-50 rounded-lg p-3 border border-purple-100">
                                <div class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">\${formattedResponse}</div>
                            </div>
                        </div>
                    \`;
                    container.scrollTop = container.scrollHeight;
                } catch (error) {
                    document.getElementById('portalAiTyping')?.remove();
                    showMessage('error', 'AI応答の取得に失敗しました');
                }
                
                input.disabled = false;
                input.focus();
            });

            // ===============================
            // モーダル関連
            // ===============================
            
            // AIアシスタントモーダル
            function openAiModal() {
                document.getElementById('aiModal').classList.remove('hidden');
                document.getElementById('portalAiChatInput').focus();
            }
            
            function closeAiModal() {
                document.getElementById('aiModal').classList.add('hidden');
            }
            
            // AI提案モーダル
            let currentSuggestQuestionId = null;
            let currentSuggestion = '';
            
            function openAiSuggestModal(questionId) {
                currentSuggestQuestionId = questionId;
                const question = hearingQuestions.find(q => q.id === questionId);
                
                document.getElementById('suggestQuestionText').textContent = question.question_text;
                document.getElementById('suggestContent').innerHTML = \`
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <p>AIが回答を考えています...</p>
                    </div>
                \`;
                document.getElementById('suggestActions').classList.add('hidden');
                document.getElementById('aiSuggestModal').classList.remove('hidden');
                
                generateSuggestion(questionId);
            }
            
            function closeAiSuggestModal() {
                document.getElementById('aiSuggestModal').classList.add('hidden');
            }
            
            async function generateSuggestion(questionId) {
                const question = hearingQuestions.find(q => q.id === questionId);
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/ai-suggest\`, {
                        question_id: questionId,
                        question_text: question.question_text
                    });
                    
                    currentSuggestion = formatAIResponse(response.data.suggestion);
                    
                    document.getElementById('suggestContent').innerHTML = \`
                        <div class="bg-purple-50 rounded-lg p-4 border border-purple-100">
                            <div class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">\${currentSuggestion}</div>
                        </div>
                    \`;
                    document.getElementById('suggestActions').classList.remove('hidden');
                } catch (error) {
                    document.getElementById('suggestContent').innerHTML = \`
                        <div class="text-center py-8 text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>提案の取得に失敗しました</p>
                        </div>
                    \`;
                }
            }
            
            function regenerateSuggestion() {
                document.getElementById('suggestContent').innerHTML = \`
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <p>別の回答を考えています...</p>
                    </div>
                \`;
                document.getElementById('suggestActions').classList.add('hidden');
                generateSuggestion(currentSuggestQuestionId);
            }
            
            function applySuggestion() {
                if (currentSuggestQuestionId && currentSuggestion) {
                    const textarea = document.getElementById(\`answer-\${currentSuggestQuestionId}\`);
                    if (textarea) {
                        textarea.value = currentSuggestion;
                        updateHearingAnswer(currentSuggestQuestionId, currentSuggestion);
                    }
                    closeAiSuggestModal();
                    showMessage('success', '回答を入力しました');
                }
            }
            
            // テンプレートモーダル
            let currentTemplateQuestionId = null;
            
            // 質問キーに基づくテンプレート辞書（各質問専用）
            const questionTemplates = {
                // ===== IT導入補助金 =====
                'company_overview': [
                    '当社は【業種】を営む企業で、創業【年数】目になります。主に【製品・サービス名】を提供しており、【地域・顧客層】のお客様を中心に事業を展開しております。',
                    '弊社は【商品・サービス】の製造・販売を主な事業としております。【技術・特徴】を強みとし、創業以来お客様との信頼関係を大切にしてまいりました。',
                    '【業種】として【年数】年の実績があります。【主力事業】を中心に、地域密着型の経営を続けてまいりました。',
                ],
                'employee_count': ['10', '25', '50', '100'],
                'annual_revenue': ['5000', '10000', '30000', '50000'],
                'current_issues': [
                    '現在、受発注業務が手作業のため、FAXや電話での注文対応に多くの時間を要しています。転記ミスや確認漏れが頻発し、顧客からのクレームにつながるケースもあります。',
                    '在庫管理が属人的で、Excelで管理しているため在庫の過不足が発生しがちです。棚卸しにも多大な時間がかかり、業務効率が悪い状態です。',
                    '顧客情報が各営業担当者の手元で管理されており、情報共有ができていません。担当者不在時の対応が困難で、顧客満足度の低下を招いています。',
                    '経理業務が紙ベースで、請求書作成や入金確認に多くの時間を費やしています。月末月初は残業が常態化しています。',
                    '生産現場の進捗管理ができておらず、納期遅延が発生しています。工程間の情報連携が不十分で、手待ち時間が多く発生しています。',
                ],
                'issue_impact': [
                    '月に約20時間の残業が発生しており、年間で約50万円の人件費増となっています。また、ミスによる再作業やクレーム対応で本来の業務に集中できない状況です。',
                    '在庫過多による保管コスト年間約100万円、欠品による機会損失が年間約200万円と試算しています。',
                    '顧客対応の遅れにより、年間5件程度の失注が発生していると推測されます。既存顧客の離反も懸念されます。',
                    '経理担当者の月末残業が平均40時間を超えており、負担が大きい状態です。',
                ],
                'target_it_tool': ['受発注システム', '会計・財務システム', '顧客管理(CRM)', '在庫管理システム', 'テレワーク関連'],
                'expected_effect': [
                    '受発注業務の自動化により、月20時間の残業削減と転記ミスゼロを目指します。年間50万円以上のコスト削減効果を見込んでいます。',
                    'システム導入により在庫の適正化を図り、保管コスト30%削減、欠品率50%減を目標としています。',
                    '顧客情報の一元管理により、対応スピードを50%向上させ、顧客満足度の改善と売上10%増を目指します。',
                    '経理業務のデジタル化により、処理時間を60%短縮し、月末の残業を解消することを目標としています。',
                ],
                'implementation_schedule': [
                    '来年3月までに本稼働させたいと考えています。',
                    '補助金交付決定後、3ヶ月以内での導入完了を希望します。',
                    '繁忙期を避け、閑散期での段階的な導入を希望します。',
                ],
                'future_vision': [
                    '3年後には売上を現在の1.5倍に、5年後には2倍に成長させることを目標としています。そのために業務効率化を進め、従業員がより付加価値の高い業務に集中できる環境を整えます。',
                    'デジタル化を推進し、生産性を30%向上させます。浮いた時間とリソースで新規顧客開拓に注力し、20社の新規取引先獲得を目指します。',
                    '業務効率化で余力を生み出し、新たな事業領域への参入を計画しています。既存の強みを活かしながら、事業の多角化を図ります。',
                ],
                // ===== ものづくり補助金 =====
                'company_strength': [
                    '当社の強みは【分野】における【年数】年の経験と実績です。特に【技術・ノウハウ】については、地域でもトップクラスの品質を誇っております。',
                    '独自開発の【技術名】により、競合他社では対応が難しい【製品・加工】が可能です。',
                    '大手メーカーとの長年の取引実績があり、品質管理体制と納期遵守率の高さが評価されています。',
                ],
                'innovation_content': [
                    '本事業では、AI/IoTを活用した検査システムの導入により、これまで熟練者の経験に頼っていた品質検査を自動化・高精度化します。',
                    '新たに【設備・技術】を導入し、従来は対応できなかった【製品・加工】の製造を可能にします。これにより新規市場への参入が実現します。',
                    '最新の生産設備を導入し、生産性を大幅に向上させるとともに、品質のばらつきを低減します。',
                ],
                'technical_challenge': [
                    '【工程】における【課題】の検出・制御が技術的課題です。解決策として、AI画像認識技術を導入し、リアルタイムでの自動判定を実現します。',
                    '現状、手作業で行っている工程でミスが発生しています。新たに自動化設備を導入することで、この課題を克服します。',
                ],
                'equipment_detail': [
                    '【メーカー名】製 【機械・システム名】 Model【型番】 処理能力：【仕様】 精度：【仕様】',
                    '【システム名】一式 ・【機器1】：【仕様】 ・【機器2】：【仕様】',
                ],
                'investment_amount': ['1500', '3500', '5000', '8000'],
                'productivity_improvement': [
                    '付加価値額を年間1,000万円増加させ、従業員一人当たりの付加価値額を15%向上させます。',
                    '生産性を3年間で10%向上させ、事業計画期間内に給与を3%引き上げます。',
                ],
                'market_expansion': [
                    '品質保証体制の強化により、医療機器/航空宇宙/自動車市場への参入を目指します。',
                    '新技術を活かし、新規分野の顧客を開拓します。展示会出展や営業活動により、10社の新規顧客獲得を目標としています。',
                ],
            };
            
            // キーワードベースのフォールバック
            const keywordTemplates = {
                'ビジョン': ['将来的には業界のリーディングカンパニーを目指し、地域社会への貢献を両立させていきます。'],
                '将来': ['3年後には現在の売上高を増加させ、新規顧客を獲得することを目標としています。'],
                '事業内容': ['当社は【業種】において、【サービス】を提供しております。創業以来【年数】年にわたり事業を展開してまいりました。'],
                '課題': ['現在、【課題内容】の面で課題を抱えており、業務効率化が必要な状況です。'],
                '効果': ['本事業の実施により、業務効率が向上し、コスト削減が見込まれます。'],
                'default': ['具体的な内容についてご記入ください。']
            };
            
            function openTemplateModal(questionId) {
                currentTemplateQuestionId = questionId;
                const question = hearingQuestions.find(q => q.id === questionId);
                
                document.getElementById('templateQuestionText').textContent = question.question_text;
                
                // まずquestion_keyで直接マッチを試みる
                let templates = questionTemplates[question.question_key] || [];
                
                // マッチしない場合はキーワードベースで検索
                if (templates.length === 0) {
                    const searchText = question.question_text + ' ' + (question.category || '');
                    for (const [keyword, temps] of Object.entries(keywordTemplates)) {
                        if (keyword !== 'default' && searchText.includes(keyword)) {
                            templates = templates.concat(temps);
                        }
                    }
                }
                
                // それでもマッチしない場合はデフォルト
                if (templates.length === 0) {
                    templates = keywordTemplates['default'];
                }
                
                // 重複を除去
                templates = [...new Set(templates)];
                
                document.getElementById('templateList').innerHTML = templates.map((template, i) => \`
                    <button onclick="applyTemplate(\${i})" 
                            class="w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
                        <div class="text-sm text-gray-700 whitespace-pre-wrap">\${template}</div>
                    </button>
                \`).join('');
                
                // グローバルに保存
                window.currentTemplates = templates;
                
                document.getElementById('templateModal').classList.remove('hidden');
            }
            
            function openTemplateModal(questionId) {
                currentTemplateQuestionId = questionId;
                const question = hearingQuestions.find(q => q.id === questionId);
                
                document.getElementById('templateQuestionText').textContent = question.question_text;
                
                // 質問キーで直接テンプレートを取得
                let templates = questionTemplates[question.question_key] || [];
                
                // テンプレートがない場合はデフォルト
                if (templates.length === 0) {
                    templates = questionTemplates['default'] || [];
                }
                
                // example_answerがあれば先頭に追加
                if (question.example_answer && templates.indexOf(question.example_answer) === -1) {
                    templates = [question.example_answer].concat(templates);
                }
                
                // 最大5件に制限
                templates = templates.slice(0, 5);
                
                if (templates.length === 0) {
                    document.getElementById('templateList').innerHTML = '<div class="text-center text-gray-500 py-4">この質問用のテンプレートはありません</div>';
                } else {
                    document.getElementById('templateList').innerHTML = templates.map(function(template, i) {
                        return '<button onclick="applyTemplate(' + i + ')" class="w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">' +
                            '<div class="text-sm text-gray-700">' + template + '</div>' +
                        '</button>';
                    }).join('');
                }
                
                // グローバルに保存
                window.currentTemplates = templates;
                
                document.getElementById('templateModal').classList.remove('hidden');
            }
            
            function closeTemplateModal() {
                document.getElementById('templateModal').classList.add('hidden');
            }
            
            function applyTemplate(index) {
                if (currentTemplateQuestionId && window.currentTemplates) {
                    const template = window.currentTemplates[index];
                    const input = document.getElementById('answer-' + currentTemplateQuestionId);
                    if (input) {
                        input.value = template;
                        updateHearingAnswer(currentTemplateQuestionId, template);
                    }
                    closeTemplateModal();
                    showMessage('success', 'テンプレートを適用しました');
                }
            }
            
            // ===============================
            // 書類データ入力機能
            // ===============================
            
            let currentDataInputType = null;
            let currentDataInputDocType = null;
            
            function showDataInputModal(type, docType) {
                currentDataInputType = type;
                currentDataInputDocType = docType;
                
                const modal = document.getElementById('dataInputModal');
                const title = document.getElementById('dataInputTitle');
                const content = document.getElementById('dataInputContent');
                
                let titleText = '';
                let formHtml = '';
                
                if (type === 'registry') {
                    titleText = '<i class="fas fa-building mr-2"></i>登記簿謄本 データ入力';
                    formHtml = \`
                        <div class="space-y-4">
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                <p class="text-sm text-yellow-800"><i class="fas fa-lightbulb mr-1"></i>登記簿謄本に記載されている内容を入力してください</p>
                            </div>
                            
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="sm:col-span-2">
                                    <label class="block text-sm font-medium mb-1">会社名（商号）<span class="text-red-500">*</span></label>
                                    <input type="text" id="reg_company_name" class="w-full px-3 py-2 border rounded-lg" placeholder="株式会社〇〇">
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="block text-sm font-medium mb-1">本店所在地<span class="text-red-500">*</span></label>
                                    <input type="text" id="reg_address" class="w-full px-3 py-2 border rounded-lg" placeholder="東京都〇〇区〇〇1-1-1">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">設立年月日</label>
                                    <input type="date" id="reg_establishment" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">資本金（円）</label>
                                    <input type="number" id="reg_capital" class="w-full px-3 py-2 border rounded-lg" placeholder="10000000">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">代表者名<span class="text-red-500">*</span></label>
                                    <input type="text" id="reg_representative" class="w-full px-3 py-2 border rounded-lg" placeholder="山田 太郎">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">代表者役職</label>
                                    <input type="text" id="reg_rep_title" class="w-full px-3 py-2 border rounded-lg" placeholder="代表取締役" value="代表取締役">
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="block text-sm font-medium mb-1">法人番号（13桁）</label>
                                    <input type="text" id="reg_corporate_number" class="w-full px-3 py-2 border rounded-lg" placeholder="1234567890123" maxlength="13">
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="block text-sm font-medium mb-1">事業目的（主なもの）</label>
                                    <textarea id="reg_business_purpose" rows="3" class="w-full px-3 py-2 border rounded-lg" placeholder="1. ソフトウェアの開発及び販売&#10;2. ITコンサルティング&#10;3. 前各号に附帯する一切の事業"></textarea>
                                </div>
                            </div>
                        </div>
                    \`;
                } else if (type === 'financial') {
                    titleText = '<i class="fas fa-file-invoice-dollar mr-2"></i>財務諸表 データ入力';
                    formHtml = \`
                        <div class="space-y-4">
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                <p class="text-sm text-yellow-800"><i class="fas fa-lightbulb mr-1"></i>決算書（損益計算書・貸借対照表）の主要項目を入力してください</p>
                            </div>
                            
                            <div class="border-b pb-2 mb-4">
                                <h4 class="font-bold text-blue-600"><i class="fas fa-calendar mr-1"></i>決算期情報</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">決算期<span class="text-red-500">*</span></label>
                                    <input type="text" id="fin_fiscal_year" class="w-full px-3 py-2 border rounded-lg" placeholder="2024年3月期">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">従業員数</label>
                                    <input type="number" id="fin_employee_count" class="w-full px-3 py-2 border rounded-lg" placeholder="25">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-green-600"><i class="fas fa-chart-line mr-1"></i>損益計算書（PL）</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">売上高（円）<span class="text-red-500">*</span></label>
                                    <input type="number" id="fin_revenue" class="w-full px-3 py-2 border rounded-lg" placeholder="100000000">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">売上原価（円）</label>
                                    <input type="number" id="fin_cost_of_sales" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">売上総利益（円）</label>
                                    <input type="number" id="fin_gross_profit" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">販売費及び一般管理費（円）</label>
                                    <input type="number" id="fin_selling_admin" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">営業利益（円）<span class="text-red-500">*</span></label>
                                    <input type="number" id="fin_operating_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">経常利益（円）</label>
                                    <input type="number" id="fin_ordinary_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">当期純利益（円）</label>
                                    <input type="number" id="fin_net_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-orange-600"><i class="fas fa-coins mr-1"></i>販管費内訳（補助金申請で重要）</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">人件費（円）<span class="text-red-500">*</span></label>
                                    <input type="number" id="fin_personnel" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">減価償却費（円）<span class="text-red-500">*</span></label>
                                    <input type="number" id="fin_depreciation" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">地代家賃（円）</label>
                                    <input type="number" id="fin_rent" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">研究開発費（円）</label>
                                    <input type="number" id="fin_rd" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-purple-600"><i class="fas fa-balance-scale mr-1"></i>貸借対照表（BS）</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">総資産（円）</label>
                                    <input type="number" id="fin_total_assets" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">流動資産（円）</label>
                                    <input type="number" id="fin_current_assets" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">負債合計（円）</label>
                                    <input type="number" id="fin_total_liabilities" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">流動負債（円）</label>
                                    <input type="number" id="fin_current_liabilities" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">純資産（円）</label>
                                    <input type="number" id="fin_net_assets" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">資本金（円）</label>
                                    <input type="number" id="fin_capital_stock" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                        </div>
                    \`;
                } else if (type === 'tax_return') {
                    titleText = '<i class="fas fa-file-alt mr-2"></i>確定申告書 データ入力';
                    formHtml = \`
                        <div class="space-y-4">
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                <p class="text-sm text-yellow-800"><i class="fas fa-lightbulb mr-1"></i>確定申告書（青色申告決算書）の内容を入力してください（個人事業主向け）</p>
                            </div>
                            
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">申告年度<span class="text-red-500">*</span></label>
                                    <input type="text" id="tax_year" class="w-full px-3 py-2 border rounded-lg" placeholder="令和5年分">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">従業員数（専従者含む）</label>
                                    <input type="number" id="tax_employee_count" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-green-600"><i class="fas fa-yen-sign mr-1"></i>収入金額</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">事業所得（営業等）<span class="text-red-500">*</span></label>
                                    <input type="number" id="tax_business_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">合計所得金額</label>
                                    <input type="number" id="tax_total_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-orange-600"><i class="fas fa-receipt mr-1"></i>必要経費</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">必要経費合計</label>
                                    <input type="number" id="tax_total_expenses" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">給料賃金</label>
                                    <input type="number" id="tax_salary_wages" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">減価償却費</label>
                                    <input type="number" id="tax_depreciation" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">地代家賃</label>
                                    <input type="number" id="tax_rent" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-blue-600"><i class="fas fa-calculator mr-1"></i>所得・税額</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">課税所得金額</label>
                                    <input type="number" id="tax_taxable_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">青色申告特別控除額</label>
                                    <input type="number" id="tax_blue_deduction" class="w-full px-3 py-2 border rounded-lg" placeholder="650000">
                                </div>
                            </div>
                        </div>
                    \`;
                }
                
                title.innerHTML = titleText;
                content.innerHTML = formHtml;
                modal.classList.remove('hidden');
                
                // 既存データがあれば読み込む
                loadExistingData(type);
            }
            
            async function loadExistingData(type) {
                try {
                    if (type === 'registry') {
                        const response = await axios.get(\`/api/clients/\${CLIENT_ID}/registry-data\`);
                        if (response.data) {
                            const d = response.data;
                            if (d.company_name) document.getElementById('reg_company_name').value = d.company_name;
                            if (d.head_office_address) document.getElementById('reg_address').value = d.head_office_address;
                            if (d.establishment_date) document.getElementById('reg_establishment').value = d.establishment_date;
                            if (d.capital_amount) document.getElementById('reg_capital').value = d.capital_amount;
                            if (d.representative_name) document.getElementById('reg_representative').value = d.representative_name;
                            if (d.representative_title) document.getElementById('reg_rep_title').value = d.representative_title;
                            if (d.corporate_number) document.getElementById('reg_corporate_number').value = d.corporate_number;
                            if (d.business_purpose && d.business_purpose.length) {
                                document.getElementById('reg_business_purpose').value = d.business_purpose.join('\\n');
                            }
                        }
                    } else if (type === 'financial') {
                        const response = await axios.get(\`/api/clients/\${CLIENT_ID}/financial-statements\`);
                        if (response.data && response.data.length > 0) {
                            const d = response.data[0];
                            if (d.fiscal_year) document.getElementById('fin_fiscal_year').value = d.fiscal_year;
                            if (d.employee_count) document.getElementById('fin_employee_count').value = d.employee_count;
                            if (d.revenue) document.getElementById('fin_revenue').value = d.revenue;
                            if (d.cost_of_sales) document.getElementById('fin_cost_of_sales').value = d.cost_of_sales;
                            if (d.gross_profit) document.getElementById('fin_gross_profit').value = d.gross_profit;
                            if (d.selling_admin_expenses) document.getElementById('fin_selling_admin').value = d.selling_admin_expenses;
                            if (d.operating_income) document.getElementById('fin_operating_income').value = d.operating_income;
                            if (d.ordinary_income) document.getElementById('fin_ordinary_income').value = d.ordinary_income;
                            if (d.net_income) document.getElementById('fin_net_income').value = d.net_income;
                            if (d.personnel_expenses) document.getElementById('fin_personnel').value = d.personnel_expenses;
                            if (d.depreciation) document.getElementById('fin_depreciation').value = d.depreciation;
                            if (d.rent_expenses) document.getElementById('fin_rent').value = d.rent_expenses;
                            if (d.rd_expenses) document.getElementById('fin_rd').value = d.rd_expenses;
                            if (d.total_assets) document.getElementById('fin_total_assets').value = d.total_assets;
                            if (d.current_assets) document.getElementById('fin_current_assets').value = d.current_assets;
                            if (d.total_liabilities) document.getElementById('fin_total_liabilities').value = d.total_liabilities;
                            if (d.current_liabilities) document.getElementById('fin_current_liabilities').value = d.current_liabilities;
                            if (d.total_net_assets) document.getElementById('fin_net_assets').value = d.total_net_assets;
                            if (d.capital_stock) document.getElementById('fin_capital_stock').value = d.capital_stock;
                        }
                    } else if (type === 'tax_return') {
                        const response = await axios.get(\`/api/clients/\${CLIENT_ID}/tax-return\`);
                        if (response.data && response.data.length > 0) {
                            const d = response.data[0];
                            if (d.tax_year) document.getElementById('tax_year').value = d.tax_year;
                            if (d.employee_count) document.getElementById('tax_employee_count').value = d.employee_count;
                            if (d.business_income) document.getElementById('tax_business_income').value = d.business_income;
                            if (d.total_income) document.getElementById('tax_total_income').value = d.total_income;
                            if (d.total_expenses) document.getElementById('tax_total_expenses').value = d.total_expenses;
                            if (d.salary_wages) document.getElementById('tax_salary_wages').value = d.salary_wages;
                            if (d.depreciation_expense) document.getElementById('tax_depreciation').value = d.depreciation_expense;
                            if (d.rent_cost) document.getElementById('tax_rent').value = d.rent_cost;
                            if (d.taxable_income) document.getElementById('tax_taxable_income').value = d.taxable_income;
                            if (d.blue_return_deduction) document.getElementById('tax_blue_deduction').value = d.blue_return_deduction;
                        }
                    }
                } catch (error) {
                    console.error('既存データ読み込みエラー:', error);
                }
            }
            
            function closeDataInputModal() {
                document.getElementById('dataInputModal').classList.add('hidden');
                currentDataInputType = null;
                currentDataInputDocType = null;
            }
            
            async function saveDataInput() {
                try {
                    let data = {};
                    let endpoint = '';
                    
                    if (currentDataInputType === 'registry') {
                        data = {
                            company_name: document.getElementById('reg_company_name').value,
                            head_office_address: document.getElementById('reg_address').value,
                            establishment_date: document.getElementById('reg_establishment').value,
                            capital_amount: parseInt(document.getElementById('reg_capital').value) || null,
                            representative_name: document.getElementById('reg_representative').value,
                            representative_title: document.getElementById('reg_rep_title').value,
                            corporate_number: document.getElementById('reg_corporate_number').value,
                            business_purpose: document.getElementById('reg_business_purpose').value.split('\\n').filter(s => s.trim()),
                            verified: true
                        };
                        endpoint = \`/api/clients/\${CLIENT_ID}/registry-data\`;
                    } else if (currentDataInputType === 'financial') {
                        data = {
                            fiscal_year: document.getElementById('fin_fiscal_year').value,
                            employee_count: parseInt(document.getElementById('fin_employee_count').value) || null,
                            revenue: parseInt(document.getElementById('fin_revenue').value) || null,
                            cost_of_sales: parseInt(document.getElementById('fin_cost_of_sales').value) || null,
                            gross_profit: parseInt(document.getElementById('fin_gross_profit').value) || null,
                            selling_admin_expenses: parseInt(document.getElementById('fin_selling_admin').value) || null,
                            operating_income: parseInt(document.getElementById('fin_operating_income').value) || null,
                            ordinary_income: parseInt(document.getElementById('fin_ordinary_income').value) || null,
                            net_income: parseInt(document.getElementById('fin_net_income').value) || null,
                            personnel_expenses: parseInt(document.getElementById('fin_personnel').value) || null,
                            depreciation: parseInt(document.getElementById('fin_depreciation').value) || null,
                            rent_expenses: parseInt(document.getElementById('fin_rent').value) || null,
                            rd_expenses: parseInt(document.getElementById('fin_rd').value) || null,
                            total_assets: parseInt(document.getElementById('fin_total_assets').value) || null,
                            current_assets: parseInt(document.getElementById('fin_current_assets').value) || null,
                            total_liabilities: parseInt(document.getElementById('fin_total_liabilities').value) || null,
                            current_liabilities: parseInt(document.getElementById('fin_current_liabilities').value) || null,
                            total_net_assets: parseInt(document.getElementById('fin_net_assets').value) || null,
                            capital_stock: parseInt(document.getElementById('fin_capital_stock').value) || null,
                            verified: true
                        };
                        endpoint = \`/api/clients/\${CLIENT_ID}/financial-statements\`;
                    } else if (currentDataInputType === 'tax_return') {
                        data = {
                            tax_year: document.getElementById('tax_year').value,
                            employee_count: parseInt(document.getElementById('tax_employee_count').value) || null,
                            business_income: parseInt(document.getElementById('tax_business_income').value) || null,
                            total_income: parseInt(document.getElementById('tax_total_income').value) || null,
                            total_expenses: parseInt(document.getElementById('tax_total_expenses').value) || null,
                            salary_wages: parseInt(document.getElementById('tax_salary_wages').value) || null,
                            depreciation_expense: parseInt(document.getElementById('tax_depreciation').value) || null,
                            rent_cost: parseInt(document.getElementById('tax_rent').value) || null,
                            taxable_income: parseInt(document.getElementById('tax_taxable_income').value) || null,
                            blue_return_deduction: parseInt(document.getElementById('tax_blue_deduction').value) || null,
                            verified: true
                        };
                        endpoint = \`/api/clients/\${CLIENT_ID}/tax-return\`;
                    }
                    
                    const response = await axios.post(endpoint, data);
                    
                    if (response.data.success) {
                        showMessage('success', 'データを保存しました！');
                        closeDataInputModal();
                        
                        // 財務諸表の場合は財務指標を表示
                        if (currentDataInputType === 'financial') {
                            setTimeout(() => showFinancialIndicators(), 500);
                        }
                    }
                } catch (error) {
                    console.error('データ保存エラー:', error);
                    showMessage('error', 'データの保存に失敗しました');
                }
            }
            
            async function showFinancialIndicators() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/financial-indicators\`);
                    const indicators = response.data;
                    
                    if (!indicators || indicators.length === 0) {
                        return;
                    }
                    
                    const latest = indicators[0];
                    const modal = document.getElementById('financialIndicatorsModal');
                    const content = document.getElementById('financialIndicatorsContent');
                    
                    const formatNumber = (num) => {
                        if (num === null || num === undefined) return '-';
                        return num.toLocaleString();
                    };
                    
                    const formatPercent = (num) => {
                        if (num === null || num === undefined) return '-';
                        return (num * 100).toFixed(1) + '%';
                    };
                    
                    content.innerHTML = \`
                        <div class="space-y-4">
                            <div class="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-4 border border-green-200">
                                <h4 class="font-bold text-green-700 mb-3"><i class="fas fa-star mr-1"></i>補助金申請で重要な指標</h4>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="bg-white rounded-lg p-3 text-center">
                                        <div class="text-xs text-gray-500 mb-1">労働生産性</div>
                                        <div class="text-xl font-bold text-green-600">\${formatNumber(latest.labor_productivity)}円</div>
                                        <div class="text-xs text-gray-400">従業員1人あたり</div>
                                    </div>
                                    <div class="bg-white rounded-lg p-3 text-center">
                                        <div class="text-xs text-gray-500 mb-1">付加価値額</div>
                                        <div class="text-xl font-bold text-teal-600">\${formatNumber(latest.added_value)}円</div>
                                        <div class="text-xs text-gray-400">営業利益+人件費+減価償却</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <h4 class="font-bold text-blue-700 mb-3"><i class="fas fa-chart-pie mr-1"></i>収益性指標</h4>
                                <div class="grid grid-cols-2 gap-3 text-sm">
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">売上総利益率</span>
                                        <span class="font-medium">\${formatPercent(latest.gross_profit_margin)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">営業利益率</span>
                                        <span class="font-medium">\${formatPercent(latest.operating_profit_margin)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">経常利益率</span>
                                        <span class="font-medium">\${formatPercent(latest.ordinary_profit_margin)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">当期純利益率</span>
                                        <span class="font-medium">\${formatPercent(latest.net_profit_margin)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                <h4 class="font-bold text-purple-700 mb-3"><i class="fas fa-shield-alt mr-1"></i>安全性指標</h4>
                                <div class="grid grid-cols-2 gap-3 text-sm">
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">自己資本比率</span>
                                        <span class="font-medium">\${formatPercent(latest.equity_ratio)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">流動比率</span>
                                        <span class="font-medium">\${formatPercent(latest.current_ratio)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">ROE</span>
                                        <span class="font-medium">\${formatPercent(latest.roe)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">ROA</span>
                                        <span class="font-medium">\${formatPercent(latest.roa)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="text-xs text-gray-500 text-center mt-4">
                                <i class="fas fa-info-circle mr-1"></i>
                                これらの指標は入力された財務データから自動計算されました
                            </div>
                        </div>
                    \`;
                    
                    modal.classList.remove('hidden');
                } catch (error) {
                    console.error('財務指標取得エラー:', error);
                }
            }
            
            function closeFinancialIndicatorsModal() {
                document.getElementById('financialIndicatorsModal').classList.add('hidden');
            }
            
            // ===============================
            // 新規申込機能
            // ===============================
            
            async function openNewApplicationModal() {
                // 補助金種別を読み込む
                try {
                    const response = await axios.get('/api/subsidy-types');
                    const subsidyTypes = response.data;
                    
                    const select = document.getElementById('applicationSubsidyType');
                    select.innerHTML = '<option value="">選択してください</option>';
                    
                    // カテゴリでグループ化
                    const grouped = {};
                    subsidyTypes.forEach(type => {
                        const cat = type.category || 'その他';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(type);
                    });
                    
                    Object.entries(grouped).forEach(([category, types]) => {
                        const optgroup = document.createElement('optgroup');
                        optgroup.label = category;
                        types.forEach(type => {
                            const option = document.createElement('option');
                            option.value = type.id;
                            option.textContent = type.name;
                            optgroup.appendChild(option);
                        });
                        select.appendChild(optgroup);
                    });
                    
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
                
                document.getElementById('newApplicationModal').classList.remove('hidden');
            }
            
            function closeNewApplicationModal() {
                document.getElementById('newApplicationModal').classList.add('hidden');
                document.getElementById('newApplicationForm').reset();
            }
            
            async function submitNewApplication() {
                const form = document.getElementById('newApplicationForm');
                const formData = new FormData(form);
                
                const subsidyTypeId = formData.get('subsidy_type_id');
                const notes = formData.get('notes');
                const privacyAgreed = form.querySelector('[name="privacy_agreed"]').checked;
                
                if (!subsidyTypeId) {
                    showMessage('error', '補助金・助成金を選択してください');
                    return;
                }
                
                if (!privacyAgreed) {
                    showMessage('error', 'プライバシーポリシーに同意してください');
                    return;
                }
                
                try {
                    // 新規申込として通信を送信
                    await axios.post(\`/api/clients/\${CLIENT_ID}/communications\`, {
                        message: \`【新規申込希望】補助金ID: \${subsidyTypeId}\\n相談内容: \${notes || 'なし'}\\nプライバシーポリシー同意: 済\`,
                        sender_type: 'client',
                        sender_name: '${client.name}'
                    });
                    
                    showMessage('success', '新規申込を送信しました。担当者からご連絡いたします。');
                    closeNewApplicationModal();
                    loadCommunications();
                } catch (error) {
                    console.error('Error submitting application:', error);
                    showMessage('error', '申込の送信に失敗しました。');
                }
            }
            
            // ===============================
            // 初期化
            // ===============================
            
            loadStatus();
            loadAnnouncements();
            loadPipelineProgress();
            loadDepositInfo();
            loadHearingQuestions();
            loadChecklist();
            loadDocuments();
            loadCommunications();
            loadPortalAiChat();
        </script>
    </body>
    </html>
  `)
})

// ===============================
// 従業員管理画面
// ===============================

app.get('/admin/users', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>従業員管理 - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <!-- ヘッダー -->
            <header class="bg-green-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <div class="flex items-center justify-between">
                        <h1 class="text-2xl font-bold">
                            <i class="fas fa-users-cog mr-2"></i>
                            従業員管理
                        </h1>
                        <div class="flex items-center gap-4">
                            <a href="/" class="hover:underline">
                                <i class="fas fa-arrow-left mr-1"></i>
                                トップに戻る
                            </a>
                            <button onclick="logout()" class="hover:underline">
                                <i class="fas fa-sign-out-alt mr-1"></i>
                                ログアウト
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <!-- メインコンテンツ -->
            <div class="container mx-auto px-4 py-8">
                <!-- アクションボタン -->
                <div class="mb-6">
                    <button onclick="openAddUserModal()" 
                            class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">
                        <i class="fas fa-user-plus mr-2"></i>
                        新規従業員追加
                    </button>
                </div>

                <!-- 従業員一覧 -->
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-gray-50 border-b">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ユーザー名</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">表示名</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">登録日</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody id="usersList" class="divide-y divide-gray-200">
                            <tr>
                                <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                    <div>読み込み中...</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 新規追加モーダル -->
        <div id="addUserModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-8 max-w-md w-full">
                <h3 class="text-xl font-bold mb-4">新規従業員追加</h3>
                <form id="addUserForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">ユーザー名 *</label>
                        <input type="text" name="username" required 
                               class="w-full px-3 py-2 border rounded-lg"
                               placeholder="半角英数字">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">パスワード *</label>
                        <input type="password" name="password" required 
                               class="w-full px-3 py-2 border rounded-lg"
                               placeholder="8文字以上推奨">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">表示名 *</label>
                        <input type="text" name="name" required 
                               class="w-full px-3 py-2 border rounded-lg"
                               placeholder="山田太郎">
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" 
                                class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                            追加
                        </button>
                        <button type="button" onclick="closeAddUserModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 編集モーダル -->
        <div id="editUserModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-8 max-w-md w-full">
                <h3 class="text-xl font-bold mb-4">従業員情報編集</h3>
                <form id="editUserForm" class="space-y-4">
                    <input type="hidden" name="id">
                    <div>
                        <label class="block text-sm font-medium mb-1">ユーザー名 *</label>
                        <input type="text" name="username" required 
                               class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">パスワード</label>
                        <input type="password" name="password" 
                               class="w-full px-3 py-2 border rounded-lg"
                               placeholder="変更しない場合は空欄">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">表示名 *</label>
                        <input type="text" name="name" required 
                               class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" 
                                class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                            更新
                        </button>
                        <button type="button" onclick="closeEditUserModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- トースト通知 -->
        <div id="toast" class="hidden fixed top-4 right-4 z-50"></div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // 認証チェック
            if (!localStorage.getItem('admin_token')) {
                window.location.href = '/login';
            }

            // トースト表示
            function showToast(message, type = 'success') {
                const toast = document.getElementById('toast');
                const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
                toast.innerHTML = \`
                    <div class="\${bgColor} text-white px-6 py-3 rounded-lg shadow-lg">
                        <i class="fas fa-\${type === 'success' ? 'check-circle' : 'exclamation-circle'} mr-2"></i>
                        \${message}
                    </div>
                \`;
                toast.classList.remove('hidden');
                setTimeout(() => toast.classList.add('hidden'), 3000);
            }

            // ログアウト
            function logout() {
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_name');
                window.location.href = '/login';
            }

            // モーダル操作
            function openAddUserModal() {
                document.getElementById('addUserModal').classList.remove('hidden');
            }

            function closeAddUserModal() {
                document.getElementById('addUserModal').classList.add('hidden');
                document.getElementById('addUserForm').reset();
            }

            function openEditUserModal(user) {
                const form = document.getElementById('editUserForm');
                form.elements['id'].value = user.id;
                form.elements['username'].value = user.username;
                form.elements['name'].value = user.name;
                form.elements['password'].value = '';
                document.getElementById('editUserModal').classList.remove('hidden');
            }

            function closeEditUserModal() {
                document.getElementById('editUserModal').classList.add('hidden');
                document.getElementById('editUserForm').reset();
            }

            // 従業員一覧読み込み
            async function loadUsers() {
                try {
                    const response = await axios.get('/api/admin/users');
                    const users = response.data;
                    
                    const tbody = document.getElementById('usersList');
                    if (users.length === 0) {
                        tbody.innerHTML = \`
                            <tr>
                                <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                                    従業員が登録されていません
                                </td>
                            </tr>
                        \`;
                        return;
                    }
                    
                    tbody.innerHTML = users.map(user => \`
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 text-sm">\${user.id}</td>
                            <td class="px-6 py-4">
                                <div class="font-medium">\${user.username}</div>
                                \${user.id === 1 ? '<span class="text-xs text-green-600"><i class="fas fa-shield-alt mr-1"></i>メイン管理者</span>' : ''}
                            </td>
                            <td class="px-6 py-4">\${user.name}</td>
                            <td class="px-6 py-4 text-sm text-gray-500">
                                \${new Date(user.created_at).toLocaleDateString('ja-JP')}
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex gap-2">
                                    <button onclick='openEditUserModal(\${JSON.stringify(user)})' 
                                            class="text-blue-600 hover:text-blue-800">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    \${user.id !== 1 ? \`
                                        <button onclick="deleteUser(\${user.id}, '\${user.name}')" 
                                                class="text-red-600 hover:text-red-800">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    \` : ''}
                                </div>
                            </td>
                        </tr>
                    \`).join('');
                } catch (error) {
                    console.error('Failed to load users:', error);
                    showToast('従業員一覧の読み込みに失敗しました', 'error');
                }
            }

            // 従業員追加
            document.getElementById('addUserForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                try {
                    await axios.post('/api/admin/users', data);
                    showToast('従業員を追加しました');
                    closeAddUserModal();
                    loadUsers();
                } catch (error) {
                    showToast(error.response?.data?.error || '従業員の追加に失敗しました', 'error');
                }
            });

            // 従業員編集
            document.getElementById('editUserForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                const id = data.id;
                delete data.id;
                
                try {
                    await axios.put(\`/api/admin/users/\${id}\`, data);
                    showToast('従業員情報を更新しました');
                    closeEditUserModal();
                    loadUsers();
                } catch (error) {
                    showToast(error.response?.data?.error || '従業員情報の更新に失敗しました', 'error');
                }
            });

            // 従業員削除
            async function deleteUser(id, name) {
                if (!confirm(\`\${name} を削除してもよろしいですか？\nこの操作は取り消せません。\`)) {
                    return;
                }
                
                try {
                    await axios.delete(\`/api/admin/users/\${id}\`);
                    showToast('従業員を削除しました');
                    loadUsers();
                } catch (error) {
                    showToast(error.response?.data?.error || '従業員の削除に失敗しました', 'error');
                }
            }

            // 初期読み込み
            loadUsers();
        </script>
    </body>
    </html>
  `)
})

// ===============================
// API: 公募要領管理
// ===============================

// 監視URL一覧取得
app.get('/api/subsidy-watch-urls', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT w.*, s.name as subsidy_name 
    FROM subsidy_watch_urls w
    LEFT JOIN subsidy_types s ON w.subsidy_type_id = s.id
    ORDER BY w.subsidy_type_id, w.id
  `).all()
  
  return c.json(result.results)
})

// 監視URL追加
app.post('/api/subsidy-watch-urls', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO subsidy_watch_urls (subsidy_type_id, url, url_type, description)
    VALUES (?, ?, ?, ?)
  `).bind(
    data.subsidy_type_id,
    data.url,
    data.url_type || 'page',
    data.description || null
  ).run()
  
  return c.json({ id: result.meta.last_row_id })
})

// 監視URL削除
app.delete('/api/subsidy-watch-urls/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare(`DELETE FROM subsidy_watch_urls WHERE id = ?`).bind(id).run()
  
  return c.json({ success: true })
})

// 更新チェック実行（手動 or Cron）
app.post('/api/subsidy-check-updates', async (c) => {
  const { DB } = c.env
  
  // アクティブな監視URLを取得
  const watchUrls = await DB.prepare(`
    SELECT w.*, s.name as subsidy_name 
    FROM subsidy_watch_urls w
    LEFT JOIN subsidy_types s ON w.subsidy_type_id = s.id
    WHERE w.is_active = 1
  `).all()
  
  const results = []
  
  for (const watchUrl of (watchUrls.results || [])) {
    try {
      // URLをフェッチしてハッシュを計算
      const response = await fetch(watchUrl.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SubsidyChecker/1.0)'
        }
      })
      
      if (!response.ok) {
        results.push({
          url: watchUrl.url,
          status: 'error',
          message: `HTTP ${response.status}`
        })
        continue
      }
      
      const content = await response.text()
      
      // シンプルなハッシュ計算（コンテンツの長さ + 一部の内容）
      const contentHash = btoa(content.length.toString() + content.substring(0, 1000)).substring(0, 64)
      
      // Last-Modifiedヘッダー取得
      const lastModified = response.headers.get('Last-Modified') || null
      
      // 変更検知
      let changeDetected = false
      let changeType = null
      
      if (watchUrl.last_content_hash && watchUrl.last_content_hash !== contentHash) {
        changeDetected = true
        changeType = 'content_change'
      }
      
      if (watchUrl.last_modified_date && lastModified && watchUrl.last_modified_date !== lastModified) {
        changeDetected = true
        changeType = 'modified_date_change'
      }
      
      // 初回チェックの場合は変更なしとして記録
      if (!watchUrl.last_checked_at) {
        changeDetected = false
      }
      
      // 監視URLの状態を更新
      await DB.prepare(`
        UPDATE subsidy_watch_urls 
        SET last_checked_at = CURRENT_TIMESTAMP,
            last_content_hash = ?,
            last_modified_date = ?
        WHERE id = ?
      `).bind(contentHash, lastModified, watchUrl.id).run()
      
      // 変更が検知された場合、ログと通知を作成
      if (changeDetected) {
        // 更新ログ作成
        await DB.prepare(`
          INSERT INTO subsidy_update_logs 
          (watch_url_id, subsidy_type_id, change_type, old_value, new_value)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          watchUrl.id,
          watchUrl.subsidy_type_id,
          changeType,
          watchUrl.last_content_hash,
          contentHash
        ).run()
        
        // 管理者通知作成
        await DB.prepare(`
          INSERT INTO admin_notifications 
          (notification_type, title, message, related_id, related_table)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          'subsidy_update',
          `${watchUrl.subsidy_name}の公募要領が更新された可能性があります`,
          `監視URL: ${watchUrl.description || watchUrl.url}\n変更種別: ${changeType}`,
          watchUrl.id,
          'subsidy_watch_urls'
        ).run()
      }
      
      results.push({
        url: watchUrl.url,
        subsidy_name: watchUrl.subsidy_name,
        status: 'success',
        change_detected: changeDetected,
        change_type: changeType
      })
      
    } catch (error) {
      results.push({
        url: watchUrl.url,
        status: 'error',
        message: error.message
      })
    }
  }
  
  return c.json({
    checked_at: new Date().toISOString(),
    total: watchUrls.results?.length || 0,
    results
  })
})

// AI による公募要領情報の自動抽出
app.post('/api/subsidy-guidelines/:subsidyTypeId/ai-extract', async (c) => {
  const { DB, GEMINI_API_KEY } = c.env
  const subsidyTypeId = c.req.param('subsidyTypeId')
  const { url } = await c.req.json()
  
  if (!url) {
    return c.json({ error: 'URLが指定されていません' }, 400)
  }
  
  try {
    // URLからコンテンツを取得
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.9'
      }
    })
    
    if (!response.ok) {
      return c.json({ error: `URLの取得に失敗しました: HTTP ${response.status}` }, 400)
    }
    
    const html = await response.text()
    
    // HTMLからテキストを抽出（簡易的なパース）
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 15000) // トークン制限のため
    
    // 補助金情報を取得
    const subsidyType = await DB.prepare(`
      SELECT * FROM subsidy_types WHERE id = ?
    `).bind(subsidyTypeId).first()
    
    // 現在の公募要領情報を取得
    const currentGuideline = await DB.prepare(`
      SELECT * FROM subsidy_guidelines 
      WHERE subsidy_type_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).bind(subsidyTypeId).first()
    
    // AIプロンプト作成
    const prompt = `あなたは補助金・助成金の専門家です。以下のウェブページの内容から、補助金の公募要領情報を抽出してください。

【補助金名】
${subsidyType?.name || '不明'}

【ウェブページの内容】
${textContent}

【抽出してほしい情報】
以下の情報をJSON形式で出力してください。情報が見つからない場合はnullを入れてください。

{
  "fiscal_year": "年度（例: 2025年度、令和7年度）",
  "version": "公募回・バージョン（例: 第1次公募、通年公募、第18次）",
  "application_start_date": "申請開始日（YYYY-MM-DD形式）",
  "application_end_date": "申請締切日（YYYY-MM-DD形式）",
  "max_amount": "補助上限額（円単位の数値のみ、例: 4500000）",
  "min_amount": "補助下限額（円単位の数値のみ）",
  "subsidy_rate": "補助率（例: 1/2、2/3、1/2〜2/3）",
  "eligibility_requirements": "対象者・要件（100文字以内で要約）",
  "target_expenses": "対象経費（100文字以内で要約）",
  "changes_detected": "前回からの主な変更点（あれば記載、なければnull）",
  "confidence": "抽出の確信度（high/medium/low）",
  "notes": "その他重要な情報や注意点"
}

重要：
- 金額は必ず円単位の数値のみで出力（万円の場合は10000を掛けて変換）
- 日付は必ずYYYY-MM-DD形式
- 情報が明確に読み取れない場合はnullを設定
- JSONのみを出力し、他の説明は不要`

    // Gemini APIを呼び出し
    if (!GEMINI_API_KEY) {
      return c.json({ 
        error: 'API key not configured',
        demo: true,
        extracted: {
          fiscal_year: "2025年度",
          version: "デモ用サンプル",
          application_end_date: "2025-12-31",
          max_amount: 5000000,
          subsidy_rate: "1/2",
          confidence: "low",
          notes: "これはデモ用のサンプルデータです"
        }
      })
    }
    
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          }
        })
      }
    )
    
    if (!aiResponse.ok) {
      throw new Error(`Gemini API error: ${aiResponse.status}`)
    }
    
    const aiData = await aiResponse.json()
    const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // JSONを抽出
    let extracted = null
    try {
      // JSONブロックを探す
      const jsonMatch = aiText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.error('JSON parse error:', e)
    }
    
    if (!extracted) {
      return c.json({ error: 'AIからの応答を解析できませんでした', raw: aiText }, 500)
    }
    
    // 現在のデータと比較して差分を検出
    const changes = []
    if (currentGuideline) {
      if (extracted.fiscal_year && extracted.fiscal_year !== currentGuideline.fiscal_year) {
        changes.push({ field: '年度', old: currentGuideline.fiscal_year, new: extracted.fiscal_year })
      }
      if (extracted.version && extracted.version !== currentGuideline.version) {
        changes.push({ field: '公募回', old: currentGuideline.version, new: extracted.version })
      }
      if (extracted.application_end_date && extracted.application_end_date !== currentGuideline.application_end_date) {
        changes.push({ field: '申請締切', old: currentGuideline.application_end_date, new: extracted.application_end_date })
      }
      if (extracted.max_amount && extracted.max_amount !== currentGuideline.max_amount) {
        changes.push({ field: '上限額', old: currentGuideline.max_amount, new: extracted.max_amount })
      }
      if (extracted.subsidy_rate && extracted.subsidy_rate !== currentGuideline.subsidy_rate) {
        changes.push({ field: '補助率', old: currentGuideline.subsidy_rate, new: extracted.subsidy_rate })
      }
    }
    
    return c.json({
      success: true,
      subsidy_type: subsidyType,
      current_guideline: currentGuideline,
      extracted,
      changes,
      has_changes: changes.length > 0 || !currentGuideline,
      source_url: url
    })
    
  } catch (error) {
    console.error('AI extraction error:', error)
    return c.json({ error: `抽出中にエラーが発生しました: ${error.message}` }, 500)
  }
})

// AI抽出結果で公募要領を更新
app.post('/api/subsidy-guidelines/:subsidyTypeId/ai-update', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.param('subsidyTypeId')
  const data = await c.req.json()
  
  try {
    // 既存のactiveな公募要領を取得
    const existing = await DB.prepare(`
      SELECT id FROM subsidy_guidelines 
      WHERE subsidy_type_id = ? AND status = 'active'
      AND fiscal_year = ? AND version = ?
    `).bind(subsidyTypeId, data.fiscal_year, data.version || null).first()
    
    if (existing) {
      // 既存レコードを更新
      await DB.prepare(`
        UPDATE subsidy_guidelines SET
          application_start_date = ?,
          application_end_date = ?,
          max_amount = ?,
          min_amount = ?,
          subsidy_rate = ?,
          eligibility_requirements = ?,
          target_expenses = ?,
          source_url = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        data.application_start_date || null,
        data.application_end_date || null,
        data.max_amount || null,
        data.min_amount || null,
        data.subsidy_rate || null,
        data.eligibility_requirements || null,
        data.target_expenses || null,
        data.source_url || null,
        existing.id
      ).run()
      
      return c.json({ success: true, action: 'updated', id: existing.id })
    } else {
      // 新規作成
      const result = await DB.prepare(`
        INSERT INTO subsidy_guidelines (
          subsidy_type_id, fiscal_year, version,
          application_start_date, application_end_date,
          max_amount, min_amount, subsidy_rate,
          eligibility_requirements, target_expenses,
          status, source_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).bind(
        subsidyTypeId,
        data.fiscal_year || null,
        data.version || null,
        data.application_start_date || null,
        data.application_end_date || null,
        data.max_amount || null,
        data.min_amount || null,
        data.subsidy_rate || null,
        data.eligibility_requirements || null,
        data.target_expenses || null,
        data.source_url || null
      ).run()
      
      return c.json({ success: true, action: 'created', id: result.meta.last_row_id })
    }
  } catch (error) {
    console.error('AI update error:', error)
    return c.json({ error: `更新に失敗しました: ${error.message}` }, 500)
  }
})

// 更新ログ一覧取得
app.get('/api/subsidy-update-logs', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT l.*, s.name as subsidy_name, w.url, w.description as url_description
    FROM subsidy_update_logs l
    LEFT JOIN subsidy_types s ON l.subsidy_type_id = s.id
    LEFT JOIN subsidy_watch_urls w ON l.watch_url_id = w.id
    ORDER BY l.detected_at DESC
    LIMIT 100
  `).all()
  
  return c.json(result.results)
})

// 更新ログのステータス更新
app.put('/api/subsidy-update-logs/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE subsidy_update_logs 
    SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, notes = ?
    WHERE id = ?
  `).bind(data.status, data.reviewed_by, data.notes || null, id).run()
  
  return c.json({ success: true })
})

// 通知一覧取得
app.get('/api/admin/notifications', async (c) => {
  const { DB } = c.env
  const unreadOnly = c.req.query('unread_only') === 'true'
  
  let query = `SELECT * FROM admin_notifications`
  if (unreadOnly) {
    query += ` WHERE is_read = 0`
  }
  query += ` ORDER BY created_at DESC LIMIT 50`
  
  const result = await DB.prepare(query).all()
  
  return c.json(result.results)
})

// 通知を既読にする
app.put('/api/admin/notifications/:id/read', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE admin_notifications 
    SET is_read = 1, read_by = ?, read_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(data.read_by, id).run()
  
  return c.json({ success: true })
})

// 未読通知数取得
app.get('/api/admin/notifications/unread-count', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0
  `).first()
  
  return c.json({ count: result?.count || 0 })
})

// 公募要領詳細情報 CRUD
app.get('/api/subsidy-guidelines', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT g.*, s.name as subsidy_name 
    FROM subsidy_guidelines g
    LEFT JOIN subsidy_types s ON g.subsidy_type_id = s.id
    ORDER BY g.subsidy_type_id, g.fiscal_year DESC
  `).all()
  
  return c.json(result.results)
})

app.get('/api/subsidy-guidelines/:subsidyTypeId', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.param('subsidyTypeId')
  
  const result = await DB.prepare(`
    SELECT * FROM subsidy_guidelines 
    WHERE subsidy_type_id = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(subsidyTypeId).first()
  
  return c.json(result || null)
})

app.post('/api/subsidy-guidelines', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO subsidy_guidelines (
      subsidy_type_id, fiscal_year, version,
      application_start_date, application_end_date,
      max_amount, min_amount, subsidy_rate,
      eligibility_requirements, target_expenses,
      document_sections, character_limits,
      status, source_url, pdf_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.subsidy_type_id,
    data.fiscal_year || null,
    data.version || null,
    data.application_start_date || null,
    data.application_end_date || null,
    data.max_amount || null,
    data.min_amount || null,
    data.subsidy_rate || null,
    data.eligibility_requirements ? JSON.stringify(data.eligibility_requirements) : null,
    data.target_expenses ? JSON.stringify(data.target_expenses) : null,
    data.document_sections ? JSON.stringify(data.document_sections) : null,
    data.character_limits ? JSON.stringify(data.character_limits) : null,
    data.status || 'active',
    data.source_url || null,
    data.pdf_url || null
  ).run()
  
  return c.json({ id: result.meta.last_row_id })
})

app.put('/api/subsidy-guidelines/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE subsidy_guidelines SET
      fiscal_year = ?, version = ?,
      application_start_date = ?, application_end_date = ?,
      max_amount = ?, min_amount = ?, subsidy_rate = ?,
      eligibility_requirements = ?, target_expenses = ?,
      document_sections = ?, character_limits = ?,
      status = ?, source_url = ?, pdf_url = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.fiscal_year || null,
    data.version || null,
    data.application_start_date || null,
    data.application_end_date || null,
    data.max_amount || null,
    data.min_amount || null,
    data.subsidy_rate || null,
    data.eligibility_requirements ? JSON.stringify(data.eligibility_requirements) : null,
    data.target_expenses ? JSON.stringify(data.target_expenses) : null,
    data.document_sections ? JSON.stringify(data.document_sections) : null,
    data.character_limits ? JSON.stringify(data.character_limits) : null,
    data.status || 'active',
    data.source_url || null,
    data.pdf_url || null,
    id
  ).run()
  
  return c.json({ success: true })
})

// 公募要領削除API
app.delete('/api/subsidy-guidelines/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare(`DELETE FROM subsidy_guidelines WHERE id = ?`).bind(id).run()
  
  return c.json({ success: true })
})

// 公募要領ステータス切り替えAPI
app.patch('/api/subsidy-guidelines/:id/status', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { status } = await c.req.json()
  
  await DB.prepare(`
    UPDATE subsidy_guidelines SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(status, id).run()
  
  return c.json({ success: true })
})

// ===============================
// 公募要領管理画面
// ===============================

app.get('/admin/guidelines', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>公募要領管理 - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <!-- ヘッダー -->
            <header class="bg-indigo-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <a href="/" class="text-sm hover:underline mb-1 block">
                                <i class="fas fa-arrow-left mr-1"></i>トップに戻る
                            </a>
                            <h1 class="text-xl md:text-2xl font-bold">
                                <i class="fas fa-book-open mr-2"></i>
                                公募要領管理
                            </h1>
                        </div>
                        <div class="flex items-center gap-4">
                            <div id="notificationBadge" class="relative cursor-pointer" onclick="showNotifications()">
                                <i class="fas fa-bell text-xl"></i>
                                <span id="unreadCount" class="hidden absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">0</span>
                            </div>
                            <button onclick="logout()" class="text-sm hover:underline">
                                <i class="fas fa-sign-out-alt mr-1"></i>
                                ログアウト
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div class="container mx-auto px-4 py-8">
                <!-- タブ切り替え -->
                <div class="bg-white rounded-lg shadow mb-6">
                    <div class="border-b flex overflow-x-auto">
                        <button onclick="switchTab('watch')" id="tab-watch" 
                                class="px-6 py-3 font-medium text-indigo-600 border-b-2 border-indigo-600 whitespace-nowrap">
                            <i class="fas fa-eye mr-2"></i>監視URL
                        </button>
                        <button onclick="switchTab('updates')" id="tab-updates" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-sync mr-2"></i>更新履歴
                        </button>
                        <button onclick="switchTab('guidelines')" id="tab-guidelines" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-file-alt mr-2"></i>公募要領詳細
                        </button>
                    </div>
                </div>

                <!-- 監視URLタブ -->
                <div id="content-watch" class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h2 class="text-lg font-bold">監視URL一覧</h2>
                        <div class="flex gap-2">
                            <button onclick="checkUpdatesNow()" 
                                    class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                                <i class="fas fa-sync mr-2"></i>今すぐチェック
                            </button>
                            <button onclick="openAddUrlModal()" 
                                    class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                                <i class="fas fa-plus mr-2"></i>URL追加
                            </button>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow overflow-hidden">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 border-b">
                                <tr>
                                    <th class="px-4 py-3 text-left">補助金</th>
                                    <th class="px-4 py-3 text-left">URL</th>
                                    <th class="px-4 py-3 text-left">最終チェック</th>
                                    <th class="px-4 py-3 text-left">操作</th>
                                </tr>
                            </thead>
                            <tbody id="watchUrlsList" class="divide-y">
                                <tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">読み込み中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 更新履歴タブ -->
                <div id="content-updates" class="hidden space-y-6">
                    <h2 class="text-lg font-bold">更新検知履歴</h2>
                    <div class="bg-white rounded-lg shadow overflow-hidden">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 border-b">
                                <tr>
                                    <th class="px-4 py-3 text-left">検知日時</th>
                                    <th class="px-4 py-3 text-left">補助金</th>
                                    <th class="px-4 py-3 text-left">変更種別</th>
                                    <th class="px-4 py-3 text-left">ステータス</th>
                                    <th class="px-4 py-3 text-left">操作</th>
                                </tr>
                            </thead>
                            <tbody id="updateLogsList" class="divide-y">
                                <tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">読み込み中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 公募要領詳細タブ -->
                <div id="content-guidelines" class="hidden space-y-6">
                    <!-- AI自動更新セクション -->
                    <div class="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                        <div class="flex flex-wrap items-center justify-between gap-4">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                                    <i class="fas fa-robot text-white"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-purple-900">AI自動更新</h3>
                                    <p class="text-sm text-purple-700">公式サイトからAIが最新情報を自動抽出します</p>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <select id="aiExtractSubsidy" class="px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white">
                                    <option value="">補助金を選択</option>
                                </select>
                                <button onclick="openAiExtractModal()" 
                                        class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2">
                                    <i class="fas fa-magic"></i>
                                    <span>AIで情報取得</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <h2 class="text-lg font-bold">公募要領詳細</h2>
                            <p class="text-sm text-gray-500">補助金・助成金ごとに公募情報を管理します</p>
                        </div>
                        <div class="flex gap-2">
                            <select id="guidelinesFilter" onchange="filterGuidelines()" class="px-3 py-2 border rounded-lg text-sm">
                                <option value="all">すべて表示</option>
                                <option value="active">有効のみ</option>
                                <option value="inactive">終了のみ</option>
                            </select>
                            <button onclick="openAddGuidelineModal()" 
                                    class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                                <i class="fas fa-plus mr-2"></i>新規追加
                            </button>
                        </div>
                    </div>
                    <div id="guidelinesList" class="space-y-8">
                        <div class="text-center py-8 text-gray-500">読み込み中...</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- URL追加モーダル -->
        <div id="addUrlModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 class="text-xl font-bold mb-4">監視URL追加</h3>
                <form id="addUrlForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">補助金種別 *</label>
                        <select name="subsidy_type_id" id="addUrlSubsidyType" required class="w-full px-3 py-2 border rounded-lg">
                            <option value="">選択してください</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">URL *</label>
                        <input type="url" name="url" required class="w-full px-3 py-2 border rounded-lg" placeholder="https://...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">説明</label>
                        <input type="text" name="description" class="w-full px-3 py-2 border rounded-lg" placeholder="公式サイトトップページ">
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">追加</button>
                        <button type="button" onclick="closeAddUrlModal()" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 通知モーダル -->
        <div id="notificationsModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">通知</h3>
                    <button onclick="closeNotificationsModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div id="notificationsList" class="space-y-3">
                    <div class="text-center py-4 text-gray-500">読み込み中...</div>
                </div>
            </div>
        </div>

        <!-- 公募要領追加モーダル -->
        <div id="addGuidelineModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
                <h3 class="text-xl font-bold mb-4">公募要領詳細追加</h3>
                <form id="addGuidelineForm" class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">補助金種別 *</label>
                            <select name="subsidy_type_id" id="addGuidelineSubsidyType" required class="w-full px-3 py-2 border rounded-lg">
                                <option value="">選択してください</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">年度 *</label>
                            <input type="text" name="fiscal_year" required class="w-full px-3 py-2 border rounded-lg" placeholder="2025年度">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公募回・バージョン</label>
                        <input type="text" name="version" class="w-full px-3 py-2 border rounded-lg" placeholder="第1次公募、通年公募 など">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">申請開始日</label>
                            <input type="date" name="application_start_date" class="w-full px-3 py-2 border rounded-lg">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">申請締切日</label>
                            <input type="date" name="application_end_date" class="w-full px-3 py-2 border rounded-lg">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">上限額（万円）</label>
                            <input type="number" name="max_amount" class="w-full px-3 py-2 border rounded-lg" placeholder="450">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">下限額（万円）</label>
                            <input type="number" name="min_amount" class="w-full px-3 py-2 border rounded-lg" placeholder="5">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">補助率</label>
                            <input type="text" name="subsidy_rate" class="w-full px-3 py-2 border rounded-lg" placeholder="1/2〜2/3">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公式サイトURL</label>
                        <input type="url" name="source_url" class="w-full px-3 py-2 border rounded-lg" placeholder="https://...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公募要領PDF URL</label>
                        <input type="url" name="pdf_url" class="w-full px-3 py-2 border rounded-lg" placeholder="https://...pdf">
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">追加</button>
                        <button type="button" onclick="closeAddGuidelineModal()" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 公募要領編集モーダル -->
        <div id="editGuidelineModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
                <h3 class="text-xl font-bold mb-4">公募要領詳細編集</h3>
                <form id="editGuidelineForm" class="space-y-4">
                    <input type="hidden" name="id" id="editGuidelineId">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">補助金種別</label>
                            <input type="text" id="editGuidelineSubsidyName" disabled class="w-full px-3 py-2 border rounded-lg bg-gray-100">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">年度 *</label>
                            <input type="text" name="fiscal_year" id="editGuidelineFiscalYear" required class="w-full px-3 py-2 border rounded-lg" placeholder="2025年度">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公募回・バージョン</label>
                        <input type="text" name="version" id="editGuidelineVersion" class="w-full px-3 py-2 border rounded-lg" placeholder="第1次公募、通年公募 など">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">申請開始日</label>
                            <input type="date" name="application_start_date" id="editGuidelineStartDate" class="w-full px-3 py-2 border rounded-lg">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">申請締切日</label>
                            <input type="date" name="application_end_date" id="editGuidelineEndDate" class="w-full px-3 py-2 border rounded-lg">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">上限額（万円）</label>
                            <input type="number" name="max_amount" id="editGuidelineMaxAmount" class="w-full px-3 py-2 border rounded-lg" placeholder="450">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">下限額（万円）</label>
                            <input type="number" name="min_amount" id="editGuidelineMinAmount" class="w-full px-3 py-2 border rounded-lg" placeholder="5">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">補助率</label>
                            <input type="text" name="subsidy_rate" id="editGuidelineSubsidyRate" class="w-full px-3 py-2 border rounded-lg" placeholder="1/2〜2/3">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公式サイトURL</label>
                        <input type="url" name="source_url" id="editGuidelineSourceUrl" class="w-full px-3 py-2 border rounded-lg" placeholder="https://...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公募要領PDF URL</label>
                        <input type="url" name="pdf_url" id="editGuidelinePdfUrl" class="w-full px-3 py-2 border rounded-lg" placeholder="https://...pdf">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">ステータス</label>
                        <select name="status" id="editGuidelineStatus" class="w-full px-3 py-2 border rounded-lg">
                            <option value="active">有効（公募中）</option>
                            <option value="inactive">終了</option>
                        </select>
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">更新</button>
                        <button type="button" onclick="closeEditGuidelineModal()" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- AI抽出モーダル -->
        <div id="aiExtractModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                        <i class="fas fa-robot text-white"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold">AI自動情報取得</h3>
                        <p class="text-sm text-gray-500">公式サイトから公募要領情報を自動抽出</p>
                    </div>
                </div>
                <form id="aiExtractForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">補助金種別 *</label>
                        <select name="subsidy_type_id" id="aiExtractSubsidyType" required class="w-full px-3 py-2 border rounded-lg">
                            <option value="">選択してください</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公式サイトURL *</label>
                        <input type="url" name="url" id="aiExtractUrl" required class="w-full px-3 py-2 border rounded-lg" placeholder="https://...">
                        <p class="text-xs text-gray-500 mt-1">公募要領の情報が掲載されているページのURLを入力してください</p>
                    </div>
                    <div id="aiExtractStatus" class="hidden">
                        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div class="flex items-center gap-3">
                                <i class="fas fa-spinner fa-spin text-purple-600 text-xl"></i>
                                <div>
                                    <div class="font-medium text-purple-900">AIが解析中...</div>
                                    <div class="text-sm text-purple-700">公式サイトから情報を抽出しています</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" id="aiExtractSubmitBtn" class="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
                            <i class="fas fa-magic mr-2"></i>AIで情報を抽出
                        </button>
                        <button type="button" onclick="closeAiExtractModal()" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- AI抽出結果モーダル -->
        <div id="aiResultModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                            <i class="fas fa-check text-white"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold">AI抽出結果</h3>
                            <p class="text-sm text-gray-500" id="aiResultSubsidyName">-</p>
                        </div>
                    </div>
                    <button onclick="closeAiResultModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <!-- 変更点サマリー -->
                <div id="aiResultChanges" class="mb-6"></div>
                
                <!-- 抽出データ比較 -->
                <div class="bg-gray-50 rounded-lg p-4 mb-6">
                    <h4 class="font-bold mb-3">抽出された情報</h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="text-gray-500">年度:</span>
                            <span class="ml-2 font-medium" id="aiResult_fiscal_year">-</span>
                        </div>
                        <div>
                            <span class="text-gray-500">公募回:</span>
                            <span class="ml-2 font-medium" id="aiResult_version">-</span>
                        </div>
                        <div>
                            <span class="text-gray-500">申請開始:</span>
                            <span class="ml-2 font-medium" id="aiResult_start_date">-</span>
                        </div>
                        <div>
                            <span class="text-gray-500">申請締切:</span>
                            <span class="ml-2 font-medium" id="aiResult_end_date">-</span>
                        </div>
                        <div>
                            <span class="text-gray-500">上限額:</span>
                            <span class="ml-2 font-medium" id="aiResult_max_amount">-</span>
                        </div>
                        <div>
                            <span class="text-gray-500">補助率:</span>
                            <span class="ml-2 font-medium" id="aiResult_subsidy_rate">-</span>
                        </div>
                    </div>
                    <div class="mt-3 text-sm">
                        <div class="text-gray-500">対象者・要件:</div>
                        <div class="mt-1" id="aiResult_eligibility">-</div>
                    </div>
                    <div class="mt-3 text-sm">
                        <div class="text-gray-500">対象経費:</div>
                        <div class="mt-1" id="aiResult_expenses">-</div>
                    </div>
                    <div class="mt-3 text-sm flex items-center gap-2">
                        <span class="text-gray-500">確信度:</span>
                        <span id="aiResult_confidence" class="px-2 py-0.5 rounded text-xs">-</span>
                    </div>
                    <div id="aiResult_notes" class="mt-3 text-sm text-gray-600 hidden">
                        <div class="text-gray-500">注意点:</div>
                        <div class="mt-1 italic"></div>
                    </div>
                </div>
                
                <div class="flex gap-2">
                    <button onclick="applyAiResult()" class="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold">
                        <i class="fas fa-check mr-2"></i>この内容で更新する
                    </button>
                    <button onclick="closeAiResultModal()" class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400">
                        キャンセル
                    </button>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // 認証チェック
            if (!localStorage.getItem('admin_token')) {
                window.location.href = '/login';
            }
            
            function logout() {
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_name');
                window.location.href = '/login';
            }

            let subsidyTypes = [];

            // タブ切り替え
            function switchTab(tab) {
                ['watch', 'updates', 'guidelines'].forEach(t => {
                    document.getElementById('content-' + t).classList.add('hidden');
                    document.getElementById('tab-' + t).classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
                    document.getElementById('tab-' + t).classList.add('text-gray-500');
                });
                document.getElementById('content-' + tab).classList.remove('hidden');
                document.getElementById('tab-' + tab).classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
                document.getElementById('tab-' + tab).classList.remove('text-gray-500');
            }

            // トースト
            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                toast.className = \`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 \${type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white\`;
                toast.innerHTML = \`<i class="fas fa-\${type === 'success' ? 'check' : 'exclamation'}-circle mr-2"></i>\${message}\`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }

            // 補助金種別読み込み
            async function loadSubsidyTypes() {
                const response = await axios.get('/api/subsidy-types');
                subsidyTypes = response.data;
                
                const options = '<option value="">選択してください</option>' + 
                    subsidyTypes.map(s => \`<option value="\${s.id}">\${s.name}</option>\`).join('');
                document.getElementById('addUrlSubsidyType').innerHTML = options;
                document.getElementById('addGuidelineSubsidyType').innerHTML = options;
                document.getElementById('aiExtractSubsidy').innerHTML = '<option value="">補助金を選択</option>' + 
                    subsidyTypes.map(s => \`<option value="\${s.id}" data-url="\${s.source_url || ''}">\${s.name}</option>\`).join('');
                document.getElementById('aiExtractSubsidyType').innerHTML = options;
            }
            
            // AI抽出モーダル
            let currentAiResult = null;
            
            function openAiExtractModal() {
                const selectedSubsidy = document.getElementById('aiExtractSubsidy').value;
                if (selectedSubsidy) {
                    document.getElementById('aiExtractSubsidyType').value = selectedSubsidy;
                    // 補助金の公式URLがあれば自動入力
                    const subsidy = subsidyTypes.find(s => s.id == selectedSubsidy);
                    const guideline = allGuidelines.find(g => g.subsidy_type_id == selectedSubsidy && g.status === 'active');
                    if (guideline?.source_url) {
                        document.getElementById('aiExtractUrl').value = guideline.source_url;
                    }
                }
                document.getElementById('aiExtractModal').classList.remove('hidden');
            }
            
            function closeAiExtractModal() {
                document.getElementById('aiExtractModal').classList.add('hidden');
                document.getElementById('aiExtractForm').reset();
                document.getElementById('aiExtractStatus').classList.add('hidden');
            }
            
            document.getElementById('aiExtractForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const subsidyTypeId = document.getElementById('aiExtractSubsidyType').value;
                const url = document.getElementById('aiExtractUrl').value;
                
                if (!subsidyTypeId || !url) {
                    showToast('補助金とURLを入力してください', 'error');
                    return;
                }
                
                // ローディング表示
                document.getElementById('aiExtractStatus').classList.remove('hidden');
                document.getElementById('aiExtractSubmitBtn').disabled = true;
                
                try {
                    const response = await axios.post(\`/api/subsidy-guidelines/\${subsidyTypeId}/ai-extract\`, { url });
                    const result = response.data;
                    
                    if (result.error) {
                        showToast(result.error, 'error');
                        return;
                    }
                    
                    // 結果を保存
                    currentAiResult = {
                        subsidyTypeId,
                        ...result.extracted,
                        source_url: url
                    };
                    
                    // 結果モーダルを表示
                    closeAiExtractModal();
                    showAiResultModal(result);
                    
                } catch (error) {
                    showToast('AI抽出に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
                } finally {
                    document.getElementById('aiExtractStatus').classList.add('hidden');
                    document.getElementById('aiExtractSubmitBtn').disabled = false;
                }
            });
            
            function showAiResultModal(result) {
                const subsidy = subsidyTypes.find(s => s.id == result.subsidy_type?.id);
                document.getElementById('aiResultSubsidyName').textContent = subsidy?.name || result.subsidy_type?.name || '不明';
                
                // 変更点表示
                const changesDiv = document.getElementById('aiResultChanges');
                if (result.changes && result.changes.length > 0) {
                    changesDiv.innerHTML = \`
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h4 class="font-bold text-yellow-800 mb-2"><i class="fas fa-exclamation-triangle mr-2"></i>変更が検出されました</h4>
                            <div class="space-y-2">
                                \${result.changes.map(c => \`
                                    <div class="flex items-center gap-2 text-sm">
                                        <span class="text-gray-600">\${c.field}:</span>
                                        <span class="line-through text-red-600">\${c.old || '-'}</span>
                                        <i class="fas fa-arrow-right text-gray-400"></i>
                                        <span class="text-green-600 font-bold">\${c.new}</span>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                    \`;
                } else if (!result.current_guideline) {
                    changesDiv.innerHTML = \`
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 class="font-bold text-blue-800"><i class="fas fa-plus-circle mr-2"></i>新規登録</h4>
                            <p class="text-sm text-blue-700">この補助金の公募要領情報が新規登録されます</p>
                        </div>
                    \`;
                } else {
                    changesDiv.innerHTML = \`
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h4 class="font-bold text-green-800"><i class="fas fa-check-circle mr-2"></i>変更なし</h4>
                            <p class="text-sm text-green-700">現在の情報と同じ内容です</p>
                        </div>
                    \`;
                }
                
                // 抽出データ表示
                const ext = result.extracted;
                document.getElementById('aiResult_fiscal_year').textContent = ext.fiscal_year || '-';
                document.getElementById('aiResult_version').textContent = ext.version || '-';
                document.getElementById('aiResult_start_date').textContent = ext.application_start_date || '-';
                document.getElementById('aiResult_end_date').textContent = ext.application_end_date || '-';
                document.getElementById('aiResult_max_amount').textContent = ext.max_amount ? (ext.max_amount / 10000).toLocaleString() + '万円' : '-';
                document.getElementById('aiResult_subsidy_rate').textContent = ext.subsidy_rate || '-';
                document.getElementById('aiResult_eligibility').textContent = ext.eligibility_requirements || '-';
                document.getElementById('aiResult_expenses').textContent = ext.target_expenses || '-';
                
                // 確信度
                const confEl = document.getElementById('aiResult_confidence');
                const confColors = { high: 'bg-green-100 text-green-800', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-red-100 text-red-800' };
                const confLabels = { high: '高', medium: '中', low: '低' };
                confEl.className = \`px-2 py-0.5 rounded text-xs \${confColors[ext.confidence] || 'bg-gray-100 text-gray-800'}\`;
                confEl.textContent = confLabels[ext.confidence] || ext.confidence || '-';
                
                // 注意点
                const notesDiv = document.getElementById('aiResult_notes');
                if (ext.notes) {
                    notesDiv.classList.remove('hidden');
                    notesDiv.querySelector('div:last-child').textContent = ext.notes;
                } else {
                    notesDiv.classList.add('hidden');
                }
                
                document.getElementById('aiResultModal').classList.remove('hidden');
            }
            
            function closeAiResultModal() {
                document.getElementById('aiResultModal').classList.add('hidden');
                currentAiResult = null;
            }
            
            async function applyAiResult() {
                if (!currentAiResult) {
                    showToast('適用するデータがありません', 'error');
                    return;
                }
                
                try {
                    const response = await axios.post(\`/api/subsidy-guidelines/\${currentAiResult.subsidyTypeId}/ai-update\`, currentAiResult);
                    
                    if (response.data.success) {
                        showToast(\`公募要領を\${response.data.action === 'created' ? '新規登録' : '更新'}しました\`);
                        closeAiResultModal();
                        loadGuidelines();
                    }
                } catch (error) {
                    showToast('更新に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
                }
            }

            // 監視URL一覧
            async function loadWatchUrls() {
                const response = await axios.get('/api/subsidy-watch-urls');
                const urls = response.data;
                
                const tbody = document.getElementById('watchUrlsList');
                if (urls.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">監視URLがありません</td></tr>';
                    return;
                }
                
                tbody.innerHTML = urls.map(url => \`
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3">
                            <span class="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">\${url.subsidy_name || '不明'}</span>
                        </td>
                        <td class="px-4 py-3">
                            <div class="truncate max-w-xs" title="\${url.url}">\${url.description || url.url}</div>
                            <a href="\${url.url}" target="_blank" class="text-xs text-blue-600 hover:underline">
                                <i class="fas fa-external-link-alt mr-1"></i>開く
                            </a>
                        </td>
                        <td class="px-4 py-3 text-xs text-gray-500">
                            \${url.last_checked_at ? new Date(url.last_checked_at).toLocaleString('ja-JP') : '未チェック'}
                        </td>
                        <td class="px-4 py-3">
                            <button onclick="deleteWatchUrl(\${url.id})" class="text-red-600 hover:text-red-800">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                \`).join('');
            }

            // 更新ログ一覧
            async function loadUpdateLogs() {
                const response = await axios.get('/api/subsidy-update-logs');
                const logs = response.data;
                
                const tbody = document.getElementById('updateLogsList');
                if (logs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">更新履歴がありません</td></tr>';
                    return;
                }
                
                const statusLabels = {
                    pending: { label: '未確認', class: 'bg-yellow-100 text-yellow-800' },
                    reviewed: { label: '確認済み', class: 'bg-blue-100 text-blue-800' },
                    applied: { label: '対応済み', class: 'bg-green-100 text-green-800' },
                    ignored: { label: '対応不要', class: 'bg-gray-100 text-gray-800' }
                };
                
                tbody.innerHTML = logs.map(log => \`
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm">\${new Date(log.detected_at).toLocaleString('ja-JP')}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">\${log.subsidy_name}</span>
                        </td>
                        <td class="px-4 py-3 text-sm">\${log.change_type || '-'}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-1 rounded text-xs \${statusLabels[log.status]?.class || ''}">\${statusLabels[log.status]?.label || log.status}</span>
                        </td>
                        <td class="px-4 py-3">
                            <select onchange="updateLogStatus(\${log.id}, this.value)" class="text-sm border rounded px-2 py-1">
                                <option value="pending" \${log.status === 'pending' ? 'selected' : ''}>未確認</option>
                                <option value="reviewed" \${log.status === 'reviewed' ? 'selected' : ''}>確認済み</option>
                                <option value="applied" \${log.status === 'applied' ? 'selected' : ''}>対応済み</option>
                                <option value="ignored" \${log.status === 'ignored' ? 'selected' : ''}>対応不要</option>
                            </select>
                        </td>
                    </tr>
                \`).join('');
            }

            // 公募要領データを保持
            let allGuidelines = [];
            
            // 公募要領一覧
            async function loadGuidelines() {
                const response = await axios.get('/api/subsidy-guidelines');
                allGuidelines = response.data;
                renderGuidelines();
            }
            
            function filterGuidelines() {
                renderGuidelines();
            }
            
            function renderGuidelines() {
                const filter = document.getElementById('guidelinesFilter').value;
                let guidelines = allGuidelines;
                
                if (filter === 'active') {
                    guidelines = guidelines.filter(g => g.status === 'active');
                } else if (filter === 'inactive') {
                    guidelines = guidelines.filter(g => g.status !== 'active');
                }
                
                const container = document.getElementById('guidelinesList');
                if (guidelines.length === 0) {
                    container.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-folder-open text-4xl mb-2"></i><div>公募要領がありません</div></div>';
                    return;
                }
                
                // 補助金種別ごとにグループ化
                const grouped = {};
                const subsidyInfo = {};
                guidelines.forEach(g => {
                    const key = g.subsidy_type_id;
                    if (!grouped[key]) {
                        grouped[key] = [];
                        // 補助金情報を取得
                        const subsidy = subsidyTypes.find(s => s.id == key);
                        subsidyInfo[key] = subsidy || { name: g.subsidy_name, category: '不明' };
                    }
                    grouped[key].push(g);
                });
                
                // カテゴリ色の定義
                const getCategoryColor = (category) => {
                    if (category === '行政書士管轄') return { bg: 'bg-emerald-50', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-800', icon: 'fas fa-stamp' };
                    if (category === '社労士管轄') return { bg: 'bg-blue-50', border: 'border-blue-500', badge: 'bg-blue-100 text-blue-800', icon: 'fas fa-user-tie' };
                    return { bg: 'bg-gray-50', border: 'border-gray-500', badge: 'bg-gray-100 text-gray-800', icon: 'fas fa-folder' };
                };
                
                // 申請期限の残日数計算
                const getDaysRemaining = (endDate) => {
                    if (!endDate) return null;
                    const today = new Date();
                    const end = new Date(endDate);
                    const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
                    return diff;
                };
                
                const getDeadlineStatus = (days) => {
                    if (days === null) return { class: '', text: '' };
                    if (days < 0) return { class: 'text-gray-500', text: '終了' };
                    if (days <= 7) return { class: 'text-red-600 font-bold', text: \`残り\${days}日\` };
                    if (days <= 14) return { class: 'text-orange-600 font-bold', text: \`残り\${days}日\` };
                    if (days <= 30) return { class: 'text-yellow-600', text: \`残り\${days}日\` };
                    return { class: 'text-green-600', text: \`残り\${days}日\` };
                };
                
                let html = '';
                
                // カテゴリでソート（行政書士管轄 → 社労士管轄 → その他）
                const categoryOrder = ['行政書士管轄', '社労士管轄'];
                const sortedKeys = Object.keys(grouped).sort((a, b) => {
                    const catA = subsidyInfo[a]?.category || '';
                    const catB = subsidyInfo[b]?.category || '';
                    const orderA = categoryOrder.indexOf(catA);
                    const orderB = categoryOrder.indexOf(catB);
                    if (orderA !== orderB) return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
                    return (subsidyInfo[a]?.name || '').localeCompare(subsidyInfo[b]?.name || '');
                });
                
                sortedKeys.forEach(subsidyTypeId => {
                    const items = grouped[subsidyTypeId];
                    const info = subsidyInfo[subsidyTypeId];
                    const colors = getCategoryColor(info.category);
                    
                    html += \`
                        <div class="bg-white rounded-lg shadow overflow-hidden">
                            <div class="\${colors.bg} border-l-4 \${colors.border} px-4 py-3">
                                <div class="flex items-center justify-between flex-wrap gap-2">
                                    <div class="flex items-center gap-3">
                                        <i class="\${colors.icon} text-gray-600"></i>
                                        <div>
                                            <h3 class="font-bold text-gray-900">\${info.name}</h3>
                                            <span class="\${colors.badge} text-xs px-2 py-0.5 rounded">\${info.category || '一般'}</span>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-sm text-gray-500">\${items.length}件の公募情報</span>
                                        <button onclick="openAddGuidelineModalFor(\${subsidyTypeId})" class="text-indigo-600 hover:text-indigo-800 text-sm">
                                            <i class="fas fa-plus-circle mr-1"></i>追加
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="divide-y">
                    \`;
                    
                    items.forEach(g => {
                        const days = getDaysRemaining(g.application_end_date);
                        const deadlineStatus = getDeadlineStatus(days);
                        
                        html += \`
                            <div class="p-4 hover:bg-gray-50 transition-colors">
                                <div class="flex flex-wrap items-start justify-between gap-4">
                                    <div class="flex-1 min-w-[200px]">
                                        <div class="flex items-center gap-2 mb-2">
                                            <span class="font-bold">\${g.fiscal_year || '-'}</span>
                                            \${g.version ? \`<span class="text-gray-500">\${g.version}</span>\` : ''}
                                            <span class="px-2 py-0.5 rounded text-xs \${g.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">\${g.status === 'active' ? '公募中' : '終了'}</span>
                                        </div>
                                        <div class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                                            <div>
                                                <span class="text-gray-500">補助率:</span>
                                                <span class="ml-1 font-medium">\${g.subsidy_rate || '-'}</span>
                                            </div>
                                            <div>
                                                <span class="text-gray-500">上限額:</span>
                                                <span class="ml-1 font-medium">\${g.max_amount ? (g.max_amount / 10000).toLocaleString() + '万円' : '-'}</span>
                                            </div>
                                            <div>
                                                <span class="text-gray-500">申請期限:</span>
                                                <span class="ml-1 \${deadlineStatus.class}">\${g.application_end_date || '-'} \${deadlineStatus.text}</span>
                                            </div>
                                            <div>
                                                <span class="text-gray-500">開始:</span>
                                                <span class="ml-1">\${g.application_start_date || '-'}</span>
                                            </div>
                                        </div>
                                        \${g.source_url ? \`
                                            <div class="mt-2">
                                                <a href="\${g.source_url}" target="_blank" class="text-blue-600 hover:underline text-sm">
                                                    <i class="fas fa-external-link-alt mr-1"></i>公式サイト
                                                </a>
                                                \${g.pdf_url ? \`
                                                    <a href="\${g.pdf_url}" target="_blank" class="text-blue-600 hover:underline text-sm ml-4">
                                                        <i class="fas fa-file-pdf mr-1"></i>公募要領PDF
                                                    </a>
                                                \` : ''}
                                            </div>
                                        \` : ''}
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button onclick="toggleGuidelineStatus(\${g.id}, '\${g.status}')" 
                                                class="px-3 py-1 rounded text-sm \${g.status === 'active' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}"
                                                title="\${g.status === 'active' ? '終了にする' : '有効にする'}">
                                            <i class="fas fa-\${g.status === 'active' ? 'pause' : 'play'} mr-1"></i>
                                            \${g.status === 'active' ? '終了' : '有効化'}
                                        </button>
                                        <button onclick='openEditGuidelineModal(\${JSON.stringify(g).replace(/'/g, "&#39;")})' 
                                                class="px-3 py-1 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200">
                                            <i class="fas fa-edit mr-1"></i>編集
                                        </button>
                                        <button onclick="deleteGuideline(\${g.id})" 
                                                class="px-3 py-1 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200">
                                            <i class="fas fa-trash mr-1"></i>削除
                                        </button>
                                    </div>
                                </div>
                            </div>
                        \`;
                    });
                    
                    html += \`
                            </div>
                        </div>
                    \`;
                });
                
                container.innerHTML = html;
            }

            // 通知
            async function loadUnreadCount() {
                const response = await axios.get('/api/admin/notifications/unread-count');
                const count = response.data.count;
                const badge = document.getElementById('unreadCount');
                if (count > 0) {
                    badge.textContent = count;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }

            async function showNotifications() {
                document.getElementById('notificationsModal').classList.remove('hidden');
                const response = await axios.get('/api/admin/notifications');
                const notifications = response.data;
                
                const container = document.getElementById('notificationsList');
                if (notifications.length === 0) {
                    container.innerHTML = '<div class="text-center py-4 text-gray-500">通知はありません</div>';
                    return;
                }
                
                container.innerHTML = notifications.map(n => \`
                    <div class="border rounded-lg p-3 \${n.is_read ? 'bg-gray-50' : 'bg-yellow-50 border-yellow-200'}">
                        <div class="flex justify-between items-start">
                            <h4 class="font-medium text-sm">\${n.title}</h4>
                            \${!n.is_read ? \`<button onclick="markAsRead(\${n.id})" class="text-xs text-blue-600 hover:underline">既読にする</button>\` : ''}
                        </div>
                        <p class="text-xs text-gray-600 mt-1 whitespace-pre-wrap">\${n.message}</p>
                        <div class="text-xs text-gray-400 mt-2">\${new Date(n.created_at).toLocaleString('ja-JP')}</div>
                    </div>
                \`).join('');
            }

            function closeNotificationsModal() {
                document.getElementById('notificationsModal').classList.add('hidden');
            }

            async function markAsRead(id) {
                await axios.put(\`/api/admin/notifications/\${id}/read\`, {
                    read_by: localStorage.getItem('admin_name') || 'admin'
                });
                showNotifications();
                loadUnreadCount();
            }

            // 更新チェック実行
            async function checkUpdatesNow() {
                showToast('更新チェックを開始しています...', 'info');
                try {
                    const response = await axios.post('/api/subsidy-check-updates');
                    const result = response.data;
                    
                    const changes = result.results.filter(r => r.change_detected).length;
                    if (changes > 0) {
                        showToast(\`\${changes}件の更新が検知されました！\`, 'success');
                    } else {
                        showToast('更新はありませんでした', 'success');
                    }
                    
                    loadWatchUrls();
                    loadUpdateLogs();
                    loadUnreadCount();
                } catch (error) {
                    showToast('チェックに失敗しました: ' + error.message, 'error');
                }
            }

            // 監視URL追加
            function openAddUrlModal() {
                document.getElementById('addUrlModal').classList.remove('hidden');
            }
            function closeAddUrlModal() {
                document.getElementById('addUrlModal').classList.add('hidden');
                document.getElementById('addUrlForm').reset();
            }

            document.getElementById('addUrlForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                try {
                    await axios.post('/api/subsidy-watch-urls', data);
                    showToast('監視URLを追加しました');
                    closeAddUrlModal();
                    loadWatchUrls();
                } catch (error) {
                    showToast('追加に失敗しました', 'error');
                }
            });

            async function deleteWatchUrl(id) {
                if (!confirm('この監視URLを削除しますか？')) return;
                await axios.delete(\`/api/subsidy-watch-urls/\${id}\`);
                showToast('削除しました');
                loadWatchUrls();
            }

            // 更新ログステータス更新
            async function updateLogStatus(id, status) {
                await axios.put(\`/api/subsidy-update-logs/\${id}\`, {
                    status,
                    reviewed_by: localStorage.getItem('admin_name') || 'admin'
                });
                showToast('ステータスを更新しました');
            }

            // 公募要領追加
            function openAddGuidelineModal() {
                document.getElementById('addGuidelineModal').classList.remove('hidden');
            }
            function openAddGuidelineModalFor(subsidyTypeId) {
                document.getElementById('addGuidelineSubsidyType').value = subsidyTypeId;
                document.getElementById('addGuidelineModal').classList.remove('hidden');
            }
            function closeAddGuidelineModal() {
                document.getElementById('addGuidelineModal').classList.add('hidden');
                document.getElementById('addGuidelineForm').reset();
            }

            document.getElementById('addGuidelineForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                // 金額を円に変換
                if (data.max_amount) data.max_amount = parseInt(data.max_amount) * 10000;
                if (data.min_amount) data.min_amount = parseInt(data.min_amount) * 10000;
                
                try {
                    await axios.post('/api/subsidy-guidelines', data);
                    showToast('公募要領を追加しました');
                    closeAddGuidelineModal();
                    loadGuidelines();
                } catch (error) {
                    showToast('追加に失敗しました', 'error');
                }
            });
            
            // 公募要領編集
            function openEditGuidelineModal(g) {
                document.getElementById('editGuidelineId').value = g.id;
                document.getElementById('editGuidelineSubsidyName').value = g.subsidy_name || '-';
                document.getElementById('editGuidelineFiscalYear').value = g.fiscal_year || '';
                document.getElementById('editGuidelineVersion').value = g.version || '';
                document.getElementById('editGuidelineStartDate').value = g.application_start_date || '';
                document.getElementById('editGuidelineEndDate').value = g.application_end_date || '';
                document.getElementById('editGuidelineMaxAmount').value = g.max_amount ? g.max_amount / 10000 : '';
                document.getElementById('editGuidelineMinAmount').value = g.min_amount ? g.min_amount / 10000 : '';
                document.getElementById('editGuidelineSubsidyRate').value = g.subsidy_rate || '';
                document.getElementById('editGuidelineSourceUrl').value = g.source_url || '';
                document.getElementById('editGuidelinePdfUrl').value = g.pdf_url || '';
                document.getElementById('editGuidelineStatus').value = g.status || 'active';
                document.getElementById('editGuidelineModal').classList.remove('hidden');
            }
            function closeEditGuidelineModal() {
                document.getElementById('editGuidelineModal').classList.add('hidden');
                document.getElementById('editGuidelineForm').reset();
            }

            document.getElementById('editGuidelineForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                const id = data.id;
                delete data.id;
                
                // 金額を円に変換
                if (data.max_amount) data.max_amount = parseInt(data.max_amount) * 10000;
                if (data.min_amount) data.min_amount = parseInt(data.min_amount) * 10000;
                
                try {
                    await axios.put(\`/api/subsidy-guidelines/\${id}\`, data);
                    showToast('公募要領を更新しました');
                    closeEditGuidelineModal();
                    loadGuidelines();
                } catch (error) {
                    showToast('更新に失敗しました', 'error');
                }
            });
            
            // ステータス切り替え
            async function toggleGuidelineStatus(id, currentStatus) {
                const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
                const message = newStatus === 'active' ? '有効にしますか？' : '終了にしますか？';
                
                if (!confirm(message)) return;
                
                try {
                    await axios.patch(\`/api/subsidy-guidelines/\${id}/status\`, { status: newStatus });
                    showToast(\`ステータスを\${newStatus === 'active' ? '有効' : '終了'}に変更しました\`);
                    loadGuidelines();
                } catch (error) {
                    showToast('ステータス変更に失敗しました', 'error');
                }
            }
            
            // 公募要領削除
            async function deleteGuideline(id) {
                if (!confirm('この公募要領を削除しますか？\\n※この操作は取り消せません')) return;
                
                try {
                    await axios.delete(\`/api/subsidy-guidelines/\${id}\`);
                    showToast('公募要領を削除しました');
                    loadGuidelines();
                } catch (error) {
                    showToast('削除に失敗しました', 'error');
                }
            }

            // 初期読み込み
            loadSubsidyTypes();
            loadWatchUrls();
            loadUpdateLogs();
            loadGuidelines();
            loadUnreadCount();
        </script>
    </body>
    </html>
  `)
})

// ===============================
// バックアップ管理画面
// ===============================

app.get('/admin/backup', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>バックアップ管理 - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <!-- ヘッダー -->
            <header class="bg-amber-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <div class="flex items-center justify-between">
                        <h1 class="text-xl md:text-2xl font-bold">
                            <i class="fas fa-database mr-2"></i>
                            バックアップ管理
                        </h1>
                        <div class="flex items-center gap-4">
                            <a href="/" class="hover:underline text-sm">
                                <i class="fas fa-arrow-left mr-1"></i>
                                ダッシュボードに戻る
                            </a>
                            <button onclick="logout()" class="hover:underline text-sm">
                                <i class="fas fa-sign-out-alt mr-1"></i>
                                ログアウト
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <!-- メインコンテンツ -->
            <div class="container mx-auto px-4 py-8">
                <!-- 警告メッセージ -->
                <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded-r-lg">
                    <div class="flex items-start">
                        <i class="fas fa-exclamation-triangle text-yellow-500 mt-1 mr-3"></i>
                        <div>
                            <h3 class="font-bold text-yellow-800">注意事項</h3>
                            <p class="text-yellow-700 text-sm mt-1">
                                バックアップの復元（インポート）を行うと、既存のデータが上書きされます。<br>
                                必ず現在のデータをエクスポートしてから復元を行ってください。
                            </p>
                        </div>
                    </div>
                </div>

                <!-- データ概要 -->
                <div class="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 class="text-xl font-bold mb-4">
                        <i class="fas fa-chart-pie mr-2 text-amber-600"></i>
                        現在のデータ概要
                    </h2>
                    <div id="dataOverview" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div class="text-center py-8 col-span-full text-gray-500">
                            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                            <div>読み込み中...</div>
                        </div>
                    </div>
                </div>

                <!-- エクスポート -->
                <div class="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 class="text-xl font-bold mb-4">
                        <i class="fas fa-download mr-2 text-green-600"></i>
                        データエクスポート
                    </h2>
                    <p class="text-gray-600 mb-4">
                        全データをJSON形式でダウンロードします。バックアップとして保存してください。
                    </p>
                    <div class="flex flex-wrap gap-3">
                        <button onclick="exportAllData()" 
                                class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition">
                            <i class="fas fa-file-export mr-2"></i>
                            全データをエクスポート
                        </button>
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-info-circle mr-1"></i>
                            JSON形式でダウンロードされます
                        </div>
                    </div>
                </div>

                <!-- インポート -->
                <div class="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 class="text-xl font-bold mb-4">
                        <i class="fas fa-upload mr-2 text-blue-600"></i>
                        データインポート（復元）
                    </h2>
                    <p class="text-gray-600 mb-4">
                        エクスポートしたJSONファイルからデータを復元します。
                    </p>
                    
                    <!-- ファイル選択 -->
                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4 text-center hover:border-blue-500 transition cursor-pointer"
                         onclick="document.getElementById('backupFile').click()"
                         ondrop="handleFileDrop(event)"
                         ondragover="handleDragOver(event)"
                         ondragleave="handleDragLeave(event)"
                         id="dropZone">
                        <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
                        <p class="text-gray-600 mb-2">クリックしてファイルを選択、またはドラッグ＆ドロップ</p>
                        <p class="text-sm text-gray-400">対応形式: JSON (.json)</p>
                        <input type="file" id="backupFile" accept=".json" class="hidden" onchange="handleFileSelect(event)">
                    </div>
                    
                    <!-- 選択されたファイル情報 -->
                    <div id="selectedFileInfo" class="hidden bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <i class="fas fa-file-code text-blue-600 mr-3 text-xl"></i>
                                <div>
                                    <div id="selectedFileName" class="font-medium"></div>
                                    <div id="selectedFileSize" class="text-sm text-gray-500"></div>
                                </div>
                            </div>
                            <button onclick="clearSelectedFile()" class="text-gray-500 hover:text-red-600">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    <!-- プレビュー -->
                    <div id="backupPreview" class="hidden bg-gray-50 rounded-lg p-4 mb-4">
                        <h3 class="font-bold mb-3">
                            <i class="fas fa-eye mr-2"></i>
                            バックアップ内容プレビュー
                        </h3>
                        <div id="previewContent" class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        </div>
                        <div id="previewMeta" class="mt-3 pt-3 border-t text-xs text-gray-500">
                        </div>
                    </div>

                    <!-- インポートオプション -->
                    <div id="importOptions" class="hidden space-y-4 mb-4">
                        <h3 class="font-bold">
                            <i class="fas fa-cog mr-2"></i>
                            インポートオプション
                        </h3>
                        <div class="flex items-center">
                            <input type="checkbox" id="mergeMode" class="mr-2 h-4 w-4">
                            <label for="mergeMode" class="text-sm">
                                マージモード（既存データと統合、重複は上書き）
                            </label>
                        </div>
                        <div class="text-sm text-gray-500">
                            <i class="fas fa-info-circle mr-1"></i>
                            チェックしない場合、既存データはすべて削除されます
                        </div>
                    </div>

                    <!-- インポートボタン -->
                    <div class="flex flex-wrap gap-3">
                        <button id="importBtn" onclick="importData()" 
                                class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                                disabled>
                            <i class="fas fa-file-import mr-2"></i>
                            データを復元
                        </button>
                        <button id="selectiveImportBtn" onclick="openSelectiveImportModal()" 
                                class="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                                disabled>
                            <i class="fas fa-tasks mr-2"></i>
                            選択的インポート
                        </button>
                    </div>
                </div>

                <!-- インポート履歴（将来の拡張用） -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-bold mb-4">
                        <i class="fas fa-history mr-2 text-gray-600"></i>
                        バックアップのヒント
                    </h2>
                    <div class="grid md:grid-cols-2 gap-4 text-sm">
                        <div class="bg-green-50 p-4 rounded-lg">
                            <h3 class="font-bold text-green-800 mb-2">
                                <i class="fas fa-check-circle mr-1"></i>
                                推奨事項
                            </h3>
                            <ul class="text-green-700 space-y-1">
                                <li>• 定期的にバックアップを取得してください</li>
                                <li>• 重要な変更前にはバックアップを取得してください</li>
                                <li>• バックアップファイルは安全な場所に保存してください</li>
                                <li>• 複数のバックアップを保持することをお勧めします</li>
                            </ul>
                        </div>
                        <div class="bg-red-50 p-4 rounded-lg">
                            <h3 class="font-bold text-red-800 mb-2">
                                <i class="fas fa-exclamation-circle mr-1"></i>
                                注意事項
                            </h3>
                            <ul class="text-red-700 space-y-1">
                                <li>• 復元時は既存データが上書きされます</li>
                                <li>• バックアップファイルを他者と共有しないでください</li>
                                <li>• インポート中はブラウザを閉じないでください</li>
                                <li>• 大容量データの復元には時間がかかる場合があります</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 選択的インポートモーダル -->
        <div id="selectiveImportModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">
                        <i class="fas fa-tasks mr-2"></i>
                        選択的インポート
                    </h3>
                    <button onclick="closeSelectiveImportModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <p class="text-gray-600 mb-4">
                    復元するテーブルを選択してください。
                </p>
                <div id="tableSelectionList" class="grid grid-cols-2 gap-3 mb-4">
                </div>
                <div class="flex gap-3 pt-4 border-t">
                    <button onclick="selectAllTables()" class="text-blue-600 hover:text-blue-800 text-sm">
                        <i class="fas fa-check-double mr-1"></i>全て選択
                    </button>
                    <button onclick="deselectAllTables()" class="text-gray-600 hover:text-gray-800 text-sm">
                        <i class="fas fa-times mr-1"></i>全て解除
                    </button>
                </div>
                <div class="flex gap-3 pt-4">
                    <button onclick="executeSelectiveImport()" 
                            class="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700">
                        <i class="fas fa-file-import mr-2"></i>
                        選択したテーブルを復元
                    </button>
                    <button onclick="closeSelectiveImportModal()" 
                            class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400">
                        キャンセル
                    </button>
                </div>
            </div>
        </div>

        <!-- トースト通知 -->
        <div id="toast" class="hidden fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all transform translate-x-full">
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // 認証チェック
            if (!localStorage.getItem('admin_token')) {
                window.location.href = '/login';
            }
            
            // adminロールチェック
            const adminRole = localStorage.getItem('admin_role');
            if (adminRole !== 'admin') {
                alert('この機能は管理者のみ使用できます');
                window.location.href = '/';
            }
            
            function logout() {
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_name');
                window.location.href = '/login';
            }

            let selectedBackupData = null;

            const TABLE_LABELS = {
                admin_users: '管理ユーザー',
                subsidy_types: '助成金種別',
                subsidy_type_documents: '助成金種別書類',
                document_checklist: '書類チェックリスト',
                clients: '顧客',
                documents: 'アップロード書類',
                communications: 'コミュニケーション',
                subsidy_guidelines: '公募要領',
                subsidy_watch_urls: '監視URL',
                subsidy_update_logs: '更新ログ',
                admin_notifications: '通知',
                hearing_questions: 'ヒアリング質問',
                hearing_answers: 'ヒアリング回答',
                ai_chat_history: 'AIチャット履歴',
                document_templates: '文書テンプレート',
                generated_documents: '生成文書',
                document_section_edits: '文書編集履歴',
                success_cases: '採択事例',
                client_profiles: '顧客プロファイル',
                subsidy_match_scores: 'マッチングスコア'
            };

            // データ概要の読み込み
            async function loadDataOverview() {
                try {
                    const response = await axios.get('/api/backup/info');
                    const data = response.data;
                    
                    const overview = document.getElementById('dataOverview');
                    overview.innerHTML = \`
                        <div class="bg-blue-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-blue-600">\${data.summary.admin_users}</div>
                            <div class="text-xs text-gray-600">管理ユーザー</div>
                        </div>
                        <div class="bg-purple-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-purple-600">\${data.summary.subsidy_types}</div>
                            <div class="text-xs text-gray-600">助成金種別</div>
                        </div>
                        <div class="bg-green-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-green-600">\${data.summary.clients}</div>
                            <div class="text-xs text-gray-600">顧客</div>
                        </div>
                        <div class="bg-orange-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-orange-600">\${data.summary.documents}</div>
                            <div class="text-xs text-gray-600">アップロード書類</div>
                        </div>
                        <div class="bg-indigo-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-indigo-600">\${data.summary.generated_documents}</div>
                            <div class="text-xs text-gray-600">生成文書</div>
                        </div>
                        <div class="bg-amber-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-amber-600">\${data.summary.success_cases}</div>
                            <div class="text-xs text-gray-600">採択事例</div>
                        </div>
                    \`;
                } catch (error) {
                    console.error('Error loading data overview:', error);
                }
            }

            // エクスポート
            function exportAllData() {
                showToast('バックアップを作成中...', 'info');
                
                // ダウンロードリンクを作成
                const link = document.createElement('a');
                link.href = '/api/backup/export';
                link.download = \`subsidy_app_backup_\${new Date().toISOString().split('T')[0]}.json\`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => {
                    showToast('バックアップファイルのダウンロードが開始されました', 'success');
                }, 1000);
            }

            // ファイル選択
            function handleFileSelect(event) {
                const file = event.target.files[0];
                if (file) {
                    processFile(file);
                }
            }

            function handleDragOver(event) {
                event.preventDefault();
                document.getElementById('dropZone').classList.add('border-blue-500', 'bg-blue-50');
            }

            function handleDragLeave(event) {
                event.preventDefault();
                document.getElementById('dropZone').classList.remove('border-blue-500', 'bg-blue-50');
            }

            function handleFileDrop(event) {
                event.preventDefault();
                document.getElementById('dropZone').classList.remove('border-blue-500', 'bg-blue-50');
                
                const file = event.dataTransfer.files[0];
                if (file && file.type === 'application/json') {
                    processFile(file);
                } else {
                    showToast('JSONファイルを選択してください', 'error');
                }
            }

            function processFile(file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        if (!data.version || !data.tables) {
                            throw new Error('Invalid backup format');
                        }
                        
                        selectedBackupData = data;
                        
                        // ファイル情報表示
                        document.getElementById('selectedFileInfo').classList.remove('hidden');
                        document.getElementById('selectedFileName').textContent = file.name;
                        document.getElementById('selectedFileSize').textContent = formatFileSize(file.size);
                        
                        // プレビュー表示
                        showBackupPreview(data);
                        
                        // ボタン有効化
                        document.getElementById('importBtn').disabled = false;
                        document.getElementById('selectiveImportBtn').disabled = false;
                        document.getElementById('importOptions').classList.remove('hidden');
                        
                        showToast('バックアップファイルを読み込みました', 'success');
                    } catch (error) {
                        console.error('Parse error:', error);
                        showToast('無効なバックアップファイルです', 'error');
                    }
                };
                reader.readAsText(file);
            }

            function formatFileSize(bytes) {
                if (bytes < 1024) return bytes + ' bytes';
                if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            }

            function showBackupPreview(data) {
                document.getElementById('backupPreview').classList.remove('hidden');
                
                const previewContent = document.getElementById('previewContent');
                previewContent.innerHTML = Object.entries(data.tables)
                    .filter(([_, records]) => records.length > 0)
                    .map(([table, records]) => \`
                        <div class="bg-white rounded p-2 border">
                            <span class="font-medium">\${TABLE_LABELS[table] || table}</span>
                            <span class="text-blue-600 ml-2">\${records.length}件</span>
                        </div>
                    \`).join('');
                
                const previewMeta = document.getElementById('previewMeta');
                previewMeta.innerHTML = \`
                    <div>バックアップ日時: \${new Date(data.exported_at).toLocaleString('ja-JP')}</div>
                    <div>バージョン: \${data.version}</div>
                \`;
            }

            function clearSelectedFile() {
                selectedBackupData = null;
                document.getElementById('backupFile').value = '';
                document.getElementById('selectedFileInfo').classList.add('hidden');
                document.getElementById('backupPreview').classList.add('hidden');
                document.getElementById('importOptions').classList.add('hidden');
                document.getElementById('importBtn').disabled = true;
                document.getElementById('selectiveImportBtn').disabled = true;
            }

            // インポート実行
            async function importData() {
                if (!selectedBackupData) return;
                
                if (!confirm('本当にデータを復元しますか？\\n既存のデータは上書きされます。')) {
                    return;
                }
                
                showToast('データを復元中...', 'info');
                
                try {
                    const response = await axios.post('/api/backup/import', selectedBackupData);
                    const result = response.data;
                    
                    if (result.success) {
                        showToast('データの復元が完了しました', 'success');
                    } else {
                        showToast('一部のデータの復元に失敗しました', 'warning');
                    }
                    
                    // 結果表示
                    alert(\`復元結果:\\n\\n\${Object.entries(result.imported).map(([t, c]) => \`\${TABLE_LABELS[t] || t}: \${c}件\`).join('\\n')}\`);
                    
                    loadDataOverview();
                } catch (error) {
                    console.error('Import error:', error);
                    showToast('復元に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
                }
            }

            // 選択的インポート
            function openSelectiveImportModal() {
                if (!selectedBackupData) return;
                
                document.getElementById('selectiveImportModal').classList.remove('hidden');
                
                const list = document.getElementById('tableSelectionList');
                list.innerHTML = Object.entries(selectedBackupData.tables)
                    .filter(([_, records]) => records.length > 0)
                    .map(([table, records]) => \`
                        <label class="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                            <input type="checkbox" class="table-checkbox mr-3" value="\${table}">
                            <span class="flex-1">\${TABLE_LABELS[table] || table}</span>
                            <span class="text-sm text-gray-500">\${records.length}件</span>
                        </label>
                    \`).join('');
            }

            function closeSelectiveImportModal() {
                document.getElementById('selectiveImportModal').classList.add('hidden');
            }

            function selectAllTables() {
                document.querySelectorAll('.table-checkbox').forEach(cb => cb.checked = true);
            }

            function deselectAllTables() {
                document.querySelectorAll('.table-checkbox').forEach(cb => cb.checked = false);
            }

            async function executeSelectiveImport() {
                const selectedTables = Array.from(document.querySelectorAll('.table-checkbox:checked'))
                    .map(cb => cb.value);
                
                if (selectedTables.length === 0) {
                    showToast('復元するテーブルを選択してください', 'error');
                    return;
                }
                
                if (!confirm(\`選択した\${selectedTables.length}個のテーブルを復元しますか？\\n選択されたテーブルの既存データは上書きされます。\`)) {
                    return;
                }
                
                showToast('選択したデータを復元中...', 'info');
                
                try {
                    const mergeMode = document.getElementById('mergeMode').checked;
                    const response = await axios.post('/api/backup/import-selective', {
                        tables: selectedTables,
                        data: selectedBackupData,
                        merge_mode: mergeMode
                    });
                    const result = response.data;
                    
                    closeSelectiveImportModal();
                    
                    if (result.success) {
                        showToast('選択したデータの復元が完了しました', 'success');
                    } else {
                        showToast('一部のデータの復元に失敗しました', 'warning');
                    }
                    
                    alert(\`復元結果:\\n\\n\${Object.entries(result.imported).map(([t, c]) => \`\${TABLE_LABELS[t] || t}: \${c}件\`).join('\\n')}\`);
                    
                    loadDataOverview();
                } catch (error) {
                    console.error('Selective import error:', error);
                    showToast('復元に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
                }
            }

            // トースト通知
            function showToast(message, type = 'success') {
                const toast = document.getElementById('toast');
                const colors = {
                    success: 'bg-green-500 text-white',
                    error: 'bg-red-500 text-white',
                    warning: 'bg-yellow-500 text-white',
                    info: 'bg-blue-500 text-white'
                };
                
                toast.className = \`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all transform \${colors[type]}\`;
                toast.innerHTML = \`<i class="fas fa-\${type === 'success' ? 'check' : type === 'error' ? 'times' : type === 'warning' ? 'exclamation' : 'info'}-circle mr-2"></i>\${message}\`;
                toast.classList.remove('translate-x-full', 'hidden');
                
                setTimeout(() => {
                    toast.classList.add('translate-x-full');
                }, 3000);
            }

            // 初期読み込み
            loadDataOverview();
        </script>
    </body>
    </html>
  `)
})

// ===============================
// AI機能 API
// ===============================

// Gemini API呼び出しヘルパー（リトライ機能付き）
async function callGeminiAPI(prompt: string, apiKey: string, maxRetries = 3): Promise<string> {
  if (!apiKey) {
    // デモモード：APIキーがない場合はダミーレスポンス
    return `【デモモード】\n\nAPIキーが設定されていないため、実際のAI生成は行われません。\n\n本番環境では、以下のプロンプトに基づいてAIが文章を生成します：\n\n${prompt.substring(0, 200)}...`
  }
  
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // レート制限対策：リトライ時は待機
      if (attempt > 0) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000) // 2秒, 4秒, 最大10秒
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
            }
          })
        }
      )
      
      // 429（レート制限）または5xx（サーバーエラー）の場合はリトライ
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Gemini API error: ${response.status}`)
        console.error(`Gemini API attempt ${attempt + 1}/${maxRetries} failed: ${response.status}`)
        continue
      }
      
      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`)
      }
      
      const data = await response.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      
    } catch (error) {
      lastError = error as Error
      console.error(`Gemini API attempt ${attempt + 1}/${maxRetries} error:`, error)
    }
  }
  
  throw lastError || new Error('Gemini API failed after retries')
}

// ===============================
// ヒアリング質問API
// ===============================

// 補助金種別のヒアリング質問取得
app.get('/api/hearing-questions/:subsidyTypeId', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.param('subsidyTypeId')
  
  // 共通質問を取得（subsidy_type_id = 0）
  const commonQuestions = await DB.prepare(`
    SELECT * FROM hearing_questions 
    WHERE subsidy_type_id = 0
    ORDER BY display_order ASC
  `).all()
  
  // 補助金固有の質問を取得
  const specificQuestions = await DB.prepare(`
    SELECT * FROM hearing_questions 
    WHERE subsidy_type_id = ?
    ORDER BY display_order ASC
  `).bind(subsidyTypeId).all()
  
  const commonQs = commonQuestions.results || []
  const specificQs = specificQuestions.results || []
  
  // 固有質問がない場合は共通質問のみ返す
  if (specificQs.length === 0) {
    return c.json(commonQs)
  }
  
  // 質問テキストの正規化関数（重複検出用）
  // 質問の核心部分を抽出して比較
  const normalizeText = (text: string) => {
    let normalized = text
      .replace(/導入後|実現後/g, '効果')
      .replace(/御社|貴社/g, '会社')
      .replace(/[？?！!、。・\s]/g, '')
      .toLowerCase()
    return normalized
  }
  
  // キーワードベースの重複チェック（同じカテゴリの類似質問を検出）
  const getKeywords = (text: string): string[] => {
    const keywords: string[] = []
    if (/事業内容/.test(text)) keywords.push('事業内容')
    if (/従業員/.test(text)) keywords.push('従業員')
    if (/年商|売上/.test(text)) keywords.push('売上')
    if (/創業|設立/.test(text)) keywords.push('設立年')
    if (/課題|困っている/.test(text)) keywords.push('課題')
    if (/影響/.test(text)) keywords.push('影響')
    if (/効果|期待/.test(text) && /どのような/.test(text)) keywords.push('期待効果')
    if (/予算/.test(text)) keywords.push('予算')
    if (/ビジョン|5年後|3年後/.test(text)) keywords.push('ビジョン')
    return keywords
  }
  
  // 固有質問で既にカバーされているキーワードを収集
  const coveredKeywords = new Set<string>()
  specificQs.forEach(q => {
    getKeywords(q.question_text).forEach(k => coveredKeywords.add(k))
  })
  
  // 固有質問の正規化されたテキストセットを作成
  const specificTextSet = new Set(specificQs.map(q => normalizeText(q.question_text)))
  
  // 共通質問から重複を除外（テキスト一致 OR キーワード重複）
  const filteredCommonQs = commonQs.filter(q => {
    // 正規化テキストで完全一致する場合は除外
    if (specificTextSet.has(normalizeText(q.question_text))) return false
    // キーワードが既にカバーされている場合も除外
    const qKeywords = getKeywords(q.question_text)
    if (qKeywords.some(k => coveredKeywords.has(k))) return false
    return true
  })
  
  // 固有質問をベースにして、共通質問の固有に無いものを追加
  const mergedQuestions = [
    ...specificQs,  // 固有質問を優先
    ...filteredCommonQs  // 共通質問で重複していないもの
  ]
  
  // display_orderでソート
  mergedQuestions.sort((a, b) => a.display_order - b.display_order)
  
  return c.json(mergedQuestions)
})

// 顧客のヒアリング回答取得
app.get('/api/clients/:clientId/hearing-answers', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const result = await DB.prepare(`
    SELECT ha.*, hq.question_key, hq.question_text, hq.category
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
    ORDER BY hq.display_order
  `).bind(clientId).all()
  
  return c.json(result.results)
})

// ヒアリング回答保存（複数対応）
app.post('/api/clients/:clientId/hearing-answers', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  
  // question_keyとclient_profilesフィールドのマッピング
  const profileFieldMapping: Record<string, string> = {
    'employee_count': 'employee_count',
    'common_employee_count': 'employee_count',
    'annual_revenue': 'annual_revenue',
    'common_annual_revenue': 'annual_revenue',
    'establishment_year': 'establishment_year',
    'common_establishment_year': 'establishment_year',
    'company_overview': 'industry',  // 事業内容から業種を推定
    'common_company_overview': 'industry',
    'common_business_area': 'region',
    'current_issues': 'business_challenges',
    'common_current_issues': 'business_challenges',
    'common_what_to_achieve': 'investment_plans',
    'target_it_tool': 'investment_plans',
  }
  
  // プロファイル更新用データを収集
  const profileUpdates: Record<string, string> = {}
  
  // 回答を保存し、プロファイル更新データを収集する関数
  const saveAnswerAndCollectProfile = async (questionId: number, answerText: string) => {
    // 質問のquestion_keyを取得
    const question = await DB.prepare(`
      SELECT question_key FROM hearing_questions WHERE id = ?
    `).bind(questionId).first() as { question_key: string } | null
    
    if (question && profileFieldMapping[question.question_key] && answerText) {
      const field = profileFieldMapping[question.question_key]
      profileUpdates[field] = answerText
    }
    
    // 回答を保存
    const existing = await DB.prepare(`
      SELECT id FROM hearing_answers WHERE client_id = ? AND question_id = ?
    `).bind(clientId, questionId).first()
    
    if (existing) {
      await DB.prepare(`
        UPDATE hearing_answers 
        SET answer_text = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(answerText, (existing as any).id).run()
    } else {
      await DB.prepare(`
        INSERT INTO hearing_answers (client_id, question_id, answer_text)
        VALUES (?, ?, ?)
      `).bind(clientId, questionId, answerText).run()
    }
  }
  
  // 複数回答の一括保存
  if (data.answers && Array.isArray(data.answers)) {
    for (const answer of data.answers) {
      await saveAnswerAndCollectProfile(answer.question_id, answer.answer_text)
    }
  } else {
    // 単一回答の保存（後方互換性）
    await saveAnswerAndCollectProfile(data.question_id, data.answer_text)
  }
  
  // client_profilesを自動更新
  if (Object.keys(profileUpdates).length > 0) {
    const existingProfile = await DB.prepare(`
      SELECT id FROM client_profiles WHERE client_id = ?
    `).bind(clientId).first()
    
    if (existingProfile) {
      // 既存プロファイルを更新（null以外のフィールドのみ）
      const updates: string[] = []
      const values: any[] = []
      
      for (const [field, value] of Object.entries(profileUpdates)) {
        if (field === 'employee_count' || field === 'annual_revenue') {
          // 数値フィールド
          const numValue = parseInt(value.replace(/[^0-9]/g, ''))
          if (!isNaN(numValue)) {
            updates.push(`${field} = ?`)
            values.push(numValue)
          }
        } else if (field === 'establishment_year') {
          // 年のフィールド
          const yearMatch = value.match(/(\d{4})/)
          if (yearMatch) {
            updates.push(`${field} = ?`)
            values.push(parseInt(yearMatch[1]))
          }
        } else {
          updates.push(`${field} = ?`)
          values.push(value)
        }
      }
      
      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP')
        values.push(clientId)
        await DB.prepare(`
          UPDATE client_profiles SET ${updates.join(', ')} WHERE client_id = ?
        `).bind(...values).run()
      }
    } else {
      // 新規プロファイル作成
      const fields = ['client_id']
      const placeholders = ['?']
      const values: any[] = [clientId]
      
      for (const [field, value] of Object.entries(profileUpdates)) {
        fields.push(field)
        placeholders.push('?')
        
        if (field === 'employee_count' || field === 'annual_revenue') {
          const numValue = parseInt(value.replace(/[^0-9]/g, ''))
          values.push(isNaN(numValue) ? null : numValue)
        } else if (field === 'establishment_year') {
          const yearMatch = value.match(/(\d{4})/)
          values.push(yearMatch ? parseInt(yearMatch[1]) : null)
        } else {
          values.push(value)
        }
      }
      
      await DB.prepare(`
        INSERT INTO client_profiles (${fields.join(', ')}) VALUES (${placeholders.join(', ')})
      `).bind(...values).run()
    }
  }
  
  return c.json({ 
    saved: data.answers ? data.answers.length : 1,
    profile_updated: Object.keys(profileUpdates).length > 0
  })
})

// ===============================
// AIチャットAPI
// ===============================

// チャット履歴取得
app.get('/api/clients/:clientId/ai-chat', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const result = await DB.prepare(`
    SELECT * FROM ai_chat_history 
    WHERE client_id = ?
    ORDER BY created_at ASC
  `).bind(clientId).all()
  
  return c.json(result.results)
})

// AIチャット送信
app.post('/api/clients/:clientId/ai-chat', async (c) => {
  const { DB, GEMINI_API_KEY } = c.env
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  
  // ユーザーメッセージを保存
  await DB.prepare(`
    INSERT INTO ai_chat_history (client_id, role, content, context_type)
    VALUES (?, 'user', ?, ?)
  `).bind(clientId, data.message, data.context_type || 'hearing').run()
  
  // 顧客情報と補助金情報を取得
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(clientId).first()
  
  // 過去のチャット履歴を取得
  const chatHistory = await DB.prepare(`
    SELECT role, content FROM ai_chat_history 
    WHERE client_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).bind(clientId).all()
  
  // ヒアリング回答を取得
  const answers = await DB.prepare(`
    SELECT hq.question_text, ha.answer_text
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
  `).bind(clientId).all()
  
  // プロンプト構築
  const systemPrompt = `あなたは補助金申請を支援する親切なアドバイザーです。

【重要な回答ルール】
- マークダウン記法（**太字**、# 見出し、- 箇条書き）は使わないでください
- 自然な日本語の文章で回答してください
- 箇条書きが必要な場合は「・」や「1. 2. 3.」を使ってください
- 堅すぎず、親しみやすい口調で話してください
- 回答は簡潔に、要点を絞ってください（長くなりすぎないように）

【顧客情報】
顧客名: ${client?.name || '未設定'}
会社名: ${client?.company_name || '未設定'}
申請予定の補助金: ${client?.subsidy_name || '未設定'}

【これまでのヒアリング回答】
${(answers.results || []).map((a: any) => `Q: ${a.question_text}\nA: ${a.answer_text || '未回答'}`).join('\n\n')}

【直近の会話履歴】
${(chatHistory.results || []).reverse().map((m: any) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`).join('\n')}

上記を踏まえて、ユーザーの質問に分かりやすく回答してください。`

  const prompt = `${systemPrompt}\n\nユーザー: ${data.message}`
  
  try {
    const aiResponse = await callGeminiAPI(prompt, GEMINI_API_KEY)
    
    // AIレスポンスを保存
    await DB.prepare(`
      INSERT INTO ai_chat_history (client_id, role, content, context_type)
      VALUES (?, 'assistant', ?, ?)
    `).bind(clientId, aiResponse, data.context_type || 'hearing').run()
    
    return c.json({ response: aiResponse })
  } catch (error) {
    return c.json({ error: 'AI応答の生成に失敗しました', response: '申し訳ありません。一時的にAI機能が利用できません。しばらくしてからお試しください。' })
  }
})

// AI回答提案API
app.post('/api/clients/:clientId/ai-suggest', async (c) => {
  const { DB, GEMINI_API_KEY } = c.env
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  
  // 顧客情報と既存回答を取得
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(clientId).first() as any
  
  const answers = await DB.prepare(`
    SELECT hq.question_text, ha.answer_text
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
  `).bind(clientId).all()
  
  // 提出書類から抽出したデータを取得
  const profile = await DB.prepare(`
    SELECT * FROM client_profiles WHERE client_id = ?
  `).bind(clientId).first() as any
  
  // 財務データを取得
  const financialData = await DB.prepare(`
    SELECT * FROM client_financial_data WHERE client_id = ? ORDER BY fiscal_year DESC LIMIT 2
  `).bind(clientId).all()
  
  // プロファイル情報を整形
  let profileInfo = ''
  if (profile) {
    const profileItems = []
    if (profile.company_name) profileItems.push(`会社名: ${profile.company_name}`)
    if (profile.representative_name) profileItems.push(`代表者名: ${profile.representative_name}`)
    if (profile.establishment_date) profileItems.push(`設立日: ${profile.establishment_date}`)
    if (profile.capital_amount) profileItems.push(`資本金: ${Number(profile.capital_amount).toLocaleString()}円`)
    if (profile.employee_count) profileItems.push(`従業員数: ${profile.employee_count}名`)
    if (profile.business_description) profileItems.push(`事業内容: ${profile.business_description}`)
    if (profile.main_products) profileItems.push(`主要製品・サービス: ${profile.main_products}`)
    if (profile.address) profileItems.push(`所在地: ${profile.address}`)
    if (profileItems.length > 0) {
      profileInfo = `\n【登記簿・会社情報（書類から抽出）】\n${profileItems.join('\n')}`
    }
  }
  
  // 財務情報を整形
  let financialInfo = ''
  if (financialData.results && financialData.results.length > 0) {
    const financialItems = (financialData.results as any[]).map(fd => {
      const items = []
      if (fd.fiscal_year) items.push(`会計年度: ${fd.fiscal_year}`)
      if (fd.revenue) items.push(`売上高: ${Number(fd.revenue).toLocaleString()}円`)
      if (fd.operating_income) items.push(`営業利益: ${Number(fd.operating_income).toLocaleString()}円`)
      if (fd.ordinary_income) items.push(`経常利益: ${Number(fd.ordinary_income).toLocaleString()}円`)
      if (fd.net_income) items.push(`当期純利益: ${Number(fd.net_income).toLocaleString()}円`)
      if (fd.total_assets) items.push(`総資産: ${Number(fd.total_assets).toLocaleString()}円`)
      return items.join(', ')
    }).filter(s => s)
    if (financialItems.length > 0) {
      financialInfo = `\n【財務情報（決算書から抽出）】\n${financialItems.join('\n')}`
    }
  }
  
  const prompt = `あなたは補助金申請の回答作成を支援するアシスタントです。

【重要なルール】
- マークダウン記法は使わないでください
- 自然な日本語の文章で回答してください
- 補助金申請に適した具体的で説得力のある文章を書いてください
- 提出書類から抽出した情報（会社情報、財務データ）を積極的に活用してください
- 200〜300字程度で簡潔に回答してください

【顧客基本情報】
会社名: ${client?.company_name || '未設定'}
申請予定の補助金: ${client?.subsidy_name || '未設定'}
${profileInfo}
${financialInfo}

【既存の回答】
${(answers.results || []).map((a: any) => `${a.question_text}: ${a.answer_text || '未回答'}`).join('\n')}

以下の質問に対する回答例を作成してください。上記の会社情報や財務データを参考に、具体的な数字や事実を盛り込んでください。〇〇や△△などの箇所は、ユーザーが後で具体的な内容に置き換えられるようにしてください。

質問: ${data.question_text}`

  try {
    const suggestion = await callGeminiAPI(prompt, GEMINI_API_KEY)
    return c.json({ suggestion })
  } catch (error) {
    return c.json({ error: '提案の生成に失敗しました' }, 500)
  }
})

// ===============================
// 文書生成API
// ===============================

// テンプレート一覧取得
app.get('/api/document-templates', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT dt.*, st.name as subsidy_name
    FROM document_templates dt
    LEFT JOIN subsidy_types st ON dt.subsidy_type_id = st.id
    WHERE dt.is_active = 1
    ORDER BY dt.subsidy_type_id
  `).all()
  
  return c.json(result.results)
})

// 補助金種別のテンプレート取得
app.get('/api/document-templates/by-subsidy/:subsidyTypeId', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.param('subsidyTypeId')
  
  const result = await DB.prepare(`
    SELECT * FROM document_templates 
    WHERE subsidy_type_id = ? AND is_active = 1
    LIMIT 1
  `).bind(subsidyTypeId).first()
  
  return c.json(result)
})

// 生成済み文書一覧
app.get('/api/clients/:clientId/generated-documents', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const result = await DB.prepare(`
    SELECT gd.*, dt.template_name
    FROM generated_documents gd
    LEFT JOIN document_templates dt ON gd.template_id = dt.id
    WHERE gd.client_id = ?
    ORDER BY gd.created_at DESC
  `).bind(clientId).all()
  
  return c.json(result.results)
})

// 文書詳細取得
app.get('/api/generated-documents/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const doc = await DB.prepare(`
    SELECT gd.*, dt.template_name, dt.sections as template_sections
    FROM generated_documents gd
    LEFT JOIN document_templates dt ON gd.template_id = dt.id
    WHERE gd.id = ?
  `).bind(id).first()
  
  return c.json(doc)
})

// AI文書生成
app.post('/api/clients/:clientId/generate-document', async (c) => {
  const { DB, GEMINI_API_KEY } = c.env
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  
  // 顧客情報取得
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(clientId).first()
  
  if (!client) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  // テンプレート取得
  const template = await DB.prepare(`
    SELECT * FROM document_templates WHERE id = ?
  `).bind(data.template_id).first()
  
  if (!template) {
    return c.json({ error: 'テンプレートが見つかりません' }, 404)
  }
  
  // 公募要領情報取得
  const guidelines = await DB.prepare(`
    SELECT * FROM subsidy_guidelines 
    WHERE subsidy_type_id = ? AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
  `).bind(client.subsidy_type_id).first()
  
  // ヒアリング回答取得
  const answers = await DB.prepare(`
    SELECT hq.question_key, hq.question_text, hq.category, ha.answer_text
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
    ORDER BY hq.display_order
  `).bind(clientId).all()
  
  // 採択事例取得
  const successCases = await DB.prepare(`
    SELECT success_summary, key_factors 
    FROM success_cases 
    WHERE subsidy_type_id = ? AND is_public = 1
    LIMIT 3
  `).bind(client.subsidy_type_id).all()
  
  const sections = JSON.parse(template.sections)
  const generatedSections: Record<string, string> = {}
  
  // 補助金情報を整形
  const g = guidelines as any
  const guidelinesInfo = guidelines ? `
【補助金制度情報】
- 補助金名: ${client.subsidy_name}
- 年度・公募回: ${g?.fiscal_year || ''}年度 ${g?.version || ''}
- 補助率: ${g?.subsidy_rate || '未設定'}
- 補助上限額: ${g?.max_amount ? `${(g.max_amount / 10000).toLocaleString()}万円` : '未設定'}
- 補助下限額: ${g?.min_amount ? `${(g.min_amount / 10000).toLocaleString()}万円` : '未設定'}
- 対象経費: ${g?.target_expenses || '未設定'}
- 対象者要件: ${g?.eligibility_requirements || '未設定'}
- 申請期限: ${g?.application_end_date || '未設定'}` : `
【補助金制度情報】
- 補助金名: ${client.subsidy_name}
- その他詳細情報: 未登録`
  
  // 各セクションをAIで生成
  for (const section of sections) {
    const sectionPrompt = `${template.ai_prompt_base}

【顧客情報】
- 会社名: ${client.company_name || '未設定'}
- 顧客名: ${client.name}
- 申請補助金: ${client.subsidy_name}
${guidelinesInfo}

【ヒアリング回答】
${(answers.results || []).map((a: any) => `【${a.category}】${a.question_text}\n回答: ${a.answer_text || '未回答'}`).join('\n\n')}

【採択事例の成功ポイント（参考）】
${(successCases.results || []).map((c: any, i: number) => `事例${i+1}: ${c.success_summary}`).join('\n')}

【生成するセクション】
セクション名: ${section.title}
説明: ${section.description}
文字数上限: ${section.max_chars}文字

上記の情報を基に、このセクションの内容を生成してください。

【重要な出力ルール】
- マークダウン記法（太字、見出し、箇条書き記号、コードブロック等）は絶対に使用しないでください
- 箇条書きが必要な場合は「・」や「（1）」「①」などの記号を使用してください
- 改行と段落で構造化してください
- 具体的な数値を含めてください
- 補助率や補助上限額などの補助金制度情報を適切に文書に反映してください
- 審査員が納得できる論理的な説明を心がけてください
- 文字数は${section.max_chars}文字以内に収めてください
- 自然な日本語のビジネス文書として出力してください`

    try {
      const content = await callGeminiAPI(sectionPrompt, GEMINI_API_KEY)
      generatedSections[section.id] = content
    } catch (error) {
      generatedSections[section.id] = `【生成エラー】このセクションの生成に失敗しました。`
    }
  }
  
  // 生成文書を保存
  const result = await DB.prepare(`
    INSERT INTO generated_documents 
    (client_id, template_id, document_title, sections_content, ai_model_used)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    clientId,
    data.template_id,
    `${client.subsidy_name} 事業計画書 - ${client.company_name || client.name}`,
    JSON.stringify(generatedSections),
    'gemini-2.5-flash'
  ).run()
  
  return c.json({ 
    id: result.meta.last_row_id,
    sections: generatedSections
  })
})

// 文書セクション更新
app.put('/api/generated-documents/:id/sections/:sectionId', async (c) => {
  const { DB } = c.env
  const docId = c.req.param('id')
  const sectionId = c.req.param('sectionId')
  const data = await c.req.json()
  
  // 現在の文書取得
  const doc = await DB.prepare(`
    SELECT * FROM generated_documents WHERE id = ?
  `).bind(docId).first()
  
  if (!doc) {
    return c.json({ error: '文書が見つかりません' }, 404)
  }
  
  const sectionsContent = JSON.parse(doc.sections_content || '{}')
  const previousContent = sectionsContent[sectionId]
  
  // 編集履歴を保存
  await DB.prepare(`
    INSERT INTO document_section_edits 
    (document_id, section_id, previous_content, new_content, edit_type, editor_name, editor_comment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    docId,
    sectionId,
    previousContent,
    data.content,
    data.edit_type || 'manual',
    data.editor_name,
    data.editor_comment
  ).run()
  
  // セクション内容を更新
  sectionsContent[sectionId] = data.content
  
  await DB.prepare(`
    UPDATE generated_documents 
    SET sections_content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(JSON.stringify(sectionsContent), docId).run()
  
  return c.json({ success: true })
})

// 文書削除
app.delete('/api/generated-documents/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // 編集履歴も削除
  await DB.prepare(`
    DELETE FROM document_section_edits WHERE document_id = ?
  `).bind(id).run()
  
  // 文書を削除
  await DB.prepare(`
    DELETE FROM generated_documents WHERE id = ?
  `).bind(id).run()
  
  return c.json({ success: true })
})

// 文書ステータス更新
app.put('/api/generated-documents/:id/status', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE generated_documents 
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(data.status, id).run()
  
  return c.json({ success: true })
})

// セクション再生成
app.post('/api/generated-documents/:id/regenerate-section', async (c) => {
  const { DB, GEMINI_API_KEY } = c.env
  const docId = c.req.param('id')
  const data = await c.req.json()
  
  // 文書とテンプレート取得
  const doc = await DB.prepare(`
    SELECT gd.*, dt.sections as template_sections, dt.ai_prompt_base
    FROM generated_documents gd
    JOIN document_templates dt ON gd.template_id = dt.id
    WHERE gd.id = ?
  `).bind(docId).first()
  
  if (!doc) {
    return c.json({ error: '文書が見つかりません' }, 404)
  }
  
  const sections = JSON.parse(doc.template_sections)
  const section = sections.find((s: any) => s.id === data.section_id)
  
  if (!section) {
    return c.json({ error: 'セクションが見つかりません' }, 404)
  }
  
  // 顧客情報取得
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(doc.client_id).first()
  
  // ヒアリング回答取得
  const answers = await DB.prepare(`
    SELECT hq.question_text, hq.category, ha.answer_text
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
  `).bind(doc.client_id).all()
  
  const prompt = `${doc.ai_prompt_base}

【顧客情報】
- 会社名: ${client?.company_name || '未設定'}
- 申請補助金: ${client?.subsidy_name}

【ヒアリング回答】
${(answers.results || []).map((a: any) => `【${a.category}】${a.question_text}\n回答: ${a.answer_text || '未回答'}`).join('\n\n')}

【生成するセクション】
セクション名: ${section.title}
説明: ${section.description}
文字数上限: ${section.max_chars}文字

${data.additional_instructions ? `【追加指示】\n${data.additional_instructions}\n` : ''}

上記の情報を基に、このセクションの内容を再生成してください。

【重要な出力ルール】
- マークダウン記法（太字、見出し、箇条書き記号、コードブロック等）は絶対に使用しないでください
- 箇条書きが必要な場合は「・」や「（1）」「①」などの記号を使用してください
- 改行と段落で構造化してください
- 自然な日本語のビジネス文書として出力してください`

  try {
    const content = await callGeminiAPI(prompt, GEMINI_API_KEY)
    
    // セクション内容を更新
    const sectionsContent = JSON.parse(doc.sections_content || '{}')
    const previousContent = sectionsContent[data.section_id]
    sectionsContent[data.section_id] = content
    
    // 編集履歴を保存
    await DB.prepare(`
      INSERT INTO document_section_edits 
      (document_id, section_id, previous_content, new_content, edit_type, editor_name)
      VALUES (?, ?, ?, ?, 'ai_regenerate', ?)
    `).bind(docId, data.section_id, previousContent, content, data.editor_name || 'AI').run()
    
    await DB.prepare(`
      UPDATE generated_documents 
      SET sections_content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(JSON.stringify(sectionsContent), docId).run()
    
    return c.json({ content })
  } catch (error) {
    return c.json({ error: '再生成に失敗しました' }, 500)
  }
})

// ===============================
// 採択事例API
// ===============================

app.get('/api/success-cases', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.query('subsidy_type_id')
  
  let query = `
    SELECT sc.*, st.name as subsidy_name
    FROM success_cases sc
    LEFT JOIN subsidy_types st ON sc.subsidy_type_id = st.id
    WHERE sc.is_public = 1
  `
  
  if (subsidyTypeId) {
    query += ` AND sc.subsidy_type_id = ${subsidyTypeId}`
  }
  
  query += ` ORDER BY sc.fiscal_year DESC`
  
  const result = await DB.prepare(query).all()
  
  return c.json(result.results)
})

// ===============================
// 補助金マッチングAPI
// ===============================

// 企業プロファイル取得/作成
app.get('/api/clients/:clientId/profile', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const profile = await DB.prepare(`
    SELECT * FROM client_profiles WHERE client_id = ?
  `).bind(clientId).first()
  
  return c.json(profile || {})
})

app.put('/api/clients/:clientId/profile', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  
  // 既存プロファイル確認
  const existing = await DB.prepare(`
    SELECT id FROM client_profiles WHERE client_id = ?
  `).bind(clientId).first()
  
  if (existing) {
    await DB.prepare(`
      UPDATE client_profiles SET
        industry = ?, employee_count = ?, annual_revenue = ?,
        establishment_year = ?, region = ?,
        business_challenges = ?, investment_plans = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE client_id = ?
    `).bind(
      data.industry,
      data.employee_count,
      data.annual_revenue,
      data.establishment_year,
      data.region,
      JSON.stringify(data.business_challenges || []),
      JSON.stringify(data.investment_plans || []),
      clientId
    ).run()
  } else {
    await DB.prepare(`
      INSERT INTO client_profiles 
      (client_id, industry, employee_count, annual_revenue, establishment_year, region, business_challenges, investment_plans)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      clientId,
      data.industry,
      data.employee_count,
      data.annual_revenue,
      data.establishment_year,
      data.region,
      JSON.stringify(data.business_challenges || []),
      JSON.stringify(data.investment_plans || [])
    ).run()
  }
  
  return c.json({ success: true })
})

// 補助金マッチング実行
app.post('/api/clients/:clientId/match-subsidies', async (c) => {
  const { DB, GEMINI_API_KEY } = c.env
  const clientId = c.req.param('clientId')
  
  // 顧客プロファイル取得
  const profile = await DB.prepare(`
    SELECT * FROM client_profiles WHERE client_id = ?
  `).bind(clientId).first()
  
  // ヒアリング回答取得
  const answers = await DB.prepare(`
    SELECT hq.question_text, ha.answer_text
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
  `).bind(clientId).all()
  
  // 全補助金種別取得
  const subsidies = await DB.prepare(`
    SELECT st.*, sg.max_amount, sg.min_amount, sg.subsidy_rate, sg.application_end_date
    FROM subsidy_types st
    LEFT JOIN subsidy_guidelines sg ON st.id = sg.subsidy_type_id AND sg.status = 'active'
  `).all()
  
  const matchResults = []
  
  for (const subsidy of (subsidies.results || [])) {
    // AIでマッチングスコアを計算
    const prompt = `以下の企業情報と補助金の適合性を0-100のスコアで評価し、JSON形式で回答してください。

【企業情報】
- 業種: ${profile?.industry || '不明'}
- 従業員数: ${profile?.employee_count || '不明'}
- 年商: ${profile?.annual_revenue ? profile.annual_revenue + '万円' : '不明'}
- 所在地: ${profile?.region || '不明'}
- 経営課題: ${profile?.business_challenges || '不明'}
- 投資計画: ${profile?.investment_plans || '不明'}

【ヒアリング情報】
${(answers.results || []).map((a: any) => `${a.question_text}: ${a.answer_text || '未回答'}`).join('\n')}

【補助金情報】
- 名称: ${subsidy.name}
- カテゴリ: ${subsidy.category}
- 説明: ${subsidy.description}
- 上限額: ${subsidy.max_amount ? (subsidy.max_amount / 10000) + '万円' : '不明'}
- 補助率: ${subsidy.subsidy_rate || '不明'}

以下のJSON形式で回答してください：
{
  "score": 0-100の整数,
  "adoption_probability": 0-100の整数（採択可能性%）,
  "recommendation": "この企業にこの補助金をお勧めする理由または懸念点（100文字以内）",
  "key_points": ["ポイント1", "ポイント2"]
}`

    try {
      const response = await callGeminiAPI(prompt, GEMINI_API_KEY)
      
      // JSONを抽出してクリーニング
      let jsonStr = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
      const startIdx = jsonStr.indexOf('{')
      const endIdx = jsonStr.lastIndexOf('}')
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonStr = jsonStr.substring(startIdx, endIdx + 1)
      }
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ')
      
      if (jsonStr) {
        const result = JSON.parse(jsonStr)
        
        // スコアを保存
        await DB.prepare(`
          INSERT OR REPLACE INTO subsidy_match_scores 
          (client_id, subsidy_type_id, match_score, adoption_probability, ai_recommendation, score_breakdown)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          clientId,
          subsidy.id,
          result.score,
          result.adoption_probability,
          result.recommendation,
          JSON.stringify(result.key_points)
        ).run()
        
        matchResults.push({
          subsidy_id: subsidy.id,
          subsidy_name: subsidy.name,
          category: subsidy.category,
          ...result
        })
      }
    } catch (error) {
      // エラーの場合はデフォルトスコア
      matchResults.push({
        subsidy_id: subsidy.id,
        subsidy_name: subsidy.name,
        category: subsidy.category,
        score: 50,
        recommendation: '自動評価に失敗しました。手動で確認してください。'
      })
    }
  }
  
  // スコア順にソート
  matchResults.sort((a, b) => (b.score || 0) - (a.score || 0))
  
  return c.json(matchResults)
})

// マッチングスコア取得
app.get('/api/clients/:clientId/match-scores', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const result = await DB.prepare(`
    SELECT sms.*, st.name as subsidy_name, st.category
    FROM subsidy_match_scores sms
    JOIN subsidy_types st ON sms.subsidy_type_id = st.id
    WHERE sms.client_id = ?
    ORDER BY sms.match_score DESC
  `).bind(clientId).all()
  
  return c.json(result.results)
})

// ===============================
// 編集履歴API
// ===============================

// 文書の編集履歴取得
app.get('/api/generated-documents/:id/edit-history', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const result = await DB.prepare(`
    SELECT * FROM document_section_edits 
    WHERE document_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(id).all()
  
  return c.json(result.results)
})

// AI分析：セクション品質チェック
app.post('/api/generated-documents/:id/analyze-quality', async (c) => {
  const { DB, GEMINI_API_KEY } = c.env
  const id = c.req.param('id')
  
  // 文書取得
  const doc = await DB.prepare(`
    SELECT gd.*, dt.sections as template_sections
    FROM generated_documents gd
    JOIN document_templates dt ON gd.template_id = dt.id
    WHERE gd.id = ?
  `).bind(id).first()
  
  if (!doc) {
    return c.json({ error: '文書が見つかりません' }, 404)
  }
  
  const sections = JSON.parse(doc.template_sections || '[]')
  const content = JSON.parse(doc.sections_content || '{}')
  
  const prompt = `以下の補助金申請書の品質を分析してください。
各セクションについて、10点満点でスコアと改善点を日本語で回答してください。

${sections.map((s: any) => `
【${s.title}】(上限${s.max_chars}文字)
${content[s.id] || '未入力'}
`).join('\n')}

JSON形式で回答してください：
{
  "overall_score": 全体スコア(10点満点),
  "sections": {
    "セクションID": {
      "score": スコア(10点満点),
      "issues": ["問題点1", "問題点2"],
      "improvements": ["改善提案1", "改善提案2"]
    }
  },
  "summary": "全体の総評（100文字以内）"
}`

  try {
    const response = await callGeminiAPI(prompt, GEMINI_API_KEY)
    
    // JSONを抽出してクリーニング
    let jsonStr = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
    const startIdx = jsonStr.indexOf('{')
    const endIdx = jsonStr.lastIndexOf('}')
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1)
    }
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ')
    
    if (jsonStr) {
      const result = JSON.parse(jsonStr)
      return c.json(JSON.parse(jsonMatch[0]))
    }
    return c.json({ error: 'AI分析の解析に失敗しました' }, 500)
  } catch (error) {
    return c.json({ error: 'AI分析に失敗しました' }, 500)
  }
})

// ===============================
// フェーズ4: 採択率予測システム強化
// ===============================

// 詳細な採択率予測API
app.post('/api/clients/:clientId/predict-adoption', async (c) => {
  const { DB, GEMINI_API_KEY } = c.env
  const clientId = c.req.param('clientId')
  
  // 顧客情報取得
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name, st.category, st.description as subsidy_description
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(clientId).first()
  
  if (!client) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  // 企業プロファイル取得
  const profile = await DB.prepare(`
    SELECT * FROM client_profiles WHERE client_id = ?
  `).bind(clientId).first()
  
  // ヒアリング回答取得
  const answers = await DB.prepare(`
    SELECT hq.question_key, hq.question_text, hq.category, ha.answer_text
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
  `).bind(clientId).all()
  
  // 採択事例取得（同じ補助金）
  const successCases = await DB.prepare(`
    SELECT * FROM success_cases 
    WHERE subsidy_type_id = ? AND is_public = 1
    ORDER BY fiscal_year DESC
    LIMIT 5
  `).bind(client.subsidy_type_id).all()
  
  // 公募要領取得
  const guideline = await DB.prepare(`
    SELECT * FROM subsidy_guidelines 
    WHERE subsidy_type_id = ? AND status = 'active'
    LIMIT 1
  `).bind(client.subsidy_type_id).first()
  
  // 生成文書の有無確認
  const generatedDocs = await DB.prepare(`
    SELECT COUNT(*) as count FROM generated_documents WHERE client_id = ?
  `).bind(clientId).first()
  
  const answeredQuestions = (answers.results || []).filter((a: any) => a.answer_text).length
  const totalQuestions = (answers.results || []).length || 1
  
  const prompt = `あなたは補助金審査の専門家です。以下の情報を基に、この企業の補助金採択可能性を詳細に分析してください。

【申請補助金】
- 名称: ${client.subsidy_name || '未選択'}
- カテゴリ: ${client.category || '不明'}
- 説明: ${client.subsidy_description || ''}
${guideline ? `
- 補助率: ${guideline.subsidy_rate || '不明'}
- 上限額: ${guideline.max_amount ? (guideline.max_amount / 10000) + '万円' : '不明'}
- 申請締切: ${guideline.application_end_date || '不明'}
` : ''}

【企業情報】
- 会社名: ${client.company_name || '未設定'}
- 担当者: ${client.name}
- 業種: ${profile?.industry || '不明'}
- 従業員数: ${profile?.employee_count || '不明'}人
- 年商: ${profile?.annual_revenue ? profile.annual_revenue + '万円' : '不明'}
- 設立年: ${profile?.establishment_year || '不明'}
- 所在地: ${profile?.region || '不明'}
- 経営課題: ${profile?.business_challenges || '不明'}
- 投資計画: ${profile?.investment_plans || '不明'}

【ヒアリング情報】（回答率: ${Math.round(answeredQuestions / totalQuestions * 100)}%）
${(answers.results || []).map((a: any) => `【${a.category}】${a.question_text}\n回答: ${a.answer_text || '（未回答）'}`).join('\n\n')}

【申請書作成状況】
- 生成済み文書数: ${generatedDocs?.count || 0}件

【類似企業の採択事例】（参考）
${(successCases.results || []).slice(0, 3).map((c: any, i: number) => `
事例${i+1}: ${c.company_industry}（${c.company_size}）
- 成功ポイント: ${c.success_summary}
- 成功要因: ${c.key_factors}
`).join('')}

上記を総合的に分析し、以下のJSON形式で回答してください：
{
  "adoption_probability": 0-100の整数（採択可能性%）,
  "confidence_level": "high" | "medium" | "low"（予測の確信度）,
  "overall_assessment": "S" | "A" | "B" | "C" | "D"（総合評価）,
  "score_breakdown": {
    "eligibility": { "score": 0-100, "comment": "申請資格に関するコメント" },
    "business_plan": { "score": 0-100, "comment": "事業計画に関するコメント" },
    "innovation": { "score": 0-100, "comment": "革新性に関するコメント" },
    "feasibility": { "score": 0-100, "comment": "実現可能性に関するコメント" },
    "expected_effect": { "score": 0-100, "comment": "期待効果に関するコメント" }
  },
  "strengths": ["強み1", "強み2", "強み3"],
  "weaknesses": ["弱み1", "弱み2"],
  "improvement_suggestions": [
    { "priority": "high" | "medium" | "low", "suggestion": "具体的な改善提案", "expected_impact": "改善による効果" }
  ],
  "similar_success_rate": "類似企業の採択率の目安（%）",
  "key_success_factors": ["採択に向けて特に重要なポイント1", "ポイント2"],
  "risk_factors": ["リスク要因1", "リスク要因2"],
  "recommended_actions": ["今すぐ実行すべきアクション1", "アクション2", "アクション3"]
}`

  try {
    const response = await callGeminiAPI(prompt, GEMINI_API_KEY)
    
    // JSONを抽出してクリーニング
    let jsonStr = response
    // マークダウンのコードブロックを除去
    jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
    // 最初の { から最後の } までを抽出
    const startIdx = jsonStr.indexOf('{')
    const endIdx = jsonStr.lastIndexOf('}')
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1)
    }
    // 制御文字を除去
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ')
    
    if (jsonStr) {
      const result = JSON.parse(jsonStr)
      
      // 予測結果をDBに保存
      await DB.prepare(`
        INSERT OR REPLACE INTO subsidy_match_scores 
        (client_id, subsidy_type_id, match_score, adoption_probability, ai_recommendation, score_breakdown, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        clientId,
        client.subsidy_type_id,
        result.adoption_probability,
        result.adoption_probability,
        result.overall_assessment + ': ' + (result.improvement_suggestions?.[0]?.suggestion || ''),
        JSON.stringify(result.score_breakdown)
      ).run()
      
      return c.json({
        success: true,
        prediction: result,
        metadata: {
          client_id: clientId,
          subsidy_name: client.subsidy_name,
          analyzed_at: new Date().toISOString(),
          data_completeness: Math.round(answeredQuestions / totalQuestions * 100)
        }
      })
    }
    
    // JSON解析に失敗した場合のフォールバック
    return c.json({ 
      error: 'AI分析の解析に失敗しました',
      prediction: {
        adoption_probability: 50,
        confidence_level: 'low',
        overall_assessment: 'C',
        improvement_suggestions: [{ priority: 'high', suggestion: 'ヒアリング情報を充実させてください', expected_impact: '予測精度の向上' }]
      }
    }, 500)
  } catch (error: any) {
    console.error('Predict adoption error:', error?.message || error)
    
    // エラー時でもできる限り有用な情報を返す
    const dataCompleteness = Math.round(answeredQuestions / totalQuestions * 100)
    const hasProfile = !!(profile?.industry || profile?.employee_count)
    
    // 簡易的な評価を生成
    let estimatedProbability = 30 // ベース
    let assessment = 'D'
    
    if (dataCompleteness >= 80) {
      estimatedProbability += 30
      assessment = 'B'
    } else if (dataCompleteness >= 50) {
      estimatedProbability += 15
      assessment = 'C'
    }
    
    if (hasProfile) {
      estimatedProbability += 10
    }
    
    if (generatedDocs?.count > 0) {
      estimatedProbability += 10
    }
    
    return c.json({ 
      success: true,
      error: 'AI分析が一時的に利用できません。簡易評価を表示しています。',
      prediction: {
        adoption_probability: Math.min(estimatedProbability, 70),
        confidence_level: 'low',
        overall_assessment: assessment,
        score_breakdown: {
          eligibility: { score: hasProfile ? 50 : 20, comment: hasProfile ? '基本情報が登録されています' : '企業情報が不足しています' },
          business_plan: { score: dataCompleteness >= 50 ? 50 : 20, comment: `ヒアリング回答率: ${dataCompleteness}%` },
          innovation: { score: 30, comment: 'AI分析が必要です' },
          feasibility: { score: 30, comment: 'AI分析が必要です' },
          expected_effect: { score: 30, comment: 'AI分析が必要です' }
        },
        strengths: dataCompleteness >= 50 ? ['ヒアリング情報が一定量入力されています'] : ['現時点では特定できません'],
        weaknesses: [
          ...(hasProfile ? [] : ['企業プロファイルが未入力です']),
          ...(dataCompleteness < 50 ? ['ヒアリング情報が不足しています'] : []),
          ...(generatedDocs?.count === 0 ? ['申請書類が未作成です'] : [])
        ],
        improvement_suggestions: [
          ...(hasProfile ? [] : [{ priority: 'high', suggestion: '企業プロファイルを入力してください', expected_impact: '申請資格の確認が可能になります' }]),
          ...(dataCompleteness < 80 ? [{ priority: 'high', suggestion: 'ヒアリング質問に回答してください', expected_impact: '採択率予測の精度が向上します' }] : []),
          { priority: 'medium', suggestion: '後ほど再度AI分析を実行してください', expected_impact: 'より詳細な分析結果を取得できます' }
        ],
        similar_success_rate: 'AI分析が必要です',
        key_success_factors: ['ヒアリング情報の充実', '企業情報の詳細入力', '申請書類の準備'],
        risk_factors: ['情報不足による低評価', 'AI分析未完了'],
        recommended_actions: ['ヒアリング質問への回答を完了させる', '企業プロファイルを入力する', '後ほど再度分析を実行する']
      },
      metadata: {
        client_id: clientId,
        subsidy_name: client.subsidy_name,
        analyzed_at: new Date().toISOString(),
        data_completeness: dataCompleteness,
        is_fallback: true
      }
    })
  }
})

// ===============================
// フェーズ4: 複数補助金マッチング強化
// ===============================

// 全補助金との詳細マッチング分析
app.post('/api/clients/:clientId/comprehensive-matching', async (c) => {
  const { DB, GEMINI_API_KEY } = c.env
  const clientId = c.req.param('clientId')
  
  // 顧客情報取得
  const client = await DB.prepare(`
    SELECT * FROM clients WHERE id = ?
  `).bind(clientId).first()
  
  if (!client) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  // 企業プロファイル
  const profile = await DB.prepare(`
    SELECT * FROM client_profiles WHERE client_id = ?
  `).bind(clientId).first()
  
  // ヒアリング回答
  const answers = await DB.prepare(`
    SELECT hq.question_text, hq.category, ha.answer_text
    FROM hearing_answers ha
    JOIN hearing_questions hq ON ha.question_id = hq.id
    WHERE ha.client_id = ?
  `).bind(clientId).all()
  
  // 全補助金種別と公募要領
  const subsidies = await DB.prepare(`
    SELECT st.*, sg.max_amount, sg.min_amount, sg.subsidy_rate, 
           sg.application_start_date, sg.application_end_date, sg.status as guideline_status
    FROM subsidy_types st
    LEFT JOIN subsidy_guidelines sg ON st.id = sg.subsidy_type_id AND sg.status = 'active'
  `).all()
  
  const prompt = `あなたは補助金コンサルタントの専門家です。以下の企業情報を基に、利用可能な全ての補助金との適合性を詳細に分析してください。

【企業情報】
- 会社名: ${client.company_name || '未設定'}
- 業種: ${profile?.industry || '不明'}
- 従業員数: ${profile?.employee_count || '不明'}人
- 年商: ${profile?.annual_revenue ? profile.annual_revenue + '万円' : '不明'}
- 設立年: ${profile?.establishment_year || '不明'}年
- 所在地: ${profile?.region || '不明'}
- 経営課題: ${profile?.business_challenges || '不明'}
- 投資計画: ${profile?.investment_plans || '不明'}

【ヒアリング情報】
${(answers.results || []).map((a: any) => `【${a.category}】${a.question_text}\n回答: ${a.answer_text || '未回答'}`).join('\n\n')}

【利用可能な補助金一覧】
${(subsidies.results || []).map((s: any) => `
- ${s.name}（${s.category}）
  説明: ${s.description || ''}
  補助率: ${s.subsidy_rate || '不明'}
  上限額: ${s.max_amount ? (s.max_amount / 10000) + '万円' : '不明'}
  申請期間: ${s.application_start_date || '?'} 〜 ${s.application_end_date || '?'}
`).join('')}

企業に最も適した補助金を上位3件選び、以下のJSON形式のみで回答してください。
必ずJSONのみを出力してください。説明文や前置きは一切不要です。recommendationsは必ず3件以下にしてください。

{"company_summary":"企業の特徴（50字以内）","recommendations":[{"subsidy_name":"補助金名","match_score":50,"adoption_probability":50,"application_complexity":"普通","rank":1,"reasons":["理由1"],"concerns":["懸念点1"],"estimated_amount":"100万円","compatibility":{"eligibility":{"met":true,"detail":"申請資格あり"},"timing":{"status":"申請可能"}}}],"overall_strategy":"補助金活用戦略（50字以内）","priority_actions":["アクション1","アクション2"]}`

  try {
    const response = await callGeminiAPI(prompt, GEMINI_API_KEY)
    
    // JSONを抽出してクリーニング
    let jsonStr = response
    jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
    const startIdx = jsonStr.indexOf('{')
    const endIdx = jsonStr.lastIndexOf('}')
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1)
    }
    // 制御文字と問題のある文字を除去
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ')
    // 改行を削除してJSONを整形
    jsonStr = jsonStr.replace(/\n/g, ' ').replace(/\r/g, ' ')
    // 複数スペースを1つに
    jsonStr = jsonStr.replace(/\s+/g, ' ')
    
    let result = null
    try {
      result = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('JSON parse error, trying to fix:', parseError)
      // 一般的なJSON修正を試みる
      jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
      result = JSON.parse(jsonStr)
    }
    
    if (result) {
      
      // 各補助金のスコアをDBに保存
      for (const rec of (result.recommendations || [])) {
        const subsidy = (subsidies.results || []).find((s: any) => s.name === rec.subsidy_name)
        if (subsidy) {
          await DB.prepare(`
            INSERT OR REPLACE INTO subsidy_match_scores 
            (client_id, subsidy_type_id, match_score, adoption_probability, ai_recommendation, score_breakdown, calculated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            clientId,
            subsidy.id,
            rec.match_score || 50,
            rec.adoption_probability || rec.match_score || 50,
            rec.reasons?.join(', ') || '',
            JSON.stringify(rec.compatibility || {})
          ).run()
        }
      }
      
      return c.json({
        success: true,
        analysis: result,
        metadata: {
          client_id: clientId,
          analyzed_at: new Date().toISOString(),
          subsidies_analyzed: subsidies.results?.length || 0
        }
      })
    }
    
    // JSON解析失敗時のフォールバック
    return c.json({
      success: true,
      analysis: {
        company_summary: '企業情報を分析中です。詳細な分析にはヒアリング情報の充実が必要です。',
        recommendations: (subsidies.results || []).slice(0, 5).map((s: any, i: number) => ({
          subsidy_name: s.name,
          match_score: 50,
          adoption_probability: 50,
          rank: i + 1,
          compatibility: {
            eligibility: { met: true, detail: '詳細確認が必要です' },
            business_fit: { score: 50, detail: 'ヒアリング情報をもとに再分析してください' },
            timing: { status: '要確認', deadline_days: null }
          },
          reasons: ['基本的な要件は満たしている可能性があります'],
          concerns: ['詳細情報が不足しているため正確な判定ができません'],
          preparation_steps: ['ヒアリング質問に回答してください', '企業プロファイルを充実させてください'],
          estimated_amount: '要算出',
          application_complexity: '普通'
        })),
        overall_strategy: 'まずはヒアリング質問への回答を完了させ、企業プロファイルを充実させてください。その後、再度分析を実行することでより精度の高い結果が得られます。',
        priority_actions: ['ヒアリング質問に回答する', '企業プロファイルを更新する', '再度総合分析を実行する']
      },
      metadata: {
        client_id: clientId,
        analyzed_at: new Date().toISOString(),
        subsidies_analyzed: subsidies.results?.length || 0,
        partial: true
      }
    })
  } catch (error: any) {
    console.error('Comprehensive matching error:', error)
    
    // エラー時でもできる限り有用なフォールバックを返す
    const subsidyList = (subsidies.results || []).slice(0, 3)
    
    return c.json({
      success: true,
      error: 'AI分析が一時的に利用できません。基本的な補助金情報を表示しています。',
      analysis: {
        company_summary: client.company_name ? `${client.company_name}様の補助金候補` : '補助金候補一覧',
        recommendations: subsidyList.map((s: any, i: number) => ({
          subsidy_name: s.name,
          match_score: 50,
          adoption_probability: 50,
          application_complexity: '普通',
          rank: i + 1,
          reasons: [`${s.category}カテゴリの補助金です`, s.description ? s.description.substring(0, 50) + '...' : '詳細は公募要領をご確認ください'],
          concerns: ['詳細な適合性分析にはAI分析が必要です'],
          estimated_amount: s.max_amount ? `最大${(s.max_amount / 10000).toLocaleString()}万円` : '要確認',
          compatibility: { eligibility: { met: true, detail: '要確認' }, timing: { status: '要確認' } }
        })),
        overall_strategy: 'AI分析が一時的に利用できないため、基本的な補助金情報を表示しています。後ほど再度「総合分析」を実行してください。',
        priority_actions: [
          'ヒアリング質問への回答を完了させる',
          '企業プロファイルを充実させる', 
          '後ほど再度総合分析を実行する'
        ]
      },
      metadata: {
        client_id: clientId,
        analyzed_at: new Date().toISOString(),
        subsidies_analyzed: subsidies.results?.length || 0,
        is_fallback: true,
        error_type: error?.message?.includes('429') ? 'rate_limit' : 'unknown'
      }
    })
  }
})

// ===============================
// フェーズ4: Cronジョブ（公募要領自動監視）
// ===============================

// Cronトリガーエンドポイント（Cloudflare Workers Cron Triggers用）
app.get('/api/cron/check-guideline-updates', async (c) => {
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
app.get('/api/cron/history', async (c) => {
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

// ===============================
// フェーズ4: エクスポート機能（PDF/Word）
// ===============================

// 文書エクスポートAPI（HTML形式 - PDF/Word変換用）
app.get('/api/generated-documents/:id/export', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const format = c.req.query('format') || 'html'
  
  // 文書取得
  const doc = await DB.prepare(`
    SELECT gd.*, dt.template_name, dt.sections as template_sections,
           c.name as client_name, c.company_name,
           st.name as subsidy_name
    FROM generated_documents gd
    JOIN document_templates dt ON gd.template_id = dt.id
    JOIN clients c ON gd.client_id = c.id
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE gd.id = ?
  `).bind(id).first()
  
  if (!doc) {
    return c.json({ error: '文書が見つかりません' }, 404)
  }
  
  const sections = JSON.parse(doc.template_sections || '[]')
  const content = JSON.parse(doc.sections_content || '{}')
  
  // HTML形式で生成
  const htmlContent = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.document_title}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
      font-size: 10.5pt;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
    }
    .header h1 {
      font-size: 18pt;
      margin-bottom: 10px;
    }
    .header .meta {
      font-size: 10pt;
      color: #666;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 14pt;
      border-left: 4px solid #2563eb;
      padding-left: 10px;
      margin-bottom: 15px;
    }
    .section .content {
      text-align: justify;
      white-space: pre-wrap;
    }
    .section .char-count {
      text-align: right;
      font-size: 9pt;
      color: #888;
      margin-top: 5px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ccc;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${doc.document_title}</h1>
    <div class="meta">
      <p>申請者: ${doc.company_name || doc.client_name}</p>
      <p>申請補助金: ${doc.subsidy_name || '未設定'}</p>
      <p>作成日: ${new Date(doc.created_at).toLocaleDateString('ja-JP')}</p>
    </div>
  </div>
  
  ${sections.map((section: any) => {
    const sectionContent = content[section.id] || ''
    return `
    <div class="section">
      <h2>${section.title}</h2>
      <div class="content">${sectionContent}</div>
      <div class="char-count">${sectionContent.length.toLocaleString()} / ${section.max_chars.toLocaleString()}文字</div>
    </div>
    `
  }).join('')}
  
  <div class="footer">
    <p>本書類は補助金申請支援システムにより作成されました</p>
    <p>出力日時: ${new Date().toLocaleString('ja-JP')}</p>
  </div>
</body>
</html>`

  if (format === 'json') {
    return c.json({
      title: doc.document_title,
      client_name: doc.client_name,
      company_name: doc.company_name,
      subsidy_name: doc.subsidy_name,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      status: doc.status,
      sections: sections.map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        max_chars: s.max_chars,
        content: content[s.id] || '',
        char_count: (content[s.id] || '').length
      }))
    })
  }
  
  // HTML形式で返す（ブラウザで印刷 → PDF保存可能）
  return c.html(htmlContent)
})

// 複数文書の一括エクスポート
app.post('/api/clients/:clientId/export-all-documents', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  // 顧客の全文書取得
  const docs = await DB.prepare(`
    SELECT gd.*, dt.template_name, dt.sections as template_sections
    FROM generated_documents gd
    JOIN document_templates dt ON gd.template_id = dt.id
    WHERE gd.client_id = ?
    ORDER BY gd.created_at DESC
  `).bind(clientId).all()
  
  const client = await DB.prepare(`
    SELECT c.*, st.name as subsidy_name
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    WHERE c.id = ?
  `).bind(clientId).first()
  
  if (!client) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  return c.json({
    client: {
      id: client.id,
      name: client.name,
      company_name: client.company_name,
      subsidy_name: client.subsidy_name
    },
    documents: (docs.results || []).map((doc: any) => {
      const sections = JSON.parse(doc.template_sections || '[]')
      const content = JSON.parse(doc.sections_content || '{}')
      return {
        id: doc.id,
        title: doc.document_title,
        template_name: doc.template_name,
        status: doc.status,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        sections: sections.map((s: any) => ({
          id: s.id,
          title: s.title,
          content: content[s.id] || '',
          char_count: (content[s.id] || '').length,
          max_chars: s.max_chars
        })),
        total_chars: Object.values(content).reduce((sum: number, c: any) => sum + (c?.length || 0), 0)
      }
    }),
    exported_at: new Date().toISOString()
  })
})

// ===============================
// フェーズ4: ダッシュボード統計API
// ===============================

// 管理者ダッシュボード用統計API
app.get('/api/dashboard/stats', async (c) => {
  const { DB } = c.env
  
  // 顧客統計
  const clientStats = await DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'inquiry' THEN 1 ELSE 0 END) as inquiry,
      SUM(CASE WHEN status = 'consulting' THEN 1 ELSE 0 END) as consulting,
      SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) as preparing,
      SUM(CASE WHEN status = 'applying' THEN 1 ELSE 0 END) as applying,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM clients
  `).first()
  
  // 今月の統計
  const thisMonth = new Date().toISOString().substring(0, 7)
  const monthlyStats = await DB.prepare(`
    SELECT 
      COUNT(*) as new_clients,
      (SELECT COUNT(*) FROM clients WHERE status = 'completed' AND strftime('%Y-%m', updated_at) = ?) as completed_this_month
    FROM clients WHERE strftime('%Y-%m', created_at) = ?
  `).bind(thisMonth, thisMonth).first()
  
  // 生成文書統計
  const docStats = await DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
      SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN status = 'final' THEN 1 ELSE 0 END) as final
    FROM generated_documents
  `).first()
  
  // マッチングスコア統計
  const matchStats = await DB.prepare(`
    SELECT 
      AVG(match_score) as avg_score,
      AVG(adoption_probability) as avg_probability,
      COUNT(*) as total_analyses
    FROM subsidy_match_scores
  `).first()
  
  // 公募要領更新通知
  const pendingUpdates = await DB.prepare(`
    SELECT COUNT(*) as count FROM subsidy_update_logs WHERE status = 'pending'
  `).first()
  
  // 未読通知数
  const unreadNotifications = await DB.prepare(`
    SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0
  `).first()
  
  return c.json({
    clients: clientStats,
    monthly: monthlyStats,
    documents: docStats,
    matching: {
      average_score: Math.round(matchStats?.avg_score || 0),
      average_probability: Math.round(matchStats?.avg_probability || 0),
      total_analyses: matchStats?.total_analyses || 0
    },
    alerts: {
      pending_guideline_updates: pendingUpdates?.count || 0,
      unread_notifications: unreadNotifications?.count || 0
    },
    generated_at: new Date().toISOString()
  })
})

// ===============================
// フェーズ4: バックアップ機能（JSONインポート/エクスポート）
// ===============================

// JSON形式で全データをエクスポート
app.get('/api/backup/export', async (c) => {
  const { DB } = c.env
  
  try {
    // 各テーブルからデータを取得（存在するテーブルのみ）
    // テーブルが存在しない場合はエラーをキャッチして空配列を返す
    const safeQuery = async (query: string) => {
      try {
        return await DB.prepare(query).all()
      } catch (e) {
        return { results: [] }
      }
    }

    const [
      adminUsers,
      subsidyTypes,
      subsidyTypeDocuments,
      documentChecklist,
      clients,
      documents,
      communications,
      subsidyGuidelines,
      subsidyWatchUrls,
      subsidyUpdateLogs,
      adminNotifications,
      hearingQuestions,
      hearingAnswers,
      aiChatHistory,
      documentTemplates,
      generatedDocuments,
      documentSectionEdits,
      successCases,
      clientProfiles,
      subsidyMatchScores
    ] = await Promise.all([
      safeQuery('SELECT * FROM admin_users'),
      safeQuery('SELECT * FROM subsidy_types'),
      safeQuery('SELECT * FROM subsidy_type_documents'),
      safeQuery('SELECT * FROM document_checklist'),
      safeQuery('SELECT * FROM clients'),
      safeQuery('SELECT * FROM documents'),
      safeQuery('SELECT * FROM communications'),
      safeQuery('SELECT * FROM subsidy_guidelines'),
      safeQuery('SELECT * FROM subsidy_watch_urls'),
      safeQuery('SELECT * FROM subsidy_update_logs'),
      safeQuery('SELECT * FROM admin_notifications'),
      safeQuery('SELECT * FROM hearing_questions'),
      safeQuery('SELECT * FROM hearing_answers'),
      safeQuery('SELECT * FROM ai_chat_history'),
      safeQuery('SELECT * FROM document_templates'),
      safeQuery('SELECT * FROM generated_documents'),
      safeQuery('SELECT * FROM document_section_edits'),
      safeQuery('SELECT * FROM success_cases'),
      safeQuery('SELECT * FROM client_profiles'),
      safeQuery('SELECT * FROM subsidy_match_scores')
    ])

    const backupData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      app_name: '助成金申請管理システム',
      tables: {
        admin_users: adminUsers.results || [],
        subsidy_types: subsidyTypes.results || [],
        subsidy_type_documents: subsidyTypeDocuments.results || [],
        document_checklist: documentChecklist.results || [],
        clients: clients.results || [],
        documents: documents.results || [],
        communications: communications.results || [],
        subsidy_guidelines: subsidyGuidelines.results || [],
        subsidy_watch_urls: subsidyWatchUrls.results || [],
        subsidy_update_logs: subsidyUpdateLogs.results || [],
        admin_notifications: adminNotifications.results || [],
        hearing_questions: hearingQuestions.results || [],
        hearing_answers: hearingAnswers.results || [],
        ai_chat_history: aiChatHistory.results || [],
        document_templates: documentTemplates.results || [],
        generated_documents: generatedDocuments.results || [],
        document_section_edits: documentSectionEdits.results || [],
        success_cases: successCases.results || [],
        client_profiles: clientProfiles.results || [],
        subsidy_match_scores: subsidyMatchScores.results || []
      },
      summary: {
        total_admin_users: (adminUsers.results || []).length,
        total_subsidy_types: (subsidyTypes.results || []).length,
        total_clients: (clients.results || []).length,
        total_documents: (documents.results || []).length,
        total_generated_documents: (generatedDocuments.results || []).length,
        total_success_cases: (successCases.results || []).length
      }
    }

    // JSONファイルとしてダウンロード可能なレスポンスを返す
    const filename = `subsidy_app_backup_${new Date().toISOString().split('T')[0]}.json`
    
    return new Response(JSON.stringify(backupData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error: any) {
    console.error('Backup export error:', error)
    return c.json({ error: 'バックアップの作成に失敗しました', details: error.message }, 500)
  }
})

// バックアップ情報取得（サマリーのみ）
app.get('/api/backup/info', async (c) => {
  const { DB } = c.env
  
  try {
    const [
      adminUsersCount,
      subsidyTypesCount,
      clientsCount,
      documentsCount,
      generatedDocsCount,
      successCasesCount
    ] = await Promise.all([
      DB.prepare('SELECT COUNT(*) as count FROM admin_users').first(),
      DB.prepare('SELECT COUNT(*) as count FROM subsidy_types').first(),
      DB.prepare('SELECT COUNT(*) as count FROM clients').first(),
      DB.prepare('SELECT COUNT(*) as count FROM documents').first(),
      DB.prepare('SELECT COUNT(*) as count FROM generated_documents').first(),
      DB.prepare('SELECT COUNT(*) as count FROM success_cases').first()
    ])

    return c.json({
      summary: {
        admin_users: adminUsersCount?.count || 0,
        subsidy_types: subsidyTypesCount?.count || 0,
        clients: clientsCount?.count || 0,
        documents: documentsCount?.count || 0,
        generated_documents: generatedDocsCount?.count || 0,
        success_cases: successCasesCount?.count || 0
      },
      last_checked: new Date().toISOString()
    })
  } catch (error: any) {
    return c.json({ error: 'バックアップ情報の取得に失敗しました' }, 500)
  }
})

// JSON形式でデータをインポート（復元）
app.post('/api/backup/import', async (c) => {
  const { DB } = c.env
  
  try {
    const backupData = await c.req.json()
    
    // バックアップデータの検証
    if (!backupData.version || !backupData.tables) {
      return c.json({ error: '無効なバックアップファイルです' }, 400)
    }

    const results = {
      success: true,
      imported: {} as Record<string, number>,
      errors: [] as string[]
    }

    // トランザクション的な処理（D1はネイティブトランザクションをサポートしていないため、順次処理）
    const tables = backupData.tables

    // インポート順序（外部キー制約を考慮）
    const importOrder = [
      'admin_users',
      'subsidy_types',
      'subsidy_type_documents',
      'document_checklist',
      'clients',
      'documents',
      'communications',
      'subsidy_guidelines',
      'subsidy_watch_urls',
      'subsidy_update_logs',
      'admin_notifications',
      'hearing_questions',
      'hearing_answers',
      'ai_chat_history',
      'document_templates',
      'generated_documents',
      'document_section_edits',
      'success_cases',
      'client_profiles',
      'subsidy_match_scores'
    ]

    for (const tableName of importOrder) {
      const records = tables[tableName]
      if (!records || !Array.isArray(records) || records.length === 0) {
        results.imported[tableName] = 0
        continue
      }

      try {
        // 既存データを削除（オプション: merge_modeがfalseの場合）
        // デフォルトは上書きモード
        await DB.prepare(`DELETE FROM ${tableName}`).run()

        let importedCount = 0
        for (const record of records) {
          const columns = Object.keys(record)
          const values = Object.values(record)
          const placeholders = columns.map(() => '?').join(', ')
          
          try {
            await DB.prepare(`
              INSERT INTO ${tableName} (${columns.join(', ')}) 
              VALUES (${placeholders})
            `).bind(...values).run()
            importedCount++
          } catch (insertError: any) {
            // 重複エラーなどは無視して続行
            console.warn(`Insert error for ${tableName}:`, insertError.message)
          }
        }
        
        results.imported[tableName] = importedCount
      } catch (tableError: any) {
        results.errors.push(`${tableName}: ${tableError.message}`)
      }
    }

    if (results.errors.length > 0) {
      results.success = false
    }

    return c.json({
      ...results,
      message: results.success 
        ? 'バックアップの復元が完了しました' 
        : '一部のデータの復元に失敗しました',
      restored_at: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Backup import error:', error)
    return c.json({ error: 'バックアップの復元に失敗しました', details: error.message }, 500)
  }
})

// ===============================
// 書類解析・財務データ抽出API
// ===============================

// 書類タイプに基づく解析種別の判定
function getDocumentAnalysisType(documentType: string): string | null {
  const type = documentType.toLowerCase();
  if (type.includes('登記') || type.includes('謄本') || type.includes('履歴事項')) {
    return 'registry';
  }
  if (type.includes('決算') || type.includes('財務') || type.includes('貸借') || type.includes('損益') || type.includes('bs') || type.includes('pl')) {
    return 'financial_statement';
  }
  if (type.includes('確定申告') || type.includes('申告書')) {
    return 'tax_return';
  }
  return null;
}

// 書類解析をトリガー
app.post('/api/documents/:id/analyze', async (c) => {
  const { DB } = c.env;
  const documentId = c.req.param('id');
  
  try {
    // 書類情報を取得
    const document = await DB.prepare(`
      SELECT d.*, c.name as client_name 
      FROM documents d
      JOIN clients c ON d.client_id = c.id
      WHERE d.id = ?
    `).bind(documentId).first();
    
    if (!document) {
      return c.json({ error: '書類が見つかりません' }, 404);
    }
    
    const analysisType = getDocumentAnalysisType(document.document_type as string);
    if (!analysisType) {
      return c.json({ error: 'この書類タイプは自動解析に対応していません' }, 400);
    }
    
    // 解析ログを作成
    await DB.prepare(`
      INSERT INTO document_analysis_logs (client_id, document_id, document_type, analysis_status)
      VALUES (?, ?, ?, 'processing')
    `).bind(document.client_id, documentId, analysisType).run();
    
    // ここでは模擬データを返す（実際はAI APIを呼び出す）
    // 本番環境ではOCR + AI解析を実装
    let extractedData: any = {};
    let warnings: string[] = [];
    
    if (analysisType === 'registry') {
      extractedData = {
        company_name: '',
        company_name_kana: '',
        corporate_number: '',
        head_office_address: '',
        establishment_date: '',
        capital_amount: null,
        business_purpose: [],
        representative_name: '',
        representative_title: '代表取締役',
        directors: [],
        total_shares: null,
        issued_shares: null
      };
      warnings.push('登記簿謄本の解析にはAI連携が必要です。手動で入力してください。');
    } else if (analysisType === 'financial_statement') {
      extractedData = {
        fiscal_year: '',
        revenue: null,
        cost_of_sales: null,
        gross_profit: null,
        selling_admin_expenses: null,
        operating_income: null,
        ordinary_income: null,
        net_income: null,
        personnel_expenses: null,
        depreciation: null,
        total_assets: null,
        total_liabilities: null,
        total_net_assets: null,
        employee_count: null
      };
      warnings.push('財務諸表の解析にはAI連携が必要です。主要項目を手動で入力してください。');
    } else if (analysisType === 'tax_return') {
      extractedData = {
        tax_year: '',
        business_income: null,
        total_income: null,
        total_expenses: null,
        salary_wages: null,
        depreciation_expense: null,
        taxable_income: null,
        income_tax: null,
        employee_count: null
      };
      warnings.push('確定申告書の解析にはAI連携が必要です。手動で入力してください。');
    }
    
    // 解析ログを更新
    await DB.prepare(`
      UPDATE document_analysis_logs 
      SET analysis_status = 'completed',
          extracted_data = ?,
          warnings = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE document_id = ? AND analysis_status = 'processing'
    `).bind(
      JSON.stringify(extractedData),
      JSON.stringify(warnings),
      documentId
    ).run();
    
    return c.json({
      success: true,
      document_id: documentId,
      analysis_type: analysisType,
      extracted_data: extractedData,
      warnings,
      message: '書類の解析準備が完了しました。データを確認・入力してください。',
      requires_verification: true
    });
  } catch (error: any) {
    console.error('Document analysis error:', error);
    return c.json({ error: '書類の解析に失敗しました', details: error.message }, 500);
  }
});

// 登記簿データの保存・更新
app.post('/api/clients/:id/registry-data', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  const data = await c.req.json();
  
  try {
    // 既存データをチェック
    const existing = await DB.prepare(`
      SELECT id FROM company_registry_data WHERE client_id = ?
    `).bind(clientId).first();
    
    if (existing) {
      // 更新
      await DB.prepare(`
        UPDATE company_registry_data SET
          company_name = ?,
          company_name_kana = ?,
          corporate_number = ?,
          head_office_address = ?,
          establishment_date = ?,
          capital_amount = ?,
          business_purpose = ?,
          representative_name = ?,
          representative_title = ?,
          representative_address = ?,
          directors = ?,
          total_shares = ?,
          issued_shares = ?,
          share_transfer_restriction = ?,
          document_id = ?,
          verified = ?,
          verified_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE verified_at END,
          manual_corrections = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE client_id = ?
      `).bind(
        data.company_name,
        data.company_name_kana,
        data.corporate_number,
        data.head_office_address,
        data.establishment_date,
        data.capital_amount,
        JSON.stringify(data.business_purpose || []),
        data.representative_name,
        data.representative_title,
        data.representative_address,
        JSON.stringify(data.directors || []),
        data.total_shares,
        data.issued_shares,
        data.share_transfer_restriction,
        data.document_id,
        data.verified ? 1 : 0,
        data.verified ? 1 : 0,
        data.manual_corrections ? JSON.stringify(data.manual_corrections) : null,
        clientId
      ).run();
    } else {
      // 新規作成
      await DB.prepare(`
        INSERT INTO company_registry_data (
          client_id, company_name, company_name_kana, corporate_number,
          head_office_address, establishment_date, capital_amount, business_purpose,
          representative_name, representative_title, representative_address,
          directors, total_shares, issued_shares, share_transfer_restriction,
          document_id, verified, verified_at, extraction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        clientId,
        data.company_name,
        data.company_name_kana,
        data.corporate_number,
        data.head_office_address,
        data.establishment_date,
        data.capital_amount,
        JSON.stringify(data.business_purpose || []),
        data.representative_name,
        data.representative_title,
        data.representative_address,
        JSON.stringify(data.directors || []),
        data.total_shares,
        data.issued_shares,
        data.share_transfer_restriction,
        data.document_id,
        data.verified ? 1 : 0,
        data.verified ? new Date().toISOString() : null
      ).run();
    }
    
    return c.json({ success: true, message: '登記簿データを保存しました' });
  } catch (error: any) {
    console.error('Registry data save error:', error);
    return c.json({ error: '登記簿データの保存に失敗しました', details: error.message }, 500);
  }
});

// 登記簿データの取得
app.get('/api/clients/:id/registry-data', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  
  try {
    const data = await DB.prepare(`
      SELECT * FROM company_registry_data WHERE client_id = ?
    `).bind(clientId).first();
    
    if (!data) {
      return c.json(null);
    }
    
    // JSONフィールドをパース
    return c.json({
      ...data,
      business_purpose: data.business_purpose ? JSON.parse(data.business_purpose as string) : [],
      directors: data.directors ? JSON.parse(data.directors as string) : [],
      manual_corrections: data.manual_corrections ? JSON.parse(data.manual_corrections as string) : null
    });
  } catch (error: any) {
    return c.json({ error: '登記簿データの取得に失敗しました' }, 500);
  }
});

// 財務諸表データの保存・更新
app.post('/api/clients/:id/financial-statements', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  const data = await c.req.json();
  
  try {
    // 既存データをチェック（同じ決算期）
    const existing = await DB.prepare(`
      SELECT id FROM financial_statements WHERE client_id = ? AND fiscal_year = ?
    `).bind(clientId, data.fiscal_year).first();
    
    if (existing) {
      // 更新
      await DB.prepare(`
        UPDATE financial_statements SET
          fiscal_period = ?, document_id = ?,
          revenue = ?, cost_of_sales = ?, gross_profit = ?,
          selling_admin_expenses = ?, operating_income = ?,
          non_operating_income = ?, non_operating_expenses = ?,
          ordinary_income = ?, extraordinary_income = ?, extraordinary_loss = ?,
          income_before_tax = ?, corporate_tax = ?, net_income = ?,
          personnel_expenses = ?, depreciation = ?, rent_expenses = ?,
          advertising_expenses = ?, rd_expenses = ?, other_expenses = ?,
          current_assets = ?, cash_and_deposits = ?, accounts_receivable = ?,
          inventory = ?, fixed_assets = ?, tangible_assets = ?,
          intangible_assets = ?, investments = ?, total_assets = ?,
          current_liabilities = ?, accounts_payable = ?, short_term_loans = ?,
          fixed_liabilities = ?, long_term_loans = ?, total_liabilities = ?,
          capital_stock = ?, capital_surplus = ?, retained_earnings = ?,
          total_net_assets = ?, employee_count = ?, average_salary = ?,
          verified = ?, verified_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE verified_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        data.fiscal_period, data.document_id,
        data.revenue, data.cost_of_sales, data.gross_profit,
        data.selling_admin_expenses, data.operating_income,
        data.non_operating_income, data.non_operating_expenses,
        data.ordinary_income, data.extraordinary_income, data.extraordinary_loss,
        data.income_before_tax, data.corporate_tax, data.net_income,
        data.personnel_expenses, data.depreciation, data.rent_expenses,
        data.advertising_expenses, data.rd_expenses, data.other_expenses,
        data.current_assets, data.cash_and_deposits, data.accounts_receivable,
        data.inventory, data.fixed_assets, data.tangible_assets,
        data.intangible_assets, data.investments, data.total_assets,
        data.current_liabilities, data.accounts_payable, data.short_term_loans,
        data.fixed_liabilities, data.long_term_loans, data.total_liabilities,
        data.capital_stock, data.capital_surplus, data.retained_earnings,
        data.total_net_assets, data.employee_count, data.average_salary,
        data.verified ? 1 : 0, data.verified ? 1 : 0,
        existing.id
      ).run();
    } else {
      // 新規作成
      await DB.prepare(`
        INSERT INTO financial_statements (
          client_id, fiscal_year, fiscal_period, document_id,
          revenue, cost_of_sales, gross_profit,
          selling_admin_expenses, operating_income,
          non_operating_income, non_operating_expenses,
          ordinary_income, extraordinary_income, extraordinary_loss,
          income_before_tax, corporate_tax, net_income,
          personnel_expenses, depreciation, rent_expenses,
          advertising_expenses, rd_expenses, other_expenses,
          current_assets, cash_and_deposits, accounts_receivable,
          inventory, fixed_assets, tangible_assets,
          intangible_assets, investments, total_assets,
          current_liabilities, accounts_payable, short_term_loans,
          fixed_liabilities, long_term_loans, total_liabilities,
          capital_stock, capital_surplus, retained_earnings,
          total_net_assets, employee_count, average_salary,
          verified, verified_at, extraction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        clientId, data.fiscal_year, data.fiscal_period, data.document_id,
        data.revenue, data.cost_of_sales, data.gross_profit,
        data.selling_admin_expenses, data.operating_income,
        data.non_operating_income, data.non_operating_expenses,
        data.ordinary_income, data.extraordinary_income, data.extraordinary_loss,
        data.income_before_tax, data.corporate_tax, data.net_income,
        data.personnel_expenses, data.depreciation, data.rent_expenses,
        data.advertising_expenses, data.rd_expenses, data.other_expenses,
        data.current_assets, data.cash_and_deposits, data.accounts_receivable,
        data.inventory, data.fixed_assets, data.tangible_assets,
        data.intangible_assets, data.investments, data.total_assets,
        data.current_liabilities, data.accounts_payable, data.short_term_loans,
        data.fixed_liabilities, data.long_term_loans, data.total_liabilities,
        data.capital_stock, data.capital_surplus, data.retained_earnings,
        data.total_net_assets, data.employee_count, data.average_salary,
        data.verified ? 1 : 0, data.verified ? new Date().toISOString() : null
      ).run();
    }
    
    // 財務指標を自動計算
    await calculateFinancialIndicators(DB, clientId, data.fiscal_year, 'financial_statement', data);
    
    return c.json({ success: true, message: '財務諸表データを保存しました' });
  } catch (error: any) {
    console.error('Financial statement save error:', error);
    return c.json({ error: '財務諸表データの保存に失敗しました', details: error.message }, 500);
  }
});

// 財務諸表データの取得
app.get('/api/clients/:id/financial-statements', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  
  try {
    const data = await DB.prepare(`
      SELECT * FROM financial_statements 
      WHERE client_id = ? 
      ORDER BY fiscal_year DESC
    `).bind(clientId).all();
    
    return c.json(data.results || []);
  } catch (error: any) {
    return c.json({ error: '財務諸表データの取得に失敗しました' }, 500);
  }
});

// 財務指標の自動計算関数
async function calculateFinancialIndicators(
  DB: D1Database, 
  clientId: string, 
  fiscalYear: string, 
  sourceType: string,
  data: any
) {
  try {
    // 付加価値額の計算（中小企業庁方式）
    // 付加価値額 = 営業利益 + 人件費 + 減価償却費
    const addedValue = (data.operating_income || 0) + (data.personnel_expenses || 0) + (data.depreciation || 0);
    
    // 労働生産性 = 付加価値額 / 従業員数
    const laborProductivity = data.employee_count ? Math.round(addedValue / data.employee_count) : null;
    
    // 付加価値率 = 付加価値額 / 売上高
    const addedValueRate = data.revenue ? addedValue / data.revenue : null;
    
    // 一人当たり売上高
    const perCapitaSales = data.employee_count && data.revenue ? Math.round(data.revenue / data.employee_count) : null;
    
    // 収益性指標
    const grossProfitMargin = data.revenue ? (data.gross_profit || 0) / data.revenue : null;
    const operatingProfitMargin = data.revenue ? (data.operating_income || 0) / data.revenue : null;
    const ordinaryProfitMargin = data.revenue ? (data.ordinary_income || 0) / data.revenue : null;
    const netProfitMargin = data.revenue ? (data.net_income || 0) / data.revenue : null;
    
    // 安全性指標
    const equityRatio = data.total_assets ? (data.total_net_assets || 0) / data.total_assets : null;
    const currentRatio = data.current_liabilities ? (data.current_assets || 0) / data.current_liabilities : null;
    const debtRatio = data.total_net_assets ? (data.total_liabilities || 0) / data.total_net_assets : null;
    
    // ROE = 当期純利益 / 自己資本
    const roe = data.total_net_assets ? (data.net_income || 0) / data.total_net_assets : null;
    
    // ROA = 当期純利益 / 総資産
    const roa = data.total_assets ? (data.net_income || 0) / data.total_assets : null;
    
    // 既存データをチェック
    const existing = await DB.prepare(`
      SELECT id FROM financial_indicators 
      WHERE client_id = ? AND fiscal_year = ? AND source_type = ?
    `).bind(clientId, fiscalYear, sourceType).first();
    
    if (existing) {
      await DB.prepare(`
        UPDATE financial_indicators SET
          labor_productivity = ?,
          added_value = ?,
          added_value_rate = ?,
          per_capita_sales = ?,
          gross_profit_margin = ?,
          operating_profit_margin = ?,
          ordinary_profit_margin = ?,
          net_profit_margin = ?,
          equity_ratio = ?,
          current_ratio = ?,
          debt_ratio = ?,
          roe = ?,
          roa = ?,
          calculation_date = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        laborProductivity, addedValue, addedValueRate, perCapitaSales,
        grossProfitMargin, operatingProfitMargin, ordinaryProfitMargin, netProfitMargin,
        equityRatio, currentRatio, debtRatio, roe, roa,
        existing.id
      ).run();
    } else {
      await DB.prepare(`
        INSERT INTO financial_indicators (
          client_id, fiscal_year, source_type,
          labor_productivity, added_value, added_value_rate, per_capita_sales,
          gross_profit_margin, operating_profit_margin, ordinary_profit_margin, net_profit_margin,
          equity_ratio, current_ratio, debt_ratio, roe, roa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        clientId, fiscalYear, sourceType,
        laborProductivity, addedValue, addedValueRate, perCapitaSales,
        grossProfitMargin, operatingProfitMargin, ordinaryProfitMargin, netProfitMargin,
        equityRatio, currentRatio, debtRatio, roe, roa
      ).run();
    }
  } catch (error) {
    console.error('Financial indicators calculation error:', error);
  }
}

// 財務指標の取得
app.get('/api/clients/:id/financial-indicators', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  
  try {
    const indicators = await DB.prepare(`
      SELECT * FROM financial_indicators 
      WHERE client_id = ? 
      ORDER BY fiscal_year DESC
    `).bind(clientId).all();
    
    return c.json(indicators.results || []);
  } catch (error: any) {
    return c.json({ error: '財務指標の取得に失敗しました' }, 500);
  }
});

// 確定申告書データの保存・更新
app.post('/api/clients/:id/tax-return', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  const data = await c.req.json();
  
  try {
    const existing = await DB.prepare(`
      SELECT id FROM tax_return_data WHERE client_id = ? AND tax_year = ?
    `).bind(clientId, data.tax_year).first();
    
    if (existing) {
      await DB.prepare(`
        UPDATE tax_return_data SET
          document_id = ?,
          business_income = ?, agricultural_income = ?,
          real_estate_income = ?, salary_income = ?,
          miscellaneous_income = ?, total_income = ?,
          total_expenses = ?, salary_wages = ?,
          outsourcing_cost = ?, depreciation_expense = ?,
          interest_discount = ?, rent_cost = ?,
          utility_cost = ?, communication_cost = ?,
          advertising_cost = ?, consumables_cost = ?,
          taxable_income = ?, income_tax = ?,
          blue_return_deduction = ?,
          employee_count = ?, family_employee_count = ?,
          verified = ?, verified_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE verified_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        data.document_id,
        data.business_income, data.agricultural_income,
        data.real_estate_income, data.salary_income,
        data.miscellaneous_income, data.total_income,
        data.total_expenses, data.salary_wages,
        data.outsourcing_cost, data.depreciation_expense,
        data.interest_discount, data.rent_cost,
        data.utility_cost, data.communication_cost,
        data.advertising_cost, data.consumables_cost,
        data.taxable_income, data.income_tax,
        data.blue_return_deduction,
        data.employee_count, data.family_employee_count,
        data.verified ? 1 : 0, data.verified ? 1 : 0,
        existing.id
      ).run();
    } else {
      await DB.prepare(`
        INSERT INTO tax_return_data (
          client_id, tax_year, document_id,
          business_income, agricultural_income,
          real_estate_income, salary_income,
          miscellaneous_income, total_income,
          total_expenses, salary_wages,
          outsourcing_cost, depreciation_expense,
          interest_discount, rent_cost,
          utility_cost, communication_cost,
          advertising_cost, consumables_cost,
          taxable_income, income_tax,
          blue_return_deduction,
          employee_count, family_employee_count,
          verified, verified_at, extraction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        clientId, data.tax_year, data.document_id,
        data.business_income, data.agricultural_income,
        data.real_estate_income, data.salary_income,
        data.miscellaneous_income, data.total_income,
        data.total_expenses, data.salary_wages,
        data.outsourcing_cost, data.depreciation_expense,
        data.interest_discount, data.rent_cost,
        data.utility_cost, data.communication_cost,
        data.advertising_cost, data.consumables_cost,
        data.taxable_income, data.income_tax,
        data.blue_return_deduction,
        data.employee_count, data.family_employee_count,
        data.verified ? 1 : 0, data.verified ? new Date().toISOString() : null
      ).run();
    }
    
    return c.json({ success: true, message: '確定申告書データを保存しました' });
  } catch (error: any) {
    console.error('Tax return save error:', error);
    return c.json({ error: '確定申告書データの保存に失敗しました', details: error.message }, 500);
  }
});

// 確定申告書データの取得
app.get('/api/clients/:id/tax-return', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  
  try {
    const data = await DB.prepare(`
      SELECT * FROM tax_return_data 
      WHERE client_id = ? 
      ORDER BY tax_year DESC
    `).bind(clientId).all();
    
    return c.json(data.results || []);
  } catch (error: any) {
    return c.json({ error: '確定申告書データの取得に失敗しました' }, 500);
  }
});

// 事業計画テンプレート取得
app.get('/api/business-plan-templates/:subsidyTypeId', async (c) => {
  const { DB } = c.env;
  const subsidyTypeId = c.req.param('subsidyTypeId');
  
  try {
    const templates = await DB.prepare(`
      SELECT * FROM business_plan_templates 
      WHERE subsidy_type_id = ?
      ORDER BY section_order ASC
    `).bind(subsidyTypeId).all();
    
    // JSONフィールドをパース
    const result = (templates.results || []).map((t: any) => ({
      ...t,
      key_points: t.key_points ? JSON.parse(t.key_points) : [],
      common_mistakes: t.common_mistakes ? JSON.parse(t.common_mistakes) : [],
      successful_patterns: t.successful_patterns ? JSON.parse(t.successful_patterns) : null,
      keyword_suggestions: t.keyword_suggestions ? JSON.parse(t.keyword_suggestions) : []
    }));
    
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: 'テンプレートの取得に失敗しました' }, 500);
  }
});

// 顧客の抽出データサマリー取得（基本情報フィールド埋め用）
app.get('/api/clients/:id/extracted-data-summary', async (c) => {
  const { DB } = c.env;
  const clientId = c.req.param('id');
  
  try {
    // 登記簿データ
    const registry = await DB.prepare(`
      SELECT * FROM company_registry_data WHERE client_id = ?
    `).bind(clientId).first();
    
    // 最新の財務諸表
    const financial = await DB.prepare(`
      SELECT * FROM financial_statements 
      WHERE client_id = ? 
      ORDER BY fiscal_year DESC LIMIT 1
    `).bind(clientId).first();
    
    // 最新の確定申告書
    const taxReturn = await DB.prepare(`
      SELECT * FROM tax_return_data 
      WHERE client_id = ? 
      ORDER BY tax_year DESC LIMIT 1
    `).bind(clientId).first();
    
    // 財務指標
    const indicators = await DB.prepare(`
      SELECT * FROM financial_indicators 
      WHERE client_id = ? 
      ORDER BY fiscal_year DESC LIMIT 1
    `).bind(clientId).first();
    
    return c.json({
      registry: registry ? {
        ...registry,
        business_purpose: registry.business_purpose ? JSON.parse(registry.business_purpose as string) : [],
        directors: registry.directors ? JSON.parse(registry.directors as string) : []
      } : null,
      financial_statement: financial,
      tax_return: taxReturn,
      financial_indicators: indicators,
      summary: {
        company_name: registry?.company_name || null,
        address: registry?.head_office_address || null,
        establishment_date: registry?.establishment_date || null,
        capital_amount: registry?.capital_amount || null,
        representative_name: registry?.representative_name || null,
        employee_count: financial?.employee_count || taxReturn?.employee_count || null,
        annual_revenue: financial?.revenue || taxReturn?.business_income || null,
        operating_income: financial?.operating_income || null,
        labor_productivity: indicators?.labor_productivity || null,
        added_value: indicators?.added_value || null
      }
    });
  } catch (error: any) {
    return c.json({ error: 'データサマリーの取得に失敗しました' }, 500);
  }
});

// 選択的インポート（特定テーブルのみ）
app.post('/api/backup/import-selective', async (c) => {
  const { DB } = c.env
  
  try {
    const { tables: selectedTables, data, merge_mode = false } = await c.req.json()
    
    if (!selectedTables || !Array.isArray(selectedTables) || !data?.tables) {
      return c.json({ error: '無効なリクエストです' }, 400)
    }

    const results = {
      success: true,
      imported: {} as Record<string, number>,
      errors: [] as string[]
    }

    for (const tableName of selectedTables) {
      const records = data.tables[tableName]
      if (!records || !Array.isArray(records) || records.length === 0) {
        results.imported[tableName] = 0
        continue
      }

      try {
        // マージモードでない場合は既存データを削除
        if (!merge_mode) {
          await DB.prepare(`DELETE FROM ${tableName}`).run()
        }

        let importedCount = 0
        for (const record of records) {
          const columns = Object.keys(record)
          const values = Object.values(record)
          const placeholders = columns.map(() => '?').join(', ')
          
          try {
            if (merge_mode) {
              // マージモード: INSERT OR REPLACE
              await DB.prepare(`
                INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) 
                VALUES (${placeholders})
              `).bind(...values).run()
            } else {
              await DB.prepare(`
                INSERT INTO ${tableName} (${columns.join(', ')}) 
                VALUES (${placeholders})
              `).bind(...values).run()
            }
            importedCount++
          } catch (insertError: any) {
            console.warn(`Insert error for ${tableName}:`, insertError.message)
          }
        }
        
        results.imported[tableName] = importedCount
      } catch (tableError: any) {
        results.errors.push(`${tableName}: ${tableError.message}`)
      }
    }

    if (results.errors.length > 0) {
      results.success = false
    }

    return c.json({
      ...results,
      message: results.success 
        ? '選択したデータの復元が完了しました' 
        : '一部のデータの復元に失敗しました',
      restored_at: new Date().toISOString()
    })
  } catch (error: any) {
    return c.json({ error: '選択的インポートに失敗しました', details: error.message }, 500)
  }
})

// ===============================
// パイプライン管理API
// ===============================

// パイプラインテンプレート一覧取得
app.get('/api/pipeline-templates', async (c) => {
  const { DB } = c.env
  const category = c.req.query('category')
  
  let query = `
    SELECT pt.*, 
           (SELECT COUNT(*) FROM pipeline_template_tasks WHERE template_id = pt.id) as task_count
    FROM pipeline_templates pt
    WHERE pt.is_active = 1
  `
  
  if (category) {
    query += ` AND pt.category = ?`
    const templates = await DB.prepare(query).bind(category).all()
    return c.json(templates.results || [])
  }
  
  const templates = await DB.prepare(query).all()
  return c.json(templates.results || [])
})

// パイプラインテンプレート詳細取得
app.get('/api/pipeline-templates/:id', async (c) => {
  const { DB } = c.env
  const templateId = c.req.param('id')
  
  const template = await DB.prepare(`
    SELECT * FROM pipeline_templates WHERE id = ?
  `).bind(templateId).first()
  
  if (!template) {
    return c.json({ error: 'テンプレートが見つかりません' }, 404)
  }
  
  const tasks = await DB.prepare(`
    SELECT * FROM pipeline_template_tasks 
    WHERE template_id = ? 
    ORDER BY sort_order ASC
  `).bind(templateId).all()
  
  return c.json({
    ...template,
    tasks: tasks.results || []
  })
})

// パイプラインテンプレート作成
app.post('/api/pipeline-templates', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO pipeline_templates 
    (name, description, category, service_start_offset, service_end_offset, 
     requires_approval, allow_external_tasks, progress_reflection, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.name,
    data.description || '',
    data.category || 'general',
    data.service_start_offset || 0,
    data.service_end_offset || 30,
    data.requires_approval ? 1 : 0,
    data.allow_external_tasks ? 1 : 0,
    data.progress_reflection !== false ? 1 : 0,
    data.created_by || null
  ).run()
  
  const templateId = result.meta.last_row_id
  
  // タスクがある場合は追加
  if (data.tasks && Array.isArray(data.tasks)) {
    for (let i = 0; i < data.tasks.length; i++) {
      const task = data.tasks[i]
      await DB.prepare(`
        INSERT INTO pipeline_template_tasks 
        (template_id, task_name, task_type, description, sort_order, 
         days_offset_start, days_offset_end, is_required, default_assignee_role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        templateId,
        task.task_name,
        task.task_type || 'internal',
        task.description || '',
        i + 1,
        task.days_offset_start || 0,
        task.days_offset_end || 7,
        task.is_required !== false ? 1 : 0,
        task.default_assignee_role || null
      ).run()
    }
  }
  
  return c.json({ 
    success: true, 
    id: templateId,
    message: 'パイプラインテンプレートを作成しました' 
  })
})

// パイプラインテンプレート更新
app.put('/api/pipeline-templates/:id', async (c) => {
  const { DB } = c.env
  const templateId = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE pipeline_templates SET
    name = ?, description = ?, category = ?, 
    service_start_offset = ?, service_end_offset = ?,
    requires_approval = ?, allow_external_tasks = ?, progress_reflection = ?,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.name,
    data.description || '',
    data.category || 'general',
    data.service_start_offset || 0,
    data.service_end_offset || 30,
    data.requires_approval ? 1 : 0,
    data.allow_external_tasks ? 1 : 0,
    data.progress_reflection !== false ? 1 : 0,
    templateId
  ).run()
  
  // タスクを更新（一旦削除して再作成）
  if (data.tasks && Array.isArray(data.tasks)) {
    await DB.prepare(`DELETE FROM pipeline_template_tasks WHERE template_id = ?`).bind(templateId).run()
    
    for (let i = 0; i < data.tasks.length; i++) {
      const task = data.tasks[i]
      await DB.prepare(`
        INSERT INTO pipeline_template_tasks 
        (template_id, task_name, task_type, description, sort_order, 
         days_offset_start, days_offset_end, is_required, default_assignee_role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        templateId,
        task.task_name,
        task.task_type || 'internal',
        task.description || '',
        i + 1,
        task.days_offset_start || 0,
        task.days_offset_end || 7,
        task.is_required !== false ? 1 : 0,
        task.default_assignee_role || null
      ).run()
    }
  }
  
  return c.json({ 
    success: true,
    message: 'パイプラインテンプレートを更新しました' 
  })
})

// パイプラインテンプレート削除
app.delete('/api/pipeline-templates/:id', async (c) => {
  const { DB } = c.env
  const templateId = c.req.param('id')
  
  await DB.prepare(`
    UPDATE pipeline_templates SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(templateId).run()
  
  return c.json({ 
    success: true,
    message: 'パイプラインテンプレートを削除しました' 
  })
})

// クライアントにパイプラインを適用
app.post('/api/clients/:clientId/apply-pipeline', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const { template_id, service_start_date } = await c.req.json()
  
  // テンプレート取得
  const template = await DB.prepare(`
    SELECT * FROM pipeline_templates WHERE id = ? AND is_active = 1
  `).bind(template_id).first()
  
  if (!template) {
    return c.json({ error: 'テンプレートが見つかりません' }, 404)
  }
  
  // 開始日を設定
  const startDate = service_start_date ? new Date(service_start_date) : new Date()
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + (template.service_end_offset || 30))
  
  // パイプライン作成
  const pipelineResult = await DB.prepare(`
    INSERT INTO client_pipelines 
    (client_id, template_id, pipeline_name, service_start_date, service_end_date, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).bind(
    clientId,
    template_id,
    template.name,
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  ).run()
  
  const pipelineId = pipelineResult.meta.last_row_id
  
  // テンプレートタスクを取得してクライアントタスクを作成
  const templateTasks = await DB.prepare(`
    SELECT * FROM pipeline_template_tasks 
    WHERE template_id = ? 
    ORDER BY sort_order ASC
  `).bind(template_id).all()
  
  for (const task of (templateTasks.results || [])) {
    const taskStart = new Date(startDate)
    taskStart.setDate(taskStart.getDate() + (task.days_offset_start || 0))
    
    const taskEnd = new Date(startDate)
    taskEnd.setDate(taskEnd.getDate() + (task.days_offset_end || 7))
    
    await DB.prepare(`
      INSERT INTO client_pipeline_tasks 
      (pipeline_id, template_task_id, task_name, task_type, description, 
       sort_order, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      pipelineId,
      task.id,
      task.task_name,
      task.task_type,
      task.description,
      task.sort_order,
      taskStart.toISOString().split('T')[0],
      taskEnd.toISOString().split('T')[0]
    ).run()
  }
  
  return c.json({ 
    success: true,
    pipeline_id: pipelineId,
    message: 'パイプラインを適用しました' 
  })
})

// クライアントのパイプライン一覧取得
app.get('/api/clients/:clientId/pipelines', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const pipelines = await DB.prepare(`
    SELECT cp.*, pt.name as template_name,
           (SELECT COUNT(*) FROM client_pipeline_tasks WHERE pipeline_id = cp.id) as total_tasks,
           (SELECT COUNT(*) FROM client_pipeline_tasks WHERE pipeline_id = cp.id AND status = 'completed') as completed_tasks
    FROM client_pipelines cp
    LEFT JOIN pipeline_templates pt ON cp.template_id = pt.id
    WHERE cp.client_id = ?
    ORDER BY cp.created_at DESC
  `).bind(clientId).all()
  
  return c.json(pipelines.results || [])
})

// パイプラインタスク一覧取得
app.get('/api/pipelines/:pipelineId/tasks', async (c) => {
  const { DB } = c.env
  const pipelineId = c.req.param('pipelineId')
  
  const tasks = await DB.prepare(`
    SELECT cpt.*, au.name as assignee_name
    FROM client_pipeline_tasks cpt
    LEFT JOIN admin_users au ON cpt.assigned_to = au.id
    WHERE cpt.pipeline_id = ?
    ORDER BY cpt.sort_order ASC
  `).bind(pipelineId).all()
  
  return c.json(tasks.results || [])
})

// タスク更新
app.put('/api/pipeline-tasks/:taskId', async (c) => {
  const { DB } = c.env
  const taskId = c.req.param('taskId')
  const data = await c.req.json()
  
  // 現在の状態を取得
  const currentTask = await DB.prepare(`
    SELECT * FROM client_pipeline_tasks WHERE id = ?
  `).bind(taskId).first()
  
  if (!currentTask) {
    return c.json({ error: 'タスクが見つかりません' }, 404)
  }
  
  // 更新
  await DB.prepare(`
    UPDATE client_pipeline_tasks SET
    status = COALESCE(?, status),
    progress_percentage = COALESCE(?, progress_percentage),
    assigned_to = ?,
    notes = COALESCE(?, notes),
    completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.status || null,
    data.progress_percentage !== undefined ? data.progress_percentage : null,
    data.assigned_to || null,
    data.notes || null,
    data.status || null,
    taskId
  ).run()
  
  // 履歴を記録
  if (data.status !== currentTask.status || data.progress_percentage !== currentTask.progress_percentage) {
    await DB.prepare(`
      INSERT INTO task_history 
      (task_id, old_status, new_status, old_progress, new_progress, changed_by, change_note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      taskId,
      currentTask.status,
      data.status || currentTask.status,
      currentTask.progress_percentage,
      data.progress_percentage || currentTask.progress_percentage,
      data.changed_by || null,
      data.change_note || null
    ).run()
  }
  
  // パイプラインの進捗を更新
  const pipelineTasks = await DB.prepare(`
    SELECT status FROM client_pipeline_tasks WHERE pipeline_id = ?
  `).bind(currentTask.pipeline_id).all()
  
  const totalTasks = pipelineTasks.results?.length || 1
  const completedTasks = pipelineTasks.results?.filter((t: any) => t.status === 'completed').length || 0
  const progressPercentage = Math.round((completedTasks / totalTasks) * 100)
  
  await DB.prepare(`
    UPDATE client_pipelines SET 
    progress_percentage = ?,
    status = CASE WHEN ? = 100 THEN 'completed' ELSE status END,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(progressPercentage, progressPercentage, currentTask.pipeline_id).run()
  
  return c.json({ 
    success: true,
    message: 'タスクを更新しました',
    pipeline_progress: progressPercentage
  })
})

// ===============================
// お知らせ管理API
// ===============================

// お知らせ一覧取得（管理者用）
app.get('/api/announcements', async (c) => {
  const { DB } = c.env
  const includeInactive = c.req.query('include_inactive') === 'true'
  
  let query = `SELECT * FROM announcements`
  if (!includeInactive) {
    query += ` WHERE is_active = 1`
  }
  query += ` ORDER BY created_at DESC`
  
  const announcements = await DB.prepare(query).all()
  return c.json(announcements.results || [])
})

// 顧客向けお知らせ取得
app.get('/api/clients/:clientId/announcements', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const now = new Date().toISOString()
  
  const announcements = await DB.prepare(`
    SELECT a.*, 
           CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END as is_read
    FROM announcements a
    LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.client_id = ?
    WHERE a.is_active = 1
    AND (a.target_type = 'all' OR a.target_type = 'client' 
         OR (a.target_type = 'specific' AND a.target_ids LIKE ?))
    AND (a.start_date IS NULL OR a.start_date <= ?)
    AND (a.end_date IS NULL OR a.end_date >= ?)
    ORDER BY a.created_at DESC
  `).bind(clientId, `%${clientId}%`, now, now).all()
  
  return c.json(announcements.results || [])
})

// お知らせ作成
app.post('/api/announcements', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO announcements 
    (title, content, type, target_type, target_ids, start_date, end_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.title,
    data.content,
    data.type || 'info',
    data.target_type || 'all',
    data.target_ids || null,
    data.start_date || null,
    data.end_date || null,
    data.created_by || null
  ).run()
  
  return c.json({ 
    success: true,
    id: result.meta.last_row_id,
    message: 'お知らせを作成しました' 
  })
})

// お知らせ既読
app.post('/api/announcements/:id/read', async (c) => {
  const { DB } = c.env
  const announcementId = c.req.param('id')
  const { client_id, admin_user_id } = await c.req.json()
  
  await DB.prepare(`
    INSERT OR IGNORE INTO announcement_reads (announcement_id, client_id, admin_user_id)
    VALUES (?, ?, ?)
  `).bind(announcementId, client_id || null, admin_user_id || null).run()
  
  return c.json({ success: true })
})

// ===============================
// パイプライン管理ページ
// ===============================

app.get('/admin/pipelines', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>パイプライン管理 - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            .sidebar-link { transition: all 0.2s; }
            .sidebar-link:hover { background-color: rgba(255,255,255,0.1); }
            .sidebar-link.active { background-color: rgba(255,255,255,0.2); border-left: 3px solid white; }
            .task-card { transition: all 0.2s; }
            .task-card:hover { transform: translateX(4px); }
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            <!-- 左サイドバー -->
            <aside id="sidebar" class="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-blue-800 to-blue-900 text-white transform -translate-x-full lg:translate-x-0 lg:static transition-transform duration-300 z-50">
                <div class="p-4 border-b border-blue-700">
                    <h1 class="text-xl font-bold flex items-center gap-2">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <span>助成金管理</span>
                    </h1>
                    <p class="text-xs text-blue-300 mt-1">Subsidy Manager</p>
                </div>
                
                <nav class="p-4 space-y-1">
                    <a href="/" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-home w-5"></i>
                        <span>ダッシュボード</span>
                    </a>
                    
                    <div class="pt-4 pb-2">
                        <p class="px-4 text-xs font-semibold text-blue-400 uppercase tracking-wider">顧客管理</p>
                    </div>
                    <a href="/" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-users w-5"></i>
                        <span>顧客一覧</span>
                    </a>
                    
                    <div class="pt-4 pb-2">
                        <p class="px-4 text-xs font-semibold text-blue-400 uppercase tracking-wider">申請種別</p>
                    </div>
                    <a href="/subsidy-types" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-building w-5"></i>
                        <span>補助金一覧</span>
                        <span class="ml-auto text-xs bg-blue-700 px-2 py-0.5 rounded">行政書士</span>
                    </a>
                    <a href="/subsidy-types?category=employment" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-hand-holding-usd w-5"></i>
                        <span>助成金一覧</span>
                        <span class="ml-auto text-xs bg-green-700 px-2 py-0.5 rounded">社労士</span>
                    </a>
                    <a href="/admin/pipelines" class="sidebar-link active flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-project-diagram w-5"></i>
                        <span>パイプライン管理</span>
                    </a>
                    
                    <div class="pt-4 pb-2">
                        <p class="px-4 text-xs font-semibold text-blue-400 uppercase tracking-wider">設定</p>
                    </div>
                    <a href="/admin/guidelines" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg">
                        <i class="fas fa-book-open w-5"></i>
                        <span>公募要領管理</span>
                    </a>
                </nav>
            </aside>
            
            <!-- サイドバーオーバーレイ -->
            <div id="sidebarOverlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden lg:hidden"></div>
            
            <!-- メインコンテンツ -->
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">パイプライン管理</h2>
                        </div>
                        <div class="flex items-center gap-3">
                            <button onclick="openNewTemplateModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                <i class="fas fa-plus mr-2"></i>新規テンプレート
                            </button>
                        </div>
                    </div>
                </header>
                
                <div class="p-4 lg:p-6">
                    <!-- テンプレート一覧 -->
                    <div class="bg-white rounded-xl shadow-sm">
                        <div class="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 class="text-base font-bold text-gray-800">パイプラインテンプレート</h3>
                            <select id="filterCategory" onchange="loadTemplates()" class="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                                <option value="">すべてのカテゴリ</option>
                                <option value="subsidy">補助金</option>
                                <option value="grant">助成金</option>
                                <option value="general">一般</option>
                            </select>
                        </div>
                        <div id="templatesList" class="divide-y divide-gray-100">
                            <div class="text-center py-12 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
                                <div>読み込み中...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- 新規テンプレートモーダル -->
        <div id="newTemplateModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b sticky top-0 bg-white z-10">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-bold">新規パイプラインテンプレート作成</h3>
                        <button onclick="closeNewTemplateModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <form id="newTemplateForm" class="p-6 space-y-6">
                    <!-- 基本情報 -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="md:col-span-2">
                            <label class="block text-sm font-medium mb-1">パイプライン名 *</label>
                            <input type="text" name="name" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-sm font-medium mb-1">説明</label>
                            <textarea name="description" rows="2" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">カテゴリ *</label>
                            <select name="category" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="subsidy">補助金</option>
                                <option value="grant">助成金</option>
                                <option value="general">一般</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">担当者</label>
                            <select name="created_by" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="">選択してください</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- 期間設定 -->
                    <div class="border rounded-lg p-4 bg-gray-50">
                        <h4 class="font-medium mb-3 flex items-center gap-2">
                            <i class="fas fa-calendar-alt text-blue-600"></i>サービス期間設定
                        </h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-1">開始日オフセット（日）</label>
                                <input type="number" name="service_start_offset" value="0" class="w-full px-3 py-2 border rounded-lg">
                                <p class="text-xs text-gray-500 mt-1">申請日からの日数</p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">終了日オフセット（日）</label>
                                <input type="number" name="service_end_offset" value="30" class="w-full px-3 py-2 border rounded-lg">
                                <p class="text-xs text-gray-500 mt-1">申請日からの日数</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- オプション -->
                    <div class="border rounded-lg p-4 bg-gray-50">
                        <h4 class="font-medium mb-3 flex items-center gap-2">
                            <i class="fas fa-cog text-blue-600"></i>オプション
                        </h4>
                        <div class="space-y-3">
                            <label class="flex items-center gap-3">
                                <input type="checkbox" name="progress_reflection" checked class="rounded text-blue-600">
                                <span class="text-sm">進捗反映</span>
                            </label>
                            <label class="flex items-center gap-3">
                                <input type="checkbox" name="allow_external_tasks" class="rounded text-blue-600">
                                <span class="text-sm">外部タスクを許可</span>
                            </label>
                            <label class="flex items-center gap-3">
                                <input type="checkbox" name="requires_approval" class="rounded text-blue-600">
                                <span class="text-sm">承認が必要</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- サービスタスク -->
                    <div class="border rounded-lg p-4">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-medium flex items-center gap-2">
                                <i class="fas fa-tasks text-blue-600"></i>サービスタスク
                            </h4>
                            <button type="button" onclick="addTaskRow()" class="text-blue-600 hover:text-blue-700 text-sm">
                                <i class="fas fa-plus mr-1"></i>タスク追加
                            </button>
                        </div>
                        <div id="tasksList" class="space-y-3">
                            <!-- タスク行がここに追加される -->
                        </div>
                    </div>
                    
                    <div class="flex gap-3 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium">
                            <i class="fas fa-save mr-2"></i>保存
                        </button>
                        <button type="button" onclick="closeNewTemplateModal()" class="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-medium">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- テンプレート詳細モーダル -->
        <div id="templateDetailModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b sticky top-0 bg-white z-10">
                    <div class="flex items-center justify-between">
                        <h3 id="templateDetailTitle" class="text-xl font-bold">テンプレート詳細</h3>
                        <button onclick="closeTemplateDetailModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div id="templateDetailContent" class="p-6">
                    <!-- 詳細がここに表示される -->
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // 認証チェック
            function checkAuth() {
                const token = localStorage.getItem('admin_token');
                if (!token) {
                    window.location.href = '/login';
                    return false;
                }
                return true;
            }
            
            if (!checkAuth()) {
                // リダイレクト
            }
            
            // Axios設定
            axios.defaults.headers.common['Authorization'] = \`Bearer \${localStorage.getItem('admin_username')}:\${localStorage.getItem('admin_role')}\`;
            
            // サイドバートグル
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                sidebar.classList.toggle('-translate-x-full');
                overlay.classList.toggle('hidden');
            }
            
            // タスク行テンプレート
            let taskCounter = 0;
            
            function addTaskRow(task = null) {
                taskCounter++;
                const container = document.getElementById('tasksList');
                const row = document.createElement('div');
                row.className = 'task-card bg-white border rounded-lg p-4 relative';
                row.id = 'task-row-' + taskCounter;
                
                row.innerHTML = \`
                    <button type="button" onclick="removeTaskRow(\${taskCounter})" class="absolute top-2 right-2 text-red-500 hover:text-red-700">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="md:col-span-2">
                            <label class="block text-xs font-medium mb-1">タスク名 *</label>
                            <input type="text" name="tasks[\${taskCounter}][task_name]" required value="\${task?.task_name || ''}" class="w-full px-3 py-2 border rounded-lg text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-medium mb-1">タスクタイプ</label>
                            <select name="tasks[\${taskCounter}][task_type]" class="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="internal" \${task?.task_type === 'internal' ? 'selected' : ''}>自社タスク</option>
                                <option value="external" \${task?.task_type === 'external' ? 'selected' : ''}>顧客タスク</option>
                                <option value="both" \${task?.task_type === 'both' ? 'selected' : ''}>両方</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-medium mb-1">必須</label>
                            <select name="tasks[\${taskCounter}][is_required]" class="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="1" \${task?.is_required !== 0 ? 'selected' : ''}>必須</option>
                                <option value="0" \${task?.is_required === 0 ? 'selected' : ''}>任意</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-medium mb-1">開始日オフセット（日）</label>
                            <input type="number" name="tasks[\${taskCounter}][days_offset_start]" value="\${task?.days_offset_start || 0}" class="w-full px-3 py-2 border rounded-lg text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-medium mb-1">終了日オフセット（日）</label>
                            <input type="number" name="tasks[\${taskCounter}][days_offset_end]" value="\${task?.days_offset_end || 7}" class="w-full px-3 py-2 border rounded-lg text-sm">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-xs font-medium mb-1">説明</label>
                            <input type="text" name="tasks[\${taskCounter}][description]" value="\${task?.description || ''}" class="w-full px-3 py-2 border rounded-lg text-sm">
                        </div>
                    </div>
                \`;
                
                container.appendChild(row);
            }
            
            function removeTaskRow(id) {
                const row = document.getElementById('task-row-' + id);
                if (row) row.remove();
            }
            
            // テンプレート一覧読み込み
            async function loadTemplates() {
                try {
                    const category = document.getElementById('filterCategory').value;
                    let url = '/api/pipeline-templates';
                    if (category) {
                        url += '?category=' + category;
                    }
                    
                    const response = await axios.get(url);
                    const templates = response.data;
                    
                    const container = document.getElementById('templatesList');
                    
                    if (templates.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-12 text-gray-500">
                                <i class="fas fa-folder-open text-4xl mb-3 text-gray-300"></i>
                                <p>パイプラインテンプレートがありません</p>
                                <button onclick="openNewTemplateModal()" class="mt-3 text-blue-600 hover:text-blue-700">
                                    <i class="fas fa-plus mr-1"></i>新規作成
                                </button>
                            </div>
                        \`;
                        return;
                    }
                    
                    const categoryLabels = {
                        'subsidy': { label: '補助金', color: 'bg-blue-100 text-blue-800' },
                        'grant': { label: '助成金', color: 'bg-green-100 text-green-800' },
                        'general': { label: '一般', color: 'bg-gray-100 text-gray-800' }
                    };
                    
                    container.innerHTML = templates.map(t => {
                        const cat = categoryLabels[t.category] || categoryLabels.general;
                        return \`
                            <div class="p-4 hover:bg-gray-50 cursor-pointer" onclick="showTemplateDetail(\${t.id})">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                            <i class="fas fa-project-diagram"></i>
                                        </div>
                                        <div>
                                            <div class="font-medium text-gray-900">\${t.name}</div>
                                            <div class="text-sm text-gray-500">\${t.description || '説明なし'}</div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <span class="px-2 py-1 rounded-full text-xs font-medium \${cat.color}">\${cat.label}</span>
                                        <span class="text-sm text-gray-500">\${t.task_count || 0}タスク</span>
                                        <i class="fas fa-chevron-right text-gray-400"></i>
                                    </div>
                                </div>
                            </div>
                        \`;
                    }).join('');
                    
                } catch (error) {
                    console.error('Error loading templates:', error);
                    document.getElementById('templatesList').innerHTML = \`
                        <div class="text-center py-12 text-red-500">
                            <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                            <p>読み込みエラー</p>
                        </div>
                    \`;
                }
            }
            
            // テンプレート詳細表示
            async function showTemplateDetail(id) {
                try {
                    const response = await axios.get('/api/pipeline-templates/' + id);
                    const template = response.data;
                    
                    document.getElementById('templateDetailTitle').textContent = template.name;
                    
                    const categoryLabels = {
                        'subsidy': { label: '補助金', color: 'bg-blue-100 text-blue-800' },
                        'grant': { label: '助成金', color: 'bg-green-100 text-green-800' },
                        'general': { label: '一般', color: 'bg-gray-100 text-gray-800' }
                    };
                    const cat = categoryLabels[template.category] || categoryLabels.general;
                    
                    const taskTypeLabels = {
                        'internal': { label: '自社', color: 'bg-purple-100 text-purple-800' },
                        'external': { label: '顧客', color: 'bg-orange-100 text-orange-800' },
                        'both': { label: '両方', color: 'bg-gray-100 text-gray-800' }
                    };
                    
                    let content = \`
                        <div class="space-y-6">
                            <!-- 基本情報 -->
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <span class="text-sm text-gray-500">カテゴリ</span>
                                    <p class="mt-1"><span class="px-2 py-1 rounded-full text-xs font-medium \${cat.color}">\${cat.label}</span></p>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-500">サービス期間</span>
                                    <p class="mt-1 font-medium">\${template.service_start_offset}日 〜 \${template.service_end_offset}日</p>
                                </div>
                            </div>
                            
                            <div>
                                <span class="text-sm text-gray-500">説明</span>
                                <p class="mt-1">\${template.description || '説明なし'}</p>
                            </div>
                            
                            <!-- オプション -->
                            <div class="flex gap-4">
                                <span class="text-sm \${template.progress_reflection ? 'text-green-600' : 'text-gray-400'}">
                                    <i class="fas fa-\${template.progress_reflection ? 'check' : 'times'} mr-1"></i>進捗反映
                                </span>
                                <span class="text-sm \${template.allow_external_tasks ? 'text-green-600' : 'text-gray-400'}">
                                    <i class="fas fa-\${template.allow_external_tasks ? 'check' : 'times'} mr-1"></i>外部タスク
                                </span>
                                <span class="text-sm \${template.requires_approval ? 'text-green-600' : 'text-gray-400'}">
                                    <i class="fas fa-\${template.requires_approval ? 'check' : 'times'} mr-1"></i>承認必要
                                </span>
                            </div>
                            
                            <!-- タスク一覧 -->
                            <div>
                                <h4 class="font-medium mb-3 flex items-center gap-2">
                                    <i class="fas fa-tasks text-blue-600"></i>タスク一覧（\${template.tasks?.length || 0}件）
                                </h4>
                                <div class="space-y-2">
                    \`;
                    
                    if (template.tasks && template.tasks.length > 0) {
                        template.tasks.forEach((task, index) => {
                            const tt = taskTypeLabels[task.task_type] || taskTypeLabels.internal;
                            content += \`
                                <div class="border rounded-lg p-3 bg-gray-50">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <span class="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">\${index + 1}</span>
                                            <span class="font-medium">\${task.task_name}</span>
                                            <span class="px-2 py-0.5 rounded text-xs \${tt.color}">\${tt.label}</span>
                                            \${task.is_required ? '<span class="text-red-500 text-xs">*必須</span>' : ''}
                                        </div>
                                        <span class="text-sm text-gray-500">\${task.days_offset_start}日 〜 \${task.days_offset_end}日</span>
                                    </div>
                                    \${task.description ? '<p class="text-sm text-gray-600 mt-1 ml-8">' + task.description + '</p>' : ''}
                                </div>
                            \`;
                        });
                    } else {
                        content += '<p class="text-gray-500 text-center py-4">タスクがありません</p>';
                    }
                    
                    content += \`
                                </div>
                            </div>
                            
                            <!-- アクション -->
                            <div class="flex gap-3 pt-4 border-t">
                                <button onclick="editTemplate(\${template.id})" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                                    <i class="fas fa-edit mr-2"></i>編集
                                </button>
                                <button onclick="deleteTemplate(\${template.id})" class="flex-1 bg-red-100 text-red-600 py-2 rounded-lg hover:bg-red-200">
                                    <i class="fas fa-trash mr-2"></i>削除
                                </button>
                            </div>
                        </div>
                    \`;
                    
                    document.getElementById('templateDetailContent').innerHTML = content;
                    document.getElementById('templateDetailModal').classList.remove('hidden');
                    
                } catch (error) {
                    console.error('Error loading template detail:', error);
                    alert('テンプレート詳細の読み込みに失敗しました');
                }
            }
            
            // モーダル操作
            function openNewTemplateModal() {
                document.getElementById('newTemplateForm').reset();
                document.getElementById('tasksList').innerHTML = '';
                taskCounter = 0;
                addTaskRow(); // 最初の1行を追加
                document.getElementById('newTemplateModal').classList.remove('hidden');
                loadUsers();
            }
            
            function closeNewTemplateModal() {
                document.getElementById('newTemplateModal').classList.add('hidden');
            }
            
            function closeTemplateDetailModal() {
                document.getElementById('templateDetailModal').classList.add('hidden');
            }
            
            // ユーザー読み込み
            async function loadUsers() {
                try {
                    const response = await axios.get('/api/admin/users');
                    const users = response.data;
                    const select = document.querySelector('select[name="created_by"]');
                    select.innerHTML = '<option value="">選択してください</option>';
                    users.forEach(u => {
                        select.innerHTML += '<option value="' + u.name + '">' + u.name + '</option>';
                    });
                } catch (error) {
                    console.error('Error loading users:', error);
                }
            }
            
            // テンプレート削除
            async function deleteTemplate(id) {
                if (!confirm('このテンプレートを削除しますか？')) return;
                
                try {
                    await axios.delete('/api/pipeline-templates/' + id);
                    alert('テンプレートを削除しました');
                    closeTemplateDetailModal();
                    loadTemplates();
                } catch (error) {
                    console.error('Error deleting template:', error);
                    alert('削除に失敗しました');
                }
            }
            
            // フォーム送信
            document.getElementById('newTemplateForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const data = {
                    name: formData.get('name'),
                    description: formData.get('description'),
                    category: formData.get('category'),
                    service_start_offset: parseInt(formData.get('service_start_offset')) || 0,
                    service_end_offset: parseInt(formData.get('service_end_offset')) || 30,
                    progress_reflection: formData.get('progress_reflection') === 'on',
                    allow_external_tasks: formData.get('allow_external_tasks') === 'on',
                    requires_approval: formData.get('requires_approval') === 'on',
                    created_by: formData.get('created_by'),
                    tasks: []
                };
                
                // タスクを収集
                const taskRows = document.querySelectorAll('[id^="task-row-"]');
                taskRows.forEach(row => {
                    const taskName = row.querySelector('input[name*="[task_name]"]')?.value;
                    if (taskName) {
                        data.tasks.push({
                            task_name: taskName,
                            task_type: row.querySelector('select[name*="[task_type]"]')?.value || 'internal',
                            is_required: row.querySelector('select[name*="[is_required]"]')?.value === '1',
                            days_offset_start: parseInt(row.querySelector('input[name*="[days_offset_start]"]')?.value) || 0,
                            days_offset_end: parseInt(row.querySelector('input[name*="[days_offset_end]"]')?.value) || 7,
                            description: row.querySelector('input[name*="[description]"]')?.value || ''
                        });
                    }
                });
                
                try {
                    await axios.post('/api/pipeline-templates', data);
                    alert('テンプレートを作成しました');
                    closeNewTemplateModal();
                    loadTemplates();
                } catch (error) {
                    console.error('Error creating template:', error);
                    alert('作成に失敗しました');
                }
            });
            
            // 初期読み込み
            loadTemplates();
        </script>
    </body>
    </html>
  `)
})

// ===============================
// プライバシーポリシーページ
// ===============================

app.get('/privacy-policy', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>プライバシーポリシー - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <header class="bg-blue-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <h1 class="text-2xl font-bold">
                        <i class="fas fa-shield-alt mr-2"></i>
                        プライバシーポリシー
                    </h1>
                </div>
            </header>
            
            <div class="container mx-auto px-4 py-8 max-w-4xl">
                <div class="bg-white rounded-lg shadow p-6 md:p-8 prose max-w-none">
                    <p class="text-gray-600 mb-6">最終更新日: 2024年1月1日</p>
                    
                    <section class="mb-8">
                        <h2 class="text-xl font-bold mb-4 text-gray-800">1. 個人情報の収集について</h2>
                        <p class="text-gray-700 mb-4">
                            当社は、補助金・助成金申請支援サービスの提供にあたり、以下の個人情報を収集させていただく場合があります。
                        </p>
                        <ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
                            <li>氏名、会社名、住所</li>
                            <li>電話番号、メールアドレス</li>
                            <li>財務情報（決算書、確定申告書等に記載の情報）</li>
                            <li>登記情報（登記簿謄本に記載の情報）</li>
                            <li>その他、申請に必要な情報</li>
                        </ul>
                    </section>
                    
                    <section class="mb-8">
                        <h2 class="text-xl font-bold mb-4 text-gray-800">2. 個人情報の利用目的</h2>
                        <p class="text-gray-700 mb-4">収集した個人情報は、以下の目的で利用いたします。</p>
                        <ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
                            <li>補助金・助成金の申請書類の作成支援</li>
                            <li>お客様へのご連絡・ご案内</li>
                            <li>サービス品質の向上</li>
                            <li>法令に基づく対応</li>
                        </ul>
                    </section>
                    
                    <section class="mb-8">
                        <h2 class="text-xl font-bold mb-4 text-gray-800">3. 個人情報の第三者提供</h2>
                        <p class="text-gray-700">
                            当社は、法令に基づく場合を除き、お客様の同意なく個人情報を第三者に提供することはありません。
                            ただし、補助金・助成金申請のため、行政機関等への提出が必要な場合は、事前にお客様の同意を得た上で提供いたします。
                        </p>
                    </section>
                    
                    <section class="mb-8">
                        <h2 class="text-xl font-bold mb-4 text-gray-800">4. 個人情報の管理</h2>
                        <p class="text-gray-700">
                            当社は、個人情報の漏洩、滅失、毀損を防止するため、適切なセキュリティ対策を講じます。
                            また、従業員に対して個人情報保護に関する教育・啓発を行います。
                        </p>
                    </section>
                    
                    <section class="mb-8">
                        <h2 class="text-xl font-bold mb-4 text-gray-800">5. お問い合わせ</h2>
                        <p class="text-gray-700">
                            個人情報の取り扱いに関するお問い合わせは、当社までご連絡ください。
                        </p>
                    </section>
                </div>
                
                <div class="mt-6 text-center">
                    <a href="javascript:history.back()" class="text-blue-600 hover:text-blue-700">
                        <i class="fas fa-arrow-left mr-1"></i>戻る
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `)
})

// ===============================
// 特定商取引法に基づく表記
// ===============================

app.get('/legal', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>特定商取引法に基づく表記 - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <header class="bg-blue-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <h1 class="text-2xl font-bold">
                        <i class="fas fa-balance-scale mr-2"></i>
                        特定商取引法に基づく表記
                    </h1>
                </div>
            </header>
            
            <div class="container mx-auto px-4 py-8 max-w-4xl">
                <div class="bg-white rounded-lg shadow p-6 md:p-8">
                    <table class="w-full">
                        <tbody class="divide-y">
                            <tr>
                                <td class="py-4 pr-4 font-medium text-gray-700 w-1/3">販売業者</td>
                                <td class="py-4 text-gray-600">株式会社〇〇〇〇</td>
                            </tr>
                            <tr>
                                <td class="py-4 pr-4 font-medium text-gray-700">代表者名</td>
                                <td class="py-4 text-gray-600">代表取締役 〇〇 〇〇</td>
                            </tr>
                            <tr>
                                <td class="py-4 pr-4 font-medium text-gray-700">所在地</td>
                                <td class="py-4 text-gray-600">〒000-0000 東京都〇〇区〇〇 0-0-0</td>
                            </tr>
                            <tr>
                                <td class="py-4 pr-4 font-medium text-gray-700">電話番号</td>
                                <td class="py-4 text-gray-600">03-0000-0000</td>
                            </tr>
                            <tr>
                                <td class="py-4 pr-4 font-medium text-gray-700">メールアドレス</td>
                                <td class="py-4 text-gray-600">info@example.com</td>
                            </tr>
                            <tr>
                                <td class="py-4 pr-4 font-medium text-gray-700">サービス料金</td>
                                <td class="py-4 text-gray-600">
                                    各サービスページに表示される価格に準じます。<br>
                                    表示価格は税込価格です。
                                </td>
                            </tr>
                            <tr>
                                <td class="py-4 pr-4 font-medium text-gray-700">支払方法</td>
                                <td class="py-4 text-gray-600">
                                    クレジットカード決済<br>
                                    銀行振込
                                </td>
                            </tr>
                            <tr>
                                <td class="py-4 pr-4 font-medium text-gray-700">支払時期</td>
                                <td class="py-4 text-gray-600">
                                    クレジットカード: 即時決済<br>
                                    銀行振込: 請求書発行後14日以内
                                </td>
                            </tr>
                            <tr>
                                <td class="py-4 pr-4 font-medium text-gray-700">サービス提供時期</td>
                                <td class="py-4 text-gray-600">お申込み確認後、速やかにサービスを開始します。</td>
                            </tr>
                            <tr>
                                <td class="py-4 pr-4 font-medium text-gray-700">キャンセル・返金</td>
                                <td class="py-4 text-gray-600">
                                    サービス開始前のキャンセル: 手付金を除き返金いたします。<br>
                                    サービス開始後のキャンセル: 進捗状況に応じて精算いたします。
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="mt-6 text-center">
                    <a href="javascript:history.back()" class="text-blue-600 hover:text-blue-700">
                        <i class="fas fa-arrow-left mr-1"></i>戻る
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `)
})

// ===============================
// API: システム設定（銀行振込先など）
// ===============================

// システム設定取得
app.get('/api/settings', async (c) => {
  const { DB } = c.env
  
  const settings = await DB.prepare(`
    SELECT setting_key, setting_value, setting_type, description
    FROM system_settings
  `).all()
  
  // キー・バリュー形式に変換
  const result: Record<string, any> = {}
  for (const row of (settings.results || []) as any[]) {
    let value = row.setting_value
    if (row.setting_type === 'boolean') {
      value = value === 'true'
    } else if (row.setting_type === 'number') {
      value = Number(value)
    } else if (row.setting_type === 'json') {
      try { value = JSON.parse(value) } catch {}
    }
    result[row.setting_key] = value
  }
  
  return c.json(result)
})

// システム設定更新
app.put('/api/settings', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  for (const [key, value] of Object.entries(data)) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
    await DB.prepare(`
      UPDATE system_settings 
      SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = ?
    `).bind(stringValue, key).run()
  }
  
  return c.json({ success: true, message: '設定を保存しました' })
})

// 銀行振込先情報取得（公開API - 顧客ポータル用）
app.get('/api/bank-info', async (c) => {
  const { DB } = c.env
  
  const settings = await DB.prepare(`
    SELECT setting_key, setting_value
    FROM system_settings
    WHERE setting_key IN ('bank_name', 'bank_branch', 'bank_account_type', 'bank_account_number', 'bank_account_holder', 'company_name')
  `).all()
  
  const result: Record<string, string> = {}
  for (const row of (settings.results || []) as any[]) {
    result[row.setting_key] = row.setting_value || ''
  }
  
  return c.json(result)
})

// ===============================
// API: 支払い管理
// ===============================

// 顧客の支払い履歴取得
app.get('/api/clients/:clientId/payments', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  const payments = await DB.prepare(`
    SELECT ph.*, au.name as confirmed_by_name
    FROM payment_history ph
    LEFT JOIN admin_users au ON ph.confirmed_by = au.id
    WHERE ph.client_id = ?
    ORDER BY ph.created_at DESC
  `).bind(clientId).all()
  
  return c.json(payments.results || [])
})

// 振込完了報告（顧客用）
app.post('/api/clients/:clientId/report-transfer', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  
  try {
    const data = await c.req.json()
    
    // クライアント情報を取得して金額を確認
    const client = await DB.prepare(`
      SELECT deposit_amount FROM clients WHERE id = ?
    `).bind(clientId).first() as any
    
    const amount = data.amount || client?.deposit_amount || 0
    
    // 支払い履歴を作成
    await DB.prepare(`
      INSERT INTO payment_history (client_id, payment_type, amount, payment_method, status, bank_transfer_reported_at, notes)
      VALUES (?, ?, ?, 'bank_transfer', 'reported', CURRENT_TIMESTAMP, ?)
    `).bind(clientId, data.payment_type || 'deposit', amount, data.notes || '').run()
    
    // クライアントの振込報告フラグを更新
    await DB.prepare(`
      UPDATE clients 
      SET deposit_transfer_reported = 1, 
          deposit_transfer_reported_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(clientId).run()
    
    return c.json({ success: true, message: '振込完了報告を送信しました。確認まで少々お待ちください。' })
  } catch (error: any) {
    console.error('Report transfer error:', error)
    return c.json({ error: '振込報告の処理中にエラーが発生しました', details: error.message }, 500)
  }
})

// 支払い確認（管理者用）
app.put('/api/payments/:paymentId/confirm', async (c) => {
  const { DB } = c.env
  const paymentId = c.req.param('paymentId')
  const user = await getCurrentUser(c)
  
  if (!user) {
    return c.json({ error: '認証が必要です' }, 401)
  }
  
  // 支払い情報を取得
  const payment = await DB.prepare(`
    SELECT * FROM payment_history WHERE id = ?
  `).bind(paymentId).first() as any
  
  if (!payment) {
    return c.json({ error: '支払い情報が見つかりません' }, 404)
  }
  
  // 支払いを確認済みに更新
  await DB.prepare(`
    UPDATE payment_history 
    SET status = 'confirmed', 
        bank_transfer_confirmed_at = CURRENT_TIMESTAMP,
        confirmed_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(user.id, paymentId).run()
  
  // クライアントの支払いステータスを更新
  if (payment.payment_type === 'deposit') {
    await DB.prepare(`
      UPDATE clients 
      SET deposit_paid = 1, 
          deposit_paid_at = CURRENT_TIMESTAMP,
          deposit_payment_method = 'bank_transfer',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(payment.client_id).run()
  }
  
  return c.json({ success: true, message: '支払いを確認しました' })
})

// 支払い待ち一覧（管理者用）
app.get('/api/payments/pending', async (c) => {
  const { DB } = c.env
  
  const payments = await DB.prepare(`
    SELECT ph.*, c.name as client_name, c.company_name
    FROM payment_history ph
    JOIN clients c ON ph.client_id = c.id
    WHERE ph.status = 'reported'
    ORDER BY ph.bank_transfer_reported_at ASC
  `).all()
  
  return c.json(payments.results || [])
})

// ===============================
// API: Stripe決済
// ===============================

// Stripe決済セッション作成
app.post('/api/clients/:clientId/create-checkout-session', async (c) => {
  const { DB, STRIPE_SECRET_KEY } = c.env as any
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  
  if (!STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe決済は現在設定されていません' }, 400)
  }
  
  // クライアント情報を取得
  const client = await DB.prepare(`
    SELECT * FROM clients WHERE id = ?
  `).bind(clientId).first() as any
  
  if (!client) {
    return c.json({ error: '顧客が見つかりません' }, 404)
  }
  
  const amount = data.amount || client.deposit_amount
  if (!amount || amount <= 0) {
    return c.json({ error: '支払い金額が設定されていません' }, 400)
  }
  
  try {
    // Stripe APIを呼び出し
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'payment_method_types[]': 'card',
        'line_items[0][price_data][currency]': 'jpy',
        'line_items[0][price_data][product_data][name]': `${client.name}様 - 手付金`,
        'line_items[0][price_data][unit_amount]': String(amount),
        'line_items[0][quantity]': '1',
        'mode': 'payment',
        'success_url': `${data.success_url || c.req.url.replace(/\/api\/.*/, '')}/portal/${client.access_token}?payment=success`,
        'cancel_url': `${data.cancel_url || c.req.url.replace(/\/api\/.*/, '')}/portal/${client.access_token}?payment=cancelled`,
        'metadata[client_id]': clientId,
        'metadata[payment_type]': 'deposit',
      }).toString(),
    })
    
    const session = await response.json() as any
    
    if (session.error) {
      console.error('Stripe error:', session.error)
      return c.json({ error: session.error.message }, 400)
    }
    
    // 支払い履歴を作成
    await DB.prepare(`
      INSERT INTO payment_history (client_id, payment_type, amount, payment_method, status, stripe_session_id)
      VALUES (?, 'deposit', ?, 'credit_card', 'pending', ?)
    `).bind(clientId, amount, session.id).run()
    
    return c.json({ 
      success: true, 
      checkout_url: session.url,
      session_id: session.id
    })
  } catch (error: any) {
    console.error('Stripe session creation error:', error)
    return c.json({ error: '決済セッションの作成に失敗しました' }, 500)
  }
})

// Stripe Webhook受信
app.post('/api/stripe/webhook', async (c) => {
  const { DB, STRIPE_WEBHOOK_SECRET } = c.env as any
  
  const payload = await c.req.text()
  const sig = c.req.header('stripe-signature')
  
  // Webhook署名検証（本番環境では必須）
  // 簡易的な実装のため、署名検証は省略（本番では必ず実装してください）
  
  let event: any
  try {
    event = JSON.parse(payload)
  } catch {
    return c.json({ error: 'Invalid payload' }, 400)
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const clientId = session.metadata?.client_id
    
    if (clientId) {
      // 支払い履歴を更新
      await DB.prepare(`
        UPDATE payment_history 
        SET status = 'completed', 
            stripe_payment_intent_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE stripe_session_id = ?
      `).bind(session.payment_intent, session.id).run()
      
      // クライアントの支払いステータスを更新
      await DB.prepare(`
        UPDATE clients 
        SET deposit_paid = 1, 
            deposit_paid_at = CURRENT_TIMESTAMP,
            deposit_payment_method = 'credit_card',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(clientId).run()
    }
  }
  
  return c.json({ received: true })
})

// ===============================
// 管理画面: システム設定
// ===============================

app.get('/admin/settings', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>システム設定 - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-100 min-h-screen">
        <nav class="bg-white shadow">
            <div class="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                <div class="flex items-center gap-4">
                    <a href="/" class="text-gray-600 hover:text-gray-900">
                        <i class="fas fa-arrow-left"></i>
                    </a>
                    <h1 class="text-xl font-bold text-gray-800">システム設定</h1>
                </div>
                <div class="flex items-center gap-4">
                    <span id="adminName" class="text-sm text-gray-600"></span>
                </div>
            </div>
        </nav>
        
        <div class="max-w-4xl mx-auto p-6">
            <!-- 銀行振込先設定 -->
            <div class="bg-white rounded-lg shadow mb-6">
                <div class="p-4 border-b">
                    <h2 class="text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-university text-green-600"></i>
                        銀行振込先情報
                    </h2>
                    <p class="text-sm text-gray-500 mt-1">顧客ポータルで表示される振込先情報を設定します</p>
                </div>
                <div class="p-4 space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">銀行名</label>
                            <input type="text" id="bank_name" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 三菱UFJ銀行">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">支店名</label>
                            <input type="text" id="bank_branch" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 渋谷支店">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">口座種別</label>
                            <select id="bank_account_type" class="w-full px-3 py-2 border rounded-lg">
                                <option value="普通">普通</option>
                                <option value="当座">当座</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">口座番号</label>
                            <input type="text" id="bank_account_number" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 1234567">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">口座名義</label>
                            <input type="text" id="bank_account_holder" class="w-full px-3 py-2 border rounded-lg" placeholder="例: カ）サンプルシャ">
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 会社情報 -->
            <div class="bg-white rounded-lg shadow mb-6">
                <div class="p-4 border-b">
                    <h2 class="text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-building text-blue-600"></i>
                        会社情報
                    </h2>
                    <p class="text-sm text-gray-500 mt-1">請求書などに表示される会社情報を設定します</p>
                </div>
                <div class="p-4 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">会社名</label>
                        <input type="text" id="company_name" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 株式会社サンプル">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">住所</label>
                        <input type="text" id="company_address" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 東京都渋谷区...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                        <input type="text" id="company_phone" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 03-1234-5678">
                    </div>
                </div>
            </div>
            
            <!-- Stripe設定 -->
            <div class="bg-white rounded-lg shadow mb-6">
                <div class="p-4 border-b">
                    <h2 class="text-lg font-bold flex items-center gap-2">
                        <i class="fab fa-stripe text-purple-600"></i>
                        Stripe決済設定
                    </h2>
                    <p class="text-sm text-gray-500 mt-1">クレジットカード決済を利用する場合に設定します</p>
                </div>
                <div class="p-4 space-y-4">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" id="stripe_enabled" class="rounded text-purple-600">
                        <label class="text-sm font-medium text-gray-700">Stripe決済を有効にする</label>
                    </div>
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div class="flex items-start gap-2">
                            <i class="fas fa-info-circle text-yellow-600 mt-0.5"></i>
                            <div class="text-sm text-yellow-800">
                                <p class="font-medium">APIキーの設定について</p>
                                <p class="mt-1">Stripe APIキーは環境変数（wrangler.toml）で設定してください：</p>
                                <code class="block mt-2 bg-yellow-100 p-2 rounded text-xs">
                                    [vars]<br>
                                    STRIPE_SECRET_KEY = "sk_..."<br>
                                    STRIPE_WEBHOOK_SECRET = "whsec_..."
                                </code>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 保存ボタン -->
            <div class="flex justify-end gap-3">
                <a href="/" class="px-6 py-2 border rounded-lg hover:bg-gray-50">キャンセル</a>
                <button onclick="saveSettings()" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i class="fas fa-save mr-2"></i>保存
                </button>
            </div>
        </div>
        
        <script>
            // 認証チェック
            const token = localStorage.getItem('admin_token');
            if (!token) {
                window.location.href = '/login';
            }
            document.getElementById('adminName').textContent = localStorage.getItem('admin_name') || '';
            
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
            
            // 設定を読み込み
            async function loadSettings() {
                try {
                    const response = await axios.get('/api/settings');
                    const settings = response.data;
                    
                    document.getElementById('bank_name').value = settings.bank_name || '';
                    document.getElementById('bank_branch').value = settings.bank_branch || '';
                    document.getElementById('bank_account_type').value = settings.bank_account_type || '普通';
                    document.getElementById('bank_account_number').value = settings.bank_account_number || '';
                    document.getElementById('bank_account_holder').value = settings.bank_account_holder || '';
                    document.getElementById('company_name').value = settings.company_name || '';
                    document.getElementById('company_address').value = settings.company_address || '';
                    document.getElementById('company_phone').value = settings.company_phone || '';
                    document.getElementById('stripe_enabled').checked = settings.stripe_enabled === true;
                } catch (error) {
                    console.error('Error loading settings:', error);
                }
            }
            
            // 設定を保存
            async function saveSettings() {
                try {
                    const settings = {
                        bank_name: document.getElementById('bank_name').value,
                        bank_branch: document.getElementById('bank_branch').value,
                        bank_account_type: document.getElementById('bank_account_type').value,
                        bank_account_number: document.getElementById('bank_account_number').value,
                        bank_account_holder: document.getElementById('bank_account_holder').value,
                        company_name: document.getElementById('company_name').value,
                        company_address: document.getElementById('company_address').value,
                        company_phone: document.getElementById('company_phone').value,
                        stripe_enabled: document.getElementById('stripe_enabled').checked ? 'true' : 'false'
                    };
                    
                    await axios.put('/api/settings', settings);
                    alert('設定を保存しました');
                } catch (error) {
                    console.error('Error saving settings:', error);
                    alert('設定の保存に失敗しました');
                }
            }
            
            loadSettings();
        </script>
    </body>
    </html>
  `)
})

// 支払い確認待ち一覧画面
app.get('/admin/payments', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>支払い確認 - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-100 min-h-screen">
        <nav class="bg-white shadow">
            <div class="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                <div class="flex items-center gap-4">
                    <a href="/" class="text-gray-600 hover:text-gray-900">
                        <i class="fas fa-arrow-left"></i>
                    </a>
                    <h1 class="text-xl font-bold text-gray-800">支払い確認</h1>
                </div>
            </div>
        </nav>
        
        <div class="max-w-6xl mx-auto p-6">
            <div class="bg-white rounded-lg shadow">
                <div class="p-4 border-b flex justify-between items-center">
                    <h2 class="text-lg font-bold">振込確認待ち</h2>
                    <button onclick="loadPayments()" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-sync-alt"></i> 更新
                    </button>
                </div>
                <div id="paymentsList" class="divide-y">
                    <div class="p-8 text-center text-gray-500">
                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <p>読み込み中...</p>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            const token = localStorage.getItem('admin_token');
            if (!token) window.location.href = '/login';
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
            
            async function loadPayments() {
                try {
                    const response = await axios.get('/api/payments/pending');
                    const payments = response.data;
                    
                    if (payments.length === 0) {
                        document.getElementById('paymentsList').innerHTML = \`
                            <div class="p-8 text-center text-gray-500">
                                <i class="fas fa-check-circle text-4xl text-green-500 mb-3"></i>
                                <p>確認待ちの支払いはありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    document.getElementById('paymentsList').innerHTML = payments.map(p => \`
                        <div class="p-4 flex items-center justify-between hover:bg-gray-50">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                                    <i class="fas fa-university text-yellow-600"></i>
                                </div>
                                <div>
                                    <div class="font-medium">\${p.client_name}</div>
                                    <div class="text-sm text-gray-500">\${p.company_name || ''}</div>
                                    <div class="text-xs text-gray-400">
                                        報告日時: \${new Date(p.bank_transfer_reported_at).toLocaleString('ja-JP')}
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="text-right">
                                    <div class="font-bold text-lg">¥\${p.amount.toLocaleString()}</div>
                                    <div class="text-xs text-gray-500">\${p.payment_type === 'deposit' ? '手付金' : 'その他'}</div>
                                </div>
                                <button onclick="confirmPayment(\${p.id})" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                    <i class="fas fa-check mr-1"></i>確認
                                </button>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Error:', error);
                }
            }
            
            async function confirmPayment(paymentId) {
                if (!confirm('この支払いを確認済みにしますか？')) return;
                
                try {
                    await axios.put(\`/api/payments/\${paymentId}/confirm\`);
                    alert('支払いを確認しました');
                    loadPayments();
                } catch (error) {
                    alert('エラーが発生しました');
                }
            }
            
            loadPayments();
        </script>
    </body>
    </html>
  `)
})

// =============================================
// 顧客管理ページ
// =============================================
app.get('/clients', async (c) => {
  const { DB } = c.env
  const clients = await DB.prepare(`
    SELECT c.*, 
           COUNT(DISTINCT cl2.id) as case_count,
           st.name as subsidy_type_name
    FROM clients c
    LEFT JOIN clients cl2 ON c.id = cl2.id
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all()
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>顧客管理 - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <header class="bg-blue-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <a href="/" class="text-sm hover:underline mb-2 block">
                                <i class="fas fa-arrow-left mr-1"></i>ダッシュボードに戻る
                            </a>
                            <h1 class="text-2xl font-bold">
                                <i class="fas fa-users mr-2"></i>顧客管理
                            </h1>
                        </div>
                        <button onclick="openNewCustomerModal()" class="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50">
                            <i class="fas fa-user-plus mr-2"></i>新規顧客追加
                        </button>
                    </div>
                </div>
            </header>

            <div class="container mx-auto px-4 py-8">
                <!-- 検索・フィルター -->
                <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <div class="flex flex-col sm:flex-row gap-3">
                        <div class="flex-1 relative">
                            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <input type="text" id="searchQuery" placeholder="顧客名・会社名で検索..." 
                                   class="w-full pl-10 pr-4 py-2 border rounded-lg" onkeyup="filterCustomers()">
                        </div>
                    </div>
                </div>

                <!-- 顧客一覧 -->
                <div class="bg-white rounded-lg shadow-sm overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">顧客名</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">会社名</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">連絡先</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">案件数</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">登録日</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody id="customerList" class="divide-y divide-gray-200">
                            ${(clients.results || []).map((client: any) => `
                                <tr class="hover:bg-gray-50 customer-row" data-name="${client.name}" data-company="${client.company_name || ''}">
                                    <td class="px-4 py-3">
                                        <div class="font-medium text-gray-900">${client.name}</div>
                                    </td>
                                    <td class="px-4 py-3 text-gray-600">${client.company_name || '-'}</td>
                                    <td class="px-4 py-3 text-sm text-gray-600">
                                        ${client.email ? `<div><i class="fas fa-envelope mr-1"></i>${client.email}</div>` : ''}
                                        ${client.phone ? `<div><i class="fas fa-phone mr-1"></i>${client.phone}</div>` : ''}
                                    </td>
                                    <td class="px-4 py-3">
                                        <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">${client.case_count || 1}件</span>
                                    </td>
                                    <td class="px-4 py-3 text-sm text-gray-600">${client.created_at?.split(' ')[0] || '-'}</td>
                                    <td class="px-4 py-3">
                                        <a href="/client/${client.id}" class="text-blue-600 hover:text-blue-800 mr-3">
                                            <i class="fas fa-eye"></i> 詳細
                                        </a>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <script>
            function filterCustomers() {
                const query = document.getElementById('searchQuery').value.toLowerCase();
                document.querySelectorAll('.customer-row').forEach(row => {
                    const name = row.dataset.name.toLowerCase();
                    const company = row.dataset.company.toLowerCase();
                    row.style.display = (name.includes(query) || company.includes(query)) ? '' : 'none';
                });
            }
            
            function openNewCustomerModal() {
                // 新規顧客追加のモーダルを開く（簡易版はダッシュボードへリダイレクト）
                window.location.href = '/?action=new_customer';
            }
        </script>
    </body>
    </html>
  `)
})

// =============================================
// 案件一覧ページ
// =============================================
app.get('/cases', async (c) => {
  try {
    const { DB } = c.env
    const statusFilter = c.req.query('status') || ''
    
    let query = `
      SELECT c.*, st.name as subsidy_type_name, st.category as subsidy_category,
             sg.application_end_date
      FROM clients c
      LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
      LEFT JOIN subsidy_guidelines sg ON st.id = sg.subsidy_type_id
      WHERE 1=1
    `
    
    if (statusFilter) {
      query += ` AND c.status = '${statusFilter}'`
    }
    
    query += ` ORDER BY 
      CASE WHEN sg.application_end_date IS NOT NULL AND sg.application_end_date != '' 
           THEN sg.application_end_date 
           ELSE '9999-12-31' END ASC,
      c.created_at DESC
    `
    
    const cases = await DB.prepare(query).all()
  
  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    inquiry: { label: '見込み', color: 'yellow' },
    preparing: { label: '書類準備中', color: 'orange' },
    applying: { label: '申請中', color: 'purple' },
    completed: { label: '完了', color: 'green' }
  }

  // Build case items HTML
  const caseItemsHtml = (cases.results || []).map((item: any) => {
    const statusInfo = STATUS_LABELS[item.status] || { label: item.status, color: 'gray' }
    const isDeadlineNear = item.application_end_date && new Date(item.application_end_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const subsidyBadge = item.subsidy_type_name ? '<span class="text-sm text-gray-500">' + item.subsidy_type_name + '</span>' : ''
    const deadlineBadge = isDeadlineNear ? '<span class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs"><i class="fas fa-exclamation-triangle mr-1"></i>期限間近</span>' : ''
    const deadlineText = item.application_end_date ? '<p class="text-sm text-gray-500 mt-1"><i class="fas fa-calendar mr-1"></i>申請期限: ' + item.application_end_date + '</p>' : ''
    
    return '<div class="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition border-l-4 border-' + statusInfo.color + '-400">' +
      '<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">' +
        '<div class="flex-1">' +
          '<div class="flex items-center gap-3 mb-2">' +
            '<span class="bg-' + statusInfo.color + '-100 text-' + statusInfo.color + '-800 px-2 py-1 rounded text-sm font-medium">' + statusInfo.label + '</span>' +
            subsidyBadge +
            deadlineBadge +
          '</div>' +
          '<h3 class="text-lg font-bold text-gray-900">' + item.name + '</h3>' +
          '<p class="text-gray-600">' + (item.company_name || '') + '</p>' +
          deadlineText +
        '</div>' +
        '<div class="flex gap-2">' +
          '<a href="/client/' + item.id + '" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">' +
            '<i class="fas fa-eye mr-1"></i>詳細' +
          '</a>' +
        '</div>' +
      '</div>' +
    '</div>'
  }).join('')
  
  const emptyMessage = (cases.results || []).length === 0 ? '<div class="text-center py-12 text-gray-500">案件がありません</div>' : ''
  const statusTitle = statusFilter && STATUS_LABELS[statusFilter] ? '<span class="text-lg font-normal">（' + STATUS_LABELS[statusFilter].label + '）</span>' : ''

  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>案件一覧 - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <header class="bg-blue-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <a href="/" class="text-sm hover:underline mb-2 block">
                                <i class="fas fa-arrow-left mr-1"></i>ダッシュボードに戻る
                            </a>
                            <h1 class="text-2xl font-bold">
                                <i class="fas fa-folder-open mr-2"></i>案件一覧
                                ${statusTitle}
                            </h1>
                        </div>
                        <a href="/?action=new_case" class="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50">
                            <i class="fas fa-plus mr-2"></i>新規案件登録
                        </a>
                    </div>
                </div>
            </header>

            <div class="container mx-auto px-4 py-8">
                <!-- フィルター -->
                <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <div class="flex flex-wrap gap-2">
                        <a href="/cases" class="px-4 py-2 rounded-lg ${!statusFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">すべて</a>
                        <a href="/cases?status=inquiry" class="px-4 py-2 rounded-lg ${statusFilter === 'inquiry' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">見込み</a>
                        <a href="/cases?status=preparing" class="px-4 py-2 rounded-lg ${statusFilter === 'preparing' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">書類準備中</a>
                        <a href="/cases?status=applying" class="px-4 py-2 rounded-lg ${statusFilter === 'applying' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">申請中</a>
                        <a href="/cases?status=completed" class="px-4 py-2 rounded-lg ${statusFilter === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">完了</a>
                    </div>
                </div>

                <!-- 案件一覧 -->
                <div class="space-y-4">
                    ${caseItemsHtml}
                    ${emptyMessage}
                </div>
            </div>
        </div>
    </body>
    </html>
  `)
  } catch (error: any) {
    console.error('Cases page error:', error)
    return c.text('Error: ' + (error.message || 'Unknown error'), 500)
  }
})

// =============================================
// 統計ページ
// =============================================
app.get('/admin/statistics', async (c) => {
  const { DB } = c.env
  
  // 統計データを取得
  const totalClients = await DB.prepare('SELECT COUNT(*) as count FROM clients').first() as any
  const newThisMonth = await DB.prepare(`
    SELECT COUNT(*) as count FROM clients 
    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).first() as any
  const completedThisMonth = await DB.prepare(`
    SELECT COUNT(*) as count FROM clients 
    WHERE status = 'completed' AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')
  `).first() as any
  
  const byStatus = await DB.prepare(`
    SELECT status, COUNT(*) as count FROM clients GROUP BY status
  `).all()
  
  const bySubsidyType = await DB.prepare(`
    SELECT st.name, st.category, COUNT(c.id) as count
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    GROUP BY c.subsidy_type_id
    ORDER BY count DESC
    LIMIT 10
  `).all()
  
  const monthlyStats = await DB.prepare(`
    SELECT 
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as new_count,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
    FROM clients
    WHERE created_at >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month DESC
  `).all()

  // Build HTML for status cards
  const labels: Record<string, string> = {
    inquiry: '見込み',
    consulting: '相談中',
    preparing: '書類準備中',
    applying: '申請中',
    completed: '完了'
  }
  const colors: Record<string, string> = {
    inquiry: 'yellow',
    consulting: 'blue',
    preparing: 'orange',
    applying: 'purple',
    completed: 'green'
  }
  
  const statusItemsHtml = (byStatus.results || []).map((item: any) => {
    const color = colors[item.status] || 'gray'
    const label = labels[item.status] || item.status
    return '<div class="flex items-center justify-between p-3 bg-' + color + '-50 rounded-lg">' +
      '<span class="text-sm font-medium text-' + color + '-800">' + label + '</span>' +
      '<span class="text-lg font-bold text-' + color + '-600">' + item.count + '</span>' +
    '</div>'
  }).join('')
  
  const subsidyTypeHtml = (bySubsidyType.results || []).map((item: any, index: number) => {
    return '<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">' +
      '<div class="flex items-center gap-3">' +
        '<span class="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">' + (index + 1) + '</span>' +
        '<span class="text-sm">' + (item.name || '未設定') + '</span>' +
      '</div>' +
      '<span class="text-lg font-bold text-gray-700">' + item.count + '</span>' +
    '</div>'
  }).join('')
  
  const monthlyStatsHtml = (monthlyStats.results || []).map((item: any) => {
    return '<tr class="border-b">' +
      '<td class="py-3 text-sm">' + item.month + '</td>' +
      '<td class="py-3 text-right"><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">' + item.new_count + '</span></td>' +
      '<td class="py-3 text-right"><span class="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">' + item.completed_count + '</span></td>' +
    '</tr>'
  }).join('')
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>統計情報 - 助成金申請管理システム</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <header class="bg-blue-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <a href="/" class="text-sm hover:underline mb-2 block">
                                <i class="fas fa-arrow-left mr-1"></i>ダッシュボードに戻る
                            </a>
                            <h1 class="text-2xl font-bold">
                                <i class="fas fa-chart-line mr-2"></i>統計情報
                            </h1>
                        </div>
                    </div>
                </div>
            </header>

            <div class="container mx-auto px-4 py-8">
                <!-- サマリーカード -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-500 text-sm">総顧客数</p>
                                <p class="text-3xl font-bold text-gray-900">${totalClients?.count || 0}</p>
                            </div>
                            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-users text-blue-600 text-xl"></i>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-500 text-sm">今月の新規</p>
                                <p class="text-3xl font-bold text-blue-600">${newThisMonth?.count || 0}</p>
                            </div>
                            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-user-plus text-blue-600 text-xl"></i>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-500 text-sm">今月の完了</p>
                                <p class="text-3xl font-bold text-green-600">${completedThisMonth?.count || 0}</p>
                            </div>
                            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-check-circle text-green-600 text-xl"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- ステータス別 -->
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                            <i class="fas fa-chart-pie text-purple-600"></i>ステータス別
                        </h2>
                        <div class="space-y-3">
                            ${statusItemsHtml}
                        </div>
                    </div>

                    <!-- 申請種別ランキング -->
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                            <i class="fas fa-ranking-star text-orange-600"></i>申請種別ランキング
                        </h2>
                        <div class="space-y-3">
                            ${subsidyTypeHtml}
                        </div>
                    </div>

                    <!-- 月別推移 -->
                    <div class="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
                        <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                            <i class="fas fa-chart-bar text-blue-600"></i>月別推移（過去6ヶ月）
                        </h2>
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead>
                                    <tr class="border-b">
                                        <th class="py-2 text-left text-sm font-medium text-gray-500">月</th>
                                        <th class="py-2 text-right text-sm font-medium text-gray-500">新規</th>
                                        <th class="py-2 text-right text-sm font-medium text-gray-500">完了</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${monthlyStatsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
  `)
})

export default app
