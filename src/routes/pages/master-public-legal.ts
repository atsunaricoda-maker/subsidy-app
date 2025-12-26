// プラットフォーム（申請らくらく君）の法務ページ
// SaaS利用者向けの利用規約・プライバシーポリシー・特商法表記
import { Hono } from 'hono'
import type { AppEnv } from '../../types'

const routes = new Hono<AppEnv>()

// 共通のヘッダー・フッターコンポーネント
const getLayout = (title: string, headerColor: string, icon: string, content: string) => `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - 申請らくらく君</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        .prose h2 { margin-top: 2rem; margin-bottom: 1rem; font-size: 1.25rem; font-weight: 700; color: #1f2937; }
        .prose h3 { margin-top: 1.5rem; margin-bottom: 0.75rem; font-size: 1.1rem; font-weight: 600; color: #374151; }
        .prose p { margin-bottom: 1rem; color: #4b5563; line-height: 1.75; }
        .prose ul { margin-bottom: 1rem; margin-left: 1.5rem; list-style-type: disc; }
        .prose li { color: #4b5563; margin-bottom: 0.5rem; }
        .prose table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
        .prose th, .prose td { padding: 0.75rem 1rem; border: 1px solid #e5e7eb; }
        .prose th { background: #f9fafb; font-weight: 600; text-align: left; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="min-h-screen flex flex-col">
        <header class="bg-gradient-to-r ${headerColor} text-white shadow-lg">
            <div class="container mx-auto px-4 py-6">
                <a href="/" class="text-white/70 hover:text-white text-sm mb-2 inline-block">
                    <i class="fas fa-arrow-left mr-1"></i>トップに戻る
                </a>
                <h1 class="text-2xl font-bold">
                    <i class="fas ${icon} mr-2"></i>
                    ${title}
                </h1>
                <p class="text-white/80 text-sm mt-1">申請らくらく君 プラットフォーム運営</p>
            </div>
        </header>
        
        <div class="container mx-auto px-4 py-8 max-w-4xl flex-1">
            <div class="bg-white rounded-xl shadow-sm p-6 md:p-8 prose">
                ${content}
            </div>
            
            <div class="mt-8 flex justify-center gap-4 text-sm">
                <a href="/master/terms" class="text-blue-600 hover:text-blue-800">
                    <i class="fas fa-file-contract mr-1"></i>SaaS利用規約
                </a>
                <span class="text-gray-300">|</span>
                <a href="/master/legal" class="text-blue-600 hover:text-blue-800">
                    <i class="fas fa-balance-scale mr-1"></i>特定商取引法
                </a>
                <span class="text-gray-300">|</span>
                <a href="/master/privacy-policy" class="text-blue-600 hover:text-blue-800">
                    <i class="fas fa-shield-alt mr-1"></i>プライバシーポリシー
                </a>
            </div>
        </div>
        
        <footer class="bg-gray-800 text-gray-400 py-6 mt-8">
            <div class="container mx-auto px-4 text-center text-sm">
                <p>© ${new Date().getFullYear()} 申請らくらく君 All Rights Reserved.</p>
            </div>
        </footer>
    </div>
</body>
</html>
`

