import type { NextApiRequest, NextApiResponse } from "next";
import { redis, redisConfigured } from "@/lib/redis";

// POST /api/photo-meta { ids: string[] }
//   -> { meta: { [id]: { reactions: {emoji:count}, comments: number } } }
// Resume leger utilise pour afficher un badge sur les vignettes de la grille.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const rawIds: unknown = req.body?.ids;
  if (!Array.isArray(rawIds)) return res.status(400).json({ error: "bad ids" });
  const ids = rawIds
    .filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 200)
    .slice(0, 60);

  if (!redisConfigured || !redis || ids.length === 0) {
    return res.status(200).json({ meta: {} });
  }

  try {
    const pipe = redis.pipeline();
    ids.forEach((id) => {
      pipe.hgetall(`r:${id}`);
      pipe.llen(`c:${id}`);
    });
    const results = (await pipe.exec()) as unknown[];

    const meta: Record<string, { reactions: Record<string, number>; comments: number }> = {};
    ids.forEach((id, i) => {
      const reactions = (results[i * 2] as Record<string, number>) || {};
      const comments = Number(results[i * 2 + 1]) || 0;
      meta[id] = { reactions, comments };
    });
    return res.status(200).json({ meta });
  } catch {
    return res.status(200).json({ meta: {} });
  }
}
