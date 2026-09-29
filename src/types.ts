export interface ApiKey {
  id: string; // Document ID (usually userId)
  userId: string;
  geminiApiKey: string;
  chatGptApiKey?: string;
  updatedAt: number;
}

export interface Product {
  id: string;
  ownerId: string;
  productName: string;
  features: string;
  brand: string;
  createdAt: number;
}

export interface TaProfile {
  id: string;
  ownerId: string;
  ageGroup: string;
  description: string;
  painPoints: string;
  createdAt: number;
}

export interface ProductDetail {
  id: string;
  ownerId: string;
  productId: string;
  details: string;
  createdAt: number;
}

export interface ImageStyle {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  createdAt: number;
}

export interface ArchivedCopy {
  id: string;
  ownerId: string;
  content: string; // The full text content
  brand?: string;
  createdAt: number;
}

export interface MarketingSettings {
  id: string; // Usually userId
  userId: string;
  mode: 'default' | 'custom';
  languageModel?: 'gemma-4-31b-it' | 'gemini-3.1-pro-preview';
  imageModel?: 'gemini-3.1-flash-image-preview' | 'gpt-image-2';
  customSystemPrompt: string;
  customJsonFormat: string;
  updatedAt: number;
}
