// 顧客向け法務ページ（組織ごとに表示）
// SaaS利用者が自社の顧客に見せるプライバシーポリシー・利用規約・特商法表記
import { Hono } from 'hono'
import type { AppEnv } from '../../types'

const routes = new Hono<AppEnv>()

// Markdownを簡易的にHTMLに変換する共通関数
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

// 設定を取得する共通関数
const getSettings = async (DB: any) => {
  const settings: any = {}
  try {
    const result = await DB.prepare(`SELECT setting_key, setting_value FROM site_settings`).all()
    for (const s of (result.results || [])) {
      settings[(s as any).setting_key] = (s as any).setting_value || ''
    }
  } catch (e) {
    // テーブルがない場合はデフォルト値を使用
  }
  return settings
}

// ========================================
// プライバシーポリシー
// ========================================
routes.get('/privacy-policy', async (c) => {
  const { DB } = c.env
  const settings = await getSettings(DB)
  
  // 外部URLが設定されている場合はリダイレクト
  if (settings.privacy_policy_url && settings.privacy_policy_url.trim()) {
    return c.redirect(settings.privacy_policy_url)
  }
  
  const companyName = settings.company_name || '当事務所'
  const footerText = settings.footer_text || ''
  const privacyContent = settings.privacy_policy || ''
  
  // デフォルトのプライバシーポリシーテンプレート（士業事務所向け）
  const defaultPrivacy = `
    <p class="text-sm text-gray-500 mb-6">最終更新日: ${new Date().toLocaleDateString('ja-JP')}</p>
    
    <p class="text-gray-700 mb-6">${companyName}（以下「当事務所」といいます）は、補助金・助成金申請支援サービス（以下「本サービス」といいます）における、お客様の個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。</p>
    
    <h2 class="text-xl font-bold mb-4 text-gray-800">第1条（個人情報の定義）</h2>
    <p class="text-gray-700 mb-4">「個人情報」とは、個人情報保護法に定める個人情報を指し、生存する個人に関する情報であって、氏名、生年月日、住所、電話番号、メールアドレスその他の記述等により特定の個人を識別できるものを指します。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第2条（収集する個人情報）</h2>
    <p class="text-gray-700 mb-4">当事務所は、本サービスの提供にあたり、以下の個人情報を収集することがあります。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>氏名、会社名、役職</li>
      <li>住所、電話番号、メールアドレス</li>
      <li>法人番号、設立年月日</li>
      <li>従業員数、資本金、売上高等の事業情報</li>
      <li>決算書、確定申告書等の財務情報</li>
      <li>登記簿謄本、定款等の法人情報</li>
      <li>補助金・助成金申請に必要なその他の情報</li>
      <li>サービス利用履歴、通信記録</li>
    </ul>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第3条（個人情報の利用目的）</h2>
    <p class="text-gray-700 mb-4">当事務所は、収集した個人情報を以下の目的で利用します。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>補助金・助成金申請書類の作成・提出代行</li>
      <li>申請に関するご相談・アドバイスの提供</li>
      <li>申請状況のご報告・ご連絡</li>
      <li>サービス料金の請求・決済処理</li>
      <li>お問い合わせへの対応</li>
      <li>サービスの改善・新サービスの開発</li>
      <li>法令に基づく対応</li>
    </ul>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第4条（個人情報の第三者提供）</h2>
    <p class="text-gray-700 mb-4">当事務所は、以下の場合を除き、お客様の同意なく個人情報を第三者に提供しません。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>法令に基づく場合</li>
      <li>人の生命、身体または財産の保護のために必要な場合</li>
      <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要な場合</li>
      <li>国の機関等への協力が必要な場合</li>
      <li>補助金・助成金の申請先機関（国、地方公共団体、独立行政法人等）への提出に必要な場合</li>
      <li>業務委託先（本サービスのシステム運営会社等）への提供が必要な場合</li>
    </ul>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第5条（業務委託）</h2>
    <p class="text-gray-700 mb-4">当事務所は、本サービスの提供にあたり、以下の業務を外部に委託することがあります。委託先には、個人情報の適切な取扱いを義務付けています。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>システム運営・保守（申請らくらく君）</li>
      <li>データ保管（クラウドサービス）</li>
      <li>決済処理</li>
    </ul>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第6条（個人情報の安全管理）</h2>
    <p class="text-gray-700 mb-4">当事務所は、個人情報の漏洩、滅失、毀損の防止その他の安全管理のために、以下の措置を講じます。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>SSL/TLS暗号化通信の使用</li>
      <li>アクセス権限の適切な管理</li>
      <li>書類の施錠保管</li>
      <li>従業者への教育・監督</li>
    </ul>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第7条（個人情報の開示・訂正・削除）</h2>
    <p class="text-gray-700 mb-4">お客様は、当事務所に対して、ご自身の個人情報の開示、訂正、削除を請求することができます。請求をされる場合は、下記のお問い合わせ先までご連絡ください。本人確認の上、合理的な期間内に対応いたします。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第8条（個人情報の保存期間）</h2>
    <p class="text-gray-700 mb-4">当事務所は、お客様の個人情報を、サービス提供終了後も法令で定められた期間（税法上の書類保存期間等）保存することがあります。保存期間経過後は、適切な方法で廃棄いたします。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第9条（Cookieの使用）</h2>
    <p class="text-gray-700 mb-4">当事務所が利用するシステム（申請らくらく君）では、セッション管理のためにCookieを使用しています。ブラウザの設定によりCookieを無効化することができますが、一部の機能が利用できなくなる場合があります。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第10条（プライバシーポリシーの変更）</h2>
    <p class="text-gray-700 mb-4">当事務所は、必要に応じて本ポリシーを変更することがあります。変更後のプライバシーポリシーは、本ページに掲載した時点から効力を生じます。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第11条（お問い合わせ先）</h2>
    <p class="text-gray-700 mb-4">本ポリシーに関するお問い合わせは、以下までお願いいたします。</p>
    <div class="bg-gray-50 p-4 rounded-lg">
      <p class="text-gray-700 mb-1"><strong>${companyName}</strong></p>
      ${settings.company_address ? `<p class="text-gray-700 mb-1">住所: ${settings.postal_code ? '〒' + settings.postal_code + ' ' : ''}${settings.company_address}</p>` : ''}
      ${settings.company_email ? `<p class="text-gray-700 mb-1">メール: ${settings.company_email}</p>` : ''}
      ${settings.company_phone ? `<p class="text-gray-700">電話: ${settings.company_phone}</p>` : ''}
    </div>
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
                    <p class="text-green-200 text-sm mt-1">${companyName}</p>
                </div>
            </header>
            
            <div class="container mx-auto px-4 py-8 max-w-4xl flex-1">
                <div class="bg-white rounded-xl shadow-sm p-6 md:p-8">
                    ${contentHtml}
                </div>
                
                <div class="mt-8 flex justify-center gap-4 text-sm">
                    <a href="/terms" class="text-green-600 hover:text-green-800">
                        <i class="fas fa-file-contract mr-1"></i>利用規約
                    </a>
                    <span class="text-gray-300">|</span>
                    <a href="/legal" class="text-green-600 hover:text-green-800">
                        <i class="fas fa-balance-scale mr-1"></i>特定商取引法に基づく表記
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

// ========================================
// 特定商取引法に基づく表記
// ========================================
routes.get('/legal', async (c) => {
  const { DB } = c.env
  const settings = await getSettings(DB)
  
  // 外部URLが設定されている場合はリダイレクト
  if (settings.legal_notice_url && settings.legal_notice_url.trim()) {
    return c.redirect(settings.legal_notice_url)
  }
  
  const companyName = settings.company_name || '（事業者名を設定してください）'
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
                    <p class="text-blue-200 text-sm mt-1">${companyName}</p>
                </div>
            </header>
            
            <div class="container mx-auto px-4 py-8 max-w-4xl flex-1">
                <div class="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table class="w-full">
                        <tbody class="divide-y divide-gray-200">
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700 w-1/3">事業者名・屋号</th>
                                <td class="px-6 py-4 text-gray-900">${companyName}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">代表者・責任者</th>
                                <td class="px-6 py-4 text-gray-900">${settings.company_representative || '（設定画面で入力してください）'}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">所在地</th>
                                <td class="px-6 py-4 text-gray-900">
                                    ${settings.postal_code ? '〒' + settings.postal_code + '<br>' : ''}
                                    ${settings.company_address || '（設定画面で入力してください）'}
                                </td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">電話番号</th>
                                <td class="px-6 py-4 text-gray-900">
                                    ${settings.company_phone || '（設定画面で入力してください）'}
                                    ${settings.business_hours ? '<br><span class="text-sm text-gray-500">受付時間: ' + settings.business_hours + '</span>' : ''}
                                </td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">メールアドレス</th>
                                <td class="px-6 py-4 text-gray-900">${settings.company_email || '（設定画面で入力してください）'}</td>
                            </tr>
                            ${settings.invoice_registration_number ? `
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">適格請求書発行事業者<br>登録番号</th>
                                <td class="px-6 py-4 text-gray-900">${settings.invoice_registration_number}</td>
                            </tr>
                            ` : ''}
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">サービス内容</th>
                                <td class="px-6 py-4 text-gray-900">
                                    補助金・助成金申請支援サービス
                                    <ul class="list-disc ml-4 mt-2 text-sm text-gray-600">
                                        <li>申請書類の作成支援・代行</li>
                                        <li>申請に関するコンサルティング</li>
                                        <li>申請状況の管理・報告</li>
                                    </ul>
                                </td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">販売価格・報酬</th>
                                <td class="px-6 py-4 text-gray-900">
                                    ${settings.legal_price_info || `
                                        <p class="mb-2">料金は申請する補助金・助成金の種類により異なります。</p>
                                        <p class="mb-2">詳細はお見積りにてご案内いたします。</p>
                                        <p class="text-sm text-gray-500">※表示価格は全て税込みです</p>
                                    `}
                                </td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">支払方法</th>
                                <td class="px-6 py-4 text-gray-900">${settings.legal_payment_method || '銀行振込'}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">支払時期</th>
                                <td class="px-6 py-4 text-gray-900">
                                    ${settings.legal_payment_timing || `
                                        <p class="mb-1">【着手金】契約締結後、業務開始前にお支払い</p>
                                        <p>【成功報酬】補助金・助成金の交付決定後にお支払い</p>
                                    `}
                                </td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">サービス提供時期</th>
                                <td class="px-6 py-4 text-gray-900">${settings.legal_service_start || 'ご契約・着手金のお支払い確認後、速やかに業務を開始いたします。'}</td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">キャンセル・返金</th>
                                <td class="px-6 py-4 text-gray-900">
                                    ${settings.legal_cancel_policy || `
                                        <p class="mb-2">【着手前】着手金の全額を返金いたします。</p>
                                        <p class="mb-2">【着手後】業務の進捗状況に応じて、着手金の一部を返金いたします。</p>
                                        <p class="text-sm text-gray-500">※詳細は契約書に定めます</p>
                                    `}
                                </td>
                            </tr>
                            <tr class="hover:bg-gray-50">
                                <th class="px-6 py-4 bg-gray-50 text-left text-sm font-semibold text-gray-700">追加費用</th>
                                <td class="px-6 py-4 text-gray-900">${settings.legal_additional_cost || '申請に必要な証明書取得費用、郵送費等の実費は別途ご負担いただきます。'}</td>
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
                
                <div class="mt-8 flex justify-center gap-4 text-sm">
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

// ========================================
// 利用規約（顧客向けサービス利用規約）
// ========================================
routes.get('/terms', async (c) => {
  const { DB } = c.env
  const settings = await getSettings(DB)
  
  // 外部URLが設定されている場合はリダイレクト
  if (settings.terms_url && settings.terms_url.trim()) {
    return c.redirect(settings.terms_url)
  }
  
  const companyName = settings.company_name || '当事務所'
  const footerText = settings.footer_text || ''
  const termsContent = settings.terms_of_service || ''
  
  // デフォルトの利用規約テンプレート（士業事務所の顧客向け）
  const defaultTerms = `
    <p class="text-sm text-gray-500 mb-6">最終更新日: ${new Date().toLocaleDateString('ja-JP')}</p>
    
    <p class="text-gray-700 mb-6">この利用規約（以下「本規約」といいます）は、${companyName}（以下「当事務所」といいます）が提供する補助金・助成金申請支援サービス（以下「本サービス」といいます）の利用条件を定めるものです。お客様は、本規約に同意の上、本サービスをご利用ください。</p>
    
    <h2 class="text-xl font-bold mb-4 text-gray-800">第1条（適用）</h2>
    <p class="text-gray-700 mb-4">1. 本規約は、お客様と当事務所との間の本サービスの利用に関わる一切の関係に適用されます。</p>
    <p class="text-gray-700 mb-4">2. 当事務所が別途定める個別契約、見積書、契約書等の条件は、本規約の一部を構成します。本規約と個別契約等が矛盾する場合、個別契約等が優先されます。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第2条（サービス内容）</h2>
    <p class="text-gray-700 mb-4">本サービスは、以下の内容を含みます。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>補助金・助成金に関する情報提供・コンサルティング</li>
      <li>申請書類の作成支援・代行</li>
      <li>申請手続きの代行（委任を受けた場合）</li>
      <li>申請状況の管理・報告</li>
      <li>オンラインポータルを通じた書類提出・進捗確認</li>
    </ul>
    <p class="text-gray-700 mb-4">具体的なサービス内容・範囲は、個別契約にて定めます。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第3条（契約の成立）</h2>
    <p class="text-gray-700 mb-4">1. お客様が当事務所の見積書に同意し、契約書を締結した時点で、本サービスの利用契約が成立します。</p>
    <p class="text-gray-700 mb-4">2. 当事務所は、以下の場合に契約をお断りすることがあります。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>申請要件を満たさないことが明らかな場合</li>
      <li>虚偽の情報を申告された場合</li>
      <li>反社会的勢力に該当する、またはその関係が疑われる場合</li>
      <li>その他、当事務所が不適切と判断した場合</li>
    </ul>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第4条（お客様の義務）</h2>
    <p class="text-gray-700 mb-4">お客様は、本サービスの利用にあたり、以下の義務を負います。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>正確かつ最新の情報を提供すること</li>
      <li>必要書類を期日までに提出すること</li>
      <li>当事務所からの連絡・確認に速やかに対応すること</li>
      <li>本サービスに関する料金を期日までに支払うこと</li>
      <li>アカウント情報（ID・パスワード）を適切に管理すること</li>
      <li>補助金・助成金の不正受給に関わる行為をしないこと</li>
    </ul>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第5条（料金・支払い）</h2>
    <p class="text-gray-700 mb-4">1. 本サービスの料金は、個別契約または見積書に定めます。</p>
    <p class="text-gray-700 mb-4">2. 着手金は、業務開始前にお支払いいただきます。成功報酬は、補助金・助成金の交付決定後にお支払いいただきます。</p>
    <p class="text-gray-700 mb-4">3. 支払期日までにお支払いがない場合、当事務所は業務を中断することがあります。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第6条（免責事項）</h2>
    <p class="text-gray-700 mb-4">1. 当事務所は、補助金・助成金の採択・交付を保証するものではありません。申請が不採択となった場合でも、着手金の返金はいたしません。</p>
    <p class="text-gray-700 mb-4">2. 以下の事由により生じた損害について、当事務所は責任を負いません。</p>
    <ul class="list-disc ml-6 text-gray-700 mb-4">
      <li>お客様が提供した情報の誤り・不備に起因する場合</li>
      <li>お客様が必要書類を期日までに提出しなかった場合</li>
      <li>補助金・助成金制度の変更・廃止による場合</li>
      <li>天災、システム障害等の不可抗力による場合</li>
      <li>お客様の事業活動に起因する場合</li>
    </ul>
    <p class="text-gray-700 mb-4">3. 当事務所が責任を負う場合でも、その賠償額は、お客様が支払った報酬の額を上限とします。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第7条（秘密保持）</h2>
    <p class="text-gray-700 mb-4">1. 当事務所は、本サービスの提供を通じて知り得たお客様の秘密情報を、お客様の同意なく第三者に開示しません。</p>
    <p class="text-gray-700 mb-4">2. ただし、法令に基づく場合、補助金・助成金の申請に必要な場合は、この限りではありません。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第8条（契約解除）</h2>
    <p class="text-gray-700 mb-4">1. お客様は、当事務所に書面で通知することにより、いつでも契約を解除できます。</p>
    <p class="text-gray-700 mb-4">2. 当事務所は、お客様が本規約に違反した場合、その他信頼関係を維持できないと判断した場合、契約を解除できます。</p>
    <p class="text-gray-700 mb-4">3. 契約解除時の返金については、業務の進捗状況に応じて協議の上決定します。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第9条（知的財産権）</h2>
    <p class="text-gray-700 mb-4">当事務所が作成した申請書類、事業計画書等の著作権は当事務所に帰属します。ただし、お客様は、補助金・助成金申請の目的において、これらを使用することができます。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第10条（オンラインポータルの利用）</h2>
    <p class="text-gray-700 mb-4">1. お客様は、当事務所が提供するオンラインポータル（申請らくらく君）を通じて、書類の提出、進捗の確認、メッセージの送受信を行うことができます。</p>
    <p class="text-gray-700 mb-4">2. ポータルのアカウント情報は、お客様の責任で管理してください。不正利用による損害について、当事務所は責任を負いません。</p>
    <p class="text-gray-700 mb-4">3. ポータルは、システムの保守・改善のため、予告なく一時停止することがあります。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第11条（反社会的勢力の排除）</h2>
    <p class="text-gray-700 mb-4">お客様は、現在および将来にわたり、反社会的勢力に該当しないこと、および反社会的勢力と関係を有しないことを表明・保証します。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第12条（規約の変更）</h2>
    <p class="text-gray-700 mb-4">当事務所は、必要に応じて本規約を変更することがあります。変更後の規約は、本ページに掲載した時点から効力を生じます。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">第13条（準拠法・管轄裁判所）</h2>
    <p class="text-gray-700 mb-4">1. 本規約の解釈は、日本法に準拠します。</p>
    <p class="text-gray-700 mb-4">2. 本サービスに関して紛争が生じた場合、当事務所の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。</p>
    
    <h2 class="text-xl font-bold mt-8 mb-4 text-gray-800">お問い合わせ先</h2>
    <div class="bg-gray-50 p-4 rounded-lg">
      <p class="text-gray-700 mb-1"><strong>${companyName}</strong></p>
      ${settings.company_address ? `<p class="text-gray-700 mb-1">住所: ${settings.postal_code ? '〒' + settings.postal_code + ' ' : ''}${settings.company_address}</p>` : ''}
      ${settings.company_email ? `<p class="text-gray-700 mb-1">メール: ${settings.company_email}</p>` : ''}
      ${settings.company_phone ? `<p class="text-gray-700">電話: ${settings.company_phone}</p>` : ''}
    </div>
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
                    <p class="text-purple-200 text-sm mt-1">${companyName}</p>
                </div>
            </header>
            
            <div class="container mx-auto px-4 py-8 max-w-4xl flex-1">
                <div class="bg-white rounded-xl shadow-sm p-6 md:p-8">
                    ${contentHtml}
                </div>
                
                <div class="mt-8 flex justify-center gap-4 text-sm">
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
