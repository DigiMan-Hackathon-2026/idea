# 이상무（イ・サンム）· ココソウル（여기서울）

[한국어](README.md) | **日本語**

ソウルを移動する日本人が、**駅で乗る方向を確かめ、降りたあと近くのローカル体験を自分で始められる**ようにするモバイルウェブ・PWAです。
画面は日本語が基本で、韓国語にも切り替えられます。現地で見せる韓国語の文も一緒に表示します。

アイデア一覧の **1. 地下鉄案内サービス** にあたります。チームでは案内・クエスト・スタンプに分けて担当し、イ・サンムは **クエスト** の担当です。このフォルダのコードには3つの機能がすべて入っています。

## フォルダ

| パス | 内容 |
|---|---|
| [`kokoseoul/`](kokoseoul) | アプリ全体のコードです。イ・サンムの個人リポジトリ（非公開）の `main` を、git の履歴ごと移しました（コミット360件、2026-11-21〜24）。 |
| [`line-agent/`](line-agent) | LINE旅行秘書です。ココソウル `a855c50` から始め、LINE公式アカウントとAI電話予約を加えました。個人リポジトリの git の履歴ごと移しました（コミット43件、2026-11-25〜26）。 |
| [`kokoseoul/docs/PRD_v0.1.md`](kokoseoul/docs/PRD_v0.1.md) | プロダクト要件：対象、利用の流れ、デモの検収基準（韓国語） |
| [`kokoseoul/docs/TRD_v0.1.md`](kokoseoul/docs/TRD_v0.1.md) | 技術要件：構成、案内板の読み取り、データ・デプロイ（韓国語） |
| [`kokoseoul/docs/HANDOFF.md`](kokoseoul/docs/HANDOFF.md) | 現在の実装状況と引き継ぎ（韓国語） |

## デモ

非公開の Preview デプロイです。開けない場合は、イ・サンムにアクセス権を依頼してください。

- クエスト（ウェブ）: https://yeogiseoul-platform-preview-hjyvtena9-koko-seoul.vercel.app/quests
- クエスト（スマホ枠）: https://yeogiseoul-platform-preview-j8m5otr50-koko-seoul.vercel.app/mobile-preview

## 機能

### クエスト（イ・サンム担当）

| 画面 | できること |
|---|---|
| `/quests` | 目的・時間・エリアでクエストを探す。オフライン用に保存したクエストが一番上にまとまります。 |
| `/quests/nearby` | 駅の出口や、現在地から見つけた近くの駅から始まるクエスト |
| `/quests/courses` | 地下鉄の路線でつなぐコース6つ |
| `/quests/<クエスト>` | 出発する出口と路線、出口からの直線距離、定休日、手順ごとの説明、見せる韓国語カード、公式情報の確認日 |

- 詳細の「ここまでの行き方を調べる」を押すと、クエストの駅が降りる駅に入った状態で地下鉄案内が開きます。乗り換え駅では、出発駅から乗り換えが一番少ないホームを選びます。
- 今日（ソウル時間）が定休日なら赤く知らせます。祝日や臨時休業はわからないため、公式案内を確認するよう案内します。
- 「オフライン用に保存する」を押すと、出口・手順・韓国語カード・住所を端末に保存します。電波がないときに同じアドレスを開くと、その内容が表示されます。進行記録や位置情報は保存しません。
- カテゴリはグルメ、観光・文化体験、ビューティー、ショッピング、休憩・散歩、日常の中の新しい体験の6つです。ソースに登録された場所型クエストは30件です。そのうち出口の座標につながった場所が29件、出口が24か所です。
- クエストの内容は、公式の出典と確認日にもとづいて書きます。公開前の確認手順は [`CONTENT_VERIFICATION_v0.1.md`](kokoseoul/docs/CONTENT_VERIFICATION_v0.1.md) と [`quest-drafts/PUBLISHING.md`](kokoseoul/research/desk/quest-drafts/PUBLISHING.md) にあります（韓国語）。

