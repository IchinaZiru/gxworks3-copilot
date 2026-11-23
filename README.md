# GX Works3 × GitHub Copilot Computer Use

**CC-Link IE TSN構成のCSV連携・GUI設定を支援する、Windows向けオフライン検証プロジェクト**

本リポジトリは、構成チェックツールのJSONからGX Works3用の局一覧CSVを生成し、GitHub CopilotのComputer UseによるGUI操作を補助するためのプロトタイプです。日本語版CSP+からリンクデバイス点数を解析し、GX Works3の設定画面でRX・RY・RWr・RWwを設定する**AI001**も含みます。

> **重要：** 個人PCの特定のオフライン検証環境では主要な操作を確認していますが、**社内PCでは未検証**です。PLCへの接続・書込み、GX Works3の設定反映・適用、プロジェクト保存の自動化は対象外です。会社のルールに従い、許可された環境・データだけで使用してください。

## 目次

1. [機能一覧](#1-機能一覧)
2. [リポジトリ構成と同梱ファイル](#2-リポジトリ構成と同梱ファイル)
3. [社内PCでの初回セットアップ](#3-社内pcでの初回セットアップ)
4. [最初に行う読み取り専用テスト](#4-最初に行う読み取り専用テスト)
5. [AI001：CSP+に基づく点数設定](#5-ai001cspに基づく点数設定)
6. [JSONからGX Works3用CSVへの変換](#6-jsonからgx-works3用csvへの変換)
7. [CSVファイルダイアログの自動操作](#7-csvファイルダイアログの自動操作)
8. [一連の作業フロー](#8-一連の作業フロー)
9. [検証済み事項と未対応事項](#9-検証済み事項と未対応事項)
10. [よくある問題と対処](#10-よくある問題と対処)
11. [公開・データ管理上の注意](#11-公開データ管理上の注意)
12. [更新・参考資料](#12-更新参考資料)

## 1. 機能一覧

| 機能 | 場所 | 主な役割 |
| --- | --- | --- |
| **JSON → 局一覧CSV変換** | [gxworks3-import](.github/skills/gxworks3-import/SKILL.md) | 構成チェックツールのJSONをGX Works3のCSVへ変換。テンプレートを保持したoverlayモードに対応 |
| **CSVダイアログ補助** | [gxworks3-file-dialog](.github/skills/gxworks3-file-dialog/SKILL.md) | GX Works3の「インポート／エクスポート」画面でファイル名入力・選択を補助 |
| **AI001 点数設定** | [gxworks3-ai001](.github/skills/gxworks3-ai001/SKILL.md) | CSP+の初期値・最小値・最大値を参照し、Computer UseでRX／RY／RWr／RWwを設定 |
| **CSP+解析** | [parse_cspp_point_counts.ps1](input/cspp/parse_cspp_point_counts.ps1) | 日本語版CC-Link IE TSN CSP+から4項目×3区分を解析し、JSONへ出力 |

3つのSkillは**Copilotに操作手順を伝えるファイル**であり、単体でGX Works3のGUI操作を実行するプログラムではありません。GUI操作には対応するCopilot Computer Use環境が必要です。

## 2. リポジトリ構成と同梱ファイル

```text
gxworks3-copilot/
├─ .github/
│  └─ skills/
│     ├─ gxworks3-import/
│     │  ├─ SKILL.md
│     │  ├─ agents/openai.yaml
│     │  ├─ references/
│     │  │  ├─ mapping.md
│     │  │  └─ gui-workflow.md
│     │  └─ scripts/
│     │     ├─ convert.js
│     │     ├─ patch_core.js
│     │     └─ reverse_core.js
│     ├─ gxworks3-file-dialog/
│     │  ├─ SKILL.md
│     │  ├─ agents/openai.yaml
│     │  ├─ references/windows-workflow.md
│     │  └─ scripts/
│     │     ├─ file_dialog.ahk
│     │     └─ watch_dialog.js
│     └─ gxworks3-ai001/
│        ├─ SKILL.md
│        └─ agents/openai.yaml
├─ input/
│  └─ cspp/
│     ├─ 0x0000_NZ2GNS12A2-14DT_1_ja.CSPP.zip
│     ├─ nz2gns12a2-14dt-ai001-point-counts.json
│     └─ parse_cspp_point_counts.ps1
├─ tools/
│  └─ gx-file-dialog.exe
├─ .gitignore
└─ README.md
```

以下は**GitHubには含まれていないため、利用するPCごとに準備**します。

| パス | 目的 | 準備方法 |
| --- | --- | --- |
| `output/` | 変換済みCSV、エクスポートCSV、操作ログ | ローカルで作成 |
| `input/flowchart.json` | 構成チェックツールから出力したJSON | 使用者が用意 |
| `input/gx_template.csv` | GX Works3でエクスポートした局一覧CSV | オフライン検証用プロジェクトから取得 |
| GX Works3検証用プロジェクト | マスタユニット／局構成を含むテスト環境 | 人間がGX Works3上で準備 |

`output/`、ルート直下の`input/*.json`・`input/*.csv`などは`.gitignore`の対象です。解析済みCSP+ JSONは`input/cspp/`内にあり、リポジトリに同梱されています。

## 3. 社内PCでの初回セットアップ

### 3.1 必要な環境

- **Windows 10／11**
- **GX Works3**（オフラインのコピー／検証用プロジェクト）
- **Visual Studio Code**、GitHub Copilotを利用できるアカウント
- **CopilotのローカルAgent + Computer Use**（GUI自動操作を行う場合）
- **Node.js**（JSON→CSV変換とファイルダイアログ補助に必要。追加のnpmパッケージは不要）
- **Windows PowerShell**（CSP+の再解析時に使用）
- **`tools/gx-file-dialog.exe`**（CSVファイル選択を自動化する場合）

既存のコンパイル済みEXEを動かすだけならAutoHotkeyのインストールは不要です。ソースの`.ahk`をEXEに再ビルドする場合のみ**AutoHotkey v2 + Ahk2Exe**を使用します。

> 組織のポリシーにより、GitHub、Copilot Computer Use、外部EXE、追加ソフトの実行が制限される場合があります。許可されない操作を回避しないでください。

### 3.2 GitHubから取得して開く

1. <https://github.com/IchinaZiru/gxworks3-copilot> を開く。
2. **Code → Download ZIP**でZIPをダウンロード。
3. ZIPを**展開**する（ZIPの中身を直接編集しない）。
4. VS Codeの「フォルダーを開く」で、展開した`gxworks3-copilot-main`フォルダ**全体**を開く。
5. VS CodeのPowerShellターミナルで、ワークスペースのルートから次を実行。

```powershell
New-Item -ItemType Directory -Force -Path input, output | Out-Null
node --version
```

`node --version`でバージョンが表示されれば利用できます。コマンドが見つからない場合は、社内で許可されているNode.js導入手順を確認してください。

Gitが使えるPCでは、ZIPの代わりに以下でも取得できます。

```powershell
git clone https://github.com/IchinaZiru/gxworks3-copilot.git
cd gxworks3-copilot
New-Item -ItemType Directory -Force -Path input, output | Out-Null
```

### 3.3 Copilot Computer Useの準備

1. VS CodeでGitHub Copilotにサインイン。
2. 設定に`chat.agentHost.computerUse.enabled`がある環境では有効化し、必要に応じてVS Codeを再起動。
3. **ローカルAgent**で新しいCopilot Chatを開く。
4. 対応環境ではチャットから次を実行し、権限確認を行う。

```text
/computer on
```

バージョン・組織設定によって操作や機能の提供状況が異なります。Computer Useを利用できなければGUI操作は行わず、CLIの確認に限定してください。

### 3.4 3つのSkillを認識できるか確認する

Copilot Chatへ入力：

```text
このワークスペースの .github/skills/ にある
「gxworks3-import」「gxworks3-file-dialog」「gxworks3-ai001」
のSKILL.mdを読み、各機能・前提条件・禁止操作を説明してください。
今回はファイル編集とGX Works3操作をしないでください。
```

Skillが見えない場合は、`.github/skills/<skill名>/SKILL.md`の構成を維持したうえで、VS Codeで開いたフォルダがリポジトリのルートかを確認します。

## 4. 最初に行う読み取り専用テスト

**初回は設定値を書き換えず、CopilotがGX Works3を観察できるか確認します。**

1. 人間がGX Works3でオフラインの検証用プロジェクトを開く。
2. 人間がマスタユニットなどの必要な構成を事前に準備し、**「CC-Link IE TSN構成」**画面を開く。
3. AI001を検証する場合、局番3に**`NZ2GNS12A2-14DT`**が存在する状態にする。
4. Copilotに次を送る。

```text
gxworks3-ai001 のSKILL.mdを読んでください。
社内PCでの初回動作確認なので、GX Works3に対して読み取り専用で実行してください。
「CC-Link IE TSN構成」の画面を確認し、必要ならComputer Useで最大化し、
局番3・NZ2GNS12A2-14DTのRX／RY／RWr／RWwの点数と
各開始・終了アドレス、警告の有無を報告してください。
値の入力、設定反映、適用、保存、PLC書込みは禁止します。
```

構成画面が小さければ**アクセシビリティ上の「最大化」ボタンを優先**します。最大化後に4項目の点数列がすべて見える場合、横スクロールしません。局番や機種が異なる場合は変更せず停止します。

## 5. AI001：CSP+に基づく点数設定

### 5.1 CSP+から抽出済みの値

対象：**局番3／`NZ2GNS12A2-14DT`／日本語版CC-Link IE TSN CSP+**

| 項目 | 初期値 `initial` | 最小値 `minimum` | 最大値 `maximum` | 単位 |
| --- | ---: | ---: | ---: | --- |
| RX | 16 | 0 | 16 | bit |
| RY | 16 | 0 | 16 | bit |
| RWr | 20 | 0 | 20 | word |
| RWw | 20 | 0 | 20 | word |

使用ファイル：[`input/cspp/nz2gns12a2-14dt-ai001-point-counts.json`](input/cspp/nz2gns12a2-14dt-ai001-point-counts.json)

通常は**CSP+ ZIPを毎回読み直さず、解析・検証済みJSONを読みます**。JSONが無効な場合などに限り、別の出力先へ再解析します。`(CCIEF)`のプロファイルは使用しません。

### 5.2 操作フローと承認

1. 人間がオフライン検証用GX Works3プロジェクトと構成画面を準備。
2. Copilotに、**局番・機種・設定区分（`initial`／`minimum`／`maximum`）・対象項目**を指定する。対象項目を省略した場合は4項目すべて。
3. Copilotが解析済みJSON、GUIの現在点数、開始・終了アドレスを読み取る。
4. **変更計画を提示し、ユーザーの明示的な承認を待つ。**
5. 承認後、必要な点数セルだけを1つずつ入力し、値とアドレスを再確認する。
6. **既知の点数補正ダイアログ**だけは、条件に合致すれば追加承認なしで「はい」を1回押す。
7. 最終値、補正有無、アドレス変化、警告・未完了項目をまとめて報告し、**構成画面を開いたまま停止する**。

初期値への設定を依頼する例：

```text
gxworks3-ai001 のSKILL.mdに従って、オフライン検証用GX Works3の
局番3「NZ2GNS12A2-14DT」のRX・RY・RWr・RWwを
CSP+のinitial（初期値）に設定したいです。
まず現在値と変更計画を提示し、私が明示的に承認するまでは入力しないでください。
設定反映・適用・保存・PLC書込みは行わないでください。
```

RXだけを最小値にする例：

```text
gxworks3-ai001 を使い、局番3「NZ2GNS12A2-14DT」の
RXのみをminimum（最小値）に設定する計画を提示してください。
RY・RWr・RWwは読み取りと検証のみ行い、入力しないでください。
承認待ちで停止してください。
```

### 5.3 自動補正ダイアログの扱い

CSP+に書かれた最小値`0`がGX Works3のGUIで受け付けられるとは限りません。個人PCで、`0`の入力時に以下の**既知の警告**が出ることを確認しています。

```text
点数の設定値が範囲外です。入力されたデータを 16 に変更します。
```

Copilotは**事前承認済みの局・点数セル**について、既知の警告文と明確な非負整数の補正値が確認でき、他の操作を要求していない場合に限り、「はい」を1回押します。押した後は、4項目すべての点数と全アドレスを読み戻します。**未知の警告・対象外項目の変更・予期しないアドレス変更がある場合は停止**します。

個人PCでの4項目`minimum`テスト結果：

| 項目 | 変更前 | CSP+指定値 | GX Works3の最終表示値 | 結果 |
| --- | ---: | ---: | ---: | --- |
| RX | 16 | 0 | **16** | 補正あり・変更なし |
| RY | 16 | 0 | **16** | 補正あり・変更なし |
| RWr | 20 | 0 | **4** | 補正あり・20→4 |
| RWw | 20 | 0 | **4** | 補正あり・20→4 |

RWr／RWwの開始アドレスは`0020`のままで、終了アドレスが`0033`→`0023`になりました。その後の`initial`テストでは、RWr／RWwを`4`→`20`に戻す操作も確認しています。

**注意：GX Works3が16／4に補正したことと、16／4が厳密な「設定可能な最小値」であることは別です。** 後者は検証していないため、報告では「CSP+の0を指定した結果、GX Works3が16／4へ補正した」と記載します。

### 5.4 CSP+ JSONを再生成する場合

通常の利用では不要です。必要な場合のみ、元ファイルとは**別名**で出力してください。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File input/cspp/parse_cspp_point_counts.ps1 -ArchivePath input/cspp/0x0000_NZ2GNS12A2-14DT_1_ja.CSPP.zip -OutputPath output/ai001_point_counts_recheck.json -Model NZ2GNS12A2-14DT
```

## 6. JSONからGX Works3用CSVへの変換

### 6.1 必要な入力

- `input/flowchart.json`：構成チェックツールが出力したJSON（`nodes`、`edges`、`communicationMode`など）。**GitHubには含まれません**。
- `input/gx_template.csv`：コピーしたGX Works3検証用プロジェクトからエクスポートした局一覧CSV。**GitHubには含まれません**。

変換前に、JSONの機種・局番・設定値とCSVの対象プロジェクトが一致することを確認してください。元の構成チェックツール本体はこのリポジトリには含まれません。

### 6.2 推奨：overlayモード

```powershell
node .github/skills/gxworks3-import/scripts/convert.js --json input/flowchart.json --template input/gx_template.csv --out output/station_list_overlay.csv
```

**overlayモード**は、入力JSONに含まれる項目を更新しつつ、JSONにないGX Works3固有の既存列をCSVテンプレートから保持する方式です。出力は**UTF-16LE BOM／タブ区切り／39列**の局一覧CSVです。

主な対応例：局番、機種名、局種別、Class、RX／RY／RWr／RWw点数、`cycleSetting`（`BASIC`／`MID`／`LOW`）、JSONに存在する追加項目。通信周期は関連する2列の整合にも配慮しています。

**対象外：** `edges`の物理配線、ポート接続、`speed`、マスタの周期時間（µs）など。CSVのみでGUI上の全設定を再現できるわけではありません。

ファイルが既に存在する場合は上書きされません。**新しい出力名**を使用してください。`--force`は内容を確認した場合にのみ指定します。

### 6.3 sparseモード（注意）

```powershell
node .github/skills/gxworks3-import/scripts/convert.js --json input/flowchart.json --out output/station_list_sparse.csv
```

`--template`なしでは、JSONで指定されない列が空白になり、GX Works3でのインポート時に値がリセットされる可能性があります。**通常はoverlayを推奨**します。

### 6.4 Copilot経由でのGUIインポート

```text
gxworks3-import のSKILL.mdとreferences/gui-workflow.mdを読み、
input/flowchart.jsonとinput/gx_template.csvからoverlay CSVを生成してください。
出力CSVの39列、変更差分、警告を報告し、
GX Works3へのインポート前に対象プロジェクトとファイルを明示して承認待ちで停止してください。
オフラインの検証用プロジェクト以外には操作しないでください。
```

承認後にインポートしても、**ファイル選択完了は設定が受け入れられた証拠ではありません**。GX Works3の警告と各局の表示値を確認し、必要に応じて再エクスポートしてCSV差分を検証します。

## 7. CSVファイルダイアログの自動操作

対象Skill：[`gxworks3-file-dialog`](.github/skills/gxworks3-file-dialog/SKILL.md)

GX Works3の日本語CSVダイアログ「インポート」「エクスポート」のみを操作する、**AutoHotkey v2で作成したWindows用EXE**とNode.jsランチャーを利用します。対象ウィンドウのタイトル、クラス`#32770`、GX Works3プロセスを照合します。

### 7.1 まずGUIを触らない確認

```powershell
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js export output/ahk_first_test.csv fill --dry-run
```

`DRY-RUN: Path validation succeeded.`が出れば、ファイルパスとEXEの存在確認ができています。**EXEもGUIも起動しません**。なお、EXEの社内PCでの実行成功までは意味しません。

### 7.2 3つの操作

| アクション | 動作 | 成功時の状態 |
| --- | --- | --- |
| `probe` | 正しいCSVダイアログを検出するだけ | `STATUS=PROBED` |
| `fill` | ファイル名欄へCSVパスを入力するだけ | `STATUS=FILLED` |
| `submit` | CSVパスを確認してEnterを1回押す | エクスポート：`STATUS=SAVED`／インポート：`STATUS=FILE_SELECTED` |

すべて**ワークスペースの`output/`内のCSVパス**を使用します。エクスポート先は未作成のファイル名にしてください。インポート元は既に存在している必要があります。

### 7.3 安全な確認手順

1. GX Works3を**1インスタンス**だけ起動して、オフライン検証用プロジェクトを開く。
2. `probe`を起動してから、GX Works3の「局一覧をエクスポート」ダイアログをComputer Useまたは人間が開く。
3. 状態ファイルに`STATUS=PROBED`が出たことを確認する。
4. Computer Useの操作が完了してから`fill`を実行し、入力欄を確認。テストでは人間がキャンセルする。
5. ダイアログを開き直した後、承認・確認済みの新しい出力名で`submit`を実行する。

```powershell
# 事前に監視を開始し、その後GX Works3で「局一覧をエクスポート」を開く
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js export output/ahk_first_test.csv probe

# ダイアログを開いたまま、Computer Useの操作が完了してから実行
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js export output/ahk_first_test.csv fill

# ダイアログを再度開き、新しい出力先で実行
node .github/skills/gxworks3-file-dialog/scripts/watch_dialog.js export output/ahk_export_test_01.csv submit
```

各操作結果は`output/gx_dialog_*.status.txt`に保存されます。最新の状態を表示：

```powershell
$last = Get-ChildItem output -Filter 'gx_dialog_*.status.txt' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($last) { Get-Content $last.FullName }
```

**`probe`のみ**Computer Useがダイアログを開く操作と並行できます。`fill`・`submit`中は、Computer Useで同じダイアログを操作させないでください。75秒経っても完了しない場合、二重起動・二重入力せず、状態ファイルと画面を確認します。

**インポートの`submit`は、ユーザーの明示的承認後のみ**実行します。`STATUS=FILE_SELECTED`はCSVの選択完了であり、GX Works3が局設定を受け入れたことを意味しません。

詳細：[`windows-workflow.md`](.github/skills/gxworks3-file-dialog/references/windows-workflow.md)

## 8. 一連の作業フロー

1. **人間**がGX Works3のオフライン検証用プロジェクトとマスタユニットを準備する。
2. GX Works3から**局一覧CSV**をエクスポートし、`input/gx_template.csv`へ配置する。
3. 構成チェックツールからJSONを出力し、`input/flowchart.json`へ配置する。
4. `gxworks3-import`で**overlay CSV**を生成し、差分・警告・39列を確認する。
5. 対象プロジェクト・CSVを明示し、**ユーザーの承認後**にGX Works3へインポートする。
6. 必要であれば`gxworks3-file-dialog`でCSVファイル選択を補助する。
7. GX Works3の局番号、機種、設定値、警告を確認する。
8. 必要に応じて`gxworks3-ai001`で局番3のリンクデバイス点数を設定する（**GUI入力前に別途承認**）。
9. 最終値・補正内容・アドレス変化・未完了項目を報告して**停止**する。

**「設定を反映して閉じる」「設定を破棄して閉じる」「適用」「プロジェクト保存」「PLC書込み」は、この自動化の実行範囲外**です。

## 9. 検証済み事項と未対応事項

### 個人PCの検証用環境で確認済み

- JSON→局一覧CSV変換と、39列・UTF-16LE BOM・差分の確認。
- `cycleSetting`の変更を通信周期に関係する2列へ反映する修正。
- ファイルダイアログ補助の`probe`・`fill`・`submit`。
- AI001での自動最大化、局番3の認識、4項目の読み取り、個別設定／一括設定。
- 既知のGX Works3点数補正ダイアログの「はい」自動クリックと、点数・アドレスの読み戻し。
- 最小値指定でRWr／RWwが20→4へ補正され、初期値指定で4→20へ戻ること。

### まだ検証・実装していないこと

- **社内PC**でのComputer Use動作、EXE実行、GX Works3連携。
- 複数局・別機種に対応する汎用AI001。
- 異なるGX Works3のバージョン／表示言語での互換性。
- 全種類のダイアログやタイムアウトからの完全自律復旧。
- **AI002**：通信周期間隔・サイクリック伝送時間のGUI設定。
- **AI003**：ユニキャスト・マルチキャストのGUI設定。
- GX Works3への設定反映、プロジェクト保存、PLC書込みの自動化。

## 10. よくある問題と対処

| 状況 | 対処 |
| --- | --- |
| `node`コマンドが見つからない | Node.jsの有無、PATH、社内での導入許可を確認 |
| Skillが見つからない | ZIPを展開したか、リポジトリの**ルート**をVS Codeで開いたか確認 |
| Computer Useが使えない | ローカルAgent、権限、設定、VS Code再起動を確認。使えなければCLI確認のみ実施 |
| `output/`がない | `New-Item -ItemType Directory -Force -Path output` |
| `input/flowchart.json`がない | 同梱されていないため、構成チェックツールから出力して配置 |
| `input/gx_template.csv`がない | 検証用GX Works3から局一覧CSVをエクスポートして配置 |
| 出力CSVが既に存在する | 新しい出力ファイル名に変更。元データを上書きしない |
| EXEがブロックされる | 社内PCの実行許可を確認し、組織の制限を回避しない |
| `STATUS=WAITING` / `STATUS=ERROR` | GX Works3の起動数、ダイアログ名、ステータスの`DETAILS=`／`DIAGNOSTICS=`を確認 |
| Computer Useがタイムアウトした | **操作が済んでいる可能性がある**ため、再実行前に画面・状態を確認 |
| 点数が自動補正された | CSP+指定値とGX補正値を区別して報告。未知の警告では停止 |
| インポート後の設定が想定と異なる | GX Works3で警告を確認し、必要に応じて再エクスポートして差分を検証 |

## 11. 公開・データ管理上の注意

このリポジトリは**Public公開されている状態が確認されています**。実設備の構成、社内IPアドレス、社内仕様書、GX Works3プロジェクト、認証情報、実機スクリーンショットなどを無許可で登録しないでください。

また、現状同梱している**CSP+ ZIP、コンパイル済みEXE、インターン成果物**についても、第三者への再配布や社内PCへの持ち込みが許可されているかを確認してください。許可が確認できない場合、Public公開を継続しない判断が安全です。**Privateに変更するだけで社外持ち出しが自動的に許可されるわけではありません。**

実機に接続した状態や本番プロジェクトには、この検証用GUI操作を適用しないでください。

## 12. 更新・参考資料

### リポジトリの更新

ZIP取得の場合はGitHubの更新が自動反映されません。最新のZIPを再取得して展開してください。

`git clone`した場合は、変更状況を確認してから更新します。

```powershell
git status
git pull --ff-only
```

GitHub上でREADMEを直接編集した後、個人PCのリポジトリからさらにPushする場合は、まずローカルへ取り込んでください。未コミットの変更や競合がないことを確認してから操作します。

```powershell
git status
git pull --rebase origin main
```

### 詳しい仕様

- [JSON→CSVの対応列・変換仕様](.github/skills/gxworks3-import/references/mapping.md)
- [GX Works3の局一覧インポート手順](.github/skills/gxworks3-import/references/gui-workflow.md)
- [ファイルダイアログ操作の詳細](.github/skills/gxworks3-file-dialog/references/windows-workflow.md)
- [AI001の最新手順](.github/skills/gxworks3-ai001/SKILL.md)
- [CSP+解析済みJSON](input/cspp/nz2gns12a2-14dt-ai001-point-counts.json)

**社内PCでの推奨確認順：** ZIPの取得・展開 → VS Codeで3つのSkillを確認 → Node.jsとEXEの`--dry-run` → GX Works3の読み取り専用Computer Use → JSON・CSV変換 → 承認のうえでGUI入力／インポートを検証。
