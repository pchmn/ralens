CREATE TABLE public.events ( id uuid DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, slug text DEFAULT 'slug'::text NOT NULL, "creatorId" uuid NOT NULL, "startAt" timestamptz NOT NULL, "endAt" timestamptz NOT NULL, params jsonb DEFAULT '{}'::jsonb NOT NULL, "createdAt" timestamptz DEFAULT now() NOT NULL, "updatedAt" timestamptz DEFAULT now() NOT NULL, PRIMARY KEY ("id") , FOREIGN KEY ("creatorId") REFERENCES auth.users (id) ON UPDATE restrict ON DELETE restrict);
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updatedAt"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updatedAt" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_public_events_updatedAt"
BEFORE UPDATE ON "public"."events"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_events_updatedAt" ON "public"."events"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
