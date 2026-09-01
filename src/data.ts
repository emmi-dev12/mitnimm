export type Lang = "de" | "en";

export type Spot = {
  id: string;
  lat: number;
  lon: number;
  quote: string;
  quoteEn: string;
  category: string;
  categoryEn: string;
  items: string;
  itemsEn: string;
  photo: string;
  street?: string;
  createdAt: number;
  hoursLeft: number;
  gone?: boolean;
  goneAt?: number;
};

export const CH = {
  minLat: 45.8,
  maxLat: 47.9,
  minLon: 5.9,
  maxLon: 10.6,
};

export const ZH = { lat: 47.3765, lon: 8.5254 };

export const spots: Spot[] = [
  {
    id: "s1",
    lat: 47.3782,
    lon: 8.5278,
    quote: "SOFA",
    quoteEn: "SOFA",
    category: "Möbel",
    categoryEn: "Furniture",
    items: "1 Sofa",
    itemsEn: "1 sofa",
    photo: "/piles/sofa.png",
    createdAt: Date.now() - 10 * 3600_000,
    hoursLeft: 14,
  },
  {
    id: "s2",
    lat: 47.3796,
    lon: 8.5312,
    quote: "BÜCHER",
    quoteEn: "BOOKS",
    category: "Bücher",
    categoryEn: "Books",
    items: "Karton Bücher",
    itemsEn: "box of books",
    photo: "/piles/books.png",
    createdAt: Date.now() - 4 * 3600_000,
    hoursLeft: 20,
  },
  {
    id: "s3",
    lat: 47.3751,
    lon: 8.5229,
    quote: "LAMPE",
    quoteEn: "LAMP",
    category: "Haushalt",
    categoryEn: "Household",
    items: "1 Lampe",
    itemsEn: "1 lamp",
    photo: "/piles/lamp.png",
    createdAt: Date.now() - 2 * 3600_000,
    hoursLeft: 22,
  },
];

export function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function inCH(lat: number, lon: number) {
  return lat >= CH.minLat && lat <= CH.maxLat && lon >= CH.minLon && lon <= CH.maxLon;
}

export const TTL_H = 72;

export function hoursLeft(s: Spot) {
  return Math.max(0, Math.round((s.createdAt + TTL_H * 3600_000 - Date.now()) / 3600_000));
}
