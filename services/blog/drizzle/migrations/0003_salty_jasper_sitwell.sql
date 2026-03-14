ALTER TABLE "post" ADD COLUMN "urlSlug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "post_url_slug_idx" ON "post" USING btree ("urlSlug");--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_urlSlug_unique" UNIQUE("urlSlug");