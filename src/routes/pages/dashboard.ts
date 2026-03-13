// ダッシュボード - 概要ページ（リニューアル版）
// KPI、通知、アラート、クイックアクションのみ。案件一覧は /cases に統合。
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import { modalStyles, modalScripts } from '../../templates/modal'
import type { AppEnv } from '../../types'

const routes = new Hono<AppEnv>()

routes.get('/', async (c) => {
  const tenantOrgId = c.get('tenantOrgId') || 1;
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ダッシュボード - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
            ${modalStyles}
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .fade-in { animation: fadeInUp 0.4s ease forwards; }
            .fade-in-delay-1 { animation-delay: 0.1s; opacity: 0; }
            .fade-in-delay-2 { animation-delay: 0.2s; opacity: 0; }
            .fade-in-delay-3 { animation-delay: 0.3s; opacity: 0; }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex">
            ${generateSidebar('dashboard')}
            
            <main class="flex-1 min-h-screen lg:ml-56">
                <header class="bg-white border-b sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 lg:px-6 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <div>
                                <h2 class="text-lg font-bold text-gray-800">ダッシュボード</h2>
                                <p class="text-xs text-gray-500" id="currentDate"></p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <button onclick="loadAllData()" class="text-gray-400 hover:text-gray-600 transition" title="更新">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                            <a href="/cases" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                                <i class="fas fa-plus mr-1"></i>新規案件
                            </a>
                        </div>
                    </div>
                </header>
                
                <div class="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
                    
                    <!-- システムお知らせ -->
                    <div id="announcementsSection" class="hidden">
                        <div id="announcementsList" class="space-y-2"></div>
                    </div>
                    
                    <!-- KPI カード（コンパクト4列） -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-in">
                        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-medium text-gray-500">進行中</span>
                                <div class="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-briefcase text-blue-500 text-sm"></i>
                                </div>
                            </div>
                            <div class="text-2xl font-bold text-gray-900" id="kpi-active">-</div>
                            <div class="text-xs text-gray-400 mt-1">件の案件</div>
                        </div>
                        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-medium text-gray-500">今月完了</span>
                                <div class="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-check-circle text-green-500 text-sm"></i>
                                </div>
                            </div>
                            <div class="text-2xl font-bold text-gray-900" id="kpi-completed">-</div>
                            <div class="text-xs text-gray-400 mt-1">件完了</div>
                        </div>
                        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-medium text-gray-500">今月採択額</span>
                                <div class="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-coins text-purple-500 text-sm"></i>
                                </div>
                            </div>
                            <div class="text-2xl font-bold text-gray-900" id="kpi-amount">-</div>
                            <div class="text-xs text-gray-400 mt-1" id="kpi-amount-sub"></div>
                        </div>
                        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-medium text-gray-500">見込み</span>
                                <div class="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-lightbulb text-yellow-500 text-sm"></i>
                                </div>
                            </div>
                            <div class="text-2xl font-bold text-gray-900" id="kpi-inquiry">-</div>
                            <div class="text-xs text-gray-400 mt-1">件の見込み</div>
                        </div>
                    </div>

                    <!-- ステータスバー（クリックで案件一覧へ） -->
                    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 fade-in fade-in-delay-1">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-sm font-bold text-gray-700">案件ステータス</h3>
                            <a href="/cases" class="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                全件表示 <i class="fas fa-arrow-right ml-1"></i>
                            </a>
                        </div>
                        <div class="grid grid-cols-3 md:grid-cols-6 gap-2" id="statusBar">
                            <a href="/cases?status=inquiry" class="text-center p-2 rounded-lg bg-yellow-50 hover:bg-yellow-100 transition cursor-pointer group">
                                <div class="text-lg font-bold text-yellow-600 group-hover:scale-110 transition-transform" id="status-inquiry">-</div>
                                <div class="text-xs text-gray-500">見込み</div>
                            </a>
                            <a href="/cases?status=preparing" class="text-center p-2 rounded-lg bg-orange-50 hover:bg-orange-100 transition cursor-pointer group">
                                <div class="text-lg font-bold text-orange-600 group-hover:scale-110 transition-transform" id="status-preparing">-</div>
                                <div class="text-xs text-gray-500">書類準備</div>
                            </a>
                            <a href="/cases?status=applying" class="text-center p-2 rounded-lg bg-purple-50 hover:bg-purple-100 transition cursor-pointer group">
                                <div class="text-lg font-bold text-purple-600 group-hover:scale-110 transition-transform" id="status-applying">-</div>
                                <div class="text-xs text-gray-500">申請中</div>
                            </a>
                            <a href="/cases?status=adopted" class="text-center p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition cursor-pointer group">
                                <div class="text-lg font-bold text-blue-600 group-hover:scale-110 transition-transform" id="status-adopted">-</div>
                                <div class="text-xs text-gray-500">採択</div>
                            </a>
                            <a href="/cases?status=rejected" class="text-center p-2 rounded-lg bg-red-50 hover:bg-red-100 transition cursor-pointer group">
                                <div class="text-lg font-bold text-red-600 group-hover:scale-110 transition-transform" id="status-rejected">-</div>
                                <div class="text-xs text-gray-500">不採択</div>
                            </a>
                            <a href="/cases?archived=true" class="text-center p-2 rounded-lg bg-green-50 hover:bg-green-100 transition cursor-pointer group">
                                <div class="text-lg font-bold text-green-600 group-hover:scale-110 transition-transform" id="status-archived">-</div>
                                <div class="text-xs text-gray-500">完了</div>
                            </a>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- 左側：通知 + アラート -->
                        <div class="space-y-6">
                            <!-- 未対応通知 -->
                            <div id="notificationSection" class="hidden bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in fade-in-delay-2">
                                <div class="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                                    <h3 class="text-sm font-bold text-blue-800 flex items-center gap-2">
                                        <i class="fas fa-bell"></i>未対応の通知
                                    </h3>
                                </div>
                                <div class="p-4">
                                    <div class="grid grid-cols-3 gap-3" id="notificationCards">
                                        <button onclick="openNotificationsModal('new_message')" class="p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition text-left">
                                            <div class="text-xs text-gray-500 mb-1">未読メッセージ</div>
                                            <div class="text-xl font-bold text-blue-600" id="notify-message">0</div>
                                        </button>
                                        <button onclick="openNotificationsModal('document_upload')" class="p-3 rounded-lg bg-green-50 hover:bg-green-100 transition text-left">
                                            <div class="text-xs text-gray-500 mb-1">書類UP</div>
                                            <div class="text-xl font-bold text-green-600" id="notify-document">0</div>
                                        </button>
                                        <button onclick="openNotificationsModal('payment_report')" class="p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 transition text-left">
                                            <div class="text-xs text-gray-500 mb-1">入金報告</div>
                                            <div class="text-xl font-bold text-yellow-600" id="notify-payment">0</div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 期限アラート -->
                            <div id="deadlineSection" class="hidden bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden fade-in fade-in-delay-2">
                                <div class="p-4 border-b bg-gradient-to-r from-red-50 to-orange-50">
                                    <h3 class="text-sm font-bold text-red-700 flex items-center gap-2">
                                        <i class="fas fa-exclamation-triangle"></i>期限が近い案件
                                    </h3>
                                </div>
                                <div id="deadlineList" class="divide-y divide-gray-100"></div>
                            </div>
                            
                            <!-- 最近の活動 -->
                            <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in fade-in-delay-3">
                                <div class="p-4 border-b">
                                    <h3 class="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <i class="fas fa-history text-gray-400"></i>最近の活動
                                    </h3>
                                </div>
                                <div id="recentActivity" class="p-4 space-y-3 max-h-64 overflow-y-auto">
                                    <div class="animate-pulse space-y-3">
                                        <div class="flex items-center gap-2"><div class="w-6 h-6 bg-gray-200 rounded-full"></div><div class="h-3 bg-gray-200 rounded w-3/4"></div></div>
                                        <div class="flex items-center gap-2"><div class="w-6 h-6 bg-gray-200 rounded-full"></div><div class="h-3 bg-gray-200 rounded w-2/3"></div></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 右側：担当者別 + クイックアクション -->
                        <div class="space-y-6">
                            <!-- 担当者別案件数 -->
                            <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in fade-in-delay-2">
                                <div class="p-4 border-b">
                                    <h3 class="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <i class="fas fa-users text-gray-400"></i>担当者別案件数
                                    </h3>
                                </div>
                                <div id="assigneeStats" class="p-4 space-y-2 max-h-48 overflow-y-auto">
                                    <div class="animate-pulse space-y-2">
                                        <div class="h-10 bg-gray-200 rounded"></div>
                                        <div class="h-10 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- クイックアクション -->
                            <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 fade-in fade-in-delay-3">
                                <h3 class="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    <i class="fas fa-bolt text-gray-400"></i>クイックアクション
                                </h3>
                                <div class="grid grid-cols-2 gap-2">
                                    <a href="/cases" class="flex items-center gap-2 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition text-sm text-blue-700 font-medium">
                                        <i class="fas fa-folder-open w-5 text-center"></i>案件一覧
                                    </a>
                                    <a href="/clients" class="flex items-center gap-2 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition text-sm text-gray-700 font-medium">
                                        <i class="fas fa-users w-5 text-center"></i>顧客一覧
                                    </a>
                                    <a href="/subsidy-types" class="flex items-center gap-2 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition text-sm text-gray-700 font-medium">
                                        <i class="fas fa-list w-5 text-center"></i>申請種別
                                    </a>
                                    <a href="/admin/statistics" class="flex items-center gap-2 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition text-sm text-gray-700 font-medium">
                                        <i class="fas fa-chart-line w-5 text-center"></i>統計
                                    </a>
                                </div>
                            </div>
                            
                            <!-- 今週のToDo -->
                            <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in fade-in-delay-3">
                                <div class="p-4 border-b">
                                    <h3 class="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <i class="fas fa-calendar-week text-gray-400"></i>今週のToDo
                                    </h3>
                                </div>
                                <div id="weeklyTodos" class="p-4 space-y-2 max-h-48 overflow-y-auto">
                                    <div class="animate-pulse space-y-2">
                                        <div class="h-8 bg-gray-200 rounded"></div>
                                        <div class="h-8 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <!-- 通知モーダル -->
        <div id="notificationsModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold">通知</h3>
                    <div class="flex items-center gap-2">
                        <button onclick="markAllNotificationsRead()" class="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded hover:bg-gray-200">
                            <i class="fas fa-check-double mr-1"></i>すべて既読
                        </button>
                        <button onclick="closeNotificationsModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div id="notificationsList" class="space-y-3">
                    <div class="text-center py-4 text-gray-500">読み込み中...</div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${modalScripts}
            
            window.currentOrgId = ${tenantOrgId};
            
            // 日付表示
            const now = new Date();
            const dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
            document.getElementById('currentDate').textContent = dateStr;
            
            // 認証
            const token = localStorage.getItem('admin_token');
            if (!token) window.location.href = '/login';
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
            
            // 管理者名表示
            const adminName = localStorage.getItem('admin_name');
            const sidebarName = document.getElementById('sidebarAdminName');
            if (sidebarName && adminName) sidebarName.textContent = adminName;
            
            // ======= メインデータロード =======
            async function loadAllData() {
                await Promise.all([
                    loadCaseStats(),
                    loadNotificationSummary(),
                    loadDeadlineAlerts(),
                    loadRecentActivity(),
                    loadAnnouncements()
                ]);
            }
            
            // ステータス別件数と KPI
            async function loadCaseStats() {
                try {
                    const [casesRes, statsRes] = await Promise.all([
                        axios.get('/api/cases'),
                        axios.get('/api/dashboard/stats').catch(() => ({ data: {} }))
                    ]);
                    
                    const cases = casesRes.data || [];
                    const stats = statsRes.data || {};
                    
                    // ステータス集計
                    const counts = { inquiry: 0, preparing: 0, applying: 0, adopted: 0, rejected: 0, archived: 0 };
                    cases.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });
                    
                    Object.keys(counts).forEach(k => {
                        const el = document.getElementById('status-' + k);
                        if (el) el.textContent = counts[k];
                    });
                    
                    // KPI
                    const active = cases.filter(c => !['rejected', 'completed', 'archived'].includes(c.status) && !c.is_archived).length;
                    document.getElementById('kpi-active').textContent = active;
                    document.getElementById('kpi-inquiry').textContent = counts.inquiry;
                    
                    // アーカイブ件数
                    if (stats.monthly_cases) {
                        document.getElementById('status-archived').textContent = stats.monthly_cases.total_archived || 0;
                        document.getElementById('kpi-completed').textContent = stats.monthly_cases.completed || 0;
                        
                        const amount = stats.monthly_cases.approved_amount || 0;
                        if (amount >= 10000) {
                            document.getElementById('kpi-amount').textContent = '¥' + Math.round(amount / 10000) + '万';
                        } else if (amount > 0) {
                            document.getElementById('kpi-amount').textContent = '¥' + amount.toLocaleString();
                        } else {
                            document.getElementById('kpi-amount').textContent = '¥0';
                        }
                    }
                    
                    // 担当者別
                    renderAssigneeStats(cases);
                    
                    // 今週のToDo
                    renderWeeklyTodos(cases);
                    
                    // 期限アラート
                    renderDeadlineAlerts(cases);
                    
                } catch (error) {
                    console.error('Error loading case stats:', error);
                }
            }
            
            // 担当者別
            function renderAssigneeStats(cases) {
                const container = document.getElementById('assigneeStats');
                const activeCases = cases.filter(c => !['completed', 'rejected', 'archived'].includes(c.status) && !c.is_archived);
                const byAssignee = {};
                activeCases.forEach(c => {
                    const key = c.assigned_to_name || c.assigned_to || '未割り当て';
                    byAssignee[key] = (byAssignee[key] || 0) + 1;
                });
                
                const entries = Object.entries(byAssignee).sort((a, b) => b[1] - a[1]);
                if (entries.length === 0) {
                    container.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">進行中の案件はありません</div>';
                    return;
                }
                
                container.innerHTML = entries.map(([name, count]) => \`
                    <div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                        <div class="flex items-center gap-2">
                            <div class="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <i class="fas fa-user text-xs"></i>
                            </div>
                            <span class="text-sm font-medium text-gray-700">\${name}</span>
                        </div>
                        <span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">\${count}件</span>
                    </div>
                \`).join('');
            }
            
            // 今週のToDo
            function renderWeeklyTodos(cases) {
                const container = document.getElementById('weeklyTodos');
                const today = new Date(); today.setHours(0,0,0,0);
                const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
                
                const deadlines = cases.filter(c => {
                    if (['completed', 'rejected'].includes(c.status) || c.is_archived) return false;
                    if (!c.application_end_date) return false;
                    const d = new Date(c.application_end_date);
                    return d >= today && d <= endOfWeek;
                }).sort((a, b) => new Date(a.application_end_date) - new Date(b.application_end_date));
                
                if (deadlines.length === 0) {
                    container.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">今週の期限はありません</div>';
                    return;
                }
                
                container.innerHTML = deadlines.slice(0, 5).map(c => {
                    const d = new Date(c.application_end_date);
                    const diff = Math.ceil((d - today) / (1000*60*60*24));
                    const urgency = diff <= 2 ? 'text-red-600 font-bold' : 'text-orange-600';
                    return \`
                        <a href="/case/\${c.id}" class="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition">
                            <span class="text-sm text-gray-700 truncate flex-1">\${c.client_name || '未設定'}</span>
                            <span class="text-xs \${urgency} flex-shrink-0">\${diff === 0 ? '今日!' : 'あと' + diff + '日'}</span>
                        </a>
                    \`;
                }).join('');
            }
            
            // 期限アラート
            function renderDeadlineAlerts(cases) {
                const section = document.getElementById('deadlineSection');
                const container = document.getElementById('deadlineList');
                const today = new Date(); today.setHours(0,0,0,0);
                
                const urgent = cases.filter(c => {
                    if (['completed', 'rejected'].includes(c.status) || c.is_archived) return false;
                    if (!c.application_end_date) return false;
                    const d = new Date(c.application_end_date);
                    const diff = Math.ceil((d - today) / (1000*60*60*24));
                    return diff >= 0 && diff <= 7;
                }).sort((a, b) => new Date(a.application_end_date) - new Date(b.application_end_date));
                
                if (urgent.length === 0) { section.classList.add('hidden'); return; }
                section.classList.remove('hidden');
                
                container.innerHTML = urgent.slice(0, 5).map(c => {
                    const d = new Date(c.application_end_date);
                    const diff = Math.ceil((d - today) / (1000*60*60*24));
                    const badge = diff <= 3 
                        ? '<span class="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold animate-pulse">あと' + diff + '日</span>'
                        : '<span class="bg-orange-500 text-white px-2 py-0.5 rounded text-xs font-bold">あと' + diff + '日</span>';
                    return \`
                        <a href="/case/\${c.id}" class="flex items-center justify-between p-3 hover:bg-red-50 transition">
                            <div class="flex items-center gap-3">
                                \${badge}
                                <div>
                                    <div class="font-medium text-sm text-gray-800">\${c.client_name || '未設定'}</div>
                                    <div class="text-xs text-gray-500">\${c.subsidy_type_name || ''}</div>
                                </div>
                            </div>
                            <i class="fas fa-chevron-right text-gray-300"></i>
                        </a>
                    \`;
                }).join('');
            }
            
            // 通知サマリー
            async function loadNotificationSummary() {
                try {
                    const res = await axios.get('/api/admin/notifications/summary');
                    const s = res.data;
                    document.getElementById('notify-message').textContent = s.new_message || 0;
                    document.getElementById('notify-document').textContent = s.document_upload || 0;
                    document.getElementById('notify-payment').textContent = s.payment_report || 0;
                    
                    const total = (s.new_message || 0) + (s.document_upload || 0) + (s.payment_report || 0);
                    document.getElementById('notificationSection').classList.toggle('hidden', total === 0);
                } catch (e) { console.error('Notification error:', e); }
            }
            
            // 期限アラート (API)
            async function loadDeadlineAlerts() {
                // Already handled in loadCaseStats
            }
            
            // 最近の活動
            async function loadRecentActivity() {
                try {
                    const res = await axios.get('/api/recent-activity');
                    const activities = res.data || [];
                    const container = document.getElementById('recentActivity');
                    
                    if (activities.length === 0) {
                        container.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">最近の活動はありません</div>';
                        return;
                    }
                    
                    const icons = {
                        'new_client': { icon: 'fa-user-plus', color: 'text-green-500', bg: 'bg-green-100' },
                        'document_upload': { icon: 'fa-upload', color: 'text-blue-500', bg: 'bg-blue-100' },
                        'status_change': { icon: 'fa-exchange-alt', color: 'text-purple-500', bg: 'bg-purple-100' },
                        'communication': { icon: 'fa-comment', color: 'text-yellow-500', bg: 'bg-yellow-100' },
                        'document_approved': { icon: 'fa-check-circle', color: 'text-green-500', bg: 'bg-green-100' },
                        'document_rejected': { icon: 'fa-times-circle', color: 'text-red-500', bg: 'bg-red-100' }
                    };
                    
                    container.innerHTML = activities.slice(0, 8).map(a => {
                        const s = icons[a.type] || { icon: 'fa-circle', color: 'text-gray-500', bg: 'bg-gray-100' };
                        const timeAgo = formatTimeAgo(a.created_at);
                        return \`
                            <div class="flex items-center gap-2">
                                <div class="w-6 h-6 rounded-full \${s.bg} flex items-center justify-center flex-shrink-0">
                                    <i class="fas \${s.icon} \${s.color}" style="font-size:9px"></i>
                                </div>
                                <div class="flex-1 min-w-0 text-xs text-gray-600 truncate">\${a.description}</div>
                                <span class="text-xs text-gray-400 flex-shrink-0">\${timeAgo}</span>
                            </div>
                        \`;
                    }).join('');
                } catch (e) {
                    console.error('Activity error:', e);
                    document.getElementById('recentActivity').innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">読み込みエラー</div>';
                }
            }
            
            // お知らせ
            async function loadAnnouncements() {
                try {
                    const orgId = window.currentOrgId || 1;
                    const res = await axios.get('/api/organizations/' + orgId + '/announcements');
                    const announcements = res.data || [];
                    const section = document.getElementById('announcementsSection');
                    const container = document.getElementById('announcementsList');
                    
                    if (announcements.length === 0) { section.classList.add('hidden'); return; }
                    section.classList.remove('hidden');
                    
                    const styles = { info: 'bg-blue-50 border-blue-200 text-blue-800', warning: 'bg-yellow-50 border-yellow-200 text-yellow-800', error: 'bg-red-50 border-red-200 text-red-800', success: 'bg-green-50 border-green-200 text-green-800' };
                    const iconMap = { info: 'fa-info-circle text-blue-500', warning: 'fa-exclamation-triangle text-yellow-500', error: 'fa-times-circle text-red-500', success: 'fa-check-circle text-green-500' };
                    
                    container.innerHTML = announcements.map(ann => {
                        const style = styles[ann.type] || styles.info;
                        const icon = iconMap[ann.type] || iconMap.info;
                        return \`
                            <div class="rounded-xl border p-3 \${style} \${ann.is_read ? 'opacity-70' : ''}">
                                <div class="flex items-start gap-2">
                                    <i class="fas \${icon} mt-0.5"></i>
                                    <div class="flex-1">
                                        <div class="flex items-center justify-between">
                                            <h4 class="font-bold text-sm">\${escapeHtml(ann.title)}</h4>
                                            <span class="text-xs opacity-70">\${formatDate(ann.created_at)}</span>
                                        </div>
                                        <p class="text-xs mt-1">\${escapeHtml(ann.content)}</p>
                                        \${!ann.is_read ? '<button onclick="markAnnouncementRead(' + ann.id + ')" class="text-xs mt-1 underline">既読</button>' : ''}
                                    </div>
                                </div>
                            </div>
                        \`;
                    }).join('');
                } catch (e) { console.error('Announcements error:', e); }
            }
            
            async function markAnnouncementRead(id) {
                try {
                    const orgId = window.currentOrgId || 1;
                    await axios.post('/api/announcements/' + id + '/read', { organization_id: orgId });
                    loadAnnouncements();
                } catch (e) { console.error(e); }
            }
            
            // 通知モーダル
            let currentNotificationFilter = null;
            
            function openNotificationsModal(filterType = null) {
                document.getElementById('notificationsModal').classList.remove('hidden');
                loadNotificationsWithType(filterType);
            }
            
            function closeNotificationsModal() {
                document.getElementById('notificationsModal').classList.add('hidden');
                loadNotificationSummary();
            }
            
            async function loadNotificationsWithType(filterType) {
                currentNotificationFilter = filterType;
                try {
                    const res = await axios.get('/api/admin/notifications?unread_only=true');
                    let notifications = res.data;
                    if (filterType) notifications = notifications.filter(n => n.notification_type === filterType);
                    
                    const container = document.getElementById('notificationsList');
                    
                    if (notifications.length === 0) {
                        container.innerHTML = '<div class="text-center py-4 text-gray-500">未読の通知はありません</div>';
                        return;
                    }
                    
                    const typeIcon = { new_message: '<i class="fas fa-envelope text-blue-500"></i>', document_upload: '<i class="fas fa-file-upload text-green-500"></i>', payment_report: '<i class="fas fa-yen-sign text-yellow-500"></i>' };
                    const typeColor = { new_message: 'border-blue-200 bg-blue-50', document_upload: 'border-green-200 bg-green-50', payment_report: 'border-yellow-200 bg-yellow-50' };
                    
                    container.innerHTML = notifications.map(n => \`
                        <div class="border rounded-lg p-3 \${typeColor[n.notification_type] || 'border-gray-200 bg-gray-50'}">
                            <div class="flex justify-between items-start">
                                <div class="flex items-center gap-2">
                                    \${typeIcon[n.notification_type] || '<i class="fas fa-bell text-gray-500"></i>'}
                                    <h4 class="font-medium text-sm">\${n.title}</h4>
                                </div>
                                <button onclick="markNotificationRead(\${n.id})" class="text-xs text-gray-500 hover:text-gray-700">既読</button>
                            </div>
                            <p class="text-xs text-gray-600 mt-1">\${n.message}</p>
                        </div>
                    \`).join('');
                } catch (e) { console.error(e); }
            }
            
            async function markNotificationRead(id) {
                try {
                    await axios.put('/api/admin/notifications/' + id + '/read', { read_by: localStorage.getItem('admin_name') || 'admin' });
                    loadNotificationSummary();
                    if (!document.getElementById('notificationsModal').classList.contains('hidden')) {
                        loadNotificationsWithType(currentNotificationFilter);
                    }
                } catch (e) { console.error(e); }
            }
            
            async function markAllNotificationsRead() {
                try {
                    await axios.put('/api/admin/notifications/read-all', { notification_type: currentNotificationFilter, read_by: localStorage.getItem('admin_name') || 'admin' });
                    loadNotificationsWithType(currentNotificationFilter);
                    loadNotificationSummary();
                } catch (e) { console.error(e); }
            }
            
            // formatTimeAgo, formatDate, escapeHtml は sidebarScripts 共通版を使用
            
            // ウェルカムモーダル
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('welcome') === 'true') {
                setTimeout(() => {
                    showTrialWelcomeModal();
                    history.replaceState({}, document.title, window.location.pathname);
                }, 800);
            }
            
            // openNewCase パラメータは案件一覧にリダイレクト
            if (urlParams.get('openNewCase')) {
                const clientId = urlParams.get('client_id');
                window.location.href = '/cases' + (clientId ? '?newCase=true&client_id=' + clientId : '?newCase=true');
            }
            
            function showTrialWelcomeModal() {
                const modal = document.createElement('div');
                modal.id = 'trialWelcomeModal';
                modal.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4';
                modal.innerHTML = \`
                    <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                        <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white text-center">
                            <div class="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-rocket text-4xl"></i>
                            </div>
                            <h2 class="text-2xl font-bold mb-2">申請らくらく君へようこそ！</h2>
                            <p class="text-blue-100">14日間の無料トライアルが開始されました</p>
                        </div>
                        <div class="p-6">
                            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                                <ul class="space-y-2 text-sm text-blue-700">
                                    <li class="flex items-center gap-2"><i class="fas fa-check-circle text-green-500"></i><strong>1件分の案件</strong>を無料でお試し</li>
                                    <li class="flex items-center gap-2"><i class="fas fa-check-circle text-green-500"></i>すべての機能を制限なく利用可能</li>
                                    <li class="flex items-center gap-2"><i class="fas fa-check-circle text-green-500"></i>見込み客の登録は無制限</li>
                                </ul>
                            </div>
                            <div class="flex gap-3">
                                <a href="/admin/subscription" class="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-center font-medium">
                                    <i class="fas fa-ticket-alt mr-2"></i>プラン確認
                                </a>
                                <button onclick="document.getElementById('trialWelcomeModal').remove()" class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold">
                                    <i class="fas fa-play-circle mr-2"></i>始める
                                </button>
                            </div>
                        </div>
                    </div>
                \`;
                document.body.appendChild(modal);
                modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            }
            
            ${sidebarScripts}
            
            // 初期化
            loadAllData();
        </script>
    </body>
    </html>
  `)
})

export default routes
