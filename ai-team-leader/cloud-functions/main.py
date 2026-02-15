import functions_framework
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
import json
import os

# プロジェクトIDを環境から取得
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT")
LOCATION = "asia-northeast1"

# Vertex AIの初期化
vertexai.init(project=PROJECT_ID, location=LOCATION)

@functions_framework.http
def analyze_tasks(request):
    if request.method == 'OPTIONS':
        headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }
        return ('', 204, headers)

    headers = {'Access-Control-Allow-Origin': '*'}

    try:
        request_json = request.get_json(silent=True)
        team_data = request_json.get('teamData', []) if request_json else []
        
        # モデル初期化
        model = GenerativeModel("gemini-2.5-flash")

        # プロンプトの改善：不完全な出力を防ぐための厳格な指示
        system_prompt = """
        あなたは新人マネージャーを支える「AIチームリーダー」です。
        提供されたデータを分析し、必ず完全なJSON形式のみで回答してください。
        解説やMarkdownの装飾(```jsonなど)は一切含めないでください。
        
        出力が途中で切れないよう、簡潔かつ要点を得た文章を心がけてください。

        {
          "managerView": {
            "overallSummary": "チーム全体の傾向とメンバー全員の変調への言及",
            "memberRisks": [ { "name": "名前", "riskLevel": "High", "reason": "根拠" } ],
            "recommendedActions": [ { "memberName": "名前", "type": "1on1", "priority": "High", "suggestion": "提案", "messageTemplate": "送信案" } ]
          },
          "memberViews": {
            "名前": {
              "stats": { "total": 0, "completed": 0, "completionRate": 0, "overdue": 0 },
              "advice": "個別の励まし",
              "timeTrend": [ {"name": "Morning", "count": 0}, {"name": "Afternoon", "count": 0}, {"name": "Evening", "count": 0}, {"name": "Night", "count": 0} ],
              "postponedTasks": [ {"name": "タスク名", "count": 0, "risk": "High"} ]
            }
          }
        }
        """
        
        user_prompt = f"Data: {json.dumps(team_data, ensure_ascii=False)}"

        generation_config = GenerationConfig(
            temperature=0.1,
            max_output_tokens=8192, # 出力枠を大きく確保し、途切れを防止
            response_mime_type="application/json"
        )
        
        response = model.generate_content([system_prompt, user_prompt], generation_config=generation_config)
        
        # 文字列が空でないことを確認
        if not response.text:
            raise ValueError("AIからの回答が空でした。")

        return (response.text, 200, headers)

    except Exception as e:
        print(f"Analysis Error: {str(e)}")
        return (json.dumps({"error": str(e)}), 500, headers)