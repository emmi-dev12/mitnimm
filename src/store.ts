import { type Spot } from "./data";

export function itemList(s: Spot) {
  return s.items
    .split(/[,+/]| und /i)
    .map((x) => x.trim())
    .filter(Boolean);
}

const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

function withApi(path: string) {
  return `${API}${path}`;
}

export function mediaUrl(path: string) {
  if (!path || path.startsWith("http") || path.startsWith("data:")) return path;
  return withApi(path);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (API.includes("ngrok")) headers.set("ngrok-skip-browser-warning", "1");
  const r = await fetch(withApi(path), { ...init, headers });
  if (!r.ok) throw new Error(`api ${r.status}`);
  return r.json() as Promise<T>;
}

export function loadSpots() {
  return api<Spot[]>("/api/spots");
}

export function loadHistory() {
  return api<Spot[]>("/api/history");
}

export function createSpot(fields: Record<string, string>, photo: Blob) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  form.set("photo", photo, "pile.jpg");
  return api<Spot>("/api/spots", { method: "POST", body: form });
}

export function stillSpot(id: string) {
  return api<Spot>(`/api/spots/${id}/still`, { method: "POST" });
}

export function goneSpot(id: string, remaining?: string[]) {
  return api<Spot>(`/api/spots/${id}/gone`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ remaining }),
  });
}
