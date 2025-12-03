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
    // Authorization: Bearer username:role の形式
    const [username, role] = authHeader.replace('Bearer ', '').split(':')
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
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen">
            <!-- ヘッダー -->
            <header class="bg-blue-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <div class="flex items-center justify-between">
                        <h1 class="text-lg md:text-2xl font-bold">
                            <i class="fas fa-file-invoice-dollar mr-1 md:mr-2"></i>
                            <span class="hidden sm:inline">助成金申請管理システム</span>
                            <span class="sm:hidden">助成金管理</span>
                        </h1>
                        <div class="flex items-center gap-2 md:gap-4 text-xs md:text-sm">
                            <span id="adminName" class="hidden sm:inline">
                                <i class="fas fa-user-shield mr-1"></i>
                                管理者モード
                            </span>
                            <button onclick="logout()" class="hover:underline">
                                <i class="fas fa-sign-out-alt mr-1"></i>
                                <span class="hidden sm:inline">ログアウト</span>
                                <span class="sm:hidden">終了</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <!-- メインコンテンツ -->
            <div class="container mx-auto px-4 py-8">
                <!-- ステータスカード -->
                <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8" id="statusCards">
                    <div class="bg-white p-6 rounded-lg shadow">
                        <div class="text-gray-500 text-sm mb-2">見込み</div>
                        <div class="text-3xl font-bold text-yellow-500" id="count-inquiry">-</div>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow">
                        <div class="text-gray-500 text-sm mb-2">相談中</div>
                        <div class="text-3xl font-bold text-blue-500" id="count-consulting">-</div>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow">
                        <div class="text-gray-500 text-sm mb-2">書類準備中</div>
                        <div class="text-3xl font-bold text-orange-500" id="count-preparing">-</div>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow">
                        <div class="text-gray-500 text-sm mb-2">申請中</div>
                        <div class="text-3xl font-bold text-purple-500" id="count-applying">-</div>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow">
                        <div class="text-gray-500 text-sm mb-2">完了</div>
                        <div class="text-3xl font-bold text-green-500" id="count-completed">-</div>
                    </div>
                </div>

                <!-- フィルターと新規登録 -->
                <div class="bg-white rounded-lg shadow p-4 mb-6">
                    <div class="space-y-3">
                        <!-- 検索・フィルター -->
                        <div class="flex flex-col sm:flex-row gap-2">
                            <select id="filterStatus" class="px-4 py-3 border rounded-lg text-base">
                                <option value="">全ステータス</option>
                                <option value="inquiry">見込み</option>
                                <option value="consulting">相談中</option>
                                <option value="preparing">書類準備中</option>
                                <option value="applying">申請中</option>
                                <option value="completed">完了</option>
                            </select>
                            <input type="text" id="searchQuery" placeholder="顧客名・会社名で検索" 
                                   class="flex-1 px-4 py-3 border rounded-lg text-base">
                        </div>
                        <!-- アクションボタン -->
                        <div id="actionButtons" class="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <a href="/subsidy-types" 
                               class="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 text-center text-sm md:text-base">
                                <i class="fas fa-file-contract mr-1"></i>
                                <span class="hidden sm:inline">助成金種別管理</span>
                                <span class="sm:hidden">助成金管理</span>
                            </a>
                            <a href="/admin/guidelines" 
                               class="bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 text-center text-sm md:text-base">
                                <i class="fas fa-book-open mr-1"></i>
                                <span class="hidden sm:inline">公募要領管理</span>
                                <span class="sm:hidden">公募要領</span>
                            </a>
                            <a href="/admin/users" id="employeeManagementBtn"
                               class="hidden bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 text-center text-sm md:text-base">
                                <i class="fas fa-users-cog mr-1"></i>
                                <span class="hidden sm:inline">従業員管理</span>
                                <span class="sm:hidden">従業員</span>
                            </a>
                            <a href="/admin/backup" id="backupManagementBtn"
                               class="hidden bg-amber-600 text-white px-4 py-3 rounded-lg hover:bg-amber-700 text-center text-sm md:text-base">
                                <i class="fas fa-database mr-1"></i>
                                <span class="hidden sm:inline">バックアップ</span>
                                <span class="sm:hidden">バックアップ</span>
                            </a>
                            <button onclick="openNewClientModal()" 
                                    class="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 text-sm md:text-base">
                                <i class="fas fa-plus mr-1"></i>
                                <span class="hidden sm:inline">新規顧客登録</span>
                                <span class="sm:hidden">新規登録</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 統計・レポート -->
                <div class="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 class="text-xl font-bold mb-4">
                        <i class="fas fa-chart-bar mr-2"></i>統計情報
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="border rounded-lg p-4">
                            <div class="text-sm text-gray-500 mb-1">総顧客数</div>
                            <div class="text-2xl font-bold" id="stat-total">-</div>
                        </div>
                        <div class="border rounded-lg p-4">
                            <div class="text-sm text-gray-500 mb-1">今月の新規顧客</div>
                            <div class="text-2xl font-bold text-blue-600" id="stat-new-month">-</div>
                        </div>
                        <div class="border rounded-lg p-4">
                            <div class="text-sm text-gray-500 mb-1">今月の完了件数</div>
                            <div class="text-2xl font-bold text-green-600" id="stat-completed-month">-</div>
                        </div>
                    </div>
                </div>

                <!-- 顧客一覧 -->
                <div class="bg-white rounded-lg shadow">
                    <div class="p-6">
                        <h2 class="text-xl font-bold mb-4">顧客一覧</h2>
                        <div id="clientsList">
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
                                <div>読み込み中...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 新規顧客登録モーダル -->
        <div id="newClientModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-4 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <h3 class="text-xl font-bold mb-4">新規顧客登録</h3>
                <form id="newClientForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">顧客名 *</label>
                        <input type="text" name="name" required class="w-full px-3 py-2 border rounded-lg">
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
                    <div>
                        <label class="block text-sm font-medium mb-1">申請する助成金 *</label>
                        <select name="subsidy_type_id" id="newClientSubsidyType" required class="w-full px-3 py-2 border rounded-lg">
                            <option value="">選択してください</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">担当者</label>
                        <select name="assigned_to" id="newClientAssignedTo" class="w-full px-3 py-2 border rounded-lg">
                            <option value="">未割り当て</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">メモ</label>
                        <textarea name="notes" rows="3" class="w-full px-3 py-2 border rounded-lg"></textarea>
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 text-base">
                            登録
                        </button>
                        <button type="button" onclick="closeNewClientModal()" 
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
            
            // adminロールのみ従業員管理・バックアップボタン表示
            const adminRole = localStorage.getItem('admin_role');
            if (adminRole === 'admin') {
                const employeeBtn = document.getElementById('employeeManagementBtn');
                const backupBtn = document.getElementById('backupManagementBtn');
                if (employeeBtn) {
                    employeeBtn.classList.remove('hidden');
                }
                if (backupBtn) {
                    backupBtn.classList.remove('hidden');
                }
            } else {
                // staffの場合はボタンを3列にする
                const actionButtons = document.getElementById('actionButtons');
                if (actionButtons) {
                    actionButtons.classList.remove('md:grid-cols-5');
                    actionButtons.classList.add('md:grid-cols-3');
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
                } catch (error) {
                    console.error('Error loading data:', error);
                    document.getElementById('clientsList').innerHTML = 
                        '<div class="text-center py-8 text-red-500">データの読み込みに失敗しました</div>';
                }
            }
            
            // 助成金種別読み込み
            async function loadSubsidyTypes() {
                try {
                    const response = await axios.get('/api/subsidy-types');
                    subsidyTypes = response.data;
                    
                    // 新規登録フォームのセレクトボックスに追加
                    const select = document.getElementById('newClientSubsidyType');
                    select.innerHTML = '<option value="">選択してください</option>' +
                        subsidyTypes.map(type => \`<option value="\${type.id}">\${type.name}（\${type.category}）</option>\`).join('');
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
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

                container.innerHTML = clients.map(client => {
                    const subsidyType = subsidyTypes.find(s => s.id === client.subsidy_type_id);
                    const portalUrl = \`\${window.location.origin}/portal/\${client.access_token}\`;
                    return \`
                    <div class="border-b last:border-b-0 py-4 hover:bg-gray-50">
                        <!-- PC版表示 -->
                        <div class="hidden md:flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center gap-3 mb-2">
                                    <h3 class="text-lg font-bold">\${client.name}</h3>
                                    <span class="px-3 py-1 rounded-full text-xs font-medium \${STATUS_COLORS[client.status]}">
                                        \${STATUS_LABELS[client.status]}
                                    </span>
                                    \${subsidyType ? \`<span class="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">\${subsidyType.name}</span>\` : ''}
                                </div>
                                <div class="text-sm text-gray-600 space-y-1">
                                    \${client.company_name ? \`<div><i class="fas fa-building w-4"></i> \${client.company_name}</div>\` : ''}
                                    \${client.email ? \`<div><i class="fas fa-envelope w-4"></i> \${client.email}</div>\` : ''}
                                    \${client.phone ? \`<div><i class="fas fa-phone w-4"></i> \${client.phone}</div>\` : ''}
                                    \${client.assigned_staff ? \`<div><i class="fas fa-user w-4"></i> 担当: \${client.assigned_staff}</div>\` : ''}
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
                                <span class="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap \${STATUS_COLORS[client.status]}">
                                    \${STATUS_LABELS[client.status]}
                                </span>
                            </div>
                            \${subsidyType ? \`<div class="inline-block px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">\${subsidyType.name}</div>\` : ''}
                            <div class="text-sm text-gray-600 space-y-1">
                                \${client.email ? \`<div><i class="fas fa-envelope w-4"></i> \${client.email}</div>\` : ''}
                                \${client.phone ? \`<div><i class="fas fa-phone w-4"></i> \${client.phone}</div>\` : ''}
                                \${client.assigned_staff ? \`<div><i class="fas fa-user w-4"></i> 担当: \${client.assigned_staff}</div>\` : ''}
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

// 顧客一覧取得
app.get('/api/clients', async (c) => {
  const { DB } = c.env
  const user = await getCurrentUser(c)
  
  let query = `SELECT * FROM clients`
  let params = []
  
  // adminロール以外は自分が担当の案件のみ表示
  if (user && user.role !== 'admin') {
    query += ` WHERE assigned_to = ?`
    params.push(user.username)
  }
  
  query += ` ORDER BY created_at DESC`
  
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
    INSERT INTO clients (name, company_name, email, phone, access_token, assigned_staff, assigned_to, notes, subsidy_type_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.name,
    data.company_name || null,
    data.email || null,
    data.phone || null,
    token,
    data.assigned_staff || null,
    data.assigned_to || null,
    data.notes || null,
    data.subsidy_type_id || null
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
// API: 助成金種別管理
// ===============================

// 助成金種別一覧取得
app.get('/api/subsidy-types', async (c) => {
  const { DB } = c.env
  
  const result = await DB.prepare(`
    SELECT * FROM subsidy_types ORDER BY category, name
  `).all()
  
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

// ===============================
// 助成金種別管理画面
// ===============================

app.get('/subsidy-types', async (c) => {
  const { DB } = c.env
  
  const subsidyTypes = await DB.prepare(`
    SELECT * FROM subsidy_types ORDER BY category, name
  `).all()
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>助成金種別管理</title>
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
                                助成金種別管理
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

                <!-- 助成金種別一覧 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="subsidyTypesList">
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
                        <label class="block text-sm font-medium mb-1">カテゴリ</label>
                        <select name="category" class="w-full px-3 py-2 border rounded-lg">
                            <option value="IT系">IT系</option>
                            <option value="雇用系">雇用系</option>
                            <option value="設備投資系">設備投資系</option>
                            <option value="一般">一般</option>
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

            // 助成金種別一覧読み込み
            async function loadSubsidyTypes() {
                try {
                    const response = await axios.get('/api/subsidy-types');
                    subsidyTypes = response.data;
                    renderSubsidyTypes();
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
            }

            // 助成金種別表示
            function renderSubsidyTypes() {
                const container = document.getElementById('subsidyTypesList');
                
                if (subsidyTypes.length === 0) {
                    container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">まだ助成金種別が登録されていません</div>';
                    return;
                }

                container.innerHTML = subsidyTypes.map(subsidy => \`
                    <div class="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
                        <div class="flex items-start justify-between mb-3">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    <h3 class="text-lg font-bold">\${subsidy.name}</h3>
                                    <span class="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                        \${subsidy.category}
                                    </span>
                                </div>
                                <p class="text-sm text-gray-600">\${subsidy.description || '説明なし'}</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="viewSubsidyDetail(\${subsidy.id})" 
                                    class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                <i class="fas fa-eye mr-1"></i>詳細・編集
                            </button>
                        </div>
                    </div>
                \`).join('');
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
                            
                            <div class="flex gap-2 pt-4">
                                <button onclick="closeEditSubsidyModal()" 
                                        class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
                                    閉じる
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

                        <!-- 書類一覧 -->
                        <div class="bg-white rounded-lg shadow p-6">
                            <h2 class="text-lg font-bold mb-4">書類一覧</h2>
                            <div id="documentsList"></div>
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
                        <select name="subsidy_type_id" id="edit_subsidy_type_id" class="w-full px-3 py-2 border rounded-lg">
                            <option value="">選択してください</option>
                        </select>
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
                    
                    // 編集フォームのセレクトボックスに追加
                    const select = document.getElementById('edit_subsidy_type_id');
                    select.innerHTML = '<option value="">選択してください</option>' +
                        subsidyTypes.map(type => \`<option value="\${type.id}">\${type.name}（\${type.category}）</option>\`).join('');
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
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
                const response = await axios.get(\`/api/clients/\${CLIENT_ID}/documents\`);
                const docs = response.data;
                
                const container = document.getElementById('documentsList');
                if (docs.length === 0) {
                    container.innerHTML = '<div class="text-sm text-gray-500">まだ書類がありません</div>';
                    return;
                }
                
                container.innerHTML = docs.map(doc => \`
                    <div class="border-b py-3 last:border-b-0">
                        <div class="mb-2">
                            <div class="font-medium text-sm">\${doc.document_type}</div>
                            <div class="text-xs text-gray-500">\${doc.file_name}</div>
                            <div class="text-xs text-gray-400">\${new Date(doc.uploaded_at).toLocaleString('ja-JP')}</div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs px-2 py-1 rounded-full \${
                                doc.status === 'approved' ? 'bg-green-100 text-green-800' :
                                doc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                            }">
                                \${doc.status === 'approved' ? '承認済み' : doc.status === 'rejected' ? '差し戻し' : '確認中'}
                            </span>
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
                                    <i class="fas fa-times mr-1"></i>差戻し
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
                    <div class="flex justify-end mb-3">
                        <div class="max-w-[80%] bg-blue-100 rounded-lg p-3">
                            <div class="flex items-center gap-2 mb-1">
                                <i class="fas fa-user text-sm text-blue-600"></i>
                                <span class="text-xs font-medium">あなた</span>
                            </div>
                            <div class="text-sm">\${message}</div>
                        </div>
                    </div>
                    <div class="flex justify-start mb-3" id="aiTyping">
                        <div class="max-w-[80%] bg-purple-100 rounded-lg p-3">
                            <i class="fas fa-spinner fa-spin text-purple-600"></i>
                            <span class="text-sm ml-2">考え中...</span>
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
                    
                    container.innerHTML += \`
                        <div class="flex justify-start mb-3">
                            <div class="max-w-[80%] bg-purple-100 rounded-lg p-3">
                                <div class="flex items-center gap-2 mb-1">
                                    <i class="fas fa-robot text-sm text-purple-600"></i>
                                    <span class="text-xs font-medium">AIアシスタント</span>
                                </div>
                                <div class="text-sm whitespace-pre-wrap">\${response.data.response}</div>
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
                                            <div class="text-sm font-medium">\${q.question_text}</div>
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
                    <h1 class="text-lg md:text-2xl font-bold">
                        <i class="fas fa-user-circle mr-1 md:mr-2"></i>
                        ${client.name} 様
                    </h1>
                    <p class="text-xs md:text-sm mt-1">助成金申請の書類提出とやり取り</p>
                </div>
            </header>

            <div class="container mx-auto px-4 py-4 lg:py-6">
                <!-- PC: 2カラムレイアウト / モバイル: 縦並び -->
                <div class="lg:grid lg:grid-cols-12 lg:gap-6">
                    
                    <!-- 左カラム: ステータス + ヒアリング質問 -->
                    <div class="lg:col-span-7 xl:col-span-8 space-y-4 lg:space-y-6">
                        <!-- 現在のステータス (コンパクト) -->
                        <div class="bg-white rounded-lg shadow p-4">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="text-2xl" id="statusIcon"></div>
                                    <div>
                                        <div class="text-lg font-bold" id="statusText"></div>
                                        <div class="text-xs text-gray-600" id="statusDescription"></div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs text-gray-500">回答進捗</div>
                                    <div id="hearingProgress" class="text-sm font-medium text-indigo-600">0 / 0 問</div>
                                </div>
                            </div>
                            <div class="mt-3 w-full bg-indigo-200 rounded-full h-2">
                                <div id="hearingProgressBar" class="bg-indigo-600 h-2 rounded-full transition-all" style="width: 0%"></div>
                            </div>
                        </div>

                        <!-- ヒアリング質問セクション -->
                        <div class="bg-white rounded-lg shadow p-4 lg:p-6">
                            <div class="flex items-center justify-between mb-4">
                                <h2 class="text-lg font-bold">
                                    <i class="fas fa-clipboard-list mr-2 text-indigo-600"></i>ヒアリング質問
                                </h2>
                                <div class="flex gap-2">
                                    <button onclick="saveAllHearingAnswers()" 
                                            class="bg-indigo-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-indigo-700">
                                        <i class="fas fa-save mr-1"></i>保存
                                    </button>
                                    <button onclick="autoFillWithAI()" 
                                            class="bg-purple-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-purple-700">
                                        <i class="fas fa-magic mr-1"></i>AI回答
                                    </button>
                                </div>
                            </div>
                            
                            <!-- カテゴリ別タブ -->
                            <div class="mb-4 border-b">
                                <div id="hearingCategoryTabs" class="flex overflow-x-auto gap-1">
                                    <div class="text-gray-500 text-sm py-2">読み込み中...</div>
                                </div>
                            </div>
                            
                            <!-- 質問一覧 (スクロール可能) -->
                            <div id="hearingQuestionsList" class="space-y-4 max-h-[60vh] lg:max-h-[65vh] overflow-y-auto pr-2">
                                <div class="text-center py-8 text-gray-500">
                                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                    <p>ヒアリング質問を読み込み中...</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 右カラム: AIアシスタント + 書類 + やり取り -->
                    <div class="lg:col-span-5 xl:col-span-4 mt-4 lg:mt-0">
                        <div class="lg:sticky lg:top-4 space-y-4">
                            <!-- AIアシスタント（質問・相談用） -->
                            <div class="bg-white rounded-lg shadow p-4">
                                <h2 class="text-base font-bold mb-3">
                                    <i class="fas fa-robot mr-2 text-purple-600"></i>AIアシスタント
                                </h2>
                                
                                <div id="portalAiChat" class="border rounded-lg mb-3 h-48 lg:h-40 overflow-y-auto p-3 bg-gray-50 text-sm">
                                    <div class="text-center text-gray-500 py-4">
                                        <i class="fas fa-robot text-3xl mb-2 text-purple-400"></i>
                                        <p class="text-sm">補助金申請のお手伝いをします</p>
                                    </div>
                                </div>
                                
                                <form id="portalAiChatForm" class="flex gap-2">
                                    <input type="text" id="portalAiChatInput" 
                                           placeholder="AIに質問..." 
                                           class="flex-1 px-3 py-2 border rounded-lg text-sm" required>
                                    <button type="submit" 
                                            class="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700">
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                </form>
                            </div>

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
                                        <h3 class="text-sm font-medium mb-2">必要書類</h3>
                                        <div id="checklistItems" class="space-y-1 text-xs max-h-24 overflow-y-auto"></div>
                                    </div>

                                    <div class="mb-3">
                                        <select id="documentType" class="w-full px-3 py-2 border rounded-lg text-sm border-green-500">
                                            <option value="">書類の種類を選択</option>
                                        </select>
                                    </div>

                                    <div id="uploadSection" class="hidden mb-3">
                                        <div id="dropZone" class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center transition-colors">
                                            <i class="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-1"></i>
                                            <p class="text-xs text-gray-600 mb-2">ドラッグ&ドロップ または</p>
                                            <input type="file" id="fileInput" class="hidden" multiple>
                                            <button onclick="document.getElementById('fileInput').click()" 
                                                    class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                                                <i class="fas fa-file mr-1"></i>選択
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 class="text-sm font-medium mb-2">アップロード済み</h3>
                                        <div id="uploadedDocuments" class="max-h-32 overflow-y-auto text-sm"></div>
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

            <!-- モバイル用フローティングボタン（スクロールで隠れた時用） -->
            <div class="lg:hidden fixed bottom-4 right-4 z-40">
                <button onclick="document.getElementById('portalAiChatInput').focus(); document.getElementById('portalAiChat').scrollIntoView({behavior: 'smooth'})" 
                        class="bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700">
                    <i class="fas fa-robot text-xl"></i>
                </button>
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

            async function loadChecklist() {
                // 顧客の助成金種別に基づくチェックリストを取得
                const response = await axios.get(\`/api/clients/\${CLIENT_ID}/document-checklist\`);
                const items = response.data;
                
                const docsResponse = await axios.get(\`/api/clients/\${CLIENT_ID}/documents\`);
                const uploadedDocs = docsResponse.data;
                const uploadedTypes = new Set(uploadedDocs.map(d => d.document_type));
                
                document.getElementById('checklistItems').innerHTML = items.map(item => \`
                    <div class="flex items-center gap-1.5 py-0.5">
                        <i class="fas fa-\${uploadedTypes.has(item.document_type) ? 'check-circle text-green-500' : 'circle text-gray-300'} text-xs"></i>
                        <span class="\${uploadedTypes.has(item.document_type) ? 'text-green-700' : 'text-gray-600'}">\${item.document_type}</span>
                    </div>
                \`).join('');

                const select = document.getElementById('documentType');
                select.innerHTML = '<option value="">書類の種類を選択</option>' + 
                    items.map(item => \`<option value="\${item.document_type}">\${item.document_type}</option>\`).join('');
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

            // 書類の種類選択時の処理
            document.getElementById('documentType').addEventListener('change', (e) => {
                const uploadSection = document.getElementById('uploadSection');
                if (e.target.value) {
                    uploadSection.classList.remove('hidden');
                } else {
                    uploadSection.classList.add('hidden');
                }
            });

            document.getElementById('fileInput').addEventListener('change', async (e) => {
                const files = e.target.files;
                const documentType = document.getElementById('documentType').value;
                
                if (!documentType) {
                    showMessage('error', '書類の種類を選択してください');
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
                    
                    showMessage('success', \`\${successCount}件の書類をアップロードしました！\`);
                    document.getElementById('fileInput').value = '';
                    await loadDocuments();
                    await loadChecklist();
                } catch (error) {
                    console.error('Upload error:', error);
                    if (error.response) {
                        showMessage('error', \`アップロードエラー: \${error.response.data.error || '不明なエラー'}\`);
                    } else {
                        showMessage('error', 'ネットワークエラーが発生しました。もう一度お試しください。');
                    }
                }
            });

            // ドラッグ&ドロップ機能
            const dropZone = document.getElementById('dropZone');
            
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-green-500', 'bg-green-50');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-green-500', 'bg-green-50');
            });
            
            dropZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-green-500', 'bg-green-50');
                
                const documentType = document.getElementById('documentType').value;
                if (!documentType) {
                    showMessage('error', '書類の種類を選択してください');
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
                    
                    showMessage('success', \`\${successCount}件の書類をアップロードしました！\`);
                    await loadDocuments();
                    await loadChecklist();
                } catch (error) {
                    console.error('Upload error:', error);
                    if (error.response) {
                        showMessage('error', \`アップロードエラー: \${error.response.data.error || '不明なエラー'}\`);
                    } else {
                        showMessage('error', 'ネットワークエラーが発生しました。もう一度お試しください。');
                    }
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
                                <div class="font-medium text-gray-800 mb-1">\${q.question_text}</div>
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
                        <textarea onchange="updateHearingAnswer(\${question.id}, this.value)"
                                  placeholder="回答を入力してください..."
                                  rows="3"
                                  class="w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none">\${currentAnswer}</textarea>
                    \`;
                }
            }
            
            function updateHearingAnswer(questionId, value) {
                hearingAnswers[questionId] = value;
                updateProgress();
                // カテゴリタブの進捗も更新
                const categories = [...new Set(hearingQuestions.map(q => q.category))];
                renderCategoryTabs(categories);
            }
            
            function updateProgress() {
                const total = hearingQuestions.length;
                const answered = hearingQuestions.filter(q => hearingAnswers[q.id] && hearingAnswers[q.id].trim()).length;
                const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
                
                document.getElementById('hearingProgress').textContent = \`\${answered} / \${total} 問\`;
                document.getElementById('hearingProgressBar').style.width = \`\${percent}%\`;
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
                    <div class="flex justify-end mb-3">
                        <div class="max-w-[80%] bg-green-100 rounded-lg p-3">
                            <div class="flex items-center gap-2 mb-1">
                                <i class="fas fa-user text-sm text-green-600"></i>
                                <span class="text-xs font-medium">あなた</span>
                            </div>
                            <div class="text-sm">\${message}</div>
                        </div>
                    </div>
                    <div class="flex justify-start mb-3" id="portalAiTyping">
                        <div class="max-w-[80%] bg-purple-100 rounded-lg p-3">
                            <i class="fas fa-spinner fa-spin text-purple-600"></i>
                            <span class="text-sm ml-2">考え中...</span>
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
                    
                    container.innerHTML += \`
                        <div class="flex justify-start mb-3">
                            <div class="max-w-[80%] bg-purple-100 rounded-lg p-3">
                                <div class="flex items-center gap-2 mb-1">
                                    <i class="fas fa-robot text-sm text-purple-600"></i>
                                    <span class="text-xs font-medium">AIアシスタント</span>
                                </div>
                                <div class="text-sm whitespace-pre-wrap">\${response.data.response}</div>
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

            loadStatus();
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
                    <div class="flex justify-between items-center">
                        <h2 class="text-lg font-bold">公募要領詳細</h2>
                        <button onclick="openAddGuidelineModal()" 
                                class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                            <i class="fas fa-plus mr-2"></i>新規追加
                        </button>
                    </div>
                    <div id="guidelinesList" class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <label class="block text-sm font-medium mb-1">年度</label>
                            <input type="text" name="fiscal_year" class="w-full px-3 py-2 border rounded-lg" placeholder="令和6年度">
                        </div>
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
                            <input type="text" name="subsidy_rate" class="w-full px-3 py-2 border rounded-lg" placeholder="1/2">
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

            // 公募要領一覧
            async function loadGuidelines() {
                const response = await axios.get('/api/subsidy-guidelines');
                const guidelines = response.data;
                
                const container = document.getElementById('guidelinesList');
                if (guidelines.length === 0) {
                    container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">公募要領詳細がありません</div>';
                    return;
                }
                
                container.innerHTML = guidelines.map(g => \`
                    <div class="bg-white rounded-lg shadow p-4">
                        <div class="flex items-start justify-between mb-2">
                            <span class="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">\${g.subsidy_name}</span>
                            <span class="px-2 py-1 \${g.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} rounded text-xs">\${g.status === 'active' ? '有効' : g.status}</span>
                        </div>
                        <h3 class="font-bold mb-2">\${g.fiscal_year || ''} \${g.version || ''}</h3>
                        <div class="text-sm text-gray-600 space-y-1">
                            \${g.application_end_date ? \`<div><i class="fas fa-calendar mr-1"></i>締切: \${g.application_end_date}</div>\` : ''}
                            \${g.max_amount ? \`<div><i class="fas fa-yen-sign mr-1"></i>上限: \${(g.max_amount / 10000).toLocaleString()}万円</div>\` : ''}
                            \${g.subsidy_rate ? \`<div><i class="fas fa-percent mr-1"></i>補助率: \${g.subsidy_rate}</div>\` : ''}
                        </div>
                        \${g.source_url ? \`<a href="\${g.source_url}" target="_blank" class="text-blue-600 hover:underline text-sm mt-2 block"><i class="fas fa-external-link-alt mr-1"></i>公式サイト</a>\` : ''}
                    </div>
                \`).join('');
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

// Gemini API呼び出しヘルパー
async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey) {
    // デモモード：APIキーがない場合はダミーレスポンス
    return `【デモモード】\n\nAPIキーが設定されていないため、実際のAI生成は行われません。\n\n本番環境では、以下のプロンプトに基づいてAIが文章を生成します：\n\n${prompt.substring(0, 200)}...`
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
  
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }
  
  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ===============================
// ヒアリング質問API
// ===============================

// 補助金種別のヒアリング質問取得
app.get('/api/hearing-questions/:subsidyTypeId', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.param('subsidyTypeId')
  
  const result = await DB.prepare(`
    SELECT * FROM hearing_questions 
    WHERE subsidy_type_id = ?
    ORDER BY display_order
  `).bind(subsidyTypeId).all()
  
  return c.json(result.results)
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

// ヒアリング回答保存
app.post('/api/clients/:clientId/hearing-answers', async (c) => {
  const { DB } = c.env
  const clientId = c.req.param('clientId')
  const data = await c.req.json()
  
  // 既存の回答を確認
  const existing = await DB.prepare(`
    SELECT id FROM hearing_answers WHERE client_id = ? AND question_id = ?
  `).bind(clientId, data.question_id).first()
  
  if (existing) {
    // 更新
    await DB.prepare(`
      UPDATE hearing_answers 
      SET answer_text = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(data.answer_text, existing.id).run()
    return c.json({ id: existing.id, updated: true })
  } else {
    // 新規作成
    const result = await DB.prepare(`
      INSERT INTO hearing_answers (client_id, question_id, answer_text)
      VALUES (?, ?, ?)
    `).bind(clientId, data.question_id, data.answer_text).run()
    return c.json({ id: result.meta.last_row_id, created: true })
  }
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
  const systemPrompt = `あなたは補助金申請を支援するAIアシスタントです。
親切で分かりやすい言葉で、申請者の情報を引き出すお手伝いをしてください。

【顧客情報】
- 顧客名: ${client?.name || '未設定'}
- 会社名: ${client?.company_name || '未設定'}
- 申請予定の補助金: ${client?.subsidy_name || '未設定'}

【これまでのヒアリング回答】
${(answers.results || []).map((a: any) => `Q: ${a.question_text}\nA: ${a.answer_text || '未回答'}`).join('\n\n')}

【直近の会話履歴】
${(chatHistory.results || []).reverse().map((m: any) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`).join('\n')}

