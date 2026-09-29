import React, { useState } from 'react';
import { Settings, PenTool, LayoutTemplate, Video, Key, ChevronRight, Copy, Check, ImageIcon, Download, LogOut, GitMerge } from 'lucide-react';
import { useAuth, useApiKey, useProducts, useTaProfiles, useProductDetails, useImageStyles, useArchivedCopies, useMarketingSettings } from './hooks/useData';
import { SettingsModal } from './components/SettingsModal';
import { generateCopy, generateImagePrompt, ImagePromptResult, generateImageUrlFromPrompt, generateVideoScript, VideoScriptRow, generateMarketingProposal } from './lib/gemini';
import { auth } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import html2pdf from 'html2pdf.js';

const BrandLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E11D48" />
        <stop offset="100%" stopColor="#0D9488" />
      </linearGradient>
      <linearGradient id="roseGrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F472B6" />
        <stop offset="100%" stopColor="#BE123C" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="128" fill="url(#brandGrad)" />
    <path d="M256 100 C 150 100 100 200 100 300 C 100 400 200 400 256 350 C 312 400 412 400 412 300 C 412 200 362 100 256 100 Z" fill="white" opacity="0.1" />
    <path d="M256 130 C 180 130 130 230 150 330 C 170 380 230 380 256 330 C 282 380 342 380 362 330 C 382 230 332 130 256 130 Z" fill="url(#roseGrad)" opacity="0.9" />
    <text x="50%" y="56%" dominantBaseline="middle" textAnchor="middle" fill="white" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="160" letterSpacing="-4">KM</text>
    <circle cx="256" cy="400" r="12" fill="white" />
  </svg>
);

