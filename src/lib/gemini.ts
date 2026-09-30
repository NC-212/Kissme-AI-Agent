import { GoogleGenAI } from '@google/genai';
import { KISS_ME_EMOJIS } from './emojis';


export const getGeminiClient = (apiKey: string) => {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }
  return new GoogleGenAI({ apiKey });
};


const CANDIDATE_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];


async function callGeminiWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  }
): Promise<any> {
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || JSON.stringify(err);
        // 如果遇到 503 流量高峰，稍候 1 秒重試或切換下一個模型
        if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
          await new Promise((res) => setTimeout(res, 1200));
          continue;
        }
        // 若非 503 錯誤則直接拋出
        throw err;
      }
    }
  }
  throw lastError;
}

/**
 * 安全地從 AI 回應中提取純文字
 */
function safeExtractText(response: any): string {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (parts && Array.isArray(parts)) {
    return parts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join('');
  }
  try {
    return response?.text || '';
  } catch (e) {
    return '';
  }
}

function extractJsonArray(text: string): any[] {
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object' && parsed !== null) return [parsed];
    } catch(e) {}
  }

  let lastBracket = text.lastIndexOf(']');
  while (lastBracket !== -1) {
    let searchIndex = text.lastIndexOf('[', lastBracket);
    while (searchIndex !== -1) {
      try {
        const substr = text.substring(searchIndex, lastBracket + 1);
        const parsed = JSON.parse(substr);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {}
      searchIndex = text.lastIndexOf('[', searchIndex - 1);
    }
    lastBracket = text.lastIndexOf(']', lastBracket - 1);
  }

  try {
    const singleObjMatch = text.match(/\{[\s\S]*\}/);
    if (singleObjMatch) {
      const parsed = JSON.parse(singleObjMatch[0]);
      return [parsed];
    }
  } catch (e) {}

  return [];
}

export async function generateCopy(
  apiKey: string,
  format: 'format1' | 'format2',
  productName: string,
  productFeatures: string,
  brand: string,
  taAge: string,
  taDesc: string,
  taPain: string,
  onProgress?: (stage: string) => void,
  productDetails?: string,
  customSettings?: { 
    mode: string;
    systemPrompt: string; 
    jsonFormat: string;
    languageModel?: string;
  }
): Promise<any[]> {
  const ai = getGeminiClient(apiKey);
  
  if (onProgress) onProgress('AI 初步生成中...');
  
  let focusInstructions = '';
  if (format === 'format1') {
    focusInstructions = `
# 內容重心：TA 與 痛點導向
- 深入挖掘目標受眾 (${taDesc}) 的生活場景。
- 強力描述痛點 (${taPain})，產生物理或心理上的共鳴。
- 將產品功能轉化為解決這些困擾的理想方案。
`;
  } else {
    focusInstructions = `
# 內容重心：產品介紹導向
- 專注於產品 (${productName}) 的核心功能與特色 (${productFeatures})。
- 強調專利技術、成分優勢。
- 提供清晰、專業且具說服力的產品價值訊息。
`;
  }

  let primaryPrompt = '';
  if (customSettings?.mode === 'custom') {
    primaryPrompt = `
# Role & Custom Persona
${customSettings.systemPrompt}

# 輸入資訊
品牌：${brand}
產品：${productName}
目標受眾：${taDesc} (${taAge})
受眾痛點：${taPain}
${productDetails ? `詳細資訊：${productDetails}\n` : ''}
${focusInstructions}

# 任務描述
請撰寫一篇社群貼文（350字以內）。
# Emoji 使用指引
${KISS_ME_EMOJIS}
`;
  } else {
    primaryPrompt = `
# Role
你是資深美妝行銷專家。針對品牌 ${brand} 撰寫社群貼文。
產品：${productName} - ${productFeatures}
目標受眾：${taDesc} (${taAge})。痛點：${taPain}
${productDetails ? `詳細資訊：${productDetails}\n` : ''}
${focusInstructions}
請撰寫吸引人的貼文。
# Emoji 使用指引
${KISS_ME_EMOJIS}
`;
  }

  const primaryResponse = await callGeminiWithFallback(ai, {
    contents: primaryPrompt,
  });
  const initialCopy = safeExtractText(primaryResponse);

  if (onProgress) onProgress('AI 審核建議中...');
  const criticPrompt = `作為品牌審查官，請針對以下初稿給予文字精進與吸睛度建議：\n${initialCopy}`;
  const criticResponse = await callGeminiWithFallback(ai, {
    contents: criticPrompt,
  });
  const feedback = safeExtractText(criticResponse);

  if (onProgress) onProgress('法規審查與格式化...');
  let legalPrompt = '';
  if (customSettings?.mode === 'custom' && customSettings.jsonFormat) {
    legalPrompt = `你是化妝品行銷與法規專家。請參考審查建議重寫文案，並嚴格遵循台灣《化妝品標示宣傳廣告涉及虛偽誇大或醫療效能認定基準》（嚴禁醫療效能、過度誇大詞彙）。
審查建議：${feedback}

【輸出規定】：
必須直接輸出標準 JSON 陣列（只有一個物件）：
[
  {
${customSettings.jsonFormat}
  }
]`;
  } else {
    legalPrompt = `你是化妝品行銷與法規專家。請參考審查建議，為產品撰寫「一篇」完全符合台灣《化妝品標示宣傳廣告涉及虛偽誇大或醫療效能認定基準》的社群貼文。
嚴禁任何醫療療效宣稱，將誇大詞替換為合規修飾詞（例如「毛孔消失」改為「修飾毛孔」、「24小時不脫妝」改為「長效持妝」）。

審查建議：
${feedback}

【輸出規定】：
必須直接輸出標準 JSON 陣列（只產出一篇文案，陣列內只有一個物件）：
[
  {
    "【標題】：": "吸睛主標題",
    "【解方】：": "針對痛點的溫和訴求",
    "【特點】：": "產品核心特色說明",
    "【促購】：": "行動呼籲",
    "【hashtag】：": "#標籤"
  }
]`;
  }

  const finalResponse = await callGeminiWithFallback(ai, {
    contents: legalPrompt,
    config: {
      responseMimeType: 'application/json',
    }
  });

  const text = safeExtractText(finalResponse);
  const result = extractJsonArray(text);

  if (!result || result.length === 0) {
    return [{
      "【標題】：": `${brand} ${productName}`,
      "【解方】：": text || "已根據受眾痛點生成最佳方案。",
      "【特點】：": productFeatures,
      "【促購】：": "點擊了解更多專屬優惠！",
      "【hashtag】：": `#${brand} #${productName.split(' ')[0]}`
    }];
  }

  return result;
}

