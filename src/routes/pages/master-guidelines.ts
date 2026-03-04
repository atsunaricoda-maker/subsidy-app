// マスター管理 - 公募要領管理ページ
import { Hono } from 'hono'
import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'
import type { AppEnv } from '../../types'

const routes = new Hono<AppEnv>()

routes.get('/master/guidelines', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>公募要領管理 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            .sidebar-link.active {
                background: rgba(59, 130, 246, 0.3);
                border-left: 3px solid #3B82F6;
            }
            .sidebar-link:hover {
                background: rgba(255,255,255,0.1);
            }
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateMasterSidebar('guidelines')}
            
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-book-open mr-2 text-indigo-600"></i>公募要領管理
                            </h2>
                        </div>
                        <div class="text-sm text-gray-500">
                            <i class="fas fa-info-circle mr-1"></i>
                            全法人に反映されます
                        </div>
                    </div>
                </header>

                <div class="p-4 lg:p-6">
                    <!-- 注意書き -->
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <div class="flex items-start gap-3">
                            <div class="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <i class="fas fa-exclamation-triangle text-yellow-600"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-yellow-800">マスターデータ編集</h3>
                                <p class="text-sm text-yellow-700 mt-1">
                                    ここで編集した公募要領情報は、すべての法人組織に即座に反映されます。<br>
                                    各法人の管理画面では閲覧のみ可能で、編集はこのマスター管理画面からのみ行えます。
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
                            <button onclick="switchTab('guidelines')" id="tab-guidelines" 
                                    class="px-6 py-3 font-medium text-indigo-600 border-b-2 border-indigo-600 whitespace-nowrap">
                                <i class="fas fa-file-alt mr-2"></i>公募要領一覧
                            </button>
                            <button onclick="switchTab('watch')" id="tab-watch" 
                                    class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                                <i class="fas fa-eye mr-2"></i>監視URL
                            </button>
                            <button onclick="switchTab('updates')" id="tab-updates" 
                                    class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                                <i class="fas fa-sync mr-2"></i>更新履歴
                            </button>
                            <button onclick="switchTab('calendar')" id="tab-calendar" 
                                    class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap">
                                <i class="fas fa-calendar-alt mr-2"></i>スケジュール
                            </button>
                        </div>
                    </div>

                    <!-- 公募要領一覧タブ -->
                    <div id="content-guidelines" class="space-y-6">
                        <!-- AI自動更新セクション -->
                        <div class="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                            <div class="flex flex-wrap items-center justify-between gap-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                                        <i class="fas fa-robot text-white"></i>
                                    </div>
                                    <div>
                                        <h3 class="font-bold text-purple-900">AI自動更新</h3>
                                        <p class="text-sm text-purple-700">公式サイトからAIが最新情報を自動抽出します</p>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <select id="aiExtractSubsidy" class="px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white">
                                        <option value="">補助金を選択</option>
                                    </select>
                                    <button onclick="openAiExtractModal()" 
                                            class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2">
                                        <i class="fas fa-magic"></i>
                                        <span>AIで情報取得</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex flex-wrap justify-between items-center gap-4">
                            <div>
                                <h2 class="text-lg font-bold">公募要領詳細</h2>
                                <p class="text-sm text-gray-500">補助金・助成金ごとに公募情報を管理します</p>
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
                                <button onclick="openAddGuidelineModal()" 
                                        class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                                    <i class="fas fa-plus mr-2"></i>新規追加
                                </button>
                            </div>
                        </div>
                        <div id="guidelinesList" class="space-y-8">
                            <div class="text-center py-8 text-gray-500">読み込み中...</div>
                        </div>
                    </div>

                    <!-- 監視URLタブ -->
                    <div id="content-watch" class="hidden space-y-6">
                        <div class="flex justify-between items-center">
                            <h2 class="text-lg font-bold">監視URL一覧</h2>
                            <div class="flex gap-2">
                                <button onclick="checkUpdatesNow()" 
                                        class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                                    <i class="fas fa-sync mr-2"></i>今すぐチェック
                                </button>
                                <button onclick="openAddUrlModal()" 
                                        class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                                    <i class="fas fa-plus mr-2"></i>URL追加
                                </button>
                            </div>
                        </div>
                        <div class="bg-white rounded-lg shadow overflow-hidden">
                            <table class="w-full text-sm">
                                <thead class="bg-gray-50 border-b">
                                    <tr>
                                        <th class="px-4 py-3 text-left">補助金</th>
                                        <th class="px-4 py-3 text-left">URL</th>
                                        <th class="px-4 py-3 text-left">最終チェック</th>
                                        <th class="px-4 py-3 text-left">操作</th>
                                    </tr>
                                </thead>
                                <tbody id="watchUrlsList" class="divide-y">
                                    <tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">読み込み中...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- 更新履歴タブ -->
                    <div id="content-updates" class="hidden space-y-6">
                        <h2 class="text-lg font-bold">更新検知履歴</h2>
                        <div class="bg-white rounded-lg shadow overflow-hidden">
                            <table class="w-full text-sm">
                                <thead class="bg-gray-50 border-b">
                                    <tr>
                                        <th class="px-4 py-3 text-left">検知日時</th>
                                        <th class="px-4 py-3 text-left">補助金</th>
                                        <th class="px-4 py-3 text-left">変更種別</th>
                                        <th class="px-4 py-3 text-left">ステータス</th>
                                        <th class="px-4 py-3 text-left">操作</th>
                                    </tr>
                                </thead>
                                <tbody id="updateLogsList" class="divide-y">
                                    <tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">読み込み中...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- スケジュールタブ -->
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
                </div>
            </main>
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
            ${masterSidebarScripts}
            
            const token = localStorage.getItem('master_token');
            const axiosConfig = { headers: { 'Authorization': 'Bearer ' + token } };
            
            let subsidyTypes = [];
            let allGuidelines = [];
            let currentCalendarMonth = new Date();
            let currentAiResult = null;

            // タブ切り替え
            function switchTab(tab) {
                ['guidelines', 'watch', 'updates', 'calendar'].forEach(t => {
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
                
                if (tab === 'calendar') renderCalendarTimeline();
            }

            // トースト
            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                toast.className = \`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 \${type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white\`;
                toast.innerHTML = \`<i class="fas fa-\${type === 'success' ? 'check' : 'exclamation'}-circle mr-2"></i>\${message}\`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }

            // 補助金種別読み込み
            async function loadSubsidyTypes() {
                const response = await axios.get('/api/master/subsidy-types', axiosConfig);
                subsidyTypes = response.data;
                
                const options = '<option value="">選択してください</option>' + 
                    subsidyTypes.map(s => \`<option value="\${s.id}">\${s.name}</option>\`).join('');
                document.getElementById('addUrlSubsidyType').innerHTML = options;
                document.getElementById('addGuidelineSubsidyType').innerHTML = options;
                document.getElementById('aiExtractSubsidy').innerHTML = '<option value="">補助金を選択</option>' + 
                    subsidyTypes.map(s => \`<option value="\${s.id}">\${s.name}</option>\`).join('');
                document.getElementById('aiExtractSubsidyType').innerHTML = options;
            }

            // 公募要領一覧
            async function loadGuidelines() {
                const response = await axios.get('/api/master/subsidy-guidelines', axiosConfig);
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
                        const subsidy = subsidyTypes.find(s => s.id == key);
                        subsidyInfo[key] = subsidy || { name: g.subsidy_name, category: '不明' };
                    }
                    grouped[key].push(g);
                });
                
                const getCategoryColor = (category) => {
                    if (category === '行政書士管轄') return { bg: 'bg-emerald-50', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-800', icon: 'fas fa-file-signature' };
                    if (category === '社労士管轄') return { bg: 'bg-blue-50', border: 'border-blue-500', badge: 'bg-blue-100 text-blue-800', icon: 'fas fa-users' };
                    return { bg: 'bg-gray-50', border: 'border-gray-500', badge: 'bg-gray-100 text-gray-800', icon: 'fas fa-folder' };
                };
                
                const getDaysRemaining = (endDate) => {
                    if (!endDate) return null;
                    const today = new Date();
                    const end = new Date(endDate);
                    return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
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
                        
                        html += \`
                            <div class="p-4 hover:bg-gray-50 transition-colors">
                                <div class="flex flex-wrap items-start justify-between gap-4">
                                    <div class="flex-1 min-w-[200px]">
                                        <div class="flex items-center gap-2 mb-2">
                                            <span class="font-bold">\${g.fiscal_year || '-'}</span>
                                            \${g.version ? \`<span class="text-gray-500">\${g.version}</span>\` : ''}
                                            <span class="px-2 py-0.5 rounded text-xs \${g.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">\${g.status === 'active' ? '公募中' : '終了'}</span>
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
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button onclick="toggleGuidelineStatus(\${g.id}, '\${g.status}')" 
                                                class="px-3 py-1 rounded text-sm \${g.status === 'active' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}"
                                                title="\${g.status === 'active' ? '終了にする' : '有効にする'}">
                                            <i class="fas fa-\${g.status === 'active' ? 'pause' : 'play'} mr-1"></i>
                                            \${g.status === 'active' ? '終了' : '有効化'}
                                        </button>
                                        <button onclick='openEditGuidelineModal(\${JSON.stringify(g).replace(/'/g, "&#39;")})' 
                                                class="px-3 py-1 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200">
                                            <i class="fas fa-edit mr-1"></i>編集
                                        </button>
                                        <button onclick="deleteGuideline(\${g.id})" 
                                                class="px-3 py-1 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200">
                                            <i class="fas fa-trash mr-1"></i>削除
                                        </button>
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
                
                document.getElementById('summaryActiveCount').textContent = activeGuidelines.length + '件';
                document.getElementById('summaryDeadlineCount').textContent = deadlineWithin30.length + '件';
                document.getElementById('summaryTotalAmount').textContent = (totalMaxAmount / 100000000).toFixed(1) + '億円';
                document.getElementById('summarySubsidyTypes').textContent = uniqueSubsidyTypes + '種類';
                
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
                
                const gyoseishoshi = getGuidelinesByCategory('行政書士管轄');
                const gyoseishoshiAmount = gyoseishoshi.reduce((sum, g) => sum + (g.max_amount || 0), 0);
                document.getElementById('summaryGyoseishoshiActive').textContent = gyoseishoshi.length + '件';
                document.getElementById('summaryGyoseishoshiDeadline').textContent = getDeadlineCount(gyoseishoshi) + '件';
                document.getElementById('summaryGyoseishoshiAmount').textContent = formatAmount(gyoseishoshiAmount);
                
                const sharoshi = getGuidelinesByCategory('社労士管轄');
                const sharoshiAmount = sharoshi.reduce((sum, g) => sum + (g.max_amount || 0), 0);
                document.getElementById('summarySharoshiActive').textContent = sharoshi.length + '件';
                document.getElementById('summarySharoshiDeadline').textContent = getDeadlineCount(sharoshi) + '件';
                document.getElementById('summarySharoshiAmount').textContent = formatAmount(sharoshiAmount);
            }

            // 監視URL一覧
            async function loadWatchUrls() {
                const response = await axios.get('/api/master/subsidy-watch-urls', axiosConfig);
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
                        <td class="px-4 py-3">
                            <button onclick="deleteWatchUrl(\${url.id})" class="text-red-600 hover:text-red-800">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                \`).join('');
            }

            // 更新ログ一覧
            async function loadUpdateLogs() {
                const response = await axios.get('/api/master/subsidy-update-logs', axiosConfig);
                const logs = response.data;
                
                const tbody = document.getElementById('updateLogsList');
                if (logs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">更新履歴がありません</td></tr>';
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
                        <td class="px-4 py-3">
                            <select onchange="updateLogStatus(\${log.id}, this.value)" class="text-sm border rounded px-2 py-1">
                                <option value="pending" \${log.status === 'pending' ? 'selected' : ''}>未確認</option>
                                <option value="reviewed" \${log.status === 'reviewed' ? 'selected' : ''}>確認済み</option>
                                <option value="applied" \${log.status === 'applied' ? 'selected' : ''}>対応済み</option>
                                <option value="ignored" \${log.status === 'ignored' ? 'selected' : ''}>対応不要</option>
                            </select>
                        </td>
                    </tr>
                \`).join('');
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
                
                if (categoryFilter !== 'all') {
                    activeGuidelines = activeGuidelines.filter(g => {
                        const subsidy = subsidyTypes.find(s => s.id == g.subsidy_type_id);
                        return subsidy?.category === categoryFilter;
                    });
                }
                
                const seenSubsidyTypes = new Set();
                activeGuidelines = activeGuidelines.filter(g => {
                    if (seenSubsidyTypes.has(g.subsidy_type_id)) return false;
                    seenSubsidyTypes.add(g.subsidy_type_id);
                    return true;
                });
                
                const today = new Date();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                
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
                    
                    const monthStart = new Date(year, month, 1);
                    const monthEnd = new Date(year, month + 1, 0);
                    
                    const displayStart = startDate && startDate > monthStart ? startDate : monthStart;
                    const displayEnd = endDate < monthEnd ? endDate : monthEnd;
                    
                    if (displayEnd < monthStart || displayStart > monthEnd) return;
                    
                    const startPercent = Math.max(0, ((displayStart - monthStart) / (monthEnd - monthStart)) * 100);
                    const endPercent = Math.min(100, ((displayEnd - monthStart) / (monthEnd - monthStart)) * 100);
                    const width = Math.max(2, endPercent - startPercent);
                    
                    timelineHtml += \`
                        <div class="flex items-center gap-4">
                            <div class="w-48 text-sm truncate font-medium">\${subsidy.name}</div>
                            <div class="flex-1 relative h-8 bg-gray-100 rounded overflow-hidden">
                                <div class="\${barColor} h-full rounded" style="margin-left: \${startPercent}%; width: \${width}%;"></div>
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

            // 公募要領追加モーダル
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
                
                if (data.max_amount) data.max_amount = parseInt(data.max_amount) * 10000;
                if (data.min_amount) data.min_amount = parseInt(data.min_amount) * 10000;
                
                try {
                    await axios.post('/api/master/subsidy-guidelines', data, axiosConfig);
                    showToast('公募要領を追加しました');
                    closeAddGuidelineModal();
                    loadGuidelines();
                } catch (error) {
                    showToast('追加に失敗しました', 'error');
                }
            });

            // 公募要領編集モーダル
            function openEditGuidelineModal(g) {
                document.getElementById('editGuidelineId').value = g.id;
                document.getElementById('editGuidelineSubsidyName').value = g.subsidy_name || subsidyTypes.find(s => s.id == g.subsidy_type_id)?.name || '';
                document.getElementById('editGuidelineFiscalYear').value = g.fiscal_year || '';
                document.getElementById('editGuidelineVersion').value = g.version || '';
                document.getElementById('editGuidelineStartDate').value = g.application_start_date || '';
                document.getElementById('editGuidelineEndDate').value = g.application_end_date || '';
                document.getElementById('editGuidelineMaxAmount').value = g.max_amount ? g.max_amount / 10000 : '';
                document.getElementById('editGuidelineMinAmount').value = g.min_amount ? g.min_amount / 10000 : '';
                document.getElementById('editGuidelineSubsidyRate').value = g.subsidy_rate || '';
                document.getElementById('editGuidelineEligibility').value = g.eligibility_requirements || '';
                document.getElementById('editGuidelineExpenses').value = g.target_expenses || '';
                document.getElementById('editGuidelineSourceUrl').value = g.source_url || '';
                document.getElementById('editGuidelinePdfUrl').value = g.pdf_url || '';
                document.getElementById('editGuidelineStatus').value = g.status || 'active';
                document.getElementById('editGuidelineModal').classList.remove('hidden');
            }
            function closeEditGuidelineModal() {
                document.getElementById('editGuidelineModal').classList.add('hidden');
            }

            document.getElementById('editGuidelineForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                const id = data.id;
                delete data.id;
                
                if (data.max_amount) data.max_amount = parseInt(data.max_amount) * 10000;
                if (data.min_amount) data.min_amount = parseInt(data.min_amount) * 10000;
                
                try {
                    await axios.put(\`/api/master/subsidy-guidelines/\${id}\`, data, axiosConfig);
                    showToast('公募要領を更新しました');
                    closeEditGuidelineModal();
                    loadGuidelines();
                } catch (error) {
                    showToast('更新に失敗しました', 'error');
                }
            });

            async function toggleGuidelineStatus(id, currentStatus) {
                const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
                try {
                    await axios.patch(\`/api/master/subsidy-guidelines/\${id}/status\`, { status: newStatus }, axiosConfig);
                    showToast(newStatus === 'active' ? '有効にしました' : '終了にしました');
                    loadGuidelines();
                } catch (error) {
                    showToast('ステータス変更に失敗しました', 'error');
                }
            }

            async function deleteGuideline(id) {
                if (!confirm('この公募要領を削除しますか？')) return;
                try {
                    await axios.delete(\`/api/master/subsidy-guidelines/\${id}\`, axiosConfig);
                    showToast('削除しました');
                    loadGuidelines();
                } catch (error) {
                    showToast('削除に失敗しました', 'error');
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
                    await axios.post('/api/master/subsidy-watch-urls', data, axiosConfig);
                    showToast('監視URLを追加しました');
                    closeAddUrlModal();
                    loadWatchUrls();
                } catch (error) {
                    showToast('追加に失敗しました', 'error');
                }
            });

            async function deleteWatchUrl(id) {
                if (!confirm('この監視URLを削除しますか？')) return;
                try {
                    await axios.delete(\`/api/master/subsidy-watch-urls/\${id}\`, axiosConfig);
                    showToast('削除しました');
                    loadWatchUrls();
                } catch (error) {
                    showToast('削除に失敗しました', 'error');
                }
            }

            // 更新チェック実行
            async function checkUpdatesNow() {
                showToast('更新チェックを開始しています...');
                try {
                    const response = await axios.post('/api/subsidy-check-updates', {}, axiosConfig);
                    const result = response.data;
                    
                    const changes = result.results?.filter(r => r.change_detected).length || 0;
                    if (changes > 0) {
                        showToast(\`\${changes}件の更新が検知されました！\`);
                    } else {
                        showToast('更新はありませんでした');
                    }
                    
                    loadWatchUrls();
                    loadUpdateLogs();
                } catch (error) {
                    showToast('チェックに失敗しました: ' + error.message, 'error');
                }
            }

            async function updateLogStatus(id, status) {
                try {
                    await axios.put(\`/api/master/subsidy-update-logs/\${id}\`, {
                        status,
                        reviewed_by: localStorage.getItem('master_name') || 'master'
                    }, axiosConfig);
                    showToast('ステータスを更新しました');
                } catch (error) {
                    showToast('更新に失敗しました', 'error');
                }
            }

            // AI抽出
            function openAiExtractModal() {
                const selectedSubsidy = document.getElementById('aiExtractSubsidy').value;
                if (selectedSubsidy) {
                    document.getElementById('aiExtractSubsidyType').value = selectedSubsidy;
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
                
                document.getElementById('aiExtractStatus').classList.remove('hidden');
                document.getElementById('aiExtractSubmitBtn').disabled = true;
                
                try {
                    const response = await axios.post(\`/api/master/subsidy-guidelines/\${subsidyTypeId}/ai-extract\`, { url }, axiosConfig);
                    const result = response.data;
                    
                    if (result.error) {
                        showToast(result.error, 'error');
                        return;
                    }
                    
                    currentAiResult = {
                        subsidyTypeId,
                        ...result.extracted,
                        source_url: url
                    };
                    
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
                
                const ext = result.extracted;
                document.getElementById('aiResult_fiscal_year').textContent = ext.fiscal_year || '-';
                document.getElementById('aiResult_version').textContent = ext.version || '-';
                document.getElementById('aiResult_start_date').textContent = ext.application_start_date || '-';
                document.getElementById('aiResult_end_date').textContent = ext.application_end_date || '-';
                document.getElementById('aiResult_max_amount').textContent = ext.max_amount ? (ext.max_amount / 10000).toLocaleString() + '万円' : '-';
                document.getElementById('aiResult_subsidy_rate').textContent = ext.subsidy_rate || '-';
                document.getElementById('aiResult_eligibility').textContent = ext.eligibility_requirements || '-';
                document.getElementById('aiResult_expenses').textContent = ext.target_expenses || '-';
                
                const confEl = document.getElementById('aiResult_confidence');
                const confColors = { high: 'bg-green-100 text-green-800', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-red-100 text-red-800' };
                const confLabels = { high: '高', medium: '中', low: '低' };
                confEl.className = \`px-2 py-0.5 rounded text-xs \${confColors[ext.confidence] || 'bg-gray-100 text-gray-800'}\`;
                confEl.textContent = confLabels[ext.confidence] || ext.confidence || '-';
                
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
                    const response = await axios.post(\`/api/master/subsidy-guidelines/\${currentAiResult.subsidyTypeId}/ai-update\`, currentAiResult, axiosConfig);
                    
                    if (response.data.success) {
                        showToast(\`公募要領を\${response.data.action === 'created' ? '新規登録' : '更新'}しました\`);
                        closeAiResultModal();
                        loadGuidelines();
                    }
                } catch (error) {
                    showToast('更新に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
                }
            }

            // サイドバートグル
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                sidebar.classList.toggle('-translate-x-full');
            }

            // 初期化
            (async () => {
                await loadSubsidyTypes();
                await loadGuidelines();
                loadWatchUrls();
                loadUpdateLogs();
            })();
        </script>
    </body>
    </html>
  `)
})

export default routes
