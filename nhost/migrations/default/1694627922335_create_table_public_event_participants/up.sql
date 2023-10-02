CREATE TABLE "public"."event_participants" ("eventId" uuid NOT NULL, "userId" uuid NOT NULL, "role" text NOT NULL DEFAULT 'editor', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("eventId","userId") , FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON UPDATE restrict ON DELETE restrict, FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON UPDATE restrict ON DELETE restrict);
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
CREATE TRIGGER "set_public_event_participants_updatedAt"
BEFORE UPDATE ON "public"."event_participants"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_event_participants_updatedAt" ON "public"."event_participants"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
