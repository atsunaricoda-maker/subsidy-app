# 助成金申請管理システム (Subsidy Manager)

## プロジェクト概要

助成金申請業務のDX化を実現するWebアプリケーションです。顧客とのやり取りを一元管理し、書類提出をオンライン化することで、業務効率を大幅に向上させます。

## 🎯 主な機能

### 管理者側機能
- **顧客管理**: 全顧客の一覧表示と詳細情報管理
- **進捗管理**: 5段階のステータス管理（見込み → 相談中 → 書類準備中 → 申請中 → 完了）
- **ダッシュボード**: ステータス別の集計表示
- **書類確認**: 顧客がアップロードした書類の確認・承認
- **やり取り記録**: チャット形式でのコミュニケーション履歴
- **フィルター・検索**: ステータスや顧客名での絞り込み

### 顧客側機能（顧客ポータル）
- **進捗確認**: 現在の申請状況をリアルタイムで確認
- **書類アップロード**: ドラッグ&ドロップで簡単にファイル提出
- **必要書類チェックリスト**: 何を提出すべきか一目で確認
- **やり取り**: 担当者とチャット形式でコミュニケーション
- **専用URL**: 個別のアクセストークンで簡単ログイン

## 🌐 公開URL

- **開発環境**: https://3000-iwrkztrt62csfqxhcj1f7-2e77fc33.sandbox.novita.ai

### アクセス方法

#### 管理者画面
```
https://3000-iwrkztrt62csfqxhcj1f7-2e77fc33.sandbox.novita.ai/
```

#### 顧客ポータル（テスト用）
```
https://3000-iwrkztrt62csfqxhcj1f7-2e77fc33.sandbox.novita.ai/portal/test-token-001
https://3000-iwrkztrt62csfqxhcj1f7-2e77fc33.sandbox.novita.ai/portal/test-token-002
https://3000-iwrkztrt62csfqxhcj1f7-2e77fc33.sandbox.novita.ai/portal/test-token-003
```

## 📊 データ構造

### データベーステーブル

#### clients（顧客テーブル）
- 顧客の基本情報（名前、会社名、連絡先）
- ステータス管理（inquiry, consulting, preparing, applying, completed）
- アクセストークン（顧客ポータル用）
- 担当スタッフ、メモ

#### documents（書類テーブル）
- 顧客ID（外部キー）
- 書類種別、ファイル名、パス
- アップロード者（client/staff）
- ステータス（pending, approved, rejected）

#### communications（やり取り記録テーブル）
- 顧客ID（外部キー）
- メッセージ内容
- 送信者情報（client/staff）
- 送信日時

#### document_checklist（必要書類テンプレート）
- 書類種別（登記簿謄本、決算書など）
- 説明文、表示順序

### ストレージサービス
- **Cloudflare D1**: SQLiteベースの分散データベース（顧客情報、メタデータ）
- **Cloudflare R2**: S3互換オブジェクトストレージ（書類ファイル保管）※今後実装予定

## 💻 技術スタック

- **フレームワーク**: Hono（軽量・高速なWebフレームワーク）
- **ランタイム**: Cloudflare Workers
- **データベース**: Cloudflare D1（SQLite）
- **フロントエンド**: TailwindCSS, Vanilla JavaScript
- **デプロイ**: Cloudflare Pages

## 🚀 開発環境セットアップ

### 前提条件
- Node.js 18以上
- npm

### インストール

```bash
# 依存関係のインストール
npm install

# データベースマイグレーション
npm run db:migrate:local

# テストデータ投入
npm run db:seed
```

### 開発サーバー起動

```bash
# ビルド
npm run build

# サーバー起動（PM2）
pm2 start ecosystem.config.cjs

# または直接起動
npm run dev:sandbox
```

### データベース操作

```bash
# マイグレーション適用
npm run db:migrate:local

# テストデータ投入
npm run db:seed

# データベースリセット
npm run db:reset

# SQLコンソール
npm run db:console:local
```

## 📝 使い方

### 管理者の操作手順

1. **新規顧客登録**
   - トップページの「新規顧客登録」ボタンをクリック
   - 顧客情報を入力して登録
   - 自動生成されたアクセストークンで顧客ポータルURLを発行

2. **進捗管理**
   - ダッシュボードで全体の進捗を確認
   - 顧客をクリックして詳細画面へ
   - ステータスを更新（編集機能は今後実装予定）

3. **やり取り**
   - 顧客詳細画面でチャット形式でコミュニケーション
   - 全履歴が自動保存される

4. **書類確認**
   - 顧客詳細画面で提出書類を確認
   - 承認・差し戻しステータスを更新（今後実装予定）

### 顧客の操作手順

1. **ポータルアクセス**
   - 管理者から送られた専用URLにアクセス

2. **進捗確認**
   - 現在の申請状況を確認

3. **書類アップロード**
   - 必要書類チェックリストを確認
   - 書類の種類を選択
   - ファイルをドラッグ&ドロップまたは選択してアップロード

4. **やり取り**
   - 担当者にメッセージを送信
   - 返信を確認

## 🎨 画面構成

### 管理者画面
- `/` - トップページ（顧客一覧・ダッシュボード）
- `/client/:id` - 顧客詳細ページ

### 顧客ポータル
- `/portal/:token` - 顧客専用ポータル

### API エンドポイント
- `GET /api/clients` - 顧客一覧取得
- `POST /api/clients` - 顧客新規登録
- `GET /api/clients/:id` - 顧客詳細取得
- `PUT /api/clients/:id` - 顧客情報更新
- `GET /api/clients/:id/documents` - 書類一覧取得
- `POST /api/clients/:id/documents` - 書類アップロード
- `GET /api/clients/:id/communications` - やり取り記録取得
- `POST /api/clients/:id/communications` - メッセージ送信
- `GET /api/document-checklist` - 必要書類一覧取得

## ✅ 実装済み機能

- ✅ 顧客管理（登録、一覧表示、詳細表示）
- ✅ 5段階ステータス管理
- ✅ ダッシュボード（ステータス別集計）
- ✅ フィルター・検索機能
- ✅ 書類メタデータ管理
- ✅ やり取り記録（チャット形式）
- ✅ 顧客ポータル（進捗確認、書類アップロードUI、やり取り）
- ✅ 必要書類チェックリスト
- ✅ レスポンシブデザイン

## 🔧 今後の実装予定

- ⬜ R2を使った実際のファイルアップロード機能
- ⬜ 書類の承認・差し戻し機能
- ⬜ 顧客情報編集モーダル
- ⬜ メール通知機能
- ⬜ 管理者認証機能
- ⬜ レポート・統計機能
- ⬜ ファイルプレビュー機能
- ⬜ 一括操作機能

## 🔒 セキュリティ

- 顧客ポータルは個別のアクセストークンで保護
- トークンはランダム生成され、推測困難
- 本番環境では必ずHTTPSを使用

## 📦 デプロイ

### Cloudflare Pagesへのデプロイ

```bash
# 本番デプロイ
npm run deploy:prod

# または手動デプロイ
npm run build
wrangler pages deploy dist --project-name subsidy-manager
```

### 環境変数設定

本番環境で必要な設定：
- D1データベースID
- R2バケット名（今後）

## 📄 ライセンス

このプロジェクトは内部使用を目的としています。

## 👥 開発者

- 開発: Claude Code Assistant
- 企画: atsunari

## 📞 サポート

質問や問題がある場合は、開発チームまでお問い合わせください。
