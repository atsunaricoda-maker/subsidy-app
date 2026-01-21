// 案件詳細ページ（管理者用）
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/case/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // organization_idでテナント分離
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  if (!orgId) {
    return c.text('Unauthorized - Organization not found', 401)
  }
  
  const caseData = await DB.prepare(`
    SELECT 
      cases.*,
      clients.name as client_name,
      clients.company_name,
      clients.email,
      clients.phone,
      clients.address,
      subsidy_types.name as subsidy_type_name,
      subsidy_types.category as subsidy_category,
      admin_users.name as assigned_to_name
    FROM cases
    LEFT JOIN clients ON cases.client_id = clients.id
    LEFT JOIN subsidy_types ON cases.subsidy_type_id = subsidy_types.id
    LEFT JOIN admin_users ON cases.assigned_to = admin_users.username
    WHERE cases.id = ? AND cases.organization_id = ?
  `).bind(id, orgId).first()
  
  if (!caseData) {
    return c.text('Case not found', 404)
  }
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${caseData.case_number} - 案件詳細</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('cases')}
            
            <!-- メインコンテンツ -->
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <div>
                                <div class="text-sm text-gray-500">案件詳細</div>
                                <h2 class="text-lg font-bold text-gray-800">No.${String(caseData.id).padStart(4, '0')} ${caseData.subsidy_type_name || ''}</h2>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <a id="docGenerateBtn" href="/client/${caseData.client_id}#ai" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm" title="書類生成画面へ">
                                <i class="fas fa-magic mr-2"></i>書類生成
                            </a>
                            <a href="/portal/${caseData.access_token}" target="_blank" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                                <i class="fas fa-external-link-alt mr-2"></i>ポータル
                            </a>
                            <button onclick="copyPortalUrl()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm">
                                <i class="fas fa-copy mr-2"></i>URL
                            </button>
                        </div>
                    </div>
                </header>
                
                <div class="p-4 lg:p-6">
                    <!-- 案件ヘッダー情報 -->
                    <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div class="flex items-center gap-4">
                                <div class="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                                    <i class="fas fa-folder-open text-2xl text-blue-600"></i>
                                </div>
                                <div>
                                    <h1 class="text-xl font-bold text-gray-900">${caseData.client_name}</h1>
                                    <div class="text-sm text-gray-500">${caseData.company_name || ''} ${caseData.address ? '/ ' + caseData.address : ''}</div>
                                    <div class="flex items-center gap-2 mt-1">
                                        <span id="statusBadge" class="px-3 py-1 rounded-full text-xs font-medium"></span>
                                        ${caseData.subsidy_type_name ? `<span class="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">${caseData.subsidy_type_name}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col gap-2">
                                <div class="flex items-center gap-2">
                                    <label class="text-sm text-gray-600">ステータス:</label>
                                    <select id="statusSelect" onchange="updateStatus()" class="border rounded-lg px-3 py-1.5 text-sm">
                                        <option value="inquiry">見込み</option>
                                        <option value="preparing">書類準備中</option>
                                        <option value="applying">申請中</option>
                                        <option value="adopted">採択・入金待ち</option>
                                        <option value="rejected">不採択</option>
                                    </select>
                                </div>
                                <div class="text-xs text-gray-500">
                                    <i class="fas fa-user mr-1"></i>担当: ${caseData.assigned_to_name || '未割り当て'}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 申請結果・完了セクション（申請中以降のステータスで表示） -->
                    <div id="resultSection" class="${caseData.status === 'applying' || caseData.status === 'adopted' || caseData.status === 'rejected' || caseData.status === 'completed' ? '' : 'hidden'} mb-6">
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div>
                                    <h3 class="text-lg font-bold mb-2">
                                        <i class="fas fa-trophy mr-2 text-yellow-500"></i>申請結果
                                    </h3>
                                    <div class="flex flex-wrap items-center gap-3">
                                        <div class="flex items-center gap-2">
                                            <label class="text-sm text-gray-600">結果:</label>
                                            <select id="resultSelect" onchange="updateResult()" class="border rounded-lg px-3 py-1.5 text-sm">
                                                <option value="">未確定</option>
                                                <option value="approved" ${caseData.result === 'approved' ? 'selected' : ''}>採択</option>
                                                <option value="rejected" ${caseData.result === 'rejected' ? 'selected' : ''}>不採択</option>
                                            </select>
                                        </div>
                                        <div id="approvedAmountField" class="${caseData.result === 'approved' ? '' : 'hidden'} flex items-center gap-2">
                                            <label class="text-sm text-gray-600">採択額:</label>
                                            <input type="number" id="approvedAmount" value="${caseData.approved_amount || ''}" 
                                                   class="border rounded-lg px-3 py-1.5 text-sm w-36" placeholder="金額" />
                                            <span class="text-sm text-gray-500">円</span>
                                            <button onclick="updateApprovedAmount()" class="text-blue-600 hover:text-blue-800 text-sm">
                                                <i class="fas fa-save"></i>
                                            </button>
                                        </div>
                                        <div id="resultDateField" class="flex items-center gap-2">
                                            <label class="text-sm text-gray-600">結果確定日:</label>
                                            <input type="date" id="resultDate" value="${caseData.result_date || ''}" 
                                                   onchange="updateResultDate()" class="border rounded-lg px-3 py-1.5 text-sm" />
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    ${caseData.is_archived ? `
                                        <span class="bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm font-medium">
                                            <i class="fas fa-check-circle mr-2"></i>完了済み
                                        </span>
                                        <button onclick="reopenCase()" class="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm">
                                            <i class="fas fa-undo mr-2"></i>案件を再開
                                        </button>
                                    ` : `
                                        <button onclick="completeCase()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">
                                            <i class="fas fa-check-circle mr-2"></i>完了する
                                        </button>
                                    `}
                                </div>
                            </div>
                            ${caseData.is_archived ? `
                                <div class="mt-3 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                                    <i class="fas fa-check-circle mr-1"></i>この案件は完了しています（リストから非表示）
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- 見込みステータス時の制限説明バナー -->
                    <div id="inquiryRestrictionBanner" class="${caseData.status === 'inquiry' ? '' : 'hidden'} mb-6">
                        <div class="bg-gradient-to-r from-yellow-400 to-amber-400 rounded-xl shadow-lg p-4 text-white">
                            <div class="flex items-start gap-4">
                                <div class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-info-circle text-2xl"></i>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-bold text-lg">現在「見込み」ステータスです</h3>
                                    <p class="text-sm opacity-90 mt-1">
                                        顧客ポータルでは<span class="font-bold">ヒアリング回答</span>と<span class="font-bold">書類アップロード</span>が制限されています。
                                    </p>
                                    <p class="text-sm opacity-90 mt-1">
                                        案件を開始するには、ステータスを「書類準備中」以降に変更してください。変更時に<span class="font-bold">1枠</span>を消費します。
                                    </p>
                                </div>
                                <button onclick="startCase()" class="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
                                    <i class="fas fa-play-circle mr-1"></i>案件を開始
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- タブナビゲーション -->
                    <div class="bg-white rounded-xl shadow-sm mb-6">
                        <div class="border-b flex overflow-x-auto">
                            <button onclick="switchTab('pipeline')" id="tab-pipeline" class="tab-btn px-6 py-3 font-medium text-blue-600 border-b-2 border-blue-600 whitespace-nowrap">
                                <i class="fas fa-tasks mr-2"></i>パイプライン
                            </button>
                            <button onclick="switchTab('documents')" id="tab-documents" class="tab-btn px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                                <i class="fas fa-file-alt mr-2"></i>書類管理
                            </button>
                            <button onclick="switchTab('hearing')" id="tab-hearing" class="tab-btn px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                                <i class="fas fa-clipboard-list mr-2"></i>ヒアリング
                            </button>
                            <button onclick="switchTab('invoices')" id="tab-invoices" class="tab-btn px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                                <i class="fas fa-file-invoice-dollar mr-2"></i>請求書
                            </button>
                            <button onclick="switchTab('communications')" id="tab-communications" class="tab-btn px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                                <i class="fas fa-comments mr-2"></i>やり取り
                            </button>
                        </div>
                    </div>
                    
                    <!-- パイプラインタブ -->
                    <div id="content-pipeline" class="tab-content">
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-bold">
                                    <i class="fas fa-tasks mr-2 text-blue-600"></i>パイプライン進捗
                                </h3>
                                <div class="flex gap-2">
                                    <button id="addTaskBtn" onclick="openAddTaskModal()" class="hidden bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                                        <i class="fas fa-plus mr-2"></i>タスク追加
                                    </button>
                                    <button onclick="openApplyPipelineModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                        <i class="fas fa-plus mr-2"></i>テンプレート適用
                                    </button>
                                </div>
                            </div>
                            <div id="pipelineProgress" class="mb-4">
                                <div class="w-full bg-gray-200 rounded-full h-3">
                                    <div id="pipelineProgressBar" class="bg-blue-600 h-3 rounded-full transition-all" style="width: 0%"></div>
                                </div>
                                <div class="text-right text-sm text-gray-600 mt-1"><span id="pipelineProgressText">0%</span></div>
                            </div>
                            <div id="pipelineTasksList" class="space-y-3">
                                <div class="text-center py-8 text-gray-500">
                                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                    <div>読み込み中...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 書類管理タブ -->
                    <div id="content-documents" class="tab-content hidden">
                        <!-- AI書類生成へのリンク -->
                        <div id="docGenerateBanner" class="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl shadow-lg p-5 mb-6 text-white">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-4">
                                    <div class="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                                        <i class="fas fa-magic text-2xl"></i>
                                    </div>
                                    <div>
                                        <h3 class="font-bold text-lg">
                                            <i class="fas fa-robot mr-2"></i>AI書類生成
                                        </h3>
                                        <p id="docGenerateBannerDesc" class="text-sm text-purple-100 mt-1">ヒアリング回答をもとにAIが事業計画書などの書類を自動生成します</p>
                                    </div>
                                </div>
                                <a id="docGenerateBannerBtn" href="/client/${caseData.client_id}#ai" class="bg-white text-purple-700 px-6 py-3 rounded-lg hover:bg-purple-50 flex items-center gap-2 font-bold shadow-md">
                                    <i class="fas fa-file-alt"></i>
                                    <span>書類生成画面へ</span>
                                </a>
                            </div>
                            <div id="docCreationModeInfo" class="mt-3 pt-3 border-t border-white/20 hidden">
                                <span id="docCreationModeLabel" class="text-xs bg-white/20 px-2 py-1 rounded"></span>
                            </div>
                        </div>
                        
                        <!-- 一括ダウンロードボタン -->
                        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-4 mb-6 border border-blue-100">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="font-bold text-blue-800">
                                        <i class="fas fa-file-archive mr-2"></i>書類一括ダウンロード
                                    </h3>
                                    <p class="text-sm text-blue-600 mt-1">案件書類と共通書類をまとめてZIPファイルでダウンロードできます</p>
                                </div>
                                <button onclick="downloadAllDocuments()" id="downloadAllBtn" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium">
                                    <i class="fas fa-download"></i>
                                    <span>一括ダウンロード</span>
                                </button>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div class="bg-white rounded-xl shadow-sm p-6">
                                <h3 class="text-lg font-bold mb-4">
                                    <i class="fas fa-list-check mr-2 text-green-600"></i>必要書類チェックリスト
                                </h3>
                                
                                <!-- チェックリストタブ -->
                                <div class="flex border-b mb-4">
                                    <button id="checklistTabCommon" onclick="switchChecklistTab('common')" 
                                            class="px-4 py-2 text-sm font-medium border-b-2 border-green-600 text-green-600 -mb-px">
                                        <i class="fas fa-building mr-1"></i>共通書類
                                        <span id="checklistCommonBadge" class="ml-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">0/0</span>
                                    </button>
                                    <button id="checklistTabCase" onclick="switchChecklistTab('case')" 
                                            class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px">
                                        <i class="fas fa-file-alt mr-1"></i>申請書類
                                        <span id="checklistCaseBadge" class="ml-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">0/0</span>
                                    </button>
                                </div>
                                
                                <!-- 共通書類コンテンツ -->
                                <div id="checklistContentCommon" class="space-y-2">
                                    <p class="text-xs text-gray-500 mb-3 bg-green-50 p-3 rounded-lg">
                                        <i class="fas fa-info-circle mr-1 text-green-600"></i>
                                        登記簿謄本、決算書など会社全体で共通して使う書類です
                                    </p>
                                    <div id="checklistCommonList" class="space-y-2">
                                        <div class="text-center py-4 text-gray-500">読み込み中...</div>
                                    </div>
                                </div>
                                
                                <!-- 申請書類コンテンツ -->
                                <div id="checklistContentCase" class="space-y-2 hidden">
                                    <p class="text-xs text-gray-500 mb-3 bg-blue-50 p-3 rounded-lg">
                                        <i class="fas fa-info-circle mr-1 text-blue-600"></i>
                                        この補助金申請に必要な専用の書類です
                                    </p>
                                    <div id="checklistCaseList" class="space-y-2">
                                        <div class="text-center py-4 text-gray-500">読み込み中...</div>
                                    </div>
                                </div>
                            </div>
                            <div class="bg-white rounded-xl shadow-sm p-6">
                                <h3 class="text-lg font-bold mb-4">
                                    <i class="fas fa-upload mr-2 text-blue-600"></i>アップロード済み書類
                                </h3>
                                <div id="uploadedDocuments" class="space-y-2">
                                    <div class="text-center py-4 text-gray-500">読み込み中...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- ヒアリングタブ -->
                    <div id="content-hearing" class="tab-content hidden">
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h3 class="text-lg font-bold mb-4">
                                <i class="fas fa-clipboard-list mr-2 text-indigo-600"></i>ヒアリング回答
                            </h3>
                            <div id="hearingProgress" class="mb-4">
                                <div class="flex items-center justify-between text-sm text-gray-600 mb-1">
                                    <span>回答進捗</span>
                                    <span id="hearingProgressText">0/0問</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div id="hearingProgressBar" class="bg-indigo-600 h-2 rounded-full transition-all" style="width: 0%"></div>
                                </div>
                            </div>
                            
                            <!-- ヒアリングタブ切り替え -->
                            <div class="flex border-b mb-4">
                                <button id="hearingTabCommon" onclick="switchHearingAnswerTab('common')" 
                                        class="px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600 -mb-px">
                                    <i class="fas fa-globe mr-1"></i>共通質問
                                    <span id="hearingCommonBadge" class="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">0/0</span>
                                </button>
                                <button id="hearingTabCase" onclick="switchHearingAnswerTab('case')" 
                                        class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px">
                                    <i class="fas fa-clipboard-list mr-1"></i>案件固有の質問
                                    <span id="hearingCaseBadge" class="ml-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">0/0</span>
                                </button>
                            </div>
                            
                            <!-- 共通質問コンテンツ -->
                            <div id="hearingContentCommon" class="space-y-4">
                                <p class="text-xs text-gray-500 mb-3 bg-blue-50 p-3 rounded-lg">
                                    <i class="fas fa-info-circle mr-1 text-blue-600"></i>
                                    共通質問の回答は、他の案件でも自動的に共有されます
                                </p>
                                <div id="hearingCommonList" class="space-y-3">
                                    <div class="text-center py-4 text-gray-500">読み込み中...</div>
                                </div>
                            </div>
                            
                            <!-- 案件固有質問コンテンツ -->
                            <div id="hearingContentCase" class="space-y-4 hidden">
                                <p class="text-xs text-gray-500 mb-3 bg-indigo-50 p-3 rounded-lg">
                                    <i class="fas fa-info-circle mr-1 text-indigo-600"></i>
                                    この申請種別専用の質問です
                                </p>
                                <div id="hearingCaseList" class="space-y-3">
                                    <div class="text-center py-4 text-gray-500">読み込み中...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 請求書タブ -->
                    <div id="content-invoices" class="tab-content hidden">
                        <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-bold">
                                    <i class="fas fa-file-invoice-dollar mr-2 text-green-600"></i>請求書一覧
                                </h3>
                                <div class="flex gap-2">
                                    <button onclick="openCreateInvoiceModal('deposit')" class="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 text-sm">
                                        <i class="fas fa-plus mr-2"></i>手付金請求書
                                    </button>
                                    <button onclick="openCreateInvoiceModal('success_fee')" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm">
                                        <i class="fas fa-plus mr-2"></i>成功報酬請求書
                                    </button>
                                </div>
                            </div>
                            <div id="invoicesList">
                                <div class="text-center py-8 text-gray-500">
                                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                    <div>読み込み中...</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 契約情報 -->
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h3 class="text-lg font-bold mb-4">
                                <i class="fas fa-file-signature mr-2 text-blue-600"></i>契約情報
                            </h3>
                            <div id="contractInfo">
                                <div class="text-center py-4 text-gray-500">読み込み中...</div>
                            </div>
                        </div>
                        
                        <!-- 報酬設定 -->
                        <div class="bg-white rounded-xl shadow-sm p-6 mt-6">
                            <h3 class="text-lg font-bold mb-4">
                                <i class="fas fa-coins mr-2 text-yellow-600"></i>報酬設定
                            </h3>
                            <div id="rewardSettingsContent">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <!-- 手付金 -->
                                    <div class="border rounded-lg p-4">
                                        <div class="flex items-center justify-between mb-3">
                                            <h4 class="font-medium text-gray-800">
                                                <i class="fas fa-hand-holding-usd mr-2 text-yellow-500"></i>手付金
                                            </h4>
                                            <span id="depositStatus" class="${caseData.deposit_paid ? 'text-green-600' : 'text-yellow-600'} text-sm font-medium">
                                                ${caseData.deposit_paid ? '<i class="fas fa-check-circle mr-1"></i>支払済' : '<i class="fas fa-clock mr-1"></i>未払'}
                                            </span>
                                        </div>
                                        <div class="space-y-2">
                                            <label class="flex items-center gap-2">
                                                <input type="checkbox" id="depositRequiredEdit" ${caseData.deposit_required ? 'checked' : ''} onchange="updateRewardSettings()" class="rounded text-blue-600">
                                                <span class="text-sm">手付金あり</span>
                                            </label>
                                            <div id="depositAmountEditField" class="${caseData.deposit_required ? '' : 'hidden'} space-y-2">
                                                <div class="flex items-center justify-between">
                                                    <label class="block text-xs text-gray-500">金額（円）</label>
                                                    <div class="flex items-center gap-1">
                                                        <button type="button" id="depositTaxExcluding" onclick="setDepositTaxMode('excluding')" 
                                                                class="text-xs px-2 py-0.5 rounded ${caseData.deposit_tax_included ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white'}">税抜</button>
                                                        <button type="button" id="depositTaxIncluding" onclick="setDepositTaxMode('including')" 
                                                                class="text-xs px-2 py-0.5 rounded ${caseData.deposit_tax_included ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}">税込</button>
                                                    </div>
                                                </div>
                                                <input type="number" id="depositAmountEdit" value="${caseData.deposit_amount || ''}" 
                                                       class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 50000" oninput="calculateDepositPreview()">
                                                <input type="hidden" id="depositTaxIncludedEdit" value="${caseData.deposit_tax_included ? '1' : '0'}">
                                                <p id="depositCalcHint" class="text-xs text-gray-500">${caseData.deposit_tax_included ? '税込金額を入力' : '税抜金額を入力（税込は自動計算）'}</p>
                                                <div id="depositPreview" class="text-xs bg-gray-50 rounded p-2 ${caseData.deposit_amount ? '' : 'hidden'}">
                                                    <span id="depositPreviewText"></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- 成功報酬 -->
                                    <div class="border rounded-lg p-4">
                                        <div class="flex items-center justify-between mb-3">
                                            <h4 class="font-medium text-gray-800">
                                                <i class="fas fa-trophy mr-2 text-purple-500"></i>成功報酬
                                            </h4>
                                            <span id="successFeeStatus" class="text-gray-500 text-sm">
                                                ${caseData.success_fee_enabled ? (caseData.success_fee_rate ? caseData.success_fee_rate + '%' : '¥' + (caseData.success_fee_amount || 0).toLocaleString()) : '未設定'}
                                            </span>
                                        </div>
                                        <div class="space-y-2">
                                            <label class="flex items-center gap-2">
                                                <input type="checkbox" id="successFeeEnabledEdit" ${caseData.success_fee_enabled ? 'checked' : ''} onchange="toggleSuccessFeeEdit()" class="rounded text-blue-600">
                                                <span class="text-sm">成功報酬あり</span>
                                            </label>
                                            <div id="successFeeEditFields" class="${caseData.success_fee_enabled ? '' : 'hidden'} space-y-2">
                                                <div>
                                                    <label class="block text-xs text-gray-500 mb-1">報酬タイプ</label>
                                                    <select id="successFeeTypeEdit" onchange="toggleSuccessFeeTypeEdit()" class="w-full px-3 py-2 border rounded-lg text-sm">
                                                        <option value="percentage" ${caseData.success_fee_rate > 0 ? 'selected' : ''}>％（採択額に対する割合）</option>
                                                        <option value="fixed" ${caseData.success_fee_amount > 0 && !caseData.success_fee_rate ? 'selected' : ''}>固定金額</option>
                                                    </select>
                                                </div>
                                                <div id="successFeePercentageEditField" class="${caseData.success_fee_rate > 0 || caseData.success_fee_amount == 0 ? '' : 'hidden'}">
                                                    <label class="block text-xs text-gray-500 mb-1">成功報酬率（%）</label>
                                                    <input type="number" id="successFeePercentageEdit" value="${caseData.success_fee_rate || ''}" 
                                                           class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 10" min="0" max="100" step="0.1">
                                                </div>
                                                <div id="successFeeAmountEditField" class="${caseData.success_fee_amount > 0 && !caseData.success_fee_rate ? '' : 'hidden'} space-y-2">
                                                    <div class="flex items-center justify-between">
                                                        <label class="block text-xs text-gray-500">固定報酬額（円）</label>
                                                        <div class="flex items-center gap-1">
                                                            <button type="button" id="successFeeTaxExcluding" onclick="setSuccessFeeTaxMode('excluding')" 
                                                                    class="text-xs px-2 py-0.5 rounded ${caseData.success_fee_tax_included ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white'}">税抜</button>
                                                            <button type="button" id="successFeeTaxIncluding" onclick="setSuccessFeeTaxMode('including')" 
                                                                    class="text-xs px-2 py-0.5 rounded ${caseData.success_fee_tax_included ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}">税込</button>
                                                        </div>
                                                    </div>
                                                    <input type="number" id="successFeeAmountEdit" value="${caseData.success_fee_amount || ''}" 
                                                           class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 100000" min="0" oninput="calculateSuccessFeePreview()">
                                                    <input type="hidden" id="successFeeTaxIncludedEdit" value="${caseData.success_fee_tax_included ? '1' : '0'}">
                                                    <p id="successFeeCalcHint" class="text-xs text-gray-500">${caseData.success_fee_tax_included ? '税込金額を入力' : '税抜金額を入力（税込は自動計算）'}</p>
                                                    <div id="successFeePreview" class="text-xs bg-gray-50 rounded p-2 ${caseData.success_fee_amount ? '' : 'hidden'}">
                                                        <span id="successFeePreviewText"></span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-4 flex justify-end">
                                    <button onclick="saveRewardSettings()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                        <i class="fas fa-save mr-2"></i>報酬設定を保存
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- やり取りタブ -->
                    <div id="content-communications" class="tab-content hidden">
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h3 class="text-lg font-bold mb-4">
                                <i class="fas fa-comments mr-2 text-green-600"></i>やり取り記録
                            </h3>
                            <div id="communicationsList" class="space-y-3 mb-4 max-h-96 overflow-y-auto">
                                <div class="text-center py-4 text-gray-500">読み込み中...</div>
                            </div>
                            <form id="communicationForm" class="border-t pt-4">
                                <textarea id="communicationMessage" rows="3" class="w-full px-3 py-2 border rounded-lg mb-2" placeholder="メッセージを入力..."></textarea>
                                <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                                    <i class="fas fa-paper-plane mr-2"></i>送信
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- パイプラインテンプレート適用モーダル -->
        <div id="applyPipelineModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div class="p-6 border-b">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-bold">パイプラインテンプレートを適用</h3>
                        <button onclick="closeApplyPipelineModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div class="p-6">
                    <select id="pipelineTemplateSelect" class="w-full px-3 py-2 border rounded-lg mb-4">
                        <option value="">テンプレートを選択...</option>
                    </select>
                    <div id="templateDescription" class="text-sm text-gray-600 mb-4 hidden"></div>
                    <div class="flex gap-3">
                        <button onclick="applyPipelineTemplate()" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                            <i class="fas fa-check mr-2"></i>適用
                        </button>
                        <button onclick="closeApplyPipelineModal()" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
                            キャンセル
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- タスク追加モーダル -->
        <div id="addTaskModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div class="p-6 border-b">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-bold">タスクを追加</h3>
                        <button onclick="closeAddTaskModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <form id="addTaskForm" class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">挿入位置</label>
                        <select name="insert_position" id="insertPositionSelect" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500">
                            <option value="0">先頭に追加</option>
                            <!-- タスク一覧がここに動的に追加される -->
                        </select>
                        <p class="text-xs text-gray-500 mt-1">選択したタスクの後に挿入されます</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">タスク名 <span class="text-red-500">*</span></label>
                        <input type="text" name="task_name" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">タスクタイプ</label>
                        <select name="task_type" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500">
                            <option value="internal">自社タスク</option>
                            <option value="external">顧客タスク</option>
                            <option value="both">両方</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">開始日</label>
                            <input type="date" name="start_date" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">終了日</label>
                            <input type="date" name="end_date" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">説明</label>
                        <textarea name="description" rows="2" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"></textarea>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="submit" class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                            <i class="fas fa-plus mr-2"></i>追加
                        </button>
                        <button type="button" onclick="closeAddTaskModal()" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- 請求書作成モーダル -->
        <div id="createInvoiceModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b">
                    <div class="flex items-center justify-between">
                        <h3 id="invoiceModalTitle" class="text-xl font-bold">請求書を作成</h3>
                        <button onclick="closeCreateInvoiceModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <form id="createInvoiceForm" class="p-6 space-y-4">
                    <input type="hidden" name="invoice_type" id="invoiceType" value="deposit">
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">品目名 <span class="text-red-500">*</span></label>
                        <input type="text" name="item_name" id="invoiceItemName" required 
                               class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">品目詳細</label>
                        <textarea name="item_description" id="invoiceItemDescription" rows="2" 
                                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" 
                                  placeholder="詳細説明があれば入力"></textarea>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label class="block text-sm font-medium">金額 <span class="text-red-500">*</span></label>
                                <div class="flex items-center gap-2">
                                    <button type="button" id="inputModeExcludingTax" onclick="setInputMode('excluding')" 
                                            class="text-xs px-2 py-1 rounded bg-blue-600 text-white">税抜</button>
                                    <button type="button" id="inputModeIncludingTax" onclick="setInputMode('including')" 
                                            class="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300">税込</button>
                                </div>
                            </div>
                            <div class="relative">
                                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                                <input type="number" name="subtotal" id="invoiceSubtotal" required min="0"
                                       class="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                       oninput="calculateInvoiceTotal()">
                            </div>
                            <p id="inputModeHint" class="text-xs text-gray-500 mt-1">税抜金額を入力してください</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">消費税率</label>
                            <select name="tax_rate" id="invoiceTaxRate" class="w-full px-3 py-2 border rounded-lg" onchange="calculateInvoiceTotal()">
                                <option value="10">10%</option>
                                <option value="8">8%（軽減税率）</option>
                                <option value="0">0%（非課税）</option>
                            </select>
                        </div>
                    </div>
                    
                    <div id="withholdingSection" class="hidden">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="invoiceWithholding" onchange="calculateInvoiceTotal()">
                            <span class="text-sm">源泉徴収を適用（10.21%）</span>
                        </label>
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="flex justify-between text-sm mb-1">
                            <span>小計</span>
                            <span id="calcSubtotal">¥0</span>
                        </div>
                        <div class="flex justify-between text-sm mb-1">
                            <span>消費税</span>
                            <span id="calcTax">¥0</span>
                        </div>
                        <div id="calcWithholdingRow" class="hidden flex justify-between text-sm mb-1 text-orange-600">
                            <span>源泉徴収</span>
                            <span id="calcWithholding">-¥0</span>
                        </div>
                        <div class="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                            <span>請求金額</span>
                            <span id="calcTotal" class="text-blue-600">¥0</span>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">発行日</label>
                            <input type="date" name="issue_date" id="invoiceIssueDate" 
                                   class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">支払期限</label>
                            <input type="date" name="due_date" id="invoiceDueDate" 
                                   class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">備考</label>
                        <textarea name="notes" id="invoiceNotes" rows="2" 
                                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" 
                                  placeholder="請求書に記載する備考"></textarea>
                    </div>
                    
                    <div class="flex gap-3 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                            <i class="fas fa-file-invoice mr-2"></i>作成（下書き）
                        </button>
                        <button type="button" onclick="createAndIssueInvoice()" class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                            <i class="fas fa-paper-plane mr-2"></i>作成して発行
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const CASE_ID = ${id};
            const CLIENT_ID = ${caseData.client_id};
            const SUBSIDY_TYPE_ID = ${caseData.subsidy_type_id || 'null'};
            const PORTAL_TOKEN = '${caseData.access_token}';
            const PORTAL_URL = '${new URL(c.req.url).origin}/portal/${caseData.access_token}';
            const SUCCESS_FEE_ENABLED = ${caseData.success_fee_enabled ? 'true' : 'false'};
            const SUCCESS_FEE_RATE = ${caseData.success_fee_rate || 0};
            const SUCCESS_FEE_AMOUNT = ${caseData.success_fee_amount || 0};
            const APPROVED_AMOUNT = ${caseData.approved_amount || 0};
            
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
            
            // 認証チェック
            function checkAuth() {
                const token = localStorage.getItem('admin_token');
                if (!token) {
                    window.location.href = '/login';
                    return false;
                }
                return true;
            }
            if (!checkAuth()) { /* redirect */ }
            
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('admin_token');
            
            // サイドバートグル
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                sidebar.classList.toggle('-translate-x-full');
            }
            
            // タブ切り替え
            function switchTab(tabId) {
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
                    btn.classList.add('text-gray-500');
                });
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.add('hidden');
                });
                
                document.getElementById('tab-' + tabId).classList.remove('text-gray-500');
                document.getElementById('tab-' + tabId).classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
                document.getElementById('content-' + tabId).classList.remove('hidden');
            }
            
            // 現在のステータスを追跡
            let currentCaseStatus = '${caseData.status || 'inquiry'}';
            
            // 案件を開始（見込み→書類準備中）
            async function startCase() {
                // 見込みステータスでない場合は何もしない
                if (currentCaseStatus !== 'inquiry') {
                    showToast('既に案件は開始されています', 'info');
                    return;
                }
                
                // 確認モーダルを表示
                const confirmed = await showSlotConfirmDialog();
                if (!confirmed) {
                    return;
                }
                
                try {
                    // ステータスを「書類準備中(preparing)」に変更
                    await axios.put(\`/api/cases/\${CASE_ID}\`, { status: 'preparing' });
                    currentCaseStatus = 'preparing';
                    
                    // UIを更新
                    document.getElementById('statusSelect').value = 'preparing';
                    updateStatusBadge('preparing');
                    
                    // 見込みバナーを非表示
                    const inquiryBanner = document.getElementById('inquiryRestrictionBanner');
                    if (inquiryBanner) {
                        inquiryBanner.classList.add('hidden');
                    }
                    
                    showToast('案件を開始しました！', 'success');
                } catch (error) {
                    console.error('Start case error:', error);
                    const errorMessage = error.response?.data?.error || '案件の開始に失敗しました';
                    
                    // 枠不足エラーの場合は特別なメッセージを表示
                    if (errorMessage.includes('枠') || errorMessage.includes('slot')) {
                        alert('枠が不足しています。\\n\\n案件を開始するには、利用可能な枠が必要です。\\n\\n管理画面の「プラン・枠管理」から追加枠を購入してください。');
                    } else {
                        alert(errorMessage);
                    }
                }
            }
            window.startCase = startCase;
            
            // ステータス更新
            async function updateStatus() {
                const newStatus = document.getElementById('statusSelect').value;
                
                // 見込み → 他ステータスへの変更時は確認ダイアログを表示
                if (currentCaseStatus === 'inquiry' && newStatus !== 'inquiry') {
                    const confirmed = await showSlotConfirmDialog();
                    if (!confirmed) {
                        document.getElementById('statusSelect').value = currentCaseStatus;
                        return;
                    }
                }
                
                try {
                    await axios.put(\`/api/cases/\${CASE_ID}\`, { status: newStatus });
                    currentCaseStatus = newStatus;
                    updateStatusBadge(newStatus);
                    showToast('ステータスを更新しました');
                    
                    // 完了/採択/不採択ステータスの場合は結果セクションを表示
                    const resultSection = document.getElementById('resultSection');
                    if (['completed', 'adopted', 'rejected'].includes(newStatus)) {
                        resultSection.classList.remove('hidden');
                    } else {
                        resultSection.classList.add('hidden');
                    }
                    
                    // 見込みバナーの表示制御
                    const inquiryBanner = document.getElementById('inquiryRestrictionBanner');
                    if (newStatus === 'inquiry') {
                        inquiryBanner.classList.remove('hidden');
                    } else {
                        inquiryBanner.classList.add('hidden');
                    }
                } catch (error) {
                    console.error('Status update error:', error);
                    const errorMessage = error.response?.data?.error || '更新に失敗しました';
                    
                    // 枠不足エラーの場合は特別なメッセージを表示
                    if (errorMessage.includes('枠') || errorMessage.includes('slot')) {
                        alert('枠が不足しています。\\n\\n見込み → 他のステータスに変更するには、利用可能な枠が必要です。\\n\\n管理画面の「プラン・枠管理」から追加枠を購入してください。');
                    } else {
                        alert(errorMessage);
                    }
                    document.getElementById('statusSelect').value = currentCaseStatus;
                }
            }
            
            // 採択/不採択の更新
            async function updateResult() {
                const result = document.getElementById('resultSelect').value;
                const approvedAmountField = document.getElementById('approvedAmountField');
                
                // 採択の場合のみ採択額フィールドを表示
                if (result === 'approved') {
                    approvedAmountField.classList.remove('hidden');
                } else {
                    approvedAmountField.classList.add('hidden');
                }
                
                try {
                    await axios.put(\`/api/cases/\${CASE_ID}\`, { result: result || null });
                    showToast(result === 'approved' ? '採択として記録しました' : result === 'rejected' ? '不採択として記録しました' : '結果をクリアしました');
                } catch (error) {
                    console.error('Result update error:', error);
                    alert('更新に失敗しました');
                }
            }
            
            // 採択額の更新
            async function updateApprovedAmount() {
                const amount = parseInt(document.getElementById('approvedAmount').value) || 0;
                try {
                    await axios.put(\`/api/cases/\${CASE_ID}\`, { approved_amount: amount });
                    showToast('採択額を更新しました');
                } catch (error) {
                    console.error('Approved amount update error:', error);
                    alert('更新に失敗しました');
                }
            }
            
            // 結果確定日の更新
            async function updateResultDate() {
                const date = document.getElementById('resultDate').value;
                try {
                    await axios.put(\`/api/cases/\${CASE_ID}\`, { result_date: date || null });
                    showToast('結果確定日を更新しました');
                } catch (error) {
                    console.error('Result date update error:', error);
                    alert('更新に失敗しました');
                }
            }
            
            // 完了する
            async function completeCase() {
                if (!confirm('この案件を完了しますか？\\n\\n完了した案件は案件一覧に表示されなくなりますが、「完了済み」タブから確認できます。')) {
                    return;
                }
                try {
                    await axios.put(\`/api/cases/\${CASE_ID}\`, { is_archived: true, status: 'completed' });
                    showToast('完了しました');
                    window.location.reload();
                } catch (error) {
                    console.error('Complete error:', error);
                    alert('完了に失敗しました');
                }
            }
            
            // 完了解除（再開）
            async function reopenCase() {
                if (!confirm('この案件を再開しますか？\\n\\n案件一覧に表示されるようになります。')) {
                    return;
                }
                try {
                    await axios.put(\`/api/cases/\${CASE_ID}\`, { is_archived: false, status: 'applying' });
                    showToast('案件を再開しました');
                    window.location.reload();
                } catch (error) {
                    console.error('Reopen error:', error);
                    alert('案件の再開に失敗しました');
                }
            }
            
            // 枠消費確認ダイアログ
            function showSlotConfirmDialog() {
                return new Promise((resolve) => {
                    const modal = document.createElement('div');
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
                    modal.innerHTML = \`
                        <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                            <div class="bg-gradient-to-r from-blue-500 to-blue-600 p-5 text-white">
                                <div class="flex items-center gap-4">
                                    <div class="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                                        <i class="fas fa-rocket text-3xl"></i>
                                    </div>
                                    <div>
                                        <h3 class="font-bold text-xl">案件を開始しますか？</h3>
                                        <p class="text-sm opacity-90">本格的な申請サポートを開始します</p>
                                    </div>
                                </div>
                            </div>
                            <div class="p-5">
                                <!-- 案件開始後の流れ -->
                                <div class="mb-5">
                                    <h4 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <i class="fas fa-list-ol text-blue-500"></i>案件開始後の流れ
                                    </h4>
                                    <div class="space-y-3">
                                        <div class="flex items-start gap-3">
                                            <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">1</div>
                                            <div>
                                                <div class="font-medium text-gray-800">ヒアリング回答の依頼</div>
                                                <div class="text-xs text-gray-500">顧客ポータルでヒアリングシートへの回答が可能になります</div>
                                            </div>
                                        </div>
                                        <div class="flex items-start gap-3">
                                            <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">2</div>
                                            <div>
                                                <div class="font-medium text-gray-800">必要書類の収集</div>
                                                <div class="text-xs text-gray-500">顧客が書類をアップロードできるようになります</div>
                                            </div>
                                        </div>
                                        <div class="flex items-start gap-3">
                                            <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">3</div>
                                            <div>
                                                <div class="font-medium text-gray-800">申請書類の作成・提出</div>
                                                <div class="text-xs text-gray-500">パイプラインに沿って申請をサポート</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- 注意事項 -->
                                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
                                    <div class="flex items-start gap-3">
                                        <i class="fas fa-exclamation-triangle text-amber-500 mt-0.5"></i>
                                        <div class="text-sm text-amber-800">
                                            <p class="font-medium mb-1">ご確認ください</p>
                                            <ul class="list-disc list-inside space-y-1 text-amber-700">
                                                <li>利用可能な枠を<strong>1枠消費</strong>します</li>
                                                <li>「見込み」ステータスには戻せません</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="flex gap-3">
                                    <button onclick="this.closest('.fixed').remove(); window._slotConfirmResolve(false);" 
                                            class="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">
                                        キャンセル
                                    </button>
                                    <button onclick="this.closest('.fixed').remove(); window._slotConfirmResolve(true);" 
                                            class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md">
                                        <i class="fas fa-play-circle mr-2"></i>案件を開始する
                                    </button>
                                </div>
                            </div>
                        </div>
                    \`;
                    document.body.appendChild(modal);
                    window._slotConfirmResolve = resolve;
                });
            }
            
            function updateStatusBadge(status) {
                const badge = document.getElementById('statusBadge');
                badge.textContent = STATUS_LABELS[status];
                badge.className = 'px-3 py-1 rounded-full text-xs font-medium ' + STATUS_COLORS[status];
                
                // 見込みステータス時の制限バナーの表示/非表示
                const restrictionBanner = document.getElementById('inquiryRestrictionBanner');
                if (restrictionBanner) {
                    if (status === 'inquiry') {
                        restrictionBanner.classList.remove('hidden');
                    } else {
                        restrictionBanner.classList.add('hidden');
                    }
                }
            }
            
            // URL コピー
            function copyPortalUrl() {
                navigator.clipboard.writeText(PORTAL_URL).then(() => {
                    showToast('ポータルURLをコピーしました');
                });
            }
            
            // 書類一括ダウンロード
            async function downloadAllDocuments() {
                const btn = document.getElementById('downloadAllBtn');
                const originalContent = btn.innerHTML;
                
                try {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>準備中...</span>';
                    
                    const response = await axios.get(\`/api/cases/\${CASE_ID}/documents/download-all\`);
                    
                    if (!response.data.success || response.data.files.length === 0) {
                        showToast('ダウンロードする書類がありません');
                        return;
                    }
                    
                    btn.innerHTML = '<i class="fas fa-cog fa-spin"></i><span>ZIP作成中...</span>';
                    
                    // JSZipを動的にロード
                    if (!window.JSZip) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                            script.onload = resolve;
                            script.onerror = reject;
                            document.head.appendChild(script);
                        });
                    }
                    
                    const zip = new JSZip();
                    
                    // ファイルをZIPに追加
                    for (const file of response.data.files) {
                        const binaryString = atob(file.data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        zip.file(file.name, bytes);
                    }
                    
                    // ZIPを生成してダウンロード
                    const content = await zip.generateAsync({ type: 'blob' });
                    const url = URL.createObjectURL(content);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = response.data.zipFileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    showToast(\`\${response.data.totalFiles}件の書類をダウンロードしました\`);
                } catch (error) {
                    console.error('Download error:', error);
                    if (error.response?.status === 404) {
                        showToast('ダウンロードする書類がありません');
                    } else {
                        showToast('ダウンロードに失敗しました');
                    }
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            }
            
            // トースト表示
            function showToast(message) {
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50';
                toast.textContent = message;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }
            
            // 案件データ読み込み
            async function loadCaseData() {
                try {
                    const response = await axios.get(\`/api/cases/\${CASE_ID}\`);
                    const caseData = response.data;
                    
                    document.getElementById('statusSelect').value = caseData.status;
                    updateStatusBadge(caseData.status);
                } catch (error) {
                    console.error('Error loading case data:', error);
                }
            }
            
            // パイプライン読み込み
            async function loadPipeline() {
                try {
                    const response = await axios.get(\`/api/cases/\${CASE_ID}/pipelines\`);
                    const tasks = response.data;
                    
                    const container = document.getElementById('pipelineTasksList');
                    const addTaskBtn = document.getElementById('addTaskBtn');
                    
                    if (!tasks || tasks.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-tasks text-4xl mb-3 text-gray-300"></i>
                                <p>パイプラインが設定されていません</p>
                                <button onclick="openApplyPipelineModal()" class="mt-3 text-blue-600 hover:text-blue-700">
                                    <i class="fas fa-plus mr-1"></i>テンプレートを適用
                                </button>
                            </div>
                        \`;
                        document.getElementById('pipelineProgressBar').style.width = '0%';
                        document.getElementById('pipelineProgressText').textContent = '0%';
                        addTaskBtn.classList.add('hidden');
                        currentPipelineId = null;
                        currentPipelineTasks = [];
                        return;
                    }
                    
                    // パイプラインIDを取得してタスク追加ボタンを表示
                    currentPipelineId = tasks[0].pipeline_id;
                    currentPipelineTasks = tasks;  // タスク一覧を保存
                    addTaskBtn.classList.remove('hidden');
                    
                    const completed = tasks.filter(t => t.status === 'completed').length;
                    const progress = Math.round((completed / tasks.length) * 100);
                    document.getElementById('pipelineProgressBar').style.width = progress + '%';
                    document.getElementById('pipelineProgressText').textContent = progress + '% (' + completed + '/' + tasks.length + ')';
                    
                    container.innerHTML = tasks.map((task, index) => {
                        const statusClass = {
                            pending: 'bg-gray-100 text-gray-600',
                            in_progress: 'bg-blue-100 text-blue-700',
                            completed: 'bg-green-100 text-green-700'
                        }[task.status] || 'bg-gray-100 text-gray-600';
                        
                        const statusLabel = {
                            pending: '未着手',
                            in_progress: '進行中',
                            completed: '完了'
                        }[task.status] || task.status;
                        
                        const taskTypeLabel = task.task_type === 'external' ? '顧客' : task.task_type === 'both' ? '両方' : '自社';
                        
                        return \`
                            <div class="border rounded-lg p-4 \${task.status === 'completed' ? 'bg-green-50' : ''}">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        <span class="w-8 h-8 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold">\${index + 1}</span>
                                        <div>
                                            <div class="font-medium">\${task.task_name}</div>
                                            <div class="text-xs text-gray-500">
                                                <span class="px-1.5 py-0.5 rounded bg-gray-100">\${taskTypeLabel}</span>
                                                \${task.is_required ? '<span class="text-red-500 ml-1">*必須</span>' : ''}
                                                \${task.start_date ? ' | 期間: ' + task.start_date + ' 〜 ' + task.end_date : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <select onchange="updateTaskStatus(\${task.id}, this.value)" class="text-xs border rounded px-2 py-1">
                                            <option value="pending" \${task.status === 'pending' ? 'selected' : ''}>未着手</option>
                                            <option value="in_progress" \${task.status === 'in_progress' ? 'selected' : ''}>進行中</option>
                                            <option value="completed" \${task.status === 'completed' ? 'selected' : ''}>完了</option>
                                        </select>
                                    </div>
                                </div>
                                \${task.description ? '<p class="text-sm text-gray-600 mt-2 ml-11">' + task.description + '</p>' : ''}
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading pipeline:', error);
                    document.getElementById('pipelineTasksList').innerHTML = '<div class="text-center py-4 text-red-500">読み込みエラー</div>';
                }
            }
            
            // タスクステータス更新
            async function updateTaskStatus(taskId, status) {
                try {
                    await axios.put(\`/api/pipeline-tasks/\${taskId}\`, { status });
                    showToast('タスクを更新しました');
                    loadPipeline();
                } catch (error) {
                    alert('更新に失敗しました');
                    loadPipeline();
                }
            }
            
            // タスク追加モーダル
            let currentPipelineId = null;
            let currentPipelineTasks = [];
            
            async function openAddTaskModal() {
                document.getElementById('addTaskModal').classList.remove('hidden');
                document.getElementById('addTaskForm').reset();
                
                // デフォルトで今日の日付を設定
                const today = new Date().toISOString().split('T')[0];
                document.querySelector('#addTaskForm input[name="start_date"]').value = today;
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + 7);
                document.querySelector('#addTaskForm input[name="end_date"]').value = endDate.toISOString().split('T')[0];
                
                // 挿入位置のセレクトボックスを更新
                const select = document.getElementById('insertPositionSelect');
                select.innerHTML = '<option value="0">先頭に追加</option>';
                
                currentPipelineTasks.forEach((task, index) => {
                    const option = document.createElement('option');
                    option.value = task.sort_order;
                    option.textContent = \`\${index + 1}. \${task.task_name} の後\`;
                    select.appendChild(option);
                });
                
                // デフォルトで最後を選択
                if (currentPipelineTasks.length > 0) {
                    select.value = currentPipelineTasks[currentPipelineTasks.length - 1].sort_order;
                }
            }
            
            function closeAddTaskModal() {
                document.getElementById('addTaskModal').classList.add('hidden');
            }
            
            // タスク追加フォーム送信
            document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (!currentPipelineId) {
                    alert('パイプラインが設定されていません');
                    return;
                }
                
                const formData = new FormData(e.target);
                const insertAfter = parseInt(formData.get('insert_position')) || 0;
                
                const data = {
                    pipeline_id: currentPipelineId,
                    task_name: formData.get('task_name'),
                    task_type: formData.get('task_type') || 'internal',
                    start_date: formData.get('start_date') || null,
                    end_date: formData.get('end_date') || null,
                    description: formData.get('description') || '',
                    insert_after: insertAfter
                };
                
                try {
                    await axios.post('/api/pipeline-tasks', data);
                    showToast('タスクを追加しました');
                    closeAddTaskModal();
                    loadPipeline();
                } catch (error) {
                    console.error('Error adding task:', error);
                    alert('タスクの追加に失敗しました');
                }
            });
            
            // チェックリストタブ切り替え
            window.switchChecklistTab = function(tab) {
                const commonTab = document.getElementById('checklistTabCommon');
                const caseTab = document.getElementById('checklistTabCase');
                const commonContent = document.getElementById('checklistContentCommon');
                const caseContent = document.getElementById('checklistContentCase');
                
                if (tab === 'common') {
                    commonTab.className = 'px-4 py-2 text-sm font-medium border-b-2 border-green-600 text-green-600 -mb-px';
                    caseTab.className = 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px';
                    commonContent.classList.remove('hidden');
                    caseContent.classList.add('hidden');
                } else {
                    caseTab.className = 'px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600 -mb-px';
                    commonTab.className = 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px';
                    caseContent.classList.remove('hidden');
                    commonContent.classList.add('hidden');
                }
            };
            
            // 書類読み込み
            async function loadDocuments() {
                try {
                    // 共通書類タイプ、案件チェックリスト、アップロード済み書類を取得
                    const [commonTypesRes, checklistRes, docsRes, commonDocsRes] = await Promise.all([
                        axios.get('/api/common-document-types'),
                        axios.get(\`/api/cases/\${CASE_ID}/document-checklist\`),
                        axios.get(\`/api/cases/\${CASE_ID}/documents\`),
                        axios.get(\`/api/clients/\${CLIENT_ID}/common-documents\`)
                    ]);
                    
                    const commonTypes = commonTypesRes.data || [];
                    const checklist = checklistRes.data || [];
                    const documents = docsRes.data || [];
                    const commonDocs = commonDocsRes.data || [];
                    
                    // 全書類を統合（共通書類 + 案件書類）
                    const allDocuments = [...documents, ...commonDocs.map(d => ({...d, isCommon: true}))];
                    const uploadedTypes = new Set(allDocuments.map(d => d.document_type || d.type_name));
                    const uploadedTypesArray = allDocuments.map(d => (d.document_type || d.type_name || '').toLowerCase());
                    
                    // チェックリスト項目をレンダリングするヘルパー関数
                    function renderChecklistItem(item, docs, isCommonType = false) {
                        const itemType = (item.document_type || item.name || '').toLowerCase();
                        const isUploaded = uploadedTypes.has(item.document_type || item.name) || 
                            uploadedTypesArray.some(ut => ut && itemType && (ut.includes(itemType) || itemType.includes(ut)));
                        
                        const matchedDocs = docs.filter(d => {
                            const docType = (d.document_type || d.type_name || '').toLowerCase();
                            return docType === itemType || docType.includes(itemType) || itemType.includes(docType);
                        });
                        
                        const displayName = item.document_type || item.name;
                        const description = item.description || '';
                        const isRequired = item.is_required;
                        
                        return \`
                            <div class="flex items-center gap-3 p-3 rounded-lg border \${isUploaded ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}">
                                <i class="fas fa-\${isUploaded ? 'check-circle text-green-500' : 'circle text-gray-300'} text-lg"></i>
                                <div class="flex-1">
                                    <div class="text-sm font-medium">\${displayName}</div>
                                    \${description ? '<div class="text-xs text-gray-500">' + description + '</div>' : ''}
                                    \${isUploaded && matchedDocs.length > 0 ? \`
                                        <div class="text-xs text-green-600 mt-1">
                                            <i class="fas fa-file mr-1"></i>\${matchedDocs.length}件アップロード済み
                                        </div>
                                    \` : ''}
                                </div>
                                \${isRequired ? '<span class="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded">必須</span>' : ''}
                            </div>
                        \`;
                    }
                    
                    // 共通書類チェックリスト
                    const commonListContainer = document.getElementById('checklistCommonList');
                    if (commonTypes.length === 0) {
                        commonListContainer.innerHTML = '<div class="text-gray-500 text-center py-4">共通書類タイプがありません</div>';
                    } else {
                        const commonUploaded = commonTypes.filter(t => {
                            const typeName = (t.name || '').toLowerCase();
                            return uploadedTypesArray.some(ut => ut && typeName && (ut.includes(typeName) || typeName.includes(ut)));
                        }).length;
                        document.getElementById('checklistCommonBadge').textContent = \`\${commonUploaded}/\${commonTypes.length}\`;
                        commonListContainer.innerHTML = commonTypes.map(t => renderChecklistItem({
                            document_type: t.name,
                            description: t.description,
                            is_required: true
                        }, allDocuments, true)).join('');
                    }
                    
                    // 申請書類チェックリスト
                    const caseListContainer = document.getElementById('checklistCaseList');
                    if (checklist.length === 0) {
                        caseListContainer.innerHTML = '<div class="text-gray-500 text-center py-4">申請書類チェックリストがありません</div>';
                    } else {
                        const caseUploaded = checklist.filter(item => {
                            const itemType = (item.document_type || '').toLowerCase();
                            return uploadedTypesArray.some(ut => ut && itemType && (ut.includes(itemType) || itemType.includes(ut)));
                        }).length;
                        document.getElementById('checklistCaseBadge').textContent = \`\${caseUploaded}/\${checklist.length}\`;
                        caseListContainer.innerHTML = checklist.map(item => renderChecklistItem(item, allDocuments)).join('');
                    }
                    
                    // アップロード済み
                    const docsContainer = document.getElementById('uploadedDocuments');
                    if (documents.length === 0) {
                        docsContainer.innerHTML = '<div class="text-gray-500 text-center py-4">アップロードされた書類はありません</div>';
                    } else {
                        docsContainer.innerHTML = documents.map(doc => {
                            const statusClass = {
                                pending: 'bg-yellow-100 text-yellow-700',
                                approved: 'bg-green-100 text-green-700',
                                rejected: 'bg-red-100 text-red-700'
                            }[doc.status] || 'bg-gray-100';
                            const statusLabel = { pending: '確認待ち', approved: '承認済み', rejected: '差し戻し' }[doc.status] || doc.status;
                            const isPending = doc.status === 'pending' || !doc.status;
                            const isImage = /\\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(doc.file_name);
                            const isPdf = /\\.pdf$/i.test(doc.file_name);
                            const canPreview = isImage || isPdf;
                            
                            return \`
                                <div class="border rounded-lg p-3 hover:shadow-md transition \${isPending ? 'bg-yellow-50 border-yellow-200' : ''}">
                                    <div class="flex items-start gap-3">
                                        <div class="w-10 h-10 rounded-lg \${isImage ? 'bg-purple-100' : isPdf ? 'bg-red-100' : 'bg-blue-100'} flex items-center justify-center flex-shrink-0">
                                            <i class="fas \${isImage ? 'fa-image text-purple-600' : isPdf ? 'fa-file-pdf text-red-600' : 'fa-file text-blue-600'}"></i>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 mb-1">
                                                <span class="text-sm font-medium text-gray-800 truncate">\${doc.document_type}</span>
                                                <span class="px-2 py-0.5 rounded text-xs \${statusClass}">\${statusLabel}</span>
                                            </div>
                                            <div class="text-xs text-gray-500 truncate">\${doc.file_name}</div>
                                            <div class="text-xs text-gray-400 mt-1">
                                                \${doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : ''}
                                                \${doc.uploaded_by === 'client' ? ' · 顧客アップロード' : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2 mt-3 pt-3 border-t">
                                        \${canPreview ? \`
                                            <button onclick="previewDocument(\${doc.id}, '\${doc.file_name}', '\${doc.document_type}')" 
                                                    class="flex-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                                                <i class="fas fa-eye mr-1"></i>プレビュー
                                            </button>
                                        \` : ''}
                                        <a href="/api/documents/\${doc.id}/download" 
                                           class="flex-1 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center">
                                            <i class="fas fa-download mr-1"></i>ダウンロード
                                        </a>
                                        \${isPending ? \`
                                            <button onclick="approveDocument(\${doc.id})" 
                                                    class="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                                                <i class="fas fa-check mr-1"></i>承認
                                            </button>
                                            <button onclick="rejectDocument(\${doc.id})" 
                                                    class="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                                                <i class="fas fa-times mr-1"></i>差戻
                                            </button>
                                        \` : ''}
                                    </div>
                                </div>
                            \`;
                        }).join('');
                    }
                } catch (error) {
                    console.error('Error loading documents:', error);
                }
            }
            
            // 書類プレビューモーダル
            async function previewDocument(docId, fileName, docType) {
                const isImage = /\\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
                const isPdf = /\\.pdf$/i.test(fileName);
                
                const modal = document.createElement('div');
                modal.id = 'documentPreviewModal';
                modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4';
                modal.innerHTML = \`
                    <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <div class="p-4 border-b flex items-center justify-between">
                            <div>
                                <h3 class="font-bold text-lg">\${docType}</h3>
                                <p class="text-sm text-gray-500">\${fileName}</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <a href="/api/documents/\${docId}/download" 
                                   class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                                    <i class="fas fa-download mr-1"></i>ダウンロード
                                </a>
                                <button onclick="document.getElementById('documentPreviewModal').remove()" 
                                        class="p-2 text-gray-500 hover:text-gray-700">
                                    <i class="fas fa-times text-xl"></i>
                                </button>
                            </div>
                        </div>
                        <div class="flex-1 overflow-auto p-4 bg-gray-100 flex items-center justify-center min-h-[400px]">
                            \${isImage ? \`
                                <img src="/api/documents/\${docId}/download" alt="\${fileName}" 
                                     class="max-w-full max-h-full object-contain rounded shadow-lg" />
                            \` : isPdf ? \`
                                <iframe src="/api/documents/\${docId}/download#toolbar=0" 
                                        class="w-full h-full min-h-[500px] rounded shadow-lg bg-white"></iframe>
                            \` : \`
                                <div class="text-gray-500 text-center">
                                    <i class="fas fa-file text-6xl mb-4"></i>
                                    <p>このファイル形式はプレビューできません</p>
                                    <p class="text-sm mt-2">ダウンロードして確認してください</p>
                                </div>
                            \`}
                        </div>
                    </div>
                \`;
                document.body.appendChild(modal);
                
                // モーダル外クリックで閉じる
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) modal.remove();
                });
            }
            window.previewDocument = previewDocument;
            
            // 書類承認
            async function approveDocument(docId) {
                if (!confirm('この書類を承認しますか？')) return;
                
                try {
                    await axios.put(\`/api/documents/\${docId}/status\`, { status: 'approved' });
                    showToast('書類を承認しました', 'success');
                    loadDocuments();
                } catch (error) {
                    console.error('Error approving document:', error);
                    showToast('承認に失敗しました', 'error');
                }
            }
            window.approveDocument = approveDocument;
            
            // 書類差し戻し
            async function rejectDocument(docId) {
                const reason = prompt('差し戻しの理由を入力してください（任意）:');
                if (reason === null) return; // キャンセル
                
                try {
                    await axios.put(\`/api/documents/\${docId}/status\`, { status: 'rejected', reason: reason });
                    showToast('書類を差し戻しました', 'info');
                    loadDocuments();
                } catch (error) {
                    console.error('Error rejecting document:', error);
                    showToast('差し戻しに失敗しました', 'error');
                }
            }
            window.rejectDocument = rejectDocument;
            
            // ヒアリングタブ切り替え
            function switchHearingAnswerTab(tab) {
                const commonTab = document.getElementById('hearingTabCommon');
                const caseTab = document.getElementById('hearingTabCase');
                const commonContent = document.getElementById('hearingContentCommon');
                const caseContent = document.getElementById('hearingContentCase');
                
                if (tab === 'common') {
                    commonTab.className = 'px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600 -mb-px';
                    caseTab.className = 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px';
                    commonContent.classList.remove('hidden');
                    caseContent.classList.add('hidden');
                } else {
                    caseTab.className = 'px-4 py-2 text-sm font-medium border-b-2 border-indigo-600 text-indigo-600 -mb-px';
                    commonTab.className = 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px';
                    caseContent.classList.remove('hidden');
                    commonContent.classList.add('hidden');
                }
            }
            window.switchHearingAnswerTab = switchHearingAnswerTab;
            
            // ヒアリング読み込み
            async function loadHearing() {
                try {
                    const [answersRes] = await Promise.all([
                        axios.get(\`/api/cases/\${CASE_ID}/hearing-answers\`)
                    ]);
                    
                    const answers = answersRes.data;
                    const commonList = document.getElementById('hearingCommonList');
                    const caseList = document.getElementById('hearingCaseList');
                    
                    // 共通質問（subsidy_type_id = 0）と案件固有の質問を分離
                    const commonQuestions = answers.filter(a => a.subsidy_type_id === 0);
                    const caseQuestions = answers.filter(a => a.subsidy_type_id !== 0);
                    
                    // 質問をHTML化する関数
                    const renderQuestion = (a) => \`
                        <div class="border rounded-lg p-4 hover:bg-gray-50 transition">
                            <div class="font-medium text-gray-800 mb-2">
                                \${a.question_text || 'Q: ' + a.question_id}
                                \${a.is_required ? '<span class="text-red-500 text-xs ml-1">*必須</span>' : ''}
                            </div>
                            <div class="bg-gray-50 rounded p-3 text-sm">
                                \${a.answer_text || '<span class="text-gray-400 italic">未回答</span>'}
                            </div>
                            \${a.category ? '<div class="text-xs text-gray-400 mt-2"><i class="fas fa-tag mr-1"></i>' + a.category + '</div>' : ''}
                        </div>
                    \`;
                    
                    // 共通質問リスト
                    if (commonQuestions.length > 0) {
                        commonList.innerHTML = commonQuestions.map(renderQuestion).join('');
                    } else {
                        commonList.innerHTML = '<div class="text-gray-500 text-center py-4">共通質問はありません</div>';
                    }
                    
                    // 案件固有質問リスト
                    if (caseQuestions.length > 0) {
                        caseList.innerHTML = caseQuestions.map(renderQuestion).join('');
                    } else {
                        caseList.innerHTML = '<div class="text-gray-500 text-center py-4">案件固有の質問はありません</div>';
                    }
                    
                    // バッジ更新
                    const commonAnswered = commonQuestions.filter(q => q.answer_text).length;
                    const caseAnswered = caseQuestions.filter(q => q.answer_text).length;
                    document.getElementById('hearingCommonBadge').textContent = \`\${commonAnswered}/\${commonQuestions.length}\`;
                    document.getElementById('hearingCaseBadge').textContent = \`\${caseAnswered}/\${caseQuestions.length}\`;
                    
                    // 全体進捗
                    const total = answers.length;
                    const answered = answers.filter(a => a.answer_text).length;
                    const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
                    
                    document.getElementById('hearingProgressText').textContent = answered + '/' + total + '問';
                    document.getElementById('hearingProgressBar').style.width = progress + '%';
                } catch (error) {
                    console.error('Error loading hearing:', error);
                }
            }
            
            // 請求書一覧読み込み
            async function loadInvoices() {
                try {
                    const response = await axios.get(\`/api/cases/\${CASE_ID}/invoices\`);
                    const invoices = response.data;
                    
                    const container = document.getElementById('invoicesList');
                    
                    if (invoices.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-file-invoice text-4xl mb-3 opacity-50"></i>
                                <div>請求書はまだ発行されていません</div>
                                <div class="text-sm mt-2">上部のボタンから請求書を作成してください</div>
                            </div>
                        \`;
                        loadContractInfo();
                        return;
                    }
                    
                    const statusLabels = {
                        draft: { label: '下書き', color: 'bg-gray-100 text-gray-600' },
                        issued: { label: '発行済み', color: 'bg-blue-100 text-blue-700' },
                        sent: { label: '送付済み', color: 'bg-yellow-100 text-yellow-700' },
                        payment_reported: { label: '振込報告済み', color: 'bg-purple-100 text-purple-700' },
                        paid: { label: '入金済み', color: 'bg-green-100 text-green-700' },
                        cancelled: { label: 'キャンセル', color: 'bg-red-100 text-red-700' }
                    };
                    const typeLabels = {
                        deposit: { label: '手付金', color: 'text-yellow-600', icon: 'fa-hand-holding-usd' },
                        success_fee: { label: '成功報酬', color: 'text-purple-600', icon: 'fa-trophy' },
                        other: { label: 'その他', color: 'text-gray-600', icon: 'fa-file-invoice' }
                    };
                    
                    container.innerHTML = \`
                        <div class="space-y-3">
                            \${invoices.map(inv => {
                                const status = statusLabels[inv.status] || statusLabels.draft;
                                const type = typeLabels[inv.invoice_type] || typeLabels.other;
                                return \`
                                    <div class="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50">
                                        <div class="text-2xl \${type.color}">
                                            <i class="fas \${type.icon}"></i>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2">
                                                <span class="font-bold">\${inv.invoice_number}</span>
                                                <span class="text-xs px-2 py-0.5 rounded \${status.color}">\${status.label}</span>
                                            </div>
                                            <div class="text-sm text-gray-600">\${inv.item_name}</div>
                                            <div class="text-xs text-gray-400">
                                                発行日: \${inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '未設定'}
                                                \${inv.due_date ? ' / 期限: ' + new Date(inv.due_date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : ''}
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-lg font-bold">¥\${inv.total_amount.toLocaleString()}</div>
                                            <div class="text-xs text-gray-500">(税込)</div>
                                        </div>
                                        <div class="flex gap-2">
                                            \${inv.status === 'draft' ? \`
                                                <button onclick="editInvoice(\${inv.id})" class="bg-yellow-500 text-white px-3 py-1.5 rounded text-sm hover:bg-yellow-600">
                                                    <i class="fas fa-edit mr-1"></i>編集
                                                </button>
                                                <button onclick="issueInvoice(\${inv.id})" class="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">
                                                    <i class="fas fa-paper-plane mr-1"></i>発行
                                                </button>
                                            \` : ''}
                                            \${inv.status === 'issued' || inv.status === 'sent' || inv.status === 'payment_reported' ? \`
                                                <button onclick="markInvoicePaid(\${inv.id})" class="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">
                                                    <i class="fas fa-check mr-1"></i>入金確認
                                                </button>
                                            \` : ''}
                                            <button onclick="viewInvoiceDetail(\${inv.id})" class="bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-300">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            \${inv.status === 'draft' ? \`
                                                <button onclick="deleteInvoice(\${inv.id})" class="bg-red-100 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-200">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            \` : ''}
                                        </div>
                                    </div>
                                \`;
                            }).join('')}
                        </div>
                    \`;
                    
                    loadContractInfo();
                } catch (error) {
                    console.error('Error loading invoices:', error);
                    document.getElementById('invoicesList').innerHTML = \`
                        <div class="text-center py-8 text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <div>請求書の読み込みに失敗しました</div>
                        </div>
                    \`;
                }
            }
            
            // 契約情報を読み込む
            async function loadContractInfo() {
                try {
                    const response = await axios.get(\`/api/cases/\${CASE_ID}\`);
                    const caseData = response.data;
                    const contractContainer = document.getElementById('contractInfo');
                    
                    contractContainer.innerHTML = \`
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm text-gray-600 mb-1">電子契約URL</label>
                                <div class="flex gap-2">
                                    <input type="url" id="contractUrlInput" value="\${caseData.contract_url || ''}" 
                                           placeholder="https://..." 
                                           class="flex-1 px-3 py-2 border rounded-lg text-sm">
                                    <button onclick="saveContractUrl()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                        <i class="fas fa-save mr-1"></i>保存
                                    </button>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">CloudSign、freeeサインなどの電子契約URL</p>
                            </div>
                            \${caseData.contract_url ? \`
                                <a href="\${caseData.contract_url}" target="_blank" class="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                                    <i class="fas fa-file-signature text-xl text-blue-600"></i>
                                    <div class="flex-1">
                                        <div class="font-medium text-blue-700">契約書を開く</div>
                                        <div class="text-xs text-blue-500 truncate">\${caseData.contract_url}</div>
                                    </div>
                                    <i class="fas fa-external-link-alt text-blue-400"></i>
                                </a>
                            \` : ''}
                        </div>
                    \`;
                } catch (error) {
                    console.error('Error loading contract info:', error);
                }
            }
            
            // 報酬設定の編集関連関数
            function toggleSuccessFeeEdit() {
                const checkbox = document.getElementById('successFeeEnabledEdit');
                const fields = document.getElementById('successFeeEditFields');
                if (checkbox.checked) {
                    fields.classList.remove('hidden');
                } else {
                    fields.classList.add('hidden');
                }
            }
            window.toggleSuccessFeeEdit = toggleSuccessFeeEdit;
            
            function toggleSuccessFeeTypeEdit() {
                const type = document.getElementById('successFeeTypeEdit').value;
                const percentageField = document.getElementById('successFeePercentageEditField');
                const amountField = document.getElementById('successFeeAmountEditField');
                
                if (type === 'percentage') {
                    percentageField.classList.remove('hidden');
                    amountField.classList.add('hidden');
                    document.getElementById('successFeeAmountEdit').value = '';
                } else {
                    percentageField.classList.add('hidden');
                    amountField.classList.remove('hidden');
                    document.getElementById('successFeePercentageEdit').value = '';
                }
            }
            window.toggleSuccessFeeTypeEdit = toggleSuccessFeeTypeEdit;
            
            function updateRewardSettings() {
                const depositRequired = document.getElementById('depositRequiredEdit').checked;
                const depositField = document.getElementById('depositAmountEditField');
                if (depositRequired) {
                    depositField.classList.remove('hidden');
                    calculateDepositPreview();
                } else {
                    depositField.classList.add('hidden');
                }
            }
            window.updateRewardSettings = updateRewardSettings;
            
            // 手付金の税込/税抜モード切替
            let depositTaxMode = '${caseData.deposit_tax_included ? 'including' : 'excluding'}';
            function setDepositTaxMode(mode) {
                depositTaxMode = mode;
                document.getElementById('depositTaxIncludedEdit').value = mode === 'including' ? '1' : '0';
                const excludingBtn = document.getElementById('depositTaxExcluding');
                const includingBtn = document.getElementById('depositTaxIncluding');
                const hint = document.getElementById('depositCalcHint');
                
                if (mode === 'excluding') {
                    excludingBtn.className = 'text-xs px-2 py-0.5 rounded bg-blue-600 text-white';
                    includingBtn.className = 'text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600';
                    hint.textContent = '税抜金額を入力（税込は自動計算）';
                } else {
                    excludingBtn.className = 'text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600';
                    includingBtn.className = 'text-xs px-2 py-0.5 rounded bg-green-600 text-white';
                    hint.textContent = '税込金額を入力';
                }
                calculateDepositPreview();
            }
            window.setDepositTaxMode = setDepositTaxMode;
            
            // 手付金プレビュー計算
            function calculateDepositPreview() {
                const inputValue = parseInt(document.getElementById('depositAmountEdit').value) || 0;
                const preview = document.getElementById('depositPreview');
                const previewText = document.getElementById('depositPreviewText');
                
                if (inputValue <= 0) {
                    preview.classList.add('hidden');
                    return;
                }
                
                preview.classList.remove('hidden');
                const taxRate = 10;
                
                if (depositTaxMode === 'including') {
                    // 税込入力：税抜を逆算
                    const subtotal = inputValue - Math.floor(inputValue - inputValue / (1 + taxRate / 100));
                    const tax = inputValue - subtotal;
                    previewText.innerHTML = '税込 <strong>¥' + inputValue.toLocaleString() + '</strong> → 税抜 ¥' + subtotal.toLocaleString() + ' + 消費税 ¥' + tax.toLocaleString();
                } else {
                    // 税抜入力：税込を計算
                    const tax = Math.floor(inputValue * taxRate / 100);
                    const total = inputValue + tax;
                    previewText.innerHTML = '税抜 ¥' + inputValue.toLocaleString() + ' + 消費税 ¥' + tax.toLocaleString() + ' = <strong>税込 ¥' + total.toLocaleString() + '</strong>';
                }
            }
            window.calculateDepositPreview = calculateDepositPreview;
            
            // 成功報酬の税込/税抜モード切替
            let successFeeTaxMode = '${caseData.success_fee_tax_included ? 'including' : 'excluding'}';
            function setSuccessFeeTaxMode(mode) {
                successFeeTaxMode = mode;
                document.getElementById('successFeeTaxIncludedEdit').value = mode === 'including' ? '1' : '0';
                const excludingBtn = document.getElementById('successFeeTaxExcluding');
                const includingBtn = document.getElementById('successFeeTaxIncluding');
                const hint = document.getElementById('successFeeCalcHint');
                
                if (mode === 'excluding') {
                    excludingBtn.className = 'text-xs px-2 py-0.5 rounded bg-blue-600 text-white';
                    includingBtn.className = 'text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600';
                    hint.textContent = '税抜金額を入力（税込は自動計算）';
                } else {
                    excludingBtn.className = 'text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600';
                    includingBtn.className = 'text-xs px-2 py-0.5 rounded bg-green-600 text-white';
                    hint.textContent = '税込金額を入力';
                }
                calculateSuccessFeePreview();
            }
            window.setSuccessFeeTaxMode = setSuccessFeeTaxMode;
            
            // 成功報酬プレビュー計算
            function calculateSuccessFeePreview() {
                const inputValue = parseInt(document.getElementById('successFeeAmountEdit').value) || 0;
                const preview = document.getElementById('successFeePreview');
                const previewText = document.getElementById('successFeePreviewText');
                
                if (inputValue <= 0) {
                    preview.classList.add('hidden');
                    return;
                }
                
                preview.classList.remove('hidden');
                const taxRate = 10;
                
                if (successFeeTaxMode === 'including') {
                    // 税込入力：税抜を逆算
                    const subtotal = inputValue - Math.floor(inputValue - inputValue / (1 + taxRate / 100));
                    const tax = inputValue - subtotal;
                    previewText.innerHTML = '税込 <strong>¥' + inputValue.toLocaleString() + '</strong> → 税抜 ¥' + subtotal.toLocaleString() + ' + 消費税 ¥' + tax.toLocaleString();
                } else {
                    // 税抜入力：税込を計算
                    const tax = Math.floor(inputValue * taxRate / 100);
                    const total = inputValue + tax;
                    previewText.innerHTML = '税抜 ¥' + inputValue.toLocaleString() + ' + 消費税 ¥' + tax.toLocaleString() + ' = <strong>税込 ¥' + total.toLocaleString() + '</strong>';
                }
            }
            window.calculateSuccessFeePreview = calculateSuccessFeePreview;
            
            async function saveRewardSettings() {
                try {
                    const depositRequired = document.getElementById('depositRequiredEdit').checked;
                    const depositAmount = parseInt(document.getElementById('depositAmountEdit').value) || 0;
                    const depositTaxIncluded = document.getElementById('depositTaxIncludedEdit').value === '1';
                    const successFeeEnabled = document.getElementById('successFeeEnabledEdit').checked;
                    const successFeeType = document.getElementById('successFeeTypeEdit')?.value || 'percentage';
                    const successFeeRate = parseFloat(document.getElementById('successFeePercentageEdit')?.value) || 0;
                    const successFeeAmount = parseInt(document.getElementById('successFeeAmountEdit')?.value) || 0;
                    const successFeeTaxIncluded = document.getElementById('successFeeTaxIncludedEdit')?.value === '1';
                    
                    const data = {
                        deposit_required: depositRequired ? 1 : 0,
                        deposit_amount: depositAmount,
                        deposit_tax_included: depositTaxIncluded ? 1 : 0,
                        success_fee_enabled: successFeeEnabled ? 1 : 0,
                        success_fee_rate: successFeeType === 'percentage' ? successFeeRate : 0,
                        success_fee_amount: successFeeType === 'fixed' ? successFeeAmount : 0,
                        success_fee_tax_included: successFeeTaxIncluded ? 1 : 0
                    };
                    
                    await axios.put(\`/api/cases/\${CASE_ID}\`, data);
                    showToast('報酬設定を保存しました', 'success');
                    
                    // ステータス表示を更新
                    const statusSpan = document.getElementById('successFeeStatus');
                    if (statusSpan) {
                        if (successFeeEnabled) {
                            statusSpan.textContent = successFeeType === 'percentage' ? successFeeRate + '%' : '¥' + successFeeAmount.toLocaleString();
                        } else {
                            statusSpan.textContent = '未設定';
                        }
                    }
                } catch (error) {
                    console.error('Error saving reward settings:', error);
                    showToast('報酬設定の保存に失敗しました', 'error');
                }
            }
            window.saveRewardSettings = saveRewardSettings;
            
            // 請求書作成モーダルを開く
            let currentInvoiceType = 'deposit';
            
            function openCreateInvoiceModal(type) {
                currentInvoiceType = type;
                document.getElementById('invoiceType').value = type;
                
                const modal = document.getElementById('createInvoiceModal');
                const title = document.getElementById('invoiceModalTitle');
                const itemNameInput = document.getElementById('invoiceItemName');
                const withholdingSection = document.getElementById('withholdingSection');
                const subtotalInput = document.getElementById('invoiceSubtotal');
                const descriptionInput = document.getElementById('invoiceItemDescription');
                
                if (type === 'deposit') {
                    title.textContent = '手付金請求書を作成';
                    itemNameInput.value = '補助金申請サポート 着手金';
                    withholdingSection.classList.add('hidden');
                    subtotalInput.value = '';
                    descriptionInput.value = '';
                } else {
                    title.textContent = '成功報酬請求書を作成';
                    itemNameInput.value = '補助金申請サポート 成功報酬';
                    withholdingSection.classList.remove('hidden');
                    
                    // 成功報酬の金額を自動計算
                    if (SUCCESS_FEE_ENABLED) {
                        if (SUCCESS_FEE_RATE > 0 && APPROVED_AMOUNT > 0) {
                            // %ベースの場合: 採択額 × 報酬率
                            const calculatedFee = Math.floor(APPROVED_AMOUNT * SUCCESS_FEE_RATE / 100);
                            subtotalInput.value = calculatedFee;
                            descriptionInput.value = '採択額 ¥' + APPROVED_AMOUNT.toLocaleString() + ' × ' + SUCCESS_FEE_RATE + '%';
                        } else if (SUCCESS_FEE_AMOUNT > 0) {
                            // 固定金額の場合
                            subtotalInput.value = SUCCESS_FEE_AMOUNT;
                            descriptionInput.value = '固定報酬';
                        } else if (SUCCESS_FEE_RATE > 0 && APPROVED_AMOUNT === 0) {
                            // %設定あるが採択額未入力
                            subtotalInput.value = '';
                            descriptionInput.value = '※採択額を入力すると自動計算（' + SUCCESS_FEE_RATE + '%）';
                        } else {
                            subtotalInput.value = '';
                            descriptionInput.value = '';
                        }
                    } else {
                        subtotalInput.value = '';
                        descriptionInput.value = '';
                    }
                }
                
                const today = new Date();
                const dueDate = new Date(today);
                dueDate.setDate(dueDate.getDate() + 14);
                
                document.getElementById('invoiceIssueDate').value = today.toISOString().split('T')[0];
                document.getElementById('invoiceDueDate').value = dueDate.toISOString().split('T')[0];
                
                document.getElementById('invoiceNotes').value = '';
                document.getElementById('invoiceTaxRate').value = '10';
                document.getElementById('invoiceWithholding').checked = false;
                
                // 入力モードを税抜にリセット
                currentInputMode = 'excluding';
                setInputMode('excluding');
                
                calculateInvoiceTotal();
                modal.classList.remove('hidden');
            }
            window.openCreateInvoiceModal = openCreateInvoiceModal;
            
            function closeCreateInvoiceModal() {
                document.getElementById('createInvoiceModal').classList.add('hidden');
                // モーダルを閉じる時に税抜モードにリセット
                currentInputMode = 'excluding';
            }
            window.closeCreateInvoiceModal = closeCreateInvoiceModal;
            
            // 金額入力モード（税抜/税込）
            let currentInputMode = 'excluding';
            
            function setInputMode(mode) {
                currentInputMode = mode;
                const excludingBtn = document.getElementById('inputModeExcludingTax');
                const includingBtn = document.getElementById('inputModeIncludingTax');
                const hint = document.getElementById('inputModeHint');
                
                if (mode === 'excluding') {
                    excludingBtn.className = 'text-xs px-2 py-1 rounded bg-blue-600 text-white';
                    includingBtn.className = 'text-xs px-2 py-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300';
                    hint.textContent = '税抜金額を入力してください';
                } else {
                    excludingBtn.className = 'text-xs px-2 py-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300';
                    includingBtn.className = 'text-xs px-2 py-1 rounded bg-green-600 text-white';
                    hint.textContent = '税込金額を入力 → 税抜金額を自動計算';
                }
                calculateInvoiceTotal();
            }
            window.setInputMode = setInputMode;
            
            // 請求金額計算
            function calculateInvoiceTotal() {
                const inputValue = parseInt(document.getElementById('invoiceSubtotal').value) || 0;
                const taxRate = parseInt(document.getElementById('invoiceTaxRate').value) || 0;
                const hasWithholding = document.getElementById('invoiceWithholding').checked;
                
                let subtotal, tax, total;
                
                if (currentInputMode === 'including' && taxRate > 0) {
                    // 税込入力モード: 税込金額を優先し、税抜金額を逆算
                    // 端数が出る場合は税抜金額を切り上げて、税込金額がピッタリになるように調整
                    // 例: 税込30,000円 → 税抜27,273円 + 消費税2,727円 = 30,000円
                    total = inputValue;
                    subtotal = Math.ceil(inputValue / (1 + taxRate / 100));
                    tax = total - subtotal;
                    
                    // もし切り上げで税込が超える場合は切り捨てに戻す
                    if (subtotal + Math.floor(subtotal * taxRate / 100) > total) {
                        subtotal = Math.floor(inputValue / (1 + taxRate / 100));
                        tax = total - subtotal;
                    }
                } else {
                    // 税抜入力モード（通常）
                    subtotal = inputValue;
                    tax = Math.floor(subtotal * taxRate / 100);
                    total = subtotal + tax;
                }
                
                let withholding = 0;
                if (hasWithholding) {
                    withholding = Math.floor(subtotal * 0.1021);
                    total = total - withholding;
                }
                
                // 実際の税抜金額を隠しフィールドまたはデータ属性に保存
                document.getElementById('invoiceSubtotal').dataset.actualSubtotal = subtotal;
                
                document.getElementById('calcSubtotal').textContent = '¥' + subtotal.toLocaleString();
                document.getElementById('calcTax').textContent = '¥' + tax.toLocaleString();
                document.getElementById('calcWithholding').textContent = '-¥' + withholding.toLocaleString();
                document.getElementById('calcTotal').textContent = '¥' + total.toLocaleString();
                
                if (hasWithholding) {
                    document.getElementById('calcWithholdingRow').classList.remove('hidden');
                } else {
                    document.getElementById('calcWithholdingRow').classList.add('hidden');
                }
                
                // 税込モードの場合、逆算結果を表示
                const hint = document.getElementById('inputModeHint');
                if (currentInputMode === 'including' && inputValue > 0) {
                    hint.innerHTML = '税込 <strong>¥' + inputValue.toLocaleString() + '</strong> → 税抜 <strong>¥' + subtotal.toLocaleString() + '</strong>';
                    hint.className = 'text-xs text-green-600 mt-1 font-medium';
                } else if (currentInputMode === 'including') {
                    hint.textContent = '税込金額を入力 → 税抜金額を自動計算';
                    hint.className = 'text-xs text-gray-500 mt-1';
                } else {
                    hint.textContent = '税抜金額を入力してください';
                    hint.className = 'text-xs text-gray-500 mt-1';
                }
            }
            window.calculateInvoiceTotal = calculateInvoiceTotal;
            
            // 請求書作成（下書き）
            document.getElementById('createInvoiceForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                await createInvoice('draft');
            });
            
            // 作成して発行
            async function createAndIssueInvoice() {
                await createInvoice('issued');
            }
            window.createAndIssueInvoice = createAndIssueInvoice;
            
            async function createInvoice(status) {
                try {
                    const inputValue = parseInt(document.getElementById('invoiceSubtotal').value) || 0;
                    const taxRate = parseInt(document.getElementById('invoiceTaxRate').value) || 0;
                    const hasWithholding = document.getElementById('invoiceWithholding').checked;
                    
                    // 税込モードの場合は税込金額を優先して計算
                    let subtotal, taxAmount, totalAmount;
                    if (currentInputMode === 'including' && taxRate > 0) {
                        // 税込金額を優先：税抜を切り上げて計算し、消費税で端数調整
                        const includingTotal = inputValue;
                        subtotal = Math.ceil(includingTotal / (1 + taxRate / 100));
                        // 切り上げで超える場合は切り捨てに戻す
                        if (subtotal + Math.floor(subtotal * taxRate / 100) > includingTotal) {
                            subtotal = Math.floor(includingTotal / (1 + taxRate / 100));
                        }
                        taxAmount = includingTotal - subtotal;
                        totalAmount = includingTotal;
                    } else {
                        subtotal = inputValue;
                        taxAmount = Math.floor(subtotal * taxRate / 100);
                        totalAmount = subtotal + taxAmount;
                    }
                    
                    const withholdingAmount = hasWithholding ? Math.floor(subtotal * 0.1021) : 0;
                    totalAmount = totalAmount - withholdingAmount;
                    
                    const data = {
                        invoice_type: document.getElementById('invoiceType').value,
                        item_name: document.getElementById('invoiceItemName').value,
                        item_description: document.getElementById('invoiceItemDescription').value || null,
                        subtotal: subtotal,
                        tax_rate: taxRate,
                        tax_amount: taxAmount,
                        withholding_tax: withholdingAmount,
                        total_amount: totalAmount,
                        issue_date: document.getElementById('invoiceIssueDate').value || null,
                        due_date: document.getElementById('invoiceDueDate').value || null,
                        notes: document.getElementById('invoiceNotes').value || null,
                        status: status
                    };
                    
                    await axios.post(\`/api/cases/\${CASE_ID}/invoices\`, data);
                    showToast(status === 'issued' ? '請求書を発行しました' : '請求書を下書き保存しました');
                    closeCreateInvoiceModal();
                    loadInvoices();
                } catch (error) {
                    alert('請求書の作成に失敗しました: ' + (error.response?.data?.error || error.message));
                }
            }
            
            // 請求書を発行
            async function issueInvoice(invoiceId) {
                if (!confirm('この請求書を発行しますか？')) return;
                try {
                    await axios.put(\`/api/invoices/\${invoiceId}/status\`, { status: 'issued' });
                    showToast('請求書を発行しました');
                    loadInvoices();
                } catch (error) {
                    alert('発行に失敗しました');
                }
            }
            window.issueInvoice = issueInvoice;
            
            // 請求書を編集
            async function editInvoice(invoiceId) {
                try {
                    const response = await axios.get(\`/api/invoices/\${invoiceId}\`);
                    const inv = response.data;
                    
                    // 編集モーダルを表示
                    const modal = document.createElement('div');
                    modal.id = 'editInvoiceModal';
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
                    modal.innerHTML = \`
                        <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            <div class="p-6 border-b sticky top-0 bg-white">
                                <div class="flex items-center justify-between">
                                    <h3 class="text-lg font-bold"><i class="fas fa-edit mr-2 text-yellow-500"></i>請求書を編集</h3>
                                    <button onclick="document.getElementById('editInvoiceModal').remove()" class="text-gray-400 hover:text-gray-600">
                                        <i class="fas fa-times text-xl"></i>
                                    </button>
                                </div>
                            </div>
                            <form id="editInvoiceForm" class="p-6 space-y-4">
                                <input type="hidden" name="invoiceId" value="\${inv.id}">
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">請求書タイトル</label>
                                    <input type="text" name="title" value="\${inv.title || ''}" 
                                           class="w-full px-3 py-2 border rounded-lg" placeholder="例: 手付金請求書">
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">請求金額（税抜）</label>
                                    <input type="number" name="amount" value="\${inv.amount || 0}" 
                                           class="w-full px-3 py-2 border rounded-lg" required>
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">消費税額</label>
                                    <input type="number" name="tax_amount" value="\${inv.tax_amount || 0}" 
                                           class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">支払期限</label>
                                    <input type="date" name="due_date" value="\${inv.due_date ? inv.due_date.split('T')[0] : ''}" 
                                           class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">備考</label>
                                    <textarea name="notes" rows="3" class="w-full px-3 py-2 border rounded-lg" 
                                              placeholder="備考があれば入力してください">\${inv.notes || ''}</textarea>
                                </div>
                                
                                <div class="flex justify-end gap-3 pt-4 border-t">
                                    <button type="button" onclick="document.getElementById('editInvoiceModal').remove()" 
                                            class="px-4 py-2 border rounded-lg hover:bg-gray-50">キャンセル</button>
                                    <button type="submit" class="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">
                                        <i class="fas fa-save mr-1"></i>保存
                                    </button>
                                </div>
                            </form>
                        </div>
                    \`;
                    document.body.appendChild(modal);
                    
                    // フォーム送信処理
                    document.getElementById('editInvoiceForm').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        try {
                            await axios.put(\`/api/invoices/\${invoiceId}\`, {
                                title: formData.get('title'),
                                amount: parseInt(formData.get('amount')) || 0,
                                tax_amount: parseInt(formData.get('tax_amount')) || 0,
                                due_date: formData.get('due_date') || null,
                                notes: formData.get('notes')
                            });
                            showToast('請求書を更新しました');
                            document.getElementById('editInvoiceModal').remove();
                            loadInvoices();
                        } catch (error) {
                            alert('更新に失敗しました: ' + (error.response?.data?.error || error.message));
                        }
                    });
                } catch (error) {
                    alert('請求書情報の取得に失敗しました');
                }
            }
            window.editInvoice = editInvoice;
            
            // 入金確認
            async function markInvoicePaid(invoiceId) {
                if (!confirm('この請求書の入金を確認しますか？')) return;
                try {
                    await axios.put(\`/api/invoices/\${invoiceId}/status\`, { status: 'paid' });
                    showToast('入金を確認しました');
                    loadInvoices();
                } catch (error) {
                    alert('更新に失敗しました');
                }
            }
            window.markInvoicePaid = markInvoicePaid;
            
            // 請求書詳細表示（モーダル形式）
            async function viewInvoiceDetail(invoiceId) {
                try {
                    const response = await axios.get(\`/api/invoices/\${invoiceId}\`);
                    const inv = response.data;
                    
                    // 案件情報を取得
                    const caseResponse = await axios.get(\`/api/cases/\${CASE_ID}\`);
                    const caseData = caseResponse.data;
                    
                    const statusLabels = {
                        draft: { label: '下書き', color: 'bg-gray-100 text-gray-700' },
                        issued: { label: '発行済み', color: 'bg-blue-100 text-blue-700' },
                        sent: { label: '送付済み', color: 'bg-yellow-100 text-yellow-700' },
                        payment_reported: { label: '振込報告済み', color: 'bg-purple-100 text-purple-700' },
                        paid: { label: '入金済み', color: 'bg-green-100 text-green-700' },
                        cancelled: { label: 'キャンセル', color: 'bg-red-100 text-red-700' }
                    };
                    const status = statusLabels[inv.status] || statusLabels.draft;
                    
                    // 既存のモーダルを削除
                    const existing = document.getElementById('invoiceDetailModal');
                    if (existing) existing.remove();
                    
                    // インボイス番号（適格請求書番号）- APIレスポンスから取得
                    const invoiceRegistrationNumber = inv.invoice_registration_number || '';
                    
                    const modal = document.createElement('div');
                    modal.id = 'invoiceDetailModal';
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
                    modal.innerHTML = \`
                        <div class="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            <!-- ヘッダー -->
                            <div class="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
                                <div>
                                    <div class="text-sm opacity-80">請求書</div>
                                    <div class="text-xl font-bold">\${inv.invoice_number}</div>
                                </div>
                                <button onclick="document.getElementById('invoiceDetailModal').remove()" class="text-white hover:bg-white/20 p-2 rounded">
                                    <i class="fas fa-times text-xl"></i>
                                </button>
                            </div>
                            
                            <!-- 本文 -->
                            <div class="p-4 space-y-4">
                                <!-- 発行元・請求先 -->
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div class="text-xs text-gray-500 mb-1"><i class="fas fa-building mr-1"></i>発行元</div>
                                        <div class="font-medium">\${inv.issuer_name || 'デフォルト組織'}</div>
                                        <div class="text-xs text-gray-500">\${inv.issuer_email || 'Email: admin@example.com'}</div>
                                    </div>
                                    <div>
                                        <div class="text-xs text-gray-500 mb-1"><i class="fas fa-user mr-1"></i>請求先</div>
                                        <div class="font-medium">\${caseData.client_name || '顧客名'} 御中</div>
                                        <div class="text-xs text-gray-500">\${caseData.company_name || ''}</div>
                                        <div class="text-xs text-gray-500">\${caseData.email || 'Email: sample@sample'}</div>
                                    </div>
                                </div>
                                
                                <!-- 日付情報 -->
                                <div class="flex gap-4 text-sm">
                                    <div class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded">
                                        <i class="fas fa-calendar text-gray-500"></i>
                                        <span>発行日: \${inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '未設定'}</span>
                                    </div>
                                    <div class="flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded">
                                        <i class="fas fa-clock"></i>
                                        <span>支払期限: \${inv.due_date ? new Date(inv.due_date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '未設定'}</span>
                                    </div>
                                </div>
                                
                                <!-- 品目 -->
                                <div class="border rounded-lg overflow-hidden">
                                    <div class="bg-gray-50 px-4 py-2 border-b font-medium text-sm">品目</div>
                                    <table class="w-full text-sm">
                                        <tbody>
                                            <tr class="border-b">
                                                <td class="px-4 py-3">
                                                    <div class="font-medium">\${inv.item_name}</div>
                                                    <div class="text-xs text-gray-500">\${inv.description || ''}</div>
                                                </td>
                                                <td class="px-4 py-3 text-right whitespace-nowrap">¥\${inv.subtotal.toLocaleString()}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    
                                    <!-- 金額サマリー -->
                                    <div class="bg-gray-50 px-4 py-3 space-y-2 text-sm">
                                        <div class="flex justify-between">
                                            <span>小計</span>
                                            <span>¥\${inv.subtotal.toLocaleString()}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span>消費税 (10%)</span>
                                            <span>¥\${inv.tax_amount.toLocaleString()}</span>
                                        </div>
                                        \${inv.withholding_tax ? \`
                                            <div class="flex justify-between text-red-600">
                                                <span>源泉徴収税</span>
                                                <span>-¥\${inv.withholding_tax.toLocaleString()}</span>
                                            </div>
                                        \` : ''}
                                        <div class="flex justify-between font-bold text-lg pt-2 border-t">
                                            <span>合計</span>
                                            <span>¥\${inv.total_amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- 振込先情報 -->
                                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div class="text-sm font-medium text-blue-800 mb-2">
                                        <i class="fas fa-university mr-1"></i>振込先口座
                                    </div>
                                    <div class="grid grid-cols-2 gap-2 text-sm text-blue-700">
                                        <div>金融機関:</div><div>\${inv.bank_name || '-'}</div>
                                        <div>支店:</div><div>\${inv.bank_branch || '-'}</div>
                                        <div>口座種別:</div><div>\${inv.bank_account_type || '普通'}</div>
                                        <div>口座番号:</div><div>\${inv.bank_account_number || '-'}</div>
                                        <div>口座名義:</div><div>\${inv.bank_account_holder || '-'}</div>
                                    </div>
                                </div>
                                
                                <!-- インボイス番号（適格請求書発行事業者登録番号） -->
                                \${invoiceRegistrationNumber ? \`
                                <div class="bg-gray-100 border rounded-lg p-3 text-sm">
                                    <div class="text-xs text-gray-500 mb-1">
                                        <i class="fas fa-certificate mr-1"></i>適格請求書発行事業者登録番号
                                    </div>
                                    <div class="font-mono font-bold text-gray-700">\${invoiceRegistrationNumber}</div>
                                </div>
                                \` : ''}
                            </div>
                            
                            <!-- フッター -->
                            <div class="border-t p-4 flex gap-3">
                                <button onclick="downloadInvoicePdf(\${inv.id})" class="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium">
                                    <i class="fas fa-file-pdf mr-2"></i>PDFダウンロード
                                </button>
                                <button onclick="document.getElementById('invoiceDetailModal').remove()" class="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300">
                                    閉じる
                                </button>
                            </div>
                        </div>
                    \`;
                    document.body.appendChild(modal);
                    
                    // 背景クリックで閉じる
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) modal.remove();
                    });
                } catch (error) {
                    console.error('Error loading invoice detail:', error);
                    alert('詳細の取得に失敗しました');
                }
            }
            window.viewInvoiceDetail = viewInvoiceDetail;
            
            // 請求書PDFダウンロード（新しいウィンドウで印刷用ページを開く）
            function downloadInvoicePdf(invoiceId) {
                // 新しいウィンドウで請求書表示ページを開く
                const pdfWindow = window.open(\`/api/invoices/\${invoiceId}/pdf\`, '_blank');
                if (pdfWindow) {
                    showToast('請求書を新しいウィンドウで開きました。印刷メニューからPDF保存できます。');
                } else {
                    alert('ポップアップがブロックされました。ブラウザの設定を確認してください。');
                }
            }
            window.downloadInvoicePdf = downloadInvoicePdf;
            
            // 請求書削除
            async function deleteInvoice(invoiceId) {
                if (!confirm('この請求書を削除しますか？')) return;
                try {
                    await axios.delete(\`/api/invoices/\${invoiceId}\`);
                    showToast('請求書を削除しました');
                    loadInvoices();
                } catch (error) {
                    alert('削除に失敗しました');
                }
            }
            window.deleteInvoice = deleteInvoice;
            
            // 契約URLを保存
            async function saveContractUrl() {
                try {
                    const contractUrl = document.getElementById('contractUrlInput').value.trim();
                    await axios.put(\`/api/cases/\${CASE_ID}\`, { contract_url: contractUrl || null });
                    showToast('契約URLを保存しました');
                    loadContractInfo();
                } catch (error) {
                    alert('保存に失敗しました');
                }
            }
            
            // やり取り読み込み
            async function loadCommunications() {
                try {
                    const response = await axios.get(\`/api/cases/\${CASE_ID}/communications\`);
                    const communications = response.data;
                    
                    const container = document.getElementById('communicationsList');
                    
                    if (communications.length === 0) {
                        container.innerHTML = '<div class="text-gray-500 text-center py-4">やり取りの記録はありません</div>';
                        return;
                    }
                    
                    container.innerHTML = communications.map(comm => \`
                        <div class="flex gap-3 \${comm.sender_type === 'staff' ? '' : 'flex-row-reverse'}">
                            <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center \${comm.sender_type === 'staff' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}">
                                <i class="fas fa-\${comm.sender_type === 'staff' ? 'user-tie' : 'user'}"></i>
                            </div>
                            <div class="flex-1 \${comm.sender_type === 'staff' ? '' : 'text-right'}">
                                <div class="inline-block max-w-[80%] p-3 rounded-lg \${comm.sender_type === 'staff' ? 'bg-blue-50' : 'bg-green-50'}">
                                    <div class="text-sm">\${comm.message}</div>
                                </div>
                                <div class="text-xs text-gray-400 mt-1">\${comm.sender_name} - \${new Date(comm.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</div>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Error loading communications:', error);
                }
            }
            
            // メッセージ送信
            document.getElementById('communicationForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const message = document.getElementById('communicationMessage').value.trim();
                if (!message) return;
                
                try {
                    await axios.post(\`/api/cases/\${CASE_ID}/communications\`, {
                        message,
                        sender_type: 'staff',
                        sender_name: localStorage.getItem('admin_name') || 'スタッフ'
                    });
                    document.getElementById('communicationMessage').value = '';
                    loadCommunications();
                    showToast('メッセージを送信しました');
                } catch (error) {
                    alert('送信に失敗しました');
                }
            });
            
            // パイプラインテンプレート適用モーダル
            async function openApplyPipelineModal() {
                document.getElementById('applyPipelineModal').classList.remove('hidden');
                
                try {
                    // 申請種別IDでフィルタリング
                    let url = '/api/pipeline-templates';
                    if (SUBSIDY_TYPE_ID) {
                        url += '?subsidy_type_id=' + SUBSIDY_TYPE_ID;
                    }
                    const response = await axios.get(url);
                    const templates = response.data;
                    
                    const select = document.getElementById('pipelineTemplateSelect');
                    select.innerHTML = '<option value="">テンプレートを選択...</option>';
                    
                    if (templates.length === 0) {
                        const optInfo = document.createElement('option');
                        optInfo.disabled = true;
                        optInfo.textContent = '※ この申請種別用のパイプラインは未設定です';
                        select.appendChild(optInfo);
                    }
                    
                    templates.forEach(t => {
                        const option = document.createElement('option');
                        option.value = t.id;
                        option.textContent = t.name + ' (' + (t.task_count || 0) + 'タスク)';
                        option.dataset.description = t.description || '';
                        select.appendChild(option);
                    });
                    
                    select.addEventListener('change', function() {
                        const desc = this.options[this.selectedIndex]?.dataset?.description;
                        const descDiv = document.getElementById('templateDescription');
                        if (desc) {
                            descDiv.textContent = desc;
                            descDiv.classList.remove('hidden');
                        } else {
                            descDiv.classList.add('hidden');
                        }
                    });
                } catch (error) {
                    console.error('Error loading templates:', error);
                }
            }
            
            function closeApplyPipelineModal() {
                document.getElementById('applyPipelineModal').classList.add('hidden');
            }
            
            async function applyPipelineTemplate() {
                const templateId = document.getElementById('pipelineTemplateSelect').value;
                if (!templateId) {
                    alert('テンプレートを選択してください');
                    return;
                }
                
                try {
                    await axios.post(\`/api/cases/\${CASE_ID}/apply-pipeline\`, { template_id: templateId });
                    showToast('パイプラインを適用しました');
                    closeApplyPipelineModal();
                    loadPipeline();
                } catch (error) {
                    alert('適用に失敗しました: ' + (error.response?.data?.error || error.message));
                }
            }
            
            // 書類作成モードを取得してリンクを設定
            async function loadDocumentCreationMode() {
                try {
                    const response = await axios.get(\`/api/cases/\${CASE_ID}/license-status\`);
                    const data = response.data;
                    
                    const headerBtn = document.getElementById('docGenerateBtn');
                    const bannerBtn = document.getElementById('docGenerateBannerBtn');
                    const bannerDesc = document.getElementById('docGenerateBannerDesc');
                    const modeInfo = document.getElementById('docCreationModeInfo');
                    const modeLabel = document.getElementById('docCreationModeLabel');
                    
                    // 資格者代行モード（expert_proxy）かつ代行可能な場合は管理者の顧客詳細画面へ
                    if (data.canCreateDocumentsForClient || data.effectiveMode === 'expert_proxy') {
                        // 顧客詳細ページの書類生成へ
                        const clientDetailUrl = \`/client/\${CLIENT_ID}#ai\`;
                        
                        if (headerBtn) {
                            headerBtn.href = clientDetailUrl;
                            headerBtn.removeAttribute('target');
                            headerBtn.title = '顧客詳細 - AI書類生成';
                        }
                        if (bannerBtn) {
                            bannerBtn.href = clientDetailUrl;
                            bannerBtn.removeAttribute('target');
                            bannerBtn.innerHTML = '<i class="fas fa-file-alt"></i><span>書類生成画面へ</span>';
                        }
                        if (bannerDesc) {
                            bannerDesc.textContent = '資格者として顧客に代わって書類を作成します（管理画面で作業）';
                        }
                        if (modeInfo && modeLabel) {
                            modeInfo.classList.remove('hidden');
                            modeLabel.innerHTML = '<i class="fas fa-user-tie mr-1"></i>資格者代行モード';
                        }
                    } else {
                        // 顧客自己作成モードの場合はポータルへ
                        const portalUrl = \`/portal/\${PORTAL_TOKEN}#documents\`;
                        
                        if (headerBtn) {
                            headerBtn.href = portalUrl;
                            headerBtn.setAttribute('target', '_blank');
                            headerBtn.title = '顧客ポータル - 書類生成';
                        }
                        if (bannerBtn) {
                            bannerBtn.href = portalUrl;
                            bannerBtn.setAttribute('target', '_blank');
                            bannerBtn.innerHTML = '<i class="fas fa-external-link-alt"></i><span>書類生成画面へ</span>';
                        }
                        if (bannerDesc) {
                            bannerDesc.textContent = 'ヒアリング回答をもとにAIが事業計画書などの書類を自動生成します（顧客ポータル）';
                        }
                        if (modeInfo && modeLabel) {
                            modeInfo.classList.remove('hidden');
                            modeLabel.innerHTML = '<i class="fas fa-user mr-1"></i>顧客自己作成モード';
                        }
                    }
                } catch (error) {
                    console.error('Error loading document creation mode:', error);
                    // エラー時はデフォルトで顧客詳細へ（安全側）
                }
            }
            
            // 初期読み込み
            loadCaseData();
            loadDocumentCreationMode();
            loadPipeline();
            loadDocuments();
            loadHearing();
            loadInvoices();
            loadCommunications();
            
            ${sidebarScripts}
        </script>
    </body>
    </html>
  `)
})

export default routes
