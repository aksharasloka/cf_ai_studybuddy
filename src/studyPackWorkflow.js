import { WorkflowEntrypoint } from "cloudflare:workers";

/**
 * @typedef {{ userId: string }} Params
 */

function safeJsonParse(text, fallback) {
  if (!text || typeof text !== "string") return fallback;

  const attempts = [];

  // A) original
  attempts.push(text);

  // B) strip markdown fences
  attempts.push(text.replace(/```json\s*/gi, "").replace(/```/g, "").trim());

  for (const candidate of attempts) {
    // 1) direct parse
    try {
      return JSON.parse(candidate);
    } catch {}

    // 2) extract the first {...} block
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const slice = candidate.slice(start, end + 1);

      // 3) repair common model issues
      const repaired = slice
        .replace(/[\u201C\u201D]/g, '"') // smart quotes -> "
        .replace(/[\u2018\u2019]/g, "'") // smart apostrophes -> '
        .replace(/,\s*}/g, "}") // trailing commas
        .replace(/,\s*]/g, "]");

      try {
        return JSON.parse(repaired);
      } catch {}
    }
  }

  return fallback;
}

function pickText(resp) {
  return (
    resp?.response ||
    resp?.result?.response ||
    resp?.choices?.[0]?.message?.content ||
    ""
  );
}

export class StudyPackWorkflow extends WorkflowEntrypoint {
  /**
   * @param {import("cloudflare:workers").WorkflowEvent<Params>} event
   * @param {import("cloudflare:workers").WorkflowStep} step
   */
  async run(event, step) {
    const userId = event.payload?.userId || "demo";
    const stub = this.env.MY_DURABLE_OBJECT.getByName(userId);

    const notes = await step.do("load notes", async () => {
      const state = await stub.getState();
      return state?.notes || "";
    });

    if (!notes.trim()) {
      const empty = {
        generatedAt: Date.now(),
        summary: "",
        flashcards: [],
        quiz: [],
        error: "No notes found. Save notes first via POST /notes.",
      };

      await step.do("save empty pack", async () => {
        await stub.setStudyPack(empty);
        return true;
      });

      return empty;
    }

    const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

    const summary = await step.do("summary", async () => {
      const resp = await this.env.AI.run(model, {
        messages: [
          {
            role: "system",
            content:
              "Summarize the notes in 6–10 clean bullet points. No intro sentence.",
          },
          { role: "user", content: notes },
        ],
        max_tokens: 500,
      });
      return pickText(resp);
    });

    const flashcardsResult = await step.do("flashcards", async () => {
      const resp = await this.env.AI.run(model, {
        messages: [
          {
            role: "system",
            content:
              'Return ONLY valid JSON. No markdown. No explanation. Use double quotes.',
          },
          { role: "user", content: notes },
        ],
        max_tokens: 900,
      });

      const raw = pickText(resp);
      const parsed = safeJsonParse(raw, null);

      if (!parsed) return { __raw: raw, flashcards: [] };

      const cards = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];
      return { flashcards: cards, __raw: null };
    });

    const quizResult = await step.do("quiz", async () => {
      const resp = await this.env.AI.run(model, {
        messages: [
          {
            role: "system",
            content:
              'Return ONLY valid JSON. No markdown. No explanation. Use double quotes.',
          },
          { role: "user", content: notes },
        ],
        max_tokens: 1200,
      });

      const raw = pickText(resp);
      const parsed = safeJsonParse(raw, null);

      if (!parsed) return { __raw: raw, quiz: [] };

      const q = Array.isArray(parsed.quiz) ? parsed.quiz : [];
      return { quiz: q, __raw: null };
    });

    const flashcardsOut =
    Array.isArray(flashcardsResult?.flashcards) ? flashcardsResult.flashcards
    : Array.isArray(flashcardsResult?.__raw?.flashcards) ? flashcardsResult.__raw.flashcards
    : [];
  
  const quizOut =
    Array.isArray(quizResult?.quiz) ? quizResult.quiz
    : Array.isArray(quizResult?.__raw?.quiz) ? quizResult.__raw.quiz
    : [];
  
    const pack = {
        generatedAt: Date.now(),
        summary,
        flashcards: flashcardsResult.flashcards || [],
        quiz: quizResult.quiz || [],
      };

    await step.do("save pack", async () => {
      await stub.setStudyPack(pack);
      return true;
    });

    return pack;
  }
}