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
  - 購物 `Shop.writePurchase`
  - 禮物 `Shop.writeGift`
  - 常搭航空公司與額度 `Onboard.setDefaults`
  - 購物目標：`Trips.create` 的 `shopGoal`
  - 表單存檔時也呼叫同一個函式，所以兩邊不會分岔。新增功能時，請照這個做法，把「新增一筆」寫成函式，表單和範例共用。
- **每次新增或修改功能、欄位、選項時**，都要一起檢查並更新 `sample-data.js`，讓範例能示範到最新的功能。在回報裡寫明「範例改了什麼」；沒改也要說明為什麼不需要改。
- 範例只用虛構內容和台灣用語，不出現中國大陸的城市名稱或用語。
- 範例資料只存在這台裝置的 `cmo-sample-state`，不同步雲端，也不碰使用者自己的資料（`luggage-app-v1`）。

## 其他固定要求
- 其他功能不要動。不要清掉瀏覽器或雲端已存的資料。風格維持極簡雜誌感。
- 程式裡只能放 Supabase 的 publishable key，不要放 service_role key。
- 每次改完：告訴使用者怎麼在 iPad 上測試，然後 commit 並更新 GitHub Pages（push 到 `main`）。改了檔案要更新 `index.html` 的 `?v=`、`<meta name="app-version">`、`version.json`（三個用同一個版本號，新版本提示靠這個比對）和 `sw.js` 的 `CACHE` 版本。
- 沒有登入時一律顯示範例（`App.sampleMode()` 在打開時決定，重新載入前不變）；自己的資料只在登入後顯示。
