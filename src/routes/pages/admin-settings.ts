// 管理画面: システム設定
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// プラン・枠管理ページ
routes.get('/admin/subscription', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>プラン・枠管理 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            ${sidebarStyles}
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('subscription')}
            
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-ticket-alt mr-2"></i>プラン・枠管理
                            </h2>
                        </div>
                    </div>
                </header>

                <div class="p-4 lg:p-6">
            
            <!-- 現在のプラン・業務範囲 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <!-- 現在のプランカード -->
                <div class="bg-white rounded-xl shadow-sm p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-bold text-gray-800">
                            <i class="fas fa-crown text-yellow-500 mr-2"></i>現在のプラン
                        </h3>
                        <button onclick="openStripePortal()" class="px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-sm font-medium transition-colors">
                            <i class="fab fa-stripe mr-1"></i>支払い管理
                        </button>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="flex-1">
                            <p id="currentPlan" class="text-2xl font-bold text-gray-900">読み込み中...</p>
                            <p id="planPrice" class="text-sm text-gray-500 mt-1"></p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm text-gray-500">次回切り替わり</p>
                            <p id="nextResetDate" class="text-lg font-bold text-purple-600">-</p>
                        </div>
                    </div>
                    <div id="scheduledPlanInfo" class="hidden mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-clock text-yellow-600"></i>
                                <span id="scheduledPlanText" class="text-sm text-yellow-800"></span>
                            </div>
                            <button onclick="cancelScheduledPlan()" class="px-3 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded text-xs font-medium transition-colors">
                                <i class="fas fa-times mr-1"></i>キャンセル
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 業務範囲カード -->
                <div class="bg-white rounded-xl shadow-sm p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-bold text-gray-800">
                            <i class="fas fa-briefcase text-blue-500 mr-2"></i>利用可能な業務範囲
                        </h3>
                    </div>
                    <div id="businessScopeDisplay" class="space-y-3">
                        <div class="text-center py-4 text-gray-500">読み込み中...</div>
                    </div>
                </div>
            </div>
            
            <!-- 枠状況 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-white rounded-xl shadow-sm p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-sm font-medium text-gray-500">利用可能枠</h3>
                        <i class="fas fa-ticket-alt text-green-500"></i>
                    </div>
                    <p id="totalSlots" class="text-3xl font-bold text-green-600">-</p>
                    <div class="text-xs text-gray-500 mt-1 space-y-1">
                        <div class="flex justify-between">
                            <span><i class="fas fa-sync-alt mr-1 text-blue-400"></i>プラン枠:</span>
                            <span id="monthlySlots" class="font-medium">-</span>
                            <span class="text-orange-500">(有限)</span>
                        </div>
                        <div class="flex justify-between">
                            <span><i class="fas fa-plus-circle mr-1 text-green-400"></i>追加枠:</span>
                            <span id="purchasedSlots" class="font-medium">-</span>
                            <span class="text-green-500">(無期限)</span>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-xl shadow-sm p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-sm font-medium text-gray-500">今月の使用</h3>
                        <i class="fas fa-chart-bar text-blue-500"></i>
                    </div>
                    <p id="usedThisMonth" class="text-3xl font-bold text-blue-600">-</p>
                    <p class="text-sm text-gray-500 mt-1">件の案件を開始</p>
                </div>
                
                <div class="bg-white rounded-xl shadow-sm p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-sm font-medium text-gray-500">月額合計</h3>
                        <i class="fas fa-yen-sign text-orange-500"></i>
                    </div>
                    <p id="totalMonthlyPrice" class="text-3xl font-bold text-orange-600">-</p>
                    <p id="priceBreakdown" class="text-xs text-gray-500 mt-1"></p>
                </div>
            </div>
            
            <!-- 枠の説明 -->
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
                <h3 class="font-bold text-blue-800 mb-2"><i class="fas fa-info-circle mr-2"></i>枠の仕組みについて</h3>
                <div class="text-sm text-blue-700 space-y-1">
                    <p><i class="fas fa-sync-alt mr-1"></i><strong>プラン枠（有限）</strong>：毎月の切り替わり日にリセットされ、新しい枠が付与されます。未使用分は繰り越されません。</p>
                    <p><i class="fas fa-plus-circle mr-1"></i><strong>追加枠（無期限）</strong>：購入した枠は無期限で使用できます。リセットされることはありません。</p>
                    <p><i class="fas fa-arrow-right mr-1"></i><strong>消費順序</strong>：プラン枠から優先的に消費され、プラン枠がなくなると追加枠から消費されます。</p>
                </div>
            </div>
            
            <!-- プラン一覧 -->
            <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
                <h2 class="text-lg font-bold mb-2">
                    <i class="fas fa-list mr-2 text-blue-600"></i>料金プラン
                </h2>
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p class="text-sm text-yellow-800">
                        <i class="fas fa-exclamation-triangle mr-1"></i>
                        <strong>重要</strong>：プラン変更は<strong>次回切り替わり日</strong>から適用されます。即座には反映されません。
                    </p>
                </div>
                <div id="plansList" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="text-center py-8 text-gray-500">読み込み中...</div>
                </div>
            </div>
            
            <!-- オプション追加 -->
            <div id="addonSection" class="bg-white rounded-xl shadow-sm p-6 mb-8">
                <h2 class="text-lg font-bold mb-4">
                    <i class="fas fa-puzzle-piece mr-2 text-purple-600"></i>オプション追加
                </h2>
                <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                    <p class="text-sm text-purple-800">
                        <i class="fas fa-info-circle mr-1"></i>
                        業務範囲を拡張するオプションを追加できます。
                    </p>
                </div>
                <div id="addonsList" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="text-center py-8 text-gray-500">読み込み中...</div>
                </div>
            </div>
            
            <!-- 追加枠購入 -->
            <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
                <h2 class="text-lg font-bold mb-4">
                    <i class="fas fa-shopping-cart mr-2 text-green-600"></i>追加枠を購入
                </h2>
                <div class="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <p class="text-sm text-green-800">
                        <i class="fas fa-check-circle mr-1"></i>
                        追加購入した枠は<strong class="text-green-700">無期限</strong>で使用できます。月々のリセットの影響を受けません。
                    </p>
                </div>
                <div id="packagesList" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="text-center py-8 text-gray-500">読み込み中...</div>
                </div>
            </div>
            
            <!-- 使用履歴 -->
            <div class="bg-white rounded-xl shadow-sm p-6">
                <h2 class="text-lg font-bold mb-4">
                    <i class="fas fa-history mr-2 text-purple-600"></i>枠の使用履歴
                </h2>
                <div id="historyList" class="space-y-2 max-h-96 overflow-y-auto">
                    <div class="text-center py-8 text-gray-500">読み込み中...</div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${sidebarScripts}
        </script>
        <script>
            // 管理者権限チェック
            const adminRole = localStorage.getItem('admin_role');
            if (adminRole !== 'admin') {
                alert('この機能は管理者のみ利用可能です');
                window.location.href = '/';
            }
            
            let currentSubscription = null;
            
            async function loadAll() {
                // loadStatusを先に実行してcurrentSubscriptionとscheduledPlanDataを設定
                await loadStatus();
                // その後に他のデータを並列で読み込み
                await Promise.all([
                    loadPlans(),
                    loadPackages(),
                    loadHistory()
                ]);
            }
            
            let scheduledPlanData = null;
            let nextResetDateData = null;
            
            let isUnlimitedPlan = false;
            
            async function loadStatus() {
                try {
                    const response = await axios.get('/api/subscription/status');
                    const data = response.data;
                    currentSubscription = data.subscription;
                    scheduledPlanData = data.scheduled_plan;
                    nextResetDateData = data.next_reset_date;
                    isUnlimitedPlan = data.is_unlimited || false;
                    
                    document.getElementById('currentPlan').textContent = data.subscription?.plan_name || '未設定';
                    document.getElementById('planPrice').textContent = data.subscription ? '月額 ¥' + (data.subscription.monthly_price || 0).toLocaleString() : '';
                    
                    // 無制限プランの場合の表示
                    if (isUnlimitedPlan) {
                        document.getElementById('totalSlots').innerHTML = '<i class="fas fa-infinity"></i>';
                        document.getElementById('monthlySlots').innerHTML = '<i class="fas fa-infinity text-sm"></i>';
                        document.getElementById('purchasedSlots').textContent = data.balance?.purchased_slots_remaining || 0;
                    } else {
                        document.getElementById('totalSlots').textContent = data.total_available || 0;
                        document.getElementById('monthlySlots').textContent = data.balance?.monthly_slots_remaining || 0;
                        document.getElementById('purchasedSlots').textContent = data.balance?.purchased_slots_remaining || 0;
                    }
                    document.getElementById('usedThisMonth').textContent = data.used_this_month || 0;
                    
                    // 次回切り替わり日を表示
                    if (data.next_reset_date) {
                        const resetDate = new Date(data.next_reset_date);
                        document.getElementById('nextResetDate').textContent = resetDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
                    }
                    
                    // 予約されたプラン変更の表示
                    const scheduledInfo = document.getElementById('scheduledPlanInfo');
                    if (data.scheduled_plan && data.scheduled_plan_date) {
                        const scheduledDate = new Date(data.scheduled_plan_date);
                        document.getElementById('scheduledPlanText').textContent = 
                            scheduledDate.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) + 'から「' + data.scheduled_plan.plan_name + '」に変更予定';
                        scheduledInfo.classList.remove('hidden');
                    } else {
                        scheduledInfo.classList.add('hidden');
                    }
                    
                    // 業務範囲の表示
                    const scopeLabels = {
                        'labor': { name: '社労士業務（助成金）', icon: 'fa-users', color: 'blue' },
                        'administrative': { name: '行政書士業務（補助金・許認可）', icon: 'fa-file-signature', color: 'emerald' },
                        'both': { name: '両方利用（助成金 + 補助金・許認可）', icon: 'fa-layer-group', color: 'purple' }
                    };
                    
                    const currentScope = data.business_scope || 'both';
                    const scopeInfo = scopeLabels[currentScope] || scopeLabels.labor;
                    const hasDualScope = data.has_dual_scope || false;
                    
                    let scopeHtml = '';
                    if (currentScope === 'labor') {
                        scopeHtml = \`
                            <div class="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                                    <i class="fas fa-users text-white"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="font-bold text-blue-800">社労士業務</p>
                                    <p class="text-sm text-blue-600">助成金申請に対応</p>
                                </div>
                                <span class="px-2 py-1 bg-blue-500 text-white text-xs rounded-full">有効</span>
                            </div>
                            <div class="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg opacity-60">
                                <div class="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center">
                                    <i class="fas fa-file-signature text-white"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="font-bold text-gray-600">行政書士業務</p>
                                    <p class="text-sm text-gray-500">補助金・許認可申請</p>
                                </div>
                                <span class="px-2 py-1 bg-gray-400 text-white text-xs rounded-full">未契約</span>
                            </div>
                        \`;
                    } else if (currentScope === 'administrative') {
                        scopeHtml = \`
                            <div class="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg opacity-60">
                                <div class="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center">
                                    <i class="fas fa-users text-white"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="font-bold text-gray-600">社労士業務</p>
                                    <p class="text-sm text-gray-500">助成金申請</p>
                                </div>
                                <span class="px-2 py-1 bg-gray-400 text-white text-xs rounded-full">未契約</span>
                            </div>
                            <div class="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <div class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <i class="fas fa-file-signature text-white"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="font-bold text-emerald-800">行政書士業務</p>
                                    <p class="text-sm text-emerald-600">補助金・許認可申請に対応</p>
                                </div>
                                <span class="px-2 py-1 bg-emerald-500 text-white text-xs rounded-full">有効</span>
                            </div>
                        \`;
                    } else {
                        scopeHtml = \`
                            <div class="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                                    <i class="fas fa-users text-white"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="font-bold text-blue-800">社労士業務</p>
                                    <p class="text-sm text-blue-600">助成金申請に対応</p>
                                </div>
                                <span class="px-2 py-1 bg-blue-500 text-white text-xs rounded-full">有効</span>
                            </div>
                            <div class="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <div class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <i class="fas fa-file-signature text-white"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="font-bold text-emerald-800">行政書士業務</p>
                                    <p class="text-sm text-emerald-600">補助金・許認可申請に対応</p>
                                </div>
                                <span class="px-2 py-1 bg-emerald-500 text-white text-xs rounded-full">有効</span>
                            </div>
                        \`;
                    }
                    document.getElementById('businessScopeDisplay').innerHTML = scopeHtml;
                    
                    // 月額合計の計算
                    let totalPrice = data.subscription?.monthly_price || 0;
                    let breakdown = \`プラン: ¥\${totalPrice.toLocaleString()}\`;
                    if (hasDualScope) {
                        totalPrice += 2000;
                        breakdown += ' + 両方利用: ¥2,000';
                    }
                    document.getElementById('totalMonthlyPrice').textContent = '¥' + totalPrice.toLocaleString();
                    document.getElementById('priceBreakdown').textContent = breakdown;
                    
                    // アドオン表示を更新
                    updateAddonsDisplay(currentScope, hasDualScope);
                    
                } catch (error) {
                    console.error('Error loading status:', error);
                }
            }
            
            // アドオン表示を更新
            function updateAddonsDisplay(currentScope, hasDualScope) {
                const container = document.getElementById('addonsList');
                
                // 社労士の場合は行政書士追加、行政書士の場合は社労士追加を表示
                // 両方の場合は追加オプションなし
                if (currentScope === 'both' || hasDualScope) {
                    container.innerHTML = \`
                        <div class="col-span-full text-center py-8 text-gray-500">
                            <i class="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
                            <p>すべての業務範囲が有効です</p>
                        </div>
                    \`;
                    return;
                }
                
                if (currentScope === 'labor') {
                    container.innerHTML = \`
                        <div class="border-2 border-emerald-300 rounded-xl p-6 bg-emerald-50">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <i class="fas fa-file-signature text-white text-xl"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-emerald-800">行政書士業務を追加</h3>
                                    <p class="text-sm text-emerald-600">補助金・許認可申請に対応</p>
                                </div>
                            </div>
                            <div class="mb-4">
                                <span class="text-2xl font-bold text-emerald-700">+¥2,000</span>
                                <span class="text-sm text-emerald-600">/月</span>
                            </div>
                            <ul class="text-sm text-emerald-700 space-y-1 mb-4">
                                <li><i class="fas fa-check mr-2"></i>IT導入補助金、ものづくり補助金など</li>
                                <li><i class="fas fa-check mr-2"></i>各種許認可申請（建設業、飲食業など）</li>
                                <li><i class="fas fa-check mr-2"></i>補助金専用のヒアリング質問</li>
                            </ul>
                            <button onclick="addDualScope()" class="w-full bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 font-bold">
                                <i class="fas fa-plus mr-2"></i>追加する
                            </button>
                        </div>
                    \`;
                } else {
                    container.innerHTML = \`
                        <div class="border-2 border-blue-300 rounded-xl p-6 bg-blue-50">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                                    <i class="fas fa-users text-white text-xl"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-blue-800">社労士業務を追加</h3>
                                    <p class="text-sm text-blue-600">助成金申請に対応</p>
                                </div>
                            </div>
                            <div class="mb-4">
                                <span class="text-2xl font-bold text-blue-700">+¥2,000</span>
                                <span class="text-sm text-blue-600">/月</span>
                            </div>
                            <ul class="text-sm text-blue-700 space-y-1 mb-4">
                                <li><i class="fas fa-check mr-2"></i>キャリアアップ助成金、両立支援助成金など</li>
                                <li><i class="fas fa-check mr-2"></i>雇用関連の各種助成金</li>
                                <li><i class="fas fa-check mr-2"></i>助成金専用のヒアリング質問</li>
                            </ul>
                            <button onclick="addDualScope()" class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold">
                                <i class="fas fa-plus mr-2"></i>追加する
                            </button>
                        </div>
                    \`;
                }
            }
            
            // 両方利用オプションを追加
            async function addDualScope() {
                if (!confirm('業務範囲を追加しますか？\\n\\n月額 +¥2,000 で両方の業務に対応できるようになります。')) {
                    return;
                }
                
                try {
                    await axios.post('/api/subscription/add-dual-scope');
                    alert('業務範囲を追加しました！');
                    loadAll();
                } catch (error) {
                    console.error('Error adding dual scope:', error);
                    alert('エラーが発生しました: ' + (error.response?.data?.error || error.message));
                }
            }
            
            async function loadPlans() {
                try {
                    const response = await axios.get('/api/subscription/plans');
                    const plans = response.data;
                    
                    const container = document.getElementById('plansList');
                    container.innerHTML = plans.map(plan => {
                        const isCurrent = currentSubscription?.plan_code === plan.plan_code;
                        const isScheduled = scheduledPlanData?.plan_code === plan.plan_code;
                        
                        let statusBadge = '';
                        let borderClass = 'border-gray-200 hover:border-blue-300';
                        let buttonHtml = \`<button onclick="changePlan(\${plan.id})" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">このプランに変更</button>\`;
                        
                        if (isCurrent) {
                            statusBadge = '<div class="text-xs font-bold text-blue-600 mb-2"><i class="fas fa-check-circle mr-1"></i>現在のプラン</div>';
                            borderClass = 'border-blue-500 bg-blue-50';
                            buttonHtml = '';
                        } else if (isScheduled) {
                            statusBadge = '<div class="text-xs font-bold text-yellow-600 mb-2"><i class="fas fa-clock mr-1"></i>変更予約済み（' + new Date(nextResetDateData).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) + 'から適用）</div>';
                            borderClass = 'border-yellow-500 bg-yellow-50';
                            // キャンセルボタンは上部の通知エリアにあるので、ここではボタンを表示しない
                            buttonHtml = '';
                        }
                        
                        // 無制限プランかどうか
                        const isPlanUnlimited = plan.monthly_slots === -1;
                        const slotsDisplay = isPlanUnlimited ? '<i class="fas fa-infinity"></i> 無制限' : plan.monthly_slots + '枠';
                        
                        // 無制限プランの場合は特別なスタイル
                        if (isPlanUnlimited && !isCurrent && !isScheduled) {
                            borderClass = 'border-purple-300 hover:border-purple-500 bg-gradient-to-br from-purple-50 to-indigo-50';
                        }
                        
                        return \`
                            <div class="border-2 rounded-xl p-6 \${borderClass} transition-colors \${isPlanUnlimited ? 'relative' : ''}">
                                \${isPlanUnlimited && !isCurrent ? '<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full"><i class="fas fa-crown mr-1"></i>おすすめ</div>' : ''}
                                \${statusBadge}
                                <h3 class="text-lg font-bold text-gray-900">\${plan.plan_name}</h3>
                                <p class="text-3xl font-bold text-gray-900 my-3">¥\${plan.monthly_price.toLocaleString()}<span class="text-sm font-normal text-gray-500">/月</span></p>
                                <p class="text-sm text-gray-600 mb-4">\${plan.description}</p>
                                <ul class="text-sm text-gray-600 space-y-2 mb-4">
                                    <li><i class="fas fa-check text-green-500 mr-2"></i>毎月<span class="font-bold">\${slotsDisplay}</span>付与</li>
                                    <li><i class="fas fa-check text-green-500 mr-2"></i>見込み案件は無制限</li>
                                    \${isPlanUnlimited ? '<li class="text-purple-600 font-bold"><i class="fas fa-star mr-2"></i>案件数の制限なし</li>' : '<li><i class="fas fa-check text-green-500 mr-2"></i>追加枠の購入可能</li>'}
                                    \${isPlanUnlimited ? '' : '<li class="text-orange-600"><i class="fas fa-sync-alt mr-2"></i>プラン枠は毎月リセット</li>'}
                                </ul>
                                \${buttonHtml}
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading plans:', error);
                }
            }
            
            async function loadPackages() {
                try {
                    const response = await axios.get('/api/subscription/packages');
                    const packages = response.data;
                    
                    const container = document.getElementById('packagesList');
                    container.innerHTML = packages.map(pkg => {
                        const perSlot = Math.round(pkg.price / pkg.slot_count);
                        const isBest = pkg.package_code === 'bulk';
                        return \`
                            <div class="border-2 rounded-xl p-6 \${isBest ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'} transition-colors relative">
                                \${isBest ? '<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">最もお得</div>' : ''}
                                <h3 class="text-lg font-bold text-gray-900">\${pkg.package_name}</h3>
                                <p class="text-3xl font-bold text-gray-900 my-3">¥\${pkg.price.toLocaleString()}</p>
                                <p class="text-sm text-gray-500 mb-4">1枠あたり ¥\${perSlot.toLocaleString()}</p>
                                <button onclick="purchaseSlots(\${pkg.id}, '\${pkg.package_name}', \${pkg.price})" class="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                                    <i class="fas fa-shopping-cart mr-2"></i>購入する
                                </button>
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading packages:', error);
                }
            }
            
            async function loadHistory() {
                try {
                    const response = await axios.get('/api/subscription/history');
                    const history = response.data;
                    
                    const container = document.getElementById('historyList');
                    if (history.length === 0) {
                        container.innerHTML = '<div class="text-center py-8 text-gray-500">履歴はありません</div>';
                        return;
                    }
                    
                    container.innerHTML = history.map(h => {
                        const isPositive = h.slots_changed > 0;
                        const actionLabel = {
                            'consumed': '案件開始',
                            'granted': '月次付与',
                            'purchased': '枠購入',
                            'plan_changed': 'プラン変更'
                        }[h.action] || h.action;
                        const icon = {
                            'consumed': 'fa-minus-circle text-red-500',
                            'granted': 'fa-gift text-blue-500',
                            'purchased': 'fa-plus-circle text-green-500',
                            'plan_changed': 'fa-exchange-alt text-purple-500'
                        }[h.action] || 'fa-circle text-gray-500';
                        
                        return \`
                            <div class="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                <i class="fas \${icon} text-xl"></i>
                                <div class="flex-1">
                                    <div class="font-medium text-gray-900">\${actionLabel}</div>
                                    <div class="text-sm text-gray-500">\${h.note || ''}\${h.case_number ? ' - ' + h.case_number : ''}</div>
                                </div>
                                <div class="text-right">
                                    <div class="font-bold \${isPositive ? 'text-green-600' : 'text-red-600'}">\${isPositive ? '+' : ''}\${h.slots_changed}枠</div>
                                    <div class="text-xs text-gray-500">\${new Date(h.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</div>
                                </div>
                            </div>
                        \`;
                    }).join('');
                } catch (error) {
                    console.error('Error loading history:', error);
                }
            }
            
            // Stripe決済でプラン変更
            async function changePlan(planId) {
                if (!confirm('プランを変更しますか？\\n\\nStripe決済画面に移動します。')) return;
                
                try {
                    // plan_idを直接送信（APIでDBからplan_codeを取得する）
                    const response = await axios.post('/api/stripe/create-subscription-checkout', { plan_id: planId });
                    if (response.data.checkout_url) {
                        window.location.href = response.data.checkout_url;
                    } else {
                        alert('決済セッションの作成に失敗しました');
                    }
                } catch (error) {
                    console.error('Stripe checkout error:', error);
                    alert('エラー: ' + (error.response?.data?.error || '決済の準備に失敗しました'));
                }
            }
            
            // 予約プランのキャンセル（Stripe連携なし）
            async function cancelScheduledPlan() {
                if (!confirm('プラン変更の予約をキャンセルしますか？')) return;
                
                try {
                    await axios.post('/api/subscription/cancel-scheduled-plan');
                    
                    // 即座にUIを更新
                    document.getElementById('scheduledPlanInfo').classList.add('hidden');
                    scheduledPlanData = null;
                    
                    alert('プラン変更の予約をキャンセルしました');
                    
                    // 全データを再読み込み
                    await loadAll();
                } catch (error) {
                    console.error('Cancel error:', error);
                    alert('キャンセルに失敗しました');
                }
            }
            
            // Stripe決済で追加枠購入
            async function purchaseSlots(packageId, name, price) {
                // パッケージIDをSlot パッケージ名に変換（DBのslot_packagesと一致）
                const slotPackageMap = { 1: 'slot_1', 2: 'slot_3', 3: 'slot_10' };
                const slotPackage = slotPackageMap[packageId];
                
                if (!slotPackage) {
                    alert('無効なパッケージです');
                    return;
                }
                
                if (!confirm(name + '（¥' + price.toLocaleString() + '）を購入しますか？\\n\\nStripe決済画面に移動します。\\n※追加購入した枠は無期限で使用できます。')) return;
                
                try {
                    const response = await axios.post('/api/stripe/create-slot-checkout', { slot_package: slotPackage });
                    if (response.data.checkout_url) {
                        window.location.href = response.data.checkout_url;
                    } else {
                        alert('決済セッションの作成に失敗しました');
                    }
                } catch (error) {
                    console.error('Stripe checkout error:', error);
                    alert('エラー: ' + (error.response?.data?.error || '決済の準備に失敗しました'));
                }
            }
            
            // Stripe Customer Portal を開く
            async function openStripePortal() {
                try {
                    const response = await axios.post('/api/stripe/create-portal-session');
                    if (response.data.portal_url) {
                        window.location.href = response.data.portal_url;
                    }
                } catch (error) {
                    alert('エラー: ' + (error.response?.data?.error || 'ポータルを開けませんでした'));
                }
            }
            
            // URLパラメータをチェックして結果を表示
            function checkPaymentResult() {
                const params = new URLSearchParams(window.location.search);
                const status = params.get('status');
                const slots = params.get('slots');
                
                if (status === 'success') {
                    alert('サブスクリプションの設定が完了しました！');
                    // URLパラメータをクリア
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else if (status === 'slot_success' && slots) {
                    alert(slots + '枠を購入しました！');
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else if (status === 'cancelled') {
                    alert('決済がキャンセルされました');
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
            
            // ページ読み込み時に結果をチェック
            checkPaymentResult();
            
            loadAll();
        </script>
    </body>
    </html>
  `)
})