export default function App() {
  const { user: authUser, loading } = useAuth();

  // 若未登入，直接給予公開免登入訪客身分
  const user = authUser || {
    uid: "guest-demo-user",
    email: "demo@kissme-agent.com",
    displayName: "訪客體驗者"
  };
  
  // Utility to check if content is truly missing
  const isReallyMissing = (val: string) => {
    const t = (val || '').trim();
    return !t || t === '[]' || t === 'null';
  };

  const { apiKey, chatGptApiKey } = useApiKey(user?.uid);
  const { products } = useProducts(user?.uid);
  const { taProfiles } = useTaProfiles(user?.uid);
  const { productDetails } = useProductDetails(user?.uid);
  const { imageStyles } = useImageStyles(user?.uid);
  const { addArchivedCopy } = useArchivedCopies(user?.uid);
  const { settings, saveSettings } = useMarketingSettings(user?.uid);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'api' | 'products' | 'tas' | 'details' | 'styles' | 'archive' | 'downloads'>('api');
  const [activeMenu, setActiveMenu] = useState<'copy' | 'image' | 'video' | 'proposal' | 'workflow'>('copy');
  const [format, setFormat] = useState<'format1' | 'format2'>('format1');

  // Selections (Copy Generator)
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedTaId, setSelectedTaId] = useState('');
  const [useProductDetailsFlag, setUseProductDetailsFlag] = useState(false);

  // Selections (Image Generator)
  const [copyContent, setCopyContent] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState('');

  // Selections (Video Generator)
  const [videoCopyContent, setVideoCopyContent] = useState('');
  const [videoBrand, setVideoBrand] = useState<'KISSME' | 'PuraVida'>('KISSME');

  // Selections (Proposal Generator)
  const [proposalCopyText, setProposalCopyText] = useState('');
  const [proposalImageText, setProposalImageText] = useState('');
  const [proposalVideoText, setProposalVideoText] = useState('');

  // Workflow visualization state
  const [activeWorkflowNode, setActiveWorkflowNode] = useState<string>('input');

  // Generation State
  const [generatedCopyContent, setGeneratedCopyContent] = useState<any[]>([]);
  const [generatedImagePrompts, setGeneratedImagePrompts] = useState<ImagePromptResult[]>([]);
  const [generatedVideoScript, setGeneratedVideoScript] = useState<VideoScriptRow[]>([]);
  const [generatedProposal, setGeneratedProposal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [generatingImages, setGeneratingImages] = useState<{ [key: number]: boolean }>({});
  const [copied, setCopied] = useState(false);

  const handleLogin = () => {
    signInWithPopup(auth, new GoogleAuthProvider());
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      alert('請先於右上角設定 API Key');
      return;
    }
    if (!selectedProductId || (format === 'format1' && !selectedTaId)) {
      alert('請完成設定選擇以進行生成');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    const ta = format === 'format1' ? taProfiles.find(t => t.id === selectedTaId) : undefined;
    
    if (!product || (format === 'format1' && !ta)) return;

    let detailsText = '';
    if (useProductDetailsFlag || format === 'format2') {
      const details = productDetails.filter(d => d.productId === selectedProductId).map(d => d.details).join('\n');
      detailsText = details;
    }

    setIsGenerating(true);
    setGenerationStage('開始生成...');
    setGeneratedCopyContent([]);
    try {
      const result = await generateCopy(
        apiKey,
        format,
        product.productName,
        product.features,
        product.brand,
        ta?.ageGroup || '',
        ta?.description || '',
        ta?.painPoints || '',
        (stage) => setGenerationStage(stage),
        detailsText,
        {
          mode: settings?.mode || 'default',
          systemPrompt: settings?.customSystemPrompt || '',
          jsonFormat: settings?.customJsonFormat || '',
          languageModel: settings?.languageModel || 'gemma-4-31b-it'
        }
      );
      setGeneratedCopyContent(result || []);
    } catch (err: any) {
      console.error('Generation Error:', err);
      alert('生成失敗，再試一次或調整資料庫資料。\n錯誤詳情：' + (err.message || '未知錯誤'));
    } finally {
      setIsGenerating(false);
      setGenerationStage('');
    }
  };

  const handleGenerateImagePrompt = async () => {
    if (!apiKey) {
      alert('請先於右上角設定 API Key');
      return;
    }
    if (!copyContent || !selectedStyleId) {
      alert('請輸入文案內容並選擇產品圖像風格');
      return;
    }

    const style = imageStyles.find(s => s.id === selectedStyleId);
    if (!style) return;

    setIsGenerating(true);
    setGenerationStage('開始發想圖像構圖...');
    setGeneratedImagePrompts([]);
    try {
      const result = await generateImagePrompt(
        apiKey,
        copyContent,
        style.name,
        style.description,
        (stage) => setGenerationStage(stage),
        settings?.languageModel || 'gemma-4-31b-it'
      );
      setGeneratedImagePrompts(result || []);
    } catch (err: any) {
      console.error('Image Prompt Error:', err);
      alert('生成失敗，再試一次或調整資料庫資料。\n錯誤詳情：' + (err.message || '未知錯誤'));
    } finally {
      setIsGenerating(false);
      setGenerationStage('');
    }
  };

  const generateImageForPrompt = async (index: number, promptText: string) => {
    if (!apiKey) {
      alert('請先設定 API Key');
      return;
    }
    setGeneratingImages(prev => ({ ...prev, [index]: true }));
    try {
      const useGpt = settings?.imageModel === 'gpt-image-2';
      const keyToUse = useGpt ? chatGptApiKey : apiKey;
      
      if (useGpt && !chatGptApiKey) {
        alert('請先於設定中配置 ChatGPT API Key 以使用 GPT Image 模型');
        return;
      }

      const imageUrl = await generateImageUrlFromPrompt(keyToUse, promptText, settings?.imageModel || 'gemini-3.1-flash-image-preview');
      setGeneratedImagePrompts(prev => {
        const newPrompts = [...prev];
        newPrompts[index] = { ...newPrompts[index], imageUrl };
        return newPrompts;
      });
    } catch (err: any) {
      alert('生成圖片失敗: ' + err.message);
    } finally {
      setGeneratingImages(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleGenerateVideoScript = async () => {
    if (!apiKey) {
      alert('請先於右上角設定 API Key');
      return;
    }
    if (!videoCopyContent) {
      alert('請貼上社群文案內容');
      return;
    }

    setIsGenerating(true);
    setGenerationStage('開始產出影音腳本...');
    setGeneratedVideoScript([]);
    try {
      const result = await generateVideoScript(
        apiKey, 
        videoCopyContent,
        (stage) => setGenerationStage(stage),
        settings?.languageModel || 'gemma-4-31b-it'
      );
      setGeneratedVideoScript(result || []);
    } catch (err: any) {
      console.error('Video Script Error:', err);
      alert('生成失敗，再試一次或調整資料庫資料。\n錯誤詳情：' + (err.message || '未知錯誤'));
    } finally {
      setIsGenerating(false);
      setGenerationStage('');
    }
  };

  const handleGenerateProposal = async () => {
    if (!apiKey) {
      alert('請先於右上角設定 API Key');
      return;
    }
    if (!selectedProductId || !selectedTaId || !selectedStyleId) {
      alert('請完成產品、TA與圖像風格設定以進行生成');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    const ta = taProfiles.find(t => t.id === selectedTaId);
    const style = imageStyles.find(s => s.id === selectedStyleId);
    
    if (!product || !ta || !style) return;

    const missing = [];
    if (isReallyMissing(proposalCopyText)) missing.push('社群文案');
    if (isReallyMissing(proposalImageText)) missing.push('圖像提示詞');
    if (isReallyMissing(proposalVideoText)) missing.push('影片腳本');

    if (missing.length > 0) {
      const confirmMsg = `偵測到缺少以下內容：\n${missing.join('、')}\n\n是否要讓 AI 自動為您生成這些內容並填入企劃書？\n(這將消耗額外的 API 配額)`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    setIsGenerating(true);
    setGeneratedProposal('');
    setGenerationStage('開始整理企劃內容...');

    try {
      let finalCopyText = proposalCopyText;
      let finalImageText = proposalImageText;
      let finalVideoText = proposalVideoText;

      const product = products.find(p => p.id === selectedProductId);
      const ta = taProfiles.find(t => t.id === selectedTaId);
      const style = imageStyles.find(s => s.id === selectedStyleId);
      
      if (!product || !ta || !style) return;

      // Auto-generate missing parts
      if (isReallyMissing(finalCopyText)) {
        setGenerationStage('正在補齊：社群文案...');
        const details = productDetails.filter(d => d.productId === selectedProductId).map(d => d.details).join('\n');
        const res = await generateCopy(
          apiKey, 
          'format1', 
          product.productName, 
          product.features, 
          product.brand, 
          ta.ageGroup, 
          ta.description, 
          ta.painPoints,
          (s) => setGenerationStage(`案文生成中: ${s}`),
          details,
          {
            mode: settings?.mode || 'default',
            systemPrompt: settings?.customSystemPrompt || '',
            jsonFormat: settings?.customJsonFormat || '',
            languageModel: settings?.languageModel || 'gemma-4-31b-it'
          }
        );
        finalCopyText = JSON.stringify(res, null, 2);
        setProposalCopyText(finalCopyText);
        setGeneratedCopyContent(res);
      }

      if (isReallyMissing(finalImageText)) {
        setGenerationStage('正在補齊：圖像提示詞...');
        const res = await generateImagePrompt(apiKey, finalCopyText, style.name, style.description, undefined, settings?.languageModel || 'gemma-4-31b-it');
        finalImageText = JSON.stringify(res, null, 2);
        setProposalImageText(finalImageText);
        setGeneratedImagePrompts(res);
      }

      if (isReallyMissing(finalVideoText)) {
        setGenerationStage('正在補齊：影片腳本...');
        const res = await generateVideoScript(apiKey, finalCopyText, undefined, settings?.languageModel || 'gemma-4-31b-it');
        finalVideoText = JSON.stringify(res, null, 2);
        setProposalVideoText(finalVideoText);
        setGeneratedVideoScript(res);
      }

      setGenerationStage('最後整理企劃書格式...');
      const result = await generateMarketingProposal(
        apiKey,
        product.brand,
        product.productName,
        product.features,
        ta.ageGroup || '',
        ta.description || '',
        ta.painPoints || '',
        useProductDetailsFlag ? productDetails.filter(d => d.productId === selectedProductId).map(d => d.details).join('\n') : '',
        `${style.name} - ${style.description}`,
        finalCopyText,
        finalImageText,
        finalVideoText,
        settings?.languageModel || 'gemma-4-31b-it'
      );
      setGeneratedProposal(result || '');
    } catch (err: any) {
      console.error('Proposal generation error:', err);
      alert('企劃書生成中斷：' + (err.message || '未知錯誤') + '\n請檢查文案內容是否通過法規審查。');
    } finally {
      setIsGenerating(false);
      setGenerationStage('');
    }
  };

  const loadPreviousGenerations = () => {
    if (generatedCopyContent.length > 0) setProposalCopyText(JSON.stringify(generatedCopyContent, null, 2));
    if (generatedImagePrompts.length > 0) setProposalImageText(JSON.stringify(generatedImagePrompts, null, 2));
    if (generatedVideoScript.length > 0) setProposalVideoText(JSON.stringify(generatedVideoScript, null, 2));
  };

  const handleDownloadScriptPdf = async () => {
    try {
      const isPuraVida = videoBrand === 'PuraVida';
      const bgColor = isPuraVida ? '#121417' : '#FDFCFB';
      const textColor = isPuraVida ? '#d1d5db' : '#334155';
      const headerBorder = isPuraVida ? '#333' : '#e2e8f0';
      const brandTitleColor = isPuraVida ? '#ffffff' : '#e11d48';
      const brandSubtitleColor = isPuraVida ? '#888' : '#e11d48';
      const docTitleColor = isPuraVida ? '#fff' : '#0f172a';
      const docSubtitleColor = isPuraVida ? '#aaa' : '#64748b';
      const thBg = isPuraVida ? '#1a1c23' : '#f8fafc';
      const thColor = isPuraVida ? '#a1a1aa' : '#475569';
      const tdBorder = isPuraVida ? '#2d3139' : '#e2e8f0';
      const sceneColor = isPuraVida ? '#fff' : '#0f172a';
      const placeholderBg = isPuraVida ? '#1f2228' : '#f1f5f9';
      const placeholderBorder = isPuraVida ? '#474d5b' : '#cbd5e1';
      const placeholderColor = isPuraVida ? '#6b7280' : '#64748b';
      const labelColor = isPuraVida ? '#888' : '#64748b';
      const highlightColor = isPuraVida ? '#e8b4b8' : '#e11d48';

      const rowsHtml = generatedVideoScript.map((row, index) => `
          <tr>
              <td class="col-scene">${row.scene || index + 1}</td>
              <td class="col-img">
                  <div class="img-placeholder"><span>[ 畫面示意 ]<br>${row.imageHint ? row.imageHint.replace(/\\n/g, '<br>') : ''}</span></div>
              </td>
              <td class="col-camera">
                  <span class="label">運鏡</span>
                  ${row.camera ? row.camera.replace(/\\n/g, '<br>') : ''}
              </td>
              <td class="col-action">
                  ${row.action ? row.action.replace(/\\n/g, '<br>') : ''}
              </td>
              <td class="col-vo">
                  ${row.voiceover ? row.voiceover.replace(/\\n/g, '<br>') : ''}
              </td>
              <td class="col-text">
                  <span class="highlight">${row.screenText ? row.screenText.replace(/\\n/g, '<br>') : ''}</span>
              </td>
              <td class="col-time">${row.time || ''}</td>
          </tr>
      `).join('');

      const htmlContent = `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<style>
  @page {
      size: A4 portrait;
      margin: 12mm;
  }
  body {
      margin: 0;
      padding: 0;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: ${textColor};
      background-color: ${bgColor};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
  }
  * { box-sizing: border-box; }
  
  .header-table {
      width: 100%;
      margin-bottom: 20px;
      border-bottom: 1px solid ${headerBorder};
      padding-bottom: 15px;
  }
  .header-table td {
      border: none;
      padding: 0;
  }
  .brand-title {
      font-size: 24px;
      color: ${brandTitleColor};
      letter-spacing: 1px;
      font-weight: bold;
  }
  .brand-subtitle {
      font-size: 9px;
      color: ${brandSubtitleColor};
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 4px;
  }
  .doc-title {
      text-align: center;
      font-size: 16px;
      color: ${docTitleColor};
      letter-spacing: 1px;
      font-weight: bold;
  }
  .doc-subtitle {
      text-align: center;
      font-size: 12px;
      color: ${docSubtitleColor};
      margin-top: 5px;
  }

  table.storyboard {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      table-layout: fixed;
  }
  table.storyboard th, table.storyboard td {
      border: 1px solid ${tdBorder};
      padding: 12px;
      vertical-align: middle;
      line-height: 1.6;
  }
  table.storyboard th {
      background-color: ${thBg};
      color: ${thColor};
      text-align: center;
      font-weight: bold;
      padding: 8px;
  }
  .col-scene { width: 6%; text-align: center; font-size: 14px; color: ${sceneColor}; font-weight: bold; }
  .col-img { width: 18%; }
  .col-camera { width: 14%; }
  .col-action { width: 22%; }
  .col-vo { width: 22%; }
  .col-text { width: 10%; }
  .col-time { width: 8%; text-align: center; font-weight: bold; }

  .img-placeholder {
      background-color: ${placeholderBg};
      border: 1px dashed ${placeholderBorder};
      border-radius: 4px;
      height: 110px;
      width: 100%;
      display: table;
  }
  .img-placeholder span {
      display: table-cell;
      text-align: center;
      vertical-align: middle;
      color: ${placeholderColor};
      font-size: 10px;
      line-height: 1.4;
  }

  .label { color: ${labelColor}; font-size: 10px; margin-bottom: 2px; display: block;}
  .highlight { color: ${highlightColor}; display: block; margin-bottom: 8px; font-weight: bold;}
  
  .footer-table {
      width: 100%;
      margin-top: 15px;
      font-size: 10px;
      color: ${labelColor};
  }
  .footer-table td {
      border: none;
      padding: 0;
  }
</style>
</head>
<body onload="setTimeout(() => { window.print(); window.close(); }, 500)">

  <table class="header-table">
      <tr>
          <td style="width: 30%;">
              <div class="brand-title">${videoBrand}</div>
              <div class="brand-subtitle">${isPuraVida ? 'LIVE YOUR PURE LIFE' : 'BEAUTY INNOVATION'}</div>
          </td>
          <td style="width: 40%;">
              <div class="doc-title">短影音 30 秒分鏡腳本</div>
              <div class="doc-subtitle">Reels (9:16) 企劃</div>
          </td>
          <td style="width: 30%; text-align: right;">
          </td>
      </tr>
  </table>

  <table class="storyboard">
      <thead>
          <tr>
              <th class="col-scene">鏡次</th>
              <th class="col-img">畫面</th>
              <th class="col-camera">畫面內容 (運鏡)</th>
              <th class="col-action">動作 / 故事</th>
              <th class="col-vo">旁白 / 音效</th>
              <th class="col-text">畫面文字</th>
              <th class="col-time">時間</th>
          </tr>
      </thead>
      <tbody>
          ${rowsHtml}
      </tbody>
  </table>

  <table class="footer-table">
      <tr>
          <td style="text-align: left;">*整體色調：${isPuraVida ? '深色黑紫 / 柔和光影 / 科技感 / 水潤霜感 / 極簡高級感' : '米色粉色 / 溫暖光線 / 優雅感 / 澄淨無瑕'}</td>
          <td style="text-align: right; font-size: 14px; font-weight: bold; color: ${brandTitleColor};">${videoBrand}</td>
      </tr>
  </table>

</body>
</html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      } else {
        alert('請允許瀏覽器跳出視窗以列印 PDF');
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('下載 PDF 失敗，請稍後再試。');
    }
  };

  const handleDownloadScriptWord = async () => {
    try {
      const isPuraVida = videoBrand === 'PuraVida';
      const bgColor = isPuraVida ? '#121417' : '#FFFFFF';
      const textColor = isPuraVida ? '#d1d5db' : '#334155';
      const headerBorder = isPuraVida ? '#333333' : '#e2e8f0';
      const brandTitleColor = isPuraVida ? '#ffffff' : '#e11d48';
      const docTitleColor = isPuraVida ? '#ffffff' : '#0f172a';
      const thBg = isPuraVida ? '#1a1c23' : '#f8fafc';
      const thColor = isPuraVida ? '#a1a1aa' : '#475569';
      const tdBorder = isPuraVida ? '#2d3139' : '#e2e8f0';
      const highlightColor = isPuraVida ? '#e8b4b8' : '#e11d48';

      const rowsHtml = generatedVideoScript.map((row, index) => `
          <tr style="vertical-align: top;">
              <td style="border: 1px solid ${tdBorder}; padding: 12px; text-align: center;">${row.scene || index + 1}</td>
              <td style="border: 1px solid ${tdBorder}; padding: 12px;">
                  <b>[畫面示意]</b><br>
                  ${row.imageHint ? row.imageHint.replace(/\n/g, '<br>') : ''}
              </td>
              <td style="border: 1px solid ${tdBorder}; padding: 12px;">
                  <b>[運鏡]</b><br>
                  ${row.camera ? row.camera.replace(/\n/g, '<br>') : ''}<br><br>
                  ${row.action ? row.action.replace(/\n/g, '<br>') : ''}
              </td>
              <td style="border: 1px solid ${tdBorder}; padding: 12px;">
                  ${row.voiceover ? row.voiceover.replace(/\n/g, '<br>') : ''}
              </td>
              <td style="border: 1px solid ${tdBorder}; padding: 12px; color: ${highlightColor};">
                  ${row.screenText ? row.screenText.replace(/\n/g, '<br>') : ''}
              </td>
              <td style="border: 1px solid ${tdBorder}; padding: 12px; text-align: center;">${row.time || ''}</td>
          </tr>
      `).join('');

      const htmlContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Video Script</title>
<style>
  body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: ${textColor};
      background-color: ${bgColor};
  }
  table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
  }
</style>
</head>
<body style="background-color: ${bgColor}; color: ${textColor};">

  <div style="margin-bottom: 20px; border-bottom: 1px solid ${headerBorder}; padding-bottom: 10px;">
      <h1 style="color: ${brandTitleColor}; margin: 0;">${videoBrand}</h1>
      <h3 style="color: ${docTitleColor}; margin: 5px 0 0 0;">短影音 30 秒分鏡腳本 (Reels 9:16)</h3>
  </div>

  <table>
      <thead>
          <tr>
              <th style="border: 1px solid ${tdBorder}; background-color: ${thBg}; color: ${thColor}; padding: 10px; width: 5%;">鏡次</th>
              <th style="border: 1px solid ${tdBorder}; background-color: ${thBg}; color: ${thColor}; padding: 10px; width: 20%;">畫面</th>
              <th style="border: 1px solid ${tdBorder}; background-color: ${thBg}; color: ${thColor}; padding: 10px; width: 25%;">運鏡與動作</th>
              <th style="border: 1px solid ${tdBorder}; background-color: ${thBg}; color: ${thColor}; padding: 10px; width: 25%;">旁白與音效</th>
              <th style="border: 1px solid ${tdBorder}; background-color: ${thBg}; color: ${thColor}; padding: 10px; width: 15%;">畫面文字</th>
              <th style="border: 1px solid ${tdBorder}; background-color: ${thBg}; color: ${thColor}; padding: 10px; width: 10%;">時間</th>
          </tr>
      </thead>
      <tbody>
          ${rowsHtml}
      </tbody>
  </table>

  <p style="margin-top: 20px; font-size: 12px; color: ${thColor};">
      *整體色調：${isPuraVida ? '深色黑紫 / 柔和光影 / 科技感 / 水潤霜感 / 極簡高級感' : '米色粉色 / 溫暖光線 / 優雅感 / 澄淨無瑕'}
  </p>

</body>
</html>
      `;

      const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${videoBrand}_Reels腳本.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to generate Word doc:', error);
      alert('下載 Word 失敗，請稍後再試。');
    }
  };

  const handleDownloadPdf = async (elementId: string, filename: string) => {
    try {
      const element = document.getElementById(elementId);
      if (!element) return;
      
      const opt = {
        margin:       [10, 10, 10, 10],
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      // @ts-ignore
      html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('下載 PDF 失敗，請稍後再試。');
    }
  };

  const handleDownloadWord = (htmlContent: string, filename: string) => {
    try {
      const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate Word doc:', error);
      alert('產生 Word 檔案時發生錯誤，請稍後再試。');
    }
  };

  const copyToClipboard = async (format: 'json' | 'text' = 'text', customText?: string) => {
    let textToCopy = customText || '';
    if (!customText) {
      if (activeMenu === 'copy') {
        if (format === 'json') {
          textToCopy = JSON.stringify(generatedCopyContent, null, 2);
        } else {
          textToCopy = generatedCopyContent.map(item => Object.entries(item).map(([k, v]) => `${k} ${v}`).join('\n\n')).join('\n\n---\n\n');
        }
      } else if (activeMenu === 'image') {
        if (format === 'json') {
          textToCopy = JSON.stringify(generatedImagePrompts, null, 2);
        } else {
          textToCopy = generatedImagePrompts.map(item => `【標題】：${item.title}\n【文案】：${item.overlayCopy || ''}\n【設計理念】：${item.designIdea}\n【Prompt】：${item.prompt}`).join('\n\n---\n\n');
        }
      } else if (activeMenu === 'video') {
        if (format === 'json') {
          textToCopy = JSON.stringify(generatedVideoScript, null, 2);
        } else {
          textToCopy = generatedVideoScript.map((val, idx) => `第 ${idx + 1} 幕 (${val.time})\n畫面示意：${val.imageHint}\n運鏡快照：${val.camera} - ${val.action}\n旁白與音效：${val.voiceover}\n畫面文字：${val.screenText}`).join('\n\n');
        }
      } else if (activeMenu === 'proposal') {
        textToCopy = generatedProposal;
        
        try {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = generatedProposal;
          const textBlob = new Blob([tempDiv.innerText], { type: 'text/plain' });
          const htmlBlob = new Blob([generatedProposal], { type: 'text/html' });
          const clipboardItem = new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          });
          
          await navigator.clipboard.write([clipboardItem]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          return;
        } catch (err) {
          console.error("ClipboardItem failed, falling back to writeText", err);
        }
      }
    }

    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 直接進入主介面，不進行登入阻擋
  return (
    <div className="fixed inset-0 flex flex-col bg-[#FDFCFB] font-sans text-slate-800">
      {/* Top Navigation */}
      <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <BrandLogo className="w-8 h-8 rounded-lg shadow-sm object-cover" />
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 hidden sm:block">KISS ME <span className="font-normal text-slate-500">Marketing AI Agent</span></h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-xs font-medium text-slate-500 hidden md:block px-2">{user.email}</div>
          <button
            onClick={() => {
              setSettingsInitialTab('api');
              setSettingsOpen(true);
            }}
            className="flex items-center space-x-2 text-sm text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-full border border-slate-200 bg-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:block">API & 資料庫設定</span>
          </button>
          <button
            onClick={() => signOut(auth)}
            className="flex items-center space-x-2 text-sm text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-full border border-slate-200 bg-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">登出</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 border-r border-slate-100 bg-white p-4 flex flex-col space-y-2 shrink-0">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">AI 生成工具</div>
          <button
            onClick={() => setActiveMenu('copy')}
            className={`w-full text-left px-3 py-2.5 rounded-xl font-medium flex items-center space-x-3 transition-colors ${
              activeMenu === 'copy' ? 'bg-rose-50 text-rose-700' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <PenTool className="w-5 h-5" />
            <span>文案生成</span>
          </button>
          <button
            onClick={() => setActiveMenu('image')}
            className={`w-full text-left px-3 py-2.5 rounded-xl font-medium flex items-center space-x-3 transition-colors ${
              activeMenu === 'image' ? 'bg-rose-50 text-rose-700' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            <span>社群圖像生成</span>
          </button>
          <button
            onClick={() => setActiveMenu('video')}
            className={`w-full text-left px-3 py-2.5 rounded-xl font-medium flex items-center space-x-3 transition-colors ${
              activeMenu === 'video' ? 'bg-rose-50 text-rose-700' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Video className="w-5 h-5" />
            <span>影片腳本生成</span>
          </button>
          <button
            onClick={() => setActiveMenu('proposal')}
            className={`w-full text-left px-3 py-2.5 rounded-xl font-medium flex items-center space-x-3 transition-colors ${
              activeMenu === 'proposal' ? 'bg-rose-50 text-rose-700' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <LayoutTemplate className="w-5 h-5" />
            <span>行銷企劃書生成</span>
          </button>
          <button
            onClick={() => setActiveMenu('workflow')}
            className={`w-full text-left px-3 py-2.5 rounded-xl font-medium flex items-center space-x-3 transition-colors ${
              activeMenu === 'workflow' ? 'bg-rose-50 text-rose-700' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <GitMerge className="w-5 h-5" />
            <span>系統工作流圖</span>
          </button>
          
          <div className="mt-auto">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 mt-4">
              <p className="text-[10px] text-slate-400 leading-relaxed italic">"美姬公主精神：200年傳承的精緻美學，由AI賦予現代色彩。"</p>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 flex flex-col p-4 sm:p-8 space-y-6 overflow-hidden">
          {activeMenu === 'copy' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
              {/* Left: Configuration Form */}
              <div className="lg:col-span-5 flex flex-col space-y-4 overflow-y-auto pr-2">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">選擇生成模式</label>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => setFormat('format1')} 
                        className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl border-2 text-sm font-semibold text-center transition-colors ${format === 'format1' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                      >
                        TA & 痛點導向
                      </button>
                      <button 
                        onClick={() => setFormat('format2')} 
                        className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl border-2 text-sm font-semibold text-center transition-colors ${format === 'format2' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                      >
                        產品介紹導向
                      </button>
                      <button 
                        onClick={async () => {
                          if (!settings || !settings.customSystemPrompt) {
                            if (confirm('尚未有分析後的自訂風格。是否要打開「系統設定」並進入「文案存摺」來進行分析？')) {
                              setSettingsInitialTab('archive');
                              setSettingsOpen(true);
                            }
                            return;
                          }
                          const newMode = settings.mode === 'custom' ? 'default' : 'custom';
                          await saveSettings({
                            mode: newMode,
                            languageModel: settings.languageModel || 'gemma-4-31b-it',
                            imageModel: settings.imageModel || 'gemini-3.1-flash-image-preview',
                            customSystemPrompt: settings.customSystemPrompt,
                            customJsonFormat: settings.customJsonFormat
                          });
                        }} 
                        className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl border-2 text-sm font-semibold text-center transition-colors ${settings?.mode === 'custom' ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                      >
                        {settings?.mode === 'custom' ? '✨ 自訂風格已開啓' : '✨ 套用自訂風格'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">產品名稱及特色</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                      >
                        <option value="">請選擇產品...</option>
                        {products.map(p => <option key={p.id} value={p.id}>[{p.brand}] {p.productName}</option>)}
                      </select>
                    </div>

                    {format === 'format1' && (
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700 mb-1.5">目標客群 (TA)</label>
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                          value={selectedTaId}
                          onChange={(e) => setSelectedTaId(e.target.value)}
                        >
                          <option value="">請選擇 TA Profile...</option>
                          {taProfiles.map(t => <option key={t.id} value={t.id}>{t.ageGroup}</option>)}
                        </select>
                      </div>
                    )}

                    {format === 'format1' && (
                      <div className="flex items-center space-x-2 pt-2">
                        <input
                          type="checkbox"
                          id="details"
                          checked={useProductDetailsFlag}
                          onChange={(e) => setUseProductDetailsFlag(e.target.checked)}
                          className="rounded text-rose-500 focus:ring-rose-500 border-slate-300 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="details" className="text-sm text-slate-600 cursor-pointer">使用詳細產品資訊資料庫</label>
                      </div>
                    )}
                    {format === 'format2' && (
                      <div className="text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded-lg border border-rose-100 mt-2 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        相應產品詳細資訊將自動套用
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !selectedProductId || (format === 'format1' && !selectedTaId)}
                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold shadow-lg shadow-slate-200 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                  >
                    {isGenerating ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          <span>AI 生成中...</span>
                        </div>
                        {generationStage && (
                          <span className="text-[10px] font-normal opacity-80 animate-pulse">{generationStage}</span>
                        )}
                      </>
                    ) : (
                      <>立即產出文案</>
                    )}
                  </button>
                </div>
              </div>

              {/* Right: AI Result Preview */}
              <div className="lg:col-span-7 flex flex-col min-h-[500px] lg:h-full lg:min-h-0">
                <div className="flex-1 bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-0">
                  <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-white shrink-0">
                    <span className="text-sm font-semibold text-slate-900">生成預覽</span>
                    {generatedCopyContent.length > 0 && (
                      <div className="flex gap-4">
                        <button
                          onClick={async () => {
                            const fullText = generatedCopyContent.map(item => 
                              Object.entries(item).map(([k, v]) => `${k} ${v}`).join('\n')
                            ).join('\n\n');
                            const prod = products.find(p => p.id === selectedProductId);
                            await addArchivedCopy({ 
                              content: fullText, 
                              brand: prod?.brand 
                            });
                            alert('已儲存至文案存摺！');
                          }}
                          className="text-amber-600 text-sm font-bold hover:underline flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          儲存至存摺
                        </button>
                        <button
                          onClick={() => copyToClipboard('text')}
                          className="text-rose-600 text-sm font-medium hover:underline flex items-center gap-1.5 transition-colors"
                        >
                          {copied && activeMenu === 'copy' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          複製全文
                        </button>
                        <button
                          onClick={() => copyToClipboard('json')}
                          className="text-indigo-600 text-sm font-medium hover:underline flex items-center gap-1.5 transition-colors"
                        >
                          <Copy className="w-4 h-4" /> 複製 JSON
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 p-6 md:p-8 overflow-y-auto text-slate-700 space-y-4 font-serif leading-relaxed selection:bg-rose-100 bg-white min-h-0">
                    {generatedCopyContent.length > 0 ? (
                      <div className="whitespace-pre-wrap">
                        {generatedCopyContent.map((item, i) => (
                          <div key={i} className="mb-6">
                            {Object.entries(item).map(([k, v]) => (
                               <div key={k} className="mb-2">
                                 <span className="font-bold">{k}</span> {v as string}
                               </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                        <PenTool className="w-12 h-12 stroke-1" />
                        <p className="font-sans">請完成左側設定並點擊產生</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeMenu === 'image' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
              {/* Left: Configuration Form */}
              <div className="lg:col-span-5 flex flex-col space-y-4 overflow-y-auto pr-2">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">設定圖像生成</label>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">貼上社群文案內容</label>
                      <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[150px]"
                        placeholder="請將您想發布的社群貼文內容貼在此處..."
                        value={copyContent}
                        onChange={(e) => setCopyContent(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">選擇產品圖像風格</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        value={selectedStyleId}
                        onChange={(e) => setSelectedStyleId(e.target.value)}
                      >
                        <option value="">請選擇產品圖像風格...</option>
                        {imageStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateImagePrompt}
                    disabled={isGenerating || !copyContent || !selectedStyleId}
                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold shadow-lg shadow-slate-200 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                  >
                    {isGenerating ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          <span>AI 生成中...</span>
                        </div>
                        {generationStage && (
                          <span className="text-[10px] font-normal opacity-80 animate-pulse">{generationStage}</span>
                        )}
                      </>
                    ) : (
                      <>立即產出圖像提示詞</>
                    )}
                  </button>
                </div>
              </div>

              {/* Right: AI Result Preview */}
              <div className="lg:col-span-7 flex flex-col min-h-[500px] lg:h-full lg:min-h-0">
                <div className="flex-1 bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-0">
                  <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-white shrink-0">
                    <span className="text-sm font-semibold text-slate-900">圖像生成提示詞預覽</span>
                    {generatedImagePrompts.length > 0 && (
                      <div className="flex gap-4">
                        <button
                          onClick={() => copyToClipboard('text')}
                          className="text-rose-600 text-sm font-medium hover:underline flex items-center gap-1.5 transition-colors"
                        >
                          {copied && activeMenu === 'image' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          複製全文
                        </button>
                        <button
                          onClick={() => copyToClipboard('json')}
                          className="text-indigo-600 text-sm font-medium hover:underline flex items-center gap-1.5 transition-colors"
                        >
                          <Copy className="w-4 h-4" /> 複製 JSON
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 p-6 md:p-8 overflow-y-auto text-slate-700 space-y-4 font-sans leading-relaxed selection:bg-rose-100 bg-white min-h-0 scroll-smooth">
                    {generatedImagePrompts.length > 0 ? (
                      <div className="space-y-6">
                        {generatedImagePrompts.map((item, index) => (
                          <div key={index} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-slate-900">{item.title}</h4>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(item.prompt);
                                }}
                                className="text-rose-600 text-xs font-semibold hover:bg-rose-50 px-2 py-1 rounded-md border border-slate-200 transition-colors flex items-center gap-1"
                              >
                                <Copy className="w-3.5 h-3.5" /> 複製 Prompt
                              </button>
                            </div>
                            {item.overlayCopy && (
                              <div className="text-sm text-slate-800 bg-white p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                                <span className="font-semibold block mb-1">重點文案：</span>
                                {item.overlayCopy}
                              </div>
                            )}
                            <div className="text-sm text-slate-800 bg-white p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                              <span className="font-semibold block mb-1">構圖與理念：</span>
                              {item.designIdea}
                            </div>
                            <div className="text-sm font-mono text-slate-600 bg-slate-100 p-3 rounded-xl border border-slate-200 whitespace-pre-wrap">
                              <span className="font-semibold block mb-1 text-slate-800 font-sans">Image Prompt：</span>
                              {item.prompt}
                            </div>
                            <div className="pt-2">
                              {item.imageUrl ? (
                                <div className="mt-2 text-center">
                                  <img src={item.imageUrl} alt={item.title} className="w-full max-w-sm mx-auto rounded-xl shadow-md border border-slate-200" />
                                </div>
                              ) : (
                                <button
                                  onClick={() => generateImageForPrompt(index, item.prompt)}
                                  disabled={generatingImages[index]}
                                  className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                  {generatingImages[index] ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                                  {generatingImages[index] ? '生成圖片中...' : '使用 Gemini 預覽圖片'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                        <ImageIcon className="w-12 h-12 stroke-1" />
                        <p className="font-sans">請完成左側設定並點擊產出圖像提示詞</p>
                      </div>
                    )}
                  </div>
                  
                  {/* External links */}
                  <div className="border-t border-slate-100 p-4 bg-slate-50 shrink-0">
                    <span className="text-xs font-semibold text-slate-500 mb-3 block uppercase tracking-wider">前往外部服務生成圖像</span>
                    <div className="flex flex-wrap gap-2">
                      <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all">Gemini</a>
                      <a href="https://labs.google.com/pomelli/about/" target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all">Google Pomelli</a>
                      <a href="https://labs.google/flow/about" target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all">Google Flow</a>
                      <a href="https://midjourney.com/" target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all">Midjourney</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeMenu === 'video' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
              <div className="lg:col-span-4 flex flex-col space-y-4 overflow-y-auto pr-2">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">設定影片腳本生成</label>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">專屬品牌主題風格</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        value={videoBrand}
                        onChange={(e) => setVideoBrand(e.target.value as 'KISSME' | 'PuraVida')}
                      >
                        <option value="KISSME">KISSME (米色溫暖調)</option>
                        <option value="PuraVida">PuraVida (黑紫科技感)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">輸入社群文案內容</label>
                      <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[250px]"
                        placeholder="請將您想轉換為 9:16 短影音腳本的社群貼文文案貼在此處..."
                        value={videoCopyContent}
                        onChange={(e) => setVideoCopyContent(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateVideoScript}
                    disabled={isGenerating || !videoCopyContent}
                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold shadow-lg shadow-slate-200 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                  >
                    {isGenerating ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          <span>AI 生成中...</span>
                        </div>
                        {generationStage && (
                          <span className="text-[10px] font-normal opacity-80 animate-pulse">{generationStage}</span>
                        )}
                      </>
                    ) : (
                      <>立即產出腳本</>
                    )}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-8 flex flex-col min-h-[500px] lg:h-full lg:min-h-0">
                <div className="flex-1 bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-0">
                  <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-white shrink-0">
                    <span className="text-sm font-semibold text-slate-900">影片腳本預覽 (Reels 9:16)</span>
                    {generatedVideoScript.length > 0 && (
                      <div className="flex gap-4">
                        <button
                          onClick={() => copyToClipboard('text')}
                          className="text-rose-600 text-sm font-medium hover:underline flex items-center gap-1.5 transition-colors"
                        >
                          {copied && activeMenu === 'video' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          複製全文
                        </button>
                        <button
                          onClick={() => copyToClipboard('json')}
                          className="text-indigo-600 text-sm font-medium hover:underline flex items-center gap-1.5 transition-colors"
                        >
                          <Copy className="w-4 h-4" /> 複製 JSON
                        </button>
                        <button
                          onClick={() => handleDownloadScriptPdf()}
                          className="text-violet-600 text-sm font-medium hover:underline flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-4 h-4" /> 下載高畫質 PDF
                        </button>
                        <button
                          onClick={() => handleDownloadScriptWord()}
                          className="text-emerald-600 text-sm font-medium hover:underline flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-4 h-4" /> 下載高畫質 Word
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 p-6 md:p-8 overflow-y-auto text-slate-700 bg-white min-h-0 scroll-smooth">
                    {generatedVideoScript.length > 0 ? (
                      <div id="video-script-content" className="space-y-4">
                        <div className="text-center mb-8">
                          <h2 className="text-xl font-bold text-slate-900 mb-2">短影音 (Reels) 企劃腳本</h2>
                          <p className="text-sm text-slate-500">此腳本為 AI 根據貼文內容生成的大綱，括號內的畫面敘述可作為拍攝參考。</p>
                        </div>
                        <div className="overflow-hidden border border-slate-200 rounded-2xl">
                          <table className="w-full text-left text-sm whitespace-pre-wrap">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-3 font-semibold text-slate-800 w-10 text-center">#</th>
                                <th className="px-3 py-3 font-semibold text-slate-800 border-l border-slate-200">畫面示意</th>
                                <th className="px-3 py-3 font-semibold text-slate-800 border-l border-slate-200">運鏡與動作</th>
                                <th className="px-3 py-3 font-semibold text-slate-800 border-l border-slate-200">旁白與音效</th>
                                <th className="px-3 py-3 font-semibold text-slate-800 border-l border-slate-200">畫面文字</th>
                                <th className="px-3 py-3 font-semibold text-slate-800 w-16 border-l border-slate-200 text-center">時間</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {generatedVideoScript.map((row, index) => (
                                <tr key={index} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-3 py-4 text-center font-medium text-slate-500">{row.scene || index + 1}</td>
                                  <td className="px-3 py-4 text-slate-600 border-l border-slate-100 text-xs">{row.imageHint}</td>
                                  <td className="px-3 py-4 text-slate-600 border-l border-slate-100 text-xs"><span className="text-rose-500 font-semibold block mb-1">{row.camera}</span>{row.action}</td>
                                  <td className="px-3 py-4 text-slate-800 border-l border-slate-100 text-xs font-semibold">{row.voiceover}</td>
                                  <td className="px-3 py-4 text-amber-700 border-l border-slate-100 text-xs font-bold">{row.screenText}</td>
                                  <td className="px-3 py-4 text-slate-500 border-l border-slate-100 text-center text-xs">{row.time}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                        <Video className="w-12 h-12 stroke-1" />
                        <p className="font-sans">請貼上文案並點擊產生</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeMenu === 'proposal' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
              <div className="lg:col-span-5 flex flex-col space-y-4 overflow-y-auto pr-2 pb-8">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">設定行銷企劃書生成</label>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                          產品設定
                        </label>
                        <select
                          value={selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        >
                          <option value="">請選擇產品</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.brand} - {p.productName}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                          TA 設定
                        </label>
                        <select
                          value={selectedTaId}
                          onChange={(e) => setSelectedTaId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        >
                          <option value="">請選擇 TA</option>
                          {taProfiles.map(t => (
                            <option key={t.id} value={t.id}>{t.ageGroup} - {t.description.substring(0, 20)}...</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useProductDetailsFlag}
                          onChange={(e) => setUseProductDetailsFlag(e.target.checked)}
                          className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500"
                        />
                        <span className="text-sm font-medium text-slate-700">整合產品詳細資訊</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                        產品圖像風格
                      </label>
                      <select
                        value={selectedStyleId}
                        onChange={(e) => setSelectedStyleId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="">請選擇產品圖像風格</option>
                        {imageStyles.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <hr className="border-slate-100" />
                  
                  <div className="flex items-center justify-between mt-2 mb-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">輸入生成內容素材</label>
                    <button 
                      onClick={loadPreviousGenerations}
                      className="text-indigo-600 text-[10px] font-semibold tracking-wide hover:underline"
                    >
                      載入先前的生成結果
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">貼文文案 (生成預覽)</label>
                      <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[100px]"
                        placeholder="請貼上 JSON 格式文案..."
                        value={proposalCopyText}
                        onChange={(e) => setProposalCopyText(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">圖像生成提示詞預覽</label>
                      <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[100px]"
                        placeholder="請貼上 JSON 格式圖像生成提示詞..."
                        value={proposalImageText}
                        onChange={(e) => setProposalImageText(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">影片腳本預覽 (Reels 9:16)</label>
                      <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[100px]"
                        placeholder="請貼上 JSON 格式影片腳本..."
                        value={proposalVideoText}
                        onChange={(e) => setProposalVideoText(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateProposal}
                    disabled={isGenerating || !selectedProductId || !selectedTaId || !selectedStyleId}
                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold shadow-lg shadow-slate-200 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          <span>AI 正在生成中...</span>
                        </div>
                        {generationStage && (
                          <span className="text-[10px] font-normal opacity-80 animate-pulse">{generationStage}</span>
                        )}
                      </div>
                    ) : (
                      <>
                        {(isReallyMissing(proposalCopyText) || 
                          isReallyMissing(proposalImageText) || 
                          isReallyMissing(proposalVideoText)) 
                          ? '一鍵生成 (補齊內容)' 
                          : '整理企劃書'}
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col min-h-[500px] lg:h-full lg:min-h-0">
                <div className="flex-1 bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-0">
                  <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-white shrink-0">
                    <span className="text-sm font-semibold text-slate-900">行銷企劃書預覽</span>
                    <div className="flex gap-4">
                      <button
                        onClick={() => copyToClipboard()}
                        disabled={!generatedProposal}
                        className="text-rose-600 text-sm font-medium hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5 transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? '已複製' : '點擊複製全文'}
                      </button>
                      <button
                        onClick={() => handleDownloadWord(generatedProposal, 'Kiss_me_AI_agent_行銷企劃書.doc')}
                        disabled={!generatedProposal}
                        className="text-emerald-600 text-sm font-medium hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-4 h-4" /> 下載 Word
                      </button>
                      <button
                        onClick={() => handleDownloadPdf('proposal-content', 'Kiss_me_AI_agent_行銷企劃書.pdf')}
                        disabled={!generatedProposal}
                        className="text-indigo-600 text-sm font-medium hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-4 h-4" /> 下載 PDF
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-6 md:p-8 overflow-y-auto text-slate-700 bg-white min-h-0 scroll-smooth">
                    {generatedProposal ? (
                      <div id="proposal-content" className="space-y-4">
                        <div dangerouslySetInnerHTML={{ __html: generatedProposal }} />
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                        <LayoutTemplate className="w-12 h-12 stroke-1" />
                        <p className="font-sans">請完成設定並點擊產生企劃書</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeMenu === 'workflow' && (
            <div className="flex flex-col space-y-6 h-full overflow-y-auto pr-2 pb-12">
              {/* Header Box */}
              <div className="bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-white/5 pointer-events-none" />
                <div className="relative z-10 space-y-4">
                  <div className="inline-block text-[10px] sm:text-xs font-bold tracking-widest bg-white/20 px-3 py-1 rounded-full uppercase">KISSME x PuraVida AI Studio</div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-2">系統架構與 Coding 領域工作流圖</h2>
                  <p className="text-white/80 text-xs sm:text-sm max-w-2xl font-light leading-relaxed">
                    整合 Firebase 資料儲存、Google Gemini 多模態生成與台灣化妝品廣告法規自動合規層，實現自動化企劃書編譯與 30s 影音 Reels 製作之高空運算工作流。
                  </p>
                </div>
              </div>

              {/* Interactive Flow Diagram & Detail Card */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Visual Flow Track */}
                <div className="lg:col-span-7 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 mb-1">系統數據流可視化軌跡</h3>
                    <p className="text-xs text-slate-400 mb-6">點擊下方流程節點，即可即時調閱底層代碼技術檔案與商務思維對比。</p>
                  </div>

                  {/* Flow Steps (Interactive Nodes Visual Track) */}
                  <div className="relative flex flex-col space-y-6 my-4 pr-1">
                    {/* Background Connector Bar CSS */}
                    <div className="absolute left-[23px] top-6 bottom-6 w-1 bg-slate-100 flex flex-col justify-between pointer-events-none">
                      <div className="w-full h-1/4 bg-rose-200 animate-pulse rounded-full" />
                      <div className="w-full h-1/4 bg-amber-200 animate-pulse rounded-full" />
                    </div>

                    {/* Node 1 */}
                    <button
                      onClick={() => setActiveWorkflowNode('input')}
                      className={`relative z-10 flex items-start gap-4 p-4 rounded-2xl text-left border transition-all hover:shadow-md ${
                        activeWorkflowNode === 'input'
                          ? 'bg-rose-50 border-rose-300 shadow-sm'
                          : 'bg-slate-50/50 border-slate-100'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        activeWorkflowNode === 'input' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                      }`}>
                        IN
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 01</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">數據輸入層</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">品牌、產品及 TA 受眾資料庫</h4>
                        <p className="text-xs text-slate-500 line-clamp-1">使用者自行建檔儲存於雲端 Firestore，為 AI 提供定制化行銷情境資料。</p>
                      </div>
                    </button>

                    {/* Node 2 */}
                    <button
                      onClick={() => setActiveWorkflowNode('prompt')}
                      className={`relative z-10 flex items-start gap-4 p-4 rounded-2xl text-left border transition-all hover:shadow-md ${
                        activeWorkflowNode === 'prompt'
                          ? 'bg-rose-50 border-rose-300 shadow-sm'
                          : 'bg-slate-50/50 border-slate-100'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        activeWorkflowNode === 'prompt' ? 'bg-indigo-500 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                      }`}>
                        PRO
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 02</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">拼接封裝層</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">Prompt 智能拼接架構</h4>
                        <p className="text-xs text-slate-500 line-clamp-1">加載使用者自定義之行銷好文，進行多維度分析，組裝客製風格 Prompt。</p>
                      </div>
                    </button>

                    {/* Node 3 */}
                    <button
                      onClick={() => setActiveWorkflowNode('gemini')}
                      className={`relative z-10 flex items-start gap-4 p-4 rounded-2xl text-left border transition-all hover:shadow-md ${
                        activeWorkflowNode === 'gemini'
                          ? 'bg-rose-50 border-rose-300 shadow-sm'
                          : 'bg-slate-50/50 border-slate-100'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        activeWorkflowNode === 'gemini' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                      }`}>
                        GEM
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 03</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">生成中樞</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">Gemini 3.1 Pro 核心多模態運作</h4>
                        <p className="text-xs text-slate-500 line-clamp-1">自動生成貼文內容。搭載「AI 雙層審查機制」，自動批評不合理或虛偽描述並主動修訂。</p>
                      </div>
                    </button>

                    {/* Node 4 */}
                    <button
                      onClick={() => setActiveWorkflowNode('compliance')}
                      className={`relative z-10 flex items-start gap-4 p-4 rounded-2xl text-left border transition-all hover:shadow-md ${
                        activeWorkflowNode === 'compliance'
                          ? 'bg-rose-50 border-rose-300 shadow-sm'
                          : 'bg-slate-50/50 border-slate-100'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        activeWorkflowNode === 'compliance' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                      }`}>
                        REG
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 04</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">法規校正審查庫</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">化妝品標示宣傳合規與違規詞審查</h4>
                        <p className="text-xs text-slate-500 line-clamp-1">自動比對並即時合規替換敏感醫學宣稱（如 24 小時/毛孔消失），免除主管機關高額罰鍰。</p>
                      </div>
                    </button>

                    {/* Node 5 */}
                    <button
                      onClick={() => setActiveWorkflowNode('split')}
                      className={`relative z-10 flex items-start gap-4 p-4 rounded-2xl text-left border transition-all hover:shadow-md ${
                        activeWorkflowNode === 'split'
                          ? 'bg-rose-50 border-rose-300 shadow-sm'
                          : 'bg-slate-50/50 border-slate-100'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        activeWorkflowNode === 'split' ? 'bg-violet-500 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                      }`}>
                        OUT
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 05</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">行銷分流發布</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">影音 Reels 分鏡與圖像 Midjourney 指令</h4>
                        <p className="text-xs text-slate-500 line-clamp-1">產出細緻 30s 直式影片腳本，包含運鏡畫面文字、旁白音效、時間指示與下載選項。</p>
                      </div>
                    </button>

                    {/* Node 6 */}
                    <button
                      onClick={() => setActiveWorkflowNode('export')}
                      className={`relative z-10 flex items-start gap-4 p-4 rounded-2xl text-left border transition-all hover:shadow-md ${
                        activeWorkflowNode === 'export'
                          ? 'bg-rose-50 border-rose-300 shadow-sm'
                          : 'bg-slate-50/50 border-slate-100'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        activeWorkflowNode === 'export' ? 'bg-cyan-500 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                      }`}>
                        DOC
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 06</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span className="text-xs font-semibold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded">資源高畫質匯出</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">企劃書封裝與雙格式 Word / PDF 列印</h4>
                        <p className="text-xs text-slate-500 line-clamp-1">將產品特色、TA、文案與鏡頭腳本合璧，一鍵高保真匯出 A4 直式正式行銷文檔。</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Node Technical Details Panel */}
                <div className="lg:col-span-5 bg-slate-900 rounded-3xl p-6 text-slate-100 flex flex-col justify-between shadow-xl">
                  {activeWorkflowNode === 'input' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-500 tracking-wider uppercase">01 / INPUT SRC</span>
                        <span className="text-[10px] bg-slate-800 px-2.5 py-1 rounded text-slate-400 font-mono">Firebase DB</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">品牌、產品及客群資料庫</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        系統首要整合使用者所建檔之資訊。包含不同化妝品子品牌（KISSME 裸光無瑕 / PuraVida 精華奇蹟、褪黑科技）與目標客群年齡段（TA 20代/30代/40代）及其對應之生活痛點。
                      </p>
                      
                      <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 font-mono text-[11px] space-y-2 mt-4">
                        <div className="text-slate-500 font-bold">// 程式關鍵路徑與實作定義</div>
                        <div><span className="text-emerald-400">數據集名稱:</span> products, taProfiles</div>
                        <div><span className="text-emerald-400">底層定義檔:</span> <span className="text-rose-400">/src/hooks/useData.ts</span></div>
                        <div><span className="text-emerald-400">雲端主控台:</span> Firestore NoSQL Collection</div>
                        <div><span className="text-emerald-400">法規資料綁定:</span> <span className="text-yellow-400">productDetails (防曬、毛孔係數)</span></div>
                      </div>
                    </div>
                  )}

                  {activeWorkflowNode === 'prompt' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400 tracking-wider uppercase">02 / PROMPT ASSEMBLER</span>
                        <span className="text-[10px] bg-slate-800 px-2.5 py-1 rounded text-slate-400 font-mono">Prompt Engine</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">Prompt 智能拼接架構</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        根據使用者選定之品牌、痛點主軸及套用文案風格。引擎加載特定格式定義字串（比對 TA 面臨之氣溫、底妝融化痛點），並與文案存摺解析得出的「金獎好文語調 Prompt」予以合併。
                      </p>
                      
                      <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 font-mono text-[11px] space-y-2 mt-4">
                        <div className="text-slate-500 font-bold">// 程式關鍵路徑與實際調用</div>
                        <div><span className="text-emerald-400">實作檔案:</span> <span className="text-rose-400">/src/lib/gemini.ts</span></div>
                        <div><span className="text-emerald-400">核心函數:</span> <span className="text-cyan-400">generateCopy(productId, taId, ...)</span></div>
                        <div><span className="text-emerald-400">組裝指令:</span> <span className="text-yellow-400">customSettings.jsonFormat</span></div>
                        <div><span className="text-indigo-400">風格學習機制:</span> <span className="text-indigo-300">fewShotLearningPrompt</span></div>
                      </div>
                    </div>
                  )}

                  {activeWorkflowNode === 'gemini' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-500 tracking-wider uppercase">03 / CORE CO-AGENTS</span>
                        <span className="text-[10px] bg-slate-800 px-2.5 py-1 rounded text-slate-400 font-mono">Gemini 3.1 Pro</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">Gemini 核心雙代理人協調生成</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        文案生成核心搭載「初生與自我審查批評 (Twin-Agent Review Loop)」。第一個代理人根據 Prompt 初步產出內容，並由第二個合規/寫作審查專家角色提出修訂指引，在內部對話中反覆精煉，僅向用戶輸出最佳的一篇文案 JSON。
                      </p>
                      
                      <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 font-mono text-[11px] space-y-2 mt-4">
                        <div className="text-slate-500 font-bold">// 程式關鍵路徑與模型參數</div>
                        <div><span className="text-emerald-400">核心 SDK:</span> <span className="text-yellow-400">@google/genai (TypeScript SDK)</span></div>
                        <div><span className="text-emerald-400">實作代碼:</span> <span className="text-rose-400">/src/lib/gemini.ts</span></div>
                        <div><span className="text-emerald-400">調用模型:</span> <span className="text-cyan-400">gemini-3.1-pro-preview</span></div>
                        <div><span className="text-emerald-400">生成特點:</span> <span className="text-emerald-300">強烈要求只產出一篇文案</span></div>
                      </div>
                    </div>
                  )}

                  {activeWorkflowNode === 'compliance' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-500 tracking-wider uppercase">04 / LEGAL AUDIT</span>
                        <span className="text-[10px] bg-slate-800 px-2.5 py-1 rounded text-slate-400 font-mono">Cosmetics Law</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">台灣化妝品廣告法規自動合規審查</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        專為台灣行銷打造的智能法規安全閥。法規審查代理人對首次生成出來的 JSON 行銷內容進行強制審核。若發現涉嫌醫療藥效宣稱（如「保養級」）或絕對效能誇大（如「毛孔消失」、「24小時完美」），會智慧替換為合法修飾性文意（如「修飾毛孔」、「持久」），而保留原始 JSON 的鍵值與完整結構不變。
                      </p>
                      
                      <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 font-mono text-[11px] space-y-2 mt-4">
                        <div className="text-slate-500 font-bold">// 程式關鍵路徑與比對機制</div>
                        <div><span className="text-emerald-400">合規法規:</span> 衛生福利部化妝品標示宣傳認定基準</div>
                        <div><span className="text-emerald-400">審查 Prompt:</span> <span className="text-yellow-300">legalPrompt</span></div>
                        <div><span className="text-emerald-400">實作位置:</span> <span className="text-rose-400">/src/lib/gemini.ts (法規審查中...)</span></div>
                        <div><span className="text-emerald-400">核心保證:</span> <span className="text-emerald-400">不變動鍵名、不產出理由清單</span></div>
                      </div>
                    </div>
                  )}

                  {activeWorkflowNode === 'split' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-violet-400 tracking-wider uppercase">05 / OUT SPLITTER</span>
                        <span className="text-[10px] bg-slate-800 px-2.5 py-1 rounded text-slate-400 font-mono">Format Eng</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">格式分流、短影音腳本與圖像 Midjourney 指令</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        流程引擎自動調度生成：(a) 三個階段之 Midjourney 專業背景與產品圖像生成 Prompts。(b) reels 短影音 9:16 直式專用 storyboard 分鏡表（含鏡次、畫面示意、精準運鏡、動作描寫、無數學箭頭、純旁白音效、畫面押字、預估時間）。
                      </p>
                      
                      <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 font-mono text-[11px] space-y-2 mt-4">
                        <div className="text-slate-500 font-bold">// 程式關鍵路徑與數據分流</div>
                        <div><span className="text-emerald-400">腳本函數:</span> <span className="text-cyan-400">generateVideoScript(copyContent, apiKey)</span></div>
                        <div><span className="text-emerald-400">回傳介面:</span> <span className="text-amber-400">VideoScriptRow[]</span></div>
                        <div><span className="text-emerald-400">圖像指令:</span> <span className="text-rose-400">generateImagePrompt(...)</span></div>
                        <div><span className="text-emerald-400">禁止項目:</span> <span className="text-rose-500">嚴格過濾 $ightarrow 等 LaTeX 符號</span></div>
                      </div>
                    </div>
                  )}

                  {activeWorkflowNode === 'export' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-400 tracking-wider uppercase">06 / EXPORT ENGINE</span>
                        <span className="text-[10px] bg-slate-800 px-2.5 py-1 rounded text-slate-400 font-mono">Doc Compiler</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">一鍵企劃整合發布與 Word / PDF 雙軌下載</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        提供行銷策劃之最終落地。將多代理人產出之文宣、分鏡、行銷白板及生圖成果整理併入單一 A4 白皮書內，可透過客戶端動態 Blob 封裝下載為精美 Word 檔（.doc 標籤編碼，排版更精緻），或在 Reels 視窗一鍵列印/儲存為直式滿版 PDF 檔案。
                      </p>
                      
                      <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 font-mono text-[11px] space-y-2 mt-4">
                        <div className="text-slate-500 font-bold">// 程式關鍵路徑與下載引擎</div>
                        <div><span className="text-emerald-400">Word 封裝:</span> <span className="text-cyan-300">handleDownloadScriptWord() (Blob ms_word)</span></div>
                        <div><span className="text-emerald-400">PDF 引擎:</span> <span className="text-emerald-300">handleDownloadScriptPdf() (A4 portrait size)</span></div>
                        <div><span className="text-emerald-400">外部轉檔庫:</span> Browser Native Print / html2pdf.js</div>
                        <div><span className="text-emerald-400">樣式注入:</span> <span className="text-amber-300">KISSME (米色) 與 PuraVida (黑紫) 主題轉譯</span></div>
                      </div>
                    </div>
                  )}

                  {/* Sidebar small tip */}
                  <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-3">
                    *本系統所有接口均遵循 RESTful 及 Server-side 資訊安全政策，將 API Key 設定完整保護於雲端代理伺服器。
                  </div>
                </div>
              </div>

              {/* Legal Reference Table (Educational Element) */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    台灣衛福部化妝品標示宣傳廣告合規自動校正底層邏輯
                  </h3>
                  <p className="text-xs text-slate-400">
                    系統後台會根據中華民國《化妝品標示宣傳廣告涉及虛偽誇大或醫療效能認定基準》進行文意過濾。以下為自動對照更替表範例：
                  </p>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">原始敏感字彙 / 行銷虛擬用詞</th>
                        <th className="px-4 py-3">系統自動智慧合規替換詞</th>
                        <th className="px-4 py-3">中華民國法規合理依據</th>
                        <th className="px-4 py-3">合規行銷效果 (TA 觀點)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4.5 font-semibold text-rose-600">讓毛孔消失 / 隱形毛孔 / 抹平瑕疵</td>
                        <td className="px-4 py-4.5 font-bold text-emerald-600">視覺上淡化毛孔 / 修飾毛孔 / 打造平滑感</td>
                        <td className="px-4 py-4.5 text-slate-500">化妝品僅能具「修飾」皮表之效，不得宣稱改變或消解生理結構。</td>
                        <td className="px-4 py-4.5 font-medium">依然能傳遞膚質極佳、平整肌膚的視覺震撼，同時免於廣告處罰。</td>
                      </tr>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4.5 font-semibold text-rose-600">肌膚的「救贖」 / 暗沉肌的「救星」</td>
                        <td className="px-4 py-4.5 font-bold text-emerald-600">理想選擇 / 全方位解決方案 / 逆轉暗沉祕訣</td>
                        <td className="px-4 py-4.5 text-slate-500">「救贖/救星」等绝对誇大之词涉及虛偽推舉或暗示具療效作用。</td>
                        <td className="px-4 py-4.5 font-medium">塑造專業化妝品科學深度與高品質肌膚儀式（KISSME 溫暖氛圍）。</td>
                      </tr>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4.5 font-semibold text-rose-600">24 小時完美 / 長達 1 天持續不掉妝</td>
                        <td className="px-4 py-4.5 font-bold text-emerald-600">全天候 / 持續持久 / 頂級長效持妝</td>
                        <td className="px-4 py-4.5 text-slate-500">精確時間（24小時）宣稱需有第三方認證報告，改用模糊化時效描述。</td>
                        <td className="px-4 py-4.5 font-medium">有效承諾上班族群在冷氣房與大熱天的高效持久持妝信賴感。</td>
                      </tr>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4.5 font-semibold text-rose-600">頂級養膚 / 比保養品更具保養功能的精華</td>
                        <td className="px-4 py-4.5 font-bold text-emerald-600">富含頂級保養成分 / 滋潤修護感 / 呵護肌肉</td>
                        <td className="px-4 py-4.5 text-slate-500">强调成分本身內在保濕滋潤之特性，而非宣稱治療改變膚質。</td>
                        <td className="px-4 py-4.5 font-medium">完美契合 PuraVida 薄膜渦流與褪黑修護儀式感，提升商品尊貴感。</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Bottom Status Bar */}
      <footer className="h-10 bg-slate-50 border-t border-slate-200 px-6 flex items-center text-[11px] text-slate-400 space-x-6 shrink-0 hidden sm:flex">
        <div className="flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          Firebase 連線狀態：正常
        </div>
        <div>用戶帳號：{user.email}</div>
        <div className="flex-1 text-right italic">KISSME x PuraVida AI Studio © 2024</div>
      </footer>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} initialTab={settingsInitialTab} />}
    </div>
  );
}