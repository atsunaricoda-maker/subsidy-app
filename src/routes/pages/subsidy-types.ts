// 申請種別管理画面
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/subsidy-types', async (c) => {
  const { DB } = c.env
  
  const category = c.req.query('category') || ''
  
  // カテゴリ名のマッピング（英語 → 日本語ラベル）
  const CATEGORY_MAP: Record<string, { label: string; icon: string; color: string; bgClass: string }> = {
    'subsidy': { label: '補助金一覧', icon: 'fa-file-signature', color: 'emerald', bgClass: 'bg-emerald-600' },
    'grant': { label: '助成金一覧', icon: 'fa-users', color: 'blue', bgClass: 'bg-blue-600' },
    'license': { label: '許認可申請一覧', icon: 'fa-stamp', color: 'indigo', bgClass: 'bg-indigo-600' }
  }
  
  // id = 0 は共通質問用の内部レコードなので除外
  // カテゴリ指定がある場合はフィルタリング
  let subsidyTypes;
  if (category && CATEGORY_MAP[category]) {
    subsidyTypes = await DB.prepare(`
      SELECT * FROM subsidy_types WHERE id > 0 AND category = ? ORDER BY name
    `).bind(category).all()
  } else {
    subsidyTypes = await DB.prepare(`
      SELECT * FROM subsidy_types WHERE id > 0 ORDER BY category, name
    `).all()
  }
  
  const categoryInfo = CATEGORY_MAP[category] || null
  const pageTitle = categoryInfo ? categoryInfo.label : '申請種別管理'
  const pageIcon = categoryInfo ? categoryInfo.icon : 'fa-file-contract'
  const headerBgClass = categoryInfo ? categoryInfo.bgClass : 'bg-gray-800'
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>申請種別管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar(category === 'subsidy' ? 'subsidy-gyosei' : category === 'grant' ? 'subsidy-sharoshi' : category === 'license' ? 'subsidy-kyoninka' : '')}
            
            <main class="flex-1 min-h-screen">
                <!-- パンくずリスト -->
                <div class="bg-white px-4 py-1.5 border-b text-xs" id="breadcrumb">
                    <a href="/" class="text-blue-600 hover:text-blue-800 hover:underline">ダッシュボード</a>
                    <i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>
                    <span class="text-gray-800 font-medium">申請種別</span>
                </div>
                <header class="${headerBgClass} text-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-white hover:text-gray-200">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold">
                                <i class="fas ${pageIcon} mr-2"></i>${pageTitle}
                            </h2>
                            ${category ? `<span class="text-sm opacity-80">（${subsidyTypes.results?.length || 0}件）</span>` : ''}
                        </div>
                        <button onclick="openNewSubsidyModal()" class="bg-white text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-100 text-sm">
                            <i class="fas fa-plus mr-2"></i>新規追加
                        </button>
                    </div>
                </header>

                <div class="p-4 lg:p-6">
                    <!-- 助成金種別一覧（カテゴリ別） -->
                    <div id="subsidyTypesList">
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
                            <div>読み込み中...</div>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <!-- 新規助成金作成モーダル -->
        <div id="newSubsidyModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div class="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 my-8">
                <h3 class="text-xl font-bold mb-4">新しい助成金種別を作成</h3>
                <form id="newSubsidyForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">助成金名 *</label>
                        <input type="text" name="name" required 
                               placeholder="例：事業再構築補助金"
                               class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">カテゴリ（管轄）</label>
                        <select name="category" class="w-full px-3 py-2 border rounded-lg">
                            <option value="subsidy">📋 補助金（行政書士管轄）</option>
                            <option value="grant">👥 助成金（社労士管轄）</option>
                            <option value="license">📜 許認可申請（行政書士管轄）</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">説明</label>
                        <textarea name="description" rows="2" 
                                  placeholder="この助成金の概要説明"
                                  class="w-full px-3 py-2 border rounded-lg"></textarea>
                    </div>
                    
                    <hr class="my-4">
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">
                            必要書類 *
                            <span class="text-xs text-gray-500 ml-2">（最低1つは必要です）</span>
                        </label>
                        <div id="documentsList" class="space-y-3 mb-3">
                            <!-- 書類入力フィールドがここに追加されます -->
                        </div>
                        <button type="button" onclick="addDocumentField()" 
                                class="text-blue-600 hover:text-blue-700 text-sm">
                            <i class="fas fa-plus-circle mr-1"></i>書類を追加
                        </button>
                    </div>
                    
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                            作成
                        </button>
                        <button type="button" onclick="closeNewSubsidyModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 助成金詳細・編集モーダル -->
        <div id="editSubsidyModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div class="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 my-8">
                <h3 class="text-xl font-bold mb-4">助成金種別の詳細・編集</h3>
                <div id="editSubsidyContent">
                    <!-- 内容が動的に挿入されます -->
                </div>
            </div>
        </div>

        <!-- ヒアリング質問編集モーダル -->
        <div id="hearingEditorModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div class="bg-white rounded-lg max-w-4xl w-full mx-4 my-8 max-h-[90vh] flex flex-col">
                <div class="bg-purple-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
                    <h3 class="text-xl font-bold">
                        <i class="fas fa-comments mr-2"></i>
                        <span id="hearingEditorTitle">ヒアリング質問編集</span>
                    </h3>
                    <button onclick="closeHearingEditor()" class="text-white hover:text-gray-200">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <div class="p-6 overflow-y-auto flex-1">
                    <!-- 共通質問への切り替え -->
                    <div class="mb-4 flex gap-2">
                        <button id="btnShowSpecific" onclick="showSpecificQuestions()" 
                                class="px-4 py-2 rounded-lg bg-purple-600 text-white">
                            固有質問
                        </button>
                        <button id="btnShowCommon" onclick="showCommonQuestions()" 
                                class="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300">
                            共通質問（全申請種別）
                        </button>
                    </div>
                    
                    <!-- 質問一覧 -->
                    <div id="hearingQuestionsList" class="space-y-3 mb-4">
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-2xl"></i>
                            <p class="mt-2">読み込み中...</p>
                        </div>
                    </div>
                    
                    <!-- 新規質問追加フォーム -->
                    <div class="border-t pt-4">
                        <h4 class="font-bold text-gray-700 mb-3">
                            <i class="fas fa-plus-circle mr-1"></i>新しい質問を追加
                        </h4>
                        <div class="space-y-3 bg-gray-50 p-4 rounded-lg">
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">質問文 *</label>
                                    <input type="text" id="newQuestionText" placeholder="例：御社の事業内容を教えてください"
                                           class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                                    <select id="newQuestionCategory" class="w-full px-3 py-2 border rounded-lg">
                                        <option value="企業情報">企業情報</option>
                                        <option value="課題分析">課題分析</option>
                                        <option value="事業計画">事業計画</option>
                                        <option value="IT計画">IT計画</option>
                                        <option value="将来計画">将来計画</option>
                                        <option value="その他">その他</option>
                                    </select>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">回答タイプ</label>
                                    <select id="newQuestionType" class="w-full px-3 py-2 border rounded-lg">
                                        <option value="text">短文テキスト</option>
                                        <option value="textarea">長文テキスト</option>
                                        <option value="number">数値</option>
                                        <option value="select">選択式</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">必須</label>
                                    <select id="newQuestionRequired" class="w-full px-3 py-2 border rounded-lg">
                                        <option value="1">必須</option>
                                        <option value="0">任意</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">ヘルプテキスト</label>
                                <input type="text" id="newQuestionHelp" placeholder="回答のヒントや説明"
                                       class="w-full px-3 py-2 border rounded-lg">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">回答例</label>
                                <input type="text" id="newQuestionExample" placeholder="例：製造業（金属加工）"
                                       class="w-full px-3 py-2 border rounded-lg">
                            </div>
                            <button onclick="addHearingQuestion()" 
                                    class="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
                                <i class="fas fa-plus mr-1"></i>質問を追加
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="px-6 py-4 border-t bg-gray-50 rounded-b-lg">
                    <button onclick="closeHearingEditor()" 
                            class="w-full bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600">
                        閉じる
                    </button>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // 認証チェック
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
                    window.location.href = '/login';
                }
            }
            
            // サイドバートグル
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                if (sidebar && overlay) {
                    sidebar.classList.toggle('-translate-x-full');
                    overlay.classList.toggle('hidden');
                }
            }
            window.toggleSidebar = toggleSidebar;
            
            if (!checkAuth()) {}

            let subsidyTypes = [];
            let documentFieldCount = 0;
            
            // URLからカテゴリパラメータを取得
            const urlParams = new URLSearchParams(window.location.search);
            const currentCategory = urlParams.get('category') || '';

            // 助成金種別一覧読み込み（管理画面では非表示含む全て表示）
            async function loadSubsidyTypes() {
                try {
                    // カテゴリが指定されている場合はフィルタリング
                    let apiUrl = '/api/subsidy-types?include_hidden=true';
                    if (currentCategory) {
                        apiUrl += '&category=' + encodeURIComponent(currentCategory);
                    }
                    const response = await axios.get(apiUrl);
                    subsidyTypes = response.data;
                    renderSubsidyTypes();
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
            }

            // カテゴリの色設定と日本語ラベル
            const CATEGORY_COLORS = {
                'subsidy': { 
                    bg: 'bg-emerald-50', 
                    border: 'border-emerald-500', 
                    badge: 'bg-emerald-100 text-emerald-800',
                    header: 'bg-emerald-600',
                    icon: 'fa-file-signature',
                    label: '📋 補助金（行政書士管轄）',
                    shortLabel: '補助金',
                    description: '経済産業省系の補助金申請'
                },
                'grant': { 
                    bg: 'bg-blue-50', 
                    border: 'border-blue-500', 
                    badge: 'bg-blue-100 text-blue-800',
                    header: 'bg-blue-600',
                    icon: 'fa-users',
                    label: '👥 助成金（社労士管轄）',
                    shortLabel: '助成金',
                    description: '厚生労働省系の助成金申請'
                },
                'license': { 
                    bg: 'bg-indigo-50', 
                    border: 'border-indigo-500', 
                    badge: 'bg-indigo-100 text-indigo-800',
                    header: 'bg-indigo-600',
                    icon: 'fa-stamp',
                    label: '📜 許認可申請（行政書士管轄）',
                    shortLabel: '許認可',
                    description: '各種営業許可・届出申請'
                },
                'システム': { 
                    bg: 'bg-gray-50', 
                    border: 'border-gray-400', 
                    badge: 'bg-gray-100 text-gray-800',
                    header: 'bg-gray-600',
                    icon: 'fa-cog',
                    label: 'システム',
                    shortLabel: 'システム',
                    description: 'システム用'
                }
            };
            
            // 申請種別表示
            function renderSubsidyTypes() {
                const container = document.getElementById('subsidyTypesList');
                
                if (subsidyTypes.length === 0) {
                    container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">まだ申請種別が登録されていません</div>';
                    return;
                }

                // カテゴリ別にグループ化
                const grouped = {};
                subsidyTypes.forEach(subsidy => {
                    const cat = subsidy.category || 'その他';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(subsidy);
                });
                
                // カテゴリの表示順序（英語のみ）
                const knownCategories = ['subsidy', 'grant', 'license'];
                // DBに存在するが上記にないカテゴリも追加（システムカテゴリは除外）
                const allCategories = [...new Set([...knownCategories, ...Object.keys(grouped)])];
                const categoryOrder = allCategories.filter(cat => grouped[cat] && cat !== 'システム');
                
                let html = '';
                categoryOrder.forEach(category => {
                    if (!grouped[category]) return;
                    
                    const defaultColors = { 
                        bg: 'bg-gray-50', 
                        border: 'border-gray-400', 
                        badge: 'bg-gray-100 text-gray-800',
                        header: 'bg-gray-600',
                        icon: 'fa-folder',
                        label: category,
                        shortLabel: category
                    };
                    const colors = CATEGORY_COLORS[category] || defaultColors;
                    const items = grouped[category];
                    
                    const displayLabel = colors.label || category;
                    
                    html += \`
                        <div class="mb-8">
                            <div class="\${colors.header} text-white px-4 py-3 rounded-t-lg flex items-center gap-2">
                                <i class="fas \${colors.icon}"></i>
                                <h2 class="text-lg font-bold">\${displayLabel}</h2>
                                <span class="ml-auto bg-white/20 px-2 py-1 rounded text-sm">\${items.length}件</span>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 \${colors.bg} rounded-b-lg border-2 \${colors.border} border-t-0">
                                \${items.map(subsidy => \`
                                    <div class="bg-white rounded-lg shadow p-4 hover:shadow-lg transition border-l-4 \${colors.border}">
                                        <div class="flex items-start justify-between mb-2">
                                            <div class="flex-1">
                                                <h3 class="font-bold text-gray-800">\${subsidy.name}</h3>
                                                <p class="text-sm text-gray-600 mt-1">\${subsidy.description || '説明なし'}</p>
                                            </div>
                                        </div>
                                        <div class="flex gap-2 mt-3">
                                            <button onclick="viewSubsidyDetail(\${subsidy.id})" 
                                                    class="flex-1 bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 text-sm">
                                                <i class="fas fa-eye mr-1"></i>詳細
                                            </button>
                                            <button onclick="openHearingEditor(\${subsidy.id}, '\${subsidy.name.replace(/'/g, "\\\\\'")}')"
                                                    class="flex-1 bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700 text-sm"
                                                    title="ヒアリング質問を編集">
                                                <i class="fas fa-comments mr-1"></i>ヒアリング
                                            </button>
                                            <button data-subsidy-id="\${subsidy.id}" data-subsidy-name="\${subsidy.name.replace(/"/g, '&quot;')}"
                                                    onclick="deleteSubsidyType(this.dataset.subsidyId, this.dataset.subsidyName)" 
                                                    class="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 text-sm"
                                                    title="この補助金種別を削除">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                    \`;
                });
                
                container.innerHTML = html;
            }

            // 新規作成モーダル開く
            function openNewSubsidyModal() {
                document.getElementById('newSubsidyModal').classList.remove('hidden');
                document.getElementById('documentsList').innerHTML = '';
                documentFieldCount = 0;
                // 最初の書類フィールドを追加
                addDocumentField();
            }

            function closeNewSubsidyModal() {
                document.getElementById('newSubsidyModal').classList.add('hidden');
                document.getElementById('newSubsidyForm').reset();
            }

            // 書類フィールド追加
            function addDocumentField() {
                documentFieldCount++;
                const container = document.getElementById('documentsList');
                const fieldHtml = \`
                    <div class="border rounded-lg p-3 bg-gray-50" data-doc-id="\${documentFieldCount}">
                        <div class="flex gap-2 mb-2">
                            <input type="text" 
                                   name="doc_type_\${documentFieldCount}" 
                                   placeholder="書類名（例：登記簿謄本）"
                                   required
                                   class="flex-1 px-3 py-2 border rounded-lg text-sm">
                            <button type="button" onclick="removeDocumentField(\${documentFieldCount})" 
                                    class="text-red-600 hover:text-red-700 px-2">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <input type="text" 
                               name="doc_desc_\${documentFieldCount}" 
                               placeholder="説明（例：3ヶ月以内に発行されたもの）"
                               class="w-full px-3 py-2 border rounded-lg text-sm">
                    </div>
                \`;
                container.insertAdjacentHTML('beforeend', fieldHtml);
            }

            function removeDocumentField(id) {
                const field = document.querySelector(\`[data-doc-id="\${id}"]\`);
                if (field) {
                    field.remove();
                }
            }

            // 新規助成金作成
            document.getElementById('newSubsidyForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                
                // 基本情報
                const subsidyData = {
                    name: formData.get('name'),
                    category: formData.get('category'),
                    description: formData.get('description')
                };
                
                // 書類リスト収集
                const documents = [];
                for (let i = 1; i <= documentFieldCount; i++) {
                    const docType = formData.get(\`doc_type_\${i}\`);
                    const docDesc = formData.get(\`doc_desc_\${i}\`);
                    if (docType) {
                        documents.push({
                            document_type: docType,
                            description: docDesc || '',
                            display_order: documents.length + 1
                        });
                    }
                }
                
                if (documents.length === 0) {
                    alert('最低1つは書類を追加してください');
                    return;
                }
                
                try {
                    // 助成金種別作成
                    const subsidyResponse = await axios.post('/api/subsidy-types', subsidyData);
                    const subsidyId = subsidyResponse.data.id;
                    
                    // 書類を追加
                    for (const doc of documents) {
                        await axios.post(\`/api/subsidy-types/\${subsidyId}/documents\`, doc);
                    }
                    
                    alert('助成金種別を作成しました');
                    closeNewSubsidyModal();
                    loadSubsidyTypes();
                } catch (error) {
                    alert('作成に失敗しました');
                    console.error(error);
                }
            });

            // 助成金詳細表示
            async function viewSubsidyDetail(id) {
                try {
                    const [subsidyResponse, docsResponse] = await Promise.all([
                        axios.get(\`/api/subsidy-types\`),
                        axios.get(\`/api/subsidy-types/\${id}/documents\`)
                    ]);
                    
                    const subsidy = subsidyResponse.data.find(s => s.id === id);
                    const documents = docsResponse.data;
                    
                    const content = \`
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-1">助成金名</label>
                                <div class="text-lg font-bold">\${subsidy.name}</div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">カテゴリ</label>
                                <span class="px-3 py-1 rounded bg-blue-100 text-blue-800 text-sm">
                                    \${subsidy.category}
                                </span>
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">説明</label>
                                <p class="text-gray-700">\${subsidy.description || '説明なし'}</p>
                            </div>
                            
                            <hr class="my-4">
                            
                            <div>
                                <div class="flex items-center justify-between mb-3">
                                    <label class="block text-sm font-medium">必要書類一覧</label>
                                    <button onclick="addNewDocument(\${id})" 
                                            class="text-blue-600 hover:text-blue-700 text-sm">
                                        <i class="fas fa-plus-circle mr-1"></i>書類を追加
                                    </button>
                                </div>
                                <div id="documentDetailList" class="space-y-2">
                                    \${documents.map((doc, index) => \`
                                        <div class="border rounded-lg p-3 bg-gray-50 flex items-start justify-between">
                                            <div class="flex-1">
                                                <div class="font-medium text-sm">\${index + 1}. \${doc.document_type}</div>
                                                <div class="text-xs text-gray-500">\${doc.description || '説明なし'}</div>
                                            </div>
                                            <button onclick="deleteDocument(\${id}, \${doc.id})" 
                                                    class="text-red-600 hover:text-red-700 text-sm ml-2">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    \`).join('')}
                                </div>
                            </div>
                            
                            <hr class="my-4">
                            
                            <div class="flex gap-2 pt-4">
                                <button onclick="closeEditSubsidyModal()" 
                                        class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
                                    閉じる
                                </button>
                                <button data-subsidy-id="\${subsidy.id}" data-subsidy-name="\${subsidy.name.replace(/"/g, '&quot;')}"
                                        onclick="deleteSubsidyType(this.dataset.subsidyId, this.dataset.subsidyName); closeEditSubsidyModal();" 
                                        class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">
                                    <i class="fas fa-trash mr-2"></i>この補助金種別を削除
                                </button>
                            </div>
                        </div>
                    \`;
                    
                    document.getElementById('editSubsidyContent').innerHTML = content;
                    document.getElementById('editSubsidyModal').classList.remove('hidden');
                    
                } catch (error) {
                    alert('詳細の読み込みに失敗しました');
                    console.error(error);
                }
            }

            function closeEditSubsidyModal() {
                document.getElementById('editSubsidyModal').classList.add('hidden');
            }

            // 書類追加
            async function addNewDocument(subsidyId) {
                const docType = prompt('書類名を入力してください\\n例：登記簿謄本');
                if (!docType) return;
                
                const docDesc = prompt('説明を入力してください（任意）\\n例：3ヶ月以内に発行されたもの');
                
                try {
                    await axios.post(\`/api/subsidy-types/\${subsidyId}/documents\`, {
                        document_type: docType,
                        description: docDesc || '',
                        display_order: 999
                    });
                    
                    // 再表示
                    viewSubsidyDetail(subsidyId);
                } catch (error) {
                    alert('追加に失敗しました');
                    console.error(error);
                }
            }

            // 書類削除
            async function deleteDocument(subsidyId, docId) {
                if (!confirm('この書類を削除しますか？')) return;
                
                try {
                    await axios.delete(\`/api/subsidy-types/\${subsidyId}/documents/\${docId}\`);
                    
                    // 再表示
                    viewSubsidyDetail(subsidyId);
                    loadSubsidyTypes();
                } catch (error) {
                    alert('削除に失敗しました');
                    console.error(error);
                }
            }

            // 補助金種別削除
            async function deleteSubsidyType(id, name) {
                const confirmMessage = \`「\${name}」を削除しますか？\n\n⚠️ 警告: この操作は取り消せません。\n\n削除されるデータ:\n- この補助金種別の必要書類\n- この補助金種別用のヒアリング質問\n- 補助金ガイドライン\n- マッチングスコア\n\n※ この補助金種別を使用している顧客は、補助金種別が未設定になります。\`;
                
                if (!confirm(confirmMessage)) return;
                
                // 二重確認
                const finalConfirm = prompt(\`本当に削除する場合は「\${name}」と入力してください:\`);
                if (finalConfirm !== name) {
                    alert('入力が一致しないため、削除をキャンセルしました');
                    return;
                }
                
                try {
                    const response = await axios.delete(\`/api/subsidy-types/\${id}\`);
                    
                    if (response.data.affected_clients > 0) {
                        alert(\`「\${name}」を削除しました。\n\${response.data.affected_clients}件の顧客の補助金種別が未設定になりました。\`);
                    } else {
                        alert(\`「\${name}」を削除しました。\`);
                    }
                    
                    loadSubsidyTypes();
                } catch (error) {
                    if (error.response?.data?.error) {
                        alert(\`削除に失敗しました: \${error.response.data.error}\`);
                    } else {
                        alert('削除に失敗しました');
                    }
                    console.error(error);
                }
            }

            // ===============================
            // ヒアリング質問編集機能
            // ===============================
            let currentHearingSubsidyId = null;
            let currentHearingSubsidyName = '';
            let hearingQuestions = [];
            let showingCommonQuestions = false;
            
            async function openHearingEditor(subsidyId, subsidyName) {
                currentHearingSubsidyId = subsidyId;
                currentHearingSubsidyName = subsidyName;
                showingCommonQuestions = false;
                
                document.getElementById('hearingEditorTitle').textContent = subsidyName + ' のヒアリング質問';
                document.getElementById('hearingEditorModal').classList.remove('hidden');
                document.getElementById('btnShowSpecific').className = 'px-4 py-2 rounded-lg bg-purple-600 text-white';
                document.getElementById('btnShowCommon').className = 'px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300';
                
                await loadHearingQuestions(subsidyId);
            }
            
            function closeHearingEditor() {
                document.getElementById('hearingEditorModal').classList.add('hidden');
                currentHearingSubsidyId = null;
                currentHearingSubsidyName = '';
            }
            
            function showSpecificQuestions() {
                showingCommonQuestions = false;
                document.getElementById('btnShowSpecific').className = 'px-4 py-2 rounded-lg bg-purple-600 text-white';
                document.getElementById('btnShowCommon').className = 'px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300';
                loadHearingQuestions(currentHearingSubsidyId);
            }
            
            function showCommonQuestions() {
                showingCommonQuestions = true;
                document.getElementById('btnShowSpecific').className = 'px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300';
                document.getElementById('btnShowCommon').className = 'px-4 py-2 rounded-lg bg-purple-600 text-white';
                document.getElementById('hearingEditorTitle').textContent = '共通ヒアリング質問（全申請種別）';
                loadHearingQuestions(0);
            }
            
            async function loadHearingQuestions(subsidyTypeId) {
                const container = document.getElementById('hearingQuestionsList');
                container.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2">読み込み中...</p></div>';
                
                try {
                    const response = await axios.get('/api/hearing-questions?subsidy_type_id=' + subsidyTypeId);
                    hearingQuestions = response.data;
                    renderHearingQuestions();
                } catch (error) {
                    container.innerHTML = '<div class="text-center py-8 text-red-500"><i class="fas fa-exclamation-circle text-2xl"></i><p class="mt-2">読み込みに失敗しました</p></div>';
                    console.error('Error loading hearing questions:', error);
                }
            }
            
            function renderHearingQuestions() {
                const container = document.getElementById('hearingQuestionsList');
                
                if (hearingQuestions.length === 0) {
                    container.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-comments text-3xl mb-2"></i><p>まだ質問がありません。下のフォームから追加してください。</p></div>';
                    return;
                }
                
                // カテゴリでグループ化
                const grouped = {};
                hearingQuestions.forEach(q => {
                    const cat = q.category || 'その他';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(q);
                });
                
                const categoryColors = {
                    '企業情報': 'bg-blue-100 border-blue-500',
                    '課題分析': 'bg-orange-100 border-orange-500',
                    '事業計画': 'bg-green-100 border-green-500',
                    'IT計画': 'bg-indigo-100 border-indigo-500',
                    '将来計画': 'bg-purple-100 border-purple-500',
                    'その他': 'bg-gray-100 border-gray-500'
                };
                
                let html = '';
                Object.keys(grouped).forEach(category => {
                    const questions = grouped[category];
                    const colors = categoryColors[category] || categoryColors['その他'];
                    
                    html += '<div class="mb-4">';
                    html += '<h5 class="font-bold text-gray-600 mb-2 flex items-center"><i class="fas fa-tag mr-2"></i>' + category + ' (' + questions.length + '件)</h5>';
                    html += '<div class="space-y-2">';
                    
                    questions.forEach((q, index) => {
                        const typeLabel = {'text': '短文', 'textarea': '長文', 'number': '数値', 'select': '選択'}[q.question_type] || q.question_type;
                        const requiredBadge = q.is_required ? '<span class="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">必須</span>' : '<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">任意</span>';
                        
                        html += '<div class="' + colors + ' border-l-4 rounded-lg p-3 flex items-start gap-3">';
                        html += '<div class="flex-1">';
                        html += '<div class="flex items-center gap-2 mb-1">';
                        html += '<span class="font-medium text-gray-800">' + q.question_text + '</span>';
                        html += requiredBadge;
                        html += '<span class="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">' + typeLabel + '</span>';
                        html += '</div>';
                        if (q.help_text) {
                            html += '<p class="text-sm text-gray-600"><i class="fas fa-info-circle mr-1"></i>' + q.help_text + '</p>';
                        }
                        if (q.example_answer) {
                            html += '<p class="text-sm text-gray-500"><i class="fas fa-lightbulb mr-1"></i>例: ' + q.example_answer + '</p>';
                        }
                        html += '</div>';
                        html += '<div class="flex gap-1">';
                        html += '<button onclick="editHearingQuestion(' + q.id + ')" class="text-blue-600 hover:text-blue-800 p-1" title="編集"><i class="fas fa-edit"></i></button>';
                        html += '<button onclick="deleteHearingQuestion(' + q.id + ')" class="text-red-600 hover:text-red-800 p-1" title="削除"><i class="fas fa-trash"></i></button>';
                        html += '</div>';
                        html += '</div>';
                    });
                    
                    html += '</div></div>';
                });
                
                container.innerHTML = html;
            }
            
            async function addHearingQuestion() {
                const text = document.getElementById('newQuestionText').value.trim();
                if (!text) {
                    alert('質問文を入力してください');
                    return;
                }
                
                const targetSubsidyId = showingCommonQuestions ? 0 : currentHearingSubsidyId;
                
                const data = {
                    subsidy_type_id: targetSubsidyId,
                    question_text: text,
                    question_type: document.getElementById('newQuestionType').value,
                    category: document.getElementById('newQuestionCategory').value,
                    is_required: document.getElementById('newQuestionRequired').value === '1',
                    help_text: document.getElementById('newQuestionHelp').value.trim() || null,
                    example_answer: document.getElementById('newQuestionExample').value.trim() || null
                };
                
                try {
                    await axios.post('/api/hearing-questions', data);
                    
                    // フォームをクリア
                    document.getElementById('newQuestionText').value = '';
                    document.getElementById('newQuestionHelp').value = '';
                    document.getElementById('newQuestionExample').value = '';
                    
                    // リロード
                    await loadHearingQuestions(targetSubsidyId);
                } catch (error) {
                    alert('追加に失敗しました');
                    console.error(error);
                }
            }
            
            async function editHearingQuestion(id) {
                const question = hearingQuestions.find(q => q.id === id);
                if (!question) return;
                
                const newText = prompt('質問文を編集:', question.question_text);
                if (newText === null || newText.trim() === '') return;
                
                try {
                    await axios.put('/api/hearing-questions/' + id, {
                        ...question,
                        question_text: newText.trim()
                    });
                    
                    const targetSubsidyId = showingCommonQuestions ? 0 : currentHearingSubsidyId;
                    await loadHearingQuestions(targetSubsidyId);
                } catch (error) {
                    alert('更新に失敗しました');
                    console.error(error);
                }
            }
            
            async function deleteHearingQuestion(id) {
                if (!confirm('この質問を削除しますか？\\n関連する回答データも削除されます。')) return;
                
                try {
                    await axios.delete('/api/hearing-questions/' + id);
                    
                    const targetSubsidyId = showingCommonQuestions ? 0 : currentHearingSubsidyId;
                    await loadHearingQuestions(targetSubsidyId);
                } catch (error) {
                    alert('削除に失敗しました');
                    console.error(error);
                }
            }

            // グローバルスコープに関数を公開（onclick対応）
            window.logout = logout;
            window.openNewSubsidyModal = openNewSubsidyModal;
            window.closeNewSubsidyModal = closeNewSubsidyModal;
            window.addDocumentField = addDocumentField;
            window.removeDocumentField = removeDocumentField;
            window.viewSubsidyDetail = viewSubsidyDetail;
            window.closeEditSubsidyModal = closeEditSubsidyModal;
            window.addNewDocument = addNewDocument;
            window.deleteDocument = deleteDocument;
            window.deleteSubsidyType = deleteSubsidyType;
            window.openHearingEditor = openHearingEditor;
            window.closeHearingEditor = closeHearingEditor;
            window.showSpecificQuestions = showSpecificQuestions;
            window.showCommonQuestions = showCommonQuestions;
            window.addHearingQuestion = addHearingQuestion;
            window.editHearingQuestion = editHearingQuestion;
            window.deleteHearingQuestion = deleteHearingQuestion;

            // 業務範囲チェック
            async function checkBusinessScope() {
                try {
                    const response = await axios.get('/api/subscription/status');
                    const data = response.data;
                    const scope = data.business_scope || 'both';
                    
                    // カテゴリと必要な業務範囲のマッピング（英語・日本語両対応）
                    const categoryToScope = {
                        'subsidy': ['administrative', 'both'],
                        'license': ['administrative', 'both'],
                        'grant': ['labor', 'both'],
                        // 日本語カテゴリ名にも対応
                        '行政書士管轄': ['administrative', 'both'],
                        '補助金': ['administrative', 'both'],
                        '許認可': ['administrative', 'both'],
                        '社労士管轄': ['labor', 'both'],
                        '助成金': ['labor', 'both']
                    };
                    
                    const allowedScopes = categoryToScope[currentCategory] || ['administrative', 'labor', 'both']; // マッピングにない場合は全てアクセス可能
                    
                    // 業務範囲外の場合はロック画面を表示
                    if (currentCategory && !allowedScopes.includes(scope)) {
                        const scopeNames = {
                            'subsidy': '行政書士業務（補助金）',
                            'license': '行政書士業務（許認可）',
                            'grant': '社労士業務（助成金）',
                            '行政書士管轄': '行政書士業務（補助金）',
                            '補助金': '行政書士業務（補助金）',
                            '許認可': '行政書士業務（許認可）',
                            '社労士管轄': '社労士業務（助成金）',
                            '助成金': '社労士業務（助成金）'
                        };
                        const isGrantCategory = ['grant', '社労士管轄', '助成金'].includes(currentCategory);
                        const requiredScope = isGrantCategory ? '社労士業務' : '行政書士業務';
                        
                        document.getElementById('subsidyTypesList').innerHTML = \`
                            <div class="bg-white rounded-xl shadow-lg p-8 max-w-lg mx-auto text-center">
                                <div class="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                                    <i class="fas fa-lock text-4xl text-gray-400"></i>
                                </div>
                                <h2 class="text-2xl font-bold text-gray-800 mb-4">この機能はロックされています</h2>
                                <p class="text-gray-600 mb-6">
                                    <strong>\${scopeNames[currentCategory] || currentCategory}</strong>を使用するには、<br>
                                    <strong>\${requiredScope}</strong>のオプション追加が必要です。
                                </p>
                                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                    <p class="text-blue-800">
                                        <i class="fas fa-info-circle mr-2"></i>
                                        <strong>月額 +¥2,000</strong> で\${requiredScope}を追加できます。
                                    </p>
                                </div>
                                <div class="flex gap-3 justify-center">
                                    <a href="/" class="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                                        <i class="fas fa-arrow-left mr-2"></i>戻る
                                    </a>
                                    <a href="/admin/subscription" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">
                                        <i class="fas fa-unlock mr-2"></i>オプションを追加
                                    </a>
                                </div>
                            </div>
                        \`;
                        return false;
                    }
                    return true;
                } catch (error) {
                    console.error('Error checking business scope:', error);
                    return true; // エラー時はアクセス許可
                }
            }

            // 初期読み込み
            checkBusinessScope().then(allowed => {
                if (allowed) {
                    loadSubsidyTypes();
                }
            });
        </script>
    </body>
    </html>
  `)
})

export default routes
