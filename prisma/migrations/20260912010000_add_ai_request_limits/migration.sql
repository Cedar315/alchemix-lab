CREATE TABLE public.ai_request_leases (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz NOT NULL,
  finished_at timestamptz
);
CREATE INDEX ai_request_leases_user_started ON public.ai_request_leases(user_id, started_at);
ALTER TABLE public.ai_request_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_request_leases FROM anon, authenticated;
