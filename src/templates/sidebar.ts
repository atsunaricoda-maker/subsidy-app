// 共通サイドバーテンプレート

export function generateSidebar(activePage: string = '') {
  const isActive = (page: string) => activePage === page ? 'active' : '';
  const isSectionActive = (pages: string[]) => pages.includes(activePage);
  
  return `
    <aside id="sidebar" class="fixed inset-y-0 left-0 w-52 bg-gradient-to-b from-blue-800 to-blue-900 text-white transform -translate-x-full lg:translate-x-0 lg:static transition-transform duration-300 z-50 flex flex-col">
        <div class="p-3 border-b border-blue-700 flex-shrink-0">
            <h1 class="text-base font-bold flex items-center gap-2">
                <i class="fas fa-file-invoice-dollar"></i>
                <span>申請らくらく君</span>
            </h1>
        </div>
        
        <nav class="p-2 space-y-0.5 flex-1 overflow-y-auto">
            <!-- ダッシュボード - 常時表示 -->
            <a href="/" class="sidebar-link ${isActive('dashboard')} flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                <i class="fas fa-home w-4 text-center"></i>
                <span>ダッシュボード</span>
            </a>
            
            <!-- 案件進捗ボード - 最重要機能として目立つ位置に -->
            <a href="/pipeline" class="sidebar-link ${isActive('pipeline')} flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-gradient-to-r from-indigo-600/40 to-purple-600/40 border border-indigo-400/50 mt-2 hover:from-indigo-600/60 hover:to-purple-600/60">
                <div class="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow">
                    <i class="fas fa-columns text-white text-xs"></i>
                </div>
                <span class="font-bold">案件進捗ボード</span>
            </a>
            
            <!-- 案件管理セクション - 折りたたみ可能、デフォルト展開 -->
            <div class="sidebar-section" data-section="cases">
                <button onclick="toggleSidebarSection('cases')" class="w-full flex items-center justify-between px-3 py-1.5 text-blue-300 hover:text-white text-xs mt-2">
                    <span class="font-semibold uppercase tracking-wide">案件管理</span>
                    <i class="fas fa-chevron-down section-icon transition-transform text-xs"></i>
                </button>
                <div class="section-content space-y-0.5">
                    <a href="/cases" class="sidebar-link ${isActive('cases')} flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-folder-open w-4 text-center"></i>
                        <span>案件一覧</span>
                    </a>
                    <a href="/clients" class="sidebar-link ${isActive('clients')} flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-address-book w-4 text-center"></i>
                        <span>顧客一覧</span>
                    </a>
                    <a href="/?openNewCase=true" class="sidebar-link flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-green-300 hover:text-white">
                        <i class="fas fa-plus w-4 text-center"></i>
                        <span>新規登録</span>
                    </a>
                </div>
            </div>
            
            <!-- 申請種別セクション - 折りたたみ可能 -->
            <div class="sidebar-section" data-section="subsidy">
                <button onclick="toggleSidebarSection('subsidy')" class="w-full flex items-center justify-between px-3 py-1.5 text-blue-300 hover:text-white text-xs mt-2">
                    <span class="font-semibold uppercase tracking-wide">申請種別</span>
                    <i class="fas fa-chevron-down section-icon transition-transform text-xs"></i>
                </button>
                <div class="section-content space-y-0.5">
                    <a href="/subsidy-types" id="sidebarSubsidyLink" class="sidebar-link ${isSectionActive(['subsidy-gyosei', 'subsidy-sharoshi', 'subsidy-kyoninka']) ? 'active' : ''} flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-list w-4 text-center"></i>
                        <span>種別一覧</span>
                    </a>
                    <a href="/admin/pipelines" class="sidebar-link ${isActive('pipelines')} flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-project-diagram w-4 text-center"></i>
                        <span>パイプライン</span>
                    </a>
                    <a href="/admin/guidelines" class="sidebar-link ${isActive('guidelines')} flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-book-open w-4 text-center"></i>
                        <span>公募要領</span>
                    </a>
                    <a href="/admin/statistics" class="sidebar-link ${isActive('statistics')} flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-chart-line w-4 text-center"></i>
                        <span>統計</span>
                    </a>
                </div>
            </div>
            
            <!-- 設定セクション - 折りたたみ可能、デフォルト閉じ -->
            <div class="sidebar-section" data-section="settings">
                <button onclick="toggleSidebarSection('settings')" class="w-full flex items-center justify-between px-3 py-1.5 text-blue-300 hover:text-white text-xs mt-2">
                    <span class="font-semibold uppercase tracking-wide">設定</span>
                    <i class="fas fa-chevron-down section-icon transition-transform text-xs"></i>
                </button>
                <div class="section-content space-y-0.5">
                    <a href="/admin/users" id="sidebarEmployeeLink" class="sidebar-link ${isActive('users')} hidden flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-users-cog w-4 text-center"></i>
                        <span>従業員</span>
                    </a>
                    <a href="/admin/payments" id="sidebarPaymentsLink" class="sidebar-link ${isActive('payments')} hidden flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-credit-card w-4 text-center"></i>
                        <span>支払い</span>
                        <span id="pendingPaymentsBadge" class="hidden ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">0</span>
                    </a>
                    <a href="/admin/subscription" id="sidebarSubscriptionLink" class="sidebar-link ${isActive('subscription')} hidden flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-ticket-alt w-4 text-center"></i>
                        <span>プラン</span>
                        <span id="slotsBadge" class="ml-auto bg-gray-500 text-white text-xs px-1.5 py-0.5 rounded-full">...</span>
                    </a>
                    <a href="/admin/settings" id="sidebarSettingsLink" class="sidebar-link ${isActive('settings')} hidden flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-cog w-4 text-center"></i>
                        <span>設定</span>
                    </a>
                    <a href="/admin/backup" id="sidebarBackupLink" class="sidebar-link ${isActive('backup')} hidden flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-database w-4 text-center"></i>
                        <span>バックアップ</span>
                    </a>
                </div>
            </div>
            
            <!-- サポートセクション -->
            <div class="sidebar-section" data-section="support">
                <button onclick="toggleSidebarSection('support')" class="w-full flex items-center justify-between px-3 py-1.5 text-blue-300 hover:text-white text-xs mt-2">
                    <span class="font-semibold uppercase tracking-wide">サポート</span>
                    <i class="fas fa-chevron-down section-icon transition-transform text-xs"></i>
                </button>
                <div class="section-content space-y-0.5">
                    <a href="/help" class="sidebar-link ${isActive('help')} flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-question-circle w-4 text-center"></i>
                        <span>ヘルプ・FAQ</span>
                    </a>
                    <a href="/contact" class="sidebar-link ${isActive('contact')} flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
                        <i class="fas fa-envelope w-4 text-center"></i>
                        <span>お問い合わせ</span>
                    </a>
                </div>
            </div>
        </nav>
        
        <!-- 法的リンク -->
        <div class="px-3 py-2 border-t border-blue-700/50">
            <div class="flex gap-2 text-xs text-blue-300">
                <a href="/terms" target="_blank" class="hover:text-white">利用規約</a>
                <span class="text-blue-500">|</span>
                <a href="/privacy-policy" target="_blank" class="hover:text-white">個人情報</a>
                <span class="text-blue-500">|</span>
                <a href="/legal" target="_blank" class="hover:text-white">特商法</a>
            </div>
        </div>
        
        <!-- ユーザー情報 -->
        <div class="p-2 border-t border-blue-700 bg-blue-900">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm">
                    <i class="fas fa-user"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p id="sidebarAdminName" class="text-sm font-medium truncate">管理者</p>
                </div>
                <button onclick="logout()" class="text-blue-300 hover:text-white" title="ログアウト">
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
    .sidebar-link { transition: all 0.2s; }
    .sidebar-link:hover { background-color: rgba(255,255,255,0.1); }
    .sidebar-link.active { background-color: rgba(255,255,255,0.2); border-left: 2px solid white; }
    .sidebar-section .section-content { 
        max-height: 500px; 
        overflow: hidden; 
        transition: max-height 0.3s ease-out, opacity 0.2s ease-out;
    }
    .sidebar-section.collapsed .section-content { 
        max-height: 0; 
        opacity: 0;
    }
    .sidebar-section.collapsed .section-icon { 
        transform: rotate(-90deg); 
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
    
    // サイドバーセクション折りたたみ機能
    function toggleSidebarSection(sectionName) {
        const section = document.querySelector('[data-section="' + sectionName + '"]');
        if (section) {
            section.classList.toggle('collapsed');
            const collapsedSections = JSON.parse(localStorage.getItem('sidebar_collapsed') || '{}');
            collapsedSections[sectionName] = section.classList.contains('collapsed');
            localStorage.setItem('sidebar_collapsed', JSON.stringify(collapsedSections));
        }
    }
    
    // サイドバー初期状態の復元
    function initSidebarSections() {
        const collapsedSections = JSON.parse(localStorage.getItem('sidebar_collapsed') || '{"settings": true}');
        Object.keys(collapsedSections).forEach(sectionName => {
            if (collapsedSections[sectionName]) {
                const section = document.querySelector('[data-section="' + sectionName + '"]');
                if (section) {
                    section.classList.add('collapsed');
                }
            }
        });
    }
    
    document.addEventListener('DOMContentLoaded', initSidebarSections);
    
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
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('admin_username') + ':' + localStorage.getItem('admin_role');
    }
    
    async function loadSidebarSlotBalance() {
        const badge = document.getElementById('slotsBadge');
        if (!badge) return;
        
        try {
            const response = await fetch('/api/subscription/status', {
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('admin_username') + ':' + localStorage.getItem('admin_role')
                }
            });
            
            if (!response.ok) {
                badge.textContent = '!';
                badge.className = 'ml-auto bg-gray-400 text-white text-xs px-2 py-0.5 rounded-full';
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
            badge.className = 'ml-auto bg-gray-400 text-white text-xs px-2 py-0.5 rounded-full';
        }
    }
    
    function applyBusinessScopeLock(scope) {
        const subsidyLink = document.getElementById('sidebarSubsidyLink');
        const subsidyIcon = document.getElementById('sidebarSubsidyIcon');
        const subsidyBadge = document.getElementById('sidebarSubsidyBadge');
        const grantLink = document.getElementById('sidebarGrantLink');
        const grantIcon = document.getElementById('sidebarGrantIcon');
        const grantBadge = document.getElementById('sidebarGrantBadge');
        const licenseLink = document.getElementById('sidebarLicenseLink');
        const licenseIcon = document.getElementById('sidebarLicenseIcon');
        const licenseBadge = document.getElementById('sidebarLicenseBadge');
        
        if (scope === 'labor') {
            if (subsidyLink) lockSidebarItem(subsidyLink, subsidyIcon, subsidyBadge, '行政書士業務', 'administrative');
            if (licenseLink) lockSidebarItem(licenseLink, licenseIcon, licenseBadge, '行政書士業務', 'administrative');
        }
        else if (scope === 'administrative') {
            if (grantLink) lockSidebarItem(grantLink, grantIcon, grantBadge, '社労士業務', 'labor');
        }
    }
    
    function lockSidebarItem(link, icon, badge, scopeName, scopeType) {
        link.href = 'javascript:void(0)';
        link.onclick = function(e) {
            e.preventDefault();
            showScopeLockModal(scopeName, scopeType);
        };
        link.classList.add('opacity-50', 'cursor-not-allowed');
        if (icon) icon.className = 'fas fa-lock w-5 text-gray-400';
        if (badge) {
            badge.innerHTML = '<i class="fas fa-lock text-xs"></i>';
            badge.className = 'ml-auto text-xs bg-gray-500 px-2 py-0.5 rounded';
        }
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
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadSidebarSlotBalance);
    } else {
        loadSidebarSlotBalance();
    }
`;
