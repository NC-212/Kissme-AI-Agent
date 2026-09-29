import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { ImageStyle, ApiKey, Product, TaProfile, ProductDetail, ArchivedCopy, MarketingSettings } from '../types';
import { onAuthStateChanged, User } from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}

export function useApiKey(userId: string | undefined) {
  const [apiKeyObj, setApiKeyObj] = useState<ApiKey | null>(null);
  
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, 'apiKeys', userId), (docSnap) => {
      if (docSnap.exists()) {
        setApiKeyObj({ id: docSnap.id, ...docSnap.data() } as ApiKey);
      } else {
        setApiKeyObj(null);
      }
    });
    return unsub;
  }, [userId]);

  const saveApiKey = async (geminiKey: string, chatGptKey?: string) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'apiKeys', userId), {
        userId,
        geminiApiKey: geminiKey,
        chatGptApiKey: chatGptKey || '',
        updatedAt: Date.now()
      });
    } catch (e) {
      handleFirestoreError(e, 'create', `/apiKeys/${userId}`);
    }
  };

  return { 
    apiKey: apiKeyObj?.geminiApiKey || '', 
    chatGptApiKey: apiKeyObj?.chatGptApiKey || '',
    saveApiKey 
  };
}

export function useProducts(userId: string | undefined) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'products'), where('ownerId', '==', userId));
    const unsub = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return unsub;
  }, [userId]);

  const addProduct = async (product: Omit<Product, 'id' | 'ownerId' | 'createdAt'>) => {
    if (!userId) return;
    const newDoc = doc(collection(db, 'products'));
    await setDoc(newDoc, {
      ...product,
      ownerId: userId,
      createdAt: Date.now()
    });
  };

  const updateProduct = async (id: string, product: Partial<Product>) => {
    await updateDoc(doc(db, 'products', id), product);
  };

  const deleteProduct = async (id: string) => {
    await deleteDoc(doc(db, 'products', id));
  };

  return { products, addProduct, updateProduct, deleteProduct };
}

export function useTaProfiles(userId: string | undefined) {
  const [taProfiles, setTaProfiles] = useState<TaProfile[]>([]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'taProfiles'), where('ownerId', '==', userId));
    const unsub = onSnapshot(q, (snapshot) => {
      setTaProfiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaProfile)));
    });
    return unsub;
  }, [userId]);

  const addTaProfile = async (ta: Omit<TaProfile, 'id' | 'ownerId' | 'createdAt'>) => {
    if (!userId) return;
    const newDoc = doc(collection(db, 'taProfiles'));
    await setDoc(newDoc, {
      ...ta,
      ownerId: userId,
      createdAt: Date.now()
    });
  };

  const updateTaProfile = async (id: string, ta: Partial<TaProfile>) => {
    await updateDoc(doc(db, 'taProfiles', id), ta);
  };

  const deleteTaProfile = async (id: string) => {
    await deleteDoc(doc(db, 'taProfiles', id));
  };

  return { taProfiles, addTaProfile, updateTaProfile, deleteTaProfile };
}

export function useProductDetails(userId: string | undefined) {
  const [productDetails, setProductDetails] = useState<ProductDetail[]>([]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'productDetails'), where('ownerId', '==', userId));
    const unsub = onSnapshot(q, (snapshot) => {
      setProductDetails(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDetail)));
    });
    return unsub;
  }, [userId]);

  const addProductDetail = async (detail: Omit<ProductDetail, 'id' | 'ownerId' | 'createdAt'>) => {
    if (!userId) return;
    const newDoc = doc(collection(db, 'productDetails'));
    await setDoc(newDoc, {
      ...detail,
      ownerId: userId,
      createdAt: Date.now()
    });
  };

  const updateProductDetail = async (id: string, detail: Partial<ProductDetail>) => {
    await updateDoc(doc(db, 'productDetails', id), detail);
  };

  const deleteProductDetail = async (id: string) => {
    await deleteDoc(doc(db, 'productDetails', id));
  };

  return { productDetails, addProductDetail, updateProductDetail, deleteProductDetail };
}

export function useImageStyles(userId: string | undefined) {
  const [imageStyles, setImageStyles] = useState<ImageStyle[]>([]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'imageStyles'), where('ownerId', '==', userId));
    const unsub = onSnapshot(q, (snapshot) => {
      setImageStyles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImageStyle)));
    });
    return unsub;
  }, [userId]);

  const addImageStyle = async (style: Omit<ImageStyle, 'id' | 'ownerId' | 'createdAt'>) => {
    if (!userId) return;
    const newDoc = doc(collection(db, 'imageStyles'));
    await setDoc(newDoc, {
      ...style,
      ownerId: userId,
      createdAt: Date.now()
    });
  };

  const updateImageStyle = async (id: string, style: Partial<ImageStyle>) => {
    await updateDoc(doc(db, 'imageStyles', id), style);
  };

  const deleteImageStyle = async (id: string) => {
    await deleteDoc(doc(db, 'imageStyles', id));
  };

  return { imageStyles, addImageStyle, updateImageStyle, deleteImageStyle };
}

export function useArchivedCopies(userId: string | undefined) {
  const [archivedCopies, setArchivedCopies] = useState<ArchivedCopy[]>([]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'archivedCopies'), where('ownerId', '==', userId));
    const unsub = onSnapshot(q, (snapshot) => {
      setArchivedCopies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArchivedCopy)));
    });
    return unsub;
  }, [userId]);

  const addArchivedCopy = async (copy: Omit<ArchivedCopy, 'id' | 'ownerId' | 'createdAt'>) => {
    if (!userId) return;
    const newDoc = doc(collection(db, 'archivedCopies'));
    await setDoc(newDoc, {
      ...copy,
      ownerId: userId,
      createdAt: Date.now()
    });
  };

  const deleteArchivedCopy = async (id: string) => {
    await deleteDoc(doc(db, 'archivedCopies', id));
  };

  return { archivedCopies, addArchivedCopy, deleteArchivedCopy };
}

export function useMarketingSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<MarketingSettings | null>(null);

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, 'marketingSettings', userId), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ id: docSnap.id, ...docSnap.data() } as MarketingSettings);
      } else {
        setSettings(null);
      }
    });
    return unsub;
  }, [userId]);

  const saveSettings = async (newSettings: Omit<MarketingSettings, 'id' | 'userId' | 'updatedAt'>) => {
    if (!userId) return;
    await setDoc(doc(db, 'marketingSettings', userId), {
      ...newSettings,
      userId,
      updatedAt: Date.now()
    });
  };

  return { settings, saveSettings };
}
