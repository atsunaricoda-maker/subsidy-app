import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'
// 操作ログページ
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/master/logs', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>操作ログ - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('logs')}
            
            <main class="flex-1 p-8 lg:ml-64">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-800">操作ログ</h1>
                    <p class="text-gray-600 mt-1">システム全体のアクティビティログ</p>
                </div>
                
                <div class="bg-white rounded-xl shadow-sm p-6">
                    <div class="flex gap-4 mb-6">
                        <select id="filterType" class="px-3 py-2 border rounded-lg" onchange="loadLogs()">
                            <option value="">すべての種類</option>
                            <option value="signup">新規登録</option>
                            <option value="login">ログイン</option>
                            <option value="plan_change">プラン変更</option>
                            <option value="slot_usage">枠消費</option>
                        </select>
                        <select id="filterOrg" class="px-3 py-2 border rounded-lg" onchange="loadLogs()">
                            <option value="">すべての法人</option>
                        </select>
                    </div>
                    
                    <div id="logList" class="space-y-2">
                        <div class="animate-pulse h-12 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </main>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${masterSidebarScripts}
            
            async function loadOrgs() {
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.get('/api/master/organizations', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const select = document.getElementById('filterOrg');
                    response.data.organizations.forEach(org => {
                        const option = document.createElement('option');
                        option.value = org.id;
                        option.textContent = org.name;
                        select.appendChild(option);
                    });
                } catch (error) {
                    console.error('Load orgs error:', error);
                }
            }
            
            async function loadLogs() {
                try {
                    const token = localStorage.getItem('master_token');
                    const type = document.getElementById('filterType').value;
                    const orgId = document.getElementById('filterOrg').value;
                    
                    const params = new URLSearchParams();
                    if (type) params.append('type', type);
                    if (orgId) params.append('org_id', orgId);
                    
                    const response = await axios.get('/api/master/logs?' + params.toString(), {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const logs = response.data;
                    
                    const icons = {
                        signup: 'fa-user-plus text-green-500',
                        login: 'fa-sign-in-alt text-blue-500',
                        plan_change: 'fa-exchange-alt text-purple-500',
                        slot_usage: 'fa-box text-yellow-500',
                        default: 'fa-circle text-gray-400'
                    };
                    
                    document.getElementById('logList').innerHTML = logs.map(log => \`
                        <div class="flex items-center gap-4 p-3 border-b hover:bg-gray-50">
                            <i class="fas \${icons[log.type] || icons.default} w-5"></i>
                            <div class="flex-1">
                                <p class="font-medium">\${log.message}</p>
                                <p class="text-sm text-gray-500">\${log.org_name || 'システム'}</p>
                            </div>
                            <span class="text-sm text-gray-400">\${new Date(log.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
                        </div>
                    \`).join('') || '<p class="text-gray-500 p-4">ログがありません</p>';
                    
                } catch (error) {
                    console.error('Load logs error:', error);
                    document.getElementById('logList').innerHTML = '<p class="text-gray-500 p-4">ログの読み込みに失敗しました</p>';
                }
            }
            
            loadOrgs();
            loadLogs();
        </script>
    </body>
    </html>
  `)
})

// 操作ログAPI
routes.get('/api/master/logs', async (c) => {
  const { DB } = c.env
  const type = c.req.query('type')
  const orgId = c.req.query('org_id')
  
  // slot_usage_historyから操作ログを取得
  let query = `
    SELECT 
      suh.id,
      'slot_usage' as type,
      CASE 
        WHEN suh.action = 'consumed' THEN '枠を消費: ' || suh.note
        WHEN suh.action = 'added' THEN '枠を追加: ' || suh.note
        ELSE suh.action || ': ' || COALESCE(suh.note, '')
      END as message,
      o.name as org_name,
      suh.created_at
    FROM slot_usage_history suh
    LEFT JOIN organizations o ON suh.organization_id = o.id
    WHERE 1=1
  `
  
  const bindings: any[] = []
  
  if (orgId) {
    query += ` AND suh.organization_id = ?`
    bindings.push(orgId)
  }
  
  query += ` ORDER BY suh.created_at DESC LIMIT 100`
  
  const logs = await DB.prepare(query).bind(...bindings).all()
  
  return c.json(logs?.results || [])
})

export default routes
