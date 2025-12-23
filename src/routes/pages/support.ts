// FAQ・ヘルプ・問い合わせページ
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import { modalStyles, modalScripts } from '../../templates/modal'
import type { AppEnv } from '../../types'

const routes = new Hono<AppEnv>()

// FAQ・ヘルプページ
routes.get('/help', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ヘルプ・FAQ - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
            ${modalStyles}
            
            .faq-item {
                border-bottom: 1px solid #e5e7eb;
            }
            .faq-item:last-child {
                border-bottom: none;
            }
            .faq-answer {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease-out, padding 0.3s ease-out;
            }
            .faq-item.open .faq-answer {
                max-height: 500px;
                padding-top: 12px;
            }
            .faq-item.open .faq-icon {
                transform: rotate(180deg);
            }
            .category-tab {
                transition: all 0.2s ease;
            }
            .category-tab.active {
                background-color: #3b82f6;
                color: white;
            }
            .category-tab:not(.active):hover {
                background-color: #f3f4f6;
            }
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('help')}
            
            <!-- メインコンテンツ -->
            <main class="flex-1 min-h-screen">
                <!-- トップバー -->
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-question-circle mr-2 text-blue-600"></i>
                                ヘルプ・FAQ
                            </h2>
                        </div>
                    </div>
                </header>
                
                <div class="p-4 lg:p-6 max-w-4xl mx-auto">
                    <!-- クイックアクション -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        <a href="/contact" class="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-6 hover:shadow-lg transition group">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition">
                                    <i class="fas fa-envelope text-xl"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-lg">お問い合わせ</h3>
                                    <p class="text-blue-100 text-sm">サポートチームに連絡する</p>
                                </div>
                            </div>
                        </a>
                        <div class="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-6">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                    <i class="fas fa-headset text-xl"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-lg">サポート時間</h3>
                                    <p class="text-green-100 text-sm">平日 9:00〜18:00</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- FAQ セクション -->
                    <div class="bg-white rounded-xl shadow-sm">
                        <div class="p-4 border-b">
                            <h3 class="font-bold text-lg text-gray-800">
                                <i class="fas fa-lightbulb text-yellow-500 mr-2"></i>
                                よくある質問
                            </h3>
                        </div>
                        
                        <!-- カテゴリタブ -->
                        <div class="p-4 border-b bg-gray-50 flex flex-wrap gap-2">
                            <button onclick="filterFAQ('all')" class="category-tab active px-4 py-2 rounded-full text-sm font-medium" data-category="all">
                                すべて
                            </button>
                            <button onclick="filterFAQ('general')" class="category-tab px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700" data-category="general">
                                <i class="fas fa-info-circle mr-1"></i>一般
                            </button>
                            <button onclick="filterFAQ('billing')" class="category-tab px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700" data-category="billing">
                                <i class="fas fa-yen-sign mr-1"></i>料金・プラン
                            </button>
                            <button onclick="filterFAQ('technical')" class="category-tab px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700" data-category="technical">
                                <i class="fas fa-cog mr-1"></i>技術・機能
                            </button>
                        </div>
                        
                        <!-- FAQ リスト -->
                        <div id="faqList" class="divide-y">
                            <!-- FAQアイテムはJSで生成 -->
                        </div>
                    </div>
                    
                    <!-- 追加のヘルプリソース -->
                    <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-white rounded-xl shadow-sm p-6 text-center hover:shadow-md transition">
                            <div class="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <i class="fas fa-book text-xl"></i>
                            </div>
                            <h4 class="font-bold text-gray-800 mb-2">利用ガイド</h4>
                            <p class="text-sm text-gray-500">基本的な使い方を学ぶ</p>
                        </div>
                        <div class="bg-white rounded-xl shadow-sm p-6 text-center hover:shadow-md transition">
                            <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <i class="fas fa-video text-xl"></i>
                            </div>
                            <h4 class="font-bold text-gray-800 mb-2">動画チュートリアル</h4>
                            <p class="text-sm text-gray-500">準備中</p>
                        </div>
                        <div class="bg-white rounded-xl shadow-sm p-6 text-center hover:shadow-md transition">
                            <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <i class="fas fa-newspaper text-xl"></i>
                            </div>
                            <h4 class="font-bold text-gray-800 mb-2">お知らせ</h4>
                            <p class="text-sm text-gray-500">最新情報・アップデート</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <script>
            ${sidebarScripts}
            ${modalScripts}
            
            let allFAQs = [];
            let currentCategory = 'all';
            
            // 初期化
            document.addEventListener('DOMContentLoaded', async () => {
                await loadFAQs();
                
                // ユーザー情報をサイドバーに表示
                const adminName = localStorage.getItem('admin_name');
                if (adminName) {
                    document.getElementById('sidebarAdminName').textContent = adminName;
                }
            });
            
            // FAQ読み込み
            async function loadFAQs() {
                try {
                    const token = localStorage.getItem('admin_token');
                    const response = await fetch('/api/support/faq', {
                        headers: token ? { 'Authorization': 'Bearer ' + token } : {}
                    });
                    const data = await response.json();
                    allFAQs = data.faqs || [];
                    renderFAQs();
                } catch (error) {
                    console.error('FAQ load error:', error);
                }
            }
            
            // FAQフィルタリング
            function filterFAQ(category) {
                currentCategory = category;
                
                // タブのアクティブ状態更新
                document.querySelectorAll('.category-tab').forEach(tab => {
                    if (tab.dataset.category === category) {
                        tab.classList.add('active');
                        tab.classList.remove('bg-gray-100', 'text-gray-700');
                    } else {
                        tab.classList.remove('active');
                        tab.classList.add('bg-gray-100', 'text-gray-700');
                    }
                });
                
                renderFAQs();
            }
            
            // FAQ表示
            function renderFAQs() {
                const container = document.getElementById('faqList');
                const filteredFAQs = currentCategory === 'all' 
                    ? allFAQs 
                    : allFAQs.filter(faq => faq.category === currentCategory);
                
                if (filteredFAQs.length === 0) {
                    container.innerHTML = '<div class="p-8 text-center text-gray-500">該当するFAQがありません</div>';
                    return;
                }
                
                container.innerHTML = filteredFAQs.map((faq, index) => \`
                    <div class="faq-item p-4 cursor-pointer hover:bg-gray-50" onclick="toggleFAQ(this)">
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="text-xs px-2 py-0.5 rounded-full \${getCategoryClass(faq.category)}">\${getCategoryLabel(faq.category)}</span>
                                </div>
                                <h4 class="font-medium text-gray-800">\${escapeHtml(faq.question)}</h4>
                            </div>
                            <i class="fas fa-chevron-down text-gray-400 faq-icon transition-transform"></i>
                        </div>
                        <div class="faq-answer text-gray-600 text-sm leading-relaxed">
                            \${escapeHtml(faq.answer).replace(/\\n/g, '<br>')}
                        </div>
                    </div>
                \`).join('');
            }
            
            // FAQアイテム開閉
            function toggleFAQ(element) {
                element.classList.toggle('open');
            }
            
            // カテゴリラベル
            function getCategoryLabel(category) {
                const labels = {
                    'general': '一般',
                    'billing': '料金',
                    'technical': '技術'
                };
                return labels[category] || category;
            }
            
            // カテゴリスタイル
            function getCategoryClass(category) {
                const classes = {
                    'general': 'bg-blue-100 text-blue-700',
                    'billing': 'bg-green-100 text-green-700',
                    'technical': 'bg-purple-100 text-purple-700'
                };
                return classes[category] || 'bg-gray-100 text-gray-700';
            }
            
            // HTMLエスケープ
            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            // サイドバー開閉
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                sidebar.classList.toggle('-translate-x-full');
                overlay.classList.toggle('hidden');
            }
        </script>
    </body>
    </html>
  `);
});

