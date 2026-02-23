// 共通サイドバーテンプレート - リニューアル版
// 5項目以内のシンプルなナビゲーション

export function generateSidebar(activePage: string = '') {
  const isActive = (page: string) => activePage === page ? 'active' : '';
  const isGroupActive = (pages: string[]) => pages.includes(activePage) ? 'active' : '';
  
  return `
    <aside id="sidebar" class="fixed inset-y-0 left-0 w-56 bg-gradient-to-b from-slate-900 to-slate-800 text-white transform -translate-x-full lg:translate-x-0 lg:static transition-transform duration-300 z-50 flex flex-col">
        <div class="p-4 border-b border-white/10 flex-shrink-0">
            <a href="/" class="flex items-center gap-3">
                <div class="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <i class="fas fa-file-invoice-dollar text-white text-sm"></i>
                </div>
                <span class="text-base font-bold tracking-tight">申請らくらく君</span>
            </a>
        </div>
        
        <nav class="p-3 space-y-1 flex-1 overflow-y-auto">
            <!-- 1. ダッシュボード -->
            <a href="/" class="sidebar-link ${isActive('dashboard')} flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium">
                <i class="fas fa-chart-pie w-5 text-center text-slate-400"></i>
                <span>ダッシュボード</span>
            </a>
            
            <!-- 2. 案件管理（メイン機能） -->
            <a href="/cases" class="sidebar-link ${isGroupActive(['cases', 'pipeline'])} flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium">
                <i class="fas fa-folder-open w-5 text-center text-slate-400"></i>
                <span>案件管理</span>
            </a>
            
            <!-- 3. 顧客一覧 -->
            <a href="/clients" class="sidebar-link ${isGroupActive(['clients'])} flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium">
                <i class="fas fa-users w-5 text-center text-slate-400"></i>
                <span>顧客一覧</span>
            </a>
            
            <!-- 4. 申請種別 -->
            <a href="/subsidy-types" class="sidebar-link ${isGroupActive(['subsidy-types', 'guidelines', 'pipelines', 'statistics'])} flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium">
                <i class="fas fa-list-alt w-5 text-center text-slate-400"></i>
                <span>申請種別</span>
            </a>

            <!-- セパレーター -->
            <div class="my-3 border-t border-white/10"></div>

            <!-- 5. 設定（管理者のみ表示されるサブ項目あり） -->
            <div class="space-y-0.5">
                <div class="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">管理</div>
                <a href="/admin/settings" id="sidebarSettingsLink" class="sidebar-link ${isActive('settings')} hidden flex items-center gap-3 px-3 py-2 rounded-lg text-sm">
                    <i class="fas fa-cog w-5 text-center text-slate-400"></i>
                    <span>設定</span>
                </a>
                <a href="/admin/users" id="sidebarEmployeeLink" class="sidebar-link ${isActive('users')} hidden flex items-center gap-3 px-3 py-2 rounded-lg text-sm">
                    <i class="fas fa-users-cog w-5 text-center text-slate-400"></i>
                    <span>従業員管理</span>
                </a>
                <a href="/admin/subscription" id="sidebarSubscriptionLink" class="sidebar-link ${isActive('subscription')} hidden flex items-center gap-3 px-3 py-2 rounded-lg text-sm">
                    <i class="fas fa-ticket-alt w-5 text-center text-slate-400"></i>
                    <span>プラン</span>
                    <span id="slotsBadge" class="ml-auto bg-slate-600 text-white text-xs px-1.5 py-0.5 rounded-full">...</span>
                </a>
                <a href="/admin/payments" id="sidebarPaymentsLink" class="sidebar-link ${isActive('payments')} hidden flex items-center gap-3 px-3 py-2 rounded-lg text-sm">
                    <i class="fas fa-credit-card w-5 text-center text-slate-400"></i>
                    <span>支払い</span>
                    <span id="pendingPaymentsBadge" class="hidden ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">0</span>
                </a>
                <a href="/admin/backup" id="sidebarBackupLink" class="sidebar-link ${isActive('backup')} hidden flex items-center gap-3 px-3 py-2 rounded-lg text-sm">
                    <i class="fas fa-database w-5 text-center text-slate-400"></i>
                    <span>バックアップ</span>
                </a>
            </div>
        </nav>
        
        <!-- 法的リンク（コンパクト） -->
        <div class="px-4 py-2 border-t border-white/10">
            <div class="flex gap-2 text-[10px] text-slate-500">
                <a href="/terms" target="_blank" class="hover:text-slate-300">利用規約</a>
                <span>|</span>
                <a href="/privacy-policy" target="_blank" class="hover:text-slate-300">個人情報</a>
                <span>|</span>
                <a href="/master/terms" target="_blank" class="hover:text-slate-300">プラットフォーム規約</a>
            </div>
        </div>
        
        <!-- ユーザー情報 -->
        <div class="p-3 border-t border-white/10 bg-slate-900/50">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm">
                    <i class="fas fa-user"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p id="sidebarAdminName" class="text-sm font-medium truncate">管理者</p>
                </div>
                <button onclick="logout()" class="text-slate-400 hover:text-white transition-colors" title="ログアウト">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        </div>
    </aside>
    
    <!-- サイドバーオーバーレイ（モバイル用） -->
    <div id="sidebarOverlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden lg:hidden"></div>
  `;
}

