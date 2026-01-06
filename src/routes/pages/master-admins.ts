import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'
// マスター管理者ページ
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/master/admins', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>マスター管理者 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('admins')}
            
            <main class="flex-1 p-8">
                <div class="flex justify-between items-center mb-8">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-800">マスター管理者</h1>
                        <p class="text-gray-600 mt-1">SaaS全体を管理できるユーザー</p>
                    </div>
                    <button onclick="openAddModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        <i class="fas fa-plus mr-2"></i>管理者を追加
                    </button>
                </div>
                
                <div class="bg-white rounded-xl shadow-sm">
                    <div id="adminList" class="divide-y">
                        <div class="p-8 text-center text-gray-500">読み込み中...</div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- 追加モーダル -->
        <div id="addModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
            <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold">管理者を追加</h3>
                        <button onclick="closeAddModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <form id="addForm" class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">ユーザー名</label>
                        <input type="text" id="add_username" required pattern="[a-zA-Z0-9_]+" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">表示名</label>
                        <input type="text" id="add_name" required class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                        <input type="password" id="add_password" required minlength="6" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="closeAddModal()" class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">キャンセル</button>
                        <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">追加</button>
                    </div>
                </form>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${masterSidebarScripts}
            
            async function loadAdmins() {
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.get('/api/master/admins', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const admins = response.data;
                    
                    document.getElementById('adminList').innerHTML = admins.map(admin => \`
                        <div class="p-4 flex items-center justify-between hover:bg-gray-50">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-user-shield text-purple-600"></i>
                                </div>
                                <div>
                                    <p class="font-medium">\${admin.name}</p>
                                    <p class="text-sm text-gray-500">@\${admin.username}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4">
                                <span class="text-sm text-gray-500">\${new Date(admin.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
                                \${admin.id !== 1 ? \`
                                    <button onclick="deleteAdmin(\${admin.id})" class="text-red-500 hover:text-red-700">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                \` : '<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">デフォルト</span>'}
                            </div>
                        </div>
                    \`).join('') || '<div class="p-8 text-center text-gray-500">管理者がいません</div>';
                } catch (error) {
                    console.error('Load error:', error);
                }
            }
            
            function openAddModal() {
                document.getElementById('addModal').classList.remove('hidden');
            }
            
            function closeAddModal() {
                document.getElementById('addModal').classList.add('hidden');
                document.getElementById('addForm').reset();
            }
            
            document.getElementById('addForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const token = localStorage.getItem('master_token');
                    await axios.post('/api/master/admins', {
                        username: document.getElementById('add_username').value,
                        name: document.getElementById('add_name').value,
                        password: document.getElementById('add_password').value
                    }, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    closeAddModal();
                    loadAdmins();
                    alert('管理者を追加しました');
                } catch (error) {
                    alert(error.response?.data?.error || '追加に失敗しました');
                }
            });
            
            async function deleteAdmin(id) {
                if (!confirm('この管理者を削除しますか？')) return;
                try {
                    const token = localStorage.getItem('master_token');
                    await axios.delete('/api/master/admins/' + id, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    loadAdmins();
                    alert('削除しました');
                } catch (error) {
                    alert('削除に失敗しました');
                }
            }
            
            loadAdmins();
        </script>
    </body>
    </html>
  `)
})

// マスター管理者API
routes.get('/master/admins', async (c) => {
  const { DB } = c.env
  try {
    const admins = await DB.prepare(`SELECT id, username, name, created_at FROM master_admins ORDER BY id`).all()
    return c.json(admins?.results || [])
  } catch (error: any) {
    console.error('master-admins.ts Load admins error:', error)
    return c.json({ error: error.message || 'Unknown error', source: 'master-admins.ts' }, 500)
  }
})

routes.post('/master/admins', async (c) => {
  const { DB } = c.env
  const { username, name, password } = await c.req.json()
  
  if (!username || !name || !password) {
    return c.json({ error: '必須項目を入力してください' }, 400)
  }
  
  const existing = await DB.prepare(`SELECT id FROM master_admins WHERE username = ?`).bind(username).first()
  if (existing) {
    return c.json({ error: 'このユーザー名は既に使用されています' }, 400)
  }
  
  await DB.prepare(`
    INSERT INTO master_admins (username, password_hash, name) VALUES (?, ?, ?)
  `).bind(username, password, name).run()
  
  return c.json({ success: true })
})

routes.delete('/master/admins/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  if (id === '1') {
    return c.json({ error: 'デフォルト管理者は削除できません' }, 400)
  }
  
  await DB.prepare(`DELETE FROM master_admins WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

export default routes
