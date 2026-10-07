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
          {
            foreignKeyName: "agent_runs_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
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
        Relationships: [
          {
            foreignKeyName: "agent_trace_steps_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "answer_library_knowledge_chunk_id_fkey"
            columns: ["knowledge_chunk_id"]
            isOneToOne: true
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_library_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
        Relationships: [
          {
            foreignKeyName: "approval_instances_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "approval_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "compliance_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_items_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "compliance_matrices_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "crawl_ledger_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funder_source_yield"
            referencedColumns: ["funder_id"]
          },
          {
            foreignKeyName: "crawl_ledger_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funders"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_config: {
        Row: {
          candidate_auto_approve_threshold: number
          candidate_review_min_threshold: number
          extra_non_grant_url_patterns: string[]
          extra_non_program_keywords: string[]
          extra_program_hint_keywords: string[]
          extra_root_index_paths: string[]
          extra_rss_feeds: Json
          fallback_max_links: number
          firecrawl_search_query: string
          funder_scout_queries: string[]
          is_singleton: boolean
          max_pages_per_run: number
          scrape_concurrency: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          candidate_auto_approve_threshold?: number
          candidate_review_min_threshold?: number
          extra_non_grant_url_patterns?: string[]
          extra_non_program_keywords?: string[]
          extra_program_hint_keywords?: string[]
          extra_root_index_paths?: string[]
          extra_rss_feeds?: Json
          fallback_max_links?: number
          firecrawl_search_query?: string
          funder_scout_queries?: string[]
          is_singleton?: boolean
          max_pages_per_run?: number
          scrape_concurrency?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          candidate_auto_approve_threshold?: number
          candidate_review_min_threshold?: number
          extra_non_grant_url_patterns?: string[]
          extra_non_program_keywords?: string[]
          extra_program_hint_keywords?: string[]
          extra_root_index_paths?: string[]
          extra_rss_feeds?: Json
          fallback_max_links?: number
          firecrawl_search_query?: string
          funder_scout_queries?: string[]
          is_singleton?: boolean
          max_pages_per_run?: number
          scrape_concurrency?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      discovery_registration_gates: {
        Row: {
          first_detected_at: string
          funder_id: string | null
          id: string
          last_detected_at: string
          reason: string
          resolved_at: string | null
          resolved_note: string | null
          snippet: string | null
          status: string
          times_seen: number
          url: string
        }
        Insert: {
          first_detected_at?: string
          funder_id?: string | null
          id?: string
          last_detected_at?: string
          reason: string
          resolved_at?: string | null
          resolved_note?: string | null
          snippet?: string | null
          status?: string
          times_seen?: number
          url: string
        }
        Update: {
          first_detected_at?: string
          funder_id?: string | null
          id?: string
          last_detected_at?: string
          reason?: string
          resolved_at?: string | null
          resolved_note?: string | null
          snippet?: string | null
          status?: string
          times_seen?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_registration_gates_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funder_source_yield"
            referencedColumns: ["funder_id"]
          },
          {
            foreignKeyName: "discovery_registration_gates_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funders"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_sources: {
        Row: {
          content_hash: string | null
          created_at: string
          etag: string | null
          first_seen_at: string
          funder_id: string
          grants_found: number
          grants_inserted: number
          http_status: number | null
          id: string
          last_fetched_at: string
          last_modified: string | null
          parent_url: string | null
          text_length: number | null
          times_seen: number
          updated_at: string
          url: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          etag?: string | null
          first_seen_at?: string
          funder_id: string
          grants_found?: number
          grants_inserted?: number
          http_status?: number | null
          id?: string
          last_fetched_at?: string
          last_modified?: string | null
          parent_url?: string | null
          text_length?: number | null
          times_seen?: number
          updated_at?: string
          url: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          etag?: string | null
          first_seen_at?: string
          funder_id?: string
          grants_found?: number
          grants_inserted?: number
          http_status?: number | null
          id?: string
          last_fetched_at?: string
          last_modified?: string | null
          parent_url?: string | null
          text_length?: number | null
          times_seen?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_sources_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funder_source_yield"
            referencedColumns: ["funder_id"]
          },
          {
            foreignKeyName: "discovery_sources_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funders"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_sources_registry: {
        Row: {
          auto_approved_30d: number
          cadence_cron: string | null
          candidates_30d: number
          coverage_dimensions: string[]
          created_at: string
          dataset_key: string
          enabled: boolean
          expected_refresh_hours: number
          format: string
          id: string
          label: string
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          notes: string | null
          owner_label: string
          recovery_playbook: string
          rows_30d: number
          source_url: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          auto_approved_30d?: number
          cadence_cron?: string | null
          candidates_30d?: number
          coverage_dimensions?: string[]
          created_at?: string
          dataset_key: string
          enabled?: boolean
          expected_refresh_hours: number
          format: string
          id?: string
          label: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          notes?: string | null
          owner_label: string
          recovery_playbook: string
          rows_30d?: number
          source_url?: string | null
          tier: string
          updated_at?: string
        }
        Update: {
          auto_approved_30d?: number
          cadence_cron?: string | null
          candidates_30d?: number
          coverage_dimensions?: string[]
          created_at?: string
          dataset_key?: string
          enabled?: boolean
          expected_refresh_hours?: number
          format?: string
          id?: string
          label?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          notes?: string | null
          owner_label?: string
          recovery_playbook?: string
          rows_30d?: number
          source_url?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      dsar_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["dsar_kind"]
          notes: string | null
          reason: string | null
          result_url: string | null
          status: Database["public"]["Enums"]["dsar_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["dsar_kind"]
          notes?: string | null
          reason?: string | null
          result_url?: string | null
          status?: Database["public"]["Enums"]["dsar_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["dsar_kind"]
          notes?: string | null
          reason?: string | null
          result_url?: string | null
          status?: Database["public"]["Enums"]["dsar_status"]
          updated_at?: string
          user_id?: string
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
      evidence_spans: {
        Row: {
          agent: string
          confidence: number
          created_at: string
          extraction_method: string
          field: string
          grant_id: string
          id: string
          model: string | null
          run_id: string | null
          snippet: string
          snippet_offset: number | null
          source_hash: string | null
          source_url: string
          value: Json | null
        }
        Insert: {
          agent: string
          confidence?: number
          created_at?: string
          extraction_method: string
          field: string
          grant_id: string
          id?: string
          model?: string | null
          run_id?: string | null
          snippet: string
          snippet_offset?: number | null
          source_hash?: string | null
          source_url: string
          value?: Json | null
        }
        Update: {
          agent?: string
          confidence?: number
          created_at?: string
          extraction_method?: string
          field?: string
          grant_id?: string
          id?: string
          model?: string | null
          run_id?: string | null
          snippet?: string
          snippet_offset?: number | null
          source_hash?: string | null
          source_url?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_spans_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      fit_rules: {
        Row: {
          applicant_types_allowed: string[]
          applicant_types_excluded: string[]
          auto_archive_on_fail: boolean
          created_at: string
          excluded_jurisdictions: string[]
          excluded_keywords: string[]
          excluded_sectors: string[]
          hard_fail_on_amount: boolean
          hard_fail_on_applicant_type: boolean
          hard_fail_on_capability: boolean
          hard_fail_on_deadline: boolean
          hard_fail_on_excluded_keyword: boolean
          hard_fail_on_jurisdiction: boolean
          hard_fail_on_runway: boolean
          id: string
          iial_capabilities: string[]
          lead_min_weeks: number | null
          max_amount_cad: number | null
          max_cost_share_pct_org_carries: number | null
          min_amount_cad: number | null
          min_days_to_deadline: number | null
          org_id: string | null
          partner_min_weeks: number | null
          require_match_verification: boolean
          required_jurisdictions: string[]
          required_keywords: string[]
          required_sectors: string[]
          rolling_intake_passes_runway: boolean
          threshold_fit_pass: number
          updated_at: string
          user_id: string | null
          weight_llm: number
        }
        Insert: {
          applicant_types_allowed?: string[]
          applicant_types_excluded?: string[]
          auto_archive_on_fail?: boolean
          created_at?: string
          excluded_jurisdictions?: string[]
          excluded_keywords?: string[]
          excluded_sectors?: string[]
          hard_fail_on_amount?: boolean
          hard_fail_on_applicant_type?: boolean
          hard_fail_on_capability?: boolean
          hard_fail_on_deadline?: boolean
          hard_fail_on_excluded_keyword?: boolean
          hard_fail_on_jurisdiction?: boolean
          hard_fail_on_runway?: boolean
          id?: string
          iial_capabilities?: string[]
          lead_min_weeks?: number | null
          max_amount_cad?: number | null
          max_cost_share_pct_org_carries?: number | null
          min_amount_cad?: number | null
          min_days_to_deadline?: number | null
          org_id?: string | null
          partner_min_weeks?: number | null
          require_match_verification?: boolean
          required_jurisdictions?: string[]
          required_keywords?: string[]
          required_sectors?: string[]
          rolling_intake_passes_runway?: boolean
          threshold_fit_pass?: number
          updated_at?: string
          user_id?: string | null
          weight_llm?: number
        }
        Update: {
          applicant_types_allowed?: string[]
          applicant_types_excluded?: string[]
          auto_archive_on_fail?: boolean
          created_at?: string
          excluded_jurisdictions?: string[]
          excluded_keywords?: string[]
          excluded_sectors?: string[]
          hard_fail_on_amount?: boolean
          hard_fail_on_applicant_type?: boolean
          hard_fail_on_capability?: boolean
          hard_fail_on_deadline?: boolean
          hard_fail_on_excluded_keyword?: boolean
          hard_fail_on_jurisdiction?: boolean
          hard_fail_on_runway?: boolean
          id?: string
          iial_capabilities?: string[]
          lead_min_weeks?: number | null
          max_amount_cad?: number | null
          max_cost_share_pct_org_carries?: number | null
          min_amount_cad?: number | null
          min_days_to_deadline?: number | null
          org_id?: string | null
          partner_min_weeks?: number | null
          require_match_verification?: boolean
          required_jurisdictions?: string[]
          required_keywords?: string[]
          required_sectors?: string[]
          rolling_intake_passes_runway?: boolean
          threshold_fit_pass?: number
          updated_at?: string
          user_id?: string | null
          weight_llm?: number
        }
        Relationships: [
          {
            foreignKeyName: "fit_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      funder_candidates: {
        Row: {
          bn_number: string | null
          disbursed_annual: number | null
          discovered_at: string
          funder_type: string | null
          id: string
          name: string
          name_fr: string | null
          province: string | null
          raw_metadata: Json
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          source_signals: string[]
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          bn_number?: string | null
          disbursed_annual?: number | null
          discovered_at?: string
          funder_type?: string | null
          id?: string
          name: string
          name_fr?: string | null
          province?: string | null
          raw_metadata?: Json
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          source_signals?: string[]
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          bn_number?: string | null
          disbursed_annual?: number | null
          discovered_at?: string
          funder_type?: string | null
          id?: string
          name?: string
          name_fr?: string | null
          province?: string | null
          raw_metadata?: Json
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          source_signals?: string[]
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      funders: {
        Row: {
          accounting_period_end: string | null
          active: boolean
          address: string | null
          admin_expenditures: number | null
          bn_number: string | null
          category: string | null
          charitable_programs: Json | null
          charity_status: string | null
          city: string | null
          country: string
          created_at: string
          data_source: string | null
          data_year: number | null
          designation: string | null
          directors: Json | null
          disbursed_annual: number | null
          effective_date: string | null
          email: string | null
          external_id: string | null
          fundraising_expenditures: number | null
          giving_history: Json | null
          id: string
          jurisdiction: string | null
          language: string | null
          last_content_hash: string | null
          last_discovered_at: string | null
          legal_name: string | null
          name: string
          name_fr: string | null
          org_id: string | null
          postal_code: string | null
          program_expenditures: number | null
          province: string | null
          source_key: string | null
          source_type: Database["public"]["Enums"]["funder_source_type"]
          source_url: string | null
          source_urls: string[]
          telephone: string | null
          total_expenditures: number | null
          total_revenue: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          accounting_period_end?: string | null
          active?: boolean
          address?: string | null
          admin_expenditures?: number | null
          bn_number?: string | null
          category?: string | null
          charitable_programs?: Json | null
          charity_status?: string | null
          city?: string | null
          country: string
          created_at?: string
          data_source?: string | null
          data_year?: number | null
          designation?: string | null
          directors?: Json | null
          disbursed_annual?: number | null
          effective_date?: string | null
          email?: string | null
          external_id?: string | null
          fundraising_expenditures?: number | null
          giving_history?: Json | null
          id?: string
          jurisdiction?: string | null
          language?: string | null
          last_content_hash?: string | null
          last_discovered_at?: string | null
          legal_name?: string | null
          name: string
          name_fr?: string | null
          org_id?: string | null
          postal_code?: string | null
          program_expenditures?: number | null
          province?: string | null
          source_key?: string | null
          source_type?: Database["public"]["Enums"]["funder_source_type"]
          source_url?: string | null
          source_urls?: string[]
          telephone?: string | null
          total_expenditures?: number | null
          total_revenue?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          accounting_period_end?: string | null
          active?: boolean
          address?: string | null
          admin_expenditures?: number | null
          bn_number?: string | null
          category?: string | null
          charitable_programs?: Json | null
          charity_status?: string | null
          city?: string | null
          country?: string
          created_at?: string
          data_source?: string | null
          data_year?: number | null
          designation?: string | null
          directors?: Json | null
          disbursed_annual?: number | null
          effective_date?: string | null
          email?: string | null
          external_id?: string | null
          fundraising_expenditures?: number | null
          giving_history?: Json | null
          id?: string
          jurisdiction?: string | null
          language?: string | null
          last_content_hash?: string | null
          last_discovered_at?: string | null
          legal_name?: string | null
          name?: string
          name_fr?: string | null
          org_id?: string | null
          postal_code?: string | null
          program_expenditures?: number | null
          province?: string | null
          source_key?: string | null
          source_type?: Database["public"]["Enums"]["funder_source_type"]
          source_url?: string | null
          source_urls?: string[]
          telephone?: string | null
          total_expenditures?: number | null
          total_revenue?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_copilot_messages: {
        Row: {
          actions: Json | null
          content: string
          created_at: string
          grant_id: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          actions?: Json | null
          content: string
          created_at?: string
          grant_id: string
          id?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          actions?: Json | null
          content?: string
          created_at?: string
          grant_id?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_copilot_messages_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_copilot_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_deadline_observations: {
        Row: {
          evidence_span_id: string | null
          grant_id: string
          id: string
          observed_at: string
          observed_deadline: string
          source_url: string
        }
        Insert: {
          evidence_span_id?: string | null
          grant_id: string
          id?: string
          observed_at?: string
          observed_deadline: string
          source_url: string
        }
        Update: {
          evidence_span_id?: string | null
          grant_id?: string
          id?: string
          observed_at?: string
          observed_deadline?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_deadline_observations_evidence_span_id_fkey"
            columns: ["evidence_span_id"]
            isOneToOne: false
            referencedRelation: "evidence_spans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_deadline_observations_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_dismissals: {
        Row: {
          created_at: string
          grant_id: string
          note: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grant_id: string
          note?: string | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          grant_id?: string
          note?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_dismissals_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
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
      grant_evaluations: {
        Row: {
          axis_breakdown: Json | null
          created_at: string
          eligibility_pass: boolean
          evaluated_at: string
          fit_score: number
          grant_id: string
          id: string
          llm_fit_score: number | null
          model: string
          org_id: string | null
          prompt_version: string
          rationale_en: string
          rationale_fr: string | null
          rule_snapshot: Json | null
          run_id: string | null
          user_id: string
        }
        Insert: {
          axis_breakdown?: Json | null
          created_at?: string
          eligibility_pass?: boolean
          evaluated_at?: string
          fit_score: number
          grant_id: string
          id?: string
          llm_fit_score?: number | null
          model: string
          org_id?: string | null
          prompt_version: string
          rationale_en: string
          rationale_fr?: string | null
          rule_snapshot?: Json | null
          run_id?: string | null
          user_id: string
        }
        Update: {
          axis_breakdown?: Json | null
          created_at?: string
          eligibility_pass?: boolean
          evaluated_at?: string
          fit_score?: number
          grant_id?: string
          id?: string
          llm_fit_score?: number | null
          model?: string
          org_id?: string | null
          prompt_version?: string
          rationale_en?: string
          rationale_fr?: string | null
          rule_snapshot?: Json | null
          run_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_evaluations_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_evaluations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_events: {
        Row: {
          actor_agent: string | null
          actor_user_id: string | null
          created_at: string
          from_status: string | null
          grant_id: string
          id: string
          metadata: Json
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_agent?: string | null
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          grant_id: string
          id?: string
          metadata?: Json
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_agent?: string | null
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          grant_id?: string
          id?: string
          metadata?: Json
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_events_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_review_jobs: {
        Row: {
          blocked_items: number
          completed_at: string | null
          completed_items: number
          created_at: string
          criteria_version: string
          failed_items: number
          id: string
          lock_token: string | null
          locked_until: string | null
          org_id: string
          pause_reason: string | null
          requested_by: string
          started_at: string | null
          status: string
          total_items: number
          updated_at: string
        }
        Insert: {
          blocked_items?: number
          completed_at?: string | null
          completed_items?: number
          created_at?: string
          criteria_version?: string
          failed_items?: number
          id?: string
          lock_token?: string | null
          locked_until?: string | null
          org_id: string
          pause_reason?: string | null
          requested_by: string
          started_at?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Update: {
          blocked_items?: number
          completed_at?: string | null
          completed_items?: number
          created_at?: string
          criteria_version?: string
          failed_items?: number
          id?: string
          lock_token?: string | null
          locked_until?: string | null
          org_id?: string
          pause_reason?: string | null
          requested_by?: string
          started_at?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_review_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_review_overrides: {
        Row: {
          action: string
          created_at: string
          created_by: string
          evidence_url: string | null
          grant_id: string
          id: string
          issue_key: string
          justification: string
          org_id: string
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by: string
          evidence_url?: string | null
          grant_id: string
          id?: string
          issue_key: string
          justification: string
          org_id: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string
          evidence_url?: string | null
          grant_id?: string
          id?: string
          issue_key?: string
          justification?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_review_overrides_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_review_overrides_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_review_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          grant_id: string
          id: string
          job_id: string
          last_error: string | null
          lock_token: string | null
          locked_until: string | null
          next_attempt_at: string
          priority: number
          stage: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          grant_id: string
          id?: string
          job_id: string
          last_error?: string | null
          lock_token?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          priority?: number
          stage?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          grant_id?: string
          id?: string
          job_id?: string
          last_error?: string | null
          lock_token?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          priority?: number
          stage?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_review_queue_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_review_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "grant_review_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_review_states: {
        Row: {
          coverage_pct: number
          created_at: string
          criteria_version: string
          critical_issues: Json
          evaluated_at: string | null
          evidence_count: number
          grant_id: string
          id: string
          last_error: string | null
          missing_fields: Json
          next_action: string | null
          org_id: string
          requirement_count: number
          source_checked_at: string | null
          stages: Json
          status: string
          updated_at: string
        }
        Insert: {
          coverage_pct?: number
          created_at?: string
          criteria_version?: string
          critical_issues?: Json
          evaluated_at?: string | null
          evidence_count?: number
          grant_id: string
          id?: string
          last_error?: string | null
          missing_fields?: Json
          next_action?: string | null
          org_id: string
          requirement_count?: number
          source_checked_at?: string | null
          stages?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          coverage_pct?: number
          created_at?: string
          criteria_version?: string
          critical_issues?: Json
          evaluated_at?: string | null
          evidence_count?: number
          grant_id?: string
          id?: string
          last_error?: string | null
          missing_fields?: Json
          next_action?: string | null
          org_id?: string
          requirement_count?: number
          source_checked_at?: string | null
          stages?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_review_states_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_review_states_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_search_benchmark_runs: {
        Row: {
          coverage: Json
          created_at: string
          generated_at: string
          id: string
          k: number
          ranking_version: string
          stale_case_ids: string[]
          summary: Json
          thresholds_passed: boolean
        }
        Insert: {
          coverage: Json
          created_at?: string
          generated_at: string
          id?: string
          k: number
          ranking_version: string
          stale_case_ids?: string[]
          summary: Json
          thresholds_passed: boolean
        }
        Update: {
          coverage?: Json
          created_at?: string
          generated_at?: string
          id?: string
          k?: number
          ranking_version?: string
          stale_case_ids?: string[]
          summary?: Json
          thresholds_passed?: boolean
        }
        Relationships: []
      }
      grant_search_documents: {
        Row: {
          content_en: string
          content_fr: string
          content_hash: string
          embedded_at: string | null
          embedding: string | null
          embedding_model: string | null
          grant_id: string
          updated_at: string
        }
        Insert: {
          content_en: string
          content_fr?: string
          content_hash: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          grant_id: string
          updated_at?: string
        }
        Update: {
          content_en?: string
          content_fr?: string
          content_hash?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          grant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_search_documents_grant_id_fkey"
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
        Relationships: [
          {
            foreignKeyName: "grant_search_feedback_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_search_feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "grant_search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_search_feedback_events: {
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
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_search_feedback_events_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_search_feedback_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "grant_search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_search_profiles: {
        Row: {
          active: boolean
          activities: string[]
          amount_max_cad: number | null
          amount_min_cad: number | null
          applicant_types: string[]
          created_at: string
          excluded_terms: string[]
          funding_uses: string[]
          id: string
          jurisdictions: string[]
          last_reviewed_at: string | null
          mission: string
          name: string
          org_id: string | null
          peer_organizations: string[]
          populations_served: string[]
          project_end: string | null
          project_start: string | null
          required_terms: string[]
          role: string
          sectors: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          activities?: string[]
          amount_max_cad?: number | null
          amount_min_cad?: number | null
          applicant_types?: string[]
          created_at?: string
          excluded_terms?: string[]
          funding_uses?: string[]
          id?: string
          jurisdictions?: string[]
          last_reviewed_at?: string | null
          mission?: string
          name: string
          org_id?: string | null
          peer_organizations?: string[]
          populations_served?: string[]
          project_end?: string | null
          project_start?: string | null
          required_terms?: string[]
          role?: string
          sectors?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          activities?: string[]
          amount_max_cad?: number | null
          amount_min_cad?: number | null
          applicant_types?: string[]
          created_at?: string
          excluded_terms?: string[]
          funding_uses?: string[]
          id?: string
          jurisdictions?: string[]
          last_reviewed_at?: string | null
          mission?: string
          name?: string
          org_id?: string | null
          peer_organizations?: string[]
          populations_served?: string[]
          project_end?: string | null
          project_start?: string | null
          required_terms?: string[]
          role?: string
          sectors?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_search_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_search_runs: {
        Row: {
          candidate_counts: Json
          created_at: string
          degraded_reason: string | null
          embedding_model: string | null
          filters: Json
          fusion_weights: Json
          id: string
          index_version: string
          latency_ms: number
          org_id: string | null
          profile_id: string | null
          query_text: string
          ranking_version: string
          result_snapshot: Json
          retrieval_mode: string
          taxonomy_version: string
          user_id: string
        }
        Insert: {
          candidate_counts?: Json
          created_at?: string
          degraded_reason?: string | null
          embedding_model?: string | null
          filters?: Json
          fusion_weights?: Json
          id?: string
          index_version: string
          latency_ms: number
          org_id?: string | null
          profile_id?: string | null
          query_text: string
          ranking_version: string
          result_snapshot?: Json
          retrieval_mode: string
          taxonomy_version: string
          user_id: string
        }
        Update: {
          candidate_counts?: Json
          created_at?: string
          degraded_reason?: string | null
          embedding_model?: string | null
          filters?: Json
          fusion_weights?: Json
          id?: string
          index_version?: string
          latency_ms?: number
          org_id?: string | null
          profile_id?: string | null
          query_text?: string
          ranking_version?: string
          result_snapshot?: Json
          retrieval_mode?: string
          taxonomy_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_search_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_search_runs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "grant_search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_search_runtime_config: {
        Row: {
          hybrid_enabled: boolean
          is_singleton: boolean
          ranking_version: string
          shadow_mode: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          hybrid_enabled?: boolean
          is_singleton?: boolean
          ranking_version?: string
          shadow_mode?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          hybrid_enabled?: boolean
          is_singleton?: boolean
          ranking_version?: string
          shadow_mode?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      grants: {
        Row: {
          amount_cad_max: number | null
          amount_cad_min: number | null
          amount_max: number | null
          amount_min: number | null
          applicant_types: string[] | null
          assistance_listings: string[]
          canonical_key: string | null
          confirmed_source_urls: Json | null
          country: string
          created_at: string
          currency: string | null
          deadline: string | null
          deadline_confidence: number | null
          deadline_kind: string | null
          discovered_at: string
          eligibility: Json
          eligibility_note: string | null
          eligible_applicant_types: string[]
          enrich_attempts: number
          enrich_last_attempt_at: string | null
          enrich_last_error: string | null
          enriched_at: string | null
          field_search_status: Json
          first_seen_at: string
          fit_score: number | null
          funder_id: string
          funder_type: string | null
          funding_uses: string[] | null
          historical_awards: Json | null
          id: string
          language: string
          last_seen_at: string
          manual_fields: Json
          next_expected_deadline: string | null
          next_expected_deadline_basis: string | null
          next_expected_deadline_confidence: number | null
          next_expected_open: string | null
          org_id: string | null
          populations_served: string[] | null
          requirements: Json | null
          scored_at: string | null
          search_tsv: unknown
          search_tsv_ml: unknown
          sectors: string[]
          source_confidence: number | null
          source_freshness_at: string | null
          source_hash: string
          source_key: string | null
          status: string
          summary: string | null
          summary_fr: string | null
          times_seen: number
          title: string
          title_fr: string | null
          updated_at: string
          url: string
        }
        Insert: {
          amount_cad_max?: number | null
          amount_cad_min?: number | null
          amount_max?: number | null
          amount_min?: number | null
          applicant_types?: string[] | null
          assistance_listings?: string[]
          canonical_key?: string | null
          confirmed_source_urls?: Json | null
          country: string
          created_at?: string
          currency?: string | null
          deadline?: string | null
          deadline_confidence?: number | null
          deadline_kind?: string | null
          discovered_at?: string
          eligibility?: Json
          eligibility_note?: string | null
          eligible_applicant_types?: string[]
          enrich_attempts?: number
          enrich_last_attempt_at?: string | null
          enrich_last_error?: string | null
          enriched_at?: string | null
          field_search_status?: Json
          first_seen_at?: string
          fit_score?: number | null
          funder_id: string
          funder_type?: string | null
          funding_uses?: string[] | null
          historical_awards?: Json | null
          id?: string
          language?: string
          last_seen_at?: string
          manual_fields?: Json
          next_expected_deadline?: string | null
          next_expected_deadline_basis?: string | null
          next_expected_deadline_confidence?: number | null
          next_expected_open?: string | null
          org_id?: string | null
          populations_served?: string[] | null
          requirements?: Json | null
          scored_at?: string | null
          search_tsv?: unknown
          search_tsv_ml?: unknown
          sectors?: string[]
          source_confidence?: number | null
          source_freshness_at?: string | null
          source_hash: string
          source_key?: string | null
          status?: string
          summary?: string | null
          summary_fr?: string | null
          times_seen?: number
          title: string
          title_fr?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          amount_cad_max?: number | null
          amount_cad_min?: number | null
          amount_max?: number | null
          amount_min?: number | null
          applicant_types?: string[] | null
          assistance_listings?: string[]
          canonical_key?: string | null
          confirmed_source_urls?: Json | null
          country?: string
          created_at?: string
          currency?: string | null
          deadline?: string | null
          deadline_confidence?: number | null
          deadline_kind?: string | null
          discovered_at?: string
          eligibility?: Json
          eligibility_note?: string | null
          eligible_applicant_types?: string[]
          enrich_attempts?: number
          enrich_last_attempt_at?: string | null
          enrich_last_error?: string | null
          enriched_at?: string | null
          field_search_status?: Json
          first_seen_at?: string
          fit_score?: number | null
          funder_id?: string
          funder_type?: string | null
          funding_uses?: string[] | null
          historical_awards?: Json | null
          id?: string
          language?: string
          last_seen_at?: string
          manual_fields?: Json
          next_expected_deadline?: string | null
          next_expected_deadline_basis?: string | null
          next_expected_deadline_confidence?: number | null
          next_expected_open?: string | null
          org_id?: string | null
          populations_served?: string[] | null
          requirements?: Json | null
          scored_at?: string | null
          search_tsv?: unknown
          search_tsv_ml?: unknown
          sectors?: string[]
          source_confidence?: number | null
          source_freshness_at?: string | null
          source_hash?: string
          source_key?: string | null
          status?: string
          summary?: string | null
          summary_fr?: string | null
          times_seen?: number
          title?: string
          title_fr?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "grants_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funder_source_yield"
            referencedColumns: ["funder_id"]
          },
          {
            foreignKeyName: "grants_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "funders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          language: Database["public"]["Enums"]["app_lang"]
          metadata: Json
          org_id: string | null
          source: string
          source_kind: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          language?: Database["public"]["Enums"]["app_lang"]
          metadata?: Json
          org_id?: string | null
          source: string
          source_kind?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          language?: Database["public"]["Enums"]["app_lang"]
          metadata?: Json
          org_id?: string | null
          source?: string
          source_kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      logic_models: {
        Row: {
          activities: Json
          assumptions: Json
          created_at: string
          id: string
          impact: Json
          inputs: Json
          outcomes: Json
          outputs: Json
          proposal_id: string
          updated_at: string
        }
        Insert: {
          activities?: Json
          assumptions?: Json
          created_at?: string
          id?: string
          impact?: Json
          inputs?: Json
          outcomes?: Json
          outputs?: Json
          proposal_id: string
          updated_at?: string
        }
        Update: {
          activities?: Json
          assumptions?: Json
          created_at?: string
          id?: string
          impact?: Json
          inputs?: Json
          outcomes?: Json
          outputs?: Json
          proposal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logic_models_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
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
      module_flags: {
        Row: {
          created_at: string
          description: string
          description_fr: string
          enabled: boolean
          module: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          description_fr?: string
          enabled?: boolean
          module: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          description_fr?: string
          enabled?: boolean
          module?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body_en: string
          body_fr: string
          created_at: string
          grant_id: string | null
          id: string
          kind: string
          read_at: string | null
          title_en: string
          title_fr: string
          user_id: string
        }
        Insert: {
          body_en: string
          body_fr: string
          created_at?: string
          grant_id?: string | null
          id?: string
          kind: string
          read_at?: string | null
          title_en: string
          title_fr: string
          user_id: string
        }
        Update: {
          body_en?: string
          body_fr?: string
          created_at?: string
          grant_id?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title_en?: string
          title_fr?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      org_profiles: {
        Row: {
          activities: string[]
          annual_budget_cad: number | null
          applicant_types: string[]
          business_number: string | null
          capabilities: string[]
          cost_share_max_pct: number | null
          created_at: string
          employee_count: number | null
          focus_areas: string | null
          funding_max_cad: number | null
          funding_min_cad: number | null
          id: string
          indirect_cost_rate_pct: number | null
          jurisdictions: string[]
          languages: string[]
          legal_name: string | null
          mission: string | null
          operating_regions: string[]
          org_id: string | null
          org_name: string
          populations_served: string[]
          profile_evidence: Json
          profile_updated_by: string | null
          registration_status: string | null
          sectors: string[]
          stage: Database["public"]["Enums"]["org_stage"]
          updated_at: string
          user_id: string | null
          website: string | null
          years_operating: number | null
        }
        Insert: {
          activities?: string[]
          annual_budget_cad?: number | null
          applicant_types?: string[]
          business_number?: string | null
          capabilities?: string[]
          cost_share_max_pct?: number | null
          created_at?: string
          employee_count?: number | null
          focus_areas?: string | null
          funding_max_cad?: number | null
          funding_min_cad?: number | null
          id?: string
          indirect_cost_rate_pct?: number | null
          jurisdictions?: string[]
          languages?: string[]
          legal_name?: string | null
          mission?: string | null
          operating_regions?: string[]
          org_id?: string | null
          org_name: string
          populations_served?: string[]
          profile_evidence?: Json
          profile_updated_by?: string | null
          registration_status?: string | null
          sectors?: string[]
          stage?: Database["public"]["Enums"]["org_stage"]
          updated_at?: string
          user_id?: string | null
          website?: string | null
          years_operating?: number | null
        }
        Update: {
          activities?: string[]
          annual_budget_cad?: number | null
          applicant_types?: string[]
          business_number?: string | null
          capabilities?: string[]
          cost_share_max_pct?: number | null
          created_at?: string
          employee_count?: number | null
          focus_areas?: string | null
          funding_max_cad?: number | null
          funding_min_cad?: number | null
          id?: string
          indirect_cost_rate_pct?: number | null
          jurisdictions?: string[]
          languages?: string[]
          legal_name?: string | null
          mission?: string | null
          operating_regions?: string[]
          org_id?: string | null
          org_name?: string
          populations_served?: string[]
          profile_evidence?: Json
          profile_updated_by?: string | null
          registration_status?: string | null
          sectors?: string[]
          stage?: Database["public"]["Enums"]["org_stage"]
          updated_at?: string
          user_id?: string | null
          website?: string | null
          years_operating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      outcomes: {
        Row: {
          amount_awarded_cad: number | null
          created_at: string
          decision_date: string | null
          feedback: string | null
          grant_id: string
          id: string
          impact_description: string | null
          lessons_learned: string | null
          result: string
          submission_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_awarded_cad?: number | null
          created_at?: string
          decision_date?: string | null
          feedback?: string | null
          grant_id: string
          id?: string
          impact_description?: string | null
          lessons_learned?: string | null
          result: string
          submission_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_awarded_cad?: number | null
          created_at?: string
          decision_date?: string | null
          feedback?: string | null
          grant_id?: string
          id?: string
          impact_description?: string | null
          lessons_learned?: string | null
          result?: string
          submission_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcomes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
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
            referencedRelation: "funder_source_yield"
            referencedColumns: ["funder_id"]
          },
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
      product_design_backlog: {
        Row: {
          category: string
          created_at: string
          description: string
          grant_id: string | null
          id: string
          impact: string
          org_id: string
          source: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          grant_id?: string | null
          id?: string
          impact?: string
          org_id: string
          source?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          grant_id?: string | null
          id?: string
          impact?: string
          org_id?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_design_backlog_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_design_backlog_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          country: string
          created_at: string
          id: string
          org_id: string | null
          org_name: string | null
          preferred_lang: Database["public"]["Enums"]["app_lang"]
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          id: string
          org_id?: string | null
          org_name?: string | null
          preferred_lang?: Database["public"]["Enums"]["app_lang"]
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          org_id?: string | null
          org_name?: string | null
          preferred_lang?: Database["public"]["Enums"]["app_lang"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_citation_reports: {
        Row: {
          citations: Json
          created_at: string
          id: string
          proposal_id: string
          summary: Json
          updated_at: string
        }
        Insert: {
          citations?: Json
          created_at?: string
          id?: string
          proposal_id: string
          summary?: Json
          updated_at?: string
        }
        Update: {
          citations?: Json
          created_at?: string
          id?: string
          proposal_id?: string
          summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_citation_reports_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_citations: {
        Row: {
          chunk_id: string
          created_at: string
          id: string
          marker: string
          section_id: string
          snippet: string
          user_id: string
        }
        Insert: {
          chunk_id: string
          created_at?: string
          id?: string
          marker: string
          section_id: string
          snippet: string
          user_id: string
        }
        Update: {
          chunk_id?: string
          created_at?: string
          id?: string
          marker?: string
          section_id?: string
          snippet?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_citations_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_citations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "proposal_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_reviews: {
        Row: {
          created_at: string | null
          id: string
          overall_score: number
          proposal_id: string
          reviewer_scores: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          overall_score: number
          proposal_id: string
          reviewer_scores?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          overall_score?: number
          proposal_id?: string
          reviewer_scores?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_reviews_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
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
          citations: Json
          content: string | null
          content_en: string
          content_fr: string | null
          created_at: string
          critic_notes: Json
          drafted_by: string | null
          fabrication_concerns: Json
          heading: string | null
          heading_en: string | null
          heading_fr: string | null
          human_edited: boolean
          id: string
          kind: Database["public"]["Enums"]["section_kind"] | null
          ord: number
          proposal_id: string
          requirement_id: string | null
          reused_answer_ids: string[]
          sort_order: number
          updated_at: string
          user_id: string | null
          word_count: number | null
        }
        Insert: {
          citations?: Json
          content?: string | null
          content_en?: string
          content_fr?: string | null
          created_at?: string
          critic_notes?: Json
          drafted_by?: string | null
          fabrication_concerns?: Json
          heading?: string | null
          heading_en?: string | null
          heading_fr?: string | null
          human_edited?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["section_kind"] | null
          ord?: number
          proposal_id: string
          requirement_id?: string | null
          reused_answer_ids?: string[]
          sort_order?: number
          updated_at?: string
          user_id?: string | null
          word_count?: number | null
        }
        Update: {
          citations?: Json
          content?: string | null
          content_en?: string
          content_fr?: string | null
          created_at?: string
          critic_notes?: Json
          drafted_by?: string | null
          fabrication_concerns?: Json
          heading?: string | null
          heading_en?: string | null
          heading_fr?: string | null
          human_edited?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["section_kind"] | null
          ord?: number
          proposal_id?: string
          requirement_id?: string | null
          reused_answer_ids?: string[]
          sort_order?: number
          updated_at?: string
          user_id?: string | null
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
      proposal_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_global: boolean
          name: string
          name_fr: string | null
          owner_id: string | null
          sections: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name: string
          name_fr?: string | null
          owner_id?: string | null
          sections?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name?: string
          name_fr?: string | null
          owner_id?: string | null
          sections?: Json
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          budget_total_cad: number | null
          client_id: string | null
          created_at: string
          critic_score: number | null
          grant_id: string
          human_reviewed_at: string | null
          id: string
          language: Database["public"]["Enums"]["app_lang"]
          metadata: Json
          org_id: string | null
          status: string
          template_id: string | null
          title: string | null
          updated_at: string
          user_id: string | null
          version: number
        }
        Insert: {
          budget_total_cad?: number | null
          client_id?: string | null
          created_at?: string
          critic_score?: number | null
          grant_id: string
          human_reviewed_at?: string | null
          id?: string
          language?: Database["public"]["Enums"]["app_lang"]
          metadata?: Json
          org_id?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          version?: number
        }
        Update: {
          budget_total_cad?: number | null
          client_id?: string | null
          created_at?: string
          critic_score?: number | null
          grant_id?: string
          human_reviewed_at?: string | null
          id?: string
          language?: Database["public"]["Enums"]["app_lang"]
          metadata?: Json
          org_id?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          version?: number
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
          {
            foreignKeyName: "proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proposal_templates"
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
      shared_fit_reports: {
        Row: {
          created_at: string
          expires_at: string
          grant_id: string
          id: string
          org_id: string | null
          revoked: boolean
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          grant_id: string
          id?: string
          org_id?: string | null
          revoked?: boolean
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          grant_id?: string
          id?: string
          org_id?: string | null
          revoked?: boolean
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_fit_reports_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_fit_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      source_ingest_runs: {
        Row: {
          auto_approved: number
          candidates_out: number
          dataset: string
          duplicates: number
          error_message: string | null
          errors: number
          id: string
          latency_ms: number | null
          metadata: Json
          rows_in: number
          run_at: string
          status: string
        }
        Insert: {
          auto_approved?: number
          candidates_out?: number
          dataset: string
          duplicates?: number
          error_message?: string | null
          errors?: number
          id?: string
          latency_ms?: number | null
          metadata?: Json
          rows_in?: number
          run_at?: string
          status?: string
        }
        Update: {
          auto_approved?: number
          candidates_out?: number
          dataset?: string
          duplicates?: number
          error_message?: string | null
          errors?: number
          id?: string
          latency_ms?: number | null
          metadata?: Json
          rows_in?: number
          run_at?: string
          status?: string
        }
        Relationships: []
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
          attachments: Json
          confirmation_number: string | null
          created_at: string
          grant_id: string | null
          human_edited_pct: number | null
          human_reviewed_by: string | null
          id: string
          language: Database["public"]["Enums"]["app_lang"]
          method: string | null
          notes: string | null
          org_id: string | null
          outcome: string | null
          overridden_blockers: Json
          proposal_id: string
          submitted_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attachments?: Json
          confirmation_number?: string | null
          created_at?: string
          grant_id?: string | null
          human_edited_pct?: number | null
          human_reviewed_by?: string | null
          id?: string
          language?: Database["public"]["Enums"]["app_lang"]
          method?: string | null
          notes?: string | null
          org_id?: string | null
          outcome?: string | null
          overridden_blockers?: Json
          proposal_id: string
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attachments?: Json
          confirmation_number?: string | null
          created_at?: string
          grant_id?: string | null
          human_edited_pct?: number | null
          human_reviewed_by?: string | null
          id?: string
          language?: Database["public"]["Enums"]["app_lang"]
          method?: string | null
          notes?: string | null
          org_id?: string | null
          outcome?: string | null
          overridden_blockers?: Json
          proposal_id?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_human_reviewed_by_fkey"
            columns: ["human_reviewed_by"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          entity_id: string
          entity_type: string
          id: string
          priority: string
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          entity_id: string
          entity_type: string
          id?: string
          priority?: string
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          priority?: string
          status?: string
          title?: string
        }
        Relationships: []
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
      user_organizations: {
        Row: {
          created_at: string
          org_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_config: {
        Row: {
          key: string
          rotated_at: string
          value: string
        }
        Insert: {
          key: string
          rotated_at?: string
          value: string
        }
        Update: {
          key?: string
          rotated_at?: string
          value?: string
        }
        Relationships: []
      }
      webhook_nonces: {
        Row: {
          endpoint: string
          nonce: string
          seen_at: string
        }
        Insert: {
          endpoint: string
          nonce: string
          seen_at?: string
        }
        Update: {
          endpoint?: string
          nonce?: string
          seen_at?: string
        }
        Relationships: []
      }
      webhook_rate_limit: {
        Row: {
          client_ip: string
          endpoint: string
          id: number
          seen_at: string
        }
        Insert: {
          client_ip: string
          endpoint: string
          id?: number
          seen_at?: string
        }
        Update: {
          client_ip?: string
          endpoint?: string
          id?: number
          seen_at?: string
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
      funder_source_yield: {
        Row: {
          funder_id: string | null
          grants_30d: number | null
          grants_total: number | null
          last_grant_at: string | null
          name: string | null
          source_type: Database["public"]["Enums"]["funder_source_type"] | null
        }
        Relationships: []
      }
      source_coverage_accountability: {
        Row: {
          accountable_state: string | null
          age_hours: number | null
          coverage_dimensions: string[] | null
          dataset_key: string | null
          enabled: boolean | null
          expected_refresh_hours: number | null
          id: string | null
          label: string | null
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          owner_label: string | null
          recovery_playbook: string | null
          tier: string | null
        }
        Insert: {
          accountable_state?: never
          age_hours?: never
          coverage_dimensions?: string[] | null
          dataset_key?: string | null
          enabled?: boolean | null
          expected_refresh_hours?: number | null
          id?: string | null
          label?: string | null
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          owner_label?: string | null
          recovery_playbook?: string | null
          tier?: string | null
        }
        Update: {
          accountable_state?: never
          age_hours?: never
          coverage_dimensions?: string[] | null
          dataset_key?: string | null
          enabled?: boolean | null
          expected_refresh_hours?: number | null
          id?: string | null
          label?: string | null
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          owner_label?: string | null
          recovery_playbook?: string | null
          tier?: string | null
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
      source_health_summary: {
        Row: {
          auto_approved_total: number | null
          avg_latency_ms: number | null
          candidates_total: number | null
          dataset: string | null
          errors_total: number | null
          last_run_at: string | null
          rows_in_total: number | null
          runs: number | null
          success_rate: number | null
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
      claim_grant_review_batch: {
        Args: { p_job_id: string; p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          grant_id: string
          id: string
          job_id: string
          last_error: string | null
          lock_token: string | null
          locked_until: string | null
          next_attempt_at: string
          priority: number
          stage: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "grant_review_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ensure_consultant: { Args: never; Returns: undefined }
      ensure_current_user: { Args: never; Returns: undefined }
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
      is_tenant_member: { Args: { _org_id: string }; Returns: boolean }
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
      set_grant_manual_field: {
        Args: {
          p_field: string
          p_grant_id: string
          p_note?: string
          p_value: Json
        }
        Returns: undefined
      }
      tenant_membership_role: { Args: { _org_id: string }; Returns: string }
      user_org_ids: {
        Args: { _roles?: string[]; _uid: string }
        Returns: string[]
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
      app_role: "admin" | "member" | "viewer" | "consultant"
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
      app_role: ["admin", "member", "viewer", "consultant"],
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