routes.get('/admin/settings', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>システム設定 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <style>
            ${sidebarStyles}
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('settings')}
            
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-cog mr-2"></i>システム設定
                            </h2>
                        </div>
                    </div>
                </header>

                <div class="p-4 lg:p-6 max-w-4xl">
            <!-- 銀行振込先設定 -->
            <div class="bg-white rounded-lg shadow mb-6">
                <div class="p-4 border-b">
                    <h2 class="text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-university text-green-600"></i>
                        銀行振込先情報
                    </h2>
                    <p class="text-sm text-gray-500 mt-1">顧客ポータルで表示される振込先情報を設定します</p>
                </div>
                <div class="p-4 space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">銀行名</label>
                            <input type="text" id="bank_name" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 三菱UFJ銀行">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">支店名</label>
                            <input type="text" id="bank_branch" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 渋谷支店">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">口座種別</label>
                            <select id="bank_account_type" class="w-full px-3 py-2 border rounded-lg">
                                <option value="普通">普通</option>
                                <option value="当座">当座</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">口座番号</label>
                            <input type="text" id="bank_account_number" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 1234567">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">口座名義</label>
                            <input type="text" id="bank_account_holder" class="w-full px-3 py-2 border rounded-lg" placeholder="例: カ）サンプルシャ">
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 会社情報 -->
            <div class="bg-white rounded-lg shadow mb-6">
                <div class="p-4 border-b">
                    <h2 class="text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-building text-blue-600"></i>
                        会社情報
                    </h2>
                    <p class="text-sm text-gray-500 mt-1">請求書などに表示される会社情報を設定します</p>
                </div>
                <div class="p-4 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">会社名</label>
                        <input type="text" id="company_name" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 株式会社サンプル">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">住所</label>
                        <input type="text" id="company_address" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 東京都渋谷区...">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                        <input type="text" id="company_phone" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 03-1234-5678">
                    </div>
                </div>
            </div>
            
            <!-- 資格情報・書類作成モード -->
            <div class="bg-white rounded-lg shadow mb-6">
                <div class="p-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-lg font-bold flex items-center gap-2">
                                <i class="fas fa-certificate text-amber-600"></i>
                                資格情報・書類作成モード
                            </h2>
                            <p class="text-sm text-gray-500 mt-1">行政書士法・社労士法に準拠した業務範囲を設定します</p>
                        </div>
                        <span id="licenseVerifiedBadge" class="hidden px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                            <i class="fas fa-check-circle mr-1"></i>確認済み
                        </span>
                    </div>
                </div>
                <div class="p-4 space-y-6">
                    <!-- 法的注意事項 -->
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div class="flex items-start gap-3">
                            <i class="fas fa-exclamation-triangle text-red-600 mt-0.5"></i>
                            <div class="text-sm text-red-800">
                                <p class="font-bold mb-2">重要な法的注意事項</p>
                                <ul class="space-y-1 list-disc list-inside">
                                    <li><strong>行政書士法第19条</strong>：官公署に提出する書類の作成は行政書士でなければできません</li>
                                    <li><strong>社会保険労務士法第27条</strong>：労働社会保険諸法令に基づく申請書類の作成は社労士でなければできません</li>
                                    <li>資格を持たない場合、顧客自身が書類を作成する必要があります（AIアドバイス・テンプレート提供は可能）</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 行政書士資格 -->
                    <div class="border rounded-lg p-4">
                        <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <i class="fas fa-user-tie text-blue-600"></i>
                            行政書士資格
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">登録番号</label>
                                <input type="text" id="gyoseishoshi_license_number" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 第00000号">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">登録者名</label>
                                <input type="text" id="gyoseishoshi_license_name" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 山田 太郎">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">登録年月日</label>
                                <input type="date" id="gyoseishoshi_registered_at" class="w-full px-3 py-2 border rounded-lg">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 社会保険労務士資格 -->
                    <div class="border rounded-lg p-4">
                        <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <i class="fas fa-user-shield text-green-600"></i>
                            社会保険労務士資格
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">登録番号</label>
                                <input type="text" id="sharoshi_license_number" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 第00000000号">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">登録者名</label>
                                <input type="text" id="sharoshi_license_name" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 山田 太郎">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">登録年月日</label>
                                <input type="date" id="sharoshi_registered_at" class="w-full px-3 py-2 border rounded-lg">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 書類作成モード -->
                    <div class="border rounded-lg p-4 bg-gray-50">
                        <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <i class="fas fa-file-signature text-purple-600"></i>
                            書類作成モード
                        </h3>
                        <div class="space-y-3">
                            <label class="flex items-start gap-3 p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                                <input type="radio" name="document_creation_mode" value="client_self" class="mt-1">
                                <div>
                                    <span class="font-medium text-gray-800">顧客自己作成モード</span>
                                    <p class="text-sm text-gray-500 mt-1">顧客が自分で書類を作成します。AIアドバイス・テンプレート提供のみ行います。<br>
                                    <span class="text-amber-600"><i class="fas fa-info-circle mr-1"></i>資格がない場合はこのモードのみ選択可能</span></p>
                                </div>
                            </label>
                            <label id="licensedModeOption" class="flex items-start gap-3 p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                                <input type="radio" name="document_creation_mode" value="licensed_full">
                                <div>
                                    <span class="font-medium text-gray-800">資格者代行作成モード</span>
                                    <p class="text-sm text-gray-500 mt-1">行政書士/社労士が代行して書類を作成します。<br>
                                    <span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>資格登録が必要です</span></p>
                                </div>
                            </label>
                            <label id="bothModeOption" class="flex items-start gap-3 p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                                <input type="radio" name="document_creation_mode" value="both">
                                <div>
                                    <span class="font-medium text-gray-800">案件ごとに選択</span>
                                    <p class="text-sm text-gray-500 mt-1">案件ごとに代行作成か顧客自己作成かを選択できます。<br>
                                    <span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>資格登録が必要です</span></p>
                                </div>
                            </label>
                        </div>
                    </div>
                    
                    <!-- 資格情報保存ボタン -->
                    <div class="flex justify-end">
                        <button onclick="saveLicenseInfo()" class="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2">
                            <i class="fas fa-save"></i>
                            資格情報を保存
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- 法務設定 -->
            <div class="bg-white rounded-lg shadow mb-6">
                <div class="p-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-lg font-bold flex items-center gap-2">
                                <i class="fas fa-gavel text-indigo-600"></i>
                                法務設定
                            </h2>
                            <p class="text-sm text-gray-500 mt-1">プライバシーポリシー・特定商取引法に基づく表記を設定します（Markdown対応）</p>
                        </div>
                        <button onclick="applyLegalTemplates()" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center gap-2">
                            <i class="fas fa-file-import"></i>
                            テンプレートを適用
                        </button>
                    </div>
                </div>
                <div class="p-4 space-y-6">
                    <!-- 代表者・登録番号 -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">代表者名</label>
                            <input type="text" id="company_representative" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 代表 山田太郎">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">登録番号等</label>
                            <input type="text" id="company_registration" class="w-full px-3 py-2 border rounded-lg" placeholder="例: 行政書士登録番号: 第00000号">
                        </div>
                    </div>
                    
                    <!-- インボイス登録番号 -->
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            <i class="fas fa-file-invoice text-yellow-600 mr-1"></i>適格請求書発行事業者登録番号（インボイス番号）
                        </label>
                        <input type="text" id="invoice_registration_number" class="w-full px-3 py-2 border rounded-lg" placeholder="例: T1234567890123">
                        <p class="text-xs text-gray-500 mt-1">請求書に記載される登録番号です。「T」から始まる13桁の番号を入力してください。</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                        <input type="email" id="company_email" class="w-full px-3 py-2 border rounded-lg" placeholder="例: info@example.com">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            <i class="fas fa-globe text-blue-600 mr-1"></i>会社・事務所HP URL
                        </label>
                        <input type="url" id="company_website_url" class="w-full px-3 py-2 border rounded-lg" placeholder="例: https://www.example.com">
                        <p class="text-xs text-gray-500 mt-1">既存のホームページがあれば入力してください</p>
                    </div>
                    
                    <!-- 外部URL設定案内 -->
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                        <div class="flex items-start gap-2">
                            <i class="fas fa-info-circle text-blue-600 mt-0.5"></i>
                            <div class="text-sm text-blue-800">
                                <p class="font-medium">既存HPの法務ページがある場合</p>
                                <p class="mt-1">各項目に外部URLを設定すると、システム内のページではなく既存HPへリンクします。<br>URLが空欄の場合は、下記で入力した内容がシステム内ページとして表示されます。</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- プライバシーポリシー -->
                    <div class="border rounded-lg p-4 bg-gray-50">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            <i class="fas fa-shield-alt text-green-600 mr-1"></i>プライバシーポリシー
                        </label>
                        <div class="mb-3">
                            <label class="block text-xs text-gray-600 mb-1">外部URL（既存HPがある場合）</label>
                            <input type="url" id="privacy_policy_url" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: https://www.example.com/privacy">
                        </div>
                        <div id="privacy_policy_content" class="transition-opacity">
                            <label class="block text-xs text-gray-600 mb-1">または、以下に内容を入力（Markdown対応）</label>
                            <textarea id="privacy_policy" rows="10" class="w-full px-3 py-2 border rounded-lg font-mono text-sm" placeholder="## プライバシーポリシー&#10;&#10;### 1. 個人情報の取得&#10;..."></textarea>
                            <button type="button" onclick="previewPrivacyPolicy()" class="mt-2 text-sm text-blue-600 hover:text-blue-800">
                                <i class="fas fa-eye mr-1"></i>プレビュー
                            </button>
                        </div>
                    </div>
                    
                    <!-- 利用規約 -->
                    <div class="border rounded-lg p-4 bg-gray-50">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            <i class="fas fa-scroll text-purple-600 mr-1"></i>利用規約
                        </label>
                        <div class="mb-3">
                            <label class="block text-xs text-gray-600 mb-1">外部URL（既存HPがある場合）</label>
                            <input type="url" id="terms_url" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: https://www.example.com/terms">
                        </div>
                        <div id="terms_content" class="transition-opacity">
                            <label class="block text-xs text-gray-600 mb-1">または、以下に内容を入力（Markdown対応）</label>
                            <textarea id="terms_of_service" rows="10" class="w-full px-3 py-2 border rounded-lg font-mono text-sm" placeholder="## 利用規約&#10;&#10;### 第1条（適用）&#10;..."></textarea>
                            <button type="button" onclick="previewTerms()" class="mt-2 text-sm text-blue-600 hover:text-blue-800">
                                <i class="fas fa-eye mr-1"></i>プレビュー
                            </button>
                        </div>
                    </div>
                    
                    <!-- 特定商取引法に基づく表記 -->
                    <div class="border rounded-lg p-4 bg-gray-50">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            <i class="fas fa-file-contract text-orange-600 mr-1"></i>特定商取引法に基づく表記
                        </label>
                        <div class="mb-3">
                            <label class="block text-xs text-gray-600 mb-1">外部URL（既存HPがある場合）</label>
                            <input type="url" id="legal_notice_url" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: https://www.example.com/legal">
                        </div>
                        <div id="legal_notice_content" class="transition-opacity">
                            <label class="block text-xs text-gray-600 mb-1">または、以下に内容を入力（Markdown対応）</label>
                            <textarea id="legal_notice" rows="10" class="w-full px-3 py-2 border rounded-lg font-mono text-sm" placeholder="## 特定商取引法に基づく表記&#10;&#10;### 事業者名&#10;..."></textarea>
                            <button type="button" onclick="previewLegalNotice()" class="mt-2 text-sm text-blue-600 hover:text-blue-800">
                                <i class="fas fa-eye mr-1"></i>プレビュー
                            </button>
                        </div>
                    </div>
                    
                    <!-- フッター -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">フッターテキスト</label>
                        <input type="text" id="footer_text" class="w-full px-3 py-2 border rounded-lg" placeholder="例: © 2024 株式会社サンプル All Rights Reserved.">
                    </div>
                </div>
            </div>
            
            <!-- プレビューモーダル -->
            <div id="previewModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden">
                    <div class="p-4 border-b flex justify-between items-center">
                        <h3 id="previewTitle" class="text-lg font-bold">プレビュー</h3>
                        <button onclick="closePreview()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <div id="previewContent" class="p-6 overflow-y-auto max-h-[60vh] prose prose-sm max-w-none">
                    </div>
                </div>
            </div>
            
            <!-- 保存ボタン -->
            <div class="flex justify-end gap-3">
                <a href="/" class="px-6 py-2 border rounded-lg hover:bg-gray-50">キャンセル</a>
                <button onclick="saveSettings()" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i class="fas fa-save mr-2"></i>保存
                </button>
            </div>
        </div>
        
        <script>
            ${sidebarScripts}
        </script>
        <script>
            const adminNameEl = document.getElementById('adminName');
            if (adminNameEl) adminNameEl.textContent = localStorage.getItem('admin_name') || '';
            
            // 設定値を取得するヘルパー
            function getSettingValue(settings, key) {
                if (settings[key]) {
                    return settings[key].value || settings[key] || '';
                }
                return '';
            }
            
            // 設定を読み込み
            async function loadSettings() {
                try {
                    const response = await axios.get('/api/settings');
                    const settings = response.data;
                    
                    // ヘルパー関数: 要素の値を安全に設定
                    const setValue = (id, value) => {
                        const el = document.getElementById(id);
                        if (el) el.value = value;
                    };
                    
                    // 銀行情報
                    setValue('bank_name', getSettingValue(settings, 'bank_name'));
                    setValue('bank_branch', getSettingValue(settings, 'bank_branch'));
                    setValue('bank_account_type', getSettingValue(settings, 'bank_account_type') || '普通');
                    setValue('bank_account_number', getSettingValue(settings, 'bank_account_number'));
                    setValue('bank_account_holder', getSettingValue(settings, 'bank_account_holder'));
                    
                    // 会社情報
                    setValue('company_name', getSettingValue(settings, 'company_name'));
                    setValue('company_address', getSettingValue(settings, 'company_address'));
                    setValue('company_phone', getSettingValue(settings, 'company_phone'));
                    setValue('company_email', getSettingValue(settings, 'company_email'));
                    setValue('company_representative', getSettingValue(settings, 'company_representative'));
                    setValue('company_registration', getSettingValue(settings, 'company_registration'));
                    setValue('invoice_registration_number', getSettingValue(settings, 'invoice_registration_number'));
                    
                    // 法務設定
                    setValue('company_website_url', getSettingValue(settings, 'company_website_url'));
                    setValue('privacy_policy_url', getSettingValue(settings, 'privacy_policy_url'));
                    setValue('terms_url', getSettingValue(settings, 'terms_url'));
                    setValue('legal_notice_url', getSettingValue(settings, 'legal_notice_url'));
                    setValue('privacy_policy', getSettingValue(settings, 'privacy_policy'));
                    setValue('legal_notice', getSettingValue(settings, 'legal_notice'));
                    setValue('terms_of_service', getSettingValue(settings, 'terms_of_service'));
                    setValue('footer_text', getSettingValue(settings, 'footer_text'));
                    
                    // 外部URL入力時にテキストエリアを薄く表示
                    if (typeof toggleContentVisibility === 'function') {
                        toggleContentVisibility();
                    }
                    
                    // Stripe（要素が存在する場合のみ）
                    const stripeEnabledEl = document.getElementById('stripe_enabled');
                    if (stripeEnabledEl) {
                        const stripeEnabled = getSettingValue(settings, 'stripe_enabled');
                        stripeEnabledEl.checked = stripeEnabled === 'true' || stripeEnabled === true;
                    }
                } catch (error) {
                    console.error('Error loading settings:', error);
                }
            }
            
            // 設定を保存
            async function saveSettings() {
                try {
                    // ヘルパー関数: 要素の値を安全に取得
                    const getValue = (id) => {
                        const el = document.getElementById(id);
                        return el ? el.value : '';
                    };
                    
                    const settings = {
                        // 銀行情報
                        bank_name: getValue('bank_name'),
                        bank_branch: getValue('bank_branch'),
                        bank_account_type: getValue('bank_account_type'),
                        bank_account_number: getValue('bank_account_number'),
                        bank_account_holder: getValue('bank_account_holder'),
                        // 会社情報
                        company_name: getValue('company_name'),
                        company_address: getValue('company_address'),
                        company_phone: getValue('company_phone'),
                        company_email: getValue('company_email'),
                        company_representative: getValue('company_representative'),
                        company_registration: getValue('company_registration'),
                        invoice_registration_number: getValue('invoice_registration_number'),
                        // 法務設定 - 外部URL
                        company_website_url: getValue('company_website_url'),
                        privacy_policy_url: getValue('privacy_policy_url'),
                        terms_url: getValue('terms_url'),
                        legal_notice_url: getValue('legal_notice_url'),
                        // 法務設定 - 内部コンテンツ
                        privacy_policy: getValue('privacy_policy'),
                        legal_notice: getValue('legal_notice'),
                        terms_of_service: getValue('terms_of_service'),
                        footer_text: getValue('footer_text')
                    };
                    
                    // Stripe（要素が存在する場合のみ）
                    const stripeEnabledEl = document.getElementById('stripe_enabled');
                    if (stripeEnabledEl) {
                        settings.stripe_enabled = stripeEnabledEl.checked ? 'true' : 'false';
                    }
                    
                    await axios.put('/api/settings', settings);
                    alert('設定を保存しました');
                } catch (error) {
                    console.error('Error saving settings:', error);
                    alert('設定の保存に失敗しました');
                }
            }
            
            // Markdownを簡易的にHTMLに変換
            function simpleMarkdown(text) {
                if (!text) return '';
                return text
                    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
                    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
                    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
                    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
                    .replace(/\\n/g, '<br>');
            }
            
            // プライバシーポリシーのプレビュー
            function previewPrivacyPolicy() {
                const content = document.getElementById('privacy_policy').value;
                document.getElementById('previewTitle').textContent = 'プライバシーポリシー プレビュー';
                document.getElementById('previewContent').innerHTML = simpleMarkdown(content);
                document.getElementById('previewModal').classList.remove('hidden');
            }
            
            // 特商法のプレビュー
            function previewLegalNotice() {
                const content = document.getElementById('legal_notice').value;
                document.getElementById('previewTitle').textContent = '特定商取引法に基づく表記 プレビュー';
                document.getElementById('previewContent').innerHTML = simpleMarkdown(content);
                document.getElementById('previewModal').classList.remove('hidden');
            }
            
            // 利用規約のプレビュー
            function previewTerms() {
                const content = document.getElementById('terms_of_service').value;
                document.getElementById('previewTitle').textContent = '利用規約 プレビュー';
                document.getElementById('previewContent').innerHTML = simpleMarkdown(content);
                document.getElementById('previewModal').classList.remove('hidden');
            }
            
            // 外部URL入力時にコンテンツエリアの表示を切り替え
            function toggleContentVisibility() {
                const privacyUrl = document.getElementById('privacy_policy_url').value;
                const termsUrl = document.getElementById('terms_url').value;
                const legalUrl = document.getElementById('legal_notice_url').value;
                
                const privacyContent = document.getElementById('privacy_policy_content');
                const termsContent = document.getElementById('terms_content');
                const legalContent = document.getElementById('legal_notice_content');
                
                privacyContent.style.opacity = privacyUrl ? '0.5' : '1';
                termsContent.style.opacity = termsUrl ? '0.5' : '1';
                legalContent.style.opacity = legalUrl ? '0.5' : '1';
            }
            
            // URL入力フィールドの変更を監視
            document.getElementById('privacy_policy_url').addEventListener('input', toggleContentVisibility);
            document.getElementById('terms_url').addEventListener('input', toggleContentVisibility);
            document.getElementById('legal_notice_url').addEventListener('input', toggleContentVisibility);
            
            // プレビューを閉じる
            function closePreview() {
                document.getElementById('previewModal').classList.add('hidden');
            }
            
            // 法務文書テンプレートを適用
            async function applyLegalTemplates() {
                if (!confirm('法務文書テンプレートを適用しますか？\\n\\n現在入力されている内容は上書きされます。\\n（SaaS事業者に有利な免責条項を含む内容です）')) {
                    return;
                }
                
                try {
                    const response = await axios.get('/api/legal-templates');
                    const templates = response.data;
                    
                    document.getElementById('terms_of_service').value = templates.terms_of_service;
                    document.getElementById('privacy_policy').value = templates.privacy_policy;
                    document.getElementById('legal_notice').value = templates.legal_notice;
                    
                    alert('テンプレートを適用しました。\\n\\n必要に応じて内容を編集し、「保存」ボタンをクリックしてください。');
                } catch (error) {
                    console.error('Error applying templates:', error);
                    alert('テンプレートの適用に失敗しました');
                }
            }
            
            // グローバルスコープに関数を公開（onclick対応）
            window.previewPrivacyPolicy = previewPrivacyPolicy;
            window.previewLegalNotice = previewLegalNotice;
            window.previewTerms = previewTerms;
            window.closePreview = closePreview;
            window.saveSettings = saveSettings;
            window.applyLegalTemplates = applyLegalTemplates;
            
            // 資格情報の読み込み
            async function loadLicenseInfo() {
                try {
                    const response = await axios.get('/api/organizations/current');
                    const org = response.data;
                    
                    // ヘルパー関数
                    const setValue = (id, value) => {
                        const el = document.getElementById(id);
                        if (el) el.value = value || '';
                    };
                    
                    // 行政書士資格
                    setValue('gyoseishoshi_license_number', org.gyoseishoshi_license_number);
                    setValue('gyoseishoshi_license_name', org.gyoseishoshi_license_name);
                    setValue('gyoseishoshi_registered_at', org.gyoseishoshi_registered_at);
                    
                    // 社労士資格
                    setValue('sharoshi_license_number', org.sharoshi_license_number);
                    setValue('sharoshi_license_name', org.sharoshi_license_name);
                    setValue('sharoshi_registered_at', org.sharoshi_registered_at);
                    
                    // 書類作成モード
                    const mode = org.document_creation_mode || 'client_self';
                    const modeRadio = document.querySelector(\`input[name="document_creation_mode"][value="\${mode}"]\`);
                    if (modeRadio) modeRadio.checked = true;
                    
                    // 確認済みバッジの表示
                    if (org.license_verified) {
                        document.getElementById('licenseVerifiedBadge').classList.remove('hidden');
                    }
                    
                    // 資格がない場合は代行作成モードを無効化
                    updateLicenseModeAvailability();
                } catch (error) {
                    console.error('Error loading license info:', error);
                }
            }
            
            // 資格有無に基づいてモード選択肢を更新
            function updateLicenseModeAvailability() {
                const gyosei = document.getElementById('gyoseishoshi_license_number')?.value;
                const sharoshi = document.getElementById('sharoshi_license_number')?.value;
                const hasLicense = gyosei || sharoshi;
                
                const licensedOption = document.getElementById('licensedModeOption');
                const bothOption = document.getElementById('bothModeOption');
                
                if (!hasLicense) {
                    // 資格がない場合、代行作成モードを無効化
                    licensedOption.classList.add('opacity-50', 'pointer-events-none');
                    bothOption.classList.add('opacity-50', 'pointer-events-none');
                    licensedOption.querySelector('input').disabled = true;
                    bothOption.querySelector('input').disabled = true;
                    
                    // 強制的に顧客自己作成モードを選択
                    document.querySelector('input[name="document_creation_mode"][value="client_self"]').checked = true;
                } else {
                    licensedOption.classList.remove('opacity-50', 'pointer-events-none');
                    bothOption.classList.remove('opacity-50', 'pointer-events-none');
                    licensedOption.querySelector('input').disabled = false;
                    bothOption.querySelector('input').disabled = false;
                }
            }
            
            // 資格情報を保存
            async function saveLicenseInfo() {
                try {
                    // 保存前にモード選択肢を更新
                    updateLicenseModeAvailability();
                    
                    const getValue = (id) => {
                        const el = document.getElementById(id);
                        return el ? el.value : '';
                    };
                    
                    const selectedMode = document.querySelector('input[name="document_creation_mode"]:checked')?.value || 'client_self';
                    
                    const licenseData = {
                        gyoseishoshi_license_number: getValue('gyoseishoshi_license_number'),
                        gyoseishoshi_license_name: getValue('gyoseishoshi_license_name'),
                        gyoseishoshi_registered_at: getValue('gyoseishoshi_registered_at'),
                        sharoshi_license_number: getValue('sharoshi_license_number'),
                        sharoshi_license_name: getValue('sharoshi_license_name'),
                        sharoshi_registered_at: getValue('sharoshi_registered_at'),
                        document_creation_mode: selectedMode
                    };
                    
                    await axios.put('/api/organizations/current/licenses', licenseData);
                    
                    // 確認済みバッジを非表示にする（新しい情報は再確認が必要）
                    document.getElementById('licenseVerifiedBadge').classList.add('hidden');
                    
                    alert('資格情報を保存しました。\\n\\n※資格情報の変更は管理者による確認後に有効になります。');
                } catch (error) {
                    console.error('Error saving license info:', error);
                    if (error.response?.status === 403) {
                        alert('権限がありません。管理者またはオーナーのみが資格情報を更新できます。');
                    } else {
                        alert('資格情報の保存に失敗しました');
                    }
                }
            }
            
            // 資格番号入力時のリアルタイム更新
            document.getElementById('gyoseishoshi_license_number')?.addEventListener('input', updateLicenseModeAvailability);
            document.getElementById('sharoshi_license_number')?.addEventListener('input', updateLicenseModeAvailability);
            
            window.saveLicenseInfo = saveLicenseInfo;
            
            loadSettings();
            loadLicenseInfo();
        </script>
    </body>
    </html>
  `)
})

