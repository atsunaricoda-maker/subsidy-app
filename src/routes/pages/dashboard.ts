// 管理者画面
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import { modalStyles, modalScripts } from '../../templates/modal'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 管理者トップページ
routes.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>申請らくらく君 - 管理者</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
            ${modalStyles}
            
            /* ボタンの押下効果 */
            button, a.bg-blue-600, a.bg-green-600, a.bg-purple-600, a.bg-red-600 {
                transition: all 0.15s ease;
            }
            button:active, a.bg-blue-600:active, a.bg-green-600:active, a.bg-purple-600:active, a.bg-red-600:active {
                transform: scale(0.97);
            }
            
            /* カードのホバー効果 */
            .hover-lift { transition: all 0.2s ease; }
            .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
            
            /* スケルトンローダーのアニメーション */
            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            .skeleton-shimmer {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
            }
            
            /* 入力フォーカス時のハイライト */
            input:focus, select:focus, textarea:focus {
                outline: none;
                ring: 2px;
                ring-color: #3b82f6;
            }
            
            /* ステータスカードのホバー */
            #statusCards a { transition: all 0.2s ease; }
            #statusCards a:hover { transform: translateY(-3px); }
            
            /* トーストアニメーション */
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in { animation: fadeInUp 0.3s ease; }
            
            /* モーダルのフェード */
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .modal-backdrop { animation: fadeIn 0.2s ease; }
            
            /* 選択リストのアイテム */
            .subsidy-option { transition: all 0.15s ease; }
            .subsidy-option:hover { background-color: #f3f4f6; }
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('dashboard')}
            
            <!-- メインコンテンツ -->
            <main class="flex-1 min-h-screen">
                <!-- トップバー -->
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">ダッシュボード</h2>
                        </div>
                        <div class="flex items-center gap-3">
                            <button onclick="loadData()" class="text-gray-500 hover:text-gray-700" title="更新">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                            <span id="adminName" class="text-sm text-gray-600 hidden sm:inline">
                                <i class="fas fa-user-shield mr-1"></i>
                                管理者モード
                            </span>
                        </div>
                    </div>
                </header>
                
                <div class="p-4 lg:p-6">
                    <!-- 未対応通知セクション -->
                    <div id="notificationSummary" class="hidden mb-6">
                        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-4 border border-blue-100">
                            <h3 class="text-base font-bold mb-3 text-blue-700 flex items-center gap-2">
                                <i class="fas fa-bell"></i>未対応の通知
                            </h3>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3" id="notificationCards">
                                <button type="button" id="notifyCardMessage" onclick="openNotificationsModal('new_message')" class="bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md hover:bg-blue-50 transition border-l-4 border-blue-400 text-left w-full">
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <div class="text-gray-500 text-xs">未読メッセージ</div>
                                            <div class="text-xl font-bold text-blue-600" id="notify-message">0</div>
                                        </div>
                                        <i class="fas fa-envelope text-blue-200 text-xl"></i>
                                    </div>
                                </button>
                                <button type="button" id="notifyCardDocument" onclick="openNotificationsModal('document_upload')" class="bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md hover:bg-green-50 transition border-l-4 border-green-400 text-left w-full">
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <div class="text-gray-500 text-xs">書類アップロード</div>
                                            <div class="text-xl font-bold text-green-600" id="notify-document">0</div>
                                        </div>
                                        <i class="fas fa-file-upload text-green-200 text-xl"></i>
                                    </div>
                                </button>
                                <button type="button" id="notifyCardPayment" onclick="openNotificationsModal('payment_report')" class="bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md hover:bg-yellow-50 transition border-l-4 border-yellow-400 text-left w-full">
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <div class="text-gray-500 text-xs">入金報告</div>
                                            <div class="text-xl font-bold text-yellow-600" id="notify-payment">0</div>
                                        </div>
                                        <i class="fas fa-yen-sign text-yellow-200 text-xl"></i>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- ステータスカード -->
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4 mb-6" id="statusCards">
                        <button onclick="openStatusModal('inquiry', '見込み')" class="bg-white p-3 lg:p-4 rounded-xl shadow-sm border-l-4 border-yellow-400 hover:shadow-md transition cursor-pointer block w-full text-left">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-gray-500 text-xs mb-1">見込み</div>
                                    <div class="text-xl lg:text-2xl font-bold text-yellow-500" id="count-inquiry">-</div>
                                </div>
                                <i class="fas fa-search text-yellow-200 text-xl lg:text-2xl"></i>
                            </div>
                        </button>
                        <button onclick="openStatusModal('preparing', '書類準備中')" class="bg-white p-3 lg:p-4 rounded-xl shadow-sm border-l-4 border-orange-400 hover:shadow-md transition cursor-pointer block w-full text-left">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-gray-500 text-xs mb-1">書類準備</div>
                                    <div class="text-xl lg:text-2xl font-bold text-orange-500" id="count-preparing">-</div>
                                </div>
                                <i class="fas fa-folder-open text-orange-200 text-xl lg:text-2xl"></i>
                            </div>
                        </button>
                        <button onclick="openStatusModal('applying', '申請中')" class="bg-white p-3 lg:p-4 rounded-xl shadow-sm border-l-4 border-purple-400 hover:shadow-md transition cursor-pointer block w-full text-left">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-gray-500 text-xs mb-1">申請中</div>
                                    <div class="text-xl lg:text-2xl font-bold text-purple-500" id="count-applying">-</div>
                                </div>
                                <i class="fas fa-paper-plane text-purple-200 text-xl lg:text-2xl"></i>
                            </div>
                        </button>
                        <button onclick="openStatusModal('adopted', '採択・入金待')" class="bg-white p-3 lg:p-4 rounded-xl shadow-sm border-l-4 border-blue-400 hover:shadow-md transition cursor-pointer block w-full text-left">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-gray-500 text-xs mb-1">採択・入金待</div>
                                    <div class="text-xl lg:text-2xl font-bold text-blue-500" id="count-adopted">-</div>
                                </div>
                                <i class="fas fa-trophy text-blue-200 text-xl lg:text-2xl"></i>
                            </div>
                        </button>
                        <button onclick="openStatusModal('rejected', '不採択')" class="bg-white p-3 lg:p-4 rounded-xl shadow-sm border-l-4 border-red-400 hover:shadow-md transition cursor-pointer block w-full text-left">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-gray-500 text-xs mb-1">不採択</div>
                                    <div class="text-xl lg:text-2xl font-bold text-red-500" id="count-rejected">-</div>
                                </div>
                                <i class="fas fa-times-circle text-red-200 text-xl lg:text-2xl"></i>
                            </div>
                        </button>
                        <button onclick="openStatusModal('archived', '完了済み')" class="bg-white p-3 lg:p-4 rounded-xl shadow-sm border-l-4 border-green-400 hover:shadow-md transition cursor-pointer block w-full text-left">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-gray-500 text-xs mb-1">完了済み</div>
                                    <div class="text-xl lg:text-2xl font-bold text-green-500" id="count-completed">-</div>
                                </div>
                                <i class="fas fa-check-circle text-green-200 text-xl lg:text-2xl"></i>
                            </div>
                        </button>
                    </div>

                    <!-- 検索・新規登録 -->
                    <div class="bg-white rounded-xl shadow-sm p-4 mb-6">
                        <div class="flex flex-col sm:flex-row gap-3">
                            <div class="flex-1 relative">
                                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input type="text" id="searchQuery" placeholder="顧客名・会社名で検索..." 
                                       class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            </div>
                            <button onclick="openNewCaseModal()" 
                                    class="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap">
                                <i class="fas fa-plus mr-2"></i>新規案件登録
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <!-- 左側：顧客一覧 -->
                        <div class="xl:col-span-2">
                            <!-- 申請期限アラート -->
                            <div id="deadlineAlertSection" class="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl shadow-sm p-4 mb-6 hidden border border-red-100">
                                <h2 class="text-base font-bold mb-3 text-red-600 flex items-center gap-2">
                                    <i class="fas fa-exclamation-triangle"></i>申請期限が近い案件
                                </h2>
                                <div id="deadlineAlertList" class="space-y-2"></div>
                            </div>
                            
                            <!-- 案件一覧 -->
                            <div class="bg-white rounded-xl shadow-sm">
                                <div class="p-4 border-b border-gray-100 flex items-center justify-between">
                                    <h2 class="text-base font-bold text-gray-800">案件一覧</h2>
                                    <span id="clientCount" class="text-sm text-gray-500">-件</span>
                                </div>
                                <div id="clientsList" class="divide-y divide-gray-100">
                                    <!-- スケルトンローダー -->
                                    <div class="skeleton-loader">
                                        <div class="p-4 animate-pulse">
                                            <div class="flex items-start justify-between">
                                                <div class="flex-1 space-y-3">
                                                    <div class="flex items-center gap-3">
                                                        <div class="h-5 bg-gray-200 rounded w-32"></div>
                                                        <div class="h-5 bg-gray-200 rounded w-16"></div>
                                                        <div class="h-5 bg-gray-200 rounded w-24"></div>
                                                    </div>
                                                    <div class="h-4 bg-gray-200 rounded w-48"></div>
                                                    <div class="h-4 bg-gray-200 rounded w-36"></div>
                                                </div>
                                                <div class="flex gap-2">
                                                    <div class="h-9 bg-gray-200 rounded w-20"></div>
                                                    <div class="h-9 bg-gray-200 rounded w-16"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="p-4 animate-pulse border-t">
                                            <div class="flex items-start justify-between">
                                                <div class="flex-1 space-y-3">
                                                    <div class="flex items-center gap-3">
                                                        <div class="h-5 bg-gray-200 rounded w-28"></div>
                                                        <div class="h-5 bg-gray-200 rounded w-20"></div>
                                                    </div>
                                                    <div class="h-4 bg-gray-200 rounded w-40"></div>
                                                </div>
                                                <div class="flex gap-2">
                                                    <div class="h-9 bg-gray-200 rounded w-20"></div>
                                                    <div class="h-9 bg-gray-200 rounded w-16"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="p-4 animate-pulse border-t">
                                            <div class="flex items-start justify-between">
                                                <div class="flex-1 space-y-3">
                                                    <div class="flex items-center gap-3">
                                                        <div class="h-5 bg-gray-200 rounded w-36"></div>
                                                        <div class="h-5 bg-gray-200 rounded w-16"></div>
                                                    </div>
                                                    <div class="h-4 bg-gray-200 rounded w-32"></div>
                                                </div>
                                                <div class="flex gap-2">
                                                    <div class="h-9 bg-gray-200 rounded w-20"></div>
                                                    <div class="h-9 bg-gray-200 rounded w-16"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 右側：お知らせ・クイックアクション -->
                        <div class="space-y-4">
                            <!-- 最近の活動 -->
                            <div class="bg-white rounded-xl shadow-sm p-3">
                                <h2 class="text-sm font-bold mb-2 flex items-center gap-2 text-gray-700">
                                    <i class="fas fa-history text-purple-600"></i>最近の活動
                                </h2>
                                <div id="recentActivity" class="space-y-2 text-sm max-h-32 overflow-y-auto">
                                    <!-- スケルトンローダー -->
                                    <div class="animate-pulse space-y-2">
                                        <div class="flex items-center gap-2">
                                            <div class="w-6 h-6 bg-gray-200 rounded-full"></div>
                                            <div class="flex-1 space-y-1">
                                                <div class="h-3 bg-gray-200 rounded w-3/4"></div>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <div class="w-6 h-6 bg-gray-200 rounded-full"></div>
                                            <div class="flex-1 space-y-1">
                                                <div class="h-3 bg-gray-200 rounded w-2/3"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- タブ切り替えパネル -->
                            <div class="bg-white rounded-xl shadow-sm overflow-hidden">
                                <!-- タブヘッダー -->
                                <div class="flex border-b bg-gray-50">
                                    <button onclick="switchRightTab('assignee')" id="rightTab-assignee" class="right-tab flex-1 px-3 py-2 text-xs font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent">
                                        <i class="fas fa-user-check mr-1"></i>担当者
                                    </button>
                                    <button onclick="switchRightTab('todo')" id="rightTab-todo" class="right-tab flex-1 px-3 py-2 text-xs font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent">
                                        <i class="fas fa-calendar-week mr-1"></i>ToDo
                                    </button>
                                    <button onclick="switchRightTab('action')" id="rightTab-action" class="right-tab flex-1 px-3 py-2 text-xs font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent">
                                        <i class="fas fa-bolt mr-1"></i>操作
                                    </button>
                                </div>
                                
                                <!-- タブコンテンツ -->
                                <div class="p-4">
                                    <!-- 担当者別タスク -->
                                    <div id="rightContent-assignee" class="right-content">
                                        <div id="tasksByAssignee" class="space-y-2 text-sm max-h-48 overflow-y-auto">
                                            <div class="animate-pulse space-y-2">
                                                <div class="h-10 bg-gray-200 rounded"></div>
                                                <div class="h-10 bg-gray-200 rounded"></div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- 今週のToDo -->
                                    <div id="rightContent-todo" class="right-content hidden">
                                        <div id="weeklyTodos" class="space-y-2 text-sm max-h-48 overflow-y-auto">
                                            <div class="animate-pulse space-y-2">
                                                <div class="h-8 bg-gray-200 rounded"></div>
                                                <div class="h-8 bg-gray-200 rounded"></div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- クイックアクション -->
                                    <div id="rightContent-action" class="right-content hidden">
                                        <div class="space-y-2">
                                            <button onclick="openNewCaseModal()" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm text-left flex items-center gap-2">
                                                <i class="fas fa-plus-circle w-5"></i>新規案件登録
                                            </button>
                                            <a href="/clients" class="block w-full bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                                                <i class="fas fa-users w-5 text-gray-500"></i>顧客管理
                                            </a>
                                            <a href="/subsidy-types" class="block w-full bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                                                <i class="fas fa-list w-5 text-gray-500"></i>申請種別一覧
                                            </a>
                                            <a href="/admin/statistics" class="block w-full bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                                                <i class="fas fa-chart-line w-5 text-gray-500"></i>統計情報
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <!-- 通知モーダル -->
        <div id="notificationsModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">通知</h3>
                    <div class="flex items-center gap-2">
                        <button onclick="markAllNotificationsRead()" class="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded hover:bg-gray-200">
                            <i class="fas fa-check-double mr-1"></i>すべて既読
                        </button>
                        <button onclick="closeNotificationsModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div id="notificationsList" class="space-y-3">
                    <div class="text-center py-4 text-gray-500">読み込み中...</div>
                </div>
            </div>
        </div>

        <!-- 新規案件登録モーダル -->
        <div id="newCaseModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-4 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <h3 class="text-xl font-bold mb-4">
                    <i class="fas fa-plus-circle text-blue-600 mr-2"></i>新規案件登録
                </h3>
                <form id="newCaseForm" class="space-y-4">
                    <!-- 顧客選択セクション -->
                    <div class="border rounded-lg p-4 bg-blue-50 space-y-3">
                        <h4 class="font-medium text-sm text-blue-800 flex items-center gap-2">
                            <i class="fas fa-user"></i>顧客情報
                        </h4>
                        <div class="flex gap-3">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="customer_type" value="existing" checked onchange="toggleCustomerType()" class="text-blue-600">
                                <span class="text-sm">既存顧客から選択</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="customer_type" value="new" onchange="toggleCustomerType()" class="text-blue-600">
                                <span class="text-sm">新規顧客として登録</span>
                            </label>
                        </div>
                        
                        <!-- 既存顧客選択 -->
                        <div id="existingCustomerSection">
                            <label class="block text-sm font-medium mb-1">顧客を選択 *</label>
                            <select name="existing_client_id" id="existingClientSelect" class="w-full px-3 py-2 border rounded-lg">
                                <option value="">顧客を選択してください</option>
                            </select>
                        </div>
                        
                        <!-- 新規顧客入力 -->
                        <div id="newCustomerSection" class="hidden space-y-3">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium mb-1">顧客名 *</label>
                                    <input type="text" name="name" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">会社名</label>
                                    <input type="text" name="company_name" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div class="md:col-span-2">
                                    <label class="block text-sm font-medium mb-1">所在地</label>
                                    <input type="text" name="address" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 東京都渋谷区...">
                                    <p class="text-xs text-gray-500 mt-1">同名の会社がある場合の識別に使用します</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">メールアドレス</label>
                                    <input type="email" name="email" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-1">電話番号</label>
                                    <input type="tel" name="phone" class="w-full px-3 py-2 border rounded-lg">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 申請種別選択 -->
                    <div>
                        <label class="block text-sm font-medium mb-2">申請種別 *</label>
                        
                        <!-- 検索ボックス -->
                        <div class="relative mb-2">
                            <input type="text" id="subsidySearchInput" 
                                   placeholder="🔍 補助金・助成金名で検索..." 
                                   class="w-full px-3 py-2 border rounded-lg text-sm"
                                   oninput="filterSubsidyOptions()">
                        </div>
                        
                        <!-- カテゴリタブ -->
                        <div id="categoryTabs" class="flex flex-wrap gap-1 mb-2">
                            <button type="button" onclick="selectSubsidyCategory('all')" 
                                    class="category-tab active px-3 py-1 text-xs rounded-full bg-gray-600 text-white" data-category="all">
                                すべて
                            </button>
                            <button type="button" onclick="selectSubsidyCategory('行政書士管轄')" 
                                    class="category-tab px-3 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200" data-category="行政書士管轄">
                                <i class="fas fa-file-signature mr-1"></i>行政書士管轄
                            </button>
                            <button type="button" onclick="selectSubsidyCategory('社労士管轄')" 
                                    class="category-tab px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200" data-category="社労士管轄">
                                <i class="fas fa-users mr-1"></i>社労士管轄
                            </button>
                            <button type="button" onclick="selectSubsidyCategory('許認可')" 
                                    class="category-tab px-3 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200" data-category="許認可">
                                <i class="fas fa-stamp mr-1"></i>許認可
                            </button>
                        </div>
                        
                        <!-- 補助金リスト -->
                        <input type="hidden" name="subsidy_type_id" id="newClientSubsidyType" required>
                        <div id="subsidyOptionsList" class="border rounded-lg max-h-48 overflow-y-auto bg-white">
                            <!-- 補助金オプションがここに表示される -->
                        </div>
                        
                        <!-- 選択中の表示 -->
                        <div id="selectedSubsidyName" class="text-sm text-green-600 mt-2 hidden font-medium">
                            <i class="fas fa-check-circle mr-1"></i>選択中: <span></span>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">担当者</label>
                        <select name="assigned_to" id="newClientAssignedTo" class="w-full px-3 py-2 border rounded-lg">
                            <option value="">未割り当て</option>
                        </select>
                    </div>
                    
                    <!-- パイプライン選択 -->
                    <div>
                        <label class="block text-sm font-medium mb-2">パイプライン選択</label>
                        <p class="text-xs text-gray-500 mb-2">この案件に適用するパイプラインテンプレートを選択してください（任意）</p>
                        <select name="pipeline_template_id" id="pipelineTemplateSelect" class="w-full px-3 py-2 border rounded-lg">
                            <option value="">パイプラインなし</option>
                        </select>
                        <div id="pipelineDescription" class="text-xs text-gray-600 mt-1 hidden"></div>
                    </div>
                    
                    <!-- 契約・報酬設定 -->
                    <div class="border rounded-lg p-4 bg-gray-50 space-y-4">
                        <h4 class="font-medium text-sm text-gray-700 flex items-center gap-2">
                            <i class="fas fa-file-contract text-blue-600"></i>契約・報酬設定
                        </h4>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- 手付金設定 -->
                            <div>
                                <label class="flex items-center gap-2 mb-2">
                                    <input type="checkbox" name="deposit_required" id="depositRequired" class="rounded text-blue-600" onchange="toggleDepositFields()">
                                    <span class="text-sm font-medium">手付金が必要</span>
                                </label>
                                <div id="depositFields" class="hidden space-y-2">
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">手付金額（円）</label>
                                        <input type="number" name="deposit_amount" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 50000">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 成果報酬設定 -->
                            <div>
                                <label class="flex items-center gap-2 mb-2">
                                    <input type="checkbox" name="success_fee_enabled" id="successFeeEnabled" class="rounded text-blue-600" onchange="toggleSuccessFeeFields()">
                                    <span class="text-sm font-medium">成果報酬あり</span>
                                </label>
                                <div id="successFeeFields" class="hidden space-y-3">
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">報酬タイプ</label>
                                        <select id="successFeeType" name="success_fee_type" class="w-full px-3 py-2 border rounded-lg text-sm" onchange="toggleSuccessFeeType()">
                                            <option value="percentage">％（採択額に対する割合）</option>
                                            <option value="fixed">固定金額</option>
                                        </select>
                                    </div>
                                    <div id="successFeePercentageField">
                                        <label class="block text-xs text-gray-600 mb-1">成果報酬率（%）</label>
                                        <input type="number" name="success_fee_percentage" id="successFeePercentage" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 10" min="0" max="100" step="0.1">
                                    </div>
                                    <div id="successFeeAmountField" class="hidden">
                                        <label class="block text-xs text-gray-600 mb-1">固定報酬額（円）</label>
                                        <input type="number" name="success_fee_amount" id="successFeeAmount" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 100000" min="0">
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="flex items-center gap-2 mb-2">
                                    <input type="checkbox" name="withholding_tax" class="rounded text-blue-600">
                                    <span class="text-sm font-medium">源泉徴収あり</span>
                                </label>
                                <p class="text-xs text-gray-500">報酬から源泉徴収を行う場合</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-1">申請期限</label>
                                <input type="date" name="application_end_date" class="w-full px-3 py-2 border rounded-lg text-sm">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-1">電子契約URL</label>
                            <input type="url" name="contract_url" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://...">
                            <p class="text-xs text-gray-500 mt-1">CloudSign、freeeサインなどの電子契約URL</p>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">メモ</label>
                        <textarea name="notes" rows="2" class="w-full px-3 py-2 border rounded-lg"></textarea>
                    </div>
                    
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 text-base">
                            <i class="fas fa-save mr-2"></i>案件を登録
                        </button>
                        <button type="button" onclick="closeNewCaseModal()" 
                                class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400 text-base">
                            キャンセル
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- ステータス別案件モーダル -->
        <div id="statusCasesModal" class="modal-overlay">
            <div class="modal-container modal-lg">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="fas fa-folder-open" id="statusModalIcon"></i>
                        <span id="statusModalTitle">案件一覧</span>
                    </h3>
                    <button class="modal-close" onclick="modalManager.close('statusCasesModal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" id="statusModalContent">
                    <div class="modal-loading">
                        <div class="modal-spinner"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="modalManager.close('statusCasesModal')" class="px-4 py-2 border rounded-lg hover:bg-gray-50">
                        閉じる
                    </button>
                    <a id="statusModalLink" href="/cases" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <i class="fas fa-external-link-alt mr-1"></i>案件一覧へ
                    </a>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${modalScripts}
            
            // ステータス別案件モーダルを開く
            async function openStatusModal(status, label) {
                const iconMap = {
                    inquiry: 'fa-search text-yellow-500',
                    preparing: 'fa-folder-open text-orange-500',
                    applying: 'fa-paper-plane text-purple-500',
                    adopted: 'fa-trophy text-blue-500',
                    rejected: 'fa-times-circle text-red-500',
                    archived: 'fa-check-circle text-green-500'
                };
                
                document.getElementById('statusModalIcon').className = 'fas ' + (iconMap[status] || 'fa-folder');
                document.getElementById('statusModalTitle').textContent = label + 'の案件';
                document.getElementById('statusModalLink').href = status === 'archived' ? '/cases?archived=true' : '/cases?status=' + status;
                document.getElementById('statusModalContent').innerHTML = '<div class="modal-loading"><div class="modal-spinner"></div></div>';
                
                modalManager.open('statusCasesModal');
                
                try {
                    const token = localStorage.getItem('admin_token');
                    let url = '/api/cases?status=' + status;
                    if (status === 'archived') {
                        url = '/api/cases?archived=true';
                    }
                    
                    const response = await axios.get(url, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    
                    const cases = response.data || [];
                    renderStatusModalContent(cases, status, label);
                } catch (error) {
                    console.error('Status modal error:', error);
                    document.getElementById('statusModalContent').innerHTML = '<div class="text-center py-8 text-red-500"><i class="fas fa-exclamation-circle mr-2"></i>データの読み込みに失敗しました</div>';
                }
            }
            
            // ステータスモーダルのコンテンツを描画
            function renderStatusModalContent(cases, status, label) {
                if (cases.length === 0) {
                    document.getElementById('statusModalContent').innerHTML = \`
                        <div class="text-center py-12 text-gray-500">
                            <i class="fas fa-inbox text-4xl mb-4"></i>
                            <p>\${label}の案件はありません</p>
                        </div>
                    \`;
                    return;
                }
                
                const statusColors = {
                    inquiry: 'border-l-yellow-400',
                    preparing: 'border-l-orange-400',
                    applying: 'border-l-purple-400',
                    adopted: 'border-l-blue-400',
                    rejected: 'border-l-red-400',
                    archived: 'border-l-green-400'
                };
                
                const html = \`
                    <div class="space-y-3 max-h-96 overflow-y-auto">
                        \${cases.map(c => \`
                            <div onclick="goToCaseDetail(\${c.id})" 
                                 class="p-4 bg-white border-l-4 \${statusColors[status] || 'border-l-gray-400'} rounded-lg shadow-sm hover:shadow-md cursor-pointer transition">
                                <div class="flex items-start justify-between">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="font-mono text-xs text-gray-500">\${c.case_number || '#' + c.id}</span>
                                            \${c.result === 'approved' ? '<span class="px-2 py-0.5 rounded text-xs bg-blue-500 text-white">採択</span>' : ''}
                                            \${c.result === 'rejected' ? '<span class="px-2 py-0.5 rounded text-xs bg-red-500 text-white">不採択</span>' : ''}
                                        </div>
                                        <div class="font-bold text-gray-900">\${c.client_name || '名称未設定'}</div>
                                        \${c.company_name ? '<div class="text-sm text-gray-500">' + c.company_name + '</div>' : ''}
                                        <div class="flex flex-wrap gap-2 mt-2">
                                            \${c.subsidy_type_name ? '<span class="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800">' + c.subsidy_type_name + '</span>' : ''}
                                            \${c.assigned_to_name ? '<span class="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"><i class="fas fa-user mr-1"></i>' + c.assigned_to_name + '</span>' : ''}
                                        </div>
                                        \${c.approved_amount ? '<div class="mt-2 text-sm text-blue-600"><i class="fas fa-coins mr-1"></i>採択額: ¥' + Number(c.approved_amount).toLocaleString() + '</div>' : ''}
                                    </div>
                                    <i class="fas fa-chevron-right text-gray-300"></i>
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                    <div class="mt-4 pt-4 border-t text-center text-sm text-gray-500">
                        \${cases.length}件の案件
                    </div>
                \`;
                
                document.getElementById('statusModalContent').innerHTML = html;
            }
            
            // 案件詳細ページへ移動
            function goToCaseDetail(caseId) {
                modalManager.close('statusCasesModal');
                window.location.href = '/case/' + caseId;
            }
            
            // サイドバートグル
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                sidebar.classList.toggle('-translate-x-full');
                overlay.classList.toggle('hidden');
            }
            
            // 手付金フィールドのトグル
            function toggleDepositFields() {
                const checkbox = document.getElementById('depositRequired');
                const fields = document.getElementById('depositFields');
                if (checkbox.checked) {
                    fields.classList.remove('hidden');
                } else {
                    fields.classList.add('hidden');
                }
            }
            
            // 成果報酬フィールドのトグル
            function toggleSuccessFeeFields() {
                const checkbox = document.getElementById('successFeeEnabled');
                const fields = document.getElementById('successFeeFields');
                if (checkbox.checked) {
                    fields.classList.remove('hidden');
                } else {
                    fields.classList.add('hidden');
                }
            }
            
            // 成果報酬タイプの切り替え（%/固定金額）
            function toggleSuccessFeeType() {
                const type = document.getElementById('successFeeType').value;
                const percentageField = document.getElementById('successFeePercentageField');
                const amountField = document.getElementById('successFeeAmountField');
                
                if (type === 'percentage') {
                    percentageField.classList.remove('hidden');
                    amountField.classList.add('hidden');
                    document.getElementById('successFeeAmount').value = '';
                } else {
                    percentageField.classList.add('hidden');
                    amountField.classList.remove('hidden');
                    document.getElementById('successFeePercentage').value = '';
                }
            }
            
            // 顧客タイプの切り替え（既存/新規）
            function toggleCustomerType() {
                const type = document.querySelector('input[name="customer_type"]:checked').value;
                const existingSection = document.getElementById('existingCustomerSection');
                const newSection = document.getElementById('newCustomerSection');
                
                if (type === 'existing') {
                    existingSection.classList.remove('hidden');
                    newSection.classList.add('hidden');
                } else {
                    existingSection.classList.add('hidden');
                    newSection.classList.remove('hidden');
                }
            }
            
            // 新規案件登録モーダル
            function openNewCaseModal() {
                document.getElementById('newCaseModal').classList.remove('hidden');
                loadExistingClients();
                loadSubsidyTypes();
                loadAdminUsers();
                loadPipelineTemplates();
            }
            
            function closeNewCaseModal() {
                document.getElementById('newCaseModal').classList.add('hidden');
                document.getElementById('newCaseForm').reset();
                document.getElementById('existingCustomerSection').classList.remove('hidden');
                document.getElementById('newCustomerSection').classList.add('hidden');
                document.getElementById('depositFields').classList.add('hidden');
                document.getElementById('successFeeFields').classList.add('hidden');
                document.getElementById('pipelineDescription').classList.add('hidden');
            }
            
            // パイプラインテンプレート一覧を読み込み
            let pipelineTemplates = [];
            let pipelineSelectInitialized = false;
            
            async function loadPipelineTemplates(subsidyTypeId = null, subsidyTypeName = null) {
                try {
                    // 申請種別IDが指定されている場合はフィルタリング
                    let url = '/api/pipeline-templates';
                    if (subsidyTypeId) {
                        url += '?subsidy_type_id=' + subsidyTypeId;
                    }
                    
                    const response = await axios.get(url);
                    pipelineTemplates = response.data;
                    const select = document.getElementById('pipelineTemplateSelect');
                    const descDiv = document.getElementById('pipelineDescription');
                    select.innerHTML = '<option value="">パイプラインなし</option>';
                    
                    // パイプラインがない場合のメッセージ
                    if (pipelineTemplates.length === 0) {
                        if (subsidyTypeId) {
                            const optInfo = document.createElement('option');
                            optInfo.disabled = true;
                            optInfo.textContent = '※ この申請種別用のパイプラインは未設定です';
                            select.appendChild(optInfo);
                        }
                        return;
                    }
                    
                    const categoryGroups = {
                        'subsidy': [],
                        'grant': [],
                        'license': [],
                        '行政書士管轄': [],
                        '社労士管轄': [],
                        '許認可': []
                    };
                    
                    // カテゴリ名のマッピング
                    const categoryLabels = {
                        'subsidy': '補助金（行政書士管轄）',
                        'grant': '助成金（社労士管轄）',
                        'license': '許認可申請',
                        '行政書士管轄': '補助金（行政書士管轄）',
                        '社労士管轄': '助成金（社労士管轄）',
                        '許認可': '許認可申請'
                    };
                    
                    pipelineTemplates.forEach(t => {
                        const cat = t.category || 'license';
                        if (!categoryGroups[cat]) categoryGroups[cat] = [];
                        categoryGroups[cat].push(t);
                    });
                    
                    Object.entries(categoryGroups).forEach(([category, templates]) => {
                        if (templates.length > 0) {
                            const optGroup = document.createElement('optgroup');
                            optGroup.label = categoryLabels[category] || category;
                            templates.forEach(t => {
                                const option = document.createElement('option');
                                option.value = t.id;
                                option.textContent = t.name + (t.task_count ? ' (' + t.task_count + 'タスク)' : '');
                                optGroup.appendChild(option);
                            });
                            select.appendChild(optGroup);
                        }
                    });
                    
                    // 申請種別が指定されている場合、パイプラインを自動選択
                    if (subsidyTypeId && pipelineTemplates.length > 0) {
                        let selectedPipeline = pipelineTemplates[0]; // デフォルトは最初のもの
                        
                        // 申請種別名が指定されている場合、名前が一致するパイプラインを優先
                        if (subsidyTypeName) {
                            // 完全一致を探す
                            const exactMatch = pipelineTemplates.find(t => 
                                t.name === subsidyTypeName || 
                                t.name === subsidyTypeName + ' パイプライン' ||
                                t.name === subsidyTypeName + 'パイプライン'
                            );
                            
                            if (exactMatch) {
                                selectedPipeline = exactMatch;
                            } else {
                                // 部分一致を探す（申請種別名がパイプライン名に含まれる）
                                const partialMatch = pipelineTemplates.find(t => 
                                    t.name.includes(subsidyTypeName) || subsidyTypeName.includes(t.name.replace(/パイプライン|標準|汎用/g, '').trim())
                                );
                                if (partialMatch) {
                                    selectedPipeline = partialMatch;
                                }
                            }
                        }
                        
                        // 選択を適用
                        select.value = selectedPipeline.id;
                        
                        // 説明も表示
                        if (selectedPipeline.description) {
                            descDiv.textContent = selectedPipeline.description;
                            descDiv.classList.remove('hidden');
                        }
                        
                        // 選択されたことを視覚的に強調
                        select.classList.add('ring-2', 'ring-blue-300');
                        setTimeout(() => {
                            select.classList.remove('ring-2', 'ring-blue-300');
                        }, 1500);
                    }
                    
                    // 選択変更時に説明を表示（初回のみイベント登録）
                    if (!pipelineSelectInitialized) {
                        select.addEventListener('change', function() {
                            const templateId = this.value;
                            if (templateId) {
                                const template = pipelineTemplates.find(t => t.id == templateId);
                                if (template && template.description) {
                                    descDiv.textContent = template.description;
                                    descDiv.classList.remove('hidden');
                                } else {
                                    descDiv.classList.add('hidden');
                                }
                            } else {
                                descDiv.classList.add('hidden');
                            }
                        });
                        pipelineSelectInitialized = true;
                    }
                } catch (error) {
                    console.error('Error loading pipeline templates:', error);
                }
            }
            
            // 既存顧客リストを読み込み
            // 顧客名＋所在地で表示（同名会社の識別用）
            function formatClientName(client) {
                let name = client.name;
                // 所在地があれば追加（簡略表示）
                if (client.address) {
                    // 所在地が長い場合は都道府県部分のみ表示
                    const shortAddress = client.address.length > 10 
                        ? client.address.substring(0, 10) + '...'
                        : client.address;
                    name += \` (\${shortAddress})\`;
                }
                return name;
            }
            
            async function loadExistingClients() {
                try {
                    const response = await axios.get('/api/clients');
                    const select = document.getElementById('existingClientSelect');
                    select.innerHTML = '<option value="">顧客を選択してください</option>';
                    
                    // 案件なし（リセット済み）の顧客を優先表示
                    const noCase = response.data.filter(c => !c.subsidy_type_id);
                    const hasCase = response.data.filter(c => c.subsidy_type_id);
                    
                    if (noCase.length > 0) {
                        const optGroup1 = document.createElement('optgroup');
                        optGroup1.label = '📋 新規案件を登録可能';
                        noCase.forEach(client => {
                            const option = document.createElement('option');
                            option.value = client.id;
                            option.textContent = formatClientName(client);
                            optGroup1.appendChild(option);
                        });
                        select.appendChild(optGroup1);
                    }
                    
                    if (hasCase.length > 0) {
                        const optGroup2 = document.createElement('optgroup');
                        optGroup2.label = '📁 案件進行中（情報更新）';
                        hasCase.forEach(client => {
                            const option = document.createElement('option');
                            option.value = client.id;
                            const statusLabel = {
                                inquiry: '見込み',
                                preparing: '書類準備',
                                applying: '申請中',
                                completed: '完了'
                            }[client.status] || client.status;
                            option.textContent = \`\${formatClientName(client)} - \${statusLabel}\`;
                            optGroup2.appendChild(option);
                        });
                        select.appendChild(optGroup2);
                    }
                } catch (error) {
                    console.error('Error loading clients:', error);
                }
            }
            
            // 互換性のため古い関数名も維持
            function openNewClientModal() { openNewCaseModal(); }
            function closeNewClientModal() { closeNewCaseModal(); }
            
            // ステータスでフィルター
            function filterByStatus(status) {
                const filterEl = document.getElementById('filterStatus');
                if (filterEl) filterEl.value = status;
                filterClients();
            }
            
            // 認証チェック
            function checkAuth() {
                const token = localStorage.getItem('admin_token');
                const adminName = localStorage.getItem('admin_name');
                
                if (!token) {
                    window.location.href = '/login';
                    return false;
                }
                
                if (adminName) {
                    const adminNameEl = document.getElementById('adminName');
                    if (adminNameEl) {
                        adminNameEl.innerHTML = \`
                            <i class="fas fa-user-shield mr-1"></i>
                            \${adminName}
                        \`;
                    }
                    const sidebarName = document.getElementById('sidebarAdminName');
                    if (sidebarName) sidebarName.textContent = adminName;
                }
                
                return true;
            }
            
            async function logout() {
                const confirmed = await confirmDialog({
                    title: 'ログアウト',
                    message: 'ログアウトしてもよろしいですか？',
                    confirmText: 'ログアウト',
                    cancelText: 'キャンセル',
                    confirmClass: 'bg-blue-600 text-white hover:bg-blue-700',
                    icon: 'fas fa-sign-out-alt text-blue-600'
                });
                
                if (confirmed) {
                    localStorage.removeItem('admin_token');
                    localStorage.removeItem('admin_name');
                    window.location.href = '/login';
                }
            }
            
            // 認証確認
            if (!checkAuth()) {
                // リダイレクト処理は checkAuth 内で実行
            }
            
            // adminロールのみ従業員管理・バックアップ・支払い・設定・プランリンク表示
            const adminRole = localStorage.getItem('admin_role');
            if (adminRole === 'admin') {
                const employeeLink = document.getElementById('sidebarEmployeeLink');
                const backupLink = document.getElementById('sidebarBackupLink');
                const paymentsLink = document.getElementById('sidebarPaymentsLink');
                const settingsLink = document.getElementById('sidebarSettingsLink');
                const subscriptionLink = document.getElementById('sidebarSubscriptionLink');
                if (employeeLink) {
                    employeeLink.classList.remove('hidden');
                }
                if (backupLink) {
                    backupLink.classList.remove('hidden');
                }
                if (paymentsLink) {
                    paymentsLink.classList.remove('hidden');
                    // 支払い待ち件数を取得
                    loadPendingPaymentsCount();
                }
                if (settingsLink) {
                    settingsLink.classList.remove('hidden');
                }
                if (subscriptionLink) {
                    subscriptionLink.classList.remove('hidden');
                }
            }
            
            // 支払い待ち件数を取得
            async function loadPendingPaymentsCount() {
                try {
                    const response = await axios.get('/api/payments/pending');
                    const count = response.data.length;
                    const badge = document.getElementById('pendingPaymentsBadge');
                    if (badge) {
                        if (count > 0) {
                            badge.textContent = count;
                            badge.classList.remove('hidden');
                        } else {
                            badge.classList.add('hidden');
                        }
                    }
                } catch (error) {
                    console.error('Error loading pending payments count:', error);
                }
            }
            
            // 新規案件登録フォームのサブミットハンドラ
            const newCaseFormEl = document.getElementById('newCaseForm');
            if (newCaseFormEl) {
                newCaseFormEl.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const customerType = formData.get('customer_type');
                    
                    try {
                        let clientId;
                        let caseId;
                        
                        // 案件データ
                        // formDataからの取得とselect要素から直接取得の両方を試す
                        const subsidySelect = document.getElementById('newClientSubsidyType');
                        const subsidyTypeIdFromForm = formData.get('subsidy_type_id');
                        const subsidyTypeIdFromSelect = subsidySelect ? subsidySelect.value : null;
                        const subsidyTypeId = subsidyTypeIdFromSelect || subsidyTypeIdFromForm;
                        console.log('subsidy_type_id - fromForm:', subsidyTypeIdFromForm, 'fromSelect:', subsidyTypeIdFromSelect, 'final:', subsidyTypeId);
                        
                        if (!subsidyTypeId) {
                            alert('補助金・助成金を選択してください');
                            return;
                        }
                        
                        const pipelineTemplateId = formData.get('pipeline_template_id');
                        const caseData = {
                            subsidy_type_id: parseInt(subsidyTypeId),
                            assigned_to: formData.get('assigned_to') || null,
                            notes: formData.get('notes') || null,
                            deposit_required: document.getElementById('depositRequired')?.checked ? 1 : 0,
                            deposit_amount: parseInt(formData.get('deposit_amount')) || 0,
                            withholding_tax: document.getElementById('withholdingTax')?.checked ? 1 : 0,
                            success_fee_enabled: document.getElementById('successFeeEnabled')?.checked ? 1 : 0,
                            success_fee_rate: parseFloat(formData.get('success_fee_percentage')) || 0,
                            success_fee_amount: parseInt(formData.get('success_fee_amount')) || 0,
                            contract_url: formData.get('contract_url') || null,
                            pipeline_template_id: pipelineTemplateId ? parseInt(pipelineTemplateId) : null
                        };
                        console.log('caseData:', caseData);
                        
                        if (customerType === 'existing') {
                            // 既存顧客を選択した場合 → 新しい案件を作成
                            clientId = formData.get('existing_client_id');
                            if (!clientId) {
                                alert('顧客を選択してください');
                                return;
                            }
                            
                            // 新しい案件を作成
                            const caseResponse = await axios.post('/api/cases', {
                                client_id: clientId,
                                ...caseData
                            });
                            caseId = caseResponse.data.id;
                            
                            alert(\`案件を登録しました（案件番号: \${caseResponse.data.case_number}）\\nポータルURL: /portal/\${caseResponse.data.access_token}\`);
                        } else {
                            // 新規顧客として登録
                            const name = formData.get('name');
                            if (!name) {
                                alert('顧客名を入力してください');
                                return;
                            }
                            
                            // まず顧客を作成
                            const newClientData = {
                                name: name,
                                company_name: formData.get('company_name') || null,
                                email: formData.get('email') || null,
                                phone: formData.get('phone') || null,
                                address: formData.get('address') || null
                            };
                            
                            const clientResponse = await axios.post('/api/clients', newClientData);
                            clientId = clientResponse.data.id;
                            
                            // 次に案件を作成
                            const caseResponse = await axios.post('/api/cases', {
                                client_id: clientId,
                                ...caseData
                            });
                            caseId = caseResponse.data.id;
                            
                            alert(\`顧客と案件を登録しました（案件番号: \${caseResponse.data.case_number}）\\nポータルURL: /portal/\${caseResponse.data.access_token}\`);
                        }
                        
                        closeNewCaseModal();
                        loadData();
                    } catch (error) {
                        alert('登録に失敗しました: ' + (error.response?.data?.error || error.message));
                        console.error('Error creating case:', error);
                    }
                });
            }
        
            const STATUS_LABELS = {
                inquiry: '見込み',
                preparing: '書類準備中',
                applying: '申請中',
                adopted: '採択・入金待ち',
                rejected: '不採択',
                completed: '完了',
                cancelled: 'キャンセル'
            };

            const STATUS_COLORS = {
                inquiry: 'bg-yellow-100 text-yellow-800',
                preparing: 'bg-orange-100 text-orange-800',
                applying: 'bg-purple-100 text-purple-800',
                adopted: 'bg-blue-100 text-blue-800',
                rejected: 'bg-red-100 text-red-800',
                completed: 'bg-green-100 text-green-800',
                cancelled: 'bg-gray-100 text-gray-800'
            };

            let allClients = [];
            let subsidyTypes = [];
            let allUsers = [];

            // Axios設定：認証ヘッダーを自動付与
            axios.defaults.headers.common['Authorization'] = \`Bearer \${localStorage.getItem('admin_username')}:\${localStorage.getItem('admin_role')}\`;

            // データ読み込み（案件ベース）
            let allCases = [];
            async function loadData() {
                try {
                    // 案件ベースのデータを取得
                    const response = await axios.get('/api/cases');
                    allCases = response.data;
                    
                    // 後方互換性のためallClientsも更新（案件を顧客形式に変換）
                    allClients = allCases.map(c => ({
                        ...c,
                        id: c.client_id,
                        case_id: c.id,
                        name: c.client_name,
                        company_name: c.company_name
                    }));
                    
                    updateStatusCards();
                    updateStatistics();
                    renderCases(allCases);
                    renderDeadlineAlerts(allCases);
                    renderTasksByAssignee(allCases);
                    renderWeeklyTodos(allCases);
                    loadRecentActivity();
                    loadSlotBalance();
                    loadNotificationSummary();
                } catch (error) {
                    console.error('Error loading data:', error);
                    document.getElementById('clientsList').innerHTML = 
                        '<div class="text-center py-8 text-red-500">データの読み込みに失敗しました</div>';
                }
            }
            
            // 通知サマリーを読み込む
            async function loadNotificationSummary() {
                try {
                    const response = await axios.get('/api/admin/notifications/summary');
                    const summary = response.data;
                    
                    document.getElementById('notify-message').textContent = summary.new_message || 0;
                    document.getElementById('notify-document').textContent = summary.document_upload || 0;
                    document.getElementById('notify-payment').textContent = summary.payment_report || 0;
                    
                    // 未対応があればサマリーセクションを表示
                    const total = (summary.new_message || 0) + (summary.document_upload || 0) + (summary.payment_report || 0);
                    const summarySection = document.getElementById('notificationSummary');
                    if (total > 0) {
                        summarySection.classList.remove('hidden');
                    } else {
                        summarySection.classList.add('hidden');
                    }
                } catch (error) {
                    console.error('Error loading notification summary:', error);
                }
            }
            
            // 通知タイプでフィルター表示（グローバル関数として公開）
            window.filterNotifications = function(type) {
                if (typeof window.showNotificationsWithFilter === 'function') {
                    window.showNotificationsWithFilter(type);
                } else {
                    // フォールバック：直接モーダルを開く
                    const modal = document.getElementById('notificationsModal');
                    if (modal) {
                        modal.classList.remove('hidden');
                        window.loadNotificationsWithType(type);
                    }
                }
            };
            
            // 通知を読み込んで表示（ダッシュボード用・グローバル）
            window.loadNotificationsWithType = async function(filterType) {
                // 現在のフィルターを保持
                window.currentNotificationFilter = filterType;
                
                try {
                    const response = await axios.get('/api/admin/notifications?unread_only=true');
                    let notifications = response.data;
                    
                    if (filterType) {
                        notifications = notifications.filter(n => n.notification_type === filterType);
                    }
                    
                    const container = document.getElementById('notificationsList');
                    if (!container) return;
                    
                    const filterHtml = \`
                        <div class="flex flex-wrap gap-2 mb-4 pb-3 border-b">
                            <button onclick="window.loadNotificationsWithType()" class="px-3 py-1 text-xs rounded-full \${!filterType ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">すべて</button>
                            <button onclick="window.loadNotificationsWithType('new_message')" class="px-3 py-1 text-xs rounded-full \${filterType === 'new_message' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                                <i class="fas fa-envelope mr-1"></i>メッセージ
                            </button>
                            <button onclick="window.loadNotificationsWithType('document_upload')" class="px-3 py-1 text-xs rounded-full \${filterType === 'document_upload' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                                <i class="fas fa-file-upload mr-1"></i>書類
                            </button>
                            <button onclick="window.loadNotificationsWithType('payment_report')" class="px-3 py-1 text-xs rounded-full \${filterType === 'payment_report' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                                <i class="fas fa-yen-sign mr-1"></i>入金
                            </button>
                        </div>
                    \`;
                    
                    if (notifications.length === 0) {
                        container.innerHTML = filterHtml + '<div class="text-center py-4 text-gray-500">未読の通知はありません</div>';
                        return;
                    }
                    
                    const getTypeIcon = (type) => {
                        switch(type) {
                            case 'new_message': return '<i class="fas fa-envelope text-blue-500"></i>';
                            case 'document_upload': return '<i class="fas fa-file-upload text-green-500"></i>';
                            case 'payment_report': return '<i class="fas fa-yen-sign text-yellow-500"></i>';
                            default: return '<i class="fas fa-bell text-gray-500"></i>';
                        }
                    };
                    
                    const getTypeColor = (type) => {
                        switch(type) {
                            case 'new_message': return 'border-blue-200 bg-blue-50';
                            case 'document_upload': return 'border-green-200 bg-green-50';
                            case 'payment_report': return 'border-yellow-200 bg-yellow-50';
                            default: return 'border-gray-200 bg-gray-50';
                        }
                    };
                    
                    const getNotificationUrl = (n) => {
                        // related_tableに基づいてURLを決定
                        switch(n.related_table) {
                            case 'invoices':
                                // 請求書関連（振込報告）は支払い確認ページへ
                                return '/admin/payments';
                            case 'cases':
                                return '/case/' + n.related_id;
                            case 'clients':
                                return '/client/' + n.related_id;
                            case 'documents':
                                return '/documents?id=' + n.related_id;
                            default:
                                // デフォルトは案件一覧
                                return '/cases';
                        }
                    };
                    
                    container.innerHTML = filterHtml + notifications.map(n => \`
                        <div class="border rounded-lg p-3 \${getTypeColor(n.notification_type)}">
                            <div class="flex justify-between items-start">
                                <div class="flex items-center gap-2">
                                    \${getTypeIcon(n.notification_type)}
                                    <h4 class="font-medium text-sm">\${n.title}</h4>
                                </div>
                                <div class="flex items-center gap-2">
                                    \${n.related_id ? \`<a href="\${getNotificationUrl(n)}" onclick="window.markNotificationRead(\${n.id})" class="text-xs text-blue-600 hover:underline">詳細</a>\` : ''}
                                    <button onclick="window.markNotificationRead(\${n.id})" class="text-xs text-gray-500 hover:text-gray-700">既読</button>
                                </div>
                            </div>
                            <p class="text-xs text-gray-600 mt-1 whitespace-pre-wrap">\${n.message}</p>
                            <div class="text-xs text-gray-400 mt-2">\${new Date(n.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Error loading notifications:', error);
                }
            }
            
            // 通知を既読にする（グローバル関数）
            window.markNotificationRead = async function(notificationId, skipReload = false) {
                try {
                    await axios.put(\`/api/admin/notifications/\${notificationId}/read\`, {
                        read_by: localStorage.getItem('admin_name') || 'admin'
                    });
                    // サマリーを更新
                    loadNotificationSummary();
                    // 通知リストも更新（モーダルが開いている場合）
                    if (!skipReload && document.getElementById('notificationsModal') && !document.getElementById('notificationsModal').classList.contains('hidden')) {
                        window.loadNotificationsWithType(window.currentNotificationFilter);
                    }
                } catch (error) {
                    console.error('Error marking notification as read:', error);
                }
            };
            
            // 現在のフィルター状態を保持
            window.currentNotificationFilter = null;
            
            // 通知モーダルを開く
            function openNotificationsModal(filterType = null) {
                document.getElementById('notificationsModal').classList.remove('hidden');
                window.loadNotificationsWithType(filterType);
            }
            
            // 通知モーダルを閉じる
            function closeNotificationsModal() {
                document.getElementById('notificationsModal').classList.add('hidden');
                // サマリーを更新
                loadNotificationSummary();
            }
            
            // すべての通知を既読にする
            async function markAllNotificationsRead() {
                try {
                    const filterType = window.currentNotificationFilter;
                    await axios.put('/api/admin/notifications/read-all', {
                        notification_type: filterType,
                        read_by: localStorage.getItem('admin_name') || 'admin'
                    });
                    // リストとサマリーを更新
                    window.loadNotificationsWithType(filterType);
                    loadNotificationSummary();
                    showToast(filterType ? '表示中の通知をすべて既読にしました' : 'すべての通知を既読にしました');
                } catch (error) {
                    console.error('Error marking all as read:', error);
                }
            }
            
            // 枠残数を読み込む
            async function loadSlotBalance() {
                try {
                    const response = await axios.get('/api/subscription/status');
                    const data = response.data;
                    const badge = document.getElementById('slotsBadge');
                    if (badge) {
                        if (data.is_unlimited) {
                            // 無制限プラン
                            badge.innerHTML = '<i class="fas fa-infinity text-xs"></i>';
                            badge.className = 'ml-auto bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full';
                        } else {
                            badge.textContent = data.total_available || 0;
                            badge.className = data.total_available > 0 
                                ? 'ml-auto bg-green-500 text-white text-xs px-2 py-0.5 rounded-full'
                                : 'ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full';
                        }
                    }
                } catch (error) {
                    console.error('Error loading slot balance:', error);
                }
            }
            
            // 最近の活動を読み込む
            async function loadRecentActivity() {
                try {
                    const response = await axios.get('/api/recent-activity');
                    const activities = response.data;
                    
                    const container = document.getElementById('recentActivity');
                    
                    if (!activities || activities.length === 0) {
                        container.innerHTML = '<div class="text-gray-500 text-center py-4">最近の活動はありません</div>';
                        return;
                    }
                    
                    const activityIcons = {
                        'new_client': { icon: 'fa-user-plus', color: 'text-green-500', bg: 'bg-green-100' },
                        'document_upload': { icon: 'fa-upload', color: 'text-blue-500', bg: 'bg-blue-100' },
                        'status_change': { icon: 'fa-exchange-alt', color: 'text-purple-500', bg: 'bg-purple-100' },
                        'communication': { icon: 'fa-comment', color: 'text-yellow-500', bg: 'bg-yellow-100' },
                        'document_approved': { icon: 'fa-check-circle', color: 'text-green-500', bg: 'bg-green-100' },
                        'document_rejected': { icon: 'fa-times-circle', color: 'text-red-500', bg: 'bg-red-100' }
                    };
                    
                    container.innerHTML = activities.slice(0, 5).map(activity => {
                        const actStyle = activityIcons[activity.type] || { icon: 'fa-circle', color: 'text-gray-500', bg: 'bg-gray-100' };
                        const timeAgo = formatTimeAgo(activity.created_at);
                        
                        return \`
                            <div class="flex items-center gap-2 py-1 hover:bg-gray-50 rounded transition">
                                <div class="w-5 h-5 rounded-full \${actStyle.bg} flex items-center justify-center flex-shrink-0">
                                    <i class="fas \${actStyle.icon} \${actStyle.color}" style="font-size: 9px;"></i>
                                </div>
                                <div class="flex-1 min-w-0 truncate text-xs text-gray-600">\${activity.description}</div>
                                <span class="text-xs text-gray-400 flex-shrink-0">\${timeAgo}</span>
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading recent activity:', error);
                    document.getElementById('recentActivity').innerHTML = 
                        '<div class="text-gray-500 text-center py-4">読み込みエラー</div>';
                }
            }
            
            // 時間の相対表示
            function formatTimeAgo(dateStr) {
                // D1のDATETIMEはUTCで保存されているが、タイムゾーン情報がないので明示的にUTCとして解釈
                let date;
                if (dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
                    // タイムゾーン情報がない場合、UTCとして解釈
                    date = new Date(dateStr.replace(' ', 'T') + 'Z');
                } else {
                    date = new Date(dateStr);
                }
                
                const now = new Date();
                const diffMs = now - date;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMins / 60);
                const diffDays = Math.floor(diffHours / 24);
                
                if (diffMins < 1) return 'たった今';
                if (diffMins < 60) return diffMins + '分前';
                if (diffHours < 24) return diffHours + '時間前';
                if (diffDays < 7) return diffDays + '日前';
                return date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
            }
            
            // 申請期限アラート表示
            function renderDeadlineAlerts(clients) {
                const section = document.getElementById('deadlineAlertSection');
                const container = document.getElementById('deadlineAlertList');
                
                // 期限が14日以内の案件を抽出（完了・却下以外）
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const urgentClients = clients.filter(client => {
                    if (!client.application_end_date) return false;
                    if (client.status === 'completed' || client.status === 'rejected') return false;
                    
                    const deadline = new Date(client.application_end_date);
                    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 && diffDays <= 14;
                }).sort((a, b) => {
                    return new Date(a.application_end_date).getTime() - new Date(b.application_end_date).getTime();
                });
                
                if (urgentClients.length === 0) {
                    section.classList.add('hidden');
                    return;
                }
                
                section.classList.remove('hidden');
                
                container.innerHTML = urgentClients.map(client => {
                    const subsidyType = subsidyTypes.find(s => s.id === client.subsidy_type_id);
                    const deadline = new Date(client.application_end_date);
                    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    let urgencyClass = '';
                    let urgencyText = '';
                    if (diffDays <= 3) {
                        urgencyClass = 'border-l-4 border-l-red-600 bg-red-50';
                        urgencyText = \`<span class="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold animate-pulse">あと\${diffDays}日!</span>\`;
                    } else if (diffDays <= 7) {
                        urgencyClass = 'border-l-4 border-l-orange-500 bg-orange-50';
                        urgencyText = \`<span class="bg-orange-500 text-white px-2 py-1 rounded text-xs font-bold">あと\${diffDays}日</span>\`;
                    } else {
                        urgencyClass = 'border-l-4 border-l-yellow-500 bg-yellow-50';
                        urgencyText = \`<span class="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold">あと\${diffDays}日</span>\`;
                    }
                    
                    return \`
                        <div class="p-3 rounded \${urgencyClass} flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                \${urgencyText}
                                <div>
                                    <div class="font-bold">\${client.name}</div>
                                    <div class="text-sm text-gray-600">
                                        \${subsidyType?.name || '補助金未設定'} | 期限: \${client.application_end_date}
                                    </div>
                                </div>
                            </div>
                            <a href="/client/\${client.id}" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                                詳細
                            </a>
                        </div>
                    \`;
                }).join('');
            }
            
            // 担当者別タスクを表示
            function renderTasksByAssignee(cases) {
                const container = document.getElementById('tasksByAssignee');
                if (!container) return;
                
                // 完了・却下以外の案件を担当者別にグループ化
                const activeCases = cases.filter(c => c.status !== 'completed' && c.status !== 'rejected');
                const byAssignee = {};
                
                activeCases.forEach(c => {
                    const assignee = c.assigned_to || '未割り当て';
                    if (!byAssignee[assignee]) {
                        byAssignee[assignee] = [];
                    }
                    byAssignee[assignee].push(c);
                });
                
                if (Object.keys(byAssignee).length === 0) {
                    container.innerHTML = '<div class="text-center py-4 text-gray-500">進行中の案件はありません</div>';
                    return;
                }
                
                // 担当者名を取得
                const getAssigneeName = (username) => {
                    if (username === '未割り当て') return '未割り当て';
                    const user = allUsers.find(u => u.username === username);
                    return user?.name || username;
                };
                
                container.innerHTML = Object.entries(byAssignee)
                    .sort((a, b) => b[1].length - a[1].length) // 件数が多い順
                    .map(([assignee, assigneeCases]) => {
                        const urgentCount = assigneeCases.filter(c => {
                            if (!c.application_end_date) return false;
                            const deadline = new Date(c.application_end_date);
                            const diffDays = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
                            return diffDays >= 0 && diffDays <= 7;
                        }).length;
                        
                        return \`
                            <div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer" onclick="location.href='/cases?assigned_to=\${encodeURIComponent(assignee)}'">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                        <i class="fas fa-user text-xs"></i>
                                    </div>
                                    <span class="font-medium">\${getAssigneeName(assignee)}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    \${urgentCount > 0 ? \`<span class="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">\${urgentCount}件緊急</span>\` : ''}
                                    <span class="bg-indigo-100 text-indigo-600 text-xs px-2 py-1 rounded-full font-bold">\${assigneeCases.length}件</span>
                                </div>
                            </div>
                        \`;
                    }).join('');
            }
            
            // 今週のToDoを表示
            function renderWeeklyTodos(cases) {
                const container = document.getElementById('weeklyTodos');
                if (!container) return;
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // 今週末（日曜日）を計算
                const endOfWeek = new Date(today);
                endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
                
                // 今週期限の案件を抽出
                const weeklyDeadlines = cases.filter(c => {
                    if (c.status === 'completed' || c.status === 'rejected') return false;
                    if (!c.application_end_date) return false;
                    
                    const deadline = new Date(c.application_end_date);
                    return deadline >= today && deadline <= endOfWeek;
                }).sort((a, b) => new Date(a.application_end_date) - new Date(b.application_end_date));
                
                // 未提出書類がある案件を抽出
                const pendingDocs = cases.filter(c => {
                    if (c.status === 'completed' || c.status === 'rejected') return false;
                    return c.document_progress && c.document_progress < 100;
                }).slice(0, 5);
                
                // ヒアリング未完了の案件を抽出
                const pendingHearing = cases.filter(c => {
                    if (c.status === 'completed' || c.status === 'rejected') return false;
                    return c.hearing_progress && c.hearing_progress < 100;
                }).slice(0, 3);
                
                let html = '';
                
                // 今週期限
                if (weeklyDeadlines.length > 0) {
                    html += \`
                        <div class="mb-3">
                            <div class="text-xs text-gray-500 mb-1 font-medium">📅 今週期限</div>
                            \${weeklyDeadlines.slice(0, 5).map(c => {
                                const deadline = new Date(c.application_end_date);
                                const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
                                const urgencyClass = diffDays <= 2 ? 'text-red-600 font-bold' : 'text-orange-600';
                                return \`
                                    <a href="/case/\${c.id}" class="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                                        <span class="truncate flex-1">\${c.client_name} - \${c.subsidy_name || '補助金'}</span>
                                        <span class="text-xs \${urgencyClass}">\${diffDays === 0 ? '今日!' : \`あと\${diffDays}日\`}</span>
                                    </a>
                                \`;
                            }).join('')}
                        </div>
                    \`;
                }
                
                // 書類待ち
                if (pendingDocs.length > 0) {
                    html += \`
                        <div class="mb-3">
                            <div class="text-xs text-gray-500 mb-1 font-medium">📄 書類待ち</div>
                            \${pendingDocs.map(c => \`
                                <a href="/case/\${c.id}" class="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                                    <span class="truncate flex-1">\${c.client_name}</span>
                                    <span class="text-xs text-blue-600">\${c.document_progress || 0}%完了</span>
                                </a>
                            \`).join('')}
                        </div>
                    \`;
                }
                
                // ヒアリング待ち
                if (pendingHearing.length > 0) {
                    html += \`
                        <div>
                            <div class="text-xs text-gray-500 mb-1 font-medium">🎤 ヒアリング待ち</div>
                            \${pendingHearing.map(c => \`
                                <a href="/case/\${c.id}" class="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                                    <span class="truncate flex-1">\${c.client_name}</span>
                                    <span class="text-xs text-purple-600">\${c.hearing_progress || 0}%完了</span>
                                </a>
                            \`).join('')}
                        </div>
                    \`;
                }
                
                if (!html) {
                    html = '<div class="text-center py-4 text-gray-500">今週のタスクはありません 🎉</div>';
                }
                
                container.innerHTML = html;
            }
            
            // 助成金種別読み込み
            async function loadSubsidyTypes() {
                try {
                    const response = await axios.get('/api/subsidy-types');
                    subsidyTypes = response.data;
                    
                    renderSubsidyOptions();
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
            }
            
            // 担当者リストを読み込み
            async function loadAdminUsers() {
                try {
                    const response = await axios.get('/api/admin/users');
                    allUsers = response.data;
                    
                    const select = document.getElementById('newClientAssignedTo');
                    if (select) {
                        select.innerHTML = '<option value="">担当者を選択</option>';
                        allUsers.forEach(user => {
                            const option = document.createElement('option');
                            option.value = user.username;
                            option.textContent = user.name || user.username;
                            select.appendChild(option);
                        });
                    }
                } catch (error) {
                    console.error('Error loading admin users:', error);
                }
            }
            
            // 現在選択中のカテゴリ
            let currentSubsidyCategory = 'all';
            let selectedSubsidyId = null;
            
            // カテゴリ色設定
            const SUBSIDY_CATEGORY_STYLES = {
                '行政書士管轄': { bg: 'bg-emerald-50', border: 'border-emerald-300', hover: 'hover:bg-emerald-100', selected: 'bg-emerald-500 text-white' },
                '社労士管轄': { bg: 'bg-blue-50', border: 'border-blue-300', hover: 'hover:bg-blue-100', selected: 'bg-blue-500 text-white' },
                '許認可': { bg: 'bg-indigo-50', border: 'border-indigo-300', hover: 'hover:bg-indigo-100', selected: 'bg-indigo-500 text-white' },
                'その他': { bg: 'bg-gray-50', border: 'border-gray-300', hover: 'hover:bg-gray-100', selected: 'bg-gray-500 text-white' },
                // DB英語カテゴリも対応
                'subsidy': { bg: 'bg-emerald-50', border: 'border-emerald-300', hover: 'hover:bg-emerald-100', selected: 'bg-emerald-500 text-white' },
                'grant': { bg: 'bg-blue-50', border: 'border-blue-300', hover: 'hover:bg-blue-100', selected: 'bg-blue-500 text-white' },
                'license': { bg: 'bg-indigo-50', border: 'border-indigo-300', hover: 'hover:bg-indigo-100', selected: 'bg-indigo-500 text-white' }
            };
            
            // DBカテゴリ（英語）とUIカテゴリ（日本語）のマッピング
            const CATEGORY_MAP = {
                'subsidy': '行政書士管轄',
                'grant': '社労士管轄',
                'license': '許認可',
                '行政書士管轄': '行政書士管轄',
                '社労士管轄': '社労士管轄',
                '許認可': '許認可',
                'その他': 'その他'
            };
            
            // UIカテゴリから対応するDBカテゴリを取得
            const UI_TO_DB_CATEGORY = {
                '行政書士管轄': ['subsidy', '行政書士管轄'],
                '社労士管轄': ['grant', '社労士管轄'],
                '許認可': ['license', '許認可']
            };
            
            // カテゴリ選択
            function selectSubsidyCategory(category) {
                currentSubsidyCategory = category;
                
                // タブのアクティブ状態を更新
                document.querySelectorAll('.category-tab').forEach(tab => {
                    const tabCat = tab.dataset.category;
                    if (tabCat === category) {
                        tab.classList.remove('bg-emerald-100', 'bg-blue-100', 'bg-indigo-100', 'bg-gray-100', 'text-emerald-700', 'text-blue-700', 'text-indigo-700', 'text-gray-700');
                        tab.classList.add('bg-gray-600', 'text-white');
                    } else {
                        tab.classList.remove('bg-gray-600', 'text-white');
                        if (tabCat === '行政書士管轄') tab.classList.add('bg-emerald-100', 'text-emerald-700');
                        else if (tabCat === '社労士管轄') tab.classList.add('bg-blue-100', 'text-blue-700');
                        else if (tabCat === '許認可') tab.classList.add('bg-indigo-100', 'text-indigo-700');
                        else tab.classList.add('bg-gray-100', 'text-gray-700');
                    }
                });
                
                renderSubsidyOptions();
            }
            
            // 補助金オプションをカテゴリ別にレンダリング
            function renderSubsidyOptions(filter = '') {
                const container = document.getElementById('subsidyOptionsList');
                if (!container) return;
                
                const searchInput = document.getElementById('subsidySearchInput');
                const searchFilter = filter || (searchInput ? searchInput.value : '');
                const filterLower = searchFilter.toLowerCase();
                
                // カテゴリでグループ化（日本語カテゴリに正規化）
                const grouped = {
                    '行政書士管轄': [],
                    '社労士管轄': [],
                    '許認可': []
                };
                
                subsidyTypes.forEach(type => {
                    // システムカテゴリは表示しない
                    if (type.category === 'システム') return;
                    
                    const rawCat = type.category || 'その他';
                    // DBカテゴリ（英語）を日本語に変換
                    const cat = CATEGORY_MAP[rawCat] || rawCat;
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(type);
                });
                
                let html = '';
                let categoriesToShow;
                if (currentSubsidyCategory === 'all') {
                    categoriesToShow = ['行政書士管轄', '社労士管轄', '許認可'];
                } else {
                    // 選択されたUIカテゴリに対応するものを表示
                    categoriesToShow = [currentSubsidyCategory];
                }
                
                categoriesToShow.forEach(category => {
                    if (!grouped[category]) return;
                    
                    const types = grouped[category];
                    const filteredTypes = types.filter(t => 
                        !searchFilter || 
                        t.name.toLowerCase().includes(filterLower) || 
                        (t.description && t.description.toLowerCase().includes(filterLower))
                    );
                    
                    if (filteredTypes.length === 0) return;
                    
                    const style = SUBSIDY_CATEGORY_STYLES[category] || SUBSIDY_CATEGORY_STYLES['その他'];
                    
                    // カテゴリヘッダー（「すべて」表示時のみ）
                    if (currentSubsidyCategory === 'all') {
                        html += \`<div class="px-3 py-1 text-xs font-bold text-gray-500 bg-gray-100 sticky top-0">\${category}（\${filteredTypes.length}件）</div>\`;
                    }
                    
                    filteredTypes.forEach(type => {
                        const isSelected = selectedSubsidyId === type.id;
                        html += \`
                            <div class="subsidy-option px-3 py-2 cursor-pointer border-b border-gray-100 \${isSelected ? style.selected : style.hover}"
                                 data-id="\${type.id}" data-name="\${type.name}" data-category="\${category}"
                                 onclick="selectSubsidy(\${type.id}, '\${type.name.replace(/'/g, "\\\\'")}', '\${category}')">
                                <div class="font-medium text-sm \${isSelected ? '' : 'text-gray-800'}">\${type.name}</div>
                                \${type.description ? \`<div class="text-xs \${isSelected ? 'text-white/80' : 'text-gray-500'} truncate">\${type.description}</div>\` : ''}
                            </div>
                        \`;
                    });
                });
                
                if (!html) {
                    html = '<div class="px-3 py-4 text-center text-gray-400 text-sm">該当する項目がありません</div>';
                }
                
                container.innerHTML = html;
            }
            
            // 補助金を選択
            function selectSubsidy(id, name, category) {
                selectedSubsidyId = id;
                
                // hidden inputに値をセット
                const hiddenInput = document.getElementById('newClientSubsidyType');
                if (hiddenInput) hiddenInput.value = id;
                
                // 選択表示を更新
                const display = document.getElementById('selectedSubsidyName');
                if (display) {
                    display.classList.remove('hidden');
                    display.querySelector('span').textContent = name + '（' + category + '）';
                }
                
                // リストの選択状態を更新
                renderSubsidyOptions();
                
                // 申請種別に紐づくパイプラインのみを読み込み（名前も渡して優先選択に使用）
                loadPipelineTemplates(id, name);
            }
            
            // 補助金検索フィルター
            function filterSubsidyOptions() {
                renderSubsidyOptions();
            }
            
            // 従業員一覧読み込み
            async function loadUsers() {
                try {
                    const response = await axios.get('/api/admin/users');
                    allUsers = response.data;
                    
                    // 新規登録・編集フォームのセレクトボックスに追加
                    const select = document.getElementById('newClientAssignedTo');
                    const editSelect = document.getElementById('editClientAssignedTo');
                    const options = '<option value="">未割り当て</option>' +
                        allUsers.map(user => \`<option value="\${user.username}">\${user.name}</option>\`).join('');
                    if (select) select.innerHTML = options;
                    if (editSelect) editSelect.innerHTML = options;
                } catch (error) {
                    console.error('Error loading users:', error);
                }
            }
            
            // 統計情報更新（案件ベース）
            function updateStatistics() {
                const now = new Date();
                const thisMonth = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}\`;
                
                // 総案件数
                const total = allCases.length;
                const statTotal = document.getElementById('stat-total');
                if (statTotal) statTotal.textContent = total;
                
                // 今月の新規案件
                const newThisMonth = allCases.filter(c => {
                    if (!c.created_at) return false;
                    const created = c.created_at.substring(0, 7);
                    return created === thisMonth;
                }).length;
                const statNewMonth = document.getElementById('stat-new-month');
                if (statNewMonth) statNewMonth.textContent = newThisMonth;
                
                // 今月の完了件数
                const completedThisMonth = allCases.filter(c => {
                    if (c.status !== 'completed') return false;
                    if (!c.updated_at) return false;
                    const updated = c.updated_at.substring(0, 7);
                    return updated === thisMonth;
                }).length;
                const statCompleted = document.getElementById('stat-completed-month');
                if (statCompleted) statCompleted.textContent = completedThisMonth;
            }

            // ステータスカード更新（案件ベース）
            function updateStatusCards() {
                const counts = {
                    inquiry: 0,
                    preparing: 0,
                    applying: 0,
                    adopted: 0,
                    rejected: 0,
                    completed: 0
                };
                
                allCases.forEach(caseItem => {
                    if (counts[caseItem.status] !== undefined) {
                        counts[caseItem.status]++;
                    }
                });

                Object.keys(counts).forEach(status => {
                    const el = document.getElementById(\`count-\${status}\`);
                    if (el) el.textContent = counts[status];
                });
                
                // 今月の実績をAPIから取得して表示
                loadMonthlyStats();
            }
            
            // 今月の実績を取得・表示
            async function loadMonthlyStats() {
                try {
                    const response = await axios.get('/api/dashboard/stats');
                    const data = response.data;
                    
                    // 現在の月を表示
                    const currentMonthEl = document.getElementById('currentMonth');
                    if (currentMonthEl && data.current_month) {
                        const [year, month] = data.current_month.split('-');
                        currentMonthEl.textContent = \`\${year}年\${parseInt(month)}月\`;
                    }
                    
                    // 完了済み件数（全期間）をステータスカードに反映
                    const completedEl = document.getElementById('count-completed');
                    if (completedEl && data.monthly_cases) {
                        completedEl.textContent = data.monthly_cases.total_archived || 0;
                    }
                    
                    // 今月の完了件数
                    const monthlyCompletedEl = document.getElementById('monthly-completed');
                    if (monthlyCompletedEl && data.monthly_cases) {
                        monthlyCompletedEl.textContent = data.monthly_cases.completed || 0;
                    }
                    
                    // 今月の採択件数
                    const monthlyApprovedEl = document.getElementById('monthly-approved');
                    if (monthlyApprovedEl && data.monthly_cases) {
                        monthlyApprovedEl.textContent = data.monthly_cases.approved || 0;
                    }
                    
                    // 今月の採択総額
                    const monthlyAmountEl = document.getElementById('monthly-amount');
                    if (monthlyAmountEl && data.monthly_cases) {
                        const amount = data.monthly_cases.approved_amount || 0;
                        if (amount >= 10000) {
                            monthlyAmountEl.textContent = '¥' + Math.round(amount / 10000) + '万';
                        } else if (amount > 0) {
                            monthlyAmountEl.textContent = '¥' + amount.toLocaleString();
                        } else {
                            monthlyAmountEl.textContent = '-';
                        }
                    }
                    
                    // 今月の採択率
                    const monthlyRateEl = document.getElementById('monthly-rate');
                    if (monthlyRateEl && data.monthly_cases) {
                        const rate = data.monthly_cases.rate;
                        monthlyRateEl.textContent = rate > 0 ? rate + '%' : '-';
                    }
                } catch (error) {
                    console.error('Error loading monthly stats:', error);
                }
            }
            // 案件一覧表示（案件ベース）
            // 展開状態を管理
            let expandedClients = new Set();
            
            function toggleClientExpand(clientId) {
                if (expandedClients.has(clientId)) {
                    expandedClients.delete(clientId);
                } else {
                    expandedClients.add(clientId);
                }
                renderCases(currentFilteredCases || allCases);
            }
            
            let currentFilteredCases = null;
            
            function renderCases(cases) {
                const container = document.getElementById('clientsList');
                currentFilteredCases = cases;
                
                // 案件数を更新
                const clientCountEl = document.getElementById('clientCount');
                if (clientCountEl) {
                    clientCountEl.textContent = cases.length + '件';
                }
                
                if (cases.length === 0) {
                    container.innerHTML = \`
                        <div class="text-center py-12">
                            <div class="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-folder-open text-4xl text-gray-300"></i>
                            </div>
                            <h3 class="text-lg font-medium text-gray-600 mb-2">案件がありません</h3>
                            <p class="text-sm text-gray-400 mb-4">新規案件を登録して始めましょう</p>
                            <button onclick="openNewCaseModal()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                <i class="fas fa-plus mr-2"></i>新規案件登録
                            </button>
                        </div>
                    \`;
                    return;
                }

                // 申請期限の残り日数を計算する関数
                function getDeadlineInfo(endDate) {
                    if (!endDate) return null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const deadline = new Date(endDate);
                    const diffTime = deadline.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0) {
                        return { text: '期限切れ', class: 'bg-gray-400 text-white', urgent: false };
                    } else if (diffDays <= 7) {
                        return { text: \`残り\${diffDays}日\`, class: 'bg-red-600 text-white animate-pulse', urgent: true };
                    } else if (diffDays <= 14) {
                        return { text: \`残り\${diffDays}日\`, class: 'bg-orange-500 text-white', urgent: true };
                    } else if (diffDays <= 30) {
                        return { text: \`残り\${diffDays}日\`, class: 'bg-yellow-500 text-white', urgent: false };
                    } else {
                        return { text: \`残り\${diffDays}日\`, class: 'bg-green-500 text-white', urgent: false };
                    }
                }

                // 顧客ごとに案件をグループ化
                const clientsMap = new Map();
                cases.forEach(caseItem => {
                    const clientId = caseItem.client_id;
                    if (!clientsMap.has(clientId)) {
                        clientsMap.set(clientId, {
                            clientId: clientId,
                            clientName: caseItem.client_name || '未設定',
                            companyName: caseItem.company_name,
                            email: caseItem.email,
                            address: caseItem.address,
                            cases: []
                        });
                    }
                    clientsMap.get(clientId).cases.push(caseItem);
                });
                
                // 顧客リストに変換
                const clientsList = Array.from(clientsMap.values());
                
                container.innerHTML = clientsList.map(clientData => {
                    const isExpanded = expandedClients.has(clientData.clientId);
                    const caseCount = clientData.cases.length;
                    const hasUrgent = clientData.cases.some(c => {
                        const info = getDeadlineInfo(c.application_end_date);
                        return info?.urgent;
                    });
                    
                    // 案件のステータス集計
                    const statusSummary = {};
                    clientData.cases.forEach(c => {
                        statusSummary[c.status] = (statusSummary[c.status] || 0) + 1;
                    });
                    
                    return \`
                    <div class="border-b last:border-b-0 \${hasUrgent ? 'border-l-4 border-l-red-500' : ''}">
                        <!-- 顧客ヘッダー（クリックで展開/折りたたみ） -->
                        <div class="py-3 px-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between" onclick="toggleClientExpand(\${clientData.clientId})">
                            <div class="flex items-center gap-3 flex-1">
                                <i class="fas fa-chevron-\${isExpanded ? 'down' : 'right'} text-gray-400 w-4 transition-transform"></i>
                                <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-user text-blue-600"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <h3 class="font-bold text-gray-900">\${clientData.clientName}</h3>
                                        <span class="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-800 font-medium">
                                            <i class="fas fa-folder mr-1"></i>\${caseCount}件
                                        </span>
                                        \${Object.entries(statusSummary).map(([status, count]) => \`
                                            <span class="px-2 py-0.5 rounded-full text-xs \${STATUS_COLORS[status]}">\${STATUS_LABELS[status]}: \${count}</span>
                                        \`).join('')}
                                    </div>
                                    <div class="text-sm text-gray-500 truncate">
                                        \${clientData.companyName ? clientData.companyName : ''}\${clientData.address ? (clientData.companyName ? ' / ' : '') + clientData.address : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="flex gap-2 ml-2" onclick="event.stopPropagation()">
                                <a href="/client/\${clientData.clientId}" class="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                                    <i class="fas fa-eye mr-1"></i>顧客詳細
                                </a>
                            </div>
                        </div>
                        
                        <!-- 案件リスト（展開時のみ表示） -->
                        <div class="\${isExpanded ? '' : 'hidden'} bg-gray-50 border-t">
                            \${clientData.cases.map(caseItem => {
                                const portalUrl = \`\${window.location.origin}/portal/\${caseItem.access_token}\`;
                                const deadlineInfo = getDeadlineInfo(caseItem.application_end_date);
                                const caseNo = 'No.' + String(caseItem.id).padStart(4, '0');
                                
                                return \`
                                <div class="py-2.5 px-4 pl-10 border-b last:border-b-0 hover:bg-blue-50 transition-colors \${deadlineInfo?.urgent ? 'bg-red-50' : ''}">
                                    <div class="flex items-center gap-3">
                                        <!-- 左側: 案件情報（クリックで詳細へ） -->
                                        <a href="/case/\${caseItem.id}" class="flex-1 min-w-0 group">
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <span class="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700 font-mono font-bold group-hover:bg-blue-200 group-hover:text-blue-700">\${caseNo}</span>
                                                <span class="px-2 py-0.5 rounded-full text-xs font-medium \${STATUS_COLORS[caseItem.status]}">\${STATUS_LABELS[caseItem.status]}</span>
                                                \${caseItem.subsidy_type_name ? \`<span class="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800">\${caseItem.subsidy_type_name}</span>\` : ''}
                                                \${deadlineInfo ? \`<span class="px-2 py-0.5 rounded text-xs font-bold \${deadlineInfo.class}"><i class="fas fa-clock mr-1"></i>\${deadlineInfo.text}</span>\` : ''}
                                            </div>
                                            <div class="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
                                                \${caseItem.assigned_to_name || caseItem.assigned_to ? \`<span><i class="fas fa-user w-3"></i> \${caseItem.assigned_to_name || caseItem.assigned_to}</span>\` : ''}
                                                \${caseItem.deposit_required ? \`<span class="\${caseItem.deposit_paid ? 'text-green-600' : 'text-yellow-600'}" title="着手金"><i class="fas fa-hand-holding-usd w-3"></i> ¥\${(caseItem.deposit_amount || 0).toLocaleString()} \${caseItem.deposit_paid ? '✓' : '未払'}</span>\` : ''}
                                                \${caseItem.success_fee_enabled ? \`<span class="\${caseItem.success_fee_invoice_status === 'paid' ? 'text-green-600' : (caseItem.success_fee_invoice_status === 'payment_reported' ? 'text-purple-600' : (caseItem.success_fee_invoice_count > 0 ? 'text-blue-600' : 'text-gray-400'))}" title="成功報酬"><i class="fas fa-trophy w-3"></i> \${caseItem.success_fee_rate ? caseItem.success_fee_rate + '%' : '¥' + (caseItem.success_fee_amount || 0).toLocaleString()} \${caseItem.success_fee_invoice_status === 'paid' ? '✓' : (caseItem.success_fee_invoice_status === 'payment_reported' ? '確認中' : (caseItem.success_fee_invoice_count > 0 ? '請求中' : '未発行'))}</span>\` : ''}
                                            </div>
                                        </a>
                                        <!-- 右側: アクションボタン -->
                                        <div class="flex items-center gap-1.5 flex-shrink-0">
                                            <select onchange="updateCaseStatus(\${caseItem.id}, this.value, '\${caseItem.status}')" class="text-xs border rounded px-2 py-1 bg-white w-28">
                                                <option value="inquiry" \${caseItem.status === 'inquiry' ? 'selected' : ''}>見込み</option>
                                                <option value="preparing" \${caseItem.status === 'preparing' ? 'selected' : ''}>書類準備中</option>
                                                <option value="applying" \${caseItem.status === 'applying' ? 'selected' : ''}>申請中</option>
                                                <option value="adopted" \${caseItem.status === 'adopted' ? 'selected' : ''}>採択・入金待ち</option>
                                                <option value="rejected" \${caseItem.status === 'rejected' ? 'selected' : ''}>不採択</option>
                                                <option value="completed" \${caseItem.status === 'completed' ? 'selected' : ''}>完了</option>
                                            </select>
                                            <button onclick="copyPortalUrl('\${portalUrl}', '\${clientData.clientName}')" class="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded hover:bg-purple-100 hover:text-purple-600" title="URLコピー">
                                                <i class="fas fa-copy text-sm"></i>
                                            </button>
                                            <a href="/portal/\${caseItem.access_token}" target="_blank" class="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded hover:bg-green-100 hover:text-green-600" title="ポータル">
                                                <i class="fas fa-external-link-alt text-sm"></i>
                                            </a>
                                            \${localStorage.getItem('admin_role') === 'admin' ? \`
                                            <button onclick="deleteCase(\${caseItem.id}, '\${clientData.clientName}', '\${caseNo}')" class="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded hover:bg-red-100 hover:text-red-600" title="削除">
                                                <i class="fas fa-trash text-sm"></i>
                                            </button>
                                            \` : ''}
                                        </div>
                                    </div>
                                </div>
                                \`;
                            }).join('')}
                            
                            <!-- 新規案件追加ボタン -->
                            <div class="py-2 px-4 pl-12">
                                <button onclick="openNewCaseModalForClient(\${clientData.clientId}, '\${clientData.clientName}')" 
                                        class="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                    <i class="fas fa-plus-circle"></i>この顧客に新規案件を追加
                                </button>
                            </div>
                        </div>
                    </div>
                    \`;
                }).join('');
            }
            
            // 特定顧客に対して新規案件モーダルを開く
            function openNewCaseModalForClient(clientId, clientName) {
                openNewCaseModal();
                // 既存顧客を選択状態にする
                setTimeout(() => {
                    document.querySelector('input[name="customer_type"][value="existing"]').checked = true;
                    toggleCustomerType();
                    const select = document.getElementById('existingClientSelect');
                    if (select) {
                        select.value = clientId;
                    }
                }, 100);
            }
            
            // 案件ステータス更新
            async function updateCaseStatus(caseId, newStatus, currentStatus) {
                // 見込み → 他ステータスへの変更時は確認ダイアログを表示
                if (currentStatus === 'inquiry' && newStatus !== 'inquiry') {
                    const confirmed = await showSlotConfirmDialog();
                    if (!confirmed) {
                        loadData(); // キャンセル時は元に戻す
                        return;
                    }
                }
                
                try {
                    await axios.put(\`/api/cases/\${caseId}\`, { status: newStatus });
                    showToast('ステータスを更新しました');
                    loadData();
                } catch (error) {
                    console.error('Status update error:', error);
                    const errorMessage = error.response?.data?.error || error.message;
                    if (errorMessage.includes('枠') || errorMessage.includes('slot')) {
                        alert('枠が不足しています。\\n\\n管理画面の「プラン・枠管理」から追加枠を購入してください。');
                    } else {
                        alert('ステータスの更新に失敗しました: ' + errorMessage);
                    }
                    loadData(); // リロードして元に戻す
                }
            }
            
            // 枠消費確認ダイアログ
            function showSlotConfirmDialog() {
                return new Promise((resolve) => {
                    const modal = document.createElement('div');
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
                    modal.innerHTML = \`
                        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                            <div class="bg-gradient-to-r from-yellow-400 to-amber-500 p-4 text-white">
                                <div class="flex items-center gap-3">
                                    <div class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                                        <i class="fas fa-ticket-alt text-2xl"></i>
                                    </div>
                                    <div>
                                        <h3 class="font-bold text-lg">案件を開始しますか？</h3>
                                        <p class="text-sm opacity-90">枠を1つ消費します</p>
                                    </div>
                                </div>
                            </div>
                            <div class="p-5">
                                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                    <div class="flex items-start gap-3">
                                        <i class="fas fa-info-circle text-yellow-500 mt-0.5"></i>
                                        <div class="text-sm text-yellow-800">
                                            <p class="font-medium mb-1">「見込み」から他のステータスに変更すると：</p>
                                            <ul class="list-disc list-inside space-y-1 text-yellow-700">
                                                <li>利用可能な枠を<strong>1枠消費</strong>します</li>
                                                <li>顧客がヒアリング回答・書類アップロード可能になります</li>
                                                <li>この操作は取り消せません</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex gap-3">
                                    <button onclick="this.closest('.fixed').remove(); window._slotConfirmResolve(false);" 
                                            class="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">
                                        キャンセル
                                    </button>
                                    <button onclick="this.closest('.fixed').remove(); window._slotConfirmResolve(true);" 
                                            class="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                                        <i class="fas fa-play-circle mr-1"></i>案件を開始
                                    </button>
                                </div>
                            </div>
                        </div>
                    \`;
                    document.body.appendChild(modal);
                    window._slotConfirmResolve = resolve;
                });
            }
            
            // 後方互換性のためrenderClientsもエイリアスとして残す
            function renderClients(clients) {
                renderCases(clients);
            }
            
            // 右サイドパネルのタブ切り替え
            function switchRightTab(tabName) {
                // すべてのタブを非アクティブに
                document.querySelectorAll('.right-tab').forEach(tab => {
                    tab.classList.remove('text-blue-600', 'border-blue-600');
                    tab.classList.add('text-gray-600', 'border-transparent');
                });
                document.querySelectorAll('.right-content').forEach(content => {
                    content.classList.add('hidden');
                });
                
                // 選択したタブをアクティブに
                const activeTab = document.getElementById('rightTab-' + tabName);
                const activeContent = document.getElementById('rightContent-' + tabName);
                if (activeTab) {
                    activeTab.classList.remove('text-gray-600', 'border-transparent');
                    activeTab.classList.add('text-blue-600', 'border-blue-600');
                }
                if (activeContent) {
                    activeContent.classList.remove('hidden');
                }
                
                // 選択を保存
                localStorage.setItem('dashboard_right_tab', tabName);
            }
            
            // 保存されたタブを復元
            function restoreRightTab() {
                const savedTab = localStorage.getItem('dashboard_right_tab') || 'assignee';
                switchRightTab(savedTab);
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
            
            // 案件削除
            async function deleteCase(caseId, clientName, caseNumber) {
                const confirmed = await confirmDialog({
                    title: '案件の削除',
                    message: \`\${clientName}様の案件「\${caseNumber}」を削除してもよろしいですか？この操作は取り消せません。\`,
                    confirmText: '削除する',
                    cancelText: 'キャンセル',
                    confirmClass: 'bg-red-600 text-white hover:bg-red-700',
                    icon: 'fas fa-trash-alt text-red-600'
                });
                
                if (!confirmed) return;
                
                try {
                    await axios.delete(\`/api/cases/\${caseId}\`);
                    showToast(\`案件「\${caseNumber}」を削除しました\`);
                    loadData();
                } catch (error) {
                    showToast('削除に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
                    console.error('Delete error:', error);
                }
            }
            
            // 顧客削除（後方互換性のため残す）
            async function deleteClient(clientId, clientName) {
                // 選択ダイアログを表示
                const choice = await showDeleteChoiceDialog(clientName);
                if (!choice) return;
                
                try {
                    if (choice === 'reset') {
                        await axios.delete(\`/api/clients/\${clientId}?keep_customer=true\`);
                        showToast(\`\${clientName}様の案件情報をリセットしました\`);
                    } else {
                        await axios.delete(\`/api/clients/\${clientId}\`);
                        showToast(\`\${clientName}様の情報を削除しました\`);
                    }
                    loadData();
                } catch (error) {
                    showToast('削除に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
                    console.error('Delete error:', error);
                }
            }
            
            // 削除選択ダイアログ（モーダルコンポーネント使用）
            function showDeleteChoiceDialog(clientName) {
                return new Promise((resolve) => {
                    const modalId = 'deleteChoiceModal-' + Date.now();
                    
                    modalManager.create({
                        id: modalId,
                        title: '削除オプション',
                        icon: 'fas fa-exclamation-triangle text-red-600',
                        size: 'sm',
                        content: \`
                            <p class="mb-4 text-gray-700"><strong>\${clientName}</strong>様の情報をどのように処理しますか？</p>
                            <div class="space-y-3">
                                <button onclick="window._deleteChoiceResolve && window._deleteChoiceResolve('reset')" 
                                        class="w-full p-3 border-2 border-blue-500 rounded-lg text-left hover:bg-blue-50 transition">
                                    <div class="flex items-start gap-3">
                                        <i class="fas fa-redo text-blue-600 mt-1"></i>
                                        <div>
                                            <div class="font-bold text-blue-700">案件情報のみリセット</div>
                                            <div class="text-xs text-gray-600">顧客情報は保持、案件データを削除</div>
                                        </div>
                                    </div>
                                </button>
                                <button onclick="window._deleteChoiceResolve && window._deleteChoiceResolve('delete')" 
                                        class="w-full p-3 border-2 border-red-500 rounded-lg text-left hover:bg-red-50 transition">
                                    <div class="flex items-start gap-3">
                                        <i class="fas fa-trash text-red-600 mt-1"></i>
                                        <div>
                                            <div class="font-bold text-red-700">完全に削除</div>
                                            <div class="text-xs text-gray-600">すべてのデータを削除（取り消し不可）</div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        \`,
                        footer: \`
                            <button onclick="window._deleteChoiceResolve && window._deleteChoiceResolve(null)" 
                                    class="w-full py-2 border rounded-lg hover:bg-gray-100">
                                キャンセル
                            </button>
                        \`
                    });
                    
                    window._deleteChoiceResolve = async (choice) => {
                        if (choice === 'delete') {
                            // 完全削除の場合は追加確認
                            const confirmed = await confirmDialog({
                                title: '最終確認',
                                message: '本当に完全削除しますか？この操作は取り消せません。',
                                confirmText: '完全削除',
                                cancelText: '戻る',
                                confirmClass: 'bg-red-600 text-white hover:bg-red-700',
                                icon: 'fas fa-exclamation-triangle text-red-600'
                            });
                            if (!confirmed) return;
                        }
                        modalManager.close(modalId);
                        document.getElementById(modalId)?.remove();
                        resolve(choice);
                    };
                    
                    modalManager.open(modalId);
                });
            }
            
            // トースト通知表示
            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                const bgColor = type === 'error' ? 'bg-red-600' : 'bg-green-600';
                const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
                toast.className = \`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto \${bgColor} text-white px-4 md:px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in\`;
                toast.innerHTML = \`
                    <div class="flex items-center gap-2">
                        <i class="fas \${icon}"></i>
                        <span class="text-sm md:text-base">\${message}</span>
                    </div>
                \`;
                document.body.appendChild(toast);
                
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transition = 'opacity 0.3s';
                    setTimeout(() => toast.remove(), 300);
                }, type === 'error' ? 5000 : 3000);
            }

            // 検索（案件ベース）
            function filterClients() {
                const searchQueryEl = document.getElementById('searchQuery');
                const query = searchQueryEl ? searchQueryEl.value.toLowerCase() : '';
                
                let filtered = allCases;
                
                if (query) {
                    filtered = filtered.filter(c => 
                        (c.client_name && c.client_name.toLowerCase().includes(query)) || 
                        (c.company_name && c.company_name.toLowerCase().includes(query)) ||
                        (c.case_number && c.case_number.toLowerCase().includes(query))
                    );
                }
                
                renderCases(filtered);
            }

            const searchQueryEl = document.getElementById('searchQuery');
            if (searchQueryEl) searchQueryEl.addEventListener('input', filterClients);

            // 新規顧客登録
            function openNewClientModal() {
                document.getElementById('newClientModal').classList.remove('hidden');
            }

            function closeNewClientModal() {
                document.getElementById('newClientModal').classList.add('hidden');
                document.getElementById('newClientForm').reset();
            }

            const newClientFormEl = document.getElementById('newClientForm');
            if (newClientFormEl) newClientFormEl.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                // チェックボックスの値を変換
                data.deposit_required = document.getElementById('depositRequired')?.checked ? 1 : 0;
                data.withholding_tax = document.getElementById('withholdingTax')?.checked ? 1 : 0;
                
                // 数値フィールドを変換
                if (data.deposit_amount) {
                    data.deposit_amount = parseInt(data.deposit_amount) || 0;
                }
                
                try {
                    await axios.post('/api/clients', data);
                    closeNewClientModal();
                    loadData();
                } catch (error) {
                    alert('登録に失敗しました');
                    console.error(error);
                }
            });

            // グローバルスコープに関数を公開（onclick対応）
            window.toggleSidebar = toggleSidebar;
            window.openNewCaseModal = openNewCaseModal;
            window.closeNewCaseModal = closeNewCaseModal;
            window.openNewClientModal = openNewClientModal;
            window.closeNewClientModal = closeNewClientModal;
            window.filterByStatus = filterByStatus;
            window.logout = logout;
            window.copyPortalUrl = copyPortalUrl;
            window.deleteCase = deleteCase;
            window.deleteClient = deleteClient;
            window.showDeleteChoiceDialog = showDeleteChoiceDialog;
            window.showToast = showToast;
            window.filterClients = filterClients;
            window.toggleDepositFields = toggleDepositFields;
            window.toggleSuccessFeeFields = toggleSuccessFeeFields;
            window.toggleSuccessFeeType = toggleSuccessFeeType;
            window.toggleCustomerType = toggleCustomerType;
            window.filterSubsidyOptions = filterSubsidyOptions;
            window.renderSubsidyOptions = renderSubsidyOptions;
            window.selectSubsidyCategory = selectSubsidyCategory;
            window.selectSubsidy = selectSubsidy;
            
            // 通知カードのクリックイベント
            document.getElementById('notifyCardMessage')?.addEventListener('click', () => {
                window.filterNotifications('new_message');
            });
            document.getElementById('notifyCardDocument')?.addEventListener('click', () => {
                window.filterNotifications('document_upload');
            });
            document.getElementById('notifyCardPayment')?.addEventListener('click', () => {
                window.filterNotifications('payment_report');
            });

            // 初期読み込み
            loadSubsidyTypes();
            loadUsers();
            loadData();
            restoreRightTab();
            
            // URLパラメータでopenNewCase=trueの場合、新規案件モーダルを開く
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('openNewCase') === 'true') {
                // データの読み込みが完了してからモーダルを開く
                setTimeout(() => {
                    openNewCaseModal();
                    // URLからパラメータを削除
                    history.replaceState({}, document.title, window.location.pathname);
                }, 500);
            }
            
            ${sidebarScripts}
        </script>
    </body>
    </html>
  `)
})

export default routes
