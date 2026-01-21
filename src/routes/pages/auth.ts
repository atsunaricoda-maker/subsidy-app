// 認証ページ（ログイン・サインアップ）
import { Hono } from 'hono'
import type { AppEnv } from '../../types'

const routes = new Hono<AppEnv>()

// ログインページ
routes.get('/login', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ログイン - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex items-center justify-center">
            <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                <div class="text-center mb-8">
                    <img src="/static/logo.png" alt="申請らくらく君" class="w-24 h-auto mx-auto mb-4">
                    <h1 class="text-2xl font-bold text-gray-800">申請らくらく君</h1>
                    <p class="text-sm text-gray-600 mt-2">管理者ログイン</p>
                </div>
                
                <form id="loginForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">ユーザー名</label>
                        <input type="text" name="username" required 
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">パスワード</label>
                        <input type="password" name="password" required 
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button type="submit" 
                            class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                        ログイン
                    </button>
                </form>
                
                <div class="mt-6 text-center">
                    <p class="text-gray-600">
                        アカウントをお持ちでない方は 
                        <a href="/signup" class="text-blue-600 hover:underline font-medium">新規登録（14日間無料）</a>
                    </p>
                </div>
                
                <div class="mt-4 p-4 bg-blue-50 rounded-lg text-sm">
                    <p class="font-medium text-blue-800 mb-2">デモ用ログイン情報：</p>
                    <p class="text-blue-700">ユーザー名: <code class="bg-white px-2 py-1 rounded">admin</code></p>
                    <p class="text-blue-700">パスワード: <code class="bg-white px-2 py-1 rounded">admin123</code></p>
                </div>
                
                <div id="errorMessage" class="hidden mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm"></div>
                
                <!-- フッターリンク -->
                <div class="mt-6 pt-4 border-t text-center text-xs text-gray-500">
                    <a href="/legal" class="hover:text-blue-600">特定商取引法に基づく表記</a>
                    <span class="mx-2">|</span>
                    <a href="/terms" class="hover:text-blue-600">利用規約</a>
                    <span class="mx-2">|</span>
                    <a href="/privacy-policy" class="hover:text-blue-600">プライバシーポリシー</a>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                try {
                    const response = await axios.post('/api/auth/login', data);
                    localStorage.setItem('admin_token', response.data.token);
                    localStorage.setItem('admin_name', response.data.name);
                    localStorage.setItem('admin_username', response.data.username);
                    localStorage.setItem('admin_role', response.data.role);
                    localStorage.setItem('organization_id', response.data.organization_id);
                    localStorage.setItem('organization_name', response.data.organization_name || '');
                    window.location.href = '/';
                } catch (error) {
                    const errorDiv = document.getElementById('errorMessage');
                    errorDiv.textContent = error.response?.data?.error || 'ログインに失敗しました。ユーザー名またはパスワードが正しくありません。';
                    errorDiv.classList.remove('hidden');
                }
            });
        </script>
    </body>
    </html>
  `)
})

// サインアップページ（シンプル版：14日間トライアル + 1件枠付与）
routes.get('/signup', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>新規登録 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://www.google.com/recaptcha/api.js?render=6LcKKr8qAAAAALz_sz5kkkclmbWqb8aUcrzgOVaQ"></script>
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div class="min-h-screen py-12 px-4">
            <div class="max-w-xl mx-auto">
                <!-- ヘッダー -->
                <div class="text-center mb-8">
                    <img src="/static/logo.png" alt="申請らくらく君" class="w-28 h-auto mx-auto mb-4">
                    <h1 class="text-3xl font-bold text-gray-800">申請らくらく君</h1>
                    <p class="text-gray-600 mt-2">14日間の無料トライアル（1件分）で今すぐ始めましょう</p>
                </div>
                
                <!-- 特徴 -->
                <div class="grid grid-cols-3 gap-4 mb-8">
                    <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                        <i class="fas fa-clock text-2xl text-blue-500 mb-2"></i>
                        <p class="text-sm font-medium">即日利用可能</p>
                        <p class="text-xs text-gray-500">登録後すぐに使えます</p>
                    </div>
                    <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                        <i class="fas fa-credit-card text-2xl text-green-500 mb-2"></i>
                        <p class="text-sm font-medium">登録時カード不要</p>
                        <p class="text-xs text-gray-500">トライアル中は無料</p>
                    </div>
                    <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                        <i class="fas fa-gift text-2xl text-purple-500 mb-2"></i>
                        <p class="text-sm font-medium">1件無料</p>
                        <p class="text-xs text-gray-500">トライアル期間中</p>
                    </div>
                </div>
                
                <!-- 登録フォーム -->
                <div class="bg-white rounded-xl shadow-lg p-8">
                    <h2 class="text-xl font-bold text-gray-800 mb-6">無料トライアル登録</h2>
                    
                    <form id="signupForm" class="space-y-6">
                        <!-- 事務所情報 -->
                        <div class="border-b pb-6">
                            <h3 class="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                                <i class="fas fa-building mr-2 text-blue-500"></i>事務所情報
                            </h3>
                            <div class="grid grid-cols-1 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">事務所名 / 法人名 <span class="text-red-500">*</span></label>
                                    <input type="text" name="organization_name" id="organization_name" required 
                                           class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="例: 田中社労士事務所">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">
                                        サブドメイン <span class="text-red-500">*</span>
                                    </label>
                                    <div class="flex items-center">
                                        <input type="text" name="slug" id="slug" required pattern="[a-z0-9-]+"
                                               class="flex-1 px-4 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                               placeholder="例: tanaka-office">
                                        <span class="bg-gray-100 px-3 py-2 border border-l-0 rounded-r-lg text-gray-500 text-sm">.shinsei-raku.com</span>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">半角英数字とハイフンのみ</p>
                                    <div id="slugPreview" class="text-xs text-blue-600 mt-1 hidden">
                                        <i class="fas fa-globe mr-1"></i>URL: <span id="slugUrl"></span>
                                    </div>
                                    <div id="slugError" class="text-xs text-red-500 mt-1 hidden"></div>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span class="text-red-500">*</span></label>
                                    <div class="flex gap-2">
                                        <input type="email" name="email" id="email" required 
                                               class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                               placeholder="例: info@example.com">
                                        <button type="button" id="sendCodeBtn" onclick="sendVerificationCode()"
                                                class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm whitespace-nowrap">
                                            認証コード送信
                                        </button>
                                    </div>
                                    <div id="emailStatus" class="text-xs mt-1 hidden"></div>
                                </div>
                                <div id="verificationCodeSection" class="hidden">
                                    <label class="block text-sm font-medium text-gray-700 mb-1">認証コード <span class="text-red-500">*</span></label>
                                    <div class="flex gap-2">
                                        <input type="text" name="verification_code" id="verification_code" 
                                               class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-xl tracking-widest"
                                               placeholder="000000" maxlength="6" pattern="[0-9]{6}">
                                        <button type="button" id="verifyCodeBtn" onclick="verifyCode()"
                                                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm whitespace-nowrap">
                                            確認
                                        </button>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">メールに届いた6桁のコードを入力してください</p>
                                </div>
                                <input type="hidden" name="email_verified" id="email_verified" value="false">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                                    <input type="tel" name="phone" 
                                           class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="例: 03-1234-5678">
                                </div>
                            </div>
                        </div>
                        
                        <!-- 管理者情報 -->
                        <div class="border-b pb-6">
                            <h3 class="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                                <i class="fas fa-user-shield mr-2 text-green-500"></i>ログイン情報
                            </h3>
                            <div class="grid grid-cols-1 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">ご担当者名 <span class="text-red-500">*</span></label>
                                    <input type="text" name="admin_name" required 
                                           class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="例: 田中太郎">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">ユーザー名 <span class="text-red-500">*</span></label>
                                    <input type="text" name="username" required 
                                           class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="例: tanaka">
                                    <p class="text-xs text-gray-500 mt-1">ログイン時に使用します</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">パスワード <span class="text-red-500">*</span></label>
                                    <input type="password" name="password" required minlength="6"
                                           class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="6文字以上">
                                </div>
                            </div>
                        </div>
                        
                        <!-- 業務範囲選択 -->
                        <div class="border-b pb-6">
                            <h3 class="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                                <i class="fas fa-briefcase mr-2 text-indigo-500"></i>業務範囲 <span class="text-red-500 ml-1">*</span>
                            </h3>
                            <div class="space-y-3">
                                <label class="scope-option flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:border-indigo-300 transition-all border-indigo-500 bg-indigo-50" onclick="selectScope('labor', this)">
                                    <input type="radio" name="business_scope" value="labor" checked class="mt-1">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2">
                                            <span class="font-medium">社労士業務</span>
                                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">厚労省管轄</span>
                                        </div>
                                        <p class="text-sm text-gray-500 mt-1">助成金申請（キャリアアップ、両立支援等）</p>
                                    </div>
                                </label>
                                <label class="scope-option flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:border-indigo-300 transition-all border-gray-200" onclick="selectScope('administrative', this)">
                                    <input type="radio" name="business_scope" value="administrative" class="mt-1">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2">
                                            <span class="font-medium">行政書士業務</span>
                                            <span class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">経産省・自治体管轄</span>
                                        </div>
                                        <p class="text-sm text-gray-500 mt-1">補助金申請（持続化、IT導入等）+ 許認可</p>
                                    </div>
                                </label>
                                <label class="scope-option flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:border-indigo-300 transition-all border-gray-200" onclick="selectScope('both', this)">
                                    <input type="radio" name="business_scope" value="both" class="mt-1">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2">
                                            <span class="font-medium">両方</span>
                                        </div>
                                        <p class="text-sm text-gray-500 mt-1">助成金 + 補助金 + 許認可のすべてに対応</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <!-- トライアル説明 -->
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <h4 class="font-medium text-blue-800 flex items-center">
                                <i class="fas fa-gift mr-2"></i>14日間無料トライアル
                            </h4>
                            <ul class="text-sm text-blue-700 mt-2 space-y-1">
                                <li><i class="fas fa-check mr-2"></i>1件分の申請作成が無料</li>
                                <li><i class="fas fa-check mr-2"></i>すべての機能をお試し可能</li>
                                <li><i class="fas fa-check mr-2"></i>期間中にプランを選択して継続利用</li>
                            </ul>
                        </div>
                        
                        <!-- 利用規約 -->
                        <div class="flex items-start">
                            <input type="checkbox" id="terms" name="terms" required class="mt-1 mr-2">
                            <label for="terms" class="text-sm text-gray-600">
                                <a href="/terms" target="_blank" class="text-blue-600 hover:underline">利用規約</a>および
                                <a href="/privacy-policy" target="_blank" class="text-blue-600 hover:underline">プライバシーポリシー</a>に同意します
                            </label>
                        </div>
                        
                        <button type="submit" id="submitBtn"
                                class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors">
                            <i class="fas fa-rocket mr-2"></i>無料で始める
                        </button>
                    </form>
                    
                    <div id="errorMessage" class="hidden mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm"></div>
                    
                    <p class="text-center text-sm text-gray-600 mt-6">
                        すでにアカウントをお持ちですか？ 
                        <a href="/login" class="text-blue-600 hover:underline font-medium">ログイン</a>
                    </p>
                </div>
                
                <!-- フッターリンク -->
                <div class="mt-8 text-center text-xs text-gray-500">
                    <a href="/terms" class="hover:text-blue-600">利用規約</a>
                    <span class="mx-2">|</span>
                    <a href="/privacy-policy" class="hover:text-blue-600">プライバシーポリシー</a>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            let emailVerified = false;
            
            // 業務範囲選択
            function selectScope(scope, element) {
                document.querySelectorAll('.scope-option').forEach(el => {
                    el.classList.remove('border-indigo-500', 'bg-indigo-50');
                    el.classList.add('border-gray-200');
                });
                element.classList.remove('border-gray-200');
                element.classList.add('border-indigo-500', 'bg-indigo-50');
                element.querySelector('input[type="radio"]').checked = true;
            }
            
            // 認証コード送信
            async function sendVerificationCode() {
                const email = document.getElementById('email').value;
                if (!email) {
                    showError('メールアドレスを入力してください');
                    return;
                }
                
                const btn = document.getElementById('sendCodeBtn');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                hideError();
                
                try {
                    console.log('[DEBUG] Getting reCAPTCHA token...');
                    let recaptchaToken = '';
                    try {
                        if (typeof grecaptcha !== 'undefined' && grecaptcha.execute) {
                            recaptchaToken = await grecaptcha.execute('6LcKKr8qAAAAALz_sz5kkkclmbWqb8aUcrzgOVaQ', {action: 'send_verification'});
                            console.log('[DEBUG] reCAPTCHA token obtained:', recaptchaToken.substring(0, 20) + '...');
                        } else {
                            console.log('[DEBUG] reCAPTCHA not available, proceeding without token');
                        }
                    } catch (recaptchaError) {
                        console.log('[DEBUG] reCAPTCHA error (continuing without token):', recaptchaError);
                    }
                    
                    console.log('[DEBUG] Sending verification request for:', email);
                    const response = await axios.post('/api/signup/send-verification', {
                        email: email,
                        recaptcha_token: recaptchaToken
                    });
                    console.log('[DEBUG] Response:', response.data);
                    
                    if (response.data.success) {
                        document.getElementById('verificationCodeSection').classList.remove('hidden');
                        document.getElementById('emailStatus').classList.remove('hidden');
                        document.getElementById('emailStatus').className = 'text-xs mt-1 text-blue-600';
                        document.getElementById('emailStatus').innerHTML = '<i class="fas fa-envelope mr-1"></i>認証コードを送信しました。メールをご確認ください。';
                        document.getElementById('email').readOnly = true;
                        btn.innerHTML = '再送信';
                        btn.disabled = false;
                    }
                } catch (error) {
                    console.error('[DEBUG] Error:', error);
                    console.error('[DEBUG] Error response:', error.response?.data);
                    const errorMsg = error.response?.data?.error || '認証コードの送信に失敗しました。';
                    const debugHint = error.response?.data?.debug_hint;
                    let fullError = errorMsg;
                    if (debugHint) {
                        console.error('[DEBUG] Hint:', debugHint);
                        fullError += '\\n（詳細: ' + debugHint + '）';
                    }
                    showError(fullError);
                    btn.innerHTML = '認証コード送信';
                    btn.disabled = false;
                }
            }
            
            // 認証コード確認
            async function verifyCode() {
                const email = document.getElementById('email').value;
                const code = document.getElementById('verification_code').value;
                
                if (!code || code.length !== 6) {
                    showError('6桁の認証コードを入力してください');
                    return;
                }
                
                const btn = document.getElementById('verifyCodeBtn');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                hideError();
                
                try {
                    console.log('[DEBUG] Verifying code for:', email);
                    const response = await axios.post('/api/signup/verify-email', {
                        email: email,
                        code: code
                    });
                    console.log('[DEBUG] Verify response:', response.data);
                    
                    if (response.data.success) {
                        emailVerified = true;
                        document.getElementById('email_verified').value = 'true';
                        document.getElementById('emailStatus').className = 'text-xs mt-1 text-green-600';
                        document.getElementById('emailStatus').innerHTML = '<i class="fas fa-check-circle mr-1"></i>メールアドレスが認証されました';
                        document.getElementById('verificationCodeSection').classList.add('hidden');
                        document.getElementById('sendCodeBtn').classList.add('hidden');
                        hideError();
                    }
                } catch (error) {
                    console.error('[DEBUG] Verify error:', error);
                    console.error('[DEBUG] Verify error response:', error.response?.data);
                    showError(error.response?.data?.error || '認証に失敗しました');
                    btn.innerHTML = '確認';
                    btn.disabled = false;
                }
            }
            
            // フォーム送信
            document.getElementById('signupForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // メール認証チェック
                if (!emailVerified) {
                    showError('メールアドレスの認証が必要です。「認証コード送信」ボタンを押して認証してください。');
                    return;
                }
                
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                const btn = document.getElementById('submitBtn');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>認証中...';
                
                try {
                    // reCAPTCHA v3 トークン取得（失敗しても続行）
                    let recaptchaToken = '';
                    try {
                        if (typeof grecaptcha !== 'undefined' && grecaptcha.execute) {
                            recaptchaToken = await grecaptcha.execute('6LcKKr8qAAAAALz_sz5kkkclmbWqb8aUcrzgOVaQ', {action: 'signup'});
                        }
                    } catch (recaptchaError) {
                        console.log('[DEBUG] reCAPTCHA error (continuing without token):', recaptchaError);
                    }
                    
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>登録中...';
                    
                    const response = await axios.post('/api/signup', {
                        organization_name: data.organization_name,
                        slug: data.slug,
                        email: data.email,
                        phone: data.phone || '',
                        admin_name: data.admin_name,
                        username: data.username,
                        password: data.password,
                        business_scope: data.business_scope,
                        recaptcha_token: recaptchaToken
                    });
                    
                    if (response.data.success) {
                        // 登録成功 - ログイン情報を保存してリダイレクト
                        localStorage.setItem('admin_token', response.data.token);
                        localStorage.setItem('admin_name', response.data.admin_name);
                        localStorage.setItem('admin_username', response.data.username);
                        localStorage.setItem('organization_id', response.data.organization_id);
                        localStorage.setItem('organization_name', response.data.organization_name);
                        localStorage.setItem('organization_slug', response.data.organization_slug);
                        
                        // 成功メッセージを表示してリダイレクト
                        btn.innerHTML = '<i class="fas fa-check mr-2"></i>登録完了！';
                        btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                        btn.classList.add('bg-green-600');
                        
                        setTimeout(() => {
                            const slug = response.data.organization_slug;
                            window.location.href = 'https://' + slug + '.shinsei-raku.com/?welcome=true';
                        }, 1000);
                    }
                } catch (error) {
                    showError(error.response?.data?.error || '登録に失敗しました。もう一度お試しください。');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-rocket mr-2"></i>無料で始める';
                }
            });
            
            function showError(message) {
                const errorDiv = document.getElementById('errorMessage');
                errorDiv.textContent = message;
                errorDiv.classList.remove('hidden');
                errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            function hideError() {
                const errorDiv = document.getElementById('errorMessage');
                errorDiv.classList.add('hidden');
            }
            
            // slug自動生成・バリデーション
            const orgNameInput = document.getElementById('organization_name');
            const slugInput = document.getElementById('slug');
            const slugPreview = document.getElementById('slugPreview');
            const slugUrl = document.getElementById('slugUrl');
            const slugError = document.getElementById('slugError');
            let slugCheckTimeout = null;
            let slugManuallyEdited = false;
            
            orgNameInput.addEventListener('input', () => {
                if (!slugManuallyEdited && orgNameInput.value) {
                    const autoSlug = orgNameInput.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '-')
                        .replace(/-+/g, '-')
                        .replace(/^-|-$/g, '');
                    if (autoSlug) {
                        slugInput.value = autoSlug;
                        validateSlug(autoSlug);
                    }
                }
            });
            
            slugInput.addEventListener('input', () => {
                slugManuallyEdited = true;
                const value = slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                slugInput.value = value;
                validateSlug(value);
            });
            
            async function validateSlug(slug) {
                if (!slug) {
                    slugPreview.classList.add('hidden');
                    slugError.classList.add('hidden');
                    return;
                }
                
                slugUrl.textContent = slug + '.shinsei-raku.com';
                slugPreview.classList.remove('hidden');
                
                clearTimeout(slugCheckTimeout);
                slugCheckTimeout = setTimeout(async () => {
                    try {
                        const response = await axios.get('/api/check-slug?slug=' + encodeURIComponent(slug));
                        if (response.data.available) {
                            slugError.classList.add('hidden');
                            slugInput.classList.remove('border-red-500');
                            slugInput.classList.add('border-green-500');
                        } else {
                            slugError.textContent = response.data.reason === 'reserved' ? 'このURLは予約されています' : 'このURLは既に使用されています';
                            slugError.classList.remove('hidden');
                            slugInput.classList.remove('border-green-500');
                            slugInput.classList.add('border-red-500');
                        }
                    } catch (error) {
                        console.error('Slug check failed:', error);
                    }
                }, 500);
            }
        </script>
    </body>
    </html>
  `)
})

