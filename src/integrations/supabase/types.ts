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
      agent_config_audit: {
        Row: {
          agent: string
          changed_at: string
          field: string
          id: string
          is_prompt: boolean
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
        }
        Insert: {
          agent: string
          changed_at?: string
          field: string
          id?: string
          is_prompt?: boolean
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Update: {
          agent?: string
          changed_at?: string
          field?: string
          id?: string
          is_prompt?: boolean
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_configs: {
        Row: {
          agent: string
          concurrency: number
          fallback_model: string | null
          json_mode: boolean
          max_output_tokens: number
          max_retries: number
          metadata: Json
          model: string
          prompt_version: string
          system_prompt: string | null
          temperature: number
          timeout_ms: number
          top_p: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent: string
          concurrency?: number
          fallback_model?: string | null
          json_mode?: boolean
          max_output_tokens?: number
          max_retries?: number
          metadata?: Json
          model?: string
          prompt_version?: string
          system_prompt?: string | null
          temperature?: number
          timeout_ms?: number
          top_p?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent?: string
          concurrency?: number
          fallback_model?: string | null
          json_mode?: boolean
          max_output_tokens?: number
          max_retries?: number
          metadata?: Json
          model?: string
          prompt_version?: string
          system_prompt?: string | null
          temperature?: number
          timeout_ms?: number
          top_p?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      agent_flags: {
        Row: {
          agent: string
          created_at: string
          description: string
          description_fr: string
          enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent: string
          created_at?: string
          description?: string
          description_fr?: string
          enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent?: string
          created_at?: string
          description?: string
          description_fr?: string
          enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent: string
          client_id: string | null
          cost_usd: number | null
          created_at: string
          error: string | null
          grant_id: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          metadata: Json
          model: string | null
          output_tokens: number | null
          provider: string | null
          run_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          agent: string
          client_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          grant_id?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          output_tokens?: number | null
          provider?: string | null
          run_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          agent?: string
          client_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          grant_id?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          output_tokens?: number | null
          provider?: string | null
          run_id?: string | null
          status?: string
          user_id?: string | null
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
      agent_trace_steps: {
        Row: {
          agent: string
          created_at: string
          duration_ms: number | null
          grant_id: string | null
          id: string
          message: string | null
          payload: Json | null
          run_id: string
          status: string
          step: string
        }
        Insert: {
          agent: string
          created_at?: string
          duration_ms?: number | null
          grant_id?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          run_id: string
          status?: string
          step: string
        }
        Update: {
          agent?: string
          created_at?: string
          duration_ms?: number | null
          grant_id?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          run_id?: string
          status?: string
          step?: string
        }
        Relationships: []
      }
      answer_library: {
        Row: {
          answer_en: string | null
          answer_fr: string | null
          archived_at: string | null
          client_id: string | null
          content: string | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          embedding: string | null
          evidence_notes: string | null
          id: string
          knowledge_chunk_id: string | null
          label: string
          last_used_at: string | null
          org_id: string | null
          question: string | null
          tags: string[]
          times_used: number
          updated_at: string
          updated_by: string | null
          use_count: number
          verified_at: string | null
        }
        Insert: {
          answer_en?: string | null
          answer_fr?: string | null
          archived_at?: string | null
          client_id?: string | null
          content?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          evidence_notes?: string | null
          id?: string
          knowledge_chunk_id?: string | null
          label: string
          last_used_at?: string | null
          org_id?: string | null
          question?: string | null
          tags?: string[]
          times_used?: number
          updated_at?: string
          updated_by?: string | null
          use_count?: number
          verified_at?: string | null
        }
        Update: {
          answer_en?: string | null
          answer_fr?: string | null
          archived_at?: string | null
          client_id?: string | null
          content?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          evidence_notes?: string | null
          id?: string
          knowledge_chunk_id?: string | null
          label?: string
          last_used_at?: string | null
          org_id?: string | null
          question?: string | null
          tags?: string[]
          times_used?: number
          updated_at?: string
          updated_by?: string | null
          use_count?: number
          verified_at?: string | null
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
      approval_instances: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          entity_id: string
          entity_type: string
          id: string
          status: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          entity_id: string
          entity_type: string
          id?: string
          status?: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          entity_id?: string
          entity_type?: string
          id?: string
          status?: string
          workflow_id?: string
        }
        Relationships: []
      }
      approval_steps: {
        Row: {
          approver_role: string
          comments: string | null
          created_at: string
          decided_at: string | null
          id: string
          name: string
          status: string
          step_order: number
          workflow_id: string
        }
        Insert: {
          approver_role: string
          comments?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          name: string
          status?: string
          step_order: number
          workflow_id: string
        }
        Update: {
          approver_role?: string
          comments?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          name?: string
          status?: string
          step_order?: number
          workflow_id?: string
        }
        Relationships: []
      }
      approval_workflows: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_trail: {
        Row: {
          action: string
          changes: Json
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          performed_by: string | null
        }
        Insert: {
          action: string
          changes?: Json
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          performed_by?: string | null
        }
        Update: {
          action?: string
          changes?: Json
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          performed_by?: string | null
        }
        Relationships: []
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
          lead_time_weeks: number | null
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
          lead_time_weeks?: number | null
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
          lead_time_weeks?: number | null
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
      client_team_members: {
        Row: {
          added_at: string
          added_by: string
          client_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          client_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          client_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_team_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_team_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "consultants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      competitive_grants: {
        Row: {
          agreement_end_date: string | null
          agreement_start_date: string | null
          agreement_title: string | null
          agreement_type: string | null
          agreement_value: number | null
          created_at: string | null
          data_source: string
          data_year: number
          department: string | null
          description: string | null
          external_id: string
          id: string
          naics_code: string | null
          program_name: string | null
          recipient_city: string | null
          recipient_legal_name: string | null
          recipient_name: string
          recipient_province: string | null
          recipient_type: string | null
          updated_at: string | null
        }
        Insert: {
          agreement_end_date?: string | null
          agreement_start_date?: string | null
          agreement_title?: string | null
          agreement_type?: string | null
          agreement_value?: number | null
          created_at?: string | null
          data_source?: string
          data_year?: number
          department?: string | null
          description?: string | null
          external_id: string
          id?: string
          naics_code?: string | null
          program_name?: string | null
          recipient_city?: string | null
          recipient_legal_name?: string | null
          recipient_name: string
          recipient_province?: string | null
          recipient_type?: string | null
          updated_at?: string | null
        }
        Update: {
          agreement_end_date?: string | null
          agreement_start_date?: string | null
          agreement_title?: string | null
          agreement_type?: string | null
          agreement_value?: number | null
          created_at?: string | null
          data_source?: string
          data_year?: number
          department?: string | null
          description?: string | null
          external_id?: string
          id?: string
          naics_code?: string | null
          program_name?: string | null
          recipient_city?: string | null
          recipient_legal_name?: string | null
          recipient_name?: string
          recipient_province?: string | null
          recipient_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      compliance_items: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          frequency: string
          id: string
          org_id: string | null
          status: string
          submission_id: string | null
          title: string
          type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          frequency?: string
          id?: string
          org_id?: string | null
          status?: string
          submission_id?: string | null
          title: string
          type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          frequency?: string
          id?: string
          org_id?: string | null
          status?: string
          submission_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      compliance_matrices: {
        Row: {
          checks: Json
          created_at: string | null
          id: string
          mandatory_met: number
          mandatory_total: number
          overall_score: number
          policy_alignment: Json
          proposal_id: string
          updated_at: string | null
        }
        Insert: {
          checks?: Json
          created_at?: string | null
          id?: string
          mandatory_met: number
          mandatory_total: number
          overall_score: number
          policy_alignment?: Json
          proposal_id: string
          updated_at?: string | null
        }
        Update: {
          checks?: Json
          created_at?: string | null
          id?: string
          mandatory_met?: number
          mandatory_total?: number
          overall_score?: number
          policy_alignment?: Json
          proposal_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      consent_ledger: {
        Row: {
          action: Database["public"]["Enums"]["consent_action"]
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at: string
          id: string
          ip_hash: string | null
          language: Database["public"]["Enums"]["app_lang"]
          metadata: Json
          policy_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["consent_action"]
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          id?: string
          ip_hash?: string | null
          language?: Database["public"]["Enums"]["app_lang"]
          metadata?: Json
          policy_version: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["consent_action"]
          consent_type?: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          id?: string
          ip_hash?: string | null
          language?: Database["public"]["Enums"]["app_lang"]
          metadata?: Json
          policy_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      crawl_ledger: {
        Row: {
          bytes: number | null
          change_count: number
          content_hash: string | null
          created_at: string
          error_count: number
          etag: string | null
          fetch_count: number
          funder_id: string | null
          host: string
          http_status: number | null
          interval_hours: number
          last_error: string | null
          last_fetched_at: string | null
          last_modified: string | null
          next_fetch_at: string
          status: string
          title: string | null
          updated_at: string
          url: string
          via: string | null
        }
        Insert: {
          bytes?: number | null
          change_count?: number
          content_hash?: string | null
          created_at?: string
          error_count?: number
          etag?: string | null
          fetch_count?: number
          funder_id?: string | null
          host: string
          http_status?: number | null
          interval_hours?: number
          last_error?: string | null
          last_fetched_at?: string | null
          last_modified?: string | null
          next_fetch_at?: string
          status?: string
          title?: string | null
          updated_at?: string
          url: string
          via?: string | null
        }
        Update: {
          bytes?: number | null
          change_count?: number
          content_hash?: string | null
          created_at?: string
          error_count?: number
          etag?: string | null
          fetch_count?: number
          funder_id?: string | null
          host?: string
          http_status?: number | null
          interval_hours?: number
          last_error?: string | null
          last_fetched_at?: string | null
          last_modified?: string | null
          next_fetch_at?: string
          status?: string
          title?: string | null
          updated_at?: string
          url?: string
          via?: string | null
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
          status: string
        }
        Insert: {
          detail: string
          id?: string
          is_hard_gate?: boolean
          match_id: string
          passed?: boolean
          rule_key: string
          status: string
        }
        Update: {
          detail?: string
          id?: string
          is_hard_gate?: boolean
          match_id?: string
          passed?: boolean
          rule_key?: string
          status?: string
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
      email_outbox: {
        Row: {
          body_html: string
          client_id: string | null
          created_at: string
          created_date: string
          error: string | null
          grant_id: string | null
          id: string
          kind: string
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string
          tenant_id: string | null
        }
        Insert: {
          body_html: string
          client_id?: string | null
          created_at?: string
          created_date?: string
          error?: string | null
          grant_id?: string | null
          id?: string
          kind: string
          recipient_email: string
          sent_at?: string | null
          status?: string
          subject: string
          tenant_id?: string | null
        }
        Update: {
          body_html?: string
          client_id?: string | null
          created_at?: string
          created_date?: string
          error?: string | null
          grant_id?: string | null
          id?: string
          kind?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      grant_search_feedback: {
        Row: {
          action: string
          created_at: string
          grant_id: string
          id: string
          note: string | null
          profile_id: string
          query_text: string | null
          rank_position: number | null
          reason: string | null
          score_snapshot: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          grant_id: string
          id?: string
          note?: string | null
          profile_id: string
          query_text?: string | null
          rank_position?: number | null
          reason?: string | null
          score_snapshot?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          grant_id?: string
          id?: string
          note?: string | null
          profile_id?: string
          query_text?: string | null
          rank_position?: number | null
          reason?: string | null
          score_snapshot?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grants: {
        Row: {
          amount_max: number | null
          amount_min: number | null
          assistance_listings: string[]
          country: string
          currency: string | null
          deadline: string | null
          eligibility_note: string | null
          eligible_applicant_types: string[]
          first_seen_at: string
          funder_id: string
          id: string
          language: string
          last_seen_at: string
          search_tsv: unknown
          search_tsv_ml: unknown
          source_hash: string
          source_key: string | null
          status: string
          summary: string | null
          title: string
          url: string
        }
        Insert: {
          amount_max?: number | null
          amount_min?: number | null
          assistance_listings?: string[]
          country: string
          currency?: string | null
          deadline?: string | null
          eligibility_note?: string | null
          eligible_applicant_types?: string[]
          first_seen_at?: string
          funder_id: string
          id?: string
          language?: string
          last_seen_at?: string
          search_tsv?: unknown
          search_tsv_ml?: unknown
          source_hash: string
          source_key?: string | null
          status?: string
          summary?: string | null
          title: string
          url: string
        }
        Update: {
          amount_max?: number | null
          amount_min?: number | null
          assistance_listings?: string[]
          country?: string
          currency?: string | null
          deadline?: string | null
          eligibility_note?: string | null
          eligible_applicant_types?: string[]
          first_seen_at?: string
          funder_id?: string
          id?: string
          language?: string
          last_seen_at?: string
          search_tsv?: unknown
          search_tsv_ml?: unknown
          source_hash?: string
          source_key?: string | null
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
          matched_at: string
          relevance: number | null
          retrieval: Json
          verdict: string
        }
        Insert: {
          client_id: string
          decided_at?: string
          grant_id: string
          id?: string
          matched_at?: string
          relevance?: number | null
          retrieval?: Json
          verdict: string
        }
        Update: {
          client_id?: string
          decided_at?: string
          grant_id?: string
          id?: string
          matched_at?: string
          relevance?: number | null
          retrieval?: Json
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
          assistance_listing: string | null
          awarded_on: string | null
          fetched_at: string
          funder_id: string | null
          grant_id: string | null
          id: string
          recipient_location: string | null
          recipient_name: string
          source_hash: string
          source_key: string
        }
        Insert: {
          amount?: number | null
          assistance_listing?: string | null
          awarded_on?: string | null
          fetched_at?: string
          funder_id?: string | null
          grant_id?: string | null
          id?: string
          recipient_location?: string | null
          recipient_name: string
          source_hash: string
          source_key: string
        }
        Update: {
          amount?: number | null
          assistance_listing?: string | null
          awarded_on?: string | null
          fetched_at?: string
          funder_id?: string | null
          grant_id?: string | null
          id?: string
          recipient_location?: string | null
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
      proposal_section_revisions: {
        Row: {
          content: string
          created_at: string
          drafted_by: string | null
          id: string
          proposal_id: string
          requirement_id: string | null
          word_count: number | null
        }
        Insert: {
          content: string
          created_at?: string
          drafted_by?: string | null
          id?: string
          proposal_id: string
          requirement_id?: string | null
          word_count?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          drafted_by?: string | null
          id?: string
          proposal_id?: string
          requirement_id?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_section_revisions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_section_revisions_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_sections: {
        Row: {
          content: string | null
          drafted_by: string | null
          fabrication_concerns: Json
          heading: string | null
          id: string
          proposal_id: string
          requirement_id: string | null
          reused_answer_ids: string[]
          sort_order: number
          updated_at: string
          word_count: number | null
        }
        Insert: {
          content?: string | null
          drafted_by?: string | null
          fabrication_concerns?: Json
          heading?: string | null
          id?: string
          proposal_id: string
          requirement_id?: string | null
          reused_answer_ids?: string[]
          sort_order?: number
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          content?: string | null
          drafted_by?: string | null
          fabrication_concerns?: Json
          heading?: string | null
          id?: string
          proposal_id?: string
          requirement_id?: string | null
          reused_answer_ids?: string[]
          sort_order?: number
          updated_at?: string
          word_count?: number | null
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
          client_id: string | null
          created_at: string
          grant_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          grant_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
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
      requirement_acknowledgements: {
        Row: {
          acknowledged_at: string
          acknowledged_by: string
          location: string | null
          proposal_id: string
          requirement_id: string
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_by: string
          location?: string | null
          proposal_id: string
          requirement_id: string
        }
        Update: {
          acknowledged_at?: string
          acknowledged_by?: string
          location?: string | null
          proposal_id?: string
          requirement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_acknowledgements_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_acknowledgements_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_acknowledgements_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_assessments: {
        Row: {
          assessed_at: string
          assessment: string
          model: string
          proposal_id: string
          requirement_id: string
        }
        Insert: {
          assessed_at?: string
          assessment: string
          model: string
          proposal_id: string
          requirement_id: string
        }
        Update: {
          assessed_at?: string
          assessment?: string
          model?: string
          proposal_id?: string
          requirement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_assessments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_assessments_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      requirements: {
        Row: {
          detail: string | null
          evaluation_note: string | null
          extracted_at: string | null
          extracted_from: string | null
          grant_id: string
          id: string
          is_critical: boolean
          kind: string
          label: string
          sort_order: number
          source_quote: string | null
          word_limit: number | null
        }
        Insert: {
          detail?: string | null
          evaluation_note?: string | null
          extracted_at?: string | null
          extracted_from?: string | null
          grant_id: string
          id?: string
          is_critical?: boolean
          kind?: string
          label: string
          sort_order?: number
          source_quote?: string | null
          word_limit?: number | null
        }
        Update: {
          detail?: string | null
          evaluation_note?: string | null
          extracted_at?: string | null
          extracted_from?: string | null
          grant_id?: string
          id?: string
          is_critical?: boolean
          kind?: string
          label?: string
          sort_order?: number
          source_quote?: string | null
          word_limit?: number | null
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
          human_reviewed_by: string | null
          id: string
          method: string | null
          notes: string | null
          outcome: string | null
          overridden_blockers: Json
          proposal_id: string
          submitted_at: string
        }
        Insert: {
          confirmation_number?: string | null
          human_reviewed_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          outcome?: string | null
          overridden_blockers?: Json
          proposal_id: string
          submitted_at?: string
        }
        Update: {
          confirmation_number?: string | null
          human_reviewed_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          outcome?: string | null
          overridden_blockers?: Json
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
      tenant_members: {
        Row: {
          joined_at: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          branding: Json
          created_at: string
          id: string
          name: string
          slug: string
          subdomain: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          id?: string
          name: string
          slug: string
          subdomain: string
        }
        Update: {
          branding?: Json
          created_at?: string
          id?: string
          name?: string
          slug?: string
          subdomain?: string
        }
        Relationships: []
      }
    }
    Views: {
      agent_runs_daily: {
        Row: {
          agent: string | null
          cost_usd: number | null
          day: string | null
          degraded_runs: number | null
          error_runs: number | null
          input_tokens: number | null
          ok_runs: number | null
          output_tokens: number | null
          p50_ms: number | null
          p95_ms: number | null
          runs: number | null
        }
        Relationships: []
      }
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
      auto_promote_stale_candidates: {
        Args: never
        Returns: {
          name: string
          promoted_id: string
        }[]
      }
      belongs_to_tenant: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      bump_proposal_version: {
        Args: { target_proposal_id: string }
        Returns: number
      }
      can_access_tenant_entity: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: boolean
      }
      ensure_consultant: { Args: never; Returns: undefined }
      find_consultant_by_email: {
        Args: { target_email: string }
        Returns: string
      }
      get_tenant_id_by_slug: { Args: { target_slug: string }; Returns: string }
      grant_text_config: { Args: { lang: string }; Returns: unknown }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      match_answers: {
        Args: {
          max_results?: number
          min_similarity?: number
          q_embedding: string
          target_client: string
        }
        Returns: {
          content: string
          id: string
          label: string
          similarity: number
        }[]
      }
      match_grant_search_documents:
        | {
            Args: { match_count?: number; match_threshold?: number }
            Returns: {
              grant_id: string
              semantic_similarity: number
            }[]
          }
        | {
            Args: {
              match_count?: number
              match_threshold?: number
              query_embedding: string
            }
            Returns: {
              grant_id: string
              semantic_similarity: number
            }[]
          }
      match_knowledge_chunks: {
        Args: {
          match_count?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          language: Database["public"]["Enums"]["app_lang"]
          similarity: number
          source: string
        }[]
      }
      normalize_title_v2: { Args: { t: string }; Returns: string }
      owns_client: { Args: { target: string }; Returns: boolean }
      record_answer_use: { Args: { answer_ids: string[] }; Returns: undefined }
      record_crawl_fetch: {
        Args: {
          p_bytes: number
          p_content_hash: string
          p_default_interval: number
          p_error_reason: string
          p_etag: string
          p_funder_id: string
          p_host: string
          p_http_status: number
          p_last_modified: string
          p_outcome_kind: string
          p_title: string
          p_url: string
          p_via: string
        }
        Returns: {
          changed: boolean
          content_hash: string
          interval_hours: number
          next_fetch_at: string
          status: string
        }[]
      }
      record_grant_search_feedback: {
        Args: {
          p_action: string
          p_grant_id: string
          p_note?: string
          p_profile_id: string
          p_query_text?: string
          p_rank_position?: number
          p_reason?: string
          p_score_snapshot?: Json
        }
        Returns: {
          action: string
          created_at: string
          grant_id: string
          id: string
          note: string | null
          profile_id: string
          query_text: string | null
          rank_position: number | null
          reason: string | null
          score_snapshot: Json
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "grant_search_feedback"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_extracted_requirements: {
        Args: { target_grant: string }
        Returns: number
      }
      replace_matches: {
        Args: { match_rows: Json; matched_at: string; target_client: string }
        Returns: undefined
      }
      search_funder_catalog: {
        Args: { result_limit?: number; search_query: string }
        Returns: {
          funder_id: string
          matched_on: string
          relevance: number
        }[]
      }
      search_grant_catalog: {
        Args: { result_limit?: number; search_query: string }
        Returns: {
          grant_id: string
          matched_on: string
          relevance: number
        }[]
      }
      search_grants: {
        Args: {
          countries?: string[]
          pool?: number
          q: string
          q_embedding: string
          q_language?: string
          result_limit?: number
        }
        Returns: {
          grant_id: string
          lexical_rank: number
          score: number
          vector_rank: number
        }[]
      }
      search_term_matches: {
        Args: { haystack: string; needle: string }
        Returns: boolean
      }
    }
    Enums: {
      agent_name:
        | "discoverer"
        | "enricher"
        | "evaluator"
        | "strategist"
        | "writer"
        | "critic"
      agent_status: "running" | "succeeded" | "failed" | "degraded"
      app_lang: "en" | "fr"
      app_role: "admin" | "member" | "viewer"
      consent_action: "granted" | "revoked"
      consent_type:
        | "terms_of_service"
        | "privacy_policy"
        | "ai_processing"
        | "cross_border_transfer"
        | "marketing"
      dsar_kind: "access" | "export" | "delete" | "rectify"
      dsar_status: "pending" | "processing" | "completed" | "rejected"
      funder_source_type: "rss" | "api" | "html" | "manual"
      grant_status:
        | "discovered"
        | "enriched"
        | "scored"
        | "shortlisted"
        | "in_proposal"
        | "submitted"
        | "won"
        | "lost"
        | "expired"
        | "archived"
      org_stage: "startup" | "sme" | "nonprofit" | "research" | "public_sector"
      proposal_status:
        | "draft"
        | "in_review"
        | "submitted"
        | "accepted"
        | "rejected"
        | "withdrawn"
      section_kind:
        | "summary"
        | "problem"
        | "solution"
        | "impact"
        | "budget"
        | "team"
        | "timeline"
        | "sustainability"
        | "evaluation"
        | "other"
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
    Enums: {
      agent_name: [
        "discoverer",
        "enricher",
        "evaluator",
        "strategist",
        "writer",
        "critic",
      ],
      agent_status: ["running", "succeeded", "failed", "degraded"],
      app_lang: ["en", "fr"],
      app_role: ["admin", "member", "viewer"],
      consent_action: ["granted", "revoked"],
      consent_type: [
        "terms_of_service",
        "privacy_policy",
        "ai_processing",
        "cross_border_transfer",
        "marketing",
      ],
      dsar_kind: ["access", "export", "delete", "rectify"],
      dsar_status: ["pending", "processing", "completed", "rejected"],
      funder_source_type: ["rss", "api", "html", "manual"],
      grant_status: [
        "discovered",
        "enriched",
        "scored",
        "shortlisted",
        "in_proposal",
        "submitted",
        "won",
        "lost",
        "expired",
        "archived",
      ],
      org_stage: ["startup", "sme", "nonprofit", "research", "public_sector"],
      proposal_status: [
        "draft",
        "in_review",
        "submitted",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      section_kind: [
        "summary",
        "problem",
        "solution",
        "impact",
        "budget",
        "team",
        "timeline",
        "sustainability",
        "evaluation",
        "other",
      ],
    },
  },
} as const
