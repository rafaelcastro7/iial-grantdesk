export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent: string
          client_id: string | null
          created_at: string
          error: string | null
          id: string
          latency_ms: number | null
          model: string | null
          provider: string | null
          status: string
        }
        Insert: {
          agent: string
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          provider?: string | null
          status: string
        }
        Update: {
          agent?: string
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          provider?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_library: {
        Row: {
          client_id: string
          content: string
          id: string
          label: string
          times_used: number
          updated_at: string
        }
        Insert: {
          client_id: string
          content: string
          id?: string
          label: string
          times_used?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          content?: string
          id?: string
          label?: string
          times_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_library_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          annual_budget: number | null
          beneficiaries: string | null
          capabilities: string | null
          client_id: string
          currency: string | null
          extracted_from: Json
          jurisdictions: string[]
          reviewed_at: string | null
          sectors: string[]
          stage: string | null
          updated_at: string
        }
        Insert: {
          annual_budget?: number | null
          beneficiaries?: string | null
          capabilities?: string | null
          client_id: string
          currency?: string | null
          extracted_from?: Json
          jurisdictions?: string[]
          reviewed_at?: string | null
          sectors?: string[]
          stage?: string | null
          updated_at?: string
        }
        Update: {
          annual_budget?: number | null
          beneficiaries?: string | null
          capabilities?: string | null
          client_id?: string
          currency?: string | null
          extracted_from?: Json
          jurisdictions?: string[]
          reviewed_at?: string | null
          sectors?: string[]
          stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          consultant_id: string
          country: string
          created_at: string
          id: string
          name: string
          updated_at: string
          website: string | null
        }
        Insert: {
          archived_at?: string | null
          consultant_id: string
          country?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          archived_at?: string | null
          consultant_id?: string
          country?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      consultants: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      eligibility_checks: {
        Row: {
          detail: string
          id: string
          is_hard_gate: boolean
          match_id: string
          passed: boolean
          rule_key: string
        }
        Insert: {
          detail: string
          id?: string
          is_hard_gate?: boolean
          match_id: string
          passed: boolean
          rule_key: string
        }
        Update: {
          detail?: string
          id?: string
          is_hard_gate?: boolean
          match_id?: string
          passed?: boolean
          rule_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_checks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      funders: {
        Row: {
          category: string | null
          country: string
          created_at: string
          id: string
          jurisdiction: string | null
          name: string
          source_key: string | null
          website: string | null
        }
        Insert: {
          category?: string | null
          country: string
          created_at?: string
          id?: string
          jurisdiction?: string | null
          name: string
          source_key?: string | null
          website?: string | null
        }
        Update: {
          category?: string | null
          country?: string
          created_at?: string
          id?: string
          jurisdiction?: string | null
          name?: string
          source_key?: string | null
          website?: string | null
        }
        Relationships: []
      }
      grant_embeddings: {
        Row: {
          content_hash: string
          embedding: string
          grant_id: string
          model: string
          updated_at: string
        }
        Insert: {
          content_hash: string
          embedding: string
          grant_id: string
          model: string
          updated_at?: string
        }
        Update: {
          content_hash?: string
          embedding?: string
          grant_id?: string
          model?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_embeddings_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: true
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grants: {
        Row: {
          amount_max: number | null
          amount_min: number | null
          country: string
          currency: string | null
          deadline: string | null
          first_seen_at: string
          funder_id: string
          id: string
          language: string
          last_seen_at: string
          search_tsv: unknown
          source_hash: string
          source_key: string
          status: string
          summary: string | null
          title: string
          url: string
        }
        Insert: {
          amount_max?: number | null
          amount_min?: number | null
          country: string
          currency?: string | null
          deadline?: string | null
          first_seen_at?: string
          funder_id: string
          id?: string
          language?: string
          last_seen_at?: string
          search_tsv?: unknown
          source_hash: string
          source_key: string
          status?: string
          summary?: string | null
          title: string
          url: string
        }
        Update: {
          amount_max?: number | null
          amount_min?: number | null
          country?: string
          currency?: string | null
          deadline?: string | null
          first_seen_at?: string
          funder_id?: string
          id?: string
          language?: string
          last_seen_at?: string
          search_tsv?: unknown
          source_hash?: string
          source_key?: string
          status?: string
          summary?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "grants_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funders"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          client_id: string
          decided_at: string
          grant_id: string
          id: string
          relevance: number | null
          verdict: string
        }
        Insert: {
          client_id: string
          decided_at?: string
          grant_id: string
          id?: string
          relevance?: number | null
          verdict: string
        }
        Update: {
          client_id?: string
          decided_at?: string
          grant_id?: string
          id?: string
          relevance?: number | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      past_awards: {
        Row: {
          amount: number | null
          awarded_on: string | null
          funder_id: string | null
          grant_id: string | null
          id: string
          recipient_name: string
          source_hash: string
          source_key: string
        }
        Insert: {
          amount?: number | null
          awarded_on?: string | null
          funder_id?: string | null
          grant_id?: string | null
          id?: string
          recipient_name: string
          source_hash: string
          source_key: string
        }
        Update: {
          amount?: number | null
          awarded_on?: string | null
          funder_id?: string | null
          grant_id?: string | null
          id?: string
          recipient_name?: string
          source_hash?: string
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "past_awards_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "past_awards_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_sections: {
        Row: {
          content: string | null
          heading: string
          id: string
          proposal_id: string
          requirement_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          content?: string | null
          heading: string
          id?: string
          proposal_id: string
          requirement_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          content?: string | null
          heading?: string
          id?: string
          proposal_id?: string
          requirement_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_sections_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_sections_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client_id: string
          created_at: string
          grant_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          grant_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          grant_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      requirements: {
        Row: {
          detail: string | null
          grant_id: string
          id: string
          is_critical: boolean
          label: string
          sort_order: number
        }
        Insert: {
          detail?: string | null
          grant_id: string
          id?: string
          is_critical?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          detail?: string | null
          grant_id?: string
          id?: string
          is_critical?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "requirements_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      source_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          funders_upserted: number
          grants_upserted: number
          id: string
          source_key: string
          started_at: string
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          funders_upserted?: number
          grants_upserted?: number
          id?: string
          source_key: string
          started_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          funders_upserted?: number
          grants_upserted?: number
          id?: string
          source_key?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          confirmation_number: string | null
          human_reviewed_by: string
          id: string
          method: string | null
          outcome: string | null
          proposal_id: string
          submitted_at: string
        }
        Insert: {
          confirmation_number?: string | null
          human_reviewed_by: string
          id?: string
          method?: string | null
          outcome?: string | null
          proposal_id: string
          submitted_at?: string
        }
        Update: {
          confirmation_number?: string | null
          human_reviewed_by?: string
          id?: string
          method?: string | null
          outcome?: string | null
          proposal_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_human_reviewed_by_fkey"
            columns: ["human_reviewed_by"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      source_freshness: {
        Row: {
          failures_7d: number | null
          last_ok_at: string | null
          source_key: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ensure_consultant: { Args: never; Returns: undefined }
      owns_client: { Args: { target: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
