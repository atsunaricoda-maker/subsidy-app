// 統計ページ
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/admin/statistics', async (c) => {
  const { DB } = c.env
  
  // 統計データを取得
  const totalClients = await DB.prepare('SELECT COUNT(*) as count FROM clients').first() as any
  const newThisMonth = await DB.prepare(`
    SELECT COUNT(*) as count FROM clients 
    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).first() as any
  const completedThisMonth = await DB.prepare(`
    SELECT COUNT(*) as count FROM clients 
    WHERE status = 'completed' AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')
  `).first() as any
  
  const byStatus = await DB.prepare(`
    SELECT status, COUNT(*) as count FROM clients GROUP BY status
  `).all()
  
  const bySubsidyType = await DB.prepare(`
    SELECT st.name, st.category, COUNT(c.id) as count
    FROM clients c
    LEFT JOIN subsidy_types st ON c.subsidy_type_id = st.id
    GROUP BY c.subsidy_type_id
    ORDER BY count DESC
    LIMIT 10
  `).all()
  
  const monthlyStats = await DB.prepare(`
    SELECT 
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as new_count,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
    FROM clients
    WHERE created_at >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month DESC
  `).all()
  
  // 支払い統計（月別）- invoicesテーブルから
  let monthlyPayments: any[] = []
  let yearlyPayments: any[] = []
  let totalPaymentThisMonth = { deposit: 0, success_fee: 0, total: 0 }
  let totalPaymentThisYear = { deposit: 0, success_fee: 0, total: 0 }
  
  try {
    // 月別支払い（過去12ヶ月）
    const monthlyPaymentsResult = await DB.prepare(`
      SELECT 
        strftime('%Y-%m', paid_at) as month,
        invoice_type,
        SUM(total_amount) as total,
        COUNT(*) as count
      FROM invoices
      WHERE status = 'paid' AND paid_at >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', paid_at), invoice_type
      ORDER BY month DESC
    `).all()
    monthlyPayments = monthlyPaymentsResult.results || []
    
    // 年別支払い（過去5年）
    const yearlyPaymentsResult = await DB.prepare(`
      SELECT 
        strftime('%Y', paid_at) as year,
        invoice_type,
        SUM(total_amount) as total,
        COUNT(*) as count
      FROM invoices
      WHERE status = 'paid' AND paid_at >= date('now', '-5 years')
      GROUP BY strftime('%Y', paid_at), invoice_type
      ORDER BY year DESC
    `).all()
    yearlyPayments = yearlyPaymentsResult.results || []
    
    // 今月の支払い合計
    const thisMonthPayments = await DB.prepare(`
      SELECT 
        invoice_type,
        SUM(total_amount) as total
      FROM invoices
      WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now')
      GROUP BY invoice_type
    `).all()
    
    for (const p of (thisMonthPayments.results || []) as any[]) {
      if (p.invoice_type === 'deposit') totalPaymentThisMonth.deposit = p.total || 0
      else if (p.invoice_type === 'success_fee') totalPaymentThisMonth.success_fee = p.total || 0
    }
    totalPaymentThisMonth.total = totalPaymentThisMonth.deposit + totalPaymentThisMonth.success_fee
    
    // 今年の支払い合計
    const thisYearPayments = await DB.prepare(`
      SELECT 
        invoice_type,
        SUM(total_amount) as total
      FROM invoices
      WHERE status = 'paid' AND strftime('%Y', paid_at) = strftime('%Y', 'now')
      GROUP BY invoice_type
    `).all()
    
    for (const p of (thisYearPayments.results || []) as any[]) {
      if (p.invoice_type === 'deposit') totalPaymentThisYear.deposit = p.total || 0
      else if (p.invoice_type === 'success_fee') totalPaymentThisYear.success_fee = p.total || 0
    }
    totalPaymentThisYear.total = totalPaymentThisYear.deposit + totalPaymentThisYear.success_fee
  } catch (e) {
    // invoicesテーブルがない場合は空
  }

  // Build HTML for status cards
  const labels: Record<string, string> = {
    inquiry: '見込み',
    preparing: '書類準備中',
    applying: '申請中',
    completed: '完了'
  }
  const colors: Record<string, string> = {
    inquiry: 'yellow',
    preparing: 'orange',
    applying: 'purple',
    completed: 'green'
  }
  
  const statusItemsHtml = (byStatus.results || []).map((item: any) => {
    const color = colors[item.status] || 'gray'
    const label = labels[item.status] || item.status
    return '<div class="flex items-center justify-between p-3 bg-' + color + '-50 rounded-lg">' +
      '<span class="text-sm font-medium text-' + color + '-800">' + label + '</span>' +
      '<span class="text-lg font-bold text-' + color + '-600">' + item.count + '</span>' +
    '</div>'
  }).join('')
  
  const subsidyTypeHtml = (bySubsidyType.results || []).map((item: any, index: number) => {
    return '<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">' +
      '<div class="flex items-center gap-3">' +
        '<span class="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">' + (index + 1) + '</span>' +
        '<span class="text-sm">' + (item.name || '未設定') + '</span>' +
      '</div>' +
      '<span class="text-lg font-bold text-gray-700">' + item.count + '</span>' +
    '</div>'
  }).join('')
  
  const monthlyStatsHtml = (monthlyStats.results || []).map((item: any) => {
    return '<tr class="border-b">' +
      '<td class="py-3 text-sm">' + item.month + '</td>' +
      '<td class="py-3 text-right"><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">' + item.new_count + '</span></td>' +
      '<td class="py-3 text-right"><span class="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">' + item.completed_count + '</span></td>' +
    '</tr>'
  }).join('')
  
  // 月別支払いデータを整形（月ごとにまとめる）
  const monthlyPaymentMap = new Map<string, { deposit: number, success_fee: number }>()
  for (const p of monthlyPayments as any[]) {
    if (!monthlyPaymentMap.has(p.month)) {
      monthlyPaymentMap.set(p.month, { deposit: 0, success_fee: 0 })
    }
    const data = monthlyPaymentMap.get(p.month)!
    if (p.invoice_type === 'deposit') data.deposit = p.total || 0
    else if (p.invoice_type === 'success_fee') data.success_fee = p.total || 0
  }
  
  const monthlyPaymentsHtml = Array.from(monthlyPaymentMap.entries()).map(([month, data]) => {
    const total = data.deposit + data.success_fee
    return '<tr class="border-b hover:bg-gray-50">' +
      '<td class="py-3 text-sm font-medium">' + month + '</td>' +
      '<td class="py-3 text-right"><span class="text-blue-600">¥' + data.deposit.toLocaleString() + '</span></td>' +
      '<td class="py-3 text-right"><span class="text-purple-600">¥' + data.success_fee.toLocaleString() + '</span></td>' +
      '<td class="py-3 text-right font-bold text-green-600">¥' + total.toLocaleString() + '</td>' +
    '</tr>'
  }).join('')
  
  // 年別支払いデータを整形
  const yearlyPaymentMap = new Map<string, { deposit: number, success_fee: number }>()
  for (const p of yearlyPayments as any[]) {
    if (!yearlyPaymentMap.has(p.year)) {
      yearlyPaymentMap.set(p.year, { deposit: 0, success_fee: 0 })
    }
    const data = yearlyPaymentMap.get(p.year)!
    if (p.invoice_type === 'deposit') data.deposit = p.total || 0
    else if (p.invoice_type === 'success_fee') data.success_fee = p.total || 0
  }
  
  const yearlyPaymentsHtml = Array.from(yearlyPaymentMap.entries()).map(([year, data]) => {
    const total = data.deposit + data.success_fee
    return '<tr class="border-b hover:bg-gray-50">' +
      '<td class="py-3 text-sm font-medium">' + year + '年</td>' +
      '<td class="py-3 text-right"><span class="text-blue-600">¥' + data.deposit.toLocaleString() + '</span></td>' +
      '<td class="py-3 text-right"><span class="text-purple-600">¥' + data.success_fee.toLocaleString() + '</span></td>' +
      '<td class="py-3 text-right font-bold text-green-600">¥' + total.toLocaleString() + '</td>' +
    '</tr>'
  }).join('')
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>統計情報 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('statistics')}
            
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-chart-line mr-2"></i>統計情報
                            </h2>
                        </div>
                    </div>
                </header>

                <div class="p-4 lg:p-6">
                    <!-- サマリーカード -->
                    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                        <div class="bg-white rounded-xl shadow-sm p-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-500 text-xs">総顧客数</p>
                                    <p class="text-2xl font-bold text-gray-900">${totalClients?.count || 0}</p>
                                </div>
                                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-users text-blue-600"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl shadow-sm p-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-500 text-xs">今月の新規</p>
                                    <p class="text-2xl font-bold text-blue-600">${newThisMonth?.count || 0}</p>
                                </div>
                                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-user-plus text-blue-600"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl shadow-sm p-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-500 text-xs">今月の完了</p>
                                    <p class="text-2xl font-bold text-green-600">${completedThisMonth?.count || 0}</p>
                                </div>
                                <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-check-circle text-green-600"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl shadow-sm p-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-500 text-xs">今月の売上</p>
                                    <p class="text-xl font-bold text-green-600">¥${totalPaymentThisMonth.total.toLocaleString()}</p>
                                </div>
                                <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-yen-sign text-green-600"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl shadow-sm p-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-500 text-xs">今年の売上</p>
                                    <p class="text-xl font-bold text-indigo-600">¥${totalPaymentThisYear.total.toLocaleString()}</p>
                                </div>
                                <div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <i class="fas fa-calendar-alt text-indigo-600"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-white rounded-xl shadow-sm p-4">
                            <div>
                                <p class="text-gray-500 text-xs mb-1">内訳（今月）</p>
                                <div class="flex gap-2 text-xs">
                                    <span class="text-blue-600">手付¥${totalPaymentThisMonth.deposit.toLocaleString()}</span>
                                    <span class="text-purple-600">報酬¥${totalPaymentThisMonth.success_fee.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 売上統計セクション -->
                    <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="text-lg font-bold flex items-center gap-2">
                                <i class="fas fa-coins text-yellow-500"></i>売上統計
                            </h2>
                            <div class="flex items-center gap-2">
                                <button onclick="switchView('chart')" id="btnChart" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white">
                                    <i class="fas fa-chart-bar mr-1"></i>グラフ
                                </button>
                                <button onclick="switchView('table')" id="btnTable" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-600 hover:bg-gray-300">
                                    <i class="fas fa-table mr-1"></i>表
                                </button>
                            </div>
                        </div>
                        
                        <!-- グラフ表示 -->
                        <div id="chartView" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div>
                                <h3 class="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                                    <i class="fas fa-calendar-week text-blue-500"></i>月別売上（過去12ヶ月）
                                </h3>
                                <div class="h-64">
                                    <canvas id="monthlyChart"></canvas>
                                </div>
                            </div>
                            <div>
                                <h3 class="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                                    <i class="fas fa-calendar-alt text-indigo-500"></i>年別売上（過去5年）
                                </h3>
                                <div class="h-64">
                                    <canvas id="yearlyChart"></canvas>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 表表示 -->
                        <div id="tableView" class="hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <!-- 月別売上 -->
                            <div>
                                <h3 class="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                                    <i class="fas fa-calendar-week text-blue-500"></i>月別売上（過去12ヶ月）
                                </h3>
                                <div class="overflow-x-auto max-h-80 overflow-y-auto">
                                    <table class="w-full text-sm">
                                        <thead class="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th class="py-2 px-2 text-left font-medium text-gray-500">月</th>
                                                <th class="py-2 px-2 text-right font-medium text-blue-500">手付金</th>
                                                <th class="py-2 px-2 text-right font-medium text-purple-500">成功報酬</th>
                                                <th class="py-2 px-2 text-right font-medium text-green-600">合計</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${monthlyPaymentsHtml || '<tr><td colspan="4" class="py-4 text-center text-gray-400">データがありません</td></tr>'}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <!-- 年別売上 -->
                            <div>
                                <h3 class="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                                    <i class="fas fa-calendar-alt text-indigo-500"></i>年別売上（過去5年）
                                </h3>
                                <div class="overflow-x-auto">
                                    <table class="w-full text-sm">
                                        <thead class="bg-gray-50">
                                            <tr>
                                                <th class="py-2 px-2 text-left font-medium text-gray-500">年</th>
                                                <th class="py-2 px-2 text-right font-medium text-blue-500">手付金</th>
                                                <th class="py-2 px-2 text-right font-medium text-purple-500">成功報酬</th>
                                                <th class="py-2 px-2 text-right font-medium text-green-600">合計</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${yearlyPaymentsHtml || '<tr><td colspan="4" class="py-4 text-center text-gray-400">データがありません</td></tr>'}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- ステータス別 -->
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                                <i class="fas fa-chart-pie text-purple-600"></i>ステータス別
                            </h2>
                            <div class="space-y-3">
                                ${statusItemsHtml}
                            </div>
                        </div>

                        <!-- 申請種別ランキング -->
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                                <i class="fas fa-ranking-star text-orange-600"></i>申請種別ランキング
                            </h2>
                            <div class="space-y-3">
                                ${subsidyTypeHtml}
                            </div>
                        </div>

                        <!-- 月別推移 -->
                        <div class="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
                            <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                                <i class="fas fa-chart-bar text-blue-600"></i>月別推移（過去6ヶ月）
                            </h2>
                            <div class="overflow-x-auto">
                                <table class="w-full">
                                    <thead>
                                        <tr class="border-b">
                                            <th class="py-2 text-left text-sm font-medium text-gray-500">月</th>
                                            <th class="py-2 text-right text-sm font-medium text-gray-500">新規</th>
                                            <th class="py-2 text-right text-sm font-medium text-gray-500">完了</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${monthlyStatsHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <script>
            ${sidebarScripts}
            
            // グラフ/表切り替え
            function switchView(view) {
                const chartView = document.getElementById('chartView');
                const tableView = document.getElementById('tableView');
                const btnChart = document.getElementById('btnChart');
                const btnTable = document.getElementById('btnTable');
                
                if (view === 'chart') {
                    chartView.classList.remove('hidden');
                    tableView.classList.add('hidden');
                    btnChart.className = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white';
                    btnTable.className = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-600 hover:bg-gray-300';
                } else {
                    chartView.classList.add('hidden');
                    tableView.classList.remove('hidden');
                    btnChart.className = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-600 hover:bg-gray-300';
                    btnTable.className = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white';
                }
            }
            
            // グラフデータ
            const monthlyData = ${JSON.stringify(Array.from(monthlyPaymentMap.entries()).reverse())};
            const yearlyData = ${JSON.stringify(Array.from(yearlyPaymentMap.entries()).reverse())};
            
            // 月別グラフ
            const monthlyCtx = document.getElementById('monthlyChart');
            if (monthlyCtx && monthlyData.length > 0) {
                new Chart(monthlyCtx, {
                    type: 'bar',
                    data: {
                        labels: monthlyData.map(d => d[0]),
                        datasets: [
                            {
                                label: '手付金',
                                data: monthlyData.map(d => d[1].deposit),
                                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                                borderColor: 'rgb(59, 130, 246)',
                                borderWidth: 1
                            },
                            {
                                label: '成功報酬',
                                data: monthlyData.map(d => d[1].success_fee),
                                backgroundColor: 'rgba(147, 51, 234, 0.7)',
                                borderColor: 'rgb(147, 51, 234)',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return context.dataset.label + ': ¥' + context.raw.toLocaleString();
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                stacked: true,
                            },
                            y: {
                                stacked: true,
                                ticks: {
                                    callback: function(value) {
                                        return '¥' + value.toLocaleString();
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            // 年別グラフ
            const yearlyCtx = document.getElementById('yearlyChart');
            if (yearlyCtx && yearlyData.length > 0) {
                new Chart(yearlyCtx, {
                    type: 'bar',
                    data: {
                        labels: yearlyData.map(d => d[0] + '年'),
                        datasets: [
                            {
                                label: '手付金',
                                data: yearlyData.map(d => d[1].deposit),
                                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                                borderColor: 'rgb(59, 130, 246)',
                                borderWidth: 1
                            },
                            {
                                label: '成功報酬',
                                data: yearlyData.map(d => d[1].success_fee),
                                backgroundColor: 'rgba(147, 51, 234, 0.7)',
                                borderColor: 'rgb(147, 51, 234)',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return context.dataset.label + ': ¥' + context.raw.toLocaleString();
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                stacked: true,
                            },
                            y: {
                                stacked: true,
                                ticks: {
                                    callback: function(value) {
                                        return '¥' + value.toLocaleString();
                                    }
                                }
                            }
                        }
                    }
                });
            }
        </script>
    </body>
    </html>
  `)
})

export default routes
