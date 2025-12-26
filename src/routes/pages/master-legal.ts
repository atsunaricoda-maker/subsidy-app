import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'
// 法的表記・会社情報設定ページ
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/master/legal-settings', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>プラットフォーム法的表記設定 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('legal')}
            
            <main class="flex-1 p-8">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-800">プラットフォーム法的表記設定</h1>
                    <p class="text-gray-600 mt-1">SaaS利用者向けの特定商取引法に基づく表記、利用規約、プライバシーポリシーに表示される情報</p>
                </div>
                
                <!-- プレビューリンク -->
                <div class="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
                    <div class="flex items-center gap-4 flex-wrap">
                        <span class="text-yellow-800 font-medium"><i class="fas fa-eye mr-1"></i>プレビュー:</span>
                        <a href="/master/legal" target="_blank" class="text-yellow-700 hover:text-yellow-900 underline">
                            <i class="fas fa-external-link-alt mr-1"></i>特定商取引法に基づく表記
                        </a>
                        <a href="/master/terms" target="_blank" class="text-yellow-700 hover:text-yellow-900 underline">
                            <i class="fas fa-external-link-alt mr-1"></i>SaaS利用規約
                        </a>
                        <a href="/master/privacy-policy" target="_blank" class="text-yellow-700 hover:text-yellow-900 underline">
                            <i class="fas fa-external-link-alt mr-1"></i>プライバシーポリシー
                        </a>
                    </div>
                </div>
                
                <!-- 注意事項 -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 class="font-medium text-blue-800 mb-2"><i class="fas fa-info-circle mr-1"></i>この設定について</h3>
                    <ul class="text-sm text-blue-700 space-y-1">
                        <li>• この情報は <strong>プラットフォーム（申請らくらく君）の法務ページ</strong>に表示されます</li>
                        <li>• SaaS利用者（各組織）が自分の顧客に表示する法務ページとは<strong>別</strong>です</li>
                        <li>• 各組織の法務ページは、各組織の管理画面（設定 → システム設定）で設定します</li>
                    </ul>
                </div>
                
                <!-- プラットフォーム事業者情報（SaaS運営元） -->
                <form id="platformSettingsForm">
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <h2 class="text-lg font-semibold mb-4 pb-2 border-b">
                            <i class="fas fa-crown text-yellow-600 mr-2"></i>プラットフォーム事業者情報
                        </h2>
                        <p class="text-sm text-gray-500 mb-4">
                            特定商取引法に基づき、以下の情報が公開されます。
                        </p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">運営会社名 <span class="text-red-500">*</span></label>
                                <input type="text" name="platform_company_name" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">代表者名 <span class="text-red-500">*</span></label>
                                <input type="text" name="platform_representative" required placeholder="特商法で公開必須" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                                <input type="text" name="platform_postal_code" placeholder="000-0000" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">所在地 <span class="text-red-500">*</span></label>
                                <input type="text" name="platform_address" required placeholder="特商法で公開必須" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                                <input type="text" name="platform_phone" placeholder="（メールでの問い合わせを推奨する場合は空欄可）" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span class="text-red-500">*</span></label>
                                <input type="email" name="platform_email" required class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">営業時間</label>
                                <input type="text" name="platform_business_hours" placeholder="平日 10:00〜18:00（土日祝を除く）" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">適格請求書発行事業者登録番号</label>
                                <input type="text" name="platform_invoice_number" placeholder="T0000000000000（任意）" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500">
                            </div>
                        </div>
                        
                        <!-- 保存ボタン -->
                        <div class="flex justify-end mt-6 pt-4 border-t">
                            <button type="submit" class="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                                <i class="fas fa-save mr-2"></i>保存
                            </button>
                        </div>
                    </div>
                </form>
                
                <!-- 各組織の設定への案内 -->
                <div class="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <h3 class="font-medium text-gray-800 mb-3"><i class="fas fa-building mr-2 text-blue-600"></i>各組織（SaaS利用者）の法務ページについて</h3>
                    <p class="text-sm text-gray-600 mb-4">
                        各組織が自分の顧客に表示する法務ページ（/legal, /terms, /privacy-policy）は、
                        各組織の管理画面から設定します。
                    </p>
                    <div class="bg-white rounded-lg p-4 border">
                        <p class="text-sm text-gray-700">
                            <strong>各組織の設定場所:</strong><br>
                            組織の管理画面 → 設定 → システム設定 → 「法的表記・会社情報」タブ
                        </p>
                    </div>
                </div>
            </main>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${masterSidebarScripts}
            
            // プラットフォーム設定の読み込み
            async function loadPlatformSettings() {
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.get('/api/master/platform-settings', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const settings = response.data;
                    
                    // フォームに値をセット
                    Object.keys(settings).forEach(key => {
                        const input = document.querySelector('[name="' + key + '"]');
                        if (input) {
                            input.value = settings[key] || '';
                        }
                    });
                } catch (error) {
                    console.error('Platform settings load error:', error);
                }
            }
            
            // プラットフォーム設定の保存
            document.getElementById('platformSettingsForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const data = {};
                formData.forEach((value, key) => {
                    data[key] = value;
                });
                
                try {
                    const token = localStorage.getItem('master_token');
                    await axios.put('/api/master/platform-settings', data, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    alert('プラットフォーム設定を保存しました');
                } catch (error) {
                    console.error('Save error:', error);
                    alert('保存に失敗しました');
                }
            });
            
            // ページ読み込み時に設定を取得
            loadPlatformSettings();
        </script>
    </body>
    </html>
  `)
})

export default routes
