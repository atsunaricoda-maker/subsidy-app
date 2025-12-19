// サイト設定API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'
import { generateMasterSidebar, masterSidebarScripts } from '../../templates/master-sidebar'

const routes = new Hono<AppEnv>()

// 設定一覧取得
routes.get('/settings', async (c) => {
  const { DB, CLAUDE_API_KEY } = c.env
  
  try {
    const settings = await DB.prepare(`
      SELECT setting_key, setting_value, setting_type, description
      FROM site_settings
      ORDER BY id
    `).all()
    
    // キーと値のオブジェクトに変換
    const settingsObj: Record<string, any> = {}
    for (const s of (settings.results || [])) {
      settingsObj[(s as any).setting_key] = {
        value: (s as any).setting_value,
        type: (s as any).setting_type,
        description: (s as any).description
      }
    }
    
    // 環境変数の状態を追加（値は隠す）
    settingsObj['_env_status'] = {
      claude_api_key_set: !!CLAUDE_API_KEY,
      claude_api_key_preview: CLAUDE_API_KEY ? `${CLAUDE_API_KEY.substring(0, 12)}...（環境変数で設定済み）` : null
    }
    
    return c.json(settingsObj)
  } catch (error) {
    // テーブルが存在しない場合はデフォルト値を返す
    return c.json({
      company_name: { value: '株式会社サンプル事務所', type: 'text' },
      company_address: { value: '〒000-0000 東京都○○区○○1-2-3', type: 'text' },
      company_phone: { value: '03-0000-0000', type: 'text' },
      company_email: { value: 'info@example.com', type: 'text' },
      privacy_policy: { value: 'プライバシーポリシーを設定してください', type: 'textarea' },
      legal_notice: { value: '特定商取引法に基づく表記を設定してください', type: 'textarea' }
    })
  }
})

// 設定を更新
routes.put('/settings', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  try {
    for (const [key, value] of Object.entries(data)) {
      await DB.prepare(`
        INSERT INTO site_settings (setting_key, setting_value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key) DO UPDATE SET
          setting_value = excluded.setting_value,
          updated_at = CURRENT_TIMESTAMP
      `).bind(key, value).run()
    }
    
    return c.json({ success: true, message: '設定を保存しました' })
  } catch (error) {
    console.error('Error saving settings:', error)
    return c.json({ error: '設定の保存に失敗しました' }, 500)
  }
})

// Claude API接続テスト
routes.post('/test-claude-api', async (c) => {
  const { api_key } = await c.req.json()
  
  if (!api_key) {
    return c.json({ success: false, error: 'APIキーが指定されていません' })
  }
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: 'こんにちは。接続テストです。「接続成功」とだけ返答してください。'
          }
        ]
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API test failed:', response.status, errorText)
      return c.json({ 
        success: false, 
        error: response.status === 401 ? 'APIキーが無効です' : 
               response.status === 429 ? 'レート制限に達しました。しばらく待ってから再試行してください' :
               'API接続エラー: ' + response.status
      })
    }
    
    const data = await response.json()
    return c.json({ 
      success: true, 
      message: '接続成功',
      response: data.content?.[0]?.text || ''
    })
    
  } catch (error) {
    console.error('Claude API test error:', error)
    return c.json({ success: false, error: '接続テストに失敗しました' })
  }
})

// 環境変数のClaude API接続テスト
routes.post('/test-claude-env', async (c) => {
  const { CLAUDE_API_KEY } = c.env
  
  if (!CLAUDE_API_KEY) {
    return c.json({ success: false, error: '環境変数 CLAUDE_API_KEY が設定されていません' })
  }
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: 'こんにちは。接続テストです。「接続成功」とだけ返答してください。'
          }
        ]
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API test failed:', response.status, errorText)
      return c.json({ 
        success: false, 
        error: response.status === 401 ? 'APIキーが無効です' : 
               response.status === 429 ? 'レート制限に達しました' :
               'API接続エラー: ' + response.status
      })
    }
    
    const data = await response.json()
    return c.json({ 
      success: true, 
      message: '環境変数のClaude APIキーで接続成功',
      response: data.content?.[0]?.text || ''
    })
    
  } catch (error) {
    console.error('Claude API test error:', error)
    return c.json({ success: false, error: '接続テストに失敗しました' })
  }
})

// ========================================
// マスター管理API（プラン、管理者、ログなど）
// ========================================

// プラン一覧取得（マスター管理用）
routes.get('/master/plans', async (c) => {
  const { DB } = c.env
  try {
    const plans = await DB.prepare(`
      SELECT * FROM subscription_plans ORDER BY monthly_price ASC
    `).all()
    return c.json(plans.results || [])
  } catch (error) {
    console.error('Load plans error:', error)
    return c.json([])
  }
})

