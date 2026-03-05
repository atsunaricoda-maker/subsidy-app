// 公募要領管理画面
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/admin/guidelines', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>公募要領管理 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('guidelines')}
            
            <main class="flex-1 min-h-screen">
                <!-- パンくずリスト -->
                <div class="bg-white px-4 py-1.5 border-b text-xs" id="breadcrumb">
                    <a href="/" class="text-blue-600 hover:text-blue-800 hover:underline">ダッシュボード</a>
                    <i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>
                    <a href="/subsidy-types" class="text-blue-600 hover:text-blue-800 hover:underline">申請種別</a>
                    <i class="fas fa-chevron-right text-gray-300 text-xs mx-2"></i>
                    <span class="text-gray-800 font-medium">公募要領管理</span>
                </div>
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-book-open mr-2"></i>公募要領管理
                            </h2>
                        </div>
                        <div class="flex items-center gap-3">
                            <div id="notificationBadge" class="relative cursor-pointer" onclick="showNotifications()">
                                <i class="fas fa-bell text-xl text-gray-600"></i>
                                <span id="unreadCount" class="hidden absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">0</span>
                            </div>
                        </div>
                    </div>
                </header>

                <div class="p-4 lg:p-6">
                <!-- 閲覧専用バナー -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div class="flex items-start gap-3">
                        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-eye text-blue-600"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="font-bold text-blue-800">閲覧専用モード</h3>
                            <p class="text-sm text-blue-700 mt-1">
                                公募要領データはマスター管理画面で一元管理されています。<br>
                                こちらでは最新の公募情報を確認できますが、編集はできません。
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- 管轄別サマリー -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div class="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg shadow p-4 border-l-4 border-emerald-500">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-file-signature text-emerald-600"></i>
                                <h3 class="font-bold text-emerald-800">行政書士管轄</h3>
                            </div>
                            <span class="text-xs bg-emerald-200 text-emerald-800 px-2 py-1 rounded">補助金</span>
                        </div>
                        <div class="grid grid-cols-3 gap-2 text-sm">
                            <div class="text-center">
                                <p class="text-gray-600">申請可能</p>
                                <p class="text-xl font-bold text-emerald-700" id="summaryGyoseishoshiActive">-</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-600">締切間近</p>
                                <p class="text-xl font-bold text-orange-600" id="summaryGyoseishoshiDeadline">-</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-600">最大補助額</p>
                                <p class="text-xl font-bold text-blue-600" id="summaryGyoseishoshiAmount">-</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow p-4 border-l-4 border-blue-500">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-users text-blue-600"></i>
                                <h3 class="font-bold text-blue-800">社労士管轄</h3>
                            </div>
                            <span class="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">助成金</span>
                        </div>
                        <div class="grid grid-cols-3 gap-2 text-sm">
                            <div class="text-center">
                                <p class="text-gray-600">申請可能</p>
                                <p class="text-xl font-bold text-blue-700" id="summarySharoshiActive">-</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-600">締切間近</p>
                                <p class="text-xl font-bold text-orange-600" id="summarySharoshiDeadline">-</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-600">最大補助額</p>
                                <p class="text-xl font-bold text-blue-600" id="summarySharoshiAmount">-</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 全体サマリーダッシュボード -->
                <div id="guidelinesSummary" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">現在申請可能</p>
                                <p class="text-2xl font-bold text-green-600" id="summaryActiveCount">-</p>
                            </div>
                            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-check-circle text-green-500 text-xl"></i>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">締切間近(30日以内)</p>
                                <p class="text-2xl font-bold text-orange-600" id="summaryDeadlineCount">-</p>
                            </div>
                            <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-clock text-orange-500 text-xl"></i>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">最大補助額合計</p>
                                <p class="text-2xl font-bold text-blue-600" id="summaryTotalAmount">-</p>
                            </div>
                            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-yen-sign text-blue-500 text-xl"></i>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-500">登録補助金種別</p>
                                <p class="text-2xl font-bold text-purple-600" id="summarySubsidyTypes">-</p>
                            </div>
                            <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-list text-purple-500 text-xl"></i>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- タブ切り替え -->
                <div class="bg-white rounded-lg shadow mb-6">
                    <div class="border-b flex overflow-x-auto">
                        <button onclick="switchTab('watch')" id="tab-watch" 
                                class="px-6 py-3 font-medium text-indigo-600 border-b-2 border-indigo-600 whitespace-nowrap">
                            <i class="fas fa-eye mr-2"></i>監視URL
                        </button>
                        <button onclick="switchTab('updates')" id="tab-updates" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-sync mr-2"></i>更新履歴
                        </button>
                        <button onclick="switchTab('guidelines')" id="tab-guidelines" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-file-alt mr-2"></i>公募要領詳細
                        </button>
                        <button onclick="switchTab('calendar')" id="tab-calendar" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-calendar-alt mr-2"></i>スケジュール
                        </button>
                        <button onclick="switchTab('compare')" id="tab-compare" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-columns mr-2"></i>比較
                        </button>
                        <button onclick="switchTab('cases')" id="tab-cases" 
                                class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                            <i class="fas fa-sitemap mr-2"></i>案件進捗
                        </button>
                    </div>
                </div>

                <!-- 監視URLタブ -->
                <div id="content-watch" class="space-y-6">
                    <div class="flex justify-between items-center">
                        <h2 class="text-lg font-bold">監視URL一覧</h2>
                        <span class="text-sm text-gray-500"><i class="fas fa-lock mr-1"></i>閲覧専用</span>
                    </div>
                    <div class="bg-white rounded-lg shadow overflow-hidden">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 border-b">
                                <tr>
                                    <th class="px-4 py-3 text-left">補助金</th>
                                    <th class="px-4 py-3 text-left">URL</th>
                                    <th class="px-4 py-3 text-left">最終チェック</th>
                                </tr>
                            </thead>
                            <tbody id="watchUrlsList" class="divide-y">
                                <tr><td colspan="3" class="px-4 py-8 text-center text-gray-500">読み込み中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 更新履歴タブ -->
                <div id="content-updates" class="hidden space-y-6">
                    <div class="flex justify-between items-center">
                        <h2 class="text-lg font-bold">更新検知履歴</h2>
                        <span class="text-sm text-gray-500"><i class="fas fa-lock mr-1"></i>閲覧専用</span>
                    </div>
                    <div class="bg-white rounded-lg shadow overflow-hidden">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50 border-b">
                                <tr>
                                    <th class="px-4 py-3 text-left">検知日時</th>
                                    <th class="px-4 py-3 text-left">補助金</th>
                                    <th class="px-4 py-3 text-left">変更種別</th>
                                    <th class="px-4 py-3 text-left">ステータス</th>
                                </tr>
                            </thead>
                            <tbody id="updateLogsList" class="divide-y">
                                <tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">読み込み中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 公募要領詳細タブ -->
                <div id="content-guidelines" class="hidden space-y-6">
                    <div class="flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <h2 class="text-lg font-bold">公募要領詳細</h2>
                            <p class="text-sm text-gray-500">補助金・助成金ごとの公募情報を確認できます</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <select id="categoryFilter" onchange="filterGuidelines()" class="px-3 py-2 border rounded-lg text-sm">
                                <option value="all">全管轄</option>
                                <option value="行政書士管轄">行政書士管轄</option>
                                <option value="社労士管轄">社労士管轄</option>
                            </select>
                            <select id="guidelinesFilter" onchange="filterGuidelines()" class="px-3 py-2 border rounded-lg text-sm">
                                <option value="all">すべて表示</option>
                                <option value="active">有効のみ</option>
                                <option value="inactive">終了のみ</option>
                            </select>
                            <span class="text-sm text-gray-500 flex items-center"><i class="fas fa-lock mr-1"></i>閲覧専用</span>
                        </div>
                    </div>
                    <div id="guidelinesList" class="space-y-8">
                        <div class="text-center py-8 text-gray-500">読み込み中...</div>
                    </div>
                </div>
                
                <!-- スケジュールタブ（カレンダービュー） -->
                <div id="content-calendar" class="hidden space-y-6">
                    <div class="flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <h2 class="text-lg font-bold">申請スケジュール</h2>
                            <p class="text-sm text-gray-500">公募期間をタイムラインで確認できます</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <select id="calendarCategoryFilter" onchange="renderCalendarTimeline()" class="px-3 py-2 border rounded-lg text-sm">
                                <option value="all">全管轄</option>
                                <option value="行政書士管轄">行政書士管轄</option>
                                <option value="社労士管轄">社労士管轄</option>
                            </select>
                            <button onclick="changeCalendarMonth(-1)" class="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <span id="calendarMonthLabel" class="px-4 py-2 font-medium">2025年1月</span>
                            <button onclick="changeCalendarMonth(1)" class="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- タイムライン表示 -->
                    <div class="bg-white rounded-lg shadow overflow-hidden">
                        <div class="p-4 bg-gray-50 border-b">
                            <div class="flex items-center gap-4 text-sm">
                                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-green-500"></span> 公募中</span>
                                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-yellow-500"></span> 締切間近</span>
                                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-red-500"></span> 締切7日以内</span>
                                <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-gray-300"></span> 終了</span>
                            </div>
                        </div>
                        <div id="calendarTimeline" class="p-4 min-h-[400px]">
                            <div class="text-center py-8 text-gray-500">読み込み中...</div>
                        </div>
                    </div>
                    
                    <!-- 締切間近リスト -->
                    <div class="bg-white rounded-lg shadow">
                        <div class="p-4 border-b bg-orange-50">
                            <h3 class="font-bold text-orange-800"><i class="fas fa-exclamation-triangle mr-2"></i>締切間近の公募（30日以内）</h3>
                        </div>
                        <div id="upcomingDeadlines" class="divide-y">
                            <div class="text-center py-4 text-gray-500">読み込み中...</div>
                        </div>
                    </div>
                </div>
                
                <!-- 比較タブ -->
                <div id="content-compare" class="hidden space-y-6">
                    <div class="flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <h2 class="text-lg font-bold">補助金・助成金比較</h2>
                            <p class="text-sm text-gray-500">複数の補助金を並べて比較できます</p>
                        </div>
                        <select id="compareCategoryFilter" onchange="renderCompareSelection()" class="px-3 py-2 border rounded-lg text-sm">
                            <option value="all">全管轄</option>
                            <option value="行政書士管轄">行政書士管轄</option>
                            <option value="社労士管轄">社労士管轄</option>
                        </select>
                    </div>
                    
                    <!-- 比較対象選択 -->
                    <div class="bg-white rounded-lg shadow p-4">
                        <h3 class="font-medium mb-3">比較対象を選択（最大3つ）</h3>
                        <div id="compareSelection" class="flex flex-wrap gap-2">
                            <!-- 動的生成 -->
                        </div>
                    </div>
                    
                    <!-- 比較表 -->
                    <div class="bg-white rounded-lg shadow overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr id="compareHeaders" class="bg-gray-50 border-b">
                                    <th class="px-4 py-3 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-[150px]">項目</th>
                                    <!-- 動的生成 -->
                                </tr>
                            </thead>
                            <tbody id="compareBody">
                                <tr>
                                    <td colspan="4" class="px-4 py-8 text-center text-gray-500">
                                        比較する補助金を選択してください
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- 案件進捗タブ -->
                <div id="content-cases" class="hidden space-y-6">
                    <div class="flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <h2 class="text-lg font-bold">
                                <i class="fas fa-sitemap mr-2 text-indigo-600"></i>案件進捗ツリー
                            </h2>
                            <p class="text-sm text-gray-500">補助金ごとに申請中の案件と進捗状況を確認できます</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <select id="caseTreeCategoryFilter" onchange="loadCaseTree()" class="px-3 py-2 border rounded-lg text-sm">
                                <option value="all">全管轄</option>
                                <option value="行政書士管轄">行政書士管轄</option>
                                <option value="社労士管轄">社労士管轄</option>
                            </select>
                            <select id="caseTreeStatusFilter" onchange="loadCaseTree()" class="px-3 py-2 border rounded-lg text-sm">
                                <option value="active">進行中の案件</option>
                                <option value="all">すべての案件</option>
                                <option value="completed">完了した案件</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- サマリーカード -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                            <p class="text-sm text-gray-500">申請中の案件</p>
                            <p class="text-2xl font-bold text-blue-600" id="caseTreeTotalCases">-</p>
                        </div>
                        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                            <p class="text-sm text-gray-500">申請済み</p>
                            <p class="text-2xl font-bold text-green-600" id="caseTreeAppliedCases">-</p>
                        </div>
                        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
                            <p class="text-sm text-gray-500">準備中</p>
                            <p class="text-2xl font-bold text-orange-600" id="caseTreePreparingCases">-</p>
                        </div>
                        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
                            <p class="text-sm text-gray-500">補助金種別数</p>
                            <p class="text-2xl font-bold text-purple-600" id="caseTreeSubsidyTypes">-</p>
                        </div>
                    </div>
                    
                    <!-- ツリー表示 -->
                    <div id="caseTreeContainer" class="space-y-4">
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                            <p>読み込み中...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- URL追加モーダル -->
        <div id="addUrlModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 class="text-xl font-bold mb-4">監視URL追加</h3>
                <form id="addUrlForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">補助金種別 *</label>
                        <select name="subsidy_type_id" id="addUrlSubsidyType" required class="w-full px-3 py-2 border rounded-lg">
                            <option value="">選択してください</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">URL *</label>
                        <input type="url" name="url" required class="w-full px-3 py-2 border rounded-lg" placeholder="https://...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">説明</label>
                        <input type="text" name="description" class="w-full px-3 py-2 border rounded-lg" placeholder="公式サイトトップページ">
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">追加</button>
                        <button type="button" onclick="closeAddUrlModal()" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 通知モーダル -->
        <div id="notificationsModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">通知</h3>
                    <button onclick="closeNotificationsModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div id="notificationsList" class="space-y-3">
                    <div class="text-center py-4 text-gray-500">読み込み中...</div>
                </div>
            </div>
        </div>

        <!-- 公募要領追加モーダル -->
        <div id="addGuidelineModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
                <h3 class="text-xl font-bold mb-4">公募要領詳細追加</h3>
                <form id="addGuidelineForm" class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">補助金種別 *</label>
                            <select name="subsidy_type_id" id="addGuidelineSubsidyType" required class="w-full px-3 py-2 border rounded-lg">
                                <option value="">選択してください</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">年度 *</label>
                            <input type="text" name="fiscal_year" required class="w-full px-3 py-2 border rounded-lg" placeholder="2025年度">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公募回・バージョン</label>
                        <input type="text" name="version" class="w-full px-3 py-2 border rounded-lg" placeholder="第1次公募、通年公募 など">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">申請開始日</label>
                            <input type="date" name="application_start_date" class="w-full px-3 py-2 border rounded-lg">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">申請締切日</label>
                            <input type="date" name="application_end_date" class="w-full px-3 py-2 border rounded-lg">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">上限額（万円）</label>
                            <input type="number" name="max_amount" class="w-full px-3 py-2 border rounded-lg" placeholder="450">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">下限額（万円）</label>
                            <input type="number" name="min_amount" class="w-full px-3 py-2 border rounded-lg" placeholder="5">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">補助率</label>
                            <input type="text" name="subsidy_rate" class="w-full px-3 py-2 border rounded-lg" placeholder="1/2〜2/3">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">対象者・要件</label>
                        <textarea name="eligibility_requirements" rows="3" class="w-full px-3 py-2 border rounded-lg" placeholder="中小企業者、小規模事業者など"></textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">対象経費</label>
                        <textarea name="target_expenses" rows="3" class="w-full px-3 py-2 border rounded-lg" placeholder="ソフトウェア購入費、導入関連費など"></textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公式サイトURL</label>
                        <input type="url" name="source_url" class="w-full px-3 py-2 border rounded-lg" placeholder="https://...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公募要領PDF URL</label>
                        <input type="url" name="pdf_url" class="w-full px-3 py-2 border rounded-lg" placeholder="https://...pdf">
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">追加</button>
                        <button type="button" onclick="closeAddGuidelineModal()" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 公募要領編集モーダル -->
        <div id="editGuidelineModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
                <h3 class="text-xl font-bold mb-4">公募要領詳細編集</h3>
                <form id="editGuidelineForm" class="space-y-4">
                    <input type="hidden" name="id" id="editGuidelineId">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">補助金種別</label>
                            <input type="text" id="editGuidelineSubsidyName" disabled class="w-full px-3 py-2 border rounded-lg bg-gray-100">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">年度 *</label>
                            <input type="text" name="fiscal_year" id="editGuidelineFiscalYear" required class="w-full px-3 py-2 border rounded-lg" placeholder="2025年度">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公募回・バージョン</label>
                        <input type="text" name="version" id="editGuidelineVersion" class="w-full px-3 py-2 border rounded-lg" placeholder="第1次公募、通年公募 など">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">申請開始日</label>
                            <input type="date" name="application_start_date" id="editGuidelineStartDate" class="w-full px-3 py-2 border rounded-lg">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">申請締切日</label>
                            <input type="date" name="application_end_date" id="editGuidelineEndDate" class="w-full px-3 py-2 border rounded-lg">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">上限額（万円）</label>
                            <input type="number" name="max_amount" id="editGuidelineMaxAmount" class="w-full px-3 py-2 border rounded-lg" placeholder="450">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">下限額（万円）</label>
                            <input type="number" name="min_amount" id="editGuidelineMinAmount" class="w-full px-3 py-2 border rounded-lg" placeholder="5">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">補助率</label>
                            <input type="text" name="subsidy_rate" id="editGuidelineSubsidyRate" class="w-full px-3 py-2 border rounded-lg" placeholder="1/2〜2/3">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">対象者・要件</label>
                        <textarea name="eligibility_requirements" id="editGuidelineEligibility" rows="3" class="w-full px-3 py-2 border rounded-lg" placeholder="中小企業者、小規模事業者など"></textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">対象経費</label>
                        <textarea name="target_expenses" id="editGuidelineExpenses" rows="3" class="w-full px-3 py-2 border rounded-lg" placeholder="ソフトウェア購入費、導入関連費など"></textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公式サイトURL</label>
                        <input type="url" name="source_url" id="editGuidelineSourceUrl" class="w-full px-3 py-2 border rounded-lg" placeholder="https://...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公募要領PDF URL</label>
                        <input type="url" name="pdf_url" id="editGuidelinePdfUrl" class="w-full px-3 py-2 border rounded-lg" placeholder="https://...pdf">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">ステータス</label>
                        <select name="status" id="editGuidelineStatus" class="w-full px-3 py-2 border rounded-lg">
                            <option value="active">有効（公募中）</option>
                            <option value="inactive">終了</option>
                        </select>
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">更新</button>
                        <button type="button" onclick="closeEditGuidelineModal()" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- AI抽出モーダル -->
        <div id="aiExtractModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                        <i class="fas fa-robot text-white"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold">AI自動情報取得</h3>
                        <p class="text-sm text-gray-500">公式サイトから公募要領情報を自動抽出</p>
                    </div>
                </div>
                <form id="aiExtractForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">補助金種別 *</label>
                        <select name="subsidy_type_id" id="aiExtractSubsidyType" required class="w-full px-3 py-2 border rounded-lg">
                            <option value="">選択してください</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">公式サイトURL *</label>
                        <input type="url" name="url" id="aiExtractUrl" required class="w-full px-3 py-2 border rounded-lg" placeholder="https://...">
                        <p class="text-xs text-gray-500 mt-1">公募要領の情報が掲載されているページのURLを入力してください</p>
                    </div>
                    <div id="aiExtractStatus" class="hidden">
                        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div class="flex items-center gap-3">
                                <i class="fas fa-spinner fa-spin text-purple-600 text-xl"></i>
                                <div>
                                    <div class="font-medium text-purple-900">AIが解析中...</div>
                                    <div class="text-sm text-purple-700">公式サイトから情報を抽出しています</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-2 pt-4">
                        <button type="submit" id="aiExtractSubmitBtn" class="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
                            <i class="fas fa-magic mr-2"></i>AIで情報を抽出
                        </button>
                        <button type="button" onclick="closeAiExtractModal()" class="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- AI抽出結果モーダル -->
        <div id="aiResultModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div class="bg-white rounded-lg p-6 max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                            <i class="fas fa-check text-white"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold">AI抽出結果</h3>
                            <p class="text-sm text-gray-500" id="aiResultSubsidyName">-</p>
                        </div>
                    </div>
                    <button onclick="closeAiResultModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <!-- 変更点サマリー -->
                <div id="aiResultChanges" class="mb-6"></div>
                
                <!-- 抽出データ比較 -->
                <div class="bg-gray-50 rounded-lg p-4 mb-6">
                    <h4 class="font-bold mb-3">抽出された情報</h4>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="text-gray-500">年度:</span>
                            <span class="ml-2 font-medium" id="aiResult_fiscal_year">-</span>
                        </div>
                        <div>
                            <span class="text-gray-500">公募回:</span>
                            <span class="ml-2 font-medium" id="aiResult_version">-</span>
                        </div>
                        <div>
                            <span class="text-gray-500">申請開始:</span>
                            <span class="ml-2 font-medium" id="aiResult_start_date">-</span>
                        </div>
                        <div>
                            <span class="text-gray-500">申請締切:</span>
                            <span class="ml-2 font-medium" id="aiResult_end_date">-</span>
                        </div>
                        <div>
                            <span class="text-gray-500">上限額:</span>
                            <span class="ml-2 font-medium" id="aiResult_max_amount">-</span>
                        </div>
                        <div>
                            <span class="text-gray-500">補助率:</span>
                            <span class="ml-2 font-medium" id="aiResult_subsidy_rate">-</span>
                        </div>
                    </div>
                    <div class="mt-3 text-sm">
                        <div class="text-gray-500">対象者・要件:</div>
                        <div class="mt-1" id="aiResult_eligibility">-</div>
                    </div>
                    <div class="mt-3 text-sm">
                        <div class="text-gray-500">対象経費:</div>
                        <div class="mt-1" id="aiResult_expenses">-</div>
                    </div>
                    <div class="mt-3 text-sm flex items-center gap-2">
                        <span class="text-gray-500">確信度:</span>
                        <span id="aiResult_confidence" class="px-2 py-0.5 rounded text-xs">-</span>
                    </div>
                    <div id="aiResult_notes" class="mt-3 text-sm text-gray-600 hidden">
                        <div class="text-gray-500">注意点:</div>
                        <div class="mt-1 italic"></div>
                    </div>
                </div>
                
                <div class="flex gap-2">
                    <button onclick="applyAiResult()" class="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold">
                        <i class="fas fa-check mr-2"></i>この内容で更新する
                    </button>
                    <button onclick="closeAiResultModal()" class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400">
                        キャンセル
                    </button>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${sidebarScripts}
        </script>
        <script>
            let subsidyTypes = [];
            let currentCalendarMonth = new Date();
            let selectedForCompare = [];

            // タブ切り替え
            function switchTab(tab) {
                ['watch', 'updates', 'guidelines', 'calendar', 'compare', 'cases'].forEach(t => {
                    const content = document.getElementById('content-' + t);
                    const tabEl = document.getElementById('tab-' + t);
                    if (content) content.classList.add('hidden');
                    if (tabEl) {
                        tabEl.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
                        tabEl.classList.add('text-gray-500');
                    }
                });
                document.getElementById('content-' + tab).classList.remove('hidden');
                document.getElementById('tab-' + tab).classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
                document.getElementById('tab-' + tab).classList.remove('text-gray-500');
                
                // タブ切り替え時にデータ更新
                if (tab === 'calendar') renderCalendarTimeline();
                if (tab === 'compare') renderCompareSelection();
                if (tab === 'cases') loadCaseTree();
            }

            // showToast は sidebarScripts 共通版を使用
            
            // 案件進捗ツリー読み込み
            async function loadCaseTree() {
                const container = document.getElementById('caseTreeContainer');
                const categoryFilter = document.getElementById('caseTreeCategoryFilter').value;
                const statusFilter = document.getElementById('caseTreeStatusFilter').value;
                
                container.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>読み込み中...</p></div>';
                
                try {
                    // 補助金種別と案件を取得
                    const [subsidyRes, casesRes, guidelinesRes] = await Promise.all([
                        axios.get('/api/subsidy-types'),
                        axios.get('/api/cases'),
                        axios.get('/api/subsidy-guidelines')
                    ]);
                    
                    let subsidies = subsidyRes.data || [];
                    const allCases = casesRes.data || [];
                    const guidelines = guidelinesRes.data || [];
                    
                    // カテゴリフィルタ
                    if (categoryFilter !== 'all') {
                        subsidies = subsidies.filter(s => s.category === categoryFilter);
                    }
                    
                    // ステータスフィルタ
                    let filteredCases = allCases;
                    if (statusFilter === 'active') {
                        filteredCases = allCases.filter(c => !['completed', 'rejected', 'cancelled'].includes(c.status));
                    } else if (statusFilter === 'completed') {
                        filteredCases = allCases.filter(c => ['completed', 'adopted'].includes(c.status));
                    }
                    
                    // サマリー更新
                    const totalCases = filteredCases.length;
                    const appliedCases = filteredCases.filter(c => ['applying', 'applied', 'adopted'].includes(c.status)).length;
                    const preparingCases = filteredCases.filter(c => ['preparing', 'inquiry'].includes(c.status)).length;
                    const subsidyTypesWithCases = new Set(filteredCases.map(c => c.subsidy_type_id)).size;
                    
                    document.getElementById('caseTreeTotalCases').textContent = totalCases;
                    document.getElementById('caseTreeAppliedCases').textContent = appliedCases;
                    document.getElementById('caseTreePreparingCases').textContent = preparingCases;
                    document.getElementById('caseTreeSubsidyTypes').textContent = subsidyTypesWithCases;
                    
                    // 補助金ごとにグループ化
                    const subsidyGroups = subsidies.map(subsidy => {
                        const cases = filteredCases.filter(c => c.subsidy_type_id === subsidy.id);
                        const guideline = guidelines.find(g => g.subsidy_type_id === subsidy.id);
                        return { subsidy, cases, guideline };
                    }).filter(g => g.cases.length > 0); // 案件がある補助金のみ
                    
                    if (subsidyGroups.length === 0) {
                        container.innerHTML = \`
                            <div class="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
                                <i class="fas fa-folder-open text-4xl mb-3 text-gray-300"></i>
                                <p>該当する案件がありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    // 締切日の色とラベルを決定するヘルパー関数
                    function getDeadlineStyle(daysUntil) {
                        if (daysUntil === null) return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', label: '期限未設定', icon: 'calendar' };
                        if (daysUntil < 0) return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-400', label: '期限切れ', icon: 'exclamation-triangle' };
                        if (daysUntil <= 7) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-400', label: \`あと\${daysUntil}日\`, icon: 'clock' };
                        if (daysUntil <= 30) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-400', label: \`あと\${daysUntil}日\`, icon: 'calendar-alt' };
                        return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300', label: \`あと\${daysUntil}日\`, icon: 'calendar-check' };
                    }
                    
                    // ツリー表示生成
                    container.innerHTML = subsidyGroups.map(group => {
                        const { subsidy, cases, guideline } = group;
                        const isGyoseishoshi = subsidy.category === '行政書士管轄';
                        const categoryColor = isGyoseishoshi ? 'emerald' : 'blue';
                        const deadline = guideline?.application_end_date ? new Date(guideline.application_end_date) : null;
                        const daysUntilDeadline = deadline ? Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)) : null;
                        const deadlineStyle = getDeadlineStyle(daysUntilDeadline);
                        const isExpired = daysUntilDeadline !== null && daysUntilDeadline < 0;
                        const isUrgent = daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline >= 0;
                        
                        return \`
                            <div class="bg-white rounded-lg shadow overflow-hidden \${isExpired ? 'ring-2 ring-red-400' : isUrgent ? 'ring-2 ring-orange-400' : ''}">
                                <!-- 補助金ヘッダー -->
                                <div class="p-4 bg-gradient-to-r from-\${categoryColor}-50 to-\${categoryColor}-100 border-b border-\${categoryColor}-200 cursor-pointer"
                                     onclick="toggleCaseTreeGroup(this)">
                                    <div class="flex items-center justify-between flex-wrap gap-3">
                                        <div class="flex items-center gap-3">
                                            <i class="fas fa-chevron-down text-\${categoryColor}-600 transition-transform tree-toggle-icon"></i>
                                            <div>
                                                <div class="flex items-center gap-2 flex-wrap">
                                                    <span class="font-bold text-\${categoryColor}-800">\${subsidy.name}</span>
                                                    <span class="text-xs px-2 py-0.5 rounded bg-\${categoryColor}-200 text-\${categoryColor}-800">
                                                        \${isGyoseishoshi ? '補助金' : '助成金'}
                                                    </span>
                                                    <span class="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                                                        \${cases.length}件
                                                    </span>
                                                </div>
                                                <!-- 申請期限バッジ -->
                                                <div class="flex items-center gap-2 mt-2">
                                                    <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border \${deadlineStyle.bg} \${deadlineStyle.border}">
                                                        <i class="fas fa-\${deadlineStyle.icon} \${deadlineStyle.text}"></i>
                                                        <span class="text-sm font-medium \${deadlineStyle.text}">
                                                            申請期限: \${deadline ? deadline.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '未設定'}
                                                        </span>
                                                        <span class="text-xs px-1.5 py-0.5 rounded \${deadlineStyle.bg} \${deadlineStyle.text} font-bold">
                                                            \${deadlineStyle.label}
                                                        </span>
                                                    </div>
                                                    \${guideline?.application_start_date ? \`
                                                        <span class="text-xs text-gray-500">
                                                            （開始: \${new Date(guideline.application_start_date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}）
                                                        </span>
                                                    \` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-4 text-sm">
                                            <div class="text-center">
                                                <p class="text-gray-500">準備中</p>
                                                <p class="font-bold text-orange-600">\${cases.filter(c => c.status === 'preparing').length}</p>
                                            </div>
                                            <div class="text-center">
                                                <p class="text-gray-500">申請中</p>
                                                <p class="font-bold text-blue-600">\${cases.filter(c => c.status === 'applying').length}</p>
                                            </div>
                                            <div class="text-center">
                                                <p class="text-gray-500">採択</p>
                                                <p class="font-bold text-green-600">\${cases.filter(c => c.status === 'adopted').length}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- 案件リスト -->
                                <div class="case-tree-content">
                                    <div class="divide-y">
                                        \${cases.map(caseItem => {
                                            const statusConfig = {
                                                inquiry: { label: '見込み', color: 'gray', icon: 'question-circle' },
                                                preparing: { label: '書類準備中', color: 'orange', icon: 'file-alt' },
                                                applying: { label: '申請中', color: 'blue', icon: 'paper-plane' },
                                                submitted: { label: '申請済', color: 'indigo', icon: 'check' },
                                                under_review: { label: '審査中', color: 'purple', icon: 'search' },
                                                adopted: { label: '採択', color: 'green', icon: 'trophy' },
                                                rejected: { label: '不採択', color: 'red', icon: 'times-circle' },
                                                completed: { label: '完了', color: 'teal', icon: 'flag-checkered' },
                                                cancelled: { label: 'キャンセル', color: 'gray', icon: 'ban' }
                                            }[caseItem.status] || { label: caseItem.status, color: 'gray', icon: 'circle' };
                                            
                                            return \`
                                                <div class="p-4 hover:bg-gray-50 flex items-center justify-between">
                                                    <div class="flex items-center gap-4">
                                                        <div class="w-10 h-10 rounded-full bg-\${statusConfig.color}-100 flex items-center justify-center">
                                                            <i class="fas fa-\${statusConfig.icon} text-\${statusConfig.color}-600"></i>
                                                        </div>
                                                        <div>
                                                            <div class="flex items-center gap-2">
                                                                <span class="font-medium">\${caseItem.client_name || '未設定'}</span>
                                                                <span class="text-xs px-2 py-0.5 rounded bg-\${statusConfig.color}-100 text-\${statusConfig.color}-700">
                                                                    \${statusConfig.label}
                                                                </span>
                                                            </div>
                                                            <div class="text-sm text-gray-500">
                                                                案件番号: \${caseItem.case_number || '-'}
                                                                \${caseItem.assigned_staff_name ? \` | 担当: \${caseItem.assigned_staff_name}\` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <a href="/case/\${caseItem.id}" 
                                                       class="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-sm">
                                                        <i class="fas fa-external-link-alt mr-1"></i>詳細
                                                    </a>
                                                </div>
                                            \`;
                                        }).join('')}
                                    </div>
                                </div>
                            </div>
                        \`;
                    }).join('');
                    
                } catch (error) {
                    console.error('Error loading case tree:', error);
                    container.innerHTML = \`
                        <div class="text-center py-8 text-red-500 bg-white rounded-lg shadow">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>データの読み込みに失敗しました</p>
                        </div>
                    \`;
                }
            }
            
            // ツリーグループの開閉
            function toggleCaseTreeGroup(header) {
                const content = header.nextElementSibling;
                const icon = header.querySelector('.tree-toggle-icon');
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    icon.style.transform = 'rotate(0deg)';
                } else {
                    content.style.display = 'none';
                    icon.style.transform = 'rotate(-90deg)';
                }
            }

            // 補助金種別読み込み
            async function loadSubsidyTypes() {
                try {
                    const response = await axios.get('/api/subsidy-types');
                    subsidyTypes = response.data || [];
                    
                    const options = '<option value="">選択してください</option>' + 
                        subsidyTypes.map(s => \`<option value="\${s.id}">\${s.name}</option>\`).join('');
                    
                    const addUrlSubsidyType = document.getElementById('addUrlSubsidyType');
                    const addGuidelineSubsidyType = document.getElementById('addGuidelineSubsidyType');
                    const aiExtractSubsidy = document.getElementById('aiExtractSubsidy');
                    const aiExtractSubsidyType = document.getElementById('aiExtractSubsidyType');
                    
                    if (addUrlSubsidyType) addUrlSubsidyType.innerHTML = options;
                    if (addGuidelineSubsidyType) addGuidelineSubsidyType.innerHTML = options;
                    if (aiExtractSubsidy) {
                        aiExtractSubsidy.innerHTML = '<option value="">補助金を選択</option>' + 
                            subsidyTypes.map(s => \`<option value="\${s.id}" data-url="\${s.source_url || ''}">\${s.name}</option>\`).join('');
                    }
                    if (aiExtractSubsidyType) aiExtractSubsidyType.innerHTML = options;
                } catch (error) {
                    console.error('Error loading subsidy types:', error);
                }
            }
            
            // AI抽出モーダル
            let currentAiResult = null;
            
            function openAiExtractModal() {
                const selectedSubsidy = document.getElementById('aiExtractSubsidy').value;
                if (selectedSubsidy) {
                    document.getElementById('aiExtractSubsidyType').value = selectedSubsidy;
                    // 補助金の公式URLがあれば自動入力
                    const subsidy = subsidyTypes.find(s => s.id == selectedSubsidy);
                    const guideline = allGuidelines.find(g => g.subsidy_type_id == selectedSubsidy && g.status === 'active');
                    if (guideline?.source_url) {
                        document.getElementById('aiExtractUrl').value = guideline.source_url;
                    }
                }
                document.getElementById('aiExtractModal').classList.remove('hidden');
            }
            
            function closeAiExtractModal() {
                document.getElementById('aiExtractModal').classList.add('hidden');
                document.getElementById('aiExtractForm').reset();
                document.getElementById('aiExtractStatus').classList.add('hidden');
            }
            
            document.getElementById('aiExtractForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const subsidyTypeId = document.getElementById('aiExtractSubsidyType').value;
                const url = document.getElementById('aiExtractUrl').value;
                
                if (!subsidyTypeId || !url) {
                    showToast('補助金とURLを入力してください', 'error');
                    return;
                }
                
                // ローディング表示
                document.getElementById('aiExtractStatus').classList.remove('hidden');
                document.getElementById('aiExtractSubmitBtn').disabled = true;
                
                try {
                    const response = await axios.post(\`/api/subsidy-guidelines/\${subsidyTypeId}/ai-extract\`, { url });
                    const result = response.data;
                    
                    if (result.error) {
                        showToast(result.error, 'error');
                        return;
                    }
                    
                    // 結果を保存
                    currentAiResult = {
                        subsidyTypeId,
                        ...result.extracted,
                        source_url: url
                    };
                    
                    // 結果モーダルを表示
                    closeAiExtractModal();
                    showAiResultModal(result);
                    
                } catch (error) {
                    showToast('AI抽出に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
                } finally {
                    document.getElementById('aiExtractStatus').classList.add('hidden');
                    document.getElementById('aiExtractSubmitBtn').disabled = false;
                }
            });
            
            function showAiResultModal(result) {
                const subsidy = subsidyTypes.find(s => s.id == result.subsidy_type?.id);
                document.getElementById('aiResultSubsidyName').textContent = subsidy?.name || result.subsidy_type?.name || '不明';
                
                // 変更点表示
                const changesDiv = document.getElementById('aiResultChanges');
                if (result.changes && result.changes.length > 0) {
                    changesDiv.innerHTML = \`
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h4 class="font-bold text-yellow-800 mb-2"><i class="fas fa-exclamation-triangle mr-2"></i>変更が検出されました</h4>
                            <div class="space-y-2">
                                \${result.changes.map(c => \`
                                    <div class="flex items-center gap-2 text-sm">
                                        <span class="text-gray-600">\${c.field}:</span>
                                        <span class="line-through text-red-600">\${c.old || '-'}</span>
                                        <i class="fas fa-arrow-right text-gray-400"></i>
                                        <span class="text-green-600 font-bold">\${c.new}</span>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                    \`;
                } else if (!result.current_guideline) {
                    changesDiv.innerHTML = \`
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 class="font-bold text-blue-800"><i class="fas fa-plus-circle mr-2"></i>新規登録</h4>
                            <p class="text-sm text-blue-700">この補助金の公募要領情報が新規登録されます</p>
                        </div>
                    \`;
                } else {
                    changesDiv.innerHTML = \`
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h4 class="font-bold text-green-800"><i class="fas fa-check-circle mr-2"></i>変更なし</h4>
                            <p class="text-sm text-green-700">現在の情報と同じ内容です</p>
                        </div>
                    \`;
                }
                
                // 抽出データ表示
                const ext = result.extracted;
                document.getElementById('aiResult_fiscal_year').textContent = ext.fiscal_year || '-';
                document.getElementById('aiResult_version').textContent = ext.version || '-';
                document.getElementById('aiResult_start_date').textContent = ext.application_start_date || '-';
                document.getElementById('aiResult_end_date').textContent = ext.application_end_date || '-';
                document.getElementById('aiResult_max_amount').textContent = ext.max_amount ? (ext.max_amount / 10000).toLocaleString() + '万円' : '-';
                document.getElementById('aiResult_subsidy_rate').textContent = ext.subsidy_rate || '-';
                document.getElementById('aiResult_eligibility').textContent = ext.eligibility_requirements || '-';
                document.getElementById('aiResult_expenses').textContent = ext.target_expenses || '-';
                
                // 確信度
                const confEl = document.getElementById('aiResult_confidence');
                const confColors = { high: 'bg-green-100 text-green-800', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-red-100 text-red-800' };
                const confLabels = { high: '高', medium: '中', low: '低' };
                confEl.className = \`px-2 py-0.5 rounded text-xs \${confColors[ext.confidence] || 'bg-gray-100 text-gray-800'}\`;
                confEl.textContent = confLabels[ext.confidence] || ext.confidence || '-';
                
                // 注意点
                const notesDiv = document.getElementById('aiResult_notes');
                if (ext.notes) {
                    notesDiv.classList.remove('hidden');
                    notesDiv.querySelector('div:last-child').textContent = ext.notes;
                } else {
                    notesDiv.classList.add('hidden');
                }
                
                document.getElementById('aiResultModal').classList.remove('hidden');
            }
            
            function closeAiResultModal() {
                document.getElementById('aiResultModal').classList.add('hidden');
                currentAiResult = null;
            }
            
            async function applyAiResult() {
                if (!currentAiResult) {
                    showToast('適用するデータがありません', 'error');
                    return;
                }
                
                try {
                    const response = await axios.post(\`/api/subsidy-guidelines/\${currentAiResult.subsidyTypeId}/ai-update\`, currentAiResult);
                    
                    if (response.data.success) {
                        showToast(\`公募要領を\${response.data.action === 'created' ? '新規登録' : '更新'}しました\`);
                        closeAiResultModal();
                        loadGuidelines();
                    }
                } catch (error) {
                    showToast('更新に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
                }
            }

            // 監視URL一覧
            async function loadWatchUrls() {
                const response = await axios.get('/api/subsidy-watch-urls');
                const urls = response.data;
                
                const tbody = document.getElementById('watchUrlsList');
                if (urls.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">監視URLがありません</td></tr>';
                    return;
                }
                
                tbody.innerHTML = urls.map(url => \`
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3">
                            <span class="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">\${url.subsidy_name || '不明'}</span>
                        </td>
                        <td class="px-4 py-3">
                            <div class="truncate max-w-xs" title="\${url.url}">\${url.description || url.url}</div>
                            <a href="\${url.url}" target="_blank" class="text-xs text-blue-600 hover:underline">
                                <i class="fas fa-external-link-alt mr-1"></i>開く
                            </a>
                        </td>
                        <td class="px-4 py-3 text-xs text-gray-500">
                            \${url.last_checked_at ? new Date(url.last_checked_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '未チェック'}
                        </td>
                    </tr>
                \`).join('');
            }

            // 更新ログ一覧
            async function loadUpdateLogs() {
                const response = await axios.get('/api/subsidy-update-logs');
                const logs = response.data;
                
                const tbody = document.getElementById('updateLogsList');
                if (logs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">更新履歴がありません</td></tr>';
                    return;
                }
                
                const statusLabels = {
                    pending: { label: '未確認', class: 'bg-yellow-100 text-yellow-800' },
                    reviewed: { label: '確認済み', class: 'bg-blue-100 text-blue-800' },
                    applied: { label: '対応済み', class: 'bg-green-100 text-green-800' },
                    ignored: { label: '対応不要', class: 'bg-gray-100 text-gray-800' }
                };
                
                tbody.innerHTML = logs.map(log => \`
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm">\${new Date(log.detected_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">\${log.subsidy_name}</span>
                        </td>
                        <td class="px-4 py-3 text-sm">\${log.change_type || '-'}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-1 rounded text-xs \${statusLabels[log.status]?.class || ''}">\${statusLabels[log.status]?.label || log.status}</span>
                        </td>
                    </tr>
                \`).join('');
            }

            // 公募要領データを保持
            let allGuidelines = [];
            
            // 公募要領一覧
            async function loadGuidelines() {
                const response = await axios.get('/api/subsidy-guidelines');
                allGuidelines = response.data;
                renderGuidelines();
            }
            
            function filterGuidelines() {
                renderGuidelines();
            }
            
            function renderGuidelines() {
                const filter = document.getElementById('guidelinesFilter').value;
                const categoryFilter = document.getElementById('categoryFilter').value;
                let guidelines = allGuidelines;
                
                // 管轄フィルター
                if (categoryFilter !== 'all') {
                    guidelines = guidelines.filter(g => {
                        const subsidy = subsidyTypes.find(s => s.id == g.subsidy_type_id);
                        return subsidy?.category === categoryFilter;
                    });
                }
                
                // ステータスフィルター
                if (filter === 'active') {
                    guidelines = guidelines.filter(g => g.status === 'active');
                } else if (filter === 'inactive') {
                    guidelines = guidelines.filter(g => g.status !== 'active');
                }
                
                const container = document.getElementById('guidelinesList');
                if (guidelines.length === 0) {
                    container.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-folder-open text-4xl mb-2"></i><div>公募要領がありません</div></div>';
                    return;
                }
                
                // 補助金種別ごとにグループ化
                const grouped = {};
                const subsidyInfo = {};
                guidelines.forEach(g => {
                    const key = g.subsidy_type_id;
                    if (!grouped[key]) {
                        grouped[key] = [];
                        // 補助金情報を取得
                        const subsidy = subsidyTypes.find(s => s.id == key);
                        subsidyInfo[key] = subsidy || { name: g.subsidy_name, category: '不明' };
                    }
                    grouped[key].push(g);
                });
                
                // カテゴリ色の定義（サイドバー・一覧で統一）
                const getCategoryColor = (category) => {
                    if (category === '行政書士管轄') return { bg: 'bg-emerald-50', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-800', icon: 'fas fa-file-signature' };
                    if (category === '社労士管轄') return { bg: 'bg-blue-50', border: 'border-blue-500', badge: 'bg-blue-100 text-blue-800', icon: 'fas fa-users' };
                    if (category === '許認可') return { bg: 'bg-indigo-50', border: 'border-indigo-500', badge: 'bg-indigo-100 text-indigo-800', icon: 'fas fa-stamp' };
                    return { bg: 'bg-gray-50', border: 'border-gray-500', badge: 'bg-gray-100 text-gray-800', icon: 'fas fa-folder' };
                };
                
                // 申請期限の残日数計算
                const getDaysRemaining = (endDate) => {
                    if (!endDate) return null;
                    const today = new Date();
                    const end = new Date(endDate);
                    const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
                    return diff;
                };
                
                const getDeadlineStatus = (days) => {
                    if (days === null) return { class: '', text: '' };
                    if (days < 0) return { class: 'text-gray-500', text: '終了' };
                    if (days <= 7) return { class: 'text-red-600 font-bold', text: \`残り\${days}日\` };
                    if (days <= 14) return { class: 'text-orange-600 font-bold', text: \`残り\${days}日\` };
                    if (days <= 30) return { class: 'text-yellow-600', text: \`残り\${days}日\` };
                    return { class: 'text-green-600', text: \`残り\${days}日\` };
                };
                
                let html = '';
                
                // カテゴリでソート（行政書士管轄 → 社労士管轄 → その他）
                const categoryOrder = ['行政書士管轄', '社労士管轄'];
                const sortedKeys = Object.keys(grouped).sort((a, b) => {
                    const catA = subsidyInfo[a]?.category || '';
                    const catB = subsidyInfo[b]?.category || '';
                    const orderA = categoryOrder.indexOf(catA);
                    const orderB = categoryOrder.indexOf(catB);
                    if (orderA !== orderB) return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
                    return (subsidyInfo[a]?.name || '').localeCompare(subsidyInfo[b]?.name || '');
                });
                
                sortedKeys.forEach(subsidyTypeId => {
                    const items = grouped[subsidyTypeId];
                    const info = subsidyInfo[subsidyTypeId];
                    const colors = getCategoryColor(info.category);
                    
                    html += \`
                        <div class="bg-white rounded-lg shadow overflow-hidden">
                            <div class="\${colors.bg} border-l-4 \${colors.border} px-4 py-3">
                                <div class="flex items-center justify-between flex-wrap gap-2">
                                    <div class="flex items-center gap-3">
                                        <i class="\${colors.icon} text-gray-600"></i>
                                        <div>
                                            <h3 class="font-bold text-gray-900">\${info.name}</h3>
                                            <span class="\${colors.badge} text-xs px-2 py-0.5 rounded">\${info.category || '一般'}</span>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-sm text-gray-500">\${items.length}件の公募情報</span>
                                        <button onclick="openAddGuidelineModalFor(\${subsidyTypeId})" class="text-indigo-600 hover:text-indigo-800 text-sm">
                                            <i class="fas fa-plus-circle mr-1"></i>追加
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="divide-y">
                    \`;
                    
                    items.forEach(g => {
                        const days = getDaysRemaining(g.application_end_date);
                        const deadlineStatus = getDeadlineStatus(days);
                        
                        // JSON文字列をパース（対象経費・要件）
                        let eligibility = '';
                        let expenses = '';
                        try {
                            if (g.eligibility_requirements) {
                                const parsed = typeof g.eligibility_requirements === 'string' ? 
                                    JSON.parse(g.eligibility_requirements) : g.eligibility_requirements;
                                eligibility = Array.isArray(parsed) ? parsed.join('、') : (parsed.toString() || '');
                            }
                        } catch(e) { eligibility = g.eligibility_requirements || ''; }
                        try {
                            if (g.target_expenses) {
                                const parsed = typeof g.target_expenses === 'string' ? 
                                    JSON.parse(g.target_expenses) : g.target_expenses;
                                expenses = Array.isArray(parsed) ? parsed.join('、') : (parsed.toString() || '');
                            }
                        } catch(e) { expenses = g.target_expenses || ''; }
                        
                        const hasDetails = eligibility || expenses || g.min_amount;
                        
                        html += \`
                            <div class="p-4 hover:bg-gray-50 transition-colors">
                                <div class="flex flex-wrap items-start justify-between gap-4">
                                    <div class="flex-1 min-w-[200px]">
                                        <div class="flex items-center gap-2 mb-2">
                                            <span class="font-bold">\${g.fiscal_year || '-'}</span>
                                            \${g.version ? \`<span class="text-gray-500">\${g.version}</span>\` : ''}
                                            <span class="px-2 py-0.5 rounded text-xs \${g.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">\${g.status === 'active' ? '公募中' : '終了'}</span>
                                            \${hasDetails ? \`<button onclick="toggleDetails(\${g.id})" class="text-indigo-600 hover:text-indigo-800 text-xs ml-2"><i class="fas fa-chevron-down" id="detailIcon\${g.id}"></i> 詳細</button>\` : ''}
                                        </div>
                                        <div class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                                            <div>
                                                <span class="text-gray-500">補助率:</span>
                                                <span class="ml-1 font-medium">\${g.subsidy_rate || '-'}</span>
                                            </div>
                                            <div>
                                                <span class="text-gray-500">上限額:</span>
                                                <span class="ml-1 font-medium">\${g.max_amount ? (g.max_amount / 10000).toLocaleString() + '万円' : '-'}</span>
                                            </div>
                                            <div>
                                                <span class="text-gray-500">申請期限:</span>
                                                <span class="ml-1 \${deadlineStatus.class}">\${g.application_end_date || '-'} \${deadlineStatus.text}</span>
                                            </div>
                                            <div>
                                                <span class="text-gray-500">開始:</span>
                                                <span class="ml-1">\${g.application_start_date || '-'}</span>
                                            </div>
                                        </div>
                                        \${g.source_url ? \`
                                            <div class="mt-2">
                                                <a href="\${g.source_url}" target="_blank" class="text-blue-600 hover:underline text-sm">
                                                    <i class="fas fa-external-link-alt mr-1"></i>公式サイト
                                                </a>
                                                \${g.pdf_url ? \`
                                                    <a href="\${g.pdf_url}" target="_blank" class="text-blue-600 hover:underline text-sm ml-4">
                                                        <i class="fas fa-file-pdf mr-1"></i>公募要領PDF
                                                    </a>
                                                \` : ''}
                                            </div>
                                        \` : ''}
                                        
                                        <!-- 詳細展開セクション -->
                                        <div id="details\${g.id}" class="hidden mt-4 pt-4 border-t border-gray-200">
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                \${g.min_amount ? \`
                                                    <div class="bg-blue-50 rounded-lg p-3">
                                                        <h4 class="font-bold text-blue-800 mb-2"><i class="fas fa-yen-sign mr-1"></i>補助金額</h4>
                                                        <div class="space-y-1">
                                                            <div><span class="text-gray-600">上限:</span> <span class="font-medium">\${g.max_amount ? (g.max_amount / 10000).toLocaleString() + '万円' : '-'}</span></div>
                                                            <div><span class="text-gray-600">下限:</span> <span class="font-medium">\${g.min_amount ? (g.min_amount / 10000).toLocaleString() + '万円' : '-'}</span></div>
                                                            <div><span class="text-gray-600">補助率:</span> <span class="font-medium">\${g.subsidy_rate || '-'}</span></div>
                                                        </div>
                                                    </div>
                                                \` : ''}
                                                \${eligibility ? \`
                                                    <div class="bg-green-50 rounded-lg p-3">
                                                        <h4 class="font-bold text-green-800 mb-2"><i class="fas fa-user-check mr-1"></i>対象者・要件</h4>
                                                        <p class="text-gray-700 whitespace-pre-wrap">\${eligibility}</p>
                                                    </div>
                                                \` : ''}
                                                \${expenses ? \`
                                                    <div class="bg-purple-50 rounded-lg p-3 md:col-span-2">
                                                        <h4 class="font-bold text-purple-800 mb-2"><i class="fas fa-receipt mr-1"></i>対象経費</h4>
                                                        <p class="text-gray-700 whitespace-pre-wrap">\${expenses}</p>
                                                    </div>
                                                \` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-xs text-gray-400 flex items-center">
                                            <i class="fas fa-lock mr-1"></i>閲覧専用
                                        </span>
                                    </div>
                                </div>
                            </div>
                        \`;
                    });
                    
                    html += \`
                            </div>
                        </div>
                    \`;
                });
                
                container.innerHTML = html;
                
                // サマリー更新
                updateSummary();
            }
            
            // サマリー更新
            function updateSummary() {
                const activeGuidelines = allGuidelines.filter(g => g.status === 'active');
                const deadlineWithin30 = activeGuidelines.filter(g => {
                    if (!g.application_end_date) return false;
                    const days = Math.ceil((new Date(g.application_end_date) - new Date()) / (1000*60*60*24));
                    return days >= 0 && days <= 30;
                });
                const totalMaxAmount = activeGuidelines.reduce((sum, g) => sum + (g.max_amount || 0), 0);
                const uniqueSubsidyTypes = new Set(allGuidelines.map(g => g.subsidy_type_id)).size;
                
                // 全体サマリー
                document.getElementById('summaryActiveCount').textContent = activeGuidelines.length + '件';
                document.getElementById('summaryDeadlineCount').textContent = deadlineWithin30.length + '件';
                document.getElementById('summaryTotalAmount').textContent = (totalMaxAmount / 100000000).toFixed(1) + '億円';
                document.getElementById('summarySubsidyTypes').textContent = uniqueSubsidyTypes + '種類';
                
                // 管轄別サマリー
                const getGuidelinesByCategory = (category) => {
                    return activeGuidelines.filter(g => {
                        const subsidy = subsidyTypes.find(s => s.id == g.subsidy_type_id);
                        return subsidy?.category === category;
                    });
                };
                
                const getDeadlineCount = (guidelines) => {
                    return guidelines.filter(g => {
                        if (!g.application_end_date) return false;
                        const days = Math.ceil((new Date(g.application_end_date) - new Date()) / (1000*60*60*24));
                        return days >= 0 && days <= 30;
                    }).length;
                };
                
                const formatAmount = (amount) => {
                    if (amount >= 100000000) return (amount / 100000000).toFixed(1) + '億円';
                    if (amount >= 10000) return (amount / 10000).toLocaleString() + '万円';
                    return amount.toLocaleString() + '円';
                };
                
                // 行政書士管轄
                const gyoseishoshi = getGuidelinesByCategory('行政書士管轄');
                const gyoseishoshiAmount = gyoseishoshi.reduce((sum, g) => sum + (g.max_amount || 0), 0);
                document.getElementById('summaryGyoseishoshiActive').textContent = gyoseishoshi.length + '件';
                document.getElementById('summaryGyoseishoshiDeadline').textContent = getDeadlineCount(gyoseishoshi) + '件';
                document.getElementById('summaryGyoseishoshiAmount').textContent = formatAmount(gyoseishoshiAmount);
                
                // 社労士管轄
                const sharoshi = getGuidelinesByCategory('社労士管轄');
                const sharoshiAmount = sharoshi.reduce((sum, g) => sum + (g.max_amount || 0), 0);
                document.getElementById('summarySharoshiActive').textContent = sharoshi.length + '件';
                document.getElementById('summarySharoshiDeadline').textContent = getDeadlineCount(sharoshi) + '件';
                document.getElementById('summarySharoshiAmount').textContent = formatAmount(sharoshiAmount);
            }
            
            // 詳細展開トグル
            function toggleDetails(id) {
                const details = document.getElementById('details' + id);
                const icon = document.getElementById('detailIcon' + id);
                if (details.classList.contains('hidden')) {
                    details.classList.remove('hidden');
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                } else {
                    details.classList.add('hidden');
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            }
            
            // カレンダー関連
            function changeCalendarMonth(delta) {
                currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + delta);
                renderCalendarTimeline();
            }
            
            function renderCalendarTimeline() {
                const container = document.getElementById('calendarTimeline');
                const deadlinesContainer = document.getElementById('upcomingDeadlines');
                const monthLabel = document.getElementById('calendarMonthLabel');
                const categoryFilter = document.getElementById('calendarCategoryFilter')?.value || 'all';
                
                const year = currentCalendarMonth.getFullYear();
                const month = currentCalendarMonth.getMonth();
                monthLabel.textContent = \`\${year}年\${month + 1}月\`;
                
                let activeGuidelines = allGuidelines.filter(g => g.status === 'active');
                
                // 管轄フィルター適用
                if (categoryFilter !== 'all') {
                    activeGuidelines = activeGuidelines.filter(g => {
                        const subsidy = subsidyTypes.find(s => s.id == g.subsidy_type_id);
                        return subsidy?.category === categoryFilter;
                    });
                }
                
                // 同じ補助金種別の重複を排除（最新の公募要領のみ表示）
                const seenSubsidyTypes = new Set();
                activeGuidelines = activeGuidelines.filter(g => {
                    if (seenSubsidyTypes.has(g.subsidy_type_id)) return false;
                    seenSubsidyTypes.add(g.subsidy_type_id);
                    return true;
                });
                
                const today = new Date();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                
                // タイムライン表示
                let timelineHtml = '<div class="space-y-4">';
                
                activeGuidelines.forEach(g => {
                    const subsidy = subsidyTypes.find(s => s.id == g.subsidy_type_id) || { name: g.subsidy_name || '不明' };
                    const startDate = g.application_start_date ? new Date(g.application_start_date) : null;
                    const endDate = g.application_end_date ? new Date(g.application_end_date) : null;
                    
                    if (!endDate) return;
                    
                    const daysRemaining = Math.ceil((endDate - today) / (1000*60*60*24));
                    let barColor = 'bg-green-500';
                    if (daysRemaining < 0) barColor = 'bg-gray-300';
                    else if (daysRemaining <= 7) barColor = 'bg-red-500';
                    else if (daysRemaining <= 30) barColor = 'bg-yellow-500';
                    
                    // 月内の表示位置計算
                    const monthStart = new Date(year, month, 1);
                    const monthEnd = new Date(year, month + 1, 0);
                    
                    const displayStart = startDate && startDate > monthStart ? startDate : monthStart;
                    const displayEnd = endDate < monthEnd ? endDate : monthEnd;
                    
                    if (displayEnd < monthStart || displayStart > monthEnd) return; // 月外はスキップ
                    
                    const startPercent = Math.max(0, ((displayStart - monthStart) / (monthEnd - monthStart)) * 100);
                    const endPercent = Math.min(100, ((displayEnd - monthStart) / (monthEnd - monthStart)) * 100);
                    const width = Math.max(2, endPercent - startPercent);
                    
                    timelineHtml += \`
                        <div class="flex items-center gap-4">
                            <div class="w-48 text-sm truncate font-medium">\${subsidy.name}</div>
                            <div class="flex-1 relative h-8 bg-gray-100 rounded overflow-hidden">
                                <div class="\${barColor} h-full rounded" style="margin-left: \${startPercent}%; width: \${width}%;">
                                </div>
                                <div class="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                    \${g.application_end_date ? \`〜\${g.application_end_date}\` : ''}
                                </div>
                            </div>
                            <div class="w-24 text-sm text-right \${daysRemaining <= 7 ? 'text-red-600 font-bold' : daysRemaining <= 30 ? 'text-orange-600' : 'text-gray-600'}">
                                \${daysRemaining >= 0 ? '残' + daysRemaining + '日' : '終了'}
                            </div>
                        </div>
                    \`;
                });
                
                timelineHtml += '</div>';
                
                // 日付目盛り
                const scaleHtml = \`
                    <div class="flex items-center gap-4 mt-4 pt-4 border-t">
                        <div class="w-48"></div>
                        <div class="flex-1 flex justify-between text-xs text-gray-400">
                            <span>1日</span>
                            <span>10日</span>
                            <span>20日</span>
                            <span>\${daysInMonth}日</span>
                        </div>
                        <div class="w-24"></div>
                    </div>
                \`;
                
                container.innerHTML = timelineHtml + scaleHtml;
                
                // 締切間近リスト
                const within30 = activeGuidelines
                    .filter(g => {
                        if (!g.application_end_date) return false;
                        const days = Math.ceil((new Date(g.application_end_date) - today) / (1000*60*60*24));
                        return days >= 0 && days <= 30;
                    })
                    .sort((a, b) => new Date(a.application_end_date) - new Date(b.application_end_date));
                
                if (within30.length === 0) {
                    deadlinesContainer.innerHTML = '<div class="p-4 text-center text-gray-500">締切間近の公募はありません</div>';
                } else {
                    deadlinesContainer.innerHTML = within30.map(g => {
                        const subsidy = subsidyTypes.find(s => s.id == g.subsidy_type_id) || { name: g.subsidy_name || '不明' };
                        const days = Math.ceil((new Date(g.application_end_date) - today) / (1000*60*60*24));
                        return \`
                            <div class="p-4 flex items-center justify-between hover:bg-gray-50">
                                <div>
                                    <div class="font-medium">\${subsidy.name}</div>
                                    <div class="text-sm text-gray-500">\${g.fiscal_year || ''} \${g.version || ''}</div>
                                </div>
                                <div class="text-right">
                                    <div class="\${days <= 7 ? 'text-red-600 font-bold' : 'text-orange-600'}">\${g.application_end_date}</div>
                                    <div class="text-sm \${days <= 7 ? 'text-red-500' : 'text-gray-500'}">残り\${days}日</div>
                                </div>
                            </div>
                        \`;
                    }).join('');
                }
            }
            
            // 比較機能
            function renderCompareSelection() {
                const container = document.getElementById('compareSelection');
                const categoryFilter = document.getElementById('compareCategoryFilter')?.value || 'all';
                
                let activeGuidelines = allGuidelines.filter(g => g.status === 'active');
                
                // 管轄フィルター適用
                if (categoryFilter !== 'all') {
                    activeGuidelines = activeGuidelines.filter(g => {
                        const subsidy = subsidyTypes.find(s => s.id == g.subsidy_type_id);
                        return subsidy?.category === categoryFilter;
                    });
                }
                
                // 同じ補助金種別の重複を排除（最新の公募要領のみ表示）
                const seenSubsidyTypesCompare = new Set();
                activeGuidelines = activeGuidelines.filter(g => {
                    if (seenSubsidyTypesCompare.has(g.subsidy_type_id)) return false;
                    seenSubsidyTypesCompare.add(g.subsidy_type_id);
                    return true;
                });
                
                const html = activeGuidelines.map(g => {
                    const subsidy = subsidyTypes.find(s => s.id == g.subsidy_type_id) || { name: g.subsidy_name || '不明' };
                    const isSelected = selectedForCompare.includes(g.id);
                    const categoryBadge = subsidy.category === '行政書士管轄' ? 'bg-emerald-100 text-emerald-800' : 
                                         subsidy.category === '社労士管轄' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
                    return \`
                        <button onclick="toggleCompareSelection(\${g.id})" 
                                class="px-3 py-2 rounded-lg text-sm transition-colors \${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                            <i class="fas fa-\${isSelected ? 'check-circle' : 'circle'} mr-1"></i>
                            \${subsidy.name} \${g.fiscal_year || ''}
                            <span class="ml-1 px-1 py-0.5 rounded text-xs \${isSelected ? 'bg-white/20' : categoryBadge}">\${subsidy.category || ''}</span>
                        </button>
                    \`;
                }).join('');
                
                container.innerHTML = html || '<div class="text-gray-500">比較可能な公募要領がありません</div>';
                
                renderCompareTable();
            }
            
            function toggleCompareSelection(id) {
                const idx = selectedForCompare.indexOf(id);
                if (idx > -1) {
                    selectedForCompare.splice(idx, 1);
                } else if (selectedForCompare.length < 3) {
                    selectedForCompare.push(id);
                } else {
                    showToast('比較は最大3つまでです', 'error');
                    return;
                }
                renderCompareSelection();
            }
            
            function renderCompareTable() {
                const headers = document.getElementById('compareHeaders');
                const body = document.getElementById('compareBody');
                
                if (selectedForCompare.length === 0) {
                    headers.innerHTML = '<th class="px-4 py-3 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-[150px]">項目</th>';
                    body.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">比較する補助金を選択してください</td></tr>';
                    return;
                }
                
                const selected = selectedForCompare.map(id => allGuidelines.find(g => g.id === id)).filter(Boolean);
                
                // ヘッダー
                let headerHtml = '<th class="px-4 py-3 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-[150px]">項目</th>';
                selected.forEach(g => {
                    const subsidy = subsidyTypes.find(s => s.id == g.subsidy_type_id) || { name: g.subsidy_name || '不明' };
                    headerHtml += \`<th class="px-4 py-3 text-left font-medium min-w-[200px]">\${subsidy.name}<br><span class="text-xs text-gray-500">\${g.fiscal_year || ''} \${g.version || ''}</span></th>\`;
                });
                headers.innerHTML = headerHtml;
                
                // 比較項目
                const compareItems = [
                    { label: 'ステータス', key: 'status', format: v => v === 'active' ? '<span class="text-green-600">公募中</span>' : '<span class="text-gray-500">終了</span>' },
                    { label: '補助率', key: 'subsidy_rate', format: v => v || '-' },
                    { label: '上限額', key: 'max_amount', format: v => v ? (v / 10000).toLocaleString() + '万円' : '-' },
                    { label: '下限額', key: 'min_amount', format: v => v ? (v / 10000).toLocaleString() + '万円' : '-' },
                    { label: '申請開始日', key: 'application_start_date', format: v => v || '-' },
                    { label: '申請締切日', key: 'application_end_date', format: v => v || '-' },
                    { label: '対象者・要件', key: 'eligibility_requirements', format: v => {
                        try { 
                            const p = typeof v === 'string' ? JSON.parse(v) : v;
                            return Array.isArray(p) ? p.join('、') : (p || '-');
                        } catch { return v || '-'; }
                    }},
                    { label: '対象経費', key: 'target_expenses', format: v => {
                        try {
                            const p = typeof v === 'string' ? JSON.parse(v) : v;
                            return Array.isArray(p) ? p.join('、') : (p || '-');
                        } catch { return v || '-'; }
                    }},
                    { label: '公式サイト', key: 'source_url', format: v => v ? \`<a href="\${v}" target="_blank" class="text-blue-600 hover:underline"><i class="fas fa-external-link-alt mr-1"></i>リンク</a>\` : '-' },
                ];
                
                let bodyHtml = '';
                compareItems.forEach(item => {
                    bodyHtml += '<tr class="border-b hover:bg-gray-50">';
                    bodyHtml += \`<td class="px-4 py-3 font-medium text-gray-700 sticky left-0 bg-white">\${item.label}</td>\`;
                    selected.forEach(g => {
                        bodyHtml += \`<td class="px-4 py-3 text-sm">\${item.format(g[item.key])}</td>\`;
                    });
                    bodyHtml += '</tr>';
                });
                
                body.innerHTML = bodyHtml;
            }

            // 通知
            async function loadUnreadCount() {
                const response = await axios.get('/api/admin/notifications/unread-count');
                const count = response.data.count;
                const badge = document.getElementById('unreadCount');
                if (count > 0) {
                    badge.textContent = count;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }

            let currentNotificationFilter = null;
            
            // グローバルに公開（ダッシュボードから呼び出せるように）
            window.showNotificationsWithFilter = showNotificationsInternal;
            
            async function showNotifications(filterType = null) {
                await showNotificationsInternal(filterType);
            }
            
            async function showNotificationsInternal(filterType = null) {
                document.getElementById('notificationsModal').classList.remove('hidden');
                currentNotificationFilter = filterType;
                
                const response = await axios.get('/api/admin/notifications?unread_only=true');
                let notifications = response.data;
                
                // フィルタリング
                if (filterType) {
                    notifications = notifications.filter(n => n.notification_type === filterType);
                }
                
                const container = document.getElementById('notificationsList');
                
                // フィルターボタンを追加
                const filterHtml = \`
                    <div class="flex flex-wrap gap-2 mb-4 pb-3 border-b">
                        <button onclick="showNotifications()" class="px-3 py-1 text-xs rounded-full \${!filterType ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">すべて</button>
                        <button onclick="showNotifications('new_message')" class="px-3 py-1 text-xs rounded-full \${filterType === 'new_message' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                            <i class="fas fa-envelope mr-1"></i>メッセージ
                        </button>
                        <button onclick="showNotifications('document_upload')" class="px-3 py-1 text-xs rounded-full \${filterType === 'document_upload' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                            <i class="fas fa-file-upload mr-1"></i>書類
                        </button>
                        <button onclick="showNotifications('payment_report')" class="px-3 py-1 text-xs rounded-full \${filterType === 'payment_report' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                            <i class="fas fa-yen-sign mr-1"></i>入金
                        </button>
                        \${notifications.length > 0 ? \`<button onclick="markAllAsRead('\${filterType || ''}')" class="ml-auto px-3 py-1 text-xs rounded-full bg-gray-600 text-white hover:bg-gray-700">すべて既読にする</button>\` : ''}
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
                    switch(n.related_table) {
                        case 'invoices':
                            return '/admin/payments';
                        case 'cases':
                            return '/case/' + n.related_id;
                        case 'clients':
                            return '/client/' + n.related_id;
                        case 'documents':
                            return '/documents?id=' + n.related_id;
                        default:
                            return '/cases';
                    }
                };
                
                container.innerHTML = filterHtml + notifications.map(n => \`
                    <div class="border rounded-lg p-3 \${n.is_read ? 'bg-gray-50 border-gray-200' : getTypeColor(n.notification_type)}">
                        <div class="flex justify-between items-start">
                            <div class="flex items-center gap-2">
                                \${getTypeIcon(n.notification_type)}
                                <h4 class="font-medium text-sm">\${n.title}</h4>
                            </div>
                            <div class="flex items-center gap-2">
                                \${n.related_id ? \`<a href="\${getNotificationUrl(n)}" onclick="markAsRead(\${n.id})" class="text-xs text-blue-600 hover:underline">詳細</a>\` : ''}
                                \${!n.is_read ? \`<button onclick="markAsRead(\${n.id})" class="text-xs text-gray-600 hover:underline">既読</button>\` : ''}
                            </div>
                        </div>
                        <p class="text-xs text-gray-600 mt-1 whitespace-pre-wrap">\${n.message}</p>
                        <div class="text-xs text-gray-400 mt-2">\${new Date(n.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</div>
                    </div>
                \`).join('');
            }
            
            async function markAllAsRead(filterType) {
                try {
                    await axios.put('/api/admin/notifications/read-all', {
                        notification_type: filterType || null,
                        read_by: localStorage.getItem('admin_name') || 'admin'
                    });
                    showNotifications(currentNotificationFilter);
                    loadUnreadCount();
                    if (typeof loadNotificationSummary === 'function') {
                        loadNotificationSummary();
                    }
                } catch (error) {
                    console.error('Error marking all as read:', error);
                }
            }

            function closeNotificationsModal() {
                document.getElementById('notificationsModal').classList.add('hidden');
            }

            async function markAsRead(id) {
                await axios.put(\`/api/admin/notifications/\${id}/read\`, {
                    read_by: localStorage.getItem('admin_name') || 'admin'
                });
                showNotifications(currentNotificationFilter);
                loadUnreadCount();
                if (typeof loadNotificationSummary === 'function') {
                    loadNotificationSummary();
                }
            }

            // 更新チェック実行
            async function checkUpdatesNow() {
                showToast('更新チェックを開始しています...', 'info');
                try {
                    const response = await axios.post('/api/subsidy-check-updates');
                    const result = response.data;
                    
                    const changes = result.results.filter(r => r.change_detected).length;
                    if (changes > 0) {
                        showToast(\`\${changes}件の更新が検知されました！\`, 'success');
                    } else {
                        showToast('更新はありませんでした', 'success');
                    }
                    
                    loadWatchUrls();
                    loadUpdateLogs();
                    loadUnreadCount();
                } catch (error) {
                    showToast('チェックに失敗しました: ' + error.message, 'error');
                }
            }

            // 監視URL追加
            function openAddUrlModal() {
                document.getElementById('addUrlModal').classList.remove('hidden');
            }
            function closeAddUrlModal() {
                document.getElementById('addUrlModal').classList.add('hidden');
                document.getElementById('addUrlForm').reset();
            }

            document.getElementById('addUrlForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                try {
                    await axios.post('/api/subsidy-watch-urls', data);
                    showToast('監視URLを追加しました');
                    closeAddUrlModal();
                    loadWatchUrls();
                } catch (error) {
                    showToast('追加に失敗しました', 'error');
                }
            });

            async function deleteWatchUrl(id) {
                if (!confirm('この監視URLを削除しますか？')) return;
                await axios.delete(\`/api/subsidy-watch-urls/\${id}\`);
                showToast('削除しました');
                loadWatchUrls();
            }

            // 更新ログステータス更新
            async function updateLogStatus(id, status) {
                await axios.put(\`/api/subsidy-update-logs/\${id}\`, {
                    status,
                    reviewed_by: localStorage.getItem('admin_name') || 'admin'
                });
                showToast('ステータスを更新しました');
            }

            // 公募要領追加
            function openAddGuidelineModal() {
                document.getElementById('addGuidelineModal').classList.remove('hidden');
            }
            function openAddGuidelineModalFor(subsidyTypeId) {
                document.getElementById('addGuidelineSubsidyType').value = subsidyTypeId;
                document.getElementById('addGuidelineModal').classList.remove('hidden');
            }
            function closeAddGuidelineModal() {
                document.getElementById('addGuidelineModal').classList.add('hidden');
                document.getElementById('addGuidelineForm').reset();
            }

            document.getElementById('addGuidelineForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                // 金額を円に変換
                if (data.max_amount) data.max_amount = parseInt(data.max_amount) * 10000;
                if (data.min_amount) data.min_amount = parseInt(data.min_amount) * 10000;
                
                try {
                    await axios.post('/api/subsidy-guidelines', data);
                    showToast('公募要領を追加しました');
                    closeAddGuidelineModal();
                    loadGuidelines();
                } catch (error) {
                    showToast('追加に失敗しました', 'error');
                }
            });
            
            // 公募要領編集
            function openEditGuidelineModal(g) {
                document.getElementById('editGuidelineId').value = g.id;
                document.getElementById('editGuidelineSubsidyName').value = g.subsidy_name || '-';
                document.getElementById('editGuidelineFiscalYear').value = g.fiscal_year || '';
                document.getElementById('editGuidelineVersion').value = g.version || '';
                document.getElementById('editGuidelineStartDate').value = g.application_start_date || '';
                document.getElementById('editGuidelineEndDate').value = g.application_end_date || '';
                document.getElementById('editGuidelineMaxAmount').value = g.max_amount ? g.max_amount / 10000 : '';
                document.getElementById('editGuidelineMinAmount').value = g.min_amount ? g.min_amount / 10000 : '';
                document.getElementById('editGuidelineSubsidyRate').value = g.subsidy_rate || '';
                document.getElementById('editGuidelineSourceUrl').value = g.source_url || '';
                document.getElementById('editGuidelinePdfUrl').value = g.pdf_url || '';
                document.getElementById('editGuidelineStatus').value = g.status || 'active';
                
                // 対象者・要件と対象経費
                let eligibility = '';
                let expenses = '';
                try {
                    if (g.eligibility_requirements) {
                        const parsed = typeof g.eligibility_requirements === 'string' ? JSON.parse(g.eligibility_requirements) : g.eligibility_requirements;
                        eligibility = Array.isArray(parsed) ? parsed.join('、') : (parsed.toString() || '');
                    }
                } catch { eligibility = g.eligibility_requirements || ''; }
                try {
                    if (g.target_expenses) {
                        const parsed = typeof g.target_expenses === 'string' ? JSON.parse(g.target_expenses) : g.target_expenses;
                        expenses = Array.isArray(parsed) ? parsed.join('、') : (parsed.toString() || '');
                    }
                } catch { expenses = g.target_expenses || ''; }
                document.getElementById('editGuidelineEligibility').value = eligibility;
                document.getElementById('editGuidelineExpenses').value = expenses;
                
                document.getElementById('editGuidelineModal').classList.remove('hidden');
            }
            function closeEditGuidelineModal() {
                document.getElementById('editGuidelineModal').classList.add('hidden');
                document.getElementById('editGuidelineForm').reset();
            }

            document.getElementById('editGuidelineForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                const id = data.id;
                delete data.id;
                
                // 金額を円に変換
                if (data.max_amount) data.max_amount = parseInt(data.max_amount) * 10000;
                if (data.min_amount) data.min_amount = parseInt(data.min_amount) * 10000;
                
                try {
                    await axios.put(\`/api/subsidy-guidelines/\${id}\`, data);
                    showToast('公募要領を更新しました');
                    closeEditGuidelineModal();
                    loadGuidelines();
                } catch (error) {
                    showToast('更新に失敗しました', 'error');
                }
            });
            
            // ステータス切り替え
            async function toggleGuidelineStatus(id, currentStatus) {
                const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
                const message = newStatus === 'active' ? '有効にしますか？' : '終了にしますか？';
                
                if (!confirm(message)) return;
                
                try {
                    await axios.patch(\`/api/subsidy-guidelines/\${id}/status\`, { status: newStatus });
                    showToast(\`ステータスを\${newStatus === 'active' ? '有効' : '終了'}に変更しました\`);
                    loadGuidelines();
                } catch (error) {
                    showToast('ステータス変更に失敗しました', 'error');
                }
            }
            
            // 公募要領削除
            async function deleteGuideline(id) {
                if (!confirm('この公募要領を削除しますか？\\n※この操作は取り消せません')) return;
                
                try {
                    await axios.delete(\`/api/subsidy-guidelines/\${id}\`);
                    showToast('公募要領を削除しました');
                    loadGuidelines();
                } catch (error) {
                    showToast('削除に失敗しました', 'error');
                }
            }

            // グローバルスコープに関数を公開（onclick対応）
            window.logout = logout;
            window.switchTab = switchTab;
            window.showNotifications = showNotifications;
            window.closeNotificationsModal = closeNotificationsModal;
            window.markAsRead = markAsRead;
            window.checkUpdatesNow = checkUpdatesNow;
            window.openAddUrlModal = openAddUrlModal;
            window.closeAddUrlModal = closeAddUrlModal;
            window.deleteWatchUrl = deleteWatchUrl;
            window.openAddGuidelineModal = openAddGuidelineModal;
            window.openAddGuidelineModalFor = openAddGuidelineModalFor;
            window.closeAddGuidelineModal = closeAddGuidelineModal;
            window.openEditGuidelineModal = openEditGuidelineModal;
            window.closeEditGuidelineModal = closeEditGuidelineModal;
            window.toggleGuidelineStatus = toggleGuidelineStatus;
            window.deleteGuideline = deleteGuideline;
            window.openAiExtractModal = openAiExtractModal;
            window.closeAiExtractModal = closeAiExtractModal;
            window.closeAiResultModal = closeAiResultModal;
            window.applyAiResult = applyAiResult;
            window.showToast = showToast;

            // 初期読み込み
            loadSubsidyTypes();
            loadWatchUrls();
            loadUpdateLogs();
            loadGuidelines();
            loadUnreadCount();
        </script>
    </body>
    </html>
  `)
})

export default routes
