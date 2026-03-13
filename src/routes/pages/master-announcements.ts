// マスター管理: お知らせ管理
import { Hono } from 'hono'
import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'
import type { AppEnv } from '../../types'

const routes = new Hono<AppEnv>()

routes.get('/master/announcements', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>お知らせ管理 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-900 text-white">
        <div class="min-h-screen flex">
            ${generateMasterSidebar('announcements')}
            
            <main class="flex-1 min-h-screen lg:ml-64">
                <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
                    <div class="flex items-center justify-between px-6 py-4">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-400 hover:text-white">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-xl font-bold">
                                <i class="fas fa-bullhorn mr-2 text-yellow-400"></i>
                                お知らせ管理
                            </h2>
                        </div>
                        <button onclick="openCreateModal()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
                            <i class="fas fa-plus mr-1"></i>新規作成
                        </button>
                    </div>
                </header>
                
                <div class="p-6">
                    <!-- フィルター -->
                    <div class="flex items-center gap-4 mb-6">
                        <select id="typeFilter" onchange="loadAnnouncements()" class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm">
                            <option value="">すべてのタイプ</option>
                            <option value="info">お知らせ</option>
                            <option value="warning">注意</option>
                            <option value="error">障害情報</option>
                            <option value="success">メンテナンス完了</option>
                        </select>
                        <select id="targetFilter" onchange="loadAnnouncements()" class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm">
                            <option value="">すべての対象</option>
                            <option value="all">全法人</option>
                            <option value="specific_org">特定法人</option>
                        </select>
                        <label class="flex items-center gap-2 text-sm">
                            <input type="checkbox" id="showInactive" onchange="loadAnnouncements()" class="rounded">
                            非公開も表示
                        </label>
                    </div>
                    
                    <!-- お知らせ一覧 -->
                    <div id="announcementsList" class="space-y-4">
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                            <div>読み込み中...</div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- 作成/編集モーダル -->
        <div id="editModal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
                <div class="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
                    <h3 id="modalTitle" class="text-lg font-bold">お知らせ作成</h3>
                    <button onclick="closeEditModal()" class="text-gray-400 hover:text-white">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <form id="editForm" onsubmit="saveAnnouncement(event)" class="p-6 space-y-4">
                    <input type="hidden" id="editId">
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">タイトル <span class="text-red-400">*</span></label>
                        <input type="text" id="editTitle" required class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">内容 <span class="text-red-400">*</span></label>
                        <textarea id="editContent" required rows="5" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 resize-none"></textarea>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">タイプ</label>
                            <select id="editType" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
                                <option value="info">お知らせ（青）</option>
                                <option value="warning">注意（黄）</option>
                                <option value="error">障害情報（赤）</option>
                                <option value="success">完了・リリース（緑）</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">対象</label>
                            <select id="editTargetType" onchange="toggleTargetIds()" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
                                <option value="all">全法人</option>
                                <option value="specific_org">特定法人のみ</option>
                            </select>
                        </div>
                    </div>
                    
                    <div id="targetIdsContainer" class="hidden">
                        <label class="block text-sm font-medium text-gray-300 mb-2">対象法人ID（カンマ区切り）</label>
                        <input type="text" id="editTargetIds" placeholder="例: 1,5,10" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
                        <p class="text-xs text-gray-500 mt-1">問い合わせから作成した場合は自動入力されます</p>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">公開開始日</label>
                            <input type="datetime-local" id="editStartDate" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">公開終了日</label>
                            <input type="datetime-local" id="editEndDate" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <input type="checkbox" id="editIsActive" checked class="rounded">
                        <label for="editIsActive" class="text-sm text-gray-300">公開する</label>
                    </div>
                    
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="closeEditModal()" class="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded-lg">
                            キャンセル
                        </button>
                        <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium">
                            <i class="fas fa-save mr-1"></i>保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <script>
            ${masterSidebarScripts}
            
            let announcements = [];
            
            document.addEventListener('DOMContentLoaded', () => {
                checkMasterAuth();
                loadAnnouncements();
                checkUrlParams();
            });
            
            function checkMasterAuth() {
                const token = localStorage.getItem('master_token');
                if (!token) {
                    window.location.href = '/master/login';
                }
            }
            
            function checkUrlParams() {
                const params = new URLSearchParams(window.location.search);
                if (params.has('title')) {
                    // 問い合わせからの遷移 - フォームを開く
                    document.getElementById('modalTitle').textContent = 'お知らせ作成（問い合わせ #' + (params.get('from_inquiry') || '') + ' より）';
                    document.getElementById('editId').value = '';
                    document.getElementById('editTitle').value = params.get('title') || '';
                    document.getElementById('editContent').value = params.get('content') || '';
                    document.getElementById('editType').value = params.get('type') || 'info';
                    document.getElementById('editTargetType').value = params.get('target_type') || 'all';
                    document.getElementById('editTargetIds').value = params.get('target_ids') || '';
                    document.getElementById('editStartDate').value = '';
                    document.getElementById('editEndDate').value = '';
                    document.getElementById('editIsActive').checked = true;
                    toggleTargetIds();
                    document.getElementById('editModal').classList.remove('hidden');
                    
                    // URLパラメータをクリア
                    window.history.replaceState({}, '', '/master/announcements');
                }
            }
            
            async function loadAnnouncements() {
                const token = localStorage.getItem('master_token');
                const showInactive = document.getElementById('showInactive').checked;
                
                try {
                    const url = '/api/announcements' + (showInactive ? '?include_inactive=true' : '');
                    const response = await fetch(url, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    
                    announcements = await response.json();
                    renderAnnouncements();
                } catch (error) {
                    console.error('Load error:', error);
                }
            }
            
            function renderAnnouncements() {
                const container = document.getElementById('announcementsList');
                const typeFilter = document.getElementById('typeFilter').value;
                const targetFilter = document.getElementById('targetFilter').value;
                
                let filtered = announcements;
                if (typeFilter) filtered = filtered.filter(a => a.type === typeFilter);
                if (targetFilter) filtered = filtered.filter(a => a.target_type === targetFilter);
                
                if (filtered.length === 0) {
                    container.innerHTML = '<div class="text-center py-8 text-gray-500">お知らせはありません</div>';
                    return;
                }
                
                container.innerHTML = filtered.map(ann => \`
                    <div class="bg-gray-800 rounded-xl border border-gray-700 p-4 \${ann.is_active ? '' : 'opacity-50'}">
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    \${getTypeBadge(ann.type)}
                                    \${getTargetBadge(ann.target_type)}
                                    \${ann.is_active ? '' : '<span class="px-2 py-0.5 rounded text-xs bg-gray-600 text-gray-300">非公開</span>'}
                                </div>
                                <h3 class="font-bold text-lg mb-1">\${escapeHtml(ann.title)}</h3>
                                <p class="text-gray-400 text-sm whitespace-pre-wrap">\${escapeHtml(ann.content).substring(0, 200)}\${ann.content.length > 200 ? '...' : ''}</p>
                                <p class="text-xs text-gray-500 mt-2">
                                    作成: \${formatDate(ann.created_at)}
                                    \${ann.target_ids ? ' | 対象ID: ' + ann.target_ids : ''}
                                </p>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="editAnnouncement(\${ann.id})" class="text-blue-400 hover:text-blue-300 p-2">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="deleteAnnouncement(\${ann.id})" class="text-red-400 hover:text-red-300 p-2">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                \`).join('');
            }
            
            function getTypeBadge(type) {
                const badges = {
                    'info': '<span class="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400"><i class="fas fa-info-circle mr-1"></i>お知らせ</span>',
                    'warning': '<span class="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400"><i class="fas fa-exclamation-triangle mr-1"></i>注意</span>',
                    'error': '<span class="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400"><i class="fas fa-times-circle mr-1"></i>障害</span>',
                    'success': '<span class="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400"><i class="fas fa-check-circle mr-1"></i>完了</span>'
                };
                return badges[type] || badges['info'];
            }
            
            function getTargetBadge(targetType) {
                if (targetType === 'all') {
                    return '<span class="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">全法人</span>';
                } else if (targetType === 'specific_org') {
                    return '<span class="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400">特定法人</span>';
                }
                return '';
            }
            
            function formatDate(dateStr) {
                if (!dateStr) return '-';
                return new Date(dateStr).toLocaleString('ja-JP', { 
                    year: 'numeric', month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }
            
            function openCreateModal() {
                document.getElementById('modalTitle').textContent = 'お知らせ作成';
                document.getElementById('editId').value = '';
                document.getElementById('editTitle').value = '';
                document.getElementById('editContent').value = '';
                document.getElementById('editType').value = 'info';
                document.getElementById('editTargetType').value = 'all';
                document.getElementById('editTargetIds').value = '';
                document.getElementById('editStartDate').value = '';
                document.getElementById('editEndDate').value = '';
                document.getElementById('editIsActive').checked = true;
                toggleTargetIds();
                document.getElementById('editModal').classList.remove('hidden');
            }
            
            function editAnnouncement(id) {
                const ann = announcements.find(a => a.id === id);
                if (!ann) return;
                
                document.getElementById('modalTitle').textContent = 'お知らせ編集';
                document.getElementById('editId').value = ann.id;
                document.getElementById('editTitle').value = ann.title;
                document.getElementById('editContent').value = ann.content;
                document.getElementById('editType').value = ann.type || 'info';
                document.getElementById('editTargetType').value = ann.target_type || 'all';
                document.getElementById('editTargetIds').value = ann.target_ids || '';
                document.getElementById('editStartDate').value = ann.start_date ? ann.start_date.slice(0, 16) : '';
                document.getElementById('editEndDate').value = ann.end_date ? ann.end_date.slice(0, 16) : '';
                document.getElementById('editIsActive').checked = ann.is_active === 1;
                toggleTargetIds();
                document.getElementById('editModal').classList.remove('hidden');
            }
            
            function closeEditModal() {
                document.getElementById('editModal').classList.add('hidden');
            }
            
            function toggleTargetIds() {
                const targetType = document.getElementById('editTargetType').value;
                document.getElementById('targetIdsContainer').classList.toggle('hidden', targetType !== 'specific_org');
            }
            
            async function saveAnnouncement(e) {
                e.preventDefault();
                const token = localStorage.getItem('master_token');
                const id = document.getElementById('editId').value;
                
                const data = {
                    title: document.getElementById('editTitle').value,
                    content: document.getElementById('editContent').value,
                    type: document.getElementById('editType').value,
                    target_type: document.getElementById('editTargetType').value,
                    target_ids: document.getElementById('editTargetIds').value || null,
                    start_date: document.getElementById('editStartDate').value || null,
                    end_date: document.getElementById('editEndDate').value || null,
                    is_active: document.getElementById('editIsActive').checked ? 1 : 0,
                    created_by: 'マスター管理者'
                };
                
                try {
                    const url = id ? '/api/announcements/' + id : '/api/announcements';
                    const method = id ? 'PUT' : 'POST';
                    
                    const response = await fetch(url, {
                        method,
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    });
                    
                    if (response.ok) {
                        closeEditModal();
                        loadAnnouncements();
                    } else {
                        alert('保存に失敗しました');
                    }
                } catch (error) {
                    console.error('Save error:', error);
                    alert('エラーが発生しました');
                }
            }
            
            async function deleteAnnouncement(id) {
                if (!confirm('このお知らせを削除しますか？')) return;
                
                const token = localStorage.getItem('master_token');
                
                try {
                    const response = await fetch('/api/announcements/' + id, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    
                    if (response.ok) {
                        loadAnnouncements();
                    } else {
                        alert('削除に失敗しました');
                    }
                } catch (error) {
                    console.error('Delete error:', error);
                    alert('エラーが発生しました');
                }
            }
            
            function escapeHtml(text) {
                if (!text) return '';
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                sidebar.classList.toggle('-translate-x-full');
            }
        </script>
    </body>
    </html>
  `);
});

export default routes
