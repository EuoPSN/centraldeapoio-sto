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
      access_logs: {
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
      ai_settings: {
        Row: {
          id: number
          model: string
          system_prompt: string
          updated_at: string
        }
        Insert: {
          id?: number
          model?: string
          system_prompt: string
          updated_at?: string
        }
        Update: {
          id?: number
          model?: string
          system_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          accent_color: string | null
          active_theme: string
          background_color: string | null
          cover_url: string | null
          favicon_url: string | null
          id: number
          logo_url: string | null
          platform_name: string
          primary_color: string | null
          secondary_color: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          active_theme?: string
          background_color?: string | null
          cover_url?: string | null
          favicon_url?: string | null
          id?: number
          logo_url?: string | null
          platform_name?: string
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          active_theme?: string
          background_color?: string | null
          cover_url?: string | null
          favicon_url?: string | null
          id?: number
          logo_url?: string | null
          platform_name?: string
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          position: number
          scope: string
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          scope: string
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          scope?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          behaviors: string | null
          created_at: string
          difficulty: string | null
          id: string
          name: string
          objections: string | null
          objectives: string | null
          personality: string | null
          updated_at: string
        }
        Insert: {
          behaviors?: string | null
          created_at?: string
          difficulty?: string | null
          id?: string
          name: string
          objections?: string | null
          objectives?: string | null
          personality?: string | null
          updated_at?: string
        }
        Update: {
          behaviors?: string | null
          created_at?: string
          difficulty?: string | null
          id?: string
          name?: string
          objections?: string | null
          objectives?: string | null
          personality?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_items: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          link_externo: string | null
          link_label: string | null
          position: number
          section: Database["public"]["Enums"]["content_section"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          link_externo?: string | null
          link_label?: string | null
          position?: number
          section: Database["public"]["Enums"]["content_section"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          link_externo?: string | null
          link_label?: string | null
          position?: number
          section?: Database["public"]["Enums"]["content_section"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      flow_edges: {
        Row: {
          condition: string | null
          created_at: string
          flow_id: string
          id: string
          label: string | null
          source_handle: string | null
          source_node_id: string
          target_handle: string | null
          target_node_id: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          flow_id: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id: string
          target_handle?: string | null
          target_node_id: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          flow_id?: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id?: string
          target_handle?: string | null
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_nodes: {
        Row: {
          color: string | null
          created_at: string
          data: Json
          flow_id: string
          icon: string | null
          id: string
          message: string | null
          node_type: string
          note: string | null
          parent_id: string | null
          position: number
          position_x: number
          position_y: number
          title: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          data?: Json
          flow_id: string
          icon?: string | null
          id?: string
          message?: string | null
          node_type?: string
          note?: string | null
          parent_id?: string | null
          position?: number
          position_x?: number
          position_y?: number
          title: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          data?: Json
          flow_id?: string
          icon?: string | null
          id?: string
          message?: string | null
          node_type?: string
          note?: string | null
          parent_id?: string | null
          position?: number
          position_x?: number
          position_y?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_training: boolean
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_training?: boolean
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_training?: boolean
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flows_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios_metas: {
        Row: {
          created_at: string | null
          dias_uteis: number
          id: string
          mes_referencia: string
          meta_diaria: number | null
          meta_mensal: number
          meta_semanal: number | null
          nome: string
        }
        Insert: {
          created_at?: string | null
          dias_uteis?: number
          id?: string
          mes_referencia: string
          meta_diaria?: number | null
          meta_mensal?: number
          meta_semanal?: number | null
          nome: string
        }
        Update: {
          created_at?: string | null
          dias_uteis?: number
          id?: string
          mes_referencia?: string
          meta_diaria?: number | null
          meta_mensal?: number
          meta_semanal?: number | null
          nome?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          source_id: string
          source_type: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_id: string
          source_type: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_id?: string
          source_type?: string
          title?: string
        }
        Relationships: []
      }
      knowledge_entries: {
        Row: {
          category_id: string | null
          content: string
          created_at: string
          created_by: string | null
          external_url: string | null
          file_mime: string | null
          file_name: string | null
          file_url: string | null
          id: string
          kind: string
          metadata: Json
          position: number
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          kind: string
          metadata?: Json
          position?: number
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          kind?: string
          metadata?: Json
          position?: number
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_funil: {
        Row: {
          apresentacao: number
          created_at: string | null
          created_by: string | null
          data: string
          desqualificados: number
          id: string
          leads_entrados: number
          nao_responde: number
          negociacao: number
          origem: string
          qualificados: number
          sem_interesse: number
          vendas_fechadas: number
        }
        Insert: {
          apresentacao?: number
          created_at?: string | null
          created_by?: string | null
          data: string
          desqualificados?: number
          id?: string
          leads_entrados?: number
          nao_responde?: number
          negociacao?: number
          origem: string
          qualificados?: number
          sem_interesse?: number
          vendas_fechadas?: number
        }
        Update: {
          apresentacao?: number
          created_at?: string | null
          created_by?: string | null
          data?: string
          desqualificados?: number
          id?: string
          leads_entrados?: number
          nao_responde?: number
          negociacao?: number
          origem?: string
          qualificados?: number
          sem_interesse?: number
          vendas_fechadas?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          category_id: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          internal_note: string | null
          position: number
          subcategory_id: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_note?: string | null
          position?: number
          subcategory_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_note?: string | null
          position?: number
          subcategory_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      nav_items: {
        Row: {
          admin_only: boolean
          created_at: string
          icon: string
          id: string
          label: string
          position: number
          route: string
          section: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          admin_only?: boolean
          created_at?: string
          icon?: string
          id?: string
          label: string
          position?: number
          route: string
          section?: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          admin_only?: boolean
          created_at?: string
          icon?: string
          id?: string
          label?: string
          position?: number
          route?: string
          section?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      pricing_items: {
        Row: {
          cartao_price: number | null
          category: string
          created_at: string
          id: string
          notes: string | null
          particular_price: number | null
          position: number
          specialty: string
          updated_at: string
        }
        Insert: {
          cartao_price?: number | null
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          particular_price?: number | null
          position?: number
          specialty: string
          updated_at?: string
        }
        Update: {
          cartao_price?: number | null
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          particular_price?: number | null
          position?: number
          specialty?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          updated_at: string
          xp: number
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          is_active?: boolean
          last_seen_at?: string | null
          updated_at?: string
          xp?: number
        }
        Update: {
          cargo?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      prospeccao_diaria: {
        Row: {
          canal: string
          created_at: string | null
          created_by: string | null
          data: string
          id: string
          oportunidades: number
          tentativas: number
          vendas: number
          vendedor: string
        }
        Insert: {
          canal: string
          created_at?: string | null
          created_by?: string | null
          data: string
          id?: string
          oportunidades?: number
          tentativas?: number
          vendas?: number
          vendedor: string
        }
        Update: {
          canal?: string
          created_at?: string | null
          created_by?: string | null
          data?: string
          id?: string
          oportunidades?: number
          tentativas?: number
          vendas?: number
          vendedor?: string
        }
        Relationships: []
      }
      relatorio_prospeccao: {
        Row: {
          area: string
          created_at: string | null
          data: string
          id: string
          ligacoes: number
          mensagens: number
          oportunidades: number
          tentativas: number
          updated_at: string | null
          user_id: string
          vendas: number
          ztalk: number
        }
        Insert: {
          area: string
          created_at?: string | null
          data: string
          id?: string
          ligacoes?: number
          mensagens?: number
          oportunidades?: number
          tentativas?: number
          updated_at?: string | null
          user_id: string
          vendas?: number
          ztalk?: number
        }
        Update: {
          area?: string
          created_at?: string | null
          data?: string
          id?: string
          ligacoes?: number
          mensagens?: number
          oportunidades?: number
          tentativas?: number
          updated_at?: string | null
          user_id?: string
          vendas?: number
          ztalk?: number
        }
        Relationships: []
      }
      scripts: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          position: number
          subcategory: string | null
          title: string
          updated_at: string
          usage_note: string | null
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          position?: number
          subcategory?: string | null
          title: string
          updated_at?: string
          usage_note?: string | null
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          position?: number
          subcategory?: string | null
          title?: string
          updated_at?: string
          usage_note?: string | null
        }
        Relationships: []
      }
      simulator_results: {
        Row: {
          created_at: string
          difficulty: string
          erros: string[]
          id: string
          nota: number
          pontos_fortes: string[]
          pontos_melhoria: string[]
          profile_id: string | null
          profile_name: string
          resumo: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          erros?: string[]
          id?: string
          nota: number
          pontos_fortes?: string[]
          pontos_melhoria?: string[]
          profile_id?: string | null
          profile_name: string
          resumo?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          erros?: string[]
          id?: string
          nota?: number
          pontos_fortes?: string[]
          pontos_melhoria?: string[]
          profile_id?: string | null
          profile_name?: string
          resumo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulator_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      simulator_sessions: {
        Row: {
          finished_at: string | null
          flow_id: string
          id: string
          path: Json
          started_at: string
          user_id: string
        }
        Insert: {
          finished_at?: string | null
          flow_id: string
          id?: string
          path?: Json
          started_at?: string
          user_id: string
        }
        Update: {
          finished_at?: string | null
          flow_id?: string
          id?: string
          path?: Json
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulator_sessions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          admin_response: string | null
          category: string
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      themes: {
        Row: {
          created_at: string
          id: string
          is_preset: boolean
          name: string
          tokens: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_preset?: boolean
          name: string
          tokens?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_preset?: boolean
          name?: string
          tokens?: Json
          updated_at?: string
        }
        Relationships: []
      }
      training_completions: {
        Row: {
          completed_at: string
          content_id: string
          created_at: string
          id: string
          progress_pct: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          content_id: string
          created_at?: string
          id?: string
          progress_pct?: number
          user_id: string
        }
        Update: {
          completed_at?: string
          content_id?: string
          created_at?: string
          id?: string
          progress_pct?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_knowledge: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "funcionario"
      content_section: "conhecimento" | "problemas" | "tutoriais"
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
  public: {
    Enums: {
      app_role: ["admin", "funcionario"],
      content_section: ["conhecimento", "problemas", "tutoriais"],
    },
  },
} as const
