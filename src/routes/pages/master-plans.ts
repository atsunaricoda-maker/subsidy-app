import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'
// プラン管理ページ
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/master/plans', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>プラン管理 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('plans')}
            
            <main class="flex-1 p-8 lg:ml-64">
                <div class="flex justify-between items-center mb-8">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-800">プラン管理</h1>
                        <p class="text-gray-600 mt-1">料金プランの設定・管理</p>
                    </div>
                    <button onclick="openAddPlanModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        <i class="fas fa-plus mr-2"></i>プランを追加
                    </button>
                </div>
                
                <div id="planList" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div class="animate-pulse h-48 bg-gray-200 rounded-xl"></div>
                    <div class="animate-pulse h-48 bg-gray-200 rounded-xl"></div>
                    <div class="animate-pulse h-48 bg-gray-200 rounded-xl"></div>
                </div>
            </main>
        </div>
        
        <!-- プラン編集モーダル -->
        <div id="editPlanModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
            <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold" id="planModalTitle">プランを編集</h3>
                        <button onclick="closePlanModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <form id="planForm" class="p-6 space-y-4">
                    <input type="hidden" id="plan_id">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">プランコード</label>
                        <input type="text" id="plan_code" required class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">プラン名</label>
                        <input type="text" id="plan_name" required class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">月額料金（円）</label>
                        <input type="number" id="plan_price" required min="0" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">月間枠数（-1で無制限）</label>
                        <input type="number" id="plan_slots" required min="-1" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">最大スタッフ数</label>
                        <input type="number" id="plan_max_staff" min="1" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">説明</label>
                        <input type="text" id="plan_description" class="w-full px-3 py-2 border rounded-lg">
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="checkbox" id="plan_is_active" class="rounded">
                        <label for="plan_is_active" class="text-sm text-gray-700">有効</label>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="closePlanModal()" class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">キャンセル</button>
                        <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存</button>
                    </div>
                </form>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${masterSidebarScripts}
            
            async function loadPlans() {
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.get('/api/master/plans', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const plans = response.data;
                    
                    document.getElementById('planList').innerHTML = plans.map(plan => \`
                        <div class="bg-white rounded-xl shadow-sm p-6 \${!plan.is_active ? 'opacity-60' : ''}">
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <span class="text-xs font-mono bg-gray-100 px-2 py-1 rounded">\${plan.plan_code}</span>
                                    <h3 class="text-xl font-bold mt-2">\${plan.plan_name}</h3>
                                </div>
                                <span class="text-xs px-2 py-1 rounded \${plan.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                                    \${plan.is_active ? '有効' : '無効'}
                                </span>
                            </div>
                            <p class="text-3xl font-bold text-blue-600 mb-2">
                                \${plan.monthly_price > 0 ? '¥' + plan.monthly_price.toLocaleString() : '要相談'}
                                <span class="text-sm font-normal text-gray-500">/月</span>
                            </p>
                            <div class="space-y-1 text-sm text-gray-600 mb-4">
                                <p><i class="fas fa-box w-5"></i> \${plan.monthly_slots > 0 ? plan.monthly_slots + '枠/月' : '無制限'}</p>
                                <p><i class="fas fa-users w-5"></i> 最大\${plan.max_staff || '∞'}人</p>
                                <p class="text-gray-400">\${plan.description || ''}</p>
                            </div>
                            <div class="flex justify-between items-center pt-4 border-t">
                                <span class="text-sm text-gray-500">\${plan.subscriber_count || 0}社が利用中</span>
                                <button onclick="editPlan(\${plan.id})" class="text-blue-600 hover:underline text-sm">
                                    <i class="fas fa-edit mr-1"></i>編集
                                </button>
                            </div>
                        </div>
                    \`).join('');
                } catch (error) {
                    console.error('Load error:', error);
                }
            }
            
            let editingPlanId = null;
            let plans = [];
            
            function openAddPlanModal() {
                editingPlanId = null;
                document.getElementById('planModalTitle').textContent = 'プランを追加';
                document.getElementById('planForm').reset();
                document.getElementById('plan_is_active').checked = true;
                document.getElementById('editPlanModal').classList.remove('hidden');
            }
            
            async function editPlan(id) {
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.get('/api/master/plans', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const plan = response.data.find(p => p.id === id);
                    if (!plan) return;
                    
                    editingPlanId = id;
                    document.getElementById('planModalTitle').textContent = 'プランを編集';
                    document.getElementById('plan_id').value = plan.id;
                    document.getElementById('plan_code').value = plan.plan_code;
                    document.getElementById('plan_name').value = plan.plan_name;
                    document.getElementById('plan_price').value = plan.monthly_price;
                    document.getElementById('plan_slots').value = plan.monthly_slots;
                    document.getElementById('plan_max_staff').value = plan.max_staff || '';
                    document.getElementById('plan_description').value = plan.description || '';
                    document.getElementById('plan_is_active').checked = plan.is_active;
                    document.getElementById('editPlanModal').classList.remove('hidden');
                } catch (error) {
                    alert('読み込みに失敗しました');
                }
            }
            
            function closePlanModal() {
                document.getElementById('editPlanModal').classList.add('hidden');
            }
            
            document.getElementById('planForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const token = localStorage.getItem('master_token');
                    const data = {
                        plan_code: document.getElementById('plan_code').value,
                        plan_name: document.getElementById('plan_name').value,
                        monthly_price: parseInt(document.getElementById('plan_price').value),
                        monthly_slots: parseInt(document.getElementById('plan_slots').value),
                        max_staff: parseInt(document.getElementById('plan_max_staff').value) || null,
                        description: document.getElementById('plan_description').value,
                        is_active: document.getElementById('plan_is_active').checked ? 1 : 0
                    };
                    
                    if (editingPlanId) {
                        await axios.put('/api/master/plans/' + editingPlanId, data, {
                            headers: { 'Authorization': 'Bearer ' + token }
                        });
                    } else {
                        await axios.post('/api/master/plans', data, {
                            headers: { 'Authorization': 'Bearer ' + token }
                        });
                    }
                    closePlanModal();
                    loadPlans();
                    alert('保存しました');
                } catch (error) {
                    alert(error.response?.data?.error || '保存に失敗しました');
                }
            });
            
            loadPlans();
        </script>
    </body>
    </html>
  `)
})

// プラン管理API
routes.get('/master/plans', async (c) => {
  const { DB } = c.env
  const plans = await DB.prepare(`
    SELECT sp.*, 
           (SELECT COUNT(*) FROM user_subscriptions us WHERE us.plan_id = sp.id AND us.status = 'active') as subscriber_count
    FROM subscription_plans sp
    ORDER BY sp.monthly_price ASC
  `).all()
  return c.json(plans?.results || [])
})

routes.post('/master/plans', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  await DB.prepare(`
    INSERT INTO subscription_plans (plan_code, plan_name, monthly_price, monthly_slots, max_staff, description, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.plan_code,
    data.plan_name,
    data.monthly_price,
    data.monthly_slots,
    data.max_staff,
    data.description,
    data.is_active
  ).run()
  
  return c.json({ success: true })
})

routes.put('/master/plans/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE subscription_plans SET 
      plan_code = ?, plan_name = ?, monthly_price = ?, monthly_slots = ?, 
      max_staff = ?, description = ?, is_active = ?
    WHERE id = ?
  `).bind(
    data.plan_code,
    data.plan_name,
    data.monthly_price,
    data.monthly_slots,
    data.max_staff,
    data.description,
    data.is_active,
    id
  ).run()
  
  return c.json({ success: true })
})

export default routes
