import { useState, useEffect } from 'react';
import { ImageStyle, ApiKey, Product, TaProfile, ProductDetail, ArchivedCopy, MarketingSettings } from '../types';


const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    brand: 'PuraVida',
    productName: '舒心好眠噴霧',
    features: '經實驗驗證好眠專利成分、快速均勻擴香不附著寢具、純複方自然舒緩香調、沉浸式睡前放鬆儀式',
    ownerId: 'default',
    createdAt: Date.now()
  },
  {
    id: 'prod-2',
    brand: 'KISSME',
    productName: 'FERME 裸光持久精華粉底',
    features: '58%護膚精華成分、三重柔焦修飾毛孔、高延展輕盈遮瑕、全天長效抗暗沉持妝',
    ownerId: 'default',
    createdAt: Date.now()
  },
  {
    id: 'prod-3',
    brand: 'PuraVida',
    productName: '分子保濕修護精華',
    features: '微米滲透科技、清爽不黏膩、深層補水提亮、針對疲憊暗沉肌膚修護',
    ownerId: 'default',
    createdAt: Date.now()
  }
];

const DEFAULT_TA_PROFILES: TaProfile[] = [
  {
    id: 'ta-1',
    ageGroup: '20-29 歲小資上班族 / 新鮮人',
    description: '通勤趕時間、預算有限但重視妝容完整度，下班後有聚會需求',
    painPoints: '早上化妝時間緊迫、夏日通勤容易出油脫妝、工作壓力大導致睡眠品質不佳',
    ownerId: 'default',
    createdAt: Date.now()
  },
  {
    id: 'ta-2',
    ageGroup: '30-45 歲輕熟齡知性女性',
    description: '注重日常氣色與效率，偏好優雅溫柔妝效，重視生活儀式感與肌膚深層修護',
    painPoints: '長時間待冷氣房導致底妝乾燥顯紋、膚色暗沉不均、淺眠易醒影響翌日氣色',
    ownerId: 'default',
    createdAt: Date.now()
  }
];

const DEFAULT_IMAGE_STYLES: ImageStyle[] = [
  {
    id: 'style-1',
    name: '日系溫暖優雅風 (KISSME 主題)',
    description: '柔和自然採光、粉膚色系與暖米色調、精緻生活感、清新透亮微距質感',
    ownerId: 'default',
    createdAt: Date.now()
  },
  {
    id: 'style-2',
    name: '現代科技極簡風 (PuraVida 主題)',
    description: '深黑深紫冷色調光影、水感流動、微觀分子結構、頂級專櫃保養品高級感',
    ownerId: 'default',
    createdAt: Date.now()
  }
];

const DEFAULT_PRODUCT_DETAILS: ProductDetail[] = [
  {
    id: 'detail-1',
    productId: 'prod-1',
    details: '專為枕邊及寢居空間設計之芳療噴霧；結合天竺葵、薰衣草、佛手柑與廣藿香純精油調和，快速營造安定放鬆氛圍，不殘留油漬與斑痕。',
    ownerId: 'default',
    createdAt: Date.now()
  },
  {
    id: 'detail-2',
    productId: 'prod-2',
    details: '含穀胱甘肽、菸鹼醯胺B3、人型神經醯胺與玻尿酸；搭配活性包裹科技與水潤薄膜，SPF50+ PA++++ 高防曬修飾暗沉。',
    ownerId: 'default',
    createdAt: Date.now()
  },
  {
    id: 'detail-3',
    productId: 'prod-3',
    details: '採用高滲透親水膜技術，迅速直達肌底，提升肌膚鎖水保濕力與健康屏障。',
    ownerId: 'default',
    createdAt: Date.now()
  }
];

// Helper：本地快取讀寫
const getLocalData = <T>(key: string, defaultData: T): T => {
  try {
    const saved = localStorage.getItem(`kissme_agent_${key}`);
    return saved ? JSON.parse(saved) : defaultData;
  } catch {
    return defaultData;
  }
};

const setLocalData = <T>(key: string, data: T) => {
  try {
    localStorage.setItem(`kissme_agent_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage:`, e);
  }
};

export function useAuth() {
  const user = {
    uid: 'guest-demo-user',
    email: 'demo@kissme-agent.com',
    displayName: '訪客體驗者'
  };
  return { user, loading: false };
}

export function useApiKey(userId: string | undefined) {
  const [apiKey, setApiKey] = useState<string>(() => {
    const saved = getLocalData<string>('gemini_api_key', '');
    return saved || '你的Gemini_API_Key';
  });
  const [chatGptApiKey, setChatGptApiKey] = useState<string>(() => {
    return getLocalData<string>('chatgpt_api_key', '');
  });

  const saveApiKey = async (geminiKey: string, chatGptKey?: string) => {
    setApiKey(geminiKey);
    setLocalData('gemini_api_key', geminiKey);
    if (chatGptKey !== undefined) {
      setChatGptApiKey(chatGptKey);
      setLocalData('chatgpt_api_key', chatGptKey);
    }
    alert('API Key 設定已成功保存於本機！');
  };

  return { apiKey, chatGptApiKey, saveApiKey };
}

export function useProducts(userId: string | undefined) {
  const [products, setProducts] = useState<Product[]>(() => {
    return getLocalData<Product[]>('products', DEFAULT_PRODUCTS);
  });

  const addProduct = async (product: Omit<Product, 'id' | 'ownerId' | 'createdAt'>) => {
    const newProduct: Product = {
      ...product,
      id: `prod-${Date.now()}`,
      ownerId: userId || 'default',
      createdAt: Date.now()
    };
    const updated = [newProduct, ...products];
    setProducts(updated);
    setLocalData('products', updated);
  };

  const updateProduct = async (id: string, product: Partial<Product>) => {
    const updated = products.map(p => (p.id === id ? { ...p, ...product } : p));
    setProducts(updated);
    setLocalData('products', updated);
  };

  const deleteProduct = async (id: string) => {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    setLocalData('products', updated);
  };

  return { products, addProduct, updateProduct, deleteProduct };
}

