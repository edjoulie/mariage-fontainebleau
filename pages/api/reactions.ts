import type { NextApiRequest, NextApiResponse } from "next";
import { redis, redisConfigured, ALLOWED_EMOJIS, sanitizeId } from "@/lib/redis";

// GET  /api/reactions?id=<publicId>   -> { reactions: { emoji: count } }
// POST /api/reactions { id, emoji, delta:1|-1 } -> { reactions: { emoji: count } }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!redisConfigured || !redis) {
    return res.status(200).json({ reactions: {} });
  }

  try {
    if (req.method === "GET") {
      const id = sanitizeId(req.query.id);
      if (!id) return res.status(400).json({ error: "bad id" });
      const reactions = (await redis.hgetall<Record<string, number>>(`r:${id}`)) || {};
      return res.status(200).json({ reactions });
    }

    if (req.method === "POST") {
      const { id: rawId, emoji, delta } = req.body || {};
      const id = sanitizeId(rawId);
      if (!id) return res.status(400).json({ error: "bad id" });
      if (typeof emoji !== "string" || !ALLOWED_EMOJIS.includes(emoji)) {
        return res.status(400).json({ error: "bad emoji" });
      }
      const d = delta === -1 ? -1 : 1;
      const next = await redis.hincrby(`r:${id}`, emoji, d);
      // Un compteur ne descend jamais sous zero.
      if (next < 0) await redis.hset(`r:${id}`, { [emoji]: 0 });
      const reactions = (await redis.hgetall<Record<string, number>>(`r:${id}`)) || {};
      return res.status(200).json({ reactions });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  } catch {
    return res.status(500).json({ error: "server error" });
  }
}
