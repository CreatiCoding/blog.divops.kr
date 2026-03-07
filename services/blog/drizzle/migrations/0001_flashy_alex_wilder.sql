CREATE TABLE "page_view" (
	"id" text PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"referrer" text,
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "page_view_path_idx" ON "page_view" USING btree ("path");--> statement-breakpoint
CREATE INDEX "page_view_createdAt_idx" ON "page_view" USING btree ("createdAt");