CREATE TABLE "site_visit" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"visited_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_visit_visitor_date_unique" UNIQUE("visitor_id","visited_date")
);
