
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "etapas": {
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
                    "criado_em": string,"email": string | null,"id": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"email"?: string | null,"id"?: string,"nome": string
                  }
                  Update: {
                    "criado_em"?: string,"email"?: string | null,"id"?: string,"nome"?: string
                  }
                  Relationships: [
                    
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
                    "fim": string,"id": string,"inicio": string,"numero": number
                  }
                  ComputedFields: never
                  Insert: {
                    "fim": string,"id"?: string,"inicio": string,"numero": number
                  }
                  Update: {
                    "fim"?: string,"id"?: string,"inicio"?: string,"numero"?: number
                  }
                  Relationships: [
                    
                  ]
                },"usuarios": {
                  Row: {
                    "ativo": boolean,"criado_em": string,"email": string,"id": string,"nome": string,"perfil": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"criado_em"?: string,"email": string,"id"?: string,"nome": string,"perfil": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "ativo"?: boolean,"criado_em"?: string,"email"?: string,"id"?: string,"nome"?: string,"perfil"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"vaga_conclusoes": {
                  Row: {
                    "concluida_em": string,"ordem": number,"vaga_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "concluida_em": string,"ordem": number,"vaga_id": string
                  }
                  Update: {
                    "concluida_em"?: string,"ordem"?: number,"vaga_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vaga_conclusoes_ordem_fkey"
      columns: ["ordem"]
isOneToOne: false
      referencedRelation: "etapas"
      referencedColumns: ["ordem"]
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
                    "area": string,"cancelada_em": string | null,"candidato": string | null,"criado_em": string,"data_inicio": string,"disciplina": string,"funcao": string,"gestor_id": string | null,"id": string,"onda_id": string,"retomada_em": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area": string,"cancelada_em"?: string | null,"candidato"?: string | null,"criado_em"?: string,"data_inicio": string,"disciplina": string,"funcao": string,"gestor_id"?: string | null,"id"?: string,"onda_id": string,"retomada_em"?: string | null
                  }
                  Update: {
                    "area"?: string,"cancelada_em"?: string | null,"candidato"?: string | null,"criado_em"?: string,"data_inicio"?: string,"disciplina"?: string,"funcao"?: string,"gestor_id"?: string | null,"id"?: string,"onda_id"?: string,"retomada_em"?: string | null
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
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "alterar_duracao":
{ Args: { "p_dias": number,"p_ordem": number }; Returns: undefined
                           },
"candidato_desistiu":
{ Args: { "p_vaga": string }; Returns: undefined
                           },
"concluir_etapa":
{ Args: { "p_data": string,"p_ordem_esperada": number,"p_vaga": string }; Returns: undefined
                           },
"desfazer_etapa":
{ Args: { "p_ordem_esperada": number,"p_vaga": string }; Returns: undefined
                           },
"eh_rh":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"etapa_atual":
{ Args: { "p_vaga": string }; Returns: number
                           },
"hoje_sp":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"meu_nome":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"meu_perfil":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
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
