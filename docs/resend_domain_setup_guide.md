# Resend ドメイン認証設定ガイド

**目的**: 「申請らくらく君」から認証メール（サインアップ時の確認コード等）を正しく送信できるようにする

---

## 📋 現状の問題

現在、メール送信に `onboarding@resend.dev` というResendのテスト用アドレスを使用しています。
これには以下の制限があります：

- **送信先制限**: Resendアカウントに登録されたメールアドレスにしか送信できない
- **信頼性の問題**: 迷惑メールに振り分けられやすい
- **ブランディング**: 自社ドメインからのメールではないため信頼性が低い

**解決策**: `shinsei-raku.com` ドメインをResendに登録・認証する

---

## 🔧 必要な作業

### 作業者の役割分担

| 作業 | 担当者 |
|------|--------|
| Resendアカウントでドメイン追加 | 開発者（私） |
| DNSレコードの追加 | **ドメイン管理者（あなた）** |
| 認証完了の確認 | 開発者（私） |
| アプリへの設定反映 | 開発者（私） |

---

## 📝 ドメイン管理者が行う作業

### Step 1: DNSレコードの追加

Resendでドメインを追加すると、以下のようなDNSレコードが発行されます。
**これらのレコードをDNS設定に追加してください。**

#### 追加が必要なDNSレコード（例）

| タイプ | 名前（ホスト） | 値 | 用途 |
|--------|---------------|-----|------|
| **TXT** | `_resend` | `resend-verify-xxxxxxxxxxxx` | ドメイン所有確認 |
| **MX** | `send` または `mail` | `feedback-smtp.us-east-1.amazonses.com` | バウンスメール受信 |
| **TXT** | `send` または `mail` | `v=spf1 include:amazonses.com ~all` | SPF認証 |
| **CNAME** | `resend._domainkey` | `resend._domainkey.xxxxx.dkim.resend.dev` | DKIM署名 |

> ⚠️ **実際の値はResendダッシュボードで確認してください**（上記は例です）

---

### Step 2: DNS設定の場所

ドメインを管理しているサービスによって設定場所が異なります：

| サービス | DNS設定の場所 |
|---------|--------------|
| **Cloudflare** | ダッシュボード → DNS → レコード |
| **お名前.com** | ドメイン設定 → DNS設定 |
| **ムームードメイン** | コントロールパネル → ドメイン → DNS設定 |
| **AWS Route 53** | Hosted Zones → レコードセット |
| **Google Domains** | DNS → カスタムリソースレコード |

---

### Step 3: 追加するレコードの詳細

#### 1. TXTレコード（ドメイン認証用）

```
タイプ: TXT
名前: _resend（または _resend.shinsei-raku.com）
値: resend-verify-xxxxxxxxxxxxx（Resendから発行される値）
TTL: 3600（または自動）
```

#### 2. MXレコード（バウンスメール用）- オプション

```
タイプ: MX
名前: send（つまり send.shinsei-raku.com）
値: feedback-smtp.us-east-1.amazonses.com
優先度: 10
TTL: 3600
```

#### 3. TXTレコード（SPF用）

```
タイプ: TXT
名前: send（または @）
値: v=spf1 include:amazonses.com ~all
TTL: 3600
```

> 既存のSPFレコードがある場合は、`include:amazonses.com` を追加

#### 4. CNAMEレコード（DKIM用）

```
タイプ: CNAME
名前: resend._domainkey
値: resend._domainkey.xxxxx.dkim.resend.dev（Resendから発行される値）
TTL: 3600
```

---

## ✅ 確認方法

DNSレコードを追加した後、以下の方法で確認できます：

### 1. コマンドラインで確認

```bash
# TXTレコードの確認
dig TXT _resend.shinsei-raku.com

# DKIMレコードの確認
dig CNAME resend._domainkey.shinsei-raku.com
```

### 2. オンラインツールで確認

- [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) - DNS Lookup
- [DNSChecker](https://dnschecker.org/) - DNS伝播確認

---

## 📨 設定完了後に送信可能になるメール

1. **サインアップ認証メール**
   - 新規登録時の6桁認証コード送信
   
2. **ポータルアクセス案内メール**
   - 顧客への専用URL案内

3. **ステータス変更通知**
   - 申請進捗の自動通知

4. **書類アップロード通知**
   - 顧客がアップロードした際の管理者通知

---

## 🔒 セキュリティ上の注意

- DNSレコードは**正確に**設定してください（タイポに注意）
- Resendから発行される値は**そのまま**コピー＆ペーストしてください
- DNS伝播には最大48時間かかる場合がありますが、通常は数分〜数時間です

---

## 📞 必要な情報の共有

ドメイン管理者の方は、以下の情報を開発者に共有してください：

1. **DNS管理サービス名**（Cloudflare、お名前.com等）
2. **DNSレコード追加完了の連絡**

開発者から共有する情報：

1. **Resendで発行されたDNSレコードの具体的な値**
2. **認証完了の確認結果**

---

## 🚀 作業フロー

```
[開発者] Resendでドメイン追加
    ↓
[開発者] 必要なDNSレコード情報を共有
    ↓
[ドメイン管理者] DNSレコードを追加
    ↓
[ドメイン管理者] 追加完了を連絡
    ↓
[開発者] Resendで認証ステータス確認
    ↓
[開発者] アプリの送信元アドレスを更新
    ↓
[両者] テストメール送信で確認
```

---

## 💡 補足: Resendアカウントについて

Resendアカウントを持っていない場合：

1. [resend.com](https://resend.com) でアカウント作成（無料プランあり）
2. 無料プランの制限：
   - 月100通まで
   - 1日3,000通まで（有料プラン）

すでにアカウントがある場合は、そのアカウントでドメインを追加します。

---

## 📝 作業完了後のアプリ側の変更

ドメイン認証が完了したら、開発者側で以下の変更を行います：

```typescript
// 変更前（現在）
from: 'onboarding@resend.dev'

// 変更後
from: 'noreply@shinsei-raku.com'
// または
from: '申請らくらく君 <noreply@shinsei-raku.com>'
```

---

**質問や不明点があれば、お気軽にお聞きください！**
