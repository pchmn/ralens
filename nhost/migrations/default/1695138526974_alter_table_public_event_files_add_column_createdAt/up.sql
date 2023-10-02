alter table "public"."event_files" add column "createdAt" timestamptz
 not null default now();

alter table "public"."event_files" add column "updatedAt" timestamptz
 not null default now();

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
CREATE TRIGGER "set_public_event_files_updatedAt"
BEFORE UPDATE ON "public"."event_files"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_event_files_updatedAt" ON "public"."event_files"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
