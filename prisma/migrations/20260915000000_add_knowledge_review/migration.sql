CREATE TABLE public.knowledge_candidates (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  question TEXT NOT NULL,
  recipe_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','gap','published','rejected','merged')),
  draft JSONB NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]',
  reason TEXT NOT NULL DEFAULT '',
  occurrences INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  merged_into TEXT REFERENCES public.knowledge_candidates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.knowledge_reviews (
  id BIGSERIAL PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES public.knowledge_candidates(id),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.knowledge_candidates, public.knowledge_reviews FROM anon, authenticated;
CREATE INDEX knowledge_candidates_status_updated ON public.knowledge_candidates(status, updated_at DESC);
