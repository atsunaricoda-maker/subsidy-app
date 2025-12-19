// 顧客管理ページ
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/clients', async (c) => {
  // データはクライアントサイドでAPIから取得（organization_idでフィルタされる）
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>顧客管理 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('clients')}
            
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-address-book mr-2"></i>顧客一覧
                            </h2>
                        </div>
                        <button onclick="openNewCustomerModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                            <i class="fas fa-user-plus mr-2"></i>新規顧客追加
                        </button>
                    </div>
                </header>

                <div class="p-4 lg:p-6">
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
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">連絡先</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">案件数</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">登録日</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                                </tr>
                            </thead>
                            <tbody id="customerList" class="divide-y divide-gray-200">
                                <tr>
                                    <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                                        <i class="fas fa-spinner fa-spin mr-2"></i>読み込み中...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>

        <script>
            ${sidebarScripts}
            
            // 認証チェック
            const token = localStorage.getItem('admin_token');
            if (!token) {
                window.location.href = '/login';
            }
            
            // Axios設定
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('admin_username') + ':' + localStorage.getItem('admin_role');
            
            let allClients = [];
            
            // データ読み込み
            async function loadClients() {
                try {
                    const response = await axios.get('/api/clients?include_cases=true');
                    allClients = response.data;
                    renderClients(allClients);
                } catch (error) {
                    console.error('Error loading clients:', error);
                    document.getElementById('customerList').innerHTML = 
                        '<tr><td colspan="6" class="px-4 py-8 text-center text-red-500">データの読み込みに失敗しました</td></tr>';
                }
            }
            
            // 顧客一覧の表示
            function renderClients(clients) {
                const container = document.getElementById('customerList');
                if (!clients || clients.length === 0) {
                    container.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">顧客が登録されていません</td></tr>';
                    return;
                }
                
                container.innerHTML = clients.map(client => {
                    const caseCount = client.cases?.length || 0;
                    return \`
                        <tr class="hover:bg-blue-50 customer-row cursor-pointer transition-colors" 
                            data-name="\${client.name}" 
                            data-company="\${client.company_name || ''}"
                            onclick="window.location.href='/client/\${client.id}'">
                            <td class="px-4 py-3">
                                <div class="font-medium text-gray-900">\${client.name}</div>
                            </td>
                            <td class="px-4 py-3 text-gray-600">\${client.company_name || '-'}</td>
                            <td class="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                                \${client.email ? '<div><i class="fas fa-envelope mr-1"></i>' + client.email + '</div>' : ''}
                                \${client.phone ? '<div><i class="fas fa-phone mr-1"></i>' + client.phone + '</div>' : ''}
                            </td>
                            <td class="px-4 py-3">
                                <span class="\${caseCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'} px-2 py-1 rounded text-sm">\${caseCount}件</span>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">\${client.created_at?.split(' ')[0] || '-'}</td>
                            <td class="px-4 py-3">
                                <span class="text-blue-600 hover:text-blue-800">
                                    <i class="fas fa-eye"></i> 詳細
                                </span>
                            </td>
                        </tr>
                    \`;
                }).join('');
            }
            
            function filterCustomers() {
                const query = document.getElementById('searchQuery').value.toLowerCase();
                document.querySelectorAll('.customer-row').forEach(row => {
                    const name = row.dataset.name.toLowerCase();
                    const company = row.dataset.company.toLowerCase();
                    row.style.display = (name.includes(query) || company.includes(query)) ? '' : 'none';
                });
            }
            
            function openNewCustomerModal() {
                window.location.href = '/?action=new_customer';
            }
            
            // 初期化
            loadClients();
        </script>
    </body>
    </html>
  `)
})

export default routes