// ========================================
// プライバシーポリシー（プラットフォーム用）
// ========================================
routes.get('/master/privacy-policy', async (c) => {
  const content = `
    <p class="text-gray-600 text-sm mb-6">最終更新日: ${new Date().toLocaleDateString('ja-JP')}</p>
    
    <p>申請らくらく君運営（以下「当社」といいます）は、本プラットフォーム「申請らくらく君」（以下「本サービス」といいます）における、サービス利用事業者（以下「利用事業者」といいます）および利用事業者の顧客（以下「エンドユーザー」といいます）の個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。</p>
    
    <h2>第1条（個人情報の定義）</h2>
    <p>「個人情報」とは、個人情報保護法に定める個人情報を指し、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日その他の記述等により特定の個人を識別できるものを指します。</p>
    
    <h2>第2条（個人情報の収集）</h2>
    <p>当社は、本サービスの提供にあたり、以下の個人情報を収集することがあります。</p>
    
    <h3>2.1 利用事業者から収集する情報</h3>
    <ul>
        <li>会社名・屋号、代表者名</li>
        <li>所在地、電話番号、メールアドレス</li>
        <li>担当者名、担当者連絡先</li>
        <li>決済情報（クレジットカード情報はStripe社が管理）</li>
        <li>行政書士登録番号等の資格情報</li>
        <li>サービス利用履歴、ログ情報</li>
    </ul>
    
    <h3>2.2 エンドユーザーから収集する情報</h3>
    <p>エンドユーザーの情報は、利用事業者が本サービスを通じて収集・管理します。当社は、サービス運営上必要な範囲でこれらの情報にアクセスする場合があります。</p>
    <ul>
        <li>氏名、会社名、連絡先</li>
        <li>助成金申請に必要な書類・情報</li>
        <li>サービス利用履歴</li>
    </ul>
    
    <h2>第3条（個人情報の利用目的）</h2>
    <p>当社は、収集した個人情報を以下の目的で利用します。</p>
    <ul>
        <li>本サービスの提供・運営・改善</li>
        <li>利用事業者の本人確認、契約管理</li>
        <li>利用料金の請求・決済処理</li>
        <li>お問い合わせ対応、サポート提供</li>
        <li>サービスに関する重要なお知らせの送信</li>
        <li>新機能・アップデート情報の案内（同意がある場合）</li>
        <li>利用規約違反への対応</li>
        <li>統計データの作成（個人を特定できない形式）</li>
    </ul>
    
    <h2>第4条（個人情報の第三者提供）</h2>
    <p>当社は、以下の場合を除き、利用者の同意なく個人情報を第三者に提供しません。</p>
    <ul>
        <li>法令に基づく場合</li>
        <li>人の生命、身体または財産の保護のために必要な場合</li>
        <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要な場合</li>
        <li>国の機関等への協力が必要な場合</li>
        <li>利用事業者とエンドユーザー間のサービス提供に必要な場合</li>
    </ul>
    
    <h2>第5条（個人情報の委託）</h2>
    <p>当社は、利用目的の達成に必要な範囲内において、個人情報の取扱いを外部に委託することがあります。委託先は以下を含みます。</p>
    <ul>
        <li>Cloudflare, Inc.（インフラ・データ保管）</li>
        <li>Stripe, Inc.（決済処理）</li>
        <li>Resend（メール送信）</li>
        <li>OpenAI（AI機能提供）</li>
    </ul>
    
    <h2>第6条（個人情報の安全管理）</h2>
    <p>当社は、個人情報の漏洩、滅失、毀損の防止その他の安全管理のために、以下の措置を講じます。</p>
    <ul>
        <li>SSL/TLS暗号化通信の使用</li>
        <li>パスワードのハッシュ化保存</li>
        <li>アクセス権限の適切な管理</li>
        <li>定期的なセキュリティ監査</li>
    </ul>
    
    <h2>第7条（個人情報の開示・訂正・削除）</h2>
    <p>利用者は、当社に対して、自己の個人情報の開示、訂正、削除を請求することができます。請求をされる場合は、下記のお問い合わせ先までご連絡ください。本人確認の上、合理的な期間内に対応いたします。</p>
    
    <h2>第8条（Cookieの使用）</h2>
    <p>当社は、本サービスにおいてCookieを使用します。Cookieは、セッション管理、ログイン状態の維持、サービス改善のための分析に使用されます。ブラウザの設定によりCookieを無効化できますが、一部機能が利用できなくなる場合があります。</p>
    
    <h2>第9条（データの保管場所）</h2>
    <p>本サービスで収集したデータは、Cloudflare社のグローバルネットワーク上に保管されます。データは暗号化され、適切なセキュリティ対策のもとで管理されます。</p>
    
    <h2>第10条（利用事業者の責任）</h2>
    <p>利用事業者は、エンドユーザーの個人情報を本サービスを通じて収集・管理する場合、自らの責任において適切なプライバシーポリシーを定め、エンドユーザーに対して必要な説明・同意取得を行うものとします。</p>
    
    <h2>第11条（プライバシーポリシーの変更）</h2>
    <p>当社は、必要に応じて本ポリシーを変更することがあります。重要な変更がある場合は、本サービス上での通知またはメールにてお知らせします。変更後のプライバシーポリシーは、本ページに掲載した時点から効力を生じます。</p>
    
    <h2>第12条（お問い合わせ先）</h2>
    <p>本ポリシーに関するお問い合わせは、以下までお願いいたします。</p>
    <div class="bg-gray-50 p-4 rounded-lg">
        <p class="mb-1"><strong>申請らくらく君 運営事務局</strong></p>
        <p class="mb-1">メール: support@shinsei-raku.com</p>
    </div>
  `
  
  return c.html(getLayout(
    'プライバシーポリシー',
    'from-green-600 to-green-800',
    'fa-shield-alt',
    content
  ))
})

