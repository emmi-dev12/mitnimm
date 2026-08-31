import { TG, type Lang } from "./copy";

type TgEnv = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  APP_URL?: string;
};

export async function tg(env: TgEnv, method: string, body: unknown) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function appUrl(env: TgEnv) {
  return (env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
}

export async function notifyNew(
  env: TgEnv,
  spot: { quote: string; category: string; items: string; lat: number; lon: number },
) {
  const chat = env.TELEGRAM_CHAT_ID;
  if (!chat) return;
  const link = `${appUrl(env)}/?lat=${spot.lat}&lon=${spot.lon}`;
  await tg(env, "sendMessage", {
    chat_id: chat,
    disable_web_page_preview: true,
    text: `mitnimm — ${spot.quote}\n${spot.category}: ${spot.items}\n${link}`,
  });
}

const LANGS: Lang[] = ["de", "en", "fr", "it"];

export async function registerBotCommands(env: TgEnv) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const cmds = (lang: Lang) => [
    { command: "start", description: TG[lang].cmdStart },
    { command: "lang", description: TG[lang].cmdLang },
    { command: "km", description: TG[lang].cmdKm },
  ];
  await tg(env, "setMyCommands", { commands: cmds("en") });
  for (const lang of LANGS) {
    await tg(env, "setMyCommands", {
      commands: cmds(lang),
      language_code: lang,
    });
  }
}
