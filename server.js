const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
// 1. 伺服器運行的端口號
const PORT = process.env.PORT || 8080;
// 2. 從環境變數中安全地讀取 API Key (部署時設定，例如在 Vercel)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("錯誤: GEMINI_API_KEY 環境變數未設定。請設定後再啟動伺服器。");
    process.exit(1);
}

// --- 啟用 CORS 與 HTTP 健康檢查 ---
app.use((req, res, next) => {
    // 允許任何來源連線
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.get('/', (req, res) => {
    res.send('Gemini Live Proxy is running.');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- 處理客戶端 WebSocket 連線 (核心代理邏輯) ---
wss.on('connection', (clientWs) => {
    console.log('Client connected from browser.');

    // 建立與 Google Live API 的連線
    const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
    let geminiWs = new WebSocket(geminiWsUrl);
    
    let isGeminiConnected = false;

    geminiWs.on('open', () => {
        isGeminiConnected = true;
        console.log('Proxy connected to Gemini Live API.');
    });

    // 接收來自 Gemini 的數據 (Native Audio 或 JSON) 並轉發給客戶端
    geminiWs.on('message', (data, isBinary) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data, { binary: isBinary });
        }
    });

    // 接收來自客戶端的數據 (麥克風 PCM 或 Setup JSON) 並轉發給 Gemini
    clientWs.on('message', (data) => {
        if (isGeminiConnected && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(data);
        }
    });

    // 處理連線關閉
    clientWs.on('close', () => {
        console.log('Client disconnected.');
        if (geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.close();
        }
    });

    geminiWs.on('error', (error) => {
        console.error('Gemini WS Error:', error);
        clientWs.send(JSON.stringify({ error: 'Gemini API 連線失敗或中斷' }));
        clientWs.close();
    });
});

server.listen(PORT, () => {
    console.log(`Proxy server listening on port ${PORT}`);
});
