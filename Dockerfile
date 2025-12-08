# 基礎 Node.js 映像檔
FROM node:20-slim

# 設定工作目錄
WORKDIR /usr/src/app

# 複製 package.json 和安裝依賴
COPY package*.json ./
RUN npm install --only=production

# 複製應用程式原始碼
COPY . .

# Cloud Run 要求應用程式監聽 PORT 環境變數
# Node.js 程式 (server.js) 必須使用 process.env.PORT
ENV PORT 8080 

# 啟動應用程式
CMD [ "npm", "start" ]