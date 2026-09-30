import { GoogleGenAI } from '@google/genai';
import { KISS_ME_EMOJIS } from './emojis';


export const getGeminiClient = (apiKey: string) => {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }
  return new GoogleGenAI({ apiKey });
};


 
function safeExtractText(response: any): string {
  const parts = response.candidates?.[0]?.content?.parts;
  if (parts && Array.isArray(parts)) {
    return parts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join('');
  }
  try {
    return response.text || '';
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
      } catch (e) {
      }
      searchIndex = text.lastIndexOf('[', searchIndex - 1);
    }
    lastBracket = text.lastIndexOf(']', lastBracket - 1);
  }
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
  // 統一採用官方標準穩定模型
  const modelToUse = 'gemini-1.5-flash';
  
  if (onProgress) onProgress('AI 初步生成中...');
  
  let focusInstructions = '';
  if (format === 'format1') {
    focusInstructions = `
# 內容重心：TA 與 痛點導向
- 深入挖掘目標受眾 (${taDesc}) 的生活場景。
- 強力描述痛點 (${taPain})，產生物理或心理上的共鳴。
- 將產品功能轉化為解決這些困擾的「救贖」。
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
請撰寫一篇社群貼文（350字以內）。請輸出純文字。
# Emoji 使用指引
${KISS_ME_EMOJIS}
`;
  } else {
    primaryPrompt = `
# Role
你是行銷專家。針對品牌 ${brand} 撰寫文案。
產品：${productName} - ${productFeatures}
目標受眾：${taDesc} (${taAge})。痛點：${taPain}
${productDetails ? `詳細資訊：${productDetails}\n` : ''}
${focusInstructions}
請撰寫吸引人的貼文。
# Emoji 使用指引
${KISS_ME_EMOJIS}
`;
  }

  const primaryResponse = await ai.models.generateContent({
    model: modelToUse,
    contents: primaryPrompt,
  });
  const initialCopy = safeExtractText(primaryResponse);

  if (onProgress) onProgress('AI 審核建議中...');
  const criticPrompt = `作為審查官，請給予這段文案改進建議：\n${initialCopy}`;
  const criticResponse = await ai.models.generateContent({
    model: modelToUse,
    contents: criticPrompt,
  });
  const feedback = safeExtractText(criticResponse);

  if (onProgress) onProgress('最終生成中...');
  let finalPrompt = '';
  if (customSettings?.mode === 'custom') {
    finalPrompt = `根據建議：${feedback}\n請重新撰寫，強烈要求：只產出「一篇」文案，並輸出 JSON 格式：\n[\n  {\n${customSettings.jsonFormat}\n  }\n]`;
  } else {
    finalPrompt = `根據建議：${feedback}\n請重新撰寫，強烈要求：只產出「一篇」文案，並輸出 JSON 格式：\n[\n  {\n    "【標題】：": "...",\n    "【解方】：": "...",\n    "【特點】：": "...",\n    "【促購】：": "...",\n    "【hashtag】：": "..."\n  }\n]`;
  }

  const finalResponse = await ai.models.generateContent({
    model: modelToUse,
    contents: finalPrompt,
  });
  const text = safeExtractText(finalResponse);

  if (onProgress) onProgress('法規審查中...');
  const legalPrompt = `你是化妝品廣告法規專家。請嚴格審核以下行銷文案（JSON格式）是否違反《化妝品標示宣傳廣告涉及虛偽誇大或醫療效能認定基準》（例如醫療效能宣稱、過度誇大）。
如果發現違規，請直接在原始文案內將違規詞彙替換為合法詞彙（例如「讓毛孔消失」改為「修飾毛孔」、「救贖」改為「理想選擇」）。

【重要指示】：
1. 你的輸出必須是一份「修正後的行銷文案」，且必須維持與原始輸入完全相同的 JSON 結構！
2. 只產出一篇文案（JSON 陣列內只有一個物件）。
3. 絕對不可以輸出「修正清單」、「建議列表」或「修改理由」。
4. 只能輸出包含修正後文案的單一 JSON 陣列。

原始文案（JSON）：
${text}`;
  const legalResponse = await ai.models.generateContent({
    model: modelToUse,
    contents: legalPrompt,
  });

  return extractJsonArray(safeExtractText(legalResponse));
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
  modelToUse: string = 'gemini-1.5-flash'
): Promise<ImagePromptResult[]> {
  const ai = getGeminiClient(apiKey);
  if (onProgress) onProgress('圖像構圖發想中...');
  const prompt = `根據文案發想 3 個圖像設計。風格：${styleName} (${styleDesc})\n文案：${copyContent}\n輸出 JSON 陣列 [{"title":"...","overlayCopy":"...","designIdea":"...","prompt":"英文 AI 指令"}]`;
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: prompt,
  });
  const res = extractJsonArray(safeExtractText(response));
  return res;
}

export async function generateImageUrlFromPrompt(
  apiKey: string, 
  promptText: string, 
  modelId: string = 'gemini-1.5-flash'
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

  // 避免 preview 權限問題，生圖直接呼叫 Imagen 3 穩定端點
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
  modelToUse: string = 'gemini-1.5-flash'
): Promise<VideoScriptRow[]> {
  const ai = getGeminiClient(apiKey);
  if (onProgress) onProgress('影音腳本拆解中...');
  const prompt = `你是行銷影片腳本專家。請根據以下社群文案，設計一支 30 秒短影音 (Reels 9:16 直式) 分鏡腳本。
文案內容：
${copyContent}

請輸出 JSON 陣列，包含以下欄位：
[
  {
    "scene": 1, 
    "imageHint": "畫面示意描述 (如: 疲憊臉龐特寫\\n冷色調晨光)", 
    "camera": "運鏡方式 (如: 特寫 / 快速剪輯)", 
    "action": "人物動作與情節 (如: 展現疲憊臉龐...)", 
    "voiceover": "旁白與音效指引 (如: 旁白：為什麼睡飽了...)", 
    "screenText": "畫面押字/標題 (如: 保養進入瓶頸期？)", 
    "time": "秒數區間 (如: 0-5s)"
  }
]

【重要】：
1. 這是 9:16 直式短影音腳本。
2. 絕對不要使用或輸出數學箭頭符號（例如 $\\rightarrow$、->、=> 等），請一律使用純文字描述動作或轉場。
`;
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: prompt,
  });
  return extractJsonArray(safeExtractText(response));
}

async function ensureJsonFormat(
  apiKey: string, 
  type: 'copy' | 'image' | 'video', 
  content: string, 
  modelToUse: string = 'gemini-1.5-flash'
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
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: prompt,
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
  modelToUse: string = 'gemini-1.5-flash'
): Promise<string> {
  const escapeHtml = (unsafe: string) => {
    return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };

  const finalCopyJson = await ensureJsonFormat(apiKey, 'copy', copyContent, modelToUse);
  const finalImageJson = await ensureJsonFormat(apiKey, 'image', imagePrompts, modelToUse);
  const finalVideoJson = await ensureJsonFormat(apiKey, 'video', videoScript, modelToUse);

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
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: prompt,
  });
  const text = safeExtractText(response);
  try {
    const parsed = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return { systemPrompt: parsed.systemPrompt || '', jsonFormat: parsed.jsonFormat || '' };
  } catch (e) {
    return { systemPrompt: '', jsonFormat: '' };
  }
}