
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "cliente_duracoes": {
                  Row: {
                    "cliente_id": string,"duracao": number,"ordem": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id": string,"duracao": number,"ordem": number
                  }
                  Update: {
                    "cliente_id"?: string,"duracao"?: number,"ordem"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cliente_duracoes_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cliente_duracoes_ordem_fkey"
      columns: ["ordem"]
isOneToOne: false
      referencedRelation: "etapas"
      referencedColumns: ["ordem"]
    }
                  ]
                },"cliente_etapas": {
                  Row: {
                    "cliente_id": string,"duracao": number | null,"fixa": string | null,"id": string,"nome": string,"padrao": number | null,"posicao": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id": string,"duracao"?: number | null,"fixa"?: string | null,"id"?: string,"nome": string,"padrao"?: number | null,"posicao": number
                  }
                  Update: {
                    "cliente_id"?: string,"duracao"?: number | null,"fixa"?: string | null,"id"?: string,"nome"?: string,"padrao"?: number | null,"posicao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cliente_etapas_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cliente_etapas_padrao_fkey"
      columns: ["padrao"]
isOneToOne: false
      referencedRelation: "etapas"
      referencedColumns: ["ordem"]
    }
                  ]
                },"clientes": {
                  Row: {
                    "criado_em": string,"id": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"id"?: string,"nome": string
                  }
                  Update: {
                    "criado_em"?: string,"id"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"etapas": {
                  Row: {
                    "duracao": number,"nome": string,"ordem": number
                  }
                  ComputedFields: never
                  Insert: {
                    "duracao": number,"nome": string,"ordem": number
                  }
                  Update: {
                    "duracao"?: number,"nome"?: string,"ordem"?: number
                  }
                  Relationships: [
                    
                  ]
                },"feriados": {
                  Row: {
                    "data": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "data": string,"nome": string
                  }
                  Update: {
                    "data"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"gestores": {
                  Row: {
                    "cliente_id": string,"criado_em": string,"email": string | null,"id": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id": string,"criado_em"?: string,"email"?: string | null,"id"?: string,"nome": string
                  }
                  Update: {
                    "cliente_id"?: string,"criado_em"?: string,"email"?: string | null,"id"?: string,"nome"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gestores_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"historico": {
                  Row: {
                    "acao": string,"detalhe": Json | null,"em": string,"id": string,"nome_usuario": string,"vaga_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acao": string,"detalhe"?: Json | null,"em"?: string,"id"?: string,"nome_usuario": string,"vaga_id"?: string | null
                  }
                  Update: {
                    "acao"?: string,"detalhe"?: Json | null,"em"?: string,"id"?: string,"nome_usuario"?: string,"vaga_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "historico_vaga_id_fkey"
      columns: ["vaga_id"]
isOneToOne: false
      referencedRelation: "vagas"
      referencedColumns: ["id"]
    }
                  ]
                },"ondas": {
                  Row: {
                    "fim": string,"id": string,"inicio": string,"nome": string,"projeto_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fim": string,"id"?: string,"inicio": string,"nome": string,"projeto_id": string
                  }
                  Update: {
                    "fim"?: string,"id"?: string,"inicio"?: string,"nome"?: string,"projeto_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ondas_projeto_id_fkey"
      columns: ["projeto_id"]
isOneToOne: false
      referencedRelation: "projetos"
      referencedColumns: ["id"]
    }
                  ]
                },"projeto_acessos": {
                  Row: {
                    "projeto_id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "projeto_id": string,"usuario_id": string
                  }
                  Update: {
                    "projeto_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projeto_acessos_projeto_id_fkey"
      columns: ["projeto_id"]
isOneToOne: false
      referencedRelation: "projetos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projeto_acessos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"projeto_etapas": {
                  Row: {
                    "duracao": number | null,"fixa": string | null,"id": string,"nome": string,"padrao": number | null,"posicao": number,"projeto_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duracao"?: number | null,"fixa"?: string | null,"id"?: string,"nome": string,"padrao"?: number | null,"posicao": number,"projeto_id": string
                  }
                  Update: {
                    "duracao"?: number | null,"fixa"?: string | null,"id"?: string,"nome"?: string,"padrao"?: number | null,"posicao"?: number,"projeto_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projeto_etapas_padrao_fkey"
      columns: ["padrao"]
isOneToOne: false
      referencedRelation: "etapas"
      referencedColumns: ["ordem"]
    },{
      foreignKeyName: "projeto_etapas_projeto_id_fkey"
      columns: ["projeto_id"]
isOneToOne: false
      referencedRelation: "projetos"
      referencedColumns: ["id"]
    }
                  ]
                },"projetos": {
                  Row: {
                    "area": string | null,"cliente_id": string,"criado_em": string,"encerrado_em": string | null,"id": string,"nome": string,"organizacao": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: string | null,"cliente_id": string,"criado_em"?: string,"encerrado_em"?: string | null,"id"?: string,"nome": string,"organizacao": string
                  }
                  Update: {
                    "area"?: string | null,"cliente_id"?: string,"criado_em"?: string,"encerrado_em"?: string | null,"id"?: string,"nome"?: string,"organizacao"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projetos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"usuarios": {
                  Row: {
                    "ativo": boolean,"cliente_id": string | null,"criado_em": string,"email": string,"id": string,"nome": string,"perfil": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"cliente_id"?: string | null,"criado_em"?: string,"email": string,"id"?: string,"nome": string,"perfil": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "ativo"?: boolean,"cliente_id"?: string | null,"criado_em"?: string,"email"?: string,"id"?: string,"nome"?: string,"perfil"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuarios_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"vaga_conclusoes": {
                  Row: {
                    "automatica": boolean,"concluida_em": string,"etapa_id": string,"vaga_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "automatica"?: boolean,"concluida_em": string,"etapa_id": string,"vaga_id": string
                  }
                  Update: {
                    "automatica"?: boolean,"concluida_em"?: string,"etapa_id"?: string,"vaga_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vaga_conclusoes_etapa_id_fkey"
      columns: ["etapa_id"]
isOneToOne: false
      referencedRelation: "projeto_etapas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vaga_conclusoes_vaga_id_fkey"
      columns: ["vaga_id"]
isOneToOne: false
      referencedRelation: "vagas"
      referencedColumns: ["id"]
    }
                  ]
                },"vagas": {
                  Row: {
                    "area": string,"cancelada_em": string | null,"candidato": string | null,"criado_em": string,"data_inicio": string,"disciplina": string,"funcao": string,"gestor_id": string | null,"id": string,"meta": string | null,"onda_id": string | null,"projeto_id": string,"retomada_em": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area": string,"cancelada_em"?: string | null,"candidato"?: string | null,"criado_em"?: string,"data_inicio": string,"disciplina": string,"funcao": string,"gestor_id"?: string | null,"id"?: string,"meta"?: string | null,"onda_id"?: string | null,"projeto_id": string,"retomada_em"?: string | null
                  }
                  Update: {
                    "area"?: string,"cancelada_em"?: string | null,"candidato"?: string | null,"criado_em"?: string,"data_inicio"?: string,"disciplina"?: string,"funcao"?: string,"gestor_id"?: string | null,"id"?: string,"meta"?: string | null,"onda_id"?: string | null,"projeto_id"?: string,"retomada_em"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vagas_gestor_id_fkey"
      columns: ["gestor_id"]
isOneToOne: false
      referencedRelation: "gestores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vagas_onda_id_fkey"
      columns: ["onda_id"]
isOneToOne: false
      referencedRelation: "ondas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vagas_projeto_id_fkey"
      columns: ["projeto_id"]
isOneToOne: false
      referencedRelation: "projetos"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "alterar_duracao_cliente":
{ Args: { "p_cliente": string,"p_dias": number,"p_ordem": number }; Returns: undefined
                           },
"alterar_duracao_etapa":
{ Args: { "p_dias": number,"p_etapa": string }; Returns: undefined
                           },
"alterar_duracao_etapa_cliente":
{ Args: { "p_dias": number,"p_etapa": string }; Returns: undefined
                           },
"alterar_vagas_em_grupo":
{ Args: { "p_campo": string,"p_vagas": (string)[],"p_valor": string }; Returns: Json
                           },
"cancelar_vaga":
{ Args: { "p_id": string }; Returns: undefined
                           },
"candidato_desistiu":
{ Args: { "p_vaga": string }; Returns: undefined
                           },
"concluir_etapa":
{ Args: { "p_data": string,"p_ordem_esperada": number,"p_vaga": string }; Returns: undefined
                           },
"concluir_etapa_em_grupo":
{ Args: { "p_data": string,"p_ordem_esperada": number,"p_vagas": (string)[] }; Returns: number
                           },
"concluir_etapas":
{ Args: { "p_ate": number,"p_data": string,"p_ordem_esperada": number,"p_vaga": string }; Returns: undefined
                           },
"desfazer_etapa":
{ Args: { "p_ordem_esperada": number,"p_vaga": string }; Returns: undefined
                           },
"duracao_efetiva":
{ Args: { "p_etapa": string }; Returns: number
                           },
"eh_analista":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"eh_rh":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"encerrar_projeto":
{ Args: { "p_id": string }; Returns: undefined
                           },
"etapa_atual":
{ Args: { "p_vaga": string }; Returns: number
                           },
"etapa_fixa":
{ Args: { "p_fixa": string,"p_projeto": string }; Returns: {
              "duracao": number | null,
"fixa": string | null,
"id": string,
"nome": string,
"padrao": number | null,
"posicao": number,
"projeto_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "projeto_etapas"
        isOneToOne: true
        isSetofReturn: false
      } },
"etapa_na_posicao":
{ Args: { "p_posicao": number,"p_projeto": string }; Returns: string
                           },
"etapas_padrao_do_cliente":
{ Args: { "p_cliente": string }; Returns: undefined
                           },
"excluir_cliente":
{ Args: { "p_id": string }; Returns: undefined
                           },
"excluir_etapa":
{ Args: { "p_etapa": string }; Returns: undefined
                           },
"excluir_etapa_cliente":
{ Args: { "p_etapa": string }; Returns: undefined
                           },
"exigir_projeto":
{ Args: { "p": string }; Returns: undefined
                           },
"hoje_sp":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"importar_vagas":
{ Args: { "p_projeto": string,"p_vagas": Json }; Returns: number
                           },
"incluir_etapa":
{ Args: { "p_depois_de": string,"p_duracao": number,"p_nome": string,"p_projeto": string }; Returns: string
                           },
"incluir_etapa_cliente":
{ Args: { "p_cliente": string,"p_depois_de": string,"p_duracao": number,"p_nome": string }; Returns: string
                           },
"meu_nome":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"meu_perfil":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"mover_etapa":
{ Args: { "p_etapa": string,"p_para": number }; Returns: undefined
                           },
"mover_etapa_cliente":
{ Args: { "p_etapa": string,"p_para": number }; Returns: undefined
                           },
"pessoas_do_projeto":
{ Args: { "p_projeto": string }; Returns: {
              "id": string,"nome": string,"perfil": string
            }[]
                           },
"pessoas_liberaveis":
{ Args: { "p_projeto": string }; Returns: {
              "cliente_id": string,"id": string,"nome": string,"perfil": string
            }[]
                           },
"pode_alterar_projeto":
{ Args: { "p": string }; Returns: boolean
                           },
"pode_ver_projeto":
{ Args: { "p": string }; Returns: boolean
                           },
"posicao_etapa":
{ Args: { "p_etapa": string }; Returns: number
                           },
"projeto_do_grupo":
{ Args: { "p_vagas": (string)[] }; Returns: string
                           },
"reabrir_projeto":
{ Args: { "p_id": string }; Returns: undefined
                           },
"renomear_etapa":
{ Args: { "p_etapa": string,"p_nome": string }; Returns: undefined
                           },
"renomear_etapa_cliente":
{ Args: { "p_etapa": string,"p_nome": string }; Returns: undefined
                           },
"salvar_cliente":
{ Args: { "p_id": string,"p_nome": string }; Returns: string
                           },
"salvar_onda_projeto":
{ Args: { "p_fim": string,"p_id": string,"p_inicio": string,"p_nome": string,"p_projeto": string }; Returns: string
                           },
"salvar_projeto":
{ Args: { "p": Json,"p_id": string }; Returns: string
                           },
"salvar_vaga":
{ Args: { "p": Json,"p_id": string }; Returns: string
                           },
"travar_etapa_cliente":
{ Args: { "p_etapa": string }; Returns: {
              "cliente_id": string,
"duracao": number | null,
"fixa": string | null,
"id": string,
"nome": string,
"padrao": number | null,
"posicao": number
            }
                          SetofOptions: {
        from: "*"
        to: "cliente_etapas"
        isOneToOne: true
        isSetofReturn: false
      } },
"travar_etapa_rh":
{ Args: { "p_etapa": string,"p_vagas": boolean }; Returns: {
              "duracao": number | null,
"fixa": string | null,
"id": string,
"nome": string,
"padrao": number | null,
"posicao": number,
"projeto_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "projeto_etapas"
        isOneToOne: true
        isSetofReturn: false
      } },
"travar_vaga_rh":
{ Args: { "p_vaga": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
