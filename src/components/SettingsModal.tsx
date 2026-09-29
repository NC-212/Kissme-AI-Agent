import React, { useState } from 'react';
import { X, Download } from 'lucide-react';
import { useAuth, useApiKey, useProducts, useTaProfiles, useProductDetails, useImageStyles, useArchivedCopies, useMarketingSettings } from '../hooks/useData';
import { analyzeCopyStyles } from '../lib/gemini';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const userId = user?.uid;
  const { apiKey, chatGptApiKey, saveApiKey } = useApiKey(userId);
  const { products, addProduct, deleteProduct } = useProducts(userId);
  const { taProfiles, addTaProfile, deleteTaProfile } = useTaProfiles(userId);
  const { productDetails, addProductDetail, deleteProductDetail } = useProductDetails(userId);
  const { imageStyles, addImageStyle, deleteImageStyle } = useImageStyles(userId);
  const { archivedCopies, addArchivedCopy, deleteArchivedCopy } = useArchivedCopies(userId);
  const { settings, saveSettings } = useMarketingSettings(userId);

  const [activeTab, setActiveTab] = useState<'api' | 'products' | 'tas' | 'details' | 'styles' | 'archive' | 'downloads'>('api');

  // API Key state
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempChatGptApiKey, setTempChatGptApiKey] = useState('');

  // Product state
  const [newProductName, setNewProductName] = useState('');
  const [newProductFeatures, setNewProductFeatures] = useState('');
  const [newProductBrand, setNewProductBrand] = useState('KISSME');

  // TA state
  const [newTaAge, setNewTaAge] = useState('');
  const [newTaDesc, setNewTaDesc] = useState('');
  const [newTaPain, setNewTaPain] = useState('');

  // Detail state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newDetailDesc, setNewDetailDesc] = useState('');

  // Style state
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleDesc, setNewStyleDesc] = useState('');

  // Archive state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ systemPrompt: string; jsonFormat: string } | null>(null);
  const [newArchiveContent, setNewArchiveContent] = useState('');
  const [newArchiveBrand, setNewArchiveBrand] = useState('');

  const handleAnalyzeStyles = async () => {
    if (archivedCopies.length === 0) {
      alert('存摺中尚無文案可供分析。');
      return;
    }
    if (!apiKey) {
      alert('請先設定 API Key 才能進行分析。');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeCopyStyles(apiKey, archivedCopies.map(c => c.content));
      setAnalysisResult(result);
    } catch (err: any) {
      alert('分析失敗：' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAnalyzedSettings = async () => {
    if (!analysisResult) return;
    try {
      await saveSettings({
        mode: settings?.mode || 'default',
        customSystemPrompt: analysisResult.systemPrompt,
        customJsonFormat: analysisResult.jsonFormat
      });
      alert('分析風格已儲存！您現在可以在生成文案時選擇「自訂風格」。');
      setAnalysisResult(null);
    } catch (err: any) {
      alert('儲存失敗：' + err.message);
    }
  };

  const handleSaveApi = () => {
    saveApiKey(tempApiKey || apiKey, tempChatGptApiKey || chatGptApiKey);
    alert('API Keys Saved!');
  };

  const handleToggleLanguageModel = async (model: 'gemma-4-31b-it' | 'gemini-3.1-pro-preview') => {
    try {
      await saveSettings({
        mode: settings?.mode || 'default',
        languageModel: model,
        imageModel: settings?.imageModel || 'gemini-3.1-flash-image-preview',
        customSystemPrompt: settings?.customSystemPrompt || '',
        customJsonFormat: settings?.customJsonFormat || ''
      });
    } catch (err: any) {
      alert('切換語言模型失敗：' + err.message);
    }
  };

  const handleToggleImageModel = async (model: 'gemini-3.1-flash-image-preview' | 'gpt-image-2') => {
    try {
      await saveSettings({
        mode: settings?.mode || 'default',
        languageModel: settings?.languageModel || 'gemma-4-31b-it',
        imageModel: model,
        customSystemPrompt: settings?.customSystemPrompt || '',
        customJsonFormat: settings?.customJsonFormat || ''
      });
    } catch (err: any) {
      alert('切換圖像模型失敗：' + err.message);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const response = await fetch(`/${filename}`);
      if (!response.ok) throw new Error('檔案讀取失敗');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('下載失敗：' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans text-slate-800">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white relative z-10">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">系統設定</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-52 bg-[#FDFCFB] p-4 border-r border-slate-100 flex flex-col gap-2">
            {[
              { id: 'api', label: 'API 設定' },
              { id: 'products', label: '產品管理' },
              { id: 'tas', label: 'TA 設定' },
              { id: 'details', label: '產品詳細資訊' },
              { id: 'styles', label: '產品圖像風格' },
              { id: 'archive', label: '文案存摺' },
              { id: 'downloads', label: '資源下載' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white selection:bg-rose-100">
            {activeTab === 'api' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900 flex items-center justify-between">
                    Gemini API 語言模型設置
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => handleToggleLanguageModel('gemma-4-31b-it')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${settings?.languageModel === 'gemma-4-31b-it' || !settings?.languageModel ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Gemma
                      </button>
                      <button
                        onClick={() => handleToggleLanguageModel('gemini-3.1-pro-preview')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${settings?.languageModel === 'gemini-3.1-pro-preview' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Gemini Pro
                      </button>
                    </div>
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">點擊上方按鈕切換 API 調用的核心語言模型。</p>

                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-sm text-rose-800 mb-6 space-y-2">
                    <p className="font-semibold flex items-center gap-1.5"><span className="w-4 h-4 inline-flex items-center justify-center bg-rose-200 text-rose-700 rounded-full text-[10px] font-bold">!</span> 如何獲取 Gemini API Key：</p>
                    <ol className="list-decimal pl-5 space-y-1 text-xs">
                      <li>請在新分頁開啟 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="font-medium underline hover:text-rose-900">Google AI Studio</a>。</li>
                      <li>登入並複製 API Key。</li>
                      <li>將金鑰貼到下方欄位並儲存。</li>
                    </ol>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Gemini API Key</label>
                      <input
                        type="password"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500 outline-none text-sm bg-white"
                        placeholder="AIzaSy..."
                        defaultValue={apiKey}
                        onChange={(e) => setTempApiKey(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900 flex items-center justify-between">
                    圖像生成模型設置
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => handleToggleImageModel('gemini-3.1-flash-image-preview')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${settings?.imageModel === 'gemini-3.1-flash-image-preview' || !settings?.imageModel ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Gemini Imagen
                      </button>
                      <button
                        onClick={() => handleToggleImageModel('gpt-image-2')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${settings?.imageModel === 'gpt-image-2' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        GPT Image
                      </button>
                    </div>
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">選擇圖像生成的核心模型。使用 GPT Image 需額外配置 API Key。</p>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">ChatGPT / OpenAI API Key (僅用於圖像)</label>
                      <input
                        type="password"
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500 outline-none text-sm bg-white"
                        placeholder="sk-..."
                        defaultValue={chatGptApiKey}
                        onChange={(e) => setTempChatGptApiKey(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={handleSaveApi}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold transition-all shadow-xl shadow-slate-200 active:scale-[0.98]"
                  >
                    儲存所有 API 設置
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">新增產品</h3>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="產品名稱"
                      className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                    />
                    <select
                      className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white"
                      value={newProductBrand}
                      onChange={(e) => setNewProductBrand(e.target.value)}
                    >
                      <option value="KISSME">KISSME</option>
                      <option value="PuraVida">PuraVida</option>
                    </select>
                    <textarea
                      placeholder="產品特色"
                      className="col-span-2 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white h-24"
                      value={newProductFeatures}
                      onChange={(e) => setNewProductFeatures(e.target.value)}
                    />
                    <div className="col-span-2">
                      <button
                        onClick={() => {
                          if(newProductName && newProductFeatures) {
                            addProduct({ productName: newProductName, features: newProductFeatures, brand: newProductBrand });
                            setNewProductName(''); setNewProductFeatures('');
                          }
                        }}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 shadow-md transition-colors"
                      >
                        新增產品
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">現有產品</h3>
                  <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    <ul className="">
                      {products.map(p => (
                        <li key={p.id} className="flex justify-between items-start p-4 hover:bg-slate-50 transition-colors">
                          <div>
                            <div className="font-semibold text-sm text-slate-800">[{p.brand}] {p.productName}</div>
                            <div className="text-sm text-slate-500 line-clamp-2 mt-1">{p.features}</div>
                          </div>
                          <button onClick={() => deleteProduct(p.id)} className="text-rose-500 hover:text-rose-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-transparent hover:bg-rose-50 hover:border-rose-100 transition-all ml-4 shrink-0">刪除</button>
                        </li>
                      ))}
                      {products.length === 0 && <li className="p-4"><p className="text-slate-400 text-sm">無資料</p></li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tas' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">新增 TA Profile</h3>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 grid grid-cols-1 gap-4">
                    <input
                      type="text"
                      placeholder="目標受眾/TA標籤 (例如：初學者、忙碌上班族、專業玩家)"
                      className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white"
                      value={newTaAge}
                      onChange={(e) => setNewTaAge(e.target.value)}
                    />
                    <textarea
                      placeholder="TA 描述 (例如：平時沒時間化妝，希望工具能幫助快速完妝。重視效率...)"
                      className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white h-24"
                      value={newTaDesc}
                      onChange={(e) => setNewTaDesc(e.target.value)}
                    />
                    <textarea
                      placeholder="TA 痛點 (例如：眼線到了下午就暈開、化妝新手容易手抖畫歪...)"
                      className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white h-24"
                      value={newTaPain}
                      onChange={(e) => setNewTaPain(e.target.value)}
                    />
                    <div>
                      <button
                        onClick={() => {
                          if(newTaAge && newTaDesc && newTaPain) {
                            addTaProfile({ ageGroup: newTaAge, description: newTaDesc, painPoints: newTaPain });
                            setNewTaAge(''); setNewTaDesc(''); setNewTaPain('');
                          }
                        }}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 shadow-md transition-colors"
                      >
                        新增 TA
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">現有 TA Profile</h3>
                  <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    <ul className="">
                      {taProfiles.map(ta => (
                        <li key={ta.id} className="flex justify-between items-start p-4 hover:bg-slate-50 transition-colors">
                          <div>
                            <div className="font-semibold text-sm text-slate-800">{ta.ageGroup}</div>
                            <div className="text-sm text-slate-600 mt-1"><span className="font-medium text-slate-500">描述:</span> {ta.description}</div>
                            <div className="text-sm text-rose-600 mt-1"><span className="font-medium text-rose-400">痛點:</span> {ta.painPoints}</div>
                          </div>
                          <button onClick={() => deleteTaProfile(ta.id)} className="text-rose-500 hover:text-rose-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-transparent hover:bg-rose-50 hover:border-rose-100 transition-all ml-4 shrink-0">刪除</button>
                        </li>
                      ))}
                      {taProfiles.length === 0 && <li className="p-4"><p className="text-slate-400 text-sm">無資料</p></li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'details' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">新增產品詳細資訊</h3>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 grid grid-cols-1 gap-4">
                    <select
                      className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white"
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                    >
                      <option value="">選擇產品...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.productName}</option>)}
                    </select>
                    <textarea
                      placeholder="相應產品詳細資訊"
                      className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white h-32"
                      value={newDetailDesc}
                      onChange={(e) => setNewDetailDesc(e.target.value)}
                    />
                    <div>
                      <button
                        onClick={() => {
                          if(selectedProductId && newDetailDesc) {
                            addProductDetail({ productId: selectedProductId, details: newDetailDesc });
                            setNewDetailDesc('');
                          }
                        }}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 shadow-md transition-colors"
                      >
                        新增詳細資訊
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">現有詳細資訊</h3>
                  <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    <ul className="">
                      {productDetails.map(d => {
                        const prod = products.find(p => p.id === d.productId);
                        return (
                          <li key={d.id} className="flex justify-between items-start p-4 hover:bg-slate-50 transition-colors">
                            <div>
                              <div className="font-semibold text-sm text-slate-800">對應產品: {prod?.productName || '已刪除產品'}</div>
                              <div className="text-sm text-slate-500 whitespace-pre-wrap mt-2">{d.details}</div>
                            </div>
                            <button onClick={() => deleteProductDetail(d.id)} className="text-rose-500 hover:text-rose-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-transparent hover:bg-rose-50 hover:border-rose-100 transition-all ml-4 shrink-0">刪除</button>
                          </li>
                        );
                      })}
                      {productDetails.length === 0 && <li className="p-4"><p className="text-slate-400 text-sm">無資料</p></li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'styles' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">新增產品圖像風格</h3>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 grid grid-cols-1 gap-4">
                    <input
                      type="text"
                      placeholder="風格名稱 (如：水彩風、極簡雜誌風)"
                      className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white"
                      value={newStyleName}
                      onChange={(e) => setNewStyleName(e.target.value)}
                    />
                    <textarea
                      placeholder="風格描述，可包含 Prompt 的關鍵字、光線、構圖等要求"
                      className="border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none bg-white h-32"
                      value={newStyleDesc}
                      onChange={(e) => setNewStyleDesc(e.target.value)}
                    />
                    <div>
                      <button
                        onClick={() => {
                          if (newStyleName && newStyleDesc) {
                            addImageStyle({ name: newStyleName, description: newStyleDesc });
                            setNewStyleName('');
                            setNewStyleDesc('');
                          }
                        }}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 shadow-md transition-colors"
                      >
                        新增風格
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">現有風格</h3>
                  <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    <ul className="">
                      {imageStyles.map(style => (
                        <li key={style.id} className="flex justify-between items-start p-4 hover:bg-slate-50 transition-colors">
                          <div>
                            <div className="font-semibold text-sm text-slate-800">{style.name}</div>
                            <div className="text-sm text-slate-500 whitespace-pre-wrap mt-2">{style.description}</div>
                          </div>
                          <button onClick={() => deleteImageStyle(style.id)} className="text-rose-500 hover:text-rose-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-transparent hover:bg-rose-50 hover:border-rose-100 transition-all ml-4 shrink-0">刪除</button>
                        </li>
                      ))}
                      {imageStyles.length === 0 && <li className="p-4"><p className="text-slate-400 text-sm">無資料</p></li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'archive' && (
              <div className="space-y-8">
                <div className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900">新增外部參考文案</h3>
                    <p className="text-slate-400 text-sm">貼上外部 (IG/FB) 表現優異的文案，作為 AI 學習寫作風格的樣本。</p>
                  </div>
                  
                  <div className="space-y-4">
                    <textarea
                      value={newArchiveContent}
                      onChange={(e) => setNewArchiveContent(e.target.value)}
                      placeholder="請貼上您想讓 AI 模仿的文案範例..."
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 min-h-[160px] focus:ring-2 focus:ring-rose-500 outline-none text-slate-700 leading-relaxed transition-all"
                    />
                    <div className="flex gap-4">
                      <select 
                        className="bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-rose-500"
                        value={newArchiveBrand}
                        onChange={(e) => setNewArchiveBrand(e.target.value)}
                      >
                        <option value="">選擇品牌 (選填)</option>
                        <option value="KISSME">KISSME</option>
                        <option value="PuraVida">PuraVida</option>
                      </select>
                      <button
                        onClick={async () => {
                          if (!newArchiveContent.trim()) return;
                          await addArchivedCopy({ content: newArchiveContent, brand: newArchiveBrand });
                          setNewArchiveContent('');
                          setNewArchiveBrand('');
                          alert('範例已存入存摺！');
                        }}
                        className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-200 transition-all active:scale-[0.98]"
                      >
                        新增至存摺
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-900 p-6 rounded-2xl text-white shadow-xl">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold tracking-tight">AI 文案風格分析</h3>
                    <p className="text-slate-400 text-sm">點擊按鈕，AI 將分析存摺中所有範例並自動產出專屬 Prompt 與 JSON 格式。</p>
                  </div>
                  <button
                    onClick={handleAnalyzeStyles}
                    disabled={isAnalyzing || archivedCopies.length === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-rose-500 hover:bg-rose-400 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-900/20 active:scale-95"
                  >
                    {isAnalyzing ? (
                      <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : null}
                    {isAnalyzing ? '分析中...' : '一鍵分析寫作風格'}
                  </button>
                </div>

                {analysisResult && (
                  <div className="bg-rose-50 border-2 border-rose-100 p-8 rounded-3xl space-y-6 shadow-inner animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        分析結果預覽
                      </h4>
                      <button 
                        onClick={() => setAnalysisResult(null)}
                        className="text-slate-400 hover:text-slate-600 text-sm font-medium"
                      >
                        取消
                      </button>
                    </div>
                    
                    <div className="space-y-4 text-sm">
                      <div className="space-y-2">
                        <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">AI 角色與品牌人設 (System Prompt)</label>
                        <textarea
                          className="w-full bg-white border border-rose-200 rounded-2xl p-4 min-h-[120px] shadow-sm focus:ring-2 focus:ring-rose-500 outline-none text-slate-700 leading-relaxed"
                          value={analysisResult.systemPrompt}
                          onChange={(e) => setAnalysisResult({ ...analysisResult, systemPrompt: e.target.value })}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">自訂 JSON 結構與撰寫規則</label>
                        <textarea
                          className="w-full bg-white border border-rose-200 rounded-2xl p-4 min-h-[120px] shadow-sm focus:ring-2 focus:ring-rose-500 outline-none font-mono text-xs text-slate-700 leading-relaxed"
                          value={analysisResult.jsonFormat}
                          onChange={(e) => setAnalysisResult({ ...analysisResult, jsonFormat: e.target.value })}
                        />
                      </div>

                      <button
                        onClick={handleSaveAnalyzedSettings}
                        className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold shadow-lg shadow-rose-200 transition-all active:scale-[0.98]"
                      >
                        確定儲存並作為自訂風格
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-bold text-slate-900">過往文案存摺 ({archivedCopies.length})</h3>
                    <div className="flex gap-4">
                       <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">目前模式：</span>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                          <button
                            onClick={() => saveSettings({ ...settings!, mode: 'default' })}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${settings?.mode === 'default' || !settings ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                          >
                            預設
                          </button>
                          <button
                            onClick={() => {
                              if (!settings?.customSystemPrompt) {
                                alert('尚未有分析後的自訂風格，請先進行分析。');
                                return;
                              }
                              saveSettings({ ...settings!, mode: 'custom' });
                            }}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${settings?.mode === 'custom' ? 'bg-rose-500 text-white' : 'text-slate-400'}`}
                          >
                            自訂分析
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {archivedCopies.sort((a, b) => b.createdAt - a.createdAt).map(copy => (
                      <div key={copy.id} className="group bg-white p-6 rounded-3xl border border-slate-100 hover:border-slate-200 hover:shadow-xl hover:shadow-slate-200/40 transition-all relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-100 group-hover:bg-rose-400 transition-colors" />
                        <div className="flex justify-between items-start">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">{copy.brand || '未指定'}</span>
                              <span className="text-[10px] text-slate-400">{new Date(copy.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap line-clamp-4 group-hover:line-clamp-none transition-all duration-300">
                              {copy.content}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if(confirm('確定要刪除這筆文案範例嗎？')) deleteArchivedCopy(copy.id);
                            }}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all ml-4"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {archivedCopies.length === 0 && (
                      <div className="py-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                          <X className="w-8 h-8 text-slate-200" />
                        </div>
                        <p className="text-slate-400 text-sm">存摺中尚無紀錄。您可以在生成文案後點擊儲存來累積範例。</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'downloads' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">資源下載</h3>
                  <p className="text-sm text-slate-500 mb-6">可從此處下載行銷企劃書與評分表範本。</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                      onClick={() => handleDownload('行銷企劃書白板格式.docx')}
                      className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-rose-50 hover:border-rose-100 transition-all group text-left"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-900 group-hover:text-rose-700 transition-colors text-base">行銷企劃書白板格式</span>
                        <span className="text-xs text-slate-400">Word 文檔 (.docx)</span>
                      </div>
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-rose-500 group-hover:text-white transition-all text-slate-400">
                        <Download className="w-5 h-5" />
                      </div>
                    </button>

                    <button 
                      onClick={() => handleDownload('人工評分表.docx')}
                      className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-rose-50 hover:border-rose-100 transition-all group text-left"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-900 group-hover:text-rose-700 transition-colors text-base">人工評分表</span>
                        <span className="text-xs text-slate-400">Word 文檔 (.docx)</span>
                      </div>
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-rose-500 group-hover:text-white transition-all text-slate-400">
                        <Download className="w-5 h-5" />
                      </div>
                    </button>

                    <button 
                      onClick={() => handleDownload('readme.html')}
                      className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-rose-50 hover:border-rose-100 transition-all group text-left"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-900 group-hover:text-rose-700 transition-colors text-base">工作流說明書 (美化版/PDF)</span>
                        <span className="text-xs text-slate-400">HTML 網頁 / 可轉存 PDF</span>
                      </div>
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-rose-500 group-hover:text-white transition-all text-slate-400">
                        <Download className="w-5 h-5" />
                      </div>
                    </button>

                    <button 
                      onClick={() => handleDownload('README.md')}
                      className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-rose-50 hover:border-rose-100 transition-all group text-left shadow-sm"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-900 group-hover:text-rose-700 transition-colors text-base">GitHub README</span>
                        <span className="text-xs text-slate-400">Markdown 格式 (.md)</span>
                      </div>
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-rose-500 group-hover:text-white transition-all text-slate-400">
                        <Download className="w-5 h-5" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
