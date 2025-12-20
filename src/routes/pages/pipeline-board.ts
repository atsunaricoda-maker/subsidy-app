// 案件進捗カンバンボード
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'

const routes = new Hono<AppEnv>()

routes.get('/pipeline', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>案件進捗 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <style>
            ${sidebarStyles}
            .kanban-column { min-height: 500px; }
            .case-card { 
                transition: all 0.2s; 
                cursor: pointer;
            }
            .case-card:hover { 
                transform: translateY(-2px); 
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .case-card.dragging {
                opacity: 0.5;
                transform: rotate(3deg);
            }
            .kanban-column.drag-over {
                background-color: #EFF6FF;
                border: 2px dashed #3B82F6;
            }
            .progress-ring {
                transform: rotate(-90deg);
            }
            .status-badge {
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 4px;
            }
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('pipeline')}
            
            <main class="flex-1 min-h-screen flex flex-col">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <div>
                                <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <i class="fas fa-tasks text-blue-600"></i>
                                    案件進捗ボード
                                </h2>
                                <p class="text-xs text-gray-500">ドラッグ&ドロップでステータスを変更</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <select id="filterSubsidyType" onchange="loadCases()" class="px-3 py-1.5 border rounded-lg text-sm">
                                <option value="">すべての種別</option>
                            </select>
                            <select id="filterUser" onchange="loadCases()" class="px-3 py-1.5 border rounded-lg text-sm">
                                <option value="">すべての担当者</option>
                            </select>
                            <button onclick="loadCases()" class="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 text-sm">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                    </div>
                </header>
                
                <!-- 統計サマリー -->
                <div class="p-4 pb-0">
                    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" id="statsSummary">
                        <!-- 動的に追加 -->
                    </div>
                </div>
                
                <!-- カンバンボード -->
                <div class="flex-1 p-4 overflow-x-auto">
                    <div class="flex gap-4 min-w-max h-full" id="kanbanBoard">
                        <!-- 動的に追加 -->
                    </div>
                </div>
            </main>
        </div>
        
        <!-- 案件詳細モーダル -->
        <div id="caseModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-4 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
                    <h3 class="text-lg font-bold" id="caseModalTitle">案件詳細</h3>
                    <button onclick="closeCaseModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div id="caseModalContent" class="p-4">
                    <!-- 動的に追加 -->
                </div>
            </div>
        </div>
        
        <script>
            ${sidebarScripts}
            
            const STATUSES = [
                { id: 'inquiry', label: '見込み', color: 'yellow', icon: 'fa-lightbulb' },
                { id: 'preparing', label: '書類準備中', color: 'blue', icon: 'fa-file-alt' },
                { id: 'applying', label: '申請中', color: 'purple', icon: 'fa-paper-plane' },
                { id: 'adopted', label: '採択', color: 'green', icon: 'fa-check-circle' },
                { id: 'rejected', label: '不採択', color: 'red', icon: 'fa-times-circle' },
                { id: 'completed', label: '完了', color: 'gray', icon: 'fa-flag-checkered' }
            ];
            
            const COLOR_MAP = {
                yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', header: 'bg-yellow-500' },
                blue: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800', header: 'bg-blue-500' },
                purple: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800', header: 'bg-purple-500' },
                green: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800', header: 'bg-green-500' },
                red: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', header: 'bg-red-500' },
                gray: { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-800', header: 'bg-gray-500' }
            };
            
            let allCases = [];
            let subsidyTypes = [];
            let users = [];
            
            async function init() {
                await Promise.all([
                    loadSubsidyTypes(),
                    loadUsers(),
                    loadCases()
                ]);
            }
            
            async function loadSubsidyTypes() {
                try {
                    const res = await axios.get('/api/subsidy-types');
                    subsidyTypes = res.data || [];
                    const select = document.getElementById('filterSubsidyType');
                    subsidyTypes.forEach(st => {
                        select.innerHTML += '<option value="' + st.id + '">' + st.name + '</option>';
                    });
                } catch (e) {
                    console.error(e);
                }
            }
            
            async function loadUsers() {
                try {
                    const res = await axios.get('/api/admin/users');
                    users = res.data || [];
                    const select = document.getElementById('filterUser');
                    users.forEach(u => {
                        select.innerHTML += '<option value="' + u.id + '">' + u.name + '</option>';
                    });
                } catch (e) {
                    console.error(e);
                }
            }
            
            async function loadCases() {
                try {
                    const subsidyTypeId = document.getElementById('filterSubsidyType').value;
                    const userId = document.getElementById('filterUser').value;
                    
                    let url = '/api/cases?limit=500';
                    if (subsidyTypeId) url += '&subsidy_type_id=' + subsidyTypeId;
                    if (userId) url += '&assigned_user_id=' + userId;
                    
                    const res = await axios.get(url);
                    allCases = res.data.cases || res.data || [];
                    
                    renderKanban();
                    renderStats();
                } catch (e) {
                    console.error(e);
                }
            }
            
            function renderStats() {
                const stats = {};
                STATUSES.forEach(s => stats[s.id] = 0);
                allCases.forEach(c => {
                    if (stats[c.status] !== undefined) stats[c.status]++;
                });
                
                const container = document.getElementById('statsSummary');
                container.innerHTML = STATUSES.map(s => {
                    const colors = COLOR_MAP[s.color];
                    return \`
                        <div class="bg-white rounded-lg p-3 shadow-sm border \${colors.border}">
                            <div class="flex items-center justify-between">
                                <div class="text-2xl font-bold text-gray-800">\${stats[s.id]}</div>
                                <div class="\${colors.header} w-8 h-8 rounded-full flex items-center justify-center text-white">
                                    <i class="fas \${s.icon} text-sm"></i>
                                </div>
                            </div>
                            <div class="text-xs text-gray-500 mt-1">\${s.label}</div>
                        </div>
                    \`;
                }).join('');
            }
            
            function renderKanban() {
                const board = document.getElementById('kanbanBoard');
                
                board.innerHTML = STATUSES.map(status => {
                    const colors = COLOR_MAP[status.color];
                    const cases = allCases.filter(c => c.status === status.id);
                    
                    return \`
                        <div class="kanban-column w-72 flex-shrink-0 \${colors.bg} rounded-xl border \${colors.border} flex flex-col"
                             data-status="\${status.id}"
                             ondragover="handleDragOver(event)"
                             ondragleave="handleDragLeave(event)"
                             ondrop="handleDrop(event)">
                            <div class="\${colors.header} text-white px-4 py-3 rounded-t-xl flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <i class="fas \${status.icon}"></i>
                                    <span class="font-bold">\${status.label}</span>
                                </div>
                                <span class="bg-white/20 px-2 py-0.5 rounded text-sm">\${cases.length}</span>
                            </div>
                            <div class="flex-1 p-3 space-y-3 overflow-y-auto" style="max-height: calc(100vh - 300px);">
                                \${cases.length === 0 ? '<div class="text-center text-gray-400 py-8 text-sm">案件なし</div>' : 
                                cases.map(c => renderCaseCard(c, colors)).join('')}
                            </div>
                        </div>
                    \`;
                }).join('');
            }
            
            function renderCaseCard(c, colors) {
                const subsidyType = subsidyTypes.find(st => st.id === c.subsidy_type_id);
                const assignedUser = users.find(u => u.id === c.assigned_user_id);
                
                // パイプライン進捗の計算（仮）
                const progress = c.pipeline_progress || 0;
                
                return \`
                    <div class="case-card bg-white rounded-lg shadow-sm p-3 border border-gray-100"
                         draggable="true"
                         data-case-id="\${c.id}"
                         ondragstart="handleDragStart(event)"
                         ondragend="handleDragEnd(event)"
                         onclick="openCaseDetail(\${c.id})">
                        <div class="flex items-start justify-between mb-2">
                            <div class="flex-1 min-w-0">
                                <div class="font-medium text-gray-800 truncate">\${c.client_name || '未設定'}</div>
                                <div class="text-xs text-gray-500 truncate">\${c.company_name || ''}</div>
                            </div>
                            \${c.amount_requested ? \`<div class="text-xs font-bold text-green-600">¥\${Number(c.amount_requested).toLocaleString()}</div>\` : ''}
                        </div>
                        
                        <div class="status-badge \${colors.badge} inline-block mb-2">
                            \${subsidyType?.name || '未設定'}
                        </div>
                        
                        \${progress > 0 ? \`
                        <div class="mb-2">
                            <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
                                <span>進捗</span>
                                <span>\${progress}%</span>
                            </div>
                            <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div class="h-full bg-blue-500 rounded-full" style="width: \${progress}%"></div>
                            </div>
                        </div>
                        \` : ''}
                        
                        <div class="flex items-center justify-between text-xs text-gray-400">
                            <div class="flex items-center gap-1">
                                <i class="fas fa-user"></i>
                                <span>\${assignedUser?.name || '未割当'}</span>
                            </div>
                            \${c.deadline ? \`<div class="flex items-center gap-1 \${isOverdue(c.deadline) ? 'text-red-500' : ''}">
                                <i class="fas fa-calendar"></i>
                                <span>\${formatDate(c.deadline)}</span>
                            </div>\` : ''}
                        </div>
                    </div>
                \`;
            }
            
            function formatDate(dateStr) {
                if (!dateStr) return '';
                const d = new Date(dateStr);
                return (d.getMonth() + 1) + '/' + d.getDate();
            }
            
            function isOverdue(dateStr) {
                if (!dateStr) return false;
                return new Date(dateStr) < new Date();
            }
            
            // ドラッグ&ドロップ
            let draggedCaseId = null;
            
            function handleDragStart(e) {
                draggedCaseId = e.target.dataset.caseId;
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            }
            
            function handleDragEnd(e) {
                e.target.classList.remove('dragging');
                document.querySelectorAll('.kanban-column').forEach(col => {
                    col.classList.remove('drag-over');
                });
            }
            
            function handleDragOver(e) {
                e.preventDefault();
                e.currentTarget.classList.add('drag-over');
            }
            
            function handleDragLeave(e) {
                e.currentTarget.classList.remove('drag-over');
            }
            
            async function handleDrop(e) {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                
                const newStatus = e.currentTarget.dataset.status;
                if (!draggedCaseId || !newStatus) return;
                
                try {
                    await axios.put('/api/cases/' + draggedCaseId, { status: newStatus });
                    
                    // ローカルデータを更新
                    const caseItem = allCases.find(c => c.id == draggedCaseId);
                    if (caseItem) {
                        caseItem.status = newStatus;
                    }
                    
                    renderKanban();
                    renderStats();
                    
                    // 成功通知
                    showToast('ステータスを更新しました');
                } catch (err) {
                    console.error(err);
                    showToast('更新に失敗しました', 'error');
                }
                
                draggedCaseId = null;
            }
            
            // 案件詳細モーダル
            async function openCaseDetail(caseId) {
                try {
                    const res = await axios.get('/api/cases/' + caseId);
                    const c = res.data;
                    
                    const subsidyType = subsidyTypes.find(st => st.id === c.subsidy_type_id);
                    const assignedUser = users.find(u => u.id === c.assigned_user_id);
                    const statusInfo = STATUSES.find(s => s.id === c.status);
                    const colors = COLOR_MAP[statusInfo?.color || 'gray'];
                    
                    document.getElementById('caseModalTitle').textContent = c.client_name || '案件詳細';
                    document.getElementById('caseModalContent').innerHTML = \`
                        <div class="space-y-4">
                            <div class="flex items-center gap-3">
                                <span class="status-badge \${colors.badge}">
                                    <i class="fas \${statusInfo?.icon} mr-1"></i>\${statusInfo?.label || c.status}
                                </span>
                                <span class="status-badge bg-gray-100 text-gray-700">
                                    \${subsidyType?.name || '種別未設定'}
                                </span>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <div class="text-xs text-gray-500">顧客名</div>
                                    <div class="font-medium">\${c.client_name || '未設定'}</div>
                                </div>
                                <div>
                                    <div class="text-xs text-gray-500">会社名</div>
                                    <div class="font-medium">\${c.company_name || '未設定'}</div>
                                </div>
                                <div>
                                    <div class="text-xs text-gray-500">申請金額</div>
                                    <div class="font-medium text-green-600">\${c.amount_requested ? '¥' + Number(c.amount_requested).toLocaleString() : '未設定'}</div>
                                </div>
                                <div>
                                    <div class="text-xs text-gray-500">担当者</div>
                                    <div class="font-medium">\${assignedUser?.name || '未割当'}</div>
                                </div>
                            </div>
                            
                            \${c.notes ? \`
                            <div>
                                <div class="text-xs text-gray-500 mb-1">メモ</div>
                                <div class="bg-gray-50 rounded-lg p-3 text-sm">\${c.notes}</div>
                            </div>
                            \` : ''}
                            
                            <div class="flex gap-3 pt-4 border-t">
                                <a href="/cases/\${c.id}" class="flex-1 bg-blue-600 text-white text-center py-2 rounded-lg hover:bg-blue-700">
                                    <i class="fas fa-external-link-alt mr-2"></i>詳細を開く
                                </a>
                                <button onclick="closeCaseModal()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                                    閉じる
                                </button>
                            </div>
                        </div>
                    \`;
                    
                    document.getElementById('caseModal').classList.remove('hidden');
                } catch (err) {
                    console.error(err);
                }
            }
            
            function closeCaseModal() {
                document.getElementById('caseModal').classList.add('hidden');
            }
            
            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                toast.className = \`fixed bottom-4 right-4 px-4 py-2 rounded-lg text-white \${type === 'error' ? 'bg-red-500' : 'bg-green-500'} shadow-lg z-50 animate-pulse\`;
                toast.textContent = message;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }
            
            // キーボードショートカット
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    closeCaseModal();
                }
            });
            
            // 初期化
            init();
        </script>
    </body>
    </html>
  `);
});

export default routes;
