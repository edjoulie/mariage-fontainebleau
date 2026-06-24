import type { NextApiRequest, NextApiResponse } from "next";
import { redis, redisConfigured, sanitizeId, StoredComment } from "@/lib/redis";

const MAX_NAME = 40;
const MAX_TEXT = 500;
const MAX_COMMENTS = 500;

// GET  /api/comments?id=<publicId>        -> { comments: [{name,text,ts}] }
// POST /api/comments { id, name, text }    -> { comments: [...] }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!redisConfigured || !redis) {
    return res.status(200).json({ comments: [] });
  }

  try {
    if (req.method === "GET") {
      const id = sanitizeId(req.query.id);
      if (!id) return res.status(400).json({ error: "bad id" });
      const comments = (await redis.lrange<StoredComment>(`c:${id}`, 0, -1)) || [];
      return res.status(200).json({ comments });
    }

    if (req.method === "POST") {
      const { id: rawId, name, text } = req.body || {};
      const id = sanitizeId(rawId);
      if (!id) return res.status(400).json({ error: "bad id" });

      const cleanName = String(name ?? "").trim().slice(0, MAX_NAME) || "Invité";
      const cleanText = String(text ?? "").trim().slice(0, MAX_TEXT);
      if (!cleanText) return res.status(400).json({ error: "empty" });

      const comment: StoredComment = { name: cleanName, text: cleanText, ts: Date.now() };
      await redis.rpush(`c:${id}`, comment);
      await redis.ltrim(`c:${id}`, -MAX_COMMENTS, -1);
      const comments = (await redis.lrange<StoredComment>(`c:${id}`, 0, -1)) || [];
      return res.status(200).json({ comments });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  } catch {
    return res.status(500).json({ error: "server error" });
  }
}
