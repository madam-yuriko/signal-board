export interface RestaurantWishlistRecord {
  tabelogId: string;
  url: string;
  name: string;
  prefecture?: string;
  address?: string;
  genres: string[];
  score?: number;
  reviewCount?: number;
  tabelogSaveCount?: number;
  budget?: string;
  seats?: number;
  openedOn?: string;
  status?: string;
  reservation?: string;
  facility?: string;
  imageUrl?: string;
  addedAt: string;
  updatedAt: string;
}