export interface ImagePromptResult {
  title: string;
  overlayCopy: string;
  designIdea: string;
  prompt: string;
  imageUrl?: string;
}

export async function generateImagePrompt(
  apiKey: string,
  copyContent: string,
  styleName: string,
  styleDesc: string,
  onProgress?: (stage: string) => void,
  _modelToUse?: string
): Promise<ImagePromptResult[]> {
  const ai = getGeminiClient(apiKey);
  if (onProgress) onProgress('圖像構圖發想中...');
  const prompt = `根據文案發想 3 個圖像設計。
風格：${styleName} (${styleDesc})
文案：${copyContent}

請輸出標準 JSON 陣列：
[
  {
    "title": "圖片主標題",
    "overlayCopy": "畫面上壓字文案",
    "designIdea": "視覺構圖說明",
    "prompt": "高品質英文 AI 提示詞 (適合 Midjourney 或 Imagen)"
  }
]`;

  const response = await callGeminiWithFallback(ai, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });

  const res = extractJsonArray(safeExtractText(response));
  if (!res || res.length === 0) {
    return [{
      title: "主視覺設計",
      overlayCopy: "輕透持妝，一抹自然",
      designIdea: `${styleName}，搭配柔和光線展現產品質感`,
      prompt: "commercial cosmetic photography, elegant aesthetic, soft lighting, 8k resolution, minimalist"
    }];
  }
  return res;
}

export async function generateImageUrlFromPrompt(
  apiKey: string, 
  promptText: string, 
  modelId?: string
): Promise<string> {
  if (modelId === 'gpt-image-2') {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: promptText,
        n: 1,
        size: "1024x1024",
        response_format: "url"
      })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'OpenAI API error');
    }
    const result = await response.json();
    return result.data[0].url;
  }

  const ai = getGeminiClient(apiKey);
  const response = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt: promptText,
    config: {
      numberOfImages: 1,
      aspectRatio: '1:1',
      outputMimeType: 'image/jpeg'
    }
  });

  const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (base64ImageBytes) {
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  }
  throw new Error('No image generated');
}

export interface VideoScriptRow {
  scene: number;
  imageHint: string;
  camera: string;
  action: string;
  voiceover: string;
  screenText: string;
  time: string;
}

