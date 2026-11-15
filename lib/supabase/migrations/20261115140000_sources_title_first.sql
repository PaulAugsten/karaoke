-- Some channels write "Title - Artist" instead of "Artist - Title".
ALTER TABLE "public"."sources"
  ADD COLUMN "title_first" boolean NOT NULL DEFAULT false;
