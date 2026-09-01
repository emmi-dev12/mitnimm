import type { StyleSpecification } from "maplibre-gl";

const SWISSIMAGE =
  "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg";

const satSource = {
  type: "raster" as const,
  tiles: [SWISSIMAGE],
  tileSize: 256,
  maxzoom: 19,
  attribution: "© swisstopo",
};

export const STYLES = {
  map: "https://tiles.openfreemap.org/styles/liberty",
  satellite: {
    version: 8,
    sources: { swissimage: satSource },
    layers: [{ id: "swissimage", type: "raster", source: "swissimage" }],
  } satisfies StyleSpecification,
};

export type MapKind = "map" | "satellite" | "hybrid";

export async function styleFor(kind: MapKind): Promise<string | StyleSpecification> {
  if (kind === "map") return STYLES.map;
  if (kind === "satellite") return STYLES.satellite;

  const liberty = (await fetch("https://tiles.openfreemap.org/styles/liberty").then((r) =>
    r.json(),
  )) as StyleSpecification;
  return {
    ...liberty,
    sources: { ...liberty.sources, swissimage: satSource },
    layers: [
      { id: "swissimage", type: "raster", source: "swissimage" },
      ...(liberty.layers ?? []).map((l) => {
        if (l.type === "symbol") return l;
        return {
          ...l,
          layout: {
            ...((l as { layout?: Record<string, unknown> }).layout ?? {}),
            visibility: "none" as const,
          },
        };
      }),
    ],
  };
}
