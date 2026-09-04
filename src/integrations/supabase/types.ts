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
      activity_feed: {
        Row: {
          actor_user_id: string
          club_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          actor_user_id: string
          club_id?: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          actor_user_id?: string
          club_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_logs: {
        Row: {
          action_payload: Json | null
          action_type: string
          actor_user_id: string
          created_at: string
          id: string
          pool_id: string
        }
        Insert: {
          action_payload?: Json | null
          action_type: string
          actor_user_id: string
          created_at?: string
          id?: string
          pool_id: string
        }
        Update: {
          action_payload?: Json | null
          action_type?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_logs_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          subject_id: string | null
          subject_type: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          subject_id?: string | null
          subject_type: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          subject_id?: string | null
          subject_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_rate_limits: {
        Row: {
          count: number
          function_name: string
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          function_name: string
          updated_at?: string
          user_id: string
          window_start: string
        }
        Update: {
          count?: number
          function_name?: string
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          published_at: string | null
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          published_at?: string | null
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          published_at?: string | null
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          rollout: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          rollout?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          rollout?: Json
          updated_at?: string
        }
        Relationships: []
      }
      bracket_picks: {
        Row: {
          bracket_id: string
          club_id: string
          created_at: string
          game_id: string
          id: string
          picked_in_round: number
          picked_team_id: string
          updated_at: string
        }
        Insert: {
          bracket_id: string
          club_id?: string
          created_at?: string
          game_id: string
          id?: string
          picked_in_round: number
          picked_team_id: string
          updated_at?: string
        }
        Update: {
          bracket_id?: string
          club_id?: string
          created_at?: string
          game_id?: string
          id?: string
          picked_in_round?: number
          picked_team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bracket_picks_bracket_id_fkey"
            columns: ["bracket_id"]
            isOneToOne: false
            referencedRelation: "brackets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_picks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_picks_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_picks_picked_team_id_fkey"
            columns: ["picked_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      brackets: {
        Row: {
          club_id: string
          created_at: string
          id: string
          pool_id: string
          status: string | null
          submitted_at: string | null
          tiebreaker_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          id?: string
          pool_id: string
          status?: string | null
          submitted_at?: string | null
          tiebreaker_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          pool_id?: string
          status?: string | null
          submitted_at?: string | null
          tiebreaker_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brackets_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brackets_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brackets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_categories: {
        Row: {
          club_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          club_id?: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "channel_categories_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_notification_prefs: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_notification_prefs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_read_states: {
        Row: {
          channel_id: string
          club_id: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          club_id?: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          club_id?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_read_states_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_read_states_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          archived_at: string | null
          category_id: string | null
          channel_type: string
          club_id: string
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_default: boolean
          name: string
          position: number
          post_permission: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category_id?: string | null
          channel_type?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          position?: number
          post_permission?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category_id?: string | null
          channel_type?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          position?: number
          post_permission?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "channel_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_celebration_settings: {
        Row: {
          admins_can_manage_all: boolean
          allow_members_to_add_birthdays: boolean
          allow_members_to_create_milestones: boolean
          auto_generate_connect_prompts: boolean
          club_id: string
          created_at: string
          day_of_reminder: boolean
          reminder_days_before: number
          show_in_connect: boolean
          show_on_home: boolean
          show_on_profiles: boolean
          updated_at: string
        }
        Insert: {
          admins_can_manage_all?: boolean
          allow_members_to_add_birthdays?: boolean
          allow_members_to_create_milestones?: boolean
          auto_generate_connect_prompts?: boolean
          club_id: string
          created_at?: string
          day_of_reminder?: boolean
          reminder_days_before?: number
          show_in_connect?: boolean
          show_on_home?: boolean
          show_on_profiles?: boolean
          updated_at?: string
        }
        Update: {
          admins_can_manage_all?: boolean
          allow_members_to_add_birthdays?: boolean
          allow_members_to_create_milestones?: boolean
          auto_generate_connect_prompts?: boolean
          club_id?: string
          created_at?: string
          day_of_reminder?: boolean
          reminder_days_before?: number
          show_in_connect?: boolean
          show_on_home?: boolean
          show_on_profiles?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_celebration_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_installed_assets: {
        Row: {
          asset_id: string
          club_id: string
          configuration_json: Json
          created_at: string
          enabled: boolean
          id: string
          installed_at: string
          installed_by: string | null
          sort_order: number
          updated_at: string
          visible_to_members: boolean
        }
        Insert: {
          asset_id: string
          club_id: string
          configuration_json?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          installed_at?: string
          installed_by?: string | null
          sort_order?: number
          updated_at?: string
          visible_to_members?: boolean
        }
        Update: {
          asset_id?: string
          club_id?: string
          configuration_json?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          installed_at?: string
          installed_by?: string | null
          sort_order?: number
          updated_at?: string
          visible_to_members?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "club_installed_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "platform_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_installed_assets_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          club_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_milestones: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          milestone_date: string
          recurrence: string
          title: string
          type: string
          updated_at: string
          user_id: string | null
          visibility: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          milestone_date: string
          recurrence?: string
          title: string
          type?: string
          updated_at?: string
          user_id?: string | null
          visibility?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          milestone_date?: string
          recurrence?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_milestones_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_milestones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_requests: {
        Row: {
          created_at: string
          id: string
          proposed_name: string
          reason: string | null
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_note: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          proposed_name: string
          reason?: string | null
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_note?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          proposed_name?: string
          reason?: string | null
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          accent_color: string
          banner_url: string | null
          created_at: string
          description: string | null
          id: string
          join_password: string | null
          logo_url: string | null
          name: string
          owner_admin_id: string | null
          password_visible: boolean
          settings: Json
          slug: string
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          accent_color?: string
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          join_password?: string | null
          logo_url?: string | null
          name: string
          owner_admin_id?: string | null
          password_visible?: boolean
          settings?: Json
          slug: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          accent_color?: string
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          join_password?: string | null
          logo_url?: string | null
          name?: string
          owner_admin_id?: string | null
          password_visible?: boolean
          settings?: Json
          slug?: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_owner_admin_id_fkey"
            columns: ["owner_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_participants: {
        Row: {
          club_id: string
          draft_id: string
          id: string
          pick_order: number
          user_id: string
        }
        Insert: {
          club_id?: string
          draft_id: string
          id?: string
          pick_order: number
          user_id: string
        }
        Update: {
          club_id?: string
          draft_id?: string
          id?: string
          pick_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_participants_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_participants_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_pick_disputes: {
        Row: {
          club_id: string
          commissioner_rationale: string | null
          created_at: string
          draft_id: string
          id: string
          pick_id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          club_id?: string
          commissioner_rationale?: string | null
          created_at?: string
          draft_id: string
          id?: string
          pick_id: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          club_id?: string
          commissioner_rationale?: string | null
          created_at?: string
          draft_id?: string
          id?: string
          pick_id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_pick_disputes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_picks: {
        Row: {
          club_id: string
          draft_id: string
          id: string
          pick_number: number
          pick_text: string
          picked_at: string
          round: number
          user_id: string
        }
        Insert: {
          club_id?: string
          draft_id: string
          id?: string
          pick_number: number
          pick_text: string
          picked_at?: string
          round: number
          user_id: string
        }
        Update: {
          club_id?: string
          draft_id?: string
          id?: string
          pick_number?: number
          pick_text?: string
          picked_at?: string
          round?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_picks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_playoff_matches: {
        Row: {
          club_id: string
          created_at: string
          draft_id: string | null
          id: string
          match_number: number
          round: string
          season_id: string
          seed_a: number
          seed_b: number
          status: string
          topic_picker_user_id: string | null
          updated_at: string
          user_a: string | null
          user_b: string | null
          winner_user_id: string | null
        }
        Insert: {
          club_id?: string
          created_at?: string
          draft_id?: string | null
          id?: string
          match_number?: number
          round: string
          season_id: string
          seed_a: number
          seed_b: number
          status?: string
          topic_picker_user_id?: string | null
          updated_at?: string
          user_a?: string | null
          user_b?: string | null
          winner_user_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          draft_id?: string | null
          id?: string
          match_number?: number
          round?: string
          season_id?: string
          seed_a?: number
          seed_b?: number
          status?: string
          topic_picker_user_id?: string | null
          updated_at?: string
          user_a?: string | null
          user_b?: string | null
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_playoff_matches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_playoff_matches_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_playoff_matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "draft_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_results: {
        Row: {
          club_id: string
          created_at: string
          draft_id: string
          id: string
          pick_ratings: Json
          points_awarded: number
          rank: number
          summary: string | null
          total_score: number
          user_id: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          draft_id: string
          id?: string
          pick_ratings?: Json
          points_awarded?: number
          rank: number
          summary?: string | null
          total_score?: number
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          draft_id?: string
          id?: string
          pick_ratings?: Json
          points_awarded?: number
          rank?: number
          summary?: string | null
          total_score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_results_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_results_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_season_acknowledgements: {
        Row: {
          acknowledged_at: string
          club_id: string
          created_at: string
          id: string
          season_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          club_id: string
          created_at?: string
          id?: string
          season_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          club_id?: string
          created_at?: string
          id?: string
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_season_acknowledgements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_season_acknowledgements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "draft_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_season_entries: {
        Row: {
          club_id: string
          created_at: string
          draft_id: string
          id: string
          is_playoff: boolean
          season_id: string
          season_points_awarded: Json
          week_number: number
        }
        Insert: {
          club_id?: string
          created_at?: string
          draft_id: string
          id?: string
          is_playoff?: boolean
          season_id: string
          season_points_awarded?: Json
          week_number: number
        }
        Update: {
          club_id?: string
          created_at?: string
          draft_id?: string
          id?: string
          is_playoff?: boolean
          season_id?: string
          season_points_awarded?: Json
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_season_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_season_entries_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: true
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_season_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "draft_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_season_intros: {
        Row: {
          ai_judging_notes: Json
          call_to_action_label: string
          changes: Json
          club_id: string
          commissioner_message: string | null
          created_at: string
          dispute_notes: Json
          hero_summary: string | null
          id: string
          important_dates: Json
          is_active: boolean
          scoring_notes: Json
          season_format: Json
          season_id: string
          season_subtitle: string | null
          season_theme: string | null
          updated_at: string
        }
        Insert: {
          ai_judging_notes?: Json
          call_to_action_label?: string
          changes?: Json
          club_id: string
          commissioner_message?: string | null
          created_at?: string
          dispute_notes?: Json
          hero_summary?: string | null
          id?: string
          important_dates?: Json
          is_active?: boolean
          scoring_notes?: Json
          season_format?: Json
          season_id: string
          season_subtitle?: string | null
          season_theme?: string | null
          updated_at?: string
        }
        Update: {
          ai_judging_notes?: Json
          call_to_action_label?: string
          changes?: Json
          club_id?: string
          commissioner_message?: string | null
          created_at?: string
          dispute_notes?: Json
          hero_summary?: string | null
          id?: string
          important_dates?: Json
          is_active?: boolean
          scoring_notes?: Json
          season_format?: Json
          season_id?: string
          season_subtitle?: string | null
          season_theme?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_season_intros_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_season_intros_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: true
            referencedRelation: "draft_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_season_standings: {
        Row: {
          avg_finish: number
          avg_score: number
          best_score: number
          club_id: string
          consistency: number
          drafts_played: number
          id: string
          is_eliminated: boolean
          playoff_seed: number | null
          podiums: number
          rank: number | null
          season_id: string
          season_points: number
          updated_at: string
          user_id: string
          wins: number
          worst_score: number
        }
        Insert: {
          avg_finish?: number
          avg_score?: number
          best_score?: number
          club_id?: string
          consistency?: number
          drafts_played?: number
          id?: string
          is_eliminated?: boolean
          playoff_seed?: number | null
          podiums?: number
          rank?: number | null
          season_id: string
          season_points?: number
          updated_at?: string
          user_id: string
          wins?: number
          worst_score?: number
        }
        Update: {
          avg_finish?: number
          avg_score?: number
          best_score?: number
          club_id?: string
          consistency?: number
          drafts_played?: number
          id?: string
          is_eliminated?: boolean
          playoff_seed?: number | null
          podiums?: number
          rank?: number | null
          season_id?: string
          season_points?: number
          updated_at?: string
          user_id?: string
          wins?: number
          worst_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_season_standings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_season_standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "draft_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_season_standings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_seasons: {
        Row: {
          archived_at: string | null
          best_of: number
          champion_user_id: string | null
          club_id: string
          commissioner_user_id: string | null
          created_at: string
          ends_at: string
          id: string
          name: string
          playoff_weeks: number
          regular_season_champion_user_id: string | null
          regular_season_drafts: number
          regular_season_weeks: number
          runner_up_user_id: string | null
          season_label: string | null
          season_number: number | null
          starts_at: string
          status: string
          subtitle: string | null
          summary: Json | null
          third_place_user_id: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          archived_at?: string | null
          best_of?: number
          champion_user_id?: string | null
          club_id?: string
          commissioner_user_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          name: string
          playoff_weeks?: number
          regular_season_champion_user_id?: string | null
          regular_season_drafts?: number
          regular_season_weeks?: number
          runner_up_user_id?: string | null
          season_label?: string | null
          season_number?: number | null
          starts_at: string
          status?: string
          subtitle?: string | null
          summary?: Json | null
          third_place_user_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          archived_at?: string | null
          best_of?: number
          champion_user_id?: string | null
          club_id?: string
          commissioner_user_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          playoff_weeks?: number
          regular_season_champion_user_id?: string | null
          regular_season_drafts?: number
          regular_season_weeks?: number
          runner_up_user_id?: string | null
          season_label?: string | null
          season_number?: number | null
          starts_at?: string
          status?: string
          subtitle?: string | null
          summary?: Json | null
          third_place_user_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_seasons_champion_user_id_fkey"
            columns: ["champion_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_seasons_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_seasons_commissioner_user_id_fkey"
            columns: ["commissioner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_seasons_regular_season_champion_user_id_fkey"
            columns: ["regular_season_champion_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_seasons_runner_up_user_id_fkey"
            columns: ["runner_up_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_seasons_third_place_user_id_fkey"
            columns: ["third_place_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          ai_context: string | null
          ai_context_override: string | null
          ai_context_updated_at: string | null
          ai_context_updated_by: string | null
          category: string | null
          club_id: string
          competition_id: string
          created_at: string
          created_by: string
          current_pick_number: number
          current_pick_user_id: string | null
          current_round: number
          id: string
          num_rounds: number
          status: string
          timer_seconds: number | null
          topic: string
          updated_at: string
        }
        Insert: {
          ai_context?: string | null
          ai_context_override?: string | null
          ai_context_updated_at?: string | null
          ai_context_updated_by?: string | null
          category?: string | null
          club_id?: string
          competition_id: string
          created_at?: string
          created_by: string
          current_pick_number?: number
          current_pick_user_id?: string | null
          current_round?: number
          id?: string
          num_rounds?: number
          status?: string
          timer_seconds?: number | null
          topic: string
          updated_at?: string
        }
        Update: {
          ai_context?: string | null
          ai_context_override?: string | null
          ai_context_updated_at?: string | null
          ai_context_updated_by?: string | null
          category?: string | null
          club_id?: string
          competition_id?: string
          created_at?: string
          created_by?: string
          current_pick_number?: number
          current_pick_user_id?: string | null
          current_round?: number
          id?: string
          num_rounds?: number
          status?: string
          timer_seconds?: number | null
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_current_pick_user_id_fkey"
            columns: ["current_pick_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_comments: {
        Row: {
          club_id: string
          content: string
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          club_id?: string
          content: string
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          club_id?: string
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          club_id: string
          created_at: string
          event_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          event_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          id: string
          linked_poll_id: string | null
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          id?: string
          linked_poll_id?: string | null
          location?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          linked_poll_id?: string | null
          location?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_linked_poll_id_fkey"
            columns: ["linked_poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      game_external_mappings: {
        Row: {
          created_at: string
          external_game_id: string
          external_region: string | null
          external_round_name: string | null
          game_id: string
          id: string
          provider_name: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_game_id: string
          external_region?: string | null
          external_round_name?: string | null
          game_id: string
          id?: string
          provider_name: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_game_id?: string
          external_region?: string | null
          external_round_name?: string | null
          game_id?: string
          id?: string
          provider_name?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_external_mappings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_external_mappings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      game_state_history: {
        Row: {
          changed_at: string
          changed_by_source: string
          game_id: string
          id: string
          new_score: Json | null
          new_status: string | null
          new_winner_team_id: string | null
          previous_score: Json | null
          previous_status: string | null
          previous_winner_team_id: string | null
          sync_run_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by_source: string
          game_id: string
          id?: string
          new_score?: Json | null
          new_status?: string | null
          new_winner_team_id?: string | null
          previous_score?: Json | null
          previous_status?: string | null
          previous_winner_team_id?: string | null
          sync_run_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by_source?: string
          game_id?: string
          id?: string
          new_score?: Json | null
          new_status?: string | null
          new_winner_team_id?: string | null
          previous_score?: Json | null
          previous_status?: string | null
          previous_winner_team_id?: string | null
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_state_history_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_history_new_winner_team_id_fkey"
            columns: ["new_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_history_previous_winner_team_id_fkey"
            columns: ["previous_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_state_history_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          game_slot: number
          id: string
          is_result_final: boolean
          live_clock: string | null
          live_period: string | null
          region: string
          round_name: string
          round_number: number
          scheduled_at: string | null
          source_last_updated_at: string | null
          source_payload: Json | null
          status: string | null
          team1_id: string | null
          team1_score: number | null
          team2_id: string | null
          team2_score: number | null
          tournament_id: string
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          created_at?: string
          game_slot: number
          id?: string
          is_result_final?: boolean
          live_clock?: string | null
          live_period?: string | null
          region: string
          round_name: string
          round_number: number
          scheduled_at?: string | null
          source_last_updated_at?: string | null
          source_payload?: Json | null
          status?: string | null
          team1_id?: string | null
          team1_score?: number | null
          team2_id?: string | null
          team2_score?: number | null
          tournament_id: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          created_at?: string
          game_slot?: number
          id?: string
          is_result_final?: boolean
          live_clock?: string | null
          live_period?: string | null
          region?: string
          round_name?: string
          round_number?: number
          scheduled_at?: string | null
          source_last_updated_at?: string | null
          source_payload?: Json | null
          status?: string | null
          team1_id?: string | null
          team1_score?: number | null
          team2_id?: string | null
          team2_score?: number | null
          tournament_id?: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          club_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          club_id?: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          club_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      item_enrichments: {
        Row: {
          category: string | null
          confidence: number | null
          created_at: string
          id: string
          image_url: string | null
          item_id: string
          item_type: string
          matched_name: string | null
          metadata: Json | null
          normalized_name: string | null
          source_provider: string | null
          status: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          item_id: string
          item_type?: string
          matched_name?: string | null
          metadata?: Json | null
          normalized_name?: string | null
          source_provider?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          item_id?: string
          item_type?: string
          matched_name?: string | null
          metadata?: Json | null
          normalized_name?: string | null
          source_provider?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      journey_acts: {
        Row: {
          act_key: string
          author_notes: string | null
          campaign_id: string
          created_at: string
          display_order: number
          id: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          act_key: string
          author_notes?: string | null
          campaign_id: string
          created_at?: string
          display_order?: number
          id?: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          act_key?: string
          author_notes?: string | null
          campaign_id?: string
          created_at?: string
          display_order?: number
          id?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_acts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_campaign_releases: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          package: Json
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          package: Json
          version: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          package?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "journey_campaign_releases_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_campaign_runs: {
        Row: {
          campaign_id: string
          campaign_version: number
          character_id: string | null
          completed_at: string | null
          created_at: string
          current_chapter_key: string | null
          current_scene_key: string | null
          ending_key: string | null
          id: string
          is_test_run: boolean
          last_played_at: string
          playtime_seconds: number
          run_number: number
          started_at: string
          state: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          campaign_version?: number
          character_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_chapter_key?: string | null
          current_scene_key?: string | null
          ending_key?: string | null
          id?: string
          is_test_run?: boolean
          last_played_at?: string
          playtime_seconds?: number
          run_number?: number
          started_at?: string
          state?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          campaign_version?: number
          character_id?: string | null
          completed_at?: string | null
          created_at?: string
          current_chapter_key?: string | null
          current_scene_key?: string | null
          ending_key?: string | null
          id?: string
          is_test_run?: boolean
          last_played_at?: string
          playtime_seconds?: number
          run_number?: number
          started_at?: string
          state?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_campaign_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_campaign_runs_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "journey_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_campaign_variables: {
        Row: {
          author_notes: string | null
          campaign_id: string
          created_at: string
          default_value: Json | null
          enum_values: string[] | null
          id: string
          label: string | null
          updated_at: string
          value_type: string
          variable_key: string
        }
        Insert: {
          author_notes?: string | null
          campaign_id: string
          created_at?: string
          default_value?: Json | null
          enum_values?: string[] | null
          id?: string
          label?: string | null
          updated_at?: string
          value_type?: string
          variable_key: string
        }
        Update: {
          author_notes?: string | null
          campaign_id?: string
          created_at?: string
          default_value?: Json | null
          enum_values?: string[] | null
          id?: string
          label?: string | null
          updated_at?: string
          value_type?: string
          variable_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_campaign_variables_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_campaigns: {
        Row: {
          author: string | null
          author_notes: string | null
          config: Json
          content_notes: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_length: string | null
          hero_image: string | null
          id: string
          minimum_level: number
          published_at: string | null
          recommended_level: number
          slug: string
          starting_scene_key: string | null
          status: string
          subtitle: string | null
          tags: string[]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          author?: string | null
          author_notes?: string | null
          config?: Json
          content_notes?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_length?: string | null
          hero_image?: string | null
          id?: string
          minimum_level?: number
          published_at?: string | null
          recommended_level?: number
          slug: string
          starting_scene_key?: string | null
          status?: string
          subtitle?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          author?: string | null
          author_notes?: string | null
          config?: Json
          content_notes?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_length?: string | null
          hero_image?: string | null
          id?: string
          minimum_level?: number
          published_at?: string | null
          recommended_level?: number
          slug?: string
          starting_scene_key?: string | null
          status?: string
          subtitle?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      journey_chapters: {
        Row: {
          act_id: string | null
          artwork: string | null
          author_notes: string | null
          campaign_id: string
          chapter_key: string
          created_at: string
          display_order: number
          id: string
          intro_text: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          act_id?: string | null
          artwork?: string | null
          author_notes?: string | null
          campaign_id: string
          chapter_key: string
          created_at?: string
          display_order?: number
          id?: string
          intro_text?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          act_id?: string | null
          artwork?: string | null
          author_notes?: string | null
          campaign_id?: string
          chapter_key?: string
          created_at?: string
          display_order?: number
          id?: string
          intro_text?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_chapters_act_id_fkey"
            columns: ["act_id"]
            isOneToOne: false
            referencedRelation: "journey_acts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_chapters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_characters: {
        Row: {
          abilities: string[]
          background: string | null
          created_at: string
          currency: number
          equipment: Json
          health: number
          id: string
          level: number
          max_health: number
          name: string
          origin: string | null
          portrait: string | null
          pronouns: string | null
          stats: Json
          traits: string[]
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          abilities?: string[]
          background?: string | null
          created_at?: string
          currency?: number
          equipment?: Json
          health?: number
          id?: string
          level?: number
          max_health?: number
          name: string
          origin?: string | null
          portrait?: string | null
          pronouns?: string | null
          stats?: Json
          traits?: string[]
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          abilities?: string[]
          background?: string | null
          created_at?: string
          currency?: number
          equipment?: Json
          health?: number
          id?: string
          level?: number
          max_health?: number
          name?: string
          origin?: string | null
          portrait?: string | null
          pronouns?: string | null
          stats?: Json
          traits?: string[]
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      journey_choices: {
        Row: {
          author_notes: string | null
          campaign_id: string
          choice_key: string
          choice_style: string
          choice_text: string
          confirmation_required: boolean
          created_at: string
          description: string | null
          display_order: number
          effects: Json
          hidden_when_unavailable: boolean
          id: string
          locked_hint: string | null
          major_decision: boolean
          next_scene_key: string | null
          once_only: boolean
          requirements: Json | null
          scene_id: string
          short_label: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          author_notes?: string | null
          campaign_id: string
          choice_key: string
          choice_style?: string
          choice_text: string
          confirmation_required?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          effects?: Json
          hidden_when_unavailable?: boolean
          id?: string
          locked_hint?: string | null
          major_decision?: boolean
          next_scene_key?: string | null
          once_only?: boolean
          requirements?: Json | null
          scene_id: string
          short_label?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          author_notes?: string | null
          campaign_id?: string
          choice_key?: string
          choice_style?: string
          choice_text?: string
          confirmation_required?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          effects?: Json
          hidden_when_unavailable?: boolean
          id?: string
          locked_hint?: string | null
          major_decision?: boolean
          next_scene_key?: string | null
          once_only?: boolean
          requirements?: Json | null
          scene_id?: string
          short_label?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_choices_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_choices_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "journey_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_codex_entries: {
        Row: {
          author_notes: string | null
          body: string | null
          campaign_id: string
          category: string
          codex_key: string
          created_at: string
          display_order: number
          id: string
          image: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_notes?: string | null
          body?: string | null
          campaign_id: string
          category?: string
          codex_key: string
          created_at?: string
          display_order?: number
          id?: string
          image?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_notes?: string | null
          body?: string | null
          campaign_id?: string
          category?: string
          codex_key?: string
          created_at?: string
          display_order?: number
          id?: string
          image?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_codex_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_combat_sessions: {
        Row: {
          created_at: string
          enemies: Json
          id: string
          log: Json
          player_state: Json
          round: number
          run_id: string
          scene_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enemies?: Json
          id?: string
          log?: Json
          player_state?: Json
          round?: number
          run_id: string
          scene_key: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enemies?: Json
          id?: string
          log?: Json
          player_state?: Json
          round?: number
          run_id?: string
          scene_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_combat_sessions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "journey_campaign_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_endings: {
        Row: {
          artwork: string | null
          author_notes: string | null
          campaign_id: string
          created_at: string
          description: string | null
          ending_key: string
          epilogue_blocks: Json
          id: string
          name: string
          priority: number
          requirements: Json | null
          spoiler_safe_label: string | null
          updated_at: string
        }
        Insert: {
          artwork?: string | null
          author_notes?: string | null
          campaign_id: string
          created_at?: string
          description?: string | null
          ending_key: string
          epilogue_blocks?: Json
          id?: string
          name: string
          priority?: number
          requirements?: Json | null
          spoiler_safe_label?: string | null
          updated_at?: string
        }
        Update: {
          artwork?: string | null
          author_notes?: string | null
          campaign_id?: string
          created_at?: string
          description?: string | null
          ending_key?: string
          epilogue_blocks?: Json
          id?: string
          name?: string
          priority?: number
          requirements?: Json | null
          spoiler_safe_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_endings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_enemies: {
        Row: {
          abilities: Json
          armor: number
          attack: number
          author_notes: string | null
          campaign_id: string
          created_at: string
          description: string | null
          enemy_key: string
          id: string
          max_health: number
          metadata: Json
          name: string
          portrait: string | null
          updated_at: string
        }
        Insert: {
          abilities?: Json
          armor?: number
          attack?: number
          author_notes?: string | null
          campaign_id: string
          created_at?: string
          description?: string | null
          enemy_key: string
          id?: string
          max_health?: number
          metadata?: Json
          name: string
          portrait?: string | null
          updated_at?: string
        }
        Update: {
          abilities?: Json
          armor?: number
          attack?: number
          author_notes?: string | null
          campaign_id?: string
          created_at?: string
          description?: string | null
          enemy_key?: string
          id?: string
          max_health?: number
          metadata?: Json
          name?: string
          portrait?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_enemies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_factions: {
        Row: {
          author_notes: string | null
          campaign_id: string
          created_at: string
          description: string | null
          faction_key: string
          id: string
          image: string | null
          name: string
          updated_at: string
        }
        Insert: {
          author_notes?: string | null
          campaign_id: string
          created_at?: string
          description?: string | null
          faction_key: string
          id?: string
          image?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          author_notes?: string | null
          campaign_id?: string
          created_at?: string
          description?: string | null
          faction_key?: string
          id?: string
          image?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_factions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_items: {
        Row: {
          author_notes: string | null
          campaign_id: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image: string | null
          item_key: string
          item_type: string
          max_stack: number
          metadata: Json
          name: string
          quest_item: boolean
          rarity: string
          stackable: boolean
          updated_at: string
          usable: boolean
        }
        Insert: {
          author_notes?: string | null
          campaign_id: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image?: string | null
          item_key: string
          item_type?: string
          max_stack?: number
          metadata?: Json
          name: string
          quest_item?: boolean
          rarity?: string
          stackable?: boolean
          updated_at?: string
          usable?: boolean
        }
        Update: {
          author_notes?: string | null
          campaign_id?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image?: string | null
          item_key?: string
          item_type?: string
          max_stack?: number
          metadata?: Json
          name?: string
          quest_item?: boolean
          rarity?: string
          stackable?: boolean
          updated_at?: string
          usable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "journey_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_locations: {
        Row: {
          ambient_audio: string | null
          author_notes: string | null
          campaign_id: string
          codex_key: string | null
          created_at: string
          description: string | null
          id: string
          image: string | null
          location_key: string
          map_position: Json | null
          metadata: Json
          name: string
          region: string | null
          updated_at: string
        }
        Insert: {
          ambient_audio?: string | null
          author_notes?: string | null
          campaign_id: string
          codex_key?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          location_key: string
          map_position?: Json | null
          metadata?: Json
          name: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          ambient_audio?: string | null
          author_notes?: string | null
          campaign_id?: string
          codex_key?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image?: string | null
          location_key?: string
          map_position?: Json | null
          metadata?: Json
          name?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_locations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_npcs: {
        Row: {
          author_notes: string | null
          biography: string | null
          campaign_id: string
          codex_key: string | null
          created_at: string
          description: string | null
          faction_key: string | null
          id: string
          metadata: Json
          name: string
          npc_key: string
          portrait: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_notes?: string | null
          biography?: string | null
          campaign_id: string
          codex_key?: string | null
          created_at?: string
          description?: string | null
          faction_key?: string | null
          id?: string
          metadata?: Json
          name: string
          npc_key: string
          portrait?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_notes?: string | null
          biography?: string | null
          campaign_id?: string
          codex_key?: string | null
          created_at?: string
          description?: string | null
          faction_key?: string | null
          id?: string
          metadata?: Json
          name?: string
          npc_key?: string
          portrait?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_npcs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_quests: {
        Row: {
          author_notes: string | null
          campaign_id: string
          created_at: string
          description: string | null
          hidden_until_discovered: boolean
          id: string
          objectives: Json
          quest_key: string
          quest_type: string
          rewards: Json
          title: string
          updated_at: string
        }
        Insert: {
          author_notes?: string | null
          campaign_id: string
          created_at?: string
          description?: string | null
          hidden_until_discovered?: boolean
          id?: string
          objectives?: Json
          quest_key: string
          quest_type?: string
          rewards?: Json
          title: string
          updated_at?: string
        }
        Update: {
          author_notes?: string | null
          campaign_id?: string
          created_at?: string
          description?: string | null
          hidden_until_discovered?: boolean
          id?: string
          objectives?: Json
          quest_key?: string
          quest_type?: string
          rewards?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_quests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_run_choice_history: {
        Row: {
          campaign_version: number
          choice_key: string | null
          choice_text_snapshot: string | null
          created_at: string
          id: string
          metadata: Json
          run_id: string
          scene_key: string
          user_id: string
        }
        Insert: {
          campaign_version?: number
          choice_key?: string | null
          choice_text_snapshot?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          run_id: string
          scene_key: string
          user_id: string
        }
        Update: {
          campaign_version?: number
          choice_key?: string | null
          choice_text_snapshot?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          run_id?: string
          scene_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_run_choice_history_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "journey_campaign_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_scene_blocks: {
        Row: {
          block_type: string
          campaign_id: string
          conditions: Json | null
          content: string | null
          created_at: string
          display_order: number
          id: string
          metadata: Json
          scene_id: string
          updated_at: string
        }
        Insert: {
          block_type: string
          campaign_id: string
          conditions?: Json | null
          content?: string | null
          created_at?: string
          display_order?: number
          id?: string
          metadata?: Json
          scene_id: string
          updated_at?: string
        }
        Update: {
          block_type?: string
          campaign_id?: string
          conditions?: Json | null
          content?: string | null
          created_at?: string
          display_order?: number
          id?: string
          metadata?: Json
          scene_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_scene_blocks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_scene_blocks_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "journey_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_scenes: {
        Row: {
          ambient_audio: string | null
          author_notes: string | null
          auto_next_scene_key: string | null
          background_asset: string | null
          campaign_id: string
          chapter_id: string | null
          created_at: string
          display_order: number
          ending_key: string | null
          entry_conditions: Json | null
          entry_effects: Json
          id: string
          is_routing_node: boolean
          is_terminal: boolean
          location_key: string | null
          music_track: string | null
          scene_key: string
          scene_type: string
          subtitle: string | null
          tags: string[]
          title: string | null
          updated_at: string
        }
        Insert: {
          ambient_audio?: string | null
          author_notes?: string | null
          auto_next_scene_key?: string | null
          background_asset?: string | null
          campaign_id: string
          chapter_id?: string | null
          created_at?: string
          display_order?: number
          ending_key?: string | null
          entry_conditions?: Json | null
          entry_effects?: Json
          id?: string
          is_routing_node?: boolean
          is_terminal?: boolean
          location_key?: string | null
          music_track?: string | null
          scene_key: string
          scene_type?: string
          subtitle?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Update: {
          ambient_audio?: string | null
          author_notes?: string | null
          auto_next_scene_key?: string | null
          background_asset?: string | null
          campaign_id?: string
          chapter_id?: string | null
          created_at?: string
          display_order?: number
          ending_key?: string | null
          entry_conditions?: Json | null
          entry_effects?: Json
          id?: string
          is_routing_node?: boolean
          is_terminal?: boolean
          location_key?: string | null
          music_track?: string | null
          scene_key?: string
          scene_type?: string
          subtitle?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_scenes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "journey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_scenes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "journey_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      lockbox_attempts: {
        Row: {
          attacker_id: string
          club_id: string
          id: string
          is_solved: boolean
          lock_id: string
          phase: string
          solved_at: string | null
          started_at: string
          total_attempts: number
          updated_at: string
        }
        Insert: {
          attacker_id: string
          club_id?: string
          id?: string
          is_solved?: boolean
          lock_id: string
          phase?: string
          solved_at?: string | null
          started_at?: string
          total_attempts?: number
          updated_at?: string
        }
        Update: {
          attacker_id?: string
          club_id?: string
          id?: string
          is_solved?: boolean
          lock_id?: string
          phase?: string
          solved_at?: string | null
          started_at?: string
          total_attempts?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockbox_attempts_attacker_id_fkey"
            columns: ["attacker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_attempts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_attempts_lock_id_fkey"
            columns: ["lock_id"]
            isOneToOne: false
            referencedRelation: "lockbox_locks"
            referencedColumns: ["id"]
          },
        ]
      }
      lockbox_guesses: {
        Row: {
          attempt_id: string
          club_id: string
          correct_position: number
          correct_value: number
          created_at: string
          guess_value: string
          id: string
          is_correct: boolean
          phase: string
        }
        Insert: {
          attempt_id: string
          club_id?: string
          correct_position?: number
          correct_value?: number
          created_at?: string
          guess_value: string
          id?: string
          is_correct?: boolean
          phase: string
        }
        Update: {
          attempt_id?: string
          club_id?: string
          correct_position?: number
          correct_value?: number
          created_at?: string
          guess_value?: string
          id?: string
          is_correct?: boolean
          phase?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockbox_guesses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "lockbox_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_guesses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      lockbox_locks: {
        Row: {
          club_id: string
          color_code: string
          created_at: string
          id: string
          is_cracked: boolean
          maze_grid: Json | null
          maze_id: number | null
          number_code: string
          user_id: string
          week_id: string
        }
        Insert: {
          club_id?: string
          color_code: string
          created_at?: string
          id?: string
          is_cracked?: boolean
          maze_grid?: Json | null
          maze_id?: number | null
          number_code: string
          user_id: string
          week_id: string
        }
        Update: {
          club_id?: string
          color_code?: string
          created_at?: string
          id?: string
          is_cracked?: boolean
          maze_grid?: Json | null
          maze_id?: number | null
          number_code?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockbox_locks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_locks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_locks_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "lockbox_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      lockbox_scores: {
        Row: {
          club_id: string
          crack_points: number
          created_at: string
          defense_points: number
          id: string
          rank: number | null
          total_points: number
          user_id: string
          week_id: string
        }
        Insert: {
          club_id?: string
          crack_points?: number
          created_at?: string
          defense_points?: number
          id?: string
          rank?: number | null
          total_points?: number
          user_id: string
          week_id: string
        }
        Update: {
          club_id?: string
          crack_points?: number
          created_at?: string
          defense_points?: number
          id?: string
          rank?: number | null
          total_points?: number
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockbox_scores_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_scores_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "lockbox_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      lockbox_weeks: {
        Row: {
          club_id: string
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          status: string
          week_number: number
          year: number
        }
        Insert: {
          club_id?: string
          created_at?: string
          ends_at: string
          id?: string
          starts_at: string
          status?: string
          week_number: number
          year: number
        }
        Update: {
          club_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          status?: string
          week_number?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "lockbox_weeks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      lore_contributions: {
        Row: {
          club_id: string
          content: string
          created_at: string
          id: string
          lore_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id?: string
          content: string
          created_at?: string
          id?: string
          lore_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          content?: string
          created_at?: string
          id?: string
          lore_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lore_contributions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lore_contributions_lore_id_fkey"
            columns: ["lore_id"]
            isOneToOne: false
            referencedRelation: "lore_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lore_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lore_entries: {
        Row: {
          club_id: string
          context: string
          created_at: string
          created_by: string
          era: string | null
          id: string
          image_url: string | null
          people_involved: string[] | null
          source_message_id: string | null
          status: string
          tags: string[] | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          club_id?: string
          context: string
          created_at?: string
          created_by: string
          era?: string | null
          id?: string
          image_url?: string | null
          people_involved?: string[] | null
          source_message_id?: string | null
          status?: string
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          context?: string
          created_at?: string
          created_by?: string
          era?: string | null
          id?: string
          image_url?: string | null
          people_involved?: string[] | null
          source_message_id?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lore_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lore_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lore_reactions: {
        Row: {
          club_id: string
          created_at: string
          id: string
          lore_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          id?: string
          lore_id: string
          reaction: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          lore_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lore_reactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lore_reactions_lore_id_fkey"
            columns: ["lore_id"]
            isOneToOne: false
            referencedRelation: "lore_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lore_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_birthdays: {
        Row: {
          birth_day: number
          birth_month: number
          birth_year: number | null
          club_id: string
          created_at: string
          id: string
          reminder_opt_in: boolean
          show_age: boolean
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          birth_day: number
          birth_month: number
          birth_year?: number | null
          club_id: string
          created_at?: string
          id?: string
          reminder_opt_in?: boolean
          show_age?: boolean
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          birth_day?: number
          birth_month?: number
          birth_year?: number | null
          club_id?: string
          created_at?: string
          id?: string
          reminder_opt_in?: boolean
          show_age?: boolean
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_birthdays_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_birthdays_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_link_previews: {
        Row: {
          club_id: string
          content_type: string
          created_at: string
          description: string | null
          embed_id: string | null
          embed_type: string | null
          fetched_at: string | null
          id: string
          image_url: string | null
          message_id: string
          site_name: string | null
          title: string | null
          url: string
        }
        Insert: {
          club_id?: string
          content_type?: string
          created_at?: string
          description?: string | null
          embed_id?: string | null
          embed_type?: string | null
          fetched_at?: string | null
          id?: string
          image_url?: string | null
          message_id: string
          site_name?: string | null
          title?: string | null
          url: string
        }
        Update: {
          club_id?: string
          content_type?: string
          created_at?: string
          description?: string | null
          embed_id?: string | null
          embed_type?: string | null
          fetched_at?: string | null
          id?: string
          image_url?: string | null
          message_id?: string
          site_name?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_link_previews_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_link_previews_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          club_id: string
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reports: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_id: string
          club_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_pinned: boolean
          parent_message_id: string | null
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          club_id?: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_pinned?: boolean
          parent_message_id?: string | null
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          club_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_pinned?: boolean
          parent_message_id?: string | null
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_ai_suggestions: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          prompt_context: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scene_id: string | null
          status: string
          suggested_content: string | null
          suggested_state_updates: Json
          suggestion_type: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_context?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scene_id?: string | null
          status?: string
          suggested_content?: string | null
          suggested_state_updates?: Json
          suggestion_type: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_context?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scene_id?: string | null
          status?: string
          suggested_content?: string | null
          suggested_state_updates?: Json
          suggestion_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_ai_suggestions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_ai_suggestions_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "narrative_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_approval_events: {
        Row: {
          actor_id: string | null
          campaign_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          notes: string | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          campaign_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          campaign_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "narrative_approval_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_campaign_members: {
        Row: {
          campaign_id: string
          id: string
          invited_by: string | null
          joined_at: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_campaigns: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          canon_locks: Json
          club_id: string
          content_notes: string | null
          created_at: string
          created_by: string
          current_chapter_id: string | null
          current_scene_id: string | null
          description: string | null
          gm_id: string | null
          id: string
          live_session_id: string | null
          live_started_at: string | null
          memory_summary: string | null
          opening_premise: string | null
          pitch: string | null
          play_mode: string
          player_limit: number | null
          proposed_gm_id: string | null
          schedule_note: string | null
          slug: string | null
          spectators_allowed: boolean
          status: string
          submitted_at: string | null
          template_key: string
          title: string
          tone_profile: string | null
          updated_at: string
          visibility: string
          waiting_on_state: Json
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          canon_locks?: Json
          club_id: string
          content_notes?: string | null
          created_at?: string
          created_by: string
          current_chapter_id?: string | null
          current_scene_id?: string | null
          description?: string | null
          gm_id?: string | null
          id?: string
          live_session_id?: string | null
          live_started_at?: string | null
          memory_summary?: string | null
          opening_premise?: string | null
          pitch?: string | null
          play_mode?: string
          player_limit?: number | null
          proposed_gm_id?: string | null
          schedule_note?: string | null
          slug?: string | null
          spectators_allowed?: boolean
          status?: string
          submitted_at?: string | null
          template_key?: string
          title: string
          tone_profile?: string | null
          updated_at?: string
          visibility?: string
          waiting_on_state?: Json
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          canon_locks?: Json
          club_id?: string
          content_notes?: string | null
          created_at?: string
          created_by?: string
          current_chapter_id?: string | null
          current_scene_id?: string | null
          description?: string | null
          gm_id?: string | null
          id?: string
          live_session_id?: string | null
          live_started_at?: string | null
          memory_summary?: string | null
          opening_premise?: string | null
          pitch?: string | null
          play_mode?: string
          player_limit?: number | null
          proposed_gm_id?: string | null
          schedule_note?: string | null
          slug?: string | null
          spectators_allowed?: boolean
          status?: string
          submitted_at?: string | null
          template_key?: string
          title?: string
          tone_profile?: string | null
          updated_at?: string
          visibility?: string
          waiting_on_state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "narrative_campaigns_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_chapters: {
        Row: {
          campaign_id: string
          created_at: string
          description: string | null
          id: string
          position: number
          status: string
          title: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          status?: string
          title: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_chapters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_characters: {
        Row: {
          archetype: string | null
          avatar_url: string | null
          backstory: string | null
          campaign_id: string
          conditions: Json
          created_at: string
          flaw: string | null
          goal: string | null
          id: string
          inventory: Json
          is_retired: boolean
          name: string
          notes_private: string | null
          notes_public: string | null
          owner_id: string
          personality: string | null
          pronouns: string | null
          signature_move: string | null
          stat_chaos: number
          stat_charm: number
          stat_cunning: number
          stat_focus: number
          stat_grit: number
          updated_at: string
        }
        Insert: {
          archetype?: string | null
          avatar_url?: string | null
          backstory?: string | null
          campaign_id: string
          conditions?: Json
          created_at?: string
          flaw?: string | null
          goal?: string | null
          id?: string
          inventory?: Json
          is_retired?: boolean
          name: string
          notes_private?: string | null
          notes_public?: string | null
          owner_id: string
          personality?: string | null
          pronouns?: string | null
          signature_move?: string | null
          stat_chaos?: number
          stat_charm?: number
          stat_cunning?: number
          stat_focus?: number
          stat_grit?: number
          updated_at?: string
        }
        Update: {
          archetype?: string | null
          avatar_url?: string | null
          backstory?: string | null
          campaign_id?: string
          conditions?: Json
          created_at?: string
          flaw?: string | null
          goal?: string | null
          id?: string
          inventory?: Json
          is_retired?: boolean
          name?: string
          notes_private?: string | null
          notes_public?: string | null
          owner_id?: string
          personality?: string | null
          pronouns?: string | null
          signature_move?: string | null
          stat_chaos?: number
          stat_charm?: number
          stat_cunning?: number
          stat_focus?: number
          stat_grit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_clocks: {
        Row: {
          campaign_id: string
          clock_type: string
          created_at: string
          created_by: string | null
          current_value: number
          description: string | null
          history: Json
          id: string
          max_value: number
          name: string
          related_faction_id: string | null
          related_location_id: string | null
          related_npc_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          campaign_id: string
          clock_type?: string
          created_at?: string
          created_by?: string | null
          current_value?: number
          description?: string | null
          history?: Json
          id?: string
          max_value?: number
          name: string
          related_faction_id?: string | null
          related_location_id?: string | null
          related_npc_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          campaign_id?: string
          clock_type?: string
          created_at?: string
          created_by?: string | null
          current_value?: number
          description?: string | null
          history?: Json
          id?: string
          max_value?: number
          name?: string
          related_faction_id?: string | null
          related_location_id?: string | null
          related_npc_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_clocks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_clocks_related_faction_id_fkey"
            columns: ["related_faction_id"]
            isOneToOne: false
            referencedRelation: "narrative_factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_clocks_related_location_id_fkey"
            columns: ["related_location_id"]
            isOneToOne: false
            referencedRelation: "narrative_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_clocks_related_npc_id_fkey"
            columns: ["related_npc_id"]
            isOneToOne: false
            referencedRelation: "narrative_npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_clues: {
        Row: {
          campaign_id: string
          created_at: string
          description: string | null
          discovered_by: string | null
          id: string
          importance: string
          metadata: Json
          name: string
          related_faction_id: string | null
          related_npc_id: string | null
          status: string
          visibility: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string | null
          discovered_by?: string | null
          id?: string
          importance?: string
          metadata?: Json
          name: string
          related_faction_id?: string | null
          related_npc_id?: string | null
          status?: string
          visibility?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string | null
          discovered_by?: string | null
          id?: string
          importance?: string
          metadata?: Json
          name?: string
          related_faction_id?: string | null
          related_npc_id?: string | null
          status?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_clues_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_clues_related_faction_fkey"
            columns: ["related_faction_id"]
            isOneToOne: false
            referencedRelation: "narrative_factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_clues_related_npc_id_fkey"
            columns: ["related_npc_id"]
            isOneToOne: false
            referencedRelation: "narrative_npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_factions: {
        Row: {
          attitude: string | null
          campaign_id: string
          created_at: string
          description: string | null
          gm_notes: string | null
          id: string
          metadata: Json
          name: string
          public_notes: string | null
          relationship_score: number
          suspicion_score: number
          updated_at: string
          visibility: string
        }
        Insert: {
          attitude?: string | null
          campaign_id: string
          created_at?: string
          description?: string | null
          gm_notes?: string | null
          id?: string
          metadata?: Json
          name: string
          public_notes?: string | null
          relationship_score?: number
          suspicion_score?: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          attitude?: string | null
          campaign_id?: string
          created_at?: string
          description?: string | null
          gm_notes?: string | null
          id?: string
          metadata?: Json
          name?: string
          public_notes?: string | null
          relationship_score?: number
          suspicion_score?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_factions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_gm_notes: {
        Row: {
          author_id: string | null
          body: string
          campaign_id: string
          created_at: string
          id: string
          pinned: boolean
          scene_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          campaign_id: string
          created_at?: string
          id?: string
          pinned?: boolean
          scene_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          campaign_id?: string
          created_at?: string
          id?: string
          pinned?: boolean
          scene_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_gm_notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_gm_notes_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "narrative_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_items: {
        Row: {
          campaign_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          owner_character_id: string | null
          related_scene_id: string | null
          use_notes: string | null
          visibility: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          owner_character_id?: string | null
          related_scene_id?: string | null
          use_notes?: string | null
          visibility?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          owner_character_id?: string | null
          related_scene_id?: string | null
          use_notes?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_items_owner_character_id_fkey"
            columns: ["owner_character_id"]
            isOneToOne: false
            referencedRelation: "narrative_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_items_related_scene_id_fkey"
            columns: ["related_scene_id"]
            isOneToOne: false
            referencedRelation: "narrative_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_locations: {
        Row: {
          campaign_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json
          name: string
          region: string | null
          visibility: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          region?: string | null
          visibility?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          region?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_locations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_memory: {
        Row: {
          active_characters: Json
          active_npcs: Json
          campaign_id: string
          canon_locks: Json
          current_location: string | null
          current_objective: string | null
          current_state: string | null
          gm_only_notes: string | null
          important_quotes: Json
          major_decisions: Json
          running_jokes: Json
          tone_guide: string | null
          unresolved: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_characters?: Json
          active_npcs?: Json
          campaign_id: string
          canon_locks?: Json
          current_location?: string | null
          current_objective?: string | null
          current_state?: string | null
          gm_only_notes?: string | null
          important_quotes?: Json
          major_decisions?: Json
          running_jokes?: Json
          tone_guide?: string | null
          unresolved?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_characters?: Json
          active_npcs?: Json
          campaign_id?: string
          canon_locks?: Json
          current_location?: string | null
          current_objective?: string | null
          current_state?: string | null
          gm_only_notes?: string | null
          important_quotes?: Json
          major_decisions?: Json
          running_jokes?: Json
          tone_guide?: string | null
          unresolved?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "narrative_memory_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_messages: {
        Row: {
          body: string | null
          campaign_id: string
          character_id: string | null
          created_at: string
          edited_at: string | null
          id: string
          message_type: string
          metadata: Json
          npc_id: string | null
          scene_id: string | null
          sender_id: string | null
          visibility: string
        }
        Insert: {
          body?: string | null
          campaign_id: string
          character_id?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          message_type?: string
          metadata?: Json
          npc_id?: string | null
          scene_id?: string | null
          sender_id?: string | null
          visibility?: string
        }
        Update: {
          body?: string | null
          campaign_id?: string
          character_id?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          message_type?: string
          metadata?: Json
          npc_id?: string | null
          scene_id?: string | null
          sender_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_messages_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "narrative_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_messages_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "narrative_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_npcs: {
        Row: {
          campaign_id: string
          created_at: string
          description: string | null
          id: string
          location: string | null
          metadata: Json
          motives: string | null
          name: string
          relationship: string | null
          role: string | null
          secrets: string | null
          updated_at: string
          visibility: string
          voice_notes: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          metadata?: Json
          motives?: string | null
          name: string
          relationship?: string | null
          role?: string | null
          secrets?: string | null
          updated_at?: string
          visibility?: string
          voice_notes?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          metadata?: Json
          motives?: string | null
          name?: string
          relationship?: string | null
          role?: string | null
          secrets?: string | null
          updated_at?: string
          visibility?: string
          voice_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "narrative_npcs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_rolls: {
        Row: {
          advantage: string
          campaign_id: string
          character_id: string | null
          created_at: string
          d20: number
          difficulty: number
          id: string
          message_id: string | null
          modifier: number
          outcome: string
          reason: string | null
          resolution: string | null
          roller_id: string | null
          scene_id: string | null
          stat: string
          total: number
          visibility: string
        }
        Insert: {
          advantage?: string
          campaign_id: string
          character_id?: string | null
          created_at?: string
          d20: number
          difficulty?: number
          id?: string
          message_id?: string | null
          modifier?: number
          outcome: string
          reason?: string | null
          resolution?: string | null
          roller_id?: string | null
          scene_id?: string | null
          stat: string
          total: number
          visibility?: string
        }
        Update: {
          advantage?: string
          campaign_id?: string
          character_id?: string | null
          created_at?: string
          d20?: number
          difficulty?: number
          id?: string
          message_id?: string | null
          modifier?: number
          outcome?: string
          reason?: string | null
          resolution?: string | null
          roller_id?: string | null
          scene_id?: string | null
          stat?: string
          total?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_rolls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_rolls_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "narrative_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_rolls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "narrative_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_rolls_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "narrative_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_scenes: {
        Row: {
          campaign_id: string
          chapter_id: string | null
          created_by: string | null
          ended_at: string | null
          gm_notes: string | null
          id: string
          location: string | null
          objective: string | null
          position: number
          public_notes: string | null
          stakes: string | null
          started_at: string
          status: string
          title: string
        }
        Insert: {
          campaign_id: string
          chapter_id?: string | null
          created_by?: string | null
          ended_at?: string | null
          gm_notes?: string | null
          id?: string
          location?: string | null
          objective?: string | null
          position?: number
          public_notes?: string | null
          stakes?: string | null
          started_at?: string
          status?: string
          title: string
        }
        Update: {
          campaign_id?: string
          chapter_id?: string | null
          created_by?: string | null
          ended_at?: string | null
          gm_notes?: string | null
          id?: string
          location?: string | null
          objective?: string | null
          position?: number
          public_notes?: string | null
          stakes?: string | null
          started_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_scenes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_scenes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "narrative_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_summaries: {
        Row: {
          approved_by: string | null
          body: string
          campaign_id: string
          chapter_id: string | null
          created_at: string
          generated_by_ai: boolean
          id: string
          scene_id: string | null
          title: string | null
          visibility: string
        }
        Insert: {
          approved_by?: string | null
          body: string
          campaign_id: string
          chapter_id?: string | null
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          scene_id?: string | null
          title?: string | null
          visibility?: string
        }
        Update: {
          approved_by?: string | null
          body?: string
          campaign_id?: string
          chapter_id?: string | null
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          scene_id?: string | null
          title?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_summaries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "narrative_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_summaries_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "narrative_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_summaries_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "narrative_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      nexus_boosts: {
        Row: {
          code: string
          cost_tokens: number
          created_at: string
          description: string
          effect_config: Json
          icon: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          cost_tokens?: number
          created_at?: string
          description: string
          effect_config?: Json
          icon?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          cost_tokens?: number
          created_at?: string
          description?: string
          effect_config?: Json
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      nexus_mission_calibrations: {
        Row: {
          base_hp_delta: number
          boss_hp_mult: number
          boss_shield_mult: number
          created_at: string
          enemy_hp_mult: number
          enemy_shield_mult: number
          enemy_speed_mult: number
          mission_id: number
          notes: string | null
          reward_cores_delta: number
          spawn_count_mult: number
          spawn_delay_mult: number
          spawn_interval_mult: number
          start_energy_delta: number
          updated_at: string
          updated_by: string | null
          wave_reward_mult: number
        }
        Insert: {
          base_hp_delta?: number
          boss_hp_mult?: number
          boss_shield_mult?: number
          created_at?: string
          enemy_hp_mult?: number
          enemy_shield_mult?: number
          enemy_speed_mult?: number
          mission_id: number
          notes?: string | null
          reward_cores_delta?: number
          spawn_count_mult?: number
          spawn_delay_mult?: number
          spawn_interval_mult?: number
          start_energy_delta?: number
          updated_at?: string
          updated_by?: string | null
          wave_reward_mult?: number
        }
        Update: {
          base_hp_delta?: number
          boss_hp_mult?: number
          boss_shield_mult?: number
          created_at?: string
          enemy_hp_mult?: number
          enemy_shield_mult?: number
          enemy_speed_mult?: number
          mission_id?: number
          notes?: string | null
          reward_cores_delta?: number
          spawn_count_mult?: number
          spawn_delay_mult?: number
          spawn_interval_mult?: number
          start_energy_delta?: number
          updated_at?: string
          updated_by?: string | null
          wave_reward_mult?: number
        }
        Relationships: []
      }
      nexus_mission_drafts: {
        Row: {
          applied_at: string | null
          archived_at: string | null
          config: Json
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          notes: string | null
          parent_id: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          applied_at?: string | null
          archived_at?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          name: string
          notes?: string | null
          parent_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          applied_at?: string | null
          archived_at?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          parent_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "nexus_mission_drafts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "nexus_mission_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      nexus_operation_contributions: {
        Row: {
          best_score: number
          best_waves: number
          contribution_points: number
          created_at: string
          id: string
          last_contribution_at: string
          operation_id: string
          runs_submitted: number
          total_boss_damage: number
          total_kills: number
          total_score: number
          total_waves: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_score?: number
          best_waves?: number
          contribution_points?: number
          created_at?: string
          id?: string
          last_contribution_at?: string
          operation_id: string
          runs_submitted?: number
          total_boss_damage?: number
          total_kills?: number
          total_score?: number
          total_waves?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_score?: number
          best_waves?: number
          contribution_points?: number
          created_at?: string
          id?: string
          last_contribution_at?: string
          operation_id?: string
          runs_submitted?: number
          total_boss_damage?: number
          total_kills?: number
          total_score?: number
          total_waves?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nexus_operation_contributions_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "nexus_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      nexus_operation_runs: {
        Row: {
          boss_damage: number
          contribution_points: number
          created_at: string
          duration_seconds: number
          id: string
          kills: number
          nexus_run_id: string | null
          operation_id: string
          score: number
          user_id: string
          waves: number
        }
        Insert: {
          boss_damage?: number
          contribution_points?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          kills?: number
          nexus_run_id?: string | null
          operation_id: string
          score?: number
          user_id: string
          waves?: number
        }
        Update: {
          boss_damage?: number
          contribution_points?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          kills?: number
          nexus_run_id?: string | null
          operation_id?: string
          score?: number
          user_id?: string
          waves?: number
        }
        Relationships: [
          {
            foreignKeyName: "nexus_operation_runs_nexus_run_id_fkey"
            columns: ["nexus_run_id"]
            isOneToOne: false
            referencedRelation: "nexus_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nexus_operation_runs_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "nexus_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      nexus_operations: {
        Row: {
          club_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_phase: number
          flavor: string | null
          id: string
          name: string
          phase1_progress: number
          phase1_target: number
          phase2_progress: number
          phase2_target: number
          phase3_progress: number
          phase3_target: number
          rewards_distributed_at: string | null
          started_at: string
          status: string
          total_contributors: number
          total_runs: number
          updated_at: string
        }
        Insert: {
          club_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_phase?: number
          flavor?: string | null
          id?: string
          name: string
          phase1_progress?: number
          phase1_target?: number
          phase2_progress?: number
          phase2_target?: number
          phase3_progress?: number
          phase3_target?: number
          rewards_distributed_at?: string | null
          started_at?: string
          status?: string
          total_contributors?: number
          total_runs?: number
          updated_at?: string
        }
        Update: {
          club_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_phase?: number
          flavor?: string | null
          id?: string
          name?: string
          phase1_progress?: number
          phase1_target?: number
          phase2_progress?: number
          phase2_target?: number
          phase3_progress?: number
          phase3_target?: number
          rewards_distributed_at?: string | null
          started_at?: string
          status?: string
          total_contributors?: number
          total_runs?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nexus_operations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      nexus_progress: {
        Row: {
          cores: number
          created_at: string
          highest_mission: number
          unlocked_abilities: string[]
          unlocked_towers: string[]
          updated_at: string
          upgrades: Json
          user_id: string
        }
        Insert: {
          cores?: number
          created_at?: string
          highest_mission?: number
          unlocked_abilities?: string[]
          unlocked_towers?: string[]
          updated_at?: string
          upgrades?: Json
          user_id: string
        }
        Update: {
          cores?: number
          created_at?: string
          highest_mission?: number
          unlocked_abilities?: string[]
          unlocked_towers?: string[]
          updated_at?: string
          upgrades?: Json
          user_id?: string
        }
        Relationships: []
      }
      nexus_runs: {
        Row: {
          ability_usage: Json
          base_hp_remaining: number
          created_at: string
          duration_seconds: number
          energy_starved_ms: number
          failed_wave: number | null
          id: string
          kills: number
          leaks: number
          loadout: Json
          mission_id: number
          score: number
          tower_sells: Json
          tower_upgrades: Json
          tower_usage: Json
          user_id: string
          victory: boolean
          waves_cleared: number
        }
        Insert: {
          ability_usage?: Json
          base_hp_remaining?: number
          created_at?: string
          duration_seconds?: number
          energy_starved_ms?: number
          failed_wave?: number | null
          id?: string
          kills?: number
          leaks?: number
          loadout?: Json
          mission_id: number
          score?: number
          tower_sells?: Json
          tower_upgrades?: Json
          tower_usage?: Json
          user_id: string
          victory: boolean
          waves_cleared?: number
        }
        Update: {
          ability_usage?: Json
          base_hp_remaining?: number
          created_at?: string
          duration_seconds?: number
          energy_starved_ms?: number
          failed_wave?: number | null
          id?: string
          kills?: number
          leaks?: number
          loadout?: Json
          mission_id?: number
          score?: number
          tower_sells?: Json
          tower_upgrades?: Json
          tower_usage?: Json
          user_id?: string
          victory?: boolean
          waves_cleared?: number
        }
        Relationships: []
      }
      nexus_salvage_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          note: string | null
          reason: Database["public"]["Enums"]["nexus_ledger_reason"]
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          reason: Database["public"]["Enums"]["nexus_ledger_reason"]
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          reason?: Database["public"]["Enums"]["nexus_ledger_reason"]
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nexus_salvage_wallet: {
        Row: {
          balance: number
          lifetime_earned: number
          lifetime_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nexus_sigils: {
        Row: {
          code: string
          created_at: string
          description: string
          glow_color: string
          icon: string
          id: string
          name: string
          rarity: Database["public"]["Enums"]["nexus_sigil_rarity"]
          source: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          glow_color?: string
          icon?: string
          id?: string
          name: string
          rarity?: Database["public"]["Enums"]["nexus_sigil_rarity"]
          source?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          glow_color?: string
          icon?: string
          id?: string
          name?: string
          rarity?: Database["public"]["Enums"]["nexus_sigil_rarity"]
          source?: string
        }
        Relationships: []
      }
      nexus_user_boosts: {
        Row: {
          boost_id: string
          consumed_at: string | null
          consumed_run_id: string | null
          purchased_at: string
          user_id: string
        }
        Insert: {
          boost_id: string
          consumed_at?: string | null
          consumed_run_id?: string | null
          purchased_at?: string
          user_id: string
        }
        Update: {
          boost_id?: string
          consumed_at?: string | null
          consumed_run_id?: string | null
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nexus_user_boosts_boost_id_fkey"
            columns: ["boost_id"]
            isOneToOne: false
            referencedRelation: "nexus_boosts"
            referencedColumns: ["id"]
          },
        ]
      }
      nexus_user_sigils: {
        Row: {
          earned_at: string
          id: string
          is_displayed: boolean
          sigil_id: string
          source_ref: string | null
          user_id: string
        }
        Insert: {
          earned_at?: string
          id?: string
          is_displayed?: boolean
          sigil_id: string
          source_ref?: string | null
          user_id: string
        }
        Update: {
          earned_at?: string
          id?: string
          is_displayed?: boolean
          sigil_id?: string
          source_ref?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nexus_user_sigils_sigil_id_fkey"
            columns: ["sigil_id"]
            isOneToOne: false
            referencedRelation: "nexus_sigils"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_games: {
        Row: {
          away_score: number | null
          away_team_id: string
          created_at: string
          external_id: string | null
          external_provider: string | null
          home_score: number | null
          home_team_id: string
          id: string
          kickoff_at: string
          season_id: string
          status: string
          updated_at: string
          week_id: string
          winner_team_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          home_score?: number | null
          home_team_id: string
          id?: string
          kickoff_at: string
          season_id: string
          status?: string
          updated_at?: string
          week_id: string
          winner_team_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          home_score?: number | null
          home_team_id?: string
          id?: string
          kickoff_at?: string
          season_id?: string
          status?: string
          updated_at?: string
          week_id?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfl_games_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "nfl_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_games_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "nfl_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_games_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_games_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "nfl_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "nfl_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_picks: {
        Row: {
          club_id: string
          created_at: string
          game_id: string
          id: string
          is_correct: boolean | null
          picked_team_id: string
          points_awarded: number
          season_id: string
          updated_at: string
          user_id: string
          week_id: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          game_id: string
          id?: string
          is_correct?: boolean | null
          picked_team_id: string
          points_awarded?: number
          season_id: string
          updated_at?: string
          user_id: string
          week_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          game_id?: string
          id?: string
          is_correct?: boolean | null
          picked_team_id?: string
          points_awarded?: number
          season_id?: string
          updated_at?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfl_picks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_picks_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "nfl_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_picks_picked_team_id_fkey"
            columns: ["picked_team_id"]
            isOneToOne: false
            referencedRelation: "nfl_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_picks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_picks_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "nfl_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_season_standings: {
        Row: {
          accuracy: number
          avg_weekly_rank: number | null
          club_id: string
          id: string
          rank: number | null
          season_id: string
          total_correct: number
          total_picked: number
          updated_at: string
          user_id: string
          weekly_wins: number
        }
        Insert: {
          accuracy?: number
          avg_weekly_rank?: number | null
          club_id?: string
          id?: string
          rank?: number | null
          season_id: string
          total_correct?: number
          total_picked?: number
          updated_at?: string
          user_id: string
          weekly_wins?: number
        }
        Update: {
          accuracy?: number
          avg_weekly_rank?: number | null
          club_id?: string
          id?: string
          rank?: number | null
          season_id?: string
          total_correct?: number
          total_picked?: number
          updated_at?: string
          user_id?: string
          weekly_wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfl_season_standings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_season_standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_seasons: {
        Row: {
          created_at: string
          current_week: number
          ends_at: string
          hide_unresolved_future_weeks: boolean
          id: string
          name: string
          pick_lock_minutes: number
          require_finalized_schedule: boolean
          starts_at: string
          status: string
          updated_at: string
          visible_week_window: number | null
          year: number
        }
        Insert: {
          created_at?: string
          current_week?: number
          ends_at: string
          hide_unresolved_future_weeks?: boolean
          id?: string
          name: string
          pick_lock_minutes?: number
          require_finalized_schedule?: boolean
          starts_at: string
          status?: string
          updated_at?: string
          visible_week_window?: number | null
          year: number
        }
        Update: {
          created_at?: string
          current_week?: number
          ends_at?: string
          hide_unresolved_future_weeks?: boolean
          id?: string
          name?: string
          pick_lock_minutes?: number
          require_finalized_schedule?: boolean
          starts_at?: string
          status?: string
          updated_at?: string
          visible_week_window?: number | null
          year?: number
        }
        Relationships: []
      }
      nfl_teams: {
        Row: {
          abbr: string
          city: string
          conference: string
          created_at: string
          division: string
          external_id: string | null
          external_provider: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
        }
        Insert: {
          abbr: string
          city: string
          conference: string
          created_at?: string
          division: string
          external_id?: string | null
          external_provider?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
        }
        Update: {
          abbr?: string
          city?: string
          conference?: string
          created_at?: string
          division?: string
          external_id?: string | null
          external_provider?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
        }
        Relationships: []
      }
      nfl_tiebreakers: {
        Row: {
          actual_total: number | null
          club_id: string
          created_at: string
          delta: number | null
          id: string
          predicted_total: number
          season_id: string
          updated_at: string
          user_id: string
          week_id: string
        }
        Insert: {
          actual_total?: number | null
          club_id?: string
          created_at?: string
          delta?: number | null
          id?: string
          predicted_total: number
          season_id: string
          updated_at?: string
          user_id: string
          week_id: string
        }
        Update: {
          actual_total?: number | null
          club_id?: string
          created_at?: string
          delta?: number | null
          id?: string
          predicted_total?: number
          season_id?: string
          updated_at?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfl_tiebreakers_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_tiebreakers_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_tiebreakers_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "nfl_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_weekly_standings: {
        Row: {
          accuracy: number
          club_id: string
          correct_picks: number
          id: string
          rank: number | null
          season_id: string
          tiebreak_delta: number | null
          total_picks: number
          updated_at: string
          user_id: string
          week_id: string
        }
        Insert: {
          accuracy?: number
          club_id?: string
          correct_picks?: number
          id?: string
          rank?: number | null
          season_id: string
          tiebreak_delta?: number | null
          total_picks?: number
          updated_at?: string
          user_id: string
          week_id: string
        }
        Update: {
          accuracy?: number
          club_id?: string
          correct_picks?: number
          id?: string
          rank?: number | null
          season_id?: string
          tiebreak_delta?: number | null
          total_picks?: number
          updated_at?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfl_weekly_standings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_weekly_standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_weekly_standings_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "nfl_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_weeks: {
        Row: {
          created_at: string
          ends_at: string
          featured_game_id: string | null
          id: string
          label: string
          season_id: string
          starts_at: string
          status: string
          updated_at: string
          week_number: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          featured_game_id?: string | null
          id?: string
          label: string
          season_id: string
          starts_at: string
          status?: string
          updated_at?: string
          week_number: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          featured_game_id?: string | null
          id?: string
          label?: string
          season_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfl_weeks_featured_game_fk"
            columns: ["featured_game_id"]
            isOneToOne: false
            referencedRelation: "nfl_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfl_weeks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "nfl_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          brackets: boolean
          celebrations: boolean
          chat_messages: boolean
          club_id: string
          created_at: string
          drafts: boolean
          events: boolean
          id: string
          lockbox: boolean
          lore: boolean
          mentions: boolean
          narrative: boolean
          nexus: boolean
          pickem: boolean
          polls: boolean
          portfolio_wars: boolean
          posts: boolean
          rankings: boolean
          readshift: boolean
          runedelve: boolean
          system: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          brackets?: boolean
          celebrations?: boolean
          chat_messages?: boolean
          club_id?: string
          created_at?: string
          drafts?: boolean
          events?: boolean
          id?: string
          lockbox?: boolean
          lore?: boolean
          mentions?: boolean
          narrative?: boolean
          nexus?: boolean
          pickem?: boolean
          polls?: boolean
          portfolio_wars?: boolean
          posts?: boolean
          rankings?: boolean
          readshift?: boolean
          runedelve?: boolean
          system?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          brackets?: boolean
          celebrations?: boolean
          chat_messages?: boolean
          club_id?: string
          created_at?: string
          drafts?: boolean
          events?: boolean
          id?: string
          lockbox?: boolean
          lore?: boolean
          mentions?: boolean
          narrative?: boolean
          nexus?: boolean
          pickem?: boolean
          polls?: boolean
          portfolio_wars?: boolean
          posts?: boolean
          rankings?: boolean
          readshift?: boolean
          runedelve?: boolean
          system?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_sent_log: {
        Row: {
          entity_id: string
          id: string
          sent_at: string
          type: string
          variant: string
        }
        Insert: {
          entity_id: string
          id?: string
          sent_at?: string
          type: string
          variant?: string
        }
        Update: {
          entity_id?: string
          id?: string
          sent_at?: string
          type?: string
          variant?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_user_id: string | null
          body: string | null
          club_id: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          body?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          type: string
          url?: string | null
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          body?: string | null
          club_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_assets: {
        Row: {
          category: string
          created_at: string
          default_configuration_json: Json
          full_description: string
          icon_name: string
          id: string
          is_active: boolean
          is_premium: boolean
          name: string
          placement_area: string
          requires_configuration: boolean
          short_description: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_configuration_json?: Json
          full_description?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          name: string
          placement_area?: string
          requires_configuration?: boolean
          short_description?: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_configuration_json?: Json
          full_description?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          name?: string
          placement_area?: string
          requires_configuration?: boolean
          short_description?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          club_id: string
          id: string
          label: string
          poll_id: string
          position: number
        }
        Insert: {
          club_id?: string
          id?: string
          label: string
          poll_id: string
          position?: number
        }
        Update: {
          club_id?: string
          id?: string
          label?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          club_id: string
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          closes_at: string | null
          club_id: string
          competition_id: string
          created_at: string
          created_by: string
          id: string
          poll_type: string
          question: string
          status: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          club_id?: string
          competition_id: string
          created_at?: string
          created_by: string
          id?: string
          poll_type?: string
          question: string
          status?: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          club_id?: string
          competition_id?: string
          created_at?: string
          created_by?: string
          id?: string
          poll_type?: string
          question?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_members: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          pool_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          club_id?: string
          id?: string
          joined_at?: string
          pool_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          pool_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          allow_late_entries: boolean
          club_id: string
          created_at: string
          description: string | null
          id: string
          invite_code: string
          lock_time: string
          name: string
          owner_user_id: string
          tournament_id: string
          visibility: string | null
        }
        Insert: {
          allow_late_entries?: boolean
          club_id?: string
          created_at?: string
          description?: string | null
          id?: string
          invite_code: string
          lock_time: string
          name: string
          owner_user_id: string
          tournament_id: string
          visibility?: string | null
        }
        Update: {
          allow_late_entries?: boolean
          club_id?: string
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          lock_time?: string
          name?: string
          owner_user_id?: string
          tournament_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pools_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pools_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pools_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          club_id: string
          content: string
          created_at: string
          id: string
          parent_comment_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          club_id?: string
          content: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          club_id?: string
          content?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          channel_id: string | null
          club_id: string
          comments_count: number
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          reactions_count: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          club_id?: string
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          reactions_count?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string | null
          club_id?: string
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          reactions_count?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      provider_configs: {
        Row: {
          base_url: string | null
          created_at: string
          enabled: boolean
          id: string
          provider_name: string
          sport: string
          tournament_scope: string
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          provider_name: string
          sport?: string
          tournament_scope?: string
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          provider_name?: string
          sport?: string
          tournament_scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          club_id: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          club_id?: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          club_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      push_throttle: {
        Row: {
          channel_id: string
          last_sent_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          last_sent_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          last_sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pw_accolades: {
        Row: {
          challenge_id: string
          club_id: string
          created_at: string
          id: string
          kind: string
          ticker: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          challenge_id: string
          club_id: string
          created_at?: string
          id?: string
          kind: string
          ticker?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          challenge_id?: string
          club_id?: string
          created_at?: string
          id?: string
          kind?: string
          ticker?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pw_accolades_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "pw_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pw_accolades_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      pw_challenges: {
        Row: {
          club_id: string
          created_at: string
          end_at: string
          end_trading_date: string | null
          finalized_at: string | null
          id: string
          lock_at: string
          start_trading_date: string | null
          status: Database["public"]["Enums"]["pw_challenge_status"]
          updated_at: string
          week_end: string
          week_number: number
          week_start: string
          year: number
        }
        Insert: {
          club_id: string
          created_at?: string
          end_at: string
          end_trading_date?: string | null
          finalized_at?: string | null
          id?: string
          lock_at: string
          start_trading_date?: string | null
          status?: Database["public"]["Enums"]["pw_challenge_status"]
          updated_at?: string
          week_end: string
          week_number: number
          week_start: string
          year: number
        }
        Update: {
          club_id?: string
          created_at?: string
          end_at?: string
          end_trading_date?: string | null
          finalized_at?: string | null
          id?: string
          lock_at?: string
          start_trading_date?: string | null
          status?: Database["public"]["Enums"]["pw_challenge_status"]
          updated_at?: string
          week_end?: string
          week_number?: number
          week_start?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "pw_challenges_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      pw_entries: {
        Row: {
          avg_pct: number | null
          challenge_id: string
          club_id: string
          created_at: string
          final_rank: number | null
          id: string
          locked_at: string | null
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_pct?: number | null
          challenge_id: string
          club_id: string
          created_at?: string
          final_rank?: number | null
          id?: string
          locked_at?: string | null
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_pct?: number | null
          challenge_id?: string
          club_id?: string
          created_at?: string
          final_rank?: number | null
          id?: string
          locked_at?: string | null
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pw_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "pw_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pw_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      pw_picks: {
        Row: {
          club_id: string
          created_at: string
          end_price: number | null
          entry_id: string
          id: string
          latest_price: number | null
          pct_change: number | null
          position: number
          start_price: number | null
          ticker: string
        }
        Insert: {
          club_id: string
          created_at?: string
          end_price?: number | null
          entry_id: string
          id?: string
          latest_price?: number | null
          pct_change?: number | null
          position: number
          start_price?: number | null
          ticker: string
        }
        Update: {
          club_id?: string
          created_at?: string
          end_price?: number | null
          entry_id?: string
          id?: string
          latest_price?: number | null
          pct_change?: number | null
          position?: number
          start_price?: number | null
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "pw_picks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pw_picks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "pw_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      pw_price_snapshots: {
        Row: {
          captured_at: string
          challenge_id: string
          club_id: string
          id: string
          kind: string
          price: number
          ticker: string
          trading_date: string | null
        }
        Insert: {
          captured_at?: string
          challenge_id: string
          club_id: string
          id?: string
          kind: string
          price: number
          ticker: string
          trading_date?: string | null
        }
        Update: {
          captured_at?: string
          challenge_id?: string
          club_id?: string
          id?: string
          kind?: string
          price?: number
          ticker?: string
          trading_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pw_price_snapshots_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "pw_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pw_price_snapshots_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_items: {
        Row: {
          club_id: string
          id: string
          image_url: string | null
          label: string
          position: number
          ranking_id: string
        }
        Insert: {
          club_id?: string
          id?: string
          image_url?: string | null
          label: string
          position?: number
          ranking_id: string
        }
        Update: {
          club_id?: string
          id?: string
          image_url?: string | null
          label?: string
          position?: number
          ranking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_items_ranking_id_fkey"
            columns: ["ranking_id"]
            isOneToOne: false
            referencedRelation: "rankings"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_submission_entries: {
        Row: {
          club_id: string
          id: string
          item_id: string
          rank: number
          submission_id: string
        }
        Insert: {
          club_id?: string
          id?: string
          item_id: string
          rank: number
          submission_id: string
        }
        Update: {
          club_id?: string
          id?: string
          item_id?: string
          rank?: number
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_submission_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_submission_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "ranking_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_submission_entries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "ranking_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_submissions: {
        Row: {
          club_id: string
          id: string
          ranking_id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          club_id?: string
          id?: string
          ranking_id: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          id?: string
          ranking_id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_submissions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_submissions_ranking_id_fkey"
            columns: ["ranking_id"]
            isOneToOne: false
            referencedRelation: "rankings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rankings: {
        Row: {
          category: string | null
          club_id: string
          competition_id: string
          created_at: string
          created_by: string
          id: string
          item_count: number
          status: string
          topic: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          club_id?: string
          competition_id: string
          created_at?: string
          created_by: string
          id?: string
          item_count?: number
          status?: string
          topic: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          club_id?: string
          competition_id?: string
          created_at?: string
          created_by?: string
          id?: string
          item_count?: number
          status?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rankings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          club_id: string
          created_at: string
          id: string
          reaction_type: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          id?: string
          reaction_type: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          reaction_type?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      readshift_answers: {
        Row: {
          body: string
          club_id: string
          created_at: string
          id: string
          locked: boolean
          round_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          club_id: string
          created_at?: string
          id?: string
          locked?: boolean
          round_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          club_id?: string
          created_at?: string
          id?: string
          locked?: boolean
          round_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readshift_answers_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_answers_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "readshift_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      readshift_comments: {
        Row: {
          answer_id: string | null
          club_id: string
          content: string
          created_at: string
          id: string
          round_id: string
          user_id: string
        }
        Insert: {
          answer_id?: string | null
          club_id: string
          content: string
          created_at?: string
          id?: string
          round_id: string
          user_id: string
        }
        Update: {
          answer_id?: string | null
          club_id?: string
          content?: string
          created_at?: string
          id?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readshift_comments_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "readshift_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_comments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_comments_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "readshift_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      readshift_games: {
        Row: {
          allow_custom_prompts: boolean
          allow_reveal_explanations: boolean
          club_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          current_round: number
          early_advance: boolean
          id: string
          name: string
          paused_from_phase: string | null
          phase: string
          phase_deadline: string | null
          prompt_categories: string[]
          prompt_mode: string
          read_hours: number
          reminders_enabled: boolean
          reveal_hours: number
          seed: number
          shift_hours: number
          strong_read_explanations: boolean
          total_rounds: number
          updated_at: string
          version: number
        }
        Insert: {
          allow_custom_prompts?: boolean
          allow_reveal_explanations?: boolean
          club_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          current_round?: number
          early_advance?: boolean
          id?: string
          name: string
          paused_from_phase?: string | null
          phase?: string
          phase_deadline?: string | null
          prompt_categories?: string[]
          prompt_mode?: string
          read_hours?: number
          reminders_enabled?: boolean
          reveal_hours?: number
          seed?: number
          shift_hours?: number
          strong_read_explanations?: boolean
          total_rounds?: number
          updated_at?: string
          version?: number
        }
        Update: {
          allow_custom_prompts?: boolean
          allow_reveal_explanations?: boolean
          club_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          current_round?: number
          early_advance?: boolean
          id?: string
          name?: string
          paused_from_phase?: string | null
          phase?: string
          phase_deadline?: string | null
          prompt_categories?: string[]
          prompt_mode?: string
          read_hours?: number
          reminders_enabled?: boolean
          reveal_hours?: number
          seed?: number
          shift_hours?: number
          strong_read_explanations?: boolean
          total_rounds?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "readshift_games_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      readshift_guesses: {
        Row: {
          answer_id: string
          club_id: string
          created_at: string
          explanation: string | null
          guessed_user_id: string | null
          id: string
          is_strong_read: boolean
          reader_user_id: string
          round_id: string
          updated_at: string
        }
        Insert: {
          answer_id: string
          club_id: string
          created_at?: string
          explanation?: string | null
          guessed_user_id?: string | null
          id?: string
          is_strong_read?: boolean
          reader_user_id: string
          round_id: string
          updated_at?: string
        }
        Update: {
          answer_id?: string
          club_id?: string
          created_at?: string
          explanation?: string | null
          guessed_user_id?: string | null
          id?: string
          is_strong_read?: boolean
          reader_user_id?: string
          round_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "readshift_guesses_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "readshift_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_guesses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_guesses_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "readshift_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      readshift_participants: {
        Row: {
          active: boolean
          club_id: string
          game_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          club_id: string
          game_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          club_id?: string
          game_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readshift_participants_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_participants_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "readshift_games"
            referencedColumns: ["id"]
          },
        ]
      }
      readshift_prompts: {
        Row: {
          body: string
          category: string
          club_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_group: boolean
          mode: string
          updated_at: string
        }
        Insert: {
          body: string
          category: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_group?: boolean
          mode?: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_group?: boolean
          mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "readshift_prompts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      readshift_round_awards: {
        Row: {
          award_key: string
          club_id: string
          created_at: string
          game_id: string
          id: string
          label: string
          round_id: string
          user_id: string
          value: number
        }
        Insert: {
          award_key: string
          club_id: string
          created_at?: string
          game_id: string
          id?: string
          label: string
          round_id: string
          user_id: string
          value?: number
        }
        Update: {
          award_key?: string
          club_id?: string
          created_at?: string
          game_id?: string
          id?: string
          label?: string
          round_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "readshift_round_awards_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_round_awards_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "readshift_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_round_awards_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "readshift_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      readshift_round_results: {
        Row: {
          club_id: string
          created_at: string
          detail: Json
          game_id: string
          id: string
          reading_points: Json
          round_id: string
          signal_points: Json
          total_points: Json
        }
        Insert: {
          club_id: string
          created_at?: string
          detail?: Json
          game_id: string
          id?: string
          reading_points?: Json
          round_id: string
          signal_points?: Json
          total_points?: Json
        }
        Update: {
          club_id?: string
          created_at?: string
          detail?: Json
          game_id?: string
          id?: string
          reading_points?: Json
          round_id?: string
          signal_points?: Json
          total_points?: Json
        }
        Relationships: [
          {
            foreignKeyName: "readshift_round_results_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_round_results_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "readshift_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "readshift_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      readshift_rounds: {
        Row: {
          club_id: string
          created_at: string
          game_id: string
          id: string
          phase: string
          prompt_id: string | null
          prompt_snapshot: string | null
          read_deadline: string | null
          reveal_deadline: string | null
          round_number: number
          scored_at: string | null
          shift_deadline: string | null
          updated_at: string
          voided: boolean
        }
        Insert: {
          club_id: string
          created_at?: string
          game_id: string
          id?: string
          phase?: string
          prompt_id?: string | null
          prompt_snapshot?: string | null
          read_deadline?: string | null
          reveal_deadline?: string | null
          round_number: number
          scored_at?: string | null
          shift_deadline?: string | null
          updated_at?: string
          voided?: boolean
        }
        Update: {
          club_id?: string
          created_at?: string
          game_id?: string
          id?: string
          phase?: string
          prompt_id?: string | null
          prompt_snapshot?: string | null
          read_deadline?: string | null
          reveal_deadline?: string | null
          round_number?: number
          scored_at?: string | null
          shift_deadline?: string | null
          updated_at?: string
          voided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "readshift_rounds_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_rounds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "readshift_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_rounds_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "readshift_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      readshift_signal_assignments: {
        Row: {
          club_id: string
          created_at: string
          frame_target_user_id: string | null
          id: string
          round_id: string
          signal: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          frame_target_user_id?: string | null
          id?: string
          round_id: string
          signal: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          frame_target_user_id?: string | null
          id?: string
          round_id?: string
          signal?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readshift_signal_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readshift_signal_assignments_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "readshift_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      readshift_stats: {
        Row: {
          blur_rounds: number
          blur_success: number
          club_id: string
          correct_reads: number
          correct_strong_reads: number
          eligible_reads: number
          frame_rounds: number
          frame_success: number
          games_played: number
          games_won: number
          id: string
          pairings: Json
          rounds_played: number
          strong_reads: number
          tell_rounds: number
          tell_success: number
          total_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          blur_rounds?: number
          blur_success?: number
          club_id: string
          correct_reads?: number
          correct_strong_reads?: number
          eligible_reads?: number
          frame_rounds?: number
          frame_success?: number
          games_played?: number
          games_won?: number
          id?: string
          pairings?: Json
          rounds_played?: number
          strong_reads?: number
          tell_rounds?: number
          tell_success?: number
          total_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          blur_rounds?: number
          blur_success?: number
          club_id?: string
          correct_reads?: number
          correct_strong_reads?: number
          eligible_reads?: number
          frame_rounds?: number
          frame_success?: number
          games_played?: number
          games_won?: number
          id?: string
          pairings?: Json
          rounds_played?: number
          strong_reads?: number
          tell_rounds?: number
          tell_success?: number
          total_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readshift_stats_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_active_quests: {
        Row: {
          claimed_at: string | null
          club_id: string
          created_at: string
          id: string
          period_key: string
          progress: number
          quest_id: string
          scope: Database["public"]["Enums"]["rd_quest_scope"]
          status: Database["public"]["Enums"]["rd_quest_status"]
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          club_id?: string
          created_at?: string
          id?: string
          period_key: string
          progress?: number
          quest_id: string
          scope: Database["public"]["Enums"]["rd_quest_scope"]
          status?: Database["public"]["Enums"]["rd_quest_status"]
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          club_id?: string
          created_at?: string
          id?: string
          period_key?: string
          progress?: number
          quest_id?: string
          scope?: Database["public"]["Enums"]["rd_quest_scope"]
          status?: Database["public"]["Enums"]["rd_quest_status"]
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_active_quests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rune_delve_active_quests_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "rune_delve_quest_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_bestiary: {
        Row: {
          archetype_id: string
          club_id: string
          created_at: string
          defeat_count: number
          first_defeated_at: string
          highest_level_defeated: number
          id: string
          last_defeated_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archetype_id: string
          club_id?: string
          created_at?: string
          defeat_count?: number
          first_defeated_at?: string
          highest_level_defeated?: number
          id?: string
          last_defeated_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archetype_id?: string
          club_id?: string
          created_at?: string
          defeat_count?: number
          first_defeated_at?: string
          highest_level_defeated?: number
          id?: string
          last_defeated_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_bestiary_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_class_progress: {
        Row: {
          class: string
          club_id: string
          cosmetic_title: string | null
          created_at: string
          id: string
          level: number
          lifetime_runs: number
          lifetime_score: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          class: string
          club_id?: string
          cosmetic_title?: string | null
          created_at?: string
          id?: string
          level?: number
          lifetime_runs?: number
          lifetime_score?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          class?: string
          club_id?: string
          cosmetic_title?: string | null
          created_at?: string
          id?: string
          level?: number
          lifetime_runs?: number
          lifetime_score?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_class_progress_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_daily_runs: {
        Row: {
          club_id: string
          completed_at: string
          created_at: string
          daily_date: string
          dungeon_cleared: boolean
          hero_class: string
          id: string
          kills_count: number
          modifiers: Json
          score: number
          stars: number
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id?: string
          completed_at?: string
          created_at?: string
          daily_date: string
          dungeon_cleared?: boolean
          hero_class: string
          id?: string
          kills_count?: number
          modifiers?: Json
          score?: number
          stars?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          completed_at?: string
          created_at?: string
          daily_date?: string
          dungeon_cleared?: boolean
          hero_class?: string
          id?: string
          kills_count?: number
          modifiers?: Json
          score?: number
          stars?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_daily_runs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_daily_streaks: {
        Row: {
          best_streak: number
          club_id: string
          created_at: string
          current_streak: number
          last_completed_date: string | null
          lifetime_clears: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_streak?: number
          club_id?: string
          created_at?: string
          current_streak?: number
          last_completed_date?: string | null
          lifetime_clears?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_streak?: number
          club_id?: string
          created_at?: string
          current_streak?: number
          last_completed_date?: string | null
          lifetime_clears?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_daily_streaks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_dungeons: {
        Row: {
          created_at: string
          enemy_config: Json
          id: string
          max_turns: number
          run_date: string
          seed: number
        }
        Insert: {
          created_at?: string
          enemy_config?: Json
          id?: string
          max_turns?: number
          run_date: string
          seed: number
        }
        Update: {
          created_at?: string
          enemy_config?: Json
          id?: string
          max_turns?: number
          run_date?: string
          seed?: number
        }
        Relationships: []
      }
      rune_delve_failure_rewards: {
        Row: {
          club_id: string
          failure_count: number
          id: string
          last_awarded_at: string
          level_number: number
          user_id: string
        }
        Insert: {
          club_id?: string
          failure_count?: number
          id?: string
          last_awarded_at?: string
          level_number: number
          user_id: string
        }
        Update: {
          club_id?: string
          failure_count?: number
          id?: string
          last_awarded_at?: string
          level_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_failure_rewards_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_heroes: {
        Row: {
          best_streak: number
          class: string
          club_id: string
          cosmetic_title: string | null
          created_at: string
          current_streak: number
          hero_name: string
          id: string
          last_run_date: string | null
          level: number
          lifetime_runs: number
          lifetime_score: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          best_streak?: number
          class?: string
          club_id?: string
          cosmetic_title?: string | null
          created_at?: string
          current_streak?: number
          hero_name?: string
          id?: string
          last_run_date?: string | null
          level?: number
          lifetime_runs?: number
          lifetime_score?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          best_streak?: number
          class?: string
          club_id?: string
          cosmetic_title?: string | null
          created_at?: string
          current_streak?: number
          hero_name?: string
          id?: string
          last_run_date?: string | null
          level?: number
          lifetime_runs?: number
          lifetime_score?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_heroes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_levels: {
        Row: {
          board_size: number
          chapter: number
          created_at: string
          difficulty_tier: number
          enemy_config: Json
          generation_seed: number
          id: string
          level_number: number
          metadata: Json
          modifiers: Json
          objective_target: number
          objective_type: string
          starting_board_layout: Json | null
          status: string
          turn_limit: number
          updated_at: string
        }
        Insert: {
          board_size?: number
          chapter?: number
          created_at?: string
          difficulty_tier?: number
          enemy_config?: Json
          generation_seed: number
          id?: string
          level_number: number
          metadata?: Json
          modifiers?: Json
          objective_target?: number
          objective_type?: string
          starting_board_layout?: Json | null
          status?: string
          turn_limit?: number
          updated_at?: string
        }
        Update: {
          board_size?: number
          chapter?: number
          created_at?: string
          difficulty_tier?: number
          enemy_config?: Json
          generation_seed?: number
          id?: string
          level_number?: number
          metadata?: Json
          modifiers?: Json
          objective_target?: number
          objective_type?: string
          starting_board_layout?: Json | null
          status?: string
          turn_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      rune_delve_loadouts: {
        Row: {
          class: string
          club_id: string
          id: string
          slot_1: string | null
          slot_2: string | null
          slot_3: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          class: string
          club_id?: string
          id?: string
          slot_1?: string | null
          slot_2?: string | null
          slot_3?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          class?: string
          club_id?: string
          id?: string
          slot_1?: string | null
          slot_2?: string | null
          slot_3?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_loadouts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_progress: {
        Row: {
          club_id: string
          created_at: string
          current_chapter: number
          highest_completed_level: number
          highest_unlocked_level: number
          id: string
          total_levels_cleared: number
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          current_chapter?: number
          highest_completed_level?: number
          highest_unlocked_level?: number
          id?: string
          total_levels_cleared?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          current_chapter?: number
          highest_completed_level?: number
          highest_unlocked_level?: number
          id?: string
          total_levels_cleared?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_progress_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_quest_definitions: {
        Row: {
          created_at: string
          description: string
          hero_class: string | null
          id: string
          is_personal: boolean
          objective_type: string
          scope: Database["public"]["Enums"]["rd_quest_scope"]
          shard_reward: number
          target_value: number
          title: string
          weight: number
          xp_reward: number
        }
        Insert: {
          created_at?: string
          description: string
          hero_class?: string | null
          id: string
          is_personal?: boolean
          objective_type: string
          scope: Database["public"]["Enums"]["rd_quest_scope"]
          shard_reward?: number
          target_value?: number
          title: string
          weight?: number
          xp_reward?: number
        }
        Update: {
          created_at?: string
          description?: string
          hero_class?: string | null
          id?: string
          is_personal?: boolean
          objective_type?: string
          scope?: Database["public"]["Enums"]["rd_quest_scope"]
          shard_reward?: number
          target_value?: number
          title?: string
          weight?: number
          xp_reward?: number
        }
        Relationships: []
      }
      rune_delve_relic_unlocks: {
        Row: {
          acquired_at: string
          acquired_at_level: number
          club_id: string
          id: string
          rank: number
          relic_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          acquired_at_level?: number
          club_id?: string
          id?: string
          rank?: number
          relic_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          acquired_at_level?: number
          club_id?: string
          id?: string
          rank?: number
          relic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_relic_unlocks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_runs: {
        Row: {
          ability_used: boolean
          attempts: number
          best_hp_remaining: number
          best_turns_used: number | null
          clears: number
          club_id: string
          completed_at: string
          created_at: string
          dungeon_cleared: boolean
          dungeon_id: string | null
          enemies_defeated: number
          hero_class: string
          hp_remaining: number
          id: string
          last_played_at: string
          level_id: string | null
          level_number: number | null
          longest_chain: number
          pick_log: Json
          run_date: string | null
          score: number
          total_damage: number
          turns_used: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          ability_used?: boolean
          attempts?: number
          best_hp_remaining?: number
          best_turns_used?: number | null
          clears?: number
          club_id?: string
          completed_at?: string
          created_at?: string
          dungeon_cleared?: boolean
          dungeon_id?: string | null
          enemies_defeated?: number
          hero_class: string
          hp_remaining?: number
          id?: string
          last_played_at?: string
          level_id?: string | null
          level_number?: number | null
          longest_chain?: number
          pick_log?: Json
          run_date?: string | null
          score?: number
          total_damage?: number
          turns_used?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          ability_used?: boolean
          attempts?: number
          best_hp_remaining?: number
          best_turns_used?: number | null
          clears?: number
          club_id?: string
          completed_at?: string
          created_at?: string
          dungeon_cleared?: boolean
          dungeon_id?: string | null
          enemies_defeated?: number
          hero_class?: string
          hp_remaining?: number
          id?: string
          last_played_at?: string
          level_id?: string | null
          level_number?: number | null
          longest_chain?: number
          pick_log?: Json
          run_date?: string | null
          score?: number
          total_damage?: number
          turns_used?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_runs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rune_delve_runs_dungeon_id_fkey"
            columns: ["dungeon_id"]
            isOneToOne: false
            referencedRelation: "rune_delve_dungeons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rune_delve_runs_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "rune_delve_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      rune_delve_wallet: {
        Row: {
          club_id: string
          created_at: string
          lifetime_shards_earned: number
          shards: number
          slots_unlocked: number
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id?: string
          created_at?: string
          lifetime_shards_earned?: number
          shards?: number
          slots_unlocked?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          lifetime_shards_earned?: number
          shards?: number
          slots_unlocked?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rune_delve_wallet_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rules: {
        Row: {
          id: string
          points_per_correct_pick: number
          pool_id: string
          round_number: number
        }
        Insert: {
          id?: string
          points_per_correct_pick: number
          pool_id: string
          round_number: number
        }
        Update: {
          id?: string
          points_per_correct_pick?: number
          pool_id?: string
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      standings: {
        Row: {
          correct_picks: number | null
          id: string
          pool_id: string
          possible_points_remaining: number | null
          rank: number | null
          total_points: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_picks?: number | null
          id?: string
          pool_id: string
          possible_points_remaining?: number | null
          rank?: number | null
          total_points?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_picks?: number | null
          id?: string
          pool_id?: string
          possible_points_remaining?: number | null
          rank?: number | null
          total_points?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standings_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      standings_snapshots: {
        Row: {
          correct_picks: number
          id: string
          pool_id: string
          possible_points_remaining: number
          rank: number | null
          snapshot_at: string
          source: string
          total_points: number
          user_id: string
        }
        Insert: {
          correct_picks?: number
          id?: string
          pool_id: string
          possible_points_remaining?: number
          rank?: number | null
          snapshot_at?: string
          source?: string
          total_points?: number
          user_id: string
        }
        Update: {
          correct_picks?: number
          id?: string
          pool_id?: string
          possible_points_remaining?: number
          rank?: number | null
          snapshot_at?: string
          source?: string
          total_points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standings_snapshots_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_events: {
        Row: {
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          status: string
          sync_run_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          status?: string
          sync_run_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          status?: string
          sync_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_events_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          initiated_by_user_id: string | null
          provider_name: string
          raw_summary: Json | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          initiated_by_user_id?: string | null
          provider_name: string
          raw_summary?: Json | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          initiated_by_user_id?: string | null
          provider_name?: string
          raw_summary?: Json | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_initiated_by_user_id_fkey"
            columns: ["initiated_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          play_in_group: number | null
          region: string
          school_name: string
          seed: number
          short_name: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          play_in_group?: number | null
          region: string
          school_name: string
          seed: number
          short_name: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          play_in_group?: number | null
          region?: string
          school_name?: string
          seed?: number
          short_name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          external_season_id: string | null
          gender_division: string | null
          id: string
          last_synced_at: string | null
          lock_time: string
          name: string
          season_year: number
          sport: string | null
          status: string | null
          sync_status: string | null
        }
        Insert: {
          created_at?: string
          external_season_id?: string | null
          gender_division?: string | null
          id?: string
          last_synced_at?: string | null
          lock_time: string
          name: string
          season_year: number
          sport?: string | null
          status?: string | null
          sync_status?: string | null
        }
        Update: {
          created_at?: string
          external_season_id?: string | null
          gender_division?: string | null
          id?: string
          last_synced_at?: string | null
          lock_time?: string
          name?: string
          season_year?: number
          sport?: string | null
          status?: string | null
          sync_status?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_achievement_unlocks: {
        Row: {
          achievement_key: string
          club_id: string
          id: string
          metadata: Json
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          club_id: string
          id?: string
          metadata?: Json
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          club_id?: string
          id?: string
          metadata?: Json
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_achievement_unlocks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_activities: {
        Row: {
          activity_local_date: string
          club_id: string
          competition_points: number | null
          created_at: string
          ended_at: string | null
          exercise_id: string
          id: string
          logged_at: string
          measurement_type: string
          metadata: Json
          raw_value: number
          source_activity_id: string | null
          source_type: string
          started_at: string | null
          status: string
          unit: string
          user_id: string
          week_id: string | null
          xp_awarded: number | null
        }
        Insert: {
          activity_local_date: string
          club_id: string
          competition_points?: number | null
          created_at?: string
          ended_at?: string | null
          exercise_id: string
          id?: string
          logged_at?: string
          measurement_type: string
          metadata?: Json
          raw_value: number
          source_activity_id?: string | null
          source_type?: string
          started_at?: string | null
          status?: string
          unit: string
          user_id: string
          week_id?: string | null
          xp_awarded?: number | null
        }
        Update: {
          activity_local_date?: string
          club_id?: string
          competition_points?: number | null
          created_at?: string
          ended_at?: string | null
          exercise_id?: string
          id?: string
          logged_at?: string
          measurement_type?: string
          metadata?: Json
          raw_value?: number
          source_activity_id?: string | null
          source_type?: string
          started_at?: string | null
          status?: string
          unit?: string
          user_id?: string
          week_id?: string | null
          xp_awarded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_activities_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_activities_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_activities_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "workout_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          active: boolean
          category: string
          club_id: string
          created_at: string
          created_by: string | null
          default_weekly_goal: number | null
          icon_name: string | null
          id: string
          instructions: string | null
          logging_config: Json
          measurement_type: string
          milestone_config: Json
          name: string
          scoring_config: Json
          short_description: string | null
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          club_id: string
          created_at?: string
          created_by?: string | null
          default_weekly_goal?: number | null
          icon_name?: string | null
          id?: string
          instructions?: string | null
          logging_config?: Json
          measurement_type: string
          milestone_config?: Json
          name: string
          scoring_config?: Json
          short_description?: string | null
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          default_weekly_goal?: number | null
          icon_name?: string | null
          id?: string
          instructions?: string | null
          logging_config?: Json
          measurement_type?: string
          milestone_config?: Json
          name?: string
          scoring_config?: Json
          short_description?: string | null
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_group_goals: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          exercise_id: string
          id: string
          target: number
          title: string
          updated_at: string
          week_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          exercise_id: string
          id?: string
          target: number
          title: string
          updated_at?: string
          week_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          exercise_id?: string
          id?: string
          target?: number
          title?: string
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_group_goals_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_group_goals_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_group_goals_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "workout_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_log_entries: {
        Row: {
          catalog_id: string | null
          category: string | null
          club_id: string
          created_at: string
          distance_mi: number | null
          exercise_name: string
          id: string
          log_kind: string
          points: number
          reps: number | null
          seconds: number | null
          session_id: string
          sets: Json
          sort_order: number
          unit: string | null
          user_id: string
        }
        Insert: {
          catalog_id?: string | null
          category?: string | null
          club_id: string
          created_at?: string
          distance_mi?: number | null
          exercise_name: string
          id?: string
          log_kind: string
          points?: number
          reps?: number | null
          seconds?: number | null
          session_id: string
          sets?: Json
          sort_order?: number
          unit?: string | null
          user_id: string
        }
        Update: {
          catalog_id?: string | null
          category?: string | null
          club_id?: string
          created_at?: string
          distance_mi?: number | null
          exercise_name?: string
          id?: string
          log_kind?: string
          points?: number
          reps?: number | null
          seconds?: number | null
          session_id?: string
          sets?: Json
          sort_order?: number
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_log_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_log_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_log_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_log_sessions: {
        Row: {
          activity_local_date: string
          club_id: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          started_at: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_local_date: string
          club_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          started_at?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_local_date?: string
          club_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          started_at?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_log_sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_week_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          goal: number | null
          id: string
          scoring_config: Json
          sort_order: number
          week_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          goal?: number | null
          id?: string
          scoring_config?: Json
          sort_order?: number
          week_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          goal?: number | null
          id?: string
          scoring_config?: Json
          sort_order?: number
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_week_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_week_exercises_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "workout_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_weeks: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          scoring_config: Json
          starts_at: string
          status: string
          theme: string | null
          title: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          scoring_config?: Json
          starts_at: string
          status?: string
          theme?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          scoring_config?: Json
          starts_at?: string
          status?: string
          theme?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_weeks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      nfl_team_records: {
        Row: {
          games_played: number | null
          losses: number | null
          point_diff_avg: number | null
          recent_form: string | null
          season_id: string | null
          team_id: string | null
          ties: number | null
          wins: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _credit_salvage: {
        Args: {
          _amount: number
          _note: string
          _reason: Database["public"]["Enums"]["nexus_ledger_reason"]
          _ref: string
          _user_id: string
        }
        Returns: undefined
      }
      _ensure_salvage_wallet: { Args: { _user_id: string }; Returns: undefined }
      _grant_sigil: {
        Args: { _code: string; _ref: string; _user_id: string }
        Returns: boolean
      }
      admin_set_request_needs_info: {
        Args: { _admin_note: string; _request_id: string }
        Returns: {
          created_at: string
          id: string
          proposed_name: string
          reason: string | null
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_note: string | null
        }
        SetofOptions: {
          from: "*"
          to: "club_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_narrative_clock: {
        Args: {
          _campaign_id: string
          _clock_id: string
          _delta: number
          _note?: string
        }
        Returns: {
          campaign_id: string
          clock_type: string
          created_at: string
          created_by: string | null
          current_value: number
          description: string | null
          history: Json
          id: string
          max_value: number
          name: string
          related_faction_id: string | null
          related_location_id: string | null
          related_npc_id: string | null
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "narrative_clocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_mission_draft_live: {
        Args: { _also_update_active_op?: boolean; _draft_id: string }
        Returns: Json
      }
      award_endless_rewards: {
        Args: { _run_id: string; _wave_reached: number }
        Returns: Json
      }
      award_operation_rewards: {
        Args: { _operation_id: string }
        Returns: Json
      }
      cancel_club_request: { Args: never; Returns: undefined }
      consume_ai_quota: {
        Args: {
          _function_name: string
          _max_requests: number
          _window_minutes: number
        }
        Returns: Json
      }
      consume_boost: { Args: { _run_id: string }; Returns: Json }
      create_narrative_campaign: {
        Args: {
          _club_id: string
          _content_notes: string
          _description: string
          _opening_premise: string
          _pitch: string
          _play_mode: string
          _player_limit: number
          _proposed_gm_id: string
          _schedule_note: string
          _spectators_allowed: boolean
          _submit: boolean
          _template_key: string
          _title: string
          _tone_profile: string
          _visibility: string
        }
        Returns: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          canon_locks: Json
          club_id: string
          content_notes: string | null
          created_at: string
          created_by: string
          current_chapter_id: string | null
          current_scene_id: string | null
          description: string | null
          gm_id: string | null
          id: string
          live_session_id: string | null
          live_started_at: string | null
          memory_summary: string | null
          opening_premise: string | null
          pitch: string | null
          play_mode: string
          player_limit: number | null
          proposed_gm_id: string | null
          schedule_note: string | null
          slug: string | null
          spectators_allowed: boolean
          status: string
          submitted_at: string | null
          template_key: string
          title: string
          tone_profile: string | null
          updated_at: string
          visibility: string
          waiting_on_state: Json
        }
        SetofOptions: {
          from: "*"
          to: "narrative_campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_club_id: { Args: never; Returns: string }
      ensure_forge_week: {
        Args: {
          p_club_id: string
          p_ends_at: string
          p_exercises: Json
          p_starts_at: string
          p_theme: string
          p_title: string
        }
        Returns: string
      }
      forge_monday_bounds: { Args: never; Returns: Record<string, unknown> }
      forge_notify_final_hours: { Args: never; Returns: undefined }
      forge_notify_midweek: { Args: never; Returns: undefined }
      forge_notify_new_weeks: { Args: never; Returns: undefined }
      forge_roll_all: { Args: never; Returns: undefined }
      forge_roll_club: {
        Args: { p_club_id: string; p_ends_at: string; p_starts_at: string }
        Returns: string
      }
      forge_week_lock: {
        Args: { p_club_id: string; p_starts_at: string }
        Returns: undefined
      }
      get_boost_for_run: { Args: never; Returns: Json }
      get_bracket_pool_id: { Args: { _bracket_id: string }; Returns: string }
      get_club_password: { Args: { _club_id: string }; Returns: string }
      is_app_admin: { Args: { _user_id: string }; Returns: boolean }
      is_club_admin: {
        Args: { _club: string; _user: string }
        Returns: boolean
      }
      is_club_manager: {
        Args: { _club: string; _user: string }
        Returns: boolean
      }
      is_pick_unlocked: { Args: { _game_id: string }; Returns: boolean }
      is_platform_owner: { Args: { _user: string }; Returns: boolean }
      is_pool_admin: {
        Args: { _pool_id: string; _user_id: string }
        Returns: boolean
      }
      is_pool_member: {
        Args: { _pool_id: string; _user_id: string }
        Returns: boolean
      }
      join_club_with_password:
        | { Args: { _password: string }; Returns: string }
        | { Args: { _password: string; _user_id: string }; Returns: string }
      journey_advance_scene: { Args: { _run_id: string }; Returns: Json }
      journey_apply_effects: {
        Args: { _effects: Json; _state: Json }
        Returns: Json
      }
      journey_create_character: {
        Args: {
          _background?: string
          _name: string
          _origin?: string
          _pronouns?: string
          _stats?: Json
        }
        Returns: {
          abilities: string[]
          background: string | null
          created_at: string
          currency: number
          equipment: Json
          health: number
          id: string
          level: number
          max_health: number
          name: string
          origin: string | null
          portrait: string | null
          pronouns: string | null
          stats: Json
          traits: string[]
          updated_at: string
          user_id: string
          xp: number
        }
        SetofOptions: {
          from: "*"
          to: "journey_characters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      journey_default_state: {
        Args: {
          _character: Database["public"]["Tables"]["journey_characters"]["Row"]
        }
        Returns: Json
      }
      journey_effect_notices: { Args: { _effects: Json }; Returns: Json }
      journey_endings_content: {
        Args: { _campaign_id: string; _version: number }
        Returns: Json
      }
      journey_enter_scene: {
        Args: {
          _campaign_id: string
          _scene_key: string
          _state: Json
          _version: number
        }
        Returns: Json
      }
      journey_eval_requirements: {
        Args: { _req: Json; _state: Json }
        Returns: boolean
      }
      journey_execute_choice: {
        Args: { _choice_key: string; _run_id: string; _scene_key: string }
        Returns: Json
      }
      journey_get_ending: { Args: { _run_id: string }; Returns: Json }
      journey_get_runtime_scene: { Args: { _run_id: string }; Returns: Json }
      journey_get_world: { Args: { _run_id: string }; Returns: Json }
      journey_import_campaign: { Args: { _package: Json }; Returns: Json }
      journey_is_author: { Args: { _uid: string }; Returns: boolean }
      journey_list_campaigns: { Args: never; Returns: Json }
      journey_live_scene: {
        Args: { _campaign_id: string; _scene_key: string }
        Returns: Json
      }
      journey_publish_campaign: {
        Args: { _campaign_id: string; _notes?: string }
        Returns: {
          author: string | null
          author_notes: string | null
          config: Json
          content_notes: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_length: string | null
          hero_image: string | null
          id: string
          minimum_level: number
          published_at: string | null
          recommended_level: number
          slug: string
          starting_scene_key: string | null
          status: string
          subtitle: string | null
          tags: string[]
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "journey_campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      journey_release_package: {
        Args: { _campaign_id: string; _version: number }
        Returns: Json
      }
      journey_resolve_ending: {
        Args: {
          _campaign_id: string
          _fallback: string
          _state: Json
          _version: number
        }
        Returns: string
      }
      journey_scene_content: {
        Args: { _campaign_id: string; _scene_key: string; _version: number }
        Returns: Json
      }
      journey_set_asset: {
        Args: {
          _campaign_id: string
          _key: string
          _target: string
          _url: string
        }
        Returns: undefined
      }
      journey_set_run_status: {
        Args: { _run_id: string; _status: string }
        Returns: {
          campaign_id: string
          campaign_version: number
          character_id: string | null
          completed_at: string | null
          created_at: string
          current_chapter_key: string | null
          current_scene_key: string | null
          ending_key: string | null
          id: string
          is_test_run: boolean
          last_played_at: string
          playtime_seconds: number
          run_number: number
          started_at: string
          state: Json
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "journey_campaign_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      journey_start_run: {
        Args: {
          _campaign_id: string
          _character_id: string
          _is_test?: boolean
        }
        Returns: {
          campaign_id: string
          campaign_version: number
          character_id: string | null
          completed_at: string | null
          created_at: string
          current_chapter_key: string | null
          current_scene_key: string | null
          ending_key: string | null
          id: string
          is_test_run: boolean
          last_played_at: string
          playtime_seconds: number
          run_number: number
          started_at: string
          state: Json
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "journey_campaign_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      journey_state_number: {
        Args: { _bucket: string; _key: string; _state: Json }
        Returns: number
      }
      journey_test_patch_run: {
        Args: { _run_id: string; _scene_key: string; _state_patch: Json }
        Returns: {
          campaign_id: string
          campaign_version: number
          character_id: string | null
          completed_at: string | null
          created_at: string
          current_chapter_key: string | null
          current_scene_key: string | null
          ending_key: string | null
          id: string
          is_test_run: boolean
          last_played_at: string
          playtime_seconds: number
          run_number: number
          started_at: string
          state: Json
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "journey_campaign_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      journey_validate_campaign: {
        Args: { _campaign_id: string }
        Returns: Json
      }
      journey_world_content: {
        Args: { _campaign_id: string; _version: number }
        Returns: Json
      }
      log_admin_action: {
        Args: {
          _action: string
          _metadata?: Json
          _target_id?: string
          _target_type?: string
        }
        Returns: string
      }
      narrative_can_see_campaign: {
        Args: { _campaign: string; _user: string }
        Returns: boolean
      }
      narrative_has_pending_invite: {
        Args: { _campaign: string; _user: string }
        Returns: boolean
      }
      narrative_is_club_admin: {
        Args: { _campaign: string; _user: string }
        Returns: boolean
      }
      narrative_is_gm: {
        Args: { _campaign: string; _user: string }
        Returns: boolean
      }
      narrative_is_member: {
        Args: { _campaign: string; _user: string }
        Returns: boolean
      }
      narrative_role_in: {
        Args: { _campaign: string; _user: string }
        Returns: string
      }
      nfl_week_lock_at: { Args: { _week_id: string }; Returns: string }
      purchase_boost: { Args: { _boost_code: string }; Returns: Json }
      readshift_read_cards: {
        Args: { _round_id: string }
        Returns: {
          answer_id: string
          body: string
        }[]
      }
      readshift_read_progress: {
        Args: { _round_id: string }
        Returns: {
          submitted: number
          total: number
        }[]
      }
      readshift_round_authors: {
        Args: { _round_id: string }
        Returns: {
          user_id: string
        }[]
      }
      readshift_shift_progress: {
        Args: { _round_id: string }
        Returns: {
          submitted: number
          total: number
        }[]
      }
      recompute_nfl_week_status: {
        Args: { _week_id: string }
        Returns: undefined
      }
      rune_delve_earn_shards: {
        Args: { p_amount: number }
        Returns: {
          club_id: string
          created_at: string
          lifetime_shards_earned: number
          shards: number
          slots_unlocked: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "rune_delve_wallet"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rune_delve_spend_shards: {
        Args: { p_amount: number }
        Returns: {
          club_id: string
          created_at: string
          lifetime_shards_earned: number
          shards: number
          slots_unlocked: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "rune_delve_wallet"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_displayed_sigil: { Args: { _sigil_code: string }; Returns: undefined }
      shares_club_with: { Args: { _a: string; _b: string }; Returns: boolean }
      submit_operation_contribution: {
        Args: {
          _boss_damage: number
          _duration_seconds: number
          _kills: number
          _nexus_run_id: string
          _operation_id: string
          _score: number
          _waves: number
        }
        Returns: Json
      }
      toggle_message_pin: { Args: { p_message_id: string }; Returns: undefined }
      transition_narrative_campaign: {
        Args: {
          _campaign_id: string
          _event_type: string
          _next_status: string
          _notes: string
        }
        Returns: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          canon_locks: Json
          club_id: string
          content_notes: string | null
          created_at: string
          created_by: string
          current_chapter_id: string | null
          current_scene_id: string | null
          description: string | null
          gm_id: string | null
          id: string
          live_session_id: string | null
          live_started_at: string | null
          memory_summary: string | null
          opening_premise: string | null
          pitch: string | null
          play_mode: string
          player_limit: number | null
          proposed_gm_id: string | null
          schedule_note: string | null
          slug: string | null
          spectators_allowed: boolean
          status: string
          submitted_at: string | null
          template_key: string
          title: string
          tone_profile: string | null
          updated_at: string
          visibility: string
          waiting_on_state: Json
        }
        SetofOptions: {
          from: "*"
          to: "narrative_campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_club_request: {
        Args: { _proposed_name: string; _reason: string; _user_note: string }
        Returns: {
          created_at: string
          id: string
          proposed_name: string
          reason: string | null
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_note: string | null
        }
        SetofOptions: {
          from: "*"
          to: "club_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "owner"
      nexus_ledger_reason:
        | "endless_milestone"
        | "operation_reward"
        | "operation_mvp"
        | "boost_purchase"
        | "admin_grant"
        | "admin_debit"
      nexus_sigil_rarity: "common" | "rare" | "epic" | "legendary"
      pw_challenge_status:
        | "upcoming"
        | "locked"
        | "active"
        | "completed"
        | "archived"
      rd_quest_scope: "daily" | "weekly"
      rd_quest_status: "active" | "completed" | "claimed"
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
      app_role: ["admin", "moderator", "user", "owner"],
      nexus_ledger_reason: [
        "endless_milestone",
        "operation_reward",
        "operation_mvp",
        "boost_purchase",
        "admin_grant",
        "admin_debit",
      ],
      nexus_sigil_rarity: ["common", "rare", "epic", "legendary"],
      pw_challenge_status: [
        "upcoming",
        "locked",
        "active",
        "completed",
        "archived",
      ],
      rd_quest_scope: ["daily", "weekly"],
      rd_quest_status: ["active", "completed", "claimed"],
    },
  },
} as const
