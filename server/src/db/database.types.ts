/**
 * Database types for the Supabase client.
 *
 * HAND-WRITTEN to match database/migrations/*.sql (phases 2–4).
 * Replace with generated types (`supabase gen types typescript`) once the Supabase CLI
 * is linked to the project, and regenerate after every migration.
 */
export type AppRoleEnum = 'user' | 'mentor' | 'admin'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          avatar_url: string | null
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          full_name?: string
          avatar_url?: string | null
          timezone?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          user_id: string
          role: AppRoleEnum
          granted_by: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          role: AppRoleEnum
          granted_by?: string | null
        }
        Update: never
        Relationships: []
      }
      user_preferences: {
        Row: {
          user_id: string
          life_stage: string | null
          primary_goals: string[]
          target_career: string | null
          preferred_domains: string[]
          skill_level: string | null
          onboarding_completed_at: string | null
          updated_at: string
        }
        Insert: never
        Update: {
          life_stage?: string | null
          primary_goals?: string[]
          target_career?: string | null
          preferred_domains?: string[]
          skill_level?: string | null
          onboarding_completed_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          link_path: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          type: string
          title: string
          body?: string | null
          link_path?: string | null
        }
        Update: { read_at?: string | null }
        Relationships: []
      }
      audit_events: {
        Row: {
          id: number
          actor_id: string | null
          action: string
          target_type: string | null
          target_id: string | null
          metadata: Record<string, unknown>
          request_id: string | null
          created_at: string
        }
        Insert: {
          actor_id?: string | null
          action: string
          target_type?: string | null
          target_id?: string | null
          metadata?: Record<string, unknown>
          request_id?: string | null
        }
        Update: never
        Relationships: []
      }
      contact_messages: {
        Row: {
          id: string
          user_id: string | null
          name: string
          email: string
          topic: string
          message: string
          status: string
          created_at: string
        }
        Insert: {
          user_id?: string | null
          name: string
          email: string
          topic: string
          message: string
        }
        Update: { status?: string }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          id: string
          slug: string
          title: string
          domain: string
          source_name: string
          source_url: string | null
          license: string
          status: 'draft' | 'approved' | 'archived'
          checksum: string
          created_at: string
          updated_at: string
        }
        Insert: {
          slug: string
          title: string
          domain: string
          source_name: string
          source_url?: string | null
          license: string
          status?: 'draft' | 'approved' | 'archived'
          checksum: string
        }
        Update: {
          title?: string
          domain?: string
          source_name?: string
          source_url?: string | null
          license?: string
          status?: 'draft' | 'approved' | 'archived'
          checksum?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          id: string
          document_id: string
          chunk_index: number
          heading: string | null
          content: string
          embedding: string
          created_at: string
        }
        Insert: {
          document_id: string
          chunk_index: number
          heading?: string | null
          content: string
          /** pgvector accepts a JSON array of numbers. */
          embedding: number[] | string
        }
        Update: never
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string
          domain: string
          last_message_at: string
          created_at: string
          updated_at: string
        }
        Insert: { user_id: string; title?: string; domain?: string }
        Update: { title?: string; domain?: string; last_message_at?: string }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          grounded: boolean | null
          safety_flag: 'crisis' | null
          model: string | null
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          grounded?: boolean | null
          safety_flag?: 'crisis' | null
          model?: string | null
          metadata?: Record<string, unknown>
        }
        Update: never
        Relationships: []
      }
      message_citations: {
        Row: {
          id: string
          message_id: string
          user_id: string
          citation_number: number
          chunk_id: string | null
          document_id: string | null
          title: string
          source_name: string
          source_url: string | null
          excerpt: string
          similarity: number
        }
        Insert: {
          message_id: string
          user_id: string
          citation_number: number
          chunk_id: string | null
          document_id: string | null
          title: string
          source_name: string
          source_url: string | null
          excerpt: string
          similarity: number
        }
        Update: never
        Relationships: []
      }
      ai_usage: {
        Row: {
          id: string
          user_id: string
          message_id: string | null
          status: 'reserved' | 'completed' | 'failed'
          model: string | null
          input_tokens: number | null
          output_tokens: number | null
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: {
          message_id?: string | null
          status?: 'reserved' | 'completed' | 'failed'
          model?: string | null
          input_tokens?: number | null
          output_tokens?: number | null
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          id: string
          message_id: string
          user_id: string
          rating: 'helpful' | 'not_helpful'
          comment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          message_id: string
          user_id: string
          rating: 'helpful' | 'not_helpful'
          comment?: string | null
        }
        Update: { rating?: 'helpful' | 'not_helpful'; comment?: string | null }
        Relationships: []
      }
      goals: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          category: string
          target_date: string | null
          status: 'active' | 'completed' | 'archived'
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          title: string
          description?: string | null
          category?: string
          target_date?: string | null
        }
        Update: {
          title?: string
          description?: string | null
          category?: string
          target_date?: string | null
          status?: 'active' | 'completed' | 'archived'
          completed_at?: string | null
        }
        Relationships: []
      }
      milestones: {
        Row: {
          id: string
          goal_id: string
          user_id: string
          title: string
          notes: string | null
          target_date: string | null
          position: number
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          goal_id: string
          user_id: string
          title: string
          notes?: string | null
          target_date?: string | null
          position?: number
        }
        Update: {
          title?: string
          notes?: string | null
          target_date?: string | null
          position?: number
          completed_at?: string | null
        }
        Relationships: []
      }
      resumes: {
        Row: {
          id: string
          user_id: string
          file_name: string
          storage_path: string
          size_bytes: number
          page_count: number
          extracted_text: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          storage_path: string
          size_bytes: number
          page_count: number
          extracted_text: string
        }
        Update: never
        Relationships: []
      }
      resume_analyses: {
        Row: {
          id: string
          resume_id: string
          user_id: string
          target_role: string | null
          job_description: string | null
          report: Record<string, unknown>
          model: string
          created_at: string
        }
        Insert: {
          resume_id: string
          user_id: string
          target_role?: string | null
          job_description?: string | null
          report: Record<string, unknown>
          model: string
        }
        Update: never
        Relationships: []
      }
      interview_questions: {
        Row: {
          id: string
          slug: string
          category: string
          role: string
          difficulty: string
          prompt: string
          guidance: string
          status: 'draft' | 'approved' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          slug: string
          category: string
          role: string
          difficulty: string
          prompt: string
          guidance: string
          status?: 'draft' | 'approved' | 'archived'
        }
        Update: {
          category?: string
          role?: string
          difficulty?: string
          prompt?: string
          guidance?: string
          status?: 'draft' | 'approved' | 'archived'
        }
        Relationships: []
      }
      saved_questions: {
        Row: { user_id: string; question_id: string; created_at: string }
        Insert: { user_id: string; question_id: string }
        Update: never
        Relationships: []
      }
      practice_attempts: {
        Row: {
          id: string
          user_id: string
          question_id: string
          answer: string
          feedback: Record<string, unknown> | null
          model: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          question_id: string
          answer: string
          feedback?: Record<string, unknown> | null
          model?: string | null
        }
        Update: never
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      has_role: { Args: { check_role: AppRoleEnum }; Returns: boolean }
      match_knowledge_chunks: {
        Args: { query_embedding: number[] | string; match_count?: number; min_similarity?: number }
        Returns: {
          chunk_id: string
          document_id: string
          title: string
          source_name: string
          source_url: string | null
          heading: string | null
          content: string
          similarity: number
        }[]
      }
      reserve_ai_message: {
        Args: { p_user_id: string; p_monthly_limit: number }
        Returns: { reservation_id: string | null; used: number }[]
      }
    }
    Enums: { app_role: AppRoleEnum }
    CompositeTypes: { [_ in never]: never }
  }
}