以下のユーザーメッセージに対して、補助金申請に役立つ回答をしてください。
必要に応じて追加の質問をして、申請に必要な情報を収集してください。`

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
  
  // 各セクションをAIで生成
  for (const section of sections) {
    const sectionPrompt = `${template.ai_prompt_base}

【顧客情報】
- 会社名: ${client.company_name || '未設定'}
- 顧客名: ${client.name}
- 申請補助金: ${client.subsidy_name}

【ヒアリング回答】
${(answers.results || []).map((a: any) => `【${a.category}】${a.question_text}\n回答: ${a.answer_text || '未回答'}`).join('\n\n')}

【採択事例の成功ポイント（参考）】
${(successCases.results || []).map((c: any, i: number) => `事例${i+1}: ${c.success_summary}`).join('\n')}

【生成するセクション】
セクション名: ${section.title}
説明: ${section.description}
文字数上限: ${section.max_chars}文字

上記の情報を基に、このセクションの内容を生成してください。
- 具体的な数値を含めてください
- 審査員が納得できる論理的な説明を心がけてください
- 文字数は${section.max_chars}文字以内に収めてください`

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

上記の情報を基に、このセクションの内容を再生成してください。`

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
      
      // JSONを抽出
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        
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
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
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
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      
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
    
    return c.json({ error: 'AI分析の解析に失敗しました' }, 500)
  } catch (error) {
    return c.json({ 
      error: 'AI分析に失敗しました',
      prediction: {
        adoption_probability: 50,
        confidence_level: 'low',
        overall_assessment: 'C',
        improvement_suggestions: [{ priority: 'high', suggestion: 'ヒアリング情報を充実させてください', expected_impact: '予測精度の向上' }]
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

各補助金について詳細に分析し、以下のJSON形式で回答してください：
{
  "company_summary": "企業の特徴を100文字程度で要約",
  "recommendations": [
    {
      "subsidy_name": "補助金名",
      "match_score": 0-100,
      "adoption_probability": 0-100,
      "rank": 1-n（お勧め順位）,
      "compatibility": {
        "eligibility": { "met": true/false, "detail": "詳細説明" },
        "business_fit": { "score": 0-100, "detail": "詳細説明" },
        "timing": { "status": "申請可能" | "申請期間外" | "間もなく締切", "deadline_days": 残り日数 }
      },
      "reasons": ["推奨理由1", "推奨理由2"],
      "concerns": ["懸念点1", "懸念点2"],
      "preparation_steps": ["準備ステップ1", "準備ステップ2"],
      "estimated_amount": "想定される補助金額（万円）",
      "application_complexity": "簡単" | "普通" | "複雑"
    }
  ],
  "overall_strategy": "この企業に対する補助金活用の総合戦略（200文字以内）",
  "priority_actions": ["優先して行うべきアクション1", "アクション2", "アクション3"]
}`

  try {
    const response = await callGeminiAPI(prompt, GEMINI_API_KEY)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      
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
            rec.match_score,
            rec.adoption_probability,
            rec.reasons?.join(', ') || '',
            JSON.stringify(rec.compatibility)
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
    
    return c.json({ error: 'AI分析の解析に失敗しました' }, 500)
  } catch (error) {
    return c.json({ error: 'AI分析に失敗しました' }, 500)
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

export default app
