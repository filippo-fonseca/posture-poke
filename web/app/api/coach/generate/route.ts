import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const AUDIO_DIR = path.join(process.cwd(), "public", "audio");

// ── Gemini: generate scripts ────────────────────────────────────────────────

async function generateScripts(description: string): Promise<string[]> {
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

  if (!resp.ok) throw new Error(`Gemini error: ${await resp.text()}`);

  const data = await resp.json();
  let text: string = data.candidates[0].content.parts[0].text.trim();

  if (text.startsWith("```")) {
    text = text.split("\n").slice(1).join("\n");
    text = text.replace(/```\s*$/, "").trim();
  }

  const scripts: string[] = JSON.parse(text);
  return scripts.slice(0, 10);
}

// ── ElevenLabs: create voice from description ───────────────────────────────

async function createVoice(
  description: string,
  sampleText: string
): Promise<string> {
  const previewResp = await fetch(
    `${ELEVEN_BASE}/text-to-voice/create-previews`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voice_description: description,
        text: sampleText,
      }),
    }
  );

  if (!previewResp.ok)
    throw new Error(`ElevenLabs preview error: ${await previewResp.text()}`);

  const previewData = await previewResp.json();
  const generatedVoiceId = previewData.previews[0].generated_voice_id;

  const saveResp = await fetch(
    `${ELEVEN_BASE}/text-to-voice/create-voice-from-preview`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voice_name: `SpineSync-${randomUUID().slice(0, 6)}`,
        voice_description: description,
        generated_voice_id: generatedVoiceId,
      }),
    }
  );

  if (!saveResp.ok)
    throw new Error(`ElevenLabs save error: ${await saveResp.text()}`);

  return (await saveResp.json()).voice_id;
}

// ── ElevenLabs: text-to-speech ──────────────────────────────────────────────

async function ttsToFile(
  voiceId: string,
  text: string,
  filepath: string
) {
  const resp = await fetch(
    `${ELEVEN_BASE}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    }
  );

  if (!resp.ok) throw new Error(`ElevenLabs TTS error: ${await resp.text()}`);

  const buffer = Buffer.from(await resp.arrayBuffer());
  await writeFile(filepath, buffer);
}

// ── Full pipeline endpoint ──────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
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

  try {
    // 1. Generate scripts
    const scripts = await generateScripts(description);

    // 2. Create voice (use first script as sample text)
    const voiceId = await createVoice(description, scripts[0]);

    // 3. Generate all audio files concurrently
    await mkdir(AUDIO_DIR, { recursive: true });
    const sessionId = randomUUID().slice(0, 8);
    const filenames: string[] = [];

    await Promise.all(
      scripts.map(async (script, i) => {
        const filename = `${sessionId}_${String(i).padStart(2, "0")}.mp3`;
        filenames[i] = filename;
        await ttsToFile(voiceId, script, path.join(AUDIO_DIR, filename));
      })
    );

    return NextResponse.json({
      scripts,
      voice_id: voiceId,
      audio_files: filenames,
      session_id: sessionId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
