/**
 * 建立「AI 使用情況小調查」A 版（公開市調）Google 表單
 *
 * 用法：
 * 1. 打開 https://script.google.com ，按「新專案」
 * 2. 把編輯器裡原本的內容全部刪掉，貼上這整份程式碼，按儲存（磁碟圖示）
 * 3. 上方選單確認選的是 createSurveyA，按「執行」
 * 4. 第一次會要求授權：選你的帳號 → 若出現「Google 尚未驗證這個應用程式」，按「進階」→「前往（不安全）」→「允許」
 * 5. 跑完後，下方「執行紀錄」會列出：填答連結、編輯連結、回覆試算表，以及每個管道的專屬連結
 *
 * 要改管道名稱，改下面 CHANNELS 這一段就好（只執行一次；重跑會再建一份新的表單）。
 */

// 每個發送管道一個專屬連結，答案會自動記下來源。可以自行增減。
var CHANNELS = [
  'A-社群',
  'A-活動',
  'A-社團',
];

function createSurveyA() {
  var form = FormApp.create('AI 使用情況小調查');
  form.setDescription(
    '您好，我們正在做一份 AI 使用情況的小調查，想了解大家平常怎麼使用 AI，以及工作上有哪些需要。' +
    '問卷共 7 題，大約 1 分鐘就能完成。最後一題可以留下聯絡方式，我們會把調查結果寄給您。'
  );
  form.setCollectEmail(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage('感謝您撥空填寫。如果有留下聯絡方式，調查結果整理好後會寄給您。');

  // 第 1 題
  form.addTextItem()
    .setTitle('1. 您是做哪一行的？')
    .setRequired(true);

  // 第 2 題
  form.addMultipleChoiceItem()
    .setTitle('2. 您平常用 AI 的經驗大概是哪一種？')
    .setChoiceValues([
      '沒用過',
      '用過幾次，例如問過 ChatGPT 問題',
      '工作上偶爾會用',
      '幾乎每天用',
      '有付費訂閱 AI 服務（例如 ChatGPT Plus）',
    ])
    .setRequired(true);

  form.addTextItem()
    .setTitle('（選填）如果有付費訂閱 AI 服務，目前訂了幾套？')
    .setHelpText('請填數字，例如 2')
    .setValidation(FormApp.createTextValidation().requireNumber().build());

  // 第 3 題
  form.addMultipleChoiceItem()
    .setTitle('3. 平常工作中，哪一件事最花時間？')
    .setChoiceValues(['跟客戶介紹產品', '寫貼文、公告、通知', '做宣傳影片'])
    .showOtherOption(true)
    .setRequired(true);

  // 第 4 題
  form.addMultipleChoiceItem()
    .setTitle('4. 平常工作上，比較常用手機還是電腦？')
    .setChoiceValues(['幾乎都用手機', '手機電腦差不多', '幾乎都用電腦'])
    .setRequired(true);

  // 第 5 題
  form.addCheckboxItem()
    .setTitle('5. 您最希望 AI 幫您做什麼？（可複選）')
    .setChoiceValues(['寫產品介紹或簡報', '寫貼文、公告、通知', '做宣傳圖片或影片'])
    .showOtherOption(true)
    .setRequired(true);

  // 第 6 題
  form.addMultipleChoiceItem()
    .setTitle('6. 您的年紀大約是？')
    .setChoiceValues(['24 歲以下', '25～34 歲', '35～44 歲', '45～54 歲', '55 歲以上'])
    .setRequired(true);

  // 第 7 題（選填）
  form.addTextItem()
    .setTitle('7.（選填）想收到這份調查的結果，或之後有免費 AI 實作課時收到通知嗎？歡迎留下 LINE 或 Email')
    .setHelpText('您留下的聯絡方式，只用於寄送調查結果與課程通知，不會提供給第三方。不需要的話，留白即可。');

  // 來源代碼：用專屬連結打開時會自動帶入
  var sourceItem = form.addTextItem()
    .setTitle('問卷代碼（自動帶入，請勿修改）');

  // 回覆自動存到一份新的試算表
  var sheet = SpreadsheetApp.create('AI 使用情況小調查（A 版）回覆');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  // 確保表單是開放填答的狀態
  try { form.setPublished(true); } catch (e) {}
  form.setAcceptingResponses(true);

  Logger.log('填答連結（一般）：' + form.getPublishedUrl());
  Logger.log('編輯連結：' + form.getEditUrl());
  Logger.log('回覆試算表：' + sheet.getUrl());
  CHANNELS.forEach(function (code) {
    var url = form.createResponse()
      .withItemResponse(sourceItem.createResponse(code))
      .toPrefilledUrl();
    Logger.log(code + ' 專屬連結：' + url);
  });
}
