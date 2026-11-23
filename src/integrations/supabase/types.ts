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
      admin_sections: {
        Row: {
          created_at: string
          group_name: string
          icon: string
          id: string
          label: string
          position: number
          tab_key: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          group_name?: string
          icon?: string
          id?: string
          label: string
          position?: number
          tab_key: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          group_name?: string
          icon?: string
          id?: string
          label?: string
          position?: number
          tab_key?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          client_knowledge: string
          essential_facts: string | null
          id: number
          model: string
          simulador_nota_referencia: number | null
          system_prompt: string
          updated_at: string
        }
        Insert: {
          client_knowledge?: string
          essential_facts?: string | null
          id?: number
          model?: string
          simulador_nota_referencia?: number | null
          system_prompt: string
          updated_at?: string
        }
        Update: {
          client_knowledge?: string
          essential_facts?: string | null
          id?: number
          model?: string
          simulador_nota_referencia?: number | null
          system_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      ajuda_feedback: {
        Row: {
          content_item_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          util: boolean
        }
        Insert: {
          content_item_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          util: boolean
        }
        Update: {
          content_item_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          util?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ajuda_feedback_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          accent_color: string | null
          active_theme: string
          amor_saude_site_url: string | null
          avaliacao_odonto_valor: number | null
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
          amor_saude_site_url?: string | null
          avaliacao_odonto_valor?: number | null
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
          amor_saude_site_url?: string | null
          avaliacao_odonto_valor?: number | null
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
      aquecimento_config: {
        Row: {
          cartoes_por_dia: number
          horarios: string[]
          id: number
          janela_dominio_dias: number
          limiar_dominando: number
          min_respostas: number
          nota_acerto: number
          updated_at: string
        }
        Insert: {
          cartoes_por_dia?: number
          horarios?: string[]
          id?: number
          janela_dominio_dias?: number
          limiar_dominando?: number
          min_respostas?: number
          nota_acerto?: number
          updated_at?: string
        }
        Update: {
          cartoes_por_dia?: number
          horarios?: string[]
          id?: number
          janela_dominio_dias?: number
          limiar_dominando?: number
          min_respostas?: number
          nota_acerto?: number
          updated_at?: string
        }
        Relationships: []
      }
      aquecimento_exercicios: {
        Row: {
          alternativas: Json
          aprovado_por: string | null
          contexto: string
          created_at: string
          criado_por: string
          explicacao: string
          fonte: string
          habito_chave: string | null
          id: string
          objecao_id: string | null
          pergunta: string
          resposta_aprovada: string
          status: string
          tema_id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          alternativas?: Json
          aprovado_por?: string | null
          contexto?: string
          created_at?: string
          criado_por?: string
          explicacao?: string
          fonte?: string
          habito_chave?: string | null
          id?: string
          objecao_id?: string | null
          pergunta: string
          resposta_aprovada?: string
          status?: string
          tema_id: string
          tipo: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          alternativas?: Json
          aprovado_por?: string | null
          contexto?: string
          created_at?: string
          criado_por?: string
          explicacao?: string
          fonte?: string
          habito_chave?: string | null
          id?: string
          objecao_id?: string | null
          pergunta?: string
          resposta_aprovada?: string
          status?: string
          tema_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aquecimento_exercicios_objecao_id_fkey"
            columns: ["objecao_id"]
            isOneToOne: false
            referencedRelation: "objecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aquecimento_exercicios_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "dominio_temas"
            referencedColumns: ["id"]
          },
        ]
      }
      aquecimento_prefs: {
        Row: {
          notificar: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          notificar?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          notificar?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aquecimento_respostas: {
        Row: {
          acertou: boolean
          created_at: string
          exercicio_id: string | null
          id: string
          nota: number | null
          sessao_id: string
          tema_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          acertou: boolean
          created_at?: string
          exercicio_id?: string | null
          id?: string
          nota?: number | null
          sessao_id: string
          tema_id?: string | null
          tipo: string
          user_id?: string
        }
        Update: {
          acertou?: boolean
          created_at?: string
          exercicio_id?: string | null
          id?: string
          nota?: number | null
          sessao_id?: string
          tema_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aquecimento_respostas_exercicio_id_fkey"
            columns: ["exercicio_id"]
            isOneToOne: false
            referencedRelation: "aquecimento_exercicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aquecimento_respostas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "aquecimento_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aquecimento_respostas_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "dominio_temas"
            referencedColumns: ["id"]
          },
        ]
      }
      aquecimento_sessoes: {
        Row: {
          concluida_em: string | null
          data: string
          id: string
          iniciada_em: string
          status: string
          tema_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          concluida_em?: string | null
          data?: string
          id?: string
          iniciada_em?: string
          status?: string
          tema_id?: string | null
          tipo: string
          user_id?: string
        }
        Update: {
          concluida_em?: string | null
          data?: string
          id?: string
          iniciada_em?: string
          status?: string
          tema_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aquecimento_sessoes_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "dominio_temas"
            referencedColumns: ["id"]
          },
        ]
      }
      cadencia_mensagens: {
        Row: {
          audio_exemplo_url: string | null
          canal: string
          codigo: string | null
          created_at: string
          etapa: string
          id: string
          papel: string
          ponto_parada: string
          por_que: string
          publicada_em: string | null
          status: string
          texto: string
          updated_at: string
          versao: number
        }
        Insert: {
          audio_exemplo_url?: string | null
          canal?: string
          codigo?: string | null
          created_at?: string
          etapa: string
          id?: string
          papel?: string
          ponto_parada: string
          por_que?: string
          publicada_em?: string | null
          status?: string
          texto?: string
          updated_at?: string
          versao?: number
        }
        Update: {
          audio_exemplo_url?: string | null
          canal?: string
          codigo?: string | null
          created_at?: string
          etapa?: string
          id?: string
          papel?: string
          ponto_parada?: string
          por_que?: string
          publicada_em?: string | null
          status?: string
          texto?: string
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      cadencia_mensagens_versoes: {
        Row: {
          audio_exemplo_url: string | null
          canal: string
          codigo: string
          etapa: string
          id: string
          mensagem_id: string
          papel: string
          ponto_parada: string
          por_que: string
          publicada_em: string | null
          substituida_em: string
          texto: string
          versao: number
        }
        Insert: {
          audio_exemplo_url?: string | null
          canal: string
          codigo: string
          etapa: string
          id?: string
          mensagem_id: string
          papel: string
          ponto_parada: string
          por_que: string
          publicada_em?: string | null
          substituida_em?: string
          texto: string
          versao: number
        }
        Update: {
          audio_exemplo_url?: string | null
          canal?: string
          codigo?: string
          etapa?: string
          id?: string
          mensagem_id?: string
          papel?: string
          ponto_parada?: string
          por_que?: string
          publicada_em?: string | null
          substituida_em?: string
          texto?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "cadencia_mensagens_versoes_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "cadencia_mensagens"
            referencedColumns: ["id"]
          },
        ]
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
          video_duracao: string | null
          video_url: string | null
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
          video_duracao?: string | null
          video_url?: string | null
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
          video_duracao?: string | null
          video_url?: string | null
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
      cerebro_blocos: {
        Row: {
          ativo: boolean
          chave: string
          conteudo: string
          descricao_curta: string
          ferramentas: string[]
          gerado: boolean
          id: string
          ordem: number
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          chave: string
          conteudo?: string
          descricao_curta?: string
          ferramentas?: string[]
          gerado?: boolean
          id?: string
          ordem?: number
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          chave?: string
          conteudo?: string
          descricao_curta?: string
          ferramentas?: string[]
          gerado?: boolean
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cerebro_blocos_versoes: {
        Row: {
          ativo: boolean
          bloco_id: string
          chave: string
          conteudo: string
          ferramentas: string[]
          id: string
          salvo_em: string
          salvo_por: string | null
          substituida_em: string
        }
        Insert: {
          ativo?: boolean
          bloco_id: string
          chave: string
          conteudo: string
          ferramentas?: string[]
          id?: string
          salvo_em: string
          salvo_por?: string | null
          substituida_em?: string
        }
        Update: {
          ativo?: boolean
          bloco_id?: string
          chave?: string
          conteudo?: string
          ferramentas?: string[]
          id?: string
          salvo_em?: string
          salvo_por?: string | null
          substituida_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "cerebro_blocos_versoes_bloco_id_fkey"
            columns: ["bloco_id"]
            isOneToOne: false
            referencedRelation: "cerebro_blocos"
            referencedColumns: ["id"]
          },
        ]
      }
      cerebro_regras_fixas: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          ordem: number
          texto: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          texto: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          texto?: string
          updated_at?: string
        }
        Relationships: []
      }
      changelog_confirmacoes: {
        Row: {
          acertou_checagem: boolean | null
          confirmado_em: string
          entry_id: string
          id: string
          user_id: string
        }
        Insert: {
          acertou_checagem?: boolean | null
          confirmado_em?: string
          entry_id: string
          id?: string
          user_id?: string
        }
        Update: {
          acertou_checagem?: boolean | null
          confirmado_em?: string
          entry_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_confirmacoes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "changelog_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog_entries: {
        Row: {
          created_at: string
          criada_por: string | null
          exercicio_id: string | null
          id: string
          incorporada: boolean
          lembrete_em: string | null
          link: string | null
          origem: string
          pergunta_checagem: Json | null
          publicada_em: string | null
          published: boolean
          summary: string
          tipo: string
          title: string
          usar_na_ia: boolean
          vale_a_partir: string | null
          validade: string | null
        }
        Insert: {
          created_at?: string
          criada_por?: string | null
          exercicio_id?: string | null
          id?: string
          incorporada?: boolean
          lembrete_em?: string | null
          link?: string | null
          origem?: string
          pergunta_checagem?: Json | null
          publicada_em?: string | null
          published?: boolean
          summary: string
          tipo?: string
          title: string
          usar_na_ia?: boolean
          vale_a_partir?: string | null
          validade?: string | null
        }
        Update: {
          created_at?: string
          criada_por?: string | null
          exercicio_id?: string | null
          id?: string
          incorporada?: boolean
          lembrete_em?: string | null
          link?: string | null
          origem?: string
          pergunta_checagem?: Json | null
          publicada_em?: string | null
          published?: boolean
          summary?: string
          tipo?: string
          title?: string
          usar_na_ia?: boolean
          vale_a_partir?: string | null
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "changelog_entries_exercicio_id_fkey"
            columns: ["exercicio_id"]
            isOneToOne: false
            referencedRelation: "aquecimento_exercicios"
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
          attachments: Json
          cliente_mensagem: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          sem_base: boolean
          sources: Json | null
        }
        Insert: {
          attachments?: Json
          cliente_mensagem?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          sem_base?: boolean
          sources?: Json | null
        }
        Update: {
          attachments?: Json
          cliente_mensagem?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          sem_base?: boolean
          sources?: Json | null
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
      checklist_entries: {
        Row: {
          created_at: string
          dia: string
          id: string
          item_id: string
          marcado: boolean
          updated_at: string
          user_id: string
          valor: number | null
        }
        Insert: {
          created_at?: string
          dia: string
          id?: string
          item_id: string
          marcado?: boolean
          updated_at?: string
          user_id: string
          valor?: number | null
        }
        Update: {
          created_at?: string
          dia?: string
          id?: string
          item_id?: string
          marcado?: boolean
          updated_at?: string
          user_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          meta_padrao: number | null
          position: number
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta_padrao?: number | null
          position?: number
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta_padrao?: number | null
          position?: number
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_profile_states: {
        Row: {
          advance_criteria: string | null
          attachment_label: string | null
          attachment_url: string | null
          created_at: string
          description: string | null
          example_lines: string | null
          id: string
          name: string
          overlay_cpf_x: number | null
          overlay_cpf_y: number | null
          overlay_enabled: boolean
          overlay_nome_x: number | null
          overlay_nome_y: number | null
          position: number
          profile_id: string
          updated_at: string
        }
        Insert: {
          advance_criteria?: string | null
          attachment_label?: string | null
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          example_lines?: string | null
          id?: string
          name: string
          overlay_cpf_x?: number | null
          overlay_cpf_y?: number | null
          overlay_enabled?: boolean
          overlay_nome_x?: number | null
          overlay_nome_y?: number | null
          position?: number
          profile_id: string
          updated_at?: string
        }
        Update: {
          advance_criteria?: string | null
          attachment_label?: string | null
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          example_lines?: string | null
          id?: string
          name?: string
          overlay_cpf_x?: number | null
          overlay_cpf_y?: number | null
          overlay_enabled?: boolean
          overlay_nome_x?: number | null
          overlay_nome_y?: number | null
          position?: number
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_profile_states_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          behaviors: string | null
          category_id: string | null
          cliente_cpf: string | null
          cliente_genero: string | null
          cliente_nome: string | null
          cliente_origem_lead: string | null
          cliente_regiao: string | null
          cliente_telefone: string | null
          created_at: string
          dependentes: Json
          difficulty: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          id: string
          name: string
          objections: string | null
          objectives: string | null
          personality: string | null
          updated_at: string
        }
        Insert: {
          behaviors?: string | null
          category_id?: string | null
          cliente_cpf?: string | null
          cliente_genero?: string | null
          cliente_nome?: string | null
          cliente_origem_lead?: string | null
          cliente_regiao?: string | null
          cliente_telefone?: string | null
          created_at?: string
          dependentes?: Json
          difficulty?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          id?: string
          name: string
          objections?: string | null
          objectives?: string | null
          personality?: string | null
          updated_at?: string
        }
        Update: {
          behaviors?: string | null
          category_id?: string | null
          cliente_cpf?: string | null
          cliente_genero?: string | null
          cliente_nome?: string | null
          cliente_origem_lead?: string | null
          cliente_regiao?: string | null
          cliente_telefone?: string | null
          created_at?: string
          dependentes?: Json
          difficulty?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          id?: string
          name?: string
          objections?: string | null
          objectives?: string | null
          personality?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_disse_uso: {
        Row: {
          angulo: string | null
          created_at: string
          fechamento_item_id: string | null
          id: string
          objecao_id: string | null
          user_id: string
        }
        Insert: {
          angulo?: string | null
          created_at?: string
          fechamento_item_id?: string | null
          id?: string
          objecao_id?: string | null
          user_id?: string
        }
        Update: {
          angulo?: string | null
          created_at?: string
          fechamento_item_id?: string | null
          id?: string
          objecao_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_disse_uso_fechamento_item_id_fkey"
            columns: ["fechamento_item_id"]
            isOneToOne: false
            referencedRelation: "fechamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_disse_uso_objecao_id_fkey"
            columns: ["objecao_id"]
            isOneToOne: false
            referencedRelation: "objecoes"
            referencedColumns: ["id"]
          },
        ]
      }
      config_economia: {
        Row: {
          mensalidade: number | null
          plano: string
          updated_at: string
        }
        Insert: {
          mensalidade?: number | null
          plano: string
          updated_at?: string
        }
        Update: {
          mensalidade?: number | null
          plano?: string
          updated_at?: string
        }
        Relationships: []
      }
      config_mensagens_vendem: {
        Row: {
          id: number
          limite_baixo: number
          min_envios: number
          ultima_verificacao: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          limite_baixo?: number
          min_envios?: number
          ultima_verificacao?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          limite_baixo?: number
          min_envios?: number
          ultima_verificacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contatos_enderecos: {
        Row: {
          atende_tambem: string[]
          bairro: string | null
          cidade: string | null
          contato1: string | null
          contato2: string | null
          contato3: string | null
          created_at: string
          destaque: boolean
          email: string | null
          endereco: string | null
          horario: string | null
          id: string
          maps_url: string | null
          nome_regiao: string
          numero: string | null
          ponto_referencia: string | null
          position: number
          quando_indicar: string | null
          regiao: string | null
          site: string | null
          subtitulo: string | null
          tipo: string
          use_count: number
          whatsapp: string | null
        }
        Insert: {
          atende_tambem?: string[]
          bairro?: string | null
          cidade?: string | null
          contato1?: string | null
          contato2?: string | null
          contato3?: string | null
          created_at?: string
          destaque?: boolean
          email?: string | null
          endereco?: string | null
          horario?: string | null
          id?: string
          maps_url?: string | null
          nome_regiao: string
          numero?: string | null
          ponto_referencia?: string | null
          position?: number
          quando_indicar?: string | null
          regiao?: string | null
          site?: string | null
          subtitulo?: string | null
          tipo: string
          use_count?: number
          whatsapp?: string | null
        }
        Update: {
          atende_tambem?: string[]
          bairro?: string | null
          cidade?: string | null
          contato1?: string | null
          contato2?: string | null
          contato3?: string | null
          created_at?: string
          destaque?: boolean
          email?: string | null
          endereco?: string | null
          horario?: string | null
          id?: string
          maps_url?: string | null
          nome_regiao?: string
          numero?: string | null
          ponto_referencia?: string | null
          position?: number
          quando_indicar?: string | null
          regiao?: string | null
          site?: string | null
          subtitulo?: string | null
          tipo?: string
          use_count?: number
          whatsapp?: string | null
        }
        Relationships: []
      }
      content_item_views: {
        Row: {
          content_item_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_item_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_item_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_item_views_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
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
          video_duracao: string | null
          video_url: string | null
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
          video_duracao?: string | null
          video_url?: string | null
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
          video_duracao?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      conversas_fichas: {
        Row: {
          aprovada_por: string | null
          autor_id: string
          created_at: string
          dias_ate_fechar: number | null
          fechou_em: string | null
          id: string
          mensagem_chave: string
          motivo_recusa: string | null
          o_que_fez: string[]
          objecao_id: string | null
          objecao_rotulo: string
          onde_travou: string
          perfil_cliente: string
          plano: string
          ponto_parada: string
          por_que_funcionou: string
          publicada_em: string | null
          retomada_id: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          aprovada_por?: string | null
          autor_id?: string
          created_at?: string
          dias_ate_fechar?: number | null
          fechou_em?: string | null
          id?: string
          mensagem_chave?: string
          motivo_recusa?: string | null
          o_que_fez?: string[]
          objecao_id?: string | null
          objecao_rotulo?: string
          onde_travou?: string
          perfil_cliente?: string
          plano?: string
          ponto_parada: string
          por_que_funcionou?: string
          publicada_em?: string | null
          retomada_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          aprovada_por?: string | null
          autor_id?: string
          created_at?: string
          dias_ate_fechar?: number | null
          fechou_em?: string | null
          id?: string
          mensagem_chave?: string
          motivo_recusa?: string | null
          o_que_fez?: string[]
          objecao_id?: string | null
          objecao_rotulo?: string
          onde_travou?: string
          perfil_cliente?: string
          plano?: string
          ponto_parada?: string
          por_que_funcionou?: string
          publicada_em?: string | null
          retomada_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_fichas_objecao_id_fkey"
            columns: ["objecao_id"]
            isOneToOne: false
            referencedRelation: "objecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_fichas_retomada_id_fkey"
            columns: ["retomada_id"]
            isOneToOne: false
            referencedRelation: "retomadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_fichas_retomada_id_fkey"
            columns: ["retomada_id"]
            isOneToOne: false
            referencedRelation: "retomadas_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas_fichas_feedback: {
        Row: {
          created_at: string
          ficha_id: string
          motivo: string | null
          user_id: string
          util: boolean
        }
        Insert: {
          created_at?: string
          ficha_id: string
          motivo?: string | null
          user_id?: string
          util: boolean
        }
        Update: {
          created_at?: string
          ficha_id?: string
          motivo?: string | null
          user_id?: string
          util?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "conversas_fichas_feedback_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "conversas_fichas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_fechamentos: {
        Row: {
          enviado_em: string
          enviado_por: string | null
          id: string
          periodo_fim: string
          periodo_ini: string
          sem_ticket: number
          tickets_fechados: number
          user_id: string
          vendas: number
        }
        Insert: {
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          periodo_fim: string
          periodo_ini: string
          sem_ticket?: number
          tickets_fechados?: number
          user_id: string
          vendas?: number
        }
        Update: {
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          periodo_fim?: string
          periodo_ini?: string
          sem_ticket?: number
          tickets_fechados?: number
          user_id?: string
          vendas?: number
        }
        Relationships: []
      }
      crm_vendedor_map: {
        Row: {
          created_at: string
          updated_at: string
          user_id: string
          vendedor_nome_planilha: string
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_id: string
          vendedor_nome_planilha: string
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_id?: string
          vendedor_nome_planilha?: string
        }
        Relationships: []
      }
      decision_edges: {
        Row: {
          created_at: string | null
          from_node_id: string
          id: string
          label: string
          motor_id: string
          to_node_id: string
        }
        Insert: {
          created_at?: string | null
          from_node_id: string
          id?: string
          label: string
          motor_id: string
          to_node_id: string
        }
        Update: {
          created_at?: string | null
          from_node_id?: string
          id?: string
          label?: string
          motor_id?: string
          to_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "decision_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_edges_motor_id_fkey"
            columns: ["motor_id"]
            isOneToOne: false
            referencedRelation: "decision_motors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "decision_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_motors: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      decision_nodes: {
        Row: {
          created_at: string | null
          documentos: string | null
          id: string
          is_start: boolean | null
          mensagem: string | null
          motor_id: string
          observacoes: string | null
          orientacoes: string | null
          processo: string | null
          question_type: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          documentos?: string | null
          id?: string
          is_start?: boolean | null
          mensagem?: string | null
          motor_id: string
          observacoes?: string | null
          orientacoes?: string | null
          processo?: string | null
          question_type?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          documentos?: string | null
          id?: string
          is_start?: boolean | null
          mensagem?: string | null
          motor_id?: string
          observacoes?: string | null
          orientacoes?: string | null
          processo?: string | null
          question_type?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_nodes_motor_id_fkey"
            columns: ["motor_id"]
            isOneToOne: false
            referencedRelation: "decision_motors"
            referencedColumns: ["id"]
          },
        ]
      }
      dominio_temas: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      duvidas_frequentes: {
        Row: {
          copias_count: number
          created_at: string
          id: string
          origem: string
          pergunta: string
          position: number
          resposta: string
          status: string
          tema: string
          updated_at: string
        }
        Insert: {
          copias_count?: number
          created_at?: string
          id?: string
          origem?: string
          pergunta: string
          position?: number
          resposta?: string
          status?: string
          tema: string
          updated_at?: string
        }
        Update: {
          copias_count?: number
          created_at?: string
          id?: string
          origem?: string
          pergunta?: string
          position?: number
          resposta?: string
          status?: string
          tema?: string
          updated_at?: string
        }
        Relationships: []
      }
      exame_clinicas: {
        Row: {
          clinica_id: string
          exame_id: string
        }
        Insert: {
          clinica_id: string
          exame_id: string
        }
        Update: {
          clinica_id?: string
          exame_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exame_clinicas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "contatos_enderecos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exame_clinicas_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames"
            referencedColumns: ["id"]
          },
        ]
      }
      exame_unidades: {
        Row: {
          exame_id: string
          unidade_id: string
        }
        Insert: {
          exame_id: string
          unidade_id: string
        }
        Update: {
          exame_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exame_unidades_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exame_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      exames: {
        Row: {
          categoria: string | null
          created_at: string
          descricao: string | null
          id: string
          jejum: boolean
          material: string | null
          media_referencia: number | null
          nome: string
          observacoes: string | null
          position: number
          preco_particular_medio: number | null
          preparo: string | null
          preparo_itens: string[]
          tipo: string
          usar_na_economia: boolean
          use_count: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          jejum?: boolean
          material?: string | null
          media_referencia?: number | null
          nome: string
          observacoes?: string | null
          position?: number
          preco_particular_medio?: number | null
          preparo?: string | null
          preparo_itens?: string[]
          tipo?: string
          usar_na_economia?: boolean
          use_count?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          jejum?: boolean
          material?: string | null
          media_referencia?: number | null
          nome?: string
          observacoes?: string | null
          position?: number
          preco_particular_medio?: number | null
          preparo?: string | null
          preparo_itens?: string[]
          tipo?: string
          usar_na_economia?: boolean
          use_count?: number
        }
        Relationships: []
      }
      extensao_aceites: {
        Row: {
          aceito_em: string
          id: string
          user_id: string
          versao: string
        }
        Insert: {
          aceito_em?: string
          id?: string
          user_id?: string
          versao: string
        }
        Update: {
          aceito_em?: string
          id?: string
          user_id?: string
          versao?: string
        }
        Relationships: []
      }
      extensao_config: {
        Row: {
          fuso: string
          horario: Json
          id: number
          meta_minutos: number
          nova_conversa_horas: number
          updated_at: string
        }
        Insert: {
          fuso?: string
          horario?: Json
          id?: number
          meta_minutos?: number
          nova_conversa_horas?: number
          updated_at?: string
        }
        Update: {
          fuso?: string
          horario?: Json
          id?: number
          meta_minutos?: number
          nova_conversa_horas?: number
          updated_at?: string
        }
        Relationships: []
      }
      extensao_eventos: {
        Row: {
          created_at: string
          id: number
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          tipo: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: never
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      extensao_ignorados: {
        Row: {
          created_at: string
          numero_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          numero_hash: string
          user_id?: string
        }
        Update: {
          created_at?: string
          numero_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      extensao_inicio: {
        Row: {
          definido_por: string | null
          inicio: string
          updated_at: string
          user_id: string
        }
        Insert: {
          definido_por?: string | null
          inicio: string
          updated_at?: string
          user_id: string
        }
        Update: {
          definido_por?: string | null
          inicio?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      extensao_tempos: {
        Row: {
          chat_key: string
          created_at: string
          dentro_da_meta: boolean | null
          dia: string
          id: string
          inicio_em: string
          minutos_uteis: number | null
          resposta_em: string | null
          user_id: string
        }
        Insert: {
          chat_key: string
          created_at?: string
          dentro_da_meta?: boolean | null
          dia: string
          id?: string
          inicio_em: string
          minutos_uteis?: number | null
          resposta_em?: string | null
          user_id?: string
        }
        Update: {
          chat_key?: string
          created_at?: string
          dentro_da_meta?: boolean | null
          dia?: string
          id?: string
          inicio_em?: string
          minutos_uteis?: number | null
          resposta_em?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fechamento_casos: {
        Row: {
          created_at: string
          dependentes: number
          etapa: string
          id: string
          plano: string | null
          primeiro_nome: string
          retomar_em: string | null
          updated_at: string
          user_id: string
          usos: Json
        }
        Insert: {
          created_at?: string
          dependentes?: number
          etapa?: string
          id?: string
          plano?: string | null
          primeiro_nome?: string
          retomar_em?: string | null
          updated_at?: string
          user_id?: string
          usos?: Json
        }
        Update: {
          created_at?: string
          dependentes?: number
          etapa?: string
          id?: string
          plano?: string | null
          primeiro_nome?: string
          retomar_em?: string | null
          updated_at?: string
          user_id?: string
          usos?: Json
        }
        Relationships: []
      }
      fechamento_itens: {
        Row: {
          created_at: string
          etapa: string
          evite: string | null
          exemplos_de_fala: string[]
          id: string
          mensagem: string | null
          ordem: number
          passos: string[]
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          etapa: string
          evite?: string | null
          exemplos_de_fala?: string[]
          id?: string
          mensagem?: string | null
          ordem?: number
          passos?: string[]
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          etapa?: string
          evite?: string | null
          exemplos_de_fala?: string[]
          id?: string
          mensagem?: string | null
          ordem?: number
          passos?: string[]
          status?: string
          tipo?: string
          titulo?: string
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
      flow_paths: {
        Row: {
          branches_from_stage_id: string
          category_id: string | null
          created_at: string
          id: string
          merges_into_stage_id: string | null
          name: string
          position: number
        }
        Insert: {
          branches_from_stage_id: string
          category_id?: string | null
          created_at?: string
          id?: string
          merges_into_stage_id?: string | null
          name: string
          position?: number
        }
        Update: {
          branches_from_stage_id?: string
          category_id?: string | null
          created_at?: string
          id?: string
          merges_into_stage_id?: string | null
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "flow_paths_branches_from_stage_id_fkey"
            columns: ["branches_from_stage_id"]
            isOneToOne: false
            referencedRelation: "message_flow_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_paths_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_paths_merges_into_stage_id_fkey"
            columns: ["merges_into_stage_id"]
            isOneToOne: false
            referencedRelation: "message_flow_stages"
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
          video_duracao: string | null
          video_url: string | null
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
          video_duracao?: string | null
          video_url?: string | null
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
          video_duracao?: string | null
          video_url?: string | null
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
          nivel_lideranca: string | null
          nome: string
          perfis_maturidade: string[] | null
          recomendacoes: string | null
          recomendacoes_atualizadas_em: string | null
        }
        Insert: {
          created_at?: string | null
          dias_uteis?: number
          id?: string
          mes_referencia: string
          meta_diaria?: number | null
          meta_mensal?: number
          meta_semanal?: number | null
          nivel_lideranca?: string | null
          nome: string
          perfis_maturidade?: string[] | null
          recomendacoes?: string | null
          recomendacoes_atualizadas_em?: string | null
        }
        Update: {
          created_at?: string | null
          dias_uteis?: number
          id?: string
          mes_referencia?: string
          meta_diaria?: number | null
          meta_mensal?: number
          meta_semanal?: number | null
          nivel_lideranca?: string | null
          nome?: string
          perfis_maturidade?: string[] | null
          recomendacoes?: string | null
          recomendacoes_atualizadas_em?: string | null
        }
        Relationships: []
      }
      funil_etapas: {
        Row: {
          definicao: string
          etapa: string
          nome: string
          ordem: number
          sinais: string[]
          updated_at: string
        }
        Insert: {
          definicao?: string
          etapa: string
          nome: string
          ordem?: number
          sinais?: string[]
          updated_at?: string
        }
        Update: {
          definicao?: string
          etapa?: string
          nome?: string
          ordem?: number
          sinais?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      homepage_messages: {
        Row: {
          ativo: boolean
          cor_fundo: string
          cor_fundo_2: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          fonte: string
          id: string
          position: number
          subtitulo: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          cor_fundo?: string
          cor_fundo_2?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          fonte?: string
          id?: string
          position?: number
          subtitulo?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          cor_fundo?: string
          cor_fundo_2?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          fonte?: string
          id?: string
          position?: number
          subtitulo?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      ia_limites: {
        Row: {
          ferramenta: string
          limite_diario: number | null
          updated_at: string
        }
        Insert: {
          ferramenta: string
          limite_diario?: number | null
          updated_at?: string
        }
        Update: {
          ferramenta?: string
          limite_diario?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ia_limites_extra: {
        Row: {
          created_at: string
          created_by: string | null
          extra: number
          ferramenta: string
          id: string
          user_id: string
          valido_ate: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          extra: number
          ferramenta: string
          id?: string
          user_id: string
          valido_ate: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          extra?: number
          ferramenta?: string
          id?: string
          user_id?: string
          valido_ate?: string
        }
        Relationships: []
      }
      ia_uso: {
        Row: {
          created_at: string
          ferramenta: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          ferramenta: string
          id?: never
          user_id?: string
        }
        Update: {
          created_at?: string
          ferramenta?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      image_library_items: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          id: string
          image_path: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_path: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_library_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
      marciana_feedback: {
        Row: {
          comentario: string | null
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          motivos: string[]
          resolvido_em: string | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comentario?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          motivos?: string[]
          resolvido_em?: string | null
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comentario?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          motivos?: string[]
          resolvido_em?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marciana_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marciana_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      marciana_sugestoes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          ordem: number
          texto: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          texto: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          texto?: string
          updated_at?: string
        }
        Relationships: []
      }
      mensagens_sugestoes: {
        Row: {
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          id: string
          mensagem_id: string
          por_que_mudar: string
          status: string
          texto_sugerido: string
          versao_base: number
          versao_criada: number | null
        }
        Insert: {
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          id?: string
          mensagem_id: string
          por_que_mudar?: string
          status?: string
          texto_sugerido: string
          versao_base: number
          versao_criada?: number | null
        }
        Update: {
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          id?: string
          mensagem_id?: string
          por_que_mudar?: string
          status?: string
          texto_sugerido?: string
          versao_base?: number
          versao_criada?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_sugestoes_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "cadencia_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_usos: {
        Row: {
          caso_id: string | null
          created_at: string
          id: string
          item_id: string
          levou_fechamento: boolean
          origem: string
          user_id: string
          versao: number | null
        }
        Insert: {
          caso_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          levou_fechamento?: boolean
          origem?: string
          user_id?: string
          versao?: number | null
        }
        Update: {
          caso_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          levou_fechamento?: boolean
          origem?: string
          user_id?: string
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_usos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "fechamento_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      message_drafts: {
        Row: {
          category_id: string | null
          conteudo: string
          created_at: string
          criado_por: string
          id: string
          message_id: string | null
          nota_interna: string | null
          nota_revisao: string | null
          revisado_em: string | null
          revisado_por: string | null
          status: string
          subcategory_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          conteudo: string
          created_at?: string
          criado_por: string
          id?: string
          message_id?: string | null
          nota_interna?: string | null
          nota_revisao?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          status?: string
          subcategory_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          conteudo?: string
          created_at?: string
          criado_por?: string
          id?: string
          message_id?: string | null
          nota_interna?: string | null
          nota_revisao?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          status?: string
          subcategory_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_drafts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_drafts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_drafts_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      message_flow_links: {
        Row: {
          created_at: string
          flow_stage_id: string
          id: string
          message_id: string
          position: number
        }
        Insert: {
          created_at?: string
          flow_stage_id: string
          id?: string
          message_id: string
          position?: number
        }
        Update: {
          created_at?: string
          flow_stage_id?: string
          id?: string
          message_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_flow_links_flow_stage_id_fkey"
            columns: ["flow_stage_id"]
            isOneToOne: false
            referencedRelation: "message_flow_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_flow_links_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_flow_stages: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          name: string
          path_id: string | null
          position: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          name: string
          path_id?: string | null
          position?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          name?: string
          path_id?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_flow_stages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_flow_stages_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "flow_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          category_id: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          image_path: string | null
          internal_note: string | null
          position: number
          shortcut: string | null
          subcategory_id: string | null
          tags: string[]
          title: string
          updated_at: string
          use_count: number
        }
        Insert: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string | null
          internal_note?: string | null
          position?: number
          shortcut?: string | null
          subcategory_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string | null
          internal_note?: string | null
          position?: number
          shortcut?: string | null
          subcategory_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          use_count?: number
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
      motivos_perda: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
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
      objecoes: {
        Row: {
          angulos: Json
          autor_id: string | null
          created_at: string
          evite_dizer: string | null
          exemplos_de_fala: string[]
          id: string
          leituras: Json
          nome: string
          pergunta_avancar: string | null
          prioridade: number
          status: string
          updated_at: string
        }
        Insert: {
          angulos?: Json
          autor_id?: string | null
          created_at?: string
          evite_dizer?: string | null
          exemplos_de_fala?: string[]
          id?: string
          leituras?: Json
          nome: string
          pergunta_avancar?: string | null
          prioridade?: number
          status?: string
          updated_at?: string
        }
        Update: {
          angulos?: Json
          autor_id?: string | null
          created_at?: string
          evite_dizer?: string | null
          exemplos_de_fala?: string[]
          id?: string
          leituras?: Json
          nome?: string
          pergunta_avancar?: string | null
          prioridade?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      objecoes_pendentes: {
        Row: {
          created_at: string
          fala_exemplo: string
          falas_parecidas: string[]
          id: string
          objecao_id: string | null
          ocorrencias: number
          ocorrencias_em: string[]
          respostas_atendentes: Json
          status: string
          sugerida_por: string | null
          sugestao_ia: Json | null
          ultima_ocorrencia: string
        }
        Insert: {
          created_at?: string
          fala_exemplo: string
          falas_parecidas?: string[]
          id?: string
          objecao_id?: string | null
          ocorrencias?: number
          ocorrencias_em?: string[]
          respostas_atendentes?: Json
          status?: string
          sugerida_por?: string | null
          sugestao_ia?: Json | null
          ultima_ocorrencia?: string
        }
        Update: {
          created_at?: string
          fala_exemplo?: string
          falas_parecidas?: string[]
          id?: string
          objecao_id?: string | null
          ocorrencias?: number
          ocorrencias_em?: string[]
          respostas_atendentes?: Json
          status?: string
          sugerida_por?: string | null
          sugestao_ia?: Json | null
          ultima_ocorrencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "objecoes_pendentes_objecao_id_fkey"
            columns: ["objecao_id"]
            isOneToOne: false
            referencedRelation: "objecoes"
            referencedColumns: ["id"]
          },
        ]
      }
      padrao_escrita: {
        Row: {
          ativo: boolean
          created_at: string
          exemplo_certo: string
          exemplo_errado: string
          id: string
          item: string
          ordem: number
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          exemplo_certo?: string
          exemplo_errado?: string
          id?: string
          item: string
          ordem?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          exemplo_certo?: string
          exemplo_errado?: string
          id?: string
          item?: string
          ordem?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdf_library_items: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          pdf_name: string | null
          pdf_path: string
          position: number
          title: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          pdf_name?: string | null
          pdf_path: string
          position?: number
          title: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          pdf_name?: string | null
          pdf_path?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_library_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_item_clinicas: {
        Row: {
          clinica_id: string
          pricing_item_id: string
        }
        Insert: {
          clinica_id: string
          pricing_item_id: string
        }
        Update: {
          clinica_id?: string
          pricing_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_item_clinicas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "contatos_enderecos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_item_clinicas_pricing_item_id_fkey"
            columns: ["pricing_item_id"]
            isOneToOne: false
            referencedRelation: "pricing_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_item_unidades: {
        Row: {
          destaque: boolean
          pricing_item_id: string
          unidade_id: string
        }
        Insert: {
          destaque?: boolean
          pricing_item_id: string
          unidade_id: string
        }
        Update: {
          destaque?: boolean
          pricing_item_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_item_unidades_pricing_item_id_fkey"
            columns: ["pricing_item_id"]
            isOneToOne: false
            referencedRelation: "pricing_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_item_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_items: {
        Row: {
          area: string | null
          cartao_price: number | null
          category: string
          clinicas_pendente: boolean
          como_agendar: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          para_quem: string | null
          particular_price: number | null
          position: number
          preco_particular_medio: number | null
          specialty: string
          updated_at: string
          usar_na_economia: boolean
          use_count: number
        }
        Insert: {
          area?: string | null
          cartao_price?: number | null
          category?: string
          clinicas_pendente?: boolean
          como_agendar?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          para_quem?: string | null
          particular_price?: number | null
          position?: number
          preco_particular_medio?: number | null
          specialty: string
          updated_at?: string
          usar_na_economia?: boolean
          use_count?: number
        }
        Update: {
          area?: string | null
          cartao_price?: number | null
          category?: string
          clinicas_pendente?: boolean
          como_agendar?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          para_quem?: string | null
          particular_price?: number | null
          position?: number
          preco_particular_medio?: number | null
          specialty?: string
          updated_at?: string
          usar_na_economia?: boolean
          use_count?: number
        }
        Relationships: []
      }
      problem_scenarios: {
        Row: {
          category_id: string | null
          cliente_cpf: string | null
          cliente_genero: string
          cliente_nome: string | null
          cliente_regiao: string | null
          created_at: string
          difficulty: string
          enredo: string
          faixa_etaria: string | null
          id: string
          name: string
          personalidade: string
          solucao_esperada: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cliente_cpf?: string | null
          cliente_genero?: string
          cliente_nome?: string | null
          cliente_regiao?: string | null
          created_at?: string
          difficulty?: string
          enredo: string
          faixa_etaria?: string | null
          id?: string
          name: string
          personalidade?: string
          solucao_esperada: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cliente_cpf?: string | null
          cliente_genero?: string
          cliente_nome?: string | null
          cliente_regiao?: string | null
          created_at?: string
          difficulty?: string
          enredo?: string
          faixa_etaria?: string | null
          id?: string
          name?: string
          personalidade?: string
          solucao_esperada?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_scenarios_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      procedimento_clinicas: {
        Row: {
          clinica_id: string
          procedimento_id: string
        }
        Insert: {
          clinica_id: string
          procedimento_id: string
        }
        Update: {
          clinica_id?: string
          procedimento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedimento_clinicas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "contatos_enderecos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedimento_clinicas_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos_odontologicos"
            referencedColumns: ["id"]
          },
        ]
      }
      procedimento_unidades: {
        Row: {
          procedimento_id: string
          unidade_id: string
        }
        Insert: {
          procedimento_id: string
          unidade_id: string
        }
        Update: {
          procedimento_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedimento_unidades_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos_odontologicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedimento_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      procedimentos_odontologicos: {
        Row: {
          categoria: string | null
          created_at: string
          cuidados_pos: string | null
          descricao: string | null
          id: string
          nome: string
          observacoes: string | null
          position: number
          preco_particular_medio: number | null
          usar_na_economia: boolean
          use_count: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          cuidados_pos?: string | null
          descricao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          position?: number
          preco_particular_medio?: number | null
          usar_na_economia?: boolean
          use_count?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          cuidados_pos?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          position?: number
          preco_particular_medio?: number | null
          usar_na_economia?: boolean
          use_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ajuda_novidades_vistas_em: string | null
          cargo: string | null
          created_at: string
          data_nascimento: string | null
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          nivel_lideranca: string | null
          perfis_maturidade: string[] | null
          updated_at: string
          xp: number
          xp_problemas: number
        }
        Insert: {
          ajuda_novidades_vistas_em?: string | null
          cargo?: string | null
          created_at?: string
          data_nascimento?: string | null
          display_name?: string | null
          email: string
          id: string
          is_active?: boolean
          last_seen_at?: string | null
          nivel_lideranca?: string | null
          perfis_maturidade?: string[] | null
          updated_at?: string
          xp?: number
          xp_problemas?: number
        }
        Update: {
          ajuda_novidades_vistas_em?: string | null
          cargo?: string | null
          created_at?: string
          data_nascimento?: string | null
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          nivel_lideranca?: string | null
          perfis_maturidade?: string[] | null
          updated_at?: string
          xp?: number
          xp_problemas?: number
        }
        Relationships: []
      }
      promo_plans: {
        Row: {
          ativo: boolean
          cor_fundo: string
          cor_fundo_2: string | null
          created_at: string
          id: string
          nome: string
          position: number
          preco_demais_meses: number
          preco_primeiro_mes: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor_fundo?: string
          cor_fundo_2?: string | null
          created_at?: string
          id?: string
          nome: string
          position?: number
          preco_demais_meses: number
          preco_primeiro_mes: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor_fundo?: string
          cor_fundo_2?: string | null
          created_at?: string
          id?: string
          nome?: string
          position?: number
          preco_demais_meses?: number
          preco_primeiro_mes?: number
          updated_at?: string
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
      quiz_attempts: {
        Row: {
          completed_at: string
          id: string
          quiz_id: string
          respostas: Json
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          quiz_id: string
          respostas?: Json
          score: number
          total_questions: number
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          quiz_id?: string
          respostas?: Json
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          id: string
          is_correct: boolean
          position: number
          question_id: string
          texto: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          position?: number
          question_id: string
          texto: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          position?: number
          question_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          id: string
          pergunta: string
          position: number
          quiz_id: string
          resposta_esperada: string | null
          tipo: string
        }
        Insert: {
          id?: string
          pergunta: string
          position?: number
          quiz_id: string
          resposta_esperada?: string | null
          tipo?: string
        }
        Update: {
          id?: string
          pergunta?: string
          position?: number
          quiz_id?: string
          resposta_esperada?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          id: string
          position: number
          titulo: string
          training_module_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          titulo: string
          training_module_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          titulo?: string
          training_module_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_training_module_id_fkey"
            columns: ["training_module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      raiox_resultados: {
        Row: {
          created_at: string
          escrita: Json
          etapa: string | null
          faltou: Json
          habito: Json
          id: string
          onde_perdeu: Json
          reescrita: Json
          retomada_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          escrita?: Json
          etapa?: string | null
          faltou?: Json
          habito?: Json
          id?: string
          onde_perdeu?: Json
          reescrita?: Json
          retomada_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          escrita?: Json
          etapa?: string | null
          faltou?: Json
          habito?: Json
          id?: string
          onde_perdeu?: Json
          reescrita?: Json
          retomada_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raiox_resultados_retomada_id_fkey"
            columns: ["retomada_id"]
            isOneToOne: false
            referencedRelation: "retomadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raiox_resultados_retomada_id_fkey"
            columns: ["retomada_id"]
            isOneToOne: false
            referencedRelation: "retomadas_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_config: {
        Row: {
          id: number
          minimo_retomadas: number
          periodo: string
          podio_constantes: boolean
          podio_ensinam: boolean
          podio_evoluiram: boolean
          podio_fechamentos: boolean
          podio_respondidas: boolean
          podio_treino: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          minimo_retomadas?: number
          periodo?: string
          podio_constantes?: boolean
          podio_ensinam?: boolean
          podio_evoluiram?: boolean
          podio_fechamentos?: boolean
          podio_respondidas?: boolean
          podio_treino?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          minimo_retomadas?: number
          periodo?: string
          podio_constantes?: boolean
          podio_ensinam?: boolean
          podio_evoluiram?: boolean
          podio_fechamentos?: boolean
          podio_respondidas?: boolean
          podio_treino?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ranking_hall: {
        Row: {
          created_at: string
          id: string
          mes: string
          podio: string
          posicao: number
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          mes: string
          podio: string
          posicao: number
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          id?: string
          mes?: string
          podio?: string
          posicao?: number
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      ranking_ocultos: {
        Row: {
          created_at: string
          mes: string
          user_id: string
        }
        Insert: {
          created_at?: string
          mes: string
          user_id: string
        }
        Update: {
          created_at?: string
          mes?: string
          user_id?: string
        }
        Relationships: []
      }
      recursos_config: {
        Row: {
          atualizado_por: string | null
          chave: string
          updated_at: string
          valor: boolean
        }
        Insert: {
          atualizado_por?: string | null
          chave: string
          updated_at?: string
          valor?: boolean
        }
        Update: {
          atualizado_por?: string | null
          chave?: string
          updated_at?: string
          valor?: boolean
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
      retomada_eventos: {
        Row: {
          acao: string
          created_at: string
          detalhe: string | null
          etapa: string
          id: string
          mensagem_id: string | null
          mensagem_versao: number | null
          ponto_parada: string | null
          prevista_em: string | null
          retomada_id: string
          user_id: string
          usou_recomendada: boolean | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhe?: string | null
          etapa: string
          id?: string
          mensagem_id?: string | null
          mensagem_versao?: number | null
          ponto_parada?: string | null
          prevista_em?: string | null
          retomada_id: string
          user_id?: string
          usou_recomendada?: boolean | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhe?: string | null
          etapa?: string
          id?: string
          mensagem_id?: string | null
          mensagem_versao?: number | null
          ponto_parada?: string | null
          prevista_em?: string | null
          retomada_id?: string
          user_id?: string
          usou_recomendada?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "retomada_eventos_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "cadencia_mensagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retomada_eventos_retomada_id_fkey"
            columns: ["retomada_id"]
            isOneToOne: false
            referencedRelation: "retomadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retomada_eventos_retomada_id_fkey"
            columns: ["retomada_id"]
            isOneToOne: false
            referencedRelation: "retomadas_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      retomadas: {
        Row: {
          codigo: string
          created_at: string
          d10_enviado_em: string | null
          dependentes: number | null
          etapa_atual: string
          etapa_funil: string | null
          fechamento_caso_id: string | null
          id: string
          motivo_perda: string | null
          observacao: string
          origem: string
          plano: string | null
          ponto_parada: string
          ponto_parada_inicial: string
          primeiro_nome: string
          proxima_em: string | null
          status: string
          subetapa_fechamento: string | null
          telefone: string | null
          telefone_hash: string | null
          updated_at: string
          user_id: string
          vezes_voltou: number
        }
        Insert: {
          codigo?: string
          created_at?: string
          d10_enviado_em?: string | null
          dependentes?: number | null
          etapa_atual?: string
          etapa_funil?: string | null
          fechamento_caso_id?: string | null
          id?: string
          motivo_perda?: string | null
          observacao?: string
          origem?: string
          plano?: string | null
          ponto_parada: string
          ponto_parada_inicial: string
          primeiro_nome?: string
          proxima_em?: string | null
          status?: string
          subetapa_fechamento?: string | null
          telefone?: string | null
          telefone_hash?: string | null
          updated_at?: string
          user_id?: string
          vezes_voltou?: number
        }
        Update: {
          codigo?: string
          created_at?: string
          d10_enviado_em?: string | null
          dependentes?: number | null
          etapa_atual?: string
          etapa_funil?: string | null
          fechamento_caso_id?: string | null
          id?: string
          motivo_perda?: string | null
          observacao?: string
          origem?: string
          plano?: string | null
          ponto_parada?: string
          ponto_parada_inicial?: string
          primeiro_nome?: string
          proxima_em?: string | null
          status?: string
          subetapa_fechamento?: string | null
          telefone?: string | null
          telefone_hash?: string | null
          updated_at?: string
          user_id?: string
          vezes_voltou?: number
        }
        Relationships: [
          {
            foreignKeyName: "retomadas_fechamento_caso_id_fkey"
            columns: ["fechamento_caso_id"]
            isOneToOne: false
            referencedRelation: "fechamento_casos"
            referencedColumns: ["id"]
          },
        ]
      }
      roteiros_audio: {
        Row: {
          audio_url: string | null
          categoria: string
          created_at: string
          dicas: string[]
          duracao: string | null
          id: string
          position: number
          situacao: string
          status: string
          texto: string
          titulo: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          categoria: string
          created_at?: string
          dicas?: string[]
          duracao?: string | null
          id?: string
          position?: number
          situacao?: string
          status?: string
          texto?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          categoria?: string
          created_at?: string
          dicas?: string[]
          duracao?: string | null
          id?: string
          position?: number
          situacao?: string
          status?: string
          texto?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      roteiros_ligacao: {
        Row: {
          created_at: string
          dicas: string[]
          etapa: string
          id: string
          position: number
          situacao: string
          status: string
          texto: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dicas?: string[]
          etapa: string
          id?: string
          position?: number
          situacao?: string
          status?: string
          texto?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dicas?: string[]
          etapa?: string
          id?: string
          position?: number
          situacao?: string
          status?: string
          texto?: string
          titulo?: string
          updated_at?: string
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
          mensagem_fraca: string | null
          nota: number
          pontos_fortes: string[]
          pontos_melhoria: string[]
          profile_id: string | null
          profile_name: string
          reescrita: string | null
          resumo: string | null
          scenario_id: string | null
          tipo: string
          trechos: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          erros?: string[]
          id?: string
          mensagem_fraca?: string | null
          nota: number
          pontos_fortes?: string[]
          pontos_melhoria?: string[]
          profile_id?: string | null
          profile_name: string
          reescrita?: string | null
          resumo?: string | null
          scenario_id?: string | null
          tipo?: string
          trechos?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          erros?: string[]
          id?: string
          mensagem_fraca?: string | null
          nota?: number
          pontos_fortes?: string[]
          pontos_melhoria?: string[]
          profile_id?: string | null
          profile_name?: string
          reescrita?: string | null
          resumo?: string | null
          scenario_id?: string | null
          tipo?: string
          trechos?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulator_results_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "problem_scenarios"
            referencedColumns: ["id"]
          },
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
          content_item_id: string | null
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
          content_item_id?: string | null
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
          content_item_id?: string | null
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      telemedicina_itens: {
        Row: {
          ativo: boolean
          cartao: number | null
          created_at: string
          descricao: string | null
          id: string
          indique_quando: string | null
          link_agendamento: string | null
          nome: string
          para_quem: string | null
          particular: number | null
          passos: string[]
          position: number
          tempo_espera_min: number | null
          tipo: string
          updated_at: string
          use_count: number
        }
        Insert: {
          ativo?: boolean
          cartao?: number | null
          created_at?: string
          descricao?: string | null
          id?: string
          indique_quando?: string | null
          link_agendamento?: string | null
          nome: string
          para_quem?: string | null
          particular?: number | null
          passos?: string[]
          position?: number
          tempo_espera_min?: number | null
          tipo: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          ativo?: boolean
          cartao?: number | null
          created_at?: string
          descricao?: string | null
          id?: string
          indique_quando?: string | null
          link_agendamento?: string | null
          nome?: string
          para_quem?: string | null
          particular?: number | null
          passos?: string[]
          position?: number
          tempo_espera_min?: number | null
          tipo?: string
          updated_at?: string
          use_count?: number
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
      ticket_historico: {
        Row: {
          campo: string
          created_at: string
          id: string
          origem: string
          ticket_id: string
          user_id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          created_at?: string
          id?: string
          origem: string
          ticket_id: string
          user_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          created_at?: string
          id?: string
          origem?: string
          ticket_id?: string
          user_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_historico_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "retomadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_historico_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "retomadas_admin"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_vistos: {
        Row: {
          tour_id: string
          user_id: string
          versao: number
          visto_em: string
        }
        Insert: {
          tour_id: string
          user_id?: string
          versao?: number
          visto_em?: string
        }
        Update: {
          tour_id?: string
          user_id?: string
          versao?: number
          visto_em?: string
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
      training_module_images: {
        Row: {
          image_library_item_id: string
          position: number
          training_module_id: string
        }
        Insert: {
          image_library_item_id: string
          position?: number
          training_module_id: string
        }
        Update: {
          image_library_item_id?: string
          position?: number
          training_module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_module_images_image_library_item_id_fkey"
            columns: ["image_library_item_id"]
            isOneToOne: false
            referencedRelation: "image_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_module_images_training_module_id_fkey"
            columns: ["training_module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          pdf_name: string | null
          pdf_path: string | null
          position: number
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          pdf_name?: string | null
          pdf_path?: string | null
          position?: number
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          pdf_name?: string | null
          pdf_path?: string | null
          position?: number
          titulo?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          cidade: string | null
          created_at: string
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          position: number
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          position?: number
        }
        Update: {
          cidade?: string | null
          created_at?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          position?: number
        }
        Relationships: []
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
      retomadas_admin: {
        Row: {
          atendente: string | null
          codigo: string | null
          created_at: string | null
          d10_enviado_em: string | null
          dependentes: number | null
          etapa_atual: string | null
          etapa_funil: string | null
          fechamento_caso_id: string | null
          id: string | null
          motivo_perda: string | null
          observacao: string | null
          origem: string | null
          plano: string | null
          ponto_parada: string | null
          ponto_parada_inicial: string | null
          primeiro_nome: string | null
          proxima_em: string | null
          status: string | null
          subetapa_fechamento: string | null
          updated_at: string | null
          user_id: string | null
          vezes_voltou: number | null
        }
        Relationships: [
          {
            foreignKeyName: "retomadas_fechamento_caso_id_fkey"
            columns: ["fechamento_caso_id"]
            isOneToOne: false
            referencedRelation: "fechamento_casos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _mensagens_calc: {
        Args: { _ate?: string; _desde: string }
        Returns: {
          enviadas: number
          etapa: string
          fecharam: number
          media_fechamento: number
          media_resposta: number
          mensagem_id: string
          origem: string
          ponto: string
          responderam: number
          selo: string
          titulo: string
          versao: number
        }[]
      }
      amor_saude_excluir_lote: {
        Args: { p_ids: string[]; p_tipo: string }
        Returns: number
      }
      aquecimento_adesao_semana: {
        Args: never
        Returns: {
          dias: number
          user_id: string
        }[]
      }
      aquecimento_mapa_equipe: {
        Args: never
        Returns: {
          acertos: number
          nivel: string
          respostas: number
          tema_id: string
          user_id: string
        }[]
      }
      aquecimento_meu_mapa: {
        Args: never
        Returns: {
          acertos: number
          nivel: string
          respostas: number
          tema_id: string
        }[]
      }
      changelog_resumo_confirmacoes: {
        Args: never
        Returns: {
          acertos: number
          com_checagem: number
          confirmadas: number
          entry_id: string
          faltam_ids: string[]
          total: number
        }[]
      }
      chave_telefone: { Args: { _tel: string }; Returns: string }
      cliente_disse_contagens: {
        Args: { _dias?: number }
        Returns: {
          angulo: string
          objecao_id: string
          total: number
        }[]
      }
      crm_gravar_fechamentos: {
        Args: { _fim: string; _ini: string; _linhas: Json }
        Returns: number
      }
      extensao_admin_resumo: {
        Args: { _fim: string; _ini: string }
        Returns: {
          atualizados: number
          conversas_novas: number
          dentro_da_meta: number
          ignorados: number
          instalou: boolean
          nome: string
          pausas: number
          primeiro_evento: string
          resposta_media: number
          tickets_criados: number
          user_id: string
        }[]
      }
      extensao_minutos_uteis: {
        Args: { _fim: string; _ini: string }
        Returns: number
      }
      extensao_resumo_semanal: {
        Args: { _fim: string; _ini: string; _user?: string }
        Returns: {
          atualizados: number
          ignorados: number
          pausas: number
          semana: string
          tickets_criados: number
          user_id: string
        }[]
      }
      extensao_tempo_dia: {
        Args: { _fim: string; _ini: string; _user?: string }
        Returns: {
          conversas_novas: number
          dentro_da_meta: number
          dia: string
          media_minutos: number
          sem_resposta: number
          user_id: string
        }[]
      }
      extensao_tempo_resumo: { Args: { _dia: string }; Returns: Json }
      fechar_tickets_por_crm: {
        Args: {
          _fim: string
          _hashes: string[]
          _ini: string
          _user_id: string
        }
        Returns: Json
      }
      increment_amor_saude_use: {
        Args: { item_id: string; item_tipo: string }
        Returns: undefined
      }
      increment_contato_use: {
        Args: { contato_id: string }
        Returns: undefined
      }
      increment_duvida_copias: { Args: { p_id: string }; Returns: undefined }
      increment_message_use_count: {
        Args: { msg_id: string }
        Returns: undefined
      }
      limpar_fechamento_casos: { Args: never; Returns: number }
      limpar_raiox: { Args: never; Returns: number }
      limpar_retomadas: { Args: never; Returns: number }
      marcar_ajuda_novidades_vistas: { Args: never; Returns: undefined }
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
      mensagens_desempenho: {
        Args: { _ate?: string; _de?: string; periodo_dias?: number }
        Returns: {
          enviadas: number
          etapa: string
          fecharam: number
          media_fechamento: number
          media_resposta: number
          mensagem_id: string
          origem: string
          ponto: string
          responderam: number
          selo: string
          titulo: string
          versao: number
        }[]
      }
      mensagens_selo: {
        Args: never
        Returns: {
          envios: number
          mensagem_id: string
          origem: string
          selo: string
          versao: number
        }[]
      }
      mensagens_usos_marcar_fechamento: {
        Args: { _caso_id: string }
        Returns: number
      }
      mensagens_versao_anterior: {
        Args: never
        Returns: {
          canal: string
          mensagem_id: string
          texto: string
          versao: number
        }[]
      }
      numero_com_outro_atendente: { Args: { _chave: string }; Returns: boolean }
      ranking_admin: {
        Args: { p_mes: string; p_podio: string }
        Returns: {
          entra_no_podio: boolean
          nome: string
          posicao: number
          total: number
          user_id: string
          valor: number
        }[]
      }
      ranking_calcular: {
        Args: { p_mes: string }
        Returns: {
          nome: string
          podio: string
          posicao: number
          qualifica: boolean
          total: number
          user_id: string
          valor: number
        }[]
      }
      ranking_fechar_mes: { Args: { p_mes: string }; Returns: undefined }
      ranking_hall_campeoes: {
        Args: { p_meses?: number }
        Returns: {
          mes: string
          nome: string
          podio: string
          valor: number
        }[]
      }
      ranking_podios: { Args: { p_mes: string }; Returns: Json }
      telefone_hash: { Args: { _tel: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "funcionario"
      content_section:
        | "conhecimento"
        | "problemas"
        | "tutoriais"
        | "treinamentos"
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
      app_role: ["admin", "funcionario"],
      content_section: [
        "conhecimento",
        "problemas",
        "tutoriais",
        "treinamentos",
      ],
    },
  },
} as const
