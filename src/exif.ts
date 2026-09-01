function u16(v: DataView, o: number, le: boolean) {
  return v.getUint16(o, le);
}
function u32(v: DataView, o: number, le: boolean) {
  return v.getUint32(o, le);
}

function rationals(v: DataView, o: number, le: boolean, n: number) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const num = v.getUint32(o + i * 8, le);
    const den = v.getUint32(o + i * 8 + 4, le);
    out.push(den ? num / den : 0);
  }
  return out;
}

function dms(vals: number[]) {
  return (vals[0] ?? 0) + (vals[1] ?? 0) / 60 + (vals[2] ?? 0) / 3600;
}

function findApp1(buf: ArrayBuffer): DataView | null {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  let i = 2;
  while (i + 4 < v.byteLength) {
    if (v.getUint8(i) !== 0xff) break;
    const marker = v.getUint8(i + 1);
    const len = v.getUint16(i + 2);
    if (marker === 0xe1) {
      const start = i + 4;
      const ascii = new TextDecoder().decode(new Uint8Array(buf, start, 4));
      if (ascii === "Exif") return new DataView(buf, start + 6, len - 8);
      return null;
    }
    if (marker === 0xda) break;
    i += 2 + len;
  }
  return null;
}

export function gpsFromJpeg(buf: ArrayBuffer): { lat: number; lon: number } | null {
  const tiff = findApp1(buf);
  if (!tiff || tiff.byteLength < 8) return null;
  const le = tiff.getUint16(0) === 0x4949;
  if (!le && tiff.getUint16(0) !== 0x4d4d) return null;
  const ifd0 = u32(tiff, 4, le);
  const n0 = u16(tiff, ifd0, le);
  let gpsOff = 0;
  for (let i = 0; i < n0; i++) {
    const e = ifd0 + 2 + i * 12;
    if (u16(tiff, e, le) === 0x8825 && u16(tiff, e + 2, le) === 4) {
      gpsOff = u32(tiff, e + 8, le);
    }
  }
  if (!gpsOff) return null;
  const n = u16(tiff, gpsOff, le);
  let latRef = "N";
  let lonRef = "E";
  let lat = 0;
  let lon = 0;
  let gotLat = false;
  let gotLon = false;
  for (let i = 0; i < n; i++) {
    const e = gpsOff + 2 + i * 12;
    const tag = u16(tiff, e, le);
    const type = u16(tiff, e + 2, le);
    const count = u32(tiff, e + 4, le);
    const val = u32(tiff, e + 8, le);
    if (tag === 1 && type === 2) {
      latRef = String.fromCharCode(tiff.getUint8(e + 8));
    } else if (tag === 3 && type === 2) {
      lonRef = String.fromCharCode(tiff.getUint8(e + 8));
    } else if (tag === 2 && type === 5 && count === 3) {
      lat = dms(rationals(tiff, val, le, 3));
      gotLat = true;
    } else if (tag === 4 && type === 5 && count === 3) {
      lon = dms(rationals(tiff, val, le, 3));
      gotLon = true;
    }
  }
  if (!gotLat || !gotLon) return null;
  if (latRef === "S") lat = -lat;
  if (lonRef === "W") lon = -lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}
