// 案件管理ページ（統合版）
// カンバン + リストビュー切り替え、ステップウィザードでの新規登録
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import { modalStyles, modalScripts } from '../../templates/modal'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/cases', async (c) => {
  try {
    const { DB } = c.env
    const user = await getCurrentUser(c)
    const showArchived = c.req.query('archived') === 'true'
    const assignedTo = c.req.query('assigned_to') || ''
    const filterStatus = c.req.query('status') || ''
    const openNewCase = c.req.query('newCase') === 'true'
    const preselectedClientId = c.req.query('client_id') || ''
    
    const orgId = getEffectiveOrgId(c, user)
    if (!orgId) return c.redirect('/login')
    
    // 担当者リスト取得
    const adminUsersResult = await DB.prepare('SELECT username, name FROM admin_users WHERE organization_id = ? ORDER BY name').bind(orgId).all()
    const adminUsers = adminUsersResult.results || []

  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>案件管理 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
            ${modalStyles}
            .kanban-container { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; height: calc(100vh - 180px); min-height: 400px; }
            @media (max-width: 1200px) { .kanban-container { grid-template-columns: repeat(3, 1fr); height: auto; } }
            @media (max-width: 640px) { .kanban-container { grid-template-columns: repeat(2, 1fr); } }
            .kanban-column { display: flex; flex-direction: column; min-height: 0; max-height: 100%; }
            .kanban-cards { flex: 1; overflow-y: auto; min-height: 0; }
            .kanban-cards::-webkit-scrollbar { width: 3px; }
            .kanban-cards::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
            
            /* ステップウィザード */
            .wizard-step { display: none; }
            .wizard-step.active { display: block; }
            .wizard-indicator { transition: all 0.3s; }
            .wizard-indicator.completed { background-color: #3b82f6; color: white; }
            .wizard-indicator.current { background-color: #3b82f6; color: white; box-shadow: 0 0 0 4px rgba(59,130,246,0.2); }
            .wizard-indicator.pending { background-color: #e5e7eb; color: #9ca3af; }
            .wizard-line.completed { background-color: #3b82f6; }
            .wizard-line.pending { background-color: #e5e7eb; }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex">
            ${generateSidebar('cases')}
            
            <main class="flex-1 h-screen overflow-hidden flex flex-col">
                <!-- パンくずリスト -->
                <div class="bg-white px-4 py-1.5 border-b text-xs" id="breadcrumb">
                    <a href="/" class="text-blue-600 hover:text-blue-800 hover:underline">ダッシュボード</a>
                    <i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>
                    <span class="text-gray-800 font-medium">案件管理</span>
                </div>
                
                <!-- ヘッダー -->
                <header class="bg-white border-b sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-2.5">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-bold text-gray-800">案件管理</h2>
                            <span class="text-sm text-gray-500" id="caseCount">-</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <!-- ビュー切り替え -->
                            <div class="flex bg-gray-100 rounded-lg p-0.5">
                                <button onclick="setView('kanban')" id="viewBtn-kanban" class="px-3 py-1.5 rounded-md text-xs font-medium bg-white shadow-sm text-gray-700">
                                    <i class="fas fa-columns mr-1"></i>カンバン
                                </button>
                                <button onclick="setView('list')" id="viewBtn-list" class="px-3 py-1.5 rounded-md text-xs font-medium text-gray-500">
                                    <i class="fas fa-list mr-1"></i>リスト
                                </button>
                            </div>
                            
                            <!-- フィルター -->
                            <select id="statusFilter" onchange="applyFilters()" class="border rounded-lg px-2 py-1.5 text-sm bg-white">
                                <option value="">全ステータス</option>
                                <option value="inquiry" ${filterStatus === 'inquiry' ? 'selected' : ''}>見込み</option>
                                <option value="preparing" ${filterStatus === 'preparing' ? 'selected' : ''}>書類準備</option>
                                <option value="applying" ${filterStatus === 'applying' ? 'selected' : ''}>申請中</option>
                                <option value="adopted" ${filterStatus === 'adopted' ? 'selected' : ''}>採択</option>
                                <option value="rejected" ${filterStatus === 'rejected' ? 'selected' : ''}>不採択</option>
                            </select>
                            <select id="assigneeFilter" onchange="applyFilters()" class="border rounded-lg px-2 py-1.5 text-sm bg-white">
                                <option value="">全担当者</option>
                                <option value="未割り当て" ${assignedTo === '未割り当て' ? 'selected' : ''}>未割り当て</option>
                                ${(adminUsers as any[]).map((u: any) => `<option value="${u.username}" ${assignedTo === u.username ? 'selected' : ''}>${u.name || u.username}</option>`).join('')}
                            </select>
                            
                            <!-- ソート -->
                            <select id="sortSelect" onchange="currentSort=this.value;loadCases()" class="border rounded-lg px-2 py-1.5 text-sm bg-white">
                                <option value="updated_desc">更新日 ↓</option>
                                <option value="updated_asc">更新日 ↑</option>
                                <option value="created_desc">作成日 ↓</option>
                                <option value="deadline_asc">期限が近い順</option>
                                <option value="client_name">顧客名 A→Z</option>
                            </select>
                            
                            <!-- CSV -->
                            <a href="/api/export/cases/csv" class="text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg border hover:bg-gray-50 text-sm" title="CSV出力">
                                <i class="fas fa-file-csv"></i>
                            </a>
                            
                            <!-- 新規案件ボタン -->
                            <button onclick="openNewCaseWizard()" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 text-sm font-medium">
                                <i class="fas fa-plus mr-1"></i>新規案件
                            </button>
                        </div>
                    </div>
                </header>

                <!-- カンバンビュー -->
                <div id="kanbanView" class="p-3 flex-1 overflow-hidden">
                    <div class="kanban-container" id="kanbanBoard">
                        <div class="col-span-6 text-center py-12 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-2xl mb-3"></i>
                            <div>読み込み中...</div>
                        </div>
                    </div>
                </div>
                
                <!-- リストビュー -->
                <div id="listView" class="hidden flex-1 overflow-y-auto">
                    <div class="p-4">
                        <div class="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <table class="w-full">
                                <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                                    <tr>
                                        <th class="px-4 py-3 text-left">案件番号</th>
                                        <th class="px-4 py-3 text-left">顧客名</th>
                                        <th class="px-4 py-3 text-left">申請種別</th>
                                        <th class="px-4 py-3 text-left">ステータス</th>
                                        <th class="px-4 py-3 text-left">進捗</th>
                                        <th class="px-4 py-3 text-left">担当者</th>
                                        <th class="px-4 py-3 text-left">期限</th>
                                        <th class="px-4 py-3 text-center">操作</th>
                                    </tr>
                                </thead>
                                <tbody id="listBody" class="divide-y divide-gray-100"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <!-- 新規案件ステップウィザード -->
        <div id="newCaseWizard" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <!-- ウィザードヘッダー -->
                <div class="p-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-bold text-gray-800">
                            <i class="fas fa-plus-circle text-blue-600 mr-2"></i>新規案件登録
                        </h3>
                        <button onclick="closeNewCaseWizard()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <!-- ステップインジケーター -->
                    <div class="flex items-center justify-center gap-0">
                        <div class="flex flex-col items-center">
                            <div id="stepInd-1" class="wizard-indicator current w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</div>
                            <span class="text-xs mt-1 text-gray-500">顧客</span>
                        </div>
                        <div id="stepLine-1" class="wizard-line pending w-16 h-0.5 mx-2"></div>
                        <div class="flex flex-col items-center">
                            <div id="stepInd-2" class="wizard-indicator pending w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                            <span class="text-xs mt-1 text-gray-500">申請種別</span>
                        </div>
                        <div id="stepLine-2" class="wizard-line pending w-16 h-0.5 mx-2"></div>
                        <div class="flex flex-col items-center">
                            <div id="stepInd-3" class="wizard-indicator pending w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                            <span class="text-xs mt-1 text-gray-500">詳細設定</span>
                        </div>
                    </div>
                </div>
                
                <div class="p-5">
                    <!-- Step 1: 顧客選択 -->
                    <div id="wizardStep-1" class="wizard-step active">
                        <h4 class="font-bold text-gray-700 mb-3">顧客を選択してください</h4>
                        <div class="flex gap-3 mb-4">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="wiz_customer_type" value="existing" checked onchange="toggleWizCustomerType()">
                                <span class="text-sm">既存顧客</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="wiz_customer_type" value="new" onchange="toggleWizCustomerType()">
                                <span class="text-sm">新規顧客</span>
                            </label>
                        </div>
                        
                        <div id="wizExistingCustomer">
                            <select id="wizClientSelect" class="w-full px-3 py-2.5 border rounded-lg text-sm">
                                <option value="">顧客を選択...</option>
                            </select>
                        </div>
                        
                        <div id="wizNewCustomer" class="hidden space-y-3">
                            <div class="grid grid-cols-2 gap-3">
                                <div class="col-span-2">
                                    <label class="block text-xs font-medium text-gray-600 mb-1">顧客名 / 企業名 *</label>
                                    <input type="text" id="wizNewName" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 山田太郎 / 株式会社サンプル">
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">メール</label>
                                    <input type="email" id="wizNewEmail" class="w-full px-3 py-2 border rounded-lg text-sm">
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">電話</label>
                                    <input type="tel" id="wizNewPhone" class="w-full px-3 py-2 border rounded-lg text-sm">
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-600 mb-1">住所</label>
                                <input type="text" id="wizNewAddress" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="東京都渋谷区...">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Step 2: 申請種別選択 -->
                    <div id="wizardStep-2" class="wizard-step">
                        <h4 class="font-bold text-gray-700 mb-3">申請種別を選択してください</h4>
                        <div class="relative mb-3">
                            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                            <input type="text" id="wizSubsidySearch" placeholder="補助金・助成金名で検索..." class="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" oninput="filterWizSubsidies()">
                        </div>
                        <div id="wizSubsidyList" class="border rounded-lg max-h-60 overflow-y-auto"></div>
                        <div id="wizSelectedSubsidy" class="hidden mt-2 text-sm text-green-600 font-medium">
                            <i class="fas fa-check-circle mr-1"></i>選択中: <span></span>
                        </div>
                    </div>
                    
                    <!-- Step 3: 詳細設定 -->
                    <div id="wizardStep-3" class="wizard-step">
                        <h4 class="font-bold text-gray-700 mb-3">詳細設定（任意）</h4>
                        <div class="space-y-4">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">担当者</label>
                                    <select id="wizAssignedTo" class="w-full px-3 py-2 border rounded-lg text-sm">
                                        <option value="">未割り当て</option>
                                        ${(adminUsers as any[]).map((u: any) => `<option value="${u.username}">${u.name || u.username}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">申請期限</label>
                                    <input type="date" id="wizDeadline" class="w-full px-3 py-2 border rounded-lg text-sm">
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-xs font-medium text-gray-600 mb-1">パイプライン</label>
                                <select id="wizPipeline" class="w-full px-3 py-2 border rounded-lg text-sm">
                                    <option value="">パイプラインなし</option>
                                </select>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <label class="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <input type="checkbox" id="wizDepositRequired" class="rounded">
                                    <div>
                                        <div class="text-sm font-medium">手付金</div>
                                        <div class="text-xs text-gray-500">着手金が必要な場合</div>
                                    </div>
                                </label>
                                <label class="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <input type="checkbox" id="wizSuccessFee" class="rounded">
                                    <div>
                                        <div class="text-sm font-medium">成果報酬</div>
                                        <div class="text-xs text-gray-500">成功報酬がある場合</div>
                                    </div>
                                </label>
                            </div>
                            
                            <div id="wizDepositFields" class="hidden">
                                <label class="block text-xs font-medium text-gray-600 mb-1">手付金額（円）</label>
                                <input type="number" id="wizDepositAmount" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="50000">
                            </div>
                            
                            <div id="wizSuccessFeeFields" class="hidden grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">報酬率（%）</label>
                                    <input type="number" id="wizSuccessRate" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="10" step="0.1">
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">固定額（円）</label>
                                    <input type="number" id="wizSuccessAmount" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="100000">
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                                <textarea id="wizNotes" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="案件に関するメモ..."></textarea>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- ウィザードフッター -->
                <div class="p-5 border-t bg-gray-50 flex items-center justify-between">
                    <button id="wizBackBtn" onclick="wizardBack()" class="hidden px-4 py-2 border rounded-lg text-sm hover:bg-white">
                        <i class="fas fa-arrow-left mr-1"></i>戻る
                    </button>
                    <div class="flex-1"></div>
                    <button id="wizNextBtn" onclick="wizardNext()" class="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                        次へ <i class="fas fa-arrow-right ml-1"></i>
                    </button>
                    <button id="wizSubmitBtn" onclick="submitNewCase()" class="hidden px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                        <i class="fas fa-save mr-1"></i>案件を登録
                    </button>
                </div>
            </div>
        </div>
        
        <!-- クイックビューモーダル -->
        <div id="quickViewModal" class="modal-overlay">
            <div class="modal-container modal-lg">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="fas fa-folder-open"></i><span id="qvTitle">案件詳細</span></h3>
                    <button class="modal-close" onclick="modalManager.close('quickViewModal')"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body" id="qvContent">
                    <div class="modal-loading"><div class="modal-spinner"></div></div>
                </div>
                <div class="modal-footer">
                    <button onclick="modalManager.close('quickViewModal')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">閉じる</button>
                    <a id="qvDetailLink" href="#" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <i class="fas fa-external-link-alt mr-1"></i>詳細ページへ
                    </a>
                </div>
            </div>
        </div>

        <script>
            ${sidebarScripts}
            ${modalScripts}
            
            const token = localStorage.getItem('admin_token');
            if (!token) window.location.href = '/login';
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
            
            let allCases = [];
            let subsidyTypes = [];
            let currentView = 'kanban';
            let currentSort = 'updated_desc'; // デフォルトソート
            
            const STATUSES = [
                { key: 'inquiry', label: '見込み', color: 'yellow', icon: 'fa-lightbulb' },
                { key: 'preparing', label: '書類準備', color: 'orange', icon: 'fa-file-alt' },
                { key: 'applying', label: '申請中', color: 'purple', icon: 'fa-paper-plane' },
                { key: 'adopted', label: '採択', color: 'blue', icon: 'fa-trophy' },
                { key: 'rejected', label: '不採択', color: 'red', icon: 'fa-times-circle' },
                { key: 'archived', label: '完了', color: 'green', icon: 'fa-check-circle' }
            ];
            
            // ステータスラベル・色は sidebarScripts 共通版（window.statusLabels / window.statusColors）を使用
            
            const COLOR_MAP = {
                yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'bg-yellow-100 text-yellow-800', badge: 'bg-yellow-500' },
                orange: { bg: 'bg-orange-50', border: 'border-orange-200', header: 'bg-orange-100 text-orange-800', badge: 'bg-orange-500' },
                purple: { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-100 text-purple-800', badge: 'bg-purple-500' },
                blue: { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-blue-100 text-blue-800', badge: 'bg-blue-500' },
                red: { bg: 'bg-red-50', border: 'border-red-200', header: 'bg-red-100 text-red-800', badge: 'bg-red-500' },
                green: { bg: 'bg-green-50', border: 'border-green-200', header: 'bg-green-100 text-green-800', badge: 'bg-green-500' }
            };
            
            // ======= データ読み込み =======
            async function loadCases() {
                try {
                    const showArchived = new URLSearchParams(window.location.search).get('archived') === 'true';
                    const url = showArchived ? '/api/cases?include_archived=true' : '/api/cases';
                    const res = await axios.get(url);
                    allCases = res.data.cases || res.data || [];
                    
                    // フィルター適用
                    let filtered = allCases;
                    const assignee = document.getElementById('assigneeFilter')?.value;
                    const statusFilter = new URLSearchParams(window.location.search).get('status');
                    
                    if (assignee === '未割り当て') filtered = filtered.filter(c => !c.assigned_to);
                    else if (assignee) filtered = filtered.filter(c => c.assigned_to === assignee);
                    if (statusFilter) filtered = filtered.filter(c => c.status === statusFilter);
                    
                    // ソート適用
                    filtered.sort(function(a, b) {
                        switch(currentSort) {
                            case 'updated_asc': return new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at);
                            case 'created_desc': return new Date(b.created_at) - new Date(a.created_at);
                            case 'deadline_asc': 
                                if (!a.application_end_date) return 1;
                                if (!b.application_end_date) return -1;
                                return new Date(a.application_end_date) - new Date(b.application_end_date);
                            case 'client_name': return (a.client_name || '').localeCompare(b.client_name || '', 'ja');
                            default: return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
                        }
                    });
                    
                    document.getElementById('caseCount').textContent = filtered.length + '件';
                    
                    if (currentView === 'kanban') renderKanban(filtered);
                    else renderList(filtered);
                } catch (e) {
                    console.error('Load error:', e);
                }
            }
            
            // ======= カンバンレンダリング =======
            function renderKanban(cases) {
                const board = document.getElementById('kanbanBoard');
                const grouped = {};
                STATUSES.forEach(s => grouped[s.key] = []);
                
                cases.forEach(c => {
                    if (c.is_archived) { grouped['archived']?.push(c); }
                    else if (grouped[c.status]) { grouped[c.status].push(c); }
                });
                
                board.innerHTML = STATUSES.map(status => {
                    const items = grouped[status.key] || [];
                    const colors = COLOR_MAP[status.color];
                    
                    const cards = items.length === 0 
                        ? '<div class="text-center py-4 text-gray-400 text-xs">案件なし</div>'
                        : items.map(c => {
                            const totalTasks = c.pipeline_total_tasks || 0;
                            const completedTasks = c.pipeline_completed_tasks || 0;
                            const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                            const hasProgress = totalTasks > 0;
                            
                            return \`
                            <div onclick="openQuickView(\${c.id})" class="bg-white rounded-lg shadow-sm border hover:shadow hover:border-blue-300 transition cursor-pointer mb-1.5 p-2">
                                <div class="flex items-center justify-between mb-1">
                                    <span class="font-mono text-xs text-gray-400">\${c.case_number || '#' + c.id}</span>
                                    \${c.result === 'approved' ? '<span class="px-1 py-0.5 rounded text-xs bg-blue-500 text-white">採択</span>' : ''}
                                    \${c.result === 'rejected' ? '<span class="px-1 py-0.5 rounded text-xs bg-red-500 text-white">不採択</span>' : ''}
                                </div>
                                <div class="font-semibold text-gray-900 text-sm truncate">\${c.client_name || '未設定'}</div>
                                \${c.subsidy_type_name ? '<div class="mt-1"><span class="inline-block px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 truncate">' + c.subsidy_type_name + '</span></div>' : ''}
                                \${hasProgress ? \`
                                <div class="mt-1.5">
                                    <div class="flex items-center justify-between text-xs mb-0.5">
                                        <span class="text-gray-400">進捗</span>
                                        <span class="\${progressPct >= 100 ? 'text-green-600' : 'text-blue-600'} font-medium">\${completedTasks}/\${totalTasks}</span>
                                    </div>
                                    <div class="h-1 bg-gray-200 rounded-full overflow-hidden">
                                        <div class="h-full rounded-full transition-all \${progressPct >= 100 ? 'bg-green-500' : 'bg-blue-500'}" style="width:\${progressPct}%"></div>
                                    </div>
                                </div>
                                \` : ''}
                                \${c.assigned_to_name ? '<div class="text-xs text-gray-400 mt-1"><i class="fas fa-user mr-1"></i>' + c.assigned_to_name + '</div>' : ''}
                            </div>
                        \`}).join('');
                    
                    return \`
                        <div class="kanban-column rounded-lg \${colors.bg} border \${colors.border} overflow-hidden">
                            <div class="\${colors.header} px-2 py-1.5 flex items-center justify-between shrink-0">
                                <div class="flex items-center gap-1">
                                    <i class="fas \${status.icon} text-xs"></i>
                                    <span class="font-semibold text-xs">\${status.label}</span>
                                </div>
                                <span class="\${colors.badge} text-white text-xs px-1.5 py-0.5 rounded-full">\${items.length}</span>
                            </div>
                            <div class="kanban-cards p-1.5">\${cards}</div>
                        </div>
                    \`;
                }).join('');
            }
            
            // ======= リストレンダリング =======
            function renderList(cases) {
                const body = document.getElementById('listBody');
                
                if (cases.length === 0) {
                    body.innerHTML = '<tr><td colspan="8" class="text-center py-16"><div class="max-w-sm mx-auto"><div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4"><i class="fas fa-folder-plus text-blue-400 text-2xl"></i></div><p class="text-gray-500 mb-1">案件がありません</p><p class="text-gray-400 text-sm mb-4">最初の案件を登録して管理を始めましょう</p><button onclick="openNewCaseWizard()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"><i class="fas fa-plus mr-1"></i>最初の案件を作成</button></div></td></tr>';
                    return;
                }
                
                body.innerHTML = cases.map(c => {
                    const deadline = c.application_end_date;
                    let deadlineHtml = '-';
                    if (deadline) {
                        const d = new Date(deadline);
                        const diff = Math.ceil((d - new Date()) / (1000*60*60*24));
                        if (diff < 0) deadlineHtml = '<span class="text-gray-400">期限切れ</span>';
                        else if (diff <= 7) deadlineHtml = '<span class="text-red-600 font-bold">あと' + diff + '日</span>';
                        else deadlineHtml = d.toLocaleDateString('ja-JP', { month:'numeric', day:'numeric' });
                    }
                    
                    const totalTasks = c.pipeline_total_tasks || 0;
                    const completedTasks = c.pipeline_completed_tasks || 0;
                    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                    
                    let progressHtml = '-';
                    if (totalTasks > 0) {
                        const barColor = progressPct >= 100 ? 'bg-green-500' : 'bg-blue-500';
                        progressHtml = \`
                            <div class="w-24">
                                <div class="flex items-center justify-between text-xs mb-0.5">
                                    <span class="\${progressPct >= 100 ? 'text-green-600' : 'text-blue-600'} font-medium">\${progressPct}%</span>
                                </div>
                                <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div class="h-full \${barColor} rounded-full" style="width:\${progressPct}%"></div>
                                </div>
                            </div>
                        \`;
                    }
                    
                    return \`
                        <tr class="hover:bg-blue-50 cursor-pointer transition" onclick="window.location.href='/case/\${c.id}'">
                            <td class="px-4 py-3 font-mono text-sm text-gray-500">\${c.case_number || '#' + c.id}</td>
                            <td class="px-4 py-3">
                                <div class="font-medium text-gray-900">\${c.client_name || '未設定'}</div>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-600">\${c.subsidy_type_name || '-'}</td>
                            <td class="px-4 py-3">
                                <span class="px-2 py-1 rounded-full text-xs font-medium \${statusColors[c.status] || 'bg-gray-100'}">\${statusLabels[c.status] || c.status}</span>
                                \${c.is_archived ? '<span class="ml-1 px-1.5 py-0.5 rounded text-xs bg-green-200 text-green-800"><i class="fas fa-archive text-xs mr-0.5"></i>完了</span>' : ''}
                            </td>
                            <td class="px-4 py-3">\${progressHtml}</td>
                            <td class="px-4 py-3 text-sm text-gray-600">\${c.assigned_to_name || '-'}</td>
                            <td class="px-4 py-3 text-sm">\${deadlineHtml}</td>
                            <td class="px-4 py-3 text-center">
                                <a href="/case/\${c.id}" class="text-blue-600 hover:text-blue-800"><i class="fas fa-external-link-alt"></i></a>
                            </td>
                        </tr>
                    \`;
                }).join('');
            }
            
            // ======= ビュー切り替え =======
            function setView(view) {
                currentView = view;
                document.getElementById('kanbanView').classList.toggle('hidden', view !== 'kanban');
                document.getElementById('listView').classList.toggle('hidden', view !== 'list');
                
                document.getElementById('viewBtn-kanban').className = view === 'kanban' 
                    ? 'px-3 py-1.5 rounded-md text-xs font-medium bg-white shadow-sm text-gray-700' 
                    : 'px-3 py-1.5 rounded-md text-xs font-medium text-gray-500';
                document.getElementById('viewBtn-list').className = view === 'list' 
                    ? 'px-3 py-1.5 rounded-md text-xs font-medium bg-white shadow-sm text-gray-700' 
                    : 'px-3 py-1.5 rounded-md text-xs font-medium text-gray-500';
                
                localStorage.setItem('cases_view', view);
                loadCases();
            }
            
            function applyFilters() {
                const assignee = document.getElementById('assigneeFilter')?.value;
                const statusFilter = document.getElementById('statusFilter')?.value;
                const params = new URLSearchParams(window.location.search);
                if (assignee) params.set('assigned_to', assignee);
                else params.delete('assigned_to');
                if (statusFilter) params.set('status', statusFilter);
                else params.delete('status');
                window.location.href = '/cases' + (params.toString() ? '?' + params.toString() : '');
            }
            
            // ======= クイックビュー =======
            async function openQuickView(caseId) {
                document.getElementById('qvDetailLink').href = '/case/' + caseId;
                document.getElementById('qvContent').innerHTML = '<div class="modal-loading"><div class="modal-spinner"></div></div>';
                modalManager.open('quickViewModal');
                
                try {
                    const res = await axios.get('/api/cases/' + caseId + '/quick-view?tab=overview');
                    const d = res.data;
                    document.getElementById('qvTitle').textContent = (d.case_number || '#' + caseId) + ' - ' + (d.client_name || '');
                    
                    // タスク進捗
                    const totalTasks = d.pipeline_total_tasks || 0;
                    const completedTasks = d.pipeline_completed_tasks || 0;
                    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                    
                    // 期限表示
                    let deadlineHtml = '';
                    if (d.application_end_date) {
                        const dl = new Date(d.application_end_date);
                        const diff = Math.ceil((dl - new Date()) / (1000*60*60*24));
                        if (diff < 0) deadlineHtml = '<span class="text-xs text-gray-400"><i class="fas fa-clock mr-1"></i>期限切れ</span>';
                        else if (diff <= 7) deadlineHtml = '<span class="text-xs text-red-600 font-bold"><i class="fas fa-exclamation-triangle mr-1"></i>あと' + diff + '日</span>';
                        else deadlineHtml = '<span class="text-xs text-gray-600"><i class="fas fa-calendar mr-1"></i>' + dl.toLocaleDateString('ja-JP') + '</span>';
                    }
                    
                    document.getElementById('qvContent').innerHTML = \`
                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="px-3 py-1 rounded-full text-xs font-medium \${statusColors[d.status] || 'bg-gray-100'}">\${statusLabels[d.status] || d.status}</span>
                                    \${d.result === 'approved' ? '<span class="px-2 py-1 rounded text-xs bg-blue-500 text-white"><i class="fas fa-trophy mr-1"></i>採択</span>' : ''}
                                    \${d.result === 'rejected' ? '<span class="px-2 py-1 rounded text-xs bg-red-500 text-white">不採択</span>' : ''}
                                </div>
                                \${deadlineHtml}
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div class="p-3 bg-gray-50 rounded-lg">
                                    <div class="text-xs text-gray-500 mb-0.5">顧客名</div>
                                    <a href="/client/\${d.client_id}" class="font-medium text-blue-600 hover:underline">\${d.client_name || '-'}</a>
                                </div>
                                <div class="p-3 bg-gray-50 rounded-lg">
                                    <div class="text-xs text-gray-500 mb-0.5">申請種別</div>
                                    <div class="font-medium text-sm">\${d.subsidy_type_name || '-'}</div>
                                </div>
                                <div class="p-3 bg-gray-50 rounded-lg">
                                    <div class="text-xs text-gray-500 mb-0.5">担当者</div>
                                    <div class="font-medium">\${d.assigned_to_name || '<span class="text-gray-400">未割り当て</span>'}</div>
                                </div>
                                <div class="p-3 bg-gray-50 rounded-lg">
                                    <div class="text-xs text-gray-500 mb-0.5">タスク進捗</div>
                                    \${totalTasks > 0 ? \`
                                        <div class="font-medium text-sm \${progressPct >= 100 ? 'text-green-600' : 'text-blue-600'}">\${completedTasks}/\${totalTasks} (\${progressPct}%)</div>
                                        <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                                            <div class="h-full rounded-full \${progressPct >= 100 ? 'bg-green-500' : 'bg-blue-500'}" style="width:\${progressPct}%"></div>
                                        </div>
                                    \` : '<div class="text-gray-400 text-sm">タスクなし</div>'}
                                </div>
                            </div>
                            \${d.notes ? '<div class="text-sm text-gray-600 bg-gray-50 rounded-lg p-3"><div class="text-xs text-gray-400 mb-1"><i class="fas fa-sticky-note mr-1"></i>メモ</div>' + d.notes + '</div>' : ''}
                            \${d.access_token ? \`
                            <div class="pt-2 border-t">
                                <div class="text-xs text-gray-500 mb-1"><i class="fas fa-link mr-1"></i>ポータルURL</div>
                                <div class="flex items-center gap-2">
                                    <input type="text" readonly value="\${window.location.origin}/portal/\${d.access_token}" class="flex-1 px-3 py-1.5 border rounded bg-gray-50 text-xs font-mono">
                                    <button onclick="navigator.clipboard.writeText(this.previousElementSibling.value).then(() => { this.innerHTML = '<i class=&quot;fas fa-check text-green-600&quot;></i>'; setTimeout(() => this.innerHTML = '<i class=&quot;fas fa-copy&quot;></i>', 1500); })" class="px-3 py-1.5 border rounded hover:bg-gray-50 text-sm"><i class="fas fa-copy"></i></button>
                                </div>
                            </div>
                            \` : ''}
                        </div>
                    \`;
                } catch (e) {
                    document.getElementById('qvContent').innerHTML = '<div class="text-center py-8 text-red-500"><i class="fas fa-exclamation-circle text-2xl mb-2"></i><div>読み込みに失敗しました</div></div>';
                }
            }
            
            // ======= ステップウィザード =======
            let wizardStep = 1;
            let wizSelectedSubsidyId = null;
            let wizSelectedSubsidyName = '';
            
            function openNewCaseWizard() {
                wizardStep = 1;
                wizSelectedSubsidyId = null;
                document.getElementById('newCaseWizard').classList.remove('hidden');
                updateWizardUI();
                loadWizardData();
            }
            
            function closeNewCaseWizard() {
                document.getElementById('newCaseWizard').classList.add('hidden');
            }
            
            async function loadWizardData() {
                try {
                    const [clientsRes, subsidyRes] = await Promise.all([
                        axios.get('/api/clients'),
                        axios.get('/api/subsidy-types')
                    ]);
                    
                    // 顧客セレクト
                    const select = document.getElementById('wizClientSelect');
                    select.innerHTML = '<option value="">顧客を選択...</option>';
                    (clientsRes.data || []).forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c.id;
                        opt.textContent = c.name;
                        select.appendChild(opt);
                    });
                    
                    // プリセレクト
                    const preselect = '${preselectedClientId}';
                    if (preselect) select.value = preselect;
                    
                    // 補助金リスト
                    subsidyTypes = subsidyRes.data || [];
                    renderWizSubsidies();
                } catch (e) { console.error('Wizard data error:', e); }
            }
            
            function renderWizSubsidies(filter = '') {
                const container = document.getElementById('wizSubsidyList');
                const search = filter || document.getElementById('wizSubsidySearch')?.value?.toLowerCase() || '';
                
                const filtered = subsidyTypes.filter(t => 
                    t.category !== 'システム' && (!search || t.name.toLowerCase().includes(search) || (t.description && t.description.toLowerCase().includes(search)))
                );
                
                if (filtered.length === 0) {
                    container.innerHTML = '<div class="p-4 text-center text-gray-400 text-sm">該当する申請種別がありません</div>';
                    return;
                }
                
                container.innerHTML = filtered.map(t => \`
                    <div class="px-3 py-2.5 cursor-pointer hover:bg-blue-50 border-b border-gray-100 transition \${wizSelectedSubsidyId === t.id ? 'bg-blue-100 border-blue-300' : ''}"
                         onclick="selectWizSubsidy(\${t.id}, '\${t.name.replace(/'/g, "\\\\'")}')">
                        <div class="font-medium text-sm \${wizSelectedSubsidyId === t.id ? 'text-blue-700' : 'text-gray-800'}">\${t.name}</div>
                        \${t.description ? '<div class="text-xs text-gray-500 truncate">' + t.description + '</div>' : ''}
                    </div>
                \`).join('');
            }
            
            function filterWizSubsidies() { renderWizSubsidies(); }
            
            function selectWizSubsidy(id, name) {
                wizSelectedSubsidyId = id;
                wizSelectedSubsidyName = name;
                const display = document.getElementById('wizSelectedSubsidy');
                display.classList.remove('hidden');
                display.querySelector('span').textContent = name;
                renderWizSubsidies();
                
                // パイプライン読み込み
                loadWizPipelines(id, name);
            }
            
            async function loadWizPipelines(subsidyTypeId, subsidyTypeName) {
                try {
                    const res = await axios.get('/api/pipeline-templates?subsidy_type_id=' + subsidyTypeId);
                    const templates = res.data || [];
                    const select = document.getElementById('wizPipeline');
                    select.innerHTML = '<option value="">パイプラインなし</option>';
                    templates.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.id;
                        opt.textContent = t.name + (t.task_count ? ' (' + t.task_count + 'タスク)' : '');
                        select.appendChild(opt);
                    });
                    // 自動選択
                    if (templates.length > 0) select.value = templates[0].id;
                } catch (e) { console.error(e); }
            }
            
            function toggleWizCustomerType() {
                const type = document.querySelector('input[name="wiz_customer_type"]:checked')?.value;
                document.getElementById('wizExistingCustomer').classList.toggle('hidden', type !== 'existing');
                document.getElementById('wizNewCustomer').classList.toggle('hidden', type !== 'new');
            }
            
            function updateWizardUI() {
                // ステップ表示
                for (let i = 1; i <= 3; i++) {
                    const step = document.getElementById('wizardStep-' + i);
                    const ind = document.getElementById('stepInd-' + i);
                    step.classList.toggle('active', i === wizardStep);
                    
                    if (i < wizardStep) { ind.className = 'wizard-indicator completed w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold'; ind.innerHTML = '<i class="fas fa-check"></i>'; }
                    else if (i === wizardStep) { ind.className = 'wizard-indicator current w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold'; ind.textContent = i; }
                    else { ind.className = 'wizard-indicator pending w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold'; ind.textContent = i; }
                    
                    if (i < 3) {
                        const line = document.getElementById('stepLine-' + i);
                        line.className = i < wizardStep ? 'wizard-line completed w-16 h-0.5 mx-2' : 'wizard-line pending w-16 h-0.5 mx-2';
                    }
                }
                
                // ボタン
                document.getElementById('wizBackBtn').classList.toggle('hidden', wizardStep === 1);
                document.getElementById('wizNextBtn').classList.toggle('hidden', wizardStep === 3);
                document.getElementById('wizSubmitBtn').classList.toggle('hidden', wizardStep !== 3);
            }
            
            function wizardNext() {
                // バリデーション
                if (wizardStep === 1) {
                    const type = document.querySelector('input[name="wiz_customer_type"]:checked')?.value;
                    if (type === 'existing' && !document.getElementById('wizClientSelect').value) {
                        showToast('顧客を選択してください', 'warning'); return;
                    }
                    if (type === 'new' && !document.getElementById('wizNewName').value) {
                        showToast('顧客名を入力してください', 'warning'); return;
                    }
                }
                if (wizardStep === 2 && !wizSelectedSubsidyId) {
                    showToast('申請種別を選択してください', 'warning'); return;
                }
                
                wizardStep = Math.min(wizardStep + 1, 3);
                updateWizardUI();
            }
            
            function wizardBack() {
                wizardStep = Math.max(wizardStep - 1, 1);
                updateWizardUI();
            }
            
            async function submitNewCase() {
                const submitBtn = document.getElementById('wizSubmitBtn');
                setButtonLoading(submitBtn, true);
                try {
                    const type = document.querySelector('input[name="wiz_customer_type"]:checked')?.value;
                    let clientId;
                    
                    if (type === 'existing') {
                        clientId = document.getElementById('wizClientSelect').value;
                    } else {
                        // 新規顧客作成
                        const clientRes = await axios.post('/api/clients', {
                            name: document.getElementById('wizNewName').value,
                            email: document.getElementById('wizNewEmail').value || null,
                            phone: document.getElementById('wizNewPhone').value || null,
                            address: document.getElementById('wizNewAddress').value || null
                        });
                        clientId = clientRes.data.id;
                    }
                    
                    // 案件作成
                    const caseData = {
                        client_id: clientId,
                        subsidy_type_id: wizSelectedSubsidyId,
                        assigned_to: document.getElementById('wizAssignedTo').value || null,
                        application_end_date: document.getElementById('wizDeadline').value || null,
                        pipeline_template_id: document.getElementById('wizPipeline').value ? parseInt(document.getElementById('wizPipeline').value) : null,
                        deposit_required: document.getElementById('wizDepositRequired').checked ? 1 : 0,
                        deposit_amount: parseInt(document.getElementById('wizDepositAmount')?.value) || 0,
                        success_fee_enabled: document.getElementById('wizSuccessFee').checked ? 1 : 0,
                        success_fee_rate: parseFloat(document.getElementById('wizSuccessRate')?.value) || 0,
                        success_fee_amount: parseInt(document.getElementById('wizSuccessAmount')?.value) || 0,
                        notes: document.getElementById('wizNotes').value || null
                    };
                    
                    const res = await axios.post('/api/cases', caseData);
                    closeNewCaseWizard();
                    // 成功メッセージ後にページをリロード
                    const caseNum = res.data.case_number || '';
                    const caseId = res.data.id || res.data.case_id;
                    if (caseId && confirm('案件を登録しました（番号: ' + caseNum + '）\\n案件詳細ページを開きますか？')) {
                        window.location.href = '/case/' + caseId;
                    } else {
                        loadCases();
                    }
                } catch (e) {
                    showToast('登録に失敗しました: ' + (e.response?.data?.error || e.message), 'error');
                    console.error(e);
                } finally {
                    setButtonLoading(submitBtn, false);
                }
            }
            
            // チェックボックス連動
            document.getElementById('wizDepositRequired')?.addEventListener('change', function() {
                document.getElementById('wizDepositFields').classList.toggle('hidden', !this.checked);
            });
            document.getElementById('wizSuccessFee')?.addEventListener('change', function() {
                document.getElementById('wizSuccessFeeFields').classList.toggle('hidden', !this.checked);
            });
            
            // ESCキーでウィザードモーダルを閉じる
            registerEscClose(['newCaseWizard', 'quickViewModal']);
            
            // ======= 初期化 =======
            const savedView = localStorage.getItem('cases_view') || 'kanban';
            if (savedView !== 'kanban') setView(savedView);
            else loadCases();
            
            // openNewCaseパラメータ
            if ('${openNewCase ? 'true' : ''}' === 'true') {
                setTimeout(openNewCaseWizard, 500);
            }
        </script>
    </body>
    </html>
  `)
  } catch (error: any) {
    console.error('Cases page error:', error)
    return c.text('Error: ' + (error.message || 'Unknown error'), 500)
  }
})

export default routes
