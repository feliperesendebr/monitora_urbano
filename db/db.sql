-- 1. Criação do Domínio
CREATE TYPE public.tipo_alerta_enum AS ENUM ('buraco', 'falta_iluminacao', 'calcada_irregular', 'mato_alto');

-- 2. Tabela Principal
CREATE TABLE public.alertas_infraestrutura (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo_problema public.tipo_alerta_enum NOT NULL,
    descricao TEXT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente' NOT NULL,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Segurança (RLS)
ALTER TABLE public.alertas_infraestrutura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura anonima" ON public.alertas_infraestrutura FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir insercao anonima" ON public.alertas_infraestrutura FOR INSERT TO anon WITH CHECK (true);

CREATE TABLE public.parques (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    geometria JSONB NOT NULL, -- Guardaremos os pontos do polígono como JSON
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Segurança Crítica (Row Level Security)
-- Isso permite que sua chave 'anon' do Angular consiga ler e inserir
ALTER TABLE public.parques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura anonima parques"
ON public.parques FOR SELECT
TO anon
USING (true);

CREATE POLICY "Permitir insercao anonima parques"
ON public.parques FOR INSERT
TO anon
WITH CHECK (true);
