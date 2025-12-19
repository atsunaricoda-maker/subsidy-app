import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'
// マスターデータ管理
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// ヒアリング質問管理ページ
routes.get('/master/hearing-questions', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ヒアリング質問管理 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('hearing')}
            
            <main class="flex-1 p-8">
                <div class="mb-6 flex items-center justify-between">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-800">ヒアリング質問管理</h1>
                        <p class="text-gray-600 mt-1">顧客ポータルで表示される質問を管理</p>
                    </div>
                    <button onclick="openAddModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <i class="fas fa-plus"></i>新規質問追加
                    </button>
                </div>
                
                <!-- フィルター -->
                <div class="bg-white rounded-xl shadow-sm p-4 mb-6">
                    <div class="flex items-center gap-4">
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-700 mb-1">補助金種別</label>
                            <select id="filterSubsidyType" onchange="loadQuestions()" class="w-full px-3 py-2 border rounded-lg">
                                <option value="">すべて</option>
                                <option value="0">共通質問</option>
                            </select>
                        </div>
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                            <select id="filterCategory" onchange="loadQuestions()" class="w-full px-3 py-2 border rounded-lg">
                                <option value="">すべて</option>
                                <option value="企業情報">企業情報</option>
                                <option value="課題分析">課題分析</option>
                                <option value="IT計画">IT計画</option>
                                <option value="事業計画">事業計画</option>
                                <option value="将来計画">将来計画</option>
                                <option value="期待効果">期待効果</option>
                            </select>
                        </div>
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-700 mb-1">検索</label>
                            <input type="text" id="searchQuery" placeholder="質問文で検索..." class="w-full px-3 py-2 border rounded-lg" oninput="loadQuestions()">
                        </div>
                    </div>
                </div>
                
                <!-- 質問一覧 -->
                <div class="bg-white rounded-xl shadow-sm">
                    <div class="p-4 border-b flex items-center justify-between">
                        <h2 class="font-semibold">質問一覧</h2>
                        <span id="questionCount" class="text-sm text-gray-500">0件</span>
                    </div>
                    <div id="questionList" class="divide-y">
                        <div class="p-8 text-center text-gray-500">
                            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                            <p>読み込み中...</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- 質問編集モーダル -->
        <div id="questionModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
                    <h3 id="modalTitle" class="text-lg font-bold">質問を編集</h3>
                    <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <form id="questionForm" class="p-6 space-y-4">
                    <input type="hidden" id="questionId">
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">補助金種別 <span class="text-red-500">*</span></label>
                        <select id="subsidyTypeId" class="w-full px-3 py-2 border rounded-lg" required>
                            <option value="0">共通質問（全種別で表示）</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">カテゴリ <span class="text-red-500">*</span></label>
                        <select id="category" class="w-full px-3 py-2 border rounded-lg" required>
                            <option value="企業情報">企業情報</option>
                            <option value="課題分析">課題分析</option>
                            <option value="IT計画">IT計画</option>
                            <option value="事業計画">事業計画</option>
                            <option value="将来計画">将来計画</option>
                            <option value="期待効果">期待効果</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">質問文 <span class="text-red-500">*</span></label>
                        <input type="text" id="questionText" class="w-full px-3 py-2 border rounded-lg" required placeholder="例: 現在の業務で困っていること・課題は何ですか？">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">ヒント文</label>
                        <textarea id="hintText" rows="2" class="w-full px-3 py-2 border rounded-lg" placeholder="回答者へのヒントや補足説明"></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">記入例</label>
                        <textarea id="exampleText" rows="3" class="w-full px-3 py-2 border rounded-lg" placeholder="回答例を記載"></textarea>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">表示順</label>
                            <input type="number" id="displayOrder" class="w-full px-3 py-2 border rounded-lg" value="0" min="0">
                        </div>
                        <div class="flex items-center gap-2 pt-6">
                            <input type="checkbox" id="isRequired" class="rounded">
                            <label for="isRequired" class="text-sm text-gray-700">必須項目</label>
                        </div>
                    </div>
                    
                    <div class="flex justify-end gap-3 pt-4">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 border rounded-lg hover:bg-gray-50">キャンセル</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-save mr-1"></i>保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <script>
            const masterToken = localStorage.getItem('master_token');
            if (!masterToken) window.location.href = '/master/login';
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + masterToken;
            
            let subsidyTypes = [];
            
            // 補助金種別を読み込み
            async function loadSubsidyTypes() {
                try {
                    const res = await axios.get('/api/subsidy-types');
                    subsidyTypes = res.data || [];
                    
                    const filterSelect = document.getElementById('filterSubsidyType');
                    const formSelect = document.getElementById('subsidyTypeId');
                    
                    subsidyTypes.forEach(st => {
                        filterSelect.innerHTML += \`<option value="\${st.id}">\${st.name}</option>\`;
                        formSelect.innerHTML += \`<option value="\${st.id}">\${st.name}</option>\`;
                    });
                } catch (e) {
                    console.error('Load subsidy types error:', e);
                }
            }
            
            // 質問一覧を読み込み
            async function loadQuestions() {
                const subsidyTypeId = document.getElementById('filterSubsidyType').value;
                const category = document.getElementById('filterCategory').value;
                const search = document.getElementById('searchQuery').value;
                
                try {
                    let url = '/api/master/hearing-questions?';
                    if (subsidyTypeId) url += \`subsidy_type_id=\${subsidyTypeId}&\`;
                    if (category) url += \`category=\${encodeURIComponent(category)}&\`;
                    if (search) url += \`search=\${encodeURIComponent(search)}&\`;
                    
                    const res = await axios.get(url);
                    const questions = res.data || [];
                    
                    document.getElementById('questionCount').textContent = questions.length + '件';
                    
                    if (questions.length === 0) {
                        document.getElementById('questionList').innerHTML = \`
                            <div class="p-8 text-center text-gray-500">
                                <i class="fas fa-clipboard-list text-4xl mb-3 text-gray-300"></i>
                                <p>質問がありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    document.getElementById('questionList').innerHTML = questions.map(q => \`
                        <div class="p-4 hover:bg-gray-50">
                            <div class="flex items-start justify-between gap-4">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="px-2 py-0.5 text-xs rounded-full \${q.subsidy_type_id === 0 ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                                            \${q.subsidy_type_id === 0 ? '共通' : (q.subsidy_name || '種別不明')}
                                        </span>
                                        <span class="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">\${q.category}</span>
                                        \${q.is_required ? '<span class="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">必須</span>' : ''}
                                    </div>
                                    <p class="font-medium text-gray-800">\${q.question_text}</p>
                                    \${q.hint_text ? \`<p class="text-sm text-gray-500 mt-1"><i class="fas fa-lightbulb text-yellow-500 mr-1"></i>\${q.hint_text}</p>\` : ''}
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="text-xs text-gray-400">順序: \${q.display_order}</span>
                                    <button onclick="editQuestion(\${q.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteQuestion(\${q.id})" class="p-2 text-red-600 hover:bg-red-50 rounded">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    \`).join('');
                    
                } catch (e) {
                    console.error('Load questions error:', e);
                    document.getElementById('questionList').innerHTML = '<p class="p-4 text-red-500">読み込みに失敗しました</p>';
                }
            }
            
            function openAddModal() {
                document.getElementById('modalTitle').textContent = '新規質問追加';
                document.getElementById('questionId').value = '';
                document.getElementById('questionForm').reset();
                document.getElementById('subsidyTypeId').value = '0';
                document.getElementById('questionModal').classList.remove('hidden');
            }
            
            async function editQuestion(id) {
                try {
                    const res = await axios.get(\`/api/master/hearing-questions/\${id}\`);
                    const q = res.data;
                    
                    document.getElementById('modalTitle').textContent = '質問を編集';
                    document.getElementById('questionId').value = q.id;
                    document.getElementById('subsidyTypeId').value = q.subsidy_type_id;
                    document.getElementById('category').value = q.category;
                    document.getElementById('questionText').value = q.question_text;
                    document.getElementById('hintText').value = q.hint_text || '';
                    document.getElementById('exampleText').value = q.example_text || '';
                    document.getElementById('displayOrder').value = q.display_order || 0;
                    document.getElementById('isRequired').checked = q.is_required;
                    
                    document.getElementById('questionModal').classList.remove('hidden');
                } catch (e) {
                    alert('質問の取得に失敗しました');
                }
            }
            
            async function deleteQuestion(id) {
                if (!confirm('この質問を削除しますか？')) return;
                
                try {
                    await axios.delete(\`/api/master/hearing-questions/\${id}\`);
                    loadQuestions();
                } catch (e) {
                    alert('削除に失敗しました');
                }
            }
            
            function closeModal() {
                document.getElementById('questionModal').classList.add('hidden');
            }
            
            document.getElementById('questionForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const id = document.getElementById('questionId').value;
                const data = {
                    subsidy_type_id: parseInt(document.getElementById('subsidyTypeId').value),
                    category: document.getElementById('category').value,
                    question_text: document.getElementById('questionText').value,
                    hint_text: document.getElementById('hintText').value,
                    example_text: document.getElementById('exampleText').value,
                    display_order: parseInt(document.getElementById('displayOrder').value) || 0,
                    is_required: document.getElementById('isRequired').checked
                };
                
                try {
                    if (id) {
                        await axios.put(\`/api/master/hearing-questions/\${id}\`, data);
                    } else {
                        await axios.post('/api/master/hearing-questions', data);
                    }
                    closeModal();
                    loadQuestions();
                } catch (e) {
                    alert('保存に失敗しました');
                }
            });
            
            function masterLogout() {
                localStorage.removeItem('master_token');
                window.location.href = '/master/login';
            }
            
            loadSubsidyTypes();
            loadQuestions();
        </script>
    </body>
    </html>
  `)
})

// ヒアリング質問API（マスター用）
routes.get('/master/hearing-questions', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.query('subsidy_type_id')
  const category = c.req.query('category')
  const search = c.req.query('search')
  
  let query = `
    SELECT hq.*, st.name as subsidy_name
    FROM hearing_questions hq
    LEFT JOIN subsidy_types st ON hq.subsidy_type_id = st.id
    WHERE 1=1
  `
  const bindings: any[] = []
  
  if (subsidyTypeId !== undefined && subsidyTypeId !== '') {
    query += ` AND hq.subsidy_type_id = ?`
    bindings.push(parseInt(subsidyTypeId))
  }
  if (category) {
    query += ` AND hq.category = ?`
    bindings.push(category)
  }
  if (search) {
    query += ` AND hq.question_text LIKE ?`
    bindings.push(`%${search}%`)
  }
  
  query += ` ORDER BY hq.subsidy_type_id, hq.category, hq.display_order`
  
  const result = await DB.prepare(query).bind(...bindings).all()
  return c.json(result?.results || [])
})

