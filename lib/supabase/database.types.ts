export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: { Row: { id: string; owner_id: string; name: string; created_at: string }; Insert: { id?: string; owner_id: string; name: string }; Update: { name?: string } };
      products: { Row: { id: string; owner_id: string; organization_id: string; name: string; category: string; status: string; theme_key: string; updated_at: string }; Insert: { id?: string; owner_id: string; organization_id: string; name: string; category?: string; status?: string; theme_key?: string }; Update: { name?: string; category?: string; status?: string; theme_key?: string } };
      product_facts: { Row: { id: string; owner_id: string; product_id: string; fact_key: string; value: Json; verification_status: string }; Insert: { owner_id: string; product_id: string; fact_key: string; value: Json; verification_status?: string }; Update: { value?: Json; verification_status?: string } };
      page_versions: { Row: { id: string; owner_id: string; product_id: string; version_number: number; page_plan: Json; theme_tokens: Json; channel_profile: string }; Insert: { owner_id: string; product_id: string; version_number: number; page_plan?: Json; theme_tokens?: Json; channel_profile?: string }; Update: never };
      page_parts: { Row: { id: string; owner_id: string; page_version_id: string; part_type: string; order_index: number; content: Json; visibility: boolean }; Insert: { owner_id: string; page_version_id: string; part_type: string; order_index: number; content?: Json; visibility?: boolean }; Update: { order_index?: number; content?: Json; visibility?: boolean } };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
