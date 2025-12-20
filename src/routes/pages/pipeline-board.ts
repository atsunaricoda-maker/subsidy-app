// 案件進捗ボード - 補助金種別ごとの進捗一覧
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
        <title>案件進捗ボード - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <style>
            ${sidebarStyles}
            .subsidy-group { transition: all 0.3s; }
            .subsidy-group.collapsed .group-content { display: none; }
            .subsidy-group.collapsed .collapse-icon { transform: rotate(-90deg); }
            .case-row:hover { background-color: #F9FAFB; }
            .progress-bar-bg { background-color: #E5E7EB; }
            .progress-bar-fill { transition: width 0.5s ease; }
            .task-dot { width: 8px; height: 8px; border-radius: 50%; }
            .overdue { animation: pulse 2s infinite; }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex">
            ${generateSidebar('pipeline')}
            
            <main class="flex-1 min-h-screen flex flex-col">
                <header class="bg-white shadow-sm sticky top-0 z-30 border-b">
                    <div class="flex items-center justify-between px-6 py-4">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <div>
                                <h1 class="text-xl font-bold text-gray-800">案件進捗ボード</h1>
                                <p class="text-sm text-gray-500">補助金種別ごとの申請進捗を一覧表示</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="flex items-center gap-2 text-sm text-gray-500">
                                <span class="flex items-center gap-1"><span class="task-dot bg-green-500"></span>完了</span>
                                <span class="flex items-center gap-1"><span class="task-dot bg-blue-500"></span>進行中</span>
                                <span class="flex items-center gap-1"><span class="task-dot bg-gray-300"></span>未着手</span>
                            </div>
                            <button onclick="loadData()" class="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-sm">
                                <i class="fas fa-sync-alt mr-1"></i>更新
                            </button>
                        </div>
                    </div>
                </header>
                
                <!-- サマリーカード -->
                <div class="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                    <div class="flex items-center gap-6" id="summaryCards">
                        <div class="text-center">
                            <div class="text-3xl font-bold text-gray-800" id="totalCases">-</div>
                            <div class="text-xs text-gray-500">総案件数</div>
                        </div>
                        <div class="h-10 w-px bg-gray-300"></div>
                        <div class="text-center">
                            <div class="text-3xl font-bold text-green-600" id="completedCases">-</div>
                            <div class="text-xs text-gray-500">完了</div>
                        </div>
                        <div class="text-center">
                            <div class="text-3xl font-bold text-blue-600" id="inProgressCases">-</div>
                            <div class="text-xs text-gray-500">進行中</div>
                        </div>
                        <div class="text-center">
                            <div class="text-3xl font-bold text-red-600" id="overdueCases">-</div>
                            <div class="text-xs text-gray-500">期限超過</div>
                        </div>
                    </div>
                </div>
                
                <!-- メインコンテンツ -->
                <div class="flex-1 p-6 overflow-y-auto">
                    <div id="subsidyGroups" class="space-y-4">
                        <div class="text-center py-12 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
                            <div>読み込み中...</div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- タスク詳細モーダル -->
        <div id="taskModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div class="p-4 border-b sticky top-0 bg-white flex items-center justify-between">
                    <h3 class="font-bold" id="taskModalTitle">タスク一覧</h3>
                    <button onclick="closeTaskModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="taskModalContent" class="p-4">
                </div>
            </div>
        </div>
        
        <script>
            ${sidebarScripts}
            
            let subsidyTypes = [];
            let allCases = [];
            let allPipelines = {};
            
            async function loadData() {
                try {
                    // 補助金種別を取得
                    const stRes = await axios.get('/api/subsidy-types');
                    subsidyTypes = stRes.data || [];
                    
                    // 全案件を取得（アーカイブ以外）
                    const casesRes = await axios.get('/api/cases?limit=1000&include_archived=false');
                    allCases = casesRes.data.cases || casesRes.data || [];
                    
                    // 各案件のパイプラインを取得
                    allPipelines = {};
                    const pipelinePromises = allCases.map(async (c) => {
                        try {
                            const res = await axios.get('/api/cases/' + c.id + '/pipelines');
                            const pipelines = res.data || [];
                            if (pipelines.length > 0) {
                                // タスクを取得
                                const tasksRes = await axios.get('/api/pipelines/' + pipelines[0].id + '/tasks');
                                allPipelines[c.id] = {
                                    pipeline: pipelines[0],
                                    tasks: tasksRes.data || []
                                };
                            }
                        } catch (e) {
                            // パイプラインがない場合は無視
                        }
                    });
                    
                    await Promise.all(pipelinePromises);
                    
                    renderSummary();
                    renderSubsidyGroups();
                } catch (e) {
                    console.error(e);
                    document.getElementById('subsidyGroups').innerHTML = 
                        '<div class="text-center py-12 text-red-500"><i class="fas fa-exclamation-circle text-3xl mb-3"></i><div>読み込みに失敗しました</div></div>';
                }
            }
            
            function calculateProgress(caseId) {
                const pipelineData = allPipelines[caseId];
                if (!pipelineData || !pipelineData.tasks || pipelineData.tasks.length === 0) {
                    return { percent: 0, completed: 0, total: 0, currentTask: null, tasks: [] };
                }
                
                const tasks = pipelineData.tasks;
                const completed = tasks.filter(t => t.status === 'completed').length;
                const inProgress = tasks.find(t => t.status === 'in_progress');
                const percent = Math.round((completed / tasks.length) * 100);
                
                return {
                    percent,
                    completed,
                    total: tasks.length,
                    currentTask: inProgress || tasks.find(t => t.status === 'pending'),
                    tasks
                };
            }
            
            function renderSummary() {
                let completed = 0;
                let inProgress = 0;
                let overdue = 0;
                const now = new Date();
                
                allCases.forEach(c => {
                    if (c.status === 'completed' || c.status === 'adopted') {
                        completed++;
                    } else if (c.status !== 'rejected') {
                        inProgress++;
                        if (c.deadline && new Date(c.deadline) < now) {
                            overdue++;
                        }
                    }
                });
                
                document.getElementById('totalCases').textContent = allCases.length;
                document.getElementById('completedCases').textContent = completed;
                document.getElementById('inProgressCases').textContent = inProgress;
                document.getElementById('overdueCases').textContent = overdue;
            }
            
            function renderSubsidyGroups() {
                // 補助金種別ごとにグループ化
                const grouped = {};
                subsidyTypes.forEach(st => {
                    grouped[st.id] = {
                        subsidyType: st,
                        cases: []
                    };
                });
                
                // 未分類用
                grouped['other'] = {
                    subsidyType: { id: 'other', name: '種別未設定' },
                    cases: []
                };
                
                allCases.forEach(c => {
                    const stId = c.subsidy_type_id || 'other';
                    if (grouped[stId]) {
                        grouped[stId].cases.push(c);
                    } else {
                        grouped['other'].cases.push(c);
                    }
                });
                
                // 案件があるグループのみ表示、案件数でソート
                const sortedGroups = Object.values(grouped)
                    .filter(g => g.cases.length > 0)
                    .sort((a, b) => b.cases.length - a.cases.length);
                
                if (sortedGroups.length === 0) {
                    document.getElementById('subsidyGroups').innerHTML = 
                        '<div class="text-center py-12 text-gray-500"><i class="fas fa-inbox text-5xl mb-4 text-gray-300"></i><div class="text-lg">案件がありません</div><p class="text-sm mt-2">新規案件を登録してください</p></div>';
                    return;
                }
                
                document.getElementById('subsidyGroups').innerHTML = sortedGroups.map(group => {
                    const st = group.subsidyType;
                    const cases = group.cases;
                    
                    // 進捗率でソート（低い順＝要対応順）
                    cases.sort((a, b) => {
                        const progressA = calculateProgress(a.id).percent;
                        const progressB = calculateProgress(b.id).percent;
                        return progressA - progressB;
                    });
                    
                    // グループの平均進捗
                    const avgProgress = cases.length > 0 
                        ? Math.round(cases.reduce((sum, c) => sum + calculateProgress(c.id).percent, 0) / cases.length)
                        : 0;
                    
                    return \`
                        <div class="subsidy-group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div class="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b cursor-pointer flex items-center justify-between"
                                 onclick="toggleGroup(this.parentElement)">
                                <div class="flex items-center gap-4">
                                    <i class="fas fa-chevron-down collapse-icon text-gray-400 transition-transform"></i>
                                    <div>
                                        <h2 class="font-bold text-gray-800">\${st.name}</h2>
                                        <div class="text-sm text-gray-500">\${cases.length}社が申請中</div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-4">
                                    <div class="text-right">
                                        <div class="text-sm text-gray-500">平均進捗</div>
                                        <div class="font-bold text-lg \${avgProgress >= 70 ? 'text-green-600' : avgProgress >= 30 ? 'text-blue-600' : 'text-orange-600'}">\${avgProgress}%</div>
                                    </div>
                                    <div class="w-24 h-3 progress-bar-bg rounded-full overflow-hidden">
                                        <div class="h-full progress-bar-fill \${avgProgress >= 70 ? 'bg-green-500' : avgProgress >= 30 ? 'bg-blue-500' : 'bg-orange-500'}" style="width: \${avgProgress}%"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="group-content">
                                <table class="w-full">
                                    <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                                        <tr>
                                            <th class="px-5 py-3 text-left font-medium">会社名</th>
                                            <th class="px-5 py-3 text-left font-medium w-64">進捗</th>
                                            <th class="px-5 py-3 text-left font-medium">現在のタスク</th>
                                            <th class="px-5 py-3 text-left font-medium">期限</th>
                                            <th class="px-5 py-3 text-left font-medium">ステータス</th>
                                            <th class="px-5 py-3 text-center font-medium w-20">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100">
                                        \${cases.map(c => renderCaseRow(c)).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    \`;
                }).join('');
            }
            
            function renderCaseRow(c) {
                const progress = calculateProgress(c.id);
                const isOverdue = c.deadline && new Date(c.deadline) < new Date();
                
                const statusColors = {
                    inquiry: 'bg-yellow-100 text-yellow-800',
                    preparing: 'bg-blue-100 text-blue-800',
                    applying: 'bg-purple-100 text-purple-800',
                    adopted: 'bg-green-100 text-green-800',
                    rejected: 'bg-red-100 text-red-800',
                    completed: 'bg-gray-100 text-gray-800'
                };
                
                const statusLabels = {
                    inquiry: '見込み',
                    preparing: '書類準備',
                    applying: '申請中',
                    adopted: '採択',
                    rejected: '不採択',
                    completed: '完了'
                };
                
                const progressColor = progress.percent >= 70 ? 'bg-green-500' : progress.percent >= 30 ? 'bg-blue-500' : 'bg-orange-500';
                
                return \`
                    <tr class="case-row hover:bg-gray-50 transition-colors">
                        <td class="px-5 py-4">
                            <a href="/cases/\${c.id}" class="hover:text-blue-600">
                                <div class="font-medium text-gray-800">\${c.company_name || c.client_name || '未設定'}</div>
                                <div class="text-xs text-gray-500">\${c.client_name || ''}</div>
                            </a>
                        </td>
                        <td class="px-5 py-4">
                            <div class="flex items-center gap-3">
                                <div class="flex-1">
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="text-sm font-medium text-gray-700">\${progress.percent}%</span>
                                        <span class="text-xs text-gray-500">\${progress.completed}/\${progress.total}タスク</span>
                                    </div>
                                    <div class="h-2 progress-bar-bg rounded-full overflow-hidden">
                                        <div class="h-full progress-bar-fill \${progressColor}" style="width: \${progress.percent}%"></div>
                                    </div>
                                </div>
                                \${progress.tasks.length > 0 ? \`
                                <button onclick="event.stopPropagation(); showTasks(\${c.id}, '\${c.company_name || c.client_name || ''}')" 
                                        class="text-gray-400 hover:text-blue-600" title="タスク詳細">
                                    <i class="fas fa-list-check"></i>
                                </button>
                                \` : ''}
                            </div>
                        </td>
                        <td class="px-5 py-4">
                            \${progress.currentTask ? \`
                                <div class="flex items-center gap-2">
                                    <span class="task-dot \${progress.currentTask.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300'}"></span>
                                    <span class="text-sm text-gray-700">\${progress.currentTask.name}</span>
                                </div>
                            \` : \`
                                <span class="text-sm text-gray-400">タスク未設定</span>
                            \`}
                        </td>
                        <td class="px-5 py-4">
                            \${c.deadline ? \`
                                <div class="\${isOverdue ? 'text-red-600 font-medium overdue' : 'text-gray-600'}">
                                    <i class="fas fa-calendar mr-1"></i>
                                    \${formatDate(c.deadline)}
                                    \${isOverdue ? '<i class="fas fa-exclamation-triangle ml-1"></i>' : ''}
                                </div>
                            \` : '<span class="text-gray-400">-</span>'}
                        </td>
                        <td class="px-5 py-4">
                            <span class="px-2 py-1 rounded-full text-xs font-medium \${statusColors[c.status] || 'bg-gray-100 text-gray-800'}">
                                \${statusLabels[c.status] || c.status}
                            </span>
                        </td>
                        <td class="px-5 py-4 text-center">
                            <a href="/cases/\${c.id}" class="text-blue-600 hover:text-blue-800">
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                        </td>
                    </tr>
                \`;
            }
            
            function formatDate(dateStr) {
                if (!dateStr) return '';
                const d = new Date(dateStr);
                const now = new Date();
                const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
                
                const formatted = (d.getMonth() + 1) + '/' + d.getDate();
                
                if (diffDays < 0) {
                    return formatted + ' (' + Math.abs(diffDays) + '日超過)';
                } else if (diffDays === 0) {
                    return formatted + ' (今日)';
                } else if (diffDays <= 7) {
                    return formatted + ' (あと' + diffDays + '日)';
                }
                return formatted;
            }
            
            function toggleGroup(el) {
                el.classList.toggle('collapsed');
            }
            
            function showTasks(caseId, companyName) {
                const progress = calculateProgress(caseId);
                
                document.getElementById('taskModalTitle').textContent = companyName + ' のタスク一覧';
                document.getElementById('taskModalContent').innerHTML = \`
                    <div class="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm text-gray-600">全体進捗</span>
                            <span class="font-bold">\${progress.percent}%</span>
                        </div>
                        <div class="h-2 progress-bar-bg rounded-full overflow-hidden">
                            <div class="h-full progress-bar-fill bg-blue-500" style="width: \${progress.percent}%"></div>
                        </div>
                    </div>
                    <div class="space-y-2">
                        \${progress.tasks.map((t, i) => \`
                            <div class="flex items-center gap-3 p-3 rounded-lg \${t.status === 'completed' ? 'bg-green-50' : t.status === 'in_progress' ? 'bg-blue-50' : 'bg-gray-50'}">
                                <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                                    \${t.status === 'completed' ? 'bg-green-500 text-white' : t.status === 'in_progress' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'}">
                                    \${t.status === 'completed' ? '<i class="fas fa-check"></i>' : i + 1}
                                </div>
                                <div class="flex-1">
                                    <div class="font-medium \${t.status === 'completed' ? 'text-green-800 line-through' : 'text-gray-800'}">\${t.name}</div>
                                    \${t.description ? '<div class="text-xs text-gray-500">' + t.description + '</div>' : ''}
                                </div>
                                <div class="text-xs \${t.status === 'completed' ? 'text-green-600' : t.status === 'in_progress' ? 'text-blue-600' : 'text-gray-400'}">
                                    \${t.status === 'completed' ? '完了' : t.status === 'in_progress' ? '進行中' : '未着手'}
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                    <div class="mt-4 pt-4 border-t">
                        <a href="/cases/\${caseId}" class="block w-full text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                            案件詳細を開く
                        </a>
                    </div>
                \`;
                
                document.getElementById('taskModal').classList.remove('hidden');
            }
            
            function closeTaskModal() {
                document.getElementById('taskModal').classList.add('hidden');
            }
            
            // ESCキーでモーダルを閉じる
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeTaskModal();
            });
            
            // 初期化
            loadData();
        </script>
    </body>
    </html>
  `);
});

export default routes;
