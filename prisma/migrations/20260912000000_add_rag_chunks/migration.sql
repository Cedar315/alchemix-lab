CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
-- Supabase normally installs vector in extensions. Do not silently relocate an existing extension.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector' AND n.nspname='extensions') THEN
    RAISE EXCEPTION 'pgvector must be installed in schema extensions; review database extension configuration first';
  END IF;
END $$;
CREATE TABLE public.rag_chunks (
  id TEXT PRIMARY KEY,
  dataset_version TEXT NOT NULL,
  embedding_profile TEXT NOT NULL,
  document JSONB NOT NULL,
  embedding extensions.vector(1024) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
-- No browser policies: access only through authenticated administrator server routes.
REVOKE ALL ON public.rag_chunks FROM anon, authenticated;
