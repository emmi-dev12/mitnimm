const BASE = "https://mitnimm.onrender.com";

export const agentCard = {
  name: "mitnimm",
  description: "Free sidewalk piles in Switzerland. Read-only. No auth.",
  base: BASE,
  auth: "none",
  start: `${BASE}/api/nearby?plz=8004`,
  endpoints: {
    nearby: "GET /api/nearby?plz=8004&km=3&category=velo",
    spots: "GET /api/spots?category=moebel",
    history: "GET /api/history",
    categories: "GET /api/categories",
  },
  write: "POST /api/spots is humans on site only (GPS + photo). Do not automate.",
};

export const openapi = {
  openapi: "3.1.0",
  info: { title: "mitnimm", version: "0.1.0", description: agentCard.description },
  servers: [{ url: BASE }],
  paths: {
    "/api": { get: { summary: "This card", responses: { "200": { description: "Discovery" } } } },
    "/api/nearby": {
      get: {
        summary: "Piles near a Swiss PLZ",
        parameters: [
          { name: "plz", in: "query", required: true, schema: { type: "string", example: "8004" } },
          { name: "km", in: "query", schema: { type: "number", default: 3 } },
          { name: "category", in: "query", schema: { type: "string", example: "velo" } },
        ],
      },
    },
    "/api/spots": { get: { summary: "All live piles" } },
    "/api/history": { get: { summary: "Gone piles, no photos" } },
    "/api/categories": { get: { summary: "Category ids and labels" } },
  },
};