// 支払い管理画面（タブ形式）
routes.get('/admin/payments', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>支払い管理 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <style>
            ${sidebarStyles}
            .tab-active { border-bottom: 2px solid #3b82f6; color: #3b82f6; }
            .tab-inactive { border-bottom: 2px solid transparent; color: #6b7280; }
            .tab-inactive:hover { color: #374151; background-color: #f3f4f6; }
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('payments')}
            
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-credit-card mr-2"></i>支払い管理
                            </h2>
                        </div>
                        <button onclick="loadAllData()" class="text-blue-600 hover:text-blue-800">
                            <i class="fas fa-sync-alt"></i> 更新
                        </button>
                    </div>
                </header>

                <div class="p-4 lg:p-6">
                    <!-- サマリーカード -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-sm text-gray-500">振込待ち</div>
                                    <div id="summaryWaiting" class="text-2xl font-bold text-blue-600">0件</div>
                                    <div id="summaryWaitingAmount" class="text-xs text-gray-400">¥0</div>
                                </div>
                                <i class="fas fa-clock text-blue-200 text-3xl"></i>
                            </div>
                        </div>
                        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-sm text-gray-500">確認待ち</div>
                                    <div id="summaryPending" class="text-2xl font-bold text-yellow-600">0件</div>
                                    <div id="summaryPendingAmount" class="text-xs text-gray-400">¥0</div>
                                </div>
                                <i class="fas fa-hourglass-half text-yellow-200 text-3xl"></i>
                            </div>
                        </div>
                        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="text-sm text-gray-500">支払い済み（今月）</div>
                                    <div id="summaryPaid" class="text-2xl font-bold text-green-600">0件</div>
                                    <div id="summaryPaidAmount" class="text-xs text-gray-400">¥0</div>
                                </div>
                                <i class="fas fa-check-circle text-green-200 text-3xl"></i>
                            </div>
                        </div>
                    </div>
                    
                    <!-- タブ -->
                    <div class="bg-white rounded-lg shadow">
                        <div class="border-b">
                            <nav class="flex">
                                <button onclick="switchTab('waiting')" id="tabWaiting" class="flex-1 px-4 py-3 text-sm font-medium tab-active">
                                    <i class="fas fa-clock mr-2"></i>振込待ち
                                    <span id="tabWaitingCount" class="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">0</span>
                                </button>
                                <button onclick="switchTab('pending')" id="tabPending" class="flex-1 px-4 py-3 text-sm font-medium tab-inactive">
                                    <i class="fas fa-hourglass-half mr-2"></i>確認待ち
                                    <span id="tabPendingCount" class="ml-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">0</span>
                                </button>
                                <button onclick="switchTab('paid')" id="tabPaid" class="flex-1 px-4 py-3 text-sm font-medium tab-inactive">
                                    <i class="fas fa-check-circle mr-2"></i>支払い済み
                                    <span id="tabPaidCount" class="ml-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">0</span>
                                </button>
                            </nav>
                        </div>
                        
                        <!-- タブコンテンツ -->
                        <div id="contentWaiting" class="p-4">
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                <p>読み込み中...</p>
                            </div>
                        </div>
                        <div id="contentPending" class="p-4 hidden">
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                <p>読み込み中...</p>
                            </div>
                        </div>
                        <div id="contentPaid" class="p-4 hidden">
                            <div class="flex justify-end mb-3">
                                <select id="paidFilter" onchange="loadPaidInvoices()" class="text-sm border rounded px-3 py-1.5">
                                    <option value="month">今月</option>
                                    <option value="all">すべて</option>
                                </select>
                            </div>
                            <div id="paidList">
                                <div class="text-center py-8 text-gray-500">
                                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                    <p>読み込み中...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <script>
            ${sidebarScripts}
        </script>
        <script>
            let currentTab = 'waiting';
            
            function switchTab(tabName) {
                currentTab = tabName;
                ['waiting', 'pending', 'paid'].forEach(t => {
                    document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1)).className = 
                        t === tabName ? 'flex-1 px-4 py-3 text-sm font-medium tab-active' : 'flex-1 px-4 py-3 text-sm font-medium tab-inactive';
                    document.getElementById('content' + t.charAt(0).toUpperCase() + t.slice(1)).className = 
                        t === tabName ? 'p-4' : 'p-4 hidden';
                });
            }
            
            // 期日計算ヘルパー
            function getDueDateInfo(dueDate) {
                if (!dueDate) return { class: 'text-gray-500', icon: 'fa-calendar', label: '期限未設定', badge: '' };
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const due = new Date(dueDate);
                due.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) {
                    return { class: 'text-red-600 font-bold', icon: 'fa-exclamation-circle', label: due.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }), badge: Math.abs(diffDays) + '日超過', badgeClass: 'bg-red-100 text-red-700' };
                } else if (diffDays === 0) {
                    return { class: 'text-red-600 font-bold', icon: 'fa-exclamation-triangle', label: '本日期限', badge: '本日', badgeClass: 'bg-red-100 text-red-700' };
                } else if (diffDays <= 3) {
                    return { class: 'text-orange-600', icon: 'fa-clock', label: due.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }), badge: 'あと' + diffDays + '日', badgeClass: 'bg-orange-100 text-orange-700' };
                } else if (diffDays <= 7) {
                    return { class: 'text-yellow-600', icon: 'fa-calendar-alt', label: due.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }), badge: 'あと' + diffDays + '日', badgeClass: 'bg-yellow-100 text-yellow-700' };
                }
                return { class: 'text-gray-600', icon: 'fa-calendar', label: due.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }), badge: '', badgeClass: '' };
            }
            
            // 振込待ちを読み込む（issued/sent）
            async function loadWaitingInvoices() {
                try {
                    const response = await axios.get('/api/invoices/pending-payments');
                    const invoices = response.data || [];
                    
                    document.getElementById('tabWaitingCount').textContent = invoices.length;
                    document.getElementById('summaryWaiting').textContent = invoices.length + '件';
                    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
                    document.getElementById('summaryWaitingAmount').textContent = '¥' + totalAmount.toLocaleString();
                    
                    if (invoices.length === 0) {
                        document.getElementById('contentWaiting').innerHTML = \`
                            <div class="text-center py-12 text-gray-500">
                                <i class="fas fa-inbox text-5xl text-gray-300 mb-4"></i>
                                <p class="text-lg">振込待ちの請求書はありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    document.getElementById('contentWaiting').innerHTML = \`
                        <div class="space-y-3">
                            \${invoices.map(inv => {
                                const dueInfo = getDueDateInfo(inv.due_date);
                                return \`
                                    <div class="border rounded-lg p-4 hover:shadow-md transition bg-white">
                                        <div class="flex items-start justify-between gap-4">
                                            <div class="flex items-start gap-3">
                                                <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <i class="fas fa-file-invoice-dollar text-blue-600"></i>
                                                </div>
                                                <div>
                                                    <div class="font-medium text-gray-800">\${inv.client_name || '顧客名未設定'}</div>
                                                    <div class="text-sm text-gray-500">\${inv.company_name || ''}</div>
                                                    <div class="text-xs text-gray-400 mt-1">
                                                        <span class="mr-2">\${inv.invoice_number || '-'}</span>
                                                        <span class="px-1.5 py-0.5 rounded \${inv.status === 'sent' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                                                            \${inv.status === 'sent' ? '送付済' : '発行済'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="text-right flex-shrink-0">
                                                <div class="font-bold text-lg text-gray-800">¥\${(inv.total_amount || 0).toLocaleString()}</div>
                                                <div class="\${dueInfo.class} text-sm flex items-center justify-end gap-1 mt-1">
                                                    <i class="fas \${dueInfo.icon}"></i>
                                                    <span>\${dueInfo.label}</span>
                                                    \${dueInfo.badge ? \`<span class="ml-1 px-1.5 py-0.5 rounded text-xs \${dueInfo.badgeClass}">\${dueInfo.badge}</span>\` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="mt-3 pt-3 border-t flex justify-end gap-2">
                                            <a href="/case/\${inv.case_id}" class="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                                                <i class="fas fa-external-link-alt mr-1"></i>案件詳細
                                            </a>
                                        </div>
                                    </div>
                                \`;
                            }).join('')}
                        </div>
                    \`;
                } catch (error) {
                    console.error('Error:', error);
                }
            }
            
            // 確認待ちを読み込む（payment_reported）
            async function loadPendingInvoices() {
                try {
                    const response = await axios.get('/api/payments/pending');
                    const payments = response.data || [];
                    
                    document.getElementById('tabPendingCount').textContent = payments.length;
                    document.getElementById('summaryPending').textContent = payments.length + '件';
                    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                    document.getElementById('summaryPendingAmount').textContent = '¥' + totalAmount.toLocaleString();
                    
                    if (payments.length === 0) {
                        document.getElementById('contentPending').innerHTML = \`
                            <div class="text-center py-12 text-gray-500">
                                <i class="fas fa-check-circle text-5xl text-green-300 mb-4"></i>
                                <p class="text-lg">確認待ちの支払いはありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    document.getElementById('contentPending').innerHTML = \`
                        <div class="space-y-3">
                            \${payments.map(p => {
                                const isInvoice = p.source === 'invoices';
                                return \`
                                    <div class="border rounded-lg p-4 hover:shadow-md transition bg-yellow-50 border-yellow-200">
                                        <div class="flex items-start justify-between gap-4">
                                            <div class="flex items-start gap-3">
                                                <div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                                                    <i class="fas fa-hourglass-half text-yellow-600"></i>
                                                </div>
                                                <div>
                                                    <div class="font-medium text-gray-800">\${p.client_name || '顧客名未設定'}</div>
                                                    <div class="text-sm text-gray-500">\${p.company_name || ''}</div>
                                                    \${isInvoice ? \`
                                                        <div class="text-xs text-blue-600 mt-1">
                                                            <i class="fas fa-file-invoice mr-1"></i>\${p.invoice_number || '-'} - \${p.item_name || ''}
                                                        </div>
                                                    \` : ''}
                                                    <div class="text-xs text-gray-400 mt-1">
                                                        <i class="fas fa-clock mr-1"></i>報告日時: \${p.bank_transfer_reported_at ? new Date(p.bank_transfer_reported_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="text-right flex-shrink-0">
                                                <div class="font-bold text-lg text-yellow-700">¥\${(p.amount || 0).toLocaleString()}</div>
                                                <div class="text-xs text-gray-500 mt-1">
                                                    <span class="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">振込報告済</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="mt-3 pt-3 border-t border-yellow-200 flex justify-end gap-2">
                                            \${isInvoice && p.case_id ? \`
                                                <a href="/case/\${p.case_id}" class="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                                                    <i class="fas fa-external-link-alt mr-1"></i>案件詳細
                                                </a>
                                            \` : ''}
                                            <button onclick="confirmPayment(\${p.id}, '\${p.source || 'payment_history'}')" class="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                                                <i class="fas fa-check mr-1"></i>入金確認
                                            </button>
                                        </div>
                                    </div>
                                \`;
                            }).join('')}
                        </div>
                    \`;
                } catch (error) {
                    console.error('Error:', error);
                }
            }
            
            // 支払い済みを読み込む
            async function loadPaidInvoices() {
                try {
                    const filter = document.getElementById('paidFilter').value;
                    const response = await axios.get('/api/payments/history?type=all&period=' + filter);
                    const payments = response.data || [];
                    
                    document.getElementById('tabPaidCount').textContent = payments.length;
                    if (filter === 'month') {
                        document.getElementById('summaryPaid').textContent = payments.length + '件';
                        const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                        document.getElementById('summaryPaidAmount').textContent = '¥' + totalAmount.toLocaleString();
                    }
                    
                    if (payments.length === 0) {
                        document.getElementById('paidList').innerHTML = \`
                            <div class="text-center py-12 text-gray-500">
                                <i class="fas fa-inbox text-5xl text-gray-300 mb-4"></i>
                                <p class="text-lg">支払い履歴がありません</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    document.getElementById('paidList').innerHTML = \`
                        <div class="space-y-3">
                            \${payments.map(p => {
                                const isInvoice = p.source === 'invoices';
                                return \`
                                    <div class="border rounded-lg p-4 hover:shadow-md transition bg-green-50 border-green-200">
                                        <div class="flex items-start justify-between gap-4">
                                            <div class="flex items-start gap-3">
                                                <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                                    <i class="fas fa-check text-green-600"></i>
                                                </div>
                                                <div>
                                                    <div class="font-medium text-gray-800">\${p.client_name || '顧客名未設定'}</div>
                                                    <div class="text-sm text-gray-500">\${p.company_name || ''}</div>
                                                    \${isInvoice && p.invoice_number ? \`
                                                        <div class="text-xs text-blue-600 mt-1">
                                                            <i class="fas fa-file-invoice mr-1"></i>\${p.invoice_number}\${p.item_name ? ' - ' + p.item_name : ''}
                                                        </div>
                                                    \` : ''}
                                                    <div class="text-xs text-gray-400 mt-1">
                                                        案件: \${p.case_number || '-'} | \${p.subsidy_type_name || '申請種別未設定'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="text-right flex-shrink-0">
                                                <div class="font-bold text-lg text-green-600">¥\${(p.amount || 0).toLocaleString()}</div>
                                                <div class="text-xs text-gray-500 mt-1">
                                                    <span class="px-1.5 py-0.5 rounded \${p.payment_type === 'deposit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}">
                                                        \${p.payment_type === 'deposit' ? '手付金' : '成功報酬'}
                                                    </span>
                                                </div>
                                                <div class="text-xs text-gray-400 mt-1">
                                                    \${p.confirmed_at ? new Date(p.confirmed_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) + ' 確認' : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                \`;
                            }).join('')}
                        </div>
                    \`;
                } catch (error) {
                    console.error('Error:', error);
                }
            }
            
            async function confirmPayment(paymentId, source = 'payment_history') {
                if (!confirm('この支払いを確認済みにしますか？')) return;
                
                try {
                    await axios.put(\`/api/payments/\${paymentId}/confirm\`, { source });
                    alert('支払いを確認しました');
                    loadAllData();
                } catch (error) {
                    alert('エラーが発生しました');
                }
            }
            
            async function loadAllData() {
                await Promise.all([
                    loadWaitingInvoices(),
                    loadPendingInvoices(),
                    loadPaidInvoices()
                ]);
            }
            
            // グローバルスコープに関数を公開
            window.switchTab = switchTab;
            window.loadWaitingInvoices = loadWaitingInvoices;
            window.loadPendingInvoices = loadPendingInvoices;
            window.loadPaidInvoices = loadPaidInvoices;
            window.confirmPayment = confirmPayment;
            window.loadAllData = loadAllData;
            
            // 初期読み込み
            loadAllData();
        </script>
    </body>
    </html>
  `)
})

export default routes
