# Monitora Urbano 🌳📍

[![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=for-the-badge&logo=angular)](https://angular.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-BaaS-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel)](https://vercel.com/)

O **Monitora Urbano** é uma plataforma *CivicTech* de mapeamento colaborativo projetada para transformar dados isolados de abandono urbano em inteligência geográfica coletiva. Focada inicialmente nas Regiões Administrativas de **Taguatinga e Ceilândia (DF)**, a aplicação permite que o cidadão registre passivos de infraestrutura e planeje rotas seguras.

---

## 🚀 Funcionalidades Principais

*   **📍 Mapeamento em Tempo Real:** Registro georreferenciado de buracos, falta de iluminação, calçadas irregulares e mato alto.
*   **🛡️ Motor de Roteamento Seguro:** Algoritmo espacial que analisa o trajeto do usuário e sinaliza (Verde/Vermelho) se a rota possui riscos de infraestrutura em um raio de 150m.
*   **🌳 Zonas de Observação (Parques):** Gestão de áreas poligonais com dashboards automáticos de zeladoria, contabilizando alertas internos.
*   **🛰️ Captura de Alta Precisão:** Suporte a GPS nativo e modo de seleção manual via "Mira" no mapa para maior exatidão.
*   **📱 Mobile-First:** Interface responsiva desenhada para o uso em campo pelo cidadão.

---

## 🛠️ Stack Técnica

### Frontend
- **Angular 21:** Arquitetura baseada em *Standalone Components* e *Signals*.
- **Leaflet & Leaflet Routing Machine:** Motor cartográfico e roteamento OSRM.
- **Tailwind CSS:** Design System utilitário para alta performance visual.

### Backend (BaaS)
- **Supabase (PostgreSQL):** Persistência de dados geográficos.
- **Row Level Security (RLS):** Segurança estrita no nível do banco de dados, permitindo tráfego anônimo seguro.

---

## ⚙️ Configuração do Ambiente

### 1. Requisitos Prévios
- Node.js v24+
- Conta no Supabase

### 2. Instalação
```bash
git clone https://github.com/seu-usuario/monitora-urbano.git
cd monitora-urbano
npm install
```

### 3. Banco de Dados (SQL Editor)
Execute o script abaixo no painel do Supabase para provisionar a infraestrutura:

```sql
-- Domínio de Alertas
CREATE TYPE public.tipo_alerta_enum AS ENUM ('buraco', 'falta_iluminacao', 'calcada_irregular', 'mato_alto');

-- Tabela de Alertas
CREATE TABLE public.alertas_infraestrutura (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo_problema public.tipo_alerta_enum NOT NULL,
    descricao TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente',
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Parques/Zonas
CREATE TABLE public.parques (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    geometria JSONB NOT NULL,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Segurança RLS
ALTER TABLE public.alertas_infraestrutura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura Anonima" ON public.alertas_infraestrutura FOR SELECT TO anon USING (true);
CREATE POLICY "Insercao Anonima" ON public.alertas_infraestrutura FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Leitura Parques" ON public.parques FOR SELECT TO anon USING (true);
CREATE POLICY "Insercao Parques" ON public.parques FOR INSERT TO anon WITH CHECK (true);
```

### 4. Variáveis de Ambiente
Crie ou edite o arquivo `src/environments/environment.development.ts`:
```typescript
export const environment = {
  production: false,
  supabaseUrl: 'SUA_URL_SUPABASE',
  supabaseKey: 'SUA_ANON_KEY'
};
```

---

## 🌍 Impacto Social (ODS)

Este projeto está alinhado com as metas da ONU para o desenvolvimento sustentável:
- **ODS 3 (Saúde e Bem-Estar):** Prevenção de acidentes e quedas em vias públicas.
- **ODS 11 (Cidades e Comunidades Sustentáveis):** Proporcionar acesso a sistemas de transporte seguros e acessíveis.
- **ODS 15 (Vida Terrestre):** Monitoramento e proteção de áreas verdes urbanas.

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---
**Desenvolvido como um protótipo de alta fidelidade para o Distrito Federal.**