// プラン作成
routes.post('/master/plans', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  try {
    await DB.prepare(`
      INSERT INTO subscription_plans (plan_code, plan_name, monthly_price, monthly_slots, max_staff, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.plan_code,
      data.plan_name,
      data.monthly_price || 0,
      data.monthly_slots || 5,
      data.max_staff || 3,
      data.description || '',
      data.is_active ? 1 : 0
    ).run()
    
    return c.json({ success: true })
  } catch (error: any) {
    console.error('Create plan error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// プラン更新
routes.put('/master/plans/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  try {
    await DB.prepare(`
      UPDATE subscription_plans 
      SET plan_code = ?, plan_name = ?, monthly_price = ?, monthly_slots = ?, 
          max_staff = ?, description = ?, is_active = ?
      WHERE id = ?
    `).bind(
      data.plan_code,
      data.plan_name,
      data.monthly_price || 0,
      data.monthly_slots || 5,
      data.max_staff || 3,
      data.description || '',
      data.is_active ? 1 : 0,
      id
    ).run()
    
    return c.json({ success: true })
  } catch (error: any) {
    console.error('Update plan error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// プラン削除
routes.delete('/master/plans/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    await DB.prepare(`DELETE FROM subscription_plans WHERE id = ?`).bind(id).run()
    return c.json({ success: true })
  } catch (error: any) {
    console.error('Delete plan error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// マスター管理者一覧取得
routes.get('/master/admins', async (c) => {
  const { DB } = c.env
  try {
    const admins = await DB.prepare(`
      SELECT id, username, role, email, is_active, created_at 
      FROM admin_users 
      WHERE is_master_admin = 1
      ORDER BY created_at DESC
    `).all()
    return c.json(admins.results || [])
  } catch (error) {
    console.error('Load admins error:', error)
    return c.json([])
  }
})

// マスター管理者作成
routes.post('/master/admins', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  try {
    // パスワードハッシュ（実際はbcryptなどを使う）
    const passwordHash = data.password // TODO: ハッシュ化
    
    await DB.prepare(`
      INSERT INTO admin_users (username, password_hash, role, email, is_master_admin, is_active)
      VALUES (?, ?, 'master_admin', ?, 1, 1)
    `).bind(data.username, passwordHash, data.email || '').run()
    
    return c.json({ success: true })
  } catch (error: any) {
    console.error('Create admin error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// 操作ログ取得
routes.get('/master/logs', async (c) => {
  const { DB } = c.env
  const orgId = c.req.query('organization_id')
  const type = c.req.query('type')
  
  try {
    let query = `
      SELECT al.*, o.company_name as organization_name
      FROM audit_logs al
      LEFT JOIN organizations o ON al.organization_id = o.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (orgId) {
      query += ` AND al.organization_id = ?`
      params.push(orgId)
    }
    if (type) {
      query += ` AND al.action_type = ?`
      params.push(type)
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT 100`
    
    const logs = await DB.prepare(query).bind(...params).all()
    return c.json(logs.results || [])
  } catch (error) {
    console.error('Load logs error:', error)
    return c.json([])
  }
})

// ヒアリング質問一覧取得（マスター管理用）
routes.get('/master/hearing-questions', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.query('subsidy_type_id')
  const category = c.req.query('category')
  
  try {
    let query = `
      SELECT hq.*, st.name as subsidy_name 
      FROM hearing_questions hq
      LEFT JOIN subsidy_types st ON hq.subsidy_type_id = st.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (subsidyTypeId && subsidyTypeId !== 'all') {
      query += ` AND hq.subsidy_type_id = ?`
      params.push(subsidyTypeId)
    }
    if (category && category !== 'all') {
      query += ` AND hq.category = ?`
      params.push(category)
    }
    
    query += ` ORDER BY hq.subsidy_type_id, hq.sort_order ASC`
    
    const questions = await DB.prepare(query).bind(...params).all()
    return c.json(questions.results || [])
  } catch (error) {
    console.error('Load hearing questions error:', error)
    return c.json([])
  }
})

// AIプロンプト一覧取得
routes.get('/master/ai-prompts', async (c) => {
  const { DB } = c.env
  
  try {
    const prompts = await DB.prepare(`
      SELECT * FROM ai_prompts ORDER BY section_id ASC
    `).all()
    return c.json(prompts.results || [])
  } catch (error) {
    console.error('Load AI prompts error:', error)
    return c.json([])
  }
})

// AIプロンプト更新
routes.put('/master/ai-prompts/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const data = await c.req.json()
  
  try {
    await DB.prepare(`
      UPDATE ai_prompts SET prompt_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(data.prompt_text, id).run()
    
    return c.json({ success: true })
  } catch (error: any) {
    console.error('Update AI prompt error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// AIモデル設定取得API
routes.get('/master/ai-models', async (c) => {
  const { DB } = c.env
  
  try {
    const settings = await DB.prepare(`
      SELECT setting_key, setting_value FROM site_settings 
      WHERE setting_key LIKE 'ai_model_%'
    `).all()
    
    const models: Record<string, string> = {
      // デフォルト値
      ai_model_claude: 'claude-haiku-4-5-20251001',
      ai_model_claude_multimodal: 'claude-haiku-4-5-20251001'
    }
    
    for (const s of (settings.results || [])) {
      models[(s as any).setting_key] = (s as any).setting_value
    }
    
    return c.json(models)
  } catch (error) {
    console.error('Error getting AI models:', error)
    return c.json({
      ai_model_claude: 'claude-haiku-4-5-20251001',
      ai_model_claude_multimodal: 'claude-haiku-4-5-20251001'
    })
  }
})

// AIモデル設定更新API
routes.put('/master/ai-models', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  try {
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('ai_model_')) {
        await DB.prepare(`
          INSERT INTO site_settings (setting_key, setting_value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(setting_key) DO UPDATE SET
            setting_value = excluded.setting_value,
            updated_at = CURRENT_TIMESTAMP
        `).bind(key, value).run()
      }
    }
    
    return c.json({ success: true, message: 'AIモデル設定を保存しました' })
  } catch (error) {
    console.error('Error saving AI models:', error)
    return c.json({ error: 'AIモデル設定の保存に失敗しました' }, 500)
  }
})

// 法務文書テンプレートを取得
routes.get('/legal-templates', async (c) => {
  // SaaS事業者に有利な法務文書テンプレート
  const termsOfService = `# 利用規約

最終更新日：2025年12月

本利用規約（以下「本規約」）は、当社が提供する申請らくらく君（以下「本サービス」）の利用条件を定めるものです。本サービスをご利用いただく前に、本規約をよくお読みください。本サービスを利用することにより、本規約に同意したものとみなされます。

## 第1条（定義）

1. 「当社」とは、本サービスを提供する事業者を指します。
2. 「利用者」とは、本規約に同意の上、本サービスを利用する法人または個人を指します。
3. 「コンテンツ」とは、利用者が本サービスに入力、アップロード、または送信するすべての情報、データ、テキスト、ファイルを指します。

## 第2条（サービス内容）

1. 本サービスは、補助金・助成金の申請業務を支援するためのクラウドベースのツールを提供します。
2. 本サービスには、AI（人工知能）による文書生成・分析機能が含まれる場合があります。
3. 本サービスは申請業務の「支援ツール」であり、補助金・助成金の採択を保証するものではありません。

## 第3条（AI機能に関する免責）

1. 本サービスに含まれるAI機能は、機械学習モデルに基づいており、その出力結果の正確性、完全性、適切性を保証するものではありません。
2. AI機能により生成された文書、分析結果、提案内容は、あくまで参考情報であり、最終的な判断は利用者自身の責任において行うものとします。
3. AIモデルは予告なく変更、更新、または廃止される場合があり、これにより出力結果の品質や特性が変化する可能性があります。
4. AI機能の出力に誤り、不正確な情報、または不適切な内容が含まれる場合があり、当社はこれらに起因する損害について一切の責任を負いません。
5. 利用者は、AI機能の出力を使用する前に、必ず専門家による確認を行うものとします。

## 第4条（サービスの変更・中断・終了）

1. 当社は、事前の通知なく、本サービスの内容を変更、追加、または削除することができます。
2. 当社は、以下の場合に、事前の通知なく本サービスの全部または一部を中断または停止することができます。
   - システムの保守、点検、更新を行う場合
   - 天災、停電、通信障害その他の不可抗力により本サービスの提供が困難な場合
   - その他、当社が必要と判断した場合
3. 当社は、当社の判断により、いつでも本サービスの全部または一部を終了することができます。サービス終了の場合、当社は可能な限り事前に通知するよう努めますが、緊急の場合はこの限りではありません。
4. 本サービスの変更、中断、停止、または終了により利用者に生じた損害について、当社は一切の責任を負いません。

## 第5条（料金および支払い）

1. 本サービスの利用料金は、当社が別途定める料金表に従うものとします。
2. 利用者は、当社が指定する方法により、利用料金を支払うものとします。
3. 支払済みの利用料金は、理由の如何を問わず、返金いたしません。
4. サービスの中断、停止、または終了があった場合でも、既に支払われた料金の返金は行いません。
5. 当社は、30日前の通知をもって、利用料金を改定することができます。

## 第6条（利用者の責任）

1. 利用者は、本サービスの利用に必要なID・パスワードを適切に管理する責任を負います。
2. 利用者は、本サービスに入力するコンテンツの正確性について責任を負います。
3. 利用者は、本サービスを利用して行う申請について、すべての責任を負うものとします。
4. 利用者は、本サービスの利用に関連して第三者との間で紛争が生じた場合、自己の責任と費用でこれを解決するものとします。

## 第7条（禁止事項）

利用者は、以下の行為を行ってはなりません。

1. 虚偽の情報を登録または提供する行為
2. 本サービスを不正な目的で使用する行為
3. 本サービスの運営を妨害する行為
4. 他の利用者または第三者の権利を侵害する行為
5. 法令または公序良俗に違反する行為
6. 本サービスのリバースエンジニアリング、逆コンパイル、逆アセンブル
7. 本サービスを第三者に再販売、再配布、またはサブライセンスする行為

## 第8条（知的財産権）

1. 本サービスおよびそれに関連するすべての知的財産権は、当社または正当な権利者に帰属します。
2. 利用者が本サービスに入力したコンテンツの知的財産権は、利用者に帰属します。
3. 利用者は、本サービスの改善・開発のため、入力されたコンテンツを匿名化した上で当社が分析・利用することに同意します。

## 第9条（免責事項）

1. 当社は、本サービスが利用者の特定の目的に適合すること、期待する機能・正確性・有用性を有すること、継続的に利用できること、不具合が生じないことについて、一切保証しません。
2. 当社は、本サービスの利用により利用者が被った損害（逸失利益、データの喪失、業務の中断、補助金・助成金の不採択を含むがこれに限らない）について、当社の故意または重過失による場合を除き、一切の責任を負いません。
3. 当社が責任を負う場合であっても、その賠償額は、利用者が過去12ヶ月間に当社に支払った利用料金の総額を上限とします。
4. 当社は、利用者が本サービスを通じて取得した情報の正確性、完全性、有用性について、一切の保証をしません。

## 第10条（データの取り扱い）

1. 当社は、利用者のコンテンツを適切に管理し、第三者に開示しないものとします。ただし、法令に基づく場合はこの限りではありません。
2. 当社は、本サービスの終了時に、利用者のコンテンツを削除することができます。利用者は、必要なデータを自己の責任でバックアップするものとします。
3. 当社は、システム障害、天災、その他の事由によりコンテンツが消失した場合、その復旧について一切の責任を負いません。

## 第11条（契約期間および解約）

1. 本契約は、利用者が本規約に同意した時点で成立し、利用者または当社が解約するまで有効に存続します。
2. 利用者は、当社所定の方法により、いつでも解約することができます。
3. 当社は、利用者が本規約に違反した場合、または当社が必要と判断した場合、事前の通知なく利用者のアカウントを停止または削除することができます。

## 第12条（規約の変更）

1. 当社は、利用者の承諾を得ることなく、本規約を変更することができます。
2. 変更後の本規約は、当社のウェブサイトに掲載した時点で効力を生じるものとします。
3. 変更後に本サービスを利用した場合、変更後の本規約に同意したものとみなされます。

## 第13条（分離可能性）

本規約のいずれかの条項が無効または執行不能と判断された場合でも、その他の条項は引き続き有効に存続します。

## 第14条（準拠法および管轄）

1. 本規約は、日本法に準拠し、解釈されるものとします。
2. 本サービスまたは本規約に関連して生じた紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。

## 第15条（反社会的勢力の排除）

利用者は、自らが反社会的勢力に該当しないことを表明し、保証します。当社は、利用者が反社会的勢力に該当すると判断した場合、直ちに本契約を解除できるものとします。

---

以上`;

  const privacyPolicy = `# プライバシーポリシー

最終更新日：2025年12月

当社（以下「当社」）は、申請らくらく君（以下「本サービス」）における個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。

## 第1条（収集する情報）

当社は、本サービスの提供にあたり、以下の情報を収集することがあります。

### 1. 利用者から直接提供される情報
- 氏名、会社名、団体名
- メールアドレス、電話番号、住所
- 事業内容、従業員数、売上高等の企業情報
- 補助金・助成金申請に必要な各種情報
- その他、本サービスの利用に際して入力された情報

### 2. 自動的に収集される情報
- IPアドレス
- ブラウザの種類、言語、アクセス日時
- Cookie情報
- 利用端末に関する情報
- 本サービス内での操作履歴

### 3. 第三者から取得する情報
- 認証サービス（Google等）を利用した場合のアカウント情報

## 第2条（情報の利用目的）

当社は、収集した情報を以下の目的で利用します。

1. 本サービスの提供、運営、維持、改善
2. 利用者からのお問い合わせへの対応
3. 利用料金の請求
4. 本サービスに関するお知らせ、更新情報の通知
5. 新サービス、キャンペーン等のご案内（マーケティング）
6. 利用規約に違反する行為への対応
7. 利用状況の分析、統計データの作成
8. AIモデルの学習・改善（匿名化処理後）
9. その他、上記に付随する業務

## 第3条（AIおよび機械学習における利用）

1. 当社は、本サービスの品質向上およびAI機能の改善を目的として、利用者が入力したコンテンツを匿名化した上で、機械学習モデルの学習データとして利用することがあります。
2. この場合、個人を特定できる情報は削除または匿名化され、個人情報として利用されることはありません。
3. 利用者は、本サービスを利用することにより、上記の利用に同意したものとみなされます。

## 第4条（情報の第三者提供）

当社は、以下の場合を除き、個人情報を第三者に提供しません。

1. 利用者の同意がある場合
2. 法令に基づく場合
3. 人の生命、身体または財産の保護のために必要がある場合
4. 公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合
5. 国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合
6. 当社の業務委託先（クラウドサービス、決済代行サービス等）に対して、業務の遂行に必要な範囲で提供する場合
7. 合併、会社分割、事業譲渡その他の事由による事業の承継に伴って提供する場合

## 第5条（外部サービスの利用）

当社は、本サービスの提供にあたり、以下の外部サービスを利用しています。これらのサービスには、各社のプライバシーポリシーが適用されます。

1. クラウドインフラ：Cloudflare, Inc.
2. AI・機械学習：OpenAI、Anthropic等のAIサービスプロバイダー
3. 決済サービス：Stripe等の決済代行サービス
4. 分析ツール：Google Analytics等

## 第6条（情報の保管期間）

1. 当社は、利用目的に必要な期間、個人情報を保管します。
2. 利用者がアカウントを削除した場合、当社は合理的な期間内に個人情報を削除します。ただし、法令で保存が義務付けられている情報、および匿名化された統計データはこの限りではありません。
3. 当社は、サービス終了後、すべてのデータを削除する権利を有します。

## 第7条（情報の安全管理）

当社は、個人情報の漏洩、滅失、毀損を防止するため、以下の安全管理措置を講じます。

1. データの暗号化（通信時および保管時）
2. アクセス制御、認証機能の実装
3. 定期的なセキュリティ監査
4. 従業員への教育・研修

なお、インターネット上の通信は完全に安全ではなく、当社は情報の完全なセキュリティを保証することはできません。

## 第8条（Cookieの使用）

1. 当社は、本サービスにおいてCookieを使用しています。
2. Cookieは、利用者の利便性向上、利用状況の分析、広告配信の最適化等の目的で使用されます。
3. 利用者は、ブラウザの設定によりCookieを無効にすることができますが、本サービスの一部機能が利用できなくなる場合があります。

## 第9条（利用者の権利）

利用者は、当社に対して、以下の請求を行うことができます。

1. 保有する個人情報の開示請求
2. 個人情報の訂正、追加、削除の請求
3. 個人情報の利用停止または消去の請求
4. 個人情報の第三者提供の停止請求

上記の請求を行う場合は、当社所定の方法によりお問い合わせください。本人確認のため、必要な書類の提出をお願いする場合があります。

## 第10条（お子様の個人情報）

本サービスは、16歳未満の方を対象としていません。当社は、16歳未満の方から故意に個人情報を収集することはありません。

## 第11条（海外への情報移転）

本サービスの提供にあたり、利用者の情報が日本国外のサーバーに保存される場合があります。これらの国・地域は、日本と同等のデータ保護法制を有していない可能性があります。本サービスを利用することにより、利用者はこの海外への情報移転に同意したものとみなされます。

## 第12条（プライバシーポリシーの変更）

1. 当社は、法令の変更、事業内容の変更、その他の理由により、利用者への事前の通知なく本プライバシーポリシーを変更することがあります。
2. 変更後のプライバシーポリシーは、当社のウェブサイトに掲載した時点で効力を生じます。
3. 重要な変更がある場合、当社は可能な限り利用者に通知するよう努めます。

## 第13条（お問い合わせ）

本プライバシーポリシーに関するお問い合わせは、システム設定画面に記載の連絡先までご連絡ください。

---

以上`;

  const legalNotice = `# 特定商取引法に基づく表記

## 事業者名
（システム設定画面で設定してください）

## 代表者
（システム設定画面で設定してください）

## 所在地
（システム設定画面で設定してください）

## 電話番号
（システム設定画面で設定してください）

## メールアドレス
（システム設定画面で設定してください）

## サービス料金
料金プランページをご確認ください。

## 支払方法
- 銀行振込

## 支払時期
- 月額プラン：請求書発行後14日以内に銀行振込
- 追加枠：請求書発行後14日以内に銀行振込

## サービス提供時期
お支払い確認後、即時利用可能

## 返品・キャンセル
サービスの性質上、お支払い後の返金は原則として行っておりません。月額プランは月末までに解約手続きを行うことで、翌月以降の課金を停止できます。

## 動作環境
- 最新版のGoogle Chrome、Safari、Firefox、Microsoft Edge
- 安定したインターネット接続

## 免責事項
本サービスは補助金・助成金申請の支援ツールであり、採択を保証するものではありません。AI機能の出力結果については、必ず専門家の確認を経た上でご利用ください。

---

以上`;

  return c.json({
    terms_of_service: termsOfService,
    privacy_policy: privacyPolicy,
    legal_notice: legalNotice
  });
});

// 公開用設定取得（認証不要）
routes.get('/public/settings', async (c) => {
  const { DB } = c.env
  
  try {
    const settings = await DB.prepare(`
      SELECT setting_key, setting_value
      FROM site_settings
      WHERE setting_key IN ('company_name', 'company_address', 'company_phone', 'company_email', 
                            'company_representative', 'company_registration',
                            'privacy_policy', 'legal_notice', 'terms_of_service', 'footer_text',
                            'company_website_url', 'privacy_policy_url', 'terms_url', 'legal_notice_url')
    `).all()
    
    const settingsObj: Record<string, string> = {}
    for (const s of (settings.results || [])) {
      settingsObj[(s as any).setting_key] = (s as any).setting_value || ''
    }
    
    return c.json(settingsObj)
  } catch (error) {
    // デフォルト値を返す
    return c.json({
      company_name: '株式会社サンプル事務所',
      company_address: '〒000-0000 東京都○○区○○1-2-3',
      company_phone: '03-0000-0000',
      company_email: 'info@example.com',
      privacy_policy: 'プライバシーポリシーを設定してください',
      legal_notice: '特定商取引法に基づく表記を設定してください'
    })
  }
})

// サイト設定取得
routes.get('/site-settings', async (c) => {
  const { DB } = c.env
  
  try {
    const settings = await DB.prepare(`
      SELECT setting_key, setting_value FROM site_settings
    `).all()
    
    const result: Record<string, string> = {}
    for (const s of (settings.results || []) as any[]) {
      result[s.setting_key] = s.setting_value || ''
    }
    
    return c.json(result)
  } catch (e) {
    return c.json({})
  }
})

// サイト設定更新
routes.post('/site-settings', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  try {
    for (const [key, value] of Object.entries(data)) {
      // 既存のキーがあれば更新、なければ挿入
      await DB.prepare(`
        INSERT INTO site_settings (setting_key, setting_value, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key) DO UPDATE SET 
          setting_value = excluded.setting_value,
          updated_at = CURRENT_TIMESTAMP
      `).bind(key, value).run()
    }
    
    return c.json({ success: true, message: '設定を保存しました' })
  } catch (e: any) {
    return c.json({ success: false, message: e.message }, 500)
  }
})

// マスターダッシュボードAPI
// マスターデータエクスポートAPI
routes.get('/master/export', async (c) => {
  const { DB } = c.env
  
  const subsidyTypes = await DB.prepare(`
    SELECT id, name, category, description FROM subsidy_types ORDER BY id
  `).all()
  
  const pipelineTemplates = await DB.prepare(`
    SELECT pt.*, 
           (SELECT COUNT(*) FROM pipeline_template_tasks WHERE template_id = pt.id) as task_count
    FROM pipeline_templates pt 
    ORDER BY pt.id
  `).all()
  
  const hearingQuestions = await DB.prepare(`
    SELECT hq.*, st.name as subsidy_name
    FROM hearing_questions hq
    LEFT JOIN subsidy_types st ON hq.subsidy_type_id = st.id
    ORDER BY hq.id
  `).all()
  
  return c.json({
    subsidyTypes: subsidyTypes.results || [],
    pipelineTemplates: pipelineTemplates.results || [],
    hearingQuestions: hearingQuestions.results || []
  })
})

// ヒアリング質問プリセット追加API
routes.post('/master/migrate-hearing-questions', async (c) => {
  const { DB } = c.env
  
  // 質問がない申請種別を取得
  const missingQuestions = await DB.prepare(`
    SELECT st.id, st.name, st.category,
           (SELECT COUNT(*) FROM hearing_questions WHERE subsidy_type_id = st.id) as question_count
    FROM subsidy_types st
    WHERE (SELECT COUNT(*) FROM hearing_questions WHERE subsidy_type_id = st.id) = 0
    ORDER BY st.category, st.id
  `).all()
  
  const results: { id: number; name: string; added: number }[] = []
  
  // プリセット質問の定義
  const presetQuestions: { [key: number]: { key: string; text: string; type: string; options: string | null; required: number; order: number }[] } = {
    // キャリアアップ助成金（正社員化コース）ID:45
    45: [
      { key: 'cu_seishain_count', text: '正社員転換を予定している有期契約労働者は何名ですか？', type: 'number', options: null, required: 1, order: 1 },
      { key: 'cu_seishain_type', text: '転換予定者の現在の雇用形態を教えてください', type: 'select', options: '["有期契約社員","パート・アルバイト","派遣社員","その他"]', required: 1, order: 2 },
      { key: 'cu_seishain_term', text: '転換予定者の勤続期間はどのくらいですか？', type: 'select', options: '["6ヶ月未満","6ヶ月以上1年未満","1年以上2年未満","2年以上3年未満","3年以上"]', required: 1, order: 3 },
      { key: 'cu_seishain_rule', text: '就業規則に正社員転換制度は規定されていますか？', type: 'select', options: '["規定済み","規定予定","規定なし","わからない"]', required: 1, order: 4 },
      { key: 'cu_seishain_wage', text: '転換後の賃金は転換前と比較して何%以上増加予定ですか？', type: 'select', options: '["3%以上","5%以上","10%以上","未定"]', required: 1, order: 5 }
    ],
    // 中途採用等支援助成金 ID:38
    38: [
      { key: 'chuto_plan', text: '中途採用を積極的に行う計画はありますか？', type: 'select', options: '["ある","検討中","まだない"]', required: 1, order: 1 },
      { key: 'chuto_count', text: '中途採用者の予定人数を教えてください', type: 'number', options: null, required: 1, order: 2 },
      { key: 'chuto_age', text: '中途採用者の想定年齢層を教えてください', type: 'checkbox', options: '["35歳未満","35歳以上45歳未満","45歳以上"]', required: 1, order: 3 },
      { key: 'chuto_ratio', text: '中途採用比率の目標値はありますか？', type: 'select', options: '["ある","設定予定","ない"]', required: 0, order: 4 },
      { key: 'chuto_training', text: '中途採用者向けの研修制度はありますか？', type: 'select', options: '["ある","導入予定","ない"]', required: 0, order: 5 }
    ],
    // 介護離職防止支援助成金 ID:40
    40: [
      { key: 'kaigo_rule', text: '介護休業制度は就業規則に規定されていますか？', type: 'select', options: '["規定済み","規定予定","規定なし"]', required: 1, order: 1 },
      { key: 'kaigo_employee', text: '介護休業を取得予定または取得した従業員はいますか？', type: 'select', options: '["いる","予定あり","いない"]', required: 1, order: 2 },
      { key: 'kaigo_flexible', text: '介護のための柔軟な働き方制度はありますか？', type: 'checkbox', options: '["短時間勤務","フレックスタイム","在宅勤務","時差出勤","なし"]', required: 1, order: 3 },
      { key: 'kaigo_return', text: '介護休業からの復帰支援制度はありますか？', type: 'select', options: '["ある","導入予定","ない"]', required: 0, order: 4 },
      { key: 'kaigo_consult', text: '従業員の介護に関する相談窓口はありますか？', type: 'select', options: '["ある","設置予定","ない"]', required: 0, order: 5 }
    ],
    // 出生時両立支援コース ID:42
    42: [
      { key: 'papa_record', text: '男性従業員の育児休業取得実績はありますか？', type: 'select', options: '["ある","ない"]', required: 1, order: 1 },
      { key: 'papa_plan', text: '育児休業取得予定の男性従業員はいますか？', type: 'select', options: '["いる","予定あり","いない"]', required: 1, order: 2 },
      { key: 'papa_days', text: '育児休業の取得日数の目標を教えてください', type: 'select', options: '["5日以上","2週間以上","1ヶ月以上","未設定"]', required: 1, order: 3 },
      { key: 'papa_env', text: '育児休業を取得しやすい職場環境づくりに取り組んでいますか？', type: 'select', options: '["取り組んでいる","取り組む予定","特に取り組んでいない"]', required: 1, order: 4 },
      { key: 'papa_system', text: '産後パパ育休（出生時育児休業）制度を導入していますか？', type: 'select', options: '["導入済み","導入予定","未導入"]', required: 1, order: 5 }
    ],
    // 育児休業等支援コース ID:41
    41: [
      { key: 'ikukyu_employee', text: '育児休業取得予定または取得中の従業員はいますか？', type: 'select', options: '["いる","予定あり","いない"]', required: 1, order: 1 },
      { key: 'ikukyu_return', text: '育児休業からの円滑な復帰支援制度はありますか？', type: 'select', options: '["ある","導入予定","ない"]', required: 1, order: 2 },
      { key: 'ikukyu_substitute', text: '代替要員の確保方法を教えてください', type: 'select', options: '["新規雇用","社内配置転換","派遣社員活用","未定"]', required: 1, order: 3 },
      { key: 'ikukyu_contact', text: '育休取得者への情報提供や面談は行っていますか？', type: 'select', options: '["行っている","行う予定","行っていない"]', required: 1, order: 4 },
      { key: 'ikukyu_short', text: '短時間勤務制度は整備されていますか？', type: 'select', options: '["整備済み","整備予定","未整備"]', required: 1, order: 5 }
    ],
    // 障害者雇用安定助成金 ID:39
    39: [
      { key: 'shogai_record', text: '障害者の雇用実績はありますか？', type: 'select', options: '["ある","ない"]', required: 1, order: 1 },
      { key: 'shogai_type', text: '雇用予定の障害者の障害種別を教えてください', type: 'checkbox', options: '["身体障害","知的障害","精神障害","発達障害","その他"]', required: 1, order: 2 },
      { key: 'shogai_env', text: '障害者が働きやすい職場環境の整備は行っていますか？', type: 'select', options: '["行っている","行う予定","行っていない"]', required: 1, order: 3 },
      { key: 'shogai_counselor', text: '障害者職業生活相談員は配置していますか？', type: 'select', options: '["配置済み","配置予定","未配置"]', required: 0, order: 4 },
      { key: 'shogai_coach', text: 'ジョブコーチ支援を受けたことはありますか？', type: 'select', options: '["ある","受ける予定","ない"]', required: 0, order: 5 }
    ],
    // 地域雇用開発助成金 ID:37
    37: [
      { key: 'chiiki_location', text: '事業所の所在地（都道府県・市区町村）を教えてください', type: 'text', options: null, required: 1, order: 1 },
      { key: 'chiiki_area', text: '雇用機会が不足している地域での事業ですか？', type: 'select', options: '["はい","いいえ","わからない"]', required: 1, order: 2 },
      { key: 'chiiki_hire', text: '新規雇用予定の人数を教えてください', type: 'number', options: null, required: 1, order: 3 },
      { key: 'chiiki_invest', text: '設備投資の予定金額を教えてください', type: 'select', options: '["300万円未満","300万円以上1000万円未満","1000万円以上"]', required: 1, order: 4 },
      { key: 'chiiki_local', text: '地域の求職者を積極的に雇用する計画はありますか？', type: 'select', options: '["ある","検討中","ない"]', required: 1, order: 5 }
    ],
    // 勤務間インターバル導入コース ID:43
    43: [
      { key: 'interval_status', text: '勤務間インターバル制度を導入していますか？', type: 'select', options: '["導入済み","導入予定","未導入"]', required: 1, order: 1 },
      { key: 'interval_hours', text: '導入予定のインターバル時間を教えてください', type: 'select', options: '["9時間以上11時間未満","11時間以上","未定"]', required: 1, order: 2 },
      { key: 'interval_count', text: '対象となる従業員数を教えてください', type: 'number', options: null, required: 1, order: 3 },
      { key: 'interval_current', text: '現在の平均的な勤務終了から翌日勤務開始までの時間は？', type: 'select', options: '["8時間未満","8時間以上11時間未満","11時間以上"]', required: 1, order: 4 },
      { key: 'interval_overtime', text: '残業が多い部署や職種はありますか？', type: 'text', options: null, required: 0, order: 5 }
    ],
    // 労働時間短縮・年休促進支援コース ID:44
    44: [
      { key: 'worktime_current', text: '現在の所定労働時間を教えてください', type: 'select', options: '["週40時間以上","週40時間未満","不明"]', required: 1, order: 1 },
      { key: 'worktime_leave', text: '年次有給休暇の平均取得日数を教えてください', type: 'select', options: '["5日未満","5日以上10日未満","10日以上"]', required: 1, order: 2 },
      { key: 'worktime_hour', text: '時間単位の年次有給休暇制度はありますか？', type: 'select', options: '["ある","導入予定","ない"]', required: 1, order: 3 },
      { key: 'worktime_special', text: '特別休暇制度はありますか？', type: 'checkbox', options: '["病気休暇","ボランティア休暇","教育訓練休暇","その他","なし"]', required: 0, order: 4 },
      { key: 'worktime_goal', text: '労働時間の削減目標はありますか？', type: 'text', options: null, required: 0, order: 5 }
    ],
    // ものづくり補助金（グリーン枠）ID:35
    35: [
      { key: 'mono_green_plan', text: '温室効果ガス削減に資する設備投資を予定していますか？', type: 'select', options: '["予定している","検討中","予定なし"]', required: 1, order: 1 },
      { key: 'mono_green_amount', text: '投資予定金額を教えてください', type: 'select', options: '["1000万円未満","1000万円以上3000万円未満","3000万円以上"]', required: 1, order: 2 },
      { key: 'mono_green_co2', text: 'CO2削減目標はありますか？', type: 'select', options: '["ある","設定予定","ない"]', required: 1, order: 3 },
      { key: 'mono_green_equip', text: 'どのような設備を導入予定ですか？', type: 'checkbox', options: '["省エネ設備","再生可能エネルギー設備","電気自動車","その他"]', required: 1, order: 4 },
      { key: 'mono_green_cert', text: '環境認証（ISO14001等）の取得状況を教えてください', type: 'select', options: '["取得済み","取得予定","未取得"]', required: 0, order: 5 }
    ],
    // 中小企業デジタル化応援隊事業 ID:31
    31: [
      { key: 'digital_issue', text: 'デジタル化に関する課題を教えてください', type: 'checkbox', options: '["業務効率化","テレワーク導入","EC・ネット販売","顧客管理","その他"]', required: 1, order: 1 },
      { key: 'digital_staff', text: 'IT専門人材は社内にいますか？', type: 'select', options: '["いる","いない"]', required: 1, order: 2 },
      { key: 'digital_tools', text: '現在利用しているITツールはありますか？', type: 'checkbox', options: '["会計ソフト","勤怠管理","顧客管理","グループウェア","なし"]', required: 1, order: 3 },
      { key: 'digital_budget', text: 'デジタル化の予算規模を教えてください', type: 'select', options: '["50万円未満","50万円以上100万円未満","100万円以上"]', required: 0, order: 4 },
      { key: 'digital_support', text: '外部専門家の支援を受けたいですか？', type: 'select', options: '["受けたい","検討中","必要ない"]', required: 1, order: 5 }
    ],
    // 中小企業経営強化税制 ID:36
    36: [
      { key: 'tax_amount', text: '設備投資の予定金額を教えてください', type: 'select', options: '["160万円未満","160万円以上1000万円未満","1000万円以上"]', required: 1, order: 1 },
      { key: 'tax_type', text: '投資予定の設備の種類を教えてください', type: 'checkbox', options: '["機械装置","工具","器具備品","建物附属設備","ソフトウェア"]', required: 1, order: 2 },
      { key: 'tax_plan', text: '経営力向上計画の認定を受けていますか？', type: 'select', options: '["受けている","申請予定","受けていない"]', required: 1, order: 3 },
      { key: 'tax_goal', text: '生産性向上の具体的な目標はありますか？', type: 'text', options: null, required: 0, order: 4 },
      { key: 'tax_timing', text: '投資予定時期を教えてください', type: 'select', options: '["3ヶ月以内","6ヶ月以内","1年以内","未定"]', required: 1, order: 5 }
    ],
    // 事業再構築補助金 ID:32
    32: [
      { key: 'saikouchiku_type', text: '新分野展開・事業転換・業種転換のいずれを検討していますか？', type: 'select', options: '["新分野展開","事業転換","業種転換","業態転換","事業再編"]', required: 1, order: 1 },
      { key: 'saikouchiku_sales', text: 'コロナ以降の売上状況を教えてください', type: 'select', options: '["10%以上減少","10%未満の減少","変化なし","増加"]', required: 1, order: 2 },
      { key: 'saikouchiku_plan', text: '新事業の具体的な計画はありますか？', type: 'select', options: '["具体的にある","構想段階","まだない"]', required: 1, order: 3 },
      { key: 'saikouchiku_amount', text: '投資予定金額を教えてください', type: 'select', options: '["1000万円未満","1000万円以上5000万円未満","5000万円以上"]', required: 1, order: 4 },
      { key: 'saikouchiku_support', text: '認定経営革新等支援機関との連携はありますか？', type: 'select', options: '["連携済み","連携予定","まだない"]', required: 1, order: 5 }
    ],
    // 創業助成金 ID:33
    33: [
      { key: 'sougyo_timing', text: '創業予定時期を教えてください', type: 'select', options: '["すでに創業済み","3ヶ月以内","6ヶ月以内","1年以内"]', required: 1, order: 1 },
      { key: 'sougyo_business', text: '創業予定の業種を教えてください', type: 'text', options: null, required: 1, order: 2 },
      { key: 'sougyo_fund', text: '創業に必要な資金の調達状況を教えてください', type: 'select', options: '["自己資金のみ","融資予定あり","出資予定あり","未定"]', required: 1, order: 3 },
      { key: 'sougyo_plan', text: '事業計画書は作成していますか？', type: 'select', options: '["作成済み","作成中","未作成"]', required: 1, order: 4 },
      { key: 'sougyo_training', text: '創業に関する研修やセミナーを受講しましたか？', type: 'select', options: '["受講済み","受講予定","受講していない"]', required: 0, order: 5 }
    ],
    // 販路開拓助成金 ID:34
    34: [
      { key: 'hanro_method', text: '販路開拓の方法を教えてください', type: 'checkbox', options: '["展示会出展","ECサイト構築","広告宣伝","海外展開","その他"]', required: 1, order: 1 },
      { key: 'hanro_amount', text: '販路開拓の投資予定金額を教えてください', type: 'select', options: '["50万円未満","50万円以上200万円未満","200万円以上"]', required: 1, order: 2 },
      { key: 'hanro_goal', text: '新規顧客獲得の目標はありますか？', type: 'select', options: '["具体的にある","検討中","ない"]', required: 1, order: 3 },
      { key: 'hanro_exp', text: '展示会等への出展経験はありますか？', type: 'select', options: '["ある","ない"]', required: 0, order: 4 },
      { key: 'hanro_area', text: '販路開拓の対象地域を教えてください', type: 'checkbox', options: '["国内（地域限定）","国内（全国）","海外"]', required: 1, order: 5 }
    ],
    // 一般建設業許可 ID:58
    58: [
      { key: 'ippan_type', text: '許可を受けたい業種を教えてください', type: 'checkbox', options: '["土木一式","建築一式","大工","左官","とび・土工","電気","管","その他"]', required: 1, order: 1 },
      { key: 'ippan_keiei', text: '経営業務管理責任者の要件を満たす方はいますか？', type: 'select', options: '["いる","採用予定","いない"]', required: 1, order: 2 },
      { key: 'ippan_sennin', text: '専任技術者の要件を満たす方はいますか？', type: 'select', options: '["いる","採用予定","いない"]', required: 1, order: 3 },
      { key: 'ippan_shisan', text: '財産的基礎（500万円以上）を満たしていますか？', type: 'select', options: '["満たしている","満たす予定","わからない"]', required: 1, order: 4 },
      { key: 'ippan_kekkaku', text: '欠格要件に該当する方はいませんか？', type: 'select', options: '["該当者なし","確認が必要","わからない"]', required: 1, order: 5 }
    ],
    // 電気工事業登録 ID:47
    47: [
      { key: 'denki_chief', text: '主任電気工事士の資格保有者はいますか？', type: 'select', options: '["いる","採用予定","いない"]', required: 1, order: 1 },
      { key: 'denki_type', text: '電気工事の種類を教えてください', type: 'checkbox', options: '["一般用電気工作物","自家用電気工作物","両方"]', required: 1, order: 2 },
      { key: 'denki_office', text: '営業所の所在地を教えてください', type: 'text', options: null, required: 1, order: 3 },
      { key: 'denki_kensetsu', text: '他の建設業許可を取得していますか？', type: 'select', options: '["取得済み","取得予定","取得していない"]', required: 0, order: 4 },
      { key: 'denki_exp', text: '電気工事の実務経験年数を教えてください', type: 'select', options: '["3年未満","3年以上5年未満","5年以上"]', required: 1, order: 5 }
    ],
    // 解体工事業登録 ID:48
    48: [
      { key: 'kaitai_tech', text: '技術管理者の要件を満たす方はいますか？', type: 'select', options: '["いる","採用予定","いない"]', required: 1, order: 1 },
      { key: 'kaitai_amount', text: '解体工事の請負金額の想定を教えてください', type: 'select', options: '["500万円未満","500万円以上"]', required: 1, order: 2 },
      { key: 'kaitai_kensetsu', text: '建設業許可（土木・建築・解体）を取得していますか？', type: 'select', options: '["取得済み","取得予定","取得していない"]', required: 1, order: 3 },
      { key: 'kaitai_exp', text: '解体工事の実務経験はありますか？', type: 'select', options: '["8年以上","1年以上","なし"]', required: 1, order: 4 },
      { key: 'kaitai_sanpai', text: '産業廃棄物収集運搬業の許可はありますか？', type: 'select', options: '["ある","取得予定","ない"]', required: 0, order: 5 }
    ],
    // 警備業認定 ID:49
    49: [
      { key: 'keibi_type', text: '警備業務の種類を教えてください', type: 'checkbox', options: '["施設警備","交通誘導","運搬警備","身辺警備"]', required: 1, order: 1 },
      { key: 'keibi_shidou', text: '警備員指導教育責任者の資格保有者はいますか？', type: 'select', options: '["いる","採用予定","いない"]', required: 1, order: 2 },
      { key: 'keibi_kekkaku', text: '欠格事由に該当する方はいませんか？', type: 'select', options: '["該当者なし","確認が必要","わからない"]', required: 1, order: 3 },
      { key: 'keibi_count', text: '警備員の採用予定人数を教えてください', type: 'number', options: null, required: 1, order: 4 },
      { key: 'keibi_office', text: '営業所の確保状況を教えてください', type: 'select', options: '["確保済み","確保予定","未定"]', required: 1, order: 5 }
    ],
    // 有料職業紹介事業許可 ID:50
    50: [
      { key: 'shokukai_koushu', text: '職業紹介責任者講習を受講しましたか？', type: 'select', options: '["受講済み","受講予定","未受講"]', required: 1, order: 1 },
      { key: 'shokukai_gyoshu', text: '紹介予定の職種を教えてください', type: 'text', options: null, required: 1, order: 2 },
      { key: 'shokukai_area', text: '事業所の面積は20㎡以上ありますか？', type: 'select', options: '["20㎡以上","20㎡未満","確認が必要"]', required: 1, order: 3 },
      { key: 'shokukai_shisan', text: '資産要件（基準資産500万円以上）を満たしていますか？', type: 'select', options: '["満たしている","満たす予定","わからない"]', required: 1, order: 4 },
      { key: 'shokukai_privacy', text: '個人情報保護の体制は整備していますか？', type: 'select', options: '["整備済み","整備予定","未整備"]', required: 1, order: 5 }
    ],
    // 倉庫業登録 ID:52
    52: [
      { key: 'souko_type', text: '倉庫の種類を教えてください', type: 'select', options: '["普通倉庫","冷蔵倉庫","水面倉庫","その他"]', required: 1, order: 1 },
      { key: 'souko_area', text: '倉庫の面積を教えてください', type: 'select', options: '["100㎡未満","100㎡以上500㎡未満","500㎡以上"]', required: 1, order: 2 },
      { key: 'souko_own', text: '倉庫の所有形態を教えてください', type: 'select', options: '["自己所有","賃借","取得予定"]', required: 1, order: 3 },
      { key: 'souko_manager', text: '倉庫管理主任者の選任予定はありますか？', type: 'select', options: '["選任済み","選任予定","未定"]', required: 1, order: 4 },
      { key: 'souko_cargo', text: '保管予定の貨物の種類を教えてください', type: 'text', options: null, required: 1, order: 5 }
    ]
  }
  
  // 各申請種別に質問を追加
  for (const item of missingQuestions.results || []) {
    const subsidyId = item.id as number
    const questions = presetQuestions[subsidyId]
    
    if (questions && questions.length > 0) {
      let addedCount = 0
      for (const q of questions) {
        try {
          await DB.prepare(`
            INSERT INTO hearing_questions (subsidy_type_id, question_key, question_text, question_type, options, is_required, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(subsidyId, q.key, q.text, q.type, q.options, q.required, q.order).run()
          addedCount++
        } catch (e) {
          // 重複キーなどのエラーは無視
        }
      }
      results.push({ id: subsidyId, name: item.name as string, added: addedCount })
    }
  }
  
  return c.json({
    success: true,
    message: 'ヒアリング質問のプリセットを追加しました',
    results,
    totalAdded: results.reduce((sum, r) => sum + r.added, 0)
  })
})

