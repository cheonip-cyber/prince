import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  imageDataUrl?: string;
  productName?: string;
  theme?: string;
  model?: "gpt-image-2.5-flare" | "gpt-image-2.5-sunburst";
};

const imageModels = new Set(["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"]);

export async function POST(request: Request) {
  try {
    const body = await request.json() as RequestBody;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI 이미지 서비스가 아직 설정되지 않았습니다." }, { status: 503 });

    const model = body.model && imageModels.has(body.model) ? body.model : "gpt-image-2.5-flare";
    const match = body.imageDataUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    const prompt = [
      `${body.productName || "농산물"} 상세페이지에 사용할 사실적인 이커머스 연출 사진을 만든다.`,
      `분위기는 ${body.theme || "따뜻하고 자연스러운 산지 감성"}.`,
      match
        ? "입력 사진의 실제 제품 형태, 색상, 표면 특징을 그대로 유지하고 제품 자체를 다른 품종이나 상품으로 다시 그리지 않는다."
        : "제품 사진이 없으므로 상품명에서 확인되는 일반적인 외형만 사용하고, 특정 산지·품종·인증·수치가 사실인 것처럼 표현하지 않는다.",
      match
        ? "배경과 빛, 자연스러운 테이블 소품만 보완한다. 사람, 농장, 인증마크, 포장 브랜드, 글자, 로고는 새로 만들지 않는다."
        : "자연스러운 배경과 빛, 테이블 소품으로 상품 중심의 장면을 구성한다. 사람, 인증마크, 포장 브랜드, 글자, 로고는 만들지 않는다.",
      "상세페이지에서 문구를 올릴 수 있도록 한쪽에 여백을 두고, 과장되지 않은 고급 상업 사진으로 완성한다.",
    ].join(" ");

    let response: Response;
    if (match) {
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.length > 10 * 1024 * 1024) return NextResponse.json({ error: "AI 연출용 사진은 10MB 이하로 줄여 주세요." }, { status: 413 });
      const form = new FormData();
      form.append("model", model);
      form.append("image", new Blob([bytes], { type: match[1] }), "product.jpg");
      form.append("prompt", prompt);
      form.append("size", "1024x1024");
      form.append("quality", "medium");
      response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } else {
      response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, size: "1024x1024", quality: "medium" }),
      });
    }
    const result = await response.json() as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
    if (!response.ok) return NextResponse.json({ error: result.error?.message || "OpenAI 이미지 생성 요청에 실패했습니다." }, { status: response.status });
    const encoded = result.data?.[0]?.b64_json;
    if (!encoded) return NextResponse.json({ error: "생성된 이미지 데이터를 받지 못했습니다." }, { status: 502 });
    return NextResponse.json({ image: `data:image/png;base64,${encoded}` });
  } catch {
    return NextResponse.json({ error: "이미지 생성 요청을 처리하지 못했습니다." }, { status: 500 });
  }
}
