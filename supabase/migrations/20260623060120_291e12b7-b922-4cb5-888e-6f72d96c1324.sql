
CREATE TABLE public.launch_config (
  id INT PRIMARY KEY DEFAULT 1,
  launch_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT launch_config_single_row CHECK (id = 1)
);

GRANT SELECT ON public.launch_config TO anon, authenticated;
GRANT ALL ON public.launch_config TO service_role;

ALTER TABLE public.launch_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read launch config"
  ON public.launch_config FOR SELECT
  USING (true);

-- Seed with a fixed launch time: 2026-06-23 13:10 GMT+5:30
INSERT INTO public.launch_config (id, launch_at)
VALUES (1, TIMESTAMPTZ '2026-06-23 13:10:00+05:30')
ON CONFLICT (id) DO UPDATE SET launch_at = EXCLUDED.launch_at;