routes.get('/master/hearing-questions/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const q = await DB.prepare('SELECT * FROM hearing_questions WHERE id = ?').bind(id).first()
  return c.json(q)
})

routes.post('/master/hearing-questions', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  await DB.prepare(`
    INSERT INTO hearing_questions (subsidy_type_id, category, question_text, hint_text, example_text, display_order, is_required)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.subsidy_type_id,
    data.category,
    data.question_text,
    data.hint_text || null,
    data.example_text || null,
    data.display_order || 0,
    data.is_required ? 1 : 0
  ).run()
  
  return c.json({ success: true })
})

routes.put('/master/hearing-questions/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE hearing_questions SET
      subsidy_type_id = ?,
      category = ?,
      question_text = ?,
      hint_text = ?,
      example_text = ?,
      display_order = ?,
      is_required = ?
    WHERE id = ?
  `).bind(
    data.subsidy_type_id,
    data.category,
    data.question_text,
    data.hint_text || null,
    data.example_text || null,
    data.display_order || 0,
    data.is_required ? 1 : 0,
    id
  ).run()
  
  return c.json({ success: true })
})

routes.delete('/master/hearing-questions/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  await DB.prepare('DELETE FROM hearing_questions WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// AIモデル設定ページ
routes.get('/master/ai-models', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AIモデル設定 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('ai-models')}
            
            <main class="flex-1 p-8">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-800">AIモデル設定</h1>
                    <p class="text-gray-600 mt-1">文書生成や書類解析に使用するAIモデルを設定します</p>
                </div>
                
                <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <div class="flex items-center gap-3 mb-6">
                        <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <i class="fas fa-brain text-purple-600 text-xl"></i>
                        </div>
                        <div>
                            <h2 class="text-lg font-semibold">Claude API モデル</h2>
                            <p class="text-sm text-gray-500">Anthropic Claude APIで使用するモデル名を指定します</p>
                        </div>
                    </div>
                    
                    <div class="space-y-6">
                        <!-- テキスト生成モデル -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                <i class="fas fa-file-alt text-blue-500 mr-1"></i>
                                テキスト生成モデル
                            </label>
                            <input type="text" id="ai_model_claude" 
                                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono"
                                placeholder="claude-haiku-4-5-20251001">
                            <p class="text-xs text-gray-500 mt-1">
                                文書生成、AIチャット、マッチング分析などに使用されます
                            </p>
                        </div>
                        
                        <!-- マルチモーダルモデル -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                <i class="fas fa-images text-green-500 mr-1"></i>
                                マルチモーダルモデル（書類解析用）
                            </label>
                            <input type="text" id="ai_model_claude_multimodal" 
                                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono"
                                placeholder="claude-haiku-4-5-20251001">
                            <p class="text-xs text-gray-500 mt-1">
                                PDF/画像からのテキスト抽出に使用されます（通常はテキスト生成と同じモデル）
                            </p>
                        </div>
                    </div>
                    
                    <!-- Claudeモデル名の例 -->
                    <div class="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h3 class="text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-lightbulb text-yellow-500 mr-1"></i>
                            利用可能なClaudeモデル名の例
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm font-mono">
                            <div class="flex items-center gap-2">
                                <span class="text-gray-600">•</span>
                                <code class="bg-white px-2 py-1 rounded border">claude-haiku-4-5-20251001</code>
                                <span class="text-xs text-gray-500">（高速・低コスト）</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-gray-600">•</span>
                                <code class="bg-white px-2 py-1 rounded border">claude-3-5-sonnet-20241022</code>
                                <span class="text-xs text-gray-500">（バランス型）</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-gray-600">•</span>
                                <code class="bg-white px-2 py-1 rounded border">claude-sonnet-4-20250514</code>
                                <span class="text-xs text-gray-500">（高性能）</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-gray-600">•</span>
                                <code class="bg-white px-2 py-1 rounded border">claude-opus-4-20250514</code>
                                <span class="text-xs text-gray-500">（最高性能）</span>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-3">
                            <i class="fas fa-external-link-alt mr-1"></i>
                            最新のモデル名は 
                            <a href="https://docs.anthropic.com/en/docs/about-claude/models" target="_blank" class="text-blue-600 hover:underline">
                                Anthropic公式ドキュメント
                            </a>
                            で確認できます
                        </p>
                    </div>
                </div>
                
                <!-- Gemini設定セクション -->
                <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <div class="flex items-center gap-3 mb-6">
                        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <i class="fas fa-robot text-blue-600 text-xl"></i>
                        </div>
                        <div>
                            <h2 class="text-lg font-semibold">Gemini API モデル</h2>
                            <p class="text-sm text-gray-500">Google Gemini APIで使用するモデル名を指定します（フォールバック用）</p>
                        </div>
                    </div>
                    
                    <div class="space-y-6">
                        <!-- Geminiモデル -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                <i class="fas fa-cog text-blue-500 mr-1"></i>
                                Geminiモデル
                            </label>
                            <input type="text" id="ai_model_gemini" 
                                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                                placeholder="gemini-2.0-flash">
                            <p class="text-xs text-gray-500 mt-1">
                                Claude APIが利用できない場合のフォールバックとして使用されます
                            </p>
                        </div>
                    </div>
                    
                    <!-- Geminiモデル名の例 -->
                    <div class="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h3 class="text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-lightbulb text-yellow-500 mr-1"></i>
                            利用可能なGeminiモデル名の例
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm font-mono">
                            <div class="flex items-center gap-2">
                                <span class="text-gray-600">•</span>
                                <code class="bg-white px-2 py-1 rounded border">gemini-2.0-flash</code>
                                <span class="text-xs text-gray-500">（高速・推奨）</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-gray-600">•</span>
                                <code class="bg-white px-2 py-1 rounded border">gemini-2.0-flash-lite</code>
                                <span class="text-xs text-gray-500">（最軽量）</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-gray-600">•</span>
                                <code class="bg-white px-2 py-1 rounded border">gemini-1.5-flash</code>
                                <span class="text-xs text-gray-500">（安定版）</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-gray-600">•</span>
                                <code class="bg-white px-2 py-1 rounded border">gemini-1.5-pro</code>
                                <span class="text-xs text-gray-500">（高性能）</span>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-3">
                            <i class="fas fa-external-link-alt mr-1"></i>
                            最新のモデル名は 
                            <a href="https://ai.google.dev/models/gemini" target="_blank" class="text-blue-600 hover:underline">
                                Google AI公式ドキュメント
                            </a>
                            で確認できます
                        </p>
                    </div>
                    
                    <!-- 保存ボタン -->
                    <div class="mt-6 flex items-center justify-between">
                        <button onclick="testAIModel()" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                            <i class="fas fa-vial"></i>
                            接続テスト
                        </button>
                        <button onclick="saveAIModels()" class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                            <i class="fas fa-save"></i>
                            設定を保存
                        </button>
                    </div>
                    
                    <div id="testResult" class="mt-4 hidden"></div>
                </div>
                
                <!-- 注意事項 -->
                <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div class="flex items-start gap-3">
                        <i class="fas fa-exclamation-triangle text-amber-500 mt-1"></i>
                        <div class="text-sm text-amber-800">
                            <p class="font-medium">モデル変更時の注意</p>
                            <ul class="mt-2 space-y-1 list-disc list-inside text-amber-700">
                                <li>モデル名を変更すると、すべてのAI機能に即座に反映されます</li>
                                <li>存在しないモデル名を設定するとAI機能がエラーになります</li>
                                <li>高性能モデル（Sonnet/Opus）はコストが高くなります</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <script>
            // 設定読み込み
            async function loadAIModels() {
                try {
                    const response = await axios.get('/api/master/ai-models');
                    const models = response.data;
                    
                    document.getElementById('ai_model_claude').value = models.ai_model_claude || 'claude-haiku-4-5-20251001';
                    document.getElementById('ai_model_claude_multimodal').value = models.ai_model_claude_multimodal || 'claude-haiku-4-5-20251001';
                    document.getElementById('ai_model_gemini').value = models.ai_model_gemini || 'gemini-2.0-flash';
                } catch (error) {
                    console.error('Error loading AI models:', error);
                }
            }
            
            // 設定保存
            async function saveAIModels() {
                try {
                    const models = {
                        ai_model_claude: document.getElementById('ai_model_claude').value,
                        ai_model_claude_multimodal: document.getElementById('ai_model_claude_multimodal').value,
                        ai_model_gemini: document.getElementById('ai_model_gemini').value
                    };
                    
                    await axios.put('/api/master/ai-models', models);
                    alert('AIモデル設定を保存しました');
                } catch (error) {
                    console.error('Error saving AI models:', error);
                    alert('保存に失敗しました');
                }
            }
            
            // 接続テスト
            async function testAIModel() {
                const resultDiv = document.getElementById('testResult');
                resultDiv.innerHTML = '<div class="p-3 bg-gray-100 rounded-lg"><i class="fas fa-spinner fa-spin mr-2"></i>テスト中...</div>';
                resultDiv.classList.remove('hidden');
                
                try {
                    const response = await axios.post('/api/test-claude-env');
                    if (response.data.success) {
                        resultDiv.innerHTML = '<div class="p-3 bg-green-100 text-green-800 rounded-lg"><i class="fas fa-check-circle mr-2"></i>' + response.data.message + '</div>';
                    } else {
                        resultDiv.innerHTML = '<div class="p-3 bg-red-100 text-red-800 rounded-lg"><i class="fas fa-times-circle mr-2"></i>' + (response.data.error || 'テスト失敗') + '</div>';
                    }
                } catch (error) {
                    resultDiv.innerHTML = '<div class="p-3 bg-red-100 text-red-800 rounded-lg"><i class="fas fa-times-circle mr-2"></i>接続テストに失敗しました</div>';
                }
            }
            
            // 初期読み込み
            loadAIModels();
        </script>
    </body>
    </html>
  `)
})

// AIプロンプト管理ページ
routes.get('/master/ai-prompts', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AIプロンプト管理 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('prompts')}
            
            <main class="flex-1 p-8">
                <div class="mb-6">
                    <h1 class="text-3xl font-bold text-gray-800">AIプロンプト管理</h1>
                    <p class="text-gray-600 mt-1">文書生成時に使用するAIプロンプトを管理</p>
                </div>
                
                <!-- タブ -->
                <div class="bg-white rounded-xl shadow-sm mb-6">
                    <div class="border-b">
                        <nav class="flex">
                            <button onclick="switchTab('section')" id="tab-section" class="px-6 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
                                セクション別プロンプト
                            </button>
                            <button onclick="switchTab('base')" id="tab-base" class="px-6 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                                ベースプロンプト
                            </button>
                            <button onclick="switchTab('rules')" id="tab-rules" class="px-6 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700">
                                出力ルール
                            </button>
                        </nav>
                    </div>
                    
                    <!-- セクション別プロンプト -->
                    <div id="content-section" class="p-6">
                        <p class="text-sm text-gray-500 mb-4">各セクションの文書生成時に使用されるプロンプトです。セクションごとに目的・必須記載事項・禁止事項を設定できます。</p>
                        <div id="sectionPrompts" class="space-y-4">
                            <div class="animate-pulse h-32 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                    
                    <!-- ベースプロンプト -->
                    <div id="content-base" class="p-6 hidden">
                        <p class="text-sm text-gray-500 mb-4">すべての文書生成で共通して使用されるベースプロンプトです。</p>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">ベースプロンプト</label>
                                <textarea id="basePrompt" rows="15" class="w-full px-3 py-2 border rounded-lg font-mono text-sm"></textarea>
                            </div>
                            <div class="flex justify-end">
                                <button onclick="saveBasePrompt()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    <i class="fas fa-save mr-1"></i>保存
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 出力ルール -->
                    <div id="content-rules" class="p-6 hidden">
                        <p class="text-sm text-gray-500 mb-4">AI出力時の品質ルールを設定します。</p>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">出力ルール</label>
                                <textarea id="outputRules" rows="15" class="w-full px-3 py-2 border rounded-lg font-mono text-sm"></textarea>
                            </div>
                            <div class="flex justify-end">
                                <button onclick="saveOutputRules()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    <i class="fas fa-save mr-1"></i>保存
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- セクションプロンプト編集モーダル -->
        <div id="sectionModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
                    <h3 id="sectionModalTitle" class="text-lg font-bold">セクションプロンプト編集</h3>
                    <button onclick="closeSectionModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <form id="sectionForm" class="p-6 space-y-4">
                    <input type="hidden" id="sectionId">
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">セクションの目的</label>
                        <textarea id="sectionPurpose" rows="3" class="w-full px-3 py-2 border rounded-lg" placeholder="このセクションで何を伝えるべきか"></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">必須記載事項</label>
                        <textarea id="sectionRequired" rows="5" class="w-full px-3 py-2 border rounded-lg" placeholder="・項目1&#10;・項目2&#10;・項目3"></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">記載禁止事項</label>
                        <textarea id="sectionProhibited" rows="4" class="w-full px-3 py-2 border rounded-lg" placeholder="・禁止項目1&#10;・禁止項目2"></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">文体・トーン</label>
                        <textarea id="sectionTone" rows="2" class="w-full px-3 py-2 border rounded-lg" placeholder="断定的に、数値を明示して等"></textarea>
                    </div>
                    
                    <div class="flex justify-end gap-3 pt-4">
                        <button type="button" onclick="closeSectionModal()" class="px-4 py-2 border rounded-lg hover:bg-gray-50">キャンセル</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-save mr-1"></i>保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <script>
            const masterToken = localStorage.getItem('master_token');
            if (!masterToken) window.location.href = '/master/login';
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + masterToken;
            
            const sectionLabels = {
                'company_overview': '企業概要',
                'current_situation': '現状の課題',
                'implementation_plan': 'IT導入計画',
                'expected_results': '導入効果',
                'future_plan': '将来展望'
            };
            
            function switchTab(tab) {
                document.querySelectorAll('[id^="tab-"]').forEach(el => {
                    el.classList.remove('border-blue-600', 'text-blue-600');
                    el.classList.add('border-transparent', 'text-gray-500');
                });
                document.querySelectorAll('[id^="content-"]').forEach(el => el.classList.add('hidden'));
                
                document.getElementById('tab-' + tab).classList.add('border-blue-600', 'text-blue-600');
                document.getElementById('tab-' + tab).classList.remove('border-transparent', 'text-gray-500');
                document.getElementById('content-' + tab).classList.remove('hidden');
            }
            
            async function loadPrompts() {
                try {
                    const res = await axios.get('/api/master/ai-prompts');
                    const prompts = res.data;
                    
                    // セクション別プロンプト
                    let sectionHtml = '';
                    for (const [key, label] of Object.entries(sectionLabels)) {
                        const p = prompts.sections?.[key] || {};
                        sectionHtml += \`
                            <div class="border rounded-lg p-4">
                                <div class="flex items-center justify-between mb-2">
                                    <h4 class="font-medium text-gray-800">\${label}</h4>
                                    <button onclick="editSection('\${key}')" class="text-blue-600 hover:text-blue-800 text-sm">
                                        <i class="fas fa-edit mr-1"></i>編集
                                    </button>
                                </div>
                                <p class="text-sm text-gray-600">\${p.purpose || '（未設定）'}</p>
                            </div>
                        \`;
                    }
                    document.getElementById('sectionPrompts').innerHTML = sectionHtml;
                    
                    // ベースプロンプト
                    document.getElementById('basePrompt').value = prompts.base || '';
                    
                    // 出力ルール
                    document.getElementById('outputRules').value = prompts.rules || '';
                    
                } catch (e) {
                    console.error('Load prompts error:', e);
                }
            }
            
            let currentSectionData = {};
            
            async function editSection(sectionId) {
                try {
                    const res = await axios.get('/api/master/ai-prompts');
                    const p = res.data.sections?.[sectionId] || {};
                    currentSectionData = p;
                    
                    document.getElementById('sectionModalTitle').textContent = sectionLabels[sectionId] + ' のプロンプト編集';
                    document.getElementById('sectionId').value = sectionId;
                    document.getElementById('sectionPurpose').value = p.purpose || '';
                    document.getElementById('sectionRequired').value = p.required || '';
                    document.getElementById('sectionProhibited').value = p.prohibited || '';
                    document.getElementById('sectionTone').value = p.tone || '';
                    
                    document.getElementById('sectionModal').classList.remove('hidden');
                } catch (e) {
                    alert('読み込みに失敗しました');
                }
            }
            
            function closeSectionModal() {
                document.getElementById('sectionModal').classList.add('hidden');
            }
            
            document.getElementById('sectionForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const sectionId = document.getElementById('sectionId').value;
                
                try {
                    await axios.put('/api/master/ai-prompts/section/' + sectionId, {
                        purpose: document.getElementById('sectionPurpose').value,
                        required: document.getElementById('sectionRequired').value,
                        prohibited: document.getElementById('sectionProhibited').value,
                        tone: document.getElementById('sectionTone').value
                    });
                    closeSectionModal();
                    loadPrompts();
                    alert('保存しました');
                } catch (e) {
                    alert('保存に失敗しました');
                }
            });
            
            async function saveBasePrompt() {
                try {
                    await axios.put('/api/master/ai-prompts/base', {
                        content: document.getElementById('basePrompt').value
                    });
                    alert('保存しました');
                } catch (e) {
                    alert('保存に失敗しました');
                }
            }
            
            async function saveOutputRules() {
                try {
                    await axios.put('/api/master/ai-prompts/rules', {
                        content: document.getElementById('outputRules').value
                    });
                    alert('保存しました');
                } catch (e) {
                    alert('保存に失敗しました');
                }
            }
            
            function masterLogout() {
                localStorage.removeItem('master_token');
                window.location.href = '/master/login';
            }
            
            loadPrompts();
        </script>
    </body>
    </html>
  `)
})

