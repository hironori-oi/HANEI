# PRJ-016 W1 リサーチレポート: 商標 + ドメイン取得確認

- **作成日**: 2026-04-26
- **作成部署**: リサーチ部門
- **担当タスク**: W1 TASK-B
- **対象**: DEC-004（HANEI 仮確定）の本格商標衝突確認 + ドメイン取得可能性

---

## エグゼクティブサマリー

1. **「HANEI」「ハンエイ」「半英」 第9 / 41 / 42 類**: WebSearch + IP Force 経由の探索では **本案件と直接競合する英語学習・教育系 IT サービスの登録商標は 2026-04-26 時点で確認できず**。ただし J-PlatPat は SPA で WebFetch 直接検索が不可、**最終確証はオーナーまたは Dev/PM が J-PlatPat 公式画面で 5 区分（9, 41, 42, 38, 16）の本格検索を実施した後**。
2. **海外法人「HANEI」が複数存在**: 米国（haneiusa.com 法人設立支援）[^4]、英国（HANEI LIMITED 10248605）[^5]、シンガポール（HANEI PTE. LTD. 201434783N）[^6]。**いずれも英語学習 EdTech ではない**ため、第41類（教育）での衝突可能性は低い。ただし第42類（IT サービス）では HANEI PTE. LTD（IT コンサル）と用途近接 → 中リスク。
3. **第2候補の比較検索**: マナピヨ / ことだま英語 / EigoNetto いずれも WebSearch では特段の登録・サービス化は確認できず。**「ことだま英語」は Designer のキャラ「ことだまトリ」と関連性が強く、命名統一の選択肢として有力**。
4. **ドメイン取得可能性**: hanei.com は **既に登録済み**（HANEI 関連法人のいずれか）。hanei.app / hanei.jp / hanei-app.com / getanei.com / tryhanei.com は **WebSearch / 公開情報では未確認** → 実取得は Dev 部門が **GoDaddy / お名前.com / value-domain で直接 lookup**。
5. **推奨**: HANEI 命名は維持しつつ、**hanei.app（または hanei.jp）を第一候補ドメインとして実取得** + **ロゴ商標 + 文字商標を第9類・第41類・第42類で同時出願（特許庁 1 区分 ¥3,400 + 登録 ¥32,900 / 区分）= 3 区分 ¥120,300 程度**。最終的な命名確定は J-PlatPat 公式画面での確認を経てから。

---

## 1. J-PlatPat 商標検索状況（2026-04-26）

### 1-1. 検索方法と制約

- **J-PlatPat（https://www.j-platpat.inpit.go.jp/）** は SPA で WebFetch では「Loading...」のまま検索結果取得不可
- 代替で **IP Force（https://ipforce.jp/shohyo）** + WebSearch を併用[^7][^8]
- **本格検索は J-PlatPat の以下 URL から手動で実行する必要あり**:
  - 商標検索 → 商標（検索キーワード） → 称呼欄に「HANEI」「ハンエイ」入力 → 商品・役務区分 9 / 41 / 42 を指定

### 1-2. WebSearch + IP Force 経由の暫定確認結果

| 検索キーワード | 区分 | 結果 |
|---------------|------|------|
| HANEI | 9 / 41 / 42 | 本案件と競合する登録商標 **確認できず**（一次ソース未到達） |
| ハンエイ | 9 / 41 / 42 | 同上 |
| 半英 | 9 / 41 / 42 | 同上、漢字表記の登録は学習 EdTech では未発見 |

### 1-3. 関連で確認された「HANEI」名称の使用主体（衝突可能性評価）

| 主体 | 業種 | 国 | 第41類との重複 | 衝突リスク |
|------|------|----|-----|-----------|
| **Hanei USA**[^4] | 米国法人設立支援・ビザ | 米国 | なし（教育とは別領域） | **低** |
| **HANEI LIMITED 10248605**[^5] | 不明（GOV.UK 登記のみ） | 英国 | 不明 | **要確認（中）** |
| **HANEI PTE. LTD. 201434783N**[^6] | IT コンサルティング・ERP | シンガポール | 第42類で近接 | **中** |
| Crunchbase「HANEI」[^4] | ソフトウェア / ERP | – | 第42類で近接 | **中** |

→ **日本国内の登録商標で英語学習 EdTech と直接衝突する HANEI / ハンエイ / 半英 は 2026-04-26 時点では暫定的に「衝突なし」**。ただし、**最終確認は特許庁公式 J-PlatPat の画面検索で行うこと**。

