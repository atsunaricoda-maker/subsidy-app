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
    username: user.username
  })
})

// ログアウトAPI
app.post('/api/auth/logout', (c) => {
  return c.json({ success: true })
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
                        <h1 class="text-2xl font-bold">
                            <i class="fas fa-file-invoice-dollar mr-2"></i>
                            助成金申請管理システム
                        </h1>
                        <div class="flex items-center gap-4 text-sm">
                            <span id="adminName">
                                <i class="fas fa-user-shield mr-1"></i>
                                管理者モード
                            </span>
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
                    <div class="flex items-center justify-between">
                        <div class="flex gap-2">
                            <select id="filterStatus" class="px-4 py-2 border rounded-lg">
                                <option value="">全ステータス</option>
                                <option value="inquiry">見込み</option>
                                <option value="consulting">相談中</option>
                                <option value="preparing">書類準備中</option>
                                <option value="applying">申請中</option>
                                <option value="completed">完了</option>
                            </select>
                            <input type="text" id="searchQuery" placeholder="顧客名・会社名で検索" 
                                   class="px-4 py-2 border rounded-lg w-64">
                        </div>
                        <div class="flex gap-2">
                            <a href="/subsidy-types" 
                               class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700">
                                <i class="fas fa-file-contract mr-2"></i>助成金種別管理
                            </a>
                            <button onclick="openNewClientModal()" 
                                    class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                                <i class="fas fa-plus mr-2"></i>新規顧客登録
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
        <div id="newClientModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-md w-full">
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
                        <label class="block text-sm font-medium mb-1">担当スタッフ</label>
                        <input type="text" name="assigned_staff" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">メモ</label>
                        <textarea name="notes" rows="3" class="w-full px-3 py-2 border rounded-lg"></textarea>
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                            登録
                        </button>
                        <button type="button" onclick="closeNewClientModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
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
                        <div class="flex items-start justify-between">
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
            
            // トースト通知表示
            function showToast(message) {
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
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
  const result = await DB.prepare(`
    SELECT * FROM clients ORDER BY created_at DESC
  `).all()
  
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
  
  const client = await DB.prepare(`
    SELECT * FROM clients WHERE id = ?
  `).bind(id).first()
  
  if (!client) {
    return c.json({ error: 'Client not found' }, 404)
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
    INSERT INTO clients (name, company_name, email, phone, access_token, assigned_staff, notes, subsidy_type_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.name,
    data.company_name || null,
    data.email || null,
    data.phone || null,
    token,
    data.assigned_staff || null,
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
  
  await DB.prepare(`
    UPDATE clients 
    SET name = ?, company_name = ?, email = ?, phone = ?, 
        status = ?, assigned_staff = ?, notes = ?, subsidy_type_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.name,
    data.company_name || null,
    data.email || null,
    data.phone || null,
    data.status,
    data.assigned_staff || null,
    data.notes || null,
    data.subsidy_type_id || null,
    id
  ).run()
  
  return c.json({ success: true })
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
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- 顧客情報 -->
                    <div class="lg:col-span-1">
                        <div class="bg-white rounded-lg shadow p-6 mb-6">
                            <h2 class="text-lg font-bold mb-4">顧客情報</h2>
                            <div class="space-y-3 text-sm" id="clientInfo"></div>
                            <button onclick="editClient()" class="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                                <i class="fas fa-edit mr-2"></i>編集
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
            </div>
        </div>

        <!-- 顧客編集モーダル -->
        <div id="editClientModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-md w-full">
                <h3 class="text-xl font-bold mb-4">顧客情報編集</h3>
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
                        <label class="block text-sm font-medium mb-1">担当スタッフ</label>
                        <input type="text" name="assigned_staff" id="edit_assigned_staff" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">メモ</label>
                        <textarea name="notes" id="edit_notes" rows="3" class="w-full px-3 py-2 border rounded-lg"></textarea>
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                            更新
                        </button>
                        <button type="button" onclick="closeEditModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
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

            async function loadClient() {
                const response = await axios.get(\`/api/clients/\${CLIENT_ID}\`);
                currentClient = response.data;
                
                const subsidyType = subsidyTypes.find(s => s.id === currentClient.subsidy_type_id);
                const portalUrl = \`\${window.location.origin}/portal/\${currentClient.access_token}\`;
                
                document.getElementById('clientInfo').innerHTML = \`
                    <div><strong>会社名:</strong> \${currentClient.company_name || '-'}</div>
                    <div><strong>メール:</strong> \${currentClient.email || '-'}</div>
                    <div><strong>電話:</strong> \${currentClient.phone || '-'}</div>
                    <div><strong>申請助成金:</strong> \${subsidyType ? subsidyType.name : '-'}</div>
                    <div><strong>ステータス:</strong> \${STATUS_LABELS[currentClient.status]}</div>
                    <div><strong>担当:</strong> \${currentClient.assigned_staff || '-'}</div>
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
                
                await axios.post(\`/api/clients/\${CLIENT_ID}/communications\`, {
                    message,
                    sender_type: 'staff',
                    sender_name: 'スタッフ'
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
                document.getElementById('edit_assigned_staff').value = currentClient.assigned_staff || '';
                document.getElementById('edit_notes').value = currentClient.notes || '';
                
                document.getElementById('editClientModal').classList.remove('hidden');
            }
            
            function closeEditModal() {
                document.getElementById('editClientModal').classList.add('hidden');
            }
            
            document.getElementById('editClientForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                try {
                    await axios.put(\`/api/clients/\${CLIENT_ID}\`, data);
                    closeEditModal();
                    loadClient();
                    alert('更新しました');
                } catch (error) {
                    alert('更新に失敗しました');
                    console.error(error);
                }
            });

            loadSubsidyTypes().then(() => {
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
                <div class="container mx-auto px-4 py-4">
                    <h1 class="text-2xl font-bold">
                        <i class="fas fa-user-circle mr-2"></i>
                        ${client.name} 様 専用ポータル
                    </h1>
                    <p class="text-sm mt-1">助成金申請に必要な書類をアップロードしたり、担当者とやり取りができます</p>
                </div>
            </header>

            <div class="container mx-auto px-4 py-8">
                <!-- 現在のステータス -->
                <div class="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 class="text-lg font-bold mb-3">現在の進捗状況</h2>
                    <div class="flex items-center gap-4">
                        <div class="text-3xl" id="statusIcon"></div>
                        <div>
                            <div class="text-2xl font-bold" id="statusText"></div>
                            <div class="text-sm text-gray-600" id="statusDescription"></div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- 書類アップロード -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-lg font-bold mb-4">
                            <i class="fas fa-upload mr-2"></i>書類アップロード
                        </h2>
                        
                        <div class="mb-4">
                            <h3 class="font-medium mb-2">必要書類チェックリスト</h3>
                            <div id="checklistItems" class="space-y-2 text-sm"></div>
                        </div>

                        <div id="dropZone" class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4 transition-colors">
                            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
                            <p class="text-sm text-gray-600 mb-4">ここに書類をドラッグ&ドロップ<br>または</p>
                            <input type="file" id="fileInput" class="hidden" multiple>
                            <button onclick="document.getElementById('fileInput').click()" 
                                    class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                                ファイルを選択
                            </button>
                        </div>

                        <div class="mb-4">
                            <label class="block text-sm font-medium mb-1">書類の種類</label>
                            <select id="documentType" class="w-full px-3 py-2 border rounded-lg">
                                <option value="">選択してください</option>
                            </select>
                        </div>

                        <h3 class="font-medium mb-2">アップロード済み書類</h3>
                        <div id="uploadedDocuments"></div>
                    </div>

                    <!-- やり取り -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-lg font-bold mb-4">
                            <i class="fas fa-comments mr-2"></i>担当者とのやり取り
                        </h2>
                        
                        <div id="clientCommunications" class="space-y-3 mb-4 max-h-96 overflow-y-auto"></div>
                        
                        <form id="clientMessageForm" class="flex gap-2">
                            <input type="text" id="clientMessageInput" 
                                   placeholder="メッセージを入力..." 
                                   class="flex-1 px-4 py-2 border rounded-lg" required>
                            <button type="submit" 
                                    class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                                送信
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
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
                    <div class="flex items-center gap-2">
                        <i class="fas fa-\${uploadedTypes.has(item.document_type) ? 'check-circle text-green-500' : 'circle text-gray-300'}"></i>
                        <div>
                            <div class="font-medium">\${item.document_type}</div>
                            <div class="text-xs text-gray-500">\${item.description || ''}</div>
                        </div>
                    </div>
                \`).join('');

                const select = document.getElementById('documentType');
                select.innerHTML = '<option value="">選択してください</option>' + 
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
                    <div class="border rounded-lg p-3 mb-2">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
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
                                   class="text-green-600 hover:text-green-800">
                                    <i class="fas fa-download"></i>
                                </a>
                            </div>
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
                            <div class="max-w-xs \${isClient ? 'bg-green-100' : 'bg-gray-100'} rounded-lg p-3">
                                <div class="font-medium text-sm mb-1">\${comm.sender_name}</div>
                                <div class="text-sm">\${comm.message}</div>
                                <div class="text-xs text-gray-500 mt-1">\${new Date(comm.created_at).toLocaleString('ja-JP')}</div>
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
                const documentType = document.getElementById('documentType').value;
                
                if (!documentType) {
                    alert('書類の種類を選択してください');
                    return;
                }
                
                if (files.length === 0) return;
                
                // 実際のファイルアップロード（R2使用）
                try {
                    for (const file of files) {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('document_type', documentType);
                        formData.append('uploaded_by', 'client');
                        
                        await axios.post(\`/api/clients/\${CLIENT_ID}/documents/upload\`, formData, {
                            headers: {
                                'Content-Type': 'multipart/form-data'
                            }
                        });
                    }
                    
                    alert('アップロードしました');
                    document.getElementById('fileInput').value = '';
                    loadDocuments();
                    loadChecklist();
                } catch (error) {
                    console.error('Upload error:', error);
                    alert('アップロードに失敗しました');
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
                    alert('書類の種類を選択してください');
                    return;
                }
                
                const files = e.dataTransfer.files;
                if (files.length === 0) return;
                
                try {
                    for (const file of files) {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('document_type', documentType);
                        formData.append('uploaded_by', 'client');
                        
                        await axios.post(\`/api/clients/\${CLIENT_ID}/documents/upload\`, formData, {
                            headers: {
                                'Content-Type': 'multipart/form-data'
                            }
                        });
                    }
                    
                    alert('アップロードしました');
                    loadDocuments();
                    loadChecklist();
                } catch (error) {
                    console.error('Upload error:', error);
                    alert('アップロードに失敗しました');
                }
            });

            loadStatus();
            loadChecklist();
            loadDocuments();
            loadCommunications();
        </script>
    </body>
    </html>
  `)
})

export default app