// AIプロンプトAPI
routes.get('/master/ai-prompts', async (c) => {
  const { DB } = c.env
  
  // site_settingsからプロンプト設定を取得
  const settings = await DB.prepare(`
    SELECT setting_key, setting_value FROM site_settings
    WHERE setting_key LIKE 'ai_prompt_%'
  `).all()
  
  const prompts: any = {
    sections: {},
    base: '',
    rules: ''
  }
  
  for (const s of (settings?.results || [])) {
    const key = (s as any).setting_key
    const value = (s as any).setting_value
    
    if (key === 'ai_prompt_base') {
      prompts.base = value
    } else if (key === 'ai_prompt_rules') {
      prompts.rules = value
    } else if (key.startsWith('ai_prompt_section_')) {
      const sectionId = key.replace('ai_prompt_section_', '')
      try {
        prompts.sections[sectionId] = JSON.parse(value)
      } catch (e) {
        prompts.sections[sectionId] = {}
      }
    }
  }
  
  // デフォルト値を設定
  if (!prompts.base) {
    prompts.base = `あなたは補助金申請の専門家です。以下の情報を基に、事業計画書のセクションを作成してください。

【重要なルール】
・ヒアリング回答に記載された情報のみを使用すること
・ヒアリング回答にない情報は絶対に創作しないこと
・具体的な数値はヒアリング回答から引用すること
・ヒアリング回答にない項目は「記載なし」と明記すること`
  }
  
  if (!prompts.rules) {
    prompts.rules = `【出力ルール】
1. 文字数は指定の80%〜100%を目安に
2. セクション番号・タイトルは出力しない（内容のみ）
3. マークダウン記法は使用禁止（**、*、#、- など）
4. 箇条書きは「・」のみ使用可
5. 禁止事項に記載の内容は絶対に含めない
6. 他セクションとの重複を避ける
7. ヒアリング回答にない情報は書かない

【文書品質】
・連続する空行禁止
・冗長な前置きを省き本題から開始
・断定的な文体で記載`
  }
  
  // セクション別デフォルトプリセット
  const defaultSectionPrompts: Record<string, any> = {
    'company_overview': {
      purpose: '申請企業の基本情報と事業内容を簡潔に紹介し、審査員に企業の全体像を理解してもらう。補助金の対象として適格であることを示す。',
      required: `・会社名、所在地、設立年、資本金、従業員数
・主な事業内容と取扱商品・サービス
・年商（売上高）と主要取引先
・企業の強みや特徴
・業界での位置づけ`,
      prohibited: `・課題や問題点の記載（次セクションで記載）
・IT導入計画の詳細（別セクションで記載）
・将来の目標や展望（別セクションで記載）
・冗長な会社沿革`,
      tone: '客観的かつ簡潔に。数値は具体的に記載。企業の信頼性が伝わる堅実な文体。'
    },
    'current_situation': {
      purpose: '現在の業務における具体的な課題と問題点を明確にし、IT導入の必要性・緊急性を審査員に理解してもらう。',
      required: `・現在の業務フローと非効率な点
・具体的な課題（時間、コスト、人的ミスなど）
・課題による損失（残業時間、機会損失など数値で）
・現状のシステム・ツール環境
・課題を放置した場合のリスク`,
      prohibited: `・企業概要の繰り返し（前セクションで記載済み）
・導入するITツールの詳細（次セクションで記載）
・導入効果の記載（別セクションで記載）
・抽象的な課題表現`,
      tone: '課題の深刻さを具体的な数値で示す。「〜が問題である」と断定的に記載。'
    },
    'implementation_plan': {
      purpose: '導入するITツールと具体的な導入計画を示し、実現可能性と計画の妥当性を審査員に理解してもらう。',
      required: `・導入するITツール名と選定理由
・導入スケジュール（準備、導入、運用開始時期）
・導入費用の内訳と予算
・社内体制（責任者、担当者）
・ベンダーとの連携体制
・従業員への教育・研修計画`,
      prohibited: `・企業概要の繰り返し
・課題の再説明（前セクションで記載済み）
・導入効果の詳細（次セクションで記載）
・他社製品との比較`,
      tone: '計画の具体性と実現可能性を示す。スケジュールは月単位で明記。'
    },
    'expected_results': {
      purpose: 'IT導入による具体的な効果を定量的・定性的に示し、投資対効果（ROI）を審査員に理解してもらう。',
      required: `・定量的効果（削減時間、コスト削減額、生産性向上率）
・定性的効果（品質向上、顧客満足度、従業員満足度）
・投資回収期間の見込み
・効果測定の方法とKPI
・効果が出るまでの想定期間`,
      prohibited: `・課題の説明の繰り返し（前セクションで記載済み）
・導入計画の繰り返し（前セクションで記載済み）
・将来展望（次セクションで記載）
・根拠のない効果予測`,
      tone: '効果は必ず数値で示す。「〜が期待される」ではなく「〜を達成する」と断定的に。'
    },
    'future_plan': {
      purpose: 'IT導入を起点とした中長期的な成長ビジョンを示し、事業の発展性と継続性を審査員にアピールする。',
      required: `・3年後、5年後の売上目標など具体的な成長目標
・IT導入が成長にどう貢献するか
・追加投資や機能拡張の計画
・人材採用・育成計画
・地域経済・雇用への貢献（該当する場合）`,
      prohibited: `・課題の説明の繰り返し
・導入効果の繰り返し（前セクションで記載済み）
・企業概要の繰り返し
・実現困難な目標`,
      tone: '将来への意欲と具体的なビジョンを示す。成長への確信を伝える前向きな文体。'
    }
  }
  
  // DBに保存されていないセクションはデフォルト値を使用
  for (const [sectionId, defaultPrompt] of Object.entries(defaultSectionPrompts)) {
    if (!prompts.sections[sectionId] || Object.keys(prompts.sections[sectionId]).length === 0) {
      prompts.sections[sectionId] = defaultPrompt
    }
  }
  
  return c.json(prompts)
})

