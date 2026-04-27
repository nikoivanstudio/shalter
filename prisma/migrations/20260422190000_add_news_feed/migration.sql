CREATE TABLE "news_posts" (
  "id" SERIAL NOT NULL,
  "author_id" INTEGER NOT NULL,
  "content" VARCHAR(2000) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_post_likes" (
  "id" SERIAL NOT NULL,
  "post_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "news_post_likes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_post_comments" (
  "id" SERIAL NOT NULL,
  "post_id" INTEGER NOT NULL,
  "author_id" INTEGER NOT NULL,
  "content" VARCHAR(1000) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "news_post_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "news_posts_author_id_idx" ON "news_posts"("author_id");
CREATE INDEX "news_posts_created_at_idx" ON "news_posts"("created_at");
CREATE UNIQUE INDEX "news_post_likes_post_id_user_id_key" ON "news_post_likes"("post_id", "user_id");
CREATE INDEX "news_post_likes_user_id_idx" ON "news_post_likes"("user_id");
CREATE INDEX "news_post_comments_post_id_created_at_idx" ON "news_post_comments"("post_id", "created_at");
CREATE INDEX "news_post_comments_author_id_idx" ON "news_post_comments"("author_id");

ALTER TABLE "news_posts"
  ADD CONSTRAINT "news_posts_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "news_post_likes"
  ADD CONSTRAINT "news_post_likes_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "news_posts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "news_post_likes"
  ADD CONSTRAINT "news_post_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "news_post_comments"
  ADD CONSTRAINT "news_post_comments_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "news_posts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "news_post_comments"
  ADD CONSTRAINT "news_post_comments_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
