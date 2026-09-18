import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Json } from "./database.types";

type WorkspacePart = { id: string; code: string; label: string; title: string; body: string; visible: boolean };
export type WorkspacePayload = { productName: string; origin: string; weight: string; theme: string; parts: WorkspacePart[] };

const REMOTE_PRODUCT_ID_KEY = "princefarm-remote-product-id";

export function clearRemoteProductLink() {
  window.localStorage.removeItem(REMOTE_PRODUCT_ID_KEY);
}

export async function sendMagicLink(client: SupabaseClient, email: string) {
  return client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}

export async function getCurrentUser(client: SupabaseClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function saveWorkspace(client: SupabaseClient, user: User, payload: WorkspacePayload) {
  const { data: existingOrg, error: orgReadError } = await client
    .from("organizations").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
  if (orgReadError) throw orgReadError;

  let organizationId = existingOrg?.id;
  if (!organizationId) {
    const { data, error } = await client.from("organizations")
      .insert({ owner_id: user.id, name: "프린스팜" }).select("id").single();
    if (error) throw error;
    organizationId = data.id;
  }

  let productId = window.localStorage.getItem(REMOTE_PRODUCT_ID_KEY);
  if (productId) {
    const { data } = await client.from("products").select("id").eq("id", productId).eq("owner_id", user.id).maybeSingle();
    if (!data) productId = null;
  }

  if (!productId) {
    const { data, error } = await client.from("products").insert({
      owner_id: user.id,
      organization_id: organizationId,
      name: payload.productName,
      category: "fruit",
      status: "review",
      theme_key: payload.theme,
    }).select("id").single();
    if (error) throw error;
    const createdProductId = data.id as string;
    productId = createdProductId;
    window.localStorage.setItem(REMOTE_PRODUCT_ID_KEY, createdProductId);
  } else {
    const { error } = await client.from("products").update({ name: payload.productName, theme_key: payload.theme, status: "review" }).eq("id", productId);
    if (error) throw error;
  }

  if (!productId) throw new Error("상품 ID를 생성하지 못했습니다.");

  const facts = [
    { owner_id: user.id, product_id: productId, fact_key: "origin", value: payload.origin as Json, verification_status: "verified" },
    { owner_id: user.id, product_id: productId, fact_key: "sales_unit", value: payload.weight as Json, verification_status: "verified" },
  ];
  const { error: factsError } = await client.from("product_facts").upsert(facts, { onConflict: "product_id,fact_key" });
  if (factsError) throw factsError;

  const { data: latestVersion, error: versionReadError } = await client.from("page_versions")
    .select("version_number").eq("product_id", productId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  if (versionReadError) throw versionReadError;
  const versionNumber = (latestVersion?.version_number ?? 0) + 1;
  const { data: version, error: versionError } = await client.from("page_versions").insert({
    owner_id: user.id,
    product_id: productId,
    version_number: versionNumber,
    page_plan: { part_count: payload.parts.length } as Json,
    theme_tokens: { key: payload.theme } as Json,
    channel_profile: "naver_860_image",
  }).select("id").single();
  if (versionError) throw versionError;

  const rows = payload.parts.map((part, index) => ({
    owner_id: user.id,
    page_version_id: version.id,
    part_type: part.code,
    order_index: index,
    content: { id: part.id, label: part.label, title: part.title, body: part.body } as Json,
    visibility: part.visible,
  }));
  const { error: partsError } = await client.from("page_parts").insert(rows);
  if (partsError) throw partsError;

  return { organizationId, productId, versionNumber };
}
