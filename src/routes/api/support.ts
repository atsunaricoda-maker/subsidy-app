// サポート・問い合わせAPI
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser, getEffectiveOrgId } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 問い合わせ送信
routes.post('/support/contact', async (c) => {
  try {
    const user = await getCurrentUser(c)
    const orgId = getEffectiveOrgId(c, user)
    
    const body = await c.req.json()
    const { category, subject, message, priority } = body
    
    if (!category || !subject || !message) {
      return c.json({ error: '必須項目が入力されていません' }, 400)
    }
    
    const { DB, RESEND_API_KEY } = c.env
    
    // 組織情報を取得
    let organizationName = '未ログイン'
    let userEmail = ''
    let userName = ''
    
    if (orgId) {
      const org = await DB.prepare('SELECT name, email FROM organizations WHERE id = ?').bind(orgId).first() as { name: string, email: string } | null
      if (org) {
        organizationName = org.name
        userEmail = org.email || ''
      }
    }
    
    if (user) {
      userName = user.name || user.username
    }
    
    // 問い合わせをDBに保存
    const result = await DB.prepare(`
      INSERT INTO support_inquiries (
        organization_id, user_id, user_name, user_email, organization_name,
        category, subject, message, priority, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).bind(
      orgId || null,
      user?.id || null,
      userName,
      userEmail,
      organizationName,
      category,
      subject,
      message,
      priority || 'normal'
    ).run()
    
    // メール送信（Resend APIを使用）
    if (RESEND_API_KEY) {
      try {
        const emailBody = `
【新規お問い合わせ】

■ 組織名: ${organizationName}
■ ユーザー名: ${userName || '未ログイン'}
■ メールアドレス: ${userEmail || '未設定'}
■ カテゴリ: ${getCategoryLabel(category)}
■ 優先度: ${getPriorityLabel(priority)}
■ 件名: ${subject}

■ 内容:
${message}

---
このメールは申請らくらく君から自動送信されました。
        `.trim()
        
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'support@shinsei-raku.com',
            to: 'support@shinsei-raku.com', // サポート受付メールアドレス
            subject: `【問い合わせ】${getCategoryLabel(category)}: ${subject}`,
            text: emailBody
          })
        })
      } catch (emailError) {
        console.error('Email send error:', emailError)
        // メール送信失敗してもDBには保存されているので成功とする
      }
    }
    
    return c.json({ 
      success: true, 
      message: 'お問い合わせを受け付けました。担当者より折り返しご連絡いたします。',
      inquiry_id: result.meta?.last_row_id
    })
  } catch (error) {
    console.error('Support contact error:', error)
    return c.json({ error: 'お問い合わせの送信に失敗しました' }, 500)
  }
})

// FAQ一覧取得
routes.get('/support/faq', async (c) => {
  try {
    const { DB } = c.env
    const category = c.req.query('category')
    
    let query = 'SELECT * FROM faq_items WHERE is_published = 1'
    const params: any[] = []
    
    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }
    
    query += ' ORDER BY sort_order ASC, created_at DESC'
    
    const faqs = await DB.prepare(query).bind(...params).all()
    
    // DBにデータがない場合はデフォルトFAQを返す
    if (!faqs.results || faqs.results.length === 0) {
      let defaultFaqs = getDefaultFAQs()
      if (category) {
        defaultFaqs = defaultFaqs.filter((faq: any) => faq.category === category)
      }
      return c.json({ faqs: defaultFaqs })
    }
    
    return c.json({ faqs: faqs.results })
  } catch (error) {
    console.error('FAQ fetch error:', error)
    // テーブルがない場合はデフォルトFAQを返す
    return c.json({ faqs: getDefaultFAQs() })
  }
})

// カテゴリラベル変換
function getCategoryLabel(category: string): string {
  const labels: { [key: string]: string } = {
    'general': '一般的な質問',
    'technical': '技術的な問題',
    'billing': '料金・プラン',
    'feature': '機能リクエスト',
    'bug': '不具合報告',
    'other': 'その他'
  }
  return labels[category] || category
}

// 優先度ラベル変換
function getPriorityLabel(priority: string): string {
  const labels: { [key: string]: string } = {
    'low': '低',
    'normal': '通常',
    'high': '高',
    'urgent': '緊急'
  }
  return labels[priority] || '通常'
}

// デフォルトFAQ（DBにデータがない場合）
function getDefaultFAQs() {
  return [
    // ===== 一般的な質問 =====
    {
      id: 1,
      category: 'general',
      question: '申請らくらく君とは何ですか？',
      answer: '申請らくらく君は、行政書士・社労士・税理士など士業の方向けの補助金・助成金申請業務支援クラウドサービスです。\n\n【主な機能】\n・案件管理：見込みから採択まで一元管理\n・顧客ポータル：お客様との書類やり取りを効率化\n・AIアシスタント：ヒアリング、マッチング、書類生成をサポート\n・進捗ボード：申請種別ごとの進捗を可視化\n・パイプライン管理：タスクの進捗を管理',
      sort_order: 1
    },
    {
      id: 2,
      category: 'general',
      question: 'どのような補助金・助成金に対応していますか？',
      answer: '主要な補助金・助成金にプリセット対応しています。\n\n【補助金】\n・IT導入補助金\n・ものづくり補助金\n・事業再構築補助金\n・小規模事業者持続化補助金\n\n【助成金】\n・キャリアアップ助成金\n・業務改善助成金\n・両立支援等助成金\n\nまた、「申請種別」メニューから独自の補助金・助成金を追加登録することも可能です。',
      sort_order: 2
    },
    {
      id: 3,
      category: 'general',
      question: '案件のステータスにはどのような種類がありますか？',
      answer: '案件は以下の5つのステータスで管理されます。\n\n1. 見込み：相談・検討段階（枠を消費しません）\n2. 書類準備中：申請書類の準備段階\n3. 申請中：申請書を提出済み、結果待ち\n4. 採択・入金待ち：採択され、入金を待っている状態\n5. 不採択：残念ながら不採択となった案件\n\n※「見込み」から他のステータスに変更する際に1枠消費されます。',
      sort_order: 3
    },
    {
      id: 4,
      category: 'general',
      question: 'サポート対応時間を教えてください',
      answer: 'お問い合わせは24時間受け付けております。\n\n【回答対応時間】\n平日 9:00〜18:00\n\n通常1〜2営業日以内に回答いたします。緊急のお問い合わせは優先的に対応いたします。',
      sort_order: 4
    },
    
    // ===== 料金・プラン =====
    {
      id: 10,
      category: 'billing',
      question: '料金プランを教えてください',
      answer: '以下のプランをご用意しています。\n\n【ベーシックプラン】月額3,000円\n・月1枠付与\n・見込み案件は無制限\n\n【スタンダードプラン】月額5,000円\n・月3枠付与\n・見込み案件は無制限\n\n【プレミアムプラン】月額10,000円\n・月10枠付与\n・見込み案件は無制限\n\n【Businessプラン】月額30,000円\n・月30枠付与\n・法人・複数拠点向け\n\n【Enterpriseプラン】月額100,000円\n・月100枠付与\n・大規模法人向け\n\n※すべてのプランで追加枠の購入が可能です。\n詳細は「設定」→「プラン」ページをご確認ください。',
      sort_order: 10
    },
    {
      id: 11,
      category: 'billing',
      question: '枠（スロット）とは何ですか？',
      answer: '枠は案件を進行させるために必要なリソースです。\n\n【枠の消費タイミング】\n・「見込み」→「書類準備中」など、見込み以外のステータスに変更する際に1枠消費\n・「見込み」のままであれば枠は消費されません\n\n【枠の補充】\n・毎月1日にプランに応じた枠数がリセット・付与されます\n・追加枠の購入も可能です（設定→プランから）\n\n【残り枠数の確認】\n・サイドバーの「プラン」に表示されています',
      sort_order: 11
    },
    {
      id: 12,
      category: 'billing',
      question: '追加枠を購入できますか？',
      answer: 'はい、月間の枠が不足した場合は追加購入が可能です。\n\n「設定」→「プラン」ページから追加枠パッケージを購入できます。\n\n購入した追加枠は当月中有効で、翌月への繰り越しはありません。まずは上位プランへのアップグレードをご検討ください。',
      sort_order: 12
    },
    {
      id: 13,
      category: 'billing',
      question: 'プランの変更・解約はできますか？',
      answer: 'はい、いつでも変更・解約が可能です。\n\n【プラン変更】\n「設定」→「プラン」ページから変更できます。\n・アップグレード：即時反映\n・ダウングレード：次回更新日から反映\n\n【解約】\n「設定」→「プラン」ページから解約手続きができます。解約後も現在の請求期間終了まではご利用いただけます。',
      sort_order: 13
    },
    
    // ===== 技術・機能 =====
    {
      id: 20,
      category: 'technical',
      question: '顧客ポータルとは何ですか？',
      answer: '顧客ポータルは、お客様（申請者）専用のWebページです。\n\n【顧客ポータルでできること】\n・進捗状況の確認\n・必要書類のアップロード\n・ヒアリング質問への回答\n・メッセージのやり取り\n・新規申請の依頼\n\n【使い方】\n案件詳細ページの「ポータル」ボタンでURLをコピーし、お客様にメールやLINEで共有してください。お客様はアカウント登録なしでアクセスできます。',
      sort_order: 20
    },
    {
      id: 21,
      category: 'technical',
      question: 'AIアシスタントではどのようなことができますか？',
      answer: 'AIが申請業務をサポートします。\n\n【AIヒアリング】\nお客様の状況をチャット形式でヒアリングし、申請に必要な情報を収集します。\n\n【補助金マッチング】\nお客様の事業内容や課題から、適した補助金・助成金を提案します。\n\n【書類生成】\n事業計画書などの申請書類のドラフトをAIが生成します。\n\n※顧客詳細ページの「AIアシスタント」タブからご利用いただけます。',
      sort_order: 21
    },
    {
      id: 22,
      category: 'technical',
      question: '案件進捗ボードとは何ですか？',
      answer: '案件進捗ボードは、補助金種別ごとに案件の進捗状況を一覧表示する機能です。\n\n【確認できる情報】\n・補助金種別ごとの案件数\n・各案件のタスク進捗率\n・期限が近いタスク\n・担当者ごとの案件状況\n\nサイドバーの「案件進捗ボード」からアクセスできます。日々の業務管理にご活用ください。',
      sort_order: 22
    },
    {
      id: 23,
      category: 'technical',
      question: 'パイプライン（タスク管理）の使い方を教えてください',
      answer: 'パイプラインは申請業務のタスクを管理する機能です。\n\n【パイプラインテンプレート】\n補助金種別ごとに標準的なタスクテンプレートが用意されています。「申請種別」→「パイプライン」から確認・編集できます。\n\n【案件へのパイプライン適用】\n案件詳細ページの「パイプライン」タブから、テンプレートを適用してタスクを自動生成できます。\n\n【タスクの進捗管理】\n各タスクの完了チェック、期限設定、添付ファイル管理が可能です。',
      sort_order: 23
    },
    {
      id: 24,
      category: 'technical',
      question: '複数の従業員で利用できますか？',
      answer: 'はい、複数の従業員アカウントを作成して利用できます。\n\n【アカウントの種類】\n・管理者（admin）：全機能にアクセス可能\n・スタッフ（staff）：案件管理など日常業務に必要な機能のみ\n\n【従業員の追加方法】\n「設定」→「従業員」ページから新規アカウントを作成できます。\n\n【案件の担当者設定】\n各案件に担当者を割り当て、担当者ごとの案件管理が可能です。',
      sort_order: 24
    },
    {
      id: 25,
      category: 'technical',
      question: 'データのバックアップは取れますか？',
      answer: 'はい、管理者権限を持つユーザーはデータのエクスポート・インポートが可能です。\n\n【バックアップ方法】\n「設定」→「バックアップ」ページから、全データをJSON形式でダウンロードできます。\n\n【バックアップ対象】\n・顧客情報\n・案件情報\n・書類データ\n・やり取り履歴\n・設定情報\n\n定期的なバックアップをお勧めします。',
      sort_order: 25
    },
    {
      id: 26,
      category: 'technical',
      question: '公募要領の管理機能について教えてください',
      answer: '公募要領管理機能では、各補助金・助成金の公募要領を登録・管理できます。\n\n【機能】\n・公募要領PDFのアップロード\n・URL（Web版要領）の登録\n・AIによる要領の自動解析\n・要点の抽出・要約\n\n「申請種別」→「公募要領」からアクセスできます。登録した公募要領はAIアシスタントの回答精度向上に活用されます。',
      sort_order: 26
    },
    {
      id: 27,
      category: 'technical',
      question: 'ヒアリングシートの設定方法を教えてください',
      answer: '補助金種別ごとにヒアリング質問をカスタマイズできます。\n\n【設定方法】\n1. 「申請種別」→ 対象の補助金を選択\n2. 「ヒアリング質問」タブを開く\n3. 質問の追加・編集・並べ替え\n\n【プリセット質問】\n主要な補助金には標準的な質問がプリセットされています。\n\n設定した質問は顧客ポータルの「ヒアリング」セクションに表示され、お客様が回答できるようになります。',
      sort_order: 27
    },
    {
      id: 28,
      category: 'technical',
      question: '請求書の発行機能はありますか？',
      answer: 'はい、案件ごとに請求書を作成・発行できます。\n\n【請求書作成】\n案件詳細ページの「請求」セクションから作成できます。\n\n【設定できる項目】\n・着手金、成功報酬、その他費用\n・振込先口座情報\n・請求書番号の自動採番\n\n【請求書の送付】\n作成した請求書はPDFでダウンロード、または顧客ポータル経由でお客様に共有できます。',
      sort_order: 28
    },
    {
      id: 29,
      category: 'technical',
      question: 'スマートフォンから利用できますか？',
      answer: 'はい、スマートフォン・タブレットからもご利用いただけます。\n\nレスポンシブデザインに対応しているため、PCと同じURLからアクセスするだけでモバイル最適化された画面で操作できます。\n\n外出先での案件確認や、お客様へのポータルURL共有などにご活用ください。',
      sort_order: 29
    },
    {
      id: 30,
      category: 'technical',
      question: '案件番号のフォーマットについて教えてください',
      answer: '案件番号は「CASE-YYYYMMDD-NNNN」形式で自動採番されます。\n\n【形式】\nCASE-20251223-0001\n・YYYYMMDD：作成日（年月日）\n・NNNN：その日の連番\n\nこの形式により、案件がいつ作成されたかが一目で分かります。',
      sort_order: 30
    }
  ]
}

export default routes
