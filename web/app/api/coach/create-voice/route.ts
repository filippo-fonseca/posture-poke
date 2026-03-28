import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

export async function POST(req: Request) {
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

  // Step 1 — generate voice preview from text description
  const previewResp = await fetch(
    `${ELEVEN_BASE}/text-to-voice/create-previews`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voice_description: description,
        text: "Hey, sit up straight! Your spine is not a banana!",
      }),
    }
  );

  if (!previewResp.ok) {
    const errText = await previewResp.text();
    return NextResponse.json(
      { error: `ElevenLabs voice preview error: ${errText}` },
      { status: 502 }
    );
  }

  const previewData = await previewResp.json();
  const generatedVoiceId =
    previewData.previews[0].generated_voice_id;

  // Step 2 — save preview as a permanent voice
  const saveResp = await fetch(
    `${ELEVEN_BASE}/text-to-voice/create-voice-from-preview`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voice_name: `SpineSync-${randomUUID().slice(0, 6)}`,
        voice_description: description,
        generated_voice_id: generatedVoiceId,
      }),
    }
  );

  if (!saveResp.ok) {
    const errText = await saveResp.text();
    return NextResponse.json(
      { error: `ElevenLabs save voice error: ${errText}` },
      { status: 502 }
    );
  }

  const voiceData = await saveResp.json();
  return NextResponse.json({ voice_id: voiceData.voice_id });
}
