/**
 * AIチームリーダー - 設定ファイル
 */
const CONFIG = {
  SHEET_NAME: "TaskData",
  MEMBERS: [
    { 
      name: "メンバーA", 
      listName: "AIハッカソン_2026年02月_memA", 
      chatWebhook: "", // Webhookが使えない場合は空でOK
      email: "sssmina218@gmail.com" // ここにメールアドレスを入力(テスト用)
    },
    { 
      name: "メンバーB", 
      listName: "AIハッカソン_2026年02月_memB", 
      chatWebhook: "", 
      email: "sssmina218@gmail.com" // ここにメールアドレスを入力(テスト用)
    }
  ],
  MANAGER_CHAT_WEBHOOK: "", // マネージャー用チャットルームURL (任意)
};

// Step 2 でデプロイした Cloud Functions の URL
const CLOUD_FUNCTION_URL = "https://analyze-tasks-114501038678.asia-northeast1.run.app";