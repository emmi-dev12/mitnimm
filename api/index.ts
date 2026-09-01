import api from "../worker/src/index.ts";
import { bootEnv, ensureBotCommands } from "../worker/src/boot.ts";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: Request): Promise<Response> {
  const { env, flush } = await bootEnv();
  ensureBotCommands(env);
  try {
    return await api.fetch(req, env);
  } finally {
    await flush();
  }
}
