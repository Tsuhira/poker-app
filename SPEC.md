# Texas Hold'em Poker 仕様書

## 1. 概要

### モード
| | くまアプリ版 | スタンドアロン版 |
|---|---|---|
| 認証 | Firebase Auth（くまアプリ） | なし |
| 通信 | Firestore + onSnapshot | WebRTC (PeerJS) |
| 参加方法 | オープンロビー | ルームコード |

### 共通仕様
- ゲーム: ノーリミット・テキサスホールデム
- プレイヤー数: 2〜9人
- チップ持ち越し: なし（セッション内のみ）
- リバイ: なし
- タイムアウト: なし
- カード秘匿: UIレベルのみ（自分の手札だけ表示）

---

## 2. アーキテクチャ

### 権威モデル
- **ホスト**（部屋作成者）のクライアントがゲームロジックを実行し状態を配信
- 他プレイヤーはアクションを送信するのみ、ロジックはホストが処理

### レイヤー構成
```
GameEngine（共通・ゲームロジック）
      ↕
TransportInterface（共通インターフェース）
      ├── FirestoreTransport（くまアプリ版）
      └── WebRTCTransport（スタンドアロン版）
```

---

## 3. データモデル

### Card
```typescript
interface Card {
  suit: "S" | "H" | "D" | "C";          // Spades / Hearts / Diamonds / Clubs
  rank: 2|3|4|5|6|7|8|9|10|11|12|13|14; // 11=J 12=Q 13=K 14=A
}
```

### Player
```typescript
interface Player {
  id: string;          // くまアプリ版: uid、スタンドアロン版: PeerJS peerId
  displayName: string;
  chips: number;
  status: "active" | "eliminated";
  isHost: boolean;
}
```

### RoomState
```typescript
interface RoomState {
  roomId: string;
  hostId: string;
  status: "waiting" | "playing";
  settings: {
    startingChips: number;
    sb: number;
    bb: number;
    maxPlayers: number; // 2-9
  };
  players: Player[];
}
```

### GameState（ホストが管理する完全な状態）
```typescript
interface GameState {
  gameId: string;
  street: "pre_flop" | "flop" | "turn" | "river" | "showdown";
  dealerIndex: number;          // players配列のインデックス
  deck: Card[];                 // 残りデッキ（ホストのみ保持）
  communityCards: Card[];       // 0〜5枚
  pots: Pot[];                  // [0]=メインポット、[1+]=サイドポット
  currentPlayerIndex: number;
  currentBet: number;           // 現在のストリートの最高ベット額
  minRaise: number;             // 最低レイズ額
  playerStates: Record<string, PlayerState>;
  lastAggressor: string | null; // 最後にRaiseしたプレイヤーID
  winners?: Winner[];
}

interface PlayerState {
  chips: number;
  bet: number;          // 現在ストリートのベット額
  totalBet: number;     // このハンドのトータルベット額（サイドポット計算用）
  holeCards: Card[];    // 2枚（ホストと本人のみ参照）
  status: "active" | "folded" | "all_in";
  hasActed: boolean;    // このストリートでアクション済みか
}

interface Pot {
  amount: number;
  eligiblePlayers: string[]; // このポットを獲得できるプレイヤーID
}

interface Winner {
  playerId: string;
  potIndex: number;
  amount: number;
  handRank: HandRank;   // 0-9
  bestHand: Card[];     // 最強の5枚
}
```

### PublicGameState（全プレイヤーに配信する状態）
GameStateから `deck` と `playerStates[*].holeCards` を除いたもの。
各プレイヤーの手札は別途個別に送信する。

---

## 4. ゲームロジック仕様

### 4.1 ハンドの流れ

```
1. シャッフル・配牌（ホスト実行）
   └─ 各プレイヤーに手札2枚を個別送信

2. ブラインド徴収
   ├─ 2人の場合: ディーラー=SB、相手=BB（ヘッズアップルール）
   └─ 3人以上: ディーラーの左=SB、その左=BB

3. Pre-flop ベッティングラウンド
   └─ BBの左（UTG）から時計回り

4. Flop（コミュニティカード3枚公開）
   └─ SBの左から時計回り（SBがfold済みなら次のプレイヤーから）

5. Turn（1枚公開）、River（1枚公開）
   └─ 同上

6. Showdown
   ├─ 7枚（手札2+コミュニティ5）から最強5枚を選択
   ├─ ポットを勝者に分配（サイドポット含む）
   └─ チップがなくなったプレイヤーをeliminated

7. 次のハンドへ
   └─ ディーラーボタンを左に1つ移動（eliminatedをスキップ）
```

