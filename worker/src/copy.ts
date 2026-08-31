export const LANGS = ["de", "en", "fr", "it"] as const;
export type Lang = (typeof LANGS)[number];
export const KMS = [1, 3, 5, 10, 15] as const;

export function isLang(v: string): v is Lang {
  return (LANGS as readonly string[]).includes(v);
}

export function detectLang(raw?: string | null): Lang {
  const s = (raw || "").toLowerCase();
  if (s.startsWith("fr")) return "fr";
  if (s.startsWith("it")) return "it";
  if (s.startsWith("en")) return "en";
  return "de";
}

export const TG = {
  de: {
    start: "PLZ schicken, z.B. 8004. /lang und /km zum Einstellen.",
    badPlz: "Vierstellige PLZ, sonst find ich nichts.",
    unknownPlz: "PLZ unbekannt.",
    none: (plz: string, km: number) => `Nichts in ${km}km um ${plz}.`,
    header: (plz: string, n: number, km: number) => `${plz} — ${n} Haufen, ${km}km:`,
    pickLang: "Sprache:",
    pickKm: "Umkreis:",
    langSet: "Sprache: Deutsch",
    kmSet: (km: number) => `Umkreis: ${km}km`,
    cmdStart: "Los — dann eine PLZ",
    cmdLang: "Sprache: DE EN FR IT",
    cmdKm: "Umkreis: 1 3 5 10 15 km",
  },
  en: {
    start: "Send a PLZ, e.g. 8004. /lang and /km to set prefs.",
    badPlz: "Four-digit PLZ, or I find nothing.",
    unknownPlz: "Unknown PLZ.",
    none: (plz: string, km: number) => `Nothing within ${km}km of ${plz}.`,
    header: (plz: string, n: number, km: number) => `${plz} — ${n} piles, ${km}km:`,
    pickLang: "Language:",
    pickKm: "Radius:",
    langSet: "Language: English",
    kmSet: (km: number) => `Radius: ${km}km`,
    cmdStart: "Start — then a PLZ",
    cmdLang: "Language: DE EN FR IT",
    cmdKm: "Radius: 1 3 5 10 15 km",
  },
  fr: {
    start: "Envoie un NPA, p.ex. 8004. /lang et /km pour régler.",
    badPlz: "NPA à 4 chiffres, sinon je ne trouve rien.",
    unknownPlz: "NPA inconnu.",
    none: (plz: string, km: number) => `Rien dans ${km}km autour de ${plz}.`,
    header: (plz: string, n: number, km: number) => `${plz} — ${n} tas, ${km}km :`,
    pickLang: "Langue :",
    pickKm: "Rayon :",
    langSet: "Langue : français",
    kmSet: (km: number) => `Rayon : ${km}km`,
    cmdStart: "Start — puis un NPA",
    cmdLang: "Langue : DE EN FR IT",
    cmdKm: "Rayon : 1 3 5 10 15 km",
  },
  it: {
    start: "Manda un NPA, es. 8004. /lang e /km per le preferenze.",
    badPlz: "NPA a 4 cifre, sennò non trovo niente.",
    unknownPlz: "NPA sconosciuto.",
    none: (plz: string, km: number) => `Niente entro ${km}km da ${plz}.`,
    header: (plz: string, n: number, km: number) => `${plz} — ${n} mucchi, ${km}km:`,
    pickLang: "Lingua:",
    pickKm: "Raggio:",
    langSet: "Lingua: italiano",
    kmSet: (km: number) => `Raggio: ${km}km`,
    cmdStart: "Start — poi un NPA",
    cmdLang: "Lingua: DE EN FR IT",
    cmdKm: "Raggio: 1 3 5 10 15 km",
  },
} as const;
