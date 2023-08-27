CREATE OR REPLACE FUNCTION set_updatedAt() RETURNS trigger AS
$$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns WHERE column_name = 'updatedAt'
    LOOP
        EXECUTE format('CREATE OR REPLACE TRIGGER set_%I_updated_at
                    BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE PROCEDURE set_updatedAt()', t,t);
    END loop;
END;
$$ language 'plpgsql';