### 4.2 ベッティングラウンド終了条件

以下をすべて満たした時点で終了：
- アクティブ（fold/all-in以外）のプレイヤーが全員 `hasActed === true`
- アクティブプレイヤー全員の `bet` が `currentBet` と等しい

例外：
- アクティブプレイヤーが1人以下 → 即終了
- 全員all-in → Showdownへスキップ（残りコミュニティカードを一気に公開）

### 4.3 利用可能なアクション

| アクション | 条件 |
|-----------|------|
| Fold | 常に可能 |
| Check | `bet === currentBet` |
| Call | `bet < currentBet` かつ `chips > (currentBet - bet)` |
| All-in | `chips <= (currentBet - bet)` のCallまたは任意のRaise |
| Raise | `chips > (currentBet - bet)` かつ `raiseAmount >= minRaise` |

**minRaise**: 前回のRaise額（初回はBB額）
**Raiseでラウンド延長**: lastAggressorより前にいたプレイヤーも再度アクション可能

### 4.4 サイドポット計算アルゴリズム

```
入力: 全プレイヤーの totalBet（fold済み含む）
出力: Pot[]

1. all-inプレイヤーを totalBet の昇順にソート
2. level = 0 として、all-inプレイヤーを1人ずつ処理:
   a. cap = そのプレイヤーの totalBet
   b. このポットの amount = Σ min(各プレイヤーのtotalBet, cap) - level
   c. eligible = totalBet >= cap かつ foldしていないプレイヤー
   d. level = cap
3. 残りのアクティブプレイヤーが2人以上いれば最終ポットを追加
```

例:
```
A: 100 all-in、B: 300 active、C: 300 active、D: 200 fold
→ メインポット: min(100,100)+min(300,100)+min(300,100)+min(200,100) = 400
   eligible: A, B, C（Dはfoldなので除外）
→ サイドポット: (300-100)+(300-100) = 400
   eligible: B, C（Aはall-inで超過分に権利なし）
```

### 4.5 ハンド評価

7枚（手札2枚+コミュニティ5枚）から C(7,5)=21通りの組み合わせを評価し最強を選択。

| ランク | 名称 | 判定条件 |
|-------|------|---------|
| 9 | Royal Flush | A-K-Q-J-10 同スート |
| 8 | Straight Flush | 連番5枚 同スート（Aロー A-2-3-4-5 含む） |
| 7 | Four of a Kind | 同ランク4枚 |
| 6 | Full House | 3枚+2枚 |
| 5 | Flush | 同スート5枚（連番でない） |
| 4 | Straight | 連番5枚（Aロー/Aハイ両対応） |
| 3 | Three of a Kind | 同ランク3枚 |
| 2 | Two Pair | ペア×2 |
| 1 | One Pair | ペア×1 |
| 0 | High Card | 上記なし |

**タイブレーク**: 同ランクの場合、構成カードを降順に並べて辞書順比較。完全同点ならポット均等分割（端数はSBに近いプレイヤーへ）。

---

## 5. 通信レイヤー

### TransportInterface
```typescript
interface Transport {
  // ルーム
  createRoom(settings: RoomSettings): Promise<string>;  // roomId返却
  joinRoom(roomId: string, player: Omit<Player, "isHost">): Promise<void>;
  leaveRoom(): Promise<void>;

  // ホスト → 全員（ゲーム状態配信）
  publishState(state: PublicGameState): Promise<void>;
  publishHoleCards(playerId: string, cards: Card[]): Promise<void>;

  // 全員 → リスナー
  onStateChange(cb: (state: PublicGameState) => void): Unsubscribe;
  onHoleCards(cb: (cards: Card[]) => void): Unsubscribe;
  onPlayerJoin(cb: (player: Player) => void): Unsubscribe;
  onPlayerLeave(cb: (playerId: string) => void): Unsubscribe;

  // プレイヤー → ホスト（アクション送信）
  sendAction(action: PlayerAction): Promise<void>;
  onAction(cb: (playerId: string, action: PlayerAction) => void): Unsubscribe;
}

interface PlayerAction {
  type: "fold" | "check" | "call" | "raise" | "all_in";
  amount?: number; // raise時のみ（コール額を含むトータル額）
}
```

