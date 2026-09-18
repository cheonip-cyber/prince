"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Cloud,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  FileJson2,
  Image as ImageIcon,
  LayoutGrid,
  Leaf,
  LoaderCircle,
  LogIn,
  LogOut,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Star,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toPng } from "html-to-image";
import { ChangeEvent, CSSProperties, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getCurrentUser, saveWorkspace, sendMagicLink } from "@/lib/supabase/workspace";

type ThemeKey = "seasonal" | "premium" | "natural";
type LayoutKey = "default" | "card" | "wide" | "split" | "collage" | "circle" | "info";
type EditTab = "content" | "design" | "image";
type ImageModel = "gpt-image-2.5-flare" | "gpt-image-2.5-sunburst";
type FontKey = "clean" | "serif" | "friendly";
type ImageRole = "gift" | "origin" | "package" | "closeup";
type Part = {
  id: string;
  code: string;
  label: string;
  title: string;
  body: string;
  visible: boolean;
  required?: boolean;
  layout?: LayoutKey;
  imageAssetId?: string;
  imageFocus?: number;
  imageZoom?: number;
  fontFamily?: FontKey;
  fontScale?: number;
  copy?: Record<string, string>;
};

type MediaAsset = {
  id: string;
  src: string;
  name: string;
  role: string;
  source: "uploaded" | "ai";
};

type Snapshot = {
  id: string;
  label: string;
  savedAt: string;
  parts: Part[];
  productName: string;
  origin: string;
  weight: string;
  theme: ThemeKey;
};

const initialParts: Part[] = [
  { id: "hero", code: "P01", label: "메인 비주얼", title: "지금 가장 향긋한 순간을 담았습니다", body: "햇살 좋은 경북 영천에서 자란 백도 복숭아를 산지의 신선함 그대로 보내드립니다.", visible: true, required: true },
  { id: "summary", code: "P02", label: "핵심 요약", title: "한눈에 보는 영천 백도", body: "은은한 향 · 부드러운 과육 · 정성스러운 선별", visible: true, required: true },
  { id: "audience", code: "P03", label: "추천 대상", title: "이런 분께 추천드려요", body: "제철 과일을 기다려 온 가족, 부담 없이 마음을 전하고 싶은 분께 잘 어울립니다.", visible: true },
  { id: "taste", code: "P04", label: "맛·식감", title: "입안 가득 부드럽고 향긋하게", body: "잘 후숙된 백도 특유의 부드러운 식감과 풍부한 과즙을 즐겨보세요.", visible: true, required: true },
  { id: "size", code: "P06", label: "크기·외형", title: "자연이 키운 모습 그대로", body: "생과일 특성상 크기와 색상에는 자연스러운 차이가 있을 수 있습니다.", visible: true, required: true },
  { id: "options", code: "P07", label: "구성·옵션", title: "필요한 만큼 골라 담았습니다", body: "2kg 한 상자, 8~10과 내외로 구성됩니다.", visible: true, required: true },
  { id: "storage", code: "P10", label: "보관법", title: "맛있는 때를 기다려 주세요", body: "수령 후 서늘한 곳에서 후숙하고, 말랑해지면 냉장 보관해 주세요.", visible: true, required: true },
  { id: "shipping", code: "P11", label: "포장·배송", title: "흔들림은 줄이고, 정성은 더하고", body: "과일 전용 완충재로 안전하게 포장해 순차 출고합니다.", visible: true, required: true },
  { id: "reviews", code: "P13", label: "별점·후기", title: "먼저 경험한 만족 포인트", body: "향과 식감, 포장과 구성에서 만족하기 좋은 포인트를 모았습니다.", visible: true },
  { id: "notice", code: "P12", label: "주의·FAQ", title: "구매 전 꼭 확인해 주세요", body: "신선식품 특성상 단순 변심 교환은 어렵습니다. 파손 시 수령 당일 사진과 함께 문의해 주세요.", visible: true, required: true },
];

const themeMap = {
  seasonal: { label: "산뜻한 제철형", swatches: ["#fffaf1", "#eb8a63", "#3f684d"] },
  premium: { label: "프리미엄 강조형", swatches: ["#f5f0e8", "#263d35", "#bd9a59"] },
  natural: { label: "따뜻한 산지형", swatches: ["#f5eee2", "#a45f3b", "#6f7f4a"] },
} satisfies Record<ThemeKey, { label: string; swatches: string[] }>;

const fontMap = {
  clean: { label: "깔끔한 고딕", sample: "상품 정보를 또렷하게", family: '"Noto Sans KR", sans-serif' },
  serif: { label: "감성적인 명조", sample: "이야기와 품격을 담아", family: '"Noto Serif KR", serif' },
  friendly: { label: "친근한 손글씨", sample: "따뜻하고 편안하게", family: '"Gowun Dodum", "Noto Sans KR", sans-serif' },
} satisfies Record<FontKey, { label: string; sample: string; family: string }>;

const layoutPresets: Array<{ key: LayoutKey; label: string }> = [
  { key: "wide", label: "전폭" },
  { key: "split", label: "2분할" },
  { key: "collage", label: "콜라주" },
  { key: "circle", label: "원형 크롭" },
  { key: "info", label: "사진+정보표" },
];

const imageRoleMap = {
  gift: { label: "선물 분위기", description: "리본·보자기·차분한 선물 테이블" },
  origin: { label: "산지 배경", description: "밭·과수원·자연광 중심의 산지 장면" },
  package: { label: "포장 연출", description: "박스 구성과 안전한 포장을 강조" },
  closeup: { label: "제품 클로즈업", description: "색·결·신선함이 잘 보이는 근접 장면" },
} satisfies Record<ImageRole, { label: string; description: string }>;

const riskyTerms = ["최고", "유일", "1위", "항암", "면역력", "무농약", "유기농", "15브릭스"];
const optionalParts: Part[] = [
  { id: "origin", code: "P05", label: "산지·선별", title: "좋은 땅에서 정성껏 골랐습니다", body: "산지에서 상태를 살펴 선별하고 신선함을 지켜 포장합니다.", visible: true },
  { id: "evidence", code: "P08", label: "품질 근거", title: "확인 가능한 정보만 담았습니다", body: "등록된 인증서나 측정 근거가 있을 때만 품질 정보로 표시합니다.", visible: true },
  { id: "usage", code: "P09", label: "섭취·활용", title: "더 맛있게 즐기는 방법", body: "깨끗이 씻어 그대로 즐기거나 차갑게 보관해 시원하게 드셔보세요.", visible: true },
];
const allPartTemplates = [...initialParts, ...optionalParts].sort((a, b) => a.code.localeCompare(b.code));

const partCopyDefaults: Record<string, Record<string, string>> = {
  hero: {
    kicker: "FRESH FROM THE FARM",
    metaOrigin: "산지직송",
    metaCategory: "신선식품",
  },
  summary: {
    kicker: "THIS SEASON'S PICK",
    card1Number: "01", card1Title: "은은한 향", card1Body: "백도 고유의\n기분 좋은 향",
    card2Number: "02", card2Title: "부드러운 과육", card2Body: "후숙할수록\n말랑한 식감",
    card3Number: "03", card3Title: "영천 산지", card3Body: "선별 후 정성껏\n포장·출고",
  },
  audience: {
    kicker: "FOR YOUR TABLE",
    bullet1: "제철 과일을 기다린 우리 가족",
    bullet2: "간편하게 제철 과일을 즐기려는 분",
    bullet3: "부드러운 과일을 좋아하는 분",
  },
  options: {
    factWeightLabel: "판매 단위",
    factOriginLabel: "원산지",
    factNameLabel: "상품명",
    composition1Name: "백도",
    composition1Value: "8~10과 내외",
    composition2Name: "총중량",
    composition2Value: "2kg",
    composition3Name: "포장",
    composition3Value: "과일 전용 완충재",
    compositionNote: "선택한 옵션과 생과 크기에 따라 실제 수량은 달라질 수 있습니다.",
  },
  reviews: {
    kicker: "REVIEW HIGHLIGHTS",
    review1Title: "향이 은은하고 과육이 부드러워요",
    review1Body: "후숙 후 먹으니 과즙과 향이 더 풍부하게 느껴졌어요.",
    review1Author: "향·식감 만족 후기",
    review2Title: "포장이 꼼꼼해 안심됐어요",
    review2Body: "과일이 흔들리지 않도록 정돈되어 받아보기 좋았습니다.",
    review2Author: "포장 만족 후기",
    review3Title: "구성과 안내가 이해하기 쉬워요",
    review3Body: "중량과 보관 방법이 잘 정리되어 선택하기 편했습니다.",
    review3Author: "구성 만족 후기",
  },
  notice: {
    noticeTitle: "원산지·판매단위 확인 완료",
    noticeBody: "입력한 상품 정보를 상세페이지에 반영했습니다.",
  },
};