// 共通のサイドバー用スタイル
export const sidebarStyles = `
    .sidebar-link { 
        transition: all 0.15s ease; 
        color: #94a3b8;
    }
    .sidebar-link:hover { 
        background-color: rgba(255,255,255,0.08); 
        color: #e2e8f0;
    }
    .sidebar-link:hover i {
        color: #e2e8f0;
    }
    .sidebar-link.active { 
        background-color: rgba(59, 130, 246, 0.15); 
        color: #60a5fa;
    }
    .sidebar-link.active i {
        color: #60a5fa;
    }
`;

// 共通のサイドバー用JavaScript
export const sidebarScripts = `
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
            localStorage.removeItem('admin_username');
            localStorage.removeItem('admin_role');
            window.location.href = '/login';
        }
    }
    
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
    }
    
    if (!checkAuth()) {}
    
    const sidebarAdminName = document.getElementById('sidebarAdminName');
    if (sidebarAdminName) {
        sidebarAdminName.textContent = localStorage.getItem('admin_name') || '管理者';
    }
    
    if (localStorage.getItem('admin_role') === 'admin') {
        const employeeLink = document.getElementById('sidebarEmployeeLink');
        const paymentsLink = document.getElementById('sidebarPaymentsLink');
        const settingsLink = document.getElementById('sidebarSettingsLink');
        const backupLink = document.getElementById('sidebarBackupLink');
        const subscriptionLink = document.getElementById('sidebarSubscriptionLink');
        if (employeeLink) employeeLink.classList.remove('hidden');
        if (paymentsLink) paymentsLink.classList.remove('hidden');
        if (settingsLink) settingsLink.classList.remove('hidden');
        if (backupLink) backupLink.classList.remove('hidden');
        if (subscriptionLink) subscriptionLink.classList.remove('hidden');
    }
    
    if (typeof axios !== 'undefined') {
        const sidebarToken = localStorage.getItem('admin_token');
        if (sidebarToken) {
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + sidebarToken;
        }
    }
    
    async function loadSidebarSlotBalance() {
        const badge = document.getElementById('slotsBadge');
        if (!badge) return;
        
        try {
            const response = await fetch('/api/subscription/status', {
                headers: {
                    'Authorization': 'Bearer ' + (localStorage.getItem('admin_token') || '')
                }
            });
            
            if (!response.ok) {
                badge.textContent = '!';
                badge.className = 'ml-auto bg-slate-600 text-white text-xs px-2 py-0.5 rounded-full';
                return;
            }
            
            const data = await response.json();
            if (data.is_unlimited) {
                badge.innerHTML = '<i class="fas fa-infinity text-xs"></i>';
                badge.className = 'ml-auto bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full';
            } else {
                const total = data.total_available !== undefined ? data.total_available : 0;
                badge.textContent = total;
                badge.className = total > 0 
                    ? 'ml-auto bg-green-500 text-white text-xs px-2 py-0.5 rounded-full'
                    : 'ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full';
            }
            
            const scope = data.business_scope || 'both';
            applyBusinessScopeLock(scope);
            
        } catch (error) {
            badge.textContent = '!';
            badge.className = 'ml-auto bg-slate-600 text-white text-xs px-2 py-0.5 rounded-full';
        }
    }
    
    function applyBusinessScopeLock(scope) {
        // Business scope locking is handled at the subsidy-types page level now
    }
    
    function showScopeLockModal(scopeName, scopeType) {
        const existingModal = document.getElementById('scopeLockModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'scopeLockModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = '<div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"><div class="bg-gradient-to-r from-gray-600 to-gray-700 text-white p-6 text-center"><div class="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4"><i class="fas fa-lock text-3xl"></i></div><h3 class="text-xl font-bold">この機能はロックされています</h3></div><div class="p-6"><p class="text-gray-600 mb-4 text-center"><strong>' + scopeName + '</strong>の機能を使用するには、<br>オプションプランへの加入が必要です。</p><div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4"><p class="text-sm text-blue-800"><i class="fas fa-info-circle mr-2"></i><strong>月額 +¥2,000</strong> で' + scopeName + 'を追加できます。</p></div><div class="flex gap-3"><button onclick="document.getElementById(\\'scopeLockModal\\').remove()" class="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">閉じる</button><a href="/admin/subscription" class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center font-bold"><i class="fas fa-arrow-right mr-2"></i>プラン管理へ</a></div></div></div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    }
    
    window.showScopeLockModal = showScopeLockModal;
    
    // ======= 共通ユーティリティ（全ページで利用可能） =======
    
    // 共通ステータスラベル・色（全ページ共有 — ページ固有のstatusLabelsがあればそちらが優先される）
    if (typeof window.statusLabels === 'undefined') {
        window.statusLabels = { inquiry: '見込み', preparing: '書類準備', applying: '申請中', adopted: '採択', rejected: '不採択', completed: '完了', archived: '完了' };
    }
    if (typeof window.statusColors === 'undefined') {
        window.statusColors = { inquiry: 'bg-yellow-100 text-yellow-800', preparing: 'bg-orange-100 text-orange-800', applying: 'bg-purple-100 text-purple-800', adopted: 'bg-blue-100 text-blue-800', rejected: 'bg-red-100 text-red-800', completed: 'bg-green-100 text-green-800', archived: 'bg-green-100 text-green-800' };
    }
    
    // 相対時間表示
    function formatTimeAgo(dateStr) {
        if (!dateStr) return '';
        const date = dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+')
            ? new Date(dateStr.replace(' ', 'T') + 'Z') : new Date(dateStr);
        const diffMs = Date.now() - date.getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'たった今';
        if (mins < 60) return mins + '分前';
        const hours = Math.floor(mins / 60);
        if (hours < 24) return hours + '時間前';
        const days = Math.floor(hours / 24);
        if (days < 7) return days + '日前';
        if (days < 30) return Math.floor(days / 7) + '週間前';
        return date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
    }
    window.formatTimeAgo = formatTimeAgo;
    
    // ボタンローディング状態の切替
    function setButtonLoading(btn, loading, originalText) {
        if (!btn) return;
        if (loading) {
            btn._originalText = btn._originalText || originalText || btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>処理中...';
            btn.classList.add('opacity-70', 'cursor-not-allowed');
        } else {
            btn.disabled = false;
            btn.innerHTML = btn._originalText || originalText || btn.innerHTML;
            btn.classList.remove('opacity-70', 'cursor-not-allowed');
        }
    }
    window.setButtonLoading = setButtonLoading;
    
    // HTMLエスケープ（XSS対策）
    if (typeof window.escapeHtml === 'undefined') {
        window.escapeHtml = function(text) {
            if (!text) return '';
            var d = document.createElement('div'); d.textContent = text; return d.innerHTML;
        };
    }
    
    // 日付フォーマット（月/日）
    if (typeof window.formatDate === 'undefined') {
        window.formatDate = function(dateStr) {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
        };
    }
    
    // パンくずリスト生成
    function generateBreadcrumb(items) {
        // items: [{label: 'ダッシュボード', href: '/'}, {label: '案件管理', href: '/cases'}, {label: '案件詳細'}]
        const container = document.getElementById('breadcrumb');
        if (!container) return;
        container.innerHTML = items.map(function(item, i) {
            const isLast = i === items.length - 1;
            if (isLast) {
                return '<span class="text-gray-800 font-medium">' + item.label + '</span>';
            }
            return '<a href="' + item.href + '" class="text-blue-600 hover:text-blue-800 hover:underline">' + item.label + '</a>'
                + '<i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>';
        }).join('');
    }
    window.generateBreadcrumb = generateBreadcrumb;
    
    // ESCキーでモーダルを閉じる汎用関数
    // 指定したID群のモーダル(hidden classベース)をESCで閉じられるようにする
    var _escModalIds = [];
    function registerEscClose(modalIds) {
        _escModalIds = _escModalIds.concat(modalIds);
    }
    window.registerEscClose = registerEscClose;
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            for (var i = _escModalIds.length - 1; i >= 0; i--) {
                var modal = document.getElementById(_escModalIds[i]);
                if (modal && !modal.classList.contains('hidden')) {
                    modal.classList.add('hidden');
                    document.body.style.overflow = '';
                    return;
                }
            }
        }
    });
    
    // Axios 401インターセプター（セッション切れ時に自動ログイン画面へ）
    if (typeof axios !== 'undefined' && !window._axiosInterceptorSet) {
        window._axiosInterceptorSet = true;
        axios.interceptors.response.use(
            function(response) { return response; },
            function(error) {
                if (error.response && error.response.status === 401) {
                    var isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/signup';
                    if (!isLoginPage) {
                        localStorage.removeItem('admin_token');
                        alert('セッションの有効期限が切れました。再度ログインしてください。');
                        window.location.href = '/login';
                    }
                }
                return Promise.reject(error);
            }
        );
    }
    
    // トースト通知（共通版 — ページ固有のshowToastがあればそちらが優先される）
    if (typeof window.showToast === 'undefined') {
        window.showToast = function(message, type) {
            type = type || 'success';
            var colors = {
                success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500'
            };
            var icons = {
                success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle'
            };
            var toast = document.createElement('div');
            toast.className = (colors[type] || colors.info) + ' text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm fixed top-4 right-4 z-[9999] transition-all duration-300 translate-x-full';
            toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i><span>' + message + '</span>';
            document.body.appendChild(toast);
            requestAnimationFrame(function() { toast.classList.remove('translate-x-full'); });
            setTimeout(function() {
                toast.classList.add('translate-x-full');
                setTimeout(function() { toast.remove(); }, 300);
            }, 3000);
        };
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadSidebarSlotBalance);
    } else {
        loadSidebarSlotBalance();
    }
`;
