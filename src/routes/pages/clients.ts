// 顧客管理ページ
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import { modalStyles, modalScripts } from '../../templates/modal'
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
            ${modalStyles}
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex">
            ${generateSidebar('clients')}
            
            <main class="flex-1 min-h-screen">
                <!-- パンくずリスト -->
                <div class="bg-white px-4 lg:px-6 py-1.5 border-b text-xs" id="breadcrumb">
                    <a href="/" class="text-blue-600 hover:text-blue-800 hover:underline">ダッシュボード</a>
                    <i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>
                    <span class="text-gray-800 font-medium">顧客一覧</span>
                </div>
                
                <!-- ヘッダー（ダッシュボード・案件と統一） -->
                <header class="bg-white border-b sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 lg:px-6 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <div>
                                <h2 class="text-lg font-bold text-gray-800">顧客一覧</h2>
                                <p class="text-xs text-gray-500" id="clientCountLabel">-</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <select id="sortSelect" onchange="sortClients()" class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                                <option value="updated_desc">更新日 ↓</option>
                                <option value="name_asc">名前 A→Z</option>
                                <option value="created_desc">登録日 ↓</option>
                                <option value="cases_desc">案件数 ↓</option>
                            </select>
                            <a href="/api/export/clients/csv" class="text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg border hover:bg-gray-50 text-sm" title="CSV出力">
                                <i class="fas fa-file-csv"></i>
                            </a>
                            <button onclick="openNewCustomerModal()" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 text-sm font-medium">
                                <i class="fas fa-plus mr-1"></i>新規顧客
                            </button>
                        </div>
                    </div>
                </header>

                <div class="p-4 lg:p-6 max-w-7xl mx-auto">
                    <!-- 検索・フィルター --> 
                    <div class="mb-4 flex flex-col sm:flex-row gap-2">
                        <div class="flex-1 relative">
                            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                            <input type="text" id="searchQuery" placeholder="顧客名・企業名で検索..." 
                                   class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" onkeyup="filterCustomers()">
                        </div>
                        <div class="flex items-center gap-2">
                            <select id="caseFilter" onchange="filterCustomers()" class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                                <option value="">全顧客</option>
                                <option value="active">進行中案件あり</option>
                                <option value="noCases">案件なし</option>
                            </select>
                            <div class="flex bg-gray-100 rounded-lg p-0.5">
                                <button onclick="setViewMode('table')" id="viewModeTable" class="px-3 py-1.5 rounded-md text-xs font-medium bg-white shadow-sm text-gray-700">
                                    <i class="fas fa-list mr-1"></i>リスト
                                </button>
                                <button onclick="setViewMode('card')" id="viewModeCard" class="px-3 py-1.5 rounded-md text-xs font-medium text-gray-500">
                                    <i class="fas fa-th-large mr-1"></i>カード
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 顧客一覧（テーブル表示） -->
                    <div id="tableView" class="bg-white rounded-xl shadow-sm overflow-hidden">
                        <table class="w-full">
                            <thead class="bg-gradient-to-r from-gray-50 to-gray-100">
                                <tr>
                                    <th class="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">顧客名</th>
                                    <th class="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">連絡先</th>
                                    <th class="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">案件状況</th>
                                    <th class="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">登録日</th>
                                    <th class="px-4 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">アクション</th>
                                </tr>
                            </thead>
                            <tbody id="customerList" class="divide-y divide-gray-100">
                                <tr>
                                    <td colspan="5" class="px-4 py-12 text-center text-gray-500">
                                        <div class="flex flex-col items-center">
                                            <i class="fas fa-spinner fa-spin text-3xl text-blue-500 mb-3"></i>
                                            <p>読み込み中...</p>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- 顧客一覧（カード表示） -->
                    <div id="cardView" class="hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <!-- カードが動的に生成される -->
                    </div>
                </div>
            </main>
        </div>

        <!-- 顧客クイックビューモーダル -->
        <div id="clientQuickViewModal" class="modal-overlay">
          <div class="modal-container modal-lg">
            <div class="modal-header">
              <h3 class="modal-title">
                <i class="fas fa-user"></i>
                <span id="clientQuickViewTitle">顧客詳細</span>
              </h3>
              <button class="modal-close" onclick="modalManager.close('clientQuickViewModal')">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="modal-tabs">
              <div class="modal-tab active" data-tab="info" onclick="switchClientTab('info')">
                <i class="fas fa-info-circle mr-1"></i>基本情報
              </div>
              <div class="modal-tab" data-tab="cases" onclick="switchClientTab('cases')">
                <i class="fas fa-folder-open mr-1"></i>案件
              </div>
              <div class="modal-tab" data-tab="documents" onclick="switchClientTab('documents')">
                <i class="fas fa-file-alt mr-1"></i>書類
              </div>
            </div>
            <div class="modal-body" id="clientQuickViewContent">
              <div class="modal-loading">
                <div class="modal-spinner"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button onclick="modalManager.close('clientQuickViewModal')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">
                閉じる
              </button>
              <button onclick="openEditClientModal(currentClientId)" class="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50">
                <i class="fas fa-edit mr-1"></i>編集
              </button>
              <a id="clientDetailLink" href="#" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <i class="fas fa-external-link-alt mr-1"></i>詳細ページへ
              </a>
            </div>
          </div>
        </div>
        
        <!-- 新規顧客登録モーダル -->
        <div id="newClientModal" class="modal-overlay">
          <div class="modal-container modal-md">
            <div class="modal-header">
              <h3 class="modal-title">
                <i class="fas fa-user-plus"></i>新規顧客登録
              </h3>
              <button class="modal-close" onclick="modalManager.close('newClientModal')">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="modal-body">
              <form id="newClientForm" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">顧客名 / 企業名 <span class="text-red-500">*</span></label>
                  <input type="text" name="name" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="例: 山田太郎 / 株式会社サンプル">
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                    <input type="email" name="email" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="example@mail.com">
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                    <input type="tel" name="phone" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="03-1234-5678">
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">住所</label>
                  <input type="text" name="address" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="東京都渋谷区...">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">備考</label>
                  <textarea name="notes" rows="3" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="メモ・備考"></textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button onclick="modalManager.close('newClientModal')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">
                キャンセル
              </button>
              <button onclick="saveNewClient()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <i class="fas fa-save mr-1"></i>登録
              </button>
            </div>
          </div>
        </div>
        
        <!-- 顧客編集モーダル -->
        <div id="editClientModal" class="modal-overlay">
          <div class="modal-container modal-md">
            <div class="modal-header">
              <h3 class="modal-title">
                <i class="fas fa-user-edit"></i>顧客情報編集
              </h3>
              <button class="modal-close" onclick="modalManager.close('editClientModal')">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="modal-body">
              <form id="editClientForm" class="space-y-4">
                <input type="hidden" name="id" id="editClientId">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">顧客名 / 企業名 <span class="text-red-500">*</span></label>
                  <input type="text" name="name" id="editClientName" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                    <input type="email" name="email" id="editClientEmail" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                    <input type="tel" name="phone" id="editClientPhone" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">住所</label>
                  <input type="text" name="address" id="editClientAddress" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">備考</label>
                  <textarea name="notes" id="editClientNotes" rows="3" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button onclick="modalManager.close('editClientModal')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">
                キャンセル
              </button>
              <button onclick="saveEditClient()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <i class="fas fa-save mr-1"></i>保存
              </button>
            </div>
          </div>
        </div>

        <script>
            ${sidebarScripts}
            ${modalScripts}
            
            // 認証チェック
            const token = localStorage.getItem('admin_token');
            if (!token) {
                window.location.href = '/login';
            }
            
            // Axios設定
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
            
            let allClients = [];
            let currentClientId = null;
            let currentClientTab = 'info';
            
            // ステータスラベル・色は sidebarScripts 共通版（window.statusLabels / window.statusColors）を使用
            
            let viewMode = 'table';
            
            // 表示モード切り替え
            function setViewMode(mode) {
                viewMode = mode;
                document.getElementById('viewModeTable').className = mode === 'table' 
                    ? 'px-3 py-1.5 rounded-md text-xs font-medium bg-white shadow-sm text-gray-700'
                    : 'px-3 py-1.5 rounded-md text-xs font-medium text-gray-500';
                document.getElementById('viewModeCard').className = mode === 'card'
                    ? 'px-3 py-1.5 rounded-md text-xs font-medium bg-white shadow-sm text-gray-700'
                    : 'px-3 py-1.5 rounded-md text-xs font-medium text-gray-500';
                document.getElementById('tableView').classList.toggle('hidden', mode !== 'table');
                document.getElementById('cardView').classList.toggle('hidden', mode !== 'card');
                localStorage.setItem('clients_view', mode);
                renderClients(allClients);
            }
            
            // ソート機能
            function sortClients() {
                const sortVal = document.getElementById('sortSelect')?.value || 'updated_desc';
                allClients.sort(function(a, b) {
                    switch(sortVal) {
                        case 'name_asc': return (a.name || '').localeCompare(b.name || '', 'ja');
                        case 'created_desc': return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                        case 'cases_desc': return (b.cases?.length || 0) - (a.cases?.length || 0);
                        default: return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
                    }
                });
                renderClients(allClients);
            }
            
            // データ読み込み
            async function loadClients() {
                try {
                    const response = await axios.get('/api/clients?include_cases=true');
                    var data = response.data;
                    // APIがエラーオブジェクトを返した場合のガード
                    if (!Array.isArray(data)) {
                        console.error('API returned non-array:', data);
                        allClients = [];
                    } else {
                        allClients = data;
                    }
                    renderClients(allClients);
                    updateStats(allClients);
                } catch (error) {
                    console.error('Error loading clients:', error);
                    var errMsg = 'データの読み込みに失敗しました';
                    if (error.response) {
                        errMsg += '（' + error.response.status + '）';
                    }
                    document.getElementById('customerList').innerHTML = 
                        '<tr><td colspan="5" class="px-4 py-12 text-center text-red-500"><i class="fas fa-exclamation-circle text-3xl mb-3"></i><p>' + errMsg + '</p><button onclick="loadClients()" class="mt-3 text-blue-600 hover:text-blue-800 text-sm"><i class="fas fa-redo mr-1"></i>再読み込み</button></td></tr>';
                }
            }
            
            // 統計を更新
            function updateStats(clients) {
                if (!Array.isArray(clients)) clients = [];
                const activeCases = clients.reduce((sum, c) => sum + (c.cases?.filter(cs => !['completed', 'rejected', 'archived'].includes(cs.status)).length || 0), 0);
                document.getElementById('clientCountLabel').textContent = clients.length + '件の顧客 / 進行中 ' + activeCases + '件';
            }
            
            // 顧客一覧の表示
            function renderClients(clients) {
                if (!Array.isArray(clients)) clients = [];
                if (viewMode === 'card') {
                    renderClientsAsCards(clients);
                    return;
                }
                
                const container = document.getElementById('customerList');
                if (clients.length === 0) {
                    container.innerHTML = '<tr><td colspan="5" class="text-center py-16"><div class="max-w-sm mx-auto"><div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4"><i class="fas fa-user-plus text-blue-400 text-2xl"></i></div><p class="text-gray-500 mb-1">顧客が登録されていません</p><p class="text-gray-400 text-sm mb-4">最初の顧客を登録して管理を始めましょう</p><button onclick="openNewCustomerModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"><i class="fas fa-plus mr-1"></i>最初の顧客を登録</button></div></td></tr>';
                    return;
                }
                
                // アバターカラーを生成
                const avatarColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500'];
                
                container.innerHTML = clients.map((client, index) => {
                    const caseCount = client.cases?.length || 0;
                    const activeCases = client.cases?.filter(c => c.status !== 'completed' && c.status !== 'rejected' && c.status !== 'archived').length || 0;
                    const latestCase = client.cases?.[0];
                    const avatarColor = avatarColors[index % avatarColors.length];
                    const initial = (client.name || '?')[0].toUpperCase();
                    
                    return \`
                        <tr class="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent customer-row cursor-pointer transition-all group" 
                            data-name="\${client.name}" 
                            data-cases="\${caseCount}"
                            data-active="\${activeCases}"
                            onclick="openClientQuickView(\${client.id})">
                            <td class="px-4 py-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 \${avatarColor} rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                                        \${initial}
                                    </div>
                                    <div>
                                        <div class="font-semibold text-gray-900">\${client.name}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-4 text-sm text-gray-500 hidden md:table-cell">
                                \${client.email ? '<div class="flex items-center gap-1"><i class="fas fa-envelope text-gray-400"></i>' + client.email + '</div>' : ''}
                                \${client.phone ? '<div class="flex items-center gap-1 mt-1"><i class="fas fa-phone text-gray-400"></i>' + client.phone + '</div>' : ''}
                                \${!client.email && !client.phone ? '<span class="text-gray-400">-</span>' : ''}
                            </td>
                            <td class="px-4 py-4">
                                \${caseCount === 0 ? '<span class="text-gray-400 text-xs">案件なし</span>' : \`
                                <div class="flex flex-col gap-1">
                                    <div class="flex items-center gap-2">
                                        <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium"><i class="fas fa-folder mr-1"></i>\${caseCount}件</span>
                                        \${activeCases > 0 ? '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs"><i class="fas fa-play-circle mr-1"></i>進行中 ' + activeCases + '</span>' : ''}
                                    </div>
                                    \${latestCase ? '<span class="text-xs px-2 py-0.5 rounded ' + (statusColors[latestCase.status] || 'bg-gray-100') + '">' + (statusLabels[latestCase.status] || latestCase.status) + '</span>' : ''}
                                </div>
                                \`}
                            </td>
                            <td class="px-4 py-4 text-sm text-gray-500 hidden sm:table-cell">
                                \${client.created_at?.split(' ')[0]?.replace(/-/g, '/') || '-'}
                            </td>
                            <td class="px-4 py-4 text-right">
                                <div class="flex items-center justify-end gap-1">
                                    <button onclick="event.stopPropagation(); openEditClientModal(\${client.id})" class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編集">
                                        <i class="fas fa-pen text-xs"></i>
                                    </button>
                                    <a href="/client/\${client.id}" onclick="event.stopPropagation()" class="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors text-xs font-medium">
                                        詳細 <i class="fas fa-arrow-right"></i>
                                    </a>
                                </div>
                            </td>
                        </tr>
                    \`;
                }).join('');
            }
            
            function filterCustomers() {
                const query = document.getElementById('searchQuery').value.toLowerCase();
                const caseFilter = document.getElementById('caseFilter')?.value || '';
                
                function matchesFilter(el) {
                    const name = (el.dataset.name || '').toLowerCase();
                    const cases = parseInt(el.dataset.cases || '0');
                    const active = parseInt(el.dataset.active || '0');
                    
                    // テキスト検索
                    if (query && !name.includes(query)) return false;
                    // 案件フィルター
                    if (caseFilter === 'active' && active === 0) return false;
                    if (caseFilter === 'noCases' && cases > 0) return false;
                    
                    return true;
                }
                
                document.querySelectorAll('.customer-row').forEach(row => {
                    row.style.display = matchesFilter(row) ? '' : 'none';
                });
                document.querySelectorAll('.customer-card').forEach(card => {
                    card.style.display = matchesFilter(card) ? '' : 'none';
                });
            }
            
            // カード表示で顧客一覧を描画
            function renderClientsAsCards(clients) {
                if (!Array.isArray(clients)) clients = [];
                const container = document.getElementById('cardView');
                if (clients.length === 0) {
                    container.innerHTML = '<div class="col-span-full text-center py-16"><div class="max-w-sm mx-auto"><div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4"><i class="fas fa-user-plus text-blue-400 text-2xl"></i></div><p class="text-gray-500 mb-1">顧客が登録されていません</p><p class="text-gray-400 text-sm mb-4">最初の顧客を登録して管理を始めましょう</p><button onclick="openNewCustomerModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"><i class="fas fa-plus mr-1"></i>最初の顧客を登録</button></div></div>';
                    return;
                }
                
                const avatarColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500'];
                
                container.innerHTML = clients.map((client, index) => {
                    const caseCount = client.cases?.length || 0;
                    const activeCases = client.cases?.filter(c => c.status !== 'completed' && c.status !== 'rejected' && c.status !== 'archived').length || 0;
                    const avatarColor = avatarColors[index % avatarColors.length];
                    const initial = (client.name || '?')[0].toUpperCase();
                    
                    return \`
                        <div class="customer-card bg-white rounded-xl shadow-sm hover:shadow-lg transition-all cursor-pointer border border-gray-100 hover:border-blue-200 overflow-hidden"
                             data-name="\${client.name}" 
                             data-cases="\${caseCount}"
                             data-active="\${activeCases}"
                             onclick="openClientQuickView(\${client.id})">
                            <div class="p-5">
                                <div class="flex items-start gap-4">
                                    <div class="w-14 h-14 \${avatarColor} rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md flex-shrink-0">
                                        \${initial}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <h3 class="font-bold text-gray-900 truncate">\${client.name}</h3>
                                        <div class="flex flex-wrap gap-2 mt-2">
                                            \${caseCount === 0 ? '<span class="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">案件なし</span>' : \`
                                                <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium"><i class="fas fa-folder mr-1"></i>\${caseCount}件</span>
                                                \${activeCases > 0 ? '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs"><i class="fas fa-play-circle mr-1"></i>進行中 ' + activeCases + '</span>' : ''}
                                            \`}
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                                    <div class="text-gray-500 truncate">
                                        \${client.email ? '<i class="fas fa-envelope mr-1"></i>' + client.email : ''}
                                    </div>
                                    <div class="text-gray-400 text-xs">
                                        \${client.created_at?.split(' ')[0]?.replace(/-/g, '/') || '-'}
                                    </div>
                                </div>
                            </div>
                            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 flex items-center justify-between">
                                <button onclick="event.stopPropagation(); openEditClientModal(\${client.id})" class="text-gray-500 hover:text-blue-600 text-sm">
                                    <i class="fas fa-pen mr-1"></i>編集
                                </button>
                                <a href="/client/\${client.id}" onclick="event.stopPropagation()" class="text-blue-600 text-sm font-medium flex items-center gap-1">
                                    詳細を見る <i class="fas fa-arrow-right"></i>
                                </a>
                            </div>
                        </div>
                    \`;
                }).join('');
            }
            
            // 顧客クイックビューを開く
            async function openClientQuickView(clientId) {
                currentClientId = clientId;
                currentClientTab = 'info';
                
                document.getElementById('clientDetailLink').href = '/client/' + clientId;
                document.getElementById('clientQuickViewTitle').textContent = '顧客詳細';
                document.getElementById('clientQuickViewContent').innerHTML = '<div class="modal-loading"><div class="modal-spinner"></div></div>';
                
                // タブをリセット
                document.querySelectorAll('#clientQuickViewModal .modal-tab').forEach(tab => {
                    tab.classList.toggle('active', tab.dataset.tab === 'info');
                });
                
                modalManager.open('clientQuickViewModal');
                await loadClientQuickViewContent(clientId, 'info');
            }
            
            // タブ切り替え
            async function switchClientTab(tabId) {
                currentClientTab = tabId;
                
                document.querySelectorAll('#clientQuickViewModal .modal-tab').forEach(tab => {
                    tab.classList.toggle('active', tab.dataset.tab === tabId);
                });
                
                document.getElementById('clientQuickViewContent').innerHTML = '<div class="modal-loading"><div class="modal-spinner"></div></div>';
                await loadClientQuickViewContent(currentClientId, tabId);
            }
            
            // コンテンツを読み込み
            async function loadClientQuickViewContent(clientId, tab) {
                try {
                    const response = await axios.get('/api/clients/' + clientId + '/quick-view?tab=' + tab);
                    const data = response.data;
                    
                    document.getElementById('clientQuickViewTitle').textContent = data.name;
                    
                    if (tab === 'info') {
                        renderClientInfoTab(data);
                    } else if (tab === 'cases') {
                        renderClientCasesTab(data);
                    } else if (tab === 'documents') {
                        renderClientDocumentsTab(data);
                    }
                } catch (error) {
                    console.error('Quick view error:', error);
                    document.getElementById('clientQuickViewContent').innerHTML = '<div class="text-center py-8 text-red-500"><i class="fas fa-exclamation-circle mr-2"></i>データの読み込みに失敗しました</div>';
                }
            }
            
            // 基本情報タブ
            function renderClientInfoTab(data) {
                document.getElementById('clientQuickViewContent').innerHTML = \`
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="quick-view-item">
                                <div class="quick-view-label">顧客名 / 企業名</div>
                                <div class="quick-view-value">\${data.name || '-'}</div>
                            </div>
                            <div class="quick-view-item">
                                <div class="quick-view-label">メールアドレス</div>
                                <div class="quick-view-value">\${data.email ? '<a href="mailto:' + data.email + '" class="text-blue-600 hover:underline">' + data.email + '</a>' : '-'}</div>
                            </div>
                            <div class="quick-view-item">
                                <div class="quick-view-label">電話番号</div>
                                <div class="quick-view-value">\${data.phone ? '<a href="tel:' + data.phone + '" class="text-blue-600 hover:underline">' + data.phone + '</a>' : '-'}</div>
                            </div>
                            <div class="quick-view-item col-span-2">
                                <div class="quick-view-label">住所</div>
                                <div class="quick-view-value">\${data.address || '-'}</div>
                            </div>
                            <div class="quick-view-item">
                                <div class="quick-view-label">登録日</div>
                                <div class="quick-view-value">\${data.created_at ? new Date(data.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}</div>
                            </div>
                            <div class="quick-view-item">
                                <div class="quick-view-label">案件数</div>
                                <div class="quick-view-value">\${data.case_count || 0}件</div>
                            </div>
                        </div>
                        \${data.notes ? \`
                        <div class="border-t pt-4">
                            <div class="quick-view-label mb-2">備考</div>
                            <div class="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">\${data.notes}</div>
                        </div>
                        \` : ''}
                    </div>
                \`;
            }
            
            // 案件タブ
            function renderClientCasesTab(data) {
                const cases = data.cases || [];
                
                if (cases.length === 0) {
                    document.getElementById('clientQuickViewContent').innerHTML = \`
                        <div class="text-center py-12 text-gray-500">
                            <i class="fas fa-folder-open text-4xl mb-4"></i>
                            <p>案件はありません</p>
                            <button onclick="createCaseForClient(\${currentClientId})" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                                <i class="fas fa-plus mr-1"></i>新規案件作成
                            </button>
                        </div>
                    \`;
                    return;
                }
                
                document.getElementById('clientQuickViewContent').innerHTML = \`
                    <div class="space-y-3">
                        \${cases.map(c => \`
                            <div onclick="openCaseQuickViewFromClient(\${c.id})" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors">
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-folder text-gray-400"></i>
                                    <div>
                                        <div class="font-medium text-sm">\${c.case_number || '#' + c.id}</div>
                                        <div class="text-xs text-gray-500">\${c.subsidy_type_name || '申請種別未設定'}</div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 rounded text-xs bg-gray-200">\${statusLabels[c.status] || c.status}</span>
                                    \${c.approved_amount ? '<span class="text-blue-600 text-xs">¥' + Number(c.approved_amount).toLocaleString() + '</span>' : ''}
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                \`;
            }
            
            // 書類タブ
            function renderClientDocumentsTab(data) {
                const docs = data.documents || [];
                
                if (docs.length === 0) {
                    document.getElementById('clientQuickViewContent').innerHTML = \`
                        <div class="text-center py-12 text-gray-500">
                            <i class="fas fa-file-alt text-4xl mb-4"></i>
                            <p>アップロードされた書類はありません</p>
                        </div>
                    \`;
                    return;
                }
                
                document.getElementById('clientQuickViewContent').innerHTML = \`
                    <div class="space-y-3">
                        \${docs.map(doc => \`
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                                <div class="flex items-center gap-3">
                                    <i class="fas fa-file text-gray-400"></i>
                                    <div>
                                        <div class="font-medium text-sm">\${doc.document_type || doc.file_name}</div>
                                        <div class="text-xs text-gray-500">\${doc.file_name} • \${new Date(doc.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</div>
                                    </div>
                                </div>
                                <a href="/api/documents/\${doc.id}/download" class="text-blue-600 hover:text-blue-800 text-sm">
                                    <i class="fas fa-download"></i>
                                </a>
                            </div>
                        \`).join('')}
                    </div>
                \`;
            }
            
            // 案件クイックビューを顧客モーダルから開く
            function openCaseQuickViewFromClient(caseId) {
                modalManager.close('clientQuickViewModal');
                // 案件一覧ページの案件クイックビュー関数を呼び出す（存在しない場合は詳細ページへ遷移）
                if (typeof openCaseQuickView === 'function') {
                    openCaseQuickView(caseId);
                } else {
                    window.location.href = '/case/' + caseId;
                }
            }
            
            // 顧客に紐づく新規案件作成
            function createCaseForClient(clientId) {
                modalManager.close('clientQuickViewModal');
                window.location.href = '/cases?newCase=true&client_id=' + clientId;
            }
            
            // CSVエクスポート
            function exportClientsCSV() {
                window.location.href = '/api/export/clients/csv';
            }
            
            // 新規顧客モーダルを開く
            function openNewCustomerModal() {
                document.getElementById('newClientForm').reset();
                modalManager.open('newClientModal');
            }
            
            // 新規顧客を保存
            async function saveNewClient() {
                const form = document.getElementById('newClientForm');
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                
                if (!data.name) {
                    showToast('顧客名を入力してください', 'error');
                    return;
                }
                
                const btn = document.querySelector('#newClientModal .modal-footer button:last-child');
                setButtonLoading(btn, true);
                try {
                    await axios.post('/api/clients', data);
                    modalManager.close('newClientModal');
                    showToast('顧客を登録しました');
                    await loadClients();
                } catch (error) {
                    console.error('Error saving client:', error);
                    showToast('顧客の登録に失敗しました', 'error');
                } finally {
                    setButtonLoading(btn, false);
                }
            }
            
            // 顧客編集モーダルを開く
            async function openEditClientModal(clientId) {
                try {
                    const response = await axios.get('/api/clients/' + clientId);
                    const client = response.data;
                    
                    document.getElementById('editClientId').value = client.id;
                    document.getElementById('editClientName').value = client.name || '';
                    document.getElementById('editClientEmail').value = client.email || '';
                    document.getElementById('editClientPhone').value = client.phone || '';
                    document.getElementById('editClientAddress').value = client.address || '';
                    document.getElementById('editClientNotes').value = client.notes || '';
                    
                    modalManager.close('clientQuickViewModal');
                    modalManager.open('editClientModal');
                } catch (error) {
                    console.error('Error loading client:', error);
                    showToast('顧客情報の取得に失敗しました', 'error');
                }
            }
            
            // 顧客情報を保存
            async function saveEditClient() {
                const form = document.getElementById('editClientForm');
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                const clientId = data.id;
                
                if (!data.name) {
                    showToast('顧客名を入力してください', 'error');
                    return;
                }
                
                const btn = document.querySelector('#editClientModal .modal-footer button:last-child');
                setButtonLoading(btn, true);
                try {
                    await axios.put('/api/clients/' + clientId, data);
                    modalManager.close('editClientModal');
                    showToast('顧客情報を更新しました');
                    await loadClients();
                } catch (error) {
                    console.error('Error saving client:', error);
                    showToast('顧客情報の更新に失敗しました', 'error');
                } finally {
                    setButtonLoading(btn, false);
                }
            }
            
            // showToast は sidebarScripts 共通版を使用
            
            // 初期化
            const savedViewMode = localStorage.getItem('clients_view') || 'table';
            if (savedViewMode !== 'table') setViewMode(savedViewMode);
            loadClients();
        </script>
    </body>
    </html>
  `)
})

export default routes
