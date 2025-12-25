// 顧客ポータル
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/portal/:token', async (c) => {
  const { DB } = c.env
  const token = c.req.param('token')
  
  // まず案件テーブルから検索
  let caseData = await DB.prepare(`
    SELECT cases.*, clients.name, clients.company_name, clients.email, clients.phone,
           clients.id as client_id
    FROM cases
    LEFT JOIN clients ON cases.client_id = clients.id
    WHERE cases.access_token = ?
  `).bind(token).first()
  
  // フォールバック: 旧形式（clientsテーブルのトークン）
  let client = caseData
  if (!caseData) {
    client = await DB.prepare(`
      SELECT * FROM clients WHERE access_token = ?
    `).bind(token).first()
  }
  
  if (!client) {
    return c.text('Invalid access token', 403)
  }
  
  // 案件データがある場合はそれを使用
  const caseId = caseData?.id || null
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>顧客ポータル - ${client.name}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-slate-50 to-green-50 min-h-screen">
        <style>
            /* タブ切り替え対応 */
            .main-tab-btn { transition: all 0.3s; border-radius: 12px 12px 0 0; }
            .main-tab-btn.active { background: white; color: #16a34a; font-weight: 600; box-shadow: 0 -2px 10px rgba(0,0,0,0.1); }
            .main-tab-btn:not(.active):hover { background: rgba(255,255,255,0.2); }
            .main-tab-content { display: none; }
            .main-tab-content.active { display: block; }
            /* 1画面に収まるレイアウト */
            .portal-container { height: calc(100vh - 140px); overflow: hidden; }
            .tab-panel { height: 100%; overflow-y: auto; }
            /* モバイル対応 */
            @media (max-width: 768px) {
                .portal-container { height: calc(100vh - 160px); }
            }
            /* カスタムアニメーション */
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        </style>
        <div class="h-screen flex flex-col">
            <!-- ヘッダー（モダンスタイル） -->
            <header class="bg-gradient-to-r from-green-600 via-green-700 to-emerald-700 text-white shadow-xl flex-shrink-0">
                <div class="container mx-auto px-4 py-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <i class="fas fa-user-circle text-lg"></i>
                                </div>
                                <div>
                                    <p class="text-green-100 text-xs">顧客ポータル</p>
                                    <h1 class="text-base md:text-lg font-bold">${client.name} 様</h1>
                                </div>
                            </div>
                            <!-- 案件セレクター -->
                            <select id="caseSelector" onchange="if(this.value) window.location.href='/portal/'+this.value" 
                                    class="bg-white/20 text-white text-xs px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-white/50 backdrop-blur-sm">
                                <option value="">案件を選択...</option>
                            </select>
                        </div>
                        <div class="flex items-center gap-3">
                            <button onclick="openAiModal()" class="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all" title="AIサポート">
                                <i class="fas fa-robot"></i>
                            </button>
                            <button onclick="openNewApplicationModal()" 
                                    class="bg-white text-green-700 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:scale-105">
                                <i class="fas fa-plus"></i>
                                <span class="hidden sm:inline">新規申請</span>
                            </button>
                        </div>
                    </div>
                    <!-- メインタブナビゲーション -->
                    <nav class="flex gap-2 mt-3 -mb-1">
                        <button onclick="switchMainTab('home')" id="mainTabHome" class="main-tab-btn active flex-1 px-4 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2">
                            <i class="fas fa-home"></i><span class="hidden sm:inline">ホーム</span>
                        </button>
                        <button onclick="switchMainTab('documents')" id="mainTabDocuments" class="main-tab-btn flex-1 px-4 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2">
                            <i class="fas fa-file-upload"></i><span class="hidden sm:inline">書類</span>
                            <span id="docBadge" class="text-xs bg-white/30 px-2 py-0.5 rounded-full hidden">0</span>
                        </button>
                        <button onclick="switchMainTab('create')" id="mainTabCreate" class="main-tab-btn flex-1 px-4 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2">
                            <i class="fas fa-file-signature"></i><span class="hidden sm:inline">書類作成</span>
                        </button>
                        <button onclick="switchMainTab('hearing')" id="mainTabHearing" class="main-tab-btn flex-1 px-4 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2">
                            <i class="fas fa-clipboard-list"></i><span class="hidden sm:inline">ヒアリング</span>
                            <span id="hearingBadge" class="text-xs bg-white/30 px-2 py-0.5 rounded-full hidden">0/0</span>
                        </button>
                        <button onclick="switchMainTab('messages')" id="mainTabMessages" class="main-tab-btn flex-1 px-4 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2">
                            <i class="fas fa-comments"></i><span class="hidden sm:inline">やり取り</span>
                            <span id="msgBadge" class="text-xs bg-red-500 px-2 py-0.5 rounded-full hidden">0</span>
                        </button>
                    </nav>
                </div>
            </header>

            <!-- メインコンテンツ（タブで切り替え） -->
            <div class="flex-1 overflow-hidden portal-container">
                <div class="container mx-auto h-full px-3 py-3">
                    <!-- ========================================== -->
                    <!-- ホームタブ -->
                    <!-- ========================================== -->
                    <div id="tabPanelHome" class="main-tab-content active tab-panel">
                        <!-- 見込みステータス時の制限バナー -->
                        <div id="inquiryRestrictionBanner" class="hidden mb-3">
                            <div class="bg-gradient-to-r from-yellow-400 to-amber-400 rounded-lg shadow p-3 text-white">
                                <div class="flex items-center gap-2">
                                    <i class="fas fa-info-circle"></i>
                                    <div>
                                        <span class="font-bold text-sm">現在「見込み」ステータスです</span>
                                        <span class="text-xs opacity-90 ml-2">担当者が案件を開始すると、各機能が利用可能になります</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 次にやるべきこと -->
                        <div id="nextActionsSection" class="hidden mb-3">
                            <div class="bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg shadow p-3 text-white">
                                <div class="flex items-center gap-2 mb-2">
                                    <i class="fas fa-bell"></i>
                                    <span class="font-bold text-sm">次にやるべきこと</span>
                                </div>
                                <div id="nextActionsList" class="space-y-1 text-sm"></div>
                            </div>
                        </div>
                        
                        <!-- ステータスカード -->
                        <div class="bg-white rounded-lg shadow p-3 mb-3">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="text-xl" id="statusIcon"></div>
                                    <div>
                                        <div class="text-sm font-bold" id="statusText"></div>
                                        <div class="text-xs text-gray-500" id="statusDescription"></div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs text-gray-500">ヒアリング進捗</div>
                                    <div id="hearingProgress" class="text-xs font-medium text-indigo-600">0/0</div>
                                </div>
                            </div>
                            <div class="mt-2 w-full bg-indigo-200 rounded-full h-1.5">
                                <div id="hearingProgressBar" class="bg-indigo-600 h-1.5 rounded-full transition-all" style="width: 0%"></div>
                            </div>
                        </div>
                        
                        <!-- 2カラムレイアウト: パイプライン + 請求書/契約 -->
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <!-- パイプライン進捗 -->
                            <div id="pipelineProgressSection" class="hidden bg-white rounded-lg shadow p-3">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-sm font-bold"><i class="fas fa-list-ol mr-1 text-blue-600"></i>進捗状況</span>
                                    <span id="pipelineProgressText" class="text-xs font-bold text-blue-600">0%</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                                    <div id="pipelineProgressBar" class="bg-blue-500 h-1.5 rounded-full transition-all" style="width: 0%"></div>
                                </div>
                                <div id="pipelineTasksList" class="space-y-1.5 max-h-48 overflow-y-auto text-xs"></div>
                            </div>
                            
                            <!-- 請求書・契約 -->
                            <div class="bg-white rounded-lg shadow p-3">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-sm font-bold"><i class="fas fa-file-invoice-dollar mr-1 text-green-600"></i>請求書</span>
                                    <span id="invoiceCountBadge" class="hidden text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"></span>
                                </div>
                                <div id="portalInvoicesContent" class="space-y-2 max-h-48 overflow-y-auto text-xs">
                                    <div class="text-gray-500 py-2 text-center"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>
                                </div>
                                <!-- 契約書リンク -->
                                <div id="contractSection" class="hidden mt-2 pt-2 border-t">
                                    <a id="contractLink" href="#" target="_blank" class="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800">
                                        <i class="fas fa-file-signature"></i>電子契約書を開く
                                    </a>
                                </div>
                            </div>
                        </div>
                        
                        <!-- フッターリンク -->
                        <div class="mt-3 flex flex-wrap gap-2 text-xs">
                            <a href="/privacy-policy" target="_blank" class="text-gray-500 hover:text-gray-700">
                                <i class="fas fa-shield-alt mr-1"></i>プライバシーポリシー
                            </a>
                            <a href="/legal" target="_blank" class="text-gray-500 hover:text-gray-700">
                                <i class="fas fa-gavel mr-1"></i>特定商取引法
                            </a>
                        </div>
                    </div>

                    <!-- ========================================== -->
                    <!-- 書類タブ（3カラムレイアウト） -->
                    <!-- ========================================== -->
                    <div id="tabPanelDocuments" class="main-tab-content tab-panel">
                        <div class="h-full">
                            <!-- 3カラムグリッド -->
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 h-full">
                                <!-- 左カラム: 共通書類 -->
                                <div class="bg-white rounded-lg shadow flex flex-col overflow-hidden">
                                    <div class="p-2 border-b bg-blue-50 flex-shrink-0">
                                        <h3 class="text-xs font-bold text-blue-700">
                                            <i class="fas fa-building mr-1"></i>共通書類
                                        </h3>
                                        <p class="text-xs text-blue-500 mt-0.5">全申請で使用</p>
                                    </div>
                                    <div id="commonDocumentsList" class="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
                                        <div class="text-gray-500 py-2 text-center">読み込み中...</div>
                                    </div>
                                </div>
                                
                                <!-- 中央カラム: 案件別必要書類 -->
                                <div class="bg-white rounded-lg shadow flex flex-col overflow-hidden">
                                    <div class="p-2 border-b bg-green-50 flex-shrink-0">
                                        <h3 class="text-xs font-bold text-green-700">
                                            <i class="fas fa-folder-open mr-1"></i>案件別必要書類
                                        </h3>
                                        <p class="text-xs text-green-500 mt-0.5">タップでアップロード</p>
                                    </div>
                                    <div id="checklistItems" class="flex-1 overflow-y-auto p-2 space-y-1 text-xs"></div>
                                </div>
                                
                                <!-- 右カラム: アップロード済み -->
                                <div class="bg-white rounded-lg shadow flex flex-col overflow-hidden">
                                    <div class="p-2 border-b bg-gray-50 flex-shrink-0">
                                        <h3 class="text-xs font-bold text-gray-700">
                                            <i class="fas fa-check-circle mr-1 text-green-600"></i>アップロード済み
                                        </h3>
                                        <p class="text-xs text-gray-500 mt-0.5">提出完了した書類</p>
                                    </div>
                                    <div id="uploadedDocuments" class="flex-1 overflow-y-auto p-2 text-xs"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ========================================== -->
                    <!-- 書類作成タブ -->
                    <!-- ========================================== -->
                    <div id="tabPanelCreate" class="main-tab-content tab-panel">
                        <div class="h-full">
                            <!-- 組織資格ステータスによる分岐表示 -->
                            <div id="docCreationLoading" class="bg-white rounded-lg shadow p-8 text-center">
                                <i class="fas fa-spinner fa-spin text-3xl text-gray-400 mb-3"></i>
                                <p class="text-gray-500">読み込み中...</p>
                            </div>
                            
                            <!-- 顧客自己作成モード（資格なし組織向け） -->
                            <div id="selfCreationMode" class="hidden h-full">
                                <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 h-full">
                                    <!-- 左カラム: 法的注意事項と同意 -->
                                    <div class="bg-white rounded-lg shadow flex flex-col overflow-hidden">
                                        <div class="p-2 border-b bg-amber-50 flex-shrink-0">
                                            <h3 class="text-xs font-bold text-amber-700">
                                                <i class="fas fa-exclamation-triangle mr-1"></i>重要事項
                                            </h3>
                                        </div>
                                        <div class="flex-1 overflow-y-auto p-3 text-xs">
                                            <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                                                <p class="font-bold text-red-700 mb-2">法的注意事項</p>
                                                <ul class="space-y-1 text-red-600 list-disc list-inside">
                                                    <li>行政書士法第19条により、官公署提出書類の作成は行政書士の独占業務です</li>
                                                    <li>本サービスはAIによる作成支援ツールであり、<strong>最終的な書類作成と提出は申請者ご自身の責任</strong>で行ってください</li>
                                                    <li>生成された内容は必ず確認・修正の上ご使用ください</li>
                                                </ul>
                                            </div>
                                            <div id="selfCreationConsentArea">
                                                <label class="flex items-start gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                                                    <input type="checkbox" id="selfCreationConsent" class="mt-0.5">
                                                    <span class="text-gray-700">上記の法的注意事項を理解し、自己責任で書類を作成することに同意します</span>
                                                </label>
                                            </div>
                                            <div id="selfCreationConsentDone" class="hidden">
                                                <div class="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                                                    <i class="fas fa-check-circle text-green-600"></i>
                                                    <span class="text-green-700">同意済み</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- 中央カラム: 事業計画書テンプレート -->
                                    <div class="bg-white rounded-lg shadow flex flex-col overflow-hidden">
                                        <div class="p-2 border-b bg-blue-50 flex-shrink-0">
                                            <h3 class="text-xs font-bold text-blue-700">
                                                <i class="fas fa-file-contract mr-1"></i>事業計画書を作成
                                            </h3>
                                            <p class="text-xs text-blue-500 mt-0.5">ヒアリング回答からAIが自動作成</p>
                                        </div>
                                        <div id="availableDocTemplates" class="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
                                            <div class="text-gray-500 py-2 text-center">読み込み中...</div>
                                        </div>
                                    </div>
                                    
                                    <!-- 右カラム: 作成済み書類 -->
                                    <div class="bg-white rounded-lg shadow flex flex-col overflow-hidden">
                                        <div class="p-2 border-b bg-green-50 flex-shrink-0">
                                            <h3 class="text-xs font-bold text-green-700">
                                                <i class="fas fa-check-circle mr-1"></i>作成済み書類
                                            </h3>
                                            <p class="text-xs text-green-500 mt-0.5">ダウンロード・編集可能</p>
                                        </div>
                                        <div id="generatedDocuments" class="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
                                            <div class="text-gray-500 py-2 text-center">まだ作成された書類はありません</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 代行作成モード（有資格組織向け） -->
                            <div id="proxyCreationMode" class="hidden h-full">
                                <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full">
                                    <!-- 左カラム: 代行作成済み書類 -->
                                    <div class="bg-white rounded-lg shadow flex flex-col overflow-hidden">
                                        <div class="p-2 border-b bg-purple-50 flex-shrink-0">
                                            <h3 class="text-xs font-bold text-purple-700">
                                                <i class="fas fa-user-tie mr-1"></i>作成済み書類
                                            </h3>
                                            <p class="text-xs text-purple-500 mt-0.5">専門家が作成した書類</p>
                                        </div>
                                        <div id="proxyCreatedDocuments" class="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
                                            <div class="text-gray-500 py-2 text-center">まだ書類は作成されていません</div>
                                        </div>
                                    </div>
                                    
                                    <!-- 右カラム: 確認・承認 -->
                                    <div class="bg-white rounded-lg shadow flex flex-col overflow-hidden">
                                        <div class="p-2 border-b bg-amber-50 flex-shrink-0">
                                            <h3 class="text-xs font-bold text-amber-700">
                                                <i class="fas fa-clipboard-check mr-1"></i>確認・承認
                                            </h3>
                                            <p class="text-xs text-amber-500 mt-0.5">内容を確認して承認してください</p>
                                        </div>
                                        <div class="flex-1 overflow-y-auto p-3 text-xs">
                                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                                                <i class="fas fa-info-circle text-blue-600 mr-1"></i>
                                                <span class="text-blue-700">書類の内容を確認し、問題なければ「承認」ボタンを押してください。修正が必要な場合は「修正依頼」ボタンからコメントを送信できます。</span>
                                            </div>
                                            <div id="pendingApprovalDocs" class="space-y-2">
                                                <div class="text-gray-500 py-2 text-center">承認待ちの書類はありません</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ========================================== -->
                    <!-- ヒアリングタブ -->
                    <!-- ========================================== -->
                    <div id="tabPanelHearing" class="main-tab-content tab-panel">
                        <div class="bg-white rounded-lg shadow h-full flex flex-col">
                            <div class="p-3 border-b flex-shrink-0">
                                <div class="flex items-center justify-between">
                                    <h2 class="text-sm font-bold"><i class="fas fa-clipboard-list mr-2 text-indigo-600"></i>ヒアリング質問</h2>
                                    <button id="hearingSaveButton" onclick="saveAllHearingAnswers()" 
                                            class="bg-indigo-600 text-white px-2 py-1 text-xs rounded hover:bg-indigo-700">
                                        <i class="fas fa-save mr-1"></i>保存
                                    </button>
                                </div>
                                <!-- 共通/案件別 切り替え -->
                                <div class="flex mt-2 border rounded overflow-hidden text-xs">
                                    <button onclick="switchHearingTab('common')" id="hearingTabCommon"
                                            class="flex-1 px-2 py-1 bg-blue-600 text-white">
                                        <i class="fas fa-building mr-1"></i>会社情報
                                        <span id="commonQuestionsBadge" class="ml-1 bg-white/30 px-1 rounded">0/0</span>
                                    </button>
                                    <button onclick="switchHearingTab('specific')" id="hearingTabSpecific"
                                            class="flex-1 px-2 py-1 bg-gray-100 text-gray-600">
                                        <i class="fas fa-folder mr-1"></i>案件別
                                        <span id="specificQuestionsBadge" class="ml-1 bg-gray-200 px-1 rounded">0/0</span>
                                    </button>
                                </div>
                            </div>
                            <!-- ヒアリング説明 -->
                            <div id="commonQuestionsInfo" class="px-3 pt-2">
                                <p class="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                                    <i class="fas fa-info-circle mr-1"></i>会社情報は一度入力すると、すべての申請案件で自動参照されます。
                                </p>
                            </div>
                            <div id="specificQuestionsInfo" class="hidden px-3 pt-2">
                                <p class="text-xs text-indigo-600 bg-indigo-50 p-2 rounded">
                                    <i class="fas fa-info-circle mr-1"></i>この申請に固有の質問です。
                                </p>
                            </div>
                            <!-- カテゴリタブ -->
                            <div class="px-3 pt-2 flex-shrink-0">
                                <div id="hearingCategoryTabs" class="flex overflow-x-auto gap-1 text-xs">
                                    <div class="text-gray-500 py-1">読み込み中...</div>
                                </div>
                            </div>
                            <!-- 質問一覧 -->
                            <div class="flex-1 overflow-y-auto p-3">
                                <div id="hearingQuestionsList" class="space-y-3">
                                    <div class="text-center py-4 text-gray-500 text-sm">
                                        <i class="fas fa-spinner fa-spin"></i> 読み込み中...
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ========================================== -->
                    <!-- やり取りタブ -->
                    <!-- ========================================== -->
                    <div id="tabPanelMessages" class="main-tab-content tab-panel">
                        <div class="bg-white rounded-lg shadow h-full flex flex-col">
                            <div class="p-3 border-b flex-shrink-0">
                                <h2 class="text-sm font-bold"><i class="fas fa-comments mr-2 text-green-600"></i>やり取り</h2>
                            </div>
                            <div id="clientCommunications" class="flex-1 overflow-y-auto p-3 space-y-2 text-sm"></div>
                            <div class="p-3 border-t flex-shrink-0">
                                <form id="clientMessageForm" class="flex gap-2">
                                    <input type="text" id="clientMessageInput" 
                                           placeholder="メッセージを入力..." 
                                           class="flex-1 px-3 py-2 border rounded text-sm" required>
                                    <button type="submit" class="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700">
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    <!-- ========================================== -->
                    <!-- 旧コンテンツ（互換性のため非表示で保持） -->
                    <!-- ========================================== -->
                    <div id="legacyContent" class="hidden">
                        <!-- お知らせバナー -->
                        <div id="announcementBanner" class="hidden mb-4"></div>
                        
                        <!-- サービス進捗状況 -->
                        <div id="serviceProgressSection" class="hidden mb-4">
                            <div class="bg-white rounded-lg shadow p-4">
                                <h2 class="text-lg font-bold mb-4">
                                    <i class="fas fa-tasks mr-2 text-blue-600"></i>サービス進捗状況
                                </h2>
                                <div id="serviceProgressList" class="space-y-6"></div>
                            </div>
                        </div>
                        
                        <!-- 案件一覧 (セレクター用データ) -->
                        <div id="casesListSection" class="hidden">
                            <div id="portalCasesList"></div>
                        </div>

                        <!-- 旧ステータスセクション（データ互換用） -->
                        <div id="statusSection" class="hidden">
                            <div id="invoicesSection" class="hidden">
                                <!-- 旧請求書セクション -->
                            </div>
                        </div>

                        <!-- 旧ヒアリングセクション（参照用） -->
                        <div id="hearingSection" class="hidden"></div>
                        
                        <!-- 旧書類セクション -->
                        <div id="documentSection" class="hidden">
                            <div id="panelDocuments" class="hidden"></div>
                            <div id="panelCommunications" class="hidden"></div>
                            <div id="tabDocuments" class="hidden"></div>
                            <div id="tabCommunications" class="hidden"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

            <!-- 書類アップロードモーダル -->
            <div id="documentUploadModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white rounded-xl w-full max-w-sm shadow-xl">
                    <div class="flex items-center justify-between p-4 border-b bg-green-600 text-white rounded-t-xl">
                        <h3 id="uploadModalTitle" class="font-bold text-sm">
                            <i class="fas fa-upload mr-2"></i>書類アップロード
                        </h3>
                        <button onclick="closeUploadModal()" class="text-white hover:text-green-200">
                            <i class="fas fa-times text-lg"></i>
                        </button>
                    </div>
                    <div class="p-4">
                        <div id="dropZone" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors hover:border-green-500 hover:bg-green-50 cursor-pointer">
                            <i class="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
                            <p class="text-sm text-gray-600 mb-3">ファイルをドラッグ&ドロップ</p>
                            <input type="file" id="fileInput" class="hidden" multiple>
                            <input type="hidden" id="selectedDocumentType" value="">
                            <button onclick="document.getElementById('fileInput').click()" 
                                    class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                                <i class="fas fa-folder-open mr-1"></i>ファイルを選択
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-3 text-center">
                            対応形式: PDF, Word, Excel, 画像ファイル
                        </p>
                    </div>
                </div>
            </div>

            <!-- 共通書類アップロードモーダル -->
            <div id="commonDocUploadModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white rounded-xl w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
                    <div class="flex items-center justify-between p-4 border-b bg-blue-600 text-white rounded-t-xl sticky top-0">
                        <h3 id="commonDocModalTitle" class="font-bold text-sm">
                            <i class="fas fa-upload mr-2"></i>共通書類アップロード
                        </h3>
                        <button onclick="closeCommonDocUploadModal()" class="text-white hover:text-blue-200">
                            <i class="fas fa-times text-lg"></i>
                        </button>
                    </div>
                    <div class="p-4">
                        <!-- 既存の書類一覧 -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                <i class="fas fa-folder mr-1 text-blue-600"></i>アップロード済み
                            </label>
                            <div id="existingCommonDocsList" class="space-y-1">
                                <div class="text-xs text-gray-500 py-2">読み込み中...</div>
                            </div>
                        </div>
                        
                        <hr class="my-4">
                        
                        <!-- 複数期分対応の案内 -->
                        <div id="commonDocMultiVersionInfo" class="hidden mb-3 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                            <p class="text-xs text-purple-700">
                                <i class="fas fa-info-circle mr-1"></i>
                                <span id="commonDocMaxVersionText">この書類は最大3期分保存できます</span>
                            </p>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                <i class="fas fa-plus-circle mr-1 text-green-600"></i>新しくアップロード
                            </label>
                            <div class="mt-2">
                                <label class="block text-xs text-gray-600 mb-1">
                                    年度・決算期 <span id="commonDocFiscalYearRequired" class="hidden text-red-500">*</span>
                                </label>
                                <input type="text" id="commonDocFiscalYear" placeholder="例: 2024 または 第10期" 
                                       class="w-full px-3 py-2 border rounded-lg text-sm">
                                <p class="text-xs text-gray-500 mt-1">決算書・確定申告書は年度の入力を推奨</p>
                            </div>
                        </div>
                        <div id="commonDocDropZone" onclick="document.getElementById('commonDocFileInput').click()"
                             class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center transition-colors hover:border-blue-500 hover:bg-blue-50 cursor-pointer">
                            <div id="commonDocDropZoneDefault">
                                <i class="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-2"></i>
                                <p class="text-xs text-gray-600 mb-2">ファイルをドラッグ&ドロップ</p>
                                <input type="file" id="commonDocFileInput" class="hidden" onchange="onCommonDocFileSelected(this)">
                                <span class="inline-block bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-xs">
                                    <i class="fas fa-folder-open mr-1"></i>ファイルを選択
                                </span>
                            </div>
                            <div id="commonDocDropZoneSelected" class="hidden">
                                <i class="fas fa-check-circle text-2xl text-green-500 mb-2"></i>
                                <p class="text-sm font-medium text-green-700 mb-1">ファイル選択済み</p>
                                <p id="commonDocSelectedFileName" class="text-xs text-gray-600 truncate px-2"></p>
                                <button onclick="event.stopPropagation(); clearCommonDocFile()" 
                                        class="mt-2 text-xs text-red-500 hover:text-red-700">
                                    <i class="fas fa-times mr-1"></i>取り消し
                                </button>
                            </div>
                        </div>
                        <p id="commonDocFormatHint" class="text-xs text-gray-500 mt-2 text-center">
                            PDF, Word, Excel, 画像ファイル対応
                        </p>
                        <button onclick="uploadCommonDocument()" id="commonDocUploadBtn"
                                class="w-full mt-3 bg-gray-300 text-gray-500 py-2 rounded-lg text-sm font-medium cursor-not-allowed" disabled>
                            <i class="fas fa-upload mr-1"></i>ファイルを選択してください
                        </button>
                    </div>
                </div>
            </div>

            <!-- AIアシスタント フローティングボタン -->
            <div id="aiFloatingBtn" class="fixed bottom-20 right-4 z-40">
                <button onclick="openAiModal()" 
                        class="bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 flex items-center gap-2">
                    <i class="fas fa-robot text-lg"></i>
                    <span class="hidden sm:inline text-xs font-medium">AIに相談</span>
                </button>
            </div>

            <!-- AIアシスタント モーダル -->
            <div id="aiModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-end sm:items-center justify-center">
                <div class="bg-white w-full sm:w-[500px] sm:max-w-lg sm:rounded-lg sm:m-4 rounded-t-2xl max-h-[85vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b bg-purple-600 text-white sm:rounded-t-lg rounded-t-2xl">
                        <h3 class="font-bold"><i class="fas fa-robot mr-2"></i>AIアシスタント</h3>
                        <button onclick="closeAiModal()" class="text-white hover:text-purple-200">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div id="portalAiChat" class="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-[300px]">
                        <div class="text-center text-gray-500 py-8">
                            <i class="fas fa-robot text-4xl mb-3 text-purple-400"></i>
                            <p class="font-medium">補助金申請のお手伝いをします</p>
                            <p class="text-sm mt-2">質問への回答方法や、書類の書き方など<br>なんでもお気軽にご相談ください</p>
                        </div>
                    </div>
                    
                    <div class="p-4 border-t bg-white sm:rounded-b-lg">
                        <form id="portalAiChatForm" class="flex gap-2">
                            <input type="text" id="portalAiChatInput" 
                                   placeholder="質問を入力してください..." 
                                   class="flex-1 px-4 py-3 border rounded-lg text-base" required>
                            <button type="submit" 
                                    class="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- AI提案モーダル（質問個別） -->
            <div id="aiSuggestModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-lg rounded-lg max-h-[80vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b">
                        <h3 class="font-bold text-purple-600"><i class="fas fa-magic mr-2"></i>AI回答提案</h3>
                        <button onclick="closeAiSuggestModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-4 border-b bg-gray-50">
                        <div class="text-sm text-gray-600 mb-1">質問:</div>
                        <div id="suggestQuestionText" class="font-medium"></div>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto p-4">
                        <div id="suggestContent" class="text-center py-8 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                            <p>AIが回答を考えています...</p>
                        </div>
                    </div>
                    
                    <div id="suggestActions" class="p-4 border-t bg-gray-50 hidden">
                        <div class="flex gap-2">
                            <button onclick="applySuggestion()" class="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
                                <i class="fas fa-check mr-1"></i>この回答を使う
                            </button>
                            <button onclick="regenerateSuggestion()" class="px-4 py-2 border rounded-lg hover:bg-gray-100">
                                <i class="fas fa-redo"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- AI書類添削モーダル -->
            <div id="aiEditDocModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-4xl rounded-lg max-h-[90vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-magic text-xl"></i>
                            <div>
                                <h3 class="font-bold">AI書類添削</h3>
                                <p id="editDocTitle" class="text-sm text-white/80"></p>
                            </div>
                        </div>
                        <button onclick="closeAiEditDocModal()" class="text-white hover:text-white/80">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto p-4 bg-gray-50">
                        <div id="editDocLoading" class="text-center py-8">
                            <i class="fas fa-spinner fa-spin text-3xl text-purple-600 mb-3"></i>
                            <p class="text-gray-600">書類を読み込んでいます...</p>
                        </div>
                        
                        <div id="editDocContent" class="hidden space-y-4">
                            <!-- セクションごとの編集エリアが動的に生成される -->
                        </div>
                    </div>
                    
                    <div class="p-4 border-t bg-white rounded-b-lg">
                        <div class="flex items-center justify-between gap-4">
                            <div class="flex items-center gap-2 text-sm text-gray-500">
                                <i class="fas fa-lightbulb text-yellow-500"></i>
                                <span>セクションを選択して「AI添削」で改善提案を受けられます</span>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="closeAiEditDocModal()" class="px-4 py-2 border rounded-lg hover:bg-gray-100">
                                    キャンセル
                                </button>
                                <button onclick="saveEditedDocument()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    <i class="fas fa-save mr-1"></i>保存
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- テンプレート選択モーダル -->
            <div id="templateModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-lg rounded-lg max-h-[70vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b">
                        <h3 class="font-bold text-blue-600"><i class="fas fa-list-alt mr-2"></i>テンプレートから選択</h3>
                        <button onclick="closeTemplateModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-4 border-b bg-gray-50">
                        <div class="text-sm text-gray-600 mb-1">質問:</div>
                        <div id="templateQuestionText" class="font-medium"></div>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto p-4">
                        <div id="templateList" class="space-y-2"></div>
                    </div>
                </div>
            </div>
            
            <!-- 書類データ入力モーダル（登記簿/財務諸表/確定申告書） -->
            <div id="dataInputModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-end sm:items-center justify-center">
                <div class="bg-white w-full sm:w-[600px] sm:max-w-2xl sm:rounded-lg sm:m-4 rounded-t-2xl max-h-[90vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b bg-blue-600 text-white sm:rounded-t-lg rounded-t-2xl">
                        <h3 id="dataInputTitle" class="font-bold"><i class="fas fa-edit mr-2"></i>データ入力・確認</h3>
                        <button onclick="closeDataInputModal()" class="text-white hover:text-blue-200">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="p-4 bg-blue-50 border-b">
                        <div class="flex items-start gap-2">
                            <i class="fas fa-info-circle text-blue-600 mt-0.5"></i>
                            <div class="text-sm text-blue-800">
                                <p class="font-medium">アップロードした書類を基に、以下の情報を入力・確認してください。</p>
                                <p class="text-xs mt-1">この情報は補助金申請書の自動作成や財務指標の計算に使用されます。</p>
                            </div>
                        </div>
                    </div>
                    
                    <div id="dataInputContent" class="flex-1 overflow-y-auto p-4">
                        <!-- 動的にフォームが挿入される -->
                    </div>
                    
                    <div class="p-4 border-t bg-gray-50 flex gap-2">
                        <button onclick="closeDataInputModal()" class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100">
                            後で入力する
                        </button>
                        <button onclick="saveDataInput()" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            <i class="fas fa-save mr-1"></i>保存して確定
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- 財務指標表示モーダル -->
            <div id="financialIndicatorsModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-2xl rounded-lg max-h-[80vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-t-lg">
                        <h3 class="font-bold"><i class="fas fa-chart-line mr-2"></i>自動計算された財務指標</h3>
                        <button onclick="closeFinancialIndicatorsModal()" class="text-white hover:text-green-200">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div id="financialIndicatorsContent" class="flex-1 overflow-y-auto p-4">
                        <!-- 財務指標が表示される -->
                    </div>
                    
                    <div class="p-4 border-t">
                        <button onclick="closeFinancialIndicatorsModal()" class="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- 新規申込モーダル -->
            <div id="newApplicationModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-end sm:items-center justify-center">
                <div class="bg-white w-full sm:w-[500px] sm:max-w-lg sm:rounded-lg sm:m-4 rounded-t-2xl max-h-[90vh] flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b bg-green-600 text-white sm:rounded-t-lg rounded-t-2xl">
                        <h3 class="font-bold"><i class="fas fa-plus-circle mr-2"></i>新規申込</h3>
                        <button onclick="closeNewApplicationModal()" class="text-white hover:text-green-200">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto p-4">
                        <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                            <div class="flex items-start gap-2">
                                <i class="fas fa-info-circle text-blue-600 mt-0.5"></i>
                                <div class="text-sm text-blue-800">
                                    <p class="font-medium">新しい補助金・助成金をお申し込みいただけます</p>
                                    <p class="mt-1">ご希望の補助金を選択して、必要事項をご記入ください。</p>
                                </div>
                            </div>
                        </div>
                        
                        <form id="newApplicationForm" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-1">申請する補助金・助成金 *</label>
                                <select name="subsidy_type_id" id="applicationSubsidyType" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500">
                                    <option value="">選択してください</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-1">申込の目的・相談内容</label>
                                <textarea name="notes" rows="3" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500" placeholder="申請したい理由や、ご相談したい内容をご記入ください"></textarea>
                            </div>
                            
                            <div class="pt-2">
                                <label class="flex items-start gap-2">
                                    <input type="checkbox" name="privacy_agreed" required class="mt-1 rounded text-green-600">
                                    <span class="text-sm text-gray-600">
                                        <a href="/privacy-policy" target="_blank" class="text-green-600 underline">プライバシーポリシー</a>に同意します
                                    </span>
                                </label>
                            </div>
                        </form>
                    </div>
                    
                    <div class="p-4 border-t bg-gray-50 flex gap-2 sm:rounded-b-lg">
                        <button onclick="closeNewApplicationModal()" class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100">
                            キャンセル
                        </button>
                        <button onclick="submitNewApplication()" class="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                            <i class="fas fa-paper-plane mr-1"></i>申込む
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // ========================================
            // メインタブ切り替え関数
            // ========================================
            function switchMainTab(tabId) {
                // すべてのタブボタンとパネルを取得
                const tabButtons = ['mainTabHome', 'mainTabDocuments', 'mainTabCreate', 'mainTabHearing', 'mainTabMessages'];
                const tabPanels = ['tabPanelHome', 'tabPanelDocuments', 'tabPanelCreate', 'tabPanelHearing', 'tabPanelMessages'];
                
                // タブボタンのスタイルをリセット
                tabButtons.forEach(id => {
                    const btn = document.getElementById(id);
                    if (btn) btn.classList.remove('active');
                });
                
                // パネルを非表示
                tabPanels.forEach(id => {
                    const panel = document.getElementById(id);
                    if (panel) panel.classList.remove('active');
                });
                
                // 選択されたタブをアクティブに
                const activeBtn = document.getElementById('mainTab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
                const activePanel = document.getElementById('tabPanel' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
                
                if (activeBtn) activeBtn.classList.add('active');
                if (activePanel) activePanel.classList.add('active');
                
                // 書類作成タブの場合、資格ステータスを取得して表示切り替え
                if (tabId === 'create') {
                    loadDocumentCreationMode();
                }
                
                // やり取りタブの時はAIボタンを非表示にする
                const aiBtn = document.getElementById('aiFloatingBtn');
                if (aiBtn) {
                    aiBtn.style.display = (tabId === 'messages') ? 'none' : 'block';
                }
            }
            
            // 案件セレクターを更新
            async function updateCaseSelector() {
                try {
                    const res = await axios.get('/api/clients/' + CLIENT_ID + '/cases');
                    const cases = res.data || [];
                    const selector = document.getElementById('caseSelector');
                    if (selector && cases.length > 0) {
                        selector.innerHTML = cases.map(c => 
                            '<option value="' + c.access_token + '"' + (c.id === CASE_ID ? ' selected' : '') + '>' +
                            (c.subsidy_type_name || '案件 #' + c.id) +
                            '</option>'
                        ).join('');
                    }
                } catch (e) {
                    console.log('Failed to load cases for selector');
                }
            }
            
            // ========================================
            // 旧タブ切り替え関数（互換性のため維持）
            // ========================================
            function switchPortalTab(tab) {
                const tabDocs = document.getElementById('tabDocuments');
                const tabComms = document.getElementById('tabCommunications');
                const panelDocs = document.getElementById('panelDocuments');
                const panelComms = document.getElementById('panelCommunications');
                
                if (tab === 'documents') {
                    tabDocs.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-green-600 text-green-600';
                    tabComms.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700';
                    panelDocs.classList.remove('hidden');
                    panelComms.classList.add('hidden');
                } else {
                    tabDocs.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700';
                    tabComms.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-green-600 text-green-600';
                    panelDocs.classList.add('hidden');
                    panelComms.classList.remove('hidden');
                }
            }
            
            // セクションへスクロール
            function scrollToSection(sectionId) {
                const section = document.getElementById(sectionId);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return false;
            }
            
            // AIレスポンスを読みやすく整形する関数
            function formatAIResponse(text) {
                if (!text) return '';
                var result = text;
                // 太字 **text** を除去
                result = result.split('**').join('');
                // 見出し # を除去
                result = result.replace(/^#+\\s*/gm, '');
                // 箇条書きを日本語の・に変換
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
            
            const CLIENT_ID = ${caseData ? caseData.client_id : client.id};
            const CASE_ID = ${caseId || 'null'};
            const STATUS_INFO = {
                inquiry: { icon: '🔍', text: '見込み', desc: 'まずはお話を聞かせてください' },
                preparing: { icon: '📝', text: '書類準備中', desc: '必要書類をアップロードしてください' },
                applying: { icon: '📤', text: '申請中', desc: '申請手続きを進めています' },
                completed: { icon: '✅', text: '完了', desc: 'お疲れ様でした！' }
            };
            
            // 見込みステータスかどうかを保持
            let isInquiryStatus = false;
            let currentStatus = 'inquiry';

            async function loadStatus() {
                // 案件データからステータスを取得（優先）
                let status = 'inquiry';
                let contractUrl = null;
                
                if (CASE_ID) {
                    try {
                        const caseRes = await axios.get(\`/api/cases/\${CASE_ID}\`);
                        status = caseRes.data.status || 'inquiry';
                        contractUrl = caseRes.data.contract_url;
                    } catch (e) {
                        console.log('Case data not found, falling back to client');
                    }
                }
                
                // フォールバック: クライアントデータから
                if (!CASE_ID || status === 'inquiry') {
                    try {
                        const response = await axios.get(\`/api/clients/\${CLIENT_ID}\`);
                        const client = response.data;
                        if (!CASE_ID) {
                            status = client.status || 'inquiry';
                        }
                        contractUrl = contractUrl || client.contract_url;
                    } catch (e) {}
                }
                
                currentStatus = status;
                isInquiryStatus = (status === 'inquiry');
                
                const info = STATUS_INFO[status] || STATUS_INFO['inquiry'];
                
                document.getElementById('statusIcon').textContent = info.icon;
                document.getElementById('statusText').textContent = info.text;
                document.getElementById('statusDescription').textContent = info.desc;
                
                // 電子契約URLがあれば表示
                if (contractUrl) {
                    const contractSection = document.getElementById('contractSection');
                    const contractLink = document.getElementById('contractLink');
                    if (contractSection && contractLink) {
                        contractSection.classList.remove('hidden');
                        contractLink.href = contractUrl;
                    }
                }
                
                // 見込みステータス時の制限バナーを表示
                updateInquiryRestrictions();
            }
            
            // 見込みステータス時の制限表示を更新
            function updateInquiryRestrictions() {
                const restrictionBanner = document.getElementById('inquiryRestrictionBanner');
                const hearingSection = document.getElementById('hearingSection');
                const documentUploadArea = document.getElementById('documentUploadArea');
                
                if (isInquiryStatus) {
                    // 制限バナーを表示
                    if (restrictionBanner) {
                        restrictionBanner.classList.remove('hidden');
                    }
                    // ヒアリングセクションに制限を追加
                    if (hearingSection) {
                        const hearingContent = hearingSection.querySelector('#hearingQuestions');
                        if (hearingContent) {
                            hearingContent.innerHTML = \`
                                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                                    <i class="fas fa-lock text-yellow-500 text-2xl mb-2"></i>
                                    <p class="font-medium text-yellow-700">ヒアリング機能は案件開始後にご利用いただけます</p>
                                    <p class="text-sm text-yellow-600 mt-1">担当者からのご連絡をお待ちください</p>
                                </div>
                            \`;
                        }
                    }
                    // 書類アップロードエリアに制限を追加
                    if (documentUploadArea) {
                        documentUploadArea.innerHTML = \`
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                                <i class="fas fa-lock text-yellow-500 text-2xl mb-2"></i>
                                <p class="font-medium text-yellow-700">書類アップロードは案件開始後にご利用いただけます</p>
                                <p class="text-sm text-yellow-600 mt-1">担当者からのご連絡をお待ちください</p>
                            </div>
                        \`;
                    }
                } else {
                    if (restrictionBanner) {
                        restrictionBanner.classList.add('hidden');
                    }
                }
            }
            
            // 次にやるべきことを読み込む
            async function loadNextActions() {
                try {
                    const nextActions = [];
                    
                    // 1. 手付金未払いチェック（案件データから取得）
                    let depositInfo = {};
                    if (CASE_ID) {
                        const caseRes = await axios.get(\`/api/cases/\${CASE_ID}\`);
                        depositInfo = caseRes.data;
                    }
                    const clientRes = await axios.get(\`/api/clients/\${CLIENT_ID}\`);
                    const client = { ...clientRes.data, ...depositInfo };
                    
                    if (client.deposit_required && !client.deposit_paid && !client.deposit_transfer_reported) {
                        const depositAmount = client.deposit_amount || 0;
                        nextActions.push({
                            icon: 'fa-yen-sign',
                            text: '手付金のお支払い',
                            description: '¥' + depositAmount.toLocaleString() + ' のお支払いをお願いします',
                            action: "showBankTransferModal('¥" + depositAmount.toLocaleString() + "')",
                            priority: 1
                        });
                    }
                    
                    // 2. 未回答のヒアリング質問チェック
                    try {
                        if (client.subsidy_type_id) {
                            // 質問と回答を両方取得
                            const [questionsRes, answersRes] = await Promise.all([
                                axios.get(\`/api/hearing-questions/\${client.subsidy_type_id}\`),
                                axios.get(\`/api/clients/\${CLIENT_ID}/hearing-answers\`)
                            ]);
                            const questions = questionsRes.data;
                            const answers = answersRes.data;
                            
                            // 回答済み質問IDのセット
                            const answeredIds = new Set(answers.map(a => a.question_id));
                            
                            // 必須かつ未回答の質問をカウント
                            const requiredUnanswered = questions.filter(q => 
                                q.is_required && !answeredIds.has(q.id)
                            ).length;
                            
                            if (requiredUnanswered > 0) {
                                nextActions.push({
                                    icon: 'fa-clipboard-list',
                                    text: 'ヒアリング質問への回答',
                                    description: '必須質問があと ' + requiredUnanswered + ' 問残っています',
                                    action: "scrollToSection('hearingSection')",
                                    priority: 2
                                });
                            }
                        }
                    } catch (e) { console.log('No hearing questions', e); }
                    
                    // 3. 顧客対応タスクチェック
                    try {
                        const pipelinesRes = await axios.get(\`/api/clients/\${CLIENT_ID}/pipelines\`);
                        const pipelines = pipelinesRes.data;
                        if (pipelines.length > 0) {
                            const activePipeline = pipelines.find(p => p.status === 'active') || pipelines[0];
                            const tasksRes = await axios.get(\`/api/pipelines/\${activePipeline.id}/tasks\`);
                            const customerTasks = tasksRes.data.filter(t => 
                                (t.task_type === 'external' || t.task_type === 'both') && 
                                (t.status === 'pending' || t.status === 'in_progress')
                            );
                            customerTasks.forEach(task => {
                                nextActions.push({
                                    icon: 'fa-tasks',
                                    text: task.task_name,
                                    description: task.end_date ? '期限: ' + task.end_date : '対応をお願いします',
                                    action: "scrollToSection('statusSection')",
                                    priority: 3
                                });
                            });
                        }
                    } catch (e) { console.log('No pipeline tasks'); }
                    
                    // 4. 未アップロード書類チェック（共通書類も含む）
                    try {
                        // チェックリストとアップロード済み書類を取得（案件ベースで取得）
                        const checklistUrl = CASE_ID ? \`/api/cases/\${CASE_ID}/document-checklist\` : \`/api/clients/\${CLIENT_ID}/document-checklist\`;
                        const [checklistRes, uploadedRes, commonDocsRes] = await Promise.all([
                            axios.get(checklistUrl),
                            axios.get(\`/api/clients/\${CLIENT_ID}/documents\`),
                            axios.get(\`/api/clients/\${CLIENT_ID}/common-documents\`)
                        ]);
                        const checklist = checklistRes.data;
                        const uploaded = uploadedRes.data;
                        const commonDocs = commonDocsRes.data || [];
                        
                        // アップロード済みの書類タイプを取得（document_typeで照合）
                        const uploadedTypes = new Set(uploaded.map(d => d.document_type));
                        // 共通書類のタイプも含める
                        commonDocs.forEach(d => uploadedTypes.add(d.document_type));
                        
                        // 未提出の書類をカウント（document_typeフィールドで照合）
                        const missingDocs = checklist.filter(item => 
                            !uploadedTypes.has(item.document_type) && !uploadedTypes.has(item.document_name)
                        ).length;
                        
                        if (missingDocs > 0) {
                            nextActions.push({
                                icon: 'fa-upload',
                                text: '書類のアップロード',
                                description: '未提出の書類が ' + missingDocs + ' 件あります',
                                action: "switchPortalTab('documents'); scrollToSection('documentSection')",
                                priority: 4
                            });
                        }
                    } catch (e) { console.log('No document requirements', e); }
                    
                    // 表示
                    const section = document.getElementById('nextActionsSection');
                    const listContainer = document.getElementById('nextActionsList');
                    
                    if (nextActions.length === 0) {
                        section.classList.add('hidden');
                        return;
                    }
                    
                    section.classList.remove('hidden');
                    nextActions.sort((a, b) => a.priority - b.priority);
                    
                    listContainer.innerHTML = nextActions.slice(0, 3).map((action, index) => \`
                        <div class="flex items-center gap-3 p-3 bg-white/10 rounded-lg cursor-pointer hover:bg-white/20 transition"
                             onclick="\${action.action}">
                            <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">
                                <i class="fas \${action.icon}"></i>
                            </div>
                            <div class="flex-1">
                                <div class="font-medium">\${action.text}</div>
                                <div class="text-xs opacity-80">\${action.description}</div>
                            </div>
                            <i class="fas fa-chevron-right opacity-60"></i>
                        </div>
                    \`).join('');
                    
                    if (nextActions.length > 3) {
                        listContainer.innerHTML += \`
                            <div class="text-center text-xs opacity-70 mt-2">
                                他 \${nextActions.length - 3} 件のアクションがあります
                            </div>
                        \`;
                    }
                } catch (error) {
                    console.error('Error loading next actions:', error);
                }
            }
            
            // お知らせを読み込む
            async function loadAnnouncements() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/announcements\`);
                    const announcements = response.data;
                    
                    if (announcements.length === 0) {
                        document.getElementById('announcementBanner').classList.add('hidden');
                        return;
                    }
                    
                    const container = document.getElementById('announcementBanner');
                    container.classList.remove('hidden');
                    
                    const typeStyles = {
                        info: { bg: 'bg-blue-50 border-blue-200', icon: 'fa-info-circle text-blue-600', text: 'text-blue-800' },
                        warning: { bg: 'bg-yellow-50 border-yellow-200', icon: 'fa-exclamation-triangle text-yellow-600', text: 'text-yellow-800' },
                        urgent: { bg: 'bg-red-50 border-red-200', icon: 'fa-exclamation-circle text-red-600', text: 'text-red-800' },
                        maintenance: { bg: 'bg-gray-50 border-gray-200', icon: 'fa-tools text-gray-600', text: 'text-gray-800' }
                    };
                    
                    container.innerHTML = announcements.map(a => {
                        const style = typeStyles[a.type] || typeStyles.info;
                        return \`
                            <div class="rounded-lg border p-3 mb-2 \${style.bg} \${a.is_read ? 'opacity-70' : ''}">
                                <div class="flex items-start gap-3">
                                    <i class="fas \${style.icon} mt-0.5"></i>
                                    <div class="flex-1">
                                        <div class="font-medium \${style.text}">\${a.title}</div>
                                        <div class="text-sm \${style.text} mt-1">\${a.content}</div>
                                    </div>
                                    \${!a.is_read ? \`
                                        <button onclick="markAnnouncementRead(\${a.id})" class="text-xs text-gray-500 hover:text-gray-700">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    \` : ''}
                                </div>
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading announcements:', error);
                }
            }
            
            async function markAnnouncementRead(announcementId) {
                try {
                    await axios.post(\`/api/announcements/\${announcementId}/read\`, {
                        client_id: CLIENT_ID
                    });
                    loadAnnouncements();
                } catch (error) {
                    console.error('Error marking announcement read:', error);
                }
            }
            
            // パイプライン進捗を読み込む
            async function loadPipelineProgress() {
                try {
                    // CASE_IDがある場合は案件別パイプラインを取得
                    let url = \`/api/clients/\${CLIENT_ID}/pipelines\`;
                    if (CASE_ID) {
                        url += \`?case_id=\${CASE_ID}\`;
                    }
                    const response = await axios.get(url);
                    let pipelines = response.data;
                    
                    // CASE_IDがある場合は、そのケースのパイプラインのみをフィルタリング
                    if (CASE_ID) {
                        pipelines = pipelines.filter(p => p.case_id === CASE_ID);
                    }
                    
                    if (pipelines.length === 0) {
                        document.getElementById('pipelineProgressSection').classList.add('hidden');
                        return;
                    }
                    
                    // アクティブなパイプラインを取得（最新のもの）
                    const activePipeline = pipelines.find(p => p.status === 'active') || pipelines[0];
                    
                    const section = document.getElementById('pipelineProgressSection');
                    section.classList.remove('hidden');
                    
                    // 進捗率を更新
                    const progress = activePipeline.progress_percentage || 0;
                    document.getElementById('pipelineProgressText').textContent = progress + '%';
                    document.getElementById('pipelineProgressBar').style.width = progress + '%';
                    
                    // タスク一覧を取得
                    const tasksResponse = await axios.get(\`/api/pipelines/\${activePipeline.id}/tasks\`);
                    const tasks = tasksResponse.data;
                    
                    const tasksContainer = document.getElementById('pipelineTasksList');
                    
                    if (tasks.length === 0) {
                        tasksContainer.innerHTML = '<div class="text-gray-500 text-center py-2">タスクがありません</div>';
                        return;
                    }
                    
                    const statusStyles = {
                        pending: { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'fa-circle' },
                        in_progress: { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'fa-spinner fa-spin' },
                        completed: { bg: 'bg-green-100', text: 'text-green-600', icon: 'fa-check' },
                        skipped: { bg: 'bg-gray-100', text: 'text-gray-400', icon: 'fa-minus' }
                    };
                    
                    const taskTypeLabels = {
                        internal: '自社対応',
                        external: '顧客対応',
                        both: '共同'
                    };
                    
                    // STEP形式で表示（参考画像③）
                    tasksContainer.innerHTML = tasks.map((task, index) => {
                        const style = statusStyles[task.status] || statusStyles.pending;
                        const isCustomerTask = task.task_type === 'external' || task.task_type === 'both';
                        const stepNum = index + 1;
                        const isCompleted = task.status === 'completed';
                        const canComplete = isCustomerTask && (task.status === 'pending' || task.status === 'in_progress');
                        
                        return \`
                            <div class="border rounded-lg p-3 \${isCompleted ? 'bg-green-50 border-green-200' : (isCustomerTask ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200')}">
                                <div class="flex items-start gap-3">
                                    <div class="flex-shrink-0">
                                        <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm \${isCompleted ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}">
                                            \${isCompleted ? '<i class="fas fa-check"></i>' : stepNum}
                                        </div>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="font-medium text-sm \${style.text}">\${task.task_name}</span>
                                            \${isCustomerTask ? '<span class="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">顧客</span>' : ''}
                                            \${isCompleted ? '<span class="text-xs px-1.5 py-0.5 bg-green-100 text-green-600 rounded">完了</span>' : ''}
                                        </div>
                                        <div class="text-xs text-gray-500">
                                            \${task.description || ''}
                                            \${task.end_date ? '<span class="ml-1">期限: ' + task.end_date + '</span>' : ''}
                                        </div>
                                    </div>
                                    \${canComplete ? \`
                                        <button onclick="completeTask(\${task.id})" 
                                                class="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">
                                            <i class="fas fa-check mr-1"></i>完了
                                        </button>
                                    \` : ''}
                                </div>
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading pipeline progress:', error);
                }
            }
            
            // タスク完了（顧客用）
            async function completeTask(taskId) {
                if (!confirm('このタスクを完了にしますか？')) {
                    return;
                }
                
                try {
                    const response = await axios.post(\`/api/portal/tasks/\${taskId}/complete\`, {
                        client_id: CLIENT_ID
                    });
                    
                    if (response.data.success) {
                        showMessage('タスクを完了しました！', 'success');
                        // 画面を更新
                        loadPipelineProgress();
                        loadServiceProgress();
                        loadNextActions();
                    }
                } catch (error) {
                    console.error('Error completing task:', error);
                    alert('タスクの完了に失敗しました: ' + (error.response?.data?.error || error.message));
                }
            }
            
            // メッセージ表示
            function showMessage(message, type = 'info') {
                const toast = document.createElement('div');
                toast.className = \`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white \${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}\`;
                toast.innerHTML = \`<i class="fas \${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-2"></i>\${message}\`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }
            
            // サービス進捗状況を読み込む（案件ごとに表示・横型バー表示・要件15）
            async function loadServiceProgress() {
                try {
                    // 案件一覧を取得
                    const casesResponse = await axios.get(\`/api/clients/\${CLIENT_ID}/cases\`);
                    const cases = casesResponse.data || [];
                    
                    // パイプライン一覧を取得
                    const pipelinesResponse = await axios.get(\`/api/clients/\${CLIENT_ID}/pipelines\`);
                    const allPipelines = pipelinesResponse.data || [];
                    
                    const section = document.getElementById('serviceProgressSection');
                    const listContainer = document.getElementById('serviceProgressList');
                    
                    if (allPipelines.length === 0) {
                        section.classList.add('hidden');
                        return;
                    }
                    
                    section.classList.remove('hidden');
                    
                    // 案件ごとのパイプラインをグループ化
                    const caseProgressMap = new Map();
                    
                    // 案件IDごとにパイプラインを整理
                    for (const pipeline of allPipelines) {
                        const caseId = pipeline.case_id;
                        if (!caseProgressMap.has(caseId)) {
                            const caseData = cases.find(c => c.id === caseId) || { id: caseId, subsidy_type_name: '案件' };
                            caseProgressMap.set(caseId, {
                                caseData,
                                pipelines: []
                            });
                        }
                        caseProgressMap.get(caseId).pipelines.push(pipeline);
                    }
                    
                    // 各案件のサービス進捗を表示
                    let html = '';
                    
                    for (const [caseId, caseInfo] of caseProgressMap) {
                        const { caseData, pipelines } = caseInfo;
                        const activePipeline = pipelines.find(p => p.status === 'active') || pipelines[0];
                        
                        if (!activePipeline) continue;
                        
                        // タスク一覧を取得
                        const tasksResponse = await axios.get(\`/api/pipelines/\${activePipeline.id}/tasks\`);
                        const tasks = tasksResponse.data || [];
                        
                        if (tasks.length === 0) continue;
                        
                        // 案件名（補助金名）
                        const caseName = caseData.subsidy_type_name || activePipeline.subsidy_name || activePipeline.template_name || '案件';
                        const caseNumber = caseData.case_number || '';
                        const progress = activePipeline.progress_percentage || 0;
                        const expectedDate = activePipeline.expected_completion_date 
                            ? new Date(activePipeline.expected_completion_date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short' })
                            : '';
                        const isCurrentCase = caseId === CASE_ID;
                        
                        html += \`
                            <div class="border rounded-lg p-4 \${isCurrentCase ? 'bg-green-50 border-green-300' : 'bg-white'}">
                                <div class="flex items-center justify-between mb-3">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h3 class="font-bold \${isCurrentCase ? 'text-green-800' : 'text-gray-800'}">\${caseName}</h3>
                                            \${isCurrentCase ? '<span class="text-xs px-1.5 py-0.5 bg-green-600 text-white rounded">現在表示中</span>' : ''}
                                        </div>
                                        <div class="text-xs text-gray-500 mt-0.5">
                                            \${caseNumber ? \`案件番号: \${caseNumber}\` : ''}
                                            \${expectedDate ? \` | 予定日: \${expectedDate}\` : ''}
                                        </div>
                                    </div>
                                    <span class="text-sm font-bold \${progress >= 100 ? 'text-green-600' : 'text-blue-600'}">
                                        \${progress}%
                                    </span>
                                </div>
                                
                                <!-- 横型進捗バー（ステップ表示） -->
                                <div class="relative">
                                    <!-- 背景バー -->
                                    <div class="absolute top-4 left-0 right-0 h-1 bg-gray-200 rounded"></div>
                                    <!-- 進捗バー -->
                                    <div class="absolute top-4 left-0 h-1 bg-orange-500 rounded transition-all" style="width: \${progress}%"></div>
                                    
                                    <!-- ステップポイント -->
                                    <div class="relative flex justify-between">
                                        \${tasks.map((task, index) => {
                                            const isCompleted = task.status === 'completed';
                                            const isInProgress = task.status === 'in_progress';
                                            
                                            return \`
                                                <div class="flex flex-col items-center" style="width: \${100 / tasks.length}%;">
                                                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10
                                                        \${isCompleted ? 'bg-orange-500 text-white' : isInProgress ? 'bg-orange-300 text-white' : 'bg-gray-300 text-gray-600'}">
                                                        \${isCompleted ? '<i class="fas fa-check"></i>' : (index + 1)}
                                                    </div>
                                                    <div class="text-xs text-center mt-1 \${isCompleted ? 'text-orange-600 font-medium' : 'text-gray-500'}" style="max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                                        \${task.task_name.length > 8 ? task.task_name.substring(0, 8) + '...' : task.task_name}
                                                    </div>
                                                </div>
                                            \`;
                                        }).join('')}
                                    </div>
                                </div>
                                
                                <!-- 案件切り替えボタン（現在表示中以外） -->
                                \${!isCurrentCase ? \`
                                    <div class="mt-3 pt-3 border-t">
                                        <button onclick="switchCase(\${caseId}, '\${caseData.access_token || ''}')" 
                                                class="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                                            <i class="fas fa-arrow-right mr-1"></i>この案件に切り替える
                                        </button>
                                    </div>
                                \` : ''}
                            </div>
                        \`;
                    }
                    
                    listContainer.innerHTML = html || '<div class="text-gray-500 text-center py-4">サービス進捗情報がありません</div>';
                    
                } catch (error) {
                    console.error('Error loading service progress:', error);
                }
            }
            
            // 請求書一覧を読み込む（顧客ポータル）
            async function loadPortalInvoices() {
                try {
                    const content = document.getElementById('portalInvoicesContent');
                    const contractSection = document.getElementById('contractSection');
                    const contractContent = document.getElementById('portalContractContent');
                    
                    if (!content) return;
                    
                    // 案件がある場合は請求書を取得
                    if (CASE_ID) {
                        const response = await axios.get(\`/api/cases/\${CASE_ID}/invoices\`);
                        const invoices = response.data;
                        
                        // 契約情報も取得
                        const caseResponse = await axios.get(\`/api/cases/\${CASE_ID}\`);
                        const caseData = caseResponse.data;
                        
                        // 契約URLがある場合は契約セクションを表示
                        if (caseData.contract_url && contractSection && contractContent) {
                            contractSection.classList.remove('hidden');
                            contractContent.innerHTML = \`
                                <a href="\${caseData.contract_url}" target="_blank" class="flex items-center gap-3 p-3 bg-blue-50 rounded-lg text-blue-700 hover:bg-blue-100">
                                    <i class="fas fa-file-signature text-lg"></i>
                                    <div class="flex-1">
                                        <div class="text-sm font-medium">契約書を確認する</div>
                                        <div class="text-xs text-blue-500">新しいタブで開きます</div>
                                    </div>
                                    <i class="fas fa-external-link-alt"></i>
                                </a>
                            \`;
                        }
                        
                        // 発行済みの請求書のみ表示（下書きは除外）
                        const issuedInvoices = invoices.filter(inv => inv.status !== 'draft' && inv.status !== 'cancelled');
                        
                        if (issuedInvoices.length === 0) {
                            content.innerHTML = \`
                                <div class="text-center py-6 text-gray-500">
                                    <i class="fas fa-file-invoice text-3xl mb-2 opacity-50"></i>
                                    <div class="text-sm">請求書はまだありません</div>
                                </div>
                            \`;
                            return;
                        }
                        
                        const statusLabels = {
                            issued: { label: '発行済み', color: 'bg-blue-100 text-blue-700', icon: 'fa-paper-plane' },
                            sent: { label: '送付済み', color: 'bg-yellow-100 text-yellow-700', icon: 'fa-envelope' },
                            paid: { label: '入金済み', color: 'bg-green-100 text-green-700', icon: 'fa-check-circle' },
                            payment_reported: { label: '振込報告済み', color: 'bg-purple-100 text-purple-700', icon: 'fa-hourglass-half' }
                        };
                        const typeLabels = {
                            deposit: { label: '着手金', icon: 'fa-hand-holding-usd', color: 'text-yellow-600' },
                            success_fee: { label: '成功報酬', icon: 'fa-trophy', color: 'text-purple-600' },
                            other: { label: 'その他', icon: 'fa-file-invoice', color: 'text-gray-600' }
                        };
                        
                        // 件数バッジを更新
                        const badge = document.getElementById('invoiceCountBadge');
                        if (badge) {
                            const unpaidCount = issuedInvoices.filter(inv => inv.status === 'issued' || inv.status === 'sent').length;
                            badge.textContent = unpaidCount > 0 ? \`未払い \${unpaidCount}件\` : \`\${issuedInvoices.length}件\`;
                            badge.className = unpaidCount > 0 
                                ? 'text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full'
                                : 'text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full';
                            badge.classList.remove('hidden');
                        }
                        
                        content.innerHTML = issuedInvoices.map((inv, index) => {
                            const status = statusLabels[inv.status] || statusLabels.issued;
                            const type = typeLabels[inv.invoice_type] || typeLabels.other;
                            const needsPayment = inv.status === 'issued' || inv.status === 'sent';
                            const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && needsPayment;
                            
                            return \`
                                <div class="border rounded-lg p-2 \${needsPayment ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'} \${isOverdue ? 'border-red-400 bg-red-50' : ''} cursor-pointer hover:shadow-md transition-shadow"
                                     onclick="showInvoiceDetailModal(\${inv.id})">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <span class="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 text-xs font-bold">\${index + 1}</span>
                                            <div>
                                                <div class="flex items-center gap-1">
                                                    <i class="fas \${type.icon} \${type.color} text-xs"></i>
                                                    <span class="font-medium text-xs">\${inv.item_name || type.label}</span>
                                                </div>
                                                <div class="text-xs text-gray-500">\${inv.invoice_number}</div>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="font-bold text-sm">¥\${inv.total_amount.toLocaleString()}</div>
                                            <span class="text-xs px-1.5 py-0.5 rounded \${status.color}">
                                                <i class="fas \${status.icon} mr-0.5"></i>\${status.label}
                                            </span>
                                        </div>
                                    </div>
                                    \${isOverdue ? '<div class="text-xs text-red-600 mt-1"><i class="fas fa-exclamation-triangle mr-1"></i>期限超過</div>' : ''}
                                    \${needsPayment && !isOverdue ? '<div class="text-xs text-yellow-700 mt-1">期限: ' + (inv.due_date ? new Date(inv.due_date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-') + '</div>' : ''}
                                </div>
                            \`;
                        }).join('');
                    } else {
                        content.innerHTML = \`
                            <div class="text-center py-6 text-gray-500">
                                <i class="fas fa-file-invoice text-3xl mb-2 opacity-50"></i>
                                <div class="text-sm">請求書はまだありません</div>
                            </div>
                        \`;
                    }
                } catch (error) {
                    console.error('Error loading portal invoices:', error);
                    document.getElementById('portalInvoicesContent').innerHTML = \`
                        <div class="text-center py-4 text-red-500">
                            <i class="fas fa-exclamation-circle"></i>
                            <div class="text-sm">読み込みに失敗しました</div>
                        </div>
                    \`;
                }
            }
            
            // 請求書の振込先を表示
            async function showInvoiceBankTransfer(invoiceId) {
                try {
                    const invoiceResponse = await axios.get(\`/api/invoices/\${invoiceId}\`);
                    const invoice = invoiceResponse.data;
                    
                    // 組織の振込先情報を取得（案件から組織情報を取得）
                    const bankInfo = await getBankInfo();
                    
                    const modal = document.createElement('div');
                    modal.id = 'bankTransferModal';
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
                    modal.innerHTML = \`
                        <div class="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                            <div class="p-6 border-b">
                                <div class="flex items-center justify-between">
                                    <h3 class="text-lg font-bold">振込先情報</h3>
                                    <button onclick="document.getElementById('bankTransferModal').remove()" class="text-gray-500 hover:text-gray-700">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="p-6">
                                <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                    <div class="text-sm font-medium text-green-800 mb-3">
                                        <i class="fas fa-university mr-2"></i>振込先口座
                                    </div>
                                    <div class="space-y-2 text-sm">
                                        <div class="flex justify-between">
                                            <span class="text-gray-600">金融機関</span>
                                            <span class="font-medium">\${bankInfo.bank_name || '未設定'}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600">支店</span>
                                            <span class="font-medium">\${bankInfo.bank_branch || '未設定'}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600">口座種別</span>
                                            <span class="font-medium">\${bankInfo.bank_account_type || '普通'}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600">口座番号</span>
                                            <span class="font-medium">\${bankInfo.bank_account_number || '未設定'}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600">口座名義</span>
                                            <span class="font-medium">\${bankInfo.bank_account_holder || '未設定'}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                    <div class="text-sm font-medium text-yellow-800 mb-2">
                                        <i class="fas fa-yen-sign mr-2"></i>お振込金額
                                    </div>
                                    <div class="text-2xl font-bold text-yellow-900">
                                        ¥\${invoice.total_amount.toLocaleString()}
                                    </div>
                                    <div class="text-xs text-yellow-700 mt-1">
                                        請求書番号: \${invoice.invoice_number}
                                    </div>
                                </div>
                                
                                <div class="text-sm text-gray-500">
                                    <p><i class="fas fa-info-circle mr-1"></i>お振込時は、振込人名にお名前をご入力ください。</p>
                                    <p class="mt-2">振込完了後は「振込完了を報告する」ボタンからご報告ください。</p>
                                </div>
                            </div>
                            <div class="p-6 border-t bg-gray-50">
                                <button onclick="document.getElementById('bankTransferModal').remove()" 
                                        class="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
                                    閉じる
                                </button>
                            </div>
                        </div>
                    \`;
                    document.body.appendChild(modal);
                } catch (error) {
                    alert('振込先情報の取得に失敗しました');
                }
            }
            window.showInvoiceBankTransfer = showInvoiceBankTransfer;
            
            // 請求書詳細モーダルを表示
            async function showInvoiceDetailModal(invoiceId) {
                try {
                    const invoiceResponse = await axios.get(\`/api/invoices/\${invoiceId}\`);
                    const inv = invoiceResponse.data;
                    
                    const typeLabels = {
                        deposit: '着手金',
                        success_fee: '成功報酬',
                        other: 'その他'
                    };
                    
                    const modal = document.createElement('div');
                    modal.id = 'invoiceDetailModal';
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
                    modal.innerHTML = \`
                        <div class="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div class="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <div class="text-sm opacity-80">請求書</div>
                                        <h3 class="text-xl font-bold">\${inv.invoice_number}</h3>
                                    </div>
                                    <button onclick="document.getElementById('invoiceDetailModal').remove()" class="text-white hover:text-gray-200">
                                        <i class="fas fa-times text-xl"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="p-6">
                                <!-- 発行元・請求先情報 -->
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <!-- 発行元（SaaS利用者） -->
                                    <div class="bg-blue-50 rounded-lg p-4">
                                        <div class="text-xs text-blue-600 font-medium mb-2">
                                            <i class="fas fa-building mr-1"></i>発行元
                                        </div>
                                        <div class="font-bold text-gray-900">\${inv.org_name || '事業者名'}</div>
                                        \${inv.org_representative ? \`<div class="text-sm text-gray-600">代表: \${inv.org_representative}</div>\` : ''}
                                        \${inv.org_address ? \`<div class="text-sm text-gray-600 mt-1">\${inv.org_address}</div>\` : ''}
                                        \${inv.org_phone ? \`<div class="text-sm text-gray-600">TEL: \${inv.org_phone}</div>\` : ''}
                                        \${inv.org_email ? \`<div class="text-sm text-gray-600">Email: \${inv.org_email}</div>\` : ''}
                                    </div>
                                    
                                    <!-- 請求先（エンド顧客） -->
                                    <div class="bg-gray-50 rounded-lg p-4">
                                        <div class="text-xs text-gray-600 font-medium mb-2">
                                            <i class="fas fa-user mr-1"></i>請求先
                                        </div>
                                        <div class="font-bold text-gray-900">\${inv.client_company || inv.client_name || 'お客様'} 御中</div>
                                        \${inv.client_name && inv.client_company ? \`<div class="text-sm text-gray-600">\${inv.client_name} 様</div>\` : ''}
                                        \${inv.client_email ? \`<div class="text-sm text-gray-600">Email: \${inv.client_email}</div>\` : ''}
                                    </div>
                                </div>
                                
                                <!-- 日付情報 -->
                                <div class="flex flex-wrap gap-4 mb-6 text-sm">
                                    <div class="bg-gray-100 px-4 py-2 rounded-lg">
                                        <span class="text-gray-500">発行日:</span>
                                        <span class="font-medium ml-1">\${inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}</span>
                                    </div>
                                    <div class="bg-yellow-100 px-4 py-2 rounded-lg">
                                        <span class="text-yellow-700">支払期限:</span>
                                        <span class="font-bold text-yellow-800 ml-1">\${inv.due_date ? new Date(inv.due_date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}</span>
                                    </div>
                                </div>
                                
                                <!-- 品目・金額 -->
                                <div class="border rounded-lg overflow-hidden mb-6">
                                    <table class="w-full text-sm">
                                        <thead class="bg-gray-100">
                                            <tr>
                                                <th class="text-left p-3">品目</th>
                                                <th class="text-right p-3 w-32">金額</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr class="border-t">
                                                <td class="p-3">
                                                    <div class="font-medium">\${inv.item_name}</div>
                                                    \${inv.item_description ? \`<div class="text-gray-500 text-xs mt-1">\${inv.item_description}</div>\` : ''}
                                                    <div class="text-xs text-gray-400 mt-1">種別: \${typeLabels[inv.invoice_type] || 'その他'}</div>
                                                </td>
                                                <td class="p-3 text-right">¥\${inv.subtotal.toLocaleString()}</td>
                                            </tr>
                                        </tbody>
                                        <tfoot class="bg-gray-50">
                                            <tr class="border-t">
                                                <td class="p-3 text-right text-gray-600">小計</td>
                                                <td class="p-3 text-right">¥\${inv.subtotal.toLocaleString()}</td>
                                            </tr>
                                            <tr class="border-t">
                                                <td class="p-3 text-right text-gray-600">消費税 (\${inv.tax_rate || 10}%)</td>
                                                <td class="p-3 text-right">¥\${(inv.tax_amount || 0).toLocaleString()}</td>
                                            </tr>
                                            \${inv.withholding_tax ? \`
                                                <tr class="border-t">
                                                    <td class="p-3 text-right text-orange-600">源泉徴収税 (10.21%)</td>
                                                    <td class="p-3 text-right text-orange-600">-¥\${inv.withholding_tax.toLocaleString()}</td>
                                                </tr>
                                            \` : ''}
                                            <tr class="border-t-2 border-gray-300">
                                                <td class="p-3 text-right font-bold text-lg">合計</td>
                                                <td class="p-3 text-right font-bold text-lg text-blue-600">¥\${inv.total_amount.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                
                                <!-- 振込先情報 -->
                                <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                    <div class="text-sm font-medium text-green-800 mb-3">
                                        <i class="fas fa-university mr-2"></i>振込先口座
                                    </div>
                                    <div class="grid grid-cols-2 gap-2 text-sm">
                                        <div class="text-gray-600">金融機関:</div>
                                        <div class="font-medium">\${inv.bank_name || '-'}</div>
                                        <div class="text-gray-600">支店:</div>
                                        <div class="font-medium">\${inv.bank_branch || '-'}</div>
                                        <div class="text-gray-600">口座種別:</div>
                                        <div class="font-medium">\${inv.bank_account_type || '普通'}</div>
                                        <div class="text-gray-600">口座番号:</div>
                                        <div class="font-medium">\${inv.bank_account_number || '-'}</div>
                                        <div class="text-gray-600">口座名義:</div>
                                        <div class="font-medium">\${inv.bank_account_holder || '-'}</div>
                                    </div>
                                </div>
                                
                                \${inv.notes ? \`
                                    <div class="bg-gray-50 rounded-lg p-4">
                                        <div class="text-xs text-gray-500 mb-1">備考</div>
                                        <div class="text-sm text-gray-700">\${inv.notes}</div>
                                    </div>
                                \` : ''}
                            </div>
                            
                            <div class="p-6 border-t bg-gray-50 flex gap-3">
                                <button onclick="downloadPortalInvoicePdf(\${inv.id})" 
                                        class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium">
                                    <i class="fas fa-file-pdf mr-2"></i>PDFダウンロード
                                </button>
                                <button onclick="document.getElementById('invoiceDetailModal').remove()" 
                                        class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
                                    閉じる
                                </button>
                            </div>
                        </div>
                    \`;
                    document.body.appendChild(modal);
                } catch (error) {
                    alert('請求書詳細の取得に失敗しました');
                }
            }
            window.showInvoiceDetailModal = showInvoiceDetailModal;
            
            // 請求書PDFダウンロード（顧客ポータル用）
            async function downloadPortalInvoicePdf(invoiceId) {
                try {
                    // 新しいウィンドウでPDFページを開く（印刷用）
                    window.open(\`/api/invoices/\${invoiceId}/pdf\`, '_blank');
                } catch (error) {
                    console.error('Error downloading PDF:', error);
                    alert('PDFのダウンロードに失敗しました');
                }
            }
            window.downloadPortalInvoicePdf = downloadPortalInvoicePdf;
            
            // 振込先情報を取得
            async function getBankInfo() {
                try {
                    // 案件から組織情報を取得
                    if (CASE_ID) {
                        const caseResponse = await axios.get(\`/api/cases/\${CASE_ID}\`);
                        const caseData = caseResponse.data;
                        if (caseData.organization_id) {
                            // 組織の設定から振込先情報を取得
                            const orgResponse = await axios.get(\`/api/public/organization/\${caseData.organization_id}\`);
                            return orgResponse.data || {};
                        }
                    }
                    // フォールバック: 公開設定から取得
                    const settingsResponse = await axios.get('/api/public/settings');
                    return settingsResponse.data || {};
                } catch (error) {
                    console.error('Error getting bank info:', error);
                    return {};
                }
            }
            
            // 振込完了を報告
            async function reportInvoicePayment(invoiceId) {
                if (!confirm('振込完了を報告しますか？')) return;
                
                try {
                    await axios.post(\`/api/invoices/\${invoiceId}/report-payment\`);
                    alert('振込報告を受け付けました。担当者の確認をお待ちください。');
                    loadPortalInvoices();
                } catch (error) {
                    alert('報告に失敗しました: ' + (error.response?.data?.error || error.message));
                }
            }
            window.reportInvoicePayment = reportInvoicePayment;
            
            // 銀行振込情報を取得
            let bankInfo = {};
            async function loadBankInfo() {
                try {
                    const response = await axios.get('/api/bank-info');
                    bankInfo = response.data;
                } catch (error) {
                    console.error('Error loading bank info:', error);
                }
            }
            loadBankInfo();
            
            // 支払いモーダル表示（銀行振込のみ対応）
            function showPaymentModal(method) {
                const amount = document.querySelector('#depositContent .font-bold')?.textContent || '¥0';
                // 銀行振込モーダルを表示
                showBankTransferModal(amount);
            }
            
            // 銀行振込モーダル
            let currentTransferAmount = 0; // モーダルで表示中の金額を保持
            function showBankTransferModal(amount) {
                // 金額文字列から数値を抽出（¥10,000 -> 10000）
                const numericAmount = parseInt(String(amount).replace(/[¥,]/g, '')) || 0;
                currentTransferAmount = numericAmount;
                
                const modal = document.createElement('div');
                modal.id = 'bankTransferModal';
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                modal.innerHTML = \`
                    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div class="p-4 border-b flex justify-between items-center">
                            <h3 class="text-lg font-bold">銀行振込でのお支払い</h3>
                            <button onclick="closeBankTransferModal()" class="text-gray-400 hover:text-gray-600">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="p-4 space-y-4">
                            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                                <h4 class="font-bold text-green-800 mb-3">
                                    <i class="fas fa-university mr-2"></i>振込先情報
                                </h4>
                                <table class="w-full text-sm">
                                    <tr>
                                        <td class="py-1 text-gray-600">銀行名</td>
                                        <td class="py-1 font-medium">\${bankInfo.bank_name || '（未設定）'}</td>
                                    </tr>
                                    <tr>
                                        <td class="py-1 text-gray-600">支店名</td>
                                        <td class="py-1 font-medium">\${bankInfo.bank_branch || '（未設定）'}</td>
                                    </tr>
                                    <tr>
                                        <td class="py-1 text-gray-600">口座種別</td>
                                        <td class="py-1 font-medium">\${bankInfo.bank_account_type || '普通'}</td>
                                    </tr>
                                    <tr>
                                        <td class="py-1 text-gray-600">口座番号</td>
                                        <td class="py-1 font-medium">\${bankInfo.bank_account_number || '（未設定）'}</td>
                                    </tr>
                                    <tr>
                                        <td class="py-1 text-gray-600">口座名義</td>
                                        <td class="py-1 font-medium">\${bankInfo.bank_account_holder || '（未設定）'}</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <div class="flex items-center gap-2 text-yellow-800">
                                    <i class="fas fa-yen-sign"></i>
                                    <span class="font-bold">お振込み金額: \${amount}</span>
                                </div>
                            </div>
                            
                            <div class="text-sm text-gray-600">
                                <p class="mb-2"><i class="fas fa-info-circle text-blue-500 mr-1"></i>お振込み後、下のボタンから完了報告をお願いします。</p>
                            </div>
                            
                            <button id="reportTransferBtn" onclick="reportBankTransfer()" class="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                                <i class="fas fa-check mr-2"></i>振込完了を報告する
                            </button>
                        </div>
                    </div>
                \`;
                document.body.appendChild(modal);
            }
            
            function closeBankTransferModal() {
                const modal = document.getElementById('bankTransferModal');
                if (modal) modal.remove();
            }
            
            // 振込完了報告
            async function reportBankTransfer() {
                if (!confirm('振込完了を報告しますか？\\n\\n※まだお振込みが完了していない場合は、振込完了後に報告してください。')) {
                    return;
                }
                
                // ボタンを無効化して二重送信防止
                const btn = document.getElementById('reportTransferBtn');
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>送信中...';
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                }
                
                let reportSuccess = false;
                
                try {
                    // モーダルで表示されていた金額を使用（クライアントDBから再取得ではなく）
                    const amount = currentTransferAmount || 0;
                    
                    await axios.post(\`/api/clients/\${CLIENT_ID}/report-transfer\`, {
                        payment_type: 'deposit',
                        amount: amount,
                        case_id: CASE_ID, // 案件IDも送信
                        notes: '顧客ポータルから報告'
                    });
                    
                    reportSuccess = true;
                } catch (error) {
                    console.error('Error reporting transfer:', error);
                    const errorMsg = error.response?.data?.error || error.response?.data?.details || error.message || '不明なエラー';
                    const statusCode = error.response?.status || 'N/A';
                    console.error('Error details:', { statusCode, errorMsg, fullError: error.response?.data });
                    alert(\`報告の送信に失敗しました。\\n\\nエラー: \${errorMsg}\\nステータス: \${statusCode}\\n\\nお手数ですが、担当者に直接ご連絡ください。\`);
                    
                    // エラー時はボタンを復活
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-check mr-2"></i>振込完了を報告する';
                        btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                    return;
                }
                
                // 報告成功後の処理
                if (reportSuccess) {
                    try { closeBankTransferModal(); } catch(e) { console.warn('closeBankTransferModal error:', e); }
                    
                    // 成功メッセージを表示
                    alert('振込完了報告を送信しました。\\n確認までしばらくお待ちください。');
                    
                    // ページをリロードしてUIを最新状態に更新
                    window.location.reload();
                }
            }

            async function loadChecklist() {
                // 見込みステータスの場合は制限メッセージを表示
                if (isInquiryStatus) {
                    document.getElementById('checklistItems').innerHTML = \`
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                            <i class="fas fa-lock text-yellow-500 text-xl mb-2"></i>
                            <p class="font-medium text-yellow-700 text-sm">書類アップロードは案件開始後に利用可能です</p>
                            <p class="text-xs text-yellow-600 mt-1">担当者からのご連絡をお待ちください</p>
                        </div>
                    \`;
                    return;
                }
                
                // 案件の助成金種別に基づくチェックリストを取得
                const checklistUrl = CASE_ID ? \`/api/cases/\${CASE_ID}/document-checklist\` : \`/api/clients/\${CLIENT_ID}/document-checklist\`;
                const [response, docsResponse, commonDocsResponse] = await Promise.all([
                    axios.get(checklistUrl),
                    axios.get(\`/api/clients/\${CLIENT_ID}/documents\`),
                    axios.get(\`/api/clients/\${CLIENT_ID}/common-documents\`)
                ]);
                const items = response.data;
                const uploadedDocs = docsResponse.data;
                const commonDocs = commonDocsResponse.data || [];
                
                // 案件別アップロード済み書類
                const uploadedTypes = new Set(uploadedDocs.map(d => d.document_type));
                
                // 共通書類の名前をマップ（同名の書類を紐づけ）
                const commonDocsByType = {};
                commonDocs.forEach(doc => {
                    if (!commonDocsByType[doc.document_type]) {
                        commonDocsByType[doc.document_type] = [];
                    }
                    commonDocsByType[doc.document_type].push(doc);
                });
                
                document.getElementById('checklistItems').innerHTML = items.map(item => {
                    const isUploaded = uploadedTypes.has(item.document_type);
                    // 共通書類から同名の書類を参照
                    const linkedCommonDocs = commonDocsByType[item.document_type] || [];
                    const hasCommonDoc = linkedCommonDocs.length > 0;
                    const isFulfilled = isUploaded || hasCommonDoc;
                    
                    // 共通書類で補完されている場合のバッジ
                    const commonBadge = hasCommonDoc && !isUploaded 
                        ? '<span class="ml-1 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600"><i class="fas fa-link mr-0.5"></i>共通書類</span>' 
                        : '';
                    
                    return \`
                        <div onclick="openUploadModal('\${item.document_type.replace(/'/g, "\\\\'")}', \${isFulfilled})" 
                             class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all \${isFulfilled ? (hasCommonDoc && !isUploaded ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200') : 'bg-gray-50 border border-gray-200 hover:bg-green-50 hover:border-green-300'}">
                            <div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center \${isFulfilled ? (hasCommonDoc && !isUploaded ? 'bg-blue-500' : 'bg-green-500') : 'bg-gray-300'}">
                                <i class="fas \${isFulfilled ? 'fa-check' : 'fa-plus'} text-white text-xs"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <span class="text-sm \${isFulfilled ? (hasCommonDoc && !isUploaded ? 'text-blue-700 font-medium' : 'text-green-700 font-medium') : 'text-gray-700'}">\${item.document_type}</span>
                                \${item.is_required ? '<span class="ml-1 text-xs text-red-500">*必須</span>' : ''}
                                \${commonBadge}
                            </div>
                            <i class="fas fa-chevron-right text-xs \${isFulfilled ? (hasCommonDoc && !isUploaded ? 'text-blue-400' : 'text-green-400') : 'text-gray-400'}"></i>
                        </div>
                    \`;
                }).join('');
            }
            
            function openUploadModal(documentType, isUploaded) {
                // 見込みステータスの場合はアップロードをブロック
                if (isInquiryStatus) {
                    showMessage('error', '書類アップロードは案件開始後にご利用いただけます');
                    return;
                }
                
                document.getElementById('selectedDocumentType').value = documentType;
                document.getElementById('uploadModalTitle').innerHTML = \`
                    <i class="fas fa-\${isUploaded ? 'sync-alt' : 'upload'} mr-2"></i>\${documentType}
                \`;
                document.getElementById('documentUploadModal').classList.remove('hidden');
            }
            
            function closeUploadModal() {
                document.getElementById('documentUploadModal').classList.add('hidden');
                document.getElementById('fileInput').value = '';
            }
            
            // 共通書類の読み込み
            async function loadCommonDocuments() {
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
                    
                    const container = document.getElementById('commonDocumentsList');
                    
                    if (documentTypes.length === 0) {
                        container.innerHTML = '<div class="text-xs text-gray-500 py-2">共通書類タイプが設定されていません</div>';
                        return;
                    }
                    
                    container.innerHTML = documentTypes.map(type => {
                        const docs = uploadedByType[type.name] || [];
                        const hasDoc = docs.length > 0;
                        const latestDoc = hasDoc ? docs[0] : null;
                        
                        // 有効期限チェック
                        let validityStatus = '';
                        if (latestDoc && type.validity_months) {
                            const uploadDate = new Date(latestDoc.uploaded_at);
                            const expiryDate = new Date(uploadDate);
                            expiryDate.setMonth(expiryDate.getMonth() + type.validity_months);
                            const now = new Date();
                            const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                            
                            if (daysUntilExpiry <= 0) {
                                validityStatus = '<span class="ml-1 text-xs text-red-500 font-medium">期限切れ</span>';
                            } else if (daysUntilExpiry <= 30) {
                                validityStatus = '<span class="ml-1 text-xs text-orange-500">残 ' + daysUntilExpiry + '日</span>';
                            }
                        }
                        
                        // 複数期分対応
                        const maxVer = type.max_versions || 1;
                        const canAddMore = !hasDoc || (maxVer > 1 && docs.length < maxVer);
                        const multiVersionBadge = maxVer > 1 ? \`<span class="ml-1 text-xs px-1 py-0.5 rounded bg-purple-100 text-purple-600">\${docs.length}/\${maxVer}期</span>\` : '';
                        
                        return \`
                            <div onclick="openCommonDocUploadModal('\${type.name.replace(/'/g, "\\\\'")}', \${type.id}, \${hasDoc}, \${maxVer})" 
                                 class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all \${hasDoc ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200 hover:bg-blue-50 hover:border-blue-300'}">
                                <div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center \${hasDoc && !canAddMore ? 'bg-blue-500' : hasDoc ? 'bg-blue-400' : 'bg-gray-300'}">
                                    <i class="fas \${hasDoc && !canAddMore ? 'fa-check' : hasDoc ? 'fa-plus' : 'fa-plus'} text-white text-xs"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <span class="text-sm \${hasDoc ? 'text-blue-700 font-medium' : 'text-gray-700'}">\${type.name}</span>
                                    \${multiVersionBadge}
                                    \${validityStatus}
                                    \${hasDoc ? '<span class="block text-xs text-gray-500 truncate">' + (latestDoc.fiscal_year ? latestDoc.fiscal_year + '期 - ' : '') + latestDoc.file_name + (docs.length > 1 ? ' 他' + (docs.length - 1) + '件' : '') + '</span>' : ''}
                                </div>
                                <i class="fas fa-chevron-right text-xs \${hasDoc ? 'text-blue-400' : 'text-gray-400'}"></i>
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading common documents:', error);
                    document.getElementById('commonDocumentsList').innerHTML = '<div class="text-xs text-red-500 py-2">共通書類の読み込みに失敗しました</div>';
                }
            }
            
            // 共通書類アップロードモーダルを開く
            let selectedCommonDocType = null;
            let selectedCommonDocTypeId = null;
            let selectedDocMaxVersions = 1;
            
            // 共通書類の既存ファイル一覧用
            let currentCommonDocs = [];
            
            async function openCommonDocUploadModal(typeName, typeId, hasDoc, maxVersions = 1) {
                selectedCommonDocType = typeName;
                selectedCommonDocTypeId = typeId;
                selectedDocMaxVersions = maxVersions || 1;
                
                document.getElementById('commonDocModalTitle').innerHTML = \`
                    <i class="fas fa-\${hasDoc ? 'folder-open' : 'upload'} mr-2"></i>\${typeName}
                \`;
                
                // 複数期分対応の場合は案内を表示
                const multiVersionInfo = document.getElementById('commonDocMultiVersionInfo');
                const maxVersionText = document.getElementById('commonDocMaxVersionText');
                const fiscalYearRequired = document.getElementById('commonDocFiscalYearRequired');
                
                if (selectedDocMaxVersions > 1) {
                    multiVersionInfo.classList.remove('hidden');
                    maxVersionText.textContent = \`この書類は最大\${selectedDocMaxVersions}期分保存できます。年度を入力すると管理しやすくなります。\`;
                    fiscalYearRequired.classList.remove('hidden');
                } else {
                    multiVersionInfo.classList.add('hidden');
                    fiscalYearRequired.classList.add('hidden');
                }
                
                // 既存の書類を取得して表示
                await loadExistingCommonDocs(typeName);
                
                document.getElementById('commonDocUploadModal').classList.remove('hidden');
            }
            
            async function loadExistingCommonDocs(typeName) {
                const container = document.getElementById('existingCommonDocsList');
                if (!container) return;
                
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/common-documents\`);
                    const docs = (response.data || []).filter(d => d.document_type === typeName);
                    currentCommonDocs = docs;
                    
                    if (docs.length === 0) {
                        container.innerHTML = '<div class="text-xs text-gray-500 py-2">まだアップロードされていません</div>';
                        return;
                    }
                    
                    container.innerHTML = docs.map(doc => \`
                        <div class="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5 border">
                            <div class="flex items-center gap-2 min-w-0">
                                <i class="fas fa-file text-blue-500"></i>
                                <span class="text-purple-600 font-medium">\${doc.fiscal_year ? doc.fiscal_year + '期' : ''}</span>
                                <span class="text-gray-600 truncate">\${doc.file_name}</span>
                            </div>
                            <div class="flex items-center gap-2 ml-2 flex-shrink-0">
                                <a href="/api/common-documents/\${doc.id}/download" 
                                   class="text-blue-600 hover:text-blue-800" title="ダウンロード">
                                    <i class="fas fa-download"></i>
                                </a>
                                <button onclick="deleteCommonDocument(\${doc.id}, event)" 
                                        class="text-red-500 hover:text-red-700" title="削除">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Error loading existing docs:', error);
                    container.innerHTML = '<div class="text-xs text-red-500 py-2">読み込みに失敗しました</div>';
                }
            }
            
            async function deleteCommonDocument(docId, event) {
                event.stopPropagation();
                if (!confirm('この書類を削除しますか？')) return;
                
                try {
                    await axios.delete(\`/api/common-documents/\${docId}\`);
                    showMessage('success', '書類を削除しました');
                    await loadExistingCommonDocs(selectedCommonDocType);
                    loadCommonDocuments();
                    // 案件別必要書類リストも更新（共通書類との連携を反映）
                    if (typeof loadDocumentChecklist === 'function') {
                        loadDocumentChecklist();
                    }
                } catch (error) {
                    console.error('Error deleting common document:', error);
                    showMessage('error', '削除に失敗しました');
                }
            }
            
            window.deleteCommonDocument = deleteCommonDocument;
            
            function closeCommonDocUploadModal() {
                document.getElementById('commonDocUploadModal').classList.add('hidden');
                document.getElementById('commonDocFileInput').value = '';
                document.getElementById('commonDocFiscalYear').value = '';
                document.getElementById('commonDocMultiVersionInfo').classList.add('hidden');
                document.getElementById('commonDocFiscalYearRequired').classList.add('hidden');
                // ファイル選択表示をリセット
                clearCommonDocFileDisplay();
                selectedCommonDocType = null;
                selectedCommonDocTypeId = null;
                selectedDocMaxVersions = 1;
            }
            
            async function uploadCommonDocument() {
                const fileInput = document.getElementById('commonDocFileInput');
                const fiscalYear = document.getElementById('commonDocFiscalYear').value;
                
                if (!fileInput.files || fileInput.files.length === 0) {
                    showMessage('error', 'ファイルを選択してください');
                    return;
                }
                
                const file = fileInput.files[0];
                showMessage('info', 'アップロード中...');
                
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('document_type', selectedCommonDocType);
                    if (fiscalYear) {
                        formData.append('fiscal_year', fiscalYear);
                    }
                    
                    await axios.post(\`/api/clients/\${CLIENT_ID}/common-documents\`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    
                    showMessage('success', '共通書類をアップロードしました');
                    closeCommonDocUploadModal();
                    loadCommonDocuments();
                    // 案件別必要書類リストも更新（共通書類との連携を反映）
                    if (typeof loadDocumentChecklist === 'function') {
                        loadDocumentChecklist();
                    }
                } catch (error) {
                    console.error('Error uploading common document:', error);
                    showMessage('error', 'アップロードに失敗しました');
                }
            }
            
            // ファイル選択時のUI更新
            function onCommonDocFileSelected(input) {
                const defaultZone = document.getElementById('commonDocDropZoneDefault');
                const selectedZone = document.getElementById('commonDocDropZoneSelected');
                const fileNameDisplay = document.getElementById('commonDocSelectedFileName');
                const uploadBtn = document.getElementById('commonDocUploadBtn');
                
                if (input.files && input.files.length > 0) {
                    const file = input.files[0];
                    defaultZone.classList.add('hidden');
                    selectedZone.classList.remove('hidden');
                    fileNameDisplay.textContent = file.name;
                    
                    // アップロードボタンを有効化
                    uploadBtn.disabled = false;
                    uploadBtn.className = 'w-full mt-3 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer';
                    uploadBtn.innerHTML = '<i class="fas fa-upload mr-1"></i>アップロード';
                } else {
                    clearCommonDocFileDisplay();
                }
            }
            
            // ファイル選択をクリア
            function clearCommonDocFile() {
                const fileInput = document.getElementById('commonDocFileInput');
                fileInput.value = '';
                clearCommonDocFileDisplay();
            }
            
            function clearCommonDocFileDisplay() {
                const defaultZone = document.getElementById('commonDocDropZoneDefault');
                const selectedZone = document.getElementById('commonDocDropZoneSelected');
                const uploadBtn = document.getElementById('commonDocUploadBtn');
                
                defaultZone.classList.remove('hidden');
                selectedZone.classList.add('hidden');
                
                // アップロードボタンを無効化
                uploadBtn.disabled = true;
                uploadBtn.className = 'w-full mt-3 bg-gray-300 text-gray-500 py-2 rounded-lg text-sm font-medium cursor-not-allowed';
                uploadBtn.innerHTML = '<i class="fas fa-upload mr-1"></i>ファイルを選択してください';
            }
            
            window.onCommonDocFileSelected = onCommonDocFileSelected;
            window.clearCommonDocFile = clearCommonDocFile;
            window.openCommonDocUploadModal = openCommonDocUploadModal;
            window.closeCommonDocUploadModal = closeCommonDocUploadModal;
            window.uploadCommonDocument = uploadCommonDocument;
            
            // 共通書類ドロップゾーンのドラッグ&ドロップ設定
            const commonDocDropZone = document.getElementById('commonDocDropZone');
            if (commonDocDropZone) {
                commonDocDropZone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    commonDocDropZone.classList.add('border-blue-500', 'bg-blue-100');
                });
                
                commonDocDropZone.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    commonDocDropZone.classList.remove('border-blue-500', 'bg-blue-100');
                });
                
                commonDocDropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    commonDocDropZone.classList.remove('border-blue-500', 'bg-blue-100');
                    
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                        // ファイル入力に設定
                        const fileInput = document.getElementById('commonDocFileInput');
                        // FileInputにはFileListを直接設定できないため、DataTransferを使用
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(files[0]);
                        fileInput.files = dataTransfer.files;
                        
                        // UIを更新
                        onCommonDocFileSelected(fileInput);
                    }
                });
            }
            
            // 案件一覧を読み込む（顧客の全案件を表示）- パイプライン付き
            async function loadPortalCases() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/cases\`);
                    const cases = response.data || [];
                    
                    const container = document.getElementById('portalCasesList');
                    
                    if (cases.length === 0) {
                        container.innerHTML = '<div class="text-sm text-gray-500 py-4 text-center">現在申請中の案件はありません</div>';
                        return;
                    }
                    
                    const statusLabels = {
                        inquiry: { label: '見込み', bg: 'bg-gray-100', text: 'text-gray-700' },
                        preparing: { label: '書類準備中', bg: 'bg-yellow-100', text: 'text-yellow-800' },
                        document_prep: { label: '書類準備中', bg: 'bg-yellow-100', text: 'text-yellow-800' },
                        applying: { label: '申請中', bg: 'bg-purple-100', text: 'text-purple-800' },
                        submitted: { label: '申請済み', bg: 'bg-blue-100', text: 'text-blue-800' },
                        under_review: { label: '審査中', bg: 'bg-purple-100', text: 'text-purple-800' },
                        adopted: { label: '採択・入金待ち', bg: 'bg-blue-100', text: 'text-blue-800' },
                        approved: { label: '採択', bg: 'bg-green-100', text: 'text-green-800' },
                        rejected: { label: '不採択', bg: 'bg-red-100', text: 'text-red-800' },
                        completed: { label: '完了', bg: 'bg-teal-100', text: 'text-teal-800' }
                    };
                    
                    // 各案件のパイプラインを取得
                    const pipelinesResponse = await axios.get(\`/api/clients/\${CLIENT_ID}/pipelines\`);
                    const allPipelines = pipelinesResponse.data || [];
                    
                    container.innerHTML = cases.map(c => {
                        const statusInfo = statusLabels[c.status] || { label: c.status, bg: 'bg-gray-100', text: 'text-gray-700' };
                        const isCurrentCase = c.id === CASE_ID;
                        const casePipelines = allPipelines.filter(p => p.case_id === c.id);
                        const activePipeline = casePipelines.find(p => p.status === 'active') || casePipelines[0];
                        const progress = activePipeline?.progress_percentage || 0;
                        
                        return \`
                            <div class="rounded-lg border \${isCurrentCase ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'} overflow-hidden">
                                <div class="flex items-center gap-3 p-3 cursor-pointer hover:bg-opacity-80 transition"
                                     onclick="switchCase(\${c.id}, '\${c.access_token}')">
                                    <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center \${isCurrentCase ? 'bg-green-500' : 'bg-gray-400'}">
                                        <i class="fas fa-file-alt text-white"></i>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                            <span class="font-medium text-sm \${isCurrentCase ? 'text-green-800' : 'text-gray-800'}">\${c.subsidy_type_name || '申請種別未設定'}</span>
                                            \${isCurrentCase ? '<span class="text-xs bg-green-600 text-white px-2 py-0.5 rounded">現在表示中</span>' : ''}
                                        </div>
                                        <div class="text-xs text-gray-500 mt-0.5">
                                            \${c.case_number || ''} 
                                            <span class="inline-block px-2 py-0.5 rounded \${statusInfo.bg} \${statusInfo.text} ml-1">\${statusInfo.label}</span>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        \${activePipeline ? \`
                                            <span class="text-xs font-bold \${progress >= 100 ? 'text-green-600' : 'text-blue-600'}">\${progress}%</span>
                                        \` : ''}
                                        <button onclick="event.stopPropagation(); toggleCasePipeline(\${c.id})" 
                                                class="text-gray-400 hover:text-gray-600 p-1">
                                            <i class="fas fa-chevron-down" id="caseChevron\${c.id}"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- パイプライン詳細（折りたたみ） -->
                                <div id="casePipeline\${c.id}" class="hidden border-t bg-white">
                                    \${activePipeline ? \`
                                        <div class="p-3">
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="text-xs font-medium text-gray-600">
                                                    <i class="fas fa-tasks mr-1 text-blue-500"></i>パイプライン進捗
                                                </span>
                                                <span class="text-xs font-bold \${progress >= 100 ? 'text-green-600' : 'text-blue-600'}">\${progress}%</span>
                                            </div>
                                            <div class="w-full bg-gray-200 rounded-full h-1.5 mb-3">
                                                <div class="h-1.5 rounded-full transition-all \${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}" style="width: \${progress}%"></div>
                                            </div>
                                            <div id="casePipelineTasks\${c.id}" class="space-y-2 text-xs">
                                                <div class="text-gray-400 py-2 text-center">
                                                    <i class="fas fa-spinner fa-spin mr-1"></i>読み込み中...
                                                </div>
                                            </div>
                                        </div>
                                    \` : \`
                                        <div class="p-3 text-xs text-gray-500 text-center">
                                            パイプラインが設定されていません
                                        </div>
                                    \`}
                                </div>
                            </div>
                        \`;
                    }).join('');
                    
                    // 各案件のパイプライン情報を保存
                    window.portalCasePipelines = {};
                    for (const c of cases) {
                        const casePipelines = allPipelines.filter(p => p.case_id === c.id);
                        window.portalCasePipelines[c.id] = casePipelines;
                    }
                } catch (error) {
                    console.error('Error loading portal cases:', error);
                    document.getElementById('portalCasesList').innerHTML = '<div class="text-sm text-red-500 py-2">案件の読み込みに失敗しました</div>';
                }
            }
            
            // 案件のパイプライン表示を切り替え
            async function toggleCasePipeline(caseId) {
                const container = document.getElementById('casePipeline' + caseId);
                const chevron = document.getElementById('caseChevron' + caseId);
                
                if (container.classList.contains('hidden')) {
                    container.classList.remove('hidden');
                    chevron.classList.remove('fa-chevron-down');
                    chevron.classList.add('fa-chevron-up');
                    
                    // タスクを読み込み
                    await loadCasePipelineTasks(caseId);
                } else {
                    container.classList.add('hidden');
                    chevron.classList.remove('fa-chevron-up');
                    chevron.classList.add('fa-chevron-down');
                }
            }
            window.toggleCasePipeline = toggleCasePipeline;
            
            // 案件のパイプラインタスクを読み込み
            async function loadCasePipelineTasks(caseId) {
                const tasksContainer = document.getElementById('casePipelineTasks' + caseId);
                const pipelines = window.portalCasePipelines?.[caseId] || [];
                const activePipeline = pipelines.find(p => p.status === 'active') || pipelines[0];
                
                if (!activePipeline) {
                    tasksContainer.innerHTML = '<div class="text-gray-400 text-center py-2">タスクがありません</div>';
                    return;
                }
                
                try {
                    const response = await axios.get(\`/api/pipelines/\${activePipeline.id}/tasks\`);
                    const tasks = response.data || [];
                    
                    if (tasks.length === 0) {
                        tasksContainer.innerHTML = '<div class="text-gray-400 text-center py-2">タスクがありません</div>';
                        return;
                    }
                    
                    tasksContainer.innerHTML = tasks.map((task, index) => {
                        const isCompleted = task.status === 'completed';
                        const isCustomerTask = task.task_type === 'external' || task.task_type === 'both';
                        const canComplete = isCustomerTask && (task.status === 'pending' || task.status === 'in_progress');
                        
                        return \`
                            <div class="flex items-center gap-2 p-2 rounded \${isCompleted ? 'bg-green-50' : (isCustomerTask ? 'bg-blue-50' : 'bg-gray-50')}">
                                <div class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold \${isCompleted ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}">
                                    \${isCompleted ? '<i class="fas fa-check text-xs"></i>' : (index + 1)}
                                </div>
                                <span class="flex-1 \${isCompleted ? 'text-green-700 line-through' : 'text-gray-700'}">\${task.task_name}</span>
                                \${isCustomerTask && !isCompleted ? '<span class="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">顧客</span>' : ''}
                                \${canComplete ? \`
                                    <button onclick="event.stopPropagation(); completeTaskFromList(\${task.id}, \${caseId})" 
                                            class="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs">
                                        完了
                                    </button>
                                \` : ''}
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading pipeline tasks:', error);
                    tasksContainer.innerHTML = '<div class="text-red-400 text-center py-2">読み込みエラー</div>';
                }
            }
            
            // タスク完了（一覧から）
            async function completeTaskFromList(taskId, caseId) {
                if (!confirm('このタスクを完了にしますか？')) return;
                
                try {
                    await axios.post(\`/api/portal/tasks/\${taskId}/complete\`, { client_id: CLIENT_ID });
                    showMessage('タスクを完了しました！', 'success');
                    await loadCasePipelineTasks(caseId);
                    await loadPortalCases();
                    if (caseId === CASE_ID) {
                        loadPipelineProgress();
                    }
                } catch (error) {
                    alert('タスクの完了に失敗しました');
                }
            }
            window.completeTaskFromList = completeTaskFromList;
            
            // 案件を切り替える
            function switchCase(caseId, accessToken) {
                if (caseId === CASE_ID) return; // 同じ案件なら何もしない
                window.location.href = '/portal/' + accessToken;
            }
            
            window.switchCase = switchCase;
            window.loadPortalCases = loadPortalCases;

            async function loadDocuments() {
                const response = await axios.get(\`/api/clients/\${CLIENT_ID}/documents\`);
                const docs = response.data;
                
                const container = document.getElementById('uploadedDocuments');
                if (docs.length === 0) {
                    container.innerHTML = '<div class="text-sm text-gray-500 py-4">まだ書類がありません</div>';
                    return;
                }
                
                container.innerHTML = docs.map(doc => {
                    const statusConfig = {
                        approved: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', icon: 'fa-check-circle', label: '承認済み' },
                        rejected: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', icon: 'fa-times-circle', label: '差し戻し' },
                        pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', icon: 'fa-clock', label: '確認中' }
                    };
                    const status = statusConfig[doc.status] || statusConfig.pending;
                    return \`
                    <div class="border rounded p-2 mb-1.5 \${status.border} \${status.bg}">
                        <div class="flex items-center justify-between">
                            <div class="flex-1 min-w-0">
                                <div class="font-medium text-xs truncate">\${doc.document_type}</div>
                                <div class="text-xs text-gray-500 truncate">\${doc.file_name}</div>
                            </div>
                            <div class="flex items-center gap-1.5 ml-2">
                                <span class="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 \${status.bg} \${status.text} font-medium">
                                    <i class="fas \${status.icon} text-xs"></i>
                                    \${status.label}
                                </span>
                                <a href="/api/documents/\${doc.id}/download" class="text-blue-600 hover:text-blue-800 text-xs">
                                    <i class="fas fa-download"></i>
                                </a>
                            </div>
                        </div>
                        \${doc.status === 'rejected' ? '<div class="text-xs text-red-600 mt-1"><i class="fas fa-exclamation-triangle mr-1"></i>書類を再提出してください</div>' : ''}
                    </div>
                \`}).join('');
            }

            // DB時刻文字列(UTC)をJSTに変換して時刻部分を表示
            function formatJSTTime(dateStr) {
                if (!dateStr) return '';
                // DBはUTCで保存されているので、JSTタイムゾーンで表示
                const isoStr = dateStr.replace(' ', 'T') + 'Z';
                const utc = new Date(isoStr);
                return utc.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
            }
            
            async function loadCommunications() {
                // 案件IDがある場合は案件別、なければ顧客全体のやり取りを取得
                const url = CASE_ID 
                    ? \`/api/cases/\${CASE_ID}/communications\`
                    : \`/api/clients/\${CLIENT_ID}/communications\`;
                const response = await axios.get(url);
                const comms = response.data;
                
                const container = document.getElementById('clientCommunications');
                if (comms.length === 0) {
                    container.innerHTML = '<div class="text-sm text-gray-500">まだやり取りがありません</div>';
                    return;
                }
                
                container.innerHTML = comms.map(comm => {
                    const isClient = comm.sender_type === 'client';
                    return \`
                        <div class="flex \${isClient ? 'justify-end' : 'justify-start'}">
                            <div class="max-w-[85%] \${isClient ? 'bg-green-100' : 'bg-gray-100'} rounded-lg px-2.5 py-1.5">
                                <div class="text-xs">\${comm.message}</div>
                                <div class="text-xs text-gray-400 mt-0.5">\${comm.sender_name} · \${formatJSTTime(comm.created_at)}</div>
                            </div>
                        </div>
                    \`;
                }).join('');
                
                container.scrollTop = container.scrollHeight;
            }

            document.getElementById('clientMessageForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const message = document.getElementById('clientMessageInput').value;
                
                await axios.post(\`/api/clients/\${CLIENT_ID}/communications\`, {
                    message,
                    case_id: CASE_ID || null,
                    sender_type: 'client',
                    sender_name: '${client.name}'
                });
                
                document.getElementById('clientMessageInput').value = '';
                loadCommunications();
            });

            document.getElementById('fileInput').addEventListener('change', async (e) => {
                // 見込みステータスの場合はアップロードをブロック
                if (isInquiryStatus) {
                    showMessage('error', '書類アップロードは案件開始後にご利用いただけます');
                    closeUploadModal();
                    return;
                }
                
                const files = e.target.files;
                const documentType = document.getElementById('selectedDocumentType').value;
                
                if (!documentType) {
                    showMessage('error', '書類の種類が選択されていません');
                    return;
                }
                
                if (files.length === 0) return;
                
                // アップロード開始を表示
                showMessage('info', 'アップロード中...');
                
                // 実際のファイルアップロード（R2使用）
                try {
                    let successCount = 0;
                    for (const file of files) {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('document_type', documentType);
                        formData.append('uploaded_by', 'client');
                        formData.append('case_id', CASE_ID);
                        
                        const response = await axios.post(\`/api/clients/\${CLIENT_ID}/documents/upload\`, formData, {
                            headers: {
                                'Content-Type': 'multipart/form-data'
                            }
                        });
                        
                        if (response.status === 200 && response.data) {
                            successCount++;
                        }
                    }
                    
                    showMessage('success', \`「\${documentType}」をアップロードしました！\`);
                    document.getElementById('fileInput').value = '';
                    closeUploadModal();
                    await loadDocuments();
                    await loadChecklist();
                    
                    // 特定の書類タイプの場合、データ入力モーダルを表示
                    const docType = documentType.toLowerCase();
                    if (docType.includes('登記') || docType.includes('謄本') || docType.includes('履歴事項')) {
                        showDataInputModal('registry', documentType);
                    } else if (docType.includes('決算') || docType.includes('財務') || docType.includes('貸借') || docType.includes('損益')) {
                        showDataInputModal('financial', documentType);
                    } else if (docType.includes('確定申告')) {
                        showDataInputModal('tax_return', documentType);
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    if (error.response) {
                        showMessage('error', \`アップロードエラー: \${error.response.data.error || '不明なエラー'}\`);
                    } else {
                        showMessage('error', 'ネットワークエラーが発生しました。もう一度お試しください。');
                    }
                }
            });

            // ドラッグ&ドロップ機能（モーダル内）
            const dropZone = document.getElementById('dropZone');
            
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-green-500', 'bg-green-100');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-green-500', 'bg-green-100');
            });
            
            dropZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-green-500', 'bg-green-100');
                
                // 見込みステータスの場合はアップロードをブロック
                if (isInquiryStatus) {
                    showMessage('error', '書類アップロードは案件開始後にご利用いただけます');
                    closeUploadModal();
                    return;
                }
                
                const documentType = document.getElementById('selectedDocumentType').value;
                if (!documentType) {
                    showMessage('error', '書類の種類が選択されていません');
                    return;
                }
                
                const files = e.dataTransfer.files;
                if (files.length === 0) return;
                
                // アップロード開始を表示
                showMessage('info', 'アップロード中...');
                
                try {
                    let successCount = 0;
                    for (const file of files) {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('document_type', documentType);
                        formData.append('uploaded_by', 'client');
                        formData.append('case_id', CASE_ID);
                        
                        const response = await axios.post(\`/api/clients/\${CLIENT_ID}/documents/upload\`, formData, {
                            headers: {
                                'Content-Type': 'multipart/form-data'
                            }
                        });
                        
                        if (response.status === 200 && response.data) {
                            successCount++;
                        }
                    }
                    
                    showMessage('success', \`「\${documentType}」をアップロードしました！\`);
                    closeUploadModal();
                    await loadDocuments();
                    await loadChecklist();
                    
                    // 特定の書類タイプの場合、データ入力モーダルを表示
                    const docType = documentType.toLowerCase();
                    if (docType.includes('登記') || docType.includes('謄本') || docType.includes('履歴事項')) {
                        showDataInputModal('registry', documentType);
                    } else if (docType.includes('決算') || docType.includes('財務') || docType.includes('貸借') || docType.includes('損益')) {
                        showDataInputModal('financial', documentType);
                    } else if (docType.includes('確定申告')) {
                        showDataInputModal('tax_return', documentType);
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    if (error.response) {
                        showMessage('error', \`アップロードエラー: \${error.response.data.error || '不明なエラー'}\`);
                    } else {
                        showMessage('error', 'ネットワークエラーが発生しました。もう一度お試しください。');
                    }
                }
            });
            
            // モーダル外クリックで閉じる
            document.getElementById('documentUploadModal').addEventListener('click', (e) => {
                if (e.target.id === 'documentUploadModal') {
                    closeUploadModal();
                }
            });

            // メッセージ表示関数
            function showMessage(type, message) {
                const colors = {
                    success: 'bg-green-600',
                    error: 'bg-red-600',
                    info: 'bg-blue-600'
                };
                const icons = {
                    success: 'fa-check-circle',
                    error: 'fa-exclamation-circle',
                    info: 'fa-info-circle'
                };
                
                // 既存のメッセージを削除
                const existing = document.getElementById('uploadMessage');
                if (existing) existing.remove();
                
                const toast = document.createElement('div');
                toast.id = 'uploadMessage';
                toast.className = \`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto \${colors[type]} text-white px-4 md:px-6 py-3 rounded-lg shadow-lg z-50\`;
                toast.innerHTML = \`
                    <div class="flex items-center gap-2">
                        <i class="fas \${icons[type]}"></i>
                        <span class="text-sm md:text-base">\${message}</span>
                    </div>
                \`;
                document.body.appendChild(toast);
                
                if (type !== 'info') {
                    setTimeout(() => {
                        toast.style.opacity = '0';
                        toast.style.transition = 'opacity 0.3s';
                        setTimeout(() => toast.remove(), 300);
                    }, 3000);
                }
            }

            // ===============================
            // ヒアリング質問機能
            // ===============================
            
            let hearingQuestions = [];
            let hearingAnswers = {};
            let currentCategory = null;
            
            async function loadHearingQuestions() {
                try {
                    // 見込みステータスの場合は制限メッセージを表示
                    if (isInquiryStatus) {
                        // カテゴリタブと保存ボタンを非表示
                        document.getElementById('hearingCategoryTabs').innerHTML = '';
                        const saveBtn = document.getElementById('hearingSaveButton');
                        if (saveBtn) saveBtn.style.display = 'none';
                        
                        document.getElementById('hearingQuestionsList').innerHTML = \`
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                                <i class="fas fa-lock text-yellow-500 text-3xl mb-3"></i>
                                <p class="font-bold text-yellow-700 text-lg">ヒアリング機能は案件開始後にご利用いただけます</p>
                                <p class="text-yellow-600 mt-2">現在、担当者が内容を確認中です。<br>案件が開始されましたら、ご質問への回答をお願いいたします。</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    // 保存ボタンを表示（見込みでない場合）
                    const saveBtn = document.getElementById('hearingSaveButton');
                    if (saveBtn) saveBtn.style.display = '';
                    
                    // 案件の助成金種別を取得（CASE_IDがある場合はcasesテーブルから）
                    let subsidyTypeId = null;
                    
                    if (CASE_ID) {
                        // 案件から補助金種別を取得
                        const caseRes = await axios.get(\`/api/cases/\${CASE_ID}\`);
                        subsidyTypeId = caseRes.data?.subsidy_type_id;
                    } else {
                        // 後方互換: 顧客から補助金種別を取得
                        const clientRes = await axios.get(\`/api/clients/\${CLIENT_ID}\`);
                        subsidyTypeId = clientRes.data?.subsidy_type_id;
                    }
                    
                    if (!subsidyTypeId) {
                        document.getElementById('hearingQuestionsList').innerHTML = \`
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-info-circle text-2xl mb-2"></i>
                                <p>まだ助成金種別が設定されていません。</p>
                                <p class="text-sm mt-2">担当者にお問い合わせください。</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    // ヒアリング質問を取得（共通質問 + 補助金種別固有の質問）
                    const questionsRes = await axios.get(\`/api/hearing-questions/\${subsidyTypeId}\`);
                    hearingQuestions = questionsRes.data;
                    
                    // 既存の回答を取得（CASE_IDがある場合は案件用API、共通質問は自動で全案件に適用）
                    let answersRes;
                    if (CASE_ID) {
                        answersRes = await axios.get(\`/api/cases/\${CASE_ID}/hearing-answers\`);
                    } else {
                        answersRes = await axios.get(\`/api/clients/\${CLIENT_ID}/hearing-answers\`);
                    }
                    hearingAnswers = {};
                    (answersRes.data || []).forEach(a => {
                        hearingAnswers[a.question_id] = a.answer_text;
                    });
                    
                    // バッジを更新してから、デフォルトタブで表示
                    updateHearingBadges();
                    
                    // 共通質問があれば共通タブ、なければ案件別タブをデフォルトに
                    const commonQs = hearingQuestions.filter(q => q.subsidy_type_id === 0);
                    const specificQs = hearingQuestions.filter(q => q.subsidy_type_id !== 0);
                    
                    if (commonQs.length > 0) {
                        currentHearingTab = 'common';
                    } else if (specificQs.length > 0) {
                        currentHearingTab = 'specific';
                    }
                    
                    // タブを初期化して表示
                    switchHearingTab(currentHearingTab);
                    updateProgress();
                } catch (error) {
                    console.error('Error loading hearing questions:', error);
                    document.getElementById('hearingQuestionsList').innerHTML = \`
                        <div class="text-center py-8 text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>ヒアリング質問の読み込みに失敗しました。</p>
                        </div>
                    \`;
                }
            }
            
            // 共通質問 / 案件別質問のタブ切り替え
            let currentHearingTab = 'common'; // 'common' or 'specific'
            
            function switchHearingTab(tab) {
                currentHearingTab = tab;
                
                // タブスタイル更新
                const commonTab = document.getElementById('hearingTabCommon');
                const specificTab = document.getElementById('hearingTabSpecific');
                const commonInfo = document.getElementById('commonQuestionsInfo');
                const specificInfo = document.getElementById('specificQuestionsInfo');
                
                if (tab === 'common') {
                    commonTab.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600';
                    specificTab.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700';
                    commonInfo.classList.remove('hidden');
                    specificInfo.classList.add('hidden');
                } else {
                    commonTab.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700';
                    specificTab.className = 'flex-1 px-4 py-2 text-sm font-medium border-b-2 border-indigo-600 text-indigo-600';
                    commonInfo.classList.add('hidden');
                    specificInfo.classList.remove('hidden');
                }
                
                // カテゴリタブと質問を再レンダリング
                const filteredQuestions = getFilteredQuestionsByTab();
                const categories = [...new Set(filteredQuestions.map(q => q.category))];
                if (categories.length > 0) {
                    currentCategory = categories[0];
                    renderCategoryTabs(categories);
                    renderQuestions();
                } else {
                    document.getElementById('hearingCategoryTabs').innerHTML = '';
                    document.getElementById('hearingQuestionsList').innerHTML = \`
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-check-circle text-2xl mb-2 text-green-500"></i>
                            <p>\${tab === 'common' ? '共通質問' : '案件別質問'}は設定されていません。</p>
                        </div>
                    \`;
                }
                
                updateHearingBadges();
            }
            
            function getFilteredQuestionsByTab() {
                return hearingQuestions.filter(q => {
                    if (currentHearingTab === 'common') {
                        return q.subsidy_type_id === 0;
                    } else {
                        return q.subsidy_type_id !== 0;
                    }
                });
            }
            
            function updateHearingBadges() {
                const commonQs = hearingQuestions.filter(q => q.subsidy_type_id === 0);
                const specificQs = hearingQuestions.filter(q => q.subsidy_type_id !== 0);
                
                const commonAnswered = commonQs.filter(q => hearingAnswers[q.id] && hearingAnswers[q.id].trim()).length;
                const specificAnswered = specificQs.filter(q => hearingAnswers[q.id] && hearingAnswers[q.id].trim()).length;
                
                const commonBadge = document.getElementById('commonQuestionsBadge');
                const specificBadge = document.getElementById('specificQuestionsBadge');
                
                if (commonBadge) {
                    commonBadge.textContent = \`\${commonAnswered}/\${commonQs.length}\`;
                    commonBadge.className = commonAnswered === commonQs.length && commonQs.length > 0
                        ? 'ml-1 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700'
                        : 'ml-1 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700';
                }
                if (specificBadge) {
                    specificBadge.textContent = \`\${specificAnswered}/\${specificQs.length}\`;
                    specificBadge.className = specificAnswered === specificQs.length && specificQs.length > 0
                        ? 'ml-1 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700'
                        : 'ml-1 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600';
                }
            }
            
            window.switchHearingTab = switchHearingTab;
            
            function renderCategoryTabs(categories) {
                const container = document.getElementById('hearingCategoryTabs');
                const borderColor = currentHearingTab === 'common' ? 'border-blue-600 text-blue-600' : 'border-indigo-600 text-indigo-600';
                container.innerHTML = categories.map(cat => \`
                    <button onclick="switchHearingCategory('\${cat}')" 
                            class="px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors \${currentCategory === cat ? borderColor : 'border-transparent text-gray-500 hover:text-gray-700'}">
                        \${cat}
                        <span class="ml-1 text-xs px-1.5 py-0.5 rounded-full \${getCategoryProgressColor(cat)}">
                            \${getCategoryProgress(cat)}
                        </span>
                    </button>
                \`).join('');
            }
            
            function getCategoryProgress(category) {
                const filteredByTab = getFilteredQuestionsByTab();
                const catQuestions = filteredByTab.filter(q => q.category === category);
                const answered = catQuestions.filter(q => hearingAnswers[q.id] && hearingAnswers[q.id].trim()).length;
                return \`\${answered}/\${catQuestions.length}\`;
            }
            
            function getCategoryProgressColor(category) {
                const filteredByTab = getFilteredQuestionsByTab();
                const catQuestions = filteredByTab.filter(q => q.category === category);
                const answered = catQuestions.filter(q => hearingAnswers[q.id] && hearingAnswers[q.id].trim()).length;
                if (answered === catQuestions.length) return 'bg-green-100 text-green-800';
                if (answered > 0) return 'bg-yellow-100 text-yellow-800';
                return 'bg-gray-100 text-gray-600';
            }
            
            function switchHearingCategory(category) {
                currentCategory = category;
                const filteredByTab = getFilteredQuestionsByTab();
                const categories = [...new Set(filteredByTab.map(q => q.category))];
                renderCategoryTabs(categories);
                renderQuestions();
            }
            
            function renderQuestions() {
                const container = document.getElementById('hearingQuestionsList');
                const filteredByTab = getFilteredQuestionsByTab();
                const filteredQuestions = filteredByTab.filter(q => q.category === currentCategory);
                
                if (filteredQuestions.length === 0) {
                    container.innerHTML = '<div class="text-center py-8 text-gray-500">このカテゴリに質問はありません。</div>';
                    return;
                }
                
                container.innerHTML = filteredQuestions.map((q, index) => \`
                    <div class="border rounded-lg p-4 \${hearingAnswers[q.id] ? 'bg-green-50 border-green-200' : 'bg-white'}">
                        <div class="flex items-start gap-3 mb-3">
                            <span class="flex-shrink-0 w-8 h-8 rounded-full \${hearingAnswers[q.id] ? 'bg-green-500' : 'bg-indigo-500'} text-white flex items-center justify-center text-sm font-medium">
                                \${hearingAnswers[q.id] ? '<i class="fas fa-check"></i>' : (index + 1)}
                            </span>
                            <div class="flex-1">
                                <div class="font-medium text-gray-800 mb-1">
                                    \${q.question_text}
                                    \${q.is_required ? 
                                        '<span class="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">必須</span>' : 
                                        '<span class="ml-2 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded">任意</span>'}
                                </div>
                                \${q.description ? \`<div class="text-sm text-gray-500">\${q.description}</div>\` : ''}
                            </div>
                        </div>
                        \${renderAnswerInput(q)}
                    </div>
                \`).join('');
            }
            
            function renderAnswerInput(question) {
                const currentAnswer = hearingAnswers[question.id] || '';
                const inputType = question.input_type || 'textarea';
                
                // ヘルプテキスト（書き方ガイド）
                const helpSection = question.help_text ? \`
                    <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div class="flex items-start gap-2">
                            <i class="fas fa-lightbulb text-blue-500 mt-0.5"></i>
                            <div class="text-sm text-blue-700">\${question.help_text}</div>
                        </div>
                    </div>
                \` : '';
                
                // 記入例
                const exampleSection = question.example_answer ? \`
                    <details class="mb-3 group">
                        <summary class="text-sm text-gray-500 cursor-pointer hover:text-indigo-600 select-none">
                            <i class="fas fa-file-alt mr-1"></i>記入例を見る
                        </summary>
                        <div class="mt-2 p-3 bg-gray-50 border rounded-lg text-sm text-gray-700">
                            <div class="whitespace-pre-wrap">\${question.example_answer}</div>
                            <button onclick="useExampleById(\${question.id})" 
                                    class="mt-2 text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
                                <i class="fas fa-copy mr-1"></i>この例文をベースに使う
                            </button>
                        </div>
                    </details>
                \` : '';
                
                // 入力ボタン群
                const actionButtons = \`
                    <div class="flex flex-wrap gap-1 mt-2">
                        <button onclick="openAiSuggestModal(\${question.id})" 
                                class="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
                            <i class="fas fa-magic mr-1"></i>AI提案
                        </button>
                        <button onclick="openTemplateModal(\${question.id})" 
                                class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            <i class="fas fa-list-alt mr-1"></i>テンプレ
                        </button>
                        <button onclick="showWritingGuide(\${question.id})" 
                                class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                            <i class="fas fa-book mr-1"></i>書き方ガイド
                        </button>
                    </div>
                \`;
                
                if (inputType === 'select' && question.options) {
                    const options = JSON.parse(question.options);
                    return \`
                        <select onchange="updateHearingAnswer(\${question.id}, this.value)" 
                                class="w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="">選択してください</option>
                            \${options.map(opt => \`<option value="\${opt}" \${currentAnswer === opt ? 'selected' : ''}>\${opt}</option>\`).join('')}
                        </select>
                    \`;
                } else if (inputType === 'number') {
                    return \`
                        <input type="number" value="\${currentAnswer}" 
                               onchange="updateHearingAnswer(\${question.id}, this.value)"
                               placeholder="数値を入力..."
                               class="w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    \`;
                } else {
                    return \`
                        \${helpSection}
                        \${exampleSection}
                        <textarea id="answer-\${question.id}" onchange="updateHearingAnswer(\${question.id}, this.value)"
                                  placeholder="回答を入力してください..."
                                  rows="3"
                                  class="w-full px-4 py-3 border rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none">\${currentAnswer}</textarea>
                        \${actionButtons}
                    \`;
                }
            }
            
            // 記入例をテキストエリアにコピー
            function useExampleById(questionId) {
                const question = hearingQuestions.find(q => q.id === questionId);
                if (!question || !question.example_answer) return;
                
                const textarea = document.getElementById(\`answer-\${questionId}\`);
                if (textarea) {
                    textarea.value = question.example_answer;
                    updateHearingAnswer(questionId, question.example_answer);
                    showMessage('success', '記入例を適用しました。必要に応じて編集してください。');
                }
            }
            
            // 書き方ガイドモーダル表示
            async function showWritingGuide(questionId) {
                const question = hearingQuestions.find(q => q.id === questionId);
                if (!question) return;
                
                // 事業計画テンプレートからガイド情報を取得（あれば）
                let guideContent = '';
                
                try {
                    const response = await axios.get(\`/api/business-plan-templates/\${currentSubsidyTypeId || 1}\`);
                    const templates = response.data;
                    const matchingTemplate = templates.find(t => t.section_key === question.document_section);
                    
                    if (matchingTemplate) {
                        guideContent = \`
                            <div class="space-y-4">
                                \${matchingTemplate.writing_guide ? \`
                                    <div class="bg-blue-50 p-4 rounded-lg">
                                        <h4 class="font-bold text-blue-700 mb-2"><i class="fas fa-pen mr-1"></i>書き方のポイント</h4>
                                        <div class="text-sm text-blue-800 whitespace-pre-wrap">\${matchingTemplate.writing_guide}</div>
                                    </div>
                                \` : ''}
                                
                                \${matchingTemplate.key_points && matchingTemplate.key_points.length ? \`
                                    <div class="bg-green-50 p-4 rounded-lg">
                                        <h4 class="font-bold text-green-700 mb-2"><i class="fas fa-check-circle mr-1"></i>重要ポイント</h4>
                                        <ul class="space-y-1">
                                            \${matchingTemplate.key_points.map(p => \`<li class="flex items-start gap-2 text-sm text-green-800"><i class="fas fa-check text-green-500 mt-1"></i>\${p}</li>\`).join('')}
                                        </ul>
                                    </div>
                                \` : ''}
                                
                                \${matchingTemplate.common_mistakes && matchingTemplate.common_mistakes.length ? \`
                                    <div class="bg-red-50 p-4 rounded-lg">
                                        <h4 class="font-bold text-red-700 mb-2"><i class="fas fa-exclamation-triangle mr-1"></i>よくある間違い</h4>
                                        <ul class="space-y-1">
                                            \${matchingTemplate.common_mistakes.map(m => \`<li class="flex items-start gap-2 text-sm text-red-800"><i class="fas fa-times text-red-500 mt-1"></i>\${m}</li>\`).join('')}
                                        </ul>
                                    </div>
                                \` : ''}
                                
                                \${matchingTemplate.example_text ? \`
                                    <div class="bg-gray-50 p-4 rounded-lg">
                                        <h4 class="font-bold text-gray-700 mb-2"><i class="fas fa-file-alt mr-1"></i>完成例</h4>
                                        <div class="text-sm text-gray-700 whitespace-pre-wrap border-l-4 border-gray-300 pl-3">\${matchingTemplate.example_text}</div>
                                    </div>
                                \` : ''}
                            </div>
                        \`;
                    }
                } catch (error) {
                    console.error('ガイド取得エラー:', error);
                }
                
                // フォールバック
                if (!guideContent) {
                    guideContent = \`
                        <div class="space-y-4">
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <h4 class="font-bold text-blue-700 mb-2"><i class="fas fa-pen mr-1"></i>一般的な書き方のコツ</h4>
                                <ul class="space-y-2 text-sm text-blue-800">
                                    <li class="flex items-start gap-2"><i class="fas fa-check text-blue-500 mt-1"></i>具体的な数字を入れる（○○%削減、○○時間短縮など）</li>
                                    <li class="flex items-start gap-2"><i class="fas fa-check text-blue-500 mt-1"></i>課題と解決策の因果関係を明確に</li>
                                    <li class="flex items-start gap-2"><i class="fas fa-check text-blue-500 mt-1"></i>5W1H（いつ、どこで、誰が、何を、なぜ、どのように）を意識</li>
                                    <li class="flex items-start gap-2"><i class="fas fa-check text-blue-500 mt-1"></i>専門用語は噛み砕いて説明</li>
                                </ul>
                            </div>
                            \${question.help_text ? \`
                                <div class="bg-yellow-50 p-4 rounded-lg">
                                    <h4 class="font-bold text-yellow-700 mb-2"><i class="fas fa-lightbulb mr-1"></i>この質問について</h4>
                                    <div class="text-sm text-yellow-800">\${question.help_text}</div>
                                </div>
                            \` : ''}
                        </div>
                    \`;
                }
                
                // モーダルを再利用（AI提案モーダルを流用）
                const modal = document.getElementById('aiSuggestModal');
                document.getElementById('suggestQuestionText').textContent = question.question_text;
                document.getElementById('suggestContent').innerHTML = guideContent;
                document.getElementById('suggestActions').classList.add('hidden');
                modal.querySelector('h3').innerHTML = '<i class="fas fa-book mr-2"></i>書き方ガイド';
                modal.classList.remove('hidden');
            }
            
            function updateHearingAnswer(questionId, value) {
                hearingAnswers[questionId] = value;
                updateProgress();
                // カテゴリタブの進捗も更新
                const categories = [...new Set(hearingQuestions.map(q => q.category))];
                renderCategoryTabs(categories);
            }
            
            function updateProgress() {
                // 必須質問の進捗
                const requiredQuestions = hearingQuestions.filter(q => q.is_required);
                const requiredAnswered = requiredQuestions.filter(q => hearingAnswers[q.id] && hearingAnswers[q.id].trim()).length;
                const requiredTotal = requiredQuestions.length;
                const requiredPercent = requiredTotal > 0 ? Math.round((requiredAnswered / requiredTotal) * 100) : 0;
                
                // 任意質問の進捗
                const optionalQuestions = hearingQuestions.filter(q => !q.is_required);
                const optionalAnswered = optionalQuestions.filter(q => hearingAnswers[q.id] && hearingAnswers[q.id].trim()).length;
                const optionalTotal = optionalQuestions.length;
                
                // 表示更新
                let progressText = \`必須: \${requiredAnswered}/\${requiredTotal}問\`;
                if (optionalTotal > 0) {
                    progressText += \` ｜ 任意: \${optionalAnswered}/\${optionalTotal}問\`;
                }
                document.getElementById('hearingProgress').textContent = progressText;
                document.getElementById('hearingProgressBar').style.width = \`\${requiredPercent}%\`;
                
                // 必須完了でバーの色を変更
                const progressBar = document.getElementById('hearingProgressBar');
                if (requiredPercent === 100) {
                    progressBar.classList.remove('bg-indigo-600');
                    progressBar.classList.add('bg-green-500');
                } else {
                    progressBar.classList.remove('bg-green-500');
                    progressBar.classList.add('bg-indigo-600');
                }
            }
            
            async function saveAllHearingAnswers() {
                // 見込みステータスの場合は保存をブロック
                if (isInquiryStatus) {
                    showMessage('error', 'ヒアリング回答の保存は案件開始後にご利用いただけます');
                    return;
                }
                
                showMessage('info', '回答を保存中...');
                
                try {
                    const answersToSave = Object.entries(hearingAnswers)
                        .filter(([_, value]) => value && value.trim())
                        .map(([questionId, answerText]) => ({
                            question_id: parseInt(questionId),
                            answer_text: answerText
                        }));
                    
                    if (answersToSave.length === 0) {
                        showMessage('error', '保存する回答がありません');
                        return;
                    }
                    
                    // CASE_IDがある場合は案件用API（共通質問を自動で全案件に適用）
                    // ない場合は従来のクライアント用API
                    let response;
                    if (CASE_ID) {
                        response = await axios.post(\`/api/cases/\${CASE_ID}/hearing-answers\`, {
                            answers: answersToSave
                        });
                        const result = response.data;
                        if (result.common_saved_count > 0) {
                            showMessage('success', \`\${result.saved_count}件の回答を保存しました！（共通質問\${result.common_saved_count}件は全案件に適用されます）\`);
                        } else {
                            showMessage('success', \`\${result.saved_count}件の回答を保存しました！\`);
                        }
                    } else {
                        await axios.post(\`/api/clients/\${CLIENT_ID}/hearing-answers\`, {
                            answers: answersToSave
                        });
                        showMessage('success', \`\${answersToSave.length}件の回答を保存しました！\`);
                    }
                    
                    // 質問リストを再描画して状態を更新
                    renderQuestions();
                    const categories = [...new Set(hearingQuestions.map(q => q.category))];
                    renderCategoryTabs(categories);
                } catch (error) {
                    console.error('Save error:', error);
                    showMessage('error', '回答の保存に失敗しました');
                }
            }
            
            async function autoFillWithAI() {
                // 未回答の質問があるか確認
                const unansweredQuestions = hearingQuestions.filter(q => !hearingAnswers[q.id] || !hearingAnswers[q.id].trim());
                
                if (unansweredQuestions.length === 0) {
                    showMessage('success', 'すべての質問に回答済みです！');
                    return;
                }
                
                // AIチャットで相談を促す
                const input = document.getElementById('portalAiChatInput');
                input.value = \`以下の質問について、どのように回答すればよいか教えてください：\\n\\n\${unansweredQuestions.slice(0, 3).map((q, i) => \`\${i+1}. \${q.question_text}\`).join('\\n')}\`;
                input.focus();
                
                // AIチャットセクションにスクロール
                document.getElementById('portalAiChat').scrollIntoView({ behavior: 'smooth' });
                
                showMessage('info', 'AIアシスタントに質問の回答方法を相談しましょう');
            }

            // ===============================
            // AIチャット機能
            // ===============================
            
            async function loadPortalAiChat() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/ai-chat\`);
                    const chats = response.data;
                    
                    const container = document.getElementById('portalAiChat');
                    if (chats.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center text-gray-500 py-8">
                                <i class="fas fa-robot text-4xl mb-2 text-purple-400"></i>
                                <p>こんにちは！補助金申請のお手伝いをします。</p>
                                <p class="text-sm mt-2">ご質問やお困りのことがあればお聞かせください。</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    container.innerHTML = chats.map(chat => \`
                        <div class="flex \${chat.role === 'user' ? 'justify-end' : 'justify-start'} mb-3">
                            <div class="max-w-[80%] \${chat.role === 'user' ? 'bg-green-100' : 'bg-purple-100'} rounded-lg p-3">
                                <div class="flex items-center gap-2 mb-1">
                                    <i class="fas \${chat.role === 'user' ? 'fa-user' : 'fa-robot'} text-sm \${chat.role === 'user' ? 'text-green-600' : 'text-purple-600'}"></i>
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
            
            document.getElementById('portalAiChatForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = document.getElementById('portalAiChatInput');
                const message = input.value.trim();
                if (!message) return;
                
                input.value = '';
                input.disabled = true;
                
                // ユーザーメッセージを即座に表示
                const container = document.getElementById('portalAiChat');
                container.innerHTML += \`
                    <div class="flex justify-end mb-2">
                        <div class="max-w-[85%] bg-green-100 rounded-lg px-3 py-2">
                            <div class="text-sm text-gray-700">\${message}</div>
                        </div>
                    </div>
                    <div class="flex justify-start mb-2" id="portalAiTyping">
                        <div class="bg-purple-50 rounded-lg px-3 py-2 border border-purple-100">
                            <i class="fas fa-circle-notch fa-spin text-purple-400 text-xs"></i>
                            <span class="text-xs text-purple-400 ml-1">回答中...</span>
                        </div>
                    </div>
                \`;
                container.scrollTop = container.scrollHeight;
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/ai-chat\`, {
                        message,
                        context_type: 'client_portal'
                    });
                    
                    document.getElementById('portalAiTyping').remove();
                    
                    const formattedResponse = formatAIResponse(response.data.response);
                    container.innerHTML += \`
                        <div class="flex justify-start mb-3">
                            <div class="max-w-[85%] bg-purple-50 rounded-lg p-3 border border-purple-100">
                                <div class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">\${formattedResponse}</div>
                            </div>
                        </div>
                    \`;
                    container.scrollTop = container.scrollHeight;
                } catch (error) {
                    document.getElementById('portalAiTyping')?.remove();
                    showMessage('error', 'AI応答の取得に失敗しました');
                }
                
                input.disabled = false;
                input.focus();
            });

            // ===============================
            // モーダル関連
            // ===============================
            
            // AIアシスタントモーダル
            function openAiModal() {
                document.getElementById('aiModal').classList.remove('hidden');
                document.getElementById('portalAiChatInput').focus();
            }
            
            function closeAiModal() {
                document.getElementById('aiModal').classList.add('hidden');
            }
            
            // AI提案モーダル
            let currentSuggestQuestionId = null;
            let currentSuggestion = '';
            
            function openAiSuggestModal(questionId) {
                currentSuggestQuestionId = questionId;
                const question = hearingQuestions.find(q => q.id === questionId);
                
                document.getElementById('suggestQuestionText').textContent = question.question_text;
                document.getElementById('suggestContent').innerHTML = \`
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <p>AIが回答を考えています...</p>
                    </div>
                \`;
                document.getElementById('suggestActions').classList.add('hidden');
                document.getElementById('aiSuggestModal').classList.remove('hidden');
                
                generateSuggestion(questionId);
            }
            
            function closeAiSuggestModal() {
                document.getElementById('aiSuggestModal').classList.add('hidden');
            }
            
            async function generateSuggestion(questionId) {
                const question = hearingQuestions.find(q => q.id === questionId);
                
                try {
                    const response = await axios.post(\`/api/clients/\${CLIENT_ID}/ai-suggest\`, {
                        question_id: questionId,
                        question_text: question.question_text
                    });
                    
                    currentSuggestion = formatAIResponse(response.data.suggestion);
                    
                    document.getElementById('suggestContent').innerHTML = \`
                        <div class="bg-purple-50 rounded-lg p-4 border border-purple-100">
                            <div class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">\${currentSuggestion}</div>
                        </div>
                    \`;
                    document.getElementById('suggestActions').classList.remove('hidden');
                } catch (error) {
                    document.getElementById('suggestContent').innerHTML = \`
                        <div class="text-center py-8 text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>提案の取得に失敗しました</p>
                        </div>
                    \`;
                }
            }
            
            function regenerateSuggestion() {
                document.getElementById('suggestContent').innerHTML = \`
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <p>別の回答を考えています...</p>
                    </div>
                \`;
                document.getElementById('suggestActions').classList.add('hidden');
                generateSuggestion(currentSuggestQuestionId);
            }
            
            function applySuggestion() {
                if (currentSuggestQuestionId && currentSuggestion) {
                    const textarea = document.getElementById(\`answer-\${currentSuggestQuestionId}\`);
                    if (textarea) {
                        textarea.value = currentSuggestion;
                        updateHearingAnswer(currentSuggestQuestionId, currentSuggestion);
                    }
                    closeAiSuggestModal();
                    showMessage('success', '回答を入力しました');
                }
            }
            
            // テンプレートモーダル
            let currentTemplateQuestionId = null;
            
            // 質問キーに基づくテンプレート辞書（各質問専用）
            const questionTemplates = {
                // ===== IT導入補助金 =====
                'company_overview': [
                    '当社は【業種】を営む企業で、創業【年数】目になります。主に【製品・サービス名】を提供しており、【地域・顧客層】のお客様を中心に事業を展開しております。',
                    '弊社は【商品・サービス】の製造・販売を主な事業としております。【技術・特徴】を強みとし、創業以来お客様との信頼関係を大切にしてまいりました。',
                    '【業種】として【年数】年の実績があります。【主力事業】を中心に、地域密着型の経営を続けてまいりました。',
                ],
                'employee_count': ['10', '25', '50', '100'],
                'annual_revenue': ['5000', '10000', '30000', '50000'],
                'current_issues': [
                    '現在、受発注業務が手作業のため、FAXや電話での注文対応に多くの時間を要しています。転記ミスや確認漏れが頻発し、顧客からのクレームにつながるケースもあります。',
                    '在庫管理が属人的で、Excelで管理しているため在庫の過不足が発生しがちです。棚卸しにも多大な時間がかかり、業務効率が悪い状態です。',
                    '顧客情報が各営業担当者の手元で管理されており、情報共有ができていません。担当者不在時の対応が困難で、顧客満足度の低下を招いています。',
                    '経理業務が紙ベースで、請求書作成や入金確認に多くの時間を費やしています。月末月初は残業が常態化しています。',
                    '生産現場の進捗管理ができておらず、納期遅延が発生しています。工程間の情報連携が不十分で、手待ち時間が多く発生しています。',
                ],
                'issue_impact': [
                    '月に約20時間の残業が発生しており、年間で約50万円の人件費増となっています。また、ミスによる再作業やクレーム対応で本来の業務に集中できない状況です。',
                    '在庫過多による保管コスト年間約100万円、欠品による機会損失が年間約200万円と試算しています。',
                    '顧客対応の遅れにより、年間5件程度の失注が発生していると推測されます。既存顧客の離反も懸念されます。',
                    '経理担当者の月末残業が平均40時間を超えており、負担が大きい状態です。',
                ],
                'target_it_tool': ['受発注システム', '会計・財務システム', '顧客管理(CRM)', '在庫管理システム', 'テレワーク関連'],
                'expected_effect': [
                    '受発注業務の自動化により、月20時間の残業削減と転記ミスゼロを目指します。年間50万円以上のコスト削減効果を見込んでいます。',
                    'システム導入により在庫の適正化を図り、保管コスト30%削減、欠品率50%減を目標としています。',
                    '顧客情報の一元管理により、対応スピードを50%向上させ、顧客満足度の改善と売上10%増を目指します。',
                    '経理業務のデジタル化により、処理時間を60%短縮し、月末の残業を解消することを目標としています。',
                ],
                'implementation_schedule': [
                    '来年3月までに本稼働させたいと考えています。',
                    '補助金交付決定後、3ヶ月以内での導入完了を希望します。',
                    '繁忙期を避け、閑散期での段階的な導入を希望します。',
                ],
                'future_vision': [
                    '3年後には売上を現在の1.5倍に、5年後には2倍に成長させることを目標としています。そのために業務効率化を進め、従業員がより付加価値の高い業務に集中できる環境を整えます。',
                    'デジタル化を推進し、生産性を30%向上させます。浮いた時間とリソースで新規顧客開拓に注力し、20社の新規取引先獲得を目指します。',
                    '業務効率化で余力を生み出し、新たな事業領域への参入を計画しています。既存の強みを活かしながら、事業の多角化を図ります。',
                ],
                // ===== ものづくり補助金 =====
                'company_strength': [
                    '当社の強みは【分野】における【年数】年の経験と実績です。特に【技術・ノウハウ】については、地域でもトップクラスの品質を誇っております。',
                    '独自開発の【技術名】により、競合他社では対応が難しい【製品・加工】が可能です。',
                    '大手メーカーとの長年の取引実績があり、品質管理体制と納期遵守率の高さが評価されています。',
                ],
                'innovation_content': [
                    '本事業では、AI/IoTを活用した検査システムの導入により、これまで熟練者の経験に頼っていた品質検査を自動化・高精度化します。',
                    '新たに【設備・技術】を導入し、従来は対応できなかった【製品・加工】の製造を可能にします。これにより新規市場への参入が実現します。',
                    '最新の生産設備を導入し、生産性を大幅に向上させるとともに、品質のばらつきを低減します。',
                ],
                'technical_challenge': [
                    '【工程】における【課題】の検出・制御が技術的課題です。解決策として、AI画像認識技術を導入し、リアルタイムでの自動判定を実現します。',
                    '現状、手作業で行っている工程でミスが発生しています。新たに自動化設備を導入することで、この課題を克服します。',
                ],
                'equipment_detail': [
                    '【メーカー名】製 【機械・システム名】 Model【型番】 処理能力：【仕様】 精度：【仕様】',
                    '【システム名】一式 ・【機器1】：【仕様】 ・【機器2】：【仕様】',
                ],
                'investment_amount': ['1500', '3500', '5000', '8000'],
                'productivity_improvement': [
                    '付加価値額を年間1,000万円増加させ、従業員一人当たりの付加価値額を15%向上させます。',
                    '生産性を3年間で10%向上させ、事業計画期間内に給与を3%引き上げます。',
                ],
                'market_expansion': [
                    '品質保証体制の強化により、医療機器/航空宇宙/自動車市場への参入を目指します。',
                    '新技術を活かし、新規分野の顧客を開拓します。展示会出展や営業活動により、10社の新規顧客獲得を目標としています。',
                ],
            };
            
            // キーワードベースのフォールバック
            const keywordTemplates = {
                'ビジョン': ['将来的には業界のリーディングカンパニーを目指し、地域社会への貢献を両立させていきます。'],
                '将来': ['3年後には現在の売上高を増加させ、新規顧客を獲得することを目標としています。'],
                '事業内容': ['当社は【業種】において、【サービス】を提供しております。創業以来【年数】年にわたり事業を展開してまいりました。'],
                '課題': ['現在、【課題内容】の面で課題を抱えており、業務効率化が必要な状況です。'],
                '効果': ['本事業の実施により、業務効率が向上し、コスト削減が見込まれます。'],
                'default': ['具体的な内容についてご記入ください。']
            };
            
            function openTemplateModal(questionId) {
                currentTemplateQuestionId = questionId;
                const question = hearingQuestions.find(q => q.id === questionId);
                
                document.getElementById('templateQuestionText').textContent = question.question_text;
                
                // まずquestion_keyで直接マッチを試みる
                let templates = questionTemplates[question.question_key] || [];
                
                // マッチしない場合はキーワードベースで検索
                if (templates.length === 0) {
                    const searchText = question.question_text + ' ' + (question.category || '');
                    for (const [keyword, temps] of Object.entries(keywordTemplates)) {
                        if (keyword !== 'default' && searchText.includes(keyword)) {
                            templates = templates.concat(temps);
                        }
                    }
                }
                
                // それでもマッチしない場合はデフォルト
                if (templates.length === 0) {
                    templates = keywordTemplates['default'];
                }
                
                // 重複を除去
                templates = [...new Set(templates)];
                
                document.getElementById('templateList').innerHTML = templates.map((template, i) => \`
                    <button onclick="applyTemplate(\${i})" 
                            class="w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
                        <div class="text-sm text-gray-700 whitespace-pre-wrap">\${template}</div>
                    </button>
                \`).join('');
                
                // グローバルに保存
                window.currentTemplates = templates;
                
                document.getElementById('templateModal').classList.remove('hidden');
            }
            
            function openTemplateModal(questionId) {
                currentTemplateQuestionId = questionId;
                const question = hearingQuestions.find(q => q.id === questionId);
                
                document.getElementById('templateQuestionText').textContent = question.question_text;
                
                // 質問キーで直接テンプレートを取得
                let templates = questionTemplates[question.question_key] || [];
                
                // テンプレートがない場合はデフォルト
                if (templates.length === 0) {
                    templates = questionTemplates['default'] || [];
                }
                
                // example_answerがあれば先頭に追加
                if (question.example_answer && templates.indexOf(question.example_answer) === -1) {
                    templates = [question.example_answer].concat(templates);
                }
                
                // 最大5件に制限
                templates = templates.slice(0, 5);
                
                if (templates.length === 0) {
                    document.getElementById('templateList').innerHTML = '<div class="text-center text-gray-500 py-4">この質問用のテンプレートはありません</div>';
                } else {
                    document.getElementById('templateList').innerHTML = templates.map(function(template, i) {
                        return '<button onclick="applyTemplate(' + i + ')" class="w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">' +
                            '<div class="text-sm text-gray-700">' + template + '</div>' +
                        '</button>';
                    }).join('');
                }
                
                // グローバルに保存
                window.currentTemplates = templates;
                
                document.getElementById('templateModal').classList.remove('hidden');
            }
            
            function closeTemplateModal() {
                document.getElementById('templateModal').classList.add('hidden');
            }
            
            function applyTemplate(index) {
                if (currentTemplateQuestionId && window.currentTemplates) {
                    const template = window.currentTemplates[index];
                    const input = document.getElementById('answer-' + currentTemplateQuestionId);
                    if (input) {
                        input.value = template;
                        updateHearingAnswer(currentTemplateQuestionId, template);
                    }
                    closeTemplateModal();
                    showMessage('success', 'テンプレートを適用しました');
                }
            }
            
            // ===============================
            // 書類データ入力機能
            // ===============================
            
            let currentDataInputType = null;
            let currentDataInputDocType = null;
            
            function showDataInputModal(type, docType) {
                currentDataInputType = type;
                currentDataInputDocType = docType;
                
                const modal = document.getElementById('dataInputModal');
                const title = document.getElementById('dataInputTitle');
                const content = document.getElementById('dataInputContent');
                
                let titleText = '';
                let formHtml = '';
                
                if (type === 'registry') {
                    titleText = '<i class="fas fa-building mr-2"></i>登記簿謄本 データ入力';
                    formHtml = \`
                        <div class="space-y-4">
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                <p class="text-sm text-yellow-800"><i class="fas fa-lightbulb mr-1"></i>登記簿謄本に記載されている内容を入力してください</p>
                            </div>
                            
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="sm:col-span-2">
                                    <label class="block text-sm font-medium mb-1">会社名（商号）<span class="text-red-500">*</span></label>
                                    <input type="text" id="reg_company_name" class="w-full px-3 py-2 border rounded-lg" placeholder="株式会社〇〇">
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="block text-sm font-medium mb-1">本店所在地<span class="text-red-500">*</span></label>
                                    <input type="text" id="reg_address" class="w-full px-3 py-2 border rounded-lg" placeholder="東京都〇〇区〇〇1-1-1">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">設立年月日</label>
                                    <input type="date" id="reg_establishment" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">資本金（円）</label>
                                    <input type="number" id="reg_capital" class="w-full px-3 py-2 border rounded-lg" placeholder="10000000">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">代表者名<span class="text-red-500">*</span></label>
                                    <input type="text" id="reg_representative" class="w-full px-3 py-2 border rounded-lg" placeholder="山田 太郎">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">代表者役職</label>
                                    <input type="text" id="reg_rep_title" class="w-full px-3 py-2 border rounded-lg" placeholder="代表取締役" value="代表取締役">
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="block text-sm font-medium mb-1">法人番号（13桁）</label>
                                    <input type="text" id="reg_corporate_number" class="w-full px-3 py-2 border rounded-lg" placeholder="1234567890123" maxlength="13">
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="block text-sm font-medium mb-1">事業目的（主なもの）</label>
                                    <textarea id="reg_business_purpose" rows="3" class="w-full px-3 py-2 border rounded-lg" placeholder="1. ソフトウェアの開発及び販売&#10;2. ITコンサルティング&#10;3. 前各号に附帯する一切の事業"></textarea>
                                </div>
                            </div>
                        </div>
                    \`;
                } else if (type === 'financial') {
                    titleText = '<i class="fas fa-file-invoice-dollar mr-2"></i>財務諸表 データ入力';
                    formHtml = \`
                        <div class="space-y-4">
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                <p class="text-sm text-yellow-800"><i class="fas fa-lightbulb mr-1"></i>決算書（損益計算書・貸借対照表）の主要項目を入力してください</p>
                            </div>
                            
                            <div class="border-b pb-2 mb-4">
                                <h4 class="font-bold text-blue-600"><i class="fas fa-calendar mr-1"></i>決算期情報</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">決算期<span class="text-red-500">*</span></label>
                                    <input type="text" id="fin_fiscal_year" class="w-full px-3 py-2 border rounded-lg" placeholder="2024年3月期">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">従業員数</label>
                                    <input type="number" id="fin_employee_count" class="w-full px-3 py-2 border rounded-lg" placeholder="25">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-green-600"><i class="fas fa-chart-line mr-1"></i>損益計算書（PL）</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">売上高（円）<span class="text-red-500">*</span></label>
                                    <input type="number" id="fin_revenue" class="w-full px-3 py-2 border rounded-lg" placeholder="100000000">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">売上原価（円）</label>
                                    <input type="number" id="fin_cost_of_sales" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">売上総利益（円）</label>
                                    <input type="number" id="fin_gross_profit" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">販売費及び一般管理費（円）</label>
                                    <input type="number" id="fin_selling_admin" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">営業利益（円）<span class="text-red-500">*</span></label>
                                    <input type="number" id="fin_operating_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">経常利益（円）</label>
                                    <input type="number" id="fin_ordinary_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">当期純利益（円）</label>
                                    <input type="number" id="fin_net_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-orange-600"><i class="fas fa-coins mr-1"></i>販管費内訳（補助金申請で重要）</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">人件費（円）<span class="text-red-500">*</span></label>
                                    <input type="number" id="fin_personnel" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">減価償却費（円）<span class="text-red-500">*</span></label>
                                    <input type="number" id="fin_depreciation" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">地代家賃（円）</label>
                                    <input type="number" id="fin_rent" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">研究開発費（円）</label>
                                    <input type="number" id="fin_rd" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-purple-600"><i class="fas fa-balance-scale mr-1"></i>貸借対照表（BS）</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">総資産（円）</label>
                                    <input type="number" id="fin_total_assets" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">流動資産（円）</label>
                                    <input type="number" id="fin_current_assets" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">負債合計（円）</label>
                                    <input type="number" id="fin_total_liabilities" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">流動負債（円）</label>
                                    <input type="number" id="fin_current_liabilities" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">純資産（円）</label>
                                    <input type="number" id="fin_net_assets" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">資本金（円）</label>
                                    <input type="number" id="fin_capital_stock" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                        </div>
                    \`;
                } else if (type === 'tax_return') {
                    titleText = '<i class="fas fa-file-alt mr-2"></i>確定申告書 データ入力';
                    formHtml = \`
                        <div class="space-y-4">
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                <p class="text-sm text-yellow-800"><i class="fas fa-lightbulb mr-1"></i>確定申告書（青色申告決算書）の内容を入力してください（個人事業主向け）</p>
                            </div>
                            
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">申告年度<span class="text-red-500">*</span></label>
                                    <input type="text" id="tax_year" class="w-full px-3 py-2 border rounded-lg" placeholder="令和5年分">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">従業員数（専従者含む）</label>
                                    <input type="number" id="tax_employee_count" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-green-600"><i class="fas fa-yen-sign mr-1"></i>収入金額</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">事業所得（営業等）<span class="text-red-500">*</span></label>
                                    <input type="number" id="tax_business_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">合計所得金額</label>
                                    <input type="number" id="tax_total_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-orange-600"><i class="fas fa-receipt mr-1"></i>必要経費</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">必要経費合計</label>
                                    <input type="number" id="tax_total_expenses" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">給料賃金</label>
                                    <input type="number" id="tax_salary_wages" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">減価償却費</label>
                                    <input type="number" id="tax_depreciation" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">地代家賃</label>
                                    <input type="number" id="tax_rent" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                            
                            <div class="border-b pb-2 mb-4 mt-6">
                                <h4 class="font-bold text-blue-600"><i class="fas fa-calculator mr-1"></i>所得・税額</h4>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-1">課税所得金額</label>
                                    <input type="number" id="tax_taxable_income" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">青色申告特別控除額</label>
                                    <input type="number" id="tax_blue_deduction" class="w-full px-3 py-2 border rounded-lg" placeholder="650000">
                                </div>
                            </div>
                        </div>
                    \`;
                }
                
                title.innerHTML = titleText;
                content.innerHTML = formHtml;
                modal.classList.remove('hidden');
                
                // 既存データがあれば読み込む
                loadExistingData(type);
            }
            
            async function loadExistingData(type) {
                try {
                    if (type === 'registry') {
                        const response = await axios.get(\`/api/clients/\${CLIENT_ID}/registry-data\`);
                        if (response.data) {
                            const d = response.data;
                            if (d.company_name) document.getElementById('reg_company_name').value = d.company_name;
                            if (d.head_office_address) document.getElementById('reg_address').value = d.head_office_address;
                            if (d.establishment_date) document.getElementById('reg_establishment').value = d.establishment_date;
                            if (d.capital_amount) document.getElementById('reg_capital').value = d.capital_amount;
                            if (d.representative_name) document.getElementById('reg_representative').value = d.representative_name;
                            if (d.representative_title) document.getElementById('reg_rep_title').value = d.representative_title;
                            if (d.corporate_number) document.getElementById('reg_corporate_number').value = d.corporate_number;
                            if (d.business_purpose && d.business_purpose.length) {
                                document.getElementById('reg_business_purpose').value = d.business_purpose.join('\\n');
                            }
                        }
                    } else if (type === 'financial') {
                        const response = await axios.get(\`/api/clients/\${CLIENT_ID}/financial-statements\`);
                        if (response.data && response.data.length > 0) {
                            const d = response.data[0];
                            if (d.fiscal_year) document.getElementById('fin_fiscal_year').value = d.fiscal_year;
                            if (d.employee_count) document.getElementById('fin_employee_count').value = d.employee_count;
                            if (d.revenue) document.getElementById('fin_revenue').value = d.revenue;
                            if (d.cost_of_sales) document.getElementById('fin_cost_of_sales').value = d.cost_of_sales;
                            if (d.gross_profit) document.getElementById('fin_gross_profit').value = d.gross_profit;
                            if (d.selling_admin_expenses) document.getElementById('fin_selling_admin').value = d.selling_admin_expenses;
                            if (d.operating_income) document.getElementById('fin_operating_income').value = d.operating_income;
                            if (d.ordinary_income) document.getElementById('fin_ordinary_income').value = d.ordinary_income;
                            if (d.net_income) document.getElementById('fin_net_income').value = d.net_income;
                            if (d.personnel_expenses) document.getElementById('fin_personnel').value = d.personnel_expenses;
                            if (d.depreciation) document.getElementById('fin_depreciation').value = d.depreciation;
                            if (d.rent_expenses) document.getElementById('fin_rent').value = d.rent_expenses;
                            if (d.rd_expenses) document.getElementById('fin_rd').value = d.rd_expenses;
                            if (d.total_assets) document.getElementById('fin_total_assets').value = d.total_assets;
                            if (d.current_assets) document.getElementById('fin_current_assets').value = d.current_assets;
                            if (d.total_liabilities) document.getElementById('fin_total_liabilities').value = d.total_liabilities;
                            if (d.current_liabilities) document.getElementById('fin_current_liabilities').value = d.current_liabilities;
                            if (d.total_net_assets) document.getElementById('fin_net_assets').value = d.total_net_assets;
                            if (d.capital_stock) document.getElementById('fin_capital_stock').value = d.capital_stock;
                        }
                    } else if (type === 'tax_return') {
                        const response = await axios.get(\`/api/clients/\${CLIENT_ID}/tax-return\`);
                        if (response.data && response.data.length > 0) {
                            const d = response.data[0];
                            if (d.tax_year) document.getElementById('tax_year').value = d.tax_year;
                            if (d.employee_count) document.getElementById('tax_employee_count').value = d.employee_count;
                            if (d.business_income) document.getElementById('tax_business_income').value = d.business_income;
                            if (d.total_income) document.getElementById('tax_total_income').value = d.total_income;
                            if (d.total_expenses) document.getElementById('tax_total_expenses').value = d.total_expenses;
                            if (d.salary_wages) document.getElementById('tax_salary_wages').value = d.salary_wages;
                            if (d.depreciation_expense) document.getElementById('tax_depreciation').value = d.depreciation_expense;
                            if (d.rent_cost) document.getElementById('tax_rent').value = d.rent_cost;
                            if (d.taxable_income) document.getElementById('tax_taxable_income').value = d.taxable_income;
                            if (d.blue_return_deduction) document.getElementById('tax_blue_deduction').value = d.blue_return_deduction;
                        }
                    }
                } catch (error) {
                    console.error('既存データ読み込みエラー:', error);
                }
            }
            
            function closeDataInputModal() {
                document.getElementById('dataInputModal').classList.add('hidden');
                currentDataInputType = null;
                currentDataInputDocType = null;
            }
            
            async function saveDataInput() {
                try {
                    let data = {};
                    let endpoint = '';
                    
                    if (currentDataInputType === 'registry') {
                        data = {
                            company_name: document.getElementById('reg_company_name').value,
                            head_office_address: document.getElementById('reg_address').value,
                            establishment_date: document.getElementById('reg_establishment').value,
                            capital_amount: parseInt(document.getElementById('reg_capital').value) || null,
                            representative_name: document.getElementById('reg_representative').value,
                            representative_title: document.getElementById('reg_rep_title').value,
                            corporate_number: document.getElementById('reg_corporate_number').value,
                            business_purpose: document.getElementById('reg_business_purpose').value.split('\\n').filter(s => s.trim()),
                            verified: true
                        };
                        endpoint = \`/api/clients/\${CLIENT_ID}/registry-data\`;
                    } else if (currentDataInputType === 'financial') {
                        data = {
                            fiscal_year: document.getElementById('fin_fiscal_year').value,
                            employee_count: parseInt(document.getElementById('fin_employee_count').value) || null,
                            revenue: parseInt(document.getElementById('fin_revenue').value) || null,
                            cost_of_sales: parseInt(document.getElementById('fin_cost_of_sales').value) || null,
                            gross_profit: parseInt(document.getElementById('fin_gross_profit').value) || null,
                            selling_admin_expenses: parseInt(document.getElementById('fin_selling_admin').value) || null,
                            operating_income: parseInt(document.getElementById('fin_operating_income').value) || null,
                            ordinary_income: parseInt(document.getElementById('fin_ordinary_income').value) || null,
                            net_income: parseInt(document.getElementById('fin_net_income').value) || null,
                            personnel_expenses: parseInt(document.getElementById('fin_personnel').value) || null,
                            depreciation: parseInt(document.getElementById('fin_depreciation').value) || null,
                            rent_expenses: parseInt(document.getElementById('fin_rent').value) || null,
                            rd_expenses: parseInt(document.getElementById('fin_rd').value) || null,
                            total_assets: parseInt(document.getElementById('fin_total_assets').value) || null,
                            current_assets: parseInt(document.getElementById('fin_current_assets').value) || null,
                            total_liabilities: parseInt(document.getElementById('fin_total_liabilities').value) || null,
                            current_liabilities: parseInt(document.getElementById('fin_current_liabilities').value) || null,
                            total_net_assets: parseInt(document.getElementById('fin_net_assets').value) || null,
                            capital_stock: parseInt(document.getElementById('fin_capital_stock').value) || null,
                            verified: true
                        };
                        endpoint = \`/api/clients/\${CLIENT_ID}/financial-statements\`;
                    } else if (currentDataInputType === 'tax_return') {
                        data = {
                            tax_year: document.getElementById('tax_year').value,
                            employee_count: parseInt(document.getElementById('tax_employee_count').value) || null,
                            business_income: parseInt(document.getElementById('tax_business_income').value) || null,
                            total_income: parseInt(document.getElementById('tax_total_income').value) || null,
                            total_expenses: parseInt(document.getElementById('tax_total_expenses').value) || null,
                            salary_wages: parseInt(document.getElementById('tax_salary_wages').value) || null,
                            depreciation_expense: parseInt(document.getElementById('tax_depreciation').value) || null,
                            rent_cost: parseInt(document.getElementById('tax_rent').value) || null,
                            taxable_income: parseInt(document.getElementById('tax_taxable_income').value) || null,
                            blue_return_deduction: parseInt(document.getElementById('tax_blue_deduction').value) || null,
                            verified: true
                        };
                        endpoint = \`/api/clients/\${CLIENT_ID}/tax-return\`;
                    }
                    
                    const response = await axios.post(endpoint, data);
                    
                    if (response.data.success) {
                        showMessage('success', 'データを保存しました！');
                        closeDataInputModal();
                        
                        // 財務諸表の場合は財務指標を表示
                        if (currentDataInputType === 'financial') {
                            setTimeout(() => showFinancialIndicators(), 500);
                        }
                    }
                } catch (error) {
                    console.error('データ保存エラー:', error);
                    showMessage('error', 'データの保存に失敗しました');
                }
            }
            
            async function showFinancialIndicators() {
                try {
                    const response = await axios.get(\`/api/clients/\${CLIENT_ID}/financial-indicators\`);
                    const indicators = response.data;
                    
                    if (!indicators || indicators.length === 0) {
                        return;
                    }
                    
                    const latest = indicators[0];
                    const modal = document.getElementById('financialIndicatorsModal');
                    const content = document.getElementById('financialIndicatorsContent');
                    
                    const formatNumber = (num) => {
                        if (num === null || num === undefined) return '-';
                        return num.toLocaleString();
                    };
                    
                    const formatPercent = (num) => {
                        if (num === null || num === undefined) return '-';
                        return (num * 100).toFixed(1) + '%';
                    };
                    
                    content.innerHTML = \`
                        <div class="space-y-4">
                            <div class="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-4 border border-green-200">
                                <h4 class="font-bold text-green-700 mb-3"><i class="fas fa-star mr-1"></i>補助金申請で重要な指標</h4>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="bg-white rounded-lg p-3 text-center">
                                        <div class="text-xs text-gray-500 mb-1">労働生産性</div>
                                        <div class="text-xl font-bold text-green-600">\${formatNumber(latest.labor_productivity)}円</div>
                                        <div class="text-xs text-gray-400">従業員1人あたり</div>
                                    </div>
                                    <div class="bg-white rounded-lg p-3 text-center">
                                        <div class="text-xs text-gray-500 mb-1">付加価値額</div>
                                        <div class="text-xl font-bold text-teal-600">\${formatNumber(latest.added_value)}円</div>
                                        <div class="text-xs text-gray-400">営業利益+人件費+減価償却</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <h4 class="font-bold text-blue-700 mb-3"><i class="fas fa-chart-pie mr-1"></i>収益性指標</h4>
                                <div class="grid grid-cols-2 gap-3 text-sm">
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">売上総利益率</span>
                                        <span class="font-medium">\${formatPercent(latest.gross_profit_margin)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">営業利益率</span>
                                        <span class="font-medium">\${formatPercent(latest.operating_profit_margin)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">経常利益率</span>
                                        <span class="font-medium">\${formatPercent(latest.ordinary_profit_margin)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">当期純利益率</span>
                                        <span class="font-medium">\${formatPercent(latest.net_profit_margin)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                <h4 class="font-bold text-purple-700 mb-3"><i class="fas fa-shield-alt mr-1"></i>安全性指標</h4>
                                <div class="grid grid-cols-2 gap-3 text-sm">
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">自己資本比率</span>
                                        <span class="font-medium">\${formatPercent(latest.equity_ratio)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">流動比率</span>
                                        <span class="font-medium">\${formatPercent(latest.current_ratio)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">ROE</span>
                                        <span class="font-medium">\${formatPercent(latest.roe)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">ROA</span>
                                        <span class="font-medium">\${formatPercent(latest.roa)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="text-xs text-gray-500 text-center mt-4">
                                <i class="fas fa-info-circle mr-1"></i>
                                これらの指標は入力された財務データから自動計算されました
                            </div>
                        </div>
                    \`;
                    
                    modal.classList.remove('hidden');
                } catch (error) {
                    console.error('財務指標取得エラー:', error);
                }
            }
            
            function closeFinancialIndicatorsModal() {
                document.getElementById('financialIndicatorsModal').classList.add('hidden');
            }
            
            // ===============================
            // 新規申込機能
            // ===============================
            
            async function openNewApplicationModal() {
                // 補助金種別を読み込む
                try {
                    const response = await axios.get('/api/subsidy-types');
                    const subsidyTypes = response.data;
                    
                    const select = document.getElementById('applicationSubsidyType');
                    select.innerHTML = '<option value="">選択してください</option>';
                    
                    // カテゴリでグループ化
                    const grouped = {};
                    subsidyTypes.forEach(type => {
                        const cat = type.category || 'その他';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(type);
                    });
                    
                    Object.entries(grouped).forEach(([category, types]) => {
                        const optgroup = document.createElement('optgroup');
                        optgroup.label = category;
                        types.forEach(type => {
                            const option = document.createElement('option');
                            option.value = type.id;
                            option.textContent = type.name;
                            optgroup.appendChild(option);
                        });
                        select.appendChild(optgroup);
                    });
                    
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
                
                document.getElementById('newApplicationModal').classList.remove('hidden');
            }
            
            function closeNewApplicationModal() {
                document.getElementById('newApplicationModal').classList.add('hidden');
                document.getElementById('newApplicationForm').reset();
            }
            
            async function submitNewApplication() {
                const form = document.getElementById('newApplicationForm');
                const formData = new FormData(form);
                
                const subsidyTypeId = formData.get('subsidy_type_id');
                const subsidySelect = document.getElementById('applicationSubsidyType');
                const subsidyTypeName = subsidySelect.options[subsidySelect.selectedIndex]?.text || '不明';
                const notes = formData.get('notes');
                const privacyAgreed = form.querySelector('[name="privacy_agreed"]').checked;
                
                if (!subsidyTypeId) {
                    showMessage('error', '補助金・助成金を選択してください');
                    return;
                }
                
                if (!privacyAgreed) {
                    showMessage('error', 'プライバシーポリシーに同意してください');
                    return;
                }
                
                try {
                    // 新規申込として通信を送信
                    await axios.post(\`/api/clients/\${CLIENT_ID}/communications\`, {
                        message: \`【新規申込希望】\\n申請種別: \${subsidyTypeName}\\n相談内容: \${notes || 'なし'}\\nプライバシーポリシー同意: 済\`,
                        sender_type: 'client',
                        sender_name: '${client.name}'
                    });
                    
                    showMessage('success', '新規申込を送信しました。担当者からご連絡いたします。');
                    closeNewApplicationModal();
                    loadCommunications();
                } catch (error) {
                    console.error('Error submitting application:', error);
                    showMessage('error', '申込の送信に失敗しました。');
                }
            }
            
            // ===============================
            // グローバルスコープに関数を公開（onclick対応）
            // ===============================
            window.openNewApplicationModal = openNewApplicationModal;
            window.closeNewApplicationModal = closeNewApplicationModal;
            window.submitNewApplication = submitNewApplication;
            window.scrollToSection = scrollToSection;
            window.switchPortalTab = switchPortalTab;
            window.openAiModal = openAiModal;
            window.closeAiModal = closeAiModal;
            window.saveAllHearingAnswers = saveAllHearingAnswers;
            window.closeUploadModal = closeUploadModal;
            window.openUploadModal = openUploadModal;
            window.openAiSuggestModal = openAiSuggestModal;
            window.closeAiSuggestModal = closeAiSuggestModal;
            window.applySuggestion = applySuggestion;
            window.regenerateSuggestion = regenerateSuggestion;
            window.closeTemplateModal = closeTemplateModal;
            window.openTemplateModal = openTemplateModal;
            window.closeDataInputModal = closeDataInputModal;
            window.saveDataInput = saveDataInput;
            window.closeFinancialIndicatorsModal = closeFinancialIndicatorsModal;
            window.completeTask = completeTask;
            window.markAnnouncementRead = markAnnouncementRead;
            window.showPaymentModal = showPaymentModal;
            window.closeBankTransferModal = closeBankTransferModal;
            window.reportBankTransfer = reportBankTransfer;
            window.switchHearingCategory = switchHearingCategory;
            window.useExampleById = useExampleById;
            window.showWritingGuide = showWritingGuide;
            window.applyTemplate = applyTemplate;
            window.showMessage = showMessage;
            
            // ===============================
            // 書類作成機能
            // ===============================
            
            // 組織の資格ステータスをキャッシュ
            let orgLicenseStatus = null;
            let selfCreationConsentGiven = false;
            
            // 書類作成モードを読み込み
            async function loadDocumentCreationMode() {
                try {
                    // 読み込み中表示
                    document.getElementById('docCreationLoading').classList.remove('hidden');
                    document.getElementById('selfCreationMode').classList.add('hidden');
                    document.getElementById('proxyCreationMode').classList.add('hidden');
                    
                    // 組織の資格ステータスを取得
                    const res = await axios.get('/api/portal/license-status?case_id=' + CASE_ID);
                    orgLicenseStatus = res.data;
                    
                    // 読み込み完了
                    document.getElementById('docCreationLoading').classList.add('hidden');
                    
                    if (orgLicenseStatus.effectiveMode === 'client_self') {
                        // 顧客自己作成モード
                        document.getElementById('selfCreationMode').classList.remove('hidden');
                        loadAvailableDocTemplates();
                        loadGeneratedDocuments();
                        checkSelfCreationConsent();
                    } else {
                        // 代行作成モード
                        document.getElementById('proxyCreationMode').classList.remove('hidden');
                        loadProxyCreatedDocuments();
                        loadPendingApprovalDocs();
                    }
                } catch (error) {
                    console.error('Failed to load license status:', error);
                    document.getElementById('docCreationLoading').innerHTML = \`
                        <div class="text-center py-8">
                            <i class="fas fa-exclamation-triangle text-3xl text-yellow-500 mb-3"></i>
                            <p class="text-gray-600">書類作成機能を読み込めませんでした</p>
                            <button onclick="loadDocumentCreationMode()" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                                再読み込み
                            </button>
                        </div>
                    \`;
                }
            }
            
            // 自己作成同意状態を確認
            function checkSelfCreationConsent() {
                // ローカルストレージから同意状態を確認
                const consentKey = 'self_creation_consent_' + CLIENT_ID;
                selfCreationConsentGiven = localStorage.getItem(consentKey) === 'true';
                
                if (selfCreationConsentGiven) {
                    document.getElementById('selfCreationConsentArea').classList.add('hidden');
                    document.getElementById('selfCreationConsentDone').classList.remove('hidden');
                    enableDocCreationButtons();
                } else {
                    document.getElementById('selfCreationConsentArea').classList.remove('hidden');
                    document.getElementById('selfCreationConsentDone').classList.add('hidden');
                    disableDocCreationButtons();
                }
            }
            
            // 同意チェックボックスのイベント
            document.getElementById('selfCreationConsent')?.addEventListener('change', async function() {
                if (this.checked) {
                    // 同意をサーバーに記録
                    try {
                        await axios.post('/api/portal/document-consent', {
                            case_id: CASE_ID,
                            consent_type: 'self_creation',
                            consent_text: '行政書士法第19条に基づき、自己責任で書類を作成することに同意しました。'
                        });
                        
                        // ローカルストレージにも保存
                        localStorage.setItem('self_creation_consent_' + CLIENT_ID, 'true');
                        selfCreationConsentGiven = true;
                        
                        document.getElementById('selfCreationConsentArea').classList.add('hidden');
                        document.getElementById('selfCreationConsentDone').classList.remove('hidden');
                        enableDocCreationButtons();
                    } catch (error) {
                        console.error('Failed to save consent:', error);
                        this.checked = false;
                        alert('同意の保存に失敗しました。再度お試しください。');
                    }
                }
            });
            
            // 書類作成ボタンを有効化
            function enableDocCreationButtons() {
                document.querySelectorAll('.doc-create-btn').forEach(btn => {
                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                });
            }
            
            // 書類作成ボタンを無効化
            function disableDocCreationButtons() {
                document.querySelectorAll('.doc-create-btn').forEach(btn => {
                    btn.disabled = true;
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                });
            }
            
            // 作成可能書類テンプレート一覧を読み込み
            async function loadAvailableDocTemplates() {
                try {
                    const container = document.getElementById('availableDocTemplates');
                    // 案件に関連する補助金タイプの必要書類を取得
                    const res = await axios.get('/api/cases/' + CASE_ID + '/document-templates');
                    const templates = res.data.templates || [];
                    
                    if (templates.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-4 text-gray-500">
                                <i class="fas fa-file-alt text-2xl mb-2 text-gray-300"></i>
                                <p>作成可能な書類テンプレートはありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    container.innerHTML = templates.map(t => \`
                        <div class="border rounded-lg p-3 hover:bg-blue-50 transition-colors">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <i class="fas fa-file-alt text-blue-600"></i>
                                    <span class="font-medium">\${t.name}</span>
                                </div>
                                <button onclick="startDocCreation('\${t.id}', '\${t.name}')" 
                                        class="doc-create-btn px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 \${selfCreationConsentGiven ? '' : 'opacity-50 cursor-not-allowed'}"
                                        \${selfCreationConsentGiven ? '' : 'disabled'}>
                                    <i class="fas fa-magic mr-1"></i>作成開始
                                </button>
                            </div>
                            \${t.description ? \`<p class="text-xs text-gray-500 mt-1">\${t.description}</p>\` : ''}
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Failed to load document templates:', error);
                    document.getElementById('availableDocTemplates').innerHTML = \`
                        <div class="text-center py-4 text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>テンプレートの読み込みに失敗しました</p>
                        </div>
                    \`;
                }
            }
            
            // 作成済み書類一覧を読み込み
            async function loadGeneratedDocuments() {
                try {
                    const container = document.getElementById('generatedDocuments');
                    const res = await axios.get('/api/cases/' + CASE_ID + '/generated-documents');
                    const docs = res.data.documents || [];
                    
                    if (docs.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-4 text-gray-500">
                                <i class="fas fa-file-alt text-2xl mb-2 text-gray-300"></i>
                                <p>まだ作成された書類はありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    container.innerHTML = docs.map(d => \`
                        <div class="border rounded-lg p-3 \${d.status === 'final' || d.status === 'approved' ? 'bg-green-50' : d.status === 'draft' ? 'bg-gray-50' : 'bg-yellow-50'}">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <i class="fas \${d.status === 'final' || d.status === 'approved' ? 'fa-file-check text-green-600' : 'fa-file-alt text-gray-400'}"></i>
                                    <span class="font-medium">\${d.name || '無題の書類'}</span>
                                </div>
                                <div class="flex gap-1">
                                    <button onclick="previewDocument(\${d.id})" class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button onclick="downloadDocument(\${d.id})" class="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                                        <i class="fas fa-download"></i>
                                    </button>
                                    <button onclick="editDocument(\${d.id})" class="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                </div>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">作成日: \${new Date(d.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Failed to load generated documents:', error);
                }
            }
            
            // 代行作成済み書類を読み込み
            async function loadProxyCreatedDocuments() {
                try {
                    const container = document.getElementById('proxyCreatedDocuments');
                    // 全ての生成書類を取得（代行作成モードでは全書類を表示）
                    const res = await axios.get('/api/cases/' + CASE_ID + '/generated-documents');
                    const docs = res.data.documents || [];
                    
                    if (docs.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-4 text-gray-500">
                                <i class="fas fa-user-tie text-2xl mb-2 text-gray-300"></i>
                                <p>作成された書類はまだありません</p>
                                <p class="text-xs mt-1">担当者が書類を作成するとここに表示されます</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    // ステータスラベルを取得
                    const getStatusLabel = (status) => {
                        const labels = {
                            'draft': '下書き',
                            'review': '確認中',
                            'final': '完成',
                            'approved': '承認済み',
                            'pending': '確認待ち'
                        };
                        return labels[status] || status;
                    };
                    
                    // ステータスに応じたスタイル
                    const getStatusStyle = (status) => {
                        if (status === 'approved' || status === 'final') return 'bg-green-100 text-green-700';
                        if (status === 'pending' || status === 'review') return 'bg-yellow-100 text-yellow-700';
                        return 'bg-gray-100 text-gray-700';
                    };
                    
                    container.innerHTML = docs.map(d => \`
                        <div class="border rounded-lg p-3 \${d.status === 'approved' || d.status === 'final' ? 'bg-green-50' : d.status === 'pending' || d.status === 'review' ? 'bg-yellow-50' : 'bg-white'}">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <i class="fas \${d.status === 'approved' || d.status === 'final' ? 'fa-check-circle text-green-600' : d.status === 'draft' ? 'fa-file-alt text-gray-400' : 'fa-clock text-yellow-600'}"></i>
                                    <span class="font-medium">\${d.name || '無題の書類'}</span>
                                </div>
                                <span class="px-2 py-0.5 rounded text-xs \${getStatusStyle(d.status)}">
                                    \${getStatusLabel(d.status)}
                                </span>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">作成日: \${new Date(d.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
                            <div class="flex gap-2 mt-2">
                                <button onclick="previewDocument(\${d.id})" class="flex-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">
                                    <i class="fas fa-eye mr-1"></i>プレビュー
                                </button>
                                <button onclick="downloadDocument(\${d.id})" class="flex-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">
                                    <i class="fas fa-download mr-1"></i>ダウンロード
                                </button>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Failed to load proxy created documents:', error);
                }
            }
            
            // 承認待ち書類を読み込み
            async function loadPendingApprovalDocs() {
                try {
                    const container = document.getElementById('pendingApprovalDocs');
                    const res = await axios.get('/api/cases/' + CASE_ID + '/generated-documents?status=pending');
                    const docs = res.data.documents || [];
                    
                    if (docs.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-4 text-gray-500">
                                <i class="fas fa-clipboard-check text-2xl mb-2 text-gray-300"></i>
                                <p>承認待ちの書類はありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    container.innerHTML = docs.map(d => \`
                        <div class="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                            <div class="flex items-center gap-2 mb-2">
                                <i class="fas fa-file-alt text-yellow-600"></i>
                                <span class="font-medium">\${d.name}</span>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="previewDocument(\${d.id})" class="flex-1 px-2 py-1 bg-white text-gray-700 rounded text-xs hover:bg-gray-50 border">
                                    <i class="fas fa-eye mr-1"></i>確認
                                </button>
                                <button onclick="approveDocument(\${d.id})" class="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                                    <i class="fas fa-check mr-1"></i>承認
                                </button>
                                <button onclick="requestRevision(\${d.id})" class="flex-1 px-2 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700">
                                    <i class="fas fa-edit mr-1"></i>修正依頼
                                </button>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Failed to load pending approval docs:', error);
                }
            }
            
            // 書類作成を開始（事業計画書をAI生成 - セクション単位で順次生成）
            async function startDocCreation(templateId, templateName) {
                if (!selfCreationConsentGiven) {
                    alert('書類作成には免責事項への同意が必要です。');
                    return;
                }
                
                // 確認ダイアログ
                if (!confirm(\`「\${templateName}」を生成します。\\n\\nヒアリング回答に基づいてAIが事業計画書を作成します。\\nセクションごとに順次生成するため、2〜3分かかる場合があります。\\n\\n続行しますか？\`)) {
                    return;
                }
                
                // ボタンを無効化
                const buttons = document.querySelectorAll('.doc-create-btn');
                buttons.forEach(btn => {
                    btn.disabled = true;
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                });
                
                // 作成可能書類エリアに生成中表示
                const container = document.getElementById('availableDocTemplates');
                const originalContent = container.innerHTML;
                
                // 進捗表示エリアを更新する関数
                function updateProgress(current, total, sectionTitle, status) {
                    container.innerHTML = \`
                        <div class="text-center py-8">
                            <i class="fas fa-spinner fa-spin text-3xl text-blue-600 mb-3"></i>
                            <p class="text-blue-700 font-medium">\${templateName} を生成中...</p>
                            <div class="mt-4 px-4">
                                <div class="bg-gray-200 rounded-full h-2 mb-2">
                                    <div class="bg-blue-600 h-2 rounded-full transition-all duration-500" style="width: \${(current / total) * 100}%"></div>
                                </div>
                                <p class="text-sm text-gray-600">\${current} / \${total} セクション完了</p>
                                <p class="text-xs text-gray-500 mt-1">\${status}: \${sectionTitle}</p>
                            </div>
                        </div>
                    \`;
                }
                
                try {
                    // Step 1: 文書の準備（文書レコード作成）
                    updateProgress(0, 1, '準備中', '処理');
                    const prepareRes = await axios.post('/api/clients/' + CLIENT_ID + '/generate-document', {
                        templateId: templateId,
                        caseId: CASE_ID
                    });
                    
                    const docId = prepareRes.data.id;
                    const sections = prepareRes.data.sections;
                    const totalSections = sections.length;
                    
                    // Step 2: 各セクションを順次生成
                    let successCount = 0;
                    let errorCount = 0;
                    
                    for (let i = 0; i < sections.length; i++) {
                        const section = sections[i];
                        updateProgress(i, totalSections, section.title, '生成中');
                        
                        try {
                            // セクションを生成
                            await axios.post('/api/generated-documents/' + docId + '/generate-section', {
                                section_id: section.id
                            });
                            successCount++;
                        } catch (sectionError) {
                            console.error('Section generation error:', section.id, sectionError);
                            errorCount++;
                            // エラーが発生しても次のセクションに進む
                        }
                        
                        // 進捗を更新
                        updateProgress(i + 1, totalSections, section.title, '完了');
                        
                        // 次のセクションまで少し待機（レート制限回避）
                        if (i < sections.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                    
                    // Step 3: 生成完了を通知
                    await axios.post('/api/generated-documents/' + docId + '/complete-generation');
                    
                    if (errorCount > 0) {
                        alert(\`「\${templateName}」の生成が完了しました。\\n\\n\${successCount}セクション成功、\${errorCount}セクションでエラーが発生しました。\\nエラーが発生したセクションは「再生成」ボタンで再度生成できます。\`);
                    } else {
                        alert('「' + templateName + '」の生成が完了しました！\\n\\n作成済み書類から確認・編集できます。');
                    }
                    
                    // 書類一覧を再読み込み
                    await loadAvailableDocTemplates();
                    await loadGeneratedDocuments();
                    
                } catch (error) {
                    console.error('Document generation error:', error);
                    const errorMsg = error.response?.data?.error || '書類の生成に失敗しました';
                    alert('エラー: ' + errorMsg);
                    // 元の内容に戻す
                    container.innerHTML = originalContent;
                } finally {
                    // ボタンを再有効化
                    buttons.forEach(btn => {
                        btn.disabled = false;
                        btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    });
                }
            }
            
            // 書類をプレビュー
            function previewDocument(docId) {
                window.open('/api/generated-documents/' + docId + '/preview', '_blank');
            }
            
            // 書類をダウンロード
            function downloadDocument(docId) {
                window.location.href = '/api/generated-documents/' + docId + '/download';
            }
            
            // 書類を編集（AI添削モーダルを開く）
            let currentEditDocId = null;
            let currentEditSections = {};
            
            async function editDocument(docId) {
                currentEditDocId = docId;
                const modal = document.getElementById('aiEditDocModal');
                const loading = document.getElementById('editDocLoading');
                const content = document.getElementById('editDocContent');
                const titleEl = document.getElementById('editDocTitle');
                
                modal.classList.remove('hidden');
                loading.classList.remove('hidden');
                content.classList.add('hidden');
                
                try {
                    // 書類データを取得
                    const res = await axios.get('/api/generated-documents/' + docId);
                    const doc = res.data.document;
                    
                    titleEl.textContent = doc.document_title || doc.document_type || '無題の書類';
                    
                    // セクションを解析
                    let sections = {};
                    if (doc.sections_content) {
                        try {
                            sections = typeof doc.sections_content === 'string' 
                                ? JSON.parse(doc.sections_content) 
                                : doc.sections_content;
                        } catch (e) {
                            sections = { content: doc.sections_content };
                        }
                    } else if (doc.content) {
                        sections = { content: doc.content };
                    }
                    
                    currentEditSections = sections;
                    
                    // セクションラベル
                    const sectionLabels = {
                        'company_overview': '会社概要・事業概要',
                        'innovation': '革新的な取組内容',
                        'equipment_plan': '設備投資計画',
                        'future_outlook': '将来の展望・期待される効果',
                        'schedule': '実施スケジュール',
                        'content': '本文'
                    };
                    
                    // 編集UIを生成
                    let html = '';
                    let sectionIndex = 0;
                    for (const [key, value] of Object.entries(sections)) {
                        sectionIndex++;
                        const label = sectionLabels[key] || key;
                        html += \`
                            <div class="bg-white rounded-lg border shadow-sm" data-section-key="\${key}">
                                <div class="flex items-center justify-between p-3 border-b bg-gray-50 rounded-t-lg">
                                    <h4 class="font-bold text-gray-800">
                                        <span class="text-purple-600 mr-2">\${sectionIndex}.</span>\${label}
                                    </h4>
                                    <button onclick="aiRefineSection('\${key}')" 
                                            class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 flex items-center gap-1">
                                        <i class="fas fa-magic"></i>
                                        <span>AI添削</span>
                                    </button>
                                </div>
                                <div class="p-3">
                                    <textarea id="section_\${key}" 
                                              class="w-full min-h-[150px] p-3 border rounded-lg text-sm leading-relaxed resize-y focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                              placeholder="内容を入力...">\${value || ''}</textarea>
                                    <div id="aiSuggestion_\${key}" class="hidden mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                        <div class="flex items-center gap-2 mb-2">
                                            <i class="fas fa-robot text-purple-600"></i>
                                            <span class="font-medium text-purple-800">AI添削提案</span>
                                        </div>
                                        <div id="suggestionContent_\${key}" class="text-sm text-gray-700 whitespace-pre-wrap"></div>
                                        <div class="flex gap-2 mt-3">
                                            <button onclick="applySectionSuggestion('\${key}')" 
                                                    class="px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
                                                <i class="fas fa-check mr-1"></i>この提案を適用
                                            </button>
                                            <button onclick="hideSectionSuggestion('\${key}')" 
                                                    class="px-3 py-1.5 border rounded text-sm hover:bg-gray-100">
                                                閉じる
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        \`;
                    }
                    
                    if (Object.keys(sections).length === 0) {
                        html = \`
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-file-alt text-4xl mb-3 text-gray-300"></i>
                                <p>編集可能なセクションがありません</p>
                            </div>
                        \`;
                    }
                    
                    content.innerHTML = html;
                    loading.classList.add('hidden');
                    content.classList.remove('hidden');
                    
                } catch (error) {
                    console.error('Failed to load document:', error);
                    loading.innerHTML = \`
                        <div class="text-center text-red-500">
                            <i class="fas fa-exclamation-circle text-3xl mb-3"></i>
                            <p>書類の読み込みに失敗しました</p>
                        </div>
                    \`;
                }
            }
            
            function closeAiEditDocModal() {
                document.getElementById('aiEditDocModal').classList.add('hidden');
                currentEditDocId = null;
                currentEditSections = {};
            }
            
            // AI添削を実行
            async function aiRefineSection(sectionKey) {
                const textarea = document.getElementById('section_' + sectionKey);
                const suggestionDiv = document.getElementById('aiSuggestion_' + sectionKey);
                const suggestionContent = document.getElementById('suggestionContent_' + sectionKey);
                
                const currentText = textarea.value;
                if (!currentText.trim()) {
                    alert('添削する内容がありません');
                    return;
                }
                
                suggestionDiv.classList.remove('hidden');
                suggestionContent.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>AIが添削しています...';
                
                try {
                    const res = await axios.post('/api/ai/refine-document', {
                        section_key: sectionKey,
                        content: currentText,
                        case_id: CASE_ID
                    });
                    
                    suggestionContent.textContent = res.data.refined || res.data.suggestion || '添削結果を取得できませんでした';
                } catch (error) {
                    console.error('AI refine error:', error);
                    suggestionContent.innerHTML = '<span class="text-red-500">添削に失敗しました。もう一度お試しください。</span>';
                }
            }
            
            // AI提案を適用
            function applySectionSuggestion(sectionKey) {
                const textarea = document.getElementById('section_' + sectionKey);
                const suggestionContent = document.getElementById('suggestionContent_' + sectionKey);
                
                textarea.value = suggestionContent.textContent;
                hideSectionSuggestion(sectionKey);
            }
            
            // AI提案を閉じる
            function hideSectionSuggestion(sectionKey) {
                document.getElementById('aiSuggestion_' + sectionKey).classList.add('hidden');
            }
            
            // 編集内容を保存
            async function saveEditedDocument() {
                if (!currentEditDocId) return;
                
                // 各セクションの値を収集
                const updatedSections = {};
                for (const key of Object.keys(currentEditSections)) {
                    const textarea = document.getElementById('section_' + key);
                    if (textarea) {
                        updatedSections[key] = textarea.value;
                    }
                }
                
                try {
                    await axios.put('/api/generated-documents/' + currentEditDocId, {
                        sections_content: JSON.stringify(updatedSections)
                    });
                    
                    alert('保存しました');
                    closeAiEditDocModal();
                    loadGeneratedDocuments();
                    loadProxyCreatedDocuments();
                } catch (error) {
                    console.error('Save error:', error);
                    alert('保存に失敗しました');
                }
            }
            
            // グローバル関数登録
            window.aiRefineSection = aiRefineSection;
            window.applySectionSuggestion = applySectionSuggestion;
            window.hideSectionSuggestion = hideSectionSuggestion;
            window.closeAiEditDocModal = closeAiEditDocModal;
            window.saveEditedDocument = saveEditedDocument;
            
            // 書類を承認
            async function approveDocument(docId) {
                if (!confirm('この書類を承認しますか？')) return;
                try {
                    await axios.post('/api/generated-documents/' + docId + '/approve');
                    loadProxyCreatedDocuments();
                    loadPendingApprovalDocs();
                    alert('書類を承認しました');
                } catch (error) {
                    console.error('Failed to approve document:', error);
                    alert('承認に失敗しました');
                }
            }
            
            // 修正を依頼
            function requestRevision(docId) {
                const comment = prompt('修正が必要な箇所を入力してください:');
                if (!comment) return;
                
                axios.post('/api/generated-documents/' + docId + '/revision', { comment })
                    .then(() => {
                        loadProxyCreatedDocuments();
                        loadPendingApprovalDocs();
                        alert('修正依頼を送信しました');
                    })
                    .catch(error => {
                        console.error('Failed to request revision:', error);
                        alert('修正依頼の送信に失敗しました');
                    });
            }
            
            // グローバル関数登録
            window.loadDocumentCreationMode = loadDocumentCreationMode;
            window.startDocCreation = startDocCreation;
            window.previewDocument = previewDocument;
            window.downloadDocument = downloadDocument;
            window.editDocument = editDocument;
            window.approveDocument = approveDocument;
            window.requestRevision = requestRevision;
            
            // ===============================
            // 初期化
            // ===============================
            
            // 初期化処理（ステータス読み込み後に他の機能を読み込む）
            async function initPortal() {
                // まずステータスを読み込む（見込みステータスの判定に必要）
                await loadStatus();
                
                // 案件セレクターを更新
                updateCaseSelector();
                
                // 案件一覧を読み込む
                loadPortalCases();
                
                // ステータス読み込み後に他の機能を並列で読み込む
                loadAnnouncements();
                loadNextActions();
                loadPipelineProgress();
                loadServiceProgress();
                loadPortalInvoices();
                loadHearingQuestions();
                loadChecklist();
                loadDocuments();
                loadCommonDocuments();
                loadCommunications();
                loadPortalAiChat();
            }
            initPortal();
        </script>
    </body>
    </html>
  `)
})

export default routes
