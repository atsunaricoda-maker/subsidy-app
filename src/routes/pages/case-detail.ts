// 案件詳細ページ（管理者用）- UX改善版
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/case/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const user = await getCurrentUser(c)
  const orgId = getEffectiveOrgId(c, user)
  
  if (!orgId) {
    return c.text('Unauthorized - Organization not found', 401)
  }
  
  const caseData = await DB.prepare(`
    SELECT 
      cases.*,
      clients.name as client_name,
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

  // ステータスフローの定義
  const statusFlow = [
    { key: 'inquiry', label: '見込み', icon: 'fa-lightbulb', color: 'yellow' },
    { key: 'preparing', label: '書類準備', icon: 'fa-file-alt', color: 'orange' },
    { key: 'applying', label: '申請中', icon: 'fa-paper-plane', color: 'purple' },
    { key: 'adopted', label: '採択', icon: 'fa-trophy', color: 'blue' },
  ]
  const currentIndex = statusFlow.findIndex(s => s.key === caseData.status)
  
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
            /* スケルトンローダー */
            @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
            .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
            .step-connector { height: 3px; transition: background-color 0.3s; }
            .step-circle { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.3s; border: 2px solid transparent; }
            .step-circle.completed { background: #6366f1; color: white; border-color: #6366f1; }
            .step-circle.current { background: #6366f1; color: white; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.2); }
            .step-circle.pending { background: #f3f4f6; color: #9ca3af; border-color: #e5e7eb; }
            .info-card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 16px; transition: box-shadow 0.2s; }
            .info-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .page-identity-case { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); }
            .case-tab-active { color: #4f46e5 !important; border-color: #4f46e5 !important; }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex">
            ${generateSidebar('cases')}
            
            <main class="flex-1 min-h-screen">
                <!-- ページ識別バナー -->
                <div class="page-identity-case px-4 lg:px-6 py-2 flex items-center gap-3">
                    <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                        <i class="fas fa-briefcase text-white text-sm"></i>
                    </div>
                    <div>
                        <div class="text-white font-bold text-sm">案件詳細</div>
                        <div class="text-indigo-200 text-xs">${caseData.subsidy_type_name || '申請種別未設定'}</div>
                    </div>
                    <div class="ml-auto flex items-center gap-2">
                        <a href="/client/${caseData.client_id}" class="text-white/80 hover:text-white text-xs flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg">
                            <i class="fas fa-user text-xs"></i>${caseData.client_name}
                        </a>
                    </div>
                </div>
                <!-- パンくずリスト -->
                <div class="bg-gray-50 px-4 lg:px-6 py-1.5 border-b border-gray-200 text-xs" id="breadcrumb">
                    <a href="/" class="text-blue-600 hover:text-blue-800 hover:underline">ダッシュボード</a>
                    <i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>
                    <a href="/cases" class="text-blue-600 hover:text-blue-800 hover:underline">案件管理</a>
                    <i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>
                    <span class="text-gray-800 font-medium">${caseData.case_number || 'No.' + String(caseData.id).padStart(4, '0')}</span>
                </div>
                <!-- ヘッダー -->
                <header class="bg-white border-b sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 lg:px-6 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <div>
                                <a href="/cases" class="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-0.5"><i class="fas fa-arrow-left"></i>案件一覧</a>
                                <div class="flex items-center gap-2">
                                    <h2 class="text-lg font-bold text-gray-800">${caseData.case_number || 'No.' + String(caseData.id).padStart(4, '0')}</h2>
                                    <span id="statusBadge" class="px-2.5 py-0.5 rounded-full text-xs font-medium"></span>
                                </div>
                                <a href="/client/${caseData.client_id}" class="text-xs text-gray-500 hover:text-teal-600 flex items-center gap-1 mt-0.5">
                                    <i class="fas fa-user text-xs"></i>${caseData.client_name}
                                </a>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <a href="/portal/${caseData.access_token}" target="_blank" class="text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg border hover:bg-gray-50 text-sm inline-flex items-center gap-1" title="顧客ポータル">
                                <i class="fas fa-external-link-alt"></i><span class="hidden sm:inline text-xs">ポータル</span>
                            </a>
                            <button onclick="copyPortalUrl()" class="text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg border hover:bg-gray-50 text-sm inline-flex items-center gap-1" title="ポータルURLコピー">
                                <i class="fas fa-copy"></i><span class="hidden sm:inline text-xs">URLコピー</span>
                            </button>

                        </div>
                    </div>
                </header>
                
                <div class="p-4 lg:p-6 max-w-7xl mx-auto">
                    
                    <!-- ステータスフロー（プログレスバー） -->
                    <div class="bg-white rounded-xl border p-4 mb-6">
                        <div class="flex items-center justify-between max-w-2xl mx-auto">
                            ${statusFlow.map((step, i) => `
                                <div class="flex flex-col items-center gap-1 ${i < statusFlow.length - 1 ? '' : ''}">
                                    <div class="step-circle ${i < currentIndex ? 'completed' : i === currentIndex ? 'current' : 'pending'}">
                                        ${i < currentIndex ? '<i class="fas fa-check text-sm"></i>' : `<i class="fas ${step.icon} text-sm"></i>`}
                                    </div>
                                    <span class="text-xs font-medium ${i <= currentIndex ? 'text-indigo-600' : 'text-gray-400'}">${step.label}</span>
                                </div>
                                ${i < statusFlow.length - 1 ? `<div class="flex-1 mx-2 mb-4 step-connector ${i < currentIndex ? 'bg-indigo-500' : 'bg-gray-200'}"></div>` : ''}
                            `).join('')}
                        </div>
                        ${caseData.status === 'rejected' ? '<div class="text-center mt-2"><span class="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><i class="fas fa-times-circle mr-1"></i>不採択</span></div>' : ''}
                    </div>
                    
                    <!-- 見込みバナー -->
                    <div id="inquiryRestrictionBanner" class="${caseData.status === 'inquiry' ? '' : 'hidden'} mb-6">
                        <div class="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                        <i class="fas fa-info-circle text-amber-600"></i>
                                    </div>
                                    <div>
                                        <h3 class="font-bold text-amber-800 text-sm">現在「見込み」ステータスです</h3>
                                        <p class="text-xs text-amber-600 mt-0.5">案件を開始するとヒアリング・書類アップロードが有効になります（1枠消費）</p>
                                    </div>
                                </div>
                                <button onclick="startCase()" class="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap">
                                    <i class="fas fa-play-circle mr-1"></i>案件を開始
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- サマリーカード4列 -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <!-- 顧客情報 -->
                        <a href="/client/${caseData.client_id}" class="info-card group">
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                                    <i class="fas fa-user text-teal-500 text-sm"></i>
                                </div>
                                <span class="text-xs font-medium text-gray-500">関連顧客</span>
                                <i class="fas fa-external-link-alt text-xs text-gray-300 ml-auto group-hover:text-teal-500"></i>
                            </div>
                            <div class="font-bold text-gray-900 truncate">${caseData.client_name}</div>
                        </a>
                        
                        <!-- 申請種別 -->
                        <div class="info-card">
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                                    <i class="fas fa-file-invoice text-purple-500 text-sm"></i>
                                </div>
                                <span class="text-xs font-medium text-gray-500">申請種別</span>
                            </div>
                            <div class="font-bold text-gray-900 text-sm truncate">${caseData.subsidy_type_name || '未設定'}</div>
                            <div class="text-xs text-gray-500">${caseData.subsidy_category || ''}</div>
                        </div>
                        
                        <!-- 担当 & ステータス -->
                        <div class="info-card">
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                                    <i class="fas fa-user-tie text-green-500 text-sm"></i>
                                </div>
                                <span class="text-xs font-medium text-gray-500">担当・ステータス</span>
                            </div>
                            <div class="mb-1">
                                <select id="assignedToSelect" onchange="updateAssignedTo()" class="border rounded px-2 py-1 text-xs w-full font-bold text-gray-900">
                                    <option value="">未割り当て</option>
                                </select>
                            </div>
                            <div>
                                <select id="statusSelect" onchange="updateStatus()" class="border rounded px-2 py-1 text-xs w-full">
                                    <option value="inquiry">見込み</option>
                                    <option value="preparing">書類準備中</option>
                                    <option value="applying">申請中</option>
                                    <option value="adopted">採択・入金待ち</option>
                                    <option value="rejected">不採択</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- 金額サマリー -->
                        <div class="info-card">
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
                                    <i class="fas fa-coins text-yellow-500 text-sm"></i>
                                </div>
                                <span class="text-xs font-medium text-gray-500">報酬</span>
                            </div>
                            <div class="space-y-1">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">手付金</span>
                                    <span class="text-xs font-bold ${caseData.deposit_paid ? 'text-green-600' : caseData.deposit_required ? 'text-yellow-600' : 'text-gray-400'}">${caseData.deposit_required ? (caseData.deposit_paid ? '<i class="fas fa-check-circle mr-0.5"></i>' : '') + '¥' + (caseData.deposit_amount || 0).toLocaleString() : '-'}</span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-xs text-gray-500">成功報酬</span>
                                    <span class="text-xs font-bold text-gray-700">${caseData.success_fee_enabled ? (caseData.success_fee_rate ? caseData.success_fee_rate + '%' : '¥' + (caseData.success_fee_amount || 0).toLocaleString()) : '-'}</span>
                                </div>
                                ${caseData.approved_amount ? `<div class="flex items-center justify-between pt-1 border-t"><span class="text-xs text-gray-500">採択額</span><span class="text-xs font-bold text-blue-600">¥${Number(caseData.approved_amount).toLocaleString()}</span></div>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <!-- 申請結果セクション -->
                    <div id="resultSection" class="${['applying', 'adopted', 'rejected', 'completed'].includes(caseData.status as string) ? '' : 'hidden'} mb-6">
                        <div class="bg-white rounded-xl border p-5">
                            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div>
                                    <h3 class="text-base font-bold mb-3 flex items-center gap-2">
                                        <i class="fas fa-trophy text-yellow-500"></i>申請結果
                                    </h3>
                                    <div class="flex flex-wrap items-center gap-4">
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
                                            <input type="number" id="approvedAmount" value="${caseData.approved_amount || ''}" class="border rounded-lg px-3 py-1.5 text-sm w-36" placeholder="金額" />
                                            <span class="text-sm text-gray-500">円</span>
                                            <button onclick="updateApprovedAmount()" class="text-blue-600 hover:text-blue-800 text-sm"><i class="fas fa-save"></i></button>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <label class="text-sm text-gray-600">確定日:</label>
                                            <input type="date" id="resultDate" value="${caseData.result_date || ''}" onchange="updateResultDate()" class="border rounded-lg px-3 py-1.5 text-sm" />
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    ${caseData.is_archived ? `
                                        <span class="bg-green-100 text-green-800 px-3 py-1.5 rounded-lg text-sm font-medium"><i class="fas fa-check-circle mr-1"></i>完了済み</span>
                                        <button onclick="reopenCase()" class="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-300 text-sm"><i class="fas fa-undo mr-1"></i>再開</button>
                                    ` : `
                                        <button onclick="completeCase()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"><i class="fas fa-check-circle mr-1"></i>完了する</button>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 次のアクション案内 -->
                    <div id="nextActionsGuide" class="mb-6">
                        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                            <div class="flex items-start gap-3">
                                <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <i class="fas fa-lightbulb text-blue-600 text-sm"></i>
                                </div>
                                <div class="flex-1">
                                    <h4 class="font-bold text-blue-800 text-sm mb-2">次のアクション</h4>
                                    <div id="nextActionsList" class="space-y-1.5"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- タブナビゲーション -->
                    <div class="bg-white rounded-xl border mb-6">
                        <div class="border-b flex overflow-x-auto">
                            <button onclick="switchTab('pipeline')" id="tab-pipeline" class="tab-btn px-5 py-3 font-medium text-indigo-600 border-b-2 border-indigo-600 whitespace-nowrap text-sm">
                                <i class="fas fa-tasks mr-1.5"></i>パイプライン
                            </button>
                            <button onclick="switchTab('documents')" id="tab-documents" class="tab-btn px-5 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap text-sm">
                                <i class="fas fa-file-alt mr-1.5"></i>案件書類
                            </button>
                            <button onclick="switchTab('hearing')" id="tab-hearing" class="tab-btn px-5 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap text-sm">
                                <i class="fas fa-clipboard-list mr-1.5"></i>ヒアリング
                            </button>
                            <button onclick="switchTab('invoices')" id="tab-invoices" class="tab-btn px-5 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap text-sm">
                                <i class="fas fa-file-invoice-dollar mr-1.5"></i>請求書
                                <span id="invoiceBadge" class="hidden ml-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">0</span>
                            </button>
                            <button onclick="switchTab('communications')" id="tab-communications" class="tab-btn px-5 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap text-sm">
                                <i class="fas fa-comments mr-1.5"></i>案件メモ
                            </button>
                        </div>
                    </div>
                    
                    <!-- パイプラインタブ -->
                    <div id="content-pipeline" class="tab-content">
                        <div class="bg-white rounded-xl border p-5">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-base font-bold flex items-center gap-2">
                                    <i class="fas fa-tasks text-blue-600"></i>パイプライン進捗
                                </h3>
                                <div class="flex gap-2">
                                    <button id="addTaskBtn" onclick="openAddTaskModal()" class="hidden bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 text-sm">
                                        <i class="fas fa-plus mr-1"></i>タスク追加
                                    </button>
                                    <button onclick="openApplyPipelineModal()" class="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm">
                                        <i class="fas fa-plus mr-1"></i>テンプレート適用
                                    </button>
                                </div>
                            </div>
                            <div id="pipelineProgress" class="mb-4">
                                <div class="flex items-center gap-3">
                                    <div class="flex-1 bg-gray-200 rounded-full h-2.5">
                                        <div id="pipelineProgressBar" class="bg-blue-600 h-2.5 rounded-full transition-all" style="width: 0%"></div>
                                    </div>
                                    <span id="pipelineProgressText" class="text-sm font-bold text-gray-600 w-24 text-right">0%</span>
                                </div>
                            </div>
                            <div id="pipelineTasksList" class="space-y-2">
                                <div class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin text-xl mb-2"></i><div class="text-sm">読み込み中...</div></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 書類管理タブ -->
                    <div id="content-documents" class="tab-content hidden">

                        
                        <div class="bg-white rounded-xl border p-4 mb-5">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="font-bold text-sm text-gray-800"><i class="fas fa-file-archive mr-1 text-blue-600"></i>書類一括ダウンロード</h3>
                                    <p class="text-xs text-gray-500 mt-0.5">案件書類と共通書類をまとめてZIPでダウンロード</p>
                                </div>
                                <button onclick="downloadAllDocuments()" id="downloadAllBtn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                                    <i class="fas fa-download mr-1"></i>一括DL
                                </button>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div class="bg-white rounded-xl border p-5">
                                <h3 class="text-sm font-bold mb-3 flex items-center gap-2"><i class="fas fa-list-check text-green-600"></i>必要書類チェックリスト</h3>
                                <div class="flex border-b mb-3">
                                    <button id="checklistTabCommon" onclick="switchChecklistTab('common')" class="px-3 py-1.5 text-xs font-medium border-b-2 border-green-600 text-green-600 -mb-px"><i class="fas fa-building mr-1"></i>共通 <span id="checklistCommonBadge" class="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">0/0</span></button>
                                    <button id="checklistTabCase" onclick="switchChecklistTab('case')" class="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px"><i class="fas fa-file-alt mr-1"></i>申請 <span id="checklistCaseBadge" class="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">0/0</span></button>
                                </div>
                                <div id="checklistContentCommon" class="space-y-2">
                                    <p class="text-xs text-gray-500 mb-2 bg-green-50 p-2 rounded-lg"><i class="fas fa-info-circle mr-1 text-green-600"></i>登記簿謄本、決算書など会社全体で共通して使う書類</p>
                                    <div id="checklistCommonList" class="space-y-1.5"><div class="text-center py-3 text-gray-500 text-sm">読み込み中...</div></div>
                                </div>
                                <div id="checklistContentCase" class="space-y-2 hidden">
                                    <p class="text-xs text-gray-500 mb-2 bg-blue-50 p-2 rounded-lg"><i class="fas fa-info-circle mr-1 text-blue-600"></i>この補助金申請に必要な専用書類</p>
                                    <div id="checklistCaseList" class="space-y-1.5"><div class="text-center py-3 text-gray-500 text-sm">読み込み中...</div></div>
                                </div>
                            </div>
                            <div class="bg-white rounded-xl border p-5">
                                <h3 class="text-sm font-bold mb-3 flex items-center gap-2"><i class="fas fa-upload text-blue-600"></i>アップロード済み書類</h3>
                                <div id="uploadedDocuments" class="space-y-2"><div class="text-center py-3 text-gray-500 text-sm">読み込み中...</div></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- ヒアリングタブ -->
                    <div id="content-hearing" class="tab-content hidden">
                        <div class="bg-white rounded-xl border p-5">
                            <h3 class="text-base font-bold mb-3 flex items-center gap-2"><i class="fas fa-clipboard-list text-indigo-600"></i>ヒアリング回答</h3>
                            <div id="hearingProgress" class="mb-4">
                                <div class="flex items-center gap-3">
                                    <div class="flex-1 bg-gray-200 rounded-full h-2">
                                        <div id="hearingProgressBar" class="bg-indigo-600 h-2 rounded-full transition-all" style="width: 0%"></div>
                                    </div>
                                    <span id="hearingProgressText" class="text-sm font-medium text-gray-600">0/0問</span>
                                </div>
                            </div>
                            <div class="flex border-b mb-3">
                                <button id="hearingTabCommon" onclick="switchHearingAnswerTab('common')" class="px-3 py-1.5 text-xs font-medium border-b-2 border-blue-600 text-blue-600 -mb-px"><i class="fas fa-globe mr-1"></i>共通質問 <span id="hearingCommonBadge" class="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">0/0</span></button>
                                <button id="hearingTabCase" onclick="switchHearingAnswerTab('case')" class="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px"><i class="fas fa-clipboard-list mr-1"></i>案件固有 <span id="hearingCaseBadge" class="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">0/0</span></button>
                            </div>
                            <div id="hearingContentCommon" class="space-y-3">
                                <p class="text-xs text-gray-500 mb-2 bg-blue-50 p-2 rounded-lg"><i class="fas fa-info-circle mr-1 text-blue-600"></i>共通質問の回答は他の案件でも共有されます</p>
                                <div id="hearingCommonList" class="space-y-2"><div class="text-center py-3 text-gray-500 text-sm">読み込み中...</div></div>
                            </div>
                            <div id="hearingContentCase" class="space-y-3 hidden">
                                <p class="text-xs text-gray-500 mb-2 bg-indigo-50 p-2 rounded-lg"><i class="fas fa-info-circle mr-1 text-indigo-600"></i>この申請種別専用の質問</p>
                                <div id="hearingCaseList" class="space-y-2"><div class="text-center py-3 text-gray-500 text-sm">読み込み中...</div></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 請求書タブ（改善版） -->
                    <div id="content-invoices" class="tab-content hidden">
                        <!-- 請求書概要カード -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                            <div class="bg-white rounded-xl border p-4">
                                <div class="flex items-center gap-2 mb-1">
                                    <div class="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center"><i class="fas fa-hand-holding-usd text-yellow-500 text-sm"></i></div>
                                    <span class="text-xs font-medium text-gray-500">手付金</span>
                                </div>
                                <div id="depositSummary" class="mt-1">
                                    <span class="text-lg font-bold ${caseData.deposit_required ? (caseData.deposit_paid ? 'text-green-600' : 'text-yellow-600') : 'text-gray-400'}">
                                        ${caseData.deposit_required ? '¥' + (caseData.deposit_amount || 0).toLocaleString() : '設定なし'}
                                    </span>
                                    ${caseData.deposit_required ? `<div class="text-xs ${caseData.deposit_paid ? 'text-green-600' : 'text-yellow-600'} mt-0.5">${caseData.deposit_paid ? '<i class="fas fa-check-circle mr-1"></i>支払済' : '<i class="fas fa-clock mr-1"></i>未払'}</div>` : ''}
                                </div>
                            </div>
                            <div class="bg-white rounded-xl border p-4">
                                <div class="flex items-center gap-2 mb-1">
                                    <div class="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center"><i class="fas fa-trophy text-purple-500 text-sm"></i></div>
                                    <span class="text-xs font-medium text-gray-500">成功報酬</span>
                                </div>
                                <div class="mt-1">
                                    <span class="text-lg font-bold text-gray-700">${caseData.success_fee_enabled ? (caseData.success_fee_rate ? caseData.success_fee_rate + '%' : '¥' + (caseData.success_fee_amount || 0).toLocaleString()) : '設定なし'}</span>
                                    ${caseData.success_fee_enabled && caseData.success_fee_rate && caseData.approved_amount ? `<div class="text-xs text-purple-600 mt-0.5">= ¥${Math.floor(Number(caseData.approved_amount) * Number(caseData.success_fee_rate) / 100).toLocaleString()}</div>` : ''}
                                </div>
                            </div>
                            <div class="bg-white rounded-xl border p-4">
                                <div class="flex items-center gap-2 mb-1">
                                    <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><i class="fas fa-file-invoice text-blue-500 text-sm"></i></div>
                                    <span class="text-xs font-medium text-gray-500">発行済み請求書</span>
                                </div>
                                <div class="mt-1">
                                    <span id="invoiceCountSummary" class="text-lg font-bold text-gray-700">-</span>
                                    <span class="text-xs text-gray-500">件</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="bg-white rounded-xl border p-5 mb-5">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-base font-bold flex items-center gap-2"><i class="fas fa-file-invoice-dollar text-green-600"></i>請求書一覧</h3>
                                <div class="flex gap-2">
                                    <button onclick="openCreateInvoiceModal('deposit')" class="bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600 text-sm"><i class="fas fa-plus mr-1"></i>手付金</button>
                                    <button onclick="openCreateInvoiceModal('success_fee')" class="bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 text-sm"><i class="fas fa-plus mr-1"></i>成功報酬</button>
                                </div>
                            </div>
                            <div id="invoicesList"><div class="text-center py-6 text-gray-500"><i class="fas fa-spinner fa-spin text-xl mb-2"></i><div class="text-sm">読み込み中...</div></div></div>
                        </div>
                        
                        <!-- 報酬設定（折りたたみ） -->
                        <details class="bg-white rounded-xl border overflow-hidden mb-5">
                            <summary class="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
                                <h3 class="text-sm font-bold flex items-center gap-2"><i class="fas fa-coins text-yellow-600"></i>報酬設定</h3>
                                <i class="fas fa-chevron-down text-gray-400 text-sm"></i>
                            </summary>
                            <div class="p-5 pt-0 border-t">
                                <div id="rewardSettingsContent">
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div class="border rounded-lg p-4">
                                            <div class="flex items-center justify-between mb-3">
                                                <h4 class="font-medium text-gray-800 text-sm"><i class="fas fa-hand-holding-usd mr-1 text-yellow-500"></i>手付金</h4>
                                                <span id="depositStatus" class="${caseData.deposit_paid ? 'text-green-600' : 'text-yellow-600'} text-xs font-medium">${caseData.deposit_paid ? '<i class="fas fa-check-circle mr-1"></i>支払済' : '<i class="fas fa-clock mr-1"></i>未払'}</span>
                                            </div>
                                            <div class="space-y-2">
                                                <label class="flex items-center gap-2"><input type="checkbox" id="depositRequiredEdit" ${caseData.deposit_required ? 'checked' : ''} onchange="updateRewardSettings()" class="rounded text-blue-600"><span class="text-sm">手付金あり</span></label>
                                                <div id="depositAmountEditField" class="${caseData.deposit_required ? '' : 'hidden'} space-y-2">
                                                    <div class="flex items-center justify-between">
                                                        <label class="block text-xs text-gray-500">金額（円）</label>
                                                        <div class="flex items-center gap-1">
                                                            <button type="button" id="depositTaxExcluding" onclick="setDepositTaxMode('excluding')" class="text-xs px-2 py-0.5 rounded ${caseData.deposit_tax_included ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white'}">税抜</button>
                                                            <button type="button" id="depositTaxIncluding" onclick="setDepositTaxMode('including')" class="text-xs px-2 py-0.5 rounded ${caseData.deposit_tax_included ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}">税込</button>
                                                        </div>
                                                    </div>
                                                    <input type="number" id="depositAmountEdit" value="${caseData.deposit_amount || ''}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 50000" oninput="calculateDepositPreview()">
                                                    <input type="hidden" id="depositTaxIncludedEdit" value="${caseData.deposit_tax_included ? '1' : '0'}">
                                                    <p id="depositCalcHint" class="text-xs text-gray-500">${caseData.deposit_tax_included ? '税込金額を入力' : '税抜金額を入力'}</p>
                                                    <div id="depositPreview" class="text-xs bg-gray-50 rounded p-2 ${caseData.deposit_amount ? '' : 'hidden'}"><span id="depositPreviewText"></span></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="border rounded-lg p-4">
                                            <div class="flex items-center justify-between mb-3">
                                                <h4 class="font-medium text-gray-800 text-sm"><i class="fas fa-trophy mr-1 text-purple-500"></i>成功報酬</h4>
                                            </div>
                                            <div class="space-y-2">
                                                <label class="flex items-center gap-2"><input type="checkbox" id="successFeeEnabledEdit" ${caseData.success_fee_enabled ? 'checked' : ''} onchange="toggleSuccessFeeEdit()" class="rounded text-blue-600"><span class="text-sm">成功報酬あり</span></label>
                                                <div id="successFeeEditFields" class="${caseData.success_fee_enabled ? '' : 'hidden'} space-y-2">
                                                    <div>
                                                        <label class="block text-xs text-gray-500 mb-1">報酬タイプ</label>
                                                        <select id="successFeeTypeEdit" onchange="toggleSuccessFeeTypeEdit()" class="w-full px-3 py-2 border rounded-lg text-sm">
                                                            <option value="percentage" ${Number(caseData.success_fee_rate) > 0 ? 'selected' : ''}>％（採択額に対する割合）</option>
                                                            <option value="fixed" ${Number(caseData.success_fee_amount) > 0 && !Number(caseData.success_fee_rate) ? 'selected' : ''}>固定金額</option>
                                                        </select>
                                                    </div>
                                                    <div id="successFeePercentageEditField" class="${Number(caseData.success_fee_rate) > 0 || Number(caseData.success_fee_amount) == 0 ? '' : 'hidden'}">
                                                        <label class="block text-xs text-gray-500 mb-1">成功報酬率（%）</label>
                                                        <input type="number" id="successFeePercentageEdit" value="${caseData.success_fee_rate || ''}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 10" min="0" max="100" step="0.1">
                                                    </div>
                                                    <div id="successFeeAmountEditField" class="${Number(caseData.success_fee_amount) > 0 && !Number(caseData.success_fee_rate) ? '' : 'hidden'} space-y-2">
                                                        <div class="flex items-center justify-between">
                                                            <label class="block text-xs text-gray-500">固定報酬額（円）</label>
                                                            <div class="flex items-center gap-1">
                                                                <button type="button" id="successFeeTaxExcluding" onclick="setSuccessFeeTaxMode('excluding')" class="text-xs px-2 py-0.5 rounded ${caseData.success_fee_tax_included ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white'}">税抜</button>
                                                                <button type="button" id="successFeeTaxIncluding" onclick="setSuccessFeeTaxMode('including')" class="text-xs px-2 py-0.5 rounded ${caseData.success_fee_tax_included ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}">税込</button>
                                                            </div>
                                                        </div>
                                                        <input type="number" id="successFeeAmountEdit" value="${caseData.success_fee_amount || ''}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 100000" min="0" oninput="calculateSuccessFeePreview()">
                                                        <input type="hidden" id="successFeeTaxIncludedEdit" value="${caseData.success_fee_tax_included ? '1' : '0'}">
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="mt-4 flex justify-end">
                                        <button onclick="saveRewardSettings()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"><i class="fas fa-save mr-1"></i>報酬設定を保存</button>
                                    </div>
                                </div>
                            </div>
                        </details>
                        
                        <!-- 契約情報（折りたたみ） -->
                        <details class="bg-white rounded-xl border overflow-hidden">
                            <summary class="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
                                <h3 class="text-sm font-bold flex items-center gap-2"><i class="fas fa-file-signature text-blue-600"></i>契約情報</h3>
                                <i class="fas fa-chevron-down text-gray-400 text-sm"></i>
                            </summary>
                            <div class="p-5 pt-0 border-t">
                                <div id="contractInfo"><div class="text-center py-3 text-gray-500 text-sm">読み込み中...</div></div>
                            </div>
                        </details>
                    </div>
                    
                    <!-- やり取りタブ -->
                    <div id="content-communications" class="tab-content hidden">
                        <div class="bg-white rounded-xl border p-5">
                            <h3 class="text-base font-bold mb-3 flex items-center gap-2"><i class="fas fa-comments text-green-600"></i>この案件のメモ・やり取り</h3>
                            <div id="communicationsList" class="space-y-3 mb-4 max-h-96 overflow-y-auto">
                                <div class="text-center py-3 text-gray-500 text-sm">読み込み中...</div>
                            </div>
                            <form id="communicationForm" class="border-t pt-4">
                                <div class="flex gap-2">
                                    <textarea id="communicationMessage" rows="2" class="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="メッセージを入力..."></textarea>
                                    <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 self-end"><i class="fas fa-paper-plane"></i></button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- モーダル群（パイプライン・タスク・請求書） -->
        <div id="applyPipelineModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div class="p-5 border-b"><div class="flex items-center justify-between"><h3 class="text-lg font-bold">パイプラインテンプレートを適用</h3><button onclick="closeApplyPipelineModal()" class="text-gray-500 hover:text-gray-700"><i class="fas fa-times"></i></button></div></div>
                <div class="p-5">
                    <select id="pipelineTemplateSelect" class="w-full px-3 py-2 border rounded-lg mb-3"><option value="">テンプレートを選択...</option></select>
                    <div id="templateDescription" class="text-sm text-gray-600 mb-3 hidden"></div>
                    <div class="flex gap-3"><button onclick="applyPipelineTemplate()" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"><i class="fas fa-check mr-1"></i>適用</button><button onclick="closeApplyPipelineModal()" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">キャンセル</button></div>
                </div>
            </div>
        </div>
        
        <div id="addTaskModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div class="p-5 border-b"><div class="flex items-center justify-between"><h3 class="text-lg font-bold">タスクを追加</h3><button onclick="closeAddTaskModal()" class="text-gray-500 hover:text-gray-700"><i class="fas fa-times"></i></button></div></div>
                <form id="addTaskForm" class="p-5 space-y-3">
                    <div><label class="block text-sm font-medium mb-1">挿入位置</label><select name="insert_position" id="insertPositionSelect" class="w-full px-3 py-2 border rounded-lg text-sm"><option value="0">先頭に追加</option></select><p class="text-xs text-gray-500 mt-1">選択したタスクの後に挿入されます</p></div>
                    <div><label class="block text-sm font-medium mb-1">タスク名 <span class="text-red-500">*</span></label><input type="text" name="task_name" required class="w-full px-3 py-2 border rounded-lg text-sm"></div>
                    <div><label class="block text-sm font-medium mb-1">タスクタイプ</label><select name="task_type" class="w-full px-3 py-2 border rounded-lg text-sm"><option value="internal">自社タスク</option><option value="external">顧客タスク</option><option value="both">両方</option></select></div>
                    <div class="grid grid-cols-2 gap-3"><div><label class="block text-sm font-medium mb-1">開始日</label><input type="date" name="start_date" class="w-full px-3 py-2 border rounded-lg text-sm"></div><div><label class="block text-sm font-medium mb-1">終了日</label><input type="date" name="end_date" class="w-full px-3 py-2 border rounded-lg text-sm"></div></div>
                    <div><label class="block text-sm font-medium mb-1">説明</label><textarea name="description" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm"></textarea></div>
                    <div class="flex gap-3 pt-2"><button type="submit" class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"><i class="fas fa-plus mr-1"></i>追加</button><button type="button" onclick="closeAddTaskModal()" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">キャンセル</button></div>
                </form>
            </div>
        </div>
        
        <!-- 請求書作成モーダル -->
        <div id="createInvoiceModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div class="p-5 border-b"><div class="flex items-center justify-between"><h3 id="invoiceModalTitle" class="text-lg font-bold">請求書を作成</h3><button onclick="closeCreateInvoiceModal()" class="text-gray-500 hover:text-gray-700"><i class="fas fa-times"></i></button></div></div>
                <form id="createInvoiceForm" class="p-5 space-y-4">
                    <input type="hidden" name="invoice_type" id="invoiceType" value="deposit">
                    <div><label class="block text-sm font-medium mb-1">品目名 <span class="text-red-500">*</span></label><input type="text" name="item_name" id="invoiceItemName" required class="w-full px-3 py-2 border rounded-lg text-sm"></div>
                    <div><label class="block text-sm font-medium mb-1">品目詳細</label><textarea name="item_description" id="invoiceItemDescription" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="詳細説明があれば入力"></textarea></div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <div class="flex items-center justify-between mb-1"><label class="block text-sm font-medium">金額 <span class="text-red-500">*</span></label><div class="flex items-center gap-1"><button type="button" id="inputModeExcludingTax" onclick="setInputMode('excluding')" class="text-xs px-2 py-0.5 rounded bg-blue-600 text-white">税抜</button><button type="button" id="inputModeIncludingTax" onclick="setInputMode('including')" class="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">税込</button></div></div>
                            <div class="relative"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span><input type="number" name="subtotal" id="invoiceSubtotal" required min="0" class="w-full pl-8 pr-3 py-2 border rounded-lg text-sm" oninput="calculateInvoiceTotal()"></div>
                            <p id="inputModeHint" class="text-xs text-gray-500 mt-1">税抜金額を入力</p>
                        </div>
                        <div><label class="block text-sm font-medium mb-1">消費税率</label><select name="tax_rate" id="invoiceTaxRate" class="w-full px-3 py-2 border rounded-lg text-sm" onchange="calculateInvoiceTotal()"><option value="10">10%</option><option value="8">8%（軽減）</option><option value="0">0%（非課税）</option></select></div>
                    </div>
                    <div id="withholdingSection" class="hidden"><label class="flex items-center gap-2"><input type="checkbox" id="invoiceWithholding" onchange="calculateInvoiceTotal()"><span class="text-sm">源泉徴収を適用（10.21%）</span></label></div>
                    <div class="bg-gray-50 rounded-lg p-3">
                        <div class="flex justify-between text-sm mb-1"><span>小計</span><span id="calcSubtotal">¥0</span></div>
                        <div class="flex justify-between text-sm mb-1"><span>消費税</span><span id="calcTax">¥0</span></div>
                        <div id="calcWithholdingRow" class="hidden flex justify-between text-sm mb-1 text-orange-600"><span>源泉徴収</span><span id="calcWithholding">-¥0</span></div>
                        <div class="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span>請求金額</span><span id="calcTotal" class="text-blue-600">¥0</span></div>
                    </div>
                    <div class="grid grid-cols-2 gap-3"><div><label class="block text-sm font-medium mb-1">発行日</label><input type="date" name="issue_date" id="invoiceIssueDate" class="w-full px-3 py-2 border rounded-lg text-sm"></div><div><label class="block text-sm font-medium mb-1">支払期限</label><input type="date" name="due_date" id="invoiceDueDate" class="w-full px-3 py-2 border rounded-lg text-sm"></div></div>
                    <div><label class="block text-sm font-medium mb-1">備考</label><textarea name="notes" id="invoiceNotes" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="請求書に記載する備考"></textarea></div>
                    <div class="flex gap-3 pt-2">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm"><i class="fas fa-file-invoice mr-1"></i>下書き保存</button>
                        <button type="button" onclick="createAndIssueInvoice()" class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 text-sm"><i class="fas fa-paper-plane mr-1"></i>作成して発行</button>
                    </div>
                </form>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const CASE_ID = ${parseInt(String(id), 10) || 0};
            const CLIENT_ID = ${caseData.client_id};
            const SUBSIDY_TYPE_ID = ${caseData.subsidy_type_id || 'null'};
            const PORTAL_TOKEN = '${caseData.access_token}';
            const PORTAL_URL = '${new URL(c.req.url).origin}/portal/${caseData.access_token}';
            const SUCCESS_FEE_ENABLED = ${caseData.success_fee_enabled ? 'true' : 'false'};
            const SUCCESS_FEE_RATE = ${caseData.success_fee_rate || 0};
            const SUCCESS_FEE_AMOUNT = ${caseData.success_fee_amount || 0};
            const APPROVED_AMOUNT = ${caseData.approved_amount || 0};
            
            const STATUS_LABELS = { inquiry: '見込み', preparing: '書類準備中', applying: '申請中', adopted: '採択・入金待ち', rejected: '不採択', completed: '完了' };
            const STATUS_COLORS = { inquiry: 'bg-yellow-100 text-yellow-800', preparing: 'bg-orange-100 text-orange-800', applying: 'bg-purple-100 text-purple-800', adopted: 'bg-blue-100 text-blue-800', rejected: 'bg-red-100 text-red-800', completed: 'bg-green-100 text-green-800' };
            
            // 認証
            function checkAuth() { const t = localStorage.getItem('admin_token'); if (!t) { window.location.href = '/login'; return false; } return true; }
            if (!checkAuth()) {}
            axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('admin_token');
            
            function toggleSidebar() { const s = document.getElementById('sidebar'); s.classList.toggle('-translate-x-full'); }
            
            // タブ切り替え（URLハッシュ永続化付き）
            function switchTab(tabId) {
                document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600'); b.classList.add('text-gray-500'); });
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById('tab-' + tabId).classList.remove('text-gray-500');
                document.getElementById('tab-' + tabId).classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
                document.getElementById('content-' + tabId).classList.remove('hidden');
                // URLハッシュに保存
                if (window.location.hash !== '#' + tabId) {
                    history.replaceState(null, '', '#' + tabId);
                }
                // 遅延読み込み
                loadTabDataIfNeeded(tabId);
            }
            // ハッシュ変更時のタブ復元
            window.addEventListener('hashchange', function() {
                var hash = window.location.hash.replace('#', '');
                var validTabs = ['pipeline','documents','hearing','invoices','communications'];
                if (hash && validTabs.includes(hash)) switchTab(hash);
            });

            // キーボードショートカット
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    closeApplyPipelineModal(); closeAddTaskModal(); closeCreateInvoiceModal();
                    return;
                }
                var tag = document.activeElement ? document.activeElement.tagName : '';
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                // 数字キーでタブ切り替え
                var tabKeys = {'1':'pipeline','2':'documents','3':'hearing','4':'invoices','5':'communications'};
                if (tabKeys[e.key]) { e.preventDefault(); switchTab(tabKeys[e.key]); }
            });
            
            let currentCaseStatus = '${caseData.status || 'inquiry'}';
            
            // ステータス操作
            async function startCase() {
                if (currentCaseStatus !== 'inquiry') { showToast('既に案件は開始されています'); return; }
                if (!confirm('案件を開始しますか？\\n（1枠を消費します）')) return;
                try {
                    await axios.put('/api/cases/' + CASE_ID, { status: 'preparing' });
                    currentCaseStatus = 'preparing';
                    document.getElementById('statusSelect').value = 'preparing';
                    updateStatusBadge('preparing');
                    document.getElementById('inquiryRestrictionBanner')?.classList.add('hidden');
                    showToast('案件を開始しました');
                    setTimeout(() => location.reload(), 500);
                } catch (error) {
                    const msg = error.response?.data?.error || '案件の開始に失敗しました';
                    if (msg.includes('枠') || msg.includes('slot')) showToast('枠が不足しています。プラン管理から追加購入してください。', 'error');
                    else showToast(msg, 'error');
                }
            }
            window.startCase = startCase;
            
            async function updateStatus() {
                const newStatus = document.getElementById('statusSelect').value;
                if (currentCaseStatus === 'inquiry' && newStatus !== 'inquiry') {
                    if (!confirm('案件を開始しますか？（1枠を消費します）')) { document.getElementById('statusSelect').value = currentCaseStatus; return; }
                }
                try {
                    await axios.put('/api/cases/' + CASE_ID, { status: newStatus });
                    currentCaseStatus = newStatus;
                    updateStatusBadge(newStatus);
                    updateNextActions({ status: newStatus });
                    showToast('ステータスを更新しました');
                    const rs = document.getElementById('resultSection');
                    if (['completed','adopted','rejected','applying'].includes(newStatus)) rs.classList.remove('hidden'); else rs.classList.add('hidden');
                    const ib = document.getElementById('inquiryRestrictionBanner');
                    if (newStatus === 'inquiry') ib?.classList.remove('hidden'); else ib?.classList.add('hidden');
                } catch (error) {
                    const msg = error.response?.data?.error || '更新に失敗しました';
                    if (msg.includes('枠') || msg.includes('slot')) showToast('枠が不足しています。', 'error');
                    else showToast(msg, 'error');
                    document.getElementById('statusSelect').value = currentCaseStatus;
                }
            }
            
            async function updateResult() {
                const result = document.getElementById('resultSelect').value;
                document.getElementById('approvedAmountField').classList.toggle('hidden', result !== 'approved');
                try { await axios.put('/api/cases/' + CASE_ID, { result: result || null }); showToast('結果を更新しました'); } catch(e) { showToast('更新に失敗しました', 'error'); }
            }
            async function updateApprovedAmount() {
                const amount = parseInt(document.getElementById('approvedAmount').value) || 0;
                try { await axios.put('/api/cases/' + CASE_ID, { approved_amount: amount }); showToast('採択額を更新しました'); } catch(e) { showToast('更新に失敗しました', 'error'); }
            }
            async function updateResultDate() {
                const date = document.getElementById('resultDate').value;
                try { await axios.put('/api/cases/' + CASE_ID, { result_date: date || null }); showToast('確定日を更新しました'); } catch(e) { showToast('更新に失敗しました', 'error'); }
            }
            async function completeCase() {
                if (!confirm('この案件を完了しますか？')) return;
                try { await axios.put('/api/cases/' + CASE_ID, { is_archived: true, status: 'completed' }); showToast('完了しました'); window.location.reload(); } catch(e) { showToast('完了に失敗しました', 'error'); }
            }
            async function reopenCase() {
                if (!confirm('案件を再開しますか？')) return;
                try { await axios.put('/api/cases/' + CASE_ID, { is_archived: false, status: 'applying' }); showToast('再開しました'); window.location.reload(); } catch(e) { showToast('再開に失敗しました', 'error'); }
            }
            
            function updateStatusBadge(status) {
                const badge = document.getElementById('statusBadge');
                badge.textContent = STATUS_LABELS[status];
                badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-medium ' + STATUS_COLORS[status];
            }
            
            function copyPortalUrl() { navigator.clipboard.writeText(PORTAL_URL).then(() => showToast('URLをコピーしました')); }
            
            // showToast は sidebarScripts 共通版を使用
            
            // 案件データ読み込み
            async function loadCaseData() {
                try { const r = await axios.get('/api/cases/' + CASE_ID); document.getElementById('statusSelect').value = r.data.status; updateStatusBadge(r.data.status); updateNextActions(r.data); } catch(e) { console.error('Error loading case:', e); }
            }
            
            // 次のアクション案内を更新
            function updateNextActions(caseInfo) {
                const container = document.getElementById('nextActionsList');
                const guide = document.getElementById('nextActionsGuide');
                if (!container || !guide) return;
                
                const status = caseInfo?.status || '${caseData.status}';
                const actions = [];
                
                if (status === 'inquiry') {
                    actions.push({ icon: 'fa-play-circle', color: 'text-amber-600', text: '案件を「開始」して書類準備に進みましょう', action: 'startCase()' });
                    actions.push({ icon: 'fa-clipboard-list', color: 'text-indigo-600', text: 'ヒアリングタブで顧客情報を確認', action: "switchTab('hearing')" });
                } else if (status === 'preparing') {
                    actions.push({ icon: 'fa-tasks', color: 'text-blue-600', text: 'パイプラインのタスクを進めましょう', action: "switchTab('pipeline')" });
                    actions.push({ icon: 'fa-file-alt', color: 'text-green-600', text: '必要書類のアップロード状況を確認', action: "switchTab('documents')" });
                } else if (status === 'applying') {
                    actions.push({ icon: 'fa-clock', color: 'text-purple-600', text: '申請結果の入力をお待ちください' });
                    actions.push({ icon: 'fa-file-invoice-dollar', color: 'text-yellow-600', text: '手付金の請求書を作成', action: "switchTab('invoices')" });
                } else if (status === 'adopted') {
                    actions.push({ icon: 'fa-trophy', color: 'text-blue-600', text: '採択額を入力してください' });
                    actions.push({ icon: 'fa-file-invoice-dollar', color: 'text-green-600', text: '成功報酬の請求書を発行', action: "switchTab('invoices')" });
                    actions.push({ icon: 'fa-check-circle', color: 'text-green-600', text: '全て完了したら案件を「完了」にしましょう' });
                } else if (status === 'rejected') {
                    actions.push({ icon: 'fa-redo', color: 'text-orange-600', text: '再申請する場合はステータスを「書類準備」に戻してください' });
                }
                
                if (actions.length === 0) {
                    guide.classList.add('hidden');
                    return;
                }
                guide.classList.remove('hidden');
                container.innerHTML = actions.map(a => 
                    '<div class="flex items-center gap-2 text-sm">' +
                    '<i class="fas ' + a.icon + ' ' + a.color + ' w-5 text-center"></i>' +
                    (a.action ? '<a href="javascript:void(0)" onclick="' + a.action + '" class="text-blue-700 hover:underline">' + a.text + '</a>' : '<span class="text-gray-700">' + a.text + '</span>') +
                    '</div>'
                ).join('');
            }
            
            // パイプライン
            let currentPipelineId = null, currentPipelineTasks = [];
            async function loadPipeline() {
                try {
                    const r = await axios.get('/api/cases/' + CASE_ID + '/pipelines');
                    const tasks = r.data;
                    const container = document.getElementById('pipelineTasksList');
                    const addBtn = document.getElementById('addTaskBtn');
                    if (!tasks || tasks.length === 0) {
                        container.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-tasks text-3xl mb-2 text-gray-300"></i><p class="text-sm">パイプライン未設定</p><button onclick="openApplyPipelineModal()" class="mt-2 text-blue-600 hover:text-blue-700 text-sm"><i class="fas fa-plus mr-1"></i>テンプレートを適用</button></div>';
                        document.getElementById('pipelineProgressBar').style.width = '0%';
                        document.getElementById('pipelineProgressText').textContent = '0%';
                        addBtn.classList.add('hidden');
                        currentPipelineId = null; currentPipelineTasks = [];
                        return;
                    }
                    currentPipelineId = tasks[0].pipeline_id;
                    currentPipelineTasks = tasks;
                    addBtn.classList.remove('hidden');
                    const completed = tasks.filter(t => t.status === 'completed').length;
                    const progress = Math.round((completed / tasks.length) * 100);
                    document.getElementById('pipelineProgressBar').style.width = progress + '%';
                    document.getElementById('pipelineProgressText').textContent = progress + '% (' + completed + '/' + tasks.length + ')';
                    container.innerHTML = tasks.map((task, i) => {
                        const sc = { pending: 'border-gray-200', in_progress: 'border-blue-300 bg-blue-50', completed: 'border-green-300 bg-green-50' }[task.status] || 'border-gray-200';
                        const si = { pending: 'fa-circle text-gray-300', in_progress: 'fa-spinner fa-spin text-blue-500', completed: 'fa-check-circle text-green-500' }[task.status] || 'fa-circle text-gray-300';
                        const sl = { pending: '未着手', in_progress: '進行中', completed: '完了' }[task.status] || task.status;
                        const tt = task.task_type === 'external' ? '顧客' : task.task_type === 'both' ? '両方' : '自社';
                        return '<div class="border rounded-lg p-3 ' + sc + '"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><span class="w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">' + (i+1) + '</span><div><i class="fas ' + si + ' mr-1"></i><span class="font-medium text-sm">' + task.task_name + '</span><div class="text-xs text-gray-500 mt-0.5"><span class="px-1 py-0.5 rounded bg-gray-100 text-xs">' + tt + '</span>' + (task.is_required ? ' <span class="text-red-500">*必須</span>' : '') + '</div></div></div><select onchange="updateTaskStatus(' + task.id + ', this.value)" class="text-xs border rounded px-2 py-1"><option value="pending" ' + (task.status==='pending'?'selected':'') + '>未着手</option><option value="in_progress" ' + (task.status==='in_progress'?'selected':'') + '>進行中</option><option value="completed" ' + (task.status==='completed'?'selected':'') + '>完了</option></select></div>' + (task.description ? '<p class="text-xs text-gray-600 mt-1.5 ml-9">' + task.description + '</p>' : '') + '</div>';
                    }).join('');
                } catch(e) { console.error('Pipeline error:', e); document.getElementById('pipelineTasksList').innerHTML = '<div class="text-center py-4 text-red-500 text-sm">読み込みエラー</div>'; }
            }
            async function updateTaskStatus(taskId, status) { try { await axios.put('/api/pipeline-tasks/' + taskId, { status }); showToast('更新しました'); invalidateAndReload('pipeline'); } catch(e) { showToast('更新に失敗しました', 'error'); invalidateAndReload('pipeline'); } }
            
            // タスク追加
            async function openAddTaskModal() {
                document.getElementById('addTaskModal').classList.remove('hidden');
                document.getElementById('addTaskForm').reset();
                const today = new Date().toISOString().split('T')[0];
                document.querySelector('#addTaskForm input[name="start_date"]').value = today;
                const end = new Date(); end.setDate(end.getDate() + 7);
                document.querySelector('#addTaskForm input[name="end_date"]').value = end.toISOString().split('T')[0];
                const select = document.getElementById('insertPositionSelect');
                select.innerHTML = '<option value="0">先頭に追加</option>';
                currentPipelineTasks.forEach((t, i) => { const o = document.createElement('option'); o.value = t.sort_order; o.textContent = (i+1) + '. ' + t.task_name + ' の後'; select.appendChild(o); });
                if (currentPipelineTasks.length > 0) select.value = currentPipelineTasks[currentPipelineTasks.length-1].sort_order;
            }
            function closeAddTaskModal() { document.getElementById('addTaskModal').classList.add('hidden'); }
            document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!currentPipelineId) { showToast('パイプラインが未設定です', 'warning'); return; }
                const fd = new FormData(e.target);
                try { await axios.post('/api/pipeline-tasks', { pipeline_id: currentPipelineId, task_name: fd.get('task_name'), task_type: fd.get('task_type') || 'internal', start_date: fd.get('start_date') || null, end_date: fd.get('end_date') || null, description: fd.get('description') || '', insert_after: parseInt(fd.get('insert_position')) || 0 }); showToast('タスクを追加しました'); closeAddTaskModal(); invalidateAndReload('pipeline'); } catch(e) { showToast('追加に失敗しました', 'error'); }
            });
            
            // チェックリスト・書類
            window.switchChecklistTab = function(tab) {
                const ct = document.getElementById('checklistTabCommon'), cst = document.getElementById('checklistTabCase');
                const cc = document.getElementById('checklistContentCommon'), csc = document.getElementById('checklistContentCase');
                if (tab === 'common') { ct.className = 'px-3 py-1.5 text-xs font-medium border-b-2 border-green-600 text-green-600 -mb-px'; cst.className = 'px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px'; cc.classList.remove('hidden'); csc.classList.add('hidden'); }
                else { cst.className = 'px-3 py-1.5 text-xs font-medium border-b-2 border-blue-600 text-blue-600 -mb-px'; ct.className = 'px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px'; csc.classList.remove('hidden'); cc.classList.add('hidden'); }
            };
            
            async function loadDocuments() {
                try {
                    const [ctr, clr, dr, cdr] = await Promise.all([ axios.get('/api/common-document-types'), axios.get('/api/cases/' + CASE_ID + '/document-checklist'), axios.get('/api/cases/' + CASE_ID + '/documents'), axios.get('/api/clients/' + CLIENT_ID + '/common-documents') ]);
                    const commonTypes = ctr.data||[], checklist = clr.data||[], documents = dr.data||[], commonDocs = cdr.data||[];
                    const allDocs = [...documents, ...commonDocs.map(d => ({...d, isCommon: true}))];
                    const uploadedTypes = new Set(allDocs.map(d => d.document_type || d.type_name));
                    const uploadedArr = allDocs.map(d => (d.document_type || d.type_name || '').toLowerCase());
                    function renderCheckItem(item, docs) {
                        const it = (item.document_type || item.name || '').toLowerCase();
                        const isUp = uploadedTypes.has(item.document_type || item.name) || uploadedArr.some(u => u && it && (u.includes(it) || it.includes(u)));
                        const dn = item.document_type || item.name;
                        return '<div class="flex items-center gap-2 p-2.5 rounded-lg border ' + (isUp ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200') + '"><i class="fas fa-' + (isUp ? 'check-circle text-green-500' : 'circle text-gray-300') + ' text-sm"></i><span class="text-sm flex-1">' + dn + '</span>' + (item.is_required ? '<span class="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded">必須</span>' : '') + '</div>';
                    }
                    // 共通
                    const ccl = document.getElementById('checklistCommonList');
                    if (commonTypes.length === 0) { ccl.innerHTML = '<div class="text-gray-500 text-center py-3 text-sm">なし</div>'; }
                    else { const cu = commonTypes.filter(t => { const n = (t.name||'').toLowerCase(); return uploadedArr.some(u => u && n && (u.includes(n) || n.includes(u))); }).length; document.getElementById('checklistCommonBadge').textContent = cu+'/'+commonTypes.length; ccl.innerHTML = commonTypes.map(t => renderCheckItem({document_type:t.name,description:t.description,is_required:true}, allDocs)).join(''); }
                    // 案件
                    const cscl = document.getElementById('checklistCaseList');
                    if (checklist.length === 0) { cscl.innerHTML = '<div class="text-gray-500 text-center py-3 text-sm">なし</div>'; }
                    else { const cu2 = checklist.filter(i => { const it = (i.document_type||'').toLowerCase(); return uploadedArr.some(u => u && it && (u.includes(it) || it.includes(u))); }).length; document.getElementById('checklistCaseBadge').textContent = cu2+'/'+checklist.length; cscl.innerHTML = checklist.map(i => renderCheckItem(i, allDocs)).join(''); }
                    // アップロード済み
                    const dc = document.getElementById('uploadedDocuments');
                    if (documents.length === 0) { dc.innerHTML = '<div class="text-gray-500 text-center py-3 text-sm">書類なし</div>'; }
                    else { dc.innerHTML = documents.map(doc => { const isPending = doc.status === 'pending' || !doc.status; return '<div class="border rounded-lg p-2.5 hover:shadow-sm transition ' + (isPending ? 'bg-yellow-50 border-yellow-200' : '') + '"><div class="flex items-start gap-2"><div class="flex-1 min-w-0"><div class="flex items-center gap-1.5 mb-0.5"><span class="text-sm font-medium text-gray-800 truncate">' + doc.document_type + '</span><span class="px-1.5 py-0.5 rounded text-xs ' + ({pending:'bg-yellow-100 text-yellow-700',approved:'bg-green-100 text-green-700',rejected:'bg-red-100 text-red-700'}[doc.status]||'bg-gray-100') + '">' + ({pending:'確認待ち',approved:'承認済み',rejected:'差し戻し'}[doc.status]||doc.status) + '</span></div><div class="text-xs text-gray-500 truncate">' + doc.file_name + '</div></div></div><div class="flex items-center gap-1.5 mt-2 pt-2 border-t"><a href="/api/documents/' + doc.id + '/download" class="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"><i class="fas fa-download mr-1"></i>DL</a>' + (isPending ? '<button onclick="approveDocument(' + doc.id + ')" class="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"><i class="fas fa-check"></i></button><button onclick="rejectDocument(' + doc.id + ')" class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"><i class="fas fa-times"></i></button>' : '') + '</div></div>'; }).join(''); }
                } catch(e) { console.error('Documents error:', e); }
            }
            async function approveDocument(id) { if (!confirm('承認しますか？')) return; try { await axios.put('/api/documents/' + id + '/status', { status: 'approved' }); showToast('承認しました'); invalidateAndReload('documents'); } catch(e) { showToast('失敗しました'); } }
            window.approveDocument = approveDocument;
            async function rejectDocument(id) { const reason = prompt('差し戻し理由（任意）:'); if (reason === null) return; try { await axios.put('/api/documents/' + id + '/status', { status: 'rejected', reason }); showToast('差し戻しました'); invalidateAndReload('documents'); } catch(e) { showToast('失敗しました'); } }
            window.rejectDocument = rejectDocument;
            
            // 一括DL
            async function downloadAllDocuments() {
                const btn = document.getElementById('downloadAllBtn'); const orig = btn.innerHTML;
                try {
                    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 準備中...';
                    const r = await axios.get('/api/cases/' + CASE_ID + '/documents/download-all');
                    if (!r.data.success || r.data.files.length === 0) { showToast('ダウンロードする書類がありません'); return; }
                    btn.innerHTML = '<i class="fas fa-cog fa-spin"></i> ZIP作成中...';
                    if (!window.JSZip) { await new Promise((res,rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
                    const zip = new JSZip();
                    for (const f of r.data.files) { const bs = atob(f.data); const bytes = new Uint8Array(bs.length); for (let i=0;i<bs.length;i++) bytes[i]=bs.charCodeAt(i); zip.file(f.name, bytes); }
                    const content = await zip.generateAsync({ type: 'blob' });
                    const url = URL.createObjectURL(content); const a = document.createElement('a'); a.href = url; a.download = r.data.zipFileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                    showToast(r.data.totalFiles + '件をダウンロードしました');
                } catch(e) { if (e.response?.status === 404) showToast('書類がありません'); else showToast('ダウンロード失敗'); } finally { btn.disabled = false; btn.innerHTML = orig; }
            }
            
            // ヒアリング
            function switchHearingAnswerTab(tab) {
                const ct = document.getElementById('hearingTabCommon'), cst = document.getElementById('hearingTabCase');
                const cc = document.getElementById('hearingContentCommon'), csc = document.getElementById('hearingContentCase');
                if (tab === 'common') { ct.className = 'px-3 py-1.5 text-xs font-medium border-b-2 border-blue-600 text-blue-600 -mb-px'; cst.className = 'px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px'; cc.classList.remove('hidden'); csc.classList.add('hidden'); }
                else { cst.className = 'px-3 py-1.5 text-xs font-medium border-b-2 border-indigo-600 text-indigo-600 -mb-px'; ct.className = 'px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent -mb-px'; csc.classList.remove('hidden'); cc.classList.add('hidden'); }
            }
            window.switchHearingAnswerTab = switchHearingAnswerTab;
            async function loadHearing() {
                try {
                    const r = await axios.get('/api/cases/' + CASE_ID + '/hearing-answers');
                    const answers = r.data;
                    const commonQ = answers.filter(a => a.subsidy_type_id === 0), caseQ = answers.filter(a => a.subsidy_type_id !== 0);
                    const renderQ = (a) => '<div class="border rounded-lg p-3 hover:bg-gray-50 transition"><div class="font-medium text-gray-800 text-sm mb-1.5">' + (a.question_text || 'Q: ' + a.question_id) + (a.is_required ? ' <span class="text-red-500 text-xs">*</span>' : '') + '</div><div class="bg-gray-50 rounded p-2 text-sm">' + (a.answer_text || '<span class="text-gray-400 italic">未回答</span>') + '</div></div>';
                    document.getElementById('hearingCommonList').innerHTML = commonQ.length > 0 ? commonQ.map(renderQ).join('') : '<div class="text-gray-500 text-center py-3 text-sm">なし</div>';
                    document.getElementById('hearingCaseList').innerHTML = caseQ.length > 0 ? caseQ.map(renderQ).join('') : '<div class="text-gray-500 text-center py-3 text-sm">なし</div>';
                    const ca = commonQ.filter(q => q.answer_text).length, csa = caseQ.filter(q => q.answer_text).length;
                    document.getElementById('hearingCommonBadge').textContent = ca + '/' + commonQ.length;
                    document.getElementById('hearingCaseBadge').textContent = csa + '/' + caseQ.length;
                    const total = answers.length, answered = answers.filter(a => a.answer_text).length;
                    const prog = total > 0 ? Math.round((answered / total) * 100) : 0;
                    document.getElementById('hearingProgressText').textContent = answered + '/' + total + '問';
                    document.getElementById('hearingProgressBar').style.width = prog + '%';
                } catch(e) { console.error('Hearing error:', e); }
            }
            
            // 請求書
            async function loadInvoices() {
                try {
                    const r = await axios.get('/api/cases/' + CASE_ID + '/invoices');
                    const invoices = r.data;
                    const container = document.getElementById('invoicesList');
                    document.getElementById('invoiceCountSummary').textContent = invoices.length;
                    // バッジ更新
                    const pending = invoices.filter(i => ['issued','sent','payment_reported'].includes(i.status)).length;
                    const badge = document.getElementById('invoiceBadge');
                    if (pending > 0) { badge.textContent = pending; badge.classList.remove('hidden'); } else badge.classList.add('hidden');
                    
                    if (invoices.length === 0) { container.innerHTML = '<div class="text-center py-6 text-gray-500"><i class="fas fa-file-invoice text-3xl mb-2 opacity-50"></i><div class="text-sm">請求書なし</div><div class="text-xs mt-1">上部のボタンから作成してください</div></div>'; loadContractInfo(); return; }
                    const stl = { draft:{l:'下書き',c:'bg-gray-100 text-gray-600'}, issued:{l:'発行済み',c:'bg-blue-100 text-blue-700'}, sent:{l:'送付済み',c:'bg-yellow-100 text-yellow-700'}, payment_reported:{l:'振込報告',c:'bg-purple-100 text-purple-700'}, paid:{l:'入金済み',c:'bg-green-100 text-green-700'}, cancelled:{l:'キャンセル',c:'bg-red-100 text-red-700'} };
                    const tl = { deposit:{l:'手付金',c:'text-yellow-600',i:'fa-hand-holding-usd'}, success_fee:{l:'成功報酬',c:'text-purple-600',i:'fa-trophy'}, other:{l:'その他',c:'text-gray-600',i:'fa-file-invoice'} };
                    container.innerHTML = '<div class="space-y-2">' + invoices.map(inv => {
                        const s = stl[inv.status]||stl.draft, t = tl[inv.invoice_type]||tl.other;
                        return '<div class="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"><div class="text-xl ' + t.c + '"><i class="fas ' + t.i + '"></i></div><div class="flex-1 min-w-0"><div class="flex items-center gap-2"><span class="font-bold text-sm">' + inv.invoice_number + '</span><span class="text-xs px-1.5 py-0.5 rounded ' + s.c + '">' + s.l + '</span></div><div class="text-xs text-gray-500">' + inv.item_name + '</div></div><div class="text-right"><div class="font-bold">¥' + inv.total_amount.toLocaleString() + '</div><div class="text-xs text-gray-500">(税込)</div></div><div class="flex gap-1">' + (inv.status==='draft' ? '<button onclick="issueInvoice('+inv.id+')" class="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"><i class="fas fa-paper-plane"></i></button>' : '') + (['issued','sent','payment_reported'].includes(inv.status) ? '<button onclick="markInvoicePaid('+inv.id+')" class="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"><i class="fas fa-check"></i></button>' : '') + '<button onclick="viewInvoiceDetail('+inv.id+')" class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-300"><i class="fas fa-eye"></i></button>' + (inv.status==='draft' ? '<button onclick="deleteInvoice('+inv.id+')" class="bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200"><i class="fas fa-trash"></i></button>' : '') + '</div></div>';
                    }).join('') + '</div>';
                    loadContractInfo();
                } catch(e) { console.error('Invoice error:', e); document.getElementById('invoicesList').innerHTML = '<div class="text-center py-6 text-red-500 text-sm">読み込みエラー</div>'; }
            }
            
            async function loadContractInfo() {
                try {
                    const r = await axios.get('/api/cases/' + CASE_ID);
                    const d = r.data;
                    document.getElementById('contractInfo').innerHTML = '<div class="space-y-3"><div><label class="block text-sm text-gray-600 mb-1">電子契約URL</label><div class="flex gap-2"><input type="url" id="contractUrlInput" value="' + (d.contract_url || '') + '" placeholder="https://..." class="flex-1 px-3 py-2 border rounded-lg text-sm"><button onclick="saveContractUrl()" class="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm"><i class="fas fa-save mr-1"></i>保存</button></div></div>' + (d.contract_url ? '<a href="' + d.contract_url + '" target="_blank" class="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"><i class="fas fa-file-signature text-blue-600"></i><div class="flex-1"><div class="font-medium text-blue-700 text-sm">契約書を開く</div></div><i class="fas fa-external-link-alt text-blue-400"></i></a>' : '') + '</div>';
                } catch(e) { console.error('Contract error:', e); }
            }
            
            // 報酬設定
            function toggleSuccessFeeEdit() { document.getElementById('successFeeEditFields').classList.toggle('hidden', !document.getElementById('successFeeEnabledEdit').checked); }
            window.toggleSuccessFeeEdit = toggleSuccessFeeEdit;
            function toggleSuccessFeeTypeEdit() { const t = document.getElementById('successFeeTypeEdit').value; document.getElementById('successFeePercentageEditField').classList.toggle('hidden', t !== 'percentage'); document.getElementById('successFeeAmountEditField').classList.toggle('hidden', t === 'percentage'); }
            window.toggleSuccessFeeTypeEdit = toggleSuccessFeeTypeEdit;
            function updateRewardSettings() { document.getElementById('depositAmountEditField').classList.toggle('hidden', !document.getElementById('depositRequiredEdit').checked); if (document.getElementById('depositRequiredEdit').checked) calculateDepositPreview(); }
            window.updateRewardSettings = updateRewardSettings;
            
            let depositTaxMode = '${caseData.deposit_tax_included ? 'including' : 'excluding'}';
            function setDepositTaxMode(m) { depositTaxMode = m; document.getElementById('depositTaxIncludedEdit').value = m === 'including' ? '1' : '0'; document.getElementById('depositTaxExcluding').className = 'text-xs px-2 py-0.5 rounded ' + (m==='excluding' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'); document.getElementById('depositTaxIncluding').className = 'text-xs px-2 py-0.5 rounded ' + (m==='including' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'); calculateDepositPreview(); }
            window.setDepositTaxMode = setDepositTaxMode;
            function calculateDepositPreview() { const v = parseInt(document.getElementById('depositAmountEdit').value) || 0; const p = document.getElementById('depositPreview'), pt = document.getElementById('depositPreviewText'); if (v <= 0) { p.classList.add('hidden'); return; } p.classList.remove('hidden'); if (depositTaxMode === 'including') { const s = v - Math.floor(v - v / 1.1); const t = v - s; pt.innerHTML = '税込 <strong>¥'+v.toLocaleString()+'</strong> → 税抜 ¥'+s.toLocaleString()+' + 消費税 ¥'+t.toLocaleString(); } else { const t = Math.floor(v * 0.1); pt.innerHTML = '税抜 ¥'+v.toLocaleString()+' + 消費税 ¥'+t.toLocaleString()+' = <strong>税込 ¥'+(v+t).toLocaleString()+'</strong>'; } }
            window.calculateDepositPreview = calculateDepositPreview;
            let successFeeTaxMode = '${caseData.success_fee_tax_included ? 'including' : 'excluding'}';
            function setSuccessFeeTaxMode(m) { successFeeTaxMode = m; document.getElementById('successFeeTaxIncludedEdit').value = m === 'including' ? '1' : '0'; document.getElementById('successFeeTaxExcluding').className = 'text-xs px-2 py-0.5 rounded ' + (m==='excluding' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'); document.getElementById('successFeeTaxIncluding').className = 'text-xs px-2 py-0.5 rounded ' + (m==='including' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'); calculateSuccessFeePreview(); }
            window.setSuccessFeeTaxMode = setSuccessFeeTaxMode;
            function calculateSuccessFeePreview() { /* similar to deposit preview */ }
            window.calculateSuccessFeePreview = calculateSuccessFeePreview;
            
            async function saveRewardSettings() {
                try {
                    const data = { deposit_required: document.getElementById('depositRequiredEdit').checked ? 1 : 0, deposit_amount: parseInt(document.getElementById('depositAmountEdit').value) || 0, deposit_tax_included: document.getElementById('depositTaxIncludedEdit').value === '1' ? 1 : 0, success_fee_enabled: document.getElementById('successFeeEnabledEdit').checked ? 1 : 0, success_fee_rate: document.getElementById('successFeeTypeEdit')?.value === 'percentage' ? (parseFloat(document.getElementById('successFeePercentageEdit')?.value) || 0) : 0, success_fee_amount: document.getElementById('successFeeTypeEdit')?.value === 'fixed' ? (parseInt(document.getElementById('successFeeAmountEdit')?.value) || 0) : 0, success_fee_tax_included: document.getElementById('successFeeTaxIncludedEdit')?.value === '1' ? 1 : 0 };
                    await axios.put('/api/cases/' + CASE_ID, data);
                    showToast('報酬設定を保存しました');
                } catch(e) { console.error('Save error:', e); showToast('保存に失敗しました'); }
            }
            window.saveRewardSettings = saveRewardSettings;
            
            // 請求書作成
            let currentInvoiceType = 'deposit', currentInputMode = 'excluding';
            function openCreateInvoiceModal(type) {
                currentInvoiceType = type; document.getElementById('invoiceType').value = type;
                const modal = document.getElementById('createInvoiceModal'), title = document.getElementById('invoiceModalTitle'), itemName = document.getElementById('invoiceItemName'), ws = document.getElementById('withholdingSection'), sub = document.getElementById('invoiceSubtotal'), desc = document.getElementById('invoiceItemDescription');
                if (type === 'deposit') { title.textContent = '手付金請求書を作成'; itemName.value = '補助金申請サポート 着手金'; ws.classList.add('hidden'); sub.value = ''; desc.value = ''; }
                else { title.textContent = '成功報酬請求書を作成'; itemName.value = '補助金申請サポート 成功報酬'; ws.classList.remove('hidden'); if (SUCCESS_FEE_RATE > 0 && APPROVED_AMOUNT > 0) { sub.value = Math.floor(APPROVED_AMOUNT * SUCCESS_FEE_RATE / 100); desc.value = '採択額 ¥'+APPROVED_AMOUNT.toLocaleString()+' × '+SUCCESS_FEE_RATE+'%'; } else if (SUCCESS_FEE_AMOUNT > 0) { sub.value = SUCCESS_FEE_AMOUNT; desc.value = '固定報酬'; } else { sub.value = ''; desc.value = ''; } }
                const today = new Date(), due = new Date(today); due.setDate(due.getDate() + 14);
                document.getElementById('invoiceIssueDate').value = today.toISOString().split('T')[0];
                document.getElementById('invoiceDueDate').value = due.toISOString().split('T')[0];
                document.getElementById('invoiceNotes').value = ''; document.getElementById('invoiceTaxRate').value = '10';
                document.getElementById('invoiceWithholding').checked = false;
                currentInputMode = 'excluding'; setInputMode('excluding');
                calculateInvoiceTotal(); modal.classList.remove('hidden');
            }
            window.openCreateInvoiceModal = openCreateInvoiceModal;
            function closeCreateInvoiceModal() { document.getElementById('createInvoiceModal').classList.add('hidden'); currentInputMode = 'excluding'; }
            window.closeCreateInvoiceModal = closeCreateInvoiceModal;
            function setInputMode(m) { currentInputMode = m; document.getElementById('inputModeExcludingTax').className = 'text-xs px-2 py-0.5 rounded ' + (m==='excluding' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'); document.getElementById('inputModeIncludingTax').className = 'text-xs px-2 py-0.5 rounded ' + (m==='including' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'); document.getElementById('inputModeHint').textContent = m === 'including' ? '税込金額を入力' : '税抜金額を入力'; calculateInvoiceTotal(); }
            window.setInputMode = setInputMode;
            function calculateInvoiceTotal() {
                const v = parseInt(document.getElementById('invoiceSubtotal').value) || 0;
                const tr = parseInt(document.getElementById('invoiceTaxRate').value) || 0;
                const hw = document.getElementById('invoiceWithholding').checked;
                let sub, tax, total;
                if (currentInputMode === 'including' && tr > 0) { total = v; sub = Math.ceil(v / (1 + tr/100)); if (sub + Math.floor(sub*tr/100) > total) sub = Math.floor(v/(1+tr/100)); tax = total - sub; }
                else { sub = v; tax = Math.floor(sub * tr / 100); total = sub + tax; }
                let wh = 0; if (hw) { wh = Math.floor(sub * 0.1021); total -= wh; }
                document.getElementById('invoiceSubtotal').dataset.actualSubtotal = sub;
                document.getElementById('calcSubtotal').textContent = '¥' + sub.toLocaleString();
                document.getElementById('calcTax').textContent = '¥' + tax.toLocaleString();
                document.getElementById('calcWithholding').textContent = '-¥' + wh.toLocaleString();
                document.getElementById('calcTotal').textContent = '¥' + total.toLocaleString();
                document.getElementById('calcWithholdingRow').classList.toggle('hidden', !hw);
            }
            window.calculateInvoiceTotal = calculateInvoiceTotal;
            document.getElementById('createInvoiceForm').addEventListener('submit', async (e) => { e.preventDefault(); await createInvoice('draft'); });
            async function createAndIssueInvoice() { await createInvoice('issued'); }
            window.createAndIssueInvoice = createAndIssueInvoice;
            async function createInvoice(status) {
                try {
                    const v = parseInt(document.getElementById('invoiceSubtotal').value) || 0;
                    const tr = parseInt(document.getElementById('invoiceTaxRate').value) || 0;
                    const hw = document.getElementById('invoiceWithholding').checked;
                    let sub, ta, total;
                    if (currentInputMode === 'including' && tr > 0) { const it = v; sub = Math.ceil(it/(1+tr/100)); if (sub + Math.floor(sub*tr/100) > it) sub = Math.floor(it/(1+tr/100)); ta = it - sub; total = it; }
                    else { sub = v; ta = Math.floor(sub*tr/100); total = sub + ta; }
                    const wh = hw ? Math.floor(sub * 0.1021) : 0; total -= wh;
                    await axios.post('/api/cases/' + CASE_ID + '/invoices', { invoice_type: document.getElementById('invoiceType').value, item_name: document.getElementById('invoiceItemName').value, item_description: document.getElementById('invoiceItemDescription').value || null, subtotal: sub, tax_rate: tr, tax_amount: ta, withholding_tax: wh, total_amount: total, issue_date: document.getElementById('invoiceIssueDate').value || null, due_date: document.getElementById('invoiceDueDate').value || null, notes: document.getElementById('invoiceNotes').value || null, status });
                    showToast(status === 'issued' ? '請求書を発行しました' : '下書き保存しました');
                    closeCreateInvoiceModal(); invalidateAndReload('invoices');
                } catch(e) { showToast('作成に失敗しました: ' + (e.response?.data?.error || e.message), 'error'); }
            }
            async function issueInvoice(id) { if (!confirm('発行しますか？')) return; try { await axios.put('/api/invoices/' + id + '/status', { status: 'issued' }); showToast('発行しました'); invalidateAndReload('invoices'); } catch(e) { showToast('失敗しました', 'error'); } }
            window.issueInvoice = issueInvoice;
            async function markInvoicePaid(id) { if (!confirm('入金確認しますか？')) return; try { await axios.put('/api/invoices/' + id + '/status', { status: 'paid' }); showToast('入金確認しました'); invalidateAndReload('invoices'); } catch(e) { showToast('失敗しました', 'error'); } }
            window.markInvoicePaid = markInvoicePaid;
            async function viewInvoiceDetail(id) { window.open('/api/invoices/' + id + '/pdf', '_blank'); showToast('請求書を開きました'); }
            window.viewInvoiceDetail = viewInvoiceDetail;
            async function deleteInvoice(id) { if (!confirm('削除しますか？')) return; try { await axios.delete('/api/invoices/' + id); showToast('削除しました'); invalidateAndReload('invoices'); } catch(e) { showToast('失敗しました', 'error'); } }
            window.deleteInvoice = deleteInvoice;
            async function saveContractUrl() { try { await axios.put('/api/cases/' + CASE_ID, { contract_url: document.getElementById('contractUrlInput').value.trim() || null }); showToast('保存しました'); loadContractInfo(); } catch(e) { showToast('保存に失敗しました', 'error'); } }
            
            // やり取り
            async function loadCommunications() {
                try {
                    const r = await axios.get('/api/cases/' + CASE_ID + '/communications');
                    const comms = r.data;
                    const c = document.getElementById('communicationsList');
                    if (comms.length === 0) { c.innerHTML = '<div class="text-gray-500 text-center py-4 text-sm">やり取りなし</div>'; return; }
                    c.innerHTML = comms.map(comm => '<div class="flex gap-2 ' + (comm.sender_type==='staff'?'':'flex-row-reverse') + '"><div class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ' + (comm.sender_type==='staff'?'bg-blue-100 text-blue-600':'bg-green-100 text-green-600') + '"><i class="fas fa-' + (comm.sender_type==='staff'?'user-tie':'user') + ' text-xs"></i></div><div class="flex-1 ' + (comm.sender_type==='staff'?'':'text-right') + '"><div class="inline-block max-w-[80%] p-2 rounded-lg ' + (comm.sender_type==='staff'?'bg-blue-50':'bg-green-50') + '"><div class="text-sm">' + comm.message + '</div></div><div class="text-xs text-gray-400 mt-0.5">' + comm.sender_name + ' - ' + new Date(comm.created_at).toLocaleString('ja-JP', {timeZone:'Asia/Tokyo'}) + '</div></div></div>').join('');
                } catch(e) { console.error('Comms error:', e); }
            }
            document.getElementById('communicationForm').addEventListener('submit', async (e) => {
                e.preventDefault(); const msg = document.getElementById('communicationMessage').value.trim(); if (!msg) return;
                const sendBtn = e.target.querySelector('button[type="submit"]');
                sendBtn.disabled = true; sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                try { await axios.post('/api/cases/' + CASE_ID + '/communications', { message: msg, sender_type: 'staff', sender_name: localStorage.getItem('admin_name') || 'スタッフ' }); document.getElementById('communicationMessage').value = ''; invalidateAndReload('communications'); showToast('送信しました'); } catch(e) { showToast('送信に失敗しました', 'error'); }
                finally { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>'; }
            });
            
            // パイプラインテンプレート適用
            async function openApplyPipelineModal() {
                document.getElementById('applyPipelineModal').classList.remove('hidden');
                try {
                    let url = '/api/pipeline-templates'; if (SUBSIDY_TYPE_ID) url += '?subsidy_type_id=' + SUBSIDY_TYPE_ID;
                    const r = await axios.get(url); const templates = r.data;
                    const s = document.getElementById('pipelineTemplateSelect');
                    s.innerHTML = '<option value="">テンプレートを選択...</option>';
                    templates.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name + ' (' + (t.task_count||0) + 'タスク)'; o.dataset.description = t.description || ''; s.appendChild(o); });
                    s.onchange = function() { const d = this.options[this.selectedIndex]?.dataset?.description; const dd = document.getElementById('templateDescription'); if (d) { dd.textContent = d; dd.classList.remove('hidden'); } else dd.classList.add('hidden'); };
                } catch(e) { console.error(e); }
            }
            function closeApplyPipelineModal() { document.getElementById('applyPipelineModal').classList.add('hidden'); }
            async function applyPipelineTemplate() { const tid = document.getElementById('pipelineTemplateSelect').value; if (!tid) { showToast('テンプレートを選択してください', 'warning'); return; } try { await axios.post('/api/cases/' + CASE_ID + '/apply-pipeline', { template_id: tid }); showToast('適用しました'); closeApplyPipelineModal(); invalidateAndReload('pipeline'); } catch(e) { showToast('適用に失敗しました', 'error'); } }
            
            // 担当者変更
            let allUsers = [];
            async function loadUsers() {
                try {
                    const r = await axios.get('/api/admin/users');
                    allUsers = r.data;
                    const select = document.getElementById('assignedToSelect');
                    select.innerHTML = '<option value="">未割り当て</option>';
                    allUsers.forEach(u => {
                        const o = document.createElement('option');
                        o.value = u.username;
                        o.textContent = u.name || u.username;
                        if (u.username === '${caseData.assigned_to || ''}') o.selected = true;
                        select.appendChild(o);
                    });
                } catch(e) { console.error('Users load error:', e); }
            }
            async function updateAssignedTo() {
                const val = document.getElementById('assignedToSelect').value;
                try {
                    await axios.put('/api/cases/' + CASE_ID, { assigned_to: val || null });
                    showToast('担当者を更新しました');
                } catch(e) { showToast('担当者の更新に失敗しました', 'error'); }
            }
            window.updateAssignedTo = updateAssignedTo;

            // 遅延読み込み: 表示中タブのみデータ取得、キャッシュ付き
            var tabDataLoaded = { pipeline: false, documents: false, hearing: false, invoices: false, communications: false };
            function loadTabDataIfNeeded(tabId) {
                if (tabDataLoaded[tabId]) return;
                tabDataLoaded[tabId] = true;
                switch(tabId) {
                    case 'pipeline': loadPipeline(); break;
                    case 'documents': loadDocuments(); break;
                    case 'hearing': loadHearing(); break;
                    case 'invoices': loadInvoices(); break;
                    case 'communications': loadCommunications(); break;
                }
            }

            // 初期読み込み（最小限: ケースデータ + ユーザーリスト + デフォルトタブのみ）
            var startTime = performance.now();
            Promise.all([loadCaseData(), loadUsers()]).then(function() {
                console.log('[perf] 初期データ読み込み完了: ' + Math.round(performance.now() - startTime) + 'ms');
                // URLハッシュからタブを復元
                var hash = window.location.hash.replace('#', '');
                var validTabs = ['pipeline','documents','hearing','invoices','communications'];
                if (hash && validTabs.includes(hash)) {
                    switchTab(hash);
                } else {
                    loadTabDataIfNeeded('pipeline');
                }
            });
            
            ${sidebarScripts}
        </script>
    </body>
    </html>
  `)
})

export default routes
