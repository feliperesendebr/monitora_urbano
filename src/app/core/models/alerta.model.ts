// Regra: Os campos opcionais (?) são gerenciados silenciosamente pelo Supabase (PostgreSQL)
export interface Alerta {
  id?: string;
  tipo_problema: 'buraco' | 'falta_iluminacao' | 'calcada_irregular' | 'mato_alto';
  descricao?: string;
  latitude: number;
  longitude: number;
  status?: string;
  data_criacao?: string;
}

export interface Parque {
  id?: string;
  nome: string;
  geometria: { lat: number, lng: number }[];
}