// ========================================
// 特定商取引法に基づく表記（プラットフォーム用）
// ========================================
routes.get('/master/legal', async (c) => {
  const content = `
    <p class="text-gray-600 text-sm mb-6">申請らくらく君 サブスクリプションサービスに関する表記</p>
    
    <table>
        <tbody>
            <tr>
                <th>事業者名</th>
                <td>申請らくらく君 運営事務局</td>
            </tr>
            <tr>
                <th>運営責任者</th>
                <td>（代表者名を記載）</td>
            </tr>
            <tr>
                <th>所在地</th>
                <td>（住所を記載）</td>
            </tr>
            <tr>
                <th>電話番号</th>
                <td>（電話番号を記載）<br><span class="text-sm text-gray-500">※お問い合わせはメールにてお願いいたします</span></td>
            </tr>
            <tr>
                <th>メールアドレス</th>
                <td>support@shinsei-raku.com</td>
            </tr>
            <tr>
                <th>販売価格</th>
                <td>
                    <p class="mb-2">月額サブスクリプション（税込）:</p>
                    <ul class="list-none ml-0">
                        <li>・Basic: ¥3,000/月（月1枠）</li>
                        <li>・Standard: ¥5,000/月（月3枠）</li>
                        <li>・Premium: ¥10,000/月（月10枠）</li>
                        <li>・Business: ¥30,000/月（月30枠）</li>
                        <li>・Enterprise: ¥100,000/月（月100枠）</li>
                    </ul>
                    <p class="mt-2 mb-2">追加枠（税込・無期限）:</p>
                    <ul class="list-none ml-0">
                        <li>・1枠: ¥1,500</li>
                        <li>・3枠: ¥3,000（¥1,000/枠）</li>
                        <li>・10枠: ¥9,000（¥900/枠）</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <th>支払方法</th>
                <td>クレジットカード決済（Stripe経由）<br>VISA / Mastercard / American Express / JCB</td>
            </tr>
            <tr>
                <th>支払時期</th>
                <td>
                    <p>・月額プラン: 契約開始時および毎月の契約更新日に自動課金</p>
                    <p>・追加枠: 購入時に即時決済</p>
                </td>
            </tr>
            <tr>
                <th>サービス提供時期</th>
                <td>決済完了後、即時ご利用いただけます。</td>
            </tr>
            <tr>
                <th>返品・キャンセル</th>
                <td>
                    <p>・月額プラン: いつでも解約可能です。解約申請後、当月末までサービスをご利用いただけます。日割り返金は行っておりません。</p>
                    <p>・追加枠: デジタルコンテンツの性質上、購入後の返金はお受けしておりません。</p>
                </td>
            </tr>
            <tr>
                <th>動作環境</th>
                <td>
                    <p>推奨ブラウザ:</p>
                    <ul class="list-none ml-0">
                        <li>・Google Chrome（最新版）</li>
                        <li>・Firefox（最新版）</li>
                        <li>・Safari（最新版）</li>
                        <li>・Microsoft Edge（最新版）</li>
                    </ul>
                    <p class="mt-2">※インターネット接続環境が必要です</p>
                </td>
            </tr>
            <tr>
                <th>追加費用</th>
                <td>サービス利用に伴う通信費等はお客様のご負担となります。</td>
            </tr>
        </tbody>
    </table>
  `
  
  return c.html(getLayout(
    '特定商取引法に基づく表記',
    'from-blue-600 to-blue-800',
    'fa-balance-scale',
    content
  ))
})

