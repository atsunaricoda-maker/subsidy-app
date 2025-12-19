// 顧客詳細画面
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/client/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const client = await DB.prepare(`
    SELECT * FROM clients WHERE id = ?
  `).bind(id).first()
  
  if (!client) {
    return c.text('Client not found', 404)
  }
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${client.name} - 顧客詳細</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('clients')}
            
            <!-- メインコンテンツ -->
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <div>
                                <div class="text-sm text-gray-500">顧客詳細</div>
                                <h2 class="text-lg font-bold text-gray-800">${client.name}</h2>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <a href="/clients" class="text-gray-500 hover:text-gray-700 text-sm">
                                <i class="fas fa-arrow-left mr-1"></i>一覧に戻る
                            </a>
                        </div>
                    </div>
                </header>

                <div class="p-4 lg:p-6">
                <!-- タブナビゲーション -->
                <div class="bg-white rounded-lg shadow mb-6">
                    <div class="border-b flex overflow-x-auto">
                        <button onclick="switchClientTab('overview')" id="client-tab-overview" 
                                class="px-6 py-3 font-medium text-blue-600 border-b-2 border-blue-600 whitespace-nowrap">
                            <i class="fas fa-user mr-2"></i>基本情報
                        </button>
                        <button onclick="switchClientTab('cases')" id="client-tab-cases" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-folder-open mr-2"></i>案件一覧
                        </button>
                        <button onclick="switchClientTab('ai')" id="client-tab-ai" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-robot mr-2"></i>AIアシスタント
                        </button>
                        <button onclick="switchClientTab('documents')" id="client-tab-documents" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-file-alt mr-2"></i>生成文書
                        </button>
                        <button onclick="switchClientTab('pipeline')" id="client-tab-pipeline" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-tasks mr-2"></i>タスク進捗
                        </button>
                    </div>
                </div>

                <!-- 基本情報タブ -->
                <div id="client-content-overview" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- 左カラム：顧客情報 -->
                    <div class="lg:col-span-1 space-y-6">
                        <!-- 顧客情報カード -->
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h2 class="text-lg font-bold mb-4 flex items-center">
                                <i class="fas fa-user-circle mr-2 text-blue-600"></i>顧客情報
                            </h2>
                            <div class="space-y-3 text-sm" id="clientInfo"></div>
                            <div class="flex gap-2 mt-4">
                                <button onclick="editClient()" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm">
                                    <i class="fas fa-edit mr-1"></i>編集
                                </button>
                                <button onclick="deleteCurrentClient()" id="deleteClientBtn" class="hidden flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 text-sm">
                                    <i class="fas fa-trash mr-1"></i>削除
                                </button>
                            </div>
                        </div>

                        <!-- 共通書類カード -->
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h2 class="text-lg font-bold mb-3 flex items-center">
                                <i class="fas fa-folder mr-2 text-yellow-600"></i>共通書類
                            </h2>
                            <p class="text-xs text-gray-500 mb-3">全申請で共通利用できる書類</p>
                            <div id="commonDocumentsListAdmin" class="space-y-2 max-h-64 overflow-y-auto">
                                <div class="text-sm text-gray-500 py-2">読み込み中...</div>
                            </div>
                        </div>
                    </div>

                    <!-- 右カラム：やり取り記録 -->
                    <div class="lg:col-span-2">
                        <div class="bg-white rounded-xl shadow-sm p-6 h-full flex flex-col">
                            <h2 class="text-lg font-bold mb-4 flex items-center">
                                <i class="fas fa-comments mr-2 text-green-600"></i>やり取り記録
                            </h2>
                            <div id="communicationsList" class="space-y-4 mb-4 flex-1 max-h-[500px] overflow-y-auto"></div>
                            
                            <form id="messageForm" class="flex gap-2 pt-4 border-t">
                                <input type="text" id="messageInput" placeholder="メッセージを入力..." 
                                       class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" required>
                                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                                    <i class="fas fa-paper-plane mr-1"></i>送信
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- 案件一覧タブ -->
                <div id="client-content-cases" class="hidden">
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-lg font-bold flex items-center">
                                <i class="fas fa-folder-open mr-2 text-blue-600"></i>案件一覧
                            </h2>
                            <button onclick="openNewCaseModalForThisClient()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                <i class="fas fa-plus mr-2"></i>新規案件登録
                            </button>
                        </div>
                        <div id="clientCasesList" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div class="col-span-full text-center py-12 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                <div>読み込み中...</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- AIアシスタントタブ -->
                <div id="client-content-ai" class="hidden space-y-6">
                    <!-- 上段：AIチャットと補助金マッチング -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- AIヒアリング -->
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <div class="flex justify-between items-center mb-4">
                                <h2 class="text-lg font-bold flex items-center">
                                    <i class="fas fa-robot mr-2 text-purple-600"></i>AIアシスタント
                                </h2>
                                <div class="flex gap-2">
                                    <button onclick="setAiChatMode('hearing')" id="aiModeHearing" class="px-3 py-1 text-xs rounded-full bg-purple-600 text-white">
                                        ヒアリング
                                    </button>
                                    <button onclick="setAiChatMode('review')" id="aiModeReview" class="px-3 py-1 text-xs rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300">
                                        文書添削
                                    </button>
                                </div>
                            </div>
                            
                            <!-- ヒアリングモード説明 -->
                            <p id="aiModeHearingDesc" class="text-sm text-gray-600 mb-4">補助金申請に必要な情報をAIがヒアリングします</p>
                            
                            <!-- 文書添削モード：文書選択 -->
                            <div id="aiModeReviewSection" class="hidden mb-4">
                                <p class="text-sm text-gray-600 mb-2">添削したい文書を選択してください</p>
                                <select id="reviewDocumentSelect" class="w-full px-3 py-2 border rounded-lg text-sm" onchange="loadDocumentForReview()">
                                    <option value="">-- 文書を選択 --</option>
                                </select>
                                <div id="selectedDocumentPreview" class="hidden mt-3 p-3 bg-gray-100 rounded-lg max-h-32 overflow-y-auto text-xs text-gray-700"></div>
                            </div>
                            
                            <div id="aiChatContainer" class="border rounded-lg mb-4 h-64 overflow-y-auto p-4 bg-gray-50">
                                <div class="text-center text-gray-500 py-8">
                                    <i class="fas fa-robot text-4xl mb-2 text-purple-400"></i>
                                    <p>AIアシスタントとの会話を開始してください</p>
                                </div>
                            </div>
                            
                            <form id="aiChatForm" class="flex gap-2">
                                <input type="text" id="aiChatInput" placeholder="メッセージを入力..." 
                                       class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" required>
                                <button type="submit" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </form>
                        </div>

                        <!-- 補助金マッチング -->
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <div class="flex justify-between items-center mb-4">
                                <h2 class="text-lg font-bold flex items-center">
                                    <i class="fas fa-search-dollar mr-2 text-green-600"></i>補助金マッチング
                                </h2>
                                <div class="flex gap-2">
                                    <button onclick="runComprehensiveMatching()" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-sm">
                                        <i class="fas fa-brain mr-1"></i>総合分析
                                    </button>
                                    <button onclick="runSubsidyMatching()" class="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 text-sm">
                                        <i class="fas fa-sync mr-1"></i>簡易
                                    </button>
                                </div>
                            </div>
                            <div id="matchingResults" class="space-y-3 max-h-80 overflow-y-auto">
                                <div class="text-center text-gray-500 py-8">
                                    <i class="fas fa-search text-4xl mb-2 text-gray-300"></i>
                                    <p class="text-sm">ボタンを押して補助金との適合性を分析</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 下段：採択率予測 -->
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-lg font-bold flex items-center">
                                <i class="fas fa-chart-line mr-2 text-orange-600"></i>採択率予測
                            </h2>
                            <button onclick="runAdoptionPrediction()" class="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm">
                                <i class="fas fa-calculator mr-1"></i>詳細予測実行
                            </button>
                        </div>
                        <div id="adoptionPredictionResult">
                            <div class="text-center text-gray-500 py-8">
                                <i class="fas fa-chart-bar text-4xl mb-2 text-gray-300"></i>
                                <p class="text-sm">「詳細予測実行」でAIが採択可能性を詳細に分析します</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 生成文書タブ -->
                <div id="client-content-documents" class="hidden space-y-6">
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-lg font-bold">
                                <i class="fas fa-file-signature mr-2 text-indigo-600"></i>AI文書生成
                            </h2>
                            <button onclick="openGenerateDocumentModal()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
                                <i class="fas fa-magic mr-1"></i>新規生成
                            </button>
                        </div>
                        <div id="generatedDocumentsList" class="space-y-4">
                            <div class="text-center text-gray-500 py-8">
                                <i class="fas fa-file-alt text-4xl mb-2 text-gray-300"></i>
                                <p>まだ生成された文書はありません</p>
                                <p class="text-sm mt-2">「新規生成」ボタンで申請書を自動生成できます</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- タスクパイプラインタブ -->
                <div id="client-content-pipeline" class="hidden space-y-6">
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-lg font-bold">
                                <i class="fas fa-tasks mr-2 text-green-600"></i>タスク進捗管理
                            </h2>
                            <button onclick="openAssignPipelineModal()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                                <i class="fas fa-plus mr-1"></i>パイプラインを割り当て
                            </button>
                        </div>
                        
                        <!-- パイプライン一覧 -->
                        <div id="clientPipelinesList">
                            <div class="text-center text-gray-500 py-8">
                                <i class="fas fa-spinner fa-spin text-2xl"></i>
                                <p class="mt-2">読み込み中...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- パイプライン割り当てモーダル -->
        <div id="assignPipelineModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 class="text-xl font-bold mb-4">
                    <i class="fas fa-tasks mr-2 text-green-600"></i>パイプラインを割り当て
                </h3>
                <form id="assignPipelineForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">テンプレート <span class="text-red-500">*</span></label>
                        <select id="pipelineTemplateSelect" class="w-full px-3 py-2 border rounded-lg" required>
                            <option value="">選択してください</option>
                        </select>
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                            <i class="fas fa-check mr-1"></i>割り当て
                        </button>
                        <button type="button" onclick="closeAssignPipelineModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- タスク詳細モーダル -->
        <div id="taskDetailModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-6 max-w-lg w-full">
                <h3 class="text-xl font-bold mb-4" id="taskDetailTitle">
                    <i class="fas fa-clipboard-check mr-2 text-blue-600"></i>タスク詳細
                </h3>
                <form id="taskDetailForm" class="space-y-4">
                    <input type="hidden" id="taskDetailId">
                    <div>
                        <label class="block text-sm font-medium mb-1">進捗率</label>
                        <div class="flex items-center gap-3">
                            <input type="range" id="taskDetailProgress" min="0" max="100" step="10" class="flex-1" 
                                   oninput="updateTaskStatusFromProgress(this.value)">
                            <span id="taskProgressValue" class="text-sm font-medium w-12 text-right">0%</span>
                        </div>
                        <div id="autoStatusHint" class="text-xs text-gray-500 mt-1">
                            <!-- 自動設定されるステータスのヒントを表示 -->
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">ステータス <span class="text-xs text-blue-600">（進捗率で自動設定）</span></label>
                        <div id="taskStatusDisplay" class="flex gap-2">
                            <span id="statusPending" class="flex-1 py-2 text-center rounded-lg border-2 cursor-pointer transition">未着手</span>
                            <span id="statusInProgress" class="flex-1 py-2 text-center rounded-lg border-2 cursor-pointer transition">進行中</span>
                            <span id="statusCompleted" class="flex-1 py-2 text-center rounded-lg border-2 cursor-pointer transition">完了</span>
                        </div>
                        <input type="hidden" id="taskDetailStatus" value="pending">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">メモ</label>
                        <textarea id="taskDetailNotes" rows="3" class="w-full px-3 py-2 border rounded-lg" 
                                  placeholder="作業メモを入力..."></textarea>
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                            <i class="fas fa-save mr-1"></i>保存
                        </button>
                        <button type="button" onclick="closeTaskDetailModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 文書生成モーダル -->
        <div id="generateDocumentModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
                <h3 class="text-xl font-bold mb-4">
                    <i class="fas fa-magic mr-2 text-indigo-600"></i>AI文書生成
                </h3>
                <form id="generateDocumentForm" class="space-y-4">
                    <!-- 案件選択 -->
                    <div>
                        <label class="block text-sm font-medium mb-1">対象案件 <span class="text-red-500">*</span></label>
                        <select id="caseSelect" class="w-full px-3 py-2 border rounded-lg" required onchange="onCaseSelectChange(this.value)">
                            <option value="">選択してください</option>
                        </select>
                        <p class="text-xs text-gray-500 mt-1">選択した案件のヒアリング内容のみが使用されます</p>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">テンプレート <span class="text-red-500">*</span></label>
                        <select id="templateSelect" class="w-full px-3 py-2 border rounded-lg" required onchange="onTemplateSelectChange(this.value)">
                            <option value="">選択してください</option>
                        </select>
                        <p id="templateDescription" class="text-xs text-gray-500 mt-1"></p>
                    </div>
                    
                    <!-- ヒアリング状況 -->
                    <div class="bg-blue-50 rounded-lg p-4">
                        <h4 class="text-sm font-medium mb-2">
                            <i class="fas fa-clipboard-check mr-1 text-blue-600"></i>選択した案件のヒアリング状況
                        </h4>
                        <div id="hearingStatus" class="text-sm text-gray-600">
                            案件を選択してください
                        </div>
                    </div>
                    
                    <!-- 参照する採択事例 -->
                    <div class="bg-green-50 rounded-lg p-4">
                        <h4 class="text-sm font-medium mb-2">
                            <i class="fas fa-trophy mr-1 text-green-600"></i>参照する採択事例
                        </h4>
                        <div id="successCasesPreview" class="text-sm text-gray-600">
                            <i class="fas fa-spinner fa-spin"></i> 読み込み中...
                        </div>
                    </div>
                    
                    <!-- 生成オプション -->
                    <div>
                        <label class="block text-sm font-medium mb-2">生成オプション</label>
                        <div class="space-y-2">
                            <label class="flex items-center gap-2">
                                <input type="checkbox" id="optDetailedNumbers" checked class="rounded">
                                <span class="text-sm">具体的な数値を強調</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" id="optCompetitiveAdvantage" checked class="rounded">
                                <span class="text-sm">競争優位性を明確化</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" id="optFutureVision" checked class="rounded">
                                <span class="text-sm">将来ビジョンを強調</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                        <i class="fas fa-lightbulb text-yellow-600 mr-1"></i>
                        <strong>ヒント：</strong>ヒアリング情報が多いほど、より精度の高い申請書が生成されます。
                        生成後は「プロ編集モード」で詳細な修正が可能です。
                    </div>
                    
                    <div class="flex gap-2 pt-4">
                        <button type="submit" id="generateDocBtn" class="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700">
                            <i class="fas fa-magic mr-1"></i>生成開始
                        </button>
                        <button type="button" onclick="closeGenerateDocumentModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 文書詳細モーダル -->
        <div id="documentDetailModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold" id="documentDetailTitle">文書詳細</h3>
                    <button onclick="closeDocumentDetailModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div id="documentDetailContent"></div>
            </div>
        </div>

        <!-- 顧客編集モーダル -->
        <div id="editClientModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onclick="closeEditModal()">
            <div class="bg-white rounded-lg p-4 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-bold">顧客情報編集</h3>
                    <button onclick="closeEditModal()" class="text-gray-500 hover:text-gray-700 text-2xl leading-none">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="editClientForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">顧客名 *</label>
                        <input type="text" name="name" id="edit_name" required class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">会社名</label>
                        <input type="text" name="company_name" id="edit_company_name" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">メールアドレス</label>
                        <input type="email" name="email" id="edit_email" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">電話番号</label>
                        <input type="tel" name="phone" id="edit_phone" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">住所</label>
                        <input type="text" name="address" id="edit_address" class="w-full px-3 py-2 border rounded-lg" placeholder="東京都...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">メモ</label>
                        <textarea name="notes" id="edit_notes" rows="3" class="w-full px-3 py-2 border rounded-lg" placeholder="顧客に関するメモ..."></textarea>
                    </div>
                    
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                        <i class="fas fa-info-circle mr-1"></i>
                        ステータス、契約URL、手付金などは各案件の詳細画面で編集できます
                    </div>
                    
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 text-base">
                            <i class="fas fa-save mr-2"></i>更新
                        </button>
                        <button type="button" onclick="closeEditModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400 text-base">
                            キャンセル
                        </button>
                    </div>
                </form>
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
            
            // 認証確認
            if (!checkAuth()) {
                // リダイレクト処理は checkAuth 内で実行
            }
            
            // Axios設定：認証ヘッダーを自動付与
            axios.defaults.headers.common['Authorization'] = \`Bearer \${localStorage.getItem('admin_username')}:\${localStorage.getItem('admin_role')}\`;
        
            const CLIENT_ID = ${id};
            const STATUS_LABELS = {
                inquiry: '見込み',
                preparing: '書類準備中',
                applying: '申請中',
                adopted: '採択・入金待ち',
                rejected: '不採択',
                completed: '完了'
            };
            const STATUS_COLORS = {
                inquiry: 'bg-yellow-100 text-yellow-800',
                preparing: 'bg-orange-100 text-orange-800',
                applying: 'bg-purple-100 text-purple-800',
                adopted: 'bg-blue-100 text-blue-800',
                rejected: 'bg-red-100 text-red-800',
                completed: 'bg-green-100 text-green-800'
            };
            
            let currentClient = null;
            let subsidyTypes = [];
            let allUsers = [];

            async function loadSubsidyTypes() {
                try {
                    console.log('Loading subsidy types...');
                    const response = await axios.get('/api/subsidy-types');
                    subsidyTypes = response.data;
                    console.log('Subsidy types loaded:', subsidyTypes.length);
                    
                    renderEditSubsidyOptions();
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                    throw error; // エラーを再スローして上位で捕捉
                }
            }
            
            // 編集フォーム用：補助金オプションをカテゴリ別にレンダリング
            function renderEditSubsidyOptions(filter = '') {
                const select = document.getElementById('edit_subsidy_type_id');
                if (!select) return;
                
                // カテゴリでグループ化
                const grouped = {};
                subsidyTypes.forEach(type => {
                    const cat = type.category || 'その他';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(type);
                });
                
                // フィルタリング
                const filterLower = filter.toLowerCase();
                let html = '<option value="">選択してください</option>';
                
                Object.entries(grouped).forEach(([category, types]) => {
                    const filteredTypes = types.filter(t => 
                        !filter || 
                        t.name.toLowerCase().includes(filterLower) || 
                        category.toLowerCase().includes(filterLower)
                    );
                    
                    if (filteredTypes.length > 0) {
                        html += \`<optgroup label="📁 \${category}">\`;
                        filteredTypes.forEach(type => {
                            html += \`<option value="\${type.id}">\${type.name}</option>\`;
                        });
                        html += '</optgroup>';
                    }
                });
                
                select.innerHTML = html;
            }
            
            // 編集フォーム用：補助金検索フィルター
            function filterEditSubsidyOptions() {
                const input = document.getElementById('editSubsidySearchInput');
                const currentValue = document.getElementById('edit_subsidy_type_id').value;
                renderEditSubsidyOptions(input.value);
                // 現在の値を維持
                document.getElementById('edit_subsidy_type_id').value = currentValue;
            }
            
            async function loadUsers() {
                try {
                    console.log('Loading users...');
                    const response = await axios.get('/api/admin/users');
                    allUsers = response.data;
                    console.log('Users loaded:', allUsers.length);
                    
                    // 編集フォームのセレクトボックスに追加
                    const select = document.getElementById('editClientAssignedTo');
                    if (select) {
                        select.innerHTML = '<option value="">未割り当て</option>' +
                            allUsers.map(user => \`<option value="\${user.username}">\${user.name}</option>\`).join('');
                    }
                } catch (error) {
                    console.error('Error loading users:', error);
                    throw error; // エラーを再スローして上位で捕捉
                }
            }

            async function loadClient() {
                try {
                    console.log('Loading client... CLIENT_ID:', CLIENT_ID);
                    console.log('subsidyTypes loaded:', subsidyTypes.length, 'items');
                    console.log('allUsers loaded:', allUsers.length, 'items');
                    
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}\`);
                    currentClient = response.data;
                    console.log('Client loaded:', currentClient);
                    
                    // 案件情報を取得（casesテーブルから）
                    const cases = currentClient.cases || [];
                    const latestCase = cases[0]; // 最新の案件
                    
                    // 案件ベースで補助金種別と担当者を取得
                    const subsidyType = latestCase ? subsidyTypes.find(s => s.id === latestCase.subsidy_type_id) : null;
                    const assignedUser = latestCase ? allUsers.find(u => u.username === latestCase.assigned_to) : null;
                    const portalUrl = latestCase ? \`\${window.location.origin}/portal/\${latestCase.access_token}\` : '';
                    
                    // 案件一覧HTML
                    const casesHtml = cases.length > 0 ? cases.map(c => {
                        const caseSubsidy = subsidyTypes.find(s => s.id === c.subsidy_type_id);
                        const caseAssignee = allUsers.find(u => u.username === c.assigned_to);
                        const caseNo = 'No.' + String(c.id).padStart(4, '0');
                        return \`
                            <a href="/case/\${c.id}" class="block p-3 bg-gray-50 rounded-lg border mb-2 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <span class="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700 font-mono font-bold">\${caseNo}</span>
                                        <div class="font-medium text-sm mt-1">\${caseSubsidy ? caseSubsidy.name : '未設定'}</div>
                                    </div>
                                    <span class="text-xs px-2 py-1 rounded \${STATUS_COLORS[c.status] || 'bg-gray-100'}">\${STATUS_LABELS[c.status] || c.status}</span>
                                </div>
                                <div class="text-xs text-gray-500 mt-1">担当: \${caseAssignee ? caseAssignee.name : '未割り当て'}</div>
                                <span onclick="event.preventDefault(); event.stopPropagation(); window.open('/portal/\${c.access_token}', '_blank');" class="text-xs text-blue-600 hover:underline inline-block mt-1">
                                    <i class="fas fa-external-link-alt mr-1"></i>ポータル
                                </span>
                            </a>
                        \`;
                    }).join('') : '<div class="text-gray-500 text-sm">案件がありません</div>';
                    
                    document.getElementById('clientInfo').innerHTML = \`
                        <div><strong>会社名:</strong> \${currentClient.company_name || '-'}</div>
                        <div><strong>メール:</strong> \${currentClient.email || '-'}</div>
                        <div><strong>電話:</strong> \${currentClient.phone || '-'}</div>
                        
                        <div class="mt-4 pt-4 border-t">
                            <strong class="block mb-2">案件一覧 (\${cases.length}件)</strong>
                            \${casesHtml}
                        </div>
                        
                        \${portalUrl ? \`
                        <div class="mt-3 pt-3 border-t">
                            <strong class="block mb-2">最新案件のポータルURL:</strong>
                            <div class="flex gap-2">
                                <input type="text" 
                                       value="\${portalUrl}" 
                                       readonly 
                                       class="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm">
                                <button onclick="copyPortalUrl('\${portalUrl}', '\${currentClient.name}')" 
                                        class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 whitespace-nowrap">
                                    <i class="fas fa-copy mr-1"></i>コピー
                                </button>
                            </div>
                            <a href="\${portalUrl}" target="_blank" 
                               class="text-blue-600 hover:underline text-sm mt-1 inline-block">
                                <i class="fas fa-external-link-alt mr-1"></i>ポータルを開く
                            </a>
                        </div>
                        \` : ''}
                    \`;
                    
                    // adminのみ削除ボタン表示
                    if (localStorage.getItem('admin_role') === 'admin') {
                        const deleteBtn = document.getElementById('deleteClientBtn');
                        if (deleteBtn) deleteBtn.classList.remove('hidden');
                    }
                } catch (error) {
                    console.error('Error loading client:', error);
                    console.error('Error details:', error.message, error.stack);
                    document.getElementById('clientInfo').innerHTML = '<div class="text-red-600">顧客情報の読み込みに失敗しました<br><small>' + (error.message || 'Unknown error') + '</small></div>';
                }
            }
            
            // 顧客削除
            async function deleteCurrentClient() {
                if (!currentClient) return;
                
                // 選択ダイアログを表示
                const choice = await showDeleteChoiceDialog(currentClient.name);
                if (!choice) return;
                
                try {
                    if (choice === 'reset') {
                        // 案件情報のみリセット
                        await axios.delete(\`/api/clients/\${CLIENT_ID}?keep_customer=true\`);
                        alert(\`\${currentClient.name}様の案件情報をリセットしました。\n顧客情報は保持されています。\`);
                        window.location.reload();
                    } else {
                        // 完全削除
                        await axios.delete(\`/api/clients/\${CLIENT_ID}\`);
                        alert(\`\${currentClient.name}様の情報を削除しました\`);
                        window.location.href = '/';
                    }
                } catch (error) {
                    alert('削除に失敗しました: ' + (error.response?.data?.error || error.message));
                    console.error('Delete error:', error);
                }
            }
            
            // 削除選択ダイアログを表示
            function showDeleteChoiceDialog(clientName) {
                return new Promise((resolve) => {
                    const modal = document.createElement('div');
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
                    modal.innerHTML = \`
                        <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
                            <div class="p-4 border-b bg-red-600 text-white rounded-t-lg">
                                <h3 class="font-bold"><i class="fas fa-exclamation-triangle mr-2"></i>削除オプション</h3>
                            </div>
                            <div class="p-4">
                                <p class="mb-4 text-gray-700">
                                    <strong>\${clientName}</strong>様の情報をどのように処理しますか？
                                </p>
                                
                                <div class="space-y-3">
                                    <button id="resetCaseBtn" class="w-full p-3 border-2 border-blue-500 rounded-lg text-left hover:bg-blue-50 transition">
                                        <div class="flex items-start gap-3">
                                            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                <i class="fas fa-redo text-blue-600"></i>
                                            </div>
                                            <div>
                                                <div class="font-bold text-blue-700">案件情報のみリセット</div>
                                                <div class="text-sm text-gray-600">顧客情報（名前・会社名・連絡先）は保持し、<br>案件データ（書類・やり取り・進捗）を削除</div>
                                                <div class="text-xs text-blue-600 mt-1"><i class="fas fa-check mr-1"></i>同じ顧客で新規案件を作成可能</div>
                                            </div>
                                        </div>
                                    </button>
                                    
                                    <button id="fullDeleteBtn" class="w-full p-3 border-2 border-red-500 rounded-lg text-left hover:bg-red-50 transition">
                                        <div class="flex items-start gap-3">
                                            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                                <i class="fas fa-trash text-red-600"></i>
                                            </div>
                                            <div>
                                                <div class="font-bold text-red-700">完全に削除</div>
                                                <div class="text-sm text-gray-600">顧客情報と案件データをすべて削除</div>
                                                <div class="text-xs text-red-600 mt-1"><i class="fas fa-exclamation-circle mr-1"></i>この操作は取り消せません</div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            <div class="p-4 border-t bg-gray-50 rounded-b-lg">
                                <button id="cancelDeleteBtn" class="w-full py-2 border rounded-lg hover:bg-gray-100">
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    \`;
                    document.body.appendChild(modal);
                    
                    document.getElementById('resetCaseBtn').onclick = () => {
                        modal.remove();
                        resolve('reset');
                    };
                    document.getElementById('fullDeleteBtn').onclick = () => {
                        if (confirm('本当に完全削除しますか？\\nこの操作は取り消せません。')) {
                            modal.remove();
                            resolve('delete');
                        }
                    };
                    document.getElementById('cancelDeleteBtn').onclick = () => {
                        modal.remove();
                        resolve(null);
                    };
                    modal.onclick = (e) => {
                        if (e.target === modal) {
                            modal.remove();
                            resolve(null);
                        }
                    };
                });
            }
            
            // AIレスポンスを読みやすく整形する関数
            function formatAIResponse(text) {
                if (!text) return '';
                // マークダウン記法を除去してプレーンテキストに変換
                var result = text;
                // 太字 **text** を除去
                result = result.split('**').join('');
                // 見出し # を除去（行頭の#と空白を削除）
                result = result.replace(/^#+\\s*/gm, '');
                // 箇条書き - や * を日本語の・に変換
                result = result.replace(/^[\\-\\*]\\s+/gm, '・');
                // バッククォートを除去
                var bt = String.fromCharCode(96);
                while (result.indexOf(bt) !== -1) {
                    result = result.replace(bt, '');
                }
                // 連続する改行を整理
                while (result.indexOf('\\n\\n\\n') !== -1) {
                    result = result.replace('\\n\\n\\n', '\\n\\n');
                }
                return result.trim();
            }
            
            // ポータルURLコピー機能
            function copyPortalUrl(url, clientName) {
                navigator.clipboard.writeText(url).then(() => {
                    showToast(\`\${clientName}様のポータルURLをコピーしました！\`);
                }).catch(err => {
                    console.error('コピーに失敗しました:', err);
                    alert('URLのコピーに失敗しました。手動でコピーしてください: ' + url);
                });
            }
            
            // トースト通知表示
            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                const bgColor = type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-yellow-600' : 'bg-green-600';
                const icon = type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-check-circle';
                toast.className = \`fixed bottom-4 right-4 \${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50\`;
                toast.innerHTML = \`
                    <div class="flex items-center gap-2">
                        <i class="fas \${icon}"></i>
                        <span>\${message}</span>
                    </div>
                \`;
                document.body.appendChild(toast);
                
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transition = 'opacity 0.3s';
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }

            async function loadDocuments() {
                console.log('loadDocuments called for CLIENT_ID:', CLIENT_ID);
                
                // 要素の存在確認
                const progressContainer = document.getElementById('documentProgress');
                const checklistContainer = document.getElementById('documentChecklist');
                const container = document.getElementById('documentsList');
                
                if (!progressContainer || !checklistContainer || !container) {
                    console.log('Document containers not found, skipping loadDocuments');
                    return;
                }
                
                try {
                    // 必要書類チェックリストと既にアップロードされた書類を取得（共通書類も含む）
                    const [checklistRes, docsRes, commonDocsRes] = await Promise.all([
                        axios.get(\`/api/clients/\${CLIENT_ID}/document-checklist\`),
                        axios.get(\`/api/clients/\${CLIENT_ID}/documents?t=\${Date.now()}\`),
                        axios.get(\`/api/clients/\${CLIENT_ID}/common-documents\`)
                    ]);
                    
                    const checklist = checklistRes.data || [];
                    const docs = docsRes.data || [];
                    const commonDocs = commonDocsRes.data || [];
                    console.log('Documents loaded:', docs.map(d => ({id: d.id, type: d.document_type, status: d.status})));
                    
                    // 案件別アップロード済みの書類タイプ
                    const uploadedTypes = new Set(docs.map(d => d.document_type));
                    // 共通書類でカバーされているタイプ（別途管理）
                    const commonDocTypes = new Set(commonDocs.map(d => d.document_type));
                    // 両方を合わせた充足済みタイプ
                    const fulfilledTypes = new Set([...uploadedTypes, ...commonDocTypes]);
                    
                    // 必須書類のカウント（共通書類も含める）
                    const requiredDocs = checklist.filter(item => item.is_required);
                    const uploadedRequired = requiredDocs.filter(item => fulfilledTypes.has(item.document_type)).length;
                    const totalRequired = requiredDocs.length;
                    const progressPercent = totalRequired > 0 ? Math.round((uploadedRequired / totalRequired) * 100) : 0;
                    
                    // 進捗表示
                    progressContainer.innerHTML = \`
                    <div class="flex items-center justify-between text-sm mb-1">
                        <span class="text-gray-600">必須書類の提出状況</span>
                        <span class="font-bold \${progressPercent === 100 ? 'text-green-600' : 'text-blue-600'}">\${uploadedRequired}/\${totalRequired}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="h-2 rounded-full transition-all \${progressPercent === 100 ? 'bg-green-500' : 'bg-blue-500'}" style="width: \${progressPercent}%"></div>
                    </div>
                \`;
                
                // チェックリスト表示（未提出の書類を強調、共通書類も考慮）
                const checklistContainer = document.getElementById('documentChecklist');
                const pendingDocs = checklist.filter(item => !fulfilledTypes.has(item.document_type));
                const commonLinkedDocs = checklist.filter(item => !uploadedTypes.has(item.document_type) && commonDocTypes.has(item.document_type));
                
                if (pendingDocs.length === 0) {
                    checklistContainer.innerHTML = \`
                        <div class="text-center py-3 bg-green-50 rounded-lg">
                            <i class="fas fa-check-circle text-green-500 text-xl mb-1"></i>
                            <p class="text-sm text-green-700 font-medium">全ての書類が提出済みです</p>
                            \${commonLinkedDocs.length > 0 ? '<p class="text-xs text-blue-600 mt-1"><i class="fas fa-link mr-1"></i>' + commonLinkedDocs.length + '件は共通書類から参照</p>' : ''}
                        </div>
                    \`;
                } else {
                    checklistContainer.innerHTML = \`
                        <div class="text-xs text-gray-500 mb-2">未提出の書類:</div>
                        \${pendingDocs.map(item => \`
                            <div class="flex items-center gap-2 p-2 bg-gray-50 rounded border \${item.is_required ? 'border-red-200' : 'border-gray-200'}">
                                <i class="fas fa-circle text-xs \${item.is_required ? 'text-red-400' : 'text-gray-300'}"></i>
                                <span class="text-sm flex-1">\${item.document_type}</span>
                                \${item.is_required ? '<span class="text-xs text-red-500 font-medium">必須</span>' : '<span class="text-xs text-gray-400">任意</span>'}
                            </div>
                        \`).join('')}
                        \${commonLinkedDocs.length > 0 ? '<div class="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded"><i class="fas fa-link mr-1"></i>' + commonLinkedDocs.length + '件は共通書類から参照</div>' : ''}
                    \`;
                }
                
                // アップロード済み書類一覧
                const container = document.getElementById('documentsList');
                if (docs.length === 0) {
                    container.innerHTML = '<div class="text-sm text-gray-500 py-2">まだ書類がありません</div>';
                    return;
                }
                
                container.innerHTML = docs.map(doc => \`
                    <div class="border-b py-2 last:border-b-0">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                                <div class="font-medium text-sm truncate">\${doc.document_type}</div>
                                <div class="text-xs text-gray-500 truncate">\${doc.file_name}</div>
                            </div>
                            <span class="flex-shrink-0 text-xs px-2 py-0.5 rounded-full \${
                                doc.status === 'approved' ? 'bg-green-100 text-green-800' :
                                doc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                            }">
                                \${doc.status === 'approved' ? '✓' : doc.status === 'rejected' ? '✗' : '...'}
                            </span>
                        </div>
                        <div class="flex items-center gap-2 mt-1">
                            <a href="/api/documents/\${doc.id}/download" 
                               class="text-blue-600 hover:text-blue-800 text-xs">
                                <i class="fas fa-download mr-1"></i>DL
                            </a>
                            \${doc.status !== 'approved' ? \`
                                <button onclick="console.log('Approve clicked', \${doc.id}); updateDocumentStatus(\${doc.id}, 'approved')" 
                                        class="text-xs text-green-600 hover:text-green-800">
                                    <i class="fas fa-check mr-1"></i>承認
                                </button>
                            \` : ''}
                            \${doc.status !== 'rejected' ? \`
                                <button onclick="console.log('Reject clicked', \${doc.id}); updateDocumentStatus(\${doc.id}, 'rejected')" 
                                        class="text-xs text-red-600 hover:text-red-800">
                                    <i class="fas fa-times mr-1"></i>差戻
                                </button>
                            \` : ''}
                        </div>
                    </div>
                \`).join('');
                } catch (error) {
                    console.error('loadDocuments error:', error);
                }
            }
            
            window.updateDocumentStatus = async function(docId, status) {
                try {
                    console.log('updateDocumentStatus called:', docId, status);
                    const response = await axios.put(\`/api/documents/\${docId}/status\`, { status });
                    console.log('API response:', response.data);
                    if (response.data && response.data.success) {
                        const statusText = status === 'approved' ? '承認' : status === 'rejected' ? '差し戻し' : '更新';
                        showToast(\`書類を\${statusText}しました\`, 'success');
                        console.log('Reloading documents...');
                        await loadDocuments();
                        console.log('Documents reloaded');
                    } else {
                        throw new Error('ステータス更新に失敗しました');
                    }
                } catch (error) {
                    showToast('ステータス更新に失敗しました', 'error');
                    console.error('Document status update error:', error);
                }
            };
            
            // 共通書類を読み込む（管理画面用）
            async function loadCommonDocumentsAdmin() {
                try {
                    const [typesRes, docsRes] = await Promise.all([
                        axios.get('/api/common-document-types'),
                        axios.get(\`/api/clients/\${CLIENT_ID}/common-documents\`)
                    ]);
                    
                    const documentTypes = typesRes.data;
                    const uploadedDocs = docsRes.data;
                    
                    // アップロード済みドキュメントタイプのマップを作成
                    const uploadedByType = {};
                    uploadedDocs.forEach(doc => {
                        if (!uploadedByType[doc.document_type]) {
                            uploadedByType[doc.document_type] = [];
                        }
                        uploadedByType[doc.document_type].push(doc);
                    });
                    
                    const container = document.getElementById('commonDocumentsListAdmin');
                    
                    if (documentTypes.length === 0) {
                        container.innerHTML = '<div class="text-sm text-gray-500 py-2">共通書類タイプが設定されていません</div>';
                        return;
                    }
                    
                    container.innerHTML = documentTypes.map(type => {
                        const docs = uploadedByType[type.name] || [];
                        const hasDoc = docs.length > 0;
                        const latestDoc = hasDoc ? docs[0] : null;
                        
                        // 有効期限チェック
                        let validityBadge = '';
                        if (latestDoc && type.validity_months) {
                            const uploadDate = new Date(latestDoc.uploaded_at);
                            const expiryDate = new Date(uploadDate);
                            expiryDate.setMonth(expiryDate.getMonth() + type.validity_months);
                            const now = new Date();
                            const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                            
                            if (daysUntilExpiry <= 0) {
                                validityBadge = '<span class="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">期限切れ</span>';
                            } else if (daysUntilExpiry <= 30) {
                                validityBadge = '<span class="ml-2 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">残 ' + daysUntilExpiry + '日</span>';
                            } else {
                                validityBadge = '<span class="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">有効</span>';
                            }
                        }
                        
                        // 複数期分対応（決算書・確定申告書など）
                        const isMultiVersion = type.max_versions && type.max_versions > 1;
                        const maxVer = type.max_versions || 1;
                        
                        return \`
                            <div class="p-3 rounded-lg border \${hasDoc ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}">
                                <div class="flex items-center gap-3">
                                    <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center \${hasDoc ? 'bg-blue-500' : 'bg-gray-300'}">
                                        <i class="fas \${hasDoc ? 'fa-check' : 'fa-file-alt'} text-white text-sm"></i>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center flex-wrap gap-1">
                                            <span class="font-medium text-sm \${hasDoc ? 'text-blue-800' : 'text-gray-700'}">\${type.name}</span>
                                            \${validityBadge}
                                            \${isMultiVersion ? \`<span class="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">最大\${maxVer}期</span>\` : ''}
                                        </div>
                                        \${!hasDoc ? '<div class="text-xs text-gray-500 mt-0.5">未アップロード</div>' : ''}
                                    </div>
                                    \${hasDoc && docs.length === 1 && !isMultiVersion ? \`
                                        <a href="/api/common-documents/\${latestDoc.id}/download" 
                                           class="text-blue-600 hover:text-blue-800 text-sm" title="ダウンロード">
                                            <i class="fas fa-download"></i>
                                        </a>
                                    \` : ''}
                                </div>
                                \${hasDoc && (isMultiVersion || docs.length > 1) ? \`
                                    <div class="mt-2 ml-11 space-y-1">
                                        \${docs.map((doc, idx) => \`
                                            <div class="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border group">
                                                <div class="flex items-center gap-2 min-w-0">
                                                    <span class="text-purple-600 font-medium">\${doc.fiscal_year ? doc.fiscal_year + '期' : (idx + 1) + '件目'}</span>
                                                    <span class="text-gray-600 truncate">\${doc.file_name}</span>
                                                    <span class="text-gray-400">\${new Date(doc.uploaded_at).toLocaleDateString('ja-JP')}</span>
                                                </div>
                                                <div class="flex items-center gap-1 ml-2 flex-shrink-0">
                                                    <a href="/api/common-documents/\${doc.id}/download" 
                                                       class="text-blue-600 hover:text-blue-800" title="ダウンロード">
                                                        <i class="fas fa-download"></i>
                                                    </a>
                                                    <button onclick="deleteCommonDocumentAdmin(\${doc.id})" 
                                                            class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="削除">
                                                        <i class="fas fa-trash-alt"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        \`).join('')}
                                        \${docs.length < maxVer ? \`
                                            <div class="text-xs text-gray-400 italic">あと\${maxVer - docs.length}期分アップロード可能</div>
                                        \` : ''}
                                    </div>
                                \` : ''}
                                \${hasDoc && !isMultiVersion && docs.length === 1 ? \`
                                    <div class="mt-1 ml-11 flex items-center justify-between text-xs group">
                                        <div class="text-gray-600">
                                            \${latestDoc.fiscal_year ? latestDoc.fiscal_year + '年度 - ' : ''}\${latestDoc.file_name}
                                            <span class="text-gray-400 ml-1">\${new Date(latestDoc.uploaded_at).toLocaleDateString('ja-JP')}</span>
                                        </div>
                                        <button onclick="deleteCommonDocumentAdmin(\${latestDoc.id})" 
                                                class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2" title="削除">
                                            <i class="fas fa-trash-alt"></i>
                                        </button>
                                    </div>
                                \` : ''}
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading common documents:', error);
                    const container = document.getElementById('commonDocumentsListAdmin');
                    if (container) {
                        container.innerHTML = '<div class="text-sm text-red-500 py-2">共通書類の読み込みに失敗しました</div>';
                    }
                }
            }
            
            // 共通書類削除（管理画面）
            async function deleteCommonDocumentAdmin(docId) {
                if (!confirm('この書類を削除しますか？\\n（削除後は元に戻せません）')) return;
                
                try {
                    await axios.delete(\`/api/common-documents/\${docId}\`);
                    showToast('書類を削除しました', 'success');
                    loadCommonDocumentsAdmin();
                } catch (error) {
                    console.error('Error deleting common document:', error);
                    showToast('書類の削除に失敗しました', 'error');
                }
            }
            
            window.deleteCommonDocumentAdmin = deleteCommonDocumentAdmin;

            async function loadCommunications() {
                const response = await axios.get(\`/api/clients/\${CLIENT_ID}/communications\`);
                const comms = response.data;
                
                const container = document.getElementById('communicationsList');
                if (comms.length === 0) {
                    container.innerHTML = '<div class="text-sm text-gray-500">まだやり取りがありません</div>';
                    return;
                }
                
                container.innerHTML = comms.map(comm => {
                    const isStaff = comm.sender_type === 'staff';
                    return \`
                        <div class="flex \${isStaff ? 'justify-end' : 'justify-start'}">
                            <div class="max-w-xs \${isStaff ? 'bg-blue-100' : 'bg-gray-100'} rounded-lg p-3">
                                <div class="font-medium text-sm mb-1">\${comm.sender_name}</div>
                                <div class="text-sm">\${comm.message}</div>
                                <div class="text-xs text-gray-500 mt-1">\${new Date(comm.created_at).toLocaleString('ja-JP')}</div>
                            </div>
                        </div>
                    \`;
                }).join('');
                
                container.scrollTop = container.scrollHeight;
            }

            document.getElementById('messageForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const message = document.getElementById('messageInput').value;
                const adminName = localStorage.getItem('admin_name') || 'スタッフ';
                
                await axios.post(\`/api/clients/\${CLIENT_ID}/communications\`, {
                    message,
                    sender_type: 'staff',
                    sender_name: adminName
                });
                
                document.getElementById('messageInput').value = '';
                loadCommunications();
            });

            function editClient() {
                if (!currentClient) return;
                
                // フォームに現在の値を設定（基本情報のみ）
                document.getElementById('edit_name').value = currentClient.name || '';
                document.getElementById('edit_company_name').value = currentClient.company_name || '';
                document.getElementById('edit_email').value = currentClient.email || '';
                document.getElementById('edit_phone').value = currentClient.phone || '';
                document.getElementById('edit_address').value = currentClient.address || '';
                document.getElementById('edit_notes').value = currentClient.notes || '';
                
                document.getElementById('editClientModal').classList.remove('hidden');
            }
            
            function closeEditModal() {
                document.getElementById('editClientModal').classList.add('hidden');
            }
            
            document.getElementById('editClientForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const submitBtn = e.target.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                
                try {
                    // ローディング表示
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>更新中...';
                    
                    const formData = new FormData(e.target);
                    const data = Object.fromEntries(formData);
                    
                    // 顧客基本情報のみ送信
                    const updateData = {
                        name: data.name,
                        company_name: data.company_name || null,
                        email: data.email || null,
                        phone: data.phone || null,
                        address: data.address || null,
                        notes: data.notes || null
                    };
                    
                    await axios.patch(\`/api/clients/\${CLIENT_ID}\`, updateData);
                    
                    closeEditModal();
                    await loadClient();
                    
                    showToast('顧客情報を更新しました！');
                } catch (error) {
                    console.error('更新エラー:', error);
                    alert('更新に失敗しました: ' + (error.response?.data?.error || error.message));
                } finally {
                    // ボタンを元に戻す
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            });

            // タブ切り替え
            function switchClientTab(tab) {
                ['overview', 'cases', 'ai', 'documents', 'pipeline'].forEach(t => {
                    const content = document.getElementById('client-content-' + t);
                    const tabBtn = document.getElementById('client-tab-' + t);
                    if (content) content.classList.add('hidden');
                    if (tabBtn) {
                        tabBtn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
                        tabBtn.classList.add('text-gray-500');
                    }
                });
                const activeContent = document.getElementById('client-content-' + tab);
                const activeTab = document.getElementById('client-tab-' + tab);
                if (activeContent) activeContent.classList.remove('hidden');
                if (activeTab) {
                    activeTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
                    activeTab.classList.remove('text-gray-500');
                }
                
                // タブ固有のデータ読み込み
                if (tab === 'cases') {
                    loadClientCases();
                } else if (tab === 'ai') {
                    loadAiChatHistory();
                    loadMatchScores();
                } else if (tab === 'documents') {
                    loadGeneratedDocuments();
                } else if (tab === 'pipeline') {
                    loadClientPipelines();
                }
            }
            
            // 顧客の案件一覧を読み込み（カンバン形式）
            async function loadClientCases() {
                const container = document.getElementById('clientCasesList');
                if (!container) return;
                
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/cases\`);
                    const cases = response.data;
                    
                    if (!cases || cases.length === 0) {
                        container.innerHTML = \`
                            <div class="col-span-full text-center py-12 text-gray-500 bg-white rounded-lg shadow">
                                <i class="fas fa-folder-open text-5xl mb-4 text-gray-300"></i>
                                <p class="text-lg mb-4">この顧客の案件はまだありません</p>
                                <button onclick="openNewCaseModalForThisClient()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                                    <i class="fas fa-plus mr-2"></i>新規案件登録
                                </button>
                            </div>
                        \`;
                        return;
                    }
                    
                    // ステータス定義
                    const STATUSES = [
                        { key: 'inquiry', label: '見込み', color: 'yellow', icon: 'fa-lightbulb' },
                        { key: 'preparing', label: '書類準備中', color: 'orange', icon: 'fa-file-alt' },
                        { key: 'applying', label: '申請中', color: 'purple', icon: 'fa-paper-plane' },
                        { key: 'completed', label: '完了済み', color: 'green', icon: 'fa-check-circle' }
                    ];
                    
                    // ステータスごとに案件をグループ化
                    const casesByStatus = {};
                    STATUSES.forEach(s => casesByStatus[s.key] = []);
                    cases.forEach(c => {
                        if (casesByStatus[c.status]) {
                            casesByStatus[c.status].push(c);
                        } else {
                            // 不明なステータスはinquiryに
                            casesByStatus['inquiry'].push(c);
                        }
                    });
                    
                    // カンバンカラムを生成
                    container.innerHTML = STATUSES.map(status => {
                        const statusCases = casesByStatus[status.key];
                        const colorClasses = {
                            yellow: { bg: 'bg-yellow-50', border: 'border-yellow-300', header: 'bg-yellow-100 text-yellow-800', badge: 'bg-yellow-500' },
                            blue: { bg: 'bg-blue-50', border: 'border-blue-300', header: 'bg-blue-100 text-blue-800', badge: 'bg-blue-500' },
                            orange: { bg: 'bg-orange-50', border: 'border-orange-300', header: 'bg-orange-100 text-orange-800', badge: 'bg-orange-500' },
                            purple: { bg: 'bg-purple-50', border: 'border-purple-300', header: 'bg-purple-100 text-purple-800', badge: 'bg-purple-500' },
                            green: { bg: 'bg-green-50', border: 'border-green-300', header: 'bg-green-100 text-green-800', badge: 'bg-green-500' }
                        }[status.color];
                        
                        return \`
                            <div class="flex flex-col rounded-lg \${colorClasses.bg} border \${colorClasses.border} overflow-hidden">
                                <!-- カラムヘッダー -->
                                <div class="\${colorClasses.header} px-3 py-2 flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <i class="fas \${status.icon}"></i>
                                        <span class="font-bold text-sm">\${status.label}</span>
                                    </div>
                                    <span class="\${colorClasses.badge} text-white text-xs px-2 py-0.5 rounded-full">\${statusCases.length}</span>
                                </div>
                                
                                <!-- カード一覧 -->
                                <div class="p-2 space-y-2 flex-1 min-h-[100px] max-h-[500px] overflow-y-auto">
                                    \${statusCases.length === 0 ? \`
                                        <div class="text-center py-4 text-gray-400 text-xs">
                                            案件なし
                                        </div>
                                    \` : statusCases.map(c => \`
                                        <div class="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer" onclick="window.location.href='/case/\${c.id}'">
                                            <div class="p-3">
                                                <div class="flex items-start justify-between gap-2 mb-2">
                                                    <span class="px-1.5 py-0.5 rounded text-xs bg-gray-200 text-gray-700 font-mono font-bold">No.\${String(c.id).padStart(4, '0')}</span>
                                                    \${c.deposit_required && !c.deposit_paid ? '<span class="text-yellow-600 text-xs"><i class="fas fa-yen-sign"></i></span>' : ''}
                                                </div>
                                                \${c.subsidy_type_name ? \`
                                                    <div class="text-sm font-medium text-gray-800 mb-2 line-clamp-2">\${c.subsidy_type_name}</div>
                                                \` : ''}
                                                <div class="flex items-center gap-2 text-xs text-gray-500">
                                                    \${c.assigned_to_name ? \`<span><i class="fas fa-user mr-1"></i>\${c.assigned_to_name}</span>\` : ''}
                                                </div>
                                                \${c.deposit_required ? \`
                                                    <div class="mt-2 text-xs \${c.deposit_paid ? 'text-green-600' : 'text-yellow-600'}">
                                                        <i class="fas fa-hand-holding-usd mr-1"></i>¥\${(c.deposit_amount || 0).toLocaleString()}
                                                        \${c.deposit_paid ? '<span class="ml-1">✓</span>' : '<span class="ml-1">未払</span>'}
                                                    </div>
                                                \` : ''}
                                                \${c.success_fee_enabled ? \`
                                                    <div class="mt-1 text-xs \${c.success_fee_invoice_status === 'paid' ? 'text-green-600' : (c.success_fee_invoice_status === 'payment_reported' ? 'text-purple-600' : (c.success_fee_invoice_count > 0 ? 'text-blue-600' : 'text-gray-400'))}">
                                                        <i class="fas fa-trophy mr-1"></i>\${c.success_fee_rate ? c.success_fee_rate + '%' : '¥' + (c.success_fee_amount || 0).toLocaleString()}
                                                        <span class="ml-1">\${c.success_fee_invoice_status === 'paid' ? '✓' : (c.success_fee_invoice_status === 'payment_reported' ? '確認中' : (c.success_fee_invoice_count > 0 ? '請求中' : '未発行'))}</span>
                                                    </div>
                                                \` : ''}
                                            </div>
                                            <div class="border-t px-3 py-2 flex gap-2" onclick="event.stopPropagation()">
                                                <a href="/case/\${c.id}" class="flex-1 text-center text-xs text-blue-600 hover:text-blue-800 py-1">
                                                    <i class="fas fa-arrow-right mr-1"></i>詳細
                                                </a>
                                                <a href="/portal/\${c.access_token}" target="_blank" class="flex-1 text-center text-xs text-green-600 hover:text-green-800 py-1">
                                                    <i class="fas fa-external-link-alt mr-1"></i>ポータル
                                                </a>
                                            </div>
                                        </div>
                                    \`).join('')}
                                </div>
                            </div>
                        \`;
                    }).join('');
                    
                } catch (error) {
                    console.error('Error loading client cases:', error);
                    container.innerHTML = \`
                        <div class="col-span-full text-center py-8 text-red-500 bg-white rounded-lg shadow">
                            <i class="fas fa-exclamation-circle text-3xl mb-3"></i>
                            <p>案件一覧の読み込みに失敗しました</p>
                        </div>
                    \`;
                }
            }
            
            // この顧客に新規案件を登録するモーダルを開く
            function openNewCaseModalForThisClient() {
                window.location.href = '/?openNewCase=' + CLIENT_ID;
            }

            // ===============================
            // パイプライン機能
            // ===============================
            
            let currentPipelines = [];
            
            // クライアントのパイプライン一覧を読み込み
            async function loadClientPipelines() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/pipelines\`);
                    currentPipelines = response.data;
                    renderClientPipelines();
                } catch (error) {
                    console.error('Error loading pipelines:', error);
                    const container = document.getElementById('clientPipelinesList');
                    if (container) {
                        container.innerHTML = '<div class="text-center text-red-500 py-4">パイプラインの読み込みに失敗しました</div>';
                    }
                }
            }
            
            // パイプライン一覧をレンダリング
            function renderClientPipelines() {
                const container = document.getElementById('clientPipelinesList');
                if (!container) return;
                
                if (currentPipelines.length === 0) {
                    container.innerHTML = \`
                        <div class="text-center text-gray-500 py-8">
                            <i class="fas fa-tasks text-4xl mb-2 text-gray-300"></i>
                            <p>パイプラインが割り当てられていません</p>
                            <p class="text-sm mt-2">「パイプラインを割り当て」ボタンでタスク管理を開始できます</p>
                        </div>
                    \`;
                    return;
                }
                
                container.innerHTML = currentPipelines.map(pipeline => {
                    const statusColors = {
                        active: 'bg-blue-100 text-blue-800',
                        completed: 'bg-green-100 text-green-800',
                        paused: 'bg-yellow-100 text-yellow-800'
                    };
                    const statusLabels = {
                        active: '進行中',
                        completed: '完了',
                        paused: '一時停止'
                    };
                    
                    return \`
                        <div class="border rounded-lg p-4 mb-4">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <h3 class="font-bold text-lg">\${pipeline.template_name || 'パイプライン'}</h3>
                                    <span class="inline-block px-2 py-1 rounded text-xs \${statusColors[pipeline.status] || 'bg-gray-100 text-gray-800'}">
                                        \${statusLabels[pipeline.status] || pipeline.status}
                                    </span>
                                </div>
                                <div class="text-right">
                                    <div class="text-2xl font-bold text-blue-600">\${pipeline.progress_percentage || 0}%</div>
                                    <div class="text-xs text-gray-500">\${pipeline.completed_tasks || 0}/\${pipeline.total_tasks || 0} タスク完了</div>
                                </div>
                            </div>
                            
                            <div class="w-full bg-gray-200 rounded-full h-2 mb-4">
                                <div class="bg-blue-600 h-2 rounded-full transition-all" style="width: \${pipeline.progress_percentage || 0}%"></div>
                            </div>
                            
                            <div id="pipeline-tasks-\${pipeline.id}" class="space-y-2">
                                <div class="text-center text-gray-400 py-2">
                                    <i class="fas fa-spinner fa-spin"></i> タスク読み込み中...
                                </div>
                            </div>
                        </div>
                    \`;
                }).join('');
                
                // 各パイプラインのタスクを読み込み
                currentPipelines.forEach(pipeline => {
                    loadPipelineTasks(pipeline.id);
                });
            }
            
            // パイプラインのタスク一覧を読み込み
            async function loadPipelineTasks(pipelineId) {
                try {
                    const response = await axios.get(\`/api/pipelines/\${pipelineId}/tasks\`);
                    const tasks = response.data;
                    renderPipelineTasks(pipelineId, tasks);
                } catch (error) {
                    console.error('Error loading pipeline tasks:', error);
                }
            }
            
            // タスク一覧をレンダリング
            function renderPipelineTasks(pipelineId, tasks) {
                const container = document.getElementById('pipeline-tasks-' + pipelineId);
                if (!container) return;
                
                if (tasks.length === 0) {
                    container.innerHTML = '<div class="text-center text-gray-400 py-2">タスクがありません</div>';
                    return;
                }
                
                const statusIcons = {
                    pending: '<i class="fas fa-circle text-gray-300"></i>',
                    in_progress: '<i class="fas fa-spinner fa-spin text-blue-500"></i>',
                    completed: '<i class="fas fa-check-circle text-green-500"></i>'
                };
                const statusLabels = {
                    pending: '未着手',
                    in_progress: '進行中',
                    completed: '完了'
                };
                const taskTypeColors = {
                    document: 'bg-blue-50 border-blue-200',
                    review: 'bg-purple-50 border-purple-200',
                    submission: 'bg-green-50 border-green-200',
                    other: 'bg-gray-50 border-gray-200'
                };
                
                container.innerHTML = tasks.map((task, index) => \`
                    <div class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-md transition \${taskTypeColors[task.task_type] || taskTypeColors.other}"
                         onclick="openTaskDetail(\${task.id}, '\${task.task_name.replace(/'/g, "\\\\'")}', '\${task.status}', \${task.progress_percentage || 0}, '\${(task.notes || '').replace(/'/g, "\\\\'")}')">
                        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center text-sm font-bold">
                            \${index + 1}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                \${statusIcons[task.status] || statusIcons.pending}
                                <span class="font-medium truncate">\${task.task_name}</span>
                                \${task.is_required ? '<span class="text-red-500 text-xs">*必須</span>' : ''}
                            </div>
                            <div class="text-xs text-gray-500 mt-1">
                                <span class="inline-block px-2 py-0.5 rounded bg-white">\${statusLabels[task.status] || task.status}</span>
                                \${task.progress_percentage > 0 ? \`<span class="ml-2">\${task.progress_percentage}%</span>\` : ''}
                                \${task.assignee_name ? \`<span class="ml-2"><i class="fas fa-user text-gray-400"></i> \${task.assignee_name}</span>\` : ''}
                            </div>
                        </div>
                        <div class="flex-shrink-0">
                            <i class="fas fa-chevron-right text-gray-400"></i>
                        </div>
                    </div>
                \`).join('');
            }
            
            // パイプライン割り当てモーダル
            async function openAssignPipelineModal() {
                document.getElementById('assignPipelineModal').classList.remove('hidden');
                
                // テンプレート一覧を読み込み
                try {
                    const response = await axios.get('/api/pipeline-templates');
                    const templates = response.data;
                    const select = document.getElementById('pipelineTemplateSelect');
                    select.innerHTML = '<option value="">選択してください</option>' +
                        templates.map(t => \`<option value="\${t.id}">\${t.name}</option>\`).join('');
                } catch (error) {
                    console.error('Error loading templates:', error);
                }
            }
            
            function closeAssignPipelineModal() {
                document.getElementById('assignPipelineModal').classList.add('hidden');
            }
            
            // パイプライン割り当て
            const assignPipelineFormEl = document.getElementById('assignPipelineForm');
            if (assignPipelineFormEl) {
                assignPipelineFormEl.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const templateId = document.getElementById('pipelineTemplateSelect').value;
                    
                    if (!templateId) {
                        alert('テンプレートを選択してください');
                        return;
                    }
                    
                    try {
                        await axios.post(\`/api/clients/\${CLIENT_ID}/apply-pipeline\`, {
                            template_id: parseInt(templateId)
                        });
                        closeAssignPipelineModal();
                        loadClientPipelines();
                        alert('パイプラインを割り当てました');
                    } catch (error) {
                        console.error('Error assigning pipeline:', error);
                        alert('パイプラインの割り当てに失敗しました: ' + (error.response?.data?.error || error.message));
                    }
                });
            }
            
            // タスク詳細モーダル
            function openTaskDetail(taskId, taskName, status, progress, notes) {
                document.getElementById('taskDetailModal').classList.remove('hidden');
                document.getElementById('taskDetailTitle').innerHTML = '<i class="fas fa-clipboard-check mr-2 text-blue-600"></i>' + taskName;
                document.getElementById('taskDetailId').value = taskId;
                document.getElementById('taskDetailProgress').value = progress;
                document.getElementById('taskProgressValue').textContent = progress + '%';
                document.getElementById('taskDetailNotes').value = notes || '';
                updateTaskStatusFromProgress(progress);
            }
            
            // 進捗率からステータスを自動設定
            function updateTaskStatusFromProgress(progress) {
                const p = parseInt(progress);
                let status = 'pending';
                let hint = '';
                
                if (p === 0) {
                    status = 'pending';
                    hint = '0% → 未着手';
                } else if (p >= 100) {
                    status = 'completed';
                    hint = '100% → 完了';
                } else {
                    status = 'in_progress';
                    hint = p + '% → 進行中';
                }
                
                document.getElementById('taskDetailStatus').value = status;
                document.getElementById('taskProgressValue').textContent = p + '%';
                document.getElementById('autoStatusHint').textContent = hint;
                
                // ステータス表示を更新
                const pending = document.getElementById('statusPending');
                const inProgress = document.getElementById('statusInProgress');
                const completed = document.getElementById('statusCompleted');
                
                // リセット
                [pending, inProgress, completed].forEach(el => {
                    el.className = 'flex-1 py-2 text-center rounded-lg border-2 cursor-pointer transition border-gray-200 text-gray-500';
                });
                
                // アクティブ状態を設定
                if (status === 'pending') {
                    pending.className = 'flex-1 py-2 text-center rounded-lg border-2 cursor-pointer transition border-gray-500 bg-gray-100 text-gray-700 font-medium';
                } else if (status === 'in_progress') {
                    inProgress.className = 'flex-1 py-2 text-center rounded-lg border-2 cursor-pointer transition border-blue-500 bg-blue-100 text-blue-700 font-medium';
                } else if (status === 'completed') {
                    completed.className = 'flex-1 py-2 text-center rounded-lg border-2 cursor-pointer transition border-green-500 bg-green-100 text-green-700 font-medium';
                }
            }
            
            function closeTaskDetailModal() {
                document.getElementById('taskDetailModal').classList.add('hidden');
            }
            
            // タスク更新
            const taskDetailFormEl = document.getElementById('taskDetailForm');
            if (taskDetailFormEl) {
                taskDetailFormEl.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const taskId = document.getElementById('taskDetailId').value;
                    const progress = parseInt(document.getElementById('taskDetailProgress').value);
                    const notes = document.getElementById('taskDetailNotes').value;
                    
                    try {
                        // 進捗率だけ送信すれば、サーバー側でステータスを自動設定
                        await axios.put(\`/api/pipeline-tasks/\${taskId}\`, {
                            progress_percentage: progress,
                            notes: notes
                        });
                        closeTaskDetailModal();
                        loadClientPipelines();
                    } catch (error) {
                        console.error('Error updating task:', error);
                        alert('タスクの更新に失敗しました');
                    }
                });
            }

            // ===============================
            // AI機能
            // ===============================
            
            // AIチャットモード管理
            let currentAiChatMode = 'hearing';
            let selectedDocumentContent = null;
            let selectedDocumentTitle = null;
            
            function setAiChatMode(mode) {
                currentAiChatMode = mode;
                
                // ボタンのスタイル切替
                const hearingBtn = document.getElementById('aiModeHearing');
                const reviewBtn = document.getElementById('aiModeReview');
                const hearingDesc = document.getElementById('aiModeHearingDesc');
                const reviewSection = document.getElementById('aiModeReviewSection');
                
                if (mode === 'hearing') {
                    hearingBtn.className = 'px-3 py-1 text-xs rounded-full bg-purple-600 text-white';
                    reviewBtn.className = 'px-3 py-1 text-xs rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300';
                    hearingDesc.classList.remove('hidden');
                    reviewSection.classList.add('hidden');
                    document.getElementById('aiChatInput').placeholder = 'メッセージを入力...';
                } else {
                    hearingBtn.className = 'px-3 py-1 text-xs rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300';
                    reviewBtn.className = 'px-3 py-1 text-xs rounded-full bg-indigo-600 text-white';
                    hearingDesc.classList.add('hidden');
                    reviewSection.classList.remove('hidden');
                    document.getElementById('aiChatInput').placeholder = '添削の指示を入力（例：もっと具体的に、数値を増やして）';
                    loadDocumentsForReview();
                }
            }
            
            async function loadDocumentsForReview() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/generated-documents\`);
                    const docs = response.data;
                    
                    const select = document.getElementById('reviewDocumentSelect');
                    select.innerHTML = '<option value="">-- 文書を選択 --</option>';
                    
                    docs.forEach(doc => {
                        const option = document.createElement('option');
                        option.value = doc.id;
                        option.textContent = doc.document_title + ' (' + new Date(doc.created_at).toLocaleDateString('ja-JP') + ')';
                        select.appendChild(option);
                    });
                } catch (error) {
                    console.error('Error loading documents for review:', error);
                }
            }
            
            async function loadDocumentForReview() {
                const docId = document.getElementById('reviewDocumentSelect').value;
                const previewDiv = document.getElementById('selectedDocumentPreview');
                
                if (!docId) {
                    previewDiv.classList.add('hidden');
                    selectedDocumentContent = null;
                    selectedDocumentTitle = null;
                    return;
                }
                
                try {
                    const response = await axios.get(\`/api/generated-documents/\${docId}\`);
                    const doc = response.data;
                    
                    selectedDocumentTitle = doc.document_title;
                    const sections = JSON.parse(doc.sections_content || '{}');
                    
                    // 全セクションを結合
                    selectedDocumentContent = Object.entries(sections)
                        .map(([key, value]) => \`【\${key}】\\n\${value}\`)
                        .join('\\n\\n');
                    
                    // プレビュー表示
                    previewDiv.innerHTML = \`<div class="font-medium mb-1">\${doc.document_title}</div><div class="text-gray-500">\${selectedDocumentContent.substring(0, 200)}...</div>\`;
                    previewDiv.classList.remove('hidden');
                } catch (error) {
                    console.error('Error loading document:', error);
                }
            }
            
            window.setAiChatMode = setAiChatMode;
            window.loadDocumentForReview = loadDocumentForReview;
            
            // AIチャット
            async function loadAiChatHistory() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/ai-chat\`);
                    const chats = response.data;
                    
                    const container = document.getElementById('aiChatContainer');
                    if (chats.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center text-gray-500 py-8">
                                <i class="fas fa-robot text-4xl mb-2 text-purple-400"></i>
                                <p>こんにちは！補助金申請のお手伝いをします。</p>
                                <p class="text-sm mt-2">何でも聞いてください。</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    container.innerHTML = chats.map(chat => \`
                        <div class="flex \${chat.role === 'user' ? 'justify-end' : 'justify-start'} mb-3">
                            <div class="max-w-[80%] \${chat.role === 'user' ? 'bg-blue-100' : 'bg-purple-100'} rounded-lg p-3">
                                <div class="flex items-center gap-2 mb-1">
                                    <i class="fas \${chat.role === 'user' ? 'fa-user' : 'fa-robot'} text-sm \${chat.role === 'user' ? 'text-blue-600' : 'text-purple-600'}"></i>
                                    <span class="text-xs font-medium">\${chat.role === 'user' ? 'あなた' : 'AIアシスタント'}</span>
                                </div>
                                <div class="text-sm whitespace-pre-wrap">\${chat.content}</div>
                            </div>
                        </div>
                    \`).join('');
                    
                    container.scrollTop = container.scrollHeight;
                } catch (error) {
                    console.error('AI chat load error:', error);
                }
            }
            
            document.getElementById('aiChatForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = document.getElementById('aiChatInput');
                const message = input.value.trim();
                if (!message) return;
                
                input.value = '';
                input.disabled = true;
                
                // ユーザーメッセージを即座に表示
                const container = document.getElementById('aiChatContainer');
                container.innerHTML += \`
                    <div class="flex justify-end mb-2">
                        <div class="max-w-[85%] bg-blue-100 rounded-lg px-3 py-2">
                            <div class="text-sm text-gray-700">\${message}</div>
                        </div>
                    </div>
                    <div class="flex justify-start mb-2" id="aiTyping">
                        <div class="bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
                            <i class="fas fa-circle-notch fa-spin text-purple-400 text-xs"></i>
                            <span class="text-xs text-purple-400 ml-1">回答中...</span>
                        </div>
                    </div>
                \`;
                container.scrollTop = container.scrollHeight;
                
                try {
                    const payload = {
                        message,
                        context_type: currentAiChatMode
                    };
                    
                    // 文書添削モードの場合、文書内容を追加
                    if (currentAiChatMode === 'review' && selectedDocumentContent) {
                        payload.document_content = selectedDocumentContent;
                        payload.document_title = selectedDocumentTitle;
                    }
                    
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/ai-chat\`, payload);
                    
                    document.getElementById('aiTyping').remove();
                    
                    const formattedResponse = formatAIResponse(response.data.response);
                    container.innerHTML += \`
                        <div class="flex justify-start mb-2">
                            <div class="max-w-[85%] bg-purple-50 rounded-lg p-3 border border-purple-100">
                                <div class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">\${formattedResponse}</div>
                            </div>
                        </div>
                    \`;
                    container.scrollTop = container.scrollHeight;
                } catch (error) {
                    document.getElementById('aiTyping')?.remove();
                    alert('AI応答の取得に失敗しました');
                }
                
                input.disabled = false;
                input.focus();
            });
            
            // マッチングスコア
            async function loadMatchScores() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/match-scores\`);
                    const scores = response.data;
                    
                    if (scores.length === 0) return;
                    
                    const container = document.getElementById('matchingResults');
                    container.innerHTML = scores.map(s => \`
                        <div class="border rounded-lg p-4 \${s.match_score >= 70 ? 'border-green-300 bg-green-50' : s.match_score >= 50 ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}">
                            <div class="flex justify-between items-start mb-2">
                                <span class="font-medium">\${s.subsidy_name}</span>
                                <span class="text-2xl font-bold \${s.match_score >= 70 ? 'text-green-600' : s.match_score >= 50 ? 'text-yellow-600' : 'text-gray-600'}">\${s.match_score}</span>
                            </div>
                            <div class="text-xs text-gray-500 mb-2">\${s.category}</div>
                            <p class="text-sm text-gray-700">\${s.ai_recommendation || ''}</p>
                            \${s.adoption_probability ? \`<div class="mt-2 text-xs text-gray-500">採択可能性: 約\${s.adoption_probability}%</div>\` : ''}
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Match scores load error:', error);
                }
            }
            
            async function runSubsidyMatching() {
                const container = document.getElementById('matchingResults');
                container.innerHTML = '<div class="text-center py-8 col-span-full"><i class="fas fa-spinner fa-spin text-2xl text-green-600"></i><p class="mt-2">AIが分析中...</p></div>';
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/match-subsidies\`);
                    const results = response.data;
                    
                    container.innerHTML = results.map(r => \`
                        <div class="border rounded-lg p-4 \${r.score >= 70 ? 'border-green-300 bg-green-50' : r.score >= 50 ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}">
                            <div class="flex justify-between items-start mb-2">
                                <span class="font-medium">\${r.subsidy_name}</span>
                                <span class="text-2xl font-bold \${r.score >= 70 ? 'text-green-600' : r.score >= 50 ? 'text-yellow-600' : 'text-gray-600'}">\${r.score}</span>
                            </div>
                            <div class="text-xs text-gray-500 mb-2">\${r.category}</div>
                            <p class="text-sm text-gray-700">\${r.recommendation || ''}</p>
                            \${r.adoption_probability ? \`<div class="mt-2 text-xs text-gray-500">採択可能性: 約\${r.adoption_probability}%</div>\` : ''}
                        </div>
                    \`).join('');
                    
                    showToast('マッチング分析が完了しました');
                } catch (error) {
                    container.innerHTML = '<div class="text-center text-red-500 py-8 col-span-full">分析に失敗しました</div>';
                }
            }
            
            // フェーズ4: 詳細採択率予測
            async function runAdoptionPrediction() {
                const container = document.getElementById('adoptionPredictionResult');
                container.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-orange-600"></i><p class="mt-2">AIが詳細分析中...（30秒程度かかります）</p></div>';
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/predict-adoption\`);
                    const { prediction, metadata } = response.data;
                    
                    const assessmentColors = {
                        'S': 'bg-green-600', 'A': 'bg-blue-600', 'B': 'bg-yellow-600', 'C': 'bg-orange-600', 'D': 'bg-red-600'
                    };
                    
                    container.innerHTML = \`
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 text-center">
                                <div class="text-4xl font-bold text-orange-600 mb-1">\${prediction.adoption_probability}%</div>
                                <div class="text-sm text-gray-600">採択可能性</div>
                                <div class="text-xs text-gray-500 mt-1">確信度: \${prediction.confidence_level === 'high' ? '高' : prediction.confidence_level === 'medium' ? '中' : '低'}</div>
                            </div>
                            <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
                                <div class="text-4xl font-bold \${assessmentColors[prediction.overall_assessment]} text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-1">\${prediction.overall_assessment}</div>
                                <div class="text-sm text-gray-600">総合評価</div>
                            </div>
                            <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
                                <div class="text-2xl font-bold text-green-600 mb-1">\${metadata.data_completeness}%</div>
                                <div class="text-sm text-gray-600">データ完成度</div>
                            </div>
                        </div>
                        
                        <!-- スコア内訳 -->
                        <div class="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 class="font-bold text-sm mb-3"><i class="fas fa-chart-bar mr-1"></i>評価項目別スコア</h4>
                            <div class="space-y-2">
                                \${Object.entries(prediction.score_breakdown || {}).map(([key, data]) => \`
                                    <div class="flex items-center gap-2">
                                        <span class="w-24 text-xs text-gray-600">\${key === 'eligibility' ? '申請資格' : key === 'business_plan' ? '事業計画' : key === 'innovation' ? '革新性' : key === 'feasibility' ? '実現可能性' : key === 'expected_effect' ? '期待効果' : key}</span>
                                        <div class="flex-1 bg-gray-200 rounded-full h-4">
                                            <div class="h-4 rounded-full \${data.score >= 70 ? 'bg-green-500' : data.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}" style="width: \${data.score}%"></div>
                                        </div>
                                        <span class="w-8 text-xs font-bold">\${data.score}</span>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                        
                        <!-- 強み・弱み -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div class="bg-green-50 rounded-lg p-4">
                                <h4 class="font-bold text-sm mb-2 text-green-700"><i class="fas fa-thumbs-up mr-1"></i>強み</h4>
                                <ul class="text-sm space-y-1">
                                    \${(prediction.strengths || []).map(s => \`<li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-1"></i>\${s}</li>\`).join('')}
                                </ul>
                            </div>
                            <div class="bg-red-50 rounded-lg p-4">
                                <h4 class="font-bold text-sm mb-2 text-red-700"><i class="fas fa-exclamation-triangle mr-1"></i>改善点</h4>
                                <ul class="text-sm space-y-1">
                                    \${(prediction.weaknesses || []).map(w => \`<li class="flex items-start gap-2"><i class="fas fa-times text-red-500 mt-1"></i>\${w}</li>\`).join('')}
                                </ul>
                            </div>
                        </div>
                        
                        <!-- 改善提案 -->
                        <div class="bg-yellow-50 rounded-lg p-4 mb-4">
                            <h4 class="font-bold text-sm mb-2 text-yellow-700"><i class="fas fa-lightbulb mr-1"></i>改善提案</h4>
                            <div class="space-y-2">
                                \${(prediction.improvement_suggestions || []).map(s => \`
                                    <div class="flex items-start gap-2 bg-white rounded p-2">
                                        <span class="px-2 py-0.5 rounded text-xs \${s.priority === 'high' ? 'bg-red-100 text-red-700' : s.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}">\${s.priority === 'high' ? '高' : s.priority === 'medium' ? '中' : '低'}</span>
                                        <div class="flex-1">
                                            <div class="text-sm font-medium">\${s.suggestion}</div>
                                            <div class="text-xs text-gray-500">\${s.expected_impact}</div>
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                        
                        <!-- 推奨アクション -->
                        <div class="bg-blue-50 rounded-lg p-4">
                            <h4 class="font-bold text-sm mb-2 text-blue-700"><i class="fas fa-tasks mr-1"></i>今すぐ実行すべきアクション</h4>
                            <ol class="text-sm space-y-1 list-decimal list-inside">
                                \${(prediction.recommended_actions || []).map(a => \`<li>\${a}</li>\`).join('')}
                            </ol>
                        </div>
                    \`;
                    
                    showToast('採択率予測が完了しました');
                } catch (error) {
                    container.innerHTML = '<div class="text-center text-red-500 py-8">分析に失敗しました。もう一度お試しください。</div>';
                }
            }
            
            // フェーズ4: 総合マッチング分析
            async function runComprehensiveMatching() {
                const container = document.getElementById('matchingResults');
                container.innerHTML = '<div class="text-center py-8 col-span-full"><i class="fas fa-spinner fa-spin text-2xl text-indigo-600"></i><p class="mt-2">全補助金との適合性を総合分析中...</p></div>';
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/comprehensive-matching\`);
                    const { analysis, metadata } = response.data;
                    
                    // 企業サマリー
                    let html = \`
                        <div class="col-span-full bg-indigo-50 rounded-lg p-4 mb-4">
                            <h4 class="font-bold text-sm mb-2 text-indigo-700"><i class="fas fa-building mr-1"></i>企業分析サマリー</h4>
                            <p class="text-sm">\${analysis.company_summary}</p>
                        </div>
                        <div class="col-span-full bg-purple-50 rounded-lg p-4 mb-4">
                            <h4 class="font-bold text-sm mb-2 text-purple-700"><i class="fas fa-lightbulb mr-1"></i>推奨戦略</h4>
                            <p class="text-sm">\${analysis.overall_strategy}</p>
                            <div class="mt-2 flex flex-wrap gap-2">
                                \${(analysis.priority_actions || []).map(a => \`<span class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">\${a}</span>\`).join('')}
                            </div>
                        </div>
                    \`;
                    
                    // 補助金推奨リスト
                    html += (analysis.recommendations || []).sort((a, b) => a.rank - b.rank).map(r => \`
                        <div class="border rounded-lg p-4 \${r.match_score >= 70 ? 'border-green-300 bg-green-50' : r.match_score >= 50 ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <span class="font-medium">\${r.subsidy_name}</span>
                                    <span class="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">推奨順位: \${r.rank}位</span>
                                </div>
                                <span class="text-2xl font-bold \${r.match_score >= 70 ? 'text-green-600' : r.match_score >= 50 ? 'text-yellow-600' : 'text-gray-600'}">\${r.match_score}</span>
                            </div>
                            <div class="text-xs text-gray-500 mb-2">
                                採択可能性: \${r.adoption_probability}% | 
                                申請難易度: \${r.application_complexity} |
                                想定補助額: \${r.estimated_amount}
                            </div>
                            <div class="flex flex-wrap gap-1 mb-2">
                                \${r.compatibility?.eligibility?.met ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">✓ 申請資格あり</span>' : '<span class="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">✗ 要確認</span>'}
                                <span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">\${r.compatibility?.timing?.status || '確認中'}</span>
                            </div>
                            <div class="text-sm mb-2">
                                <strong class="text-green-700">推奨理由:</strong>
                                <ul class="list-disc list-inside text-xs text-gray-600 mt-1">
                                    \${(r.reasons || []).map(reason => \`<li>\${reason}</li>\`).join('')}
                                </ul>
                            </div>
                            \${(r.concerns || []).length > 0 ? \`
                                <div class="text-sm">
                                    <strong class="text-red-700">懸念点:</strong>
                                    <ul class="list-disc list-inside text-xs text-gray-600 mt-1">
                                        \${r.concerns.map(c => \`<li>\${c}</li>\`).join('')}
                                    </ul>
                                </div>
                            \` : ''}
                        </div>
                    \`).join('');
                    
                    container.innerHTML = html;
                    showToast(\`総合分析完了: \${metadata.subsidies_analyzed}件の補助金を分析しました\`);
                } catch (error) {
                    container.innerHTML = '<div class="text-center text-red-500 py-8 col-span-full">分析に失敗しました</div>';
                }
            }
            
            // ===============================
            // 文書生成
            // ===============================
            
            let documentTemplates = [];
            
            async function loadDocumentTemplates() {
                try {
                    const response = await axios.get('/api/document-templates');
                    documentTemplates = response.data;
                    
                    const select = document.getElementById('templateSelect');
                    select.innerHTML = '<option value="">選択してください</option>' +
                        documentTemplates.map(t => \`<option value="\${t.id}" data-subsidy-type-id="\${t.subsidy_type_id || ''}">\${t.template_name}</option>\`).join('');
                } catch (error) {
                    console.error('Templates load error:', error);
                }
            }
            
            // テンプレート選択時のハンドラー
            async function onTemplateSelectChange(templateId) {
                const descEl = document.getElementById('templateDescription');
                
                if (!templateId) {
                    descEl.textContent = '';
                    // 全体のヒアリング状況を表示
                    await loadHearingStatusForGeneration();
                    return;
                }
                
                // 選択されたテンプレートの情報を取得
                const template = documentTemplates.find(t => t.id == templateId);
                if (template) {
                    descEl.textContent = template.description || '';
                    
                    // テンプレートに紐づく申請種別のヒアリング状況を取得
                    if (template.subsidy_type_id) {
                        await loadHearingStatusForTemplate(template.subsidy_type_id);
                    } else {
                        await loadHearingStatusForGeneration();
                    }
                }
            }
            
            // テンプレートに紐づく申請種別のヒアリング状況を取得
            async function loadHearingStatusForTemplate(subsidyTypeId) {
                const container = document.getElementById('hearingStatus');
                container.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 確認中...';
                
                try {
                    // 顧客のヒアリング回答を取得（CLIENT_IDを使用）
                    const answersRes = await axios.get(\`/api/clients/\${CLIENT_ID}/hearing-answers\`);
                    const answers = answersRes.data || [];
                    
                    // 申請種別に紐づくヒアリング質問を取得
                    const questionsRes = await axios.get(\`/api/hearing-questions?subsidy_type_id=\${subsidyTypeId}\`);
                    const questions = questionsRes.data || [];
                    
                    if (questions.length === 0) {
                        container.innerHTML = \`
                            <div class="flex items-center gap-2 text-gray-500">
                                <i class="fas fa-info-circle"></i>
                                <span>このテンプレートに関連するヒアリング質問は設定されていません</span>
                            </div>
                        \`;
                        return;
                    }
                    
                    // 回答済みの質問をカウント
                    const answeredQuestionIds = answers.filter(a => a.answer_text).map(a => a.question_id);
                    const relevantAnswers = questions.filter(q => answeredQuestionIds.includes(q.id));
                    const answeredCount = relevantAnswers.length;
                    const totalCount = questions.length;
                    const percentage = Math.round((answeredCount / totalCount) * 100);
                    
                    // カテゴリ別の回答状況
                    const categories = {};
                    questions.forEach(q => {
                        const cat = q.category || 'その他';
                        if (!categories[cat]) categories[cat] = { total: 0, answered: 0 };
                        categories[cat].total++;
                        if (answeredQuestionIds.includes(q.id)) {
                            categories[cat].answered++;
                        }
                    });
                    
                    const statusColor = percentage >= 80 ? 'text-green-700' : percentage >= 50 ? 'text-yellow-700' : 'text-red-700';
                    const statusIcon = percentage >= 80 ? 'fa-check-circle' : percentage >= 50 ? 'fa-exclamation-triangle' : 'fa-times-circle';
                    
                    container.innerHTML = \`
                        <div class="flex items-center gap-2 \${statusColor} mb-2">
                            <i class="fas \${statusIcon}"></i>
                            <span>\${answeredCount}/\${totalCount}件のヒアリング回答が登録済み (\${percentage}%)</span>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            \${Object.entries(categories).map(([cat, info]) => \`
                                <span class="px-2 py-1 bg-white rounded text-xs \${info.answered === info.total ? 'text-green-600' : 'text-gray-600'}">
                                    \${cat}: \${info.answered}/\${info.total}件
                                </span>
                            \`).join('')}
                        </div>
                        \${percentage < 80 ? '<p class="text-xs text-yellow-600 mt-2"><i class="fas fa-lightbulb mr-1"></i>ヒアリング回答を増やすと、より精度の高い文書が生成できます</p>' : ''}
                    \`;
                } catch (error) {
                    console.error('Error loading hearing status:', error);
                    container.innerHTML = '<span class="text-gray-500">読み込みエラー</span>';
                }
            }
            
            async function loadGeneratedDocuments() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/generated-documents\`);
                    const docs = response.data;
                    
                    const container = document.getElementById('generatedDocumentsList');
                    if (docs.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center text-gray-500 py-8">
                                <i class="fas fa-file-alt text-4xl mb-2 text-gray-300"></i>
                                <p>まだ生成された文書はありません</p>
                                <p class="text-sm mt-2">「新規生成」ボタンで申請書を自動生成できます</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    const statusLabels = {
                        draft: { label: '下書き', class: 'bg-gray-100 text-gray-800' },
                        review: { label: 'レビュー中', class: 'bg-yellow-100 text-yellow-800' },
                        final: { label: '確定', class: 'bg-green-100 text-green-800' }
                    };
                    
                    container.innerHTML = docs.map(doc => \`
                        <div class="border rounded-lg p-4 hover:shadow-md transition">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h3 class="font-medium">\${doc.document_title || '無題の文書'}</h3>
                                    <p class="text-sm text-gray-500">\${doc.template_name || 'テンプレート未設定'}</p>
                                </div>
                                <span class="px-2 py-1 rounded text-xs \${statusLabels[doc.status]?.class || ''}">\${statusLabels[doc.status]?.label || doc.status}</span>
                            </div>
                            <div class="text-xs text-gray-400 mb-3">
                                作成: \${new Date(doc.created_at).toLocaleString('ja-JP')}
                                \${doc.updated_at !== doc.created_at ? \` / 更新: \${new Date(doc.updated_at).toLocaleString('ja-JP')}\` : ''}
                            </div>
                            <div class="flex gap-2">
                                <button onclick="viewDocument(\${doc.id})" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm">
                                    <i class="fas fa-eye mr-1"></i>詳細・編集
                                </button>
                                <button onclick="deleteGeneratedDocument(\${doc.id})" 
                                        class="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm"
                                        title="削除"
                                        data-title="\${doc.document_title || '無題の文書'}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Generated documents load error:', error);
                }
            }
            
            async function openGenerateDocumentModal() {
                document.getElementById('generateDocumentModal').classList.remove('hidden');
                await loadCasesForGeneration();
                await loadDocumentTemplates();
                await loadSuccessCasesPreview();
            }
            
            function closeGenerateDocumentModal() {
                document.getElementById('generateDocumentModal').classList.add('hidden');
            }
            
            // 案件一覧を読み込み
            async function loadCasesForGeneration() {
                const select = document.getElementById('caseSelect');
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/cases\`);
                    const cases = response.data || [];
                    
                    const statusMap = {
                        'preparing': '準備中',
                        'submitted': '申請済',
                        'under_review': '審査中',
                        'approved': '採択',
                        'rejected': '不採択',
                        'completed': '完了',
                        'cancelled': 'キャンセル'
                    };
                    
                    select.innerHTML = '<option value="">選択してください</option>' + 
                        cases.map(c => {
                            const caseNo = 'No.' + String(c.id).padStart(4, '0');
                            const subsidyName = c.subsidy_type_name || '補助金種別未設定';
                            const status = statusMap[c.status] || c.status;
                            const createdDate = c.created_at ? new Date(c.created_at).toLocaleDateString('ja-JP') : '';
                            return \`<option value="\${c.id}">[\${caseNo}] \${subsidyName}（\${status}）\${createdDate ? ' - ' + createdDate + '作成' : ''}</option>\`;
                        }).join('');
                    
                    // 案件が1つだけなら自動選択
                    if (cases.length === 1) {
                        select.value = cases[0].id;
                        onCaseSelectChange(cases[0].id);
                    }
                } catch (error) {
                    select.innerHTML = '<option value="">案件の読み込みに失敗しました</option>';
                }
            }
            
            // 案件選択時の処理
            async function onCaseSelectChange(caseId) {
                if (!caseId) {
                    document.getElementById('hearingStatus').innerHTML = '案件を選択してください';
                    return;
                }
                await loadHearingStatusForGeneration(caseId);
            }
            
            // ヒアリング状況を読み込み（案件別）
            async function loadHearingStatusForGeneration(caseId) {
                const container = document.getElementById('hearingStatus');
                if (!caseId) {
                    container.innerHTML = '案件を選択してください';
                    return;
                }
                
                container.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 確認中...';
                
                try {
                    const answersRes = await axios.get(\`/api/cases/\${caseId}/hearing-answers\`);
                    const answers = answersRes.data || [];
                    
                    if (answers.length === 0) {
                        container.innerHTML = \`
                            <div class="flex items-center gap-2 text-yellow-700">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span>この案件のヒアリング回答がありません。AIチャットで情報を入力してください。</span>
                            </div>
                        \`;
                    } else {
                        const categories = {};
                        answers.forEach(a => {
                            if (!categories[a.category]) categories[a.category] = 0;
                            if (a.answer_text) categories[a.category]++;
                        });
                        
                        container.innerHTML = \`
                            <div class="flex items-center gap-2 text-green-700 mb-2">
                                <i class="fas fa-check-circle"></i>
                                <span>\${answers.filter(a => a.answer_text).length}件のヒアリング回答が登録済み</span>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                \${Object.entries(categories).map(([cat, count]) => \`
                                    <span class="px-2 py-1 bg-white rounded text-xs">\${cat}: \${count}件</span>
                                \`).join('')}
                            </div>
                        \`;
                    }
                } catch (error) {
                    container.innerHTML = '<span class="text-gray-500">読み込みエラー</span>';
                }
            }
            
            window.onCaseSelectChange = onCaseSelectChange;
            
            // 採択事例プレビューを読み込み
            async function loadSuccessCasesPreview() {
                const container = document.getElementById('successCasesPreview');
                if (!currentClient?.subsidy_type_id) {
                    container.innerHTML = '<span class="text-gray-500">補助金種別が選択されていません</span>';
                    return;
                }
                
                try {
                    const response = await axios.get(\`/api/success-cases?subsidy_type_id=\${currentClient.subsidy_type_id}\`);
                    const cases = response.data || [];
                    
                    if (cases.length === 0) {
                        container.innerHTML = '<span class="text-gray-500">参照可能な採択事例がありません</span>';
                    } else {
                        container.innerHTML = \`
                            <p class="mb-2">\${cases.length}件の採択事例を参照して生成します：</p>
                            <ul class="space-y-1 text-xs">
                                \${cases.slice(0, 3).map(c => \`
                                    <li class="flex items-start gap-2">
                                        <i class="fas fa-star text-yellow-500 mt-0.5"></i>
                                        <span>\${c.success_summary?.substring(0, 80)}...</span>
                                    </li>
                                \`).join('')}
                            </ul>
                        \`;
                    }
                } catch (error) {
                    container.innerHTML = '<span class="text-gray-500">読み込みエラー</span>';
                }
            }
            
            document.getElementById('generateDocumentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const caseId = document.getElementById('caseSelect').value;
                const templateId = document.getElementById('templateSelect').value;
                
                if (!caseId) {
                    alert('案件を選択してください');
                    return;
                }
                if (!templateId) {
                    alert('テンプレートを選択してください');
                    return;
                }
                
                const btn = document.getElementById('generateDocBtn');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>生成中... (数十秒かかります)';
                
                // 生成オプションを収集
                const options = {
                    detailed_numbers: document.getElementById('optDetailedNumbers').checked,
                    competitive_advantage: document.getElementById('optCompetitiveAdvantage').checked,
                    future_vision: document.getElementById('optFutureVision').checked
                };
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/generate-document\`, {
                        template_id: parseInt(templateId),
                        case_id: parseInt(caseId),
                        options: options
                    });
                    
                    closeGenerateDocumentModal();
                    showToast('文書が生成されました！');
                    loadGeneratedDocuments();
                    
                    // 生成した文書を表示
                    viewDocument(response.data.id);
                } catch (error) {
                    alert('文書生成に失敗しました: ' + (error.response?.data?.error || error.message));
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-magic mr-1"></i>生成開始';
                }
            });
            
            let currentViewingDocId = null;
            
            async function deleteGeneratedDocument(docId) {
                if (!confirm('この文書を削除しますか？\\n\\nこの操作は取り消せません。')) {
                    return;
                }
                
                try {
                    await axios.delete(\`/api/generated-documents/\${docId}\`);
                    showToast('文書を削除しました');
                    loadGeneratedDocuments();
                } catch (error) {
                    console.error('Delete error:', error);
                    showToast('削除に失敗しました', 'error');
                }
            }
            
            async function viewDocument(docId) {
                currentViewingDocId = docId;
                try {
                    const response = await axios.get(\`/api/generated-documents/\${docId}\`);
                    // APIは { document: {...} } 形式で返す
                    const doc = response.data.document || response.data;
                    
                    document.getElementById('documentDetailTitle').textContent = doc.document_title || '無題の文書';
                    
                    // template_sectionsがない場合はsections_contentからキーを取得してセクションを生成
                    let sections = [];
                    let content = {};
                    
                    if (doc.template_sections) {
                        sections = JSON.parse(doc.template_sections);
                    }
                    
                    if (doc.sections_content) {
                        content = typeof doc.sections_content === 'string' 
                            ? JSON.parse(doc.sections_content) 
                            : doc.sections_content;
                        
                        // template_sectionsがない場合、sections_contentのキーからセクションを生成
                        if (sections.length === 0) {
                            const sectionLabels = {
                                'company_overview': '会社概要・事業概要',
                                'innovation_plan': '革新的な取組内容',
                                'equipment_plan': '設備投資計画',
                                'expected_results': '期待される成果',
                                'implementation_schedule': '実施スケジュール',
                                'innovation': '革新的な取組内容',
                                'future_outlook': '将来の展望',
                                'schedule': 'スケジュール',
                                'content': '本文'
                            };
                            
                            sections = Object.keys(content).map((key, index) => ({
                                id: key,
                                title: sectionLabels[key] || key,
                                max_chars: 10000,
                                order: index
                            }));
                        }
                    }
                    
                    const statusOptions = ['draft', 'review', 'final'];
                    const statusLabels = { draft: '下書き', review: 'レビュー中', final: '確定' };
                    
                    document.getElementById('documentDetailContent').innerHTML = \`
                        <!-- プロ編集ツールバー -->
                        <div class="bg-indigo-50 rounded-lg p-4 mb-6">
                            <h4 class="font-bold text-sm mb-3">
                                <i class="fas fa-tools mr-1 text-indigo-600"></i>プロ編集ツール
                            </h4>
                            <div class="flex flex-wrap gap-2">
                                <div class="flex items-center gap-2">
                                    <label class="text-sm">ステータス:</label>
                                    <select onchange="updateDocumentStatus(\${doc.id}, this.value)" class="border rounded px-3 py-1 text-sm">
                                        \${statusOptions.map(s => \`<option value="\${s}" \${doc.status === s ? 'selected' : ''}>\${statusLabels[s]}</option>\`).join('')}
                                    </select>
                                </div>
                                <button onclick="showSuccessCaseComparison()" class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                                    <i class="fas fa-trophy mr-1"></i>採択事例と比較
                                </button>
                                <button onclick="showEditHistory(\${doc.id})" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                                    <i class="fas fa-history mr-1"></i>編集履歴
                                </button>
                                <button onclick="exportDocument(\${doc.id})" class="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">
                                    <i class="fas fa-download mr-1"></i>エクスポート
                                </button>
                                <button onclick="deleteGeneratedDocumentFromDetail(\${doc.id})" 
                                        class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                                    <i class="fas fa-trash mr-1"></i>削除
                                </button>
                            </div>
                        </div>
                        
                        <!-- 採択事例比較パネル（デフォルト非表示） -->
                        <div id="successCaseComparisonPanel" class="hidden bg-green-50 rounded-lg p-4 mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <h4 class="font-bold text-sm">
                                    <i class="fas fa-balance-scale mr-1 text-green-600"></i>採択事例との比較分析
                                </h4>
                                <button onclick="hideSuccessCaseComparison()" class="text-gray-500 hover:text-gray-700">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div id="successCaseComparisonContent">
                                <i class="fas fa-spinner fa-spin"></i> 分析中...
                            </div>
                        </div>
                        
                        <!-- 編集履歴パネル（デフォルト非表示） -->
                        <div id="editHistoryPanel" class="hidden bg-blue-50 rounded-lg p-4 mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <h4 class="font-bold text-sm">
                                    <i class="fas fa-history mr-1 text-blue-600"></i>編集履歴
                                </h4>
                                <button onclick="hideEditHistory()" class="text-gray-500 hover:text-gray-700">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div id="editHistoryContent">
                                <i class="fas fa-spinner fa-spin"></i> 読み込み中...
                            </div>
                        </div>
                        
                        <!-- セクション一覧 -->
                        <div class="space-y-6">
                            \${sections.map(section => {
                                const sectionContent = content[section.id] || '';
                                const charCount = sectionContent.length;
                                const charPercentage = Math.min(100, Math.round((charCount / section.max_chars) * 100));
                                const charColor = charPercentage > 90 ? 'text-red-600' : charPercentage > 70 ? 'text-yellow-600' : 'text-green-600';
                                
                                return \`
                                <div class="border rounded-lg p-4" data-max-chars="\${section.max_chars}">
                                    <div class="flex justify-between items-center mb-2">
                                        <h3 class="font-bold text-lg">\${section.title}</h3>
                                        <div class="flex gap-2">
                                            <button onclick="compareWithSuccessCase('\${section.id}')" 
                                                    class="text-green-600 hover:text-green-800 text-sm" title="採択事例と比較">
                                                <i class="fas fa-search-plus mr-1"></i>比較
                                            </button>
                                            <button onclick="regenerateSection(\${doc.id}, '\${section.id}')" 
                                                    class="text-purple-600 hover:text-purple-800 text-sm">
                                                <i class="fas fa-sync mr-1"></i>再生成
                                            </button>
                                            <button onclick="editSection(\${doc.id}, '\${section.id}')" 
                                                    class="text-blue-600 hover:text-blue-800 text-sm">
                                                <i class="fas fa-edit mr-1"></i>編集
                                            </button>
                                        </div>
                                    </div>
                                    <div class="flex justify-between items-center mb-2">
                                        <p class="text-xs text-gray-500">\${section.description}</p>
                                        <span class="text-xs \${charColor}">
                                            \${charCount.toLocaleString()} / \${section.max_chars.toLocaleString()}文字 (\${charPercentage}%)
                                        </span>
                                    </div>
                                    <div id="section-content-\${section.id}" class="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded border">
                                        \${sectionContent || '<span class="text-gray-400">未生成</span>'}
                                    </div>
                                    <div id="section-edit-\${section.id}" class="hidden">
                                        <textarea class="w-full border rounded p-3 text-sm" rows="10" 
                                            oninput="document.getElementById('edit-char-count-\${section.id}').textContent = this.value.length + '文字'">\${sectionContent}</textarea>
                                        <div class="flex justify-between items-center mt-2">
                                            <span id="edit-char-count-\${section.id}" class="text-xs text-gray-500">\${charCount}文字</span>
                                            <div class="flex gap-2">
                                                <button onclick="saveSection(\${doc.id}, '\${section.id}')" class="bg-blue-600 text-white px-4 py-2 rounded text-sm">保存</button>
                                                <button onclick="cancelEditSection('\${section.id}')" class="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm">キャンセル</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            \`}).join('')}
                        </div>
                    \`;
                    
                    document.getElementById('documentDetailModal').classList.remove('hidden');
                } catch (error) {
                    alert('文書の読み込みに失敗しました');
                }
            }
            
            // 採択事例比較機能
            async function showSuccessCaseComparison() {
                const panel = document.getElementById('successCaseComparisonPanel');
                const content = document.getElementById('successCaseComparisonContent');
                panel.classList.remove('hidden');
                
                content.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 採択事例を分析中...';
                
                try {
                    const casesRes = await axios.get(\`/api/success-cases?subsidy_type_id=\${currentClient?.subsidy_type_id || ''}\`);
                    const cases = casesRes.data || [];
                    
                    if (cases.length === 0) {
                        content.innerHTML = '<p class="text-gray-500">比較可能な採択事例がありません。</p>';
                        return;
                    }
                    
                    content.innerHTML = \`
                        <div class="space-y-3">
                            \${cases.slice(0, 5).map((c, i) => \`
                                <div class="bg-white rounded-lg p-3 border border-green-200">
                                    <div class="flex items-center gap-2 mb-2">
                                        <i class="fas fa-trophy text-yellow-500"></i>
                                        <span class="font-medium text-sm">事例\${i + 1}: \${c.company_industry || '不明'} (\${c.company_size || '不明'})</span>
                                        <span class="text-xs text-gray-500">\${c.fiscal_year || ''}</span>
                                    </div>
                                    <p class="text-sm text-gray-700 mb-2">\${c.success_summary || ''}</p>
                                    \${c.key_factors ? \`
                                        <div class="text-xs text-green-700">
                                            <strong>成功要因:</strong> \${JSON.parse(c.key_factors).join(', ')}
                                        </div>
                                    \` : ''}
                                </div>
                            \`).join('')}
                        </div>
                        <div class="mt-4 p-3 bg-yellow-50 rounded-lg text-sm">
                            <i class="fas fa-lightbulb text-yellow-600 mr-1"></i>
                            <strong>ヒント:</strong> 採択事例の成功要因を参考に、自社の強みを明確に記載しましょう。
                        </div>
                    \`;
                } catch (error) {
                    content.innerHTML = '<p class="text-red-500">採択事例の読み込みに失敗しました。</p>';
                }
            }
            
            function hideSuccessCaseComparison() {
                document.getElementById('successCaseComparisonPanel').classList.add('hidden');
            }
            
            // 編集履歴表示
            async function showEditHistory(docId) {
                const panel = document.getElementById('editHistoryPanel');
                const content = document.getElementById('editHistoryContent');
                panel.classList.remove('hidden');
                
                content.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 編集履歴を読み込み中...';
                
                try {
                    const response = await axios.get(\`/api/generated-documents/\${docId}/edit-history\`);
                    const history = response.data || [];
                    
                    if (history.length === 0) {
                        content.innerHTML = '<p class="text-gray-500">編集履歴がありません。</p>';
                        return;
                    }
                    
                    const editTypeLabels = {
                        manual: { label: '手動編集', class: 'bg-blue-100 text-blue-800' },
                        ai_regenerate: { label: 'AI再生成', class: 'bg-purple-100 text-purple-800' },
                        ai_suggestion: { label: 'AI提案', class: 'bg-green-100 text-green-800' }
                    };
                    
                    content.innerHTML = \`
                        <div class="space-y-2 max-h-60 overflow-y-auto">
                            \${history.map(h => \`
                                <div class="bg-white rounded p-2 border text-sm">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="px-2 py-0.5 rounded text-xs \${editTypeLabels[h.edit_type]?.class || 'bg-gray-100'}">\${editTypeLabels[h.edit_type]?.label || h.edit_type}</span>
                                        <span class="text-gray-600">\${h.section_id}</span>
                                        <span class="text-xs text-gray-400">\${new Date(h.created_at).toLocaleString('ja-JP')}</span>
                                    </div>
                                    <div class="text-xs text-gray-500">編集者: \${h.editor_name || '不明'}</div>
                                </div>
                            \`).join('')}
                        </div>
                    \`;
                } catch (error) {
                    content.innerHTML = '<p class="text-gray-500">編集履歴の読み込みに失敗しました。</p>';
                }
            }
            
            function hideEditHistory() {
                document.getElementById('editHistoryPanel').classList.add('hidden');
            }
            
            // セクション別採択事例比較
            function compareWithSuccessCase(sectionId) {
                alert(\`セクション「\${sectionId}」の採択事例比較機能は、今後のアップデートで追加予定です。\n\n現在は「採択事例と比較」ボタンで全体比較をご利用ください。\`);
            }
            
            // 詳細画面から文書削除
            async function deleteGeneratedDocumentFromDetail(docId) {
                if (!confirm('この文書を削除しますか？\\n\\nこの操作は取り消せません。')) {
                    return;
                }
                
                try {
                    await axios.delete(\`/api/generated-documents/\${docId}\`);
                    showToast('文書を削除しました');
                    closeDocumentDetailModal();
                    loadGeneratedDocuments();
                } catch (error) {
                    console.error('Delete error:', error);
                    showToast('削除に失敗しました', 'error');
                }
            }
            
            // 文書エクスポート（フェーズ4）
            function exportDocument(docId) {
                // HTML形式でエクスポート（印刷 → PDF保存可能）
                window.open(\`/api/generated-documents/\${docId}/export?format=html\`, '_blank');
                showToast('新しいタブで文書が開きました。印刷メニュー（Ctrl+P）からPDFに保存できます。');
            }
            
            // 全文書エクスポート
            async function exportAllDocuments() {
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/export-all-documents\`);
                    const data = response.data;
                    
                    // JSONとしてダウンロード
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = \`\${data.client.company_name || data.client.name}_documents_\${new Date().toISOString().split('T')[0]}.json\`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    showToast('全文書をエクスポートしました');
                } catch (error) {
                    alert('エクスポートに失敗しました');
                }
            }
            
            function closeDocumentDetailModal() {
                document.getElementById('documentDetailModal').classList.add('hidden');
            }
            
            async function updateDocumentStatus(docId, status) {
                try {
                    await axios.put(\`/api/generated-documents/\${docId}/status\`, { status });
                    showToast('ステータスを更新しました');
                    loadGeneratedDocuments();
                } catch (error) {
                    alert('更新に失敗しました');
                }
            }
            
            function editSection(docId, sectionId) {
                document.getElementById('section-content-' + sectionId).classList.add('hidden');
                document.getElementById('section-edit-' + sectionId).classList.remove('hidden');
            }
            
            function cancelEditSection(sectionId) {
                document.getElementById('section-content-' + sectionId).classList.remove('hidden');
                document.getElementById('section-edit-' + sectionId).classList.add('hidden');
            }
            
            // 文字数表示を更新する関数
            function updateCharCount(sectionId, content, maxChars) {
                const charCount = content.length;
                const charPercentage = Math.min(100, Math.round((charCount / maxChars) * 100));
                const charColor = charPercentage > 90 ? 'text-red-600' : charPercentage > 70 ? 'text-yellow-600' : 'text-green-600';
                
                // セクションヘッダーの文字数表示を更新
                const sectionDiv = document.getElementById('section-content-' + sectionId)?.closest('.border.rounded-lg');
                if (sectionDiv) {
                    const charSpan = sectionDiv.querySelector('.text-xs.text-red-600, .text-xs.text-yellow-600, .text-xs.text-green-600');
                    if (charSpan) {
                        charSpan.className = 'text-xs ' + charColor;
                        charSpan.textContent = charCount.toLocaleString() + ' / ' + maxChars.toLocaleString() + '文字 (' + charPercentage + '%)';
                    }
                }
                
                // 編集中の文字数表示も更新
                const editCharCount = document.getElementById('edit-char-count-' + sectionId);
                if (editCharCount) {
                    editCharCount.textContent = charCount + '文字';
                }
            }
            
            async function saveSection(docId, sectionId) {
                const textarea = document.querySelector('#section-edit-' + sectionId + ' textarea');
                const content = textarea.value;
                
                try {
                    await axios.put(\`/api/generated-documents/\${docId}/sections/\${sectionId}\`, {
                        content,
                        edit_type: 'manual',
                        editor_name: localStorage.getItem('admin_name') || 'admin'
                    });
                    
                    document.getElementById('section-content-' + sectionId).textContent = content;
                    
                    // 文字数表示を更新（max_charsはdata属性から取得）
                    const sectionDiv = document.getElementById('section-content-' + sectionId)?.closest('.border.rounded-lg');
                    const maxChars = parseInt(sectionDiv?.dataset?.maxChars || '1000');
                    updateCharCount(sectionId, content, maxChars);
                    
                    cancelEditSection(sectionId);
                    showToast('保存しました');
                } catch (error) {
                    alert('保存に失敗しました');
                }
            }
            
            async function regenerateSection(docId, sectionId) {
                const instruction = prompt('追加の指示があれば入力してください（空欄可）:');
                if (instruction === null) return; // キャンセルされた場合
                
                const container = document.getElementById('section-content-' + sectionId);
                container.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 再生成中...';
                
                try {
                    const response = await axios.post(\`/api/generated-documents/\${docId}/regenerate-section\`, {
                        section_id: sectionId,
                        additional_instructions: instruction,
                        editor_name: localStorage.getItem('admin_name') || 'admin'
                    });
                    
                    const newContent = response.data.content;
                    container.textContent = newContent;
                    
                    // 文字数表示を更新
                    const sectionDiv = container.closest('.border.rounded-lg');
                    const maxChars = parseInt(sectionDiv?.dataset?.maxChars || '1000');
                    updateCharCount(sectionId, newContent, maxChars);
                    
                    showToast('再生成しました');
                } catch (error) {
                    container.innerHTML = '<span class="text-red-500">再生成に失敗しました</span>';
                }
            }
            
            window.updateCharCount = updateCharCount;

            // グローバルスコープに関数を公開（onclick対応）
            window.logout = logout;
            window.switchClientTab = switchClientTab;
            window.editClient = editClient;
            window.deleteCurrentClient = deleteCurrentClient;
            window.runAdoptionPrediction = runAdoptionPrediction;
            window.runComprehensiveMatching = runComprehensiveMatching;
            window.runSubsidyMatching = runSubsidyMatching;
            window.openGenerateDocumentModal = openGenerateDocumentModal;
            window.closeGenerateDocumentModal = closeGenerateDocumentModal;
            window.openAssignPipelineModal = openAssignPipelineModal;
            window.closeAssignPipelineModal = closeAssignPipelineModal;
            window.closeTaskDetailModal = closeTaskDetailModal;
            window.closeDocumentDetailModal = closeDocumentDetailModal;
            window.closeEditModal = closeEditModal;
            window.copyPortalUrl = copyPortalUrl;
            window.updateDocumentStatus = updateDocumentStatus;
            window.openTaskDetail = openTaskDetail;
            window.viewDocument = viewDocument;
            window.deleteGeneratedDocument = deleteGeneratedDocument;
            window.showSuccessCaseComparison = showSuccessCaseComparison;
            window.hideSuccessCaseComparison = hideSuccessCaseComparison;
            window.showEditHistory = showEditHistory;
            window.hideEditHistory = hideEditHistory;
            window.compareWithSuccessCase = compareWithSuccessCase;
            window.regenerateSection = regenerateSection;
            window.editSection = editSection;
            window.saveSection = saveSection;
            window.cancelEditSection = cancelEditSection;
            window.exportDocument = exportDocument;
            window.deleteGeneratedDocumentFromDetail = deleteGeneratedDocumentFromDetail;
            window.showToast = showToast;
            window.loadDocuments = loadDocuments;

            Promise.all([loadSubsidyTypes(), loadUsers()]).then(() => {
                console.log('Initial data loaded, now loading client data...');
                loadClient();
                loadDocuments();
                loadCommonDocumentsAdmin();
                loadCommunications();
            }).catch(error => {
                console.error('Error during initial load:', error);
                document.getElementById('clientInfo').innerHTML = '<div class="text-red-600">初期データの読み込みに失敗しました</div>';
            });
            
            ${sidebarScripts}
        </script>
            </main>
        </div>
    </body>
    </html>
  `)
})

export default routes
