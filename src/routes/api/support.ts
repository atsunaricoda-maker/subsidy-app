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
    
    return c.json({ faqs: faqs.results || [] })
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
    {
      id: 1,
      category: 'general',
      question: '申請らくらく君とは何ですか？',
      answer: '申請らくらく君は、補助金・助成金の申請業務を効率化するためのクラウドサービスです。案件管理、書類作成、顧客とのやり取りを一元管理できます。',
      sort_order: 1
    },
    {
      id: 2,
      category: 'general',
      question: 'どのような補助金・助成金に対応していますか？',
      answer: 'IT導入補助金、ものづくり補助金、事業再構築補助金、小規模事業者持続化補助金、各種助成金など、主要な補助金・助成金に対応しています。また、独自の申請種別を追加することも可能です。',
      sort_order: 2
    },
    {
      id: 3,
      category: 'billing',
      question: '料金プランを教えてください',
      answer: '無料トライアルプラン（月1枠）からスタートできます。有料プランでは月額料金に応じて利用可能な枠数が増加します。詳しくは「プラン」ページをご確認ください。',
      sort_order: 3
    },
    {
      id: 4,
      category: 'billing',
      question: '枠（スロット）とは何ですか？',
      answer: '枠は案件を進行させるために必要なリソースです。「見込み」ステータスから他のステータスに変更する際に1枠消費されます。毎月のプランに応じた枠が付与され、追加購入も可能です。',
      sort_order: 4
    },
    {
      id: 5,
      category: 'technical',
      question: '顧客ポータルとは何ですか？',
      answer: '顧客ポータルは、お客様（申請者）が書類のアップロードやヒアリング回答、進捗確認を行うための専用ページです。アクセストークン付きのURLを共有することで、アカウント作成なしで利用できます。',
      sort_order: 5
    },
    {
      id: 6,
      category: 'technical',
      question: 'データのバックアップは取れますか？',
      answer: 'はい、管理者権限を持つユーザーは「設定」→「バックアップ」からデータのエクスポート・インポートが可能です。JSON形式でダウンロードできます。',
      sort_order: 6
    },
    {
      id: 7,
      category: 'technical',
      question: '複数の従業員で利用できますか？',
      answer: 'はい、従業員アカウントを追加することで複数人での利用が可能です。管理者（admin）とスタッフ（staff）の2種類の権限があり、スタッフは一部の管理機能にアクセスできません。',
      sort_order: 7
    },
    {
      id: 8,
      category: 'general',
      question: 'サポート対応時間を教えてください',
      answer: 'お問い合わせは24時間受け付けております。回答は営業日（平日9:00〜18:00）に順次対応いたします。緊急のお問い合わせは優先的に対応いたします。',
      sort_order: 8
    }
  ]
}

export default routes
