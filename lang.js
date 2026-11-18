/*
 * 翻譯檔：app 的介面文字（繁體中文／English）
 *
 * - 繁體中文是原文：畫面上的中文就是 key，中文模式完全照原樣顯示（zh 不用另外寫）。
 * - English：下面 LANG.en.text 是「中文 → 英文」對照；LANG.en.rules 是含數字、日期、名稱的句型。
 * - 使用者自己輸入的內容（物品名稱、家的名字、城市、朋友名字、自己新增的選項）不會在這裡，照原樣顯示。
 * - 範例資料的英文名稱寫在 sample-data.js（每一筆的 en），只在範例模式套用。
 *
 * ⚠ 規則：新增或修改功能時，新的介面文字要同時在這裡加上英文，不能只寫一種。
 *   名稱對照：首頁 Overview、行程 Trips、打包 Packing、家 Homes、衣櫃 Wardrobe、抽屜 Drawer、行李箱 Luggage、
 *   清單 List、行李 Bags、購物 Shopping、禮物 Gifts、預留空間 Reserved space、必帶 Essentials、穿搭 Outfits。
 */
window.LANG = { zh: { name: '繁體中文' }, en: { name: 'English', text: {}, rules: [] } };
(function () {
  var T = window.LANG.en.text;
  function add(o) { Object.keys(o).forEach(function (k) { T[k] = o[k]; }); }

  // ---------- 導覽、頁面名稱 ----------
  add({
    '首頁': 'Overview', '行程': 'Trips', '打包': 'Packing', '家': 'Homes', '衣櫃': 'Wardrobe', '抽屜': 'Drawer', '行李箱': 'Luggage',
    '清單': 'List', '行李': 'Bags', '購物': 'Shopping', '送禮': 'Gifts', '禮物': 'Gifts', '預留空間': 'Reserved space', '必帶': 'Essentials',
    '穿搭': 'Outfits', '新增': 'Add', '新增到': 'Add to', '帳號': 'Account', '帳號、登入與備份': 'Account, sign-in and backup',
    '剩餘公斤數': 'Remaining', '行李裡的物品': 'Items in your bags', '接下來的旅程': 'Upcoming trips', '修改額度': 'Edit allowance',
    '現在是範例資料・': 'You are viewing sample data · ', '現在是範例資料': 'You are viewing sample data', '現在是範例資料。': 'You are viewing sample data.', '登入開始使用': 'Sign in to start',
    '清除範例，開始使用': 'Clear sample and start', '有新版本・點一下更新': 'New version available · Tap to update',
    '更新中…': 'Updating…', '版本': 'Version', '關閉': 'Close', '取消': 'Cancel', '確定': 'OK', '確認': 'Confirm', '儲存': 'Save',
    '刪除': 'Delete', '修改': 'Edit', '編輯': 'Edit', '完成': 'Done', '略過': 'Skip', '跳過': 'Skip', '下一步': 'Next', '下一個': 'Next',
    '知道了': 'Got it', '開始使用': 'Get started', '先看範例': 'View sample', '直接開始設定': 'Set up now', '加入': 'Add', '清除': 'Clear',
    '全部': 'All', '其他': 'Other', '未定': 'Not set', '未設定': 'Not set', '設定': 'Set', '不設定': 'None', '管理': 'Manage',
    '搜尋名稱': 'Search by name', '名稱': 'Name', '重量': 'Weight', '數量': 'Qty', '價格': 'Price', '單位': 'Unit', '品類': 'Category',
    '狀態': 'Status', '類型': 'Type', '照片': 'Photo', '內容': 'Contents', '共': 'Total', '約': 'approx.', '和': 'and', '的': ' ',
    '（選填）': '(optional)', '（可不填）': '(optional)', '（可略過）': '(optional)', '選填': 'Optional', '可複選': 'Choose any',
    '請輸入': 'Enter', '請輸入名稱': 'Please enter a name', '請輸入正確的重量': 'Please enter a valid weight', '數量至少為 1': 'Quantity must be at least 1',
    '已儲存': 'Saved', '已刪除': 'Deleted', '已復原': 'Restored', '復原': 'Undo', '已移除': 'Removed', '發生錯誤': 'Something went wrong',
    '公斤': 'kg', '重量單位': 'Weight unit', '公分': 'cm', '時': 'h', '分': 'min', '小時': 'hours', '天': 'days', '年': '', '月': '',
    'COMING SOON': 'COMING SOON', '多人行程': 'Shared trips', '即將推出': 'Coming soon', '歡迎': 'Welcome', '範例': 'Sample',
    '下一趟': 'Next', '今天': 'Today', '明天': 'Tomorrow', '這趟': 'This trip', '旅程': 'Trip', '日期未定': 'Dates TBD', '路線未定': 'Route TBD',
    '帳號、登入': 'Account', '語言 / Language': '語言 / Language'
  });

  // ---------- 首頁、旅程卡、預留空間、行李 ----------
  add({
    '還沒有旅程': 'No trips yet', '先新增一趟旅程': 'Add your first trip', '設定預留空間': 'Set reserved space', '預留空間提醒': 'Reserved space alert',
    '這趟想留多少公斤給購物和送禮？打包快用到這個空間時會提醒你。可以不設定。': 'How many kilos do you want to keep free for shopping and gifts? We will let you know when packing starts to use it. Optional.',
    '已取消預留空間': 'Reserved space removed', '請輸入公斤數，或按「不設定」': 'Enter a weight in kg, or tap "None"',
    '打包的重量已經用到預留空間了。': 'Your packing has reached the reserved space.', '打包的重量快用到預留空間了。': 'Your packing is close to the reserved space.',
    '尚未設定額度': 'No allowance set', '尚未選擇行李箱': 'No suitcase selected', '選擇行李箱': 'Choose luggage', '用哪一個行李箱？': 'Which suitcase?',
    '選了行李箱，空箱重量就會自動算進去': 'Pick a suitcase and its empty weight is added automatically', '這趟不帶': 'Not this trip', '不計算': 'Not counted',
    '合計': 'Total', '含空箱': 'incl. empty case', '空箱': 'Empty case', '快滿': 'Almost full', '超重': 'Over limit', '共用': 'shared',
    '隨身小包': 'Pouch', '背包': 'Backpack', '手提': 'Carry-on', '托運': 'Checked', '手提行李': 'Carry-on', '托運行李': 'Checked bag', '登機箱': 'Cabin case',
    '背包／個人物品': 'Backpack / personal item', '隨身小包的重量': 'Pouch weight', '預設和背包／個人物品一起算': 'Counted with the backpack / personal item by default',
    '單獨計算': 'Count separately', '算進背包額度': 'Count in backpack allowance', '背包＋隨身小包': 'Backpack + pouch', '隨身小包（算在背包額度）': 'Pouch (in backpack allowance)',
    '到「家 → 行李箱」新增或修改 ›': 'Add or edit in Homes → Luggage ›', '還沒有東西。': 'Nothing yet.', '行李中': 'In bags', '已打包': 'Packed',
    '收好了': 'Packed', '取消收好': 'Unpack', '已收好': 'Packed', '已拿出來：': 'Taken out: ', '拿出來：': 'Take out: ', '放進更多東西': 'Add more items',
    '＋ 放進更多東西': '＋ Add more items', '移到…': 'Move to…', '移到別的行李': 'Move to another bag', '最緊：': 'Tightest: ', '這趟還能放多少': 'How much room is left',
    '今天的穿搭 ›': "Today's outfit ›", '明天的穿搭 ›': "Tomorrow's outfit ›", '查看禮物': 'View gifts'
  });

  // ---------- 打包 ----------
  add({
    '清單': 'List', '這趟旅程': 'Trip', '＋ 新增': '＋ Add', '編輯': 'Edit', '完成': 'Done', '出發前檢查': 'Pre-departure check',
    '全部都放進去了': 'Everything is packed', '清單是空的。點「＋ 新增」從衣櫃、抽屜挑，或直接輸入。': 'Your list is empty. Tap "＋ Add" to pick from your wardrobe or drawer, or type an item.',
    '家裡已經有，不用帶': 'Already at your destination home', '上衣': 'Tops', '下身': 'Bottoms', '洋裝／連身': 'Dresses & jumpsuits', '外套': 'Outerwear',
    '睡衣': 'Sleepwear', '鞋子': 'Shoes', '帽子／圍巾': 'Hats & scarves', '首飾配件': 'Accessories', '保養品': 'Skincare', '保健品': 'Health',
    '電線電器': 'Electronics', '特殊類': 'Special gear', '食品': 'Food', '這組都放好了': 'This group is packed', '必備品': 'Essentials',
    '新增到打包清單': 'Add to packing list', '從衣櫃挑': 'From wardrobe', '從抽屜挑': 'From drawer', '直接輸入': 'Type it in', '例如：自拍棒': 'e.g. selfie stick',
    '重量（g）': 'Weight (g)', '放在哪一區': 'Which bag', '只能手提（例如行動電源、護照）': 'Carry-on only (e.g. power bank, passport)', '加入清單': 'Add to list',
    '放在哪個行李': 'Which bag', '這趟不帶（從清單刪除）': 'Not this trip (remove from list)', '刪除（這趟不帶）': 'Delete (not this trip)',
    '已放進去，點一下取消': 'Packed — tap to undo', '放進去了': 'Packed', '拖曳調整順序': 'Drag to reorder', '拖到別的行李': 'Drag to another bag',
    '必帶清單的設定不會變，只改這趟。': 'Your essentials list stays the same; this only changes this trip.', '還沒有放東西': 'Nothing packed yet',
    '不計算重量': 'Weight not counted', '會超重': 'Would be over', '找不到？到「打包清單」手動新增 ›': 'Not here? Add it to the packing list ›',
    '必帶清單': 'Essentials list', '新增必帶的東西': 'Add an essential', '必帶清單是空的。': 'Your essentials list is empty.', '預設行李': 'Default bag',
    '每次產生新的打包清單時，這些東西會自動加進「清單」，放在預設的行李；出發前檢查也會特別提醒。': 'These go on every new packing list in their default bag, and the pre-departure check reminds you about them.',
    '（已經產生的打包清單不會變）': '(Existing packing lists will not change)', '必帶的東西都放進去了。': 'All essentials are packed.',
    '隨身小包：護照、錢包': 'Pouch: passport and wallet', '護照和錢包都收在隨身小包裡了。': 'Passport and wallet are in your pouch.',
    '這趟沒有帶隨身小包，請確認護照和錢包放在身上拿得到的地方。': 'No pouch on this trip — keep your passport and wallet somewhere easy to reach.',
    '⚠️ 超重': '⚠️ Over limit', '還沒放進去': 'not packed yet', '不在這趟的清單上': 'is not on this list', '加到隨身小包': 'Add to pouch', '移到隨身小包': 'Move to pouch',
    '在隨身小包，但還沒收好': 'is in the pouch but not packed yet', '全部都收好了 🎉': 'All packed 🎉', '沒有漏掉常帶的東西': 'Nothing you usually bring is missing',
    '當地容易買到': 'Easy to buy there', '當地容易買到，可以不用帶': 'Easy to buy there — you can skip these', '不帶了': 'Skip it', '清單上沒有': 'Not on the list: ',
    '沒有新的建議': 'No new suggestions', '已改成要帶：': 'Now packing: ', '已移回「清單」：': 'Moved back to List: ', '已取消：': 'Unpacked: ',
    '提醒：放進': 'Heads up: putting it in ', '還是要放進去嗎？': 'Pack it anyway?', '至少要帶一種行李': 'Bring at least one bag',
    '找不到這個行李箱': 'Suitcase not found', '已加進必帶清單：': 'Added to essentials: ', '依行程補上了': 'Added for your trip',
    '手機': 'Phone', '護照': 'Passport', '錢包': 'Wallet', '信用卡／現金': 'Cards / cash', '行動電源': 'Power bank', '充電線': 'Charging cable',
    '耳機': 'Earphones', '轉接頭': 'Travel adapter', '牙刷': 'Toothbrush', '內衣褲': 'Underwear', '襪子': 'Socks', '常備藥': 'Basic medicine',
    '基本保養品': 'Basic skincare', '充電線一包': 'Charging cables', '眼罩': 'Eye mask', '鑰匙': 'Keys', '現金': 'Cash', '信用卡': 'Credit card', '簽證': 'Visa'
  });

  // ---------- 行程 ----------
  add({
    '列表': 'List', '月曆': 'Calendar', '年度時間軸': 'Year', '＋ 新增旅程': '＋ New trip', '新增旅程': 'New trip', '編輯旅程': 'Edit trip', '‹ 行程': '‹ Trips',
    '目前所在地': 'Currently in', '新增第一趟': 'Add your first trip', '旅程名稱': 'Trip name', '例如：2027 春節回台灣': 'e.g. Lunar New Year 2027',
    '出發地': 'From', '出發城市': 'Departure city', '抵達城市': 'Arrival city', '起飛日期': 'Departure date', '起飛時間': 'Departure time', '起飛時間（當地）': 'Departure time (local)',
    '抵達日期': 'Arrival date', '抵達時間': 'Arrival time', '抵達時間（當地）': 'Arrival time (local)', '（同一天可不填）': '(leave blank if same day)',
    '航班號碼': 'Flight no.', '航空公司': 'Airline', '這段的行李額度': 'Allowance for this flight', '托運（公斤）': 'Checked (kg)', '手提（公斤）': 'Carry-on (kg)',
    '隨身小包（公斤）': 'Pouch (kg)', '沒填＝尚未設定額度；填 0＝這段沒有這項': 'Blank = not set; 0 = none on this flight', '＋ 新增一段航班': '＋ Add a flight',
    '刪除這段': 'Remove this flight', '往上移': 'Move up', '往下移': 'Move down', '儲存旅程': 'Save trip', '刪除這趟旅程': 'Delete this trip', '已儲存旅程': 'Trip saved',
    '已刪除旅程': 'Trip deleted', '已新增旅程': 'Trip added', '請輸入旅程名稱': 'Please name your trip', '這趟的季節': 'Seasons', '這趟的活動': 'Activities',
    '打包清單會依這裡自動帶入需要的衣物和裝備。': 'Your packing list picks clothes and gear based on these.', '最後一段結束後，回到哪個家': 'Home after the last flight',
    '未定／不回家': 'Not set / not home', '依日期和城市自動判斷，可以自己改': 'Set automatically from dates and cities; you can change it',
    '下一趟旅程會預設從這個家出發；年度時間軸也會用來顯示兩趟之間待在哪裡。': 'Your next trip starts from this home by default, and the year view uses it for time between trips.',
    '轉機點': 'Connection', '轉機方式': 'Connection type', '直掛': 'Through', '直掛到下一段': 'Checked through', '領出': 'Recheck', '需要領出重新託運': 'Collect and recheck bags',
    '入境': 'Enter', '入境停留': 'Stopover', '不入境，直接轉機': 'Transit without entering', '轉機': 'Transit', '停留': 'Stay', '時間很趕': 'Tight connection',
    '填上這段的抵達時間和下一段的起飛日期、時間，就會自動算出轉機時間': 'Add this arrival time and the next departure to calculate the layover',
    '⚠️ 下一段起飛比這段抵達還早，請檢查日期和時間': '⚠️ The next flight leaves before this one lands — check dates and times',
    '🧳 行李要領出，可以整理或換東西': '🧳 Bags come off here — you can repack or swap items', '選擇時間': 'Choose time', '請先選小時': 'Choose the hour first',
    '上個月': 'Previous month', '下個月': 'Next month', '前一年': 'Previous year', '後一年': 'Next year', '旅程中': 'Traveling', '空檔': 'Free time', '有家': 'Home',
    '有家：可換行李箱或寄放東西': 'Home here: swap suitcases or leave things', '還沒有排日期的旅程。新增旅程並填上航班日期，就會顯示在月曆上。': 'No dated trips yet. Add flight dates and they will show on the calendar.',
    '已結束的': 'Past', '多人行程': 'Shared trips', '這趟的穿搭 ›': "This trip's outfits ›", '當地': 'local', '起': 'from',
    '例如：去清邁玩、住朋友家': 'e.g. holiday, staying with friends', '例如：台北': 'e.g. Taipei', '例如：曼谷': 'e.g. Bangkok', '例如：長榮航空': 'e.g. EVA Air', '例如：BR211': 'e.g. BR211',
    '備註': 'Note', '停留天數': 'Days', '日': 'Sun', '一': 'Mon', '二': 'Tue', '三': 'Wed', '四': 'Thu', '五': 'Fri', '六': 'Sat', '回來 →': 'Back →', '待': 'Stay'
  });

  // ---------- 家：衣櫃、抽屜、行李箱 ----------
  add({
    '＋ 新增衣服': '＋ Add clothing', '新增衣服': 'Add clothing', '編輯衣服': 'Edit clothing', '‹ 衣櫃': '‹ Wardrobe', '還沒有衣服': 'No clothes yet', '新增第一件': 'Add your first piece',
    '沒有符合的衣服': 'No matching pieces', '放在哪個家': 'Home', '新增一個家': 'Add a home', '單品類別': 'Category', '請先點選單品類別': 'Choose a category first',
    '細項': 'Style', '顏色': 'Color', '花紋': 'Pattern', '適合季節': 'Seasons', '風格': 'Style', '用途': 'Use', '品牌': 'Brand', '材質': 'Material', '厚度': 'Thickness',
    '長度': 'Length', '帽型': 'Hat style', '鞋子大類': 'Shoe type', '配件種類': 'Accessory type', '款式': 'Style', '尺寸': 'Size', '實際長度（選填）': 'Actual length (optional)',
    '適用手錶': 'Fits watches', '可以搭配的錶帶': 'Matching straps', '錶帶': 'Strap', '從衣櫃刪除': 'Delete from wardrobe', '移到另一個家': 'Move to another home',
    '移動紀錄': 'Move history', '還沒有移動紀錄': 'No moves yet', '目前位置': 'Location', '在行李裡': 'In bags', '待確認': 'To confirm', '從行李拿出來': 'Take out of bags',
    '放進行李': 'Pack', '已加入衣櫃': 'Added to wardrobe', '已從行李拿出來': 'Taken out of bags', '已從行李拿出來：': 'Taken out of bags: ', '要從行李拿出來嗎？': 'Take it out of your bags?',
    '加入照片': 'Add photo', '換一張照片': 'Change photo', '換一張': 'Change', '移除照片': 'Remove photo', '點這裡拍照或選照片（可略過）': 'Tap to take or choose a photo (optional)',
    '選好種類會自動帶入': 'Filled in from the type', '選好種類會自動帶入，例如：白襯衫': 'Filled in from the type, e.g. white shirt', '看全部衣櫃': 'See all wardrobe',
    '加入下一趟的打包清單': 'Add to the next packing list', '例如：UNIQLO': 'e.g. UNIQLO', '例如：東京': 'e.g. Tokyo', '自己的叫法': 'Your own name', '例如：': 'e.g. ',
    '下次在同一種類會直接出現成選項。不輸入直接按確認，就記成「其他」。': 'It will appear as an option next time. Leave blank to save as "Other".',
    '衣櫃裡還沒有手錶。先新增手錶，就能在這裡選。': 'No watches yet. Add a watch to choose it here.',
    '還沒有錶帶。新增錶帶時，在「適用手錶」選這支手錶，就會顯示在這裡。': 'No straps yet. When you add a strap, pick this watch under "Fits watches".',
    '照片存不進去，可能是瀏覽器空間不足': 'Could not save the photo — the browser may be out of space', '照片存不進去': 'Could not save the photo',
    '照片壓縮中…': 'Compressing photo…', '這張照片讀不到，請換一張試試': 'This photo could not be read — try another', '壓縮失敗': 'Compression failed', '無法讀取照片': 'Could not read the photo',
    '抽屜還是空的・': 'Your drawer is empty · ', '新增物品，例如：泡麵、面膜、護照': 'Add an item, e.g. noodles, face masks, passport', '＋新增第一樣': '＋ Add the first item',
    '記數量': 'Count', '有／快用完／沒了': 'Have / low / out', '有': 'Have', '快用完': 'Low', '沒了': 'Out', '增加': 'More', '減少': 'Less', '從抽屜刪除': 'Delete from drawer',
    '這裡沒有東西。': 'Nothing here.', '請先到首頁或衣櫃新增一個家': 'Add a home first from Overview or Wardrobe', '抽屜物品': 'Drawer items',
    '個': 'pcs', '包': 'pack', '支': 'pcs', '條': 'pcs', '片': 'pcs', '瓶': 'bottle', '盒': 'box', '罐': 'can', '雙': 'pair', '項': 'items', '份': 'pcs', '件': 'pcs', '本': 'pcs', '組': 'set',
    '每個家放了哪些行李箱。打包時從這裡選這趟要用哪一個。': 'The luggage at each home. Choose which one to use when you pack.', '新增行李箱': 'Add luggage', '編輯行李箱': 'Edit luggage',
    '刪除這個行李箱': 'Delete this luggage', '已新增行李箱': 'Luggage added', '空箱重量': 'Empty weight', '新增尺寸': 'Add size', '新增材質': 'Add material', '新增款式': 'Add style',
    '長按可以刪除': 'Press and hold to delete', '箱子裡還有東西，請先拿出來或換到別的箱子': 'This case is not empty — take things out or move them first',
    '還沒有家。到「家 → 衣櫃」新增衣服時可以新增家。': 'No homes yet. You can add one when adding clothes in Homes → Wardrobe.', '加入照片（選填）': 'Add photo (optional)',
    '例如：灰色大箱、RIMOWA 登機箱': 'e.g. grey large case, RIMOWA cabin', '例如 4.2': 'e.g. 4.2', '名字（選填）': 'Name (optional)', '換行李箱': 'Swap suitcase',
    '28 吋托運箱': '28" checked case', '20 吋登機箱': '20" cabin case', '後背包': 'Backpack', '硬箱': 'Hard shell', '布箱': 'Soft shell', '五五開': '50/50 split', '三七開': '30/70 split', '20 吋': '20"', '28 吋': '28"', '31 吋': '31"',
    '（已經選了這個的行李箱會保留原本的資料）': '(Luggage that already uses it keeps its value)', '🧳 跟著旅程出門': '🧳 Out with a trip', '未設定家': 'No home set', '📍 未設定家': '📍 No home set', '🧳 在行李裡': '🧳 In bags'
  });

  // ---------- 衣服的選項：大類、細項、顏色、花紋、季節、風格、用途、材質、帽型、鞋子 ----------
  add({
    '衣服': 'Clothing', '衣物': 'Clothing', '配件': 'Accessories', '帽子': 'Hats', '圍巾': 'Scarves', '洋裝': 'Dress', '連身': 'Jumpsuit',
    'T 恤': 'T-shirt', 'T恤': 'T-shirt', '帽T': 'Hoodie', '襯衫': 'Shirt', '背心': 'Tank top', '毛衣': 'Sweater', '針織衫': 'Knit top', '長袖上衣': 'Long-sleeve top',
    '長褲': 'Trousers', '牛仔褲': 'Jeans', '短褲': 'Shorts', '裙子': 'Skirt', '大衣': 'Coat', '羽絨衣': 'Down jacket', '羽絨外套': 'Down jacket', '長袖睡衣': 'Long pajamas', '短袖睡衣': 'Short pajamas',
    '高跟鞋': 'Heels', '平底鞋': 'Flats', '運動鞋': 'Sneakers', '靴子': 'Boots', '細跟': 'Stiletto', '粗跟': 'Block heel', '楔型鞋': 'Wedges', '樂福鞋': 'Loafers', '芭蕾舞鞋': 'Ballet flats',
    '涼鞋': 'Sandals', '拖鞋': 'Slides', '休閒運動鞋': 'Casual sneakers', '跑步鞋': 'Running shoes', '走路鞋': 'Walking shoes', '網球鞋': 'Tennis shoes', '短靴': 'Ankle boots', '長靴': 'Tall boots',
    '馬靴': 'Riding boots', '雨靴': 'Rain boots', '皮鞋': 'Leather shoes', '鞋': 'Shoes',
    '棒球帽': 'Baseball cap', '漁夫帽': 'Bucket hat', '登山帽': 'Hiking hat', '毛帽': 'Beanie', '草帽': 'Straw hat', '貝雷帽': 'Beret', '紳士帽': 'Fedora',
    '耳環': 'Earrings', '項鍊': 'Necklace', '戒指': 'Ring', '手環': 'Bracelet', '手錶': 'Watch', '皮帶': 'Belt', '太陽眼鏡': 'Sunglasses', '包包': 'Bag', '其他配件': 'Other accessory',
    '黑': 'Black', '白': 'White', '灰': 'Grey', '米': 'Beige', '咖啡': 'Brown', '藍': 'Blue', '海軍藍': 'Navy', '綠': 'Green', '紅': 'Red', '粉紅': 'Pink', '黃': 'Yellow', '紫': 'Purple', '橘': 'Orange',
    '金色': 'Gold', '銀色': 'Silver', '玫瑰金': 'Rose gold', '珍珠白': 'Pearl white', '雙色（金銀）': 'Two-tone (gold/silver)', '黑色': 'Black', '白色': 'White', '咖啡色': 'Brown',
    '淺棕色': 'Tan', '深棕色': 'Dark brown', '紅色': 'Red', '藍色': 'Blue', '綠色': 'Green', '米色': 'Beige', '深藍': 'Dark blue', '酒紅': 'Burgundy', '多色': 'Multicolor',
    '玳瑁色': 'Tortoiseshell', '透明': 'Clear', '金框': 'Gold frame', '銀框': 'Silver frame', '紅框': 'Red frame', '綠框': 'Green frame', '紫框': 'Purple frame',
    '素色': 'Solid', '條紋': 'Stripes', '格紋': 'Check', '碎花': 'Floral', '印花': 'Print', '圓點': 'Dots', '點點': 'Dots', '迷彩': 'Camo', '圖案': 'Graphic',
    '春': 'Spring', '夏': 'Summer', '秋': 'Autumn', '冬': 'Winter', '休閒': 'Casual', '正式': 'Formal', '運動': 'Sport', '度假': 'Resort', '上班': 'Work',
    '日常': 'Everyday', '跑步': 'Running', '走路': 'Walking', '網球': 'Tennis', '騎馬': 'Riding', '雨天': 'Rain', '登山': 'Hiking',
    '薄': 'Light', '厚': 'Heavy', '針織': 'Knit', '喀什米爾': 'Cashmere', '皮革': 'Leather', '金屬': 'Metal', '布／尼龍': 'Fabric / nylon', '矽膠': 'Silicone', '布面': 'Fabric',
    '短': 'Short', '標準': 'Standard', '長': 'Long', '泳衣': 'Swimwear', '運動服': 'Sportswear'
  });

  // ---------- 抽屜品類、常見物品 ----------
  add({
    '保健食品與藥品': 'Supplements & medicine', '臉部、身體、手部': 'Face, body, hands', '證件文件': 'Documents', '電子產品': 'Electronics', '盥洗用品': 'Toiletries',
    '騎馬、打網球等活動用品': 'Gear for riding, tennis and more', '護照、現金、信用卡、簽證、衣服、鞋子配件': 'Passport, cash, cards, visa, clothes, shoes, accessories',
    '藥品': 'Medicine', '伴手禮': 'Souvenir gifts', '面膜': 'Face masks', '維他命': 'Vitamins', '乳液': 'Lotion', '毛巾': 'Towel', '雨傘': 'Umbrella', '筆電': 'Laptop',
    '相機': 'Camera', '平板': 'Tablet', '口罩': 'Face masks', '濕紙巾': 'Wet wipes', '衛生紙': 'Tissues', '牙膏': 'Toothpaste', '刮鬍刀': 'Razor', '分裝瓶': 'Travel bottles'
  });

  // ---------- 購物、送禮 ----------
  add({
    '剩餘公斤數': 'Remaining', '買之前先試算': 'Check before you buy', '這件大約多重': 'Approx. weight', '輸入重量，先算算看': 'Enter a weight to check',
    '＋ 記一筆購物': '＋ Log a purchase', '記一筆購物': 'Log a purchase', '購物紀錄': 'Purchases', '這趟還沒有購物紀錄。': 'No purchases on this trip yet.',
    '買了什麼': 'What did you buy', '在哪個城市買': 'Bought in', '之後放到哪個家': 'Goes to home', '抵達那個家整理行李時會提醒': 'We will remind you when you unpack there',
    '＋ 加照片': '＋ Add photo', '放進哪個行李': 'Which bag', '放進哪個行李？': 'Which bag?', '不放進行李': 'Not in bags', '不放進行李，不會扣剩餘公斤數': 'Not in bags — does not count against your weight',
    '刪除這筆紀錄': 'Delete this purchase', '編輯購物紀錄': 'Edit purchase', '已記下：': 'Logged: ', '在哪個城市買的？': 'Where did you buy it?', '例如 ฿350': 'e.g. ฿350',
    '不在行李裡': 'Not in bags', '已經超重了': 'Already over the limit', '這趟還沒設定額度': 'No allowance set for this trip', '（超重了）': '(over the limit)', '買了：': 'Bought: ',
    '這趟的禮物': "This trip's gifts", '依送禮對象': 'By recipient', '＋ 新增禮物': '＋ Add gift', '新增禮物': 'Add gift', '編輯禮物': 'Edit gift', '刪除這個禮物': 'Delete this gift',
    '禮物名稱': 'Gift', '送給誰': 'For', '在哪個城市送': 'Give in', '在哪個城市送？': 'Where will you give it?', '從哪裡來': 'Source', '從家裡帶': 'From home', '旅途中買': 'Bought on the trip',
    '從抽屜挑（「禮物」品類）': 'From drawer ("Gifts" category)', '想買': 'To buy', '已買好': 'Bought', '已送出': 'Given', '送出': 'Give', '已新增禮物': 'Gift added',
    '請輸入禮物名稱': 'Please name the gift', '還沒決定送誰': 'Recipient not decided', '未填對象': 'No recipient', '這趟還沒有禮物。可以先記下想買的。': 'No gifts on this trip yet. Note what you want to buy.',
    '還沒有送禮紀錄。': 'No gifts yet.', '抽屜裡還沒有「禮物」品類的東西。': 'Your drawer has no items in "Gifts".', '例如：媽媽、王經理': 'e.g. Mom, Mr. Wang', '例如：鳳梨酥、茶葉': 'e.g. pineapple cakes, tea',
    '名稱和重量跟抽屜那件一樣，要改請到「家 → 抽屜」。': 'Name and weight follow the drawer item — edit them in Homes → Drawer.', '未命名旅程': 'Untitled trip',
    '先新增一趟旅程，就能記錄購物和禮物': 'Add a trip to log purchases and gifts', '請先新增一趟旅程': 'Please add a trip first', '已買好：': 'Bought: ',
    '旅途中買給自己的': 'Things you buy for yourself on the trip', '要帶去送人的': 'Things to give away', '衣服、鞋子、帽子和配件': 'Clothes, shoes, hats and accessories',
    '保養品、電線這些出門會帶的東西': 'Skincare, cables and other travel items', '已經送出': 'Already given', '給': 'for'
  });

  // ---------- 整理行李 ----------
  add({
    '整理行李': 'Unpack & repack', '這次不用整理': 'Skip this time', '稍後再整理': 'Later', '全部留下': 'Leave all', '全部帶走': 'Take all', '留下': 'Leave', '繼續帶走': 'Keep packed',
    '行李裡沒有東西。': 'Your bags are empty.', '繼續用這個': 'Keep this one', '東西搬到這個家的另一個箱子，原本的箱子留在這裡': 'Move things into another case here and leave the original',
    '不整理行李嗎？行李裡的東西會維持「在行李裡」。': 'Skip unpacking? Everything stays in your bags.', '沒有行程時也可以手動移動': 'You can move things manually without a trip'
  });

  // ---------- 穿搭 ----------
  add({
    '每日穿搭': 'Outfits', '穿搭 ›': 'Outfit ›', '‹ 穿搭': '‹ Outfits', '換一套': 'Shuffle', '確定這套': 'Keep this look', '已確定・更新這套': 'Kept · Update look', '已確定這套': 'Look kept',
    '換了一套': 'Shuffled', '當天活動': 'Activities', '＋ 自己新增': '＋ Add your own', '新增一種活動': 'Add an activity', '日常逛街': 'City walk', '正式場合': 'Formal',
    '長途飛行': 'Long flight', '海邊': 'Beach', '這幾件可以不帶': 'You can leave these', '加入打包清單': 'Add to packing list', '往年平均': 'Seasonal average',
    '往年平均（約略）': 'Seasonal average (approx.)', '可能下雨': 'Rain likely', '還沒有天氣資料': 'No weather yet', '不穿外套': 'No jacket', '不搭配': 'None',
    '固定這件': 'Lock this piece', '取消固定': 'Unlock', '已固定這件': 'Piece locked', '已取消固定': 'Piece unlocked', '上一件': 'Previous', '下一件': 'Next',
    '改成上衣＋下身': 'Switch to top + bottom', '改成洋裝': 'Switch to dress', '要加帶': 'Add to bag', '這趟要帶': 'Packing', '看這天的穿搭': "See this day's outfit",
    '搭配這天的穿搭': "Style this day's outfit", '先填上航班日期，就能看每一天的穿搭': "Add flight dates to see each day's outfit", '填寫航班': 'Add flights',
    '確定後，這套用到的衣服會加進這趟的打包清單（已經在清單裡的不會重複；在有家城市的衣服不用帶）。': 'When you keep a look, its pieces go on this trip’s packing list (no duplicates; pieces already at a home stay there).',
    '可能下雨，避開不適合雨天的鞋子': 'Rain likely — skipping shoes that do not suit rain', '正式場合，選正式風格': 'Formal — dressing up', '長途飛行，選舒適的': 'Long flight — keeping it comfortable',
    '已從打包清單移除': 'Removed from packing list', '已加入打包清單：': 'Added to packing list: '
  });

  // ---------- 歡迎頁、第一次使用、範例提示 ----------
  add({
    'Carry My Own 介紹': 'About Carry My Own', '只帶真正需要的，不再超重。': 'Carry only what matters. Never overweight.', '每個家都有的，就不用再帶。': 'If every home has it, leave it behind.',
    '少幾件衣服，多幾套穿搭。': 'Fewer pieces, more looks.', '輕裝出發，優雅抵達。': 'Travel light, arrive elegant.', '闔上的直立行李箱': 'A closed upright suitcase',
    '台北和東京的家，各有一支牙刷和一瓶乳液': 'Homes in Taipei and Tokyo, each with a toothbrush and lotion', '上衣、長褲、鞋子三件，搭出六套': 'A top, trousers and shoes make six looks',
    '只帶登機行李的登機證，台北到成田': 'A carry-on-only boarding pass from Taipei to Narita', '再看一次介紹': 'View intro again', '再看一次範例': 'View sample again',
    '這是幫你規劃行李重量的小工具：記下每個家有哪些東西、每趟旅程帶什麼，隨時知道行李還能放幾公斤。': 'A small tool for luggage weight: note what each home has and what each trip needs, and always know how much room is left.',
    '你有哪些家？': 'Where are your homes?', '所在城市': 'City', '請輸入所在城市': 'Please enter the city', '請填這個家的所在城市': 'Please enter the city for this home',
    '輸入家的所在城市，可以新增多個，例如「台北」「東京」。家的名字可以自己取（例如「我的公寓」「爸媽家」），不填就用城市名稱。之後也能在右上角帳號裡修改。': 'Enter the city of each home — add as many as you like. You can name a home (e.g. "My flat", "Parents’ place"); otherwise the city is used. Change them later in Account.',
    '常搭的航空公司和行李額度': 'Your usual airline and allowance', '選填。新增旅程時會先幫你填好，每段航班還是可以改。': 'Optional. New trips start with these, and you can change each flight.',
    '常用的行李箱': 'Your usual luggage', '選填。點一下選擇，會放在你的第一個家；之後在「家 → 行李箱」可以補上尺寸、空箱重量。': 'Optional. Tap to choose; it goes to your first home. Add sizes and empty weights later in Homes → Luggage.',
    '設定好了，先新增一趟旅程吧': 'All set — now add a trip', '要打開範例資料看看嗎？': 'Open the sample data?',
    '範例只在這台裝置，你自己的資料不會受影響；看完按最上方的「清除範例」就回來。': 'The sample stays on this device and does not touch your data. Tap "Clear sample" at the top to come back.',
    '要清除範例資料，開始使用嗎？': 'Clear the sample and start?', '已新增家：': 'Home added: ', '已改名': 'Renamed', '所在城市：': 'City: ', '找不到這個家': 'Home not found', '還沒有家。': 'No homes yet.',
    '城市': 'City', '改名': 'Rename', '這趟還能放多少': 'How much room is left', '打包、購物、禮物都會自動算進來，快滿、超重會標示提醒。': 'Packing, shopping and gifts are counted automatically — we flag when it is almost full or over.',
    '每個家有什麼': 'What each home has', '衣服放衣櫃、其他東西放抽屜；家裡已經有的，出門就不用再帶。': 'Clothes in the wardrobe, everything else in the drawer. If it is already there, leave it behind.',
    '隨時新增': 'Add anytime', '新增衣服、抽屜物品、記一筆購物或禮物，都從這裡開始。': 'Add clothes, drawer items, purchases or gifts from here.',
    '先列清單，再打勾': 'List first, then tick', '打勾就是放進行李，行李的進度條會即時更新；往左滑或按「編輯」可以刪除。': 'Ticking an item packs it and updates the bars. Swipe left or tap "Edit" to delete.',
    '每一段航班的額度': 'Allowance for every flight', '填好航班和行李額度，到了有家的城市會提醒你整理行李。點一趟旅程，看每一天的穿搭。': 'Add flights and allowances; we remind you to repack when you reach a home. Tap a trip to see each day’s outfit.',
    '每天穿什麼': 'What to wear each day', '點這裡用衣櫃的衣服搭配，搭好的會自動加進打包清單。': 'Tap here to style a look from your wardrobe — it goes on your packing list automatically.'
  });

  // ---------- 帳號、雲端、備份 ----------
  add({
    '登入': 'Sign in', '登出': 'Sign out', '登入雲端': 'Sign in', '註冊新帳號': 'Create account', '密碼': 'Password', '忘記密碼': 'Forgot password', '設定新密碼': 'Set new password',
    '至少 6 個字': 'At least 6 characters', '請輸入 Email': 'Please enter your email', '請先在上面輸入 Email': 'Enter your email above first', 'Email 格式不正確': 'Invalid email',
    'Email 或密碼不正確': 'Incorrect email or password', '密碼至少要 6 個字': 'Password must be at least 6 characters', '密碼已更新': 'Password updated', '登入中…': 'Signing in…',
    '註冊中…': 'Creating account…', '登出中…': 'Signing out…', '登入成功，開始同步': 'Signed in — syncing', '註冊成功，已登入': 'Account created — signed in',
    '這個 Email 已經註冊過了，請直接登入': 'This email already has an account — please sign in', '這個帳號還沒確認，請先到信箱點確認連結': 'Please confirm your account from the email we sent',
    '請到信箱點信裡的連結確認帳號，再回到這裡用 Email 和密碼登入。': 'Open the link in your email to confirm, then sign in here.', '點信裡的連結後，會請你輸入新密碼。': 'The link in the email lets you set a new password.',
    '嘗試太多次了，請稍等幾分鐘再試': 'Too many attempts — please wait a few minutes', '未登入雲端': 'Not signed in', '已同步': 'Synced', '同步中…': 'Syncing…', '立即同步': 'Sync now',
    '準備同步…': 'Preparing to sync…', '檢查同步中…': 'Checking sync…', '離線中，有網路後會自動同步': 'Offline — will sync when you are back online', '連不上雲端，有網路後會自動再試': 'Cannot reach the cloud — will retry when online',
    '雲端暫時無法使用': 'Cloud unavailable', '雲端功能暫時無法使用（可能沒有網路）。資料仍安全地存在這台裝置，有網路後重新整理即可。': 'Cloud is unavailable (maybe offline). Your data is safe on this device; refresh when you are online.',
    '同步衝突太多次，請稍後再試': 'Too many sync conflicts — please try again later', '還有修改沒有上傳到雲端': 'Some changes have not been uploaded yet', '資料都已經同步到雲端。': 'Everything is synced.',
    '要登出嗎？': 'Sign out?', '現在沒有網路，沒辦法同步。': 'You are offline, so we cannot sync.', '請連上網路後再登出，避免資料遺失。': 'Please go online before signing out so nothing is lost.',
    '登出後會清掉這台裝置上的資料和照片暫存，畫面改成範例資料；雲端的資料會保留，重新登入就會全部回來。': 'Signing out clears data and photos on this device and shows the sample. Your cloud data stays — sign in to get it all back.',
    '登出時會先確認資料都已同步，再清掉這台裝置上的資料；雲端的資料會保留。': 'We check everything is synced before clearing this device. Your cloud data stays.',
    '按「確定」先同步，同步完成後再登出；': 'Tap OK to sync first and then sign out;', '按「取消」取消登出。': 'tap Cancel to stay signed in.', '按「取消」不登出。': 'Tap Cancel to stay signed in.',
    '按「取消」會登出。': 'Tap Cancel to sign out.', '按「確定」仍然登出：還沒同步的資料會先保留在這台裝置（畫面不會顯示），下次在這台裝置登入時自動同步，不會遺失。': 'Tap OK to sign out anyway: unsynced data is kept on this device (hidden) and syncs the next time you sign in here.',
    '請先按最上方的「清除範例，開始使用」回到你的資料，再登出。': 'Tap "Clear sample and start" at the top to return to your data before signing out.',
    '現在是範例資料，不會同步到雲端；清除範例後就會回到你自己的資料。': 'This is sample data and does not sync. Clear the sample to return to your own data.',
    '現在顯示的是範例資料；登入後會換成你自己的資料，範例不會上傳。': 'You are seeing sample data. Sign in to see your own; the sample is never uploaded.',
    '登入後，資料和照片會存到雲端，換裝置也看得到。第一次登入時，這台裝置的資料會自動上傳，不會遺失。': 'Once signed in, your data and photos are saved to the cloud and available on every device. The first sign-in uploads this device’s data safely.',
    '這台裝置上的資料，之前是和另一個帳號同步的。': 'The data on this device was synced with another account before.', '這台裝置還沒有和雲端同步過': 'This device has not synced yet',
    '照片上傳後在雲端找不到，下次再試': 'Photo upload could not be verified — will retry', '照片大小不符，下次再試': 'Photo size mismatch — will retry',
    '雲端資料表還沒建立，請先在 Supabase 執行設定 SQL': 'Cloud table not set up — run the setup SQL in Supabase', '雲端權限設定不正確，請重新執行設定 SQL': 'Cloud permissions are wrong — run the setup SQL again',
    '照片空間 item-photos 還沒建立，請先在 Supabase 執行照片設定 SQL': 'Photo storage is not set up — run the photo SQL in Supabase', '還有照片沒從雲端刪除': 'Some photos are still being removed from the cloud',
    '匯出備份': 'Export backup', '匯入備份': 'Import backup', '下載備份檔': 'Download backup', '準備中…': 'Preparing…', '備份失敗，請再試一次': 'Backup failed — please try again',
    '備份檔準備好了，請點「下載備份檔」': 'Your backup is ready — tap "Download backup"', '這不是行李規劃的備份檔': 'This is not a Carry My Own backup', '還原完成，重新載入中…': 'Restored — reloading…',
    '空間不足，無法還原': 'Not enough space to restore', '部分照片無法還原，可能是空間不足': 'Some photos could not be restored (low storage)', '有登入雲端的話，還原後會再和雲端同步。': 'If you are signed in, it will sync after restoring.',
    '行李箱設定': 'Luggage settings', '常帶物品': 'Frequent items', '還沒有記錄。新增過的物品會自動記在這裡，下次點一下就能帶入。': 'Nothing yet. Items you add appear here for one-tap reuse.',
    '無法儲存（瀏覽器可能在私密模式）': 'Could not save (private browsing?)', '這台裝置沒辦法開範例（可能是私密瀏覽）': 'Cannot open the sample on this device (private browsing?)', '不明時間': 'Unknown time'
  });

  // ---------- 補充：拆開的片段、活動、單位 ----------
  add({
    '游泳': 'Swimming', '登山健行': 'Hiking', '季節': 'Season', '拿出來': 'Take out', '改成要帶': 'Pack instead', '要有外套': 'bring a jacket',
    '選正式風格': 'dress up', '選舒適的': 'keep it comfortable', '避開不適合雨天的鞋子': 'skip shoes that do not suit rain',
    '這趟還能放': 'Left on this trip:', '清單全部放進去後約': 'after packing the list, about', '買了之後還剩': 'Left after this:',
    '每份': 'each', '每個': 'each', '每個／每包': 'each / per pack', '每個或每包': 'each or per pack', '含隨身小包': 'incl. pouch', '在': 'at',
    '依上一趟': 'From your last trip', '結束後回到的家帶入': '— starting from the home you returned to', '帶出': 'taken out', '裡面': 'inside',
    '已送出 ›': 'Given ›', '已買好 ›': 'Bought ›', '放進行李 ›': 'Pack ›', '重量（每份）': 'Weight (each)', '重量（每個）': 'Weight (each)',
    '重量（每個／每包）': 'Weight (each / per pack)', '重量（每個或每包）': 'Weight (each or per pack)', '停留': 'Stay', '這次抵達': 'This arrival',
    '下一段': 'Next flight', '抵達': 'Arrive', '回到': 'Back to', '紀念品': 'Souvenirs', '件': 'items'
  });

  // ---------- 句型（含數字、日期、名稱）：依序比對，第一個符合的就用 ----------
  var W = { '日': 'Sun', '一': 'Mon', '二': 'Tue', '三': 'Wed', '四': 'Thu', '五': 'Fri', '六': 'Sat' };
  var M = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function md(m, d) { return M[+m] + ' ' + (+d); }
  function R(re, fn) { window.LANG.en.rules.push([re, fn]); }
  // 日期：11/20（四）→ Thu, Nov 20；區間 12/10 – 12/17（四）→ Dec 10 – Thu, Dec 17
  R(/^(\d{1,2})\/(\d{1,2})（([日一二三四五六])）$/, function (m, tr) { return W[m[3]] + ', ' + md(m[1], m[2]); });
  R(/^(\d{1,2})\/(\d{1,2})（([日一二三四五六])）\s*[–～〜-]\s*(\d{1,2})\/(\d{1,2})（([日一二三四五六])）$/, function (m, tr) { return W[m[3]] + ', ' + md(m[1], m[2]) + ' – ' + W[m[6]] + ', ' + md(m[4], m[5]); });
  R(/^(\d{1,2})\/(\d{1,2})\s*[–～〜-]\s*(\d{1,2})\/(\d{1,2})（([日一二三四五六])）$/, function (m, tr) { return md(m[1], m[2]) + ' – ' + W[m[5]] + ', ' + md(m[3], m[4]); });
  R(/^(\d{4}) 年 (\d{1,2}) 月$/, function (m, tr) { return M[+m[2]] + ' ' + tr(m[1]); });
  R(/^(\d{4}) 年$/, function (m, tr) { return m[1]; });
  R(/^(\d{1,2}) 月$/, function (m, tr) { return M[+m[1]]; });
  R(/^(\d{1,2})月$/, function (m) { return M[+m[1]]; });
  R(/^(\d{1,2})\/(\d{1,2})（([日一二三四五六])）\s+(.+)$/, function (m, tr) { return W[m[3]] + ', ' + md(m[1], m[2]) + ' · ' + tr(m[4]); });
  R(/^(\d{1,2})\/(\d{1,2})\s+(.+)$/, function (m, tr) { return md(m[1], m[2]) + ' ' + tr(m[3]); });
  R(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/, function (m, tr) { return m[1] + ' ' + tr(m[2]); });
  // 數量
  R(/^(\d+) 件$/, function (m, tr) { return tr(m[1]) + (m[1] === '1' ? ' item' : ' items'); });
  R(/^(\d+) 項$/, function (m, tr) { return tr(m[1]) + (m[1] === '1' ? ' item' : ' items'); });
  R(/^(\d+) 份$/, function (m, tr) { return tr(m[1]) + (m[1] === '1' ? ' gift' : ' gifts'); });
  R(/^(\d+) 天$/, function (m, tr) { return tr(m[1]) + (m[1] === '1' ? ' day' : ' days'); });
  R(/^(\d+) 段航班$/, function (m, tr) { return tr(m[1]) + (m[1] === '1' ? ' flight' : ' flights'); });
  R(/^(\d+) 套$/, function (m, tr) { return tr(m[1]) + (m[1] === '1' ? ' look' : ' looks'); });
  R(/^共 (\d+) 件$/, function (m, tr) { return tr(m[1]) + ' pieces'; });
  R(/^全部 ?(\d+)$/, function (m, tr) { return 'All ' + tr(m[1]); });
  R(/^(.+?) (\d+)$/, function (m, tr) { var a = tr(m[1]); return a === m[1] ? null : a + ' ' + tr(m[2]); });   // 分頁：上衣 5
  R(/^入境 (\d+) 天$/, function (m, tr) { return 'Stay ' + tr(m[1]) + (m[1] === '1' ? ' day' : ' days'); });
  R(/^(\d+) 天・編輯 ›$/, function (m, tr) { return tr(m[1]) + ' days · Edit ›'; });
  R(/^第 (\d+) 段$/, function (m, tr) { return 'Flight ' + tr(m[1]); });
  R(/^轉機 (\d+) 小時 (\d+) 分$/, function (m, tr) { return 'Layover ' + tr(m[1]) + 'h ' + tr(m[2]) + 'm'; });
  R(/^(\d+) 小時 (\d+) 分$/, function (m, tr) { return tr(m[1]) + 'h ' + tr(m[2]) + 'm'; });
  R(/^(\d+) 小時$/, function (m, tr) { return tr(m[1]) + 'h'; });
  R(/^(\d+) 分$/, function (m, tr) { return tr(m[1]) + 'm'; });
  R(/^([\d.]+) \/ ([\d.]+) 公斤(，(.+))?$/, function (m, tr) { return m[1] + ' / ' + m[2] + ' kg' + (m[4] ? ', ' + tr(m[4]).toLowerCase() : ''); });
  R(/^([\d.]+) 公斤(，(.+))?$/, function (m, tr) { return m[1] + ' kg' + (m[3] ? ', ' + tr(m[3]).toLowerCase() : ''); });
  R(/^例如 (.+)$/, function (m) { return 'e.g. ' + m[1]; });
  R(/^版本 (.+)$/, function (m) { return 'Version ' + m[1]; });
  R(/^移到 (.+)$/, function (m, tr) { return 'Move to ' + tr(m[1]); });
  R(/^裡面 (\d+) 件$/, function (m) { return m[1] + (m[1] === '1' ? ' item inside' : ' items inside'); });
  R(/^含空箱 (.+)$/, function (m) { return 'incl. empty case ' + m[1]; });
  R(/^停留 (.+)$/, function (m, tr) { return 'Stay ' + tr(m[1]); });
  R(/^(\d+) 天 (\d+) 小時 (\d+) 分$/, function (m) { return m[1] + 'd ' + m[2] + 'h ' + m[3] + 'm'; });
  R(/^(\d+) 天 (\d+) 小時$/, function (m) { return m[1] + 'd ' + m[2] + 'h'; });
  R(/^約\s?([\d.]+\s?k?g)／(.+)$/, function (m, tr) { return '≈ ' + m[1] + ' / ' + tr(m[2]); });
  R(/^＋ 在(.+)新增行李箱$/, function (m, tr) { return '＋ Add luggage at ' + tr(m[1]); });
  // 行李、打包
  R(/^已放進(.+)$/, function (m, tr) { return 'Packed in ' + tr(m[1]); });
  R(/^已移到(.+?)：(.+)$/, function (m, tr) { return 'Moved to ' + tr(m[1]) + ': ' + tr(m[2]); });
  R(/^已移除「(.+)」$/, function (m, tr) { return 'Removed "' + tr(m[1]) + '"'; });
  R(/^已移除 (\d+) 項$/, function (m, tr) { return 'Removed ' + tr(m[1]) + ' items'; });
  R(/^已加入(.+?)：(.+)$/, function (m, tr) { return 'Added to ' + tr(m[1]) + ': ' + tr(m[2]); });
  R(/^和(.+)共用$/, function (m, tr) { return 'shared with ' + tr(m[1]).toLowerCase(); });
  R(/^會超重 ([\d.]+) kg$/, function (m, tr) { return 'Over by ' + tr(m[1]) + ' kg'; });
  R(/^(.+)・(.+)$/, null);   // 佔位：用「・」分開的交給下面的分段處理
  R(/^這件在(衣櫃|抽屜)裡：名稱和重量會一起更新；數量和放哪個行李只改這趟。$/, function (m, tr) { return 'This is in your ' + (m[1] === '衣櫃' ? 'wardrobe' : 'drawer') + ': name and weight update there too; quantity and bag only change this trip.'; });
  R(/^必帶：還有 (\d+) 項沒打勾$/, function (m, tr) { return 'Essentials: ' + tr(m[1]) + ' not ticked'; });
  R(/^還沒收好（(\d+) 件）$/, function (m, tr) { return 'Not packed yet (' + tr(m[1]) + ')'; });
  R(/^常帶但這次沒放進清單（(\d+) 件）$/, function (m, tr) { return 'Usually packed but missing (' + tr(m[1]) + ')'; });
  R(/^「(.+)」放進(.+)會超重 ([\d.]+) kg。$/, function (m, tr) { return '"' + tr(m[1]) + '" would put ' + tr(m[2]) + ' over by ' + tr(m[3]) + ' kg.'; });
  R(/^「(.+)」標記為只能手提，確定要放到托運嗎？$/, function (m, tr) { return '"' + tr(m[1]) + '" is carry-on only. Put it in checked anyway?'; });
  R(/^「(.+)」已經收好了，要從清單刪除並從行李拿出來嗎？$/, function (m, tr) { return '"' + tr(m[1]) + '" is packed. Remove it from the list and your bags?'; });
  R(/^要把「(.+)」從必帶清單刪除嗎？$/, function (m, tr) { return 'Remove "' + tr(m[1]) + '" from essentials?'; });
  R(/^放哪個行李（現在：(.+)）$/, function (m, tr) { return 'Which bag (now: ' + tr(m[1]) + ')'; });
  R(/^刪除：(.+)$/, function (m, tr) { return 'Delete: ' + tr(m[1]); });
  R(/^(.+) 還沒放進去$/, function (m, tr) { return tr(m[1]) + ' not packed yet'; });
  R(/^提醒：放進(.+)會超重 ([\d.]+) kg$/, function (m, tr) { return 'Heads up: ' + tr(m[1]) + ' would be over by ' + tr(m[2]) + ' kg'; });
  R(/^已經放進行李 (\d+) 項・看「行李」 ›$/, function (m, tr) { return tr(m[1]) + ' packed · See Bags ›'; });
  R(/^(\d+) 項建議$/, function (m, tr) { return tr(m[1]) + ' suggestions'; });
  R(/^新增了 (\d+) 項建議$/, function (m, tr) { return 'Added ' + tr(m[1]) + ' suggestions'; });
  // 預留空間、首頁
  R(/^預留空間 已用 ([\d.]+) \/ ([\d.]+) kg( ›|・修改 ›)?$/, function (m, tr) { return 'Reserved space · ' + tr(m[1]) + ' / ' + tr(m[2]) + ' kg used' + (m[3] ? (m[3] === ' ›' ? ' ›' : ' · Edit ›') : ''); });
  R(/^設定預留空間( ›)?$/, function (m, tr) { return 'Set reserved space' + (m[1] || ''); });
  R(/^預留空間：([\d.]+) kg$/, function (m, tr) { return 'Reserved space: ' + tr(m[1]) + ' kg'; });
  R(/^「(.+)」的預留空間$/, function (m, tr) { return 'Reserved space for "' + tr(m[1]) + '"'; });
  R(/^這趟的預留空間$/, function () { return 'Reserved space for this trip'; });
  R(/^([\d.]+) kg・算在(.+)額度$/, function (m, tr) { return tr(m[1]) + ' kg · in ' + tr(m[2]).toLowerCase() + ' allowance'; });
  R(/^([\d.]+) kg・不計算$/, function (m, tr) { return tr(m[1]) + ' kg · not counted'; });
  R(/^最緊：(.+)$/, function (m, tr) { return 'Tightest: ' + tr(m[1]); });
  R(/^這裡有 (\d+) 份禮物要送$/, function (m, tr) { return tr(m[1]) + ' gifts to give here'; });
  // 購物、禮物
  R(/^買了之後還剩 ([\d.-]+) 公斤(（超重了）)?$/, function (m, tr) { return tr(m[1]) + ' kg left after this' + (m[2] ? ' (over the limit)' : ''); });
  R(/^之後放(.+)$/, function (m, tr) { return 'then to ' + tr(m[1]); });
  R(/^給 (.+)$/, function (m, tr) { return 'for ' + tr(m[1]); });
  R(/^已帶回(.+)的家$/, function (m, tr) { return 'Taken home to ' + tr(m[1]); });
  R(/^📍 已放到(.+)$/, function (m, tr) { return '📍 Left at ' + tr(m[1]); });
  R(/^(\d+) 件・([\d.]+) kg$/, function (m, tr) { return tr(m[1]) + ' items · ' + tr(m[2]) + ' kg'; });
  R(/^(\d+) 項・在行李裡 ([\d.]+) kg$/, function (m, tr) { return tr(m[1]) + ' items · ' + tr(m[2]) + ' kg in bags'; });
  R(/^(\d+) 份・已送 (\d+)$/, function (m, tr) { return tr(m[1]) + ' gifts · ' + tr(m[2]) + ' given'; });
  R(/^已記成禮物：(.+)$/, function (m, tr) { return 'Saved as a gift: ' + tr(m[1]); });
  R(/^已送出，行李少了 (.+)$/, function (m, tr) { return 'Given — your bags are ' + tr(m[1]) + ' lighter'; });
  R(/^「(.+)」已經送給(.+)了嗎？會從行李拿出來。$/, function (m, tr) { return 'Did you give "' + tr(m[1]) + '" to ' + tr(m[2]) + '? It will come out of your bags.'; });
  R(/^「(.+)」已經送出了嗎？會從行李拿出來。$/, function (m, tr) { return 'Did you give "' + tr(m[1]) + '"? It will come out of your bags.'; });
  R(/^要刪除購物紀錄「(.+)」嗎？（也會從行李拿出來）$/, function (m, tr) { return 'Delete the purchase "' + tr(m[1]) + '"? (It will also come out of your bags)'; });
  R(/^要刪除禮物「(.+)」嗎？（也會從行李拿出來）$/, function (m, tr) { return 'Delete the gift "' + tr(m[1]) + '"? (It will also come out of your bags)'; });
  R(/^在(.+)有 (\d+) 項禮物要送$/, function (m, tr) { return tr(m[2]) + ' gifts to give in ' + tr(m[1]); });
  R(/^依最緊的一段「(.+)」$/, function (m, tr) { return 'Based on the tightest flight "' + tr(m[1]) + '"'; });
  // 穿搭
  R(/^這 (\d+) 件衣服，可以搭出 (\d+) 套$/, function (m, tr) { return 'These ' + tr(m[1]) + ' pieces make ' + tr(m[2]) + ' looks'; });
  R(/^這$/, function () { return 'These'; });
  R(/^件衣服，可以搭出$/, function () { return 'pieces make'; });
  R(/^套$/, function () { return 'looks'; });
  R(/^清單上的衣服共 (.+)$/, function (m, tr) { return 'Clothes on the list: ' + tr(m[1]); });
  R(/^這趟還能放 (.+)$/, function (m, tr) { return tr(m[1]) + ' left on this trip'; });
  R(/^清單全部放進去後約 (.+)$/, function (m, tr) { return 'about ' + tr(m[1]) + ' after packing the list'; });
  R(/^從打包清單移除（(\d+) 件）$/, function (m, tr) { return 'Remove from packing list (' + tr(m[1]) + ')'; });
  R(/^多帶「(.+)」，可以多 (\d+) 套$/, function (m, tr) { return 'Bring "' + tr(m[1]) + '" for ' + tr(m[2]) + ' more looks'; });
  R(/^在(.+)的家・不用帶$/, function (m, tr) { return 'At your ' + tr(m[1]) + ' home · no need to pack'; });
  R(/^(.+)有家：那裡的衣服也能穿、不用帶$/, function (m, tr) { return 'Home in ' + tr(m[1]) + ': wear what is there, no need to pack'; });
  R(/^(-?\d+)°C，要有外套$/, function (m, tr) { return tr(m[1]) + '°C — bring a jacket'; });
  R(/^已確定這套，加了 (\d+) 件到打包清單$/, function (m, tr) { return 'Look kept — ' + tr(m[1]) + ' pieces added to your packing list'; });
  R(/^已從打包清單移除 (\d+) 件$/, function (m, tr) { return 'Removed ' + tr(m[1]) + ' pieces from your packing list'; });
  R(/^要把這 (\d+) 件從打包清單移除嗎？$/, function (m, tr) { return 'Remove these ' + tr(m[1]) + ' pieces from your packing list?'; });
  R(/^DAY (\d+)$/, null);
  // 整理行李
  R(/^已抵達(.+)的家（(.+)）$/, function (m, tr) { return 'Arrived at ' + tr(m[1]) + ' (' + tr(m[2]) + ')'; });
  R(/^旅程結束，回到(.+)的家（(.+)）$/, function (m, tr) { return 'Trip over — back at ' + tr(m[1]) + ' (' + tr(m[2]) + ')'; });
  R(/^(.+)：整理一下行李，決定哪些留下、哪些帶走$/, function (m, tr) { return tr(m[1]) + ': repack — choose what stays and what comes along'; });
  R(/^整理好了：留下 (\d+) 件、新放進行李 (\d+) 件(.*)$/, function (m, tr) { return 'Done: ' + tr(m[1]) + ' left, ' + tr(m[2]) + ' packed'; });
  // 行程
  R(/^目前所在地(.+)$/, function (m, tr) { return 'Currently in ' + tr(m[1]); });
  R(/^要刪除旅程「(.+)」嗎？/, function (m, tr) { return 'Delete the trip "' + tr(m[1]) + '"?'; });
  R(/^🏠 之後回到(.+)$/, function (m, tr) { return '🏠 Then home to ' + tr(m[1]); });
  R(/^(.+) 起$/, function (m, tr) { return 'from ' + tr(m[1]); });
  R(/^🏠 出發地(.+)有家$/, function (m, tr) { return '🏠 Home in ' + tr(m[1]); });
  R(/^🏠 (.+)有家：可換行李箱或寄放東西$/, function (m, tr) { return '🏠 Home in ' + tr(m[1]) + ': swap suitcases or leave things'; });
  // 共通：「…」包起來的名字不翻
  R(/^已經有「(.+)」了$/, function (m, tr) { return '"' + tr(m[1]) + '" already exists'; });
  R(/^要刪除「(.+)」嗎？$/, function (m, tr) { return 'Delete "' + tr(m[1]) + '"?'; });
  R(/^要從抽屜刪除「(.+)」嗎？/, function (m, tr) { return 'Delete "' + tr(m[1]) + '" from your drawer?'; });
  R(/^要從衣櫃刪除「(.+)」嗎？/, function (m, tr) { return 'Delete "' + tr(m[1]) + '" from your wardrobe?'; });
  R(/^已加入：(.+)$/, function (m, tr) { return 'Added: ' + tr(m[1]); });
  R(/^已改成要帶：(.+)$/, function (m, tr) { return 'Now packing: ' + tr(m[1]); });
  R(/^已取消：(.+)$/, function (m, tr) { return 'Unpacked: ' + tr(m[1]); });
  R(/^已移回「清單」：(.+)$/, function (m, tr) { return 'Moved back to List: ' + tr(m[1]); });
  R(/^已新增家：(.+)$/, function (m, tr) { return 'Home added: ' + tr(m[1]); });
  R(/^已登入：(.+)$/, function (m, tr) { return 'Signed in: ' + tr(m[1]); });
  R(/^同步失敗：(.+)$/, function (m, tr) { return 'Sync failed: ' + tr(m[1]); });
  R(/^登出失敗：(.+)$/, function (m, tr) { return 'Sign-out failed: ' + tr(m[1]); });
  R(/^已寄出確認信到 (.+?)。?$/, function (m, tr) { return 'Confirmation email sent to ' + tr(m[1]); });
  R(/^已寄出重設密碼的信到 (.+?)。?$/, function (m, tr) { return 'Password reset email sent to ' + tr(m[1]); });
  // 參考重量的提示
  add({ '參考': 'Based on', '的大約重量': 'typical weight', '秤過之後可以直接改成實際重量。': 'Weigh it and update anytime.',
    '這是參考重量，秤過之後可以直接改成實際重量。': 'This is a typical weight — weigh it and update anytime.', '使用你記錄的重量': 'Using your recorded weight' });

  // 確認視窗
  R(/^要刪除第 (\d+) 段（(.+)）嗎？$/, function (m, tr) { return 'Remove flight ' + m[1] + ' (' + tr(m[2]) + ')?'; });
  R(/^要把「(.+)」從行李拿出來嗎？（這趟不帶了）$/, function (m, tr) { return 'Take "' + tr(m[1]) + '" out of your bags? (Not this trip)'; });
  R(/^要把「(.+)」從行李拿出來嗎？$/, function (m, tr) { return 'Take "' + tr(m[1]) + '" out of your bags?'; });

  R(/^「(.+)」在哪個城市？（用來判斷抵達哪個家）$/, function (m, tr) { return 'Which city is "' + tr(m[1]) + '" in? (Used to detect when you arrive)'; });
  R(/^「(.+)」改成$/, function (m, tr) { return 'Rename "' + tr(m[1]) + '" to'; });
  R(/^要刪除「(.+)」這個家嗎？$/, function (m, tr) { return 'Delete the home "' + tr(m[1]) + '"?'; });
  R(/^這個行李不在這趟的打包清單上。要把「(.+)」從行李拿出來嗎？$/, function (m, tr) { return 'This bag is not on this trip\u2019s list. Take "' + tr(m[1]) + '" out of your bags?'; });
  R(/^「(.+)」已經打包在(.+)，還要再放一次嗎？$/, function (m, tr) { return '"' + tr(m[1]) + '" is already packed in ' + tr(m[2]) + '. Add it again?'; });
  R(/^「(.+)」已打包在(.+)。$/, function (m, tr) { return '"' + tr(m[1]) + '" is packed in ' + tr(m[2]) + '.'; });
  R(/^要從常帶物品移除「(.+)」嗎？照片和標籤也會一起刪除，衣櫃裡也會看不到。$/, function (m, tr) { return 'Remove "' + tr(m[1]) + '" from frequent items? Its photo and tags will be deleted and it will leave your wardrobe.'; });
  R(/^(.+)這個家已經有「(.+)」了，還是要再新增一筆嗎？$/, function (m, tr) { return '"' + tr(m[2]) + '" is already at ' + tr(m[1]) + '. Add another one?'; });
  R(/^「(.+)」現在在行李裡。要從行李拿出來，改放在「(.+)」嗎？$/, function (m, tr) { return '"' + tr(m[1]) + '" is in your bags. Take it out and keep it at "' + tr(m[2]) + '"?'; });
  R(/^要把「(.+)」移到「(.+)」嗎？$/, function (m, tr) { return 'Move "' + tr(m[1]) + '" to "' + tr(m[2]) + '"?'; });
  R(/^要把「(.+)」從衣櫃刪除嗎？照片也會一起刪除。$/, function (m, tr) { return 'Delete "' + tr(m[1]) + '" from your wardrobe? Its photo will be deleted too.'; });
  R(/^要刪除自己加的選項「(.+)」嗎？$/, function (m) { return 'Delete your option "' + m[1] + '"?'; });
  R(/^要刪除行李箱「(.+)」嗎？$/, function (m, tr) { return 'Delete the luggage "' + tr(m[1]) + '"?'; });
  R(/^這次抵達(.+)不整理行李嗎？行李裡的東西會維持「在行李裡」。$/, function (m, tr) { return 'Skip unpacking at ' + tr(m[1]) + '? Everything stays in your bags.'; });
  R(/^要刪除「(.+)」這筆送禮紀錄嗎？$/, function (m, tr) { return 'Delete the gift record "' + tr(m[1]) + '"?'; });
  R(/^要刪除旅程「(.+)」嗎？$/, function (m, tr) { return 'Delete the trip "' + tr(m[1]) + '"?'; });
  R(/^・購物 (\d+) 筆$/, function (m) { return '· ' + m[1] + ' purchases'; });
  R(/^・禮物 (\d+) 份$/, function (m) { return '· ' + m[1] + ' gifts'; });
  R(/^・打包清單 (\d+) 項$/, function (m) { return '· ' + m[1] + ' packing items'; });
  R(/^要把這些資料合併到目前登入的帳號（(.*)）嗎？$/, function (m) { return 'Merge this data into the account you are signed in with (' + m[1] + ')?'; });
  R(/^要用 (.+) 的備份，取代這台裝置上目前的資料嗎？$/, function (m, tr) { return 'Replace the data on this device with the backup from ' + tr(m[1]) + '?'; });
  R(/^（照片 (\d+) 張）$/, function (m) { return '(' + m[1] + ' photos)'; });
  add({
    '所有航班段都會一起刪除，這趟的資料也會一起刪除：': 'All its flights and data will be deleted:',
    '（已經放進某個家的購物和禮物，物品會留在那個家；已經放進行李的衣服和抽屜物品會留在行李裡）': '(Purchases and gifts already left at a home stay there; clothes and drawer items in your bags stay in your bags)',
    '（已經放進行李的會保留在行李清單裡）': '(Anything already in your bags stays on the bag list)', '（已經放進行李的那件會保留在行李清單裡）': '(The one already in your bags stays on the bag list)',
    '還有資料沒有同步到雲端': 'Some data has not synced yet', '同步沒有完成': 'Sync did not finish', '新增尺寸': 'Add size', '新增材質': 'Add material', '新增款式': 'Add style'
  });

  // 整理行李、抵達
  add({ '已抵達': 'Arrived at', '下一站': 'Next stop', '購': 'Bought', '旅途中買的': 'Bought on the trip', '放進': 'Pack', '帶走': 'Take' });
  R(/^的家（(.+)）$/, function (m, tr) { return ' (' + tr(m[1]) + ')'; });
  R(/^的家$/, function () { return ''; });
  R(/^抵達(.+)的家$/, function (m, tr) { return 'arriving at ' + tr(m[1]); });
  R(/^留在(.+)$/, function (m, tr) { return 'Leave at ' + tr(m[1]); });
  R(/^(.+)的衣櫃和抽屜裡的物品（勾選要帶去下一站的）$/, function (m, tr) { return 'Wardrobe and drawer at ' + tr(m[1]) + ' (tick what comes along)'; });
  R(/^(.+)的衣櫃和抽屜裡目前沒有東西。$/, function (m, tr) { return 'Nothing in the wardrobe or drawer at ' + tr(m[1]) + '.'; });
  R(/^留下 (\d+) 件$/, function (m) { return m[1] + ' staying'; });
  R(/^繼續帶走 (\d+) 件$/, function (m) { return m[1] + ' coming along'; });
  R(/^新放進行李 (\d+) 件$/, function (m) { return m[1] + ' newly packed'; });
  R(/^旅程結束，回到(.+)$/, function (m, tr) { return 'Trip over — back at ' + tr(m[1]); });
  R(/^下一段：(.+)$/, function (m, tr) { return 'Next flight: ' + tr(m[1]); });

  // 最後才比對的通用句型（前面都不符合時）
  R(/^在(.+)$/, function (m, tr) { var t = tr(m[1]); return 'At ' + t; });
  R(/^從(.+)帶出$/, function (m, tr) { return 'from ' + tr(m[1]); });
  R(/^從(.+)$/, function (m, tr) { return 'from ' + tr(m[1]); });
  R(/^(.+?)\s*›$/, function (m, tr) { var t = tr(m[1]); return t === m[1] ? null : t + ' ›'; });
})();
