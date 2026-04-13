CREATE TABLE "board_card_comments" (
	"id" text PRIMARY KEY,
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_card_comments" ADD CONSTRAINT "board_card_comments_card_id_board_cards_id_fkey" FOREIGN KEY ("card_id") REFERENCES "board_cards"("id") ON DELETE CASCADE;