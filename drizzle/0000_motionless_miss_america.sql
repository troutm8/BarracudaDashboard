CREATE TABLE "game_events" (
	"game_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"period" integer NOT NULL,
	"time_in_period" text NOT NULL,
	"type_desc_key" text NOT NULL,
	"team_id" integer,
	"x" integer,
	"y" integer,
	"quality" boolean,
	"player1_id" integer,
	"goalie_id" integer,
	CONSTRAINT "game_events_game_id_event_id_pk" PRIMARY KEY("game_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "game_goalie_stats" (
	"game_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"name" text NOT NULL,
	"sweater_number" integer,
	"starter" boolean,
	"decision" text,
	"shots_against" integer,
	"saves" integer,
	"goals_against" integer,
	"save_pctg" numeric(6, 4),
	"toi_seconds" integer,
	CONSTRAINT "game_goalie_stats_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "game_skater_stats" (
	"game_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"name" text NOT NULL,
	"sweater_number" integer,
	"position" text,
	"goals" integer,
	"assists" integer,
	"points" integer,
	"plus_minus" integer,
	"pim" integer,
	"sog" integer,
	CONSTRAINT "game_skater_stats_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" integer PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"game_type" integer NOT NULL,
	"game_date" date NOT NULL,
	"start_time_utc" timestamp with time zone,
	"venue" text,
	"venue_timezone" text,
	"home_team_id" integer NOT NULL,
	"away_team_id" integer NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"home_sog" integer,
	"away_sog" integer,
	"game_state" text NOT NULL,
	"schedule_state" text,
	"notes" text,
	"period" integer,
	"period_type" text,
	"clock" text,
	"in_intermission" boolean,
	"last_period_type" text,
	"attendance" integer,
	"home_audio_url" text,
	"away_audio_url" text,
	"video_url" text,
	"summary" jsonb,
	"boxscore_loaded" boolean DEFAULT false NOT NULL,
	"pbp_loaded" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goalie_season_stats" (
	"season" integer NOT NULL,
	"player_id" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"full_name" text NOT NULL,
	"team_abbrev" text,
	"rookie" boolean,
	"games_played" integer,
	"wins" integer,
	"losses" integer,
	"ot_losses" integer,
	"shots_against" integer,
	"saves" integer,
	"goals_against" integer,
	"gaa" numeric(7, 4),
	"save_pct" numeric(7, 5),
	"shutouts" integer,
	"minutes" integer,
	CONSTRAINT "goalie_season_stats_season_player_id_snapshot_date_pk" PRIMARY KEY("season","player_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"args" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"rows" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "odds_snapshots" (
	"date" date NOT NULL,
	"team_id" integer NOT NULL,
	"made_playoffs" numeric(6, 4),
	"first_round_bye" numeric(6, 4),
	"won_division" numeric(6, 4),
	"projected_points" numeric(6, 1),
	CONSTRAINT "odds_snapshots_date_team_id_pk" PRIMARY KEY("date","team_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"position" text,
	"sweater_number" integer,
	"team_id" integer,
	"headshot_url" text,
	"birth_date" date,
	"birth_place" text,
	"height_in" integer,
	"weight_lb" integer,
	"shoots_catches" text,
	"draft" jsonb,
	"career" jsonb,
	"on_roster" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skater_season_stats" (
	"season" integer NOT NULL,
	"player_id" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"full_name" text NOT NULL,
	"team_abbrev" text,
	"position" text,
	"rookie" boolean,
	"games_played" integer,
	"goals" integer,
	"assists" integer,
	"points" integer,
	"plus_minus" integer,
	"pim" integer,
	"pp_goals" integer,
	"pp_assists" integer,
	"sh_goals" integer,
	"gw_goals" integer,
	"ot_goals" integer,
	"shots" integer,
	"shooting_pct" numeric(6, 2),
	"shootout_goals" integer,
	"shootout_attempts" integer,
	CONSTRAINT "skater_season_stats_season_player_id_snapshot_date_pk" PRIMARY KEY("season","player_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "standings_snapshots" (
	"date" date NOT NULL,
	"team_id" integer NOT NULL,
	"season" integer NOT NULL,
	"games_played" integer NOT NULL,
	"games_remaining" integer,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"ot_losses" integer NOT NULL,
	"so_losses" integer NOT NULL,
	"points" integer NOT NULL,
	"point_pctg" numeric(7, 6),
	"regulation_wins" integer,
	"regulation_plus_ot_wins" integer,
	"goals_for" integer,
	"goals_against" integer,
	"goal_differential" integer,
	"pim" integer,
	"home" text,
	"road" text,
	"l10" text,
	"division_rank" integer,
	"league_rank" integer,
	CONSTRAINT "standings_snapshots_date_team_id_pk" PRIMARY KEY("date","team_id")
);
--> statement-breakpoint
CREATE TABLE "team_season_stats" (
	"season" integer NOT NULL,
	"team_id" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"games_played" integer,
	"pp_pct" numeric(7, 5),
	"pk_pct" numeric(7, 5),
	"pp_goals" integer,
	"pp_opps" integer,
	"pp_goals_against" integer,
	"times_shorthanded" integer,
	"sh_goals_for" integer,
	"sh_goals_against" integer,
	"shots_for" integer,
	"shots_against" integer,
	CONSTRAINT "team_season_stats_season_team_id_snapshot_date_pk" PRIMARY KEY("season","team_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" integer PRIMARY KEY NOT NULL,
	"abbrev" text NOT NULL,
	"name" text NOT NULL,
	"common_name" text NOT NULL,
	"place_name" text NOT NULL,
	"division" text,
	"logo_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"date" date NOT NULL,
	"player_name" text NOT NULL,
	"description" text NOT NULL,
	"player_id" integer,
	"position" text,
	"kind" text NOT NULL,
	CONSTRAINT "transactions_date_player_name_description_pk" PRIMARY KEY("date","player_name","description")
);
--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_goalie_stats" ADD CONSTRAINT "game_goalie_stats_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_goalie_stats" ADD CONSTRAINT "game_goalie_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_skater_stats" ADD CONSTRAINT "game_skater_stats_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_skater_stats" ADD CONSTRAINT "game_skater_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_snapshots" ADD CONSTRAINT "standings_snapshots_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_season_stats" ADD CONSTRAINT "team_season_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ge_type_idx" ON "game_events" USING btree ("type_desc_key");--> statement-breakpoint
CREATE INDEX "ge_player_idx" ON "game_events" USING btree ("player1_id");--> statement-breakpoint
CREATE INDEX "ggs_player_idx" ON "game_goalie_stats" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "gss_player_idx" ON "game_skater_stats" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "gss_team_idx" ON "game_skater_stats" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "games_date_idx" ON "games" USING btree ("game_date");--> statement-breakpoint
CREATE INDEX "games_home_idx" ON "games" USING btree ("home_team_id");--> statement-breakpoint
CREATE INDEX "games_away_idx" ON "games" USING btree ("away_team_id");--> statement-breakpoint
CREATE INDEX "gss2_date_idx" ON "goalie_season_stats" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "sss_date_idx" ON "skater_season_stats" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "standings_team_idx" ON "standings_snapshots" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tx_date_idx" ON "transactions" USING btree ("date");