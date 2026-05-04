ALTER TABLE "users"
ADD COLUMN "profile_visibility" VARCHAR(20) NOT NULL DEFAULT 'everyone',
ADD COLUMN "show_email_in_profile" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "show_phone_in_profile" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "show_gifts_in_profile" BOOLEAN NOT NULL DEFAULT true;
