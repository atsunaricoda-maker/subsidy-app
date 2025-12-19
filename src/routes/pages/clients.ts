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
    <body class="bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
        <div class="min-h-screen flex">
            ${generateSidebar('clients')}
            
            <main class="flex-1 min-h-screen">
                <!-- ヘッダー：グラデーション背景 -->
                <header class="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white shadow-lg sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-4">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-white/80 hover:text-white">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <div>
                                <h2 class="text-xl font-bold flex items-center gap-2">
                                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                        <i class="fas fa-address-book"></i>
                                    </div>
                                    顧客管理
                                </h2>
                                <p class="text-blue-100 text-sm mt-0.5">Customer Management</p>
                            </div>
                        </div>
                        <button onclick="openNewCustomerModal()" class="bg-white text-blue-700 px-5 py-2.5 rounded-xl hover:bg-blue-50 font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2">
                            <i class="fas fa-user-plus"></i>
                            <span>新規顧客追加</span>
                        </button>
                    </div>
                </header>

                <div class="p-4 lg:p-6">
                    <!-- 統計カード -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div class="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-500 text-sm">総顧客数</p>
                                    <p id="statTotalClients" class="text-2xl font-bold text-gray-800">-</p>
                                </div>
                                <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-users text-blue-600 text-xl"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500 hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-500 text-sm">今月の新規</p>
                                    <p id="statNewClients" class="text-2xl font-bold text-gray-800">-</p>
                                </div>
                                <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-user-plus text-green-600 text-xl"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500 hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-500 text-sm">進行中案件</p>
                                    <p id="statActiveCases" class="text-2xl font-bold text-gray-800">-</p>
                                </div>
                                <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-briefcase text-purple-600 text-xl"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500 hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-500 text-sm">対応待ち</p>
                                    <p id="statPendingActions" class="text-2xl font-bold text-gray-800">-</p>
                                </div>
                                <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-clock text-orange-600 text-xl"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 検索・フィルター -->
                    <div class="bg-white rounded-xl shadow-sm p-4 mb-6">
                        <div class="flex flex-col sm:flex-row gap-3">
                            <div class="flex-1 relative">
                                <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input type="text" id="searchQuery" placeholder="顧客名・会社名で検索..." 
                                       class="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" onkeyup="filterCustomers()">
                            </div>
                            <div class="flex gap-2">
                                <button onclick="setViewMode('table')" id="viewModeTable" class="px-4 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
                                    <i class="fas fa-list"></i>
                                </button>
                                <button onclick="setViewMode('card')" id="viewModeCard" class="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                                    <i class="fas fa-th-large"></i>
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
                                    <th class="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">会社名</th>
                                    <th class="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">連絡先</th>
                                    <th class="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">案件数</th>
                                    <th class="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">登録日</th>
                                    <th class="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
                                </tr>
                            </thead>
                            <tbody id="customerList" class="divide-y divide-gray-100">
                                <tr>
                                    <td colspan="6" class="px-4 py-12 text-center text-gray-500">
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
                  <label class="block text-sm font-medium text-gray-700 mb-1">顧客名 <span class="text-red-500">*</span></label>
                  <input type="text" name="name" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="山田太郎">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">会社名</label>
                  <input type="text" name="company_name" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="株式会社サンプル">
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
                  <label class="block text-sm font-medium text-gray-700 mb-1">顧客名 <span class="text-red-500">*</span></label>
                  <input type="text" name="name" id="editClientName" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">会社名</label>
                  <input type="text" name="company_name" id="editClientCompany" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
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
            
            let viewMode = 'table';
            
            // 表示モード切り替え
            function setViewMode(mode) {
                viewMode = mode;
                document.getElementById('viewModeTable').className = mode === 'table' 
                    ? 'px-4 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors'
                    : 'px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors';
                document.getElementById('viewModeCard').className = mode === 'card'
                    ? 'px-4 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors'
                    : 'px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors';
                document.getElementById('tableView').classList.toggle('hidden', mode !== 'table');
                document.getElementById('cardView').classList.toggle('hidden', mode !== 'card');
                renderClients(allClients);
            }
            
            // データ読み込み
            async function loadClients() {
                try {
                    const response = await axios.get('/api/clients?include_cases=true');
                    allClients = response.data;
                    renderClients(allClients);
                    updateStats(allClients);
                } catch (error) {
                    console.error('Error loading clients:', error);
                    document.getElementById('customerList').innerHTML = 
                        '<tr><td colspan="6" class="px-4 py-12 text-center text-red-500"><i class="fas fa-exclamation-circle text-3xl mb-3"></i><p>データの読み込みに失敗しました</p></td></tr>';
                }
            }
            
            // 統計を更新
            function updateStats(clients) {
                document.getElementById('statTotalClients').textContent = clients.length;
                
                const now = new Date();
                const thisMonth = clients.filter(c => {
                    const created = new Date(c.created_at);
                    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                }).length;
                document.getElementById('statNewClients').textContent = thisMonth;
                
                let activeCases = 0;
                let pendingActions = 0;
                clients.forEach(c => {
                    if (c.cases) {
                        activeCases += c.cases.filter(cs => cs.status !== 'completed' && cs.status !== 'rejected').length;
                        pendingActions += c.cases.filter(cs => cs.status === 'preparing').length;
                    }
                });
                document.getElementById('statActiveCases').textContent = activeCases;
                document.getElementById('statPendingActions').textContent = pendingActions;
            }
            
            // 顧客一覧の表示
            function renderClients(clients) {
                if (viewMode === 'card') {
                    renderClientsAsCards(clients);
                    return;
                }
                
                const container = document.getElementById('customerList');
                if (!clients || clients.length === 0) {
                    container.innerHTML = '<tr><td colspan="6" class="px-4 py-12 text-center text-gray-500"><i class="fas fa-users text-4xl text-gray-300 mb-3"></i><p>顧客が登録されていません</p></td></tr>';
                    return;
                }
                
                // アバターカラーを生成
                const avatarColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500'];
                
                container.innerHTML = clients.map((client, index) => {
                    const caseCount = client.cases?.length || 0;
                    const activeCases = client.cases?.filter(c => c.status !== 'completed' && c.status !== 'rejected').length || 0;
                    const avatarColor = avatarColors[index % avatarColors.length];
                    const initial = (client.company_name || client.name || '?')[0].toUpperCase();
                    
                    return \`
                        <tr class="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent customer-row cursor-pointer transition-all group" 
                            data-name="\${client.name}" 
                            data-company="\${client.company_name || ''}"
                            onclick="openClientQuickView(\${client.id})">
                            <td class="px-4 py-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 \${avatarColor} rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                                        \${initial}
                                    </div>
                                    <div>
                                        <div class="font-semibold text-gray-900">\${client.name}</div>
                                        <div class="text-xs text-gray-500">\${client.company_name || ''}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-4 text-gray-600">\${client.company_name || '-'}</td>
                            <td class="px-4 py-4 text-sm text-gray-500 hidden md:table-cell">
                                \${client.email ? '<div class="flex items-center gap-1"><i class="fas fa-envelope text-gray-400"></i>' + client.email + '</div>' : ''}
                                \${client.phone ? '<div class="flex items-center gap-1 mt-1"><i class="fas fa-phone text-gray-400"></i>' + client.phone + '</div>' : ''}
                            </td>
                            <td class="px-4 py-4">
                                <div class="flex flex-col gap-1">
                                    <span class="\${caseCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'} px-3 py-1 rounded-full text-xs font-medium inline-flex items-center w-fit">
                                        <i class="fas fa-folder mr-1"></i>\${caseCount}件
                                    </span>
                                    \${activeCases > 0 ? '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs inline-flex items-center w-fit"><i class="fas fa-play-circle mr-1"></i>進行中 ' + activeCases + '</span>' : ''}
                                </div>
                            </td>
                            <td class="px-4 py-4 text-sm text-gray-500 hidden sm:table-cell">
                                <div class="flex items-center gap-1">
                                    <i class="fas fa-calendar text-gray-400"></i>
                                    \${client.created_at?.split(' ')[0]?.replace(/-/g, '/') || '-'}
                                </div>
                            </td>
                            <td class="px-4 py-4">
                                <button class="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                                    <i class="fas fa-arrow-right"></i>
                                </button>
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
                    
                    document.getElementById('clientQuickViewTitle').textContent = data.name + (data.company_name ? ' (' + data.company_name + ')' : '');
                    
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
                                <div class="quick-view-label">顧客名</div>
                                <div class="quick-view-value">\${data.name || '-'}</div>
                            </div>
                            <div class="quick-view-item">
                                <div class="quick-view-label">会社名</div>
                                <div class="quick-view-value">\${data.company_name || '-'}</div>
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
                
                const statusLabels = {
                    inquiry: '見込み',
                    preparing: '書類準備中',
                    applying: '申請中',
                    adopted: '採択・入金待',
                    rejected: '不採択',
                    completed: '完了'
                };
                
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
                window.location.href = '/?openNewCase=true&client_id=' + clientId;
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
                    alert('顧客名を入力してください');
                    return;
                }
                
                try {
                    await axios.post('/api/clients', data);
                    modalManager.close('newClientModal');
                    showToast('顧客を登録しました');
                    await loadClients();
                } catch (error) {
                    console.error('Error saving client:', error);
                    alert('顧客の登録に失敗しました');
                }
            }
            
            // 顧客編集モーダルを開く
            async function openEditClientModal(clientId) {
                try {
                    const response = await axios.get('/api/clients/' + clientId);
                    const client = response.data;
                    
                    document.getElementById('editClientId').value = client.id;
                    document.getElementById('editClientName').value = client.name || '';
                    document.getElementById('editClientCompany').value = client.company_name || '';
                    document.getElementById('editClientEmail').value = client.email || '';
                    document.getElementById('editClientPhone').value = client.phone || '';
                    document.getElementById('editClientAddress').value = client.address || '';
                    document.getElementById('editClientNotes').value = client.notes || '';
                    
                    modalManager.close('clientQuickViewModal');
                    modalManager.open('editClientModal');
                } catch (error) {
                    console.error('Error loading client:', error);
                    alert('顧客情報の取得に失敗しました');
                }
            }
            
            // 顧客情報を保存
            async function saveEditClient() {
                const form = document.getElementById('editClientForm');
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                const clientId = data.id;
                
                if (!data.name) {
                    alert('顧客名を入力してください');
                    return;
                }
                
                try {
                    await axios.put('/api/clients/' + clientId, data);
                    modalManager.close('editClientModal');
                    showToast('顧客情報を更新しました');
                    await loadClients();
                } catch (error) {
                    console.error('Error saving client:', error);
                    alert('顧客情報の更新に失敗しました');
                }
            }
            
            // トースト通知
            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                toast.className = 'fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ' + 
                    (type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white');
                toast.innerHTML = '<i class="fas ' + (type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle') + ' mr-2"></i>' + message;
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transition = 'opacity 0.3s';
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }
            
            // 初期化
            loadClients();
        </script>
    </body>
    </html>
  `)
})

export default routes