// 必要書類プリセット追加API
routes.post('/master/migrate-required-documents', async (c) => {
  const { DB } = c.env
  
  // 必要書類の定義
  const requiredDocs: { [key: number]: string } = {
    // 社労士管轄の助成金
    45: '雇用契約書（転換前・転換後）,就業規則,賃金台帳,労働条件通知書,転換制度に関する規定,キャリアアップ計画書,出勤簿,タイムカード,社会保険加入証明',
    38: '中途採用計画書,雇用契約書,労働条件通知書,採用選考記録,ハローワーク求人票,中途採用比率の算定資料',
    40: '介護休業申出書,介護休業取扱通知書,就業規則（介護休業規定）,労働条件通知書,出勤簿,介護状況を証明する書類',
    42: '育児休業申出書,育児休業取扱通知書,出生届受理証明書,就業規則,出勤簿,賃金台帳',
    41: '育児休業申出書,復帰支援プラン,就業規則,代替要員の雇用契約書,出勤簿,面談記録',
    39: '障害者手帳の写し,雇用契約書,就業規則,職場環境整備計画,出勤簿,賃金台帳',
    37: '事業計画書,雇用契約書,設備投資の見積書・契約書,事業所の登記簿謄本,土地・建物の賃貸契約書',
    43: '勤務間インターバル制度導入計画,就業規則,勤怠管理記録,労働時間の記録',
    44: '就業規則,年次有給休暇管理簿,労働時間の記録,特別休暇制度に関する規定',
    // 行政書士管轄の補助金
    35: '事業計画書,設備投資の見積書,CO2削減計画,環境認証の写し,決算書（直近2期分）,法人登記簿謄本',
    31: 'IT導入計画書,見積書,決算書,法人登記簿謄本,IT専門家との契約書',
    36: '経営力向上計画認定書,設備投資の見積書・契約書,決算書,法人登記簿謄本',
    32: '事業計画書,認定経営革新等支援機関の確認書,決算書（直近2期分）,法人登記簿謄本,投資の見積書',
    33: '創業計画書,資金調達計画,本人確認書類,住民票,法人の場合は登記簿謄本',
    34: '販路開拓計画書,見積書,決算書,法人登記簿謄本,展示会の申込書・請求書',
    // 許認可
    58: '登記簿謄本,役員の身分証明書,役員の登記されていないことの証明書,経営業務管理責任者の経歴書,専任技術者の資格証明書,財務諸表,営業所の賃貸契約書',
    47: '主任電気工事士の免状,登記簿謄本,営業所の図面,電気工事業届出書',
    48: '技術管理者の資格証明書,登記簿謄本,営業所の図面,解体工事業登録申請書',
    49: '警備員指導教育責任者の資格者証,登記簿謄本,役員の身分証明書,営業所の賃貸契約書,警備業認定申請書',
    50: '職業紹介責任者講習修了証,登記簿謄本,事務所の図面,資産に関する調書,個人情報適正管理規程',
    52: '倉庫明細書,建物登記簿謄本,火災保険証書,倉庫管理主任者の資格証明,倉庫業登録申請書',
    51: '運行管理者資格証,整備管理者資格証,車両の車検証,営業所・車庫の図面,資金計画書',
    53: '登記簿謄本,財務諸表,役員の履歴書,コンプライアンス規程,内部管理体制の概要',
    54: '宅地建物取引業免許証,宅地建物取引士の資格証,専任性を証する書面,財務諸表',
    55: '営業所の平面図,用途地域証明書,周辺地図,管理者の住民票,風俗営業許可申請書',
    56: '営業所の平面図,用途地域証明書,食品衛生責任者の資格証,深夜酒類提供飲食店届出書',
    57: '監理技術者資格者証,登記簿謄本,財務諸表,経営業務管理責任者の経歴書,特定建設業許可申請書',
    59: '測量士または測量士補の登録証,登記簿謄本,営業所の図面,測量業者登録申請書',
    60: '管理建築士の一級/二級建築士免許証,管理建築士講習修了証,登記簿謄本,事務所の図面',
    61: '薬剤師免許証または登録販売者登録証,店舗の図面,医薬品販売業許可申請書,構造設備の概要'
  }
  
  const results: { id: number; name: string; updated: boolean }[] = []
  
  for (const [idStr, docs] of Object.entries(requiredDocs)) {
    const id = parseInt(idStr)
    try {
      await DB.prepare(`
        UPDATE subsidy_types SET required_documents = ? WHERE id = ? AND (required_documents IS NULL OR required_documents = '')
      `).bind(docs, id).run()
      
      const updated = await DB.prepare(`SELECT name FROM subsidy_types WHERE id = ?`).bind(id).first()
      results.push({ id, name: (updated?.name as string) || '', updated: true })
    } catch (e) {
      results.push({ id, name: '', updated: false })
    }
  }
  
  return c.json({
    success: true,
    message: '必要書類のプリセットを追加しました',
    results
  })
})