export function useTaProfiles(userId: string | undefined) {
  const [taProfiles, setTaProfiles] = useState<TaProfile[]>(() => {
    return getLocalData<TaProfile[]>('taProfiles', DEFAULT_TA_PROFILES);
  });

  const addTaProfile = async (ta: Omit<TaProfile, 'id' | 'ownerId' | 'createdAt'>) => {
    const newTa: TaProfile = {
      ...ta,
      id: `ta-${Date.now()}`,
      ownerId: userId || 'default',
      createdAt: Date.now()
    };
    const updated = [newTa, ...taProfiles];
    setTaProfiles(updated);
    setLocalData('taProfiles', updated);
  };

  const updateTaProfile = async (id: string, ta: Partial<TaProfile>) => {
    const updated = taProfiles.map(t => (t.id === id ? { ...t, ...ta } : t));
    setTaProfiles(updated);
    setLocalData('taProfiles', updated);
  };

  const deleteTaProfile = async (id: string) => {
    const updated = taProfiles.filter(t => t.id !== id);
    setTaProfiles(updated);
    setLocalData('taProfiles', updated);
  };

  return { taProfiles, addTaProfile, updateTaProfile, deleteTaProfile };
}

export function useProductDetails(userId: string | undefined) {
  const [productDetails, setProductDetails] = useState<ProductDetail[]>(() => {
    return getLocalData<ProductDetail[]>('productDetails', DEFAULT_PRODUCT_DETAILS);
  });

  const addProductDetail = async (detail: Omit<ProductDetail, 'id' | 'ownerId' | 'createdAt'>) => {
    const newDetail: ProductDetail = {
      ...detail,
      id: `detail-${Date.now()}`,
      ownerId: userId || 'default',
      createdAt: Date.now()
    };
    const updated = [newDetail, ...productDetails];
    setProductDetails(updated);
    setLocalData('productDetails', updated);
  };

  const updateProductDetail = async (id: string, detail: Partial<ProductDetail>) => {
    const updated = productDetails.map(d => (d.id === id ? { ...d, ...detail } : d));
    setProductDetails(updated);
    setLocalData('productDetails', updated);
  };

  const deleteProductDetail = async (id: string) => {
    const updated = productDetails.filter(d => d.productId !== id && d.id !== id);
    setProductDetails(updated);
    setLocalData('productDetails', updated);
  };

  return { productDetails, addProductDetail, updateProductDetail, deleteProductDetail };
}

export function useImageStyles(userId: string | undefined) {
  const [imageStyles, setImageStyles] = useState<ImageStyle[]>(() => {
    return getLocalData<ImageStyle[]>('imageStyles', DEFAULT_IMAGE_STYLES);
  });

  const addImageStyle = async (style: Omit<ImageStyle, 'id' | 'ownerId' | 'createdAt'>) => {
    const newStyle: ImageStyle = {
      ...style,
      id: `style-${Date.now()}`,
      ownerId: userId || 'default',
      createdAt: Date.now()
    };
    const updated = [newStyle, ...imageStyles];
    setImageStyles(updated);
    setLocalData('imageStyles', updated);
  };

  const updateImageStyle = async (id: string, style: Partial<ImageStyle>) => {
    const updated = imageStyles.map(s => (s.id === id ? { ...s, ...style } : s));
    setImageStyles(updated);
    setLocalData('imageStyles', updated);
  };

  const deleteImageStyle = async (id: string) => {
    const updated = imageStyles.filter(s => s.id !== id);
    setImageStyles(updated);
    setLocalData('imageStyles', updated);
  };

  return { imageStyles, addImageStyle, updateImageStyle, deleteImageStyle };
}

export function useArchivedCopies(userId: string | undefined) {
  const [archivedCopies, setArchivedCopies] = useState<ArchivedCopy[]>(() => {
    return getLocalData<ArchivedCopy[]>('archivedCopies', []);
  });

  const addArchivedCopy = async (copy: Omit<ArchivedCopy, 'id' | 'ownerId' | 'createdAt'>) => {
    const newCopy: ArchivedCopy = {
      ...copy,
      id: `copy-${Date.now()}`,
      ownerId: userId || 'default',
      createdAt: Date.now()
    };
    const updated = [newCopy, ...archivedCopies];
    setArchivedCopies(updated);
    setLocalData('archivedCopies', updated);
  };

  const deleteArchivedCopy = async (id: string) => {
    const updated = archivedCopies.filter(c => c.id !== id);
    setArchivedCopies(updated);
    setLocalData('archivedCopies', updated);
  };

  return { archivedCopies, addArchivedCopy, deleteArchivedCopy };
}

export function useMarketingSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<MarketingSettings | null>(() => {
    return getLocalData<MarketingSettings | null>('marketingSettings', {
      id: 'settings-default',
      userId: userId || 'default',
      mode: 'default',
      languageModel: 'gemma-4-31b-it',
      imageModel: 'gemini-3.1-flash-image-preview',
      customSystemPrompt: '',
      customJsonFormat: '',
      updatedAt: Date.now()
    });
  });

  const saveSettings = async (newSettings: Omit<MarketingSettings, 'id' | 'userId' | 'updatedAt'>) => {
    const updated: MarketingSettings = {
      ...newSettings,
      id: 'settings-default',
      userId: userId || 'default',
      updatedAt: Date.now()
    };
    setSettings(updated);
    setLocalData('marketingSettings', updated);
  };

  return { settings, saveSettings };
}