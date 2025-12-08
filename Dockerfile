# 使用 Node.js 20 輕量版映像檔
FROM node:20-slim

# 設定工作目錄
WORKDIR /usr/src/app

# 複製 package.json 並安裝依賴
COPY package*.json ./
RUN npm install --only=production

# 複製 Node.js 程式碼
COPY . .

# Cloud Run 會注入 PORT 環境變數，我們的 server.js 監聽 PORT 8080，這在 Cloud Run 中會自動對應。
# server.js 中的 process.env.PORT || 8080 會自動被 Cloud Run 的環境變數覆寫
EXPOSE 8080 

# 啟動應用程式
CMD [ "npm", "start" ]
