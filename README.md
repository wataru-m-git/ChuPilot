# Mouse Colony App - Docker版セットアップガイド

マウスコロニー管理アプリケーションのDocker化版です。このガイドに従って、簡単にアプリケーションを起動できます。

## システム要件

- Docker Desktop または Docker + Docker Compose
- ウェブブラウザ（Chrome、Firefox、Safariなど）

## クイックスタート

### 1. Dockerコンテナの起動

プロジェクトルートで以下のコマンドを実行します：

```bash
docker compose up
```

初回実行時は、イメージのビルドと依存関係のインストールが行われるため、数分かかります。

**出力例：**
```
mouse-colony-app  | ▲ Next.js 14.2.5
mouse-colony-app  | - Local:        http://localhost:3333
mouse-colony-app  | - Environment: production
```

### 2. ブラウザでアクセス

以下のURLをブラウザで開きます：

```
http://localhost:3333
```

### 3. ログイン

初期アカウントでログインします：

- **ユーザー名**: admin@local.lab
- **パスワード**: admin1234

ログイン後、パスワードの変更をお願いします。

## よく使うコマンド

### アプリケーションの起動（バックグラウンド）
```bash
docker compose up -d
```

### ログの確認
```bash
docker compose logs -f
```

### アプリケーションの停止
```bash
docker compose down
```

### コンテナの再ビルド（コードを変更した場合）
```bash
docker compose up --build
```

### データベースへのアクセス（Prisma Studio）

コンテナ内でPrisma Studioを起動する場合：
```bash
docker compose exec app npx prisma studio
```

## ディレクトリ構成

```
.
├── Dockerfile              # Dockerイメージ定義
├── docker-compose.yml      # Docker Compose設定
├── .dockerignore          # Docker ビルド時に除外するファイル
├── package.json           # Node.js依存関係
├── src/                   # アプリケーションコード
├── prisma/                # Prismaスキーマ・マイグレーション
├── data/                  # SQLiteデータベース（永続化ボリューム）
└── public/                # 静的ファイル
```

## 主な機能

- **マウス管理**: 個体情報の登録・編集・削除
- **ケージ管理**: 飼育ケージの管理
- **系統管理**: マウスの系統分類
- **Excel インポート**: 一括登録機能
- **統計ダッシュボード**: 飼育状況の可視化

## トラブルシューティング

### ポート3333が既に使用中の場合

`docker-compose.yml` の `ports` セクションを編集します：

```yaml
ports:
  - "8080:3333"  # 外側のポートを8080に変更
```

その後、ブラウザで `http://localhost:8080` にアクセスします。

### データベースエラーが出た場合

```bash
# コンテナを削除して再起動
docker compose down -v
docker compose up
```

### ビルドエラーが出た場合

```bash
# キャッシュをクリアして再ビルド
docker compose down
docker system prune -a
docker compose up --build
```

## データベースのバックアップ

`data/mouse_colony.db` ファイルが永続化ボリュームとして保存されています。

### ホスト機から直接バックアップ

```bash
cp data/mouse_colony.db data/backup_$(date +%Y%m%d).db
```

## 開発時の注意

- コード変更後は `docker compose up --build` で再ビルドしてください
- データベーススキーマを変更した場合は、Prismaマイグレーションを実行してください

## ライセンス

内部用アプリケーション

## サポート

問題が発生した場合は、ログを確認してください：

```bash
docker compose logs app
```