// 登録完了ページ（Stripe決済完了後のリダイレクト先）
routes.get('/signup-complete', async (c) => {
  const { DB } = c.env
  const sessionId = c.req.query('session_id')
  
  if (!sessionId) {
    return c.redirect('/signup')
  }
  
  // セッション情報を取得
  let signupData: any = null
  try {
    signupData = await DB.prepare(`
      SELECT * FROM signup_sessions WHERE session_id = ? AND is_used = 0
    `).bind(sessionId).first()
  } catch (e) {
    console.log('signup_sessions table might not exist yet')
  }
  
  // データがまだない場合は少し待ってリトライ案内
  if (!signupData) {
    return c.html(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>登録処理中... - 申請らくらく君</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
          <meta http-equiv="refresh" content="3">
      </head>
      <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center">
          <div class="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto text-center">
              <i class="fas fa-spinner fa-spin text-5xl text-blue-500 mb-4"></i>
              <h1 class="text-2xl font-bold text-gray-800 mb-2">登録処理中...</h1>
              <p class="text-gray-600">アカウントを準備しています。しばらくお待ちください。</p>
              <p class="text-sm text-gray-400 mt-4">自動的に更新されます</p>
          </div>
      </body>
      </html>
    `)
  }
  
  // セッションを使用済みにする
  try {
    await DB.prepare(`
      UPDATE signup_sessions SET is_used = 1, used_at = datetime('now') WHERE session_id = ?
    `).bind(sessionId).run()
  } catch (e) {
    console.log('Could not update signup_sessions')
  }
  
  const loginUrl = `https://${signupData.slug}.shinsei-raku.com`
  const username = signupData.username
  const password = signupData.initial_password
  const email = signupData.email
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>登録完了 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-green-50 to-blue-100 min-h-screen py-12 px-4">
        <div class="max-w-2xl mx-auto">
            <!-- 成功メッセージ -->
            <div class="bg-white rounded-xl shadow-lg p-8 text-center mb-8">
                <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i class="fas fa-check text-4xl text-green-600"></i>
                </div>
                <h1 class="text-3xl font-bold text-gray-800 mb-2">登録完了！</h1>
                <p class="text-gray-600 mb-6">申請らくらく君へようこそ！14日間の無料トライアルが開始されました。</p>
                
                <!-- ログイン情報 -->
                <div class="bg-blue-50 rounded-lg p-6 text-left mb-6">
                    <h2 class="font-bold text-blue-800 mb-4 flex items-center">
                        <i class="fas fa-key mr-2"></i>ログイン情報
                    </h2>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between bg-white rounded-lg p-3">
                            <span class="text-gray-600">アクセスURL</span>
                            <div class="flex items-center gap-2">
                                <code id="loginUrl" class="bg-gray-100 px-3 py-1 rounded text-blue-600 font-mono text-sm">
                                    ${loginUrl}
                                </code>
                                <button onclick="copyToClipboard('loginUrl')" class="text-blue-500 hover:text-blue-700">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center justify-between bg-white rounded-lg p-3">
                            <span class="text-gray-600">ユーザー名</span>
                            <div class="flex items-center gap-2">
                                <code id="username" class="bg-gray-100 px-3 py-1 rounded font-mono">${username}</code>
                                <button onclick="copyToClipboard('username')" class="text-blue-500 hover:text-blue-700">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center justify-between bg-white rounded-lg p-3">
                            <span class="text-gray-600">パスワード</span>
                            <div class="flex items-center gap-2">
                                <code id="password" class="bg-gray-100 px-3 py-1 rounded font-mono">${password}</code>
                                <button onclick="copyToClipboard('password')" class="text-blue-500 hover:text-blue-700">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <p class="text-sm text-blue-700 mt-4">
                        <i class="fas fa-envelope mr-1"></i>
                        この情報は <strong>${email}</strong> にもメールでお送りしています。
                    </p>
                </div>
                
                <!-- 注意事項 -->
                <div class="bg-yellow-50 rounded-lg p-4 text-left mb-6">
                    <p class="text-yellow-800 text-sm">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        <strong>重要:</strong> 初回ログイン後、必ずパスワードを変更してください。
                    </p>
                </div>
                
                <!-- ログインボタン -->
                <a href="${loginUrl}/login" 
                   class="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors">
                    <i class="fas fa-sign-in-alt mr-2"></i>ログインする
                </a>
            </div>
            
            <!-- 次のステップ -->
            <div class="bg-white rounded-xl shadow-lg p-6">
                <h2 class="font-bold text-gray-800 mb-4">次のステップ</h2>
                <div class="space-y-3">
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span class="text-blue-600 font-bold">1</span>
                        </div>
                        <div>
                            <p class="font-medium">ログインしてダッシュボードを確認</p>
                            <p class="text-sm text-gray-500">まずはシステムの全体像を把握しましょう</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span class="text-blue-600 font-bold">2</span>
                        </div>
                        <div>
                            <p class="font-medium">顧客情報を登録</p>
                            <p class="text-sm text-gray-500">最初の顧客を登録してみましょう</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span class="text-blue-600 font-bold">3</span>
                        </div>
                        <div>
                            <p class="font-medium">AIアシスタントで書類を生成</p>
                            <p class="text-sm text-gray-500">補助金申請書類の自動生成を体験しましょう</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- フッター -->
            <div class="text-center mt-8 text-sm text-gray-500">
                <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
                <p class="mt-2">© 2024 申請らくらく君</p>
            </div>
        </div>
        
        <script>
            function copyToClipboard(elementId) {
                const text = document.getElementById(elementId).textContent.trim();
                navigator.clipboard.writeText(text).then(() => {
                    // コピー成功のフィードバック
                    const btn = event.target.closest('button');
                    const originalIcon = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check text-green-500"></i>';
                    setTimeout(() => {
                        btn.innerHTML = originalIcon;
                    }, 1500);
                });
            }
        </script>
    </body>
    </html>
  `)
})

// キャンセル時のリダイレクト用
routes.get('/signup-cancelled', (c) => {
  return c.redirect('/signup?cancelled=true')
})

export default routes
