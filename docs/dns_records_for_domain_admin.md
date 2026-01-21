# 【作業依頼】shinsei-raku.com DNS設定

**目的**: 申請らくらく君からメール（認証コード等）を送信できるようにする

---

## ✅ 追加するDNSレコード（3つ）

以下の3つのレコードをDNSに追加してください。

---

### 1️⃣ DKIMレコード（メール署名検証用）

| 項目 | 値 |
|------|-----|
| **タイプ** | `TXT` |
| **名前（ホスト）** | `resend._domainkey` |
| **値** | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCeva/RFNuEjEZ6xKU+KA9qXcTdUTSsrAnCszRVBe2Z9SO1BNerFmIJ5+Z7QHJ/gtMW2bdXR6Czq/yLsYWWvDzm11AlD3d38IHmLn+jNd/JEwRYa0Z2two5sw5hX0bJ9bKdNMLj8rsc15fclzC4ld8NZCH38Npppl9I7ZF5AqZlHQIDAQAB` |
| **TTL** | `Auto` または `3600` |

---

### 2️⃣ MXレコード（バウンスメール受信用）

| 項目 | 値 |
|------|-----|
| **タイプ** | `MX` |
| **名前（ホスト）** | `send` |
| **値** | `feedback-smtp.us-east-1.amazonses.com` |
| **優先度** | `10` |
| **TTL** | `Auto` または `3600` |

---

### 3️⃣ SPFレコード（なりすまし防止用）

| 項目 | 値 |
|------|-----|
| **タイプ** | `TXT` |
| **名前（ホスト）** | `send` |
| **値** | `v=spf1 include:amazonses.com ~all` |
| **TTL** | `Auto` または `3600` |

---

## 📋 DNS管理サービス別の設定手順

### Cloudflareの場合

1. Cloudflareダッシュボードにログイン
2. `shinsei-raku.com` を選択
3. 左メニューから **DNS** → **レコード** をクリック
4. **レコードを追加** ボタンをクリック
5. 上記3つのレコードをそれぞれ追加

**Cloudflare特有の注意点**:
- 「プロキシステータス」は **DNS のみ（灰色の雲）** にしてください
- TXTレコードの値は引用符（""）で囲まないでください

---

### お名前.comの場合

1. お名前.com Naviにログイン
2. **ドメイン設定** → **DNS設定/転送設定**
3. `shinsei-raku.com` を選択
4. **DNSレコード設定を利用する** → **設定する**
5. 上記3つのレコードをそれぞれ追加

---

### AWS Route 53の場合

1. AWS Management Consoleにログイン
2. Route 53 → **Hosted zones**
3. `shinsei-raku.com` を選択
4. **Create record** ボタンをクリック
5. 上記3つのレコードをそれぞれ追加

---

## ⚠️ 注意事項

1. **値は正確にコピー＆ペースト**してください（特にDKIMの長い値）
2. **名前（ホスト）欄の入力方法**:
   - Cloudflare: `resend._domainkey` （ドメイン部分は自動補完）
   - お名前.com: `resend._domainkey` または `resend._domainkey.shinsei-raku.com`
   - AWS Route 53: `resend._domainkey.shinsei-raku.com`
3. DNS反映には**数分〜最大48時間**かかる場合があります（通常は数分）

---

## ✅ 設定完了後

**「DNS設定完了しました」とご連絡ください。**

認証ステータスを確認し、問題なければメール送信機能を有効化します。

---

## 🔍 確認用コマンド（任意）

設定後、以下のコマンドで確認できます：

```bash
# DKIMレコード確認
dig TXT resend._domainkey.shinsei-raku.com

# SPFレコード確認
dig TXT send.shinsei-raku.com

# MXレコード確認
dig MX send.shinsei-raku.com
```

---

**質問があればお気軽にどうぞ！**
