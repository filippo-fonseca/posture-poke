import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { description } = await req.json();
  if (!description) {
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 }
    );
  }

  const prompt = `You are a comedy writer for a posture-correction app called SpineSync.
The user wants their posture coach to sound like: ${description}

Generate exactly 10 short, funny one-liner scripts (1-2 sentences each) that this coach would say when the user's posture is bad.

Rules:
- Stay hilariously in-character
- Keep each line under ~15 words so it can be spoken in <5 seconds
- Vary the joke structure — no two should feel the same
- Every line must relate to posture, slouching, or sitting up straight

Return ONLY a JSON array of 10 strings. Example: ["line 1", "line 2", ...]`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    return NextResponse.json(
      { error: `Gemini API error: ${errText}` },
      { status: 502 }
    );
  }

  const data = await resp.json();
  let text: string =
    data.candidates[0].content.parts[0].text.trim();

  // Strip markdown code fences if Gemini wraps them
  if (text.startsWith("```")) {
    text = text.split("\n").slice(1).join("\n");
    text = text.replace(/```\s*$/, "").trim();
  }

  const scripts: string[] = JSON.parse(text);
  return NextResponse.json({ scripts: scripts.slice(0, 10) });
}