routes.get('/master/dashboard', async (c) => {
  const { DB } = c.env
  
  // 組織統計
  const orgStats = await DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN created_at >= date('now', 'start of month') THEN 1 ELSE 0 END) as new_this_month
    FROM organizations
  `).first()
  
  // 総案件数
  const caseCount = await DB.prepare(`SELECT COUNT(*) as count FROM cases`).first()
  
  // プラン別分布
  const planDistribution = await DB.prepare(`
    SELECT sp.plan_name, COUNT(us.id) as count
    FROM subscription_plans sp
    LEFT JOIN user_subscriptions us ON sp.id = us.plan_id AND us.status = 'active'
    WHERE sp.is_active = 1
    GROUP BY sp.id
    ORDER BY sp.monthly_price
  `).all()
  
  // 月間売上計算
  const revenueResult = await DB.prepare(`
    SELECT COALESCE(SUM(sp.monthly_price), 0) as revenue
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.status = 'active'
  `).first()
  
  // 最近の法人
  const recentOrgs = await DB.prepare(`
    SELECT id, name, email, status, created_at
    FROM organizations
    ORDER BY created_at DESC
    LIMIT 5
  `).all()
  
  return c.json({
    total_organizations: orgStats?.total || 0,
    active_organizations: orgStats?.active || 0,
    new_organizations_this_month: orgStats?.new_this_month || 0,
    total_cases: caseCount?.count || 0,
    monthly_revenue: revenueResult?.revenue || 0,
    plan_distribution: planDistribution?.results || [],
    recent_organizations: recentOrgs?.results || []
  })
})

// 法人一覧ページ
routes.get('/master/organizations', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>法人一覧 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('organizations')}
            
            <main class="flex-1 p-8">
                <div class="flex items-center justify-between mb-8">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-800">法人一覧</h1>
                        <p class="text-gray-600 mt-1">登録されている全法人を管理</p>
                    </div>
                    <a href="/master/organizations/new" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <i class="fas fa-plus"></i>
                        新規法人登録
                    </a>
                </div>
                
                <!-- 検索・フィルター -->
                <div class="bg-white rounded-xl shadow-sm p-4 mb-6">
                    <div class="flex flex-wrap gap-4">
                        <div class="flex-1 min-w-64">
                            <input type="text" id="searchInput" placeholder="法人名・メールで検索..." 
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <select id="statusFilter" class="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">全てのステータス</option>
                            <option value="active">稼働中</option>
                            <option value="trial">トライアル</option>
                            <option value="suspended">停止中</option>
                            <option value="cancelled">解約済み</option>
                        </select>
                        <select id="planFilter" class="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">全てのプラン</option>
                        </select>
                    </div>
                </div>
                
                <!-- 法人リスト -->
                <div class="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">法人名</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">プラン</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">案件数</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">登録日</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody id="organizationsList" class="divide-y divide-gray-200">
                            <tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">読み込み中...</td></tr>
                        </tbody>
                    </table>
                </div>
            </main>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${masterSidebarScripts}
            
            const STATUS_LABELS = {
                active: { text: '稼働中', class: 'bg-green-100 text-green-800' },
                trial: { text: 'トライアル', class: 'bg-blue-100 text-blue-800' },
                suspended: { text: '停止中', class: 'bg-yellow-100 text-yellow-800' },
                cancelled: { text: '解約済み', class: 'bg-red-100 text-red-800' }
            };
            
            async function loadOrganizations() {
                try {
                    const token = localStorage.getItem('master_token');
                    const search = document.getElementById('searchInput').value;
                    const status = document.getElementById('statusFilter').value;
                    const plan = document.getElementById('planFilter').value;
                    
                    const params = new URLSearchParams();
                    if (search) params.set('search', search);
                    if (status) params.set('status', status);
                    if (plan) params.set('plan', plan);
                    
                    const response = await axios.get('/api/master/organizations/list?' + params.toString(), {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    
                    const orgs = response.data;
                    const tbody = document.getElementById('organizationsList');
                    
                    if (orgs.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">法人が見つかりません</td></tr>';
                        return;
                    }
                    
                    tbody.innerHTML = orgs.map(org => {
                        const status = STATUS_LABELS[org.status] || STATUS_LABELS.active;
                        return \`
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4">
                                    <div>
                                        <p class="font-medium text-gray-900">\${org.name}</p>
                                        <p class="text-sm text-gray-500">\${org.email}</p>
                                    </div>
                                </td>
                                <td class="px-6 py-4">
                                    <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">\${org.plan_name || '未設定'}</span>
                                </td>
                                <td class="px-6 py-4">
                                    <span class="px-2 py-1 rounded text-sm \${status.class}">\${status.text}</span>
                                </td>
                                <td class="px-6 py-4 text-gray-600">\${org.case_count || 0}件</td>
                                <td class="px-6 py-4 text-gray-600">\${new Date(org.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                                <td class="px-6 py-4">
                                    <div class="flex gap-2">
                                        <a href="/master/organizations/\${org.id}" class="text-blue-600 hover:text-blue-800">
                                            <i class="fas fa-eye"></i>
                                        </a>
                                        <button onclick="loginAsOrg(\${org.id})" class="text-green-600 hover:text-green-800" title="この法人としてログイン">
                                            <i class="fas fa-sign-in-alt"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        \`;
                    }).join('');
                    
                } catch (error) {
                    console.error('Load error:', error);
                }
            }
            
            async function loadPlans() {
                try {
                    const response = await axios.get('/api/subscription/plans');
                    const select = document.getElementById('planFilter');
                    response.data.forEach(plan => {
                        const option = document.createElement('option');
                        option.value = plan.id;
                        option.textContent = plan.name;
                        select.appendChild(option);
                    });
                } catch (error) {
                    console.error('Load plans error:', error);
                }
            }
            
            async function loginAsOrg(orgId) {
                if (!confirm('この法人の管理画面に切り替えますか？')) return;
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.post('/api/master/impersonate/' + orgId, {}, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    
                    // 法人側の認証情報をセット
                    localStorage.setItem('admin_token', response.data.token);
                    localStorage.setItem('admin_name', response.data.name);
                    localStorage.setItem('admin_username', response.data.username);
                    localStorage.setItem('admin_role', response.data.role);
                    localStorage.setItem('organization_id', orgId);
                    
                    window.location.href = '/';
                } catch (error) {
                    alert('ログインに失敗しました');
                }
            }
            
            // イベントリスナー
            document.getElementById('searchInput').addEventListener('input', debounce(loadOrganizations, 300));
            document.getElementById('statusFilter').addEventListener('change', loadOrganizations);
            document.getElementById('planFilter').addEventListener('change', loadOrganizations);
            
            function debounce(func, wait) {
                let timeout;
                return function executedFunction(...args) {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func.apply(this, args), wait);
                };
            }
            
            loadPlans();
            loadOrganizations();
        </script>
    </body>
    </html>
  `)
})

