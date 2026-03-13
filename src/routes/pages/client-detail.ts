// 顧客詳細画面 - 統合シンプル版
// AI機能・文書生成・パイプラインは案件詳細に集約
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/client/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // organization_idでテナント分離
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  if (!orgId) {
    return c.text('Unauthorized - Organization not found', 401)
  }
  
  const client = await DB.prepare(`
    SELECT * FROM clients WHERE id = ? AND organization_id = ?
  `).bind(id, orgId).first()
  
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
        <style>
            ${sidebarStyles}
            .page-identity-client { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); }
            /* スケルトンローダー */
            @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
            .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
            .skeleton-text { height: 14px; margin-bottom: 8px; }
            .skeleton-title { height: 20px; width: 60%; margin-bottom: 12px; }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex">
            ${generateSidebar('clients')}
            
            <main class="flex-1 min-h-screen lg:ml-56">
                <!-- ページ識別バナー -->
                <div class="page-identity-client px-4 lg:px-6 py-2 flex items-center gap-3">
                    <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                        <i class="fas fa-user-circle text-white text-sm"></i>
                    </div>
                    <div>
                        <div class="text-white font-bold text-sm">顧客詳細</div>
                        <div class="text-teal-200 text-xs">${client.name}</div>
                    </div>
                    <div class="ml-auto flex items-center gap-1.5 text-xs">
                        <span class="bg-white/10 text-white px-2.5 py-1 rounded-lg">
                            <i class="fas fa-folder-open mr-1"></i>案件数: <span id="caseCountBanner">-</span>
                        </span>
                    </div>
                </div>
                <!-- パンくずリスト -->
                <div class="bg-gray-50 px-4 lg:px-6 py-1.5 border-b border-gray-200 text-xs" id="breadcrumb">
                    <a href="/" class="text-blue-600 hover:text-blue-800 hover:underline">ダッシュボード</a>
                    <i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>
                    <a href="/clients" class="text-blue-600 hover:text-blue-800 hover:underline">顧客一覧</a>
                    <i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>
                    <span class="text-gray-800 font-medium">${client.name}</span>
                </div>
                <header class="bg-white border-b sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 lg:px-6 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <div>
                                <a href="/clients" class="text-xs text-teal-600 hover:text-teal-800"><i class="fas fa-arrow-left mr-1"></i>顧客一覧に戻る</a>
                                <h2 class="text-lg font-bold text-gray-800">${client.name}</h2>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="editClient()" class="inline-flex items-center bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 text-sm">
                                <i class="fas fa-edit sm:mr-1.5"></i><span class="hidden sm:inline">編集</span>
                            </button>
                            <button onclick="openNewCaseModalForThisClient()" class="inline-flex items-center bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 text-sm">
                                <i class="fas fa-plus sm:mr-1.5"></i><span class="hidden sm:inline">新規案件</span>
                            </button>
                        </div>
                    </div>
                </header>

                <div class="p-4 lg:p-6 max-w-7xl mx-auto">
                <!-- タブナビゲーション（シンプル2タブ） -->
                <div class="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
                    <div class="flex overflow-x-auto border-b">
                        <button onclick="switchClientTab('overview')" id="client-tab-overview" 
                                class="px-6 py-3 font-medium text-teal-600 border-b-2 border-teal-600 whitespace-nowrap flex items-center gap-2 text-sm">
                            <i class="fas fa-user"></i>
                            <span>基本情報</span>
                        </button>
                        <button onclick="switchClientTab('cases')" id="client-tab-cases" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap flex items-center gap-2 text-sm border-b-2 border-transparent">
                            <i class="fas fa-folder-open"></i>
                            <span>案件一覧</span>
                            <span id="caseCountTab" class="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">-</span>
                        </button>
                    </div>
                </div>

                <!-- 基本情報タブ -->
                <div id="client-content-overview" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- 左カラム：顧客情報 -->
                    <div class="lg:col-span-1 space-y-6">
                        <!-- 顧客情報カード -->
                        <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 border-t-4 border-teal-500">
                            <h2 class="text-lg font-bold mb-4 flex items-center">
                                <div class="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center mr-3">
                                    <i class="fas fa-user-circle text-teal-600 text-lg"></i>
                                </div>
                                顧客情報
                            </h2>
                            <div class="space-y-3 text-sm" id="clientInfo">
                                <!-- スケルトンローダー -->
                                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-3">
                                    <div class="skeleton skeleton-text" style="width:60px"></div><div class="skeleton skeleton-text" style="width:120px"></div>
                                    <div class="skeleton skeleton-text" style="width:60px"></div><div class="skeleton skeleton-text" style="width:160px"></div>
                                    <div class="skeleton skeleton-text" style="width:60px"></div><div class="skeleton skeleton-text" style="width:100px"></div>
                                    <div class="skeleton skeleton-text" style="width:60px"></div><div class="skeleton skeleton-text" style="width:140px"></div>
                                </div>
                            </div>
                            <div class="flex gap-2 mt-4">
                                <button onclick="editClient()" class="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 text-white py-2.5 rounded-lg hover:from-teal-700 hover:to-teal-800 text-sm font-medium shadow-md hover:shadow-lg transition-all">
                                    <i class="fas fa-edit mr-1"></i>編集
                                </button>
                                <button onclick="deleteCurrentClient()" id="deleteClientBtn" class="hidden flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-2.5 rounded-lg hover:from-red-600 hover:to-red-700 text-sm font-medium shadow-md">
                                    <i class="fas fa-trash mr-1"></i>削除
                                </button>
                            </div>
                        </div>

                        <!-- 共通書類カード -->
                        <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 border-t-4 border-yellow-500">
                            <h2 class="text-lg font-bold mb-3 flex items-center">
                                <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                                    <i class="fas fa-folder text-yellow-600 text-lg"></i>
                                </div>
                                共通書類
                            </h2>
                            <p class="text-xs text-gray-500 mb-3">全申請で共通利用できる書類</p>
                            <div id="commonDocumentsListAdmin" class="space-y-2 max-h-64 overflow-y-auto">
                                <div class="space-y-2"><div class="skeleton" style="height:48px"></div><div class="skeleton" style="height:48px"></div></div>
                            </div>
                        </div>
                    </div>

                    <!-- 右カラム：活動サマリー + やり取り記録 -->
                    <div class="lg:col-span-2 space-y-6">
                        <!-- 活動サマリー -->
                        <div id="activitySummary" class="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-4 border-t-4 border-blue-500">
                            <h2 class="text-sm font-bold mb-3 flex items-center">
                                <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-2">
                                    <i class="fas fa-chart-line text-blue-600 text-sm"></i>
                                </div>
                                活動サマリー
                            </h2>
                            <div id="activityBadges" class="flex flex-wrap gap-2">
                                <div class="skeleton" style="width:100px;height:28px;border-radius:9999px"></div>
                                <div class="skeleton" style="width:120px;height:28px;border-radius:9999px"></div>
                                <div class="skeleton" style="width:80px;height:28px;border-radius:9999px"></div>
                            </div>
                        </div>

                        <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 flex flex-col border-t-4 border-green-500" style="max-height:500px">
                            <h2 class="text-lg font-bold mb-4 flex items-center">
                                <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                                    <i class="fas fa-comments text-green-600 text-lg"></i>
                                </div>
                                この顧客とのやり取り
                            </h2>
                            <div id="communicationsList" class="space-y-4 mb-4 flex-1 max-h-[500px] overflow-y-auto"></div>
                            
                            <form id="messageForm" class="flex gap-2 pt-4 border-t">
                                <input type="text" id="messageInput" placeholder="メッセージを入力..." 
                                       class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500" required>
                                <button type="submit" class="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700">
                                    <i class="fas fa-paper-plane mr-1"></i>送信
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- 案件一覧タブ -->
                <div id="client-content-cases" class="hidden">
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-lg font-bold flex items-center">
                                <i class="fas fa-folder-open mr-2 text-teal-600"></i>案件一覧
                            </h2>
                            <button onclick="openNewCaseModalForThisClient()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                                <i class="fas fa-plus mr-2"></i>新規案件登録
                            </button>
                        </div>
                        <div id="clientCasesList" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div class="col-span-full text-center py-12 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                <div>読み込み中...</div>
                            </div>
                        </div>
                    </div>
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
                        <label class="block text-sm font-medium mb-1">顧客名 / 企業名 *</label>
                        <input type="text" name="name" id="edit_name" required class="w-full px-3 py-2 border rounded-lg" placeholder="例: 山田太郎 / 株式会社サンプル">
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
                        <label class="block text-sm font-medium mb-1">住所</label>
                        <input type="text" name="address" id="edit_address" class="w-full px-3 py-2 border rounded-lg" placeholder="東京都...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">メモ</label>
                        <textarea name="notes" id="edit_notes" rows="3" class="w-full px-3 py-2 border rounded-lg" placeholder="顧客に関するメモ..."></textarea>
                    </div>
                    
                    <div class="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-700">
                        <i class="fas fa-info-circle mr-1"></i>
                        ステータス、契約URL、報酬設定などは各案件の詳細画面で編集できます
                    </div>
                    
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-teal-600 text-white py-3 rounded-lg hover:bg-teal-700 text-base">
                            <i class="fas fa-save mr-2"></i>更新
                        </button>
                        <button type="button" onclick="closeEditModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400 text-base">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 新規案件作成モーダル（インライン） -->
        <div id="newCaseInlineModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onclick="closeNewCaseInlineModal()">
            <div class="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
                <div class="p-5 border-b bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-xl">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-bold"><i class="fas fa-plus-circle mr-2"></i>新規案件を作成</h3>
                        <button onclick="closeNewCaseInlineModal()" class="text-white/80 hover:text-white text-xl"><i class="fas fa-times"></i></button>
                    </div>
                    <p class="text-green-200 text-sm mt-1">${client.name}</p>
                </div>
                <form id="newCaseInlineForm" class="p-5 space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">申請種別 <span class="text-red-500">*</span></label>
                        <select id="newCaseSubsidyType" required class="w-full px-3 py-2 border rounded-lg text-sm">
                            <option value="">選択してください</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">担当者</label>
                        <select id="newCaseAssignedTo" class="w-full px-3 py-2 border rounded-lg text-sm">
                            <option value="">未割り当て</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">メモ</label>
                        <textarea id="newCaseNotes" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="案件に関するメモ..."></textarea>
                    </div>
                    <div class="flex gap-2 pt-2">
                        <button type="submit" class="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 text-sm font-medium">
                            <i class="fas fa-plus mr-1"></i>作成
                        </button>
                        <button type="button" onclick="closeNewCaseInlineModal()" class="flex-1 bg-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-400 text-sm">
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
                if (!token) { window.location.href = '/login'; return false; }
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
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('admin_token');

            // トースト通知
            function showToast(message, type) {
                type = type || 'success';
                var colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' };
                var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
                var toast = document.createElement('div');
                toast.className = (colors[type] || colors.info) + ' text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm fixed top-4 right-4 z-[9999] transition-all duration-300 translate-x-full';
                toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i><span>' + message + '</span>';
                document.body.appendChild(toast);
                requestAnimationFrame(function() { toast.classList.remove('translate-x-full'); });
                setTimeout(function() {
                    toast.classList.add('translate-x-full');
                    setTimeout(function() { toast.remove(); }, 300);
                }, 3000);
            }
        
            const CLIENT_ID = ${parseInt(String(id), 10) || 0};
            const STATUS_LABELS = {
                inquiry: '見込み', preparing: '書類準備中', applying: '申請中',
                adopted: '採択・入金待ち', rejected: '不採択', completed: '完了'
            };
            const STATUS_COLORS = {
                inquiry: 'bg-yellow-100 text-yellow-800', preparing: 'bg-orange-100 text-orange-800',
                applying: 'bg-purple-100 text-purple-800', adopted: 'bg-blue-100 text-blue-800',
                rejected: 'bg-red-100 text-red-800', completed: 'bg-green-100 text-green-800'
            };
            
            let currentClient = null;
            let subsidyTypes = [];
            let allUsers = [];

            async function loadSubsidyTypes() {
                try {
                    const response = await axios.get('/api/subsidy-types');
                    subsidyTypes = response.data;
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
            }
            
            async function loadUsers() {
                try {
                    const response = await axios.get('/api/admin/users');
                    allUsers = response.data;
                } catch (error) {
                    console.error('Error loading users:', error);
                }
            }

            async function loadClient() {
                try {
                    var response = await axios.get('/api/clients/' + CLIENT_ID);
                    currentClient = response.data;
                    renderClientInfo();
                } catch (error) {
                    console.error('Error loading client:', error);
                    document.getElementById('clientInfo').innerHTML = '<div class="text-red-600">顧客情報の読み込みに失敗しました</div>';
                }
            }

            // 描画を分離して再利用可能に
            function renderClientInfo() {
                if (!currentClient) return;
                    var cases = currentClient.cases || [];
                    var latestCase = cases[0];
                    
                    // バナーとタブの案件数を更新
                    var caseCountEl = document.getElementById('caseCountBanner');
                    if (caseCountEl) caseCountEl.textContent = cases.length;
                    var caseCountTabEl = document.getElementById('caseCountTab');
                    if (caseCountTabEl) {
                        caseCountTabEl.textContent = cases.length;
                        caseCountTabEl.className = cases.length > 0 
                            ? 'bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded-full'
                            : 'bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full';
                    }
                    
                    // 活動サマリーを更新
                    renderActivitySummary(cases);
                    
                    var createdDate = currentClient.created_at ? new Date(currentClient.created_at).toLocaleDateString('ja-JP') : '-';
                    
                    document.getElementById('clientInfo').innerHTML = 
                        '<div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">' +
                            '<span class="text-gray-500"><i class="fas fa-envelope w-4 text-center mr-1"></i>メール</span>' +
                            '<span>' + (currentClient.email ? '<a href="mailto:' + currentClient.email + '" class="text-teal-600 hover:underline">' + currentClient.email + '</a>' : '-') + '</span>' +
                            '<span class="text-gray-500"><i class="fas fa-phone w-4 text-center mr-1"></i>電話</span>' +
                            '<span>' + (currentClient.phone ? '<a href="tel:' + currentClient.phone + '" class="text-teal-600 hover:underline">' + currentClient.phone + '</a>' : '-') + '</span>' +
                            '<span class="text-gray-500"><i class="fas fa-map-marker-alt w-4 text-center mr-1"></i>住所</span>' +
                            '<span>' + (currentClient.address || '-') + '</span>' +
                            '<span class="text-gray-500"><i class="fas fa-calendar-alt w-4 text-center mr-1"></i>登録日</span>' +
                            '<span>' + createdDate + '</span>' +
                        '</div>' +
                        (currentClient.notes ? '<div class="mt-3 pt-3 border-t"><div class="text-gray-500 text-xs mb-1"><i class="fas fa-sticky-note mr-1"></i>メモ</div><div class="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">' + currentClient.notes + '</div></div>' : '') +
                        '<div class="mt-4 pt-4 border-t">' +
                            '<div class="flex items-center justify-between mb-2">' +
                                '<strong class="text-sm">案件 <span class="ml-1 px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs">' + cases.length + '</span></strong>' +
                                '<button onclick="switchClientTab(&#39;cases&#39;)" class="text-xs text-teal-600 hover:text-teal-800"><i class="fas fa-arrow-right mr-1"></i>詳細</button>' +
                            '</div>' +
                            (cases.length > 0 ? cases.slice(0, 3).map(function(c) {
                                var caseSubsidy = subsidyTypes.find(function(s) { return s.id === c.subsidy_type_id; });
                                var caseNo = 'No.' + String(c.id).padStart(4, '0');
                                return '<a href="/case/' + c.id + '" class="block p-2.5 bg-gray-50 rounded-lg border mb-2 hover:bg-teal-50 hover:border-teal-300 transition-colors cursor-pointer text-xs">' +
                                    '<div class="flex justify-between items-center">' +
                                        '<span class="font-mono font-bold text-gray-600">' + caseNo + '</span>' +
                                        '<span class="px-2 py-0.5 rounded ' + (STATUS_COLORS[c.status] || 'bg-gray-100') + '">' + (STATUS_LABELS[c.status] || c.status) + '</span>' +
                                    '</div>' +
                                    '<div class="font-medium text-sm mt-1 truncate">' + (caseSubsidy ? caseSubsidy.name : '未設定') + '</div>' +
                                '</a>';
                            }).join('') + (cases.length > 3 ? '<button onclick="switchClientTab(&#39;cases&#39;)" class="text-xs text-teal-600 hover:underline w-full text-center py-1">他 ' + (cases.length - 3) + ' 件を表示</button>' : '') : '<div class="text-gray-400 text-xs text-center py-3"><i class="fas fa-folder-open mr-1"></i>案件がありません</div>') +
                        '</div>' +
                        (cases.length > 0 ? '<div class="mt-3 pt-3 border-t">' +
                            '<div class="text-gray-500 text-xs mb-2"><i class="fas fa-link mr-1"></i>ポータルURL</div>' +
                            cases.map(function(c) {
                                var pUrl = window.location.origin + '/portal/' + c.access_token;
                                var caseSubsidy = subsidyTypes.find(function(s) { return s.id === c.subsidy_type_id; });
                                var label = 'No.' + String(c.id).padStart(4, '0') + (caseSubsidy ? ' ' + caseSubsidy.name : '');
                                var safeUrl = pUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
                                var safeName = (currentClient.name || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
                                return '<div class="flex items-center gap-2 mb-1.5">' +
                                    '<span class="text-xs text-gray-600 truncate flex-shrink-0" style="max-width:140px" title="' + label + '">' + label + '</span>' +
                                    '<button data-portal-url="' + safeUrl + '" data-client-name="' + safeName + '" onclick="copyPortalUrl(this.dataset.portalUrl, this.dataset.clientName)" class="bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 text-xs whitespace-nowrap"><i class="fas fa-copy mr-1"></i>コピー</button>' +
                                    '<a href="' + pUrl + '" target="_blank" class="text-teal-600 hover:text-teal-800 text-xs"><i class="fas fa-external-link-alt"></i></a>' +
                                '</div>';
                            }).join('') +
                        '</div>' : '');
                    
                    // adminのみ削除ボタン表示
                    if (localStorage.getItem('admin_role') === 'admin') {
                        var deleteBtn = document.getElementById('deleteClientBtn');
                        if (deleteBtn) deleteBtn.classList.remove('hidden');
                    }
            }
            
            // 活動サマリー描画
            function renderActivitySummary(cases) {
                var badges = document.getElementById('activityBadges');
                if (!badges) return;
                
                var activeCases = cases.filter(function(c) { return c.status !== 'completed' && c.status !== 'rejected'; }).length;
                var completedCases = cases.filter(function(c) { return c.status === 'completed'; }).length;
                var latestStatus = cases.length > 0 ? (STATUS_LABELS[cases[0].status] || cases[0].status) : '案件なし';
                
                var html = '';
                html += '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ' + (activeCases > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600') + '">' +
                    '<i class="fas fa-briefcase"></i>進行中 ' + activeCases + '件</span>';
                if (completedCases > 0) {
                    html += '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-700">' +
                        '<i class="fas fa-check-circle"></i>完了 ' + completedCases + '件</span>';
                }
                html += '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">' +
                    '<i class="fas fa-tag"></i>最新: ' + latestStatus + '</span>';
                
                if (currentClient.created_at) {
                    var days = Math.floor((new Date() - new Date(currentClient.created_at)) / (1000*60*60*24));
                    html += '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">' +
                        '<i class="fas fa-calendar-alt"></i>登録 ' + days + '日前</span>';
                }
                
                badges.innerHTML = html;
            }
            
            // 顧客削除
            async function deleteCurrentClient() {
                if (!currentClient) return;
                var choice = await showDeleteChoiceDialog(currentClient.name);
                if (!choice) return;
                
                try {
                    if (choice === 'reset') {
                        await axios.delete('/api/clients/' + CLIENT_ID + '?keep_customer=true');
                        alert(currentClient.name + '様の案件情報をリセットしました。');
                        window.location.reload();
                    } else {
                        await axios.delete('/api/clients/' + CLIENT_ID);
                        alert(currentClient.name + '様の情報を削除しました');
                        window.location.href = '/clients';
                    }
                } catch (error) {
                    alert('削除に失敗しました: ' + (error.response?.data?.error || error.message));
                }
            }
            
            function showDeleteChoiceDialog(clientName) {
                return new Promise(function(resolve) {
                    var modal = document.createElement('div');
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
                    modal.innerHTML = '<div class="bg-white rounded-lg shadow-xl max-w-md w-full">' +
                        '<div class="p-4 border-b bg-red-600 text-white rounded-t-lg"><h3 class="font-bold"><i class="fas fa-exclamation-triangle mr-2"></i>削除オプション</h3></div>' +
                        '<div class="p-4"><p class="mb-4 text-gray-700"><strong>' + clientName + '</strong>様の情報をどのように処理しますか？</p>' +
                        '<div class="space-y-3">' +
                            '<button id="resetCaseBtn" class="w-full p-3 border-2 border-blue-500 rounded-lg text-left hover:bg-blue-50 transition"><div class="flex items-start gap-3"><div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-redo text-blue-600"></i></div><div><div class="font-bold text-blue-700">案件情報のみリセット</div><div class="text-sm text-gray-600">顧客情報は保持し、案件データを削除</div></div></div></button>' +
                            '<button id="fullDeleteBtn" class="w-full p-3 border-2 border-red-500 rounded-lg text-left hover:bg-red-50 transition"><div class="flex items-start gap-3"><div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"><i class="fas fa-trash text-red-600"></i></div><div><div class="font-bold text-red-700">完全に削除</div><div class="text-sm text-gray-600">全データを削除（取り消し不可）</div></div></div></button>' +
                        '</div></div>' +
                        '<div class="p-4 border-t bg-gray-50 rounded-b-lg"><button id="cancelDeleteBtn" class="w-full py-2 border rounded-lg hover:bg-gray-100">キャンセル</button></div></div>';
                    document.body.appendChild(modal);
                    
                    document.getElementById('resetCaseBtn').onclick = function() { modal.remove(); resolve('reset'); };
                    document.getElementById('fullDeleteBtn').onclick = function() { if (confirm('本当に完全削除しますか？')) { modal.remove(); resolve('delete'); } };
                    document.getElementById('cancelDeleteBtn').onclick = function() { modal.remove(); resolve(null); };
                    modal.onclick = function(e) { if (e.target === modal) { modal.remove(); resolve(null); } };
                });
            }
            
            // ポータルURLコピー
            function copyPortalUrl(url, clientName) {
                navigator.clipboard.writeText(url).then(function() {
                    showToast(clientName + '様のポータルURLをコピーしました！');
                }).catch(function() {
                    // clipboard API が使えない場合のフォールバック
                    var tmp = document.createElement('input'); tmp.value = url; document.body.appendChild(tmp); tmp.select(); document.execCommand('copy'); document.body.removeChild(tmp);
                    showToast(clientName + '様のポータルURLをコピーしました！');
                });
            }

            // DB時刻文字列(UTC)をJSTに変換
            function formatJSTDateTime(dateStr) {
                if (!dateStr) return '';
                var isoStr = dateStr.replace(' ', 'T') + 'Z';
                var utc = new Date(isoStr);
                return utc.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
            }
            
            async function loadCommunications() {
                try {
                    var response = await axios.get('/api/clients/' + CLIENT_ID + '/communications');
                    var comms = response.data;
                    var container = document.getElementById('communicationsList');
                    if (comms.length === 0) {
                        container.innerHTML = '<div class="text-sm text-gray-500 text-center py-4"><i class="fas fa-comments text-2xl mb-2 text-gray-300"></i><p>まだやり取りがありません</p></div>';
                        return;
                    }
                    container.innerHTML = comms.map(function(comm) {
                        var isStaff = comm.sender_type === 'staff';
                        return '<div class="flex ' + (isStaff ? 'justify-end' : 'justify-start') + '">' +
                            '<div class="max-w-xs ' + (isStaff ? 'bg-teal-100' : 'bg-gray-100') + ' rounded-lg p-3">' +
                                '<div class="font-medium text-sm mb-1">' + comm.sender_name + '</div>' +
                                '<div class="text-sm">' + comm.message + '</div>' +
                                '<div class="text-xs text-gray-500 mt-1">' + formatJSTDateTime(comm.created_at) + '</div>' +
                            '</div></div>';
                    }).join('');
                    container.scrollTop = container.scrollHeight;
                } catch (error) {
                    console.error('Error loading communications:', error);
                }
            }

            document.getElementById('messageForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                var message = document.getElementById('messageInput').value.trim();
                if (!message) return;
                var sendBtn = e.target.querySelector('button[type="submit"]');
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                try {
                    var adminName = localStorage.getItem('admin_name') || 'スタッフ';
                    await axios.post('/api/clients/' + CLIENT_ID + '/communications', {
                        message: message, sender_type: 'staff', sender_name: adminName
                    });
                    document.getElementById('messageInput').value = '';
                    loadCommunications();
                } catch(err) {
                    showToast('送信に失敗しました', 'error');
                } finally {
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>送信';
                }
            });

            // 共通書類を読み込む
            async function loadCommonDocumentsAdmin() {
                try {
                    var typesRes = await axios.get('/api/common-document-types');
                    var docsRes = await axios.get('/api/clients/' + CLIENT_ID + '/common-documents');
                    var documentTypes = typesRes.data;
                    var uploadedDocs = docsRes.data;
                    
                    var uploadedByType = {};
                    uploadedDocs.forEach(function(doc) {
                        if (!uploadedByType[doc.document_type]) uploadedByType[doc.document_type] = [];
                        uploadedByType[doc.document_type].push(doc);
                    });
                    
                    var container = document.getElementById('commonDocumentsListAdmin');
                    if (documentTypes.length === 0) {
                        container.innerHTML = '<div class="text-sm text-gray-500 py-2">共通書類タイプが設定されていません</div>';
                        return;
                    }
                    
                    container.innerHTML = documentTypes.map(function(type) {
                        var docs = uploadedByType[type.name] || [];
                        var hasDoc = docs.length > 0;
                        var latestDoc = hasDoc ? docs[0] : null;
                        var validityBadge = '';
                        if (latestDoc && type.validity_months) {
                            var uploadDate = new Date(latestDoc.uploaded_at);
                            var expiryDate = new Date(uploadDate);
                            expiryDate.setMonth(expiryDate.getMonth() + type.validity_months);
                            var daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                            if (daysUntilExpiry <= 0) validityBadge = '<span class="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">期限切れ</span>';
                            else if (daysUntilExpiry <= 30) validityBadge = '<span class="ml-2 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">残 ' + daysUntilExpiry + '日</span>';
                            else validityBadge = '<span class="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">有効</span>';
                        }
                        return '<div class="p-3 rounded-lg border ' + (hasDoc ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-200') + '">' +
                            '<div class="flex items-center gap-3">' +
                                '<div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ' + (hasDoc ? 'bg-teal-500' : 'bg-gray-300') + '">' +
                                    '<i class="fas ' + (hasDoc ? 'fa-check' : 'fa-file-alt') + ' text-white text-sm"></i>' +
                                '</div>' +
                                '<div class="flex-1 min-w-0">' +
                                    '<div class="flex items-center flex-wrap gap-1"><span class="font-medium text-sm ' + (hasDoc ? 'text-teal-800' : 'text-gray-700') + '">' + type.name + '</span>' + validityBadge + '</div>' +
                                    (!hasDoc ? '<div class="text-xs text-gray-500 mt-0.5">未アップロード</div>' : '') +
                                '</div>' +
                                (hasDoc && docs.length === 1 ? '<a href="/api/common-documents/' + latestDoc.id + '/download" class="text-teal-600 hover:text-teal-800 text-sm" title="ダウンロード"><i class="fas fa-download"></i></a>' : '') +
                            '</div>' +
                            (hasDoc && docs.length === 1 ? '<div class="mt-1 ml-11 flex items-center justify-between text-xs group"><div class="text-gray-600">' + latestDoc.file_name + ' <span class="text-gray-400 ml-1">' + new Date(latestDoc.uploaded_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) + '</span></div><button onclick="deleteCommonDocumentAdmin(' + latestDoc.id + ')" class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2" title="削除"><i class="fas fa-trash-alt"></i></button></div>' : '') +
                        '</div>';
                    }).join('');
                } catch (error) {
                    console.error('Error loading common documents:', error);
                    var container = document.getElementById('commonDocumentsListAdmin');
                    if (container) container.innerHTML = '<div class="text-sm text-red-500 py-2">共通書類の読み込みに失敗しました</div>';
                }
            }
            
            async function deleteCommonDocumentAdmin(docId) {
                if (!confirm('この書類を削除しますか？')) return;
                try {
                    await axios.delete('/api/common-documents/' + docId);
                    showToast('書類を削除しました', 'success');
                    loadCommonDocumentsAdmin();
                } catch (error) {
                    showToast('書類の削除に失敗しました', 'error');
                }
            }
            window.deleteCommonDocumentAdmin = deleteCommonDocumentAdmin;

            // 顧客編集
            function editClient() {
                if (!currentClient) return;
                document.getElementById('edit_name').value = currentClient.name || '';
                document.getElementById('edit_email').value = currentClient.email || '';
                document.getElementById('edit_phone').value = currentClient.phone || '';
                document.getElementById('edit_address').value = currentClient.address || '';
                document.getElementById('edit_notes').value = currentClient.notes || '';
                document.getElementById('editClientModal').classList.remove('hidden');
            }
            function closeEditModal() {
                document.getElementById('editClientModal').classList.add('hidden');
            }
            
            document.getElementById('editClientForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                var submitBtn = e.target.querySelector('button[type="submit"]');
                var originalText = submitBtn.innerHTML;
                try {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>更新中...';
                    var formData = new FormData(e.target);
                    var data = Object.fromEntries(formData);
                    await axios.patch('/api/clients/' + CLIENT_ID, {
                        name: data.name,
                        email: data.email || null, phone: data.phone || null,
                        address: data.address || null, notes: data.notes || null
                    });
                    closeEditModal();
                    await loadClient();
                    showToast('顧客情報を更新しました！');
                } catch (error) {
                    alert('更新に失敗しました: ' + (error.response?.data?.error || error.message));
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            });

            // タブ切り替え（2タブのみ）
            function switchClientTab(tab) {
                ['overview', 'cases'].forEach(function(t) {
                    var content = document.getElementById('client-content-' + t);
                    var tabBtn = document.getElementById('client-tab-' + t);
                    if (content) content.classList.add('hidden');
                    if (tabBtn) {
                        tabBtn.classList.remove('text-teal-600', 'border-teal-600');
                        tabBtn.classList.add('text-gray-500', 'border-transparent');
                    }
                });
                var activeContent = document.getElementById('client-content-' + tab);
                var activeTab = document.getElementById('client-tab-' + tab);
                if (activeContent) activeContent.classList.remove('hidden');
                if (activeTab) {
                    activeTab.classList.add('text-teal-600', 'border-teal-600');
                    activeTab.classList.remove('text-gray-500', 'border-transparent');
                }
                if (tab === 'cases') loadClientCases();
            }
            
            // 顧客の案件一覧を読み込み（カンバン形式）
            async function loadClientCases() {
                var container = document.getElementById('clientCasesList');
                if (!container) return;
                
                try {
                    var response = await axios.get('/api/clients/' + CLIENT_ID + '/cases');
                    var cases = response.data;
                    
                    if (!cases || cases.length === 0) {
                        container.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500 bg-white rounded-lg shadow">' +
                            '<i class="fas fa-folder-open text-5xl mb-4 text-gray-300"></i>' +
                            '<p class="text-lg mb-4">この顧客の案件はまだありません</p>' +
                            '<button onclick="openNewCaseModalForThisClient()" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"><i class="fas fa-plus mr-2"></i>新規案件登録</button></div>';
                        return;
                    }
                    
                    var STATUSES = [
                        { key: 'inquiry', label: '見込み', color: 'yellow', icon: 'fa-lightbulb' },
                        { key: 'preparing', label: '書類準備中', color: 'orange', icon: 'fa-file-alt' },
                        { key: 'applying', label: '申請中', color: 'purple', icon: 'fa-paper-plane' },
                        { key: 'adopted', label: '採択', color: 'blue', icon: 'fa-award' },
                        { key: 'rejected', label: '不採択', color: 'red', icon: 'fa-times-circle' },
                        { key: 'completed', label: '完了', color: 'green', icon: 'fa-check-circle' }
                    ];
                    
                    var casesByStatus = {};
                    STATUSES.forEach(function(s) { casesByStatus[s.key] = []; });
                    cases.forEach(function(c) {
                        if (casesByStatus[c.status]) casesByStatus[c.status].push(c);
                        else casesByStatus['inquiry'].push(c);
                    });
                    
                    // 案件があるステータスのみ表示（空カラムを非表示）
                    var activeStatuses = STATUSES.filter(function(s) { return casesByStatus[s.key].length > 0; });
                    
                    var colorClasses = {
                        yellow: { bg: 'bg-yellow-50', border: 'border-yellow-300', header: 'bg-yellow-100 text-yellow-800', badge: 'bg-yellow-500' },
                        blue: { bg: 'bg-blue-50', border: 'border-blue-300', header: 'bg-blue-100 text-blue-800', badge: 'bg-blue-500' },
                        orange: { bg: 'bg-orange-50', border: 'border-orange-300', header: 'bg-orange-100 text-orange-800', badge: 'bg-orange-500' },
                        purple: { bg: 'bg-purple-50', border: 'border-purple-300', header: 'bg-purple-100 text-purple-800', badge: 'bg-purple-500' },
                        red: { bg: 'bg-red-50', border: 'border-red-300', header: 'bg-red-100 text-red-800', badge: 'bg-red-500' },
                        green: { bg: 'bg-green-50', border: 'border-green-300', header: 'bg-green-100 text-green-800', badge: 'bg-green-500' }
                    };
                    
                    // グリッド列数を案件があるステータス数に合わせる
                    var colCount = Math.min(activeStatuses.length, 3);
                    container.className = 'grid grid-cols-1 md:grid-cols-' + Math.min(colCount, 2) + ' lg:grid-cols-' + colCount + ' gap-4';
                    
                    container.innerHTML = activeStatuses.map(function(status) {
                        var statusCases = casesByStatus[status.key];
                        var cc = colorClasses[status.color];
                        return '<div class="flex flex-col rounded-lg ' + cc.bg + ' border ' + cc.border + ' overflow-hidden">' +
                            '<div class="' + cc.header + ' px-3 py-2 flex items-center justify-between">' +
                                '<div class="flex items-center gap-2"><i class="fas ' + status.icon + '"></i><span class="font-bold text-sm">' + status.label + '</span></div>' +
                                '<span class="' + cc.badge + ' text-white text-xs px-2 py-0.5 rounded-full">' + statusCases.length + '</span>' +
                            '</div>' +
                            '<div class="p-2 space-y-2 flex-1 min-h-[100px] max-h-[500px] overflow-y-auto">' +
                                (statusCases.length === 0 ? '<div class="text-center py-4 text-gray-400 text-xs">案件なし</div>' :
                                statusCases.map(function(c) {
                                    return '<div class="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer" onclick="window.location.href=&#39;/case/' + c.id + '&#39;">' +
                                        '<div class="p-3">' +
                                            '<div class="flex items-start justify-between gap-2 mb-2"><span class="px-1.5 py-0.5 rounded text-xs bg-gray-200 text-gray-700 font-mono font-bold">No.' + String(c.id).padStart(4, '0') + '</span></div>' +
                                            (c.subsidy_type_name ? '<div class="text-sm font-medium text-gray-800 mb-2 line-clamp-2">' + c.subsidy_type_name + '</div>' : '') +
                                            '<div class="flex items-center gap-2 text-xs text-gray-500">' + (c.assigned_to_name ? '<span><i class="fas fa-user mr-1"></i>' + c.assigned_to_name + '</span>' : '') + '</div>' +
                                        '</div>' +
                                        '<div class="border-t px-3 py-2 flex gap-2" onclick="event.stopPropagation()">' +
                                            '<a href="/case/' + c.id + '" class="flex-1 text-center text-xs text-teal-600 hover:text-teal-800 py-1"><i class="fas fa-arrow-right mr-1"></i>詳細</a>' +
                                            '<a href="/portal/' + c.access_token + '" target="_blank" class="flex-1 text-center text-xs text-green-600 hover:text-green-800 py-1"><i class="fas fa-external-link-alt mr-1"></i>ポータル</a>' +
                                        '</div></div>';
                                }).join('')) +
                            '</div></div>';
                    }).join('');
                    
                } catch (error) {
                    console.error('Error loading client cases:', error);
                    container.innerHTML = '<div class="col-span-full text-center py-8 text-red-500 bg-white rounded-lg shadow"><i class="fas fa-exclamation-circle text-3xl mb-3"></i><p>案件一覧の読み込みに失敗しました</p></div>';
                }
            }
            
            function openNewCaseModalForThisClient() {
                // 新規案件モーダルをインライン表示（ページ離脱しない）
                document.getElementById('newCaseInlineModal').classList.remove('hidden');
                loadNewCaseFormData();
            }
            function closeNewCaseInlineModal() {
                document.getElementById('newCaseInlineModal').classList.add('hidden');
            }
            async function loadNewCaseFormData() {
                var select = document.getElementById('newCaseSubsidyType');
                if (select.options.length <= 1) {
                    subsidyTypes.forEach(function(st) {
                        var o = document.createElement('option'); o.value = st.id; o.textContent = st.name;
                        select.appendChild(o);
                    });
                }
                var userSelect = document.getElementById('newCaseAssignedTo');
                if (userSelect.options.length <= 1) {
                    allUsers.forEach(function(u) {
                        var o = document.createElement('option'); o.value = u.username; o.textContent = u.name || u.username;
                        userSelect.appendChild(o);
                    });
                    // 自分をデフォルト選択
                    var me = localStorage.getItem('admin_username');
                    if (me) userSelect.value = me;
                }
            }
            document.getElementById('newCaseInlineForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                var btn = e.target.querySelector('button[type="submit"]');
                btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>作成中...';
                try {
                    var data = {
                        client_id: CLIENT_ID,
                        subsidy_type_id: parseInt(document.getElementById('newCaseSubsidyType').value) || null,
                        assigned_to: document.getElementById('newCaseAssignedTo').value || null,
                        notes: document.getElementById('newCaseNotes').value || null
                    };
                    var r = await axios.post('/api/cases', data);
                    showToast('案件を作成しました！');
                    closeNewCaseInlineModal();
                    // クライアントデータを再読み込みして案件数を更新
                    await loadClient();
                    if (currentClient) renderClientInfo();
                    switchClientTab('cases');
                } catch(err) {
                    showToast('作成に失敗しました: ' + (err.response?.data?.error || err.message), 'error');
                } finally {
                    btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus mr-1"></i>作成';
                }
            });

            // キーボードショートカット
            document.addEventListener('keydown', function(e) {
                // モーダルが開いていたらESCで閉じる
                if (e.key === 'Escape') {
                    closeEditModal();
                    return;
                }
                // 入力フォーカス中は無視
                var tag = document.activeElement ? document.activeElement.tagName : '';
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                // E: 編集モーダル
                if (e.key === 'e' || e.key === 'E') { e.preventDefault(); editClient(); }
                // N: 新規案件
                if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openNewCaseModalForThisClient(); }
                // 1: 基本情報タブ, 2: 案件一覧タブ
                if (e.key === '1') { e.preventDefault(); switchClientTab('overview'); }
                if (e.key === '2') { e.preventDefault(); switchClientTab('cases'); }
            });

            // グローバルスコープに関数を公開
            window.logout = logout;
            window.switchClientTab = switchClientTab;
            window.editClient = editClient;
            window.deleteCurrentClient = deleteCurrentClient;
            window.closeEditModal = closeEditModal;
            window.copyPortalUrl = copyPortalUrl;
            window.openNewCaseModalForThisClient = openNewCaseModalForThisClient;
            window.closeNewCaseInlineModal = closeNewCaseInlineModal;
            window.showToast = showToast;

            // 全API完全並列化で初期読み込み
            var startTime = performance.now();
            Promise.all([
                loadSubsidyTypes(),
                loadUsers(),
                loadClient(),
                loadCommonDocumentsAdmin(),
                loadCommunications()
            ]).then(function() {
                console.log('[perf] 全データ読み込み完了: ' + Math.round(performance.now() - startTime) + 'ms');
                // loadClientはsubsidyTypesに依存するレンダリングがあるため、再描画
                if (currentClient) renderClientInfo();
                
                // URLハッシュによるタブ切り替え
                var hash = window.location.hash.replace('#', '');
                if (hash === 'cases') {
                    setTimeout(function() { switchClientTab('cases'); }, 100);
                }
            }).catch(function(error) {
                console.error('Error during initial load:', error);
                document.getElementById('clientInfo').innerHTML = '<div class="text-red-600">初期データの読み込みに失敗しました</div>';
            });
            
            window.addEventListener('hashchange', function() {
                var hash = window.location.hash.replace('#', '');
                if (hash === 'cases') switchClientTab('cases');
                else switchClientTab('overview');
            });
            
            ${sidebarScripts}
        </script>
            </main>
        </div>
    </body>
    </html>
  `)
})

export default routes
