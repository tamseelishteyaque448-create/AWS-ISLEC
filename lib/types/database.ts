export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          activity_key: string
          activity_type: string
          badge_id: string | null
          build_submission_id: string | null
          created_at: string
          detail: string
          event_id: string | null
          id: string
          learning_path_id: string | null
          occurred_at: string
          points: number
          profile_id: string
          project_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          activity_key: string
          activity_type: string
          badge_id?: string | null
          build_submission_id?: string | null
          created_at?: string
          detail?: string
          event_id?: string | null
          id?: string
          learning_path_id?: string | null
          occurred_at?: string
          points?: number
          profile_id: string
          project_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          activity_key?: string
          activity_type?: string
          badge_id?: string | null
          build_submission_id?: string | null
          created_at?: string
          detail?: string
          event_id?: string | null
          id?: string
          learning_path_id?: string | null
          occurred_at?: string
          points?: number
          profile_id?: string
          project_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      build_assignments: {
        Row: { id: string; slug: string; title: string; summary: string; objective: string; difficulty: string; domain: string; assignment_scope: string; publication_state: string; published: boolean; is_archived: boolean; deadline_at: string | null; priority: string; requirements: NonNullable<Json>; deliverables: NonNullable<Json>; submission_requirements: NonNullable<Json>; evaluation_criteria: NonNullable<Json>; reward_points: number; sort_order: number; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; slug: string; title: string; summary?: string; objective?: string; difficulty: string; domain?: string; assignment_scope?: string; publication_state?: string; published?: boolean; is_archived?: boolean; deadline_at?: string | null; priority?: string; requirements?: NonNullable<Json>; deliverables?: NonNullable<Json>; submission_requirements?: NonNullable<Json>; evaluation_criteria?: NonNullable<Json>; reward_points?: number; sort_order?: number; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; slug?: string; title?: string; summary?: string; objective?: string; difficulty?: string; domain?: string; assignment_scope?: string; publication_state?: string; published?: boolean; is_archived?: boolean; deadline_at?: string | null; priority?: string; requirements?: NonNullable<Json>; deliverables?: NonNullable<Json>; submission_requirements?: NonNullable<Json>; evaluation_criteria?: NonNullable<Json>; reward_points?: number; sort_order?: number; created_by?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      build_assignment_attachments: {
        Row: { id: string; assignment_id: string; storage_path: string; content_type: string; file_size: number; label: string; created_by: string; created_at: string }
        Insert: { id?: string; assignment_id: string; storage_path: string; content_type: string; file_size: number; label?: string; created_by: string; created_at?: string }
        Update: { never?: never }
        Relationships: []
      }
      build_assignment_members: {
        Row: { id: string; assignment_id: string; member_id: string; assigned_by: string; assigned_at: string; status: string; reward_points_snapshot: number; updated_at: string }
        Insert: { id?: string; assignment_id: string; member_id: string; assigned_by: string; assigned_at?: string; status?: string; reward_points_snapshot?: number; updated_at?: string }
        Update: { never?: never }
        Relationships: []
      }
      build_member_domains: {
        Row: { profile_id: string; domain: string; assigned_by: string; assigned_at: string }
        Insert: { profile_id: string; domain: string; assigned_by: string; assigned_at?: string }
        Update: { never?: never }
        Relationships: []
      }
      build_submission_evidence: {
        Row: { id: string; submission_id: string; owner_id: string; storage_path: string; content_type: string; file_size: number; caption: string; created_at: string }
        Insert: { id?: string; submission_id: string; owner_id: string; storage_path: string; content_type: string; file_size: number; caption?: string; created_at?: string }
        Update: { never?: never }
        Relationships: []
      }
      build_submission_reviews: {
        Row: { id: string; work_item_id: string; submission_id: string; reviewer_id: string; decision: string; feedback: string; created_at: string }
        Insert: { id?: string; work_item_id: string; submission_id: string; reviewer_id: string; decision: string; feedback?: string; created_at?: string }
        Update: { never?: never }
        Relationships: []
      }
      build_submission_rewards: {
        Row: { id: string; work_item_id: string; submission_id: string; profile_id: string; points_awarded: number; activity_key: string; awarded_by: string; awarded_at: string }
        Insert: { id?: string; work_item_id: string; submission_id: string; profile_id: string; points_awarded: number; activity_key: string; awarded_by: string; awarded_at?: string }
        Update: { never?: never }
        Relationships: []
      }
      build_submissions: {
        Row: { id: string; work_item_id: string; member_id: string; revision_number: number; project_title: string; explanation: string; approach: string; technologies: string[]; challenges: string; learnings: string; future_improvements: string; repository_url: string | null; deployment_url: string | null; demo_url: string | null; submitted_at: string; created_at: string }
        Insert: { id?: string; work_item_id: string; member_id: string; revision_number: number; project_title: string; explanation?: string; approach?: string; technologies?: string[]; challenges?: string; learnings?: string; future_improvements?: string; repository_url?: string | null; deployment_url?: string | null; demo_url?: string | null; submitted_at?: string; created_at?: string }
        Update: { never?: never }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string
          detail: string
          icon: string
          id: string
          points: number
          requirement_type: string | null
          requirement_value: number | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail?: string
          icon: string
          id?: string
          points?: number
          requirement_type?: string | null
          requirement_value?: number | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string
          icon?: string
          id?: string
          points?: number
          requirement_type?: string | null
          requirement_value?: number | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          created_at: string
          detail: string
          id: string
          is_published: boolean
          learning_path_id: string
          level: string
          points: number
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail?: string
          id?: string
          is_published?: boolean
          learning_path_id: string
          level: string
          points: number
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          is_published?: boolean
          learning_path_id?: string
          level?: string
          points?: number
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_completions: {
        Row: {
          activity_key: string
          challenge_id: string
          completed_at: string
          created_at: string
          id: string
          points_awarded: number
          profile_id: string
        }
        Insert: {
          activity_key: string
          challenge_id: string
          completed_at?: string
          created_at?: string
          id?: string
          points_awarded: number
          profile_id: string
        }
        Update: {
          activity_key?: string
          challenge_id?: string
          completed_at?: string
          created_at?: string
          id?: string
          points_awarded?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_completions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_completions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_contents: {
        Row: {
          category: string
          challenge_id: string
          created_at: string
          estimated_minutes: number
          hint: string | null
          options: Json
          question: string
          scenario: string
          success_explanation: string | null
          updated_at: string
        }
        Insert: {
          category: string
          challenge_id: string
          created_at?: string
          estimated_minutes: number
          hint?: string | null
          options: Json
          question: string
          scenario: string
          success_explanation?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          challenge_id?: string
          created_at?: string
          estimated_minutes?: number
          hint?: string | null
          options?: Json
          question?: string
          scenario?: string
          success_explanation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_contents_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: true
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_completion_badges: {
        Row: {
          badge_id: string
          completion_id: string
          created_at: string
          points_awarded: number
        }
        Insert: {
          badge_id: string
          completion_id: string
          created_at?: string
          points_awarded: number
        }
        Update: {
          badge_id?: string
          completion_id?: string
          created_at?: string
          points_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_completion_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_completion_badges_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "challenge_completions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          event_id: string
          profile_id: string
          registered_at: string
          status: string
          updated_at: string
        }
        Insert: {
          event_id: string
          profile_id: string
          registered_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          event_id?: string
          profile_id?: string
          registered_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          attendance_label: string | null
          capacity: number | null
          context: string
          created_at: string
          created_by: string | null
          details: string
          ends_at: string | null
          event_type: string
          id: string
          is_published: boolean
          location: string | null
          poster_alt: string | null
          poster_path: string | null
          slug: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attendance_label?: string | null
          capacity?: number | null
          context?: string
          created_at?: string
          created_by?: string | null
          details?: string
          ends_at?: string | null
          event_type: string
          id?: string
          is_published?: boolean
          location?: string | null
          poster_alt?: string | null
          poster_path?: string | null
          slug: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attendance_label?: string | null
          capacity?: number | null
          context?: string
          created_at?: string
          created_by?: string | null
          details?: string
          ends_at?: string | null
          event_type?: string
          id?: string
          is_published?: boolean
          location?: string | null
          poster_alt?: string | null
          poster_path?: string | null
          slug?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          created_at: string
          description: string
          estimated_minutes: number | null
          id: string
          is_published: boolean
          level: string
          points: number
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          level: string
          points?: number
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          level?: string
          points?: number
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          handle: string
          id: string
          points: number
          role: string
          streak: number
          streak_last_date: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          handle: string
          id: string
          points?: number
          role?: string
          streak?: number
          streak_last_date?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          handle?: string
          id?: string
          points?: number
          role?: string
          streak?: number
          streak_last_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          joined_at: string
          profile_id: string
          project_id: string
          reviewed_at: string | null
          role: string
          status: string
          submitted_at: string | null
        }
        Insert: {
          joined_at?: string
          profile_id: string
          project_id: string
          reviewed_at?: string | null
          role?: string
          status?: string
          submitted_at?: string | null
        }
        Update: {
          joined_at?: string
          profile_id?: string
          project_id?: string
          reviewed_at?: string | null
          role?: string
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: { id: string; project_id: string; title: string; description: string; sort_order: number; is_archived: boolean; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; project_id: string; title: string; description?: string; sort_order?: number; is_archived?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; project_id?: string; title?: string; description?: string; sort_order?: number; is_archived?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "project_milestones_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "project_milestones_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      project_tasks: {
        Row: { id: string; project_id: string; milestone_id: string; title: string; description: string; assignee_id: string | null; status: string; sort_order: number; is_archived: boolean; created_by: string | null; created_at: string; updated_at: string; completed_at: string | null }
        Insert: { id?: string; project_id: string; milestone_id: string; title: string; description?: string; assignee_id?: string | null; status?: string; sort_order?: number; is_archived?: boolean; created_by?: string | null; created_at?: string; updated_at?: string; completed_at?: string | null }
        Update: { id?: string; project_id?: string; milestone_id?: string; title?: string; description?: string; assignee_id?: string | null; status?: string; sort_order?: number; is_archived?: boolean; created_by?: string | null; created_at?: string; updated_at?: string; completed_at?: string | null }
        Relationships: [
          { foreignKeyName: "project_tasks_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "project_tasks_milestone_id_fkey"; columns: ["milestone_id"]; isOneToOne: false; referencedRelation: "project_milestones"; referencedColumns: ["id"] },
          { foreignKeyName: "project_tasks_assignee_id_fkey"; columns: ["assignee_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "project_tasks_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      project_join_requests: {
        Row: { id: string; project_id: string; profile_id: string; requested_contribution: string; message: string; status: string; requested_at: string; resolved_at: string | null; resolved_by: string | null }
        Insert: { id?: string; project_id: string; profile_id: string; requested_contribution?: string; message?: string; status?: string; requested_at?: string; resolved_at?: string | null; resolved_by?: string | null }
        Update: { id?: string; project_id?: string; profile_id?: string; requested_contribution?: string; message?: string; status?: string; requested_at?: string; resolved_at?: string | null; resolved_by?: string | null }
        Relationships: []
      }
      project_join_request_proofs: {
        Row: { id: string; request_id: string; proof_type: string; title: string; description: string; url: string | null; created_at: string }
        Insert: { id?: string; request_id: string; proof_type: string; title: string; description?: string; url?: string | null; created_at?: string }
        Update: { id?: string; request_id?: string; proof_type?: string; title?: string; description?: string; url?: string | null; created_at?: string }
        Relationships: []
      }
      project_reviews: {
        Row: { id: string; project_id: string; reviewer_id: string; decision: string; feedback: string; created_at: string }
        Insert: { id?: string; project_id: string; reviewer_id: string; decision: string; feedback?: string; created_at?: string }
        Update: { id?: string; project_id?: string; reviewer_id?: string; decision?: string; feedback?: string; created_at?: string }
        Relationships: []
      }
      projects: {
        Row: {
          build_stage: string
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_published: boolean
          publication_state: string
          progress: number
          recruitment_mode: string
          repository_url: string | null
          demo_url: string | null
          slug: string
          status: string
          technologies: string[]
          team_capacity: number | null
          title: string
          updated_at: string
        }
        Insert: {
          build_stage?: string
          category: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_published?: boolean
          publication_state?: string
          progress?: number
          recruitment_mode?: string
          repository_url?: string | null
          demo_url?: string | null
          slug: string
          status?: string
          technologies?: string[]
          team_capacity?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          build_stage?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_published?: boolean
          publication_state?: string
          progress?: number
          recruitment_mode?: string
          repository_url?: string | null
          demo_url?: string | null
          slug?: string
          status?: string
          technologies?: string[]
          team_capacity?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          profile_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          profile_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenge_progress: {
        Row: {
          challenge_id: string
          completed_at: string | null
          created_at: string
          profile_id: string
          progress: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          created_at?: string
          profile_id: string
          progress?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          created_at?: string
          profile_id?: string
          progress?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_challenge_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_project_milestone: {
        Args: { p_project_id: string; p_title: string; p_description?: string; p_sort_order?: number }
        Returns: Json
      }
      archive_project_milestone: {
        Args: { p_project_id: string; p_milestone_id: string }
        Returns: Json
      }
      create_project_task: {
        Args: { p_project_id: string; p_milestone_id: string; p_title: string; p_description?: string; p_assignee_id?: string | null; p_sort_order?: number }
        Returns: Json
      }
      update_task_status: {
        Args: { p_project_id: string; p_task_id: string; p_status: string }
        Returns: Json
      }
      assign_task: {
        Args: { p_project_id: string; p_task_id: string; p_assignee_id?: string | null }
        Returns: Json
      }
      archive_task: {
        Args: { p_project_id: string; p_task_id: string }
        Returns: Json
      }
      assign_build_member: {
        Args: { p_assignment_id: string; p_member_id: string }
        Returns: Json
      }
      cancel_build_work_item: {
        Args: { p_work_item_id: string }
        Returns: Json
      }
      save_build_assignment: { Args: { p_assignment_id?: string | null; p_slug?: string | null; p_title?: string | null; p_summary?: string; p_objective?: string; p_difficulty?: string; p_domain?: string; p_assignment_scope?: string; p_publication_state?: string; p_deadline_at?: string | null; p_priority?: string; p_requirements?: Json; p_deliverables?: Json; p_submission_requirements?: Json; p_evaluation_criteria?: Json; p_reward_points?: number; p_sort_order?: number; p_member_ids?: string[] }; Returns: Json }
      save_build_submission: { Args: { p_submission_id?: string | null; p_assignment_id?: string | null; p_project_title?: string; p_explanation?: string; p_approach?: string; p_technologies?: string[]; p_challenges?: string; p_learnings?: string; p_future_improvements?: string; p_repository_url?: string | null; p_deployment_url?: string | null; p_demo_url?: string | null }; Returns: Json }
      submit_build_submission: { Args: { p_submission_id: string }; Returns: Json }
      review_build_submission: { Args: { p_submission_id: string; p_decision: string; p_feedback?: string }; Returns: Json }
      add_build_submission_evidence: { Args: { p_submission_id: string; p_storage_path: string; p_content_type: string; p_file_size: number; p_caption?: string }; Returns: Json }
      set_build_member_domain: { Args: { p_profile_id: string; p_domain: string; p_assigned: boolean }; Returns: Json }
      add_build_assignment_attachment: { Args: { p_assignment_id: string; p_storage_path: string; p_content_type: string; p_file_size: number; p_label?: string }; Returns: Json }
      start_build_assignment: {
        Args: { p_work_item_id: string }
        Returns: Json
      }
      submit_build_work: {
        Args: { p_work_item_id: string; p_project_title: string; p_explanation: string; p_approach: string; p_challenges?: string; p_learnings?: string; p_future_improvements?: string; p_repository_url?: string; p_deployment_url?: string; p_demo_url?: string; p_technologies?: string[] }
        Returns: Json
      }
      resubmit_build_work: {
        Args: { p_work_item_id: string; p_project_title: string; p_explanation: string; p_approach: string; p_challenges?: string; p_learnings?: string; p_future_improvements?: string; p_repository_url?: string; p_deployment_url?: string; p_demo_url?: string; p_technologies?: string[] }
        Returns: Json
      }
      complete_challenge: {
        Args: {
          p_challenge_id: string
        }
        Returns: Json
      }
      submit_challenge_answer: {
        Args: {
          p_answer: Json
          p_challenge_id: string
        }
        Returns: Json
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_admin_learning_outcome_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          badge_award_count: number
          badge_points_recorded: number
          challenge_points_awarded: number
          completion_count: number
          member_count: number
        }[]
      }
      get_admin_analytics_v1: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_event_availability: {
        Args: { p_event_id: string }
        Returns: {
          available_slots: number | null
          registered_count: number
        }[]
      }
      get_event_availabilities: {
        Args: { p_event_ids: string[] }
        Returns: {
          available_slots: number | null
          event_id: string
          registered_count: number
        }[]
      }
      cancel_event_registration: {
        Args: { p_event_id: string }
        Returns: Json
      }
      record_event_attendance: {
        Args: { p_event_id: string; p_profile_id: string }
        Returns: Json
      }
      request_project_access: {
        Args: { p_project_id: string }
        Returns: Json
      }
      create_project_v1: { Args: { p_title: string; p_slug: string; p_category: string; p_description: string; p_technologies: string[]; p_recruitment_mode?: string; p_team_capacity?: number | null }; Returns: Json }
      delete_project_v1: { Args: { p_project_id: string }; Returns: Json }
      request_project_join: { Args: { p_project_id: string; p_contribution?: string; p_message?: string }; Returns: Json }
      submit_project_for_review: { Args: { p_project_id: string }; Returns: Json }
      withdraw_project_join_request: { Args: { p_request_id: string }; Returns: Json }
      resolve_project_join_request: { Args: { p_request_id: string; p_approve: boolean }; Returns: Json }
      review_project_publication: { Args: { p_project_id: string; p_decision: string; p_feedback?: string }; Returns: Json }
      transfer_project_ownership: { Args: { p_project_id: string; p_new_owner_id: string }; Returns: Json }
      recover_project_ownership: { Args: { p_project_id: string; p_new_owner_id: string; p_reason?: string }; Returns: Json }
      update_project_v1: { Args: { p_project_id: string; p_title: string; p_category: string; p_description: string; p_technologies: string[]; p_build_stage: string; p_recruitment_mode: string; p_team_capacity?: number | null; p_repository_url?: string | null; p_demo_url?: string | null }; Returns: Json }
      admin_update_project_v1: {
        Args: {
          p_project_id:      string;
          p_title:           string;
          p_category:        string;
          p_description:     string;
          p_technologies:    string[];
          p_build_stage:     string;
          p_recruitment_mode: string;
          p_team_capacity?:  number | null;
          p_repository_url?: string | null;
          p_demo_url?:       string | null;
        };
        Returns: Json;
      }
      review_project_member: {
        Args: { p_action: string; p_profile_id: string; p_project_id: string }
        Returns: Json
      }
      submit_project_work: {
        Args: { p_project_id: string }
        Returns: Json
      }
      register_for_event: {
        Args: { p_event_id: string }
        Returns: Json
      }
      add_join_request_proof: {
        Args: { p_request_id: string; p_proof_type: string; p_title: string; p_description: string; p_url: string }
        Returns: Json
      }
      remove_join_request_proof: {
        Args: { p_proof_id: string }
        Returns: Json
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