### FirestoreTransport（くまアプリ版）
```
poker_rooms/{roomId}              ← RoomState
poker_rooms/{roomId}/game         ← PublicGameState（onSnapshot）
poker_rooms/{roomId}/hands/{uid}  ← 手札（本人のみ参照）
poker_rooms/{roomId}/actions/{id} ← プレイヤーアクション（ホストがonSnapshotで受信・処理後削除）
```

### WebRTCTransport（スタンドアロン版）
- ホストが PeerJS で Peer を作成 → `roomId = peer.id`
- 参加者が roomId を入力してホストに接続（`peer.connect(roomId)`）
- ホストがゲーム状態を全接続済みpeerにbroadcast
- 手札は該当peerにのみ送信
- アクションは各peerからホストに直接送信

---

## 6. 画面・コンポーネント構成

### 画面遷移
```
App
├── LoginGate（くまアプリ版のみ: 未ログインなら案内表示）
├── Lobby（くまアプリ版のみ: 部屋一覧 / 部屋作成）
├── JoinRoom（スタンドアロン版のみ: ルームコード入力）
├── WaitingRoom（参加者一覧 / ホストのみ設定・開始ボタン）
└── Game
    ├── Table（メイン卓）
    ├── CommunityCards
    ├── PotDisplay（メインポット + サイドポット表示）
    ├── PlayerSeat × n（チップ・ベット額・ステータス）
    │   └── HoleCards（自分: 表向き / 他者: 裏向き）
    ├── ActionPanel（自分のターン時のみ）
    │   ├── FoldButton
    │   ├── CheckButton / CallButton
    │   └── RaiseControls（スライダー + 入力）
    ├── ShowdownReveal（Showdown時に全手札を順次公開）
    └── GameLog（アクション履歴）
```

---

## 7. テスト項目

### 7.1 デッキ操作 `tests/deck.test.js`
- [ ] デッキが52枚生成される
- [ ] 全カードのsuit/rankが正しい範囲内である
- [ ] シャッフル後も52枚・重複なし
- [ ] draw(n)でn枚取り出せる
- [ ] draw後のデッキ枚数が (52-n) になる

### 7.2 ハンド評価 `tests/handEvaluator.test.js`
- [ ] Royal Flush 検出（A-K-Q-J-10 同スート）
- [ ] Straight Flush 検出（9-8-7-6-5 同スート）
- [ ] Straight Flush Aロー検出（A-2-3-4-5 同スート）
- [ ] Four of a Kind 検出
- [ ] Full House 検出
- [ ] Flush 検出
- [ ] Straight 検出（Aハイ: A-K-Q-J-10）
- [ ] Straight Aロー検出（A-2-3-4-5）
- [ ] Three of a Kind 検出
- [ ] Two Pair 検出
- [ ] One Pair 検出
- [ ] High Card 検出
- [ ] 7枚から最強5枚を選択できる（コミュニティカードのみで役が成立するケース含む）
- [ ] タイブレーク: 同ランクでキッカー比較（例: ペア A A vs ペア A A、キッカー K vs Q）
- [ ] タイブレーク: 完全同点でポット分割を示す

### 7.3 サイドポット計算 `tests/sidePot.test.js`
- [ ] オールインなし → メインポット1つ
- [ ] 1人オールイン（最小額）→ メインポット + サイドポット1つ
- [ ] 2人オールイン（異なる額）→ メインポット + サイドポット2つ
- [ ] フォールドしたプレイヤーの分はポットに含まれるがeligibleには入らない
- [ ] オールイン額がBBより小さい場合の処理（ポット均等分割で対応）
- [ ] 全員オールイン（異なる額）の多段サイドポット

### 7.4 ベッティングラウンド `tests/gameEngine.test.js`

#### アクション検証
- [ ] Pre-flopはUTG（BBの左）から開始
- [ ] Flop以降はSBの左から開始
- [ ] ヘッズアップ（2人）Pre-flopはディーラー（SB）から開始
- [ ] BBはPre-flopでチェック権を持つ（誰もレイズしなかった場合）
- [ ] Raiseでラウンドが延長され全員が再アクション可能
- [ ] CheckはcurrentBet=0の時のみ選択可
- [ ] RaiseはminRaise未満の額を拒否する