// 法人一覧API（/api/master/organizations/list として使用）
routes.get('/master/organizations/list', async (c) => {
  const { DB } = c.env
  const search = c.req.query('search') || ''
  const status = c.req.query('status') || ''
  const plan = c.req.query('plan') || ''
  
  let query = `
    SELECT o.*, sp.plan_name,
           (SELECT COUNT(*) FROM cases WHERE organization_id = o.id) as case_count
    FROM organizations o
    LEFT JOIN user_subscriptions us ON o.id = us.organization_id AND us.status = 'active'
    LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE 1=1
  `
  const params: string[] = []
  
  if (search) {
    query += ` AND (o.name LIKE ? OR o.email LIKE ?)`
    params.push(`%${search}%`, `%${search}%`)
  }
  if (status) {
    query += ` AND o.status = ?`
    params.push(status)
  }
  
  query += ` ORDER BY o.created_at DESC LIMIT 100`
  
  const stmt = DB.prepare(query)
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all()
  
  return c.json(result?.results || [])
})

// 法人一覧API（/api/master/organizations として使用 - master-logs.tsから呼び出し）
routes.get('/api/master/organizations', async (c) => {
  const { DB } = c.env
  
  try {
    const result = await DB.prepare(`
      SELECT id, name, email, status, created_at
      FROM organizations
      ORDER BY name
    `).all()
    
    return c.json({ organizations: result?.results || [] })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return c.json({ organizations: [] })
  }
})

