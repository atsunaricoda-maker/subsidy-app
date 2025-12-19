// 案件一覧ページ
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/cases', async (c) => {
  try {
    const { DB } = c.env
    const showArchived = c.req.query('archived') === 'true'
    const assignedTo = c.req.query('assigned_to') || ''
    const filterStatus = c.req.query('status') || ''
    
    // 担当者フィルター用：担当者名を取得
    let assignedToName = ''
    if (assignedTo) {
      if (assignedTo === '未割り当て') {
        assignedToName = '未割り当て'
      } else {
        const userResult = await DB.prepare('SELECT name FROM admin_users WHERE username = ?').bind(assignedTo).first() as any
        assignedToName = userResult?.name || assignedTo
      }
    }
    
    // casesテーブルから案件を取得
    let query = `
      SELECT 
        cs.id, cs.case_number, cs.status, cs.access_token, cs.created_at,
        cs.deposit_required, cs.deposit_amount, cs.deposit_paid,
        cs.success_fee_enabled, cs.success_fee_rate, cs.success_fee_amount,
        cs.is_archived, cs.result, cs.approved_amount, cs.result_date,
        cs.assigned_to,
        cl.id as client_id, cl.name as client_name, cl.company_name,
        st.name as subsidy_type_name, st.category as subsidy_category,
        au.name as assigned_to_name,
        (SELECT COUNT(*) FROM invoices WHERE invoices.case_id = cs.id AND invoices.invoice_type = 'success_fee') as success_fee_invoice_count,
        (SELECT status FROM invoices WHERE invoices.case_id = cs.id AND invoices.invoice_type = 'success_fee' ORDER BY created_at DESC LIMIT 1) as success_fee_invoice_status
      FROM cases cs
      LEFT JOIN clients cl ON cs.client_id = cl.id
      LEFT JOIN subsidy_types st ON cs.subsidy_type_id = st.id
      LEFT JOIN admin_users au ON cs.assigned_to = au.username
      WHERE (cs.is_archived = 0 OR cs.is_archived IS NULL)
      ORDER BY cs.created_at DESC
    `
    
    // アーカイブ表示の場合はアーカイブされた案件のみ表示
    if (showArchived) {
      query = `
        SELECT 
          cs.id, cs.case_number, cs.status, cs.access_token, cs.created_at,
          cs.deposit_required, cs.deposit_amount, cs.deposit_paid,
          cs.success_fee_enabled, cs.success_fee_rate, cs.success_fee_amount,
          cs.is_archived, cs.result, cs.approved_amount, cs.result_date,
          cs.assigned_to,
          cl.id as client_id, cl.name as client_name, cl.company_name,
          st.name as subsidy_type_name, st.category as subsidy_category,
          au.name as assigned_to_name,
          (SELECT COUNT(*) FROM invoices WHERE invoices.case_id = cs.id AND invoices.invoice_type = 'success_fee') as success_fee_invoice_count,
          (SELECT status FROM invoices WHERE invoices.case_id = cs.id AND invoices.invoice_type = 'success_fee' ORDER BY created_at DESC LIMIT 1) as success_fee_invoice_status
        FROM cases cs
        LEFT JOIN clients cl ON cs.client_id = cl.id
        LEFT JOIN subsidy_types st ON cs.subsidy_type_id = st.id
        LEFT JOIN admin_users au ON cs.assigned_to = au.username
        WHERE cs.is_archived = 1
        ORDER BY cs.created_at DESC
      `
    }
    
    let casesResult = await DB.prepare(query).all()
    let allCases = casesResult.results || []
    
    // 担当者フィルター適用
    if (assignedTo) {
      if (assignedTo === '未割り当て') {
        allCases = allCases.filter((c: any) => !c.assigned_to || c.assigned_to === '')
      } else {
        allCases = allCases.filter((c: any) => c.assigned_to === assignedTo)
      }
    }
    
    // ステータスフィルター適用
    if (filterStatus) {
      allCases = allCases.filter((c: any) => c.status === filterStatus)
    }
    
    const filteredCount = allCases.length
    
    // アーカイブ数を取得
    const archivedCountResult = await DB.prepare(`
      SELECT COUNT(*) as count FROM cases WHERE is_archived = 1
    `).first() as any
    const archivedCount = archivedCountResult?.count || 0
    
    // 担当者リスト取得（フィルター用）
    const adminUsersResult = await DB.prepare('SELECT username, name FROM admin_users ORDER BY name').all()
    const adminUsers = adminUsersResult.results || []
    
    // ステータス定義（完了済みは別途取得）
    const STATUSES = [
      { key: 'inquiry', label: '見込み', color: 'yellow', icon: 'fa-lightbulb' },
      { key: 'preparing', label: '書類準備中', color: 'orange', icon: 'fa-file-alt' },
      { key: 'applying', label: '申請中', color: 'purple', icon: 'fa-paper-plane' },
      { key: 'adopted', label: '採択・入金待', color: 'blue', icon: 'fa-trophy' },
      { key: 'rejected', label: '不採択', color: 'red', icon: 'fa-times-circle' },
      { key: 'archived', label: '完了済み', color: 'green', icon: 'fa-check-circle', isArchived: true }
    ]
    
    // 完了済み（アーカイブ）案件を別途取得（最新10件）
    let archivedCasesQuery = `
      SELECT 
        cs.id, cs.case_number, cs.status, cs.access_token, cs.created_at,
        cs.deposit_required, cs.deposit_amount, cs.deposit_paid,
        cs.is_archived, cs.result, cs.approved_amount, cs.result_date,
        cs.assigned_to,
        cl.id as client_id, cl.name as client_name, cl.company_name,
        st.name as subsidy_type_name, st.category as subsidy_category,
        au.name as assigned_to_name
      FROM cases cs
      LEFT JOIN clients cl ON cs.client_id = cl.id
      LEFT JOIN subsidy_types st ON cs.subsidy_type_id = st.id
      LEFT JOIN admin_users au ON cs.assigned_to = au.username
      WHERE cs.is_archived = 1
      ORDER BY cs.updated_at DESC
      LIMIT 10
    `
    const archivedCasesResult = await DB.prepare(archivedCasesQuery).all()
    let archivedCases = archivedCasesResult.results || []
    
    // 担当者フィルターをアーカイブにも適用
    if (assignedTo) {
      if (assignedTo === '未割り当て') {
        archivedCases = archivedCases.filter((c: any) => !c.assigned_to || c.assigned_to === '')
      } else {
        archivedCases = archivedCases.filter((c: any) => c.assigned_to === assignedTo)
      }
    }
    
    // ステータスごとにグループ化
    const casesByStatus: Record<string, any[]> = {}
    STATUSES.forEach(s => casesByStatus[s.key] = [])
    casesByStatus['archived'] = archivedCases as any[]
    allCases.forEach((c: any) => {
      if (c.status && casesByStatus[c.status]) {
        casesByStatus[c.status].push(c)
      } else if (!c.is_archived) {
        casesByStatus['inquiry'].push(c)
      }
    })
    
    // カンバンボードHTML生成
    const kanbanHtml = STATUSES.map(status => {
      const statusCases = casesByStatus[status.key]
      const colorMap: Record<string, { bg: string; border: string; header: string; badge: string }> = {
        yellow: { bg: 'bg-yellow-50', border: 'border-yellow-300', header: 'bg-yellow-100 text-yellow-800', badge: 'bg-yellow-500' },
        blue: { bg: 'bg-blue-50', border: 'border-blue-300', header: 'bg-blue-100 text-blue-800', badge: 'bg-blue-500' },
        orange: { bg: 'bg-orange-50', border: 'border-orange-300', header: 'bg-orange-100 text-orange-800', badge: 'bg-orange-500' },
        purple: { bg: 'bg-purple-50', border: 'border-purple-300', header: 'bg-purple-100 text-purple-800', badge: 'bg-purple-500' },
        green: { bg: 'bg-green-50', border: 'border-green-300', header: 'bg-green-100 text-green-800', badge: 'bg-green-500' },
        red: { bg: 'bg-red-50', border: 'border-red-300', header: 'bg-red-100 text-red-800', badge: 'bg-red-500' }
      }
      const colors = colorMap[status.color]
      
      const cardsHtml = statusCases.length === 0 
        ? '<div class="text-center py-6 text-gray-400 text-sm">案件なし</div>'
        : statusCases.map((c: any) => {
          // 採択/不採択バッジ
          let resultBadge = ''
          if (c.result === 'approved') {
            resultBadge = '<span class="px-2 py-0.5 rounded text-xs bg-blue-500 text-white"><i class="fas fa-check mr-1"></i>採択</span>'
          } else if (c.result === 'rejected') {
            resultBadge = '<span class="px-2 py-0.5 rounded text-xs bg-red-500 text-white"><i class="fas fa-times mr-1"></i>不採択</span>'
          } else if (c.status === 'completed' && !c.result) {
            resultBadge = '<span class="px-2 py-0.5 rounded text-xs bg-gray-300 text-gray-700"><i class="fas fa-clock mr-1"></i>結果待ち</span>'
          }
          
          return `
          <a href="/case/${c.id}" class="block bg-white rounded-lg shadow-sm border hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
            <div class="p-3">
              <div class="flex items-center justify-between mb-2">
                <span class="font-mono text-xs text-gray-500">${c.case_number || '#' + c.id}</span>
                <div class="flex items-center gap-1">
                  ${c.deposit_required && !c.deposit_paid ? '<span class="text-yellow-600 text-xs" title="手付金未払"><i class="fas fa-yen-sign"></i></span>' : ''}
                  ${c.is_archived && status.key !== 'archived' ? '<span class="text-green-600 text-xs" title="完了済み"><i class="fas fa-check-circle"></i></span>' : ''}
                </div>
              </div>
              <div class="font-bold text-gray-900 mb-1">${c.client_name || '名称未設定'}</div>
              ${c.company_name ? '<div class="text-xs text-gray-500 mb-2">' + c.company_name + '</div>' : ''}
              <div class="flex flex-wrap gap-1 mb-2">
                ${c.subsidy_type_name ? '<span class="inline-block px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800">' + c.subsidy_type_name + '</span>' : ''}
                ${resultBadge}
              </div>
              ${c.approved_amount ? '<div class="text-xs text-blue-600 mb-2"><i class="fas fa-check-circle mr-1"></i>採択額: ¥' + c.approved_amount.toLocaleString() + '</div>' : ''}
              <div class="flex items-center gap-2 text-xs text-gray-500 mt-2">
                ${c.assigned_to_name ? '<span><i class="fas fa-user mr-1"></i>' + c.assigned_to_name + '</span>' : ''}
              </div>
              ${c.deposit_required ? '<div class="mt-2 text-xs ' + (c.deposit_paid ? 'text-green-600' : 'text-yellow-600') + '"><i class="fas fa-hand-holding-usd mr-1"></i>¥' + (c.deposit_amount || 0).toLocaleString() + (c.deposit_paid ? '<span class="ml-1">✓支払済</span>' : '<span class="ml-1">未払</span>') + '</div>' : ''}
              ${c.success_fee_enabled ? '<div class="mt-1 text-xs ' + (c.success_fee_invoice_status === 'paid' ? 'text-green-600' : (c.success_fee_invoice_status === 'payment_reported' ? 'text-purple-600' : (c.success_fee_invoice_count > 0 ? 'text-blue-600' : 'text-gray-400'))) + '"><i class="fas fa-trophy mr-1"></i>' + (c.success_fee_rate ? c.success_fee_rate + '%' : '¥' + (c.success_fee_amount || 0).toLocaleString()) + '<span class="ml-1">' + (c.success_fee_invoice_status === 'paid' ? '✓支払済' : (c.success_fee_invoice_status === 'payment_reported' ? '確認中' : (c.success_fee_invoice_count > 0 ? '請求中' : '未発行'))) + '</span></div>' : ''}
            </div>
          </a>
        `}).join('')
      
      // 完了済み列の場合、採択額の合計を計算
      const totalApprovedAmount = status.key === 'archived' 
        ? statusCases.reduce((sum: number, c: any) => sum + (c.approved_amount || 0), 0)
        : 0
      
      // 完了済み列のサブヘッダー（採択額合計と全件表示リンク）
      const archivedSubHeader = status.key === 'archived' ? `
        <div class="px-4 py-2 bg-green-50 border-b border-green-200 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-green-700">
              <i class="fas fa-coins mr-1"></i>採択総額: <strong>¥${totalApprovedAmount.toLocaleString()}</strong>
            </span>
            <a href="/cases?archived=true" class="text-green-600 hover:text-green-800 text-xs">
              全件表示 <i class="fas fa-external-link-alt ml-1"></i>
            </a>
          </div>
        </div>
      ` : ''
      
      return `
        <div class="flex flex-col rounded-lg ${colors.bg} border ${colors.border} overflow-hidden min-w-[280px]">
          <div class="${colors.header} px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="fas ${status.icon}"></i>
              <span class="font-bold">${status.label}</span>
            </div>
            <span class="${colors.badge} text-white text-xs px-2 py-0.5 rounded-full">${status.key === 'archived' ? archivedCount : statusCases.length}</span>
          </div>
          ${archivedSubHeader}
          <div class="p-3 space-y-3 flex-1 overflow-y-auto" style="max-height: calc(100vh - 250px);">
            ${cardsHtml}
          </div>
        </div>
      `
    }).join('')

  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>案件一覧 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
            .kanban-container {
                display: grid;
                grid-template-columns: repeat(5, minmax(280px, 1fr));
                gap: 1rem;
                overflow-x: auto;
                padding-bottom: 1rem;
            }
            @media (max-width: 1400px) {
                .kanban-container {
                    grid-template-columns: repeat(3, minmax(280px, 1fr));
                }
            }
            @media (max-width: 900px) {
                .kanban-container {
                    grid-template-columns: repeat(2, minmax(280px, 1fr));
                }
            }
            @media (max-width: 640px) {
                .kanban-container {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('cases')}
            
            <main class="flex-1 min-h-screen overflow-hidden flex flex-col">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-folder-open mr-2"></i>${showArchived ? '完了済み案件' : '案件一覧'}
                            </h2>
                            <span class="text-sm text-gray-500">${filteredCount}件</span>
                            ${assignedTo || filterStatus ? `
                                <a href="/cases${showArchived ? '?archived=true' : ''}" class="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full hover:bg-gray-300">
                                    <i class="fas fa-times mr-1"></i>フィルター解除
                                </a>
                            ` : ''}
                        </div>
                        <div class="flex items-center gap-3">
                            <!-- 担当者フィルター -->
                            <select id="assignedToFilter" onchange="filterByAssignee()" class="border rounded-lg px-3 py-2 text-sm bg-white">
                                <option value="">全担当者</option>
                                <option value="未割り当て" ${assignedTo === '未割り当て' ? 'selected' : ''}>未割り当て</option>
                                ${(adminUsers as any[]).map((u: any) => `<option value="${u.username}" ${assignedTo === u.username ? 'selected' : ''}>${u.name || u.username}</option>`).join('')}
                            </select>
                            ${showArchived ? `
                                <a href="/cases" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm">
                                    <i class="fas fa-arrow-left mr-2"></i>戻る
                                </a>
                            ` : `
                                <a href="/cases?archived=true${assignedTo ? '&assigned_to=' + encodeURIComponent(assignedTo) : ''}" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm" title="完了済み案件を表示">
                                    <i class="fas fa-check-circle mr-2"></i>完了済み${archivedCount > 0 ? ' (' + archivedCount + ')' : ''}
                                </a>
                            `}
                            <a href="/?openNewCase=true" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                <i class="fas fa-plus mr-2"></i>新規案件登録
                            </a>
                        </div>
                    </div>
                    ${assignedTo ? `
                        <div class="px-4 pb-3 border-t">
                            <div class="flex items-center gap-2 text-sm mt-2">
                                <span class="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">
                                    <i class="fas fa-user mr-1"></i>${assignedToName}の案件
                                </span>
                            </div>
                        </div>
                    ` : ''}
                </header>

                <div class="p-4 lg:p-6 flex-1 overflow-auto">
                    <!-- カンバンボード -->
                    <div class="kanban-container">
                        ${kanbanHtml}
                    </div>
                </div>
            </main>
        </div>
        
        <script>
            ${sidebarScripts}
            
            function filterByAssignee() {
                const select = document.getElementById('assignedToFilter');
                const assignedTo = select.value;
                const urlParams = new URLSearchParams(window.location.search);
                
                if (assignedTo) {
                    urlParams.set('assigned_to', assignedTo);
                } else {
                    urlParams.delete('assigned_to');
                }
                
                const newUrl = '/cases' + (urlParams.toString() ? '?' + urlParams.toString() : '');
                window.location.href = newUrl;
            }
        </script>
    </body>
    </html>
  `)
  } catch (error: any) {
    console.error('Cases page error:', error)
    return c.text('Error: ' + (error.message || 'Unknown error'), 500)
  }
})

export default routes