#### ラウンド終了
- [ ] 全員のbet額が揃い全員hasActedでラウンド終了
- [ ] 全員foldで1人残り勝利
- [ ] 全員all-inでShowdownに直行（残コミュニティカード一括公開）

#### ゲームフロー
- [ ] ゲーム開始時に全プレイヤーへ startingChips が配布される
- [ ] SB・BBが正しいプレイヤーから徴収される（チップ不足時はall-in扱い）
- [ ] ディーラーボタンが毎ハンド左に1つ移動する
- [ ] eliminatedプレイヤーはディーラーボタン移動時にスキップされる
- [ ] チップが0になったプレイヤーがeliminatedになる
- [ ] アクティブプレイヤーが1人になったらゲーム終了

### 7.5 統合テスト: フルハンドシナリオ `tests/integration/fullHand.test.js`
- [ ] シナリオA: 全員チェックのみでShowdownまで進む
- [ ] シナリオB: 1人を残して全員foldで即決着
- [ ] シナリオC: Raise → 全員Call → Showdown
- [ ] シナリオD: オールインとサイドポットが発生するハンド
- [ ] シナリオE: スプリットポット（引き分け）が発生するハンド
- [ ] シナリオF: Pre-flopでBBがチェック権を行使する

### 7.6 統合テスト: 通信 `tests/integration/transport.test.js`
- [ ] WebRTC: ホストが部屋を作成してroomIdが返る
- [ ] WebRTC: 参加者がroomIdで接続できる
- [ ] WebRTC: publishStateが全参加者に届く
- [ ] WebRTC: publishHoleCardsが対象の参加者にのみ届く
- [ ] WebRTC: sendActionがホストに届く
- [ ] Firestore: ロビーに部屋が表示される
- [ ] Firestore: 参加者がロビーから入室できる
- [ ] Firestore: onSnapshotで全員に状態変更が届く

---

## 8. ファイル構成

```
poker-app/
├── index.html
├── package.json
├── vite.config.js
├── SPEC.md
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── hooks/
│   │   ├── useAuth.js        # くまアプリFirebase Auth
│   │   └── useRoom.js        # 部屋の状態管理
│   ├── lib/
│   │   ├── poker/
│   │   │   ├── deck.js           # デッキ生成・シャッフル
│   │   │   ├── handEvaluator.js  # 7枚→最強5枚・ハンドランク評価
│   │   │   ├── sidePot.js        # サイドポット計算
│   │   │   └── gameEngine.js     # ゲーム状態機械（ホストのみ使用）
│   │   └── transport/
│   │       ├── interface.js          # TransportInterface定義
│   │       ├── firestoreTransport.js # Firestore実装
│   │       └── webrtcTransport.js    # PeerJS実装
│   ├── components/
│   │   ├── Table.jsx
│   │   ├── CommunityCards.jsx
│   │   ├── PlayerSeat.jsx
│   │   ├── HoleCards.jsx
│   │   ├── PotDisplay.jsx
│   │   ├── ActionPanel.jsx
│   │   ├── RaiseControls.jsx
│   │   ├── ShowdownReveal.jsx
│   │   └── GameLog.jsx
│   └── pages/
│       ├── Lobby.jsx       # くまアプリ版のみ
│       ├── JoinRoom.jsx    # スタンドアロン版のみ
│       ├── WaitingRoom.jsx
│       └── Game.jsx
└── tests/
    ├── deck.test.js
    ├── handEvaluator.test.js
    ├── sidePot.test.js
    ├── gameEngine.test.js
    └── integration/
        ├── fullHand.test.js
        └── transport.test.js
```

---

## 9. 開発順序

1. **Phase 1: ゲームロジック** （テストファースト）
   - `deck.js` + `deck.test.js`
   - `handEvaluator.js` + `handEvaluator.test.js`
   - `sidePot.js` + `sidePot.test.js`
   - `gameEngine.js` + `gameEngine.test.js`

2. **Phase 2: 通信レイヤー**
   - `webrtcTransport.js`（スタンドアロン版先行）
   - `firestoreTransport.js`

3. **Phase 3: UI**
   - WaitingRoom → Table → ActionPanel の順
   - スタンドアロン版で動作確認後、くまアプリ版を追加

4. **Phase 4: 統合テスト・デプロイ**
   - フルハンドシナリオのテスト
   - GitHub Pages デプロイ設定
