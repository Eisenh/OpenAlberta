-- Fix trigger to safely allow system insertions where added_by is null
CREATE OR REPLACE FUNCTION public.add_creator_as_maintainer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.added_by IS NOT NULL THEN
    INSERT INTO public.data_source_maintainers (data_source_id, user_id, added_by)
    VALUES (NEW.id, NEW.added_by, NEW.added_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed the legacy Alberta Open Data portal to fix missing regional UI drops
DO $$ 
DECLARE 
  ab_id UUID;
BEGIN
  -- Insert the legacy source if it doesn't exist
  INSERT INTO public.data_sources (ckan_url, display_name, authority, country, region, is_approved, latitude, longitude)
  VALUES ('https://open.alberta.ca', 'Alberta Open Data', 'Government of Alberta', 'CA', 'Alberta', true, 53.9333, -116.5765)
  ON CONFLICT (ckan_url) DO UPDATE SET is_approved = true
  RETURNING id INTO ab_id;

  -- Update all existing legacy metadata that was ingested prior to generalization
  UPDATE public.docs_meta
  SET data_source_id = ab_id
  WHERE data_source_id IS NULL;
END $$;