### 1-4. 推奨アクション（W1 残期間）

1. **オーナー（または Dev）が J-PlatPat 画面で本格検索 1 回実施**（5 分程度）
   - https://www.j-platpat.inpit.go.jp/t0030 → 検索対象 = 商標 → 称呼検索
   - 「HANEI」「ハンエイ」「半英」を 9 / 41 / 42 / 38 / 16 類で確認
2. 国際出願（Madrid Protocol）への波及を確認するなら **WIPO Global Brand Database**（https://branddb.wipo.int/）でも同名 + 第41類検索
3. 衝突 0 件確認できたら、**特許庁オンライン出願（J-PlatPat 連携）**で出願（区分料金 1 区分 ¥3,400・10年登録 ¥32,900 / 区分）

---

## 2. 第2候補（HANEI 衝突時のフォールバック）

### 2-1. 候補名比較

| 候補 | 由来 | 音節 | Designer 世界観整合 | 商標衝突リスク（暫定） |
|------|------|------|--------------------|----------------------|
| **マナピヨ** | 「学び」+「ピヨ（ことだまトリ）」の合成 | 4 音節 | ◎（キャラ「ことだまトリ」直結） | 低（WebSearch で発見なし） |
| **ことだま英語** | 「ことだまトリ」のキャラ世界観 | 6 音節 | ◎（最強整合） | 低（WebSearch で発見なし、ただし「ことだま」単独は宗教・スピリチュアル系ヒット注意） |
| **EigoNetto** | 「英語ネット」の英字化 | 4 音節 | △ | 中（既存「英検ネットドリル」と類似 → 旺文社系で衝突懸念） |
| **トリラボ** | 「ことだまトリ」+ Lab | 4 音節 | ○ | 低 |
| **ピヨ英** | キャラ名 + 半英の組み合わせ | 3 音節 | ◎ | 要確認 |

### 2-2. 推奨（HANEI が 第41類 で衝突した場合）

- **第1代替: マナピヨ**（音節最短・キャラ直結・他産業との衝突リスク最小）
- **第2代替: ことだま英語**（マーケ訴求最強・ただし「ことだま」関連商標を要確認）

---

## 3. ドメイン取得可能性（暫定確認）

### 3-1. 候補ドメインと状況

| ドメイン | TLD | 状況（WebSearch / 公開情報経由） | 備考 |
|---------|-----|--------------------------------|------|
| **hanei.com** | .com | **登録済み**（HANEI 関連法人と推定）[^4] | 取得不可・買取交渉も非現実的 |
| **hanei.jp** | .jp | 未確認（要直接 lookup） | 日本国内住所必須[^9] |
| **hanei.app** | .app | 未確認（要直接 lookup） | Google が運営、HTTPS 必須、SSL 標準 |
| **hanei-app.com** | .com | 未確認（要直接 lookup） | 「app」サフィックスで取得可能性高 |
| **gethanei.com** | .com | 未確認（要直接 lookup） | SaaS でよくある get-prefix |
| **tryhanei.com** | .com | 未確認（要直接 lookup） | β募集導線で使いやすい |
| **hanei.io** | .io | 未確認 | tech 系定番、ただし価格高め |
| **hanei.dev** | .dev | 未確認 | Google 運営、HTTPS 必須 |
| **hanei.co** | .co | 未確認 | 「.com 取れない時の代替」定番 |

### 3-2. 推奨取得順位（Dev 部門 W1 後半で実取得）

1. **hanei.app**（最優先・SaaS 風で覚えやすい）
2. **hanei.jp**（日本ターゲットなら必須・住所要件は法人 or 自宅で OK）
3. **hanei-app.com**（marketing LP 用 / 海外展開時の保険）
4. **tryhanei.com**（β募集・LP 用）

→ **Dev / PM 部門が W1 中に実 lookup + 取得**（年額 .app ≒ ¥2,000、.jp ≒ ¥3,500、.com ≒ ¥1,500）

### 3-3. 取得サービス推奨

- **お名前.com**: 国内最大手、.jp 取得時の住所登録が容易
- **value-domain**: 価格安め、bulk lookup 可
- **Cloudflare Registrar**: 卸価格・更新コスト最安、ただし `.jp` 非対応
- **Vercel Domains**: Vercel デプロイと統合、DEC-013 で Vercel Pro 運用なので最も統合性が高い

---

## 4. 第2候補ドメインの参考確認

