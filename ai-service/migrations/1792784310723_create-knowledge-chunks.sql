-- Up Migration

-- O ai-service é dono deste banco: a extensão é criada pela migration, não pela infraestrutura
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id text NOT NULL,
  document_title text NOT NULL,
  section text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  -- Permite à ingestão pular seções que não mudaram
  content_hash text NOT NULL,
  -- 768 precisa bater com EMBEDDING_DIMENSIONS; mudar exige nova migration e nova ingestão
  embedding vector(768) NOT NULL,
  -- Vetores de modelos diferentes não são comparáveis
  embedding_model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_chunks_document_section_key UNIQUE (document_id, section)
);

-- Busca aproximada por similaridade de cosseno
CREATE INDEX knowledge_chunks_embedding_idx
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- Filtro por metadados
CREATE INDEX knowledge_chunks_category_idx ON knowledge_chunks (category);

-- Down Migration

DROP TABLE knowledge_chunks;
DROP EXTENSION IF EXISTS vector;
