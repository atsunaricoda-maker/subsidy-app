// マスター管理: 補助金種別管理ページ
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'

const routes = new Hono<AppEnv>()

// 補助金種別一覧ページ
routes.get('/master/subsidy-types', async (c) => {
  const sidebar = generateMasterSidebar('subsidy-types')
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>補助金種別管理 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
        <style>
            .sidebar-link.active { background: rgba(59, 130, 246, 0.5); }
            .category-badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 9999px; }
            .category-subsidy { background: #dbeafe; color: #1e40af; }
            .category-grant { background: #dcfce7; color: #166534; }
            .category-license { background: #fef3c7; color: #92400e; }
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${sidebar}
            
            <main class="flex-1 lg:ml-0">
                <header class="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="text-2xl font-bold text-gray-800">補助金種別管理</h1>
                            <p class="text-sm text-gray-500 mt-1">システム全体の補助金・助成金・許認可種別を管理</p>
                        </div>
                        <button onclick="openAddModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                            <i class="fas fa-plus"></i>
                            <span>種別を追加</span>
                        </button>
                    </div>
                </header>
                
                <div class="p-6">
                    <!-- フィルター -->
                    <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
                        <div class="flex flex-wrap gap-4 items-center">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                                <select id="categoryFilter" onchange="loadSubsidyTypes()" class="border border-gray-300 rounded-lg px-3 py-2">
                                    <option value="">すべて</option>
                                    <option value="行政書士管轄">補助金（行政書士管轄）</option>
                                    <option value="社労士管轄">助成金（社労士管轄）</option>
                                    <option value="許認可">許認可</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">検索</label>
                                <input type="text" id="searchInput" onkeyup="filterTable()" placeholder="名称で検索..." class="border border-gray-300 rounded-lg px-3 py-2 w-64">
                            </div>
                            <div class="ml-auto flex items-end gap-2">
                                <span id="totalCount" class="text-sm text-gray-500"></span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 補助金種別一覧 -->
                    <div class="bg-white rounded-lg shadow-sm overflow-hidden">
                        <table class="w-full">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">カテゴリ</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">説明</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">作成日</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                                </tr>
                            </thead>
                            <tbody id="subsidyTypesTable" class="divide-y divide-gray-200">
                                <tr>
                                    <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                                        <i class="fas fa-spinner fa-spin mr-2"></i>読み込み中...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- 追加/編集モーダル -->
        <div id="subsidyTypeModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
            <div class="bg-white rounded-lg w-full max-w-lg mx-4">
                <div class="p-6 border-b">
                    <h3 id="modalTitle" class="text-lg font-bold">補助金種別を追加</h3>
                </div>
                <form id="subsidyTypeForm" onsubmit="saveSubsidyType(event)">
                    <div class="p-6 space-y-4">
                        <input type="hidden" id="editId">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">名称 <span class="text-red-500">*</span></label>
                            <input type="text" id="typeName" required class="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="例: IT導入補助金">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">カテゴリ <span class="text-red-500">*</span></label>
                            <select id="typeCategory" required class="w-full border border-gray-300 rounded-lg px-3 py-2">
                                <option value="">選択してください</option>
                                <option value="行政書士管轄">補助金（行政書士管轄）</option>
                                <option value="社労士管轄">助成金（社労士管轄）</option>
                                <option value="許認可">許認可</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">説明</label>
                            <textarea id="typeDescription" rows="3" class="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="この補助金種別の説明"></textarea>
                        </div>
                    </div>
                    <div class="p-6 border-t bg-gray-50 flex justify-end gap-3">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">キャンセル</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存</button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- 必要書類管理モーダル -->
        <div id="documentsModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
            <div class="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                <div class="p-6 border-b flex-shrink-0">
                    <h3 class="text-lg font-bold">必要書類管理</h3>
                    <p id="documentsSubsidyName" class="text-sm text-gray-500 mt-1"></p>
                </div>
                <div class="p-6 flex-1 overflow-y-auto">
                    <div class="mb-4">
                        <button onclick="openAddDocumentModal()" class="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <i class="fas fa-plus"></i>
                            <span>必要書類を追加</span>
                        </button>
                    </div>
                    <div id="documentsList" class="space-y-2">
                        <div class="text-center text-gray-500 py-4">読み込み中...</div>
                    </div>
                </div>
                <div class="p-6 border-t bg-gray-50 flex-shrink-0">
                    <button onclick="closeDocumentsModal()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">閉じる</button>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <script>
            ${masterSidebarScripts()}
            
            let allSubsidyTypes = [];
            let currentSubsidyTypeId = null;
            
            async function loadSubsidyTypes() {
                try {
                    const category = document.getElementById('categoryFilter').value;
                    let url = '/api/master/subsidy-types';
                    if (category) {
                        url += '?category=' + encodeURIComponent(category);
                    }
                    
                    const res = await axios.get(url);
                    allSubsidyTypes = res.data;
                    renderTable(allSubsidyTypes);
                } catch (err) {
                    console.error('Load error:', err);
                    document.getElementById('subsidyTypesTable').innerHTML = \`
                        <tr>
                            <td colspan="6" class="px-4 py-8 text-center text-red-500">
                                <i class="fas fa-exclamation-circle mr-2"></i>データの読み込みに失敗しました
                            </td>
                        </tr>
                    \`;
                }
            }
            
            function renderTable(data) {
                const tbody = document.getElementById('subsidyTypesTable');
                document.getElementById('totalCount').textContent = \`全 \${data.length} 件\`;
                
                if (data.length === 0) {
                    tbody.innerHTML = \`
                        <tr>
                            <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                                データがありません
                            </td>
                        </tr>
                    \`;
                    return;
                }
                
                tbody.innerHTML = data.map(item => \`
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm text-gray-600">\${item.id}</td>
                        <td class="px-4 py-3">
                            <div class="font-medium text-gray-900">\${item.name}</div>
                        </td>
                        <td class="px-4 py-3">
                            <span class="category-badge \${getCategoryClass(item.category)}">\${item.category || '未分類'}</span>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">\${item.description || '-'}</td>
                        <td class="px-4 py-3 text-sm text-gray-600">\${item.created_at ? new Date(item.created_at).toLocaleDateString('ja-JP') : '-'}</td>
                        <td class="px-4 py-3 text-center">
                            <div class="flex items-center justify-center gap-2">
                                <button onclick="openDocumentsModal(\${item.id}, '\${item.name}')" class="text-green-600 hover:text-green-800" title="必要書類">
                                    <i class="fas fa-file-alt"></i>
                                </button>
                                <button onclick="editSubsidyType(\${item.id})" class="text-blue-600 hover:text-blue-800" title="編集">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="deleteSubsidyType(\${item.id}, '\${item.name}')" class="text-red-600 hover:text-red-800" title="削除">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                \`).join('');
            }
            
            function getCategoryClass(category) {
                if (!category) return '';
                if (category.includes('行政書士') || category === 'subsidy' || category.includes('補助金')) return 'category-subsidy';
                if (category.includes('社労士') || category === 'grant' || category.includes('助成金')) return 'category-grant';
                if (category.includes('許認可') || category === 'license') return 'category-license';
                return '';
            }
            
            function filterTable() {
                const search = document.getElementById('searchInput').value.toLowerCase();
                const filtered = allSubsidyTypes.filter(item => 
                    item.name.toLowerCase().includes(search) ||
                    (item.description && item.description.toLowerCase().includes(search))
                );
                renderTable(filtered);
            }
            
            function openAddModal() {
                document.getElementById('modalTitle').textContent = '補助金種別を追加';
                document.getElementById('editId').value = '';
                document.getElementById('typeName').value = '';
                document.getElementById('typeCategory').value = '';
                document.getElementById('typeDescription').value = '';
                document.getElementById('subsidyTypeModal').classList.remove('hidden');
            }
            
            async function editSubsidyType(id) {
                try {
                    const res = await axios.get('/api/subsidy-types/' + id);
                    const item = res.data;
                    
                    document.getElementById('modalTitle').textContent = '補助金種別を編集';
                    document.getElementById('editId').value = item.id;
                    document.getElementById('typeName').value = item.name;
                    document.getElementById('typeCategory').value = item.category || '';
                    document.getElementById('typeDescription').value = item.description || '';
                    document.getElementById('subsidyTypeModal').classList.remove('hidden');
                } catch (err) {
                    alert('データの取得に失敗しました');
                }
            }
            
            function closeModal() {
                document.getElementById('subsidyTypeModal').classList.add('hidden');
            }
            
            async function saveSubsidyType(e) {
                e.preventDefault();
                const id = document.getElementById('editId').value;
                const data = {
                    name: document.getElementById('typeName').value,
                    category: document.getElementById('typeCategory').value,
                    description: document.getElementById('typeDescription').value
                };
                
                try {
                    if (id) {
                        await axios.put('/api/master/subsidy-types/' + id, data);
                    } else {
                        await axios.post('/api/master/subsidy-types', data);
                    }
                    closeModal();
                    loadSubsidyTypes();
                    alert('保存しました');
                } catch (err) {
                    alert('保存に失敗しました: ' + (err.response?.data?.error || err.message));
                }
            }
            
            async function deleteSubsidyType(id, name) {
                if (!confirm(\`「\${name}」を削除してもよろしいですか？\\n関連するヒアリング質問や必要書類も削除されます。\`)) return;
                
                try {
                    await axios.delete('/api/master/subsidy-types/' + id);
                    loadSubsidyTypes();
                    alert('削除しました');
                } catch (err) {
                    alert('削除に失敗しました: ' + (err.response?.data?.error || err.message));
                }
            }
            
            // 必要書類管理
            async function openDocumentsModal(id, name) {
                currentSubsidyTypeId = id;
                document.getElementById('documentsSubsidyName').textContent = name;
                document.getElementById('documentsModal').classList.remove('hidden');
                await loadDocuments();
            }
            
            function closeDocumentsModal() {
                document.getElementById('documentsModal').classList.add('hidden');
                currentSubsidyTypeId = null;
            }
            
            async function loadDocuments() {
                try {
                    const res = await axios.get('/api/subsidy-types/' + currentSubsidyTypeId + '/documents');
                    const docs = res.data;
                    
                    const container = document.getElementById('documentsList');
                    if (docs.length === 0) {
                        container.innerHTML = '<div class="text-center text-gray-500 py-4">必要書類が登録されていません</div>';
                        return;
                    }
                    
                    container.innerHTML = docs.map(doc => \`
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <div class="font-medium">\${doc.document_type}</div>
                                <div class="text-sm text-gray-500">\${doc.description || ''}</div>
                                <div class="text-xs mt-1">
                                    \${doc.is_required ? '<span class="text-red-600">必須</span>' : '<span class="text-gray-500">任意</span>'}
                                </div>
                            </div>
                            <button onclick="deleteDocument(\${doc.id})" class="text-red-600 hover:text-red-800">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    \`).join('');
                } catch (err) {
                    console.error('Load documents error:', err);
                }
            }
            
            function openAddDocumentModal() {
                const docType = prompt('書類名を入力してください:');
                if (!docType) return;
                
                const description = prompt('説明（任意）:') || '';
                const isRequired = confirm('必須書類ですか？');
                
                addDocument(docType, description, isRequired);
            }
            
            async function addDocument(docType, description, isRequired) {
                try {
                    await axios.post('/api/subsidy-types/' + currentSubsidyTypeId + '/documents', {
                        document_type: docType,
                        description: description,
                        is_required: isRequired ? 1 : 0
                    });
                    await loadDocuments();
                } catch (err) {
                    alert('追加に失敗しました');
                }
            }
            
            async function deleteDocument(docId) {
                if (!confirm('この書類を削除しますか？')) return;
                
                try {
                    await axios.delete('/api/subsidy-types/' + currentSubsidyTypeId + '/documents/' + docId);
                    await loadDocuments();
                } catch (err) {
                    alert('削除に失敗しました');
                }
            }
            
            // 初期化
            loadSubsidyTypes();
        </script>
    </body>
    </html>
  `)
})

export default routes
