# 開發規則（Carry My Own 行李 app）

## 範例資料要跟著功能一起更新
- 試用範例集中在 `sample-data.js`。上半部是範例內容，下半部用各功能自己的新增函式產生資料。
- 範例**一律**透過正式功能的新增函式產生，跟使用者在畫面上新增的資料格式完全一樣，不要另外手寫資料結構：
  - 家 `App.addHome(名字, 所在城市)`（判斷抵達哪個家一律用所在城市）
  - 衣櫃 `Closet.create`
  - 抽屜 `Drawer.create`（底層是 `App.makeDrawerEntry`；`packTrip` 等於畫面上勾「加入下一趟的打包清單」）
  - 行李箱 `Bags.create`
  - 旅程 `Trips.create`
  - 打包清單 `Packing.prepareTrip`（裡面走「＋ 加入」的 `addToList`）
  - 購物（自己買、自己留的）`Shop.writePurchase`；要送人的一律是禮物 `Shop.writeGift`（旅途中買的 source 'trip'）
  - 禮物 `Shop.writeGift`
  - 常搭航空公司與額度 `Onboard.setDefaults`
  - 必帶清單 `App.addMust(名字, 預設行李, 重量)`（預設內容在 app.js 的 `DEFAULT_MUST`：「忘了會出問題、當地也買不到」的東西；打包清單的「必帶、上衣、下身、鞋子、首飾盒、貼身衣物、保養品」一直顯示，沒東西時下方灰字可以直接去挑）
  - 預留空間（這趟想留給購物和送禮的重量，以前叫購物目標）：`Trips.create` 的 `shopGoal`
  - 每日穿搭：當天活動 `Outfit.setActs(旅程 id, 日期, 活動[])`、確定這套 `Outfit.confirm(旅程 id, 日期)`（自動搭配靠衣服的 pattern／seasons／styles／uses 標籤，範例衣服要填）
  - 貼身衣物（衣櫃裡只記數量的襪子、內衣褲）：數量 `Intimates.setCount(項目 id, 家, 數量)`、新增項目 `Intimates.create`、加進某趟清單 `Packing.addIntimate(旅程, 項目 id, 數量, 是否放進行李)`；建議數量由 `Intimates.suggest` 依住幾晚、天氣、活動、目的地的家已有的自動算
  - 衣櫃畫面分五頁（衣服／鞋子／包包／配件／貼身衣物），資料裡的 group 不變；顏色存詳細的 `colors`（穿搭用），畫面只顯示 `tone`（深色／淺色／大地色，`Clothing.toneOf`），首飾、手錶、錶帶保留金銀色；`styles` 是場合（正式／休閒／運動／馬術）
  - 消耗品（抽屜物品剩多少：滿／一半／快用完／沒了；只有保養品、洗漱用品、保健品、食品顯示和記錄，`Consumables.canConsume`）：`Consumables.setLevel(物品 id, 用量)`（同時標成消耗品）、取消記錄 `Consumables.setConsumable(物品 id, false)`；城市當地好不好買：`Consumables.setAvail(城市, 'easy'|'hard'|'')`（也記成那個國家的預設）；補貨選擇：`Consumables.chooseRestock(旅程, 物品 id, 'buy'|'online'|'none', 上一個城市)`
  - 範例內容改了，把 `sample-data.js` 的 `VERSION` 加 1，打開過舊範例的裝置會自動換成新的
  - 表單存檔時也呼叫同一個函式，所以兩邊不會分岔。新增功能時，請照這個做法，把「新增一筆」寫成函式，表單和範例共用。
- **每次新增或修改功能、欄位、選項時**，都要一起檢查並更新 `sample-data.js`，讓範例能示範到最新的功能。在回報裡寫明「範例改了什麼」；沒改也要說明為什麼不需要改。
- 範例只用虛構內容和台灣用語，不出現中國大陸的城市名稱或用語。
- 範例資料只存在這台裝置的 `cmo-sample-state`，不同步雲端，也不碰使用者自己的資料（`luggage-app-v1`）。

## 中文／英文（語言切換）
- 介面文字的翻譯集中在 `lang.js`：繁體中文是原文（畫面上的中文就是 key），`LANG.en.text` 是中文 → 英文對照，`LANG.en.rules` 是含數字、日期、名稱的句型。切換和套用在 `i18n.js`。
- **以後每次新增或修改功能，新的介面文字都要同時在 `lang.js` 加上英文，不能只寫一種**；範例的新內容也要在 `sample-data.js` 的 `EN_NAMES` 加上英文名稱。
- 做完用英文模式把相關畫面、提示、確認視窗都看過一次，確認沒有中文殘留；在回報裡列出還沒翻譯完整的地方。
- 使用者自己輸入的內容（物品、家、城市、朋友、自己新增的選項）不翻譯。選單選項的 value 要用中文原文（存進資料的一律是中文）。
- 英文用詞：首頁 Overview、行程 Trips、打包 Packing、家 Homes、衣櫃 Wardrobe、抽屜 Drawer、行李箱 Luggage、清單 List、行李 Bags、購物 Shopping、禮物 Gifts、預留空間 Reserved space、必帶 Essentials、穿搭 Outfits。日期英文用「Thu, Nov 20」，時間 24 小時制，重量 kg。

## 資料安全（雲端同步）
- **每次修改到登入、登出、同步、範例或資料格式（`cloud.js`、`app.js` 的 load／migrate／save、`onboard.js`、`profile.js`、`sample-data.js`），發布前一定要跑 `node tests/safety.js`，全部通過才可以 commit／push，並在回報裡寫出測試結果（幾項通過）。** 也可以用 `SERVER_GUARD=off node tests/safety.js` 確認 app 自己（沒有雲端那一層）也守得住。
- 同步一定先讀雲端，讀成功之後才可能上傳；讀取失敗、離線時不上傳。
- 本機資料是空的、讀不懂、或是範例資料時，絕對不上傳，改用雲端的。讀不懂的本機資料另外留在 `cmo-rescue-…`。
- 刪除只刪那一筆：存檔時比對上一次，真的被刪掉的才記到 `state.tombstones`（id → 時間）；合併時只有記在這裡的才刪，「少了但沒有刪除紀錄」一律保留。不要再用「整份換掉」的方式刪資料。
- 上傳會讓物品或旅程少一半以上時先問使用者；雲端（`supabase/safety.sql`）也會擋下沒確認過的大量減少和範例資料，並保留之前 50 版。
- 打開 app 讀資料時（`load` → `migrate`）會用到的東西，要放在 `var state = load()` 之前，或寫在函式裡；檔案後面的 `var` 那時候還沒有值（這次資料被清空就是這個原因）。

## 其他固定要求
- 其他功能不要動。不要清掉瀏覽器或雲端已存的資料。風格維持極簡雜誌感。
- 程式裡只能放 Supabase 的 publishable key，不要放 service_role key。
- 每次改完：告訴使用者怎麼在 iPad 上測試，然後 commit 並更新 GitHub Pages（push 到 `main`）。改了檔案要更新 `index.html` 的 `?v=`、`<meta name="app-version">`、`version.json`（三個用同一個版本號，新版本提示靠這個比對）和 `sw.js` 的 `CACHE` 版本。
- 沒有登入時一律顯示範例（`App.sampleMode()` 在打開時決定，重新載入前不變）；自己的資料只在登入後顯示。
