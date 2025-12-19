// 従業員管理画面
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/admin/users', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>従業員管理 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('users')}
            
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-users-cog mr-2"></i>従業員管理
                            </h2>
                        </div>
                        <button onclick="openAddUserModal()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                            <i class="fas fa-user-plus mr-2"></i>新規追加
                        </button>
                    </div>
                </header>

                <div class="p-4 lg:p-6">
                    <!-- 従業員一覧 -->
                    <div class="bg-white rounded-lg shadow overflow-hidden">
                        <table class="w-full">
                            <thead class="bg-gray-50 border-b">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ユーザー名</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">表示名</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">権限</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">登録日</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                                </tr>
                            </thead>
                            <tbody id="usersList" class="divide-y divide-gray-200">
                                <tr>
                                    <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                        <div>読み込み中...</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
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
                    <div>
                        <label class="block text-sm font-medium mb-1">権限 *</label>
                        <select name="role" required class="w-full px-3 py-2 border rounded-lg">
                            <option value="staff">スタッフ</option>
                            <option value="admin">管理者</option>
                        </select>
                        <p class="text-xs text-gray-500 mt-1">管理者は従業員管理、支払い管理、設定変更などが可能です</p>
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
                    <div>
                        <label class="block text-sm font-medium mb-1">権限 *</label>
                        <select name="role" id="editUserRole" required class="w-full px-3 py-2 border rounded-lg">
                            <option value="staff">スタッフ</option>
                            <option value="admin">管理者</option>
                        </select>
                        <p class="text-xs text-gray-500 mt-1">管理者は従業員管理、支払い管理、設定変更などが可能です</p>
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
            ${sidebarScripts}
        </script>
        <script>
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
                document.getElementById('editUserRole').value = user.role || 'staff';
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
                                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                                    従業員が登録されていません
                                </td>
                            </tr>
                        \`;
                        return;
                    }
                    
                    const roleLabels = {
                        admin: { label: '管理者', color: 'bg-red-100 text-red-700', icon: 'fa-user-shield' },
                        staff: { label: 'スタッフ', color: 'bg-blue-100 text-blue-700', icon: 'fa-user' }
                    };
                    
                    tbody.innerHTML = users.map(user => {
                        const role = roleLabels[user.role] || roleLabels.staff;
                        return \`
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 text-sm">\${user.id}</td>
                            <td class="px-6 py-4">
                                <div class="font-medium">\${user.username}</div>
                                \${user.id === 1 ? '<span class="text-xs text-green-600"><i class="fas fa-shield-alt mr-1"></i>メイン管理者</span>' : ''}
                            </td>
                            <td class="px-6 py-4">\${user.name}</td>
                            <td class="px-6 py-4">
                                <span class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium \${role.color}">
                                    <i class="fas \${role.icon}"></i>
                                    \${role.label}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-500 hidden sm:table-cell">
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
                    \`}).join('');
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

            // グローバルスコープに関数を公開（onclick対応）
            window.logout = logout;
            window.openAddUserModal = openAddUserModal;
            window.closeAddUserModal = closeAddUserModal;
            window.openEditUserModal = openEditUserModal;
            window.closeEditUserModal = closeEditUserModal;
            window.deleteUser = deleteUser;
            window.showToast = showToast;

            // 初期読み込み
            loadUsers();
        </script>
    </body>
    </html>
  `)
})

export default routes
