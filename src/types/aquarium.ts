export interface AquariumRecord {
  id: number;
  name: string;
  acquiredDate: string;
  store?: string;
  quantity: number;
  unitPrice?: number;
  tank?: string;
  deathDate?: string;
  notes?: string;
  taxonomyGroup: string;
  profileSummary: string;
  sourceUrl?: string;
  externalImageUrl?: string;
  hasUploadedPhoto: boolean;
  photoUpdatedAt?: string;
  profileUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AquariumProfile {
  taxonomyGroup: string;
  summary: string;
  sourceUrl?: string;
  imageUrl?: string;
}
