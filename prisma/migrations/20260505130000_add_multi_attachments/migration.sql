create table "message_attachments" (
  "id" serial primary key,
  "message_id" integer not null references "messages"("id") on delete cascade,
  "kind" varchar(20) not null,
  "url" varchar(512) not null,
  "name" varchar(255) not null,
  "mime" varchar(100) not null,
  "size" integer not null,
  "position" integer not null default 0,
  "created_at" timestamp not null default now()
);

create index "message_attachments_message_id_position_idx"
  on "message_attachments"("message_id", "position");

insert into "message_attachments" ("message_id", "kind", "url", "name", "mime", "size", "position")
select "id", "media_kind", "media_url", "media_name", "media_mime", "media_size", 0
from "messages"
where "media_kind" is not null
  and "media_url" is not null
  and "media_name" is not null
  and "media_mime" is not null
  and "media_size" is not null;

create table "channel_message_attachments" (
  "id" serial primary key,
  "channel_message_id" integer not null references "channel_messages"("id") on delete cascade,
  "kind" varchar(20) not null,
  "url" varchar(512) not null,
  "name" varchar(255) not null,
  "mime" varchar(100) not null,
  "size" integer not null,
  "position" integer not null default 0,
  "created_at" timestamp not null default now()
);

create index "channel_message_attachments_message_id_position_idx"
  on "channel_message_attachments"("channel_message_id", "position");

insert into "channel_message_attachments" ("channel_message_id", "kind", "url", "name", "mime", "size", "position")
select "id", "media_kind", "media_url", "media_name", "media_mime", "media_size", 0
from "channel_messages"
where "media_kind" is not null
  and "media_url" is not null
  and "media_name" is not null
  and "media_mime" is not null
  and "media_size" is not null;

create table "news_post_attachments" (
  "id" serial primary key,
  "post_id" integer not null references "news_posts"("id") on delete cascade,
  "kind" varchar(20) not null,
  "url" varchar(512) not null,
  "name" varchar(255) not null,
  "mime" varchar(100) not null,
  "size" integer not null,
  "position" integer not null default 0,
  "created_at" timestamp not null default now()
);

create index "news_post_attachments_post_id_position_idx"
  on "news_post_attachments"("post_id", "position");

insert into "news_post_attachments" ("post_id", "kind", "url", "name", "mime", "size", "position")
select "id", "media_kind", "media_url", "media_name", "media_mime", "media_size", 0
from "news_posts"
where "media_kind" is not null
  and "media_url" is not null
  and "media_name" is not null
  and "media_mime" is not null
  and "media_size" is not null;
