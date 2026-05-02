alter table news_posts
add column media_kind varchar(20),
add column media_url varchar(512),
add column media_name varchar(255),
add column media_mime varchar(100),
add column media_size integer;