export async function generateVideoScript(
  apiKey: string, 
  copyContent: string,
  onProgress?: (stage: string) => void,
  _modelToUse?: string
): Promise<VideoScriptRow[]> {
  const ai = getGeminiClient(apiKey);
  if (onProgress) onProgress('影音腳本拆解中...');
  const prompt = `你是行銷影片腳本專家。請根據以下社群文案，設計一支 30 秒短影音 (Reels 9:16 直式) 分鏡腳本。
文案內容：
${copyContent}

請輸出 JSON 陣列，欄位規定如下：
[
  {
    "scene": 1, 
    "imageHint": "畫面示意描述", 
    "camera": "運鏡方式 (如: 特寫 / 快速剪輯)", 
    "action": "人物動作與情節描述", 
    "voiceover": "旁白與音效指引", 
    "screenText": "畫面押字/標題", 
    "time": "秒數區間 (如: 0-5s)"
  }
]

【重要】：
1. 這是 9:16 直式短影音腳本。
2. 絕對不要使用或輸出數學箭頭符號（例如 ->、=> 等），請一律使用純文字描述動作或轉場。
`;
  const response = await callGeminiWithFallback(ai, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });

  const res = extractJsonArray(safeExtractText(response));
  if (!res || res.length === 0) {
    return [
      {
        scene: 1,
        imageHint: "產品特寫與質感光澤",
        camera: "特寫微距",
        action: "展示產品質地",
        voiceover: "解決日常肌膚困擾的最佳選擇",
        screenText: "全新升級登場",
        time: "0-5s"
      }
    ];
  }
  return res;
}

async function ensureJsonFormat(
  apiKey: string, 
  type: 'copy' | 'image' | 'video', 
  content: string, 
  _modelToUse?: string
): Promise<string> {
  if (!content || content.trim() === '') return '[]';
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return content;
  } catch (e) {}
  const ai = getGeminiClient(apiKey);
  let hint = '';
  if (type === 'copy') hint = '[{"【標題】：":"..."}]';
  else if (type === 'image') hint = '[{"title":"..."}]';
  else hint = '[{"voiceover":"..."}]';
  const prompt = `請將內容轉換為 JSON 格式 ${hint}：\n${content}`;
  const response = await callGeminiWithFallback(ai, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });
  const res = extractJsonArray(safeExtractText(response));
  return JSON.stringify(res);
}

export async function generateMarketingProposal(
  apiKey: string,
  brand: string,
  productName: string,
  productFeatures: string,
  taAge: string,
  taDesc: string,
  taPain: string,
  selectedDetails: string,
  imageStyle: string,
  copyContent: string,
  imagePrompts: string,
  videoScript: string,
  _modelToUse?: string
): Promise<string> {
  const escapeHtml = (unsafe: string) => {
    return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };

  const finalCopyJson = await ensureJsonFormat(apiKey, 'copy', copyContent);
  const finalImageJson = await ensureJsonFormat(apiKey, 'image', imagePrompts);
  const finalVideoJson = await ensureJsonFormat(apiKey, 'video', videoScript);

  let parsedCopyContent = '';
  try {
    const arr = JSON.parse(finalCopyJson);
    parsedCopyContent = arr.map((item: any) => Object.entries(item).map(([k, v]) => `<strong>${escapeHtml(k)}</strong> ${escapeHtml(v as string)}`).join('<br>')).join('<br><br>');
  } catch (e) { parsedCopyContent = escapeHtml(copyContent); }

  let parsedImagePrompts = '';
  try {
    const arr = JSON.parse(finalImageJson);
    parsedImagePrompts = arr.map((item: any) => `<strong>標題：</strong> ${escapeHtml(item.title)}<br><strong>Prompt：</strong> ${escapeHtml(item.prompt)}`).join('<hr>');
  } catch(e) { parsedImagePrompts = escapeHtml(imagePrompts); }

  let parsedVideoScript = '';
  try {
    const arr = JSON.parse(finalVideoJson);
    parsedVideoScript = arr.map((item: any, idx: number) => `<strong>幕 ${idx+1}</strong><br><strong>旁白：</strong> ${escapeHtml(item.voiceover)}`).join('<hr>');
  } catch(e) { parsedVideoScript = escapeHtml(videoScript); }

  return `<html><body><h1>行銷企劃書</h1><p>品牌：${escapeHtml(brand)}</p><p>產品：${escapeHtml(productName)}</p><p>文案：<br>${parsedCopyContent}</p><p>圖像：<br>${parsedImagePrompts}</p><p>影片：<br>${parsedVideoScript}</p></body></html>`;
}

export async function analyzeCopyStyles(
  apiKey: string,
  copyList: string[]
): Promise<{ systemPrompt: string; jsonFormat: string }> {
  const ai = getGeminiClient(apiKey);
  const prompt = `分析文案風格，輸出 JSON: {"systemPrompt":"...","jsonFormat":"..."}\n範例：${copyList.join('\n')}`;
  const response = await callGeminiWithFallback(ai, {
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });
  const text = safeExtractText(response);
  try {
    const parsed = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return { systemPrompt: parsed.systemPrompt || '', jsonFormat: parsed.jsonFormat || '' };
  } catch (e) {
    return { systemPrompt: '', jsonFormat: '' };
  }
}