// 新規法人登録ページ
routes.get('/master/organizations/new', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>新規法人登録 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('new-org')}
            
            <main class="flex-1 p-8">
                <div class="mb-8">
                    <a href="/master/organizations" class="text-blue-600 hover:underline mb-2 inline-block">
                        <i class="fas fa-arrow-left mr-1"></i>法人一覧に戻る
                    </a>
                    <h1 class="text-3xl font-bold text-gray-800">新規法人登録</h1>
                    <p class="text-gray-600 mt-1">新しい法人アカウントを作成します</p>
                </div>
                
                <div class="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
                    <form id="orgForm" class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-gray-700 mb-1">法人名 / 事務所名 <span class="text-red-500">*</span></label>
                                <input type="text" name="name" required 
                                       class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="例: 田中社労士事務所">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">URLスラッグ <span class="text-red-500">*</span></label>
                                <input type="text" name="slug" required pattern="[a-z0-9-]+"
                                       class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="例: tanaka-office">
                                <p class="text-xs text-gray-500 mt-1">半角英数字とハイフンのみ</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span class="text-red-500">*</span></label>
                                <input type="email" name="email" required 
                                       class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="例: info@tanaka-office.jp">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                                <input type="tel" name="phone" 
                                       class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="例: 03-1234-5678">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">代表者名</label>
                                <input type="text" name="representative_name" 
                                       class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="例: 田中太郎">
                            </div>
                            
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-gray-700 mb-1">住所</label>
                                <input type="text" name="address" 
                                       class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="例: 東京都千代田区...">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">初期プラン <span class="text-red-500">*</span></label>
                                <select name="plan_id" required id="planSelect"
                                        class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">選択してください</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                                <select name="status" 
                                        class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="active">稼働中</option>
                                    <option value="trial">トライアル（14日間）</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="border-t pt-6">
                            <h3 class="font-medium text-gray-800 mb-4">管理者アカウント</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">管理者ユーザー名 <span class="text-red-500">*</span></label>
                                    <input type="text" name="admin_username" required 
                                           class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="例: admin">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">管理者パスワード <span class="text-red-500">*</span></label>
                                    <input type="password" name="admin_password" required minlength="6"
                                           class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="6文字以上">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">管理者表示名 <span class="text-red-500">*</span></label>
                                    <input type="text" name="admin_name" required 
                                           class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="例: 田中太郎">
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex justify-end gap-4">
                            <a href="/master/organizations" class="px-6 py-2 border rounded-lg hover:bg-gray-50">キャンセル</a>
                            <button type="submit" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                <i class="fas fa-plus mr-2"></i>法人を登録
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${masterSidebarScripts}
            
            async function loadPlans() {
                try {
                    const response = await axios.get('/api/subscription/plans');
                    const select = document.getElementById('planSelect');
                    response.data.forEach(plan => {
                        const option = document.createElement('option');
                        option.value = plan.id;
                        option.textContent = plan.name + ' - ¥' + plan.price.toLocaleString() + '/月';
                        select.appendChild(option);
                    });
                } catch (error) {
                    console.error('Load plans error:', error);
                }
            }
            
            document.getElementById('orgForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.post('/api/master/organizations', data, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    
                    alert('法人を登録しました！');
                    window.location.href = '/master/organizations/' + response.data.id;
                } catch (error) {
                    alert(error.response?.data?.error || '登録に失敗しました');
                }
            });
            
            // スラッグ自動生成
            document.querySelector('input[name="name"]').addEventListener('input', (e) => {
                const slugInput = document.querySelector('input[name="slug"]');
                if (!slugInput.value) {
                    // 簡易的なスラッグ生成（日本語は除去）
                    const slug = e.target.value.toLowerCase()
                        .replace(/[^a-z0-9]/g, '-')
                        .replace(/-+/g, '-')
                        .replace(/^-|-$/g, '');
                    slugInput.value = slug || '';
                }
            });
            
            loadPlans();
        </script>
    </body>
    </html>
  `)
})

// 法人登録API
routes.post('/master/organizations', async (c) => {
  const { DB } = c.env
  const data = await c.req.json()
  
  // スラッグの重複チェック
  const existing = await DB.prepare(`SELECT id FROM organizations WHERE slug = ?`).bind(data.slug).first()
  if (existing) {
    return c.json({ error: 'このURLスラッグは既に使用されています' }, 400)
  }
  
  // トランザクション的に処理
  try {
    // 1. 組織を作成
    const trialEndsAt = data.status === 'trial' 
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      : null
    
    const orgResult = await DB.prepare(`
      INSERT INTO organizations (name, slug, email, phone, address, representative_name, status, trial_ends_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.name,
      data.slug,
      data.email,
      data.phone || null,
      data.address || null,
      data.representative_name || null,
      data.status || 'active',
      trialEndsAt
    ).run()
    
    const orgId = orgResult.meta?.last_row_id
    
    // 2. 管理者アカウントを作成
    await DB.prepare(`
      INSERT INTO admin_users (username, password_hash, name, role, organization_id)
      VALUES (?, ?, ?, 'admin', ?)
    `).bind(data.admin_username, data.admin_password, data.admin_name, orgId).run()
    
    // 3. サブスクリプションを作成
    const plan = await DB.prepare(`SELECT * FROM subscription_plans WHERE id = ?`).bind(data.plan_id).first()
    if (plan) {
      const periodEnd = new Date()
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      
      const subResult = await DB.prepare(`
        INSERT INTO user_subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
        VALUES (?, ?, 'active', date('now'), ?)
      `).bind(orgId, data.plan_id, periodEnd.toISOString().split('T')[0]).run()
      
      const subscriptionId = subResult.meta?.last_row_id
      
      // 4. 初期枠を付与（正しいカラム名を使用）
      await DB.prepare(`
        INSERT INTO slot_balances (subscription_id, organization_id, monthly_slots_remaining, purchased_slots_remaining)
        VALUES (?, ?, ?, 0)
      `).bind(subscriptionId, orgId, plan.monthly_slots).run()
    }
    
    return c.json({ success: true, id: orgId })
    
  } catch (error: any) {
    console.error('Organization creation error:', error)
    return c.json({ error: '登録に失敗しました: ' + error.message }, 500)
  }
})

