-- Additive product telemetry. Aggregate metadata survives detail retention.
CREATE TABLE public.pm_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 client_id text NOT NULL, internal boolean NOT NULL, surface text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 feedback text CHECK (feedback IN ('solved','unsolved')), reason text,
 UNIQUE(user_id, client_id)
);
CREATE TABLE public.pm_turns (
 id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL, intent text,
 model text NOT NULL, version text NOT NULL, elapsed_ms integer NOT NULL,
 rag_status text, tool_summary jsonb NOT NULL DEFAULT '[]', usage jsonb,
 pinned boolean NOT NULL DEFAULT false, review_status text NOT NULL DEFAULT 'unreviewed',
 review_note text NOT NULL DEFAULT '', reviewer uuid, reviewed_at timestamptz
);
CREATE TABLE public.pm_details (
 turn_id uuid PRIMARY KEY REFERENCES public.pm_turns(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days', payload jsonb NOT NULL
);
CREATE TABLE public.pm_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
 visitor_id text NOT NULL, internal boolean NOT NULL, name text NOT NULL, page text NOT NULL,
 source text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pm_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor uuid NOT NULL, action text NOT NULL,
 target text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pm_evaluations (
 id uuid PRIMARY KEY, actor uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 mode text NOT NULL, case_key text NOT NULL, version text NOT NULL, model text NOT NULL,
 status text NOT NULL, elapsed_ms integer NOT NULL, payload jsonb NOT NULL,
 grade text NOT NULL DEFAULT 'pending', note text NOT NULL DEFAULT ''
);
CREATE INDEX ON public.pm_tasks (created_at, internal);
CREATE INDEX ON public.pm_turns (created_at);
CREATE INDEX ON public.pm_turns (task_id);
CREATE INDEX ON public.pm_details (expires_at);
CREATE INDEX ON public.pm_events (created_at, internal);
CREATE INDEX ON public.pm_events (user_id, created_at);
CREATE INDEX ON public.pm_evaluations (created_at);
ALTER TABLE public.pm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_evaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pm_tasks, public.pm_turns, public.pm_details, public.pm_events, public.pm_audit, public.pm_evaluations FROM anon, authenticated;
CREATE FUNCTION public.pm_purge_details() RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE affected bigint;
BEGIN
 DELETE FROM public.pm_details d USING public.pm_turns t WHERE d.turn_id=t.id AND d.expires_at<=now() AND NOT t.pinned;
 GET DIAGNOSTICS affected = ROW_COUNT;
 RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.pm_purge_details() FROM PUBLIC;
-- Supabase projects with pg_cron enabled get independent daily cleanup.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('alchemix-pm-retention','15 3 * * *','SELECT public.pm_purge_details()');
 END IF;
END $$;
