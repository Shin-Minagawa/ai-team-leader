AI Team Leader - 新人マネージャーのためのセーフティネット🌟 プロジェクト概要新任マネージャーにとって、メンバーの「見えない疲れ」や「タスクの停滞」を早期に察知するのは非常に困難です。「AI Team Leader」は、メンバーが普段利用している Google Tasks のログを、Google Cloud上の Vertex AI (Gemini 1.5 Flash) で高度に分析します。単なる進捗管理ではなく、**「生活リズムの夜型化」や「特定タスクの停滞傾向」**を時系列で検知し、マネージャーには「今、かけるべき言葉」と「1on1の打診案」を、メンバーには「パーソナライズされた励まし」を自動通知する、チームのセーフティネットシステムです。🏗 システム構成図graph TD
    subgraph MembersDevice ["メンバーの環境"]
        User[メンバー] -->|タスク完了| Tasks[Google Tasks]
    end

    subgraph Workspace ["Google Workspace (管理・集計)"]
        Tasks -->|API同期| GAS[Google Apps Script]
        GAS -->|日次サマリー生成| GSS[(Google Sheets)]
    end

    subgraph Cloud ["Google Cloud (AI分析基盤)"]
        GAS -->|分析リクエスト| CF[Cloud Functions Python]
        CF -->|長期トレンド推論| VertexAI[Vertex AI Gemini 1.5 Flash]
        VertexAI -->|JSONレスポンス| CF
        CF -->|結果返却| GAS
    end

    subgraph ManagersDevice ["マネージャーの環境"]
        GAS -->|ダッシュボード提供| WebApp[React Dashboard]
        GAS -->|自動通知| Email[Gmail / Notification]
    end
🚀 技術的なこだわりデータの高密度圧縮: 3ヶ月分の全タスクログをそのままAIに投げるとトークンを消費しすぎるため、GAS側で「時間帯分布」や「週次統計」に加工してからVertex AIに渡すアーキテクチャを採用しました。GASの制約（6分の壁）の回避: 重い推論処理をCloud Functionsに切り出すことで、スケーラビリティと安定性を確保しています。実用的なアクション誘導: 分析して終わりではなく、そのままメンバーに送れる「メール/Chat送信機能」を実装し、マネージャーの行動を直接サポートします。🛠 使用技術Frontend: React (SPA), Tailwind CSS, RechartsBackend Logic: Google Apps ScriptAI Brain: Vertex AI (Gemini 1.5 Flash)Infrastructure: Cloud Functions (Gen 2 / Python 3.11)Interface: Google Tasks API📁 ディレクトリ構造/google-apps-script: ダッシュボードUIおよびデータ同期ロジック/cloud-functions: Gemini 1.5 Flash を呼び出す推論API🔗 セットアップgoogle-apps-script/ 配下のファイルをGASプロジェクトに配置し、Tasks APIを有効化。cloud-functions/ をGoogle Cloudにデプロイし、そのURLをGASの config.gs に設定。