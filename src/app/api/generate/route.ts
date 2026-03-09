import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { deductCredit } from "@/lib/credits";
import { saveGeneration } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const PLATFORMS = ["Instagram", "LinkedIn", "TikTok", "Twitter/X", "Facebook"];

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { image, mediaType } = await req.json();

    if (!image || !mediaType) {
      return NextResponse.json(
        { error: "Image and media type are required" },
        { status: 400 }
      );
    }

    // Deduct credit before generation (fails if 0 credits)
    let remainingCredits: number;
    try {
      remainingCredits = await deductCredit(userId);
    } catch {
      return NextResponse.json(
        { error: "No credits remaining. Please purchase more." },
        { status: 402 }
      );
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: image,
              },
            },
            {
              type: "text",
              text: `You are a social media expert. Analyze this screenshot and generate one optimized caption for each of these platforms: ${PLATFORMS.join(", ")}.

Each caption must:
- Match the platform's tone, style, and character norms
- Include relevant hashtags where appropriate (Instagram, TikTok)
- Be engaging, authentic, and ready to copy-paste
- Capture the key message/vibe of the screenshot

Respond ONLY with valid JSON in this exact format, no markdown:
{
  "captions": [
    { "platform": "Instagram", "caption": "...", "charCount": 0 },
    { "platform": "LinkedIn", "caption": "...", "charCount": 0 },
    { "platform": "TikTok", "caption": "...", "charCount": 0 },
    { "platform": "Twitter/X", "caption": "...", "charCount": 0 },
    { "platform": "Facebook", "caption": "...", "charCount": 0 }
  ],
  "summary": "One sentence describing what the image shows"
}`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const parsed = JSON.parse(text);

    parsed.captions = parsed.captions.map(
      (c: { platform: string; caption: string }) => ({
        ...c,
        charCount: c.caption.length,
      })
    );

    await saveGeneration(userId, parsed.summary, parsed.captions);

    return NextResponse.json({ ...parsed, credits: remainingCredits });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate captions. Please try again." },
      { status: 500 }
    );
  }
}
