CREATE TABLE "entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"category" text NOT NULL,
	"activity" text NOT NULL,
	"note" text,
	"source" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "entries_started_at_idx" ON "entries" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "entries_category_idx" ON "entries" USING btree ("category");