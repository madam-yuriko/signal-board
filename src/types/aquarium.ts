export interface AquariumDeathRecord {
  date: string;
  reason?: string;
}

export interface AquariumRecord {
  id: number;
  name: string;
  acquiredDate: string;
  store?: string;
  quantity: number;
  unitPrice?: number;
  tank?: string;
  deathRecords: AquariumDeathRecord[];
  notes?: string;
  taxonomyGroup: string;
  familyName?: string;
  scientificName?: string;
  profileSummary: string;
  maxSize?: string;
  wikipediaName?: string;
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
  familyName?: string;
  scientificName?: string;
  summary: string;
  maxSize?: string;
  sourceUrl?: string;
  imageUrl?: string;
}