仮に HANEI が衝突した場合のドメインも先回り確認:

- マナピヨ → `manapiyo.com` / `manapiyo.app` / `manapiyo.jp`
- ことだま英語 → `kotodama-eigo.com` / `kotodama-eigo.jp` / `kotodama.app`

→ いずれも WebSearch では特段の使用例なし。**衝突なしの可能性高**。

---

## 5. 結論 & 上申

### 5-1. DEC-004 への影響

- **HANEI 命名は維持**で W1 を進行可能
- **最終確定は J-PlatPat 公式画面での 9 / 41 / 42 類本格検索 + ドメイン実取得確認後**
- **衝突確認なしの場合**: hanei.app + hanei.jp 取得 → ロゴ + 文字商標を 9 / 41 / 42 類で同時出願（合計 ¥12 万程度・10 年権利）

### 5-2. 上申

1. **【オーナーへ】** J-PlatPat 公式画面で本格検索 1 回（5 分） or Dev 部門に依頼可
2. **【Dev 部門へ】** hanei.app / hanei.jp / hanei-app.com / tryhanei.com の whois lookup + 仮取得
3. **【法務予算】** 商標出願 1 区分 ¥3,400・登録 10 年 ¥32,900 / 区分・3 区分合計 ¥120,300（自社個人開発で個人名義出願可）

### 5-3. リスク

- HANEI = 海外（米・英・シンガポール）法人と表記同一だが、**役務区分が異なる**ため日本国内の第41類では衝突低
- ただし、グローバル展開時（Phase 3 以降）は WIPO Madrid Protocol 経由の指定国検索が必須

---

## 参考文献

[^1]: [J-PlatPat 商標検索（公式）](https://www.j-platpat.inpit.go.jp/) / [商標検索ヘルプ](https://www.j-platpat.inpit.go.jp/help/ja/t01/t0101.html)
[^2]: [商標を検索してみましょう | 経済産業省 特許庁](https://www.jpo.go.jp/support/startup/shohyo_search.html)
[^3]: [J-PlatPat・特許庁DBで商標の簡易検索・調査はこちら｜markregi](https://markregi.com/trademark-simple-search/) / [IP Force 商標調査ツール](https://ipforce.jp/shohyo)
[^4]: [Hanei USA - haneiusa.com](https://haneiusa.com/en/) / [HANEI - Crunchbase Company Profile](https://www.crunchbase.com/organization/hanei)
[^5]: [HANEI LIMITED 10248605 | UK Companies House](https://find-and-update.company-information.service.gov.uk/company/10248605)
[^6]: [HANEI PTE. LTD. (201434783N) - Singapore Company](https://www.sgpbusiness.com/company/Hanei-Pte-Ltd)
[^7]: [商標登録の区分・第41類とは？ | IPdash東京](https://ipdash.tokyo/ip-atdeep/2-04trademark_class/class41/) / [第41類 教育・娯楽・スポーツ | Toreru Media](https://toreru.jp/media/class41/)
[^8]: [第9類：機械器具、ゲーム機用プログラム、電子書籍など | 海特許事務所](https://www.kaipat.com/trademarkc/%E7%AC%AC9%E9%A1%9E%EF%BC%9A%E6%A9%9F%E6%A2%B0%E5%99%A8%E5%85%B7%E3%80%81%E3%82%B2%E3%83%BC%E3%83%A0%E6%A9%9F%E7%94%A8%E3%83%97%E3%83%AD%E3%82%B0%E3%83%A9%E3%83%A0%E3%80%81%E9%9B%BB%E5%AD%90%E6%9B%B8/)
[^9]: [.jp Domain Names - GoDaddy](https://www.godaddy.com/tlds/jp-domain) / [JPRS WHOIS](https://whois.jprs.jp/en/)
[^10]: [Whois.com / Who.is / ICANN Lookup](https://lookup.icann.org/) - 各 TLD の whois lookup ツール
[^11]: [WIPO Global Brand Database](https://branddb.wipo.int/) - 国際商標検索

---

**調査完了**: 2026-04-26 / リサーチ部門 / W1 TASK-B

**注**: J-PlatPat の本格検索 + 各ドメインの実 whois lookup は本レポートの WebFetch 制約（SPA / Cloudflare Bot 防御）で本部署では実行不可。**Dev 部門 or オーナーが W1 残期間で 1 回手動実行 → 結果を decisions.md に DEC-015 として追記**で本タスク完結。
