// パイプライン管理ページ
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/admin/pipelines', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>パイプライン管理 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
            .task-card { transition: all 0.2s; }
            .task-card:hover { transform: translateX(4px); }
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('pipelines')}
            
            <!-- メインコンテンツ -->
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">パイプライン管理</h2>
                        </div>
                        <div class="flex items-center gap-3">
                            <button onclick="openNewTemplateModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                <i class="fas fa-plus mr-2"></i>新規テンプレート
                            </button>
                        </div>
                    </div>
                </header>
                
                <div class="p-4 lg:p-6">
                    <!-- テンプレート一覧 -->
                    <div class="bg-white rounded-xl shadow-sm">
                        <div class="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                            <h3 class="text-base font-bold text-gray-800">パイプラインテンプレート</h3>
                            <div class="flex items-center gap-3">
                                <label class="flex items-center gap-2 text-sm">
                                    <input type="checkbox" id="treeViewToggle" onchange="loadTemplates()" class="rounded text-blue-600">
                                    <span>ツリー表示</span>
                                </label>
                                <select id="filterCategory" onchange="loadTemplates()" class="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                                    <option value="">すべてのカテゴリ</option>
                                    <option value="subsidy">行政書士管轄</option>
                                    <option value="grant">社労士管轄</option>
                                    <option value="license">許認可</option>
                                </select>
                            </div>
                        </div>
                        <div id="templatesList" class="divide-y divide-gray-100">
                            <div class="text-center py-12 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
                                <div>読み込み中...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- 新規テンプレートモーダル -->
        <div id="newTemplateModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b sticky top-0 bg-white z-10">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-bold">新規パイプラインテンプレート作成</h3>
                        <button onclick="closeNewTemplateModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <form id="newTemplateForm" class="p-6 space-y-6">
                    <!-- 基本情報 -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="md:col-span-2">
                            <label class="block text-sm font-medium mb-1">パイプライン名 *</label>
                            <input type="text" name="name" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-sm font-medium mb-1">説明</label>
                            <textarea name="description" rows="2" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">カテゴリ *</label>
                            <select name="category" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="subsidy">行政書士管轄（補助金）</option>
                                <option value="grant">社労士管轄（助成金）</option>
                                <option value="license">許認可</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">担当者</label>
                            <select name="created_by" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="">選択してください</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">親パイプライン（オプション）</label>
                            <select name="parent_id" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="">なし（最上位）</option>
                            </select>
                            <p class="text-xs text-gray-500 mt-1">ツリー構造で管理する場合に親を選択</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">表示順</label>
                            <input type="number" name="display_order" value="0" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <!-- 申請種別との紐付け -->
                    <div class="border rounded-lg p-4 bg-blue-50">
                        <h4 class="font-medium mb-3 flex items-center gap-2">
                            <i class="fas fa-link text-blue-600"></i>申請種別との紐付け
                            <span class="text-xs text-gray-500 font-normal ml-2">（空の場合はすべての申請種別で利用可能）</span>
                        </h4>
                        <div id="subsidyTypeCheckboxes" class="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                            <!-- 申請種別のチェックボックスがここに追加される -->
                        </div>
                        <p class="text-xs text-gray-600 mt-2">
                            <i class="fas fa-info-circle mr-1"></i>
                            選択した申請種別の案件を登録する際に、このパイプラインが候補として表示されます。
                        </p>
                    </div>
                    
                    <!-- 期間設定 -->
                    <div class="border rounded-lg p-4 bg-gray-50">
                        <h4 class="font-medium mb-3 flex items-center gap-2">
                            <i class="fas fa-calendar-alt text-blue-600"></i>サービス期間設定
                        </h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-1">開始日オフセット（日）</label>
                                <input type="number" name="service_start_offset" value="0" class="w-full px-3 py-2 border rounded-lg">
                                <p class="text-xs text-gray-500 mt-1">申請日からの日数</p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">終了日オフセット（日）</label>
                                <input type="number" name="service_end_offset" value="30" class="w-full px-3 py-2 border rounded-lg">
                                <p class="text-xs text-gray-500 mt-1">申請日からの日数</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- オプション -->
                    <div class="border rounded-lg p-4 bg-gray-50">
                        <h4 class="font-medium mb-3 flex items-center gap-2">
                            <i class="fas fa-cog text-blue-600"></i>オプション
                        </h4>
                        <div class="space-y-3">
                            <label class="flex items-center gap-3">
                                <input type="checkbox" name="progress_reflection" checked class="rounded text-blue-600">
                                <span class="text-sm">進捗反映</span>
                            </label>
                            <label class="flex items-center gap-3">
                                <input type="checkbox" name="requires_approval" class="rounded text-blue-600">
                                <span class="text-sm">承認が必要</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- サービスタスク -->
                    <div class="border rounded-lg p-4">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-medium flex items-center gap-2">
                                <i class="fas fa-tasks text-blue-600"></i>サービスタスク
                            </h4>
                            <button type="button" onclick="addTaskRow()" class="text-blue-600 hover:text-blue-700 text-sm">
                                <i class="fas fa-plus mr-1"></i>タスク追加
                            </button>
                        </div>
                        <div id="tasksList" class="space-y-3">
                            <!-- タスク行がここに追加される -->
                        </div>
                    </div>
                    
                    <div class="flex gap-3 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium">
                            <i class="fas fa-save mr-2"></i>保存
                        </button>
                        <button type="button" onclick="closeNewTemplateModal()" class="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-medium">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- テンプレート詳細モーダル -->
        <div id="templateDetailModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b sticky top-0 bg-white z-10">
                    <div class="flex items-center justify-between">
                        <h3 id="templateDetailTitle" class="text-xl font-bold">テンプレート詳細</h3>
                        <button onclick="closeTemplateDetailModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div id="templateDetailContent" class="p-6">
                    <!-- 詳細がここに表示される -->
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${sidebarScripts}
        </script>
        <script>
            // トースト通知
            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                toast.className = 'fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 ' + 
                    (type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white');
                toast.innerHTML = '<i class="fas ' + (type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle') + ' mr-2"></i>' + message;
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }
            
            // タスク行テンプレート
            let taskCounter = 0;
            
            function addTaskRow(task = null) {
                taskCounter++;
                const container = document.getElementById('tasksList');
                const row = document.createElement('div');
                row.className = 'task-card bg-white border rounded-lg p-4 relative';
                row.id = 'task-row-' + taskCounter;
                
                row.innerHTML = \`
                    <button type="button" onclick="removeTaskRow(\${taskCounter})" class="absolute top-2 right-2 text-red-500 hover:text-red-700">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="md:col-span-2">
                            <label class="block text-xs font-medium mb-1">タスク名 *</label>
                            <input type="text" name="tasks[\${taskCounter}][task_name]" required value="\${task?.task_name || ''}" class="w-full px-3 py-2 border rounded-lg text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-medium mb-1">タスクタイプ</label>
                            <select name="tasks[\${taskCounter}][task_type]" class="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="internal" \${task?.task_type === 'internal' ? 'selected' : ''}>自社タスク</option>
                                <option value="external" \${task?.task_type === 'external' ? 'selected' : ''}>顧客タスク</option>
                                <option value="both" \${task?.task_type === 'both' ? 'selected' : ''}>両方</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-medium mb-1">必須</label>
                            <select name="tasks[\${taskCounter}][is_required]" class="w-full px-3 py-2 border rounded-lg text-sm">
                                <option value="1" \${task?.is_required !== 0 ? 'selected' : ''}>必須</option>
                                <option value="0" \${task?.is_required === 0 ? 'selected' : ''}>任意</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-medium mb-1">開始日オフセット（日）</label>
                            <input type="number" name="tasks[\${taskCounter}][days_offset_start]" value="\${task?.days_offset_start || 0}" class="w-full px-3 py-2 border rounded-lg text-sm">
                        </div>
                        <div>
                            <label class="block text-xs font-medium mb-1">終了日オフセット（日）</label>
                            <input type="number" name="tasks[\${taskCounter}][days_offset_end]" value="\${task?.days_offset_end || 7}" class="w-full px-3 py-2 border rounded-lg text-sm">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-xs font-medium mb-1">説明</label>
                            <input type="text" name="tasks[\${taskCounter}][description]" value="\${task?.description || ''}" class="w-full px-3 py-2 border rounded-lg text-sm">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-xs font-medium mb-1">
                                <i class="fas fa-paperclip mr-1"></i>添付ファイル（申請書の書き方など）
                            </label>
                            <div class="flex gap-2">
                                <input type="file" id="taskFile\${taskCounter}" onchange="handleTaskFileUpload(\${taskCounter})" class="hidden">
                                <input type="text" name="tasks[\${taskCounter}][attachment_name]" value="\${task?.attachment_name || ''}" placeholder="ファイル名" class="flex-1 px-3 py-2 border rounded-lg text-sm bg-gray-50" readonly>
                                <input type="hidden" name="tasks[\${taskCounter}][attachment_url]" value="\${task?.attachment_url || ''}">
                                <button type="button" onclick="document.getElementById('taskFile\${taskCounter}').click()" class="px-3 py-2 bg-gray-100 hover:bg-gray-200 border rounded-lg text-sm">
                                    <i class="fas fa-upload"></i>
                                </button>
                                \${task?.attachment_url ? \`
                                <a href="\${task.attachment_url}" target="_blank" class="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300 rounded-lg text-sm">
                                    <i class="fas fa-download"></i>
                                </a>
                                <button type="button" onclick="clearTaskAttachment(\${taskCounter})" class="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 border border-red-300 rounded-lg text-sm">
                                    <i class="fas fa-trash"></i>
                                </button>
                                \` : ''}
                            </div>
                        </div>
                    </div>
                \`;
                
                container.appendChild(row);
            }
            
            function removeTaskRow(id) {
                const row = document.getElementById('task-row-' + id);
                if (row) row.remove();
            }
            
            // テンプレート一覧読み込み
            async function loadTemplates() {
                try {
                    const category = document.getElementById('filterCategory').value;
                    const treeMode = document.getElementById('treeViewToggle')?.checked;
                    let url = '/api/pipeline-templates?tree=' + (treeMode ? 'true' : 'false');
                    if (category) {
                        url += '&category=' + category;
                    }
                    
                    const response = await axios.get(url);
                    const templates = response.data;
                    
                    const container = document.getElementById('templatesList');
                    
                    if (templates.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-12 text-gray-500">
                                <i class="fas fa-folder-open text-4xl mb-3 text-gray-300"></i>
                                <p>パイプラインテンプレートがありません</p>
                                <button onclick="openNewTemplateModal()" class="mt-3 text-blue-600 hover:text-blue-700">
                                    <i class="fas fa-plus mr-1"></i>新規作成
                                </button>
                            </div>
                        \`;
                        return;
                    }
                    
                    const categoryConfig = {
                        'subsidy': { 
                            label: '補助金（行政書士管轄）', 
                            icon: 'fa-file-signature',
                            headerClass: 'bg-emerald-50 border-emerald-500',
                            iconClass: 'text-emerald-600',
                            titleClass: 'text-emerald-800',
                            countClass: 'text-emerald-600',
                            itemBgClass: 'bg-emerald-100',
                            itemIconClass: 'text-emerald-600'
                        },
                        'grant': { 
                            label: '助成金（社労士管轄）', 
                            icon: 'fa-users',
                            headerClass: 'bg-blue-50 border-blue-500',
                            iconClass: 'text-blue-600',
                            titleClass: 'text-blue-800',
                            countClass: 'text-blue-600',
                            itemBgClass: 'bg-blue-100',
                            itemIconClass: 'text-blue-600'
                        },
                        'license': { 
                            label: '許認可申請', 
                            icon: 'fa-stamp',
                            headerClass: 'bg-indigo-50 border-indigo-500',
                            iconClass: 'text-indigo-600',
                            titleClass: 'text-indigo-800',
                            countClass: 'text-indigo-600',
                            itemBgClass: 'bg-indigo-100',
                            itemIconClass: 'text-indigo-600'
                        }
                    };
                    
                    // ツリー表示のヘルパー関数
                    function renderTreeItem(item, config, depth = 0) {
                        const indent = depth * 24;
                        const hasChildren = item.children && item.children.length > 0;
                        const isChild = depth > 0;
                        
                        let html = \`
                            <div class="p-3 hover:bg-gray-50 cursor-pointer" style="padding-left: \${16 + indent}px" onclick="showTemplateDetail(\${item.id})">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        \${isChild ? '<i class="fas fa-level-up-alt fa-rotate-90 text-gray-300 text-xs mr-1"></i>' : ''}
                                        <div class="w-8 h-8 rounded-lg \${config.itemBgClass} flex items-center justify-center \${config.itemIconClass}">
                                            <i class="fas \${hasChildren ? 'fa-folder' : 'fa-project-diagram'} text-sm"></i>
                                        </div>
                                        <div>
                                            <div class="font-medium text-gray-900 \${isChild ? 'text-sm' : ''}">\${item.name}</div>
                                            <div class="text-xs text-gray-500 line-clamp-1">\${item.description || ''}</div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        \${hasChildren ? '<span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">' + item.children.length + '子パイプライン</span>' : ''}
                                        <span class="text-sm text-gray-500">\${item.task_count || 0}タスク</span>
                                        <i class="fas fa-chevron-right text-gray-400"></i>
                                    </div>
                                </div>
                            </div>
                        \`;
                        
                        // 子アイテムを再帰的にレンダリング
                        if (hasChildren) {
                            item.children.forEach(child => {
                                html += renderTreeItem(child, config, depth + 1);
                            });
                        }
                        
                        return html;
                    }
                    
                    // カテゴリ別にグループ化
                    const grouped = {};
                    
                    // グループ化（ツリー/フラット共通）
                    templates.forEach(t => {
                        const cat = t.category || 'license';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(t);
                    });
                    
                    // カテゴリ順序
                    const categoryOrder = ['subsidy', 'grant', 'license'];
                    
                    let html = '';
                    categoryOrder.forEach(catKey => {
                        const items = grouped[catKey];
                        if (!items || items.length === 0) return;
                        
                        const config = categoryConfig[catKey] || categoryConfig['license'];
                        
                        // アイテム数をカウント（ツリーの場合は全階層）
                        function countItems(arr) {
                            let count = 0;
                            arr.forEach(item => {
                                count++;
                                if (item.children) count += countItems(item.children);
                            });
                            return count;
                        }
                        const totalCount = treeMode ? countItems(items) : items.length;
                        
                        html += \`
                            <div class="mb-6">
                                <div class="flex items-center gap-3 px-4 py-3 \${config.headerClass} border-l-4 rounded-r-lg">
                                    <i class="fas \${config.icon} \${config.iconClass}"></i>
                                    <h3 class="font-bold \${config.titleClass}">\${config.label}</h3>
                                    <span class="ml-auto text-sm \${config.countClass}">\${totalCount}件</span>
                                </div>
                                <div class="divide-y divide-gray-100 ml-4 border-l-2 border-gray-200">
                                    \${treeMode 
                                        ? items.map(t => renderTreeItem(t, config, 0)).join('')
                                        : items.map(t => \`
                                            <div class="p-3 hover:bg-gray-50 cursor-pointer pl-6" onclick="showTemplateDetail(\${t.id})">
                                                <div class="flex items-center justify-between">
                                                    <div class="flex items-center gap-3">
                                                        \${t.parent_id ? '<i class="fas fa-level-up-alt fa-rotate-90 text-gray-300 text-xs mr-1"></i>' : ''}
                                                        <div class="w-8 h-8 rounded-lg \${config.itemBgClass} flex items-center justify-center \${config.itemIconClass}">
                                                            <i class="fas fa-project-diagram text-sm"></i>
                                                        </div>
                                                        <div>
                                                            <div class="font-medium text-gray-900">\${t.name}</div>
                                                            <div class="text-xs text-gray-500 line-clamp-1">\${t.description || ''}</div>
                                                        </div>
                                                    </div>
                                                    <div class="flex items-center gap-3">
                                                        <span class="text-sm text-gray-500">\${t.task_count || 0}タスク</span>
                                                        <i class="fas fa-chevron-right text-gray-400"></i>
                                                    </div>
                                                </div>
                                            </div>
                                        \`).join('')
                                    }
                                </div>
                            </div>
                        \`;
                    });
                    
                    container.innerHTML = html;
                    
                } catch (error) {
                    console.error('Error loading templates:', error);
                    document.getElementById('templatesList').innerHTML = \`
                        <div class="text-center py-12 text-red-500">
                            <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                            <p>読み込みエラー</p>
                        </div>
                    \`;
                }
            }
            
            // テンプレート詳細表示
            async function showTemplateDetail(id) {
                try {
                    const response = await axios.get('/api/pipeline-templates/' + id);
                    const template = response.data;
                    
                    document.getElementById('templateDetailTitle').textContent = template.name;
                    
                    const categoryLabels = {
                        'subsidy': { label: '行政書士管轄', color: 'bg-emerald-100 text-emerald-800' },
                        'grant': { label: '社労士管轄', color: 'bg-blue-100 text-blue-800' },
                        'license': { label: '許認可', color: 'bg-indigo-100 text-indigo-800' },
                        '行政書士管轄': { label: '行政書士管轄', color: 'bg-emerald-100 text-emerald-800' },
                        '社労士管轄': { label: '社労士管轄', color: 'bg-blue-100 text-blue-800' },
                        '許認可': { label: '許認可', color: 'bg-indigo-100 text-indigo-800' }
                    };
                    const cat = categoryLabels[template.category] || categoryLabels['許認可'];
                    
                    const taskTypeLabels = {
                        'internal': { label: '自社', color: 'bg-purple-100 text-purple-800' },
                        'external': { label: '顧客', color: 'bg-orange-100 text-orange-800' },
                        'both': { label: '両方', color: 'bg-gray-100 text-gray-800' }
                    };
                    
                    let content = \`
                        <div class="space-y-6">
                            <!-- 基本情報 -->
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <span class="text-sm text-gray-500">カテゴリ</span>
                                    <p class="mt-1"><span class="px-2 py-1 rounded-full text-xs font-medium \${cat.color}">\${cat.label}</span></p>
                                </div>
                                <div>
                                    <span class="text-sm text-gray-500">サービス期間</span>
                                    <p class="mt-1 font-medium">\${template.service_start_offset}日 〜 \${template.service_end_offset}日</p>
                                </div>
                            </div>
                            
                            <div>
                                <span class="text-sm text-gray-500">説明</span>
                                <p class="mt-1">\${template.description || '説明なし'}</p>
                            </div>
                            
                            <!-- オプション -->
                            <div class="flex gap-4">
                                <span class="text-sm \${template.progress_reflection ? 'text-green-600' : 'text-gray-400'}">
                                    <i class="fas fa-\${template.progress_reflection ? 'check' : 'times'} mr-1"></i>進捗反映
                                </span>
                                <span class="text-sm \${template.requires_approval ? 'text-green-600' : 'text-gray-400'}">
                                    <i class="fas fa-\${template.requires_approval ? 'check' : 'times'} mr-1"></i>承認必要
                                </span>
                            </div>
                            
                            <!-- タスク一覧 -->
                            <div>
                                <h4 class="font-medium mb-3 flex items-center gap-2">
                                    <i class="fas fa-tasks text-blue-600"></i>タスク一覧（\${template.tasks?.length || 0}件）
                                </h4>
                                <div class="space-y-2">
                    \`;
                    
                    if (template.tasks && template.tasks.length > 0) {
                        template.tasks.forEach((task, index) => {
                            const tt = taskTypeLabels[task.task_type] || taskTypeLabels.internal;
                            content += \`
                                <div class="border rounded-lg p-3 bg-gray-50">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <span class="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">\${index + 1}</span>
                                            <span class="font-medium">\${task.task_name}</span>
                                            <span class="px-2 py-0.5 rounded text-xs \${tt.color}">\${tt.label}</span>
                                            \${task.is_required ? '<span class="text-red-500 text-xs">*必須</span>' : ''}
                                        </div>
                                        <span class="text-sm text-gray-500">\${task.days_offset_start}日 〜 \${task.days_offset_end}日</span>
                                    </div>
                                    \${task.description ? '<p class="text-sm text-gray-600 mt-1 ml-8">' + task.description + '</p>' : ''}
                                </div>
                            \`;
                        });
                    } else {
                        content += '<p class="text-gray-500 text-center py-4">タスクがありません</p>';
                    }
                    
                    // 紐づいた申請種別を表示
                    let linkedSubsidyNames = [];
                    if (template.subsidy_type_ids) {
                        try {
                            const ids = JSON.parse(template.subsidy_type_ids);
                            if (Array.isArray(ids) && ids.length > 0 && allSubsidyTypes.length > 0) {
                                ids.forEach(id => {
                                    const st = allSubsidyTypes.find(s => s.id === id);
                                    if (st) linkedSubsidyNames.push(st.name);
                                });
                            }
                        } catch (e) {
                            console.error('Error parsing subsidy_type_ids:', e);
                        }
                    }
                    
                    content += \`
                                </div>
                            </div>
                            
                            <!-- 紐づいた申請種別 -->
                            <div>
                                <h4 class="font-medium mb-3 flex items-center gap-2">
                                    <i class="fas fa-link text-blue-600"></i>紐づいた申請種別
                                </h4>
                                <div class="flex flex-wrap gap-2">
                                    \${linkedSubsidyNames.length > 0 
                                        ? linkedSubsidyNames.map(name => '<span class="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">' + name + '</span>').join('')
                                        : '<span class="text-gray-500 text-sm">すべての申請種別で利用可能</span>'
                                    }
                                </div>
                            </div>
                            
                            <!-- アクション -->
                            <div class="flex gap-3 pt-4 border-t">
                                <button onclick="editTemplate(\${template.id})" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                                    <i class="fas fa-edit mr-2"></i>編集
                                </button>
                                <button onclick="deleteTemplate(\${template.id})" class="flex-1 bg-red-100 text-red-600 py-2 rounded-lg hover:bg-red-200">
                                    <i class="fas fa-trash mr-2"></i>削除
                                </button>
                            </div>
                        </div>
                    \`;
                    
                    document.getElementById('templateDetailContent').innerHTML = content;
                    document.getElementById('templateDetailModal').classList.remove('hidden');
                    
                } catch (error) {
                    console.error('Error loading template detail:', error);
                    alert('テンプレート詳細の読み込みに失敗しました');
                }
            }
            
            // モーダル操作
            function openNewTemplateModal() {
                document.getElementById('newTemplateForm').reset();
                document.getElementById('tasksList').innerHTML = '';
                taskCounter = 0;
                addTaskRow(); // 最初の1行を追加
                document.getElementById('newTemplateModal').classList.remove('hidden');
                loadUsers();
                loadSubsidyTypesForCheckbox(); // 申請種別のチェックボックスを読み込み
                loadParentPipelineOptions(); // 親パイプライン選択肢を読み込み
                editingTemplateId = null; // 新規作成モードに設定
            }
            
            // 親パイプライン選択肢を読み込む
            async function loadParentPipelineOptions(excludeId = null, selectedParentId = null) {
                try {
                    const response = await axios.get('/api/pipeline-templates');
                    const templates = response.data;
                    
                    const select = document.querySelector('select[name="parent_id"]');
                    select.innerHTML = '<option value="">なし（最上位）</option>';
                    
                    // 親候補になれるテンプレート（自分自身と自分の子孫は除外）
                    templates.filter(t => t.id !== excludeId && !t.parent_id).forEach(t => {
                        const option = document.createElement('option');
                        option.value = t.id;
                        option.textContent = t.name;
                        if (selectedParentId && t.id == selectedParentId) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                } catch (error) {
                    console.error('Error loading parent pipeline options:', error);
                }
            }
            
            // 申請種別一覧を読み込んでチェックボックスを生成
            let allSubsidyTypes = [];
            async function loadSubsidyTypesForCheckbox(selectedIds = []) {
                try {
                    const response = await axios.get('/api/subsidy-types');
                    allSubsidyTypes = response.data;
                    
                    const container = document.getElementById('subsidyTypeCheckboxes');
                    if (!container) return;
                    
                    // カテゴリ別にグループ化
                    const grouped = {
                        'subsidy': [],
                        'grant': [],
                        'license': [],
                        '行政書士管轄': [],
                        '社労士管轄': [],
                        '許認可': []
                    };
                    
                    const categoryLabels = {
                        'subsidy': '補助金',
                        'grant': '助成金',
                        'license': '許認可',
                        '行政書士管轄': '補助金',
                        '社労士管轄': '助成金',
                        '許認可': '許認可'
                    };
                    
                    allSubsidyTypes.forEach(type => {
                        if (type.category === 'システム') return; // システムカテゴリは除外
                        const cat = type.category || 'license';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(type);
                    });
                    
                    let html = '';
                    Object.entries(grouped).forEach(([category, types]) => {
                        if (types.length === 0) return;
                        
                        const label = categoryLabels[category] || category;
                        html += '<div class="col-span-full text-xs font-bold text-gray-500 mt-2 mb-1">' + label + '</div>';
                        
                        types.forEach(type => {
                            const checked = selectedIds.includes(type.id) ? 'checked' : '';
                            html += \`
                                <label class="flex items-center gap-2 p-1.5 rounded hover:bg-blue-100 cursor-pointer text-sm">
                                    <input type="checkbox" name="subsidy_type_ids" value="\${type.id}" \${checked} class="rounded text-blue-600">
                                    <span class="truncate">\${type.name}</span>
                                </label>
                            \`;
                        });
                    });
                    
                    container.innerHTML = html || '<p class="text-gray-500 text-sm">申請種別がありません</p>';
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
            }
            
            // 親パイプライン選択の読み込み
            async function loadParentPipelines(excludeId = null, selectedParentId = null) {
                try {
                    const response = await axios.get('/api/pipeline-templates');
                    const templates = response.data;
                    const select = document.querySelector('select[name="parent_id"]');
                    if (!select) return;
                    
                    select.innerHTML = '<option value="">親パイプラインなし（ルートレベル）</option>';
                    
                    // 親を持たないテンプレートのみを親候補として表示（2階層まで）
                    templates.filter(t => !t.parent_id && t.id !== excludeId).forEach(t => {
                        const selected = selectedParentId === t.id ? 'selected' : '';
                        select.innerHTML += '<option value="' + t.id + '" ' + selected + '>' + t.name + '</option>';
                    });
                } catch (error) {
                    console.error('Error loading parent pipelines:', error);
                }
            }
            
            function closeNewTemplateModal() {
                document.getElementById('newTemplateModal').classList.add('hidden');
            }
            
            function closeTemplateDetailModal() {
                document.getElementById('templateDetailModal').classList.add('hidden');
            }
            
            // ユーザー読み込み
            async function loadUsers() {
                try {
                    const response = await axios.get('/api/admin/users');
                    const users = response.data;
                    const select = document.querySelector('select[name="created_by"]');
                    select.innerHTML = '<option value="">選択してください</option>';
                    users.forEach(u => {
                        select.innerHTML += '<option value="' + u.name + '">' + u.name + '</option>';
                    });
                } catch (error) {
                    console.error('Error loading users:', error);
                }
            }
            
            // テンプレート削除
            async function deleteTemplate(id) {
                if (!confirm('このテンプレートを削除しますか？')) return;
                
                try {
                    await axios.delete('/api/pipeline-templates/' + id);
                    alert('テンプレートを削除しました');
                    closeTemplateDetailModal();
                    loadTemplates();
                } catch (error) {
                    console.error('Error deleting template:', error);
                    alert('削除に失敗しました');
                }
            }
            
            // テンプレート編集
            let editingTemplateId = null;
            
            async function editTemplate(id) {
                try {
                    editingTemplateId = id;
                    const response = await axios.get('/api/pipeline-templates/' + id);
                    const template = response.data;
                    
                    // フォームに値を設定
                    document.querySelector('input[name="name"]').value = template.name;
                    document.querySelector('textarea[name="description"]').value = template.description || '';
                    document.querySelector('select[name="category"]').value = template.category || 'license';
                    document.querySelector('input[name="service_start_offset"]').value = template.service_start_offset || 0;
                    document.querySelector('input[name="service_end_offset"]').value = template.service_end_offset || 30;
                    
                    const progressReflection = document.querySelector('input[name="progress_reflection"]');
                    if (progressReflection) progressReflection.checked = template.progress_reflection;
                    const requiresApproval = document.querySelector('input[name="requires_approval"]');
                    if (requiresApproval) requiresApproval.checked = template.requires_approval;
                    
                    // タスクリストをクリアして再設定
                    document.getElementById('tasksList').innerHTML = '';
                    taskCounter = 0;
                    
                    if (template.tasks && template.tasks.length > 0) {
                        template.tasks.forEach(task => {
                            addTaskRow();
                            const row = document.getElementById('task-row-' + (taskCounter - 1));
                            if (row) {
                                row.querySelector('input[name*="[task_name]"]').value = task.task_name;
                                row.querySelector('select[name*="[task_type]"]').value = task.task_type || 'internal';
                                row.querySelector('select[name*="[is_required]"]').value = task.is_required ? '1' : '0';
                                row.querySelector('input[name*="[days_offset_start]"]').value = task.days_offset_start || 0;
                                row.querySelector('input[name*="[days_offset_end]"]').value = task.days_offset_end || 7;
                                const descInput = row.querySelector('input[name*="[description]"]');
                                if (descInput) descInput.value = task.description || '';
                            }
                        });
                    } else {
                        addTaskRow();
                    }
                    
                    closeTemplateDetailModal();
                    document.getElementById('newTemplateModal').classList.remove('hidden');
                    loadUsers();
                    
                    // 親パイプラインの選択を読み込み（編集中のものを除外）
                    await loadParentPipelines(id, template.parent_id);
                    
                    // 申請種別のチェックボックスを読み込み（選択済みのIDを渡す）
                    let selectedSubsidyIds = [];
                    if (template.subsidy_type_ids) {
                        try {
                            selectedSubsidyIds = JSON.parse(template.subsidy_type_ids);
                        } catch (e) {
                            console.error('Error parsing subsidy_type_ids:', e);
                        }
                    }
                    loadSubsidyTypesForCheckbox(selectedSubsidyIds);
                } catch (error) {
                    console.error('Error loading template for edit:', error);
                    alert('テンプレートの読み込みに失敗しました');
                }
            }
            
            // フォーム送信
            document.getElementById('newTemplateForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                
                // 選択された申請種別IDを収集
                const subsidyTypeIds = [];
                document.querySelectorAll('input[name="subsidy_type_ids"]:checked').forEach(cb => {
                    subsidyTypeIds.push(parseInt(cb.value));
                });
                
                // 親パイプラインID
                const parentIdValue = formData.get('parent_id');
                const parentId = parentIdValue && parentIdValue !== '' ? parseInt(parentIdValue) : null;
                
                const data = {
                    name: formData.get('name'),
                    description: formData.get('description'),
                    category: formData.get('category'),
                    parent_id: parentId,
                    service_start_offset: parseInt(formData.get('service_start_offset')) || 0,
                    service_end_offset: parseInt(formData.get('service_end_offset')) || 30,
                    progress_reflection: formData.get('progress_reflection') === 'on',
                    allow_external_tasks: true,  // デフォルトで許可
                    requires_approval: formData.get('requires_approval') === 'on',
                    created_by: formData.get('created_by'),
                    subsidy_type_ids: subsidyTypeIds.length > 0 ? subsidyTypeIds : null,
                    tasks: []
                };
                
                // タスクを収集
                const taskRows = document.querySelectorAll('[id^="task-row-"]');
                taskRows.forEach(row => {
                    const taskName = row.querySelector('input[name*="[task_name]"]')?.value;
                    if (taskName) {
                        data.tasks.push({
                            task_name: taskName,
                            task_type: row.querySelector('select[name*="[task_type]"]')?.value || 'internal',
                            is_required: row.querySelector('select[name*="[is_required]"]')?.value === '1',
                            days_offset_start: parseInt(row.querySelector('input[name*="[days_offset_start]"]')?.value) || 0,
                            days_offset_end: parseInt(row.querySelector('input[name*="[days_offset_end]"]')?.value) || 7,
                            description: row.querySelector('input[name*="[description]"]')?.value || ''
                        });
                    }
                });
                
                try {
                    let response;
                    if (editingTemplateId) {
                        response = await axios.put('/api/pipeline-templates/' + editingTemplateId, data);
                    } else {
                        response = await axios.post('/api/pipeline-templates', data);
                    }
                    
                    // APIからのレスポンスを確認
                    if (response.data && response.data.success === false) {
                        console.error('API error:', response.data.error);
                        alert('保存に失敗しました: ' + (response.data.error || '不明なエラー'));
                        return;
                    }
                    
                    alert(editingTemplateId ? 'テンプレートを更新しました' : 'テンプレートを作成しました');
                    editingTemplateId = null;
                    closeNewTemplateModal();
                    loadTemplates();
                } catch (error) {
                    console.error('Error saving template:', error);
                    const errorMsg = error.response?.data?.error || error.message || '不明なエラー';
                    alert('保存に失敗しました: ' + errorMsg);
                }
            });
            
            // モーダルを閉じる時にeditingTemplateIdをリセット
            const originalCloseNewTemplateModal = closeNewTemplateModal;
            closeNewTemplateModal = function() {
                editingTemplateId = null;
                originalCloseNewTemplateModal();
            };
            
            // タスク添付ファイルのアップロード処理
            async function handleTaskFileUpload(taskId) {
                const fileInput = document.getElementById('taskFile' + taskId);
                const file = fileInput.files[0];
                if (!file) return;
                
                // ファイルサイズ制限（10MB）
                if (file.size > 10 * 1024 * 1024) {
                    showToast('ファイルサイズは10MB以下にしてください', 'error');
                    return;
                }
                
                try {
                    showToast('アップロード中...');
                    
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('upload_type', 'pipeline_attachment');
                    
                    const response = await axios.post('/api/documents/upload-file', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    });
                    
                    if (response.data.success && response.data.url) {
                        // フォームのhidden inputを更新
                        const row = document.getElementById('task-row-' + taskId);
                        row.querySelector('input[name$="[attachment_url]"]').value = response.data.url;
                        row.querySelector('input[name$="[attachment_name]"]').value = file.name;
                        
                        // ファイル名表示も更新（読み取り専用フィールド）
                        const fileNameInput = row.querySelector('input[placeholder="ファイル名"]');
                        if (fileNameInput) {
                            fileNameInput.value = file.name;
                            fileNameInput.classList.remove('bg-gray-50');
                            fileNameInput.classList.add('bg-green-50');
                        }
                        
                        showToast('✓ ' + file.name + ' をアップロードしました');
                    } else {
                        showToast('アップロードに失敗しました: ' + (response.data.error || '不明なエラー'), 'error');
                    }
                } catch (error) {
                    console.error('File upload error:', error);
                    const errorMsg = error.response?.data?.error || error.message || '不明なエラー';
                    showToast('アップロードに失敗しました: ' + errorMsg, 'error');
                }
            }
            
            function clearTaskAttachment(taskId) {
                const row = document.getElementById('task-row-' + taskId);
                row.querySelector('input[name$="[attachment_url]"]').value = '';
                row.querySelector('input[name$="[attachment_name]"]').value = '';
                
                const fileNameInput = row.querySelector('input[placeholder="ファイル名"]');
                if (fileNameInput) {
                    fileNameInput.value = '';
                    fileNameInput.classList.remove('bg-green-50');
                    fileNameInput.classList.add('bg-gray-50');
                }
                
                showToast('添付ファイルを削除しました');
            }
            
            // グローバルスコープに関数を公開（onclick対応）
            window.toggleSidebar = toggleSidebar;
            window.openNewTemplateModal = openNewTemplateModal;
            window.closeNewTemplateModal = closeNewTemplateModal;
            window.addTaskRow = addTaskRow;
            window.removeTaskRow = removeTaskRow;
            window.closeTemplateDetailModal = closeTemplateDetailModal;
            window.showTemplateDetail = showTemplateDetail;
            window.editTemplate = editTemplate;
            window.deleteTemplate = deleteTemplate;
            window.handleTaskFileUpload = handleTaskFileUpload;
            window.clearTaskAttachment = clearTaskAttachment;
            
            // 初期読み込み
            loadTemplates();
            loadSubsidyTypesForCheckbox(); // 申請種別リストを事前に読み込み
        </script>
    </body>
    </html>
  `)
})

export default routes
