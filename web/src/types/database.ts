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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string
          id: string
          name: string
          position: number
        }
        Insert: {
          color?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          color?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      clip_media: {
        Row: {
          clip_id: string
          created_at: string
          expires_at: string
          file_name: string
          id: string
          kind: string
          mime: string
          purpose: string
          r2_key: string
          ready_at: string | null
          round: number
          size_bytes: number
          status: string
          uploaded_by: string | null
          uploader_name: string
        }
        Insert: {
          clip_id: string
          created_at?: string
          expires_at: string
          file_name: string
          id?: string
          kind: string
          mime: string
          purpose: string
          r2_key: string
          ready_at?: string | null
          round?: number
          size_bytes: number
          status?: string
          uploaded_by?: string | null
          uploader_name?: string
        }
        Update: {
          clip_id?: string
          created_at?: string
          expires_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime?: string
          purpose?: string
          r2_key?: string
          ready_at?: string | null
          round?: number
          size_bytes?: number
          status?: string
          uploaded_by?: string | null
          uploader_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "clip_media_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "clips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clip_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          brief_updated_at: string
          category_id: string
          created_by: string | null
          date: string
          deleted_at: string | null
          id: string
          note: string
          position: number
          revision_note: string
          round: number
          script: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          brief_updated_at?: string
          category_id: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          id?: string
          note?: string
          position?: number
          revision_note?: string
          round?: number
          script?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          brief_updated_at?: string
          category_id?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          note?: string
          position?: number
          revision_note?: string
          round?: number
          script?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clips_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id: string
          role: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      storage_usage: {
        Row: {
          file_count: number | null
          total_bytes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      category_counts: {
        Args: never
        Returns: {
          category_id: string
          n: number
        }[]
      }
      clip_day_counts: {
        Args: { p_from: string; p_to: string }
        Returns: {
          category_id: string
          date: string
          n: number
        }[]
      }
      copy_clip: {
        Args: { p_date: string; p_id: string }
        Returns: {
          brief_updated_at: string
          category_id: string
          created_by: string | null
          date: string
          deleted_at: string | null
          id: string
          note: string
          position: number
          revision_note: string
          round: number
          script: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_category: { Args: { p_id: string }; Returns: undefined }
      is_owner: { Args: never; Returns: boolean }
      move_clip: { Args: { p_dir: number; p_id: string }; Returns: undefined }
      next_position: { Args: { p_date: string }; Returns: number }
      purge_deleted_clips: { Args: never; Returns: undefined }
      purge_stale_media: { Args: never; Returns: undefined }
      require_owner: { Args: never; Returns: undefined }
      retention_days: { Args: { p_purpose: string }; Returns: number }
      safe_file_name: { Args: { p_name: string }; Returns: string }
      search_clips: {
        Args: { p_q: string }
        Returns: {
          brief_updated_at: string
          category_id: string
          created_by: string | null
          date: string
          deleted_at: string | null
          id: string
          note: string
          position: number
          revision_note: string
          round: number
          script: string
          status: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "clips"
          isOneToOne: false
          isSetofReturn: true
        }
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
