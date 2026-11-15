REVOKE ALL ON SEQUENCE "public"."similar_songs_song_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."similar_songs_song_id_seq" FROM "authenticated";

REVOKE ALL ON SEQUENCE "public"."similar_songs_song_id_seq" FROM "postgres";

REVOKE ALL ON SEQUENCE "public"."similar_songs_song_id_seq" FROM "service_role";

ALTER TABLE "public"."similar_songs"
  DROP CONSTRAINT "similar_songs_pkey";

ALTER TABLE "public"."similar_songs"
  ALTER COLUMN "song_id" DROP IDENTITY;

ALTER TABLE "public"."similar_songs"
  ADD CONSTRAINT "similar_songs_not_self" CHECK ((song_id <> similar_song_id));

ALTER TABLE "public"."similar_songs"
  ADD CONSTRAINT "similar_songs_pkey" PRIMARY KEY (song_id, similar_song_id);
