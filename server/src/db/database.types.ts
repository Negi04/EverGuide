/**
 * Database types for the Supabase client.
 *
 * HAND-WRITTEN to match database/migrations/20261024000001_identity_and_onboarding.sql.
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
    }
    Views: { [_ in never]: never }
    Functions: {
      has_role: { Args: { check_role: AppRoleEnum }; Returns: boolean }
    }
    Enums: { app_role: AppRoleEnum }
    CompositeTypes: { [_ in never]: never }
  }
}
