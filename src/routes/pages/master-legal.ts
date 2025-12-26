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
        <title>法的表記・会社情報設定 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('legal')}
            
            <main class="flex-1 p-8">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-800">法的表記・会社情報設定</h1>
                    <p class="text-gray-600 mt-1">特定商取引法に基づく表記、プライバシーポリシー等の設定</p>
                </div>
                
                <!-- プレビューリンク -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div class="flex items-center gap-4 flex-wrap mb-3">
                        <span class="text-blue-800 font-medium">顧客向けプレビュー:</span>
                        <a href="/legal" target="_blank" class="text-blue-600 hover:text-blue-800 underline">
                            <i class="fas fa-external-link-alt mr-1"></i>特定商取引法に基づく表記
                        </a>
                        <a href="/terms" target="_blank" class="text-blue-600 hover:text-blue-800 underline">
                            <i class="fas fa-external-link-alt mr-1"></i>利用規約
                        </a>
                        <a href="/privacy-policy" target="_blank" class="text-blue-600 hover:text-blue-800 underline">
                            <i class="fas fa-external-link-alt mr-1"></i>プライバシーポリシー
                        </a>
                    </div>
                    <div class="flex items-center gap-4 flex-wrap border-t border-blue-200 pt-3">
                        <span class="text-yellow-700 font-medium">プラットフォームプレビュー:</span>
                        <a href="/master/legal" target="_blank" class="text-yellow-600 hover:text-yellow-800 underline">
                            <i class="fas fa-external-link-alt mr-1"></i>特定商取引法に基づく表記
                        </a>
                        <a href="/master/terms" target="_blank" class="text-yellow-600 hover:text-yellow-800 underline">
                            <i class="fas fa-external-link-alt mr-1"></i>SaaS利用規約
                        </a>
                        <a href="/master/privacy-policy" target="_blank" class="text-yellow-600 hover:text-yellow-800 underline">
                            <i class="fas fa-external-link-alt mr-1"></i>プライバシーポリシー
                        </a>
                    </div>
                </div>
                
                <!-- プラットフォーム事業者情報（SaaS運営元） -->
                <form id="platformSettingsForm" class="mb-6">
                    <div class="bg-yellow-50 border-2 border-yellow-300 rounded-xl shadow-sm p-6">
                        <h2 class="text-lg font-semibold mb-4 pb-2 border-b border-yellow-300">
                            <i class="fas fa-crown text-yellow-600 mr-2"></i>プラットフォーム事業者情報（SaaS運営元）
                        </h2>
                        <p class="text-sm text-yellow-700 mb-4">
                            <i class="fas fa-info-circle mr-1"></i>
                            この情報は <strong>/master/legal</strong>、<strong>/master/terms</strong>、<strong>/master/privacy-policy</strong> に表示されます。
                            SaaS利用者向けの法務ページです。
                        </p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">運営会社名 *</label>
                                <input type="text" name="platform_company_name" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">代表者名 *</label>
                                <input type="text" name="platform_representative" placeholder="（公開されます）" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                                <input type="text" name="platform_postal_code" placeholder="000-0000" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">所在地 *</label>
                                <input type="text" name="platform_address" placeholder="（公開されます）" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                                <input type="text" name="platform_phone" placeholder="お問い合わせはメールを推奨" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス *</label>
                                <input type="email" name="platform_email" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">営業時間</label>
                                <input type="text" name="platform_business_hours" placeholder="平日 10:00〜18:00" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">適格請求書発行事業者登録番号</label>
                                <input type="text" name="platform_invoice_number" placeholder="T0000000000000" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500">
                            </div>
                        </div>
                        <div class="flex justify-end mt-4">
                            <button type="submit" class="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                                <i class="fas fa-save mr-2"></i>プラットフォーム情報を保存
                            </button>
                        </div>
                    </div>
                </form>
                
                <hr class="my-8 border-gray-300">
                
                <h2 class="text-xl font-semibold text-gray-700 mb-4">
                    <i class="fas fa-users text-blue-600 mr-2"></i>SaaS利用者（組織）のデフォルト設定
                </h2>
                <p class="text-sm text-gray-500 mb-6">以下の設定は、SaaS利用者が /legal, /terms, /privacy-policy で顧客に表示する内容のデフォルトです。</p>
                
                <form id="settingsForm" class="space-y-6">
                    <!-- 事業者情報 -->
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <h2 class="text-lg font-semibold mb-4 pb-2 border-b">
                            <i class="fas fa-building text-blue-600 mr-2"></i>事業者情報
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">事業者名（会社名/屋号）*</label>
                                <input type="text" name="company_name" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">代表者名 *</label>
                                <input type="text" name="company_representative" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
                                <input type="text" name="postal_code" placeholder="000-0000" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">所在地 *</label>
                                <input type="text" name="company_address" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">電話番号 *</label>
                                <input type="text" name="company_phone" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス *</label>
                                <input type="email" name="company_email" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">営業時間</label>
                                <input type="text" name="business_hours" placeholder="平日 9:00〜18:00" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">適格請求書発行事業者登録番号</label>
                                <input type="text" name="invoice_registration_number" placeholder="T0000000000000" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 振込先情報 -->
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <h2 class="text-lg font-semibold mb-4 pb-2 border-b">
                            <i class="fas fa-university text-green-600 mr-2"></i>振込先情報
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">銀行名</label>
                                <input type="text" name="bank_name" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">支店名</label>
                                <input type="text" name="bank_branch" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">口座種別</label>
                                <select name="bank_account_type" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                                    <option value="普通">普通</option>
                                    <option value="当座">当座</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">口座番号</label>
                                <input type="text" name="bank_account_number" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-gray-700 mb-1">口座名義</label>
                                <input type="text" name="bank_account_holder" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 特定商取引法表記詳細 -->
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <h2 class="text-lg font-semibold mb-4 pb-2 border-b">
                            <i class="fas fa-balance-scale text-purple-600 mr-2"></i>特定商取引法表記詳細
                        </h2>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">販売価格について</label>
                                <textarea name="legal_price_info" rows="2" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">支払方法</label>
                                <input type="text" name="legal_payment_method" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">支払時期</label>
                                <textarea name="legal_payment_timing" rows="2" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">サービス提供時期</label>
                                <input type="text" name="legal_service_start" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">返品・キャンセルについて</label>
                                <textarea name="legal_cancel_policy" rows="2" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">追加費用について</label>
                                <input type="text" name="legal_additional_cost" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 利用規約・プライバシーポリシー -->
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <h2 class="text-lg font-semibold mb-4 pb-2 border-b">
                            <i class="fas fa-file-contract text-orange-600 mr-2"></i>利用規約・プライバシーポリシー
                        </h2>
                        <p class="text-sm text-gray-500 mb-4">空欄の場合はデフォルトのテンプレートが表示されます。外部URLを指定するとそちらにリダイレクトします。</p>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">利用規約（外部URL）</label>
                                <input type="url" name="terms_url" placeholder="https://example.com/terms" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">利用規約（カスタム内容 - Markdown可）</label>
                                <textarea name="terms_of_service" rows="6" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"></textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">プライバシーポリシー（外部URL）</label>
                                <input type="url" name="privacy_policy_url" placeholder="https://example.com/privacy" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">プライバシーポリシー（カスタム内容 - Markdown可）</label>
                                <textarea name="privacy_policy" rows="6" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"></textarea>
                            </div>
                        </div>
                    </div>
                    
                    <!-- フッター -->
                    <div class="bg-white rounded-xl shadow-sm p-6">
                        <h2 class="text-lg font-semibold mb-4 pb-2 border-b">
                            <i class="fas fa-window-minimize text-gray-600 mr-2"></i>フッター設定
                        </h2>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">フッターテキスト</label>
                            <input type="text" name="footer_text" placeholder="© 2024 会社名 All Rights Reserved." class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <!-- 保存ボタン -->
                    <div class="flex justify-end gap-4">
                        <button type="button" onclick="loadSettings()" class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                            <i class="fas fa-undo mr-2"></i>リセット
                        </button>
                        <button type="submit" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-save mr-2"></i>保存
                        </button>
                    </div>
                </form>
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
            
            // 組織デフォルト設定の読み込み
            async function loadSettings() {
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.get('/api/site-settings', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const settings = response.data;
                    
                    // フォームに値をセット（platform_で始まるもの以外）
                    Object.keys(settings).forEach(key => {
                        if (!key.startsWith('platform_')) {
                            const input = document.querySelector('#settingsForm [name="' + key + '"]');
                            if (input) {
                                input.value = settings[key] || '';
                            }
                        }
                    });
                } catch (error) {
                    console.error('Settings load error:', error);
                }
            }
            
            // プラットフォーム設定の保存
            document.getElementById('platformSettingsForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const data = {};
                formData.forEach((value, key) => {
                    if (key.startsWith('platform_')) {
                        data[key] = value;
                    }
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
            
            // 組織デフォルト設定の保存
            document.getElementById('settingsForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const data = {};
                formData.forEach((value, key) => {
                    if (!key.startsWith('platform_')) {
                        data[key] = value;
                    }
                });
                
                try {
                    const token = localStorage.getItem('master_token');
                    await axios.post('/api/site-settings', data, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    alert('設定を保存しました');
                } catch (error) {
                    console.error('Save error:', error);
                    alert('保存に失敗しました');
                }
            });
            
            // ページ読み込み時に設定を取得
            loadPlatformSettings();
            loadSettings();
        </script>
    </body>
    </html>
  `)
})

export default routes
