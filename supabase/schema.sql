-- Duffield Holdings Dashboard Schema
-- Run in Supabase SQL Editor

CREATE TABLE deals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  address text NOT NULL,
  city text,
  state text,
  market text,
  status text NOT NULL DEFAULT 'new_lead',
  property_type text,
  asking_price numeric,
  building_sf numeric,
  lot_acres numeric,
  price_per_sf numeric,
  clear_height numeric,
  dock_doors integer,
  distance_interstate numeric,
  cap_rate numeric,
  year_built integer,
  notes text DEFAULT '',
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_deals" ON deals USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE deals;
