alter table users
add column avatar_url varchar(512);

alter table messages
add column media_kind varchar(20),
add column media_url varchar(512),
add column media_name varchar(255),
add column media_mime varchar(100),
add column media_size integer;

alter table channel_messages
add column media_kind varchar(20),
add column media_url varchar(512),
add column media_name varchar(255),
add column media_mime varchar(100),
add column media_size integer;
