export { StudyPackWorkflow } from "./studyPackWorkflow.js";

import { DurableObject } from "cloudflare:workers";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "Content-Type",
};

export class MyDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  async _get(key, fallback) {
    const value = await this.ctx.storage.get(key);
    return value ?? fallback;
  }

  async getState() {
    const notes = await this._get("notes", "");
    const messages = await this._get("messages", []);
    const studyPack = await this._get("studyPack", null);
    return { notes, messages, studyPack };
  }

  async setNotes(notes) {
    await this.ctx.storage.put("notes", notes);
    return { ok: true };
  }

  async addMessage(role, content) {
    const messages = await this._get("messages", []);
    messages.push({ role, content, ts: Date.now() });
    const trimmed = messages.slice(-20);
    await this.ctx.storage.put("messages", trimmed);
    return { ok: true, messages: trimmed };
  }

  async setStudyPack(studyPack) {
    await this.ctx.storage.put("studyPack", studyPack);
    return { ok: true };
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

function text(data, status = 200) {
  return new Response(data, { status, headers: { ...CORS_HEADERS } });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function pickText(resp) {
  return (
    resp?.response ||
    resp?.result?.response ||
    resp?.choices?.[0]?.message?.content ||
    ""
  );
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return text("", 204);

    const url = new URL(request.url);
    const path = url.pathname;

    // Read body once (prevents consumed-stream bugs)
    const body = await readJson(request);
    const userId = url.searchParams.get("userId") || body?.userId || "demo";

    const stub = env.MY_DURABLE_OBJECT.getByName(userId);

    if (path === "/" && request.method === "GET") {
      return json({ ok: true, service: "studybuddy-api", userId });
    }

    if (path === "/state" && request.method === "GET") {
      const state = await stub.getState();
      return json({ ok: true, userId, ...state });
    }

    if (path === "/notes" && request.method === "POST") {
      const notes = body?.notes;
      if (!notes || typeof notes !== "string") {
        return json({ ok: false, error: "notes required" }, 400);
      }
      await stub.setNotes(notes);
      return json({ ok: true });
    }

    if (path === "/chat" && request.method === "POST") {
      const message = body?.message?.trim();
      if (!message) return json({ ok: false, error: "message required" }, 400);

      await stub.addMessage("user", message);

      const state = await stub.getState();
      const notes = state.notes || "";
      const history = (state.messages || []).slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const system = {
        role: "system",
        content:
          "You are StudyBuddy. Be clear, practical, and concise. Use the student’s notes when helpful.",
      };

      const notesMsg = notes
        ? { role: "user", content: `Notes/context:\n${notes}` }
        : null;

      const messages = [system, ...(notesMsg ? [notesMsg] : []), ...history];

      let reply = "";
      let local = false;

      try {
        const resp = await env.AI.run(MODEL, { messages, max_tokens: 700 });
        reply = pickText(resp) || "Sorry — I couldn’t generate a response.";
      } catch {
        local = true;
        reply =
          "Local dev mode: Workers AI runs remotely. Deploy this Worker (or use remote dev) to get real AI replies.";
      }

      await stub.addMessage("assistant", reply);
      return json({ ok: true, userId, reply, local });
    }

    // Trigger workflow (async)
    if (path === "/study-pack" && request.method === "POST") {
      const instance = await env.STUDY_PACK.create({
        id: crypto.randomUUID(),
        params: { userId },
      });

      const status = await instance.status();
      return json({ ok: true, userId, instanceId: instance.id, status });
    }

    // Check workflow status/output
    if (path === "/study-pack/status" && request.method === "GET") {
      const instanceId = url.searchParams.get("instanceId");
      if (!instanceId) return json({ ok: false, error: "instanceId required" }, 400);

      const instance = await env.STUDY_PACK.get(instanceId);
      const status = await instance.status();
      return json({ ok: true, instanceId, status });
    }

    return json({ ok: false, error: "Not found" }, 404);
  },
};