// 問い合わせフォームページ
routes.get('/contact', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>お問い合わせ - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
            ${modalStyles}
            
            .form-input:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            .category-card {
                transition: all 0.2s ease;
                cursor: pointer;
            }
            .category-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .category-card.selected {
                border-color: #3b82f6;
                background-color: #eff6ff;
            }
            .category-card.selected .check-icon {
                display: flex;
            }
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('contact')}
            
            <!-- メインコンテンツ -->
            <main class="flex-1 min-h-screen">
                <!-- トップバー -->
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-envelope mr-2 text-blue-600"></i>
                                お問い合わせ
                            </h2>
                        </div>
                        <a href="/help" class="text-blue-600 hover:text-blue-800 text-sm">
                            <i class="fas fa-arrow-left mr-1"></i>ヘルプに戻る
                        </a>
                    </div>
                </header>
                
                <div class="p-4 lg:p-6 max-w-2xl mx-auto">
                    <!-- 成功メッセージ -->
                    <div id="successMessage" class="hidden mb-6 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                        <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-check text-3xl"></i>
                        </div>
                        <h3 class="font-bold text-lg text-green-800 mb-2">お問い合わせを受け付けました</h3>
                        <p class="text-green-600 text-sm">担当者より折り返しご連絡いたします。</p>
                        <button onclick="resetForm()" class="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                            新しいお問い合わせ
                        </button>
                    </div>
                    
                    <!-- お問い合わせフォーム -->
                    <div id="contactForm" class="bg-white rounded-xl shadow-sm">
                        <div class="p-4 border-b">
                            <h3 class="font-bold text-lg text-gray-800">サポートへ連絡</h3>
                            <p class="text-sm text-gray-500 mt-1">ご質問・ご要望・不具合報告など、お気軽にお問い合わせください</p>
                        </div>
                        
                        <form onsubmit="submitContact(event)" class="p-6 space-y-6">
                            <!-- カテゴリ選択 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-3">
                                    お問い合わせの種類 <span class="text-red-500">*</span>
                                </label>
                                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <div class="category-card border-2 rounded-xl p-4 text-center relative" onclick="selectCategory('general')">
                                        <div class="check-icon hidden absolute top-2 right-2 w-5 h-5 bg-blue-600 text-white rounded-full items-center justify-center">
                                            <i class="fas fa-check text-xs"></i>
                                        </div>
                                        <i class="fas fa-info-circle text-2xl text-blue-500 mb-2"></i>
                                        <div class="font-medium text-sm">一般的な質問</div>
                                    </div>
                                    <div class="category-card border-2 rounded-xl p-4 text-center relative" onclick="selectCategory('technical')">
                                        <div class="check-icon hidden absolute top-2 right-2 w-5 h-5 bg-blue-600 text-white rounded-full items-center justify-center">
                                            <i class="fas fa-check text-xs"></i>
                                        </div>
                                        <i class="fas fa-tools text-2xl text-orange-500 mb-2"></i>
                                        <div class="font-medium text-sm">技術的な問題</div>
                                    </div>
                                    <div class="category-card border-2 rounded-xl p-4 text-center relative" onclick="selectCategory('billing')">
                                        <div class="check-icon hidden absolute top-2 right-2 w-5 h-5 bg-blue-600 text-white rounded-full items-center justify-center">
                                            <i class="fas fa-check text-xs"></i>
                                        </div>
                                        <i class="fas fa-yen-sign text-2xl text-green-500 mb-2"></i>
                                        <div class="font-medium text-sm">料金・プラン</div>
                                    </div>
                                    <div class="category-card border-2 rounded-xl p-4 text-center relative" onclick="selectCategory('feature')">
                                        <div class="check-icon hidden absolute top-2 right-2 w-5 h-5 bg-blue-600 text-white rounded-full items-center justify-center">
                                            <i class="fas fa-check text-xs"></i>
                                        </div>
                                        <i class="fas fa-lightbulb text-2xl text-yellow-500 mb-2"></i>
                                        <div class="font-medium text-sm">機能リクエスト</div>
                                    </div>
                                    <div class="category-card border-2 rounded-xl p-4 text-center relative" onclick="selectCategory('bug')">
                                        <div class="check-icon hidden absolute top-2 right-2 w-5 h-5 bg-blue-600 text-white rounded-full items-center justify-center">
                                            <i class="fas fa-check text-xs"></i>
                                        </div>
                                        <i class="fas fa-bug text-2xl text-red-500 mb-2"></i>
                                        <div class="font-medium text-sm">不具合報告</div>
                                    </div>
                                    <div class="category-card border-2 rounded-xl p-4 text-center relative" onclick="selectCategory('other')">
                                        <div class="check-icon hidden absolute top-2 right-2 w-5 h-5 bg-blue-600 text-white rounded-full items-center justify-center">
                                            <i class="fas fa-check text-xs"></i>
                                        </div>
                                        <i class="fas fa-ellipsis-h text-2xl text-gray-500 mb-2"></i>
                                        <div class="font-medium text-sm">その他</div>
                                    </div>
                                </div>
                                <input type="hidden" id="category" name="category" required>
                            </div>
                            
                            <!-- 優先度 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    優先度
                                </label>
                                <select id="priority" name="priority" class="form-input w-full border rounded-lg px-4 py-2.5">
                                    <option value="normal">通常</option>
                                    <option value="low">低（急ぎではない）</option>
                                    <option value="high">高（できるだけ早く）</option>
                                    <option value="urgent">緊急（業務に支障あり）</option>
                                </select>
                            </div>
                            
                            <!-- 件名 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    件名 <span class="text-red-500">*</span>
                                </label>
                                <input type="text" id="subject" name="subject" required
                                    placeholder="お問い合わせの件名を入力"
                                    class="form-input w-full border rounded-lg px-4 py-2.5">
                            </div>
                            
                            <!-- 内容 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    お問い合わせ内容 <span class="text-red-500">*</span>
                                </label>
                                <textarea id="message" name="message" required rows="6"
                                    placeholder="詳しい内容をご記入ください。&#10;不具合の場合は、発生状況や再現手順もお書きいただけると助かります。"
                                    class="form-input w-full border rounded-lg px-4 py-2.5 resize-none"></textarea>
                            </div>
                            
                            <!-- 送信ボタン -->
                            <div class="flex gap-3 pt-2">
                                <a href="/help" class="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-center">
                                    キャンセル
                                </a>
                                <button type="submit" id="submitBtn" class="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2">
                                    <i class="fas fa-paper-plane"></i>
                                    送信する
                                </button>
                            </div>
                        </form>
                    </div>
                    
                    <!-- 補足情報 -->
                    <div class="mt-6 bg-blue-50 rounded-xl p-4">
                        <h4 class="font-medium text-blue-800 mb-2">
                            <i class="fas fa-info-circle mr-1"></i>
                            お問い合わせについて
                        </h4>
                        <ul class="text-sm text-blue-700 space-y-1">
                            <li>• 回答は通常1〜2営業日以内にメールでお送りします</li>
                            <li>• 緊急の場合は優先的に対応いたします</li>
                            <li>• よくある質問は<a href="/help" class="underline">FAQ</a>もご確認ください</li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
        
        <script>
            ${sidebarScripts}
            ${modalScripts}
            
            let selectedCategory = '';
            
            // 初期化
            document.addEventListener('DOMContentLoaded', () => {
                // ユーザー情報をサイドバーに表示
                const adminName = localStorage.getItem('admin_name');
                if (adminName) {
                    document.getElementById('sidebarAdminName').textContent = adminName;
                }
            });
            
            // カテゴリ選択
            function selectCategory(category) {
                selectedCategory = category;
                document.getElementById('category').value = category;
                
                // UIの更新
                document.querySelectorAll('.category-card').forEach(card => {
                    card.classList.remove('selected');
                });
                event.currentTarget.classList.add('selected');
            }
            
            // フォーム送信
            async function submitContact(e) {
                e.preventDefault();
                
                if (!selectedCategory) {
                    alert('お問い合わせの種類を選択してください');
                    return;
                }
                
                const submitBtn = document.getElementById('submitBtn');
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';
                
                try {
                    const token = localStorage.getItem('admin_token');
                    const response = await fetch('/api/support/contact', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': 'Bearer ' + token } : {})
                        },
                        body: JSON.stringify({
                            category: selectedCategory,
                            subject: document.getElementById('subject').value,
                            message: document.getElementById('message').value,
                            priority: document.getElementById('priority').value
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        // 成功メッセージ表示
                        document.getElementById('contactForm').classList.add('hidden');
                        document.getElementById('successMessage').classList.remove('hidden');
                    } else {
                        alert(data.error || 'お問い合わせの送信に失敗しました');
                    }
                } catch (error) {
                    console.error('Submit error:', error);
                    alert('エラーが発生しました。時間をおいて再度お試しください。');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            }
            
            // フォームリセット
            function resetForm() {
                document.getElementById('contactForm').classList.remove('hidden');
                document.getElementById('successMessage').classList.add('hidden');
                document.getElementById('subject').value = '';
                document.getElementById('message').value = '';
                document.getElementById('priority').value = 'normal';
                selectedCategory = '';
                document.getElementById('category').value = '';
                document.querySelectorAll('.category-card').forEach(card => {
                    card.classList.remove('selected');
                });
            }
            
            // サイドバー開閉
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                sidebar.classList.toggle('-translate-x-full');
                overlay.classList.toggle('hidden');
            }
        </script>
    </body>
    </html>
  `);
});

export default routes
