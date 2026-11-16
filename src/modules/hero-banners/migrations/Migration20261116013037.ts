import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261116013037 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "hb_banner_translation" drop constraint if exists "hb_banner_translation_banner_id_locale_unique";`);
    this.addSql(`create table if not exists "hb_banner" ("id" text not null, "name" text not null, "placement" text not null default 'home', "enabled" boolean not null default false, "rank" integer not null default 0, "href" text null, "secondary_href" text null, "image_desktop" text null, "image_mobile" text null, "focus" jsonb null, "files" jsonb null, "starts_at" timestamptz null, "ends_at" timestamptz null, "locales" jsonb not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "hb_banner_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_hb_banner_deleted_at" ON "hb_banner" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_hb_banner_placement_rank" ON "hb_banner" ("placement", "rank") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "hb_banner_translation" ("id" text not null, "locale" text not null, "title" text not null, "subtitle" text null, "cta" text null, "secondary_cta" text null, "alt" text null, "banner_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "hb_banner_translation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_hb_banner_translation_banner_id" ON "hb_banner_translation" ("banner_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_hb_banner_translation_deleted_at" ON "hb_banner_translation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hb_banner_translation_banner_id_locale_unique" ON "hb_banner_translation" ("banner_id", "locale") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "hb_banner_translation" add constraint "hb_banner_translation_banner_id_foreign" foreign key ("banner_id") references "hb_banner" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "hb_banner_translation" drop constraint if exists "hb_banner_translation_banner_id_foreign";`);

    this.addSql(`drop table if exists "hb_banner" cascade;`);

    this.addSql(`drop table if exists "hb_banner_translation" cascade;`);
  }

}
