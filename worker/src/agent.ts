const BASE = "https://mitnimm.onrender.com";

export const agentCard = {
  name: "mitnimm",
  description:
    "Switzerland-only map of free sidewalk piles (gratis zum Mitnehmen). Read-only for agents. No auth.",
  website: BASE,
  openapi: `${BASE}/api/openapi.json`,
  auth: "none",
  license: "MIT",
  geo: "CH",
  endpoints: {
    spots: "GET /api/spots?category=&q=",
    nearby: "GET /api/nearby?plz=8004&km=3&category=&q=",
    history: "GET /api/history?category=&q=",
    categories: "GET /api/categories",
  },
  notes: [
    "category matches id, DE/EN/FR/IT labels, or substring on items.",
    "q is free-text over quote, items, street, category.",
    "POST /api/spots is for on-site humans (GPS + photo), not unattended bots.",
    "Piles expire ~72h. gone piles stay in /api/history without photos.",
  ],
};

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "mitnimm",
    version: "0.1.0",
    description: agentCard.description,
  },
  servers: [{ url: BASE }],
  paths: {
    "/api/spots": {
      get: {
        summary: "Live piles",
        parameters: [
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Array of live spots" } },
      },
    },
    "/api/nearby": {
      get: {
        summary: "Piles near a Swiss PLZ",
        parameters: [
          { name: "plz", in: "query", required: true, schema: { type: "string", pattern: "^\\d{4}$" } },
          { name: "km", in: "query", schema: { type: "number", default: 3 } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "plz, lat, lon, km, spots[]" } },
      },
    },
    "/api/history": {
      get: {
        summary: "Gone piles (street + category + date, no photos)",
        parameters: [
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Array of gone spots" } },
      },
    },
    "/api/categories": {
      get: {
        summary: "Category list",
        responses: { "200": { description: "id + labels" } },
      },
    },
  },
};
