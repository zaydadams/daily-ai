export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      content_history: {
        Row: {
          content: string
          email: string
          id: string
          industry: string
          sent_at: string | null
          template: string
          tone_name: string | null
          user_id: string
        }
        Insert: {
          content: string
          email: string
          id?: string
          industry: string
          sent_at?: string | null
          template: string
          tone_name?: string | null
          user_id: string
        }
        Update: {
          content?: string
          email?: string
          id?: string
          industry?: string
          sent_at?: string | null
          template?: string
          tone_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_preferences"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_industry_preferences"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_email_logs: {
        Row: {
          created_at: string | null
          email: string
          error_message: string | null
          id: string
          industry: string
          scheduled_time: string | null
          status: string | null
          template: string
        }
        Insert: {
          created_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          industry: string
          scheduled_time?: string | null
          status?: string | null
          template: string
        }
        Update: {
          created_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          industry?: string
          scheduled_time?: string | null
          status?: string | null
          template?: string
        }
        Relationships: []
      }
      user_industry_preferences: {
        Row: {
          auto_generate: boolean | null
          created_at: string | null
          delivery_time: string | null
          email: string
          id: string
          industry: string
          temperature: number | null
          template: string
          timezone: string | null
          tone_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_generate?: boolean | null
          created_at?: string | null
          delivery_time?: string | null
          email: string
          id?: string
          industry: string
          temperature?: number | null
          template: string
          timezone?: string | null
          tone_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_generate?: boolean | null
          created_at?: string | null
          delivery_time?: string | null
          email?: string
          id?: string
          industry?: string
          temperature?: number | null
          template?: string
          timezone?: string | null
          tone_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          customer_id: string | null
          email: string
          expires_at: string | null
          id: string
          plan_type: string
          status: string
          subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          email: string
          expires_at?: string | null
          id?: string
          plan_type?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          plan_type?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string | null
          event_data: Json
          event_id: string
          event_type: string
          id: string
        }
        Insert: {
          created_at?: string | null
          event_data: Json
          event_id: string
          event_type: string
          id?: string
        }
        Update: {
          created_at?: string | null
          event_data?: Json
          event_id?: string
          event_type?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_user_preferences: {
        Args: {
          p_email: string
          p_industry: string
          p_template: string
          p_delivery_time: string
          p_timezone: string
          p_auto_generate: boolean
          p_user_id: string
        }
        Returns: string
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