### 地下鉄案内・スタンプ

- `/subway`: 1〜9号線の経路、乗り換え、次の停車駅、駅員に見せる韓国語の文、駅構内の案内。最後に選んだ移動情報はオフラインでも表示されます。
- `/subway/sign-camera`: ホームの案内板をカメラか写真で読み、乗る方向が合っているかを判定します。OCR は端末の中だけで処理します。
- `/station-album`: 駅名の由来を読み、その駅で位置の確認が通るとスタンプがもらえます。
- `/my`: 登録なしで進めたクエストの記録を見たり、消したりします。

## 技術スタック

Next.js 16（App Router）· React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 17 + PostGIS · Drizzle ORM · Tesseract.js（端末内 OCR）· NAVER 地図 · TMAP 徒歩経路 · Vitest · Playwright

## ローカルで動かす

Node 24.19 と pnpm 12.21 を使います。

```sh
cd idea/sangmu/kokoseoul
pnpm install --frozen-lockfile
cp .env.example .env.local   # 必要な値だけ入れます。キーはコミットしません。
pnpm dev                     # http://localhost:3000
```

- クエストの進行記録と周辺検索 API には PostgreSQL/PostGIS が必要です。ローカルの DB は [`compose.yaml`](kokoseoul/compose.yaml) で起動します。環境変数は [`.env.example`](kokoseoul/.env.example) と [`CONFIGURATION_SECRETS_v0.1.md`](kokoseoul/docs/CONFIGURATION_SECRETS_v0.1.md) を参考にしてください。
- チェック: `pnpm verify`（lint・型・単体テスト・ビルド・ドキュメント）、`pnpm test:e2e`（Playwright）

## クエストのコードの場所

| パス | 内容 |
|---|---|
| `src/app/quests/` | クエスト一覧、駅から探す、コース、詳細 |
| `src/components/visit-guide-page.tsx`, `quest-access-card.tsx` | 詳細画面と「地下鉄で行く」カード |
| `src/components/save-quest-offline.tsx`, `saved-quests.tsx` | オフライン保存ボタン、保存したクエストの一覧 |
| `src/modules/content/` | クエストのデータ、出口とのつながり、コース、定休日、オフライン保存の形式 |
| `public/quest-offline.html`, `public/sw.js` | 電波がないときのクエスト画面とサービスワーカー |
| `research/desk/quest-drafts/` | クエストの下書きと現地確認リスト |

## LINE旅行秘書（`line-agent/`）

日本人旅行者がLINE公式アカウントに「新村で2人、サムギョプサル。20時までに弘大」のように日本語で送ると、秘書が候補のお店と、席に着くべき時刻を計算して見せます。利用者が承認すると、AIが韓国語でお店に電話して予約を問い合わせ、結果をLINEで返します。最初のお店が合わない時間を提案したら、条件を保ったまま次のお店に電話します。

- 設計: [`line-agent/docs/LINE_AGENT_SPEC.md`](line-agent/docs/LINE_AGENT_SPEC.md)、進捗: [`line-agent/docs/LINE_AGENT_BUILD_PLAN.md`](line-agent/docs/LINE_AGENT_BUILD_PLAN.md)、実行: [`line-agent/docs/LINE_AGENT_RUNBOOK.md`](line-agent/docs/LINE_AGENT_RUNBOOK.md)（いずれも韓国語）
- テスト電話は同意したチームメンバーの番号にだけかけます。番号とキーはリポジトリにありません。

## このフォルダの更新

`kokoseoul/` と `line-agent/` は、それぞれ元のリポジトリから `pnpm idea:sync --push` で更新します。元の新しいコミットが日付そのままでこのリポジトリの履歴に続きます。直接直すと次の更新と混ざるので、直したいところがあればイ・サンムに知らせてください。この README は2つのフォルダの外にあるので、更新してもそのまま残ります。

現在の基準コミット: `kokoseoul/` `a855c50`（2026-11-24）、`line-agent/` `f77ba0f`（2026-11-26）
