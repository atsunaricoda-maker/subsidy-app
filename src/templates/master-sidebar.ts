// マスター管理用サイドバーテンプレート

export function generateMasterSidebar(activePage: string = '') {
  const isActive = (page: string) => activePage === page ? 'active' : '';
  
  return `
    <aside id="sidebar" class="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-gray-800 to-gray-900 text-white transform -translate-x-full lg:translate-x-0 lg:static transition-transform duration-300 z-50 flex flex-col">
        <div class="p-4 border-b border-gray-700 flex-shrink-0">
            <h1 class="text-xl font-bold flex items-center gap-2">
                <i class="fas fa-shield-alt"></i>
                <span>マスター管理</span>
            </h1>
            <p class="text-xs text-gray-400 mt-1">SaaS Management Console</p>
        </div>
        
        <nav class="p-4 space-y-1 flex-1 overflow-y-auto">
            <a href="/master" class="sidebar-link ${isActive('dashboard')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-tachometer-alt w-5"></i>
                <span>ダッシュボード</span>
            </a>
            
            <div class="pt-4 pb-2">
                <p class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">法人管理</p>
            </div>
            <a href="/master/organizations" class="sidebar-link ${isActive('organizations')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-building w-5"></i>
                <span>法人一覧</span>
            </a>
            <a href="/master/organizations/new" class="sidebar-link ${isActive('new-org')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-plus-circle w-5"></i>
                <span>新規法人登録</span>
            </a>
            
            <div class="pt-4 pb-2">
                <p class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">プラン・課金</p>
            </div>
            <a href="/master/plans" class="sidebar-link ${isActive('plans')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-tags w-5"></i>
                <span>プラン管理</span>
            </a>
            <a href="/master/billing" class="sidebar-link ${isActive('billing')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-file-invoice-dollar w-5"></i>
                <span>売上・請求</span>
            </a>
            
            <div class="pt-4 pb-2">
                <p class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">マスターデータ</p>
            </div>
            <a href="/master/guidelines" class="sidebar-link ${isActive('guidelines')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-book-open w-5"></i>
                <span>公募要領管理</span>
            </a>
            <a href="/master/subsidy-types" class="sidebar-link ${isActive('subsidy-types')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-list-alt w-5"></i>
                <span>補助金種別</span>
            </a>
            <a href="/master/pipelines" class="sidebar-link ${isActive('master-pipelines')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-project-diagram w-5"></i>
                <span>パイプライン</span>
            </a>
            <a href="/master/hearing-questions" class="sidebar-link ${isActive('hearing')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-clipboard-list w-5"></i>
                <span>ヒアリング質問</span>
            </a>
            <a href="/master/ai-prompts" class="sidebar-link ${isActive('prompts')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-robot w-5"></i>
                <span>AIプロンプト</span>
            </a>
            <a href="/master/document-templates" class="sidebar-link ${isActive('templates')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-file-alt w-5"></i>
                <span>文書テンプレート</span>
            </a>
            
            <div class="pt-4 pb-2">
                <p class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">サポート</p>
            </div>
            <a href="/master/inquiries" class="sidebar-link ${isActive('inquiries')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-envelope w-5"></i>
                <span>問い合わせ一覧</span>
                <span id="inquiryBadge" class="hidden ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">0</span>
            </a>
            <a href="/master/announcements" class="sidebar-link ${isActive('announcements')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-bullhorn w-5"></i>
                <span>お知らせ管理</span>
            </a>
            
            <div class="pt-4 pb-2">
                <p class="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">システム設定</p>
            </div>
            <a href="/master/ai-models" class="sidebar-link ${isActive('ai-models')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-brain w-5"></i>
                <span>AIモデル設定</span>
            </a>
            <a href="/master/legal-settings" class="sidebar-link ${isActive('legal')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-balance-scale w-5"></i>
                <span>法的表記・会社情報</span>
            </a>
            <a href="/master/admins" class="sidebar-link ${isActive('admins')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-user-shield w-5"></i>
                <span>マスター管理者</span>
            </a>
            <a href="/master/logs" class="sidebar-link ${isActive('logs')} flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700">
                <i class="fas fa-history w-5"></i>
                <span>操作ログ</span>
            </a>
        </nav>
        
        <div class="p-4 border-t border-gray-700 flex-shrink-0">
            <button onclick="masterLogout()" class="w-full flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                <i class="fas fa-sign-out-alt"></i>
                <span>ログアウト</span>
            </button>
        </div>
    </aside>
    
    <style>
        .sidebar-link.active {
            background: rgba(59, 130, 246, 0.3);
            border-left: 3px solid #3B82F6;
        }
        .sidebar-link:hover {
            background: rgba(255,255,255,0.1);
        }
    </style>
  `;
}

export const masterSidebarScripts = `
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.remove('-translate-x-full');
        } else {
            sidebar.classList.add('-translate-x-full');
        }
    }
    
    function masterLogout() {
        localStorage.removeItem('master_token');
        localStorage.removeItem('master_name');
        window.location.href = '/master/login';
    }
    
    function checkMasterAuth() {
        const token = localStorage.getItem('master_token');
        if (!token) {
            window.location.href = '/master/login';
            return false;
        }
        return true;
    }
    
    // 認証チェック
    checkMasterAuth();
`;

export const masterSidebarStyles = `
    .sidebar-link.active {
        background: rgba(59, 130, 246, 0.3);
        border-left: 3px solid #3B82F6;
    }
    .sidebar-link:hover {
        background: rgba(255,255,255,0.1);
    }
`;