routes.put('/master/ai-prompts/section/:sectionId', async (c) => {
  const { DB } = c.env
  const sectionId = c.req.param('sectionId')
  const data = await c.req.json()
  
  const key = 'ai_prompt_section_' + sectionId
  const value = JSON.stringify(data)
  
  await DB.prepare(`
    INSERT INTO site_settings (setting_key, setting_value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(key, value).run()
  
  return c.json({ success: true })
})

routes.put('/master/ai-prompts/base', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  await DB.prepare(`
    INSERT INTO site_settings (setting_key, setting_value, updated_at)
    VALUES ('ai_prompt_base', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(data.content).run()
  
  return c.json({ success: true })
})

routes.put('/master/ai-prompts/rules', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  await DB.prepare(`
    INSERT INTO site_settings (setting_key, setting_value, updated_at)
    VALUES ('ai_prompt_rules', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(data.content).run()
  
  return c.json({ success: true })
})

// 文書テンプレート管理ページ
routes.get('/master/document-templates', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>文書テンプレート管理 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('templates')}
            
            <main class="flex-1 p-8">
                <div class="mb-6 flex items-center justify-between">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-800">文書テンプレート管理</h1>
                        <p class="text-gray-600 mt-1">事業計画書などの文書テンプレートを管理</p>
                    </div>
                    <button onclick="openAddTemplateModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <i class="fas fa-plus"></i>新規テンプレート
                    </button>
                </div>
                
                <div id="templateList" class="grid gap-4">
                    <div class="animate-pulse h-32 bg-gray-200 rounded-xl"></div>
                </div>
            </main>
        </div>
        
        <!-- テンプレート編集モーダル -->
        <div id="templateModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
                    <h3 id="templateModalTitle" class="text-lg font-bold">テンプレート編集</h3>
                    <button onclick="closeTemplateModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <form id="templateForm" class="p-6 space-y-4">
                    <input type="hidden" id="templateId">
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">テンプレート名 <span class="text-red-500">*</span></label>
                            <input type="text" id="templateName" class="w-full px-3 py-2 border rounded-lg" required placeholder="例: IT導入補助金 事業計画書">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">対象補助金種別</label>
                            <select id="templateSubsidyType" class="w-full px-3 py-2 border rounded-lg">
                                <option value="">すべて</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">セクション構成</label>
                        <div id="sectionEditor" class="space-y-2 border rounded-lg p-4 bg-gray-50">
                            <!-- セクションがここに追加される -->
                        </div>
                        <button type="button" onclick="addSection()" class="mt-2 text-sm text-blue-600 hover:text-blue-800">
                            <i class="fas fa-plus mr-1"></i>セクションを追加
                        </button>
                    </div>
                    
                    <div class="flex justify-end gap-3 pt-4">
                        <button type="button" onclick="closeTemplateModal()" class="px-4 py-2 border rounded-lg hover:bg-gray-50">キャンセル</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-save mr-1"></i>保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <script>
            const masterToken = localStorage.getItem('master_token');
            if (!masterToken) window.location.href = '/master/login';
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + masterToken;
            
            let currentSections = [];
            
            async function loadSubsidyTypes() {
                try {
                    const res = await axios.get('/api/subsidy-types');
                    const select = document.getElementById('templateSubsidyType');
                    (res.data || []).forEach(st => {
                        select.innerHTML += \`<option value="\${st.id}">\${st.name}</option>\`;
                    });
                } catch (e) {
                    console.error(e);
                }
            }
            
            async function loadTemplates() {
                try {
                    const res = await axios.get('/api/document-templates');
                    const templates = res.data || [];
                    
                    if (templates.length === 0) {
                        document.getElementById('templateList').innerHTML = \`
                            <div class="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
                                <i class="fas fa-file-alt text-4xl mb-3 text-gray-300"></i>
                                <p>テンプレートがありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    document.getElementById('templateList').innerHTML = templates.map(t => {
                        const sections = JSON.parse(t.sections || '[]');
                        return \`
                            <div class="bg-white rounded-xl shadow-sm p-6">
                                <div class="flex items-start justify-between">
                                    <div>
                                        <h3 class="font-semibold text-lg text-gray-800">\${t.template_name}</h3>
                                        <p class="text-sm text-gray-500 mt-1">\${sections.length}セクション</p>
                                        <div class="flex flex-wrap gap-2 mt-3">
                                            \${sections.map(s => \`
                                                <span class="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">\${s.title}</span>
                                            \`).join('')}
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button onclick="editTemplate(\${t.id})" class="p-2 text-blue-600 hover:bg-blue-50 rounded">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button onclick="deleteTemplate(\${t.id})" class="p-2 text-red-600 hover:bg-red-50 rounded">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        \`;
                    }).join('');
                    
                } catch (e) {
                    console.error('Load templates error:', e);
                }
            }
            
            function openAddTemplateModal() {
                document.getElementById('templateModalTitle').textContent = '新規テンプレート作成';
                document.getElementById('templateId').value = '';
                document.getElementById('templateForm').reset();
                currentSections = [
                    { id: 'company_overview', title: '1. 企業概要', description: '会社の基本情報と事業内容', max_chars: 800 },
                    { id: 'current_situation', title: '2. 現状の課題', description: '現在の業務課題と問題点', max_chars: 1000 },
                    { id: 'implementation_plan', title: '3. IT導入計画', description: '導入するITツールと計画', max_chars: 1200 },
                    { id: 'expected_results', title: '4. 導入効果', description: '期待される効果と成果', max_chars: 1000 },
                    { id: 'future_plan', title: '5. 将来展望', description: '中長期的な成長ビジョン', max_chars: 800 }
                ];
                renderSections();
                document.getElementById('templateModal').classList.remove('hidden');
            }
            
            async function editTemplate(id) {
                try {
                    const res = await axios.get('/api/document-templates/' + id);
                    const t = res.data;
                    
                    document.getElementById('templateModalTitle').textContent = 'テンプレート編集';
                    document.getElementById('templateId').value = t.id;
                    document.getElementById('templateName').value = t.template_name;
                    document.getElementById('templateSubsidyType').value = t.subsidy_type_id || '';
                    currentSections = JSON.parse(t.sections || '[]');
                    renderSections();
                    document.getElementById('templateModal').classList.remove('hidden');
                } catch (e) {
                    alert('テンプレートの取得に失敗しました');
                }
            }
            
            function renderSections() {
                document.getElementById('sectionEditor').innerHTML = currentSections.map((s, i) => \`
                    <div class="flex items-center gap-2 bg-white p-3 rounded border">
                        <i class="fas fa-grip-vertical text-gray-400 cursor-move"></i>
                        <input type="text" value="\${s.title}" onchange="updateSection(\${i}, 'title', this.value)" class="flex-1 px-2 py-1 border rounded text-sm" placeholder="タイトル">
                        <input type="text" value="\${s.description || ''}" onchange="updateSection(\${i}, 'description', this.value)" class="flex-1 px-2 py-1 border rounded text-sm" placeholder="説明">
                        <input type="number" value="\${s.max_chars || 800}" onchange="updateSection(\${i}, 'max_chars', parseInt(this.value))" class="w-24 px-2 py-1 border rounded text-sm" placeholder="文字数">
                        <button type="button" onclick="removeSection(\${i})" class="p-1 text-red-500 hover:text-red-700">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                \`).join('');
            }
            
            function updateSection(index, field, value) {
                currentSections[index][field] = value;
            }
            
            function addSection() {
                const num = currentSections.length + 1;
                currentSections.push({
                    id: 'section_' + Date.now(),
                    title: num + '. 新しいセクション',
                    description: '',
                    max_chars: 800
                });
                renderSections();
            }
            
            function removeSection(index) {
                currentSections.splice(index, 1);
                renderSections();
            }
            
            function closeTemplateModal() {
                document.getElementById('templateModal').classList.add('hidden');
            }
            
            async function deleteTemplate(id) {
                if (!confirm('このテンプレートを削除しますか？')) return;
                try {
                    await axios.delete('/api/document-templates/' + id);
                    loadTemplates();
                } catch (e) {
                    alert('削除に失敗しました');
                }
            }
            
            document.getElementById('templateForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('templateId').value;
                
                const data = {
                    template_name: document.getElementById('templateName').value,
                    subsidy_type_id: document.getElementById('templateSubsidyType').value || null,
                    sections: JSON.stringify(currentSections)
                };
                
                try {
                    if (id) {
                        await axios.put('/api/document-templates/' + id, data);
                    } else {
                        await axios.post('/api/document-templates', data);
                    }
                    closeTemplateModal();
                    loadTemplates();
                } catch (e) {
                    alert('保存に失敗しました');
                }
            });
            
            function masterLogout() {
                localStorage.removeItem('master_token');
                window.location.href = '/master/login';
            }
            
            loadSubsidyTypes();
            loadTemplates();
        </script>
    </body>
    </html>
  `)
})

// 文書テンプレートAPI
routes.get('/document-templates/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const template = await DB.prepare('SELECT * FROM document_templates WHERE id = ?').bind(id).first()
  return c.json(template)
})

routes.post('/document-templates', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  await DB.prepare(`
    INSERT INTO document_templates (template_name, subsidy_type_id, sections)
    VALUES (?, ?, ?)
  `).bind(data.template_name, data.subsidy_type_id, data.sections).run()
  
  return c.json({ success: true })
})

routes.put('/document-templates/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE document_templates SET
      template_name = ?,
      subsidy_type_id = ?,
      sections = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(data.template_name, data.subsidy_type_id, data.sections, id).run()
  
  return c.json({ success: true })
})

routes.delete('/document-templates/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  await DB.prepare('DELETE FROM document_templates WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

export default routes
