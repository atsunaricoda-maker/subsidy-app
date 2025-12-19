// プライバシーポリシーページ（動的）
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/privacy-policy', async (c) => {
  const { DB } = c.env
  
  const settings: any = {}
  
  try {
    const result = await DB.prepare(`SELECT setting_key, setting_value FROM site_settings`).all()
    for (const s of (result.results || [])) {
      settings[(s as any).setting_key] = (s as any).setting_value || ''
    }
  } catch (e) {
    // テーブルがない場合はデフォルト値を使用
  }
  
  // 外部URLが設定されている場合はリダイレクト
  if (settings.privacy_policy_url && settings.privacy_policy_url.trim()) {
    return c.redirect(settings.privacy_policy_url)
  }
  
  const companyName = settings.company_name || '申請らくらく君'
  const footerText = settings.footer_text || ''
  const privacyContent = settings.privacy_policy || ''
  
  // Markdownを簡易的にHTMLに変換
  const markdownToHtml = (text: string) => {
    if (!text) return ''
    return text
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-6 mb-3 text-gray-800">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-gray-800">$1</h1>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-700">$1</li>')
      .replace(/\n\n/g, '</p><p class="text-gray-700 mb-4">')
      .replace(/\n/g, '<br>')
  }
  
  // デフォルトのプライバシーポリシーテンプレート
  const defaultPrivacy = `
    <h2 class="text-xl font-bold mb-4 text-gray-800">1. 個人情報の取得</h2>
    <p class="text-gray-700 mb-4">${companyName}（以下「当社」といいます）は、本サービスの提供にあたり、以下の個人情報を取得することがあります。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>氏名、会社名、所属部署</li>
      <li>メールアドレス、電話番号</li>
      <li>住所</li>
      <li>サービス利用履歴、アクセスログ</li>
      <li>その他、本サービスの提供に必要な情報</li>
    </ul>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">2. 個人情報の利用目的</h2>
    <p class="text-gray-700 mb-4">当社は、取得した個人情報を以下の目的で利用します。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>本サービスの提供・運営</li>
      <li>ユーザーからのお問い合わせへの対応</li>
      <li>サービス改善のための分析</li>
      <li>新機能・更新情報等のお知らせ</li>
      <li>利用規約に違反したユーザーへの対応</li>
    </ul>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">3. 個人情報の第三者提供</h2>
    <p class="text-gray-700 mb-4">当社は、以下の場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>法令に基づく場合</li>
      <li>人の生命、身体または財産の保護のために必要な場合</li>
      <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要な場合</li>
      <li>国の機関等への協力が必要な場合</li>
    </ul>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">4. 個人情報の安全管理</h2>
    <p class="text-gray-700 mb-4">当社は、個人情報の漏洩、滅失、毀損の防止その他の安全管理のために、必要かつ適切な措置を講じます。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">5. 個人情報の開示・訂正・削除</h2>
    <p class="text-gray-700 mb-4">ユーザーは、当社に対して、自己の個人情報の開示、訂正、削除を請求することができます。請求をされる場合は、下記のお問い合わせ先までご連絡ください。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">6. Cookieの使用</h2>
    <p class="text-gray-700 mb-4">当社は、本サービスにおいてCookieを使用することがあります。Cookieはブラウザの設定により無効化することができますが、一部のサービスが利用できなくなる場合があります。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">7. プライバシーポリシーの変更</h2>
    <p class="text-gray-700 mb-4">当社は、必要に応じて本ポリシーを変更することがあります。変更後のプライバシーポリシーは、本ページに掲載した時点から効力を生じます。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">8. お問い合わせ先</h2>
    <p class="text-gray-700 mb-4">本ポリシーに関するお問い合わせは、以下までお願いいたします。</p>
    <p class="text-gray-700 mb-4">
      ${companyName}<br>
      メール: ${settings.company_email || '（メールアドレス）'}<br>
      電話: ${settings.company_phone || '（電話番号）'}
    </p>
  `
  
  const contentHtml = privacyContent ? markdownToHtml(privacyContent) : defaultPrivacy
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>プライバシーポリシー - ${companyName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex flex-col">
            <header class="bg-gradient-to-r from-green-600 to-green-800 text-white shadow-lg">
                <div class="container mx-auto px-4 py-6">
                    <a href="/" class="text-green-200 hover:text-white text-sm mb-2 inline-block">
                        <i class="fas fa-arrow-left mr-1"></i>トップに戻る
                    </a>
                    <h1 class="text-2xl font-bold">
                        <i class="fas fa-shield-alt mr-2"></i>
                        プライバシーポリシー
                    </h1>
                </div>
            </header>
            
            <div class="container mx-auto px-4 py-8 max-w-4xl flex-1">
                <div class="bg-white rounded-xl shadow-sm p-6 md:p-8">
                    ${contentHtml}
                </div>
                
                <div class="mt-8 flex justify-center gap-4">
                    <a href="/legal" class="text-green-600 hover:text-green-800">
                        <i class="fas fa-balance-scale mr-1"></i>特定商取引法に基づく表記
                    </a>
                    <span class="text-gray-300">|</span>
                    <a href="/terms" class="text-green-600 hover:text-green-800">
                        <i class="fas fa-file-contract mr-1"></i>利用規約
                    </a>
                </div>
            </div>
            
            <footer class="bg-gray-800 text-gray-400 py-6 mt-8">
                <div class="container mx-auto px-4 text-center text-sm">
                    <p>${footerText || '© ' + new Date().getFullYear() + ' ' + companyName}</p>
                </div>
            </footer>
        </div>
    </body>
    </html>
  `)
})

routes.get('/legal', async (c) => {
  const { DB } = c.env
  
  const settings: any = {}
  
  try {
    const result = await DB.prepare(`SELECT setting_key, setting_value FROM site_settings`).all()
    for (const s of (result.results || [])) {
      settings[(s as any).setting_key] = (s as any).setting_value || ''
    }
  } catch (e) {
    // テーブルがない場合はデフォルト値を使用
  }
  
  // 外部URLが設定されている場合はリダイレクト
  if (settings.legal_notice_url && settings.legal_notice_url.trim()) {
    return c.redirect(settings.legal_notice_url)
  }
  
  const companyName = settings.company_name || '（未設定）'
  const footerText = settings.footer_text || ''
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>特定商取引法に基づく表記 - ${companyName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex flex-col">
            <header class="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
                <div class="container mx-auto px-4 py-6">
                    <a href="/" class="text-blue-200 hover:text-white text-sm mb-2 inline-block">
                        <i class="fas fa-arrow-left mr-1"></i>トップに戻る
                    </a>
                    <h1 class="text-2xl font-bold">
                        <i class="fas fa-balance-scale mr-2"></i>
                        特定商取引法に基づく表記
                    </h1>
                </div>
            </header>
            
            <div class="container mx-auto px-4 py-8 max-w-4xl flex-1">
                <div class="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table class="w-full">
                        <tbody class="divide-y divide-gray-200">
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700 w-1/3">事業者名</th>
                                <td class="px-6 py-4 text-gray-900">${companyName}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">代表者</th>
                                <td class="px-6 py-4 text-gray-900">${settings.company_representative || '（未設定）'}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">所在地</th>
                                <td class="px-6 py-4 text-gray-900">
                                    ${settings.postal_code ? '〒' + settings.postal_code + '<br>' : ''}
                                    ${settings.company_address || '（未設定）'}
                                </td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">電話番号</th>
                                <td class="px-6 py-4 text-gray-900">${settings.company_phone || '（未設定）'}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">メールアドレス</th>
                                <td class="px-6 py-4 text-gray-900">${settings.company_email || '（未設定）'}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">営業時間</th>
                                <td class="px-6 py-4 text-gray-900">${settings.business_hours || '（未設定）'}</td>
                            </tr>
                            ${settings.invoice_registration_number ? `
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">適格請求書発行事業者<br>登録番号</th>
                                <td class="px-6 py-4 text-gray-900">${settings.invoice_registration_number}</td>
                            </tr>
                            ` : ''}
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">販売価格</th>
                                <td class="px-6 py-4 text-gray-900">${settings.legal_price_info || 'サービス料金は各プランページに記載の通りです。表示価格は税込みです。'}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">支払方法</th>
                                <td class="px-6 py-4 text-gray-900">${settings.legal_payment_method || '銀行振込'}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">支払時期</th>
                                <td class="px-6 py-4 text-gray-900">${settings.legal_payment_timing || '請求書発行後14日以内'}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">サービス提供時期</th>
                                <td class="px-6 py-4 text-gray-900">${settings.legal_service_start || 'お申込み手続き完了後、即時ご利用いただけます。'}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">返品・キャンセル</th>
                                <td class="px-6 py-4 text-gray-900">${settings.legal_cancel_policy || '月額プランは解約申請月の末日までご利用可能です。日割り返金は行っておりません。'}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">追加費用</th>
                                <td class="px-6 py-4 text-gray-900">${settings.legal_additional_cost || '別途通信費等がかかる場合があります。'}</td>
                            </tr>
                            ${settings.bank_name ? `
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">振込先</th>
                                <td class="px-6 py-4 text-gray-900">
                                    ${settings.bank_name} ${settings.bank_branch || ''}支店<br>
                                    ${settings.bank_account_type || '普通'} ${settings.bank_account_number || ''}<br>
                                    口座名義: ${settings.bank_account_holder || ''}
                                </td>
                            </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
                
                <div class="mt-8 flex justify-center gap-4">
                    <a href="/terms" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-file-contract mr-1"></i>利用規約
                    </a>
                    <span class="text-gray-300">|</span>
                    <a href="/privacy-policy" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-shield-alt mr-1"></i>プライバシーポリシー
                    </a>
                </div>
            </div>
            
            <footer class="bg-gray-800 text-gray-400 py-6 mt-8">
                <div class="container mx-auto px-4 text-center text-sm">
                    <p>${footerText || '© ' + new Date().getFullYear() + ' ' + companyName}</p>
                </div>
            </footer>
        </div>
    </body>
    </html>
  `)
})

routes.get('/terms', async (c) => {
  const { DB } = c.env
  
  const settings: any = {}
  
  try {
    const result = await DB.prepare(`SELECT setting_key, setting_value FROM site_settings`).all()
    for (const s of (result.results || [])) {
      settings[(s as any).setting_key] = (s as any).setting_value || ''
    }
  } catch (e) {
    // テーブルがない場合はデフォルト値を使用
  }
  
  // 外部URLが設定されている場合はリダイレクト
  if (settings.terms_url && settings.terms_url.trim()) {
    return c.redirect(settings.terms_url)
  }
  
  const companyName = settings.company_name || '申請らくらく君'
  const footerText = settings.footer_text || ''
  const termsContent = settings.terms_of_service || ''
  
  // Markdownを簡易的にHTMLに変換
  const markdownToHtml = (text: string) => {
    if (!text) return ''
    return text
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-6 mb-3 text-gray-800">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-gray-800">$1</h1>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-700">$1</li>')
      .replace(/\n\n/g, '</p><p class="text-gray-700 mb-4">')
      .replace(/\n/g, '<br>')
  }
  
  // デフォルトの利用規約テンプレート
  const defaultTerms = `
    <h2 class="text-xl font-bold mb-4 text-gray-800">第1条（適用）</h2>
    <p class="text-gray-700 mb-4">本規約は、${companyName}（以下「当社」といいます）が提供するサービス「申請らくらく君」（以下「本サービス」といいます）の利用に関する条件を定めるものです。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第2条（利用登録）</h2>
    <p class="text-gray-700 mb-4">登録希望者が当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第3条（ユーザーIDおよびパスワードの管理）</h2>
    <p class="text-gray-700 mb-4">ユーザーは、自己の責任において、本サービスのユーザーIDおよびパスワードを適切に管理するものとします。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第4条（禁止事項）</h2>
    <p class="text-gray-700 mb-4">ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>法令または公序良俗に違反する行為</li>
      <li>犯罪行為に関連する行為</li>
      <li>当社のサービスの運営を妨害するおそれのある行為</li>
      <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
      <li>不正アクセスをし、またはこれを試みる行為</li>
    </ul>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第5条（本サービスの提供の停止等）</h2>
    <p class="text-gray-700 mb-4">当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第6条（免責事項）</h2>
    <p class="text-gray-700 mb-4">当社は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第7条（サービス内容の変更等）</h2>
    <p class="text-gray-700 mb-4">当社は、ユーザーに通知することなく、本サービスの内容を変更しまたは本サービスの提供を中止することができるものとし、これによってユーザーに生じた損害について一切の責任を負いません。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第8条（利用規約の変更）</h2>
    <p class="text-gray-700 mb-4">当社は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第9条（準拠法・裁判管轄）</h2>
    <p class="text-gray-700 mb-4">本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。</p>
  `
  
  const contentHtml = termsContent ? markdownToHtml(termsContent) : defaultTerms
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>利用規約 - ${companyName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex flex-col">
            <header class="bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg">
                <div class="container mx-auto px-4 py-6">
                    <a href="/" class="text-purple-200 hover:text-white text-sm mb-2 inline-block">
                        <i class="fas fa-arrow-left mr-1"></i>トップに戻る
                    </a>
                    <h1 class="text-2xl font-bold">
                        <i class="fas fa-file-contract mr-2"></i>
                        利用規約
                    </h1>
                </div>
            </header>
            
            <div class="container mx-auto px-4 py-8 max-w-4xl flex-1">
                <div class="bg-white rounded-xl shadow-sm p-6 md:p-8">
                    ${contentHtml}
                </div>
                
                <div class="mt-8 flex justify-center gap-4">
                    <a href="/legal" class="text-purple-600 hover:text-purple-800">
                        <i class="fas fa-balance-scale mr-1"></i>特定商取引法に基づく表記
                    </a>
                    <span class="text-gray-300">|</span>
                    <a href="/privacy-policy" class="text-purple-600 hover:text-purple-800">
                        <i class="fas fa-shield-alt mr-1"></i>プライバシーポリシー
                    </a>
                </div>
            </div>
            
            <footer class="bg-gray-800 text-gray-400 py-6 mt-8">
                <div class="container mx-auto px-4 text-center text-sm">
                    <p>${footerText || '© ' + new Date().getFullYear() + ' ' + companyName}</p>
                </div>
            </footer>
        </div>
    </body>
    </html>
  `)
})

export default routes
