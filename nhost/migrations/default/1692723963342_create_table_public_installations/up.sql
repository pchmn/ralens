CREATE TABLE public.installations (id uuid DEFAULT gen_random_uuid() NOT NULL, "userId" uuid NOT NULL, "deviceName" varchar, "osName" varchar, "osVersion" varchar, "appVersion" varchar NOT NULL, "appIdentifier" varchar NOT NULL, "deviceType" varchar NOT NULL, "deviceLocale" varchar NOT NULL, "pushToken" varchar NOT NULL, "isActive" bool DEFAULT 'true' NOT NULL, "createdAt" timestamptz DEFAULT now() NOT NULL, "updatedAt" timestamptz DEFAULT now() NOT NULL, PRIMARY KEY ("id", "userId"), FOREIGN KEY ("userId" )REFERENCES auth.users (id) ON UPDATE RESTRICT ON DELETE RESTRICT);

CREATE OR REPLACE TRIGGER set_installations_updated_at
BEFORE UPDATE ON installations
FOR EACH ROW EXECUTE PROCEDURE set_updatedAt();
