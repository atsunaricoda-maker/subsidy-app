// マスター管理: 問い合わせ一覧
import { Hono } from 'hono'
import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'
import type { AppEnv } from '../../types'

const routes = new Hono<AppEnv>()

routes.get('/master/inquiries', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>問い合わせ一覧 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-900 text-white">
        <div class="min-h-screen flex">
            ${generateMasterSidebar('inquiries')}
            
            <main class="flex-1 min-h-screen">
                <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
                    <div class="flex items-center justify-between px-6 py-4">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-400 hover:text-white">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-xl font-bold">
                                <i class="fas fa-envelope mr-2 text-blue-400"></i>
                                問い合わせ一覧
                            </h2>
                        </div>
                        <div class="flex items-center gap-3">
                            <select id="statusFilter" onchange="loadInquiries()" class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm">
                                <option value="">すべてのステータス</option>
                                <option value="pending">未対応</option>
                                <option value="in_progress">対応中</option>
                                <option value="resolved">解決済み</option>
                            </select>
                            <button onclick="loadInquiries()" class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-sync-alt mr-1"></i>更新
                            </button>
                        </div>
                    </div>
                </header>
                
                <div class="p-6">
                    <!-- 統計カード -->
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-400 text-sm">未対応</p>
                                    <p id="pendingCount" class="text-2xl font-bold text-red-400">-</p>
                                </div>
                                <div class="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-exclamation-circle text-red-400"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-400 text-sm">対応中</p>
                                    <p id="inProgressCount" class="text-2xl font-bold text-yellow-400">-</p>
                                </div>
                                <div class="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-clock text-yellow-400"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-400 text-sm">解決済み</p>
                                    <p id="resolvedCount" class="text-2xl font-bold text-green-400">-</p>
                                </div>
                                <div class="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-check-circle text-green-400"></i>
                                </div>
                            </div>
                        </div>
                        <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-gray-400 text-sm">合計</p>
                                    <p id="totalCount" class="text-2xl font-bold text-blue-400">-</p>
                                </div>
                                <div class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-envelope text-blue-400"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 問い合わせ一覧 -->
                    <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead class="bg-gray-700/50">
                                    <tr>
                                        <th class="text-left px-4 py-3 text-sm font-medium text-gray-300">ID</th>
                                        <th class="text-left px-4 py-3 text-sm font-medium text-gray-300">ステータス</th>
                                        <th class="text-left px-4 py-3 text-sm font-medium text-gray-300">優先度</th>
                                        <th class="text-left px-4 py-3 text-sm font-medium text-gray-300">カテゴリ</th>
                                        <th class="text-left px-4 py-3 text-sm font-medium text-gray-300">件名</th>
                                        <th class="text-left px-4 py-3 text-sm font-medium text-gray-300">組織</th>
                                        <th class="text-left px-4 py-3 text-sm font-medium text-gray-300">送信者</th>
                                        <th class="text-left px-4 py-3 text-sm font-medium text-gray-300">日時</th>
                                        <th class="text-left px-4 py-3 text-sm font-medium text-gray-300">操作</th>
                                    </tr>
                                </thead>
                                <tbody id="inquiriesTable" class="divide-y divide-gray-700">
                                    <tr>
                                        <td colspan="9" class="px-4 py-8 text-center text-gray-500">
                                            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                            <div>読み込み中...</div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- 詳細モーダル -->
        <div id="detailModal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
            <div class="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
                <div class="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
                    <h3 class="text-lg font-bold">問い合わせ詳細</h3>
                    <button onclick="closeDetailModal()" class="text-gray-400 hover:text-white">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div id="detailContent" class="p-6">
                    <!-- 詳細内容はJSで生成 -->
                </div>
            </div>
        </div>
        
        <script>
            ${masterSidebarScripts}
            
            let currentInquiry = null;
            
            document.addEventListener('DOMContentLoaded', () => {
                checkMasterAuth();
                loadInquiries();
            });
            
            function checkMasterAuth() {
                const token = localStorage.getItem('master_token');
                if (!token) {
                    window.location.href = '/master/login';
                }
            }
            
            async function loadInquiries() {
                const token = localStorage.getItem('master_token');
                const status = document.getElementById('statusFilter').value;
                
                try {
                    let url = '/api/master/inquiries';
                    if (status) url += '?status=' + status;
                    
                    const response = await fetch(url, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    
                    if (response.status === 401) {
                        window.location.href = '/master/login';
                        return;
                    }
                    
                    const data = await response.json();
                    renderInquiries(data.inquiries || []);
                    updateStats(data.stats || {});
                } catch (error) {
                    console.error('Load error:', error);
                }
            }
            
            function updateStats(stats) {
                document.getElementById('pendingCount').textContent = stats.pending || 0;
                document.getElementById('inProgressCount').textContent = stats.in_progress || 0;
                document.getElementById('resolvedCount').textContent = stats.resolved || 0;
                document.getElementById('totalCount').textContent = stats.total || 0;
            }
            
            function renderInquiries(inquiries) {
                const tbody = document.getElementById('inquiriesTable');
                
                if (inquiries.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="9" class="px-4 py-8 text-center text-gray-500">問い合わせはありません</td></tr>';
                    return;
                }
                
                tbody.innerHTML = inquiries.map(inq => \`
                    <tr class="hover:bg-gray-700/50 cursor-pointer" onclick="showDetail(\${inq.id})">
                        <td class="px-4 py-3 text-sm">#\${inq.id}</td>
                        <td class="px-4 py-3">\${getStatusBadge(inq.status)}</td>
                        <td class="px-4 py-3">\${getPriorityBadge(inq.priority)}</td>
                        <td class="px-4 py-3 text-sm">\${getCategoryLabel(inq.category)}</td>
                        <td class="px-4 py-3 text-sm font-medium">\${escapeHtml(inq.subject)}</td>
                        <td class="px-4 py-3 text-sm text-gray-400">\${escapeHtml(inq.organization_name || '-')}</td>
                        <td class="px-4 py-3 text-sm text-gray-400">\${escapeHtml(inq.user_name || '-')}</td>
                        <td class="px-4 py-3 text-sm text-gray-400">\${formatDate(inq.created_at)}</td>
                        <td class="px-4 py-3">
                            <button onclick="event.stopPropagation(); showDetail(\${inq.id})" class="text-blue-400 hover:text-blue-300">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                \`).join('');
            }
            
            function getStatusBadge(status) {
                const badges = {
                    'pending': '<span class="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">未対応</span>',
                    'in_progress': '<span class="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">対応中</span>',
                    'resolved': '<span class="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">解決済み</span>'
                };
                return badges[status] || badges['pending'];
            }
            
            function getPriorityBadge(priority) {
                const badges = {
                    'low': '<span class="px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-400">低</span>',
                    'normal': '<span class="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">通常</span>',
                    'high': '<span class="px-2 py-1 rounded-full text-xs bg-orange-500/20 text-orange-400">高</span>',
                    'urgent': '<span class="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">緊急</span>'
                };
                return badges[priority] || badges['normal'];
            }
            
            function getCategoryLabel(category) {
                const labels = {
                    'general': '一般',
                    'technical': '技術',
                    'billing': '料金',
                    'feature': '機能要望',
                    'bug': '不具合',
                    'other': 'その他'
                };
                return labels[category] || category;
            }
            
            function formatDate(dateStr) {
                if (!dateStr) return '-';
                const date = new Date(dateStr);
                return date.toLocaleString('ja-JP', { 
                    month: 'numeric', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            
            async function showDetail(id) {
                const token = localStorage.getItem('master_token');
                
                try {
                    const response = await fetch('/api/master/inquiries/' + id, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    
                    const data = await response.json();
                    currentInquiry = data.inquiry;
                    
                    document.getElementById('detailContent').innerHTML = \`
                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    \${getStatusBadge(currentInquiry.status)}
                                    \${getPriorityBadge(currentInquiry.priority)}
                                </div>
                                <span class="text-sm text-gray-400">#\${currentInquiry.id}</span>
                            </div>
                            
                            <div>
                                <h4 class="text-lg font-bold">\${escapeHtml(currentInquiry.subject)}</h4>
                                <p class="text-sm text-gray-400 mt-1">
                                    \${getCategoryLabel(currentInquiry.category)} | 
                                    \${escapeHtml(currentInquiry.organization_name || '未ログイン')} | 
                                    \${escapeHtml(currentInquiry.user_name || '匿名')}
                                    \${currentInquiry.user_email ? ' (' + escapeHtml(currentInquiry.user_email) + ')' : ''}
                                </p>
                                <p class="text-xs text-gray-500 mt-1">\${new Date(currentInquiry.created_at).toLocaleString('ja-JP')}</p>
                            </div>
                            
                            <div class="bg-gray-700/50 rounded-lg p-4">
                                <p class="text-sm whitespace-pre-wrap">\${escapeHtml(currentInquiry.message)}</p>
                            </div>
                            
                            \${currentInquiry.response ? \`
                                <div class="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
                                    <p class="text-xs text-blue-400 mb-2">
                                        <i class="fas fa-reply mr-1"></i>回答 (\${currentInquiry.responded_by || '-'} / \${formatDate(currentInquiry.responded_at)})
                                    </p>
                                    <p class="text-sm whitespace-pre-wrap">\${escapeHtml(currentInquiry.response)}</p>
                                </div>
                            \` : ''}
                            
                            <div class="border-t border-gray-700 pt-4">
                                <label class="block text-sm font-medium text-gray-300 mb-2">ステータス変更</label>
                                <select id="statusSelect" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 mb-3">
                                    <option value="pending" \${currentInquiry.status === 'pending' ? 'selected' : ''}>未対応</option>
                                    <option value="in_progress" \${currentInquiry.status === 'in_progress' ? 'selected' : ''}>対応中</option>
                                    <option value="resolved" \${currentInquiry.status === 'resolved' ? 'selected' : ''}>解決済み</option>
                                </select>
                                
                                <label class="block text-sm font-medium text-gray-300 mb-2">回答（内部メモ）</label>
                                <textarea id="responseText" rows="4" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 resize-none" placeholder="対応内容を記録...">\${currentInquiry.response || ''}</textarea>
                                
                                <div class="flex gap-3 mt-4">
                                    <button onclick="updateInquiry()" class="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium">
                                        <i class="fas fa-save mr-1"></i>更新
                                    </button>
                                    <button onclick="deleteInquiry()" class="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    \`;
                    
                    document.getElementById('detailModal').classList.remove('hidden');
                } catch (error) {
                    console.error('Detail load error:', error);
                    alert('詳細の読み込みに失敗しました');
                }
            }
            
            function closeDetailModal() {
                document.getElementById('detailModal').classList.add('hidden');
                currentInquiry = null;
            }
            
            async function updateInquiry() {
                if (!currentInquiry) return;
                
                const token = localStorage.getItem('master_token');
                const status = document.getElementById('statusSelect').value;
                const response = document.getElementById('responseText').value;
                
                try {
                    const res = await fetch('/api/master/inquiries/' + currentInquiry.id, {
                        method: 'PUT',
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status, response })
                    });
                    
                    if (res.ok) {
                        closeDetailModal();
                        loadInquiries();
                    } else {
                        alert('更新に失敗しました');
                    }
                } catch (error) {
                    console.error('Update error:', error);
                    alert('エラーが発生しました');
                }
            }
            
            async function deleteInquiry() {
                if (!currentInquiry) return;
                if (!confirm('この問い合わせを削除しますか？')) return;
                
                const token = localStorage.getItem('master_token');
                
                try {
                    const res = await fetch('/api/master/inquiries/' + currentInquiry.id, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    
                    if (res.ok) {
                        closeDetailModal();
                        loadInquiries();
                    } else {
                        alert('削除に失敗しました');
                    }
                } catch (error) {
                    console.error('Delete error:', error);
                    alert('エラーが発生しました');
                }
            }
            
            function escapeHtml(text) {
                if (!text) return '';
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                sidebar.classList.toggle('-translate-x-full');
            }
        </script>
    </body>
    </html>
  `);
});

export default routes
