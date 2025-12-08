const express = require('express');
const http = require('http');
const WebSocket = require('ws');
// 引入 URL 解析工具
const url = require('url'); 

const app = express();
const PORT = process.env.PORT || 8080;

// *** 部署時，請確保您的 Render 服務名稱是 'urbannnn' ***

// --- 啟用 CORS 與 HTTP 健康檢查 ---
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.get('/', (req, res) => {
    res.send('Gemini Live Proxy is running. Waiting for WSS connection...');
});

const server = http.createServer(app);

// 🚨 關鍵改變：啟用 verifyClient 檢查連線參數
const wss = new WebSocket.Server({ 
    server,
    verifyClient: (info, done) => {
        // 檢查客戶端連線 URL 是否有 API Key
        const parsedUrl = url.parse(info.req.url, true);
        const clientKey = parsedUrl.query.key;
        if (!clientKey || clientKey.length < 10) {
            console.error("Client attempted connection without a valid API key.");
            // 拒絕連線
            return done(false, 401, 'Unauthorized: API Key missing or invalid.');
        }
        // 將 Key 附加到請求中，供 wss.on('connection') 使用
        info.req.geminiKey = clientKey; 
        done(true); // 接受連線
    }
});


// --- 處理客戶端 WebSocket 連線 (核心代理邏輯) ---
wss.on('connection', (clientWs, req) => {
    const GEMINI_API_KEY = req.geminiKey; // 🚨 從客戶端連線 URL 中讀取 Key
    console.log(`Client connected. Using key: ${GEMINI_API_KEY.substring(0, 4)}...`);

    // 建立與 Google Live API 的連線，並將客戶端傳來的 Key 附上
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
        } else if (!isGeminiConnected) {
            // 如果 Gemini 連線尚未建立，客戶端應等待
            console.warn('Waiting for Gemini connection...');
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