// ========================================
// SaaS利用規約（プラットフォーム用）
// ========================================
routes.get('/master/terms', async (c) => {
  const content = `
    <p class="text-gray-600 text-sm mb-6">最終更新日: ${new Date().toLocaleDateString('ja-JP')}</p>
    
    <p>この利用規約（以下「本規約」といいます）は、申請らくらく君運営（以下「当社」といいます）が提供するSaaSプラットフォーム「申請らくらく君」（以下「本サービス」といいます）の利用条件を定めるものです。本サービスを利用する事業者（以下「利用事業者」といいます）は、本規約に同意した上で本サービスを利用するものとします。</p>
    
    <h2>第1条（適用）</h2>
    <p>1. 本規約は、利用事業者と当社との間の本サービスの利用に関わる一切の関係に適用されます。</p>
    <p>2. 当社が本サービス上で掲載する個別規定、ガイドライン、ヘルプ等も本規約の一部を構成します。</p>
    
    <h2>第2条（定義）</h2>
    <p>本規約において、以下の用語は以下の意味を持ちます。</p>
    <ul>
        <li><strong>「利用事業者」</strong>: 本サービスに登録し、サブスクリプション契約を締結した法人または個人事業主</li>
        <li><strong>「エンドユーザー」</strong>: 利用事業者が本サービスを通じてサービスを提供する顧客</li>
        <li><strong>「サブドメイン」</strong>: 利用事業者に割り当てられる専用URL（例: xxx.shinsei-raku.com）</li>
        <li><strong>「枠」</strong>: 利用事業者が管理できる案件数の単位</li>
    </ul>
    
    <h2>第3条（利用登録）</h2>
    <p>1. 登録希望者が当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了します。</p>
    <p>2. 当社は、以下の場合に登録を拒否することがあります。</p>
    <ul>
        <li>虚偽の情報を申告した場合</li>
        <li>過去に本規約違反により登録を取り消された場合</li>
        <li>反社会的勢力等に該当する場合</li>
        <li>その他当社が適当でないと判断した場合</li>
    </ul>
    
    <h2>第4条（サブスクリプション）</h2>
    <p>1. 利用事業者は、当社が定めるプランを選択し、月額料金を支払うことで本サービスを利用できます。</p>
    <p>2. 各プランには月間の利用可能枠数が設定されており、枠数を超えて案件を管理する場合は追加枠の購入が必要です。</p>
    <p>3. 月間枠は毎月リセットされます。追加購入した枠は無期限で有効です。</p>
    <p>4. プランの変更は、変更申請日の翌月から適用されます。</p>
    
    <h2>第5条（料金および支払い）</h2>
    <p>1. 利用事業者は、当社が定める料金を、当社が指定する方法により支払うものとします。</p>
    <p>2. 支払いはクレジットカード決済（Stripe経由）により行います。</p>
    <p>3. 月額料金は、契約開始日を起算日として毎月自動的に課金されます。</p>
    <p>4. 支払いに関する手数料は利用事業者の負担とします。</p>
    
    <h2>第6条（解約）</h2>
    <p>1. 利用事業者は、当社所定の方法により、いつでもサブスクリプションを解約できます。</p>
    <p>2. 解約した場合、当月末まで本サービスを利用できます。</p>
    <p>3. 日割り計算による返金は行いません。</p>
    <p>4. 解約後、利用事業者のデータは30日間保持された後、削除されます。</p>
    
    <h2>第7条（アカウント管理）</h2>
    <p>1. 利用事業者は、自己の責任においてアカウント情報を適切に管理するものとします。</p>
    <p>2. アカウント情報の管理不十分、第三者による使用等による損害について、当社は責任を負いません。</p>
    
    <h2>第8条（禁止事項）</h2>
    <p>利用事業者は、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
    <ul>
        <li>法令または公序良俗に違反する行為</li>
        <li>犯罪行為に関連する行為</li>
        <li>当社または第三者の知的財産権、プライバシー、名誉等を侵害する行為</li>
        <li>本サービスの運営を妨害する行為</li>
        <li>不正アクセスまたはこれを試みる行為</li>
        <li>他の利用事業者の情報を不正に取得する行為</li>
        <li>本サービスを第三者に再販売する行為</li>
        <li>その他当社が不適切と判断する行為</li>
    </ul>
    
    <h2>第9条（サービスの停止・中断）</h2>
    <p>当社は、以下の場合に、利用事業者に事前に通知することなく本サービスの全部または一部を停止・中断できます。</p>
    <ul>
        <li>システムの保守・点検を行う場合</li>
        <li>火災、停電、天災等により運営が困難な場合</li>
        <li>その他当社が必要と判断した場合</li>
    </ul>
    
    <h2>第10条（利用事業者の責任）</h2>
    <p>1. 利用事業者は、本サービスを通じてエンドユーザーに提供するサービスについて、自己の責任において適切に運営するものとします。</p>
    <p>2. 利用事業者は、エンドユーザーとの間で生じた紛争について、自己の責任と費用で解決するものとします。</p>
    <p>3. 利用事業者は、本サービスを利用してエンドユーザーの個人情報を取り扱う場合、個人情報保護法その他関連法令を遵守するものとします。</p>
    
    <h2>第11条（知的財産権）</h2>
    <p>1. 本サービスに関する知的財産権は、当社または正当な権利者に帰属します。</p>
    <p>2. 利用事業者が本サービスにアップロードしたコンテンツの権利は、利用事業者に帰属します。</p>
    
    <h2>第12条（免責事項）</h2>
    <p>1. 当社は、本サービスが利用事業者の特定の目的に適合すること、期待する機能・商品的価値・正確性・有用性を有すること、継続的に利用できることを保証しません。</p>
    <p>2. 当社は、本サービスの利用により生じた損害について、当社の故意または重大な過失による場合を除き、責任を負いません。</p>
    <p>3. 当社が責任を負う場合でも、その範囲は直接かつ通常の損害に限り、利用事業者が支払った直近3ヶ月分の利用料金を上限とします。</p>
    
    <h2>第13条（秘密保持）</h2>
    <p>利用事業者は、本サービスの利用に関して知り得た当社の技術上、営業上の秘密情報を、当社の事前の書面による承諾なく第三者に開示・漏洩してはなりません。</p>
    
    <h2>第14条（反社会的勢力の排除）</h2>
    <p>利用事業者は、現在および将来にわたり、反社会的勢力に該当しないことを表明・保証します。当社は、利用事業者が反社会的勢力に該当すると判明した場合、直ちに契約を解除できます。</p>
    
    <h2>第15条（規約の変更）</h2>
    <p>1. 当社は、必要に応じて本規約を変更できます。</p>
    <p>2. 変更後の規約は、本サービス上への掲載をもって効力を生じます。</p>
    <p>3. 重要な変更については、事前にメール等で通知します。</p>
    
    <h2>第16条（通知）</h2>
    <p>当社から利用事業者への通知は、本サービス上での掲載または登録されたメールアドレスへの送信により行います。</p>
    
    <h2>第17条（権利義務の譲渡禁止）</h2>
    <p>利用事業者は、当社の書面による事前の承諾なく、本規約に基づく権利義務を第三者に譲渡、担保設定その他の処分をしてはなりません。</p>
    
    <h2>第18条（分離可能性）</h2>
    <p>本規約のいずれかの条項が無効または執行不能とされた場合でも、本規約の他の条項は引き続き有効に存続します。</p>
    
    <h2>第19条（準拠法・管轄裁判所）</h2>
    <p>1. 本規約の解釈は、日本法に準拠します。</p>
    <p>2. 本サービスに関して紛争が生じた場合、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</p>
    
    <h2>お問い合わせ先</h2>
    <div class="bg-gray-50 p-4 rounded-lg">
        <p class="mb-1"><strong>申請らくらく君 運営事務局</strong></p>
        <p class="mb-1">メール: support@shinsei-raku.com</p>
    </div>
  `
  
  return c.html(getLayout(
    'SaaS利用規約',
    'from-purple-600 to-purple-800',
    'fa-file-contract',
    content
  ))
})

export default routes
