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
            <main class="flex-1 min-h-screen lg:ml-56">
                <!-- パンくずリスト -->
                <div class="bg-white px-4 py-1.5 border-b text-xs" id="breadcrumb">
                    <a href="/" class="text-blue-600 hover:text-blue-800 hover:underline">ダッシュボード</a>
                    <i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>
                    <a href="/subsidy-types" class="text-blue-600 hover:text-blue-800 hover:underline">申請種別</a>
                    <i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>
                    <span class="text-gray-800 font-medium">パイプライン管理</span>
                </div>
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
                                <i class="fas fa-plus mr-2"></i>カスタムテンプレート作成
                            </button>
                        </div>
                    </div>
                </header>
                
                <div class="p-4 lg:p-6 space-y-6">
                    <!-- 説明カード -->
                    <div class="bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <h3 class="font-bold text-blue-800 mb-2 flex items-center gap-2">
                            <i class="fas fa-info-circle"></i>パイプラインテンプレートの使い方
                        </h3>
                        <div class="text-sm text-blue-700 space-y-1">
                            <p>• <span class="font-medium">標準テンプレート</span>：すべての組織で共有されるテンプレート。そのまま使用するか、複製してカスタマイズできます</p>
                            <p>• <span class="font-medium">カスタムテンプレート</span>：自社専用のテンプレート。自由に編集・削除できます</p>
                        </div>
                    </div>
                    
                    <!-- フィルター -->
                    <div class="flex items-center gap-3 flex-wrap">
                        <label class="flex items-center gap-2 text-sm">
                            <input type="checkbox" id="treeViewToggle" onchange="loadAllTemplates()" class="rounded text-blue-600" checked>
                            <span>ツリー表示</span>
                        </label>
                        <select id="filterCategory" onchange="loadAllTemplates()" class="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                            <option value="">すべてのカテゴリ</option>
                            <option value="subsidy">行政書士管轄</option>
                            <option value="grant">社労士管轄</option>
                            <option value="license">許認可</option>
                        </select>
                    </div>
                    
                    <!-- 標準テンプレート一覧 -->
                    <div class="bg-white rounded-xl shadow-sm">
                        <div class="p-4 border-b border-gray-100 bg-yellow-50">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-star text-yellow-500"></i>
                                <h3 class="text-base font-bold text-gray-800">標準テンプレート</h3>
                                <span class="text-xs text-gray-500">（そのまま使用 or 複製してカスタマイズ）</span>
                            </div>
                        </div>
                        <div id="masterTemplatesList" class="divide-y divide-gray-100">
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                <div>読み込み中...</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- カスタムテンプレート一覧 -->
                    <div class="bg-white rounded-xl shadow-sm">
                        <div class="p-4 border-b border-gray-100 bg-green-50">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <i class="fas fa-edit text-green-600"></i>
                                    <h3 class="text-base font-bold text-gray-800">カスタムテンプレート</h3>
                                    <span class="text-xs text-gray-500">（自社専用、自由に編集可能）</span>
                                </div>
                                <button onclick="openNewTemplateModal()" class="text-green-600 hover:text-green-700 text-sm">
                                    <i class="fas fa-plus mr-1"></i>新規作成
                                </button>
                            </div>
                        </div>
                        <div id="orgTemplatesList" class="divide-y divide-gray-100">
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
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
                        <h3 class="text-xl font-bold" id="modalTitle">新規カスタムテンプレート作成</h3>
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
                        </div>
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
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${sidebarScripts}
        </script>
        <script>
            // showToast は sidebarScripts 共通版を使用
            
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
                    </div>
                \`;
                
                container.appendChild(row);
            }
            
            function removeTaskRow(id) {
                const row = document.getElementById('task-row-' + id);
                if (row) row.remove();
            }
            
            // 全テンプレート読み込み
            async function loadAllTemplates() {
                await Promise.all([
                    loadMasterTemplates(),
                    loadOrgTemplates()
                ]);
            }
            
            // マスターテンプレート読み込み
            async function loadMasterTemplates() {
                try {
                    const category = document.getElementById('filterCategory').value;
                    const treeMode = document.getElementById('treeViewToggle')?.checked;
                    let url = '/api/pipeline-templates?tree=' + (treeMode ? 'true' : 'false') + '&master_only=true';
                    if (category) {
                        url += '&category=' + category;
                    }
                    
                    const response = await axios.get(url);
                    const templates = response.data;
                    
                    const container = document.getElementById('masterTemplatesList');
                    
                    if (templates.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-folder-open text-3xl mb-2 text-gray-300"></i>
                                <p>標準テンプレートがありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    renderTemplates(container, templates, true);
                    
                } catch (error) {
                    console.error('Error loading master templates:', error);
                    document.getElementById('masterTemplatesList').innerHTML = \`
                        <div class="text-center py-8 text-red-500">
                            <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                            <p>読み込みエラー</p>
                        </div>
                    \`;
                }
            }
            
            // 組織テンプレート読み込み
            async function loadOrgTemplates() {
                try {
                    const category = document.getElementById('filterCategory').value;
                    const treeMode = document.getElementById('treeViewToggle')?.checked;
                    let url = '/api/pipeline-templates?tree=' + (treeMode ? 'true' : 'false') + '&org_only=true';
                    if (category) {
                        url += '&category=' + category;
                    }
                    
                    const response = await axios.get(url);
                    const templates = response.data;
                    
                    const container = document.getElementById('orgTemplatesList');
                    
                    if (templates.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-folder-open text-3xl mb-2 text-gray-300"></i>
                                <p>カスタムテンプレートがありません</p>
                                <p class="text-sm mt-1">標準テンプレートを複製するか、新規作成してください</p>
                                <button onclick="openNewTemplateModal()" class="mt-3 text-green-600 hover:text-green-700">
                                    <i class="fas fa-plus mr-1"></i>新規作成
                                </button>
                            </div>
                        \`;
                        return;
                    }
                    
                    renderTemplates(container, templates, false);
                    
                } catch (error) {
                    console.error('Error loading org templates:', error);
                    document.getElementById('orgTemplatesList').innerHTML = \`
                        <div class="text-center py-8 text-red-500">
                            <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                            <p>読み込みエラー</p>
                        </div>
                    \`;
                }
            }
            
            // テンプレート描画
            function renderTemplates(container, templates, isMaster) {
                const treeMode = document.getElementById('treeViewToggle')?.checked;
                
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
                
                // ツリー開閉状態を管理
                const stateKey = isMaster ? 'masterPipelineTreeState' : 'orgPipelineTreeState';
                const treeState = JSON.parse(localStorage.getItem(stateKey) || '{}');
                
                window['toggleTreeItem' + (isMaster ? 'Master' : 'Org')] = function(itemId) {
                    const childrenDiv = document.getElementById((isMaster ? 'master-' : 'org-') + 'children-' + itemId);
                    const toggleIcon = document.getElementById((isMaster ? 'master-' : 'org-') + 'toggle-' + itemId);
                    if (childrenDiv && toggleIcon) {
                        const isHidden = childrenDiv.classList.contains('hidden');
                        if (isHidden) {
                            childrenDiv.classList.remove('hidden');
                            toggleIcon.classList.remove('fa-chevron-right');
                            toggleIcon.classList.add('fa-chevron-down');
                            treeState[itemId] = true;
                        } else {
                            childrenDiv.classList.add('hidden');
                            toggleIcon.classList.remove('fa-chevron-down');
                            toggleIcon.classList.add('fa-chevron-right');
                            treeState[itemId] = false;
                        }
                        localStorage.setItem(stateKey, JSON.stringify(treeState));
                    }
                };
                
                // ツリー表示のヘルパー関数
                function renderTreeItem(item, config, depth = 0) {
                    const indent = depth * 24;
                    const hasChildren = item.children && item.children.length > 0;
                    const isChild = depth > 0;
                    const canAddChild = depth < 1 && !isMaster;
                    const isExpanded = treeState[item.id] !== false;
                    const prefix = isMaster ? 'master-' : 'org-';
                    const toggleFn = isMaster ? 'toggleTreeItemMaster' : 'toggleTreeItemOrg';
                    
                    let html = \`
                        <div class="p-3 hover:bg-gray-50 group" style="padding-left: \${16 + indent}px">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2 flex-1">
                                    \${hasChildren ? \`
                                        <button onclick="event.stopPropagation(); \${toggleFn}(\${item.id})" 
                                                class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                                            <i id="\${prefix}toggle-\${item.id}" class="fas \${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs"></i>
                                        </button>
                                    \` : '<div class="w-6"></div>'}
                                    <div class="flex items-center gap-3 cursor-pointer flex-1" onclick="showTemplateDetail(\${item.id}, \${isMaster})">
                                        \${isChild ? '<i class="fas fa-level-up-alt fa-rotate-90 text-gray-300 text-xs mr-1"></i>' : ''}
                                        <div class="w-8 h-8 rounded-lg \${config.itemBgClass} flex items-center justify-center \${config.itemIconClass}">
                                            <i class="fas \${hasChildren ? 'fa-folder' : 'fa-project-diagram'} text-sm"></i>
                                        </div>
                                        <div>
                                            <div class="font-medium text-gray-900 \${isChild ? 'text-sm' : ''} flex items-center gap-2">
                                                \${item.name}
                                                \${isMaster ? '<span class="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800"><i class="fas fa-star text-xs mr-1"></i>標準</span>' : ''}
                                            </div>
                                            <div class="text-xs text-gray-500 line-clamp-1">\${item.description || ''}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    \${hasChildren ? '<span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">' + item.children.length + '子</span>' : ''}
                                    <span class="text-sm text-gray-500">\${item.task_count || 0}タスク</span>
                                    \${isMaster ? \`
                                        <button onclick="event.stopPropagation(); duplicateToOrg(\${item.id})" 
                                                class="w-7 h-7 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center"
                                                title="カスタマイズして使用">
                                            <i class="fas fa-copy text-xs"></i>
                                        </button>
                                    \` : \`
                                        \${canAddChild ? \`
                                            <button onclick="event.stopPropagation(); createChildPipeline(\${item.id})" 
                                                    class="w-7 h-7 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center"
                                                    title="子パイプラインを追加">
                                                <i class="fas fa-plus text-xs"></i>
                                            </button>
                                        \` : ''}
                                        <button onclick="event.stopPropagation(); duplicatePipeline(\${item.id})" 
                                                class="w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center"
                                                title="複製">
                                            <i class="fas fa-copy text-xs"></i>
                                        </button>
                                    \`}
                                    <i class="fas fa-chevron-right text-gray-400 cursor-pointer" onclick="showTemplateDetail(\${item.id}, \${isMaster})"></i>
                                </div>
                            </div>
                        </div>
                    \`;
                    
                    if (hasChildren) {
                        html += \`<div id="\${prefix}children-\${item.id}" class="\${isExpanded ? '' : 'hidden'}">\`;
                        item.children.forEach(child => {
                            html += renderTreeItem(child, config, depth + 1);
                        });
                        html += '</div>';
                    }
                    
                    return html;
                }
                
                // カテゴリ別にグループ化
                const grouped = {};
                templates.forEach(t => {
                    const cat = t.category || 'license';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(t);
                });
                
                const categoryOrder = ['subsidy', 'grant', 'license'];
                
                let html = '';
                categoryOrder.forEach(catKey => {
                    const items = grouped[catKey];
                    if (!items || items.length === 0) return;
                    
                    const config = categoryConfig[catKey] || categoryConfig['license'];
                    
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
                        <div class="mb-4 last:mb-0">
                            <div class="flex items-center gap-3 px-4 py-2 \${config.headerClass} border-l-4 rounded-r-lg">
                                <i class="fas \${config.icon} \${config.iconClass} text-sm"></i>
                                <h4 class="font-medium text-sm \${config.titleClass}">\${config.label}</h4>
                                <span class="ml-auto text-xs \${config.countClass}">\${totalCount}件</span>
                            </div>
                            <div class="divide-y divide-gray-100 ml-4 border-l-2 border-gray-200">
                                \${treeMode 
                                    ? items.map(t => renderTreeItem(t, config, 0)).join('')
                                    : items.map(t => \`
                                        <div class="p-3 hover:bg-gray-50 group pl-6">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-3 cursor-pointer flex-1" onclick="showTemplateDetail(\${t.id}, \${isMaster})">
                                                    <div class="w-8 h-8 rounded-lg \${config.itemBgClass} flex items-center justify-center \${config.itemIconClass}">
                                                        <i class="fas fa-project-diagram text-sm"></i>
                                                    </div>
                                                    <div>
                                                        <div class="font-medium text-gray-900 flex items-center gap-2">
                                                            \${t.name}
                                                            \${isMaster ? '<span class="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800"><i class="fas fa-star text-xs mr-1"></i>標準</span>' : ''}
                                                        </div>
                                                        <div class="text-xs text-gray-500 line-clamp-1">\${t.description || ''}</div>
                                                    </div>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <span class="text-sm text-gray-500">\${t.task_count || 0}タスク</span>
                                                    \${isMaster ? \`
                                                        <button onclick="event.stopPropagation(); duplicateToOrg(\${t.id})" 
                                                                class="w-7 h-7 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center"
                                                                title="カスタマイズして使用">
                                                            <i class="fas fa-copy text-xs"></i>
                                                        </button>
                                                    \` : \`
                                                        <button onclick="event.stopPropagation(); duplicatePipeline(\${t.id})" 
                                                                class="w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center"
                                                                title="複製">
                                                            <i class="fas fa-copy text-xs"></i>
                                                        </button>
                                                    \`}
                                                    <i class="fas fa-chevron-right text-gray-400 cursor-pointer" onclick="showTemplateDetail(\${t.id}, \${isMaster})"></i>
                                                </div>
                                            </div>
                                        </div>
                                    \`).join('')
                                }
                            </div>
                        </div>
                    \`;
                });
                
                container.innerHTML = html || '<div class="text-center py-8 text-gray-500">テンプレートがありません</div>';
            }
            
            // マスターテンプレートを組織用に複製
            async function duplicateToOrg(templateId) {
                if (!confirm('このテンプレートをカスタムテンプレートとして複製しますか？\\n複製後、自由に編集できます。')) return;
                
                try {
                    const response = await axios.post('/api/pipeline-templates/' + templateId + '/duplicate');
                    
                    if (response.data.success !== false) {
                        showToast('テンプレートを複製しました。編集画面を開きます。');
                        setTimeout(() => {
                            editTemplate(response.data.id);
                        }, 500);
                        loadAllTemplates();
                    } else {
                        alert('複製に失敗しました: ' + (response.data.error || '不明なエラー'));
                    }
                } catch (error) {
                    console.error('Error duplicating template:', error);
                    alert('複製に失敗しました');
                }
            }
            
            // 組織テンプレートを複製
            async function duplicatePipeline(templateId) {
                try {
                    const response = await axios.get('/api/pipeline-templates/' + templateId);
                    const original = response.data;
                    
                    const copyData = {
                        name: original.name + '（コピー）',
                        description: original.description || '',
                        category: original.category,
                        parent_id: null,
                        service_start_offset: original.service_start_offset || 0,
                        service_end_offset: original.service_end_offset || 30,
                        progress_reflection: original.progress_reflection,
                        allow_external_tasks: original.allow_external_tasks,
                        requires_approval: original.requires_approval,
                        subsidy_type_ids: original.subsidy_type_ids ? JSON.parse(original.subsidy_type_ids) : null,
                        tasks: (original.tasks || []).map(t => ({
                            task_name: t.task_name,
                            task_type: t.task_type,
                            description: t.description,
                            days_offset_start: t.days_offset_start,
                            days_offset_end: t.days_offset_end,
                            is_required: t.is_required
                        }))
                    };
                    
                    const createResponse = await axios.post('/api/pipeline-templates', copyData);
                    
                    if (createResponse.data.success !== false) {
                        showToast('パイプラインを複製しました。編集画面を開きます。');
                        setTimeout(() => {
                            editTemplate(createResponse.data.id);
                        }, 500);
                        loadAllTemplates();
                    }
                } catch (error) {
                    console.error('Error duplicating pipeline:', error);
                    alert('パイプラインの複製に失敗しました');
                }
            }
            
            // 子パイプラインを作成
            async function createChildPipeline(parentId) {
                try {
                    const response = await axios.get('/api/pipeline-templates/' + parentId);
                    const parent = response.data;
                    
                    const childData = {
                        name: parent.name + '（バリエーション）',
                        description: parent.description || '',
                        category: parent.category,
                        parent_id: parentId,
                        service_start_offset: parent.service_start_offset || 0,
                        service_end_offset: parent.service_end_offset || 30,
                        progress_reflection: parent.progress_reflection,
                        allow_external_tasks: parent.allow_external_tasks,
                        requires_approval: parent.requires_approval,
                        subsidy_type_ids: parent.subsidy_type_ids ? JSON.parse(parent.subsidy_type_ids) : null,
                        tasks: (parent.tasks || []).map(t => ({
                            task_name: t.task_name,
                            task_type: t.task_type,
                            description: t.description,
                            days_offset_start: t.days_offset_start,
                            days_offset_end: t.days_offset_end,
                            is_required: t.is_required
                        }))
                    };
                    
                    const createResponse = await axios.post('/api/pipeline-templates', childData);
                    
                    if (createResponse.data.success !== false) {
                        showToast('子パイプラインを作成しました。編集画面を開きます。');
                        setTimeout(() => {
                            editTemplate(createResponse.data.id);
                        }, 500);
                        loadAllTemplates();
                    }
                } catch (error) {
                    console.error('Error creating child pipeline:', error);
                    alert('子パイプラインの作成に失敗しました');
                }
            }
            
            // テンプレート詳細表示
            async function showTemplateDetail(id, isMaster = false) {
                try {
                    const response = await axios.get('/api/pipeline-templates/' + id);
                    const template = response.data;
                    
                    document.getElementById('templateDetailTitle').textContent = template.name;
                    
                    const categoryLabels = {
                        'subsidy': { label: '行政書士管轄', color: 'bg-emerald-100 text-emerald-800' },
                        'grant': { label: '社労士管轄', color: 'bg-blue-100 text-blue-800' },
                        'license': { label: '許認可', color: 'bg-indigo-100 text-indigo-800' }
                    };
                    const cat = categoryLabels[template.category] || categoryLabels['license'];
                    
                    const taskTypeLabels = {
                        'internal': { label: '自社', color: 'bg-purple-100 text-purple-800' },
                        'external': { label: '顧客', color: 'bg-orange-100 text-orange-800' },
                        'both': { label: '両方', color: 'bg-gray-100 text-gray-800' }
                    };
                    
                    let content = \`
                        <div class="space-y-6">
                            \${isMaster ? \`
                                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <div class="flex items-center gap-2 text-yellow-800">
                                        <i class="fas fa-star"></i>
                                        <span class="font-medium">標準テンプレート</span>
                                    </div>
                                    <p class="text-sm text-yellow-700 mt-1">このテンプレートは編集できません。「カスタマイズして使用」で複製してください。</p>
                                </div>
                            \` : ''}
                            
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
                    
                    content += \`
                                </div>
                            </div>
                            
                            <!-- アクション -->
                            <div class="flex gap-3 pt-4 border-t">
                                \${isMaster ? \`
                                    <button onclick="duplicateToOrg(\${template.id}); closeTemplateDetailModal();" class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                                        <i class="fas fa-copy mr-2"></i>カスタマイズして使用
                                    </button>
                                \` : \`
                                    <button onclick="editTemplate(\${template.id})" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                                        <i class="fas fa-edit mr-2"></i>編集
                                    </button>
                                    <button onclick="deleteTemplate(\${template.id})" class="flex-1 bg-red-100 text-red-600 py-2 rounded-lg hover:bg-red-200">
                                        <i class="fas fa-trash mr-2"></i>削除
                                    </button>
                                \`}
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
                document.getElementById('modalTitle').textContent = '新規カスタムテンプレート作成';
                taskCounter = 0;
                addTaskRow();
                document.getElementById('newTemplateModal').classList.remove('hidden');
                loadUsers();
                loadSubsidyTypesForCheckbox();
                loadParentPipelineOptions();
                editingTemplateId = null;
            }
            
            // 親パイプライン選択肢を読み込む（組織テンプレートのみ）
            async function loadParentPipelineOptions(excludeId = null, selectedParentId = null) {
                try {
                    const response = await axios.get('/api/pipeline-templates?org_only=true');
                    const templates = response.data;
                    
                    const select = document.querySelector('select[name="parent_id"]');
                    select.innerHTML = '<option value="">なし（最上位）</option>';
                    
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
                    
                    const grouped = { 'subsidy': [], 'grant': [], 'license': [] };
                    const categoryLabels = { 'subsidy': '補助金', 'grant': '助成金', 'license': '許認可' };
                    
                    allSubsidyTypes.forEach(type => {
                        if (type.category === 'システム') return;
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
                    showToast('テンプレートを削除しました');
                    closeTemplateDetailModal();
                    loadAllTemplates();
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
                    
                    // マスターテンプレートは編集不可
                    if (template.is_master_template) {
                        alert('標準テンプレートは編集できません。「カスタマイズして使用」で複製してください。');
                        return;
                    }
                    
                    document.getElementById('modalTitle').textContent = 'カスタムテンプレート編集';
                    document.querySelector('input[name="name"]').value = template.name;
                    document.querySelector('textarea[name="description"]').value = template.description || '';
                    document.querySelector('select[name="category"]').value = template.category || 'license';
                    document.querySelector('input[name="service_start_offset"]').value = template.service_start_offset || 0;
                    document.querySelector('input[name="service_end_offset"]').value = template.service_end_offset || 30;
                    
                    const progressReflection = document.querySelector('input[name="progress_reflection"]');
                    if (progressReflection) progressReflection.checked = template.progress_reflection;
                    const requiresApproval = document.querySelector('input[name="requires_approval"]');
                    if (requiresApproval) requiresApproval.checked = template.requires_approval;
                    
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
                    
                    await loadParentPipelineOptions(id, template.parent_id);
                    
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
                
                const subsidyTypeIds = [];
                document.querySelectorAll('input[name="subsidy_type_ids"]:checked').forEach(cb => {
                    subsidyTypeIds.push(parseInt(cb.value));
                });
                
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
                    allow_external_tasks: true,
                    requires_approval: formData.get('requires_approval') === 'on',
                    created_by: formData.get('created_by'),
                    subsidy_type_ids: subsidyTypeIds.length > 0 ? subsidyTypeIds : null,
                    is_master_template: false,  // 組織テンプレート
                    tasks: []
                };
                
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
                    
                    if (response.data && response.data.success === false) {
                        console.error('API error:', response.data.error);
                        alert('保存に失敗しました: ' + (response.data.error || '不明なエラー'));
                        return;
                    }
                    
                    showToast(editingTemplateId ? 'テンプレートを更新しました' : 'テンプレートを作成しました');
                    editingTemplateId = null;
                    closeNewTemplateModal();
                    loadAllTemplates();
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
            
            // グローバルスコープに関数を公開
            window.toggleSidebar = toggleSidebar;
            window.openNewTemplateModal = openNewTemplateModal;
            window.closeNewTemplateModal = closeNewTemplateModal;
            window.addTaskRow = addTaskRow;
            window.removeTaskRow = removeTaskRow;
            window.closeTemplateDetailModal = closeTemplateDetailModal;
            window.showTemplateDetail = showTemplateDetail;
            window.editTemplate = editTemplate;
            window.deleteTemplate = deleteTemplate;
            window.createChildPipeline = createChildPipeline;
            window.duplicatePipeline = duplicatePipeline;
            window.duplicateToOrg = duplicateToOrg;
            
            // 初期読み込み
            loadAllTemplates();
            loadSubsidyTypesForCheckbox();
        </script>
    </body>
    </html>
  `)
})

export default routes
