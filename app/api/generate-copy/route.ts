import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type CopyRequestBody = {
  mode?: "title" | "reviews";
  instruction?: string;
  part?: { label?: string; title?: string; body?: string };
  product?: { name?: string; origin?: string; weight?: string };
};

const riskyTerms = ["최고", "유일", "1위", "항암", "면역력", "무농약", "유기농", "15브릭스"];

export async function POST(request: Request) {
  try {
    const body = await request.json() as CopyRequestBody;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI 텍스트 생성이 아직 설정되지 않았습니다." }, { status: 503 });

    const mode = body.mode === "reviews" ? "reviews" : "title";
    const product = {
      name: body.product?.name?.trim() || "농산물",
      origin: body.product?.origin?.trim() || "",
      weight: body.product?.weight?.trim() || "",
    };

    const guardrails = `다음 표현은 근거 없이 사용할 수 없다: ${riskyTerms.join(", ")}. 확인되지 않은 원산지, 인증, 수치, 효능은 만들어내지 않는다. 이미 주어진 상품명·원산지·판매단위 정보와 모순되는 내용을 작성하지 않는다.`;

    let userPrompt: string;
    let schemaHint: string;

    if (mode === "title") {
      const part = {
        label: body.part?.label || "",
        title: body.part?.title || "",
        body: body.part?.body || "",
      };
      userPrompt = [
        `상품명: ${product.name}`,
        product.origin ? `원산지: ${product.origin}` : "",
        product.weight ? `판매 단위: ${product.weight}` : "",
        `대상 파츠: ${part.label}`,
        `현재 제목: ${part.title}`,
        `현재 본문: ${part.body}`,
        body.instruction ? `요청 톤: ${body.instruction}` : "기존 톤을 유지하되 새로운 표현으로",
        "위 파츠의 제목과 본문을 상세페이지에 어울리는 한국어 카피로 다시 작성해줘.",
        "제목은 22자 이내, 본문은 120자 이내로 작성한다.",
      ].filter(Boolean).join("\n");
      schemaHint = `반드시 다음 JSON 형식으로만 응답한다: {"title": "...", "body": "..."}`;
    } else {
      userPrompt = [
        `상품명: ${product.name}`,
        product.origin ? `원산지: ${product.origin}` : "",
        product.weight ? `판매 단위: ${product.weight}` : "",
        "실제 구매 후기처럼 자연스러운 한국어 후기 3개를 새로 작성해줘.",
        "각 후기는 제목(20자 이내), 본문(60자 이내), 작성자 태그(10자 이내)로 구성한다.",
        "향·식감, 포장, 구성·정보 중 서로 다른 포인트를 하나씩 다룬다.",
      ].filter(Boolean).join("\n");
      schemaHint = `반드시 다음 JSON 형식으로만 응답한다: {"reviews": [{"title": "...", "body": "...", "author": "..."}, {"title": "...", "body": "...", "author": "..."}, {"title": "...", "body": "...", "author": "..."}]}`;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 1,
        messages: [
          { role: "system", content: `너는 신선식품 이커머스 상세페이지 카피라이터다. ${guardrails} ${schemaHint}` },
          { role: "user", content: `${userPrompt}\n\n(요청 ID: ${crypto.randomUUID()} — 이전 응답과 다른 새로운 표현으로 작성)` },
        ],
      }),
      cache: "no-store",
    });

    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) return NextResponse.json({ error: result.error?.message || "OpenAI 요청에 실패했습니다." }, { status: response.status });

    const content = result.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "AI 응답을 받지 못했습니다." }, { status: 502 });

    let parsed: { title?: string; body?: string; reviews?: Array<{ title?: string; body?: string; author?: string }> };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "AI 응답을 해석하지 못했습니다." }, { status: 502 });
    }

    if (mode === "title") {
      if (!parsed.title) return NextResponse.json({ error: "AI가 제목을 생성하지 못했습니다." }, { status: 502 });
      return NextResponse.json({ title: parsed.title, body: parsed.body || "" });
    }

    if (!parsed.reviews || parsed.reviews.length < 3) return NextResponse.json({ error: "AI가 후기를 생성하지 못했습니다." }, { status: 502 });
    const reviews = parsed.reviews.slice(0, 3).map((review) => ({
      title: review.title || "",
      body: review.body || "",
      author: review.author || "",
    }));
    return NextResponse.json({ reviews });
  } catch {
    return NextResponse.json({ error: "AI 문구 생성 요청을 처리하지 못했습니다." }, { status: 500 });
  }
}