function copyOf(part: Part, key: string, fallback = "") {
  return part.copy?.[key] ?? partCopyDefaults[part.id]?.[key] ?? fallback;
}

const photoRoles = ["대표 후보", "제품 디테일", "크기·외형", "구성·수량", "보조 이미지", "포장 상태"];
const photoPartOrder = ["hero", "audience", "taste", "size", "options", "shipping", "storage", "summary"];

function prepareImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다"));
    reader.onload = () => {
      if (typeof reader.result !== "string") return reject(new Error("이미지를 읽지 못했습니다"));
      const image = new Image();
      image.onerror = () => reject(new Error("지원하지 않는 이미지입니다"));
      image.onload = () => {
        const maxEdge = 1600;
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function downloadText(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Studio() {
  const [parts, setParts] = useState(initialParts);
  const [selectedId, setSelectedId] = useState("hero");
  const [theme, setTheme] = useState<ThemeKey>("seasonal");
  const [productName, setProductName] = useState("햇살담은 영천 백도");
  const [origin, setOrigin] = useState("경상북도 영천시");
  const [weight, setWeight] = useState("2kg · 8~10과");
  const [heroImage, setHeroImage] = useState("/peach-hero.svg");
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageModel, setImageModel] = useState<ImageModel>("gpt-image-2.5-flare");
  const [imageRole, setImageRole] = useState<ImageRole>("closeup");
  const [activeView, setActiveView] = useState<"editor" | "facts">("editor");
  const [showExport, setShowExport] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showPartLibrary, setShowPartLibrary] = useState(false);
  const [showCloudSettings, setShowCloudSettings] = useState(false);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [saved, setSaved] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<EditTab>("content");
  const [draggedPartId, setDraggedPartId] = useState<string | null>(null);
  const [dragOverPartId, setDragOverPartId] = useState<string | null>(null);
  const [imageDragging, setImageDragging] = useState(false);
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [draft, setDraft] = useState({ name: "", origin: "", weight: "", category: "과일" });
  const previewRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const selected = parts.find((part) => part.id === selectedId) ?? parts[0];
  const selectedAsset = mediaAssets.find((asset) => asset.id === selected.imageAssetId);
  const visibleParts = parts.filter((part) => part.visible);
  const warnings = useMemo(() => {
    const text = parts.map((part) => `${part.title} ${part.body}`).join(" ");
    return riskyTerms.filter((term) => text.includes(term));
  }, [parts]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("fruity-studio-v1");
      if (raw) {
        const stored = JSON.parse(raw) as Partial<Snapshot> & { snapshots?: Snapshot[] };
        if (stored.parts?.length) {
          const migrated: Part[] = stored.parts.map((part): Part => ({
            ...part,
            layout: part.layout === "default" ? "wide" : part.layout === "card" ? "info" : part.layout,
          }));
          if (!migrated.some((part) => part.id === "reviews")) {
            const reviewPart = initialParts.find((part) => part.id === "reviews");
            const noticeIndex = migrated.findIndex((part) => part.id === "notice");
            if (reviewPart) migrated.splice(noticeIndex < 0 ? migrated.length : noticeIndex, 0, { ...reviewPart });
          }
          setParts(migrated);
        }
        if (stored.productName) setProductName(stored.productName);
        if (stored.origin) setOrigin(stored.origin);
        if (stored.weight) setWeight(stored.weight);
        if (stored.theme) setTheme(stored.theme);
        if (stored.snapshots) setSnapshots(stored.snapshots);
      }
    } catch { /* damaged local data falls back to the safe sample */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    getCurrentUser(supabase).then(setCloudUser);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setCloudUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem("fruity-studio-v1", JSON.stringify({ parts, productName, origin, weight, theme, snapshots }));
      setSaved(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [hydrated, parts, productName, origin, weight, theme, snapshots]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2300);
  };

  const updateSelected = (field: "title" | "body", value: string) => {
    setParts((current) => current.map((part) => part.id === selected.id ? { ...part, [field]: value } : part));
    setSaved(false);
  };

  const updateSelectedCopy = (key: string, value: string) => {
    setParts((current) => current.map((part) => part.id === selected.id ? { ...part, copy: { ...part.copy, [key]: value } } : part));
    setSaved(false);
  };

  const updateLinkedFact = (field: "productName" | "origin" | "weight", value: string) => {
    if (field === "productName") setProductName(value);
    if (field === "origin") setOrigin(value);
    if (field === "weight") setWeight(value);
    setSaved(false);
  };

  const movePart = (direction: -1 | 1) => {
    setParts((current) => {
      const index = current.findIndex((part) => part.id === selected.id);
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
    setSaved(false);
  };

  const regenerate = () => {
    setGenerating(true);
    window.setTimeout(() => {
      updateSelected("title", selected.id === "hero" ? "한입 베어 물면, 여름이 번집니다" : `${selected.label}, 더 쉽게 확인하세요`);
      setGenerating(false);
      flash("선택한 파츠만 새로 작성했습니다");
    }, 900);
  };

  const regenerateReviews = () => {
    const variants = [
      [
        ["향과 식감이 기대 이상이었어요", `${productName} 특유의 향이 은은하고 식감도 편안하게 즐기기 좋았어요.`, "향·식감 만족 후기"],
        ["포장 상태가 깔끔해 만족했어요", "완충 포장이 단정하고 상품 상태를 확인하기 쉬워 안심됐어요.", "포장 만족 후기"],
        ["구성과 안내가 한눈에 들어와요", `${weight} 구성과 보관 안내가 잘 정리되어 선택하기 편했습니다.`, "구성 만족 후기"],
      ],
      [
        ["제철의 신선함이 잘 느껴져요", "받아본 뒤 알맞게 후숙하니 향과 과즙을 더 풍부하게 즐길 수 있었어요.", "신선도 만족 후기"],
        ["열어보는 순간 정성이 느껴져요", "상품이 흐트러지지 않도록 꼼꼼하게 정돈된 포장이 인상적이었어요.", "배송 만족 후기"],
        ["필요한 정보가 명확해서 좋아요", "원산지와 판매 단위, 보관 방법을 바로 확인할 수 있어 편리했어요.", "정보 만족 후기"],
      ],
      [
        ["부드러운 맛을 좋아한다면 잘 맞아요", `${productName}의 특징이 잘 살아 있어 가족과 함께 즐기기 좋았어요.`, "맛 만족 후기"],
        ["받는 사람을 생각한 구성이에요", "제품과 포장이 보기 좋게 정돈되어 있어 만족스럽게 받아봤어요.", "구성 만족 후기"],
        ["다음에도 편하게 선택할 것 같아요", "상품 설명과 실제 구성 확인이 쉬워 다시 고르기에도 부담이 없었어요.", "재구매 기대 후기"],
      ],
    ];
    const next = variants[Math.floor(Math.random() * variants.length)];
    setGenerating(true);
    window.setTimeout(() => {
      setParts((current) => current.map((part) => part.id === selected.id ? {
        ...part,
        copy: {
          ...part.copy,
          review1Title: next[0][0], review1Body: next[0][1], review1Author: next[0][2],
          review2Title: next[1][0], review2Body: next[1][1], review2Author: next[1][2],
          review3Title: next[2][0], review3Body: next[2][1], review3Author: next[2][2],
        },
      } : part));
      setGenerating(false);
      setSaved(false);
      flash("상품에 맞춘 후기 문구 3개를 새로 적용했습니다");
    }, 650);
  };

  const saveVersion = async (label = "수동 저장") => {
    const snapshot: Snapshot = {
      id: crypto.randomUUID(), label, savedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      parts, productName, origin, weight, theme,
    };
    setSnapshots((current) => [snapshot, ...current].slice(0, 8));
    setSaved(true);
    if (supabase && cloudUser) {
      try {
        setCloudBusy(true);
        const result = await saveWorkspace(supabase, cloudUser, { productName, origin, weight, theme, parts });
        flash(`Supabase에 v${result.versionNumber}으로 저장했습니다`);
      } catch (error) {
        flash(error instanceof Error ? `클라우드 저장 실패: ${error.message}` : "클라우드 저장에 실패했습니다");
      } finally { setCloudBusy(false); }
    } else {
      flash("현재 편집본을 브라우저에 저장했습니다");
    }
  };

  const restoreVersion = (snapshot: Snapshot) => {
    setParts(snapshot.parts); setProductName(snapshot.productName); setOrigin(snapshot.origin); setWeight(snapshot.weight); setTheme(snapshot.theme);
    setSelectedId(snapshot.parts[0]?.id ?? "hero"); setShowVersions(false); flash(`${snapshot.label} 버전을 복원했습니다`);
  };

  const createProduct = () => {
    if (!draft.name.trim()) return flash("상품명만 입력하면 바로 시작할 수 있어요");
    const noun = draft.name.trim();
    const nextOrigin = draft.origin.trim() || "원산지를 입력해 주세요";
    const nextWeight = draft.weight.trim() || "판매 단위를 입력해 주세요";
    const generated = initialParts.map((part) => {
      if (part.id === "hero") return { ...part, title: `${noun}, 제철의 맛을 담다`.slice(0, 22), body: `${nextOrigin}에서 준비한 ${noun}을 신선하게 보내드립니다.` };
      if (part.id === "summary") return { ...part, title: `한눈에 보는 ${noun}`, body: `산지와 구성 정보를 확인한 ${draft.category} 상품입니다.` };
      if (part.id === "options") return { ...part, body: `${nextWeight} 구성으로 준비했습니다.` };
      if (part.id === "reviews") return { ...part, title: `${noun}, 이런 점이 만족스러워요`, body: `${noun}의 맛과 구성, 포장에서 만족하기 좋은 포인트를 모았습니다.` };
      return part;
    });
    setParts(generated); setProductName(noun); setOrigin(nextOrigin); setWeight(nextWeight); setSelectedId("hero"); setTheme("seasonal");
    setShowNewProduct(false); setActiveView("editor"); setSaved(false); setDraft({ name: "", origin: "", weight: "", category: "과일" });
    flash(`입력한 상품 정보를 바탕으로 ${generated.length}개 파츠를 생성했습니다`);
  };

  const addPart = (partId: string) => {
    const next = allPartTemplates.find((candidate) => candidate.id === partId);
    if (!next || parts.some((part) => part.id === next.id)) return;
    setParts((current) => {
      const noticeIndex = current.findIndex((part) => part.id === "notice");
      const insertAt = noticeIndex < 0 ? current.length : noticeIndex;
      return [...current.slice(0, insertAt), { ...next }, ...current.slice(insertAt)];
    });
    setSelectedId(next.id); setActiveView("editor"); setActiveEditTab("content"); setShowPartLibrary(false); setSaved(false);
    flash(`${next.code} ${next.label} 파츠를 추가했습니다`);
  };

  const deletePart = (partId: string) => {
    if (parts.length <= 1) return flash("상세페이지에는 최소 한 개의 파츠가 필요합니다");
    const index = parts.findIndex((part) => part.id === partId);
    const removed = parts[index];
    if (!removed) return;
    const remaining = parts.filter((part) => part.id !== partId);
    const nextSelected = remaining[Math.min(index, remaining.length - 1)];
    setParts(remaining);
    if (selectedId === partId) setSelectedId(nextSelected.id);
    setSaved(false);
    flash(`${removed.label} 파츠를 삭제했습니다 · 파츠 추가에서 다시 복원할 수 있어요`);
  };

  const setPartVisibility = (partId: string, visible: boolean) => {
    setParts((current) => current.map((part) => part.id === partId ? { ...part, visible } : part));
    setSaved(false);
    flash(visible ? "파츠를 미리보기에 다시 표시했습니다" : "파츠를 숨겼습니다 · 편집 패널에서 다시 표시할 수 있어요");
  };

  const reorderParts = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setParts((current) => {
      const from = current.findIndex((part) => part.id === sourceId);
      const to = current.findIndex((part) => part.id === targetId);
      if (from < 0 || to < 0) return current;
      const copy = [...current];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
    setSaved(false);
  };

  const updateSelectedLayout = (layout: LayoutKey) => {
    setParts((current) => current.map((part) => part.id === selected.id ? { ...part, layout } : part));
    setSaved(false);
  };

  const updateSelectedTypography = (field: "fontFamily" | "fontScale", value: FontKey | number) => {
    setParts((current) => current.map((part) => part.id === selected.id ? { ...part, [field]: value } : part));
    setSaved(false);
  };

  const assignAsset = (assetId: string, partId = selected.id) => {
    const asset = mediaAssets.find((item) => item.id === assetId);
    if (!asset) return;
    setParts((current) => current.map((part) => part.id === partId ? { ...part, imageAssetId: assetId, imageFocus: part.imageFocus ?? 50, imageZoom: part.imageZoom ?? 100 } : part));
    if (partId === "hero") setHeroImage(asset.src);
    setSaved(false);
    flash(`${asset.role} 사진을 ${parts.find((part) => part.id === partId)?.label ?? "파츠"}에 배치했습니다`);
  };

  const autoPlacePhotos = (assets = mediaAssets) => {
    if (!assets.length) return flash("먼저 제품 사진을 올려 주세요");
    setParts((current) => current.map((part) => {
      const position = photoPartOrder.indexOf(part.id);
      if (position < 0) return part;
      const asset = assets[position % assets.length];
      return { ...part, imageAssetId: asset.id, imageFocus: 50, imageZoom: 100 };
    }));
    setHeroImage(assets[0].src);
    setSaved(false);
    flash(`${assets.length}장 사진을 ${Math.min(photoPartOrder.length, parts.length)}개 파츠에 자동 배치했습니다`);
  };

  const requestMagicLink = async () => {
    if (!supabase) return flash("Supabase 프로젝트 연결 후 사용할 수 있습니다");
    if (!/^\S+@\S+\.\S+$/.test(cloudEmail)) return flash("이메일 주소를 확인해 주세요");
    setCloudBusy(true);
    const { error } = await sendMagicLink(supabase, cloudEmail.trim());
    setCloudBusy(false);
    if (error) return flash(`로그인 링크 전송 실패: ${error.message}`);
    setMagicLinkSent(true);
  };

  const signOutCloud = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setCloudUser(null); setShowCloudSettings(false); flash("Supabase에서 로그아웃했습니다");
  };

  const handleFiles = async (fileList?: FileList | File[]) => {
    const files = Array.from(fileList ?? []).slice(0, Math.max(0, 10 - mediaAssets.length));
    if (!files.length) return;
    const valid = files.filter((file) => (["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type) && file.size <= 20 * 1024 * 1024);
    if (valid.length !== files.length) flash("JPG, PNG, WebP 형식의 20MB 이하 사진만 추가했습니다");
    if (!valid.length) return;
    try {
      const sources = await Promise.all(valid.map(prepareImage));
      const nextAssets = sources.map((src, index): MediaAsset => ({
        id: crypto.randomUUID(), src, name: valid[index].name,
        role: photoRoles[(mediaAssets.length + index) % photoRoles.length], source: "uploaded",
      }));
      const combined = [...mediaAssets, ...nextAssets];
      setMediaAssets(combined);
      autoPlacePhotos(combined);
    } catch (error) {
      flash(error instanceof Error ? error.message : "사진을 처리하지 못했습니다");
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setImageDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const generateMoodImage = async () => {
    const source = mediaAssets.find((asset) => asset.source === "uploaded");
    setImageGenerating(true);
    try {
      const response = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl: source?.src, productName, theme: themeMap[theme].label, model: imageModel, role: imageRole, partTitle: selected.title, partBody: selected.body }) });
      const result = await response.json() as { image?: string; error?: string };
      if (!response.ok || !result.image) throw new Error(result.error ?? "AI 이미지 생성에 실패했습니다");
      const asset: MediaAsset = { id: crypto.randomUUID(), src: result.image, name: `${productName}-${imageRoleMap[imageRole].label}.png`, role: imageRoleMap[imageRole].label, source: "ai" };
      setMediaAssets((current) => [...current, asset]);
      setParts((current) => current.map((part) => part.id === selected.id ? { ...part, imageAssetId: asset.id, imageFocus: 50, imageZoom: 100 } : part));
      if (selected.id === "hero") setHeroImage(asset.src);
      setSaved(false);
      flash(`${source ? "제품 사진을 기준으로" : "상품명과 파츠 내용을 기준으로"} ${imageRoleMap[imageRole].label} 이미지를 만들었습니다`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "AI 이미지 생성에 실패했습니다");
    } finally { setImageGenerating(false); }
  };

  const downloadAsset = (asset: MediaAsset) => {
    const anchor = document.createElement("a");
    anchor.href = asset.src;
    anchor.download = asset.name.replace(/[\\/:*?"<>|]/g, "-");
    anchor.click();
    flash("AI 생성 이미지를 다운로드했습니다");
  };

  const prepareExportPreview = async () => {
    if (!previewRef.current) return null;
    await document.fonts.ready;

    const sourceWidth = previewRef.current.getBoundingClientRect().width;
    const host = document.createElement("div");
    Object.assign(host.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: `${sourceWidth}px`,
      background: "#ffffff",
      pointerEvents: "none",
      zIndex: "-1",
    });

    const clone = previewRef.current.cloneNode(true) as HTMLDivElement;
    Object.assign(clone.style, {
      width: `${sourceWidth}px`,
      maxWidth: "none",
      margin: "0",
      boxShadow: "none",
    });
    clone.querySelectorAll(".selection-tag").forEach((element) => element.remove());
    clone.querySelectorAll(".part-hover-actions").forEach((element) => element.remove());
    clone.querySelectorAll(".part-hover-delete").forEach((element) => element.remove());
    clone.querySelectorAll(".selected-part").forEach((element) => element.classList.remove("selected-part"));
    host.appendChild(clone);
    document.body.appendChild(host);

    await Promise.all(Array.from(clone.querySelectorAll("img")).map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.onload = () => resolve();
          image.onerror = () => resolve();
        });
      }
      try { await image.decode(); } catch { /* loaded images can still be exported */ }
    }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    return { host, clone, sourceWidth };
  };

  const collectPageStyles = () => Array.from(document.styleSheets).map((sheet) => {
    try { return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n"); }
    catch { return ""; }
  }).join("\n");

  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;",
  })[character] ?? character);

  const exportPng = async () => {
    const prepared = await prepareExportPreview();
    if (!prepared) return;
    flash("860px 이미지로 렌더링하고 있습니다");
    try {
      const sourceHeight = prepared.clone.scrollHeight;
      const dataUrl = await toPng(prepared.clone, {
        width: prepared.sourceWidth,
        height: sourceHeight,
        pixelRatio: 860 / prepared.sourceWidth,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const anchor = document.createElement("a");
      anchor.download = `${productName}_상세페이지.png`;
      anchor.href = dataUrl;
      anchor.click();
      flash("여백과 편집 표시 없이 860px PNG로 저장했습니다");
    } catch (error) {
      flash(error instanceof Error ? `PNG 저장 실패: ${error.message}` : "PNG 저장에 실패했습니다");
    } finally {
      prepared.host.remove();
      setShowExport(false);
    }
  };

  const exportJson = () => {
    downloadText(`${productName}.json`, JSON.stringify({ product: { name: productName, origin, weight }, theme, parts }, null, 2), "application/json");
    setShowExport(false);
  };

  const exportHtml = async () => {
    const prepared = await prepareExportPreview();
    if (!prepared) return;
    flash("스타일과 이미지를 HTML에 포함하고 있습니다");
    try {
      await Promise.all(Array.from(prepared.clone.querySelectorAll("img")).map(async (image) => {
        const source = image.getAttribute("src") ?? "";
        image.removeAttribute("srcset");
        if (!source || source.startsWith("data:")) return;
        const response = await fetch(new URL(source, window.location.href));
        if (!response.ok) throw new Error(`이미지를 불러오지 못했습니다 (${response.status})`);
        const blob = await response.blob();
        image.src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("이미지를 변환하지 못했습니다"));
          reader.onerror = () => reject(new Error("이미지를 변환하지 못했습니다"));
          reader.readAsDataURL(blob);
        });
      }));
      prepared.clone.removeAttribute("style");
      const exportOverrides = `
        *{box-sizing:border-box}
        html,body{margin:0;min-height:100%;background:#fff}
        body{display:flex;justify-content:center;overflow-x:hidden}
        .detail-page{width:min(860px,100%)!important;max-width:none!important;margin:0 auto!important;box-shadow:none!important}
        .selection-tag{display:none!important}
        .selected-part{outline:none!important}
        @media(max-width:860px){.detail-page{width:100%!important}}
      `;
      const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(productName)}</title><style>${collectPageStyles()}${exportOverrides}</style></head><body>${prepared.clone.outerHTML}</body></html>`;
      downloadText(`${productName}.html`, html, "text/html");
      flash("스타일과 이미지를 포함한 반응형 HTML로 저장했습니다");
    } catch (error) {
      flash(error instanceof Error ? `HTML 저장 실패: ${error.message}` : "HTML 저장에 실패했습니다");
    } finally {
      prepared.host.remove();
      setShowExport(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Leaf size={19} strokeWidth={2.4} /></span><span>프린스팜</span><em>STUDIO</em></div>
        <div className="project-title"><button className="icon-btn"><ArrowLeft size={18} /></button><div><strong>{productName}</strong><span>{saved ? <><Check size={13} /> 모든 변경사항 저장됨</> : <><Clock3 size={13} /> 저장되지 않은 변경사항</>}</span></div></div>
        <div className="top-actions">
          <button className={`text-btn cloud-btn ${cloudUser ? "connected" : ""}`} onClick={() => setShowCloudSettings(true)}><Cloud size={16} /> {cloudBusy ? "저장 중" : cloudUser ? "클라우드 연결됨" : "클라우드"}</button>
          <button className="text-btn new-product-btn" onClick={() => setShowNewProduct(true)}><Plus size={16} /> 새 상품</button>
          <button className="text-btn" onClick={() => setShowVersions(!showVersions)}><Clock3 size={16} /> 버전</button>
          <button className="text-btn" onClick={() => saveVersion()}><Save size={16} /> 저장</button>
          <button className="primary-btn" onClick={() => setShowExport(!showExport)}><Download size={17} /> 내보내기 <ChevronDown size={14} /></button>
          <div className="avatar">소</div>
        </div>
        {showExport && <div className="popover export-popover">
          <b>결과물 내보내기</b><span>선택한 형식으로 바로 저장합니다.</span>
          <button onClick={exportPng}><ImageIcon size={18} /><div><strong>전체 PNG</strong><small>스마트스토어 860px</small></div></button>
          <button onClick={exportHtml}><FileCode2 size={18} /><div><strong>반응형 HTML</strong><small>자사몰용 소스</small></div></button>
          <button onClick={exportJson}><FileJson2 size={18} /><div><strong>콘텐츠 JSON</strong><small>사실·카피 원본</small></div></button>
        </div>}
        {showVersions && <div className="popover version-popover"><b>버전 기록</b><button onClick={() => restoreVersion({ id:"initial", label:"최초 생성", savedAt:"기본", parts:initialParts, productName:"햇살담은 영천 백도", origin:"경상북도 영천시", weight:"2kg · 8~10과", theme:"seasonal" })}><RotateCcw size={17} /><div><strong>v1 · 최초 생성</strong><small>기본 예시로 복원</small></div></button>{snapshots.map((snapshot) => <button key={snapshot.id} onClick={() => restoreVersion(snapshot)}><Clock3 size={17} /><div><strong>{snapshot.label}</strong><small>오늘 {snapshot.savedAt}</small></div></button>)}<button><CheckCircle2 size={17} /><div><strong>현재 편집본</strong><small>브라우저 자동 저장</small></div></button></div>}
      </header>

      <main className="workspace">
        <aside className="parts-panel">
          <div className="panel-heading"><div><span>페이지 구성</span><strong>{visibleParts.length}개 파츠</strong></div><button className="icon-btn"><PanelLeftClose size={17} /></button></div>
          <div className="stage-label"><span>드래그하여 순서 변경</span><i /></div>
          <div className="part-list">
            {parts.map((part, index) => (
              <button
                key={part.id}
                draggable
                aria-label={`${part.label} 파츠, 드래그하여 순서 변경`}
                className={`part-item ${selected.id === part.id ? "active" : ""} ${!part.visible ? "hidden-part" : ""} ${draggedPartId === part.id ? "dragging" : ""} ${dragOverPartId === part.id ? "drag-over" : ""}`}
                onClick={() => { setSelectedId(part.id); setActiveView("editor"); }}
                onDragStart={(event) => { setDraggedPartId(part.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", part.id); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOverPartId(part.id); }}
                onDrop={(event) => { event.preventDefault(); const sourceId = event.dataTransfer.getData("text/plain") || draggedPartId; if (sourceId) reorderParts(sourceId, part.id); setDraggedPartId(null); setDragOverPartId(null); }}
                onDragEnd={() => { setDraggedPartId(null); setDragOverPartId(null); }}
              >
                <span className="drag-dots" title="드래그하여 이동">⠿</span><span className="part-index">{String(index + 1).padStart(2, "0")}</span><span className="part-name"><strong>{part.label}</strong><small>{part.code}</small></span>{!part.visible && <Eye size={14} />}
              </button>
            ))}
          </div>
          <button className="add-part" onClick={() => setShowPartLibrary(true)}><Plus size={16} /> 파츠 선택 추가</button>
        </aside>

        <section className="canvas-area">
          <div className="canvas-toolbar">
            <div className="segmented"><button className={activeView === "editor" ? "active" : ""} onClick={() => setActiveView("editor")}><LayoutGrid size={15} /> 편집</button><button className={activeView === "facts" ? "active" : ""} onClick={() => setActiveView("facts")}><ShieldCheck size={15} /> 상품 사실</button></div>
            <div className="channel-select">네이버 스마트스토어 <span>860px</span><ChevronDown size={14} /></div>
            <button className="icon-btn"><MoreHorizontal size={19} /></button>
          </div>

          {activeView === "editor" ? (
            <div className="canvas-scroll">
              <div className="preview-label"><span><span className="live-dot" /> 실시간 미리보기</span><span>860 × AUTO</span></div>
              <div className={`detail-page theme-${theme}`} ref={previewRef}>
                {visibleParts.map((part) => {
                  const assignedAsset = mediaAssets.find((asset) => asset.id === part.imageAssetId);
                  const activeLayout = part.layout === "default" || !part.layout ? "wide" : part.layout === "card" ? "info" : part.layout;
                  const galleryAssets = assignedAsset
                    ? [assignedAsset, ...mediaAssets.filter((asset) => asset.id !== assignedAsset.id)].slice(0, 4)
                    : mediaAssets.slice(0, 4);
                  const partStyle = {
                    "--part-font-family": fontMap[part.fontFamily ?? "clean"].family,
                    "--part-font-scale": (part.fontScale ?? 100) / 100,
                  } as CSSProperties;
                  return (
                  <section key={part.id} className={`preview-part preview-${part.id} layout-${activeLayout} ${assignedAsset ? "has-part-image" : ""} ${selected.id === part.id ? "selected-part" : ""}`} style={partStyle} onClick={() => setSelectedId(part.id)}>
                    <div className="part-hover-actions"><button type="button" className="part-hover-hide" aria-label={`${part.label} 파츠 숨기기`} title="이 파츠 숨기기" onClick={(event) => { event.stopPropagation(); setPartVisibility(part.id, false); }}><EyeOff size={14}/><span>숨기기</span></button><button type="button" className="part-hover-delete" aria-label={`${part.label} 파츠 삭제`} title="이 파츠 삭제" onClick={(event) => { event.stopPropagation(); deletePart(part.id); }}><Trash2 size={14}/><span>삭제</span></button></div>
                    {part.id === "hero" && <>
                      <div className={`photo-frame ${activeLayout === "collage" ? "photo-collage" : ""}`}>{(activeLayout === "collage" && galleryAssets.length ? galleryAssets : [{ id: "hero-fallback", src: assignedAsset?.src ?? heroImage }]).map((asset) => <img key={asset.id} src={asset.src} alt={`${productName} 대표 상품`} className="hero-photo" style={{ objectPosition: `50% ${part.imageFocus ?? 50}%`, transform: `scale(${(part.imageZoom ?? 100) / 100})` }} />)}</div>
                      <div className="hero-overlay"><span className="eyebrow">{copyOf(part, "kicker")}</span><h1>{part.title}</h1><p>{part.body}</p><div className="hero-meta"><span>{copyOf(part, "metaOrigin")}</span><span>{weight}</span><span>{copyOf(part, "metaCategory")}</span></div></div>
                    </>}
                    {part.id === "summary" && <div className="summary-grid"><span className="section-kicker">{copyOf(part, "kicker")}</span><h2>{part.title}</h2><p>{part.body}</p><div className="summary-cards">{[1, 2, 3].map((number) => <article key={number}><b>{copyOf(part, `card${number}Number`)}</b><strong>{copyOf(part, `card${number}Title`)}</strong><span>{copyOf(part, `card${number}Body`)}</span></article>)}</div></div>}
                    {part.id === "audience" && <div className="split-part"><div><span className="section-kicker">{copyOf(part, "kicker")}</span><h2>{part.title}</h2><p>{part.body}</p><ul>{[1, 2, 3].map((number) => <li key={number}><Check size={16}/> {copyOf(part, `bullet${number}`)}</li>)}</ul></div><div className="peach-crop"><img src={assignedAsset?.src ?? heroImage} alt={productName} style={{ objectPosition: `50% ${part.imageFocus ?? 50}%`, transform: `scale(${(part.imageZoom ?? 100) / 100})` }}/></div></div>}
                    {part.id === "reviews" && <div className="review-part"><span className="section-kicker">{copyOf(part, "kicker")}</span><h2>{part.title}</h2><p>{part.body}</p><div className="review-cards">{[1, 2, 3].map((number) => <article key={number}><div className="review-stars" aria-label="별점 5점">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} fill="currentColor"/>)}</div><strong>{copyOf(part, `review${number}Title`)}</strong><p>{copyOf(part, `review${number}Body`)}</p><small>{copyOf(part, `review${number}Author`)}</small></article>)}</div></div>}
                    {!["hero", "summary", "audience", "reviews"].includes(part.id) && <>{(assignedAsset || (activeLayout === "collage" && galleryAssets.length > 0)) && <div className={`part-photo-frame ${activeLayout === "collage" ? "photo-collage" : ""}`}>{(activeLayout === "collage" ? galleryAssets : assignedAsset ? [assignedAsset] : []).map((asset) => <img key={asset.id} src={asset.src} alt={`${part.label}용 ${productName}`} style={{ objectPosition: `50% ${part.imageFocus ?? 50}%`, transform: `scale(${(part.imageZoom ?? 100) / 100})` }}/>) }{assignedAsset?.source === "ai" && <span>{copyOf(part, "imageBadge", "AI 연출 이미지")}</span>}</div>}<div className="standard-part"><span className="section-kicker">{copyOf(part, "kicker", part.label)}</span><h2>{part.title}</h2><p>{part.body.replace("2kg 한 상자, 8~10과", weight).replace("경북 영천", origin)}</p>{part.id === "options" && <><div className="composition-grid">{[1, 2, 3].map((number) => <article key={number}><span>{number}</span><strong>{copyOf(part, `composition${number}Name`)}</strong><b>{copyOf(part, `composition${number}Value`)}</b></article>)}</div><p className="composition-note">{copyOf(part, "compositionNote")}</p><div className="option-card"><div><small>{copyOf(part, "factWeightLabel")}</small><strong>{weight}</strong></div><div><small>{copyOf(part, "factOriginLabel")}</small><strong>{origin}</strong></div><div><small>{copyOf(part, "factNameLabel")}</small><strong>{productName}</strong></div></div></>}{part.id === "notice" && <div className="notice-box"><ShieldCheck size={22}/><span>{copyOf(part, "noticeTitle")}<br/><small>{copyOf(part, "noticeBody")}</small></span></div>}</div></>}
                    {selected.id === part.id && <span className="selection-tag">선택됨</span>}
                  </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <FactsPanel productName={productName} origin={origin} weight={weight} setProductName={setProductName} setOrigin={setOrigin} setWeight={setWeight} handleFiles={handleFiles} onChange={() => setSaved(false)} />
          )}
        </section>

        <aside className="edit-panel">
          <div className="edit-heading"><div><span>{selected.code}</span><strong>{selected.label}</strong></div><button className="icon-btn"><X size={18} /></button></div>
          <div className="edit-tabs">
            <button className={activeEditTab === "content" ? "active" : ""} onClick={() => setActiveEditTab("content")}>콘텐츠</button>
            <button className={activeEditTab === "design" ? "active" : ""} onClick={() => setActiveEditTab("design")}>디자인</button>
            <button className={activeEditTab === "image" ? "active" : ""} onClick={() => setActiveEditTab("image")}>이미지</button>
          </div>
          <div className="edit-scroll">
            {activeEditTab === "content" ? <>
              <div className="ai-actions"><div><Sparkles size={17}/><strong>AI 간편 수정</strong><small>이 파츠에만 적용됩니다</small></div>{selected.id !== "reviews" && <div className="chip-row"><button onClick={regenerate}>더 고급스럽게</button><button onClick={regenerate}>더 간결하게</button><button onClick={regenerate}>정보 중심으로</button></div>}<button className="regenerate-btn" onClick={selected.id === "reviews" ? regenerateReviews : regenerate} disabled={generating}>{generating ? <LoaderCircle className="spin" size={16}/> : <RefreshCcw size={16}/>} {selected.id === "reviews" ? "후기 문구 3개 다시 생성" : "제목만 다시 생성"}</button></div>
              <div className="field-group"><label>제목 <span>{selected.title.length}/22</span></label><textarea value={selected.title} onChange={(e) => updateSelected("title", e.target.value)} rows={2}/></div>
              <div className="field-group"><label>본문 <span>{selected.body.length}/120</span></label><textarea value={selected.body} onChange={(e) => updateSelected("body", e.target.value)} rows={5}/><small><CheckCircle2 size={13}/> 확인된 상품 사실과 연결됨</small></div>
              <div className="microcopy-heading"><strong>화면의 나머지 문구</strong><small>이 파츠에 보이는 작은 문구까지 모두 수정할 수 있습니다.</small></div>
              <CopyField label="영문·상단 키커" value={copyOf(selected, "kicker", selected.label)} onChange={(value) => updateSelectedCopy("kicker", value)}/>
              {selected.id === "hero" && <>
                <CopyField label="메타 정보 1" value={copyOf(selected, "metaOrigin")} onChange={(value) => updateSelectedCopy("metaOrigin", value)}/>
                <CopyField label="메타 정보 2 · 판매 단위" value={weight} onChange={(value) => updateLinkedFact("weight", value)} linked/>
                <CopyField label="메타 정보 3" value={copyOf(selected, "metaCategory")} onChange={(value) => updateSelectedCopy("metaCategory", value)}/>
              </>}
              {selected.id === "summary" && <div className="copy-card-editor">
                {[1, 2, 3].map((number) => <fieldset key={number}><legend>요약 카드 {number}</legend>
                  <CopyField label="번호" value={copyOf(selected, `card${number}Number`)} onChange={(value) => updateSelectedCopy(`card${number}Number`, value)}/>
                  <CopyField label="카드 제목" value={copyOf(selected, `card${number}Title`)} onChange={(value) => updateSelectedCopy(`card${number}Title`, value)}/>
                  <CopyField label="카드 설명" value={copyOf(selected, `card${number}Body`)} onChange={(value) => updateSelectedCopy(`card${number}Body`, value)} multiline/>
                </fieldset>)}
              </div>}
              {selected.id === "audience" && <div className="copy-card-editor"><fieldset><legend>추천 문구</legend>{[1, 2, 3].map((number) => <CopyField key={number} label={`추천 항목 ${number}`} value={copyOf(selected, `bullet${number}`)} onChange={(value) => updateSelectedCopy(`bullet${number}`, value)}/>)}</fieldset></div>}
              {selected.id === "options" && <>
                <div className="copy-card-editor">{[1, 2, 3].map((number) => <fieldset key={number}><legend>구성 카드 {number}</legend><CopyField label="구성명" value={copyOf(selected, `composition${number}Name`)} onChange={(value) => updateSelectedCopy(`composition${number}Name`, value)}/><CopyField label="수량·포함 내용" value={copyOf(selected, `composition${number}Value`)} onChange={(value) => updateSelectedCopy(`composition${number}Value`, value)}/></fieldset>)}</div>
                <CopyField label="구성 안내 문구" value={copyOf(selected, "compositionNote")} onChange={(value) => updateSelectedCopy("compositionNote", value)} multiline/>
                <CopyField label="표 라벨 · 판매 단위" value={copyOf(selected, "factWeightLabel")} onChange={(value) => updateSelectedCopy("factWeightLabel", value)}/>
                <CopyField label="표 라벨 · 원산지" value={copyOf(selected, "factOriginLabel")} onChange={(value) => updateSelectedCopy("factOriginLabel", value)}/>
                <CopyField label="표 라벨 · 상품명" value={copyOf(selected, "factNameLabel")} onChange={(value) => updateSelectedCopy("factNameLabel", value)}/>
                <CopyField label="판매 단위 값" value={weight} onChange={(value) => updateLinkedFact("weight", value)} linked/>
                <CopyField label="원산지 값" value={origin} onChange={(value) => updateLinkedFact("origin", value)} linked/>
                <CopyField label="상품명 값" value={productName} onChange={(value) => updateLinkedFact("productName", value)} linked/>
              </>}
              {selected.id === "reviews" && <div className="copy-card-editor">{[1, 2, 3].map((number) => <fieldset key={number}><legend>후기 카드 {number}</legend><CopyField label="후기 제목" value={copyOf(selected, `review${number}Title`)} onChange={(value) => updateSelectedCopy(`review${number}Title`, value)}/><CopyField label="후기 내용" value={copyOf(selected, `review${number}Body`)} onChange={(value) => updateSelectedCopy(`review${number}Body`, value)} multiline/><CopyField label="후기 태그" value={copyOf(selected, `review${number}Author`)} onChange={(value) => updateSelectedCopy(`review${number}Author`, value)}/></fieldset>)}</div>}
              {selected.id === "notice" && <>
                <CopyField label="확인 박스 제목" value={copyOf(selected, "noticeTitle")} onChange={(value) => updateSelectedCopy("noticeTitle", value)}/>
                <CopyField label="확인 박스 설명" value={copyOf(selected, "noticeBody")} onChange={(value) => updateSelectedCopy("noticeBody", value)} multiline/>
              </>}
              {!["hero", "summary", "audience", "reviews"].includes(selected.id) && <CopyField label="AI 이미지 배지" value={copyOf(selected, "imageBadge", "AI 연출 이미지")} onChange={(value) => updateSelectedCopy("imageBadge", value)}/>}
            </> : activeEditTab === "design" ? <>
              <div className="tab-intro"><Palette size={18}/><div><strong>파츠 디자인</strong><p>선택한 파츠의 구성과 페이지 전체 색감을 조정합니다.</p></div></div>
              <div className="field-group"><label>파츠 레이아웃</label><div className="layout-options layout-options-five">{layoutPresets.map(({key, label}) => { const currentLayout = selected.layout === "default" || !selected.layout ? "wide" : selected.layout === "card" ? "info" : selected.layout; return <button key={key} className={currentLayout === key ? "active" : ""} onClick={() => updateSelectedLayout(key)}><i className={`layout-preview-${key}`}/><span>{label}</span>{currentLayout === key && <Check size={13}/>}</button>; })}</div><small>콜라주는 업로드된 사진을 최대 4장까지 자동 조합합니다.</small></div>
              <div className="field-group"><label>텍스트 폰트</label><div className="font-options">{(Object.keys(fontMap) as FontKey[]).map((key) => <button key={key} className={(selected.fontFamily ?? "clean") === key ? "active" : ""} onClick={() => updateSelectedTypography("fontFamily", key)} style={{fontFamily: fontMap[key].family}}><span><strong>{fontMap[key].label}</strong><small>{fontMap[key].sample}</small></span>{(selected.fontFamily ?? "clean") === key && <Check size={14}/>}</button>)}</div></div>
              <div className="field-group"><label>폰트 크기 <span>{selected.fontScale ?? 100}%</span></label><div className="font-scale-control"><input aria-label="선택 파츠 폰트 크기" type="range" min="80" max="140" step="5" value={selected.fontScale ?? 100} onChange={(event) => updateSelectedTypography("fontScale", Number(event.target.value))}/><div><button onClick={() => updateSelectedTypography("fontScale", 90)}>작게</button><button onClick={() => updateSelectedTypography("fontScale", 100)}>기본</button><button onClick={() => updateSelectedTypography("fontScale", 120)}>크게</button></div></div><small>선택한 파츠의 제목·본문·보조 문구에 함께 적용됩니다.</small></div>
              <div className="field-group"><label>페이지 테마</label><div className="theme-options">{(Object.keys(themeMap) as ThemeKey[]).map((key) => <button key={key} className={theme === key ? "active" : ""} onClick={() => { setTheme(key); setSaved(false); }}><span>{themeMap[key].swatches.map((color) => <i key={color} style={{background: color}} />)}</span><b>{themeMap[key].label}</b>{theme === key && <Check size={14}/>}</button>)}</div></div>
            </> : <>
              <div className="tab-intro"><ImageIcon size={18}/><div><strong>사진 자동 구성</strong><p>제품 사진 4~10장을 권장합니다. 적은 사진으로도 시작할 수 있어요.</p></div></div>
              <label className={`image-dropzone ${imageDragging ? "dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setImageDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setImageDragging(false); }} onDrop={handleDrop}>
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => handleFiles(event.target.files ?? undefined)}/>
                {mediaAssets.length ? <div className="drop-preview">{mediaAssets.slice(0, 4).map((asset) => <img key={asset.id} src={asset.src} alt="업로드 미리보기"/>)}</div> : <div className="drop-empty"><ImageIcon size={34}/></div>}
                <span><UploadCloud size={22}/><strong>{imageDragging ? "여기에 놓아주세요" : `${mediaAssets.length ? "사진 더 추가" : "제품 사진 여러 장 추가"}`}</strong><small>{mediaAssets.length}/10장 · JPG, PNG, WebP · 장당 20MB</small></span>
              </label>
              <button className="auto-place-btn" onClick={() => autoPlacePhotos()} disabled={!mediaAssets.length}><Sparkles size={16}/> AI 사진 자동 배치</button>
              <div className="media-library">
                {mediaAssets.map((asset) => <article key={asset.id} className={selected.imageAssetId === asset.id ? "active" : ""}>
                  <img src={asset.src} alt={asset.name}/><div className="media-meta"><span className={`source-badge ${asset.source}`}>{asset.source === "ai" ? "AI 연출" : "원본"}</span><strong>{asset.role}</strong><small>{asset.name}</small></div>
                  <div className="media-actions">{asset.source === "ai" && <button className="asset-download" onClick={() => downloadAsset(asset)} title="AI 이미지 다운로드" aria-label={`${asset.name} 다운로드`}><Download size={13}/></button>}<button onClick={() => assignAsset(asset.id)}>{selected.imageAssetId === asset.id ? <Check size={14}/> : "배치"}</button></div>
                </article>)}
              </div>
              {selectedAsset && <div className="crop-controls"><strong>선택 파츠 이미지 맞춤</strong><label><span>세로 초점</span><input type="range" min="0" max="100" value={selected.imageFocus ?? 50} onChange={(event) => setParts((current) => current.map((part) => part.id === selected.id ? {...part, imageFocus: Number(event.target.value)} : part))}/></label><label><span>확대</span><input type="range" min="100" max="160" value={selected.imageZoom ?? 100} onChange={(event) => setParts((current) => current.map((part) => part.id === selected.id ? {...part, imageZoom: Number(event.target.value)} : part))}/></label></div>}
              <div className="ai-scene-card"><div><Sparkles size={17}/><span><strong>제품 사진이 없어도 AI 이미지 생성</strong><small>{mediaAssets.some((asset) => asset.source === "uploaded") ? "원본 제품을 유지하고 선택한 역할에 맞춰 연출합니다." : "상품명과 선택 파츠의 문구를 바탕으로 새 장면을 만듭니다."}</small></span></div><div className="image-role-options">{(Object.keys(imageRoleMap) as ImageRole[]).map((role) => <button key={role} className={imageRole === role ? "active" : ""} onClick={() => setImageRole(role)}><strong>{imageRoleMap[role].label}</strong><small>{imageRoleMap[role].description}</small></button>)}</div><div className="image-model-toggle"><button className={imageModel === "gpt-image-2.5-flare" ? "active" : ""} onClick={() => setImageModel("gpt-image-2.5-flare")}><strong>Flare</strong><small>빠른 생성</small></button><button className={imageModel === "gpt-image-2.5-sunburst" ? "active" : ""} onClick={() => setImageModel("gpt-image-2.5-sunburst")}><strong>Sunburst</strong><small>정밀 보존</small></button></div><button className="generate-scene-btn" onClick={generateMoodImage} disabled={imageGenerating}>{imageGenerating ? <><LoaderCircle className="spin" size={14}/> 생성 중</> : `${imageRoleMap[imageRole].label} · ${imageModel === "gpt-image-2.5-flare" ? "빠르게" : "정밀하게"} 생성`}</button></div>
              <div className="image-help"><CheckCircle2 size={15}/><span>자동 배치 후에도 각 파츠에서 사진·초점·확대를 자유롭게 바꿀 수 있습니다.</span></div>
            </>}
          </div>
          <div className="edit-footer"><div><button className="icon-btn" onClick={() => movePart(-1)}><ArrowUp size={17}/></button><button className="icon-btn" onClick={() => movePart(1)}><ArrowDown size={17}/></button></div><div className="footer-actions">{!selected.visible && <button className="visibility-btn" onClick={() => setPartVisibility(selected.id, true)}><Eye size={16}/> 다시 보이기</button>}</div></div>
        </aside>
      </main>

      <div className={`quality-bar ${warnings.length ? "warning" : ""}`}><div><ShieldCheck size={18}/><strong>출력 전 품질 검사</strong><span>{warnings.length ? `위험 표현 ${warnings.length}건을 확인해 주세요.` : "필수 정보와 위험 표현에 이상이 없습니다."}</span></div><span className="status-pill">{warnings.length ? <><AlertTriangle size={14}/> 확인 필요</> : <><CheckCircle2 size={14}/> 출력 가능</>}</span><button onClick={() => flash(warnings.length ? `검토 필요: ${warnings.join(", ")}` : `${visibleParts.length}개 파츠 · 사실 일치 · 위험 표현 없음`)}>검사 결과 보기</button></div>
      {showPartLibrary && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPartLibrary(false); }}><div className="part-library-modal"><div className="modal-heading"><div><span><LayoutGrid size={18}/></span><div><strong>파츠 선택 추가</strong><small>필요한 파츠를 자유롭게 구성하세요.</small></div></div><button className="icon-btn" onClick={() => setShowPartLibrary(false)}><X size={18}/></button></div><div className="part-library-body">{allPartTemplates.map((part) => { const added = parts.some((current) => current.id === part.id); return <button key={part.id} disabled={added} onClick={() => addPart(part.id)}><span className="library-code">{part.code}</span><span><strong>{part.label}</strong><small>{part.body}</small></span><span className={added ? "added" : "add"}>{added ? <><Check size={14}/> 사용 중</> : <><Plus size={14}/> 추가</>}</span></button>; })}</div><div className="modal-footer"><span className="library-hint">삭제한 파츠도 이 목록에서 언제든 다시 추가할 수 있습니다.</span><button onClick={() => setShowPartLibrary(false)}>닫기</button></div></div></div>}
      {showNewProduct && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowNewProduct(false); }}><div className="new-product-modal"><div className="modal-heading"><div><span><Sparkles size={18}/></span><div><strong>새 상세페이지 만들기</strong><small>상품명만으로 시작하고 나머지는 나중에 채워도 됩니다.</small></div></div><button className="icon-btn" onClick={() => setShowNewProduct(false)}><X size={18}/></button></div><div className="modal-body"><label><span>상품 유형</span><div className="type-toggle"><button className={draft.category === "과일" ? "active" : ""} onClick={() => setDraft({...draft, category:"과일"})}>과일</button><button className={draft.category === "채소" ? "active" : ""} onClick={() => setDraft({...draft, category:"채소"})}>채소</button></div></label><label><span>상품명 <b>필수</b></span><input autoFocus placeholder="예: 제주 하우스 감귤" value={draft.name} onChange={(e) => setDraft({...draft, name:e.target.value})}/></label><div className="modal-row"><label><span>원산지 <em>선택</em></span><input placeholder="나중에 입력 가능" value={draft.origin} onChange={(e) => setDraft({...draft, origin:e.target.value})}/></label><label><span>판매 단위 <em>선택</em></span><input placeholder="나중에 입력 가능" value={draft.weight} onChange={(e) => setDraft({...draft, weight:e.target.value})}/></label></div><label className="modal-upload"><UploadCloud size={20}/><span><strong>상품 사진은 생성 후 여러 장 추가할 수 있어요</strong><small>4~10장을 권장하지만 1장으로도 시작할 수 있습니다.</small></span></label><div className="generation-summary"><span><CheckCircle2 size={15}/> 10개 파츠 자동 구성</span><span><Sparkles size={15}/> 사진 자동 배치</span><span><Palette size={15}/> 테마 자동 적용</span></div></div><div className="modal-footer"><button onClick={() => setShowNewProduct(false)}>취소</button><button className="create-btn" onClick={createProduct}><Sparkles size={16}/> 초안 만들기 <span>상품명만으로 가능</span></button></div></div></div>}
      {showCloudSettings && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCloudSettings(false); }}><div className="api-modal"><div className="modal-heading"><div><span><Cloud size={18}/></span><div><strong>프린스팜 클라우드</strong><small>Supabase에 상품과 버전을 안전하게 저장합니다.</small></div></div><button className="icon-btn" onClick={() => setShowCloudSettings(false)}><X size={18}/></button></div><div className="api-modal-body">{!isSupabaseConfigured ? <div className="cloud-empty"><AlertTriangle size={22}/><strong>Supabase 프로젝트 연결 대기 중</strong><p>프로젝트 URL과 Publishable Key가 설정되면 이메일 로그인을 사용할 수 있습니다.</p></div> : cloudUser ? <><div className="security-note"><CheckCircle2 size={19}/><div><strong>클라우드에 연결되었습니다.</strong><p>{cloudUser.email} 계정의 전용 데이터만 RLS로 접근합니다.</p></div></div><div className="cloud-stats"><div><small>저장 대상</small><strong>{productName}</strong></div><div><small>현재 파츠</small><strong>{parts.length}개</strong></div><div><small>보안</small><strong>RLS 적용</strong></div></div><button className="cloud-save-btn" disabled={cloudBusy} onClick={() => saveVersion("클라우드 저장")}><Cloud size={16}/>{cloudBusy ? "저장 중…" : "현재 버전 Supabase에 저장"}</button></> : magicLinkSent ? <div className="cloud-empty success"><CheckCircle2 size={24}/><strong>로그인 링크를 보냈습니다.</strong><p>{cloudEmail}의 받은편지함에서 링크를 누르면 연결이 완료됩니다.</p></div> : <><div className="security-note"><ShieldCheck size={19}/><div><strong>비밀번호 없이 안전하게 로그인합니다.</strong><p>입력한 이메일로 일회용 로그인 링크를 전송합니다.</p></div></div><label><span>이메일</span><div className="secret-input"><LogIn size={16}/><input autoFocus type="email" value={cloudEmail} onChange={(e) => setCloudEmail(e.target.value)} placeholder="name@example.com" autoComplete="email"/></div></label></>}</div><div className="modal-footer api-modal-footer">{cloudUser && <button className="danger-text" onClick={signOutCloud}><LogOut size={14}/> 로그아웃</button>}<span/><button onClick={() => setShowCloudSettings(false)}>닫기</button>{isSupabaseConfigured && !cloudUser && !magicLinkSent && <button className="create-btn" disabled={cloudBusy} onClick={requestMagicLink}><LogIn size={15}/>{cloudBusy ? "전송 중…" : "로그인 링크 받기"}</button>}</div></div></div>}
      {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
    </div>
  );
}

