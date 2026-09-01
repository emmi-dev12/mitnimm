const PLANET = "https://tiles.openfreemap.org/planet";
const MAX_TILES = 700;

function lon2tile(lon: number, z: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function lat2tile(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

export function tileCount(b: { west: number; south: number; east: number; north: number }, z0: number, z1: number) {
  let n = 0;
  for (let z = z0; z <= z1; z++) {
    const x0 = lon2tile(b.west, z);
    const x1 = lon2tile(b.east, z);
    const y0 = lat2tile(b.north, z);
    const y1 = lat2tile(b.south, z);
    n += (Math.abs(x1 - x0) + 1) * (Math.abs(y1 - y0) + 1);
  }
  return n;
}

async function grab(url: string) {
  await fetch(url, { mode: "cors" }).catch(() => {});
}

export async function downloadArea(
  b: { west: number; south: number; east: number; north: number },
  onProg: (done: number, total: number) => void,
) {
  const tj = (await fetch(PLANET).then((r) => r.json())) as { tiles?: string[]; maxzoom?: number };
  const tmpl = tj.tiles?.[0];
  if (!tmpl) throw new Error("tiles");
  const zMax = Math.min(14, tj.maxzoom ?? 14);
  const z0 = 8;
  if (tileCount(b, z0, zMax) > MAX_TILES) throw new Error("big");

  const urls: string[] = [
    "https://tiles.openfreemap.org/styles/liberty",
    PLANET,
    "https://tiles.openfreemap.org/sprites/ofm_f384/ofm.json",
    "https://tiles.openfreemap.org/sprites/ofm_f384/ofm.png",
    "https://tiles.openfreemap.org/sprites/ofm_f384/ofm@2x.json",
    "https://tiles.openfreemap.org/sprites/ofm_f384/ofm@2x.png",
  ];
  for (const face of ["Noto Sans Regular", "Noto Sans Bold", "Noto Sans Italic"]) {
    for (const range of ["0-255", "256-511", "512-767"]) {
      urls.push(`https://tiles.openfreemap.org/fonts/${encodeURIComponent(face)}/${range}.pbf`);
    }
  }
  for (let z = z0; z <= zMax; z++) {
    const x0 = Math.min(lon2tile(b.west, z), lon2tile(b.east, z));
    const x1 = Math.max(lon2tile(b.west, z), lon2tile(b.east, z));
    const y0 = Math.min(lat2tile(b.north, z), lat2tile(b.south, z));
    const y1 = Math.max(lat2tile(b.north, z), lat2tile(b.south, z));
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        urls.push(tmpl.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)));
      }
    }
  }

  let done = 0;
  const total = urls.length;
  onProg(0, total);
  const q = [...urls];
  async function worker() {
    while (q.length) {
      const u = q.shift();
      if (!u) break;
      await grab(u);
      done += 1;
      onProg(done, total);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
}