// 法人詳細ページ
routes.get('/master/organizations/:id', async (c) => {
  const orgId = c.req.param('id')
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>法人詳細 - マスター管理</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex min-h-screen">
            ${generateMasterSidebar('organizations')}
            
            <main class="flex-1 p-8">
                <div class="mb-8">
                    <a href="/master/organizations" class="text-blue-600 hover:underline mb-2 inline-block">
                        <i class="fas fa-arrow-left mr-1"></i>法人一覧に戻る
                    </a>
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 id="orgName" class="text-3xl font-bold text-gray-800">読み込み中...</h1>
                            <p id="orgEmail" class="text-gray-600 mt-1"></p>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="openEditModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                                <i class="fas fa-edit mr-2"></i>編集
                            </button>
                            <button onclick="loginAsOrg(${orgId})" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                                <i class="fas fa-sign-in-alt mr-2"></i>この法人としてログイン
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- 基本情報 -->
                    <div class="lg:col-span-2 space-y-6">
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h2 class="text-lg font-semibold mb-4">基本情報</h2>
                            <div id="orgDetails" class="grid grid-cols-2 gap-4">
                                <div class="animate-pulse h-20 bg-gray-200 rounded col-span-2"></div>
                            </div>
                        </div>
                        
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h2 class="text-lg font-semibold mb-4">スタッフ一覧</h2>
                            <div id="staffList" class="space-y-2">
                                <div class="animate-pulse h-12 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- サイドバー -->
                    <div class="space-y-6">
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h2 class="text-lg font-semibold mb-4 flex justify-between items-center">
                                契約情報
                                <button onclick="openPlanModal()" class="text-sm text-blue-600 hover:underline">変更</button>
                            </h2>
                            <div id="subscriptionInfo" class="space-y-3">
                                <div class="animate-pulse h-8 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                        
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h2 class="text-lg font-semibold mb-4">枠管理</h2>
                            <div id="slotInfo" class="space-y-3">
                                <div class="animate-pulse h-8 bg-gray-200 rounded"></div>
                            </div>
                            <button onclick="openAddSlotsModal()" class="mt-4 w-full bg-blue-100 text-blue-800 px-4 py-2 rounded-lg hover:bg-blue-200">
                                <i class="fas fa-plus mr-2"></i>枠を追加
                            </button>
                        </div>
                        
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h2 class="text-lg font-semibold mb-4">利用状況</h2>
                            <div id="usageStats" class="space-y-3">
                                <div class="animate-pulse h-8 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                        
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h2 class="text-lg font-semibold mb-4 flex justify-between items-center">
                                <span><i class="fas fa-credit-card mr-2 text-green-600"></i>決済設定</span>
                                <button onclick="openPaymentModal()" class="text-sm text-blue-600 hover:underline">編集</button>
                            </h2>
                            <div id="paymentInfo" class="space-y-3">
                                <div class="animate-pulse h-8 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                        
                        <div class="bg-white rounded-xl shadow-sm p-6">
                            <h2 class="text-lg font-semibold mb-4 text-red-600">危険な操作</h2>
                            <button onclick="suspendOrg()" class="w-full mb-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200">
                                <i class="fas fa-pause mr-2"></i>一時停止
                            </button>
                            <button onclick="deleteOrg()" class="w-full px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200">
                                <i class="fas fa-trash mr-2"></i>法人を削除
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <!-- 編集モーダル -->
        <div id="editModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
            <div class="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold">法人情報を編集</h3>
                        <button onclick="closeEditModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <form id="editForm" class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">法人名</label>
                        <input type="text" id="edit_name" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                        <input type="email" id="edit_email" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                        <input type="tel" id="edit_phone" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">代表者名</label>
                        <input type="text" id="edit_representative" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">住所</label>
                        <input type="text" id="edit_address" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                        <select id="edit_status" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            <option value="active">稼働中</option>
                            <option value="trial">トライアル</option>
                            <option value="suspended">停止中</option>
                            <option value="cancelled">解約済み</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">業務範囲</label>
                        <select id="edit_business_scope" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            <option value="labor">社労士（助成金のみ）</option>
                            <option value="administrative">行政書士（補助金・許認可のみ）</option>
                            <option value="both">両方利用（+¥2,000/月）</option>
                        </select>
                        <p class="mt-1 text-xs text-gray-500">※変更すると表示される申請種別が変わります</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">備考</label>
                        <textarea id="edit_notes" rows="3" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="closeEditModal()" class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">キャンセル</button>
                        <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存</button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- プラン変更モーダル -->
        <div id="planModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
            <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4">
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold">プランを変更</h3>
                        <button onclick="closePlanModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div class="p-6">
                    <div id="planOptions" class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <!-- プランはJSで動的に読み込み -->
                    </div>
                    <div class="flex gap-3 pt-6">
                        <button onclick="closePlanModal()" class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">キャンセル</button>
                        <button onclick="changePlan()" id="changePlanBtn" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">変更を適用</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 枠追加モーダル -->
        <div id="addSlotsModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
            <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold">枠を追加</h3>
                        <button onclick="closeAddSlotsModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div class="p-6">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">追加する枠数</label>
                        <input type="number" id="addSlotCount" min="1" value="10" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">追加理由</label>
                        <select id="addSlotReason" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                            <option value="purchase">購入</option>
                            <option value="bonus">ボーナス付与</option>
                            <option value="compensation">補償</option>
                            <option value="other">その他</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">備考</label>
                        <input type="text" id="addSlotNote" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="任意">
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button onclick="closeAddSlotsModal()" class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">キャンセル</button>
                        <button onclick="addSlots()" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">追加</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 決済設定モーダル -->
        <div id="paymentModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
            <div class="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold"><i class="fas fa-credit-card mr-2 text-green-600"></i>決済設定</h3>
                        <button onclick="closePaymentModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <form id="paymentForm" class="p-6 space-y-6">
                    <!-- 決済方法（銀行振込のみ） -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">決済方法</label>
                        <div class="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                            <i class="fas fa-university text-green-600"></i>
                            <span class="text-green-800 font-medium">銀行振込</span>
                        </div>
                        <input type="hidden" id="payment_method" value="bank_transfer">
                    </div>
                    
                    <!-- 銀行振込設定 -->
                    <div class="border rounded-lg p-4 bg-gray-50">
                        <h4 class="font-medium mb-3 flex items-center gap-2">
                            <i class="fas fa-university text-blue-600"></i>銀行振込先情報
                        </h4>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs text-gray-600 mb-1">銀行名</label>
                                <input type="text" id="payment_bank_name" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 三菱UFJ銀行">
                            </div>
                            <div>
                                <label class="block text-xs text-gray-600 mb-1">支店名</label>
                                <input type="text" id="payment_bank_branch" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 渋谷支店">
                            </div>
                            <div>
                                <label class="block text-xs text-gray-600 mb-1">口座種別</label>
                                <select id="payment_bank_account_type" class="w-full px-3 py-2 border rounded-lg text-sm">
                                    <option value="普通">普通</option>
                                    <option value="当座">当座</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs text-gray-600 mb-1">口座番号</label>
                                <input type="text" id="payment_bank_account_number" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: 1234567">
                            </div>
                            <div class="col-span-2">
                                <label class="block text-xs text-gray-600 mb-1">口座名義</label>
                                <input type="text" id="payment_bank_account_holder" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="例: カ）サンプルジムショ">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 備考 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">決済に関する備考</label>
                        <textarea id="payment_notes" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="特記事項があれば入力"></textarea>
                    </div>
                    
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="closePaymentModal()" class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">キャンセル</button>
                        <button type="submit" class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">保存</button>
                    </div>
                </form>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${masterSidebarScripts}
            
            const ORG_ID = ${orgId};
            let currentOrg = null;
            let selectedPlanId = null;
            let plans = [];
            
            async function loadOrgDetails() {
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.get('/api/master/organizations/' + ORG_ID + '/detail', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const org = response.data;
                    
                    document.getElementById('orgName').textContent = org.name;
                    document.getElementById('orgEmail').textContent = org.email;
                    
                    const statusLabel = {
                        active: '<span class="px-2 py-1 bg-green-100 text-green-800 rounded">稼働中</span>',
                        trial: '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded">トライアル</span>',
                        suspended: '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">停止中</span>',
                        cancelled: '<span class="px-2 py-1 bg-red-100 text-red-800 rounded">解約済み</span>'
                    };
                    
                    const scopeLabels = {
                        labor: '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">社労士（助成金）</span>',
                        administrative: '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">行政書士（補助金・許認可）</span>',
                        both: '<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">両方（+¥2,000/月）</span>'
                    };
                    
                    document.getElementById('orgDetails').innerHTML = \`
                        <div>
                            <p class="text-sm text-gray-500">ステータス</p>
                            <p class="mt-1">\${statusLabel[org.status] || org.status}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">業務範囲</p>
                            <p class="mt-1">\${scopeLabels[org.business_scope] || scopeLabels.labor}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">登録日</p>
                            <p class="mt-1 font-medium">\${new Date(org.created_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">電話番号</p>
                            <p class="mt-1 font-medium">\${org.phone || '-'}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">代表者</p>
                            <p class="mt-1 font-medium">\${org.representative_name || '-'}</p>
                        </div>
                        <div class="col-span-2">
                            <p class="text-sm text-gray-500">住所</p>
                            <p class="mt-1 font-medium">\${org.address || '-'}</p>
                        </div>
                    \`;
                    
                    // スタッフ一覧
                    document.getElementById('staffList').innerHTML = org.staff.map(s => \`
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <p class="font-medium">\${s.name}</p>
                                <p class="text-sm text-gray-500">@\${s.username}</p>
                            </div>
                            <span class="text-xs px-2 py-1 rounded \${s.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}">\${s.role === 'admin' ? '管理者' : 'スタッフ'}</span>
                        </div>
                    \`).join('') || '<p class="text-gray-500">スタッフがいません</p>';
                    
                    // 契約情報
                    document.getElementById('subscriptionInfo').innerHTML = \`
                        <div class="flex justify-between">
                            <span class="text-gray-500">プラン</span>
                            <span class="font-medium">\${org.subscription?.plan_name || '未設定'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500">月額</span>
                            <span class="font-medium">¥\${(org.subscription?.price || 0).toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500">次回更新</span>
                            <span class="font-medium">\${org.subscription?.current_period_end ? new Date(org.subscription.current_period_end).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}</span>
                        </div>
                    \`;
                    
                    // 利用状況
                    document.getElementById('usageStats').innerHTML = \`
                        <div class="flex justify-between">
                            <span class="text-gray-500">総顧客数</span>
                            <span class="font-medium">\${org.stats?.client_count || 0}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500">総案件数</span>
                            <span class="font-medium">\${org.stats?.case_count || 0}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500">今月の案件</span>
                            <span class="font-medium">\${org.stats?.cases_this_month || 0}</span>
                        </div>
                    \`;
                    
                    // 枠情報
                    document.getElementById('slotInfo').innerHTML = \`
                        <div class="flex justify-between">
                            <span class="text-gray-500">月間枠（残り）</span>
                            <span class="font-medium">\${org.slots?.monthly_remaining || 0}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500">購入枠（残り）</span>
                            <span class="font-medium">\${org.slots?.purchased_remaining || 0}</span>
                        </div>
                        <div class="flex justify-between font-bold">
                            <span class="text-gray-700">合計</span>
                            <span class="text-blue-600">\${(org.slots?.monthly_remaining || 0) + (org.slots?.purchased_remaining || 0)}</span>
                        </div>
                    \`;
                    
                    // 決済情報（銀行振込のみ対応）
                    const paymentMethodLabels = {
                        'bank_transfer': '銀行振込'
                    };
                    const hasBankInfo = org.bank_name && org.bank_account_number;
                    document.getElementById('paymentInfo').innerHTML = \`
                        <div class="flex justify-between">
                            <span class="text-gray-500">決済方法</span>
                            <span class="font-medium">\${paymentMethodLabels[org.payment_method] || '銀行振込'}</span>
                        </div>
                        \${hasBankInfo ? \`
                        <div class="text-sm bg-gray-50 rounded p-2 mt-2">
                            <p class="text-gray-600">\${org.bank_name} \${org.bank_branch || ''}</p>
                            <p class="text-gray-600">\${org.bank_account_type || '普通'} \${org.bank_account_number}</p>
                            <p class="text-gray-800 font-medium">\${org.bank_account_holder || ''}</p>
                        </div>
                        \` : '<p class="text-sm text-gray-400">振込先未設定</p>'}
                        \${org.stripe_enabled ? \`
                        <div class="flex items-center gap-2 mt-2">
                            <i class="fab fa-stripe text-purple-600"></i>
                            <span class="text-sm text-green-600">Stripe有効</span>
                        </div>
                        \` : ''}
                    \`;
                    
                    currentOrg = org;
                    
                } catch (error) {
                    console.error('Load error:', error);
                }
            }
            
            // 編集モーダル関連
            function openEditModal() {
                if (!currentOrg) return;
                document.getElementById('edit_name').value = currentOrg.name || '';
                document.getElementById('edit_email').value = currentOrg.email || '';
                document.getElementById('edit_phone').value = currentOrg.phone || '';
                document.getElementById('edit_representative').value = currentOrg.representative_name || '';
                document.getElementById('edit_address').value = currentOrg.address || '';
                document.getElementById('edit_status').value = currentOrg.status || 'active';
                document.getElementById('edit_business_scope').value = currentOrg.business_scope || 'labor';
                document.getElementById('edit_notes').value = currentOrg.notes || '';
                document.getElementById('editModal').classList.remove('hidden');
            }
            
            function closeEditModal() {
                document.getElementById('editModal').classList.add('hidden');
            }
            
            document.getElementById('editForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const token = localStorage.getItem('master_token');
                    await axios.put('/api/master/organizations/' + ORG_ID + '/detail', {
                        name: document.getElementById('edit_name').value,
                        email: document.getElementById('edit_email').value,
                        phone: document.getElementById('edit_phone').value,
                        representative_name: document.getElementById('edit_representative').value,
                        address: document.getElementById('edit_address').value,
                        status: document.getElementById('edit_status').value,
                        business_scope: document.getElementById('edit_business_scope').value,
                        notes: document.getElementById('edit_notes').value
                    }, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    closeEditModal();
                    loadOrgDetails();
                    alert('保存しました');
                } catch (error) {
                    alert('保存に失敗しました');
                }
            });
            
            // プラン変更モーダル関連
            async function openPlanModal() {
                document.getElementById('planModal').classList.remove('hidden');
                if (plans.length === 0) {
                    try {
                        const response = await axios.get('/api/subscription/plans');
                        plans = response.data;
                    } catch (e) {
                        plans = [];
                    }
                }
                renderPlanOptions();
            }
            
            function closePlanModal() {
                document.getElementById('planModal').classList.add('hidden');
            }
            
            function renderPlanOptions() {
                const container = document.getElementById('planOptions');
                container.innerHTML = plans.map(plan => \`
                    <div class="plan-option border-2 rounded-lg p-4 cursor-pointer transition-all hover:border-blue-300 \${currentOrg?.subscription?.plan_id === plan.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}"
                         onclick="selectPlan(\${plan.id}, this)" data-plan-id="\${plan.id}">
                        <h4 class="font-bold">\${plan.plan_name}</h4>
                        <p class="text-xl font-bold text-blue-600">¥\${plan.monthly_price.toLocaleString()}<span class="text-sm text-gray-500">/月</span></p>
                        <p class="text-sm text-gray-500">\${plan.monthly_slots > 0 ? plan.monthly_slots + '枠/月' : '無制限'}</p>
                    </div>
                \`).join('');
                selectedPlanId = currentOrg?.subscription?.plan_id;
            }
            
            function selectPlan(planId, element) {
                selectedPlanId = planId;
                document.querySelectorAll('.plan-option').forEach(el => {
                    el.classList.remove('border-blue-500', 'bg-blue-50');
                    el.classList.add('border-gray-200');
                });
                element.classList.remove('border-gray-200');
                element.classList.add('border-blue-500', 'bg-blue-50');
            }
            
            async function changePlan() {
                if (!selectedPlanId) return;
                if (!confirm('プランを変更しますか？')) return;
                try {
                    const token = localStorage.getItem('master_token');
                    await axios.post('/api/master/organizations/' + ORG_ID + '/change-plan', {
                        plan_id: selectedPlanId
                    }, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    closePlanModal();
                    loadOrgDetails();
                    alert('プランを変更しました');
                } catch (error) {
                    alert('変更に失敗しました');
                }
            }
            
            // 枠追加モーダル関連
            function openAddSlotsModal() {
                document.getElementById('addSlotsModal').classList.remove('hidden');
            }
            
            function closeAddSlotsModal() {
                document.getElementById('addSlotsModal').classList.add('hidden');
            }
            
            async function addSlots() {
                const count = parseInt(document.getElementById('addSlotCount').value);
                const reason = document.getElementById('addSlotReason').value;
                const note = document.getElementById('addSlotNote').value;
                
                if (count < 1) {
                    alert('1以上の数を入力してください');
                    return;
                }
                
                try {
                    const token = localStorage.getItem('master_token');
                    await axios.post('/api/master/organizations/' + ORG_ID + '/add-slots', {
                        count, reason, note
                    }, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    closeAddSlotsModal();
                    loadOrgDetails();
                    alert(count + '枠を追加しました');
                } catch (error) {
                    alert('追加に失敗しました');
                }
            }
            
            // 決済設定モーダル関連
            function openPaymentModal() {
                if (!currentOrg) return;
                document.getElementById('payment_method').value = currentOrg.payment_method || 'bank_transfer';
                document.getElementById('payment_bank_name').value = currentOrg.bank_name || '';
                document.getElementById('payment_bank_branch').value = currentOrg.bank_branch || '';
                document.getElementById('payment_bank_account_type').value = currentOrg.bank_account_type || '普通';
                document.getElementById('payment_bank_account_number').value = currentOrg.bank_account_number || '';
                document.getElementById('payment_bank_account_holder').value = currentOrg.bank_account_holder || '';
                document.getElementById('payment_stripe_enabled').checked = currentOrg.stripe_enabled == 1;
                document.getElementById('payment_stripe_account_id').value = currentOrg.stripe_account_id || '';
                document.getElementById('payment_notes').value = currentOrg.payment_notes || '';
                document.getElementById('paymentModal').classList.remove('hidden');
            }
            
            function closePaymentModal() {
                document.getElementById('paymentModal').classList.add('hidden');
            }
            
            document.getElementById('paymentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const token = localStorage.getItem('master_token');
                    await axios.put('/api/master/organizations/' + ORG_ID + '/payment-settings', {
                        payment_method: document.getElementById('payment_method').value,
                        bank_name: document.getElementById('payment_bank_name').value,
                        bank_branch: document.getElementById('payment_bank_branch').value,
                        bank_account_type: document.getElementById('payment_bank_account_type').value,
                        bank_account_number: document.getElementById('payment_bank_account_number').value,
                        bank_account_holder: document.getElementById('payment_bank_account_holder').value,
                        stripe_enabled: document.getElementById('payment_stripe_enabled').checked ? 1 : 0,
                        stripe_account_id: document.getElementById('payment_stripe_account_id').value,
                        payment_notes: document.getElementById('payment_notes').value
                    }, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    closePaymentModal();
                    loadOrgDetails();
                    alert('決済設定を保存しました');
                } catch (error) {
                    alert('保存に失敗しました');
                }
            });
            
            async function loginAsOrg(orgId) {
                if (!confirm('この法人の管理画面に切り替えますか？')) return;
                try {
                    const token = localStorage.getItem('master_token');
                    const response = await axios.post('/api/master/impersonate/' + orgId, {}, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    
                    localStorage.setItem('admin_token', response.data.token);
                    localStorage.setItem('admin_name', response.data.name);
                    localStorage.setItem('admin_username', response.data.username);
                    localStorage.setItem('admin_role', response.data.role);
                    localStorage.setItem('organization_id', orgId);
                    
                    window.location.href = '/';
                } catch (error) {
                    alert('ログインに失敗しました');
                }
            }
            
            async function suspendOrg() {
                if (!confirm('この法人を一時停止しますか？')) return;
                try {
                    const token = localStorage.getItem('master_token');
                    await axios.post('/api/master/organizations/' + ORG_ID + '/suspend', {}, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    alert('法人を一時停止しました');
                    loadOrgDetails();
                } catch (error) {
                    alert('操作に失敗しました');
                }
            }
            
            async function deleteOrg() {
                if (!confirm('この法人を削除しますか？この操作は取り消せません。')) return;
                if (!confirm('本当に削除しますか？関連するすべてのデータが失われます。')) return;
                
                try {
                    const token = localStorage.getItem('master_token');
                    await axios.delete('/api/master/organizations/' + ORG_ID + '/detail', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    alert('法人を削除しました');
                    window.location.href = '/master/organizations';
                } catch (error) {
                    alert('削除に失敗しました');
                }
            }
            
            loadOrgDetails();
        </script>
    </body>
    </html>
  `)
})

// 法人詳細API
routes.get('/master/organizations/:id/detail', async (c) => {
  const { DB } = c.env
  const orgId = c.req.param('id')
  
  const org = await DB.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(orgId).first()
  if (!org) {
    return c.json({ error: 'Organization not found' }, 404)
  }
  
  // スタッフ一覧
  const staff = await DB.prepare(`
    SELECT id, username, name, role, created_at FROM admin_users WHERE organization_id = ?
  `).bind(orgId).all()
  
  // サブスクリプション情報
  const subscription = await DB.prepare(`
    SELECT us.*, sp.plan_name, sp.monthly_price as price, sp.monthly_slots
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.organization_id = ? AND us.status = 'active'
  `).bind(orgId).first()
  
  // 統計
  const clientCount = await DB.prepare(`SELECT COUNT(*) as count FROM clients WHERE organization_id = ?`).bind(orgId).first()
  const caseCount = await DB.prepare(`SELECT COUNT(*) as count FROM cases WHERE organization_id = ?`).bind(orgId).first()
  const casesThisMonth = await DB.prepare(`
    SELECT COUNT(*) as count FROM cases 
    WHERE organization_id = ? AND created_at >= date('now', 'start of month')
  `).bind(orgId).first()
  
  // 枠情報
  const slots = await DB.prepare(`
    SELECT monthly_slots_remaining, purchased_slots_remaining
    FROM slot_balances sb
    JOIN user_subscriptions us ON sb.subscription_id = us.id
    WHERE us.organization_id = ? AND us.status = 'active'
  `).bind(orgId).first()
  
  return c.json({
    ...org,
    staff: staff?.results || [],
    subscription,
    slots: slots ? {
      monthly_remaining: slots.monthly_slots_remaining || 0,
      purchased_remaining: slots.purchased_slots_remaining || 0
    } : null,
    stats: {
      client_count: clientCount?.count || 0,
      case_count: caseCount?.count || 0,
      cases_this_month: casesThisMonth?.count || 0
    }
  })
})

// 法人更新API
routes.put('/master/organizations/:id', async (c) => {
  const { DB } = c.env
  const orgId = c.req.param('id')
  const data = await c.req.json()
  
  // 業務範囲の変更時のアドオン管理
  if (data.business_scope) {
    const currentOrg = await DB.prepare(`SELECT business_scope FROM organizations WHERE id = ?`).bind(orgId).first()
    const oldScope = currentOrg?.business_scope
    const newScope = data.business_scope
    
    // bothに変更：アドオンを追加
    if (newScope === 'both' && oldScope !== 'both') {
      const existingAddon = await DB.prepare(`
        SELECT id FROM organization_addons WHERE organization_id = ? AND addon_type = 'dual_scope' AND status = 'active'
      `).bind(orgId).first()
      
      if (!existingAddon) {
        await DB.prepare(`
          INSERT INTO organization_addons (organization_id, addon_type, price, status)
          VALUES (?, 'dual_scope', 2000, 'active')
        `).bind(orgId).run()
      }
    }
    // bothから変更：アドオンをキャンセル
    else if (oldScope === 'both' && newScope !== 'both') {
      await DB.prepare(`
        UPDATE organization_addons SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
        WHERE organization_id = ? AND addon_type = 'dual_scope' AND status = 'active'
      `).bind(orgId).run()
    }
  }
  
  await DB.prepare(`
    UPDATE organizations SET 
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      representative_name = COALESCE(?, representative_name),
      address = COALESCE(?, address),
      status = COALESCE(?, status),
      business_scope = COALESCE(?, business_scope),
      notes = COALESCE(?, notes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.name || null,
    data.email || null,
    data.phone || null,
    data.representative_name || null,
    data.address || null,
    data.status || null,
    data.business_scope || null,
    data.notes || null,
    orgId
  ).run()
  
  return c.json({ success: true })
})

// 決済設定更新API
routes.put('/master/organizations/:id/payment-settings', async (c) => {
  const { DB } = c.env
  const orgId = c.req.param('id')
  const data = await c.req.json()
  
  await DB.prepare(`
    UPDATE organizations SET
      payment_method = COALESCE(?, payment_method),
      bank_name = ?,
      bank_branch = ?,
      bank_account_type = COALESCE(?, '普通'),
      bank_account_number = ?,
      bank_account_holder = ?,
      stripe_enabled = COALESCE(?, 0),
      stripe_account_id = ?,
      payment_notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.payment_method || null,
    data.bank_name || null,
    data.bank_branch || null,
    data.bank_account_type || null,
    data.bank_account_number || null,
    data.bank_account_holder || null,
    data.stripe_enabled || 0,
    data.stripe_account_id || null,
    data.payment_notes || null,
    orgId
  ).run()
  
  return c.json({ success: true, message: '決済設定を更新しました' })
})

// プラン変更API
routes.post('/master/organizations/:id/change-plan', async (c) => {
  const { DB } = c.env
  const orgId = c.req.param('id')
  const { plan_id } = await c.req.json()
  
  // プラン情報取得
  const plan = await DB.prepare(`SELECT * FROM subscription_plans WHERE id = ?`).bind(plan_id).first()
  if (!plan) {
    return c.json({ error: 'Plan not found' }, 404)
  }
  
  // 既存のサブスクリプション更新
  const existing = await DB.prepare(`
    SELECT id FROM user_subscriptions WHERE organization_id = ? AND status = 'active'
  `).bind(orgId).first()
  
  if (existing) {
    await DB.prepare(`
      UPDATE user_subscriptions SET plan_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(plan_id, existing.id).run()
    
    // 月間枠をリセット
    await DB.prepare(`
      UPDATE slot_balances SET monthly_slots_remaining = ?, updated_at = CURRENT_TIMESTAMP
      WHERE subscription_id = ?
    `).bind(plan.monthly_slots, existing.id).run()
  } else {
    // 新規サブスクリプション作成
    const result = await DB.prepare(`
      INSERT INTO user_subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
      VALUES (?, ?, 'active', date('now'), date('now', '+1 month'))
    `).bind(orgId, plan_id).run()
    
    await DB.prepare(`
      INSERT INTO slot_balances (subscription_id, organization_id, monthly_slots_remaining, purchased_slots_remaining)
      VALUES (?, ?, ?, 0)
    `).bind(result.meta?.last_row_id, orgId, plan.monthly_slots).run()
  }
  
  return c.json({ success: true })
})

// 枠追加API
routes.post('/master/organizations/:id/add-slots', async (c) => {
  const { DB } = c.env
  const orgId = c.req.param('id')
  const { count, reason, note } = await c.req.json()
  
  if (!count || count < 1) {
    return c.json({ error: 'Invalid count' }, 400)
  }
  
  // slot_balances更新
  const subscription = await DB.prepare(`
    SELECT us.id as subscription_id, sb.id as balance_id, sb.purchased_slots_remaining
    FROM user_subscriptions us
    JOIN slot_balances sb ON us.id = sb.subscription_id
    WHERE us.organization_id = ? AND us.status = 'active'
  `).bind(orgId).first()
  
  if (!subscription) {
    return c.json({ error: 'No active subscription found' }, 404)
  }
  
  const newBalance = (subscription.purchased_slots_remaining || 0) + count
  
  await DB.prepare(`
    UPDATE slot_balances SET purchased_slots_remaining = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(newBalance, subscription.balance_id).run()
  
  // 履歴記録
  await DB.prepare(`
    INSERT INTO slot_usage_history (subscription_id, organization_id, slot_type, action, slots_changed, balance_after, note)
    VALUES (?, ?, 'purchased', 'added', ?, ?, ?)
  `).bind(
    subscription.subscription_id,
    orgId,
    count,
    newBalance,
    note || reason || 'マスター管理者による追加'
  ).run()
  
  return c.json({ success: true, new_balance: newBalance })
})

// 法人停止API
routes.post('/master/organizations/:id/suspend', async (c) => {
  const { DB } = c.env
  const orgId = c.req.param('id')
  
  await DB.prepare(`UPDATE organizations SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(orgId).run()
  
  return c.json({ success: true })
})

// 法人削除API
routes.delete('/master/organizations/:id', async (c) => {
  const { DB } = c.env
  const orgId = c.req.param('id')
  
  try {
    // 安全な削除ヘルパー
    const safeDelete = async (query: string, ...params: any[]) => {
      try {
        await DB.prepare(query).bind(...params).run()
      } catch (e) {
        console.log('Safe delete skipped:', query, e)
      }
    }
    
    // 1. まずsubscription_idを取得（外部キー参照の親）
    const subscriptions = await DB.prepare(`SELECT id FROM user_subscriptions WHERE organization_id = ?`).bind(orgId).all()
    const subscriptionIds = subscriptions?.results?.map((s: any) => s.id) || []
    
    // 2. subscription_idを参照しているテーブルを先に削除
    for (const subId of subscriptionIds) {
      await safeDelete(`DELETE FROM slot_usage_history WHERE subscription_id = ?`, subId)
      await safeDelete(`DELETE FROM slot_balances WHERE subscription_id = ?`, subId)
    }
    
    // 3. organization_idを参照しているテーブルも削除
    await safeDelete(`DELETE FROM slot_usage_history WHERE organization_id = ?`, orgId)
    await safeDelete(`DELETE FROM slot_balances WHERE organization_id = ?`, orgId)
    
    // 4. user_subscriptionsを削除（これでorganizationsの外部キー制約がクリア）
    await safeDelete(`DELETE FROM user_subscriptions WHERE organization_id = ?`, orgId)
    
    // 5. client_id経由で削除
    const clients = await DB.prepare(`SELECT id FROM clients WHERE organization_id = ?`).bind(orgId).all()
    const clientIds = clients?.results?.map((c: any) => c.id) || []
    
    for (const clientId of clientIds) {
      await safeDelete(`DELETE FROM communications WHERE client_id = ?`, clientId)
      await safeDelete(`DELETE FROM documents WHERE client_id = ?`, clientId)
      await safeDelete(`DELETE FROM hearing_answers WHERE client_id = ?`, clientId)
    }
    
    // 6. case_id経由で削除
    const cases = await DB.prepare(`SELECT id FROM cases WHERE organization_id = ?`).bind(orgId).all()
    const caseIds = cases?.results?.map((c: any) => c.id) || []
    
    for (const caseId of caseIds) {
      await safeDelete(`DELETE FROM client_pipeline_tasks WHERE pipeline_id IN (SELECT id FROM client_pipelines WHERE case_id = ?)`, caseId)
      await safeDelete(`DELETE FROM client_pipelines WHERE case_id = ?`, caseId)
    }
    
    // 7. メインテーブル削除
    await safeDelete(`DELETE FROM cases WHERE organization_id = ?`, orgId)
    await safeDelete(`DELETE FROM clients WHERE organization_id = ?`, orgId)
    await safeDelete(`DELETE FROM admin_users WHERE organization_id = ?`, orgId)
    
    // 8. 最後に組織を削除
    await DB.prepare(`DELETE FROM organizations WHERE id = ?`).bind(orgId).run()
    
    return c.json({ success: true })
  } catch (error: any) {
    console.error('Delete organization error:', error)
    return c.json({ error: 'Failed to delete organization: ' + error.message }, 500)
  }
})

// 法人としてログイン（なりすまし）API
routes.post('/master/impersonate/:id', async (c) => {
  const { DB } = c.env
  const orgId = c.req.param('id')
  
  // 組織の管理者アカウントを取得
  const admin = await DB.prepare(`
    SELECT * FROM admin_users WHERE organization_id = ? AND role = 'admin' LIMIT 1
  `).bind(orgId).first()
  
  if (!admin) {
    return c.json({ error: 'Admin not found for this organization' }, 404)
  }
  
  const token = btoa(`${admin.id}:${Date.now()}:impersonate`)
  
  return c.json({
    token,
    name: admin.name,
    username: admin.username,
    role: admin.role || 'admin',
    organization_id: orgId
  })
})

export default routes
