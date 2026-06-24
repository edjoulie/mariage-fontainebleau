import { Redis } from "@upstash/redis";

// Le stockage n'est actif que si les variables d'environnement Upstash sont definies.
// Sans elles, les routes API repondent "vide" sans planter (degradation gracieuse).
export const redisConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

export const redis = redisConfigured ? Redis.fromEnv() : null;

// Jeu de reactions autorisees (cote serveur, pour eviter d'ecrire n'importe quoi).
export const ALLOWED_EMOJIS = ["❤️", "🎉", "😍", "👏", "😂"];

// Nettoie / valide un public_id Cloudinary recu du client.
export function sanitizeId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!id || id.length > 200) return null;
  return id;
}

export interface StoredComment {
  name: string;
  text: string;
  ts: number;
}