function CopyField({ label, value, onChange, multiline = false, linked = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  linked?: boolean;
}) {
  return <div className="field-group compact-field">
    <label>{label}{linked && <span>전체 연동</span>}</label>
    {multiline
      ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={2}/>
      : <input value={value} onChange={(event) => onChange(event.target.value)}/>}
  </div>;
}

function FactsPanel({ productName, origin, weight, setProductName, setOrigin, setWeight, handleFiles, onChange }: {
  productName: string; origin: string; weight: string;
  setProductName: (value: string) => void; setOrigin: (value: string) => void; setWeight: (value: string) => void;
  handleFiles: (files?: FileList | File[]) => void; onChange: () => void;
}) {
  const update = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => { setter(event.target.value); onChange(); };
  return <div className="facts-view"><div className="facts-header"><span className="section-kicker">OPTIONAL PRODUCT INFO</span><h1>아는 정보만 가볍게 더해 주세요.</h1><p>상품명만으로 시작할 수 있고, 사용자가 입력한 내용은 초안에 그대로 반영됩니다.</p></div><div className="facts-grid"><label className="upload-card" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFiles(event.dataTransfer.files); }}><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => handleFiles(event.target.files ?? undefined)}/><span><UploadCloud size={24}/></span><strong>제품 사진 여러 장 추가</strong><small>4~10장 권장 · 1장도 가능</small></label><div className="facts-form"><label><span>상품명 <b>필수</b></span><input value={productName} onChange={update(setProductName)}/><small><CheckCircle2 size={13}/> 상세페이지 전체에 자동 반영</small></label><label><span>원산지 <em>선택</em></span><input value={origin} onChange={update(setOrigin)}/><small>사용자가 입력한 내용을 그대로 사용합니다.</small></label><label><span>판매 단위 <em>선택</em></span><input value={weight} onChange={update(setWeight)}/><small><CheckCircle2 size={13}/> 모든 관련 파츠에 자동 반영</small></label></div></div><div className="fact-note"><Sparkles size={22}/><div><strong>상품 정보 입력은 선택입니다.</strong><p>먼저 초안을 만든 뒤 필요할 때 정보를 보완하고 사진 배치를 다시 실행할 수 있습니다.</p></div></div></div>;
}
