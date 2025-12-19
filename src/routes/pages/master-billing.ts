import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'
// 売上・請求ページ
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/master/billing', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>売上・請求 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('billing')}
            
            <main class="flex-1 p-8">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-800">売上・請求</h1>
                    <p class="text-gray-600 mt-1">月次売上と請求状況の管理</p>
                </div>
                
                <!-- サマリーカード -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <p class="text-sm text-gray-500">今月の売上</p>
                        <p id="monthlyRevenue" class="text-3xl font-bold text-blue-600 mt-1">-</p>
                    </div>
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <p class="text-sm text-gray-500">アクティブ契約数</p>
                        <p id="activeCount" class="text-3xl font-bold text-green-600 mt-1">-</p>
                    </div>
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <p class="text-sm text-gray-500">トライアル中</p>
                        <p id="trialCount" class="text-3xl font-bold text-yellow-600 mt-1">-</p>
                    </div>
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <p class="text-sm text-gray-500">平均単価</p>
                        <p id="avgPrice" class="text-3xl font-bold text-purple-600 mt-1">-</p>
                    </div>
                </div>
                
                <!-- プラン別売上 -->
                <div class="bg-white rounded-xl shadow-sm p-6 mb-8">
                    <h2 class="text-lg font-semibold mb-4">プラン別売上</h2>
                    <div id="planRevenue" class="space-y-3">
                        <div class="animate-pulse h-8 bg-gray-200 rounded"></div>
                    </div>
                </div>
                
                <!-- 最近の契約 -->
                <div class="bg-white rounded-xl shadow-sm p-6">
                    <h2 class="text-lg font-semibold mb-4">最近の契約変更</h2>
                    <div id="recentSubscriptions" class="space-y-2">
                        <div class="animate-pulse h-12 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </main>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${masterSidebarScripts}
            
            async function loadBillingData() {
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.get('/api/master/billing', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = response.data;
                    
                    document.getElementById('monthlyRevenue').textContent = '¥' + (data.monthly_revenue || 0).toLocaleString();
                    document.getElementById('activeCount').textContent = data.active_count || 0;
                    document.getElementById('trialCount').textContent = data.trial_count || 0;
                    document.getElementById('avgPrice').textContent = '¥' + Math.round(data.avg_price || 0).toLocaleString();
                    
                    document.getElementById('planRevenue').innerHTML = data.plan_breakdown.map(p => \`
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <p class="font-medium">\${p.plan_name}</p>
                                <p class="text-sm text-gray-500">\${p.count}社</p>
                            </div>
                            <p class="font-bold text-blue-600">¥\${(p.revenue || 0).toLocaleString()}</p>
                        </div>
                    \`).join('') || '<p class="text-gray-500">データがありません</p>';
                    
                    document.getElementById('recentSubscriptions').innerHTML = data.recent_subscriptions.map(s => \`
                        <div class="flex items-center justify-between p-3 border-b">
                            <div>
                                <p class="font-medium">\${s.org_name}</p>
                                <p class="text-sm text-gray-500">\${s.plan_name}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-medium">¥\${(s.price || 0).toLocaleString()}/月</p>
                                <p class="text-xs text-gray-500">\${new Date(s.created_at).toLocaleDateString('ja-JP')}</p>
                            </div>
                        </div>
                    \`).join('') || '<p class="text-gray-500 p-3">データがありません</p>';
                    
                } catch (error) {
                    console.error('Load error:', error);
                }
            }
            
            loadBillingData();
        </script>
    </body>
    </html>
  `)
})

// 売上API
routes.get('/master/billing', async (c) => {
  const { DB } = c.env
  
  // 月次売上
  const revenue = await DB.prepare(`
    SELECT SUM(sp.monthly_price) as total
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.status = 'active'
  `).first()
  
  // アクティブ数
  const activeCount = await DB.prepare(`
    SELECT COUNT(*) as count FROM organizations WHERE status = 'active'
  `).first()
  
  // トライアル数
  const trialCount = await DB.prepare(`
    SELECT COUNT(*) as count FROM organizations WHERE status = 'trial'
  `).first()
  
  // プラン別内訳
  const planBreakdown = await DB.prepare(`
    SELECT sp.plan_name, COUNT(*) as count, SUM(sp.monthly_price) as revenue
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.status = 'active'
    GROUP BY sp.id
    ORDER BY revenue DESC
  `).all()
  
  // 最近の契約
  const recentSubs = await DB.prepare(`
    SELECT o.name as org_name, sp.plan_name, sp.monthly_price as price, us.created_at
    FROM user_subscriptions us
    JOIN organizations o ON us.organization_id = o.id
    JOIN subscription_plans sp ON us.plan_id = sp.id
    ORDER BY us.created_at DESC
    LIMIT 10
  `).all()
  
  return c.json({
    monthly_revenue: revenue?.total || 0,
    active_count: activeCount?.count || 0,
    trial_count: trialCount?.count || 0,
    avg_price: (revenue?.total || 0) / Math.max(1, activeCount?.count || 1),
    plan_breakdown: planBreakdown?.results || [],
    recent_subscriptions: recentSubs?.results || []
  })
})

export default routes
