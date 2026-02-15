/**
 * AIチームリーダー - バックエンド (確実なメール通知版)
 */

/**
 * 毎日定時に実行するためのトリガー関数
 * マネージャーには全体レポート、メンバーには個別のAIアドバイスをメールします
 */
function dailyNotificationJob() {
  const analysisResult = getDashboardData();
  if (!analysisResult || analysisResult.error) {
    console.error("分析データの取得に失敗したため、通知をスキップしました。");
    return;
  }

  // 1. マネージャーへの通知 (自分のアドレスに届きます)
  const managerEmail = Session.getActiveUser().getEmail(); 
  let managerSubject = "📊 【AIチームリーダー】本日のチーム分析レポート";
  let managerBody = "本日の分析結果です。\n\n" + analysisResult.managerView.overallSummary + "\n\n";
  managerBody += "⚠️ リスク確認推奨:\n";
  analysisResult.managerView.memberRisks.forEach(function(r) {
    managerBody += "・" + r.name + " (" + r.riskLevel + "): " + r.reason + "\n";
  });
  managerBody += "\n個別のアクションはダッシュボードから実行してください。";

  try {
    MailApp.sendEmail(managerEmail, managerSubject, managerBody);
    console.log("マネージャー宛メール送信完了");
  } catch(e) {
    console.error("メール送信失敗: " + e.toString());
  }

  // 2. 各メンバーへの個別通知
  CONFIG.MEMBERS.forEach(function(member) {
    const mView = analysisResult.memberViews[member.name];
    if (mView && member.email) {
      const subject = "📢 【AIリーダー】本日のフィードバック (" + member.name + "さん)";
      let body = member.name + "さん、お疲れ様です。\nAIが分析した今日のアドバイスをお届けします。\n\n";
      body += "💡 アドバイス:\n" + mView.advice + "\n\n";
      body += "📈 現在の完了率: " + mView.stats.completionRate + "%\n";
      
      if (mView.postponedTasks && mView.postponedTasks.length > 0) {
        body += "\n⚠️ いくつかのタスクが停滞しているようです。何かあれば気軽にマネージャーに相談してくださいね！";
      }

      try {
        MailApp.sendEmail(member.email, subject, body);
        console.log(member.name + "宛メール送信完了");
      } catch(e) {
        console.warn(member.name + "へのメール送信に失敗しました。アドレスを確認してください。");
      }
    }
  });
}

/**
 * フロントエンドの「打診を送信」ボタンから呼ばれる関数
 */
function sendActionNotification(memberName, messageText) {
  const member = CONFIG.MEMBERS.find(function(m) { return m.name === memberName; });
  if (!member || !member.email) {
    return { error: "メンバーのメールアドレスが設定されていません。" };
  }

  const subject = "🤝 【AIリーダー】1on1ミーティングの打診";
  const body = memberName + "さん、お疲れ様です。\n\n" + messageText + "\n\n--- AI Team Leader 自動送信 ---";
  
  try {
    MailApp.sendEmail(member.email, subject, body);
    return { success: true };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * 分析用データの取得と集計の統合
 */
function getDashboardData() {
  try {
    syncAndSummarize();
    var allAnalysisData = CONFIG.MEMBERS.map(function(member) {
      return {
        name: member.name,
        payload: {
          dailyStats: getHistoricalSummary(member.name),
          recentIssues: getRecentProblemTasks(member.name)
        }
      };
    });
    
    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ teamData: allAnalysisData }),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(CLOUD_FUNCTION_URL, options);
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    } else {
      throw new Error("AI分析エラー: " + response.getContentText());
    }
  } catch (e) {
    console.error(e.toString());
    return { error: e.toString() };
  }
}

/**
 * 以下、既存のデータ集計ロジックを維持
 */
const SUMMARY_SHEET_NAME = "DailySummary";

function syncAndSummarize() {
  CONFIG.MEMBERS.forEach(function(member) {
    syncGoogleTasksToSheet(member.name, member.listName);
  });
  updateDailySummary();
}

function updateDailySummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sourceSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = ss.insertSheet(SUMMARY_SHEET_NAME);
    summarySheet.appendRow(["Date", "Member", "Total", "Completed", "Postpones", "AvgHour", "Morning", "Afternoon", "Evening", "Night"]);
  }
  var data = sourceSheet.getDataRange().getValues();
  data.shift(); 
  var stats = {};
  data.forEach(function(row) {
    var member = row[0];
    var status = row[3];
    var finDate = row[5] ? new Date(row[5]) : null;
    var postpone = row[6] || 0;
    var syncDate = row[7] ? new Date(row[7]) : new Date();
    var dateKey = Utilities.formatDate(syncDate, "JST", "yyyy-MM-dd");
    var key = dateKey + "_" + member;
    if (!stats[key]) {
      stats[key] = { date: dateKey, member: member, total: 0, comp: 0, post: 0, hrs: [], m: 0, a: 0, e: 0, n: 0 };
    }
    stats[key].total++;
    if (status === 'completed') {
      stats[key].comp++;
      if (finDate) {
        var h = finDate.getHours();
        stats[key].hrs.push(h);
        if (h >= 5 && h <= 11) stats[key].m++;
        else if (h >= 12 && h <= 17) stats[key].a++;
        else if (h >= 18 && h <= 21) stats[key].e++;
        else stats[key].n++;
      }
    }
    stats[key].post += postpone;
  });
  summarySheet.clearContents();
  summarySheet.appendRow(["Date", "Member", "Total", "Completed", "Postpones", "AvgHour", "Morning", "Afternoon", "Evening", "Night"]);
  var output = [];
  for (var k in stats) {
    var s = stats[k];
    var avgH = s.hrs.length > 0 ? (s.hrs.reduce(function(a,b){return a+b;},0)/s.hrs.length).toFixed(1) : "";
    output.push([s.date, s.member, s.total, s.comp, s.post, avgH, s.m, s.a, s.e, s.n]);
  }
  if (output.length > 0) summarySheet.getRange(2, 1, output.length, 10).setValues(output);
}

function getHistoricalSummary(memberName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUMMARY_SHEET_NAME);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(function(row) { return row[1] === memberName; }).slice(-90).map(function(row) {
    return { d: row[0], c: row[3], p: row[4], h: row[5], m: row[6], a: row[7], e: row[8], n: row[9] };
  });
}

function getRecentProblemTasks(memberName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(function(row) { return row[0] === memberName && row[3] !== 'completed' && row[6] > 0; }).map(function(row) { return { t: row[2], p: row[6] }; });
}

function syncGoogleTasksToSheet(memberName, listName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(["Member", "ID", "Title", "Status", "Due", "FinishedAt", "Postpones", "LastSynced"]);
  }
  var targetListId = getTaskListIdByName(listName);
  var tasks = [];
  try {
    var taskList = Tasks.Tasks.list(targetListId, { showCompleted: true, showHidden: true });
    if (taskList.items) tasks = taskList.items;
  } catch (e) { return; }
  var existingData = sheet.getDataRange().getValues();
  existingData.shift(); 
  var taskMap = {};
  existingData.forEach(function(row, index) { taskMap[row[1] + "_" + row[0]] = { rowIndex: index + 2, data: row }; });
  var now = new Date();
  tasks.forEach(function(task) {
    var taskId = task.id;
    var currentDue = task.due ? new Date(task.due) : null;
    var key = taskId + "_" + memberName;
    if (taskMap[key]) {
      var prevRow = taskMap[key].data;
      var prevDue = prevRow[4] ? new Date(prevRow[4]) : null;
      var postponeCount = prevRow[6] || 0;
      var finishedAtRecord = prevRow[5];
      if (currentDue && prevDue && currentDue.getTime() > prevDue.getTime()) postponeCount++;
      if (task.status === 'completed' && !finishedAtRecord) finishedAtRecord = task.completed ? new Date(task.completed) : now;
      sheet.getRange(taskMap[key].rowIndex, 1, 1, 8).setValues([[memberName, taskId, task.title, task.status, currentDue, finishedAtRecord, postponeCount, now]]);
    } else {
      var finishedAt = (task.status === 'completed') ? (task.completed ? new Date(task.completed) : now) : null;
      sheet.appendRow([memberName, taskId, task.title, task.status, currentDue, finishedAt, 0, now]);
    }
  });
}

function getTaskListIdByName(name) {
  try {
    var taskLists = Tasks.Tasklists.list();
    if (taskLists.items) {
      var target = taskLists.items.find(function(list) { return list.title === name; });
      if (target) return target.id;
    }
  } catch (e) {}
  return "@default";
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('AI Team Leader Dashboard');
}