# KISS ME x PuraVida 品牌行銷智能 Agent (AI Marketing Studio)

![Architecture](https://img.shields.io/badge/Architecture-React_SPA-blue)
![Orchestrator](https://img.shields.io/badge/Core_Engine-Gemini_3.1_Pro-amber)
![Data Tier](https://img.shields.io/badge/Database-Firebase_Firestore-sky)
![Compliance Shield](https://img.shields.io/badge/Compliance-Automatic_Cosmetics_Audit-emerald)

本專案為 **KISS ME** 與 **PuraVida** 打造專屬的 AI 品牌行銷自動化工作流系統（AIGC Marketing Agent），結合 Google Gemini 大語言模型與雙代理審查架構，幫助行銷人員從「產品受眾分析」到「跨渠道廣告素材」實現「高效率、高畫質、法規安全」的自動化編譯。

---

## 🌟 核心設計與體驗 (Core Design)

### 1. 沉浸式專屬品牌視覺 (Brand Identity)
- **客製化 SVG 品牌標識設計**：系統內嵌全新設計的 `<BrandLogo />` 向量化標籤，採用溫暖玫瑰粉至極光藍綠的漸層填色，象徵傳統保養美學與尖端 AI 科技的融合，不受網路與緩存限制，確保全平台清晰顯示。
- **美學化操作版面**：全面整合 `Tailwind CSS` 構建現代化卡片式高光介面（Glassmorphism），搭配流暢互動元件與字體排版，提供簡潔無壓的行銷操作體驗。
- **一鍵主題切換**：在生成高階企劃書時，系統支援雙軌品牌設計樣板（KISS ME 米白暖色系 / PuraVida 暗夜科技系），無縫接軌品牌識別。

### 2. 五大 AI 賦能工具 (AI Powertools)
系統內建全方位行銷面板，涵蓋文案到影音企劃的完整產出：
1. **文案生成**：運用 few-shot learning 根據產品規格與 TA 痛點，萃取並產生具備高度說服力的社群文案，支援一鍵複製文字與 JSON 結構。
2. **社群圖像生成**：自動提煉產品氛圍與情境，並藉由 Gemini 生成高品質可直接餵給生圖 AI (如 Midjourney) 的 Prompt 指令庫。
3. **影片腳本生成**：為 TikTok、IG Reels 等平台設計 30 秒滿版直式影音分鏡腳本，包含畫面運鏡、字卡排版及雙語語音提示。
4. **行銷企劃書生成**：將多維度資料一鍵統整為 A4 高保真互動報告，並利用 `html2pdf.js` 技術支援前端直印高畫質 PDF。
5. **系統工作流圖**：內建系統架構與 Coding 領域數據流圖解（Interactive System Architect Topology），公開展示雙代理人法規合規與 Firestore 本地同步技術細節。

---

## 🤖 系統運作與合規護城河 (Compliance & Workflow)

本系統落實三大階段工作流：**[ 第一階段: 數據載入 ] ➔ [ 第二階段: 智能生成與法規純化 ] ➔ [ 第三階段: 高清封裝匯出 ]**。

### 雙代理人審查與台灣化妝品法規校閱（Cosmetic Regulation Protection）
- **引擎架構**：整合 `@google/genai` 進行多模態提示詞推理。
- **過濾機制**：系統底層嚴格套用衛福部《化妝品標示宣傳廣告涉及虛偽誇大或醫療效能認定基準》，攔截所有醫療效能或神化誇大詞彙（如「隱形毛孔」、「徹底治癒暗沉」）。
- **自動修正**：在不改變 JSON 架構的情況下，引擎將自發性把敏感情境改寫為合法之商業替代表達（例如：「視覺上淡化毛孔」、「頂級長效持妝」），預防高昂行政罰單。

### 雲端擴展與本地緩存 (Cloud Data & Fallback)
- **Firebase Firestore 雲端同步**：系統全面套用 NoSQL (`products`, `taProfiles`, `productDetails` 等 Collections) 即時監聽與存儲，保證跨螢幕無縫接軌。
- **API 安全金鑰託管**：用戶自訂義的 Gemini API Key 將通過加密渠道配置，嚴格把關企業資訊安全。

---

## 💻 本地部署與開發指南 (Development)

在 AI Studio Sandbox 容器或本地端部署本服務：

1. **環境配置**
   請確保具備 `Node.js 18+` 與 `.env` 基礎變數。
2. **依賴安裝**
   ```bash
   npm install
   ```
3. **啟動全端系統**
   專案為 React SPA 架構，透過 Vite 啟動開發伺服器：
   ```bash
   npm run dev
   ```
4. **構建與上線**
   支援標準靜態導出產物，配合 Cloud Run 容器或 Firebase Hosting：
   ```bash
   npm run build
   ```

> **版權所有**：KISS ME x PuraVida 品牌行銷自動化工坊 & 技術工程部
> *Made with ❤️ for elegant, regulation-safe AI generating.*