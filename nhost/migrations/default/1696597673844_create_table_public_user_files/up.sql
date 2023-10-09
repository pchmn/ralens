CREATE TABLE "public"."user_files" ("userId" uuid NOT NULL, "fileId" uuid NOT NULL, PRIMARY KEY ("userId","fileId") , FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON UPDATE restrict ON DELETE restrict, FOREIGN KEY ("fileId") REFERENCES "storage"."files"("id") ON UPDATE restrict ON DELETE restrict);