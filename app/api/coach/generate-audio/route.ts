import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const AUDIO_DIR = path.join(process.cwd(), "public", "audio");

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

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ElevenLabs TTS error: ${errText}`);
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  await writeFile(filepath, buffer);
}

export async function POST(req: Request) {
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { voice_id, scripts } = await req.json();
  if (!voice_id || !scripts?.length) {
    return NextResponse.json(
      { error: "voice_id and scripts[] are required" },
      { status: 400 }
    );
  }

  await mkdir(AUDIO_DIR, { recursive: true });

  const sessionId = randomUUID().slice(0, 8);
  const filenames: string[] = [];

  // Generate audio in batches of 4 (ElevenLabs allows 5 concurrent)
  for (let i = 0; i < scripts.length; i += 4) {
    const batch = scripts.slice(i, i + 4);
    await Promise.all(
      batch.map(async (script: string, j: number) => {
        const idx = i + j;
        const filename = `${sessionId}_${String(idx).padStart(2, "0")}.mp3`;
        filenames[idx] = filename;
        await ttsToFile(voice_id, script, path.join(AUDIO_DIR, filename));
      })
    );
  }

  return NextResponse.json({
    audio_files: filenames,
    session_id: sessionId,
  });
}
