// Fichier généré par scripts/db-types.sh (npm run db:types) : ne pas modifier à la main.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "action_types": {
                  Row: {
                    "active": boolean,"factors": (string)[],"kind": string,"label": string,"max_quantity": number,"min_quantity": number,"reference_rule": string,"slug": string,"template_id": string,"unit": string,"variant": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"factors"?: (string)[],"kind": string,"label": string,"max_quantity": number,"min_quantity": number,"reference_rule": string,"slug": string,"template_id": string,"unit": string,"variant": string
                  }
                  Update: {
                    "active"?: boolean,"factors"?: (string)[],"kind"?: string,"label"?: string,"max_quantity"?: number,"min_quantity"?: number,"reference_rule"?: string,"slug"?: string,"template_id"?: string,"unit"?: string,"variant"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "action_types_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "challenge_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_cache": {
                  Row: {
                    "created_at": string,"expires_at": string,"key": string,"output": NonNullable<Json>,"task": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at": string,"key": string,"output": NonNullable<Json>,"task": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"key"?: string,"output"?: NonNullable<Json>,"task"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_calls": {
                  Row: {
                    "cache_read_tokens": number,"company_id": string | null,"cost_usd": number,"created_at": string,"error_code": string | null,"id": number,"input_tokens": number,"latency_ms": number,"model": string,"output_tokens": number,"prompt_version": string,"status": string,"task": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cache_read_tokens"?: number,"company_id"?: string | null,"cost_usd"?: number,"created_at"?: string,"error_code"?: string | null,"id"?: never,"input_tokens"?: number,"latency_ms"?: number,"model": string,"output_tokens"?: number,"prompt_version": string,"status": string,"task": string,"user_id"?: string | null
                  }
                  Update: {
                    "cache_read_tokens"?: number,"company_id"?: string | null,"cost_usd"?: number,"created_at"?: string,"error_code"?: string | null,"id"?: never,"input_tokens"?: number,"latency_ms"?: number,"model"?: string,"output_tokens"?: number,"prompt_version"?: string,"status"?: string,"task"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_calls_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_calls_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_quota": {
                  Row: {
                    "day": string,"scope": string,"subject": string,"task": string,"used": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"scope": string,"subject": string,"task": string,"used"?: number
                  }
                  Update: {
                    "day"?: string,"scope"?: string,"subject"?: string,"task"?: string,"used"?: number
                  }
                  Relationships: [
                    
                  ]
                },"alerts": {
                  Row: {
                    "body": string,"created_at": string,"id": number,"kind": string,"pushed_at": string | null,"ref": string,"seen_at": string | null,"title": string,"url": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: never,"kind": string,"pushed_at"?: string | null,"ref": string,"seen_at"?: string | null,"title": string,"url"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: never,"kind"?: string,"pushed_at"?: string | null,"ref"?: string,"seen_at"?: string | null,"title"?: string,"url"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"animator_posts": {
                  Row: {
                    "created_at": string,"day": string,"id": number,"message_id": string | null,"meta": NonNullable<Json>,"ref": string,"slot": string,"spontaneous": boolean | null,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"id"?: never,"message_id"?: string | null,"meta"?: NonNullable<Json>,"ref"?: string,"slot": string,"spontaneous"?: never,"team_id": string
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"id"?: never,"message_id"?: string | null,"meta"?: NonNullable<Json>,"ref"?: string,"slot"?: string,"spontaneous"?: never,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "animator_posts_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "team_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "animator_posts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"challenge_templates": {
                  Row: {
                    "active": boolean,"cap_group": string,"cap_units": number,"cap_window_days": number,"category": string,"id": string,"level": string,"points_per_unit": number,"requires_receipt": boolean,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"cap_group": string,"cap_units": number,"cap_window_days"?: number,"category": string,"id": string,"level"?: string,"points_per_unit": number,"requires_receipt"?: boolean,"title": string
                  }
                  Update: {
                    "active"?: boolean,"cap_group"?: string,"cap_units"?: number,"cap_window_days"?: number,"category"?: string,"id"?: string,"level"?: string,"points_per_unit"?: number,"requires_receipt"?: boolean,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cheers": {
                  Row: {
                    "created_at": string,"user_id": string,"validation_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string,"validation_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string,"validation_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cheers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cheers_validation_id_fkey"
      columns: ["validation_id"]
isOneToOne: false
      referencedRelation: "validations"
      referencedColumns: ["id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "created_at": string,"created_by": string | null,"email_domain": string | null,"id": string,"join_code": string,"name": string,"pilot_start": string,"pilot_weeks": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"email_domain"?: string | null,"id"?: string,"join_code": string,"name": string,"pilot_start"?: string,"pilot_weeks"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"email_domain"?: string | null,"id"?: string,"join_code"?: string,"name"?: string,"pilot_start"?: string,"pilot_weeks"?: number
                  }
                  Relationships: [
                    
                  ]
                },"cron_keys": {
                  Row: {
                    "name": string,"sha256": string
                  }
                  ComputedFields: never
                  Insert: {
                    "name": string,"sha256": string
                  }
                  Update: {
                    "name"?: string,"sha256"?: string
                  }
                  Relationships: [
                    
                  ]
                },"daily_quests": {
                  Row: {
                    "day": string,"quests": (string)[],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"quests": (string)[],"user_id": string
                  }
                  Update: {
                    "day"?: string,"quests"?: (string)[],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_quests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"duels": {
                  Row: {
                    "challenge_id": string | null,"challenger": string,"company_id": string,"created_at": string,"ends_on": string | null,"id": string,"kind": string,"opponent": string,"stakes": boolean,"starts_on": string | null,"status": string,"target": number,"template_id": string | null,"variant": string | null,"winner": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id"?: string | null,"challenger": string,"company_id": string,"created_at"?: string,"ends_on"?: string | null,"id"?: string,"kind": string,"opponent": string,"stakes"?: boolean,"starts_on"?: string | null,"status"?: string,"target"?: number,"template_id"?: string | null,"variant"?: string | null,"winner"?: string | null
                  }
                  Update: {
                    "challenge_id"?: string | null,"challenger"?: string,"company_id"?: string,"created_at"?: string,"ends_on"?: string | null,"id"?: string,"kind"?: string,"opponent"?: string,"stakes"?: boolean,"starts_on"?: string | null,"status"?: string,"target"?: number,"template_id"?: string | null,"variant"?: string | null,"winner"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "duels_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "user_challenges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "duels_challenger_fkey"
      columns: ["challenger"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "duels_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "duels_opponent_fkey"
      columns: ["opponent"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "duels_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "challenge_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"emission_factors": {
                  Row: {
                    "category": string,"created_at": string,"id": number,"kgco2e_per_unit": number | null,"label": string,"slug": string,"source": string,"source_ref": string,"todo": string | null,"unit": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"id"?: never,"kgco2e_per_unit"?: number | null,"label": string,"slug": string,"source": string,"source_ref": string,"todo"?: string | null,"unit": string,"version": string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"id"?: never,"kgco2e_per_unit"?: number | null,"label"?: string,"slug"?: string,"source"?: string,"source_ref"?: string,"todo"?: string | null,"unit"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"feedback": {
                  Row: {
                    "brakes": (string)[],"comment": string | null,"company_id": string,"created_at": string,"id": string,"motivation": number,"recommend": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brakes"?: (string)[],"comment"?: string | null,"company_id": string,"created_at"?: string,"id"?: string,"motivation": number,"recommend": number,"user_id"?: string | null
                  }
                  Update: {
                    "brakes"?: (string)[],"comment"?: string | null,"company_id"?: string,"created_at"?: string,"id"?: string,"motivation"?: number,"recommend"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"footprints": {
                  Row: {
                    "answers": NonNullable<Json>,"by_category": NonNullable<Json>,"created_at": string,"id": string,"total_kg": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answers": NonNullable<Json>,"by_category": NonNullable<Json>,"created_at"?: string,"id"?: string,"total_kg": number,"user_id": string
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"by_category"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"total_kg"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "footprints_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"garden_rares": {
                  Row: {
                    "obtained_at": string,"plant": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "obtained_at"?: string,"plant": string,"user_id": string
                  }
                  Update: {
                    "obtained_at"?: string,"plant"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "garden_rares_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"habit_checkins": {
                  Row: {
                    "company_id": string,"created_at": string,"habit": string,"id": string,"user_id": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"habit": string,"id"?: string,"user_id": string,"week_start": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"habit"?: string,"id"?: string,"user_id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "habit_checkins_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "habit_checkins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"habits": {
                  Row: {
                    "beef_meals_week": number,"bottled_water_l_day": number,"buys_new_phone": boolean,"commute_days": number,"commute_km": number,"commute_mode": string,"heating": string,"heating_kg_year": number,"long_flights_year": number,"new_clothes_year": number,"new_devices_year": number,"other_meat_meals_week": number,"short_flights_year": number,"updated_at": string,"user_id": string,"kept_habits": (string)[] | null
                  }
                  ComputedFields: "kept_habits"
                  Insert: {
                    "beef_meals_week": number,"bottled_water_l_day"?: number,"buys_new_phone": boolean,"commute_days": number,"commute_km": number,"commute_mode": string,"heating": string,"heating_kg_year": number,"long_flights_year": number,"new_clothes_year": number,"new_devices_year"?: number,"other_meat_meals_week": number,"short_flights_year": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "beef_meals_week"?: number,"bottled_water_l_day"?: number,"buys_new_phone"?: boolean,"commute_days"?: number,"commute_km"?: number,"commute_mode"?: string,"heating"?: string,"heating_kg_year"?: number,"long_flights_year"?: number,"new_clothes_year"?: number,"new_devices_year"?: number,"other_meat_meals_week"?: number,"short_flights_year"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "habits_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"monthly_reports": {
                  Row: {
                    "company_id": string,"content": NonNullable<Json>,"created_at": string,"month": string,"prompt_version": string | null,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"content": NonNullable<Json>,"created_at"?: string,"month": string,"prompt_version"?: string | null,"source": string
                  }
                  Update: {
                    "company_id"?: string,"content"?: NonNullable<Json>,"created_at"?: string,"month"?: string,"prompt_version"?: string | null,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "monthly_reports_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"mystery_seeds": {
                  Row: {
                    "day": string,"opened_at": string | null,"points": number,"reward": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"opened_at"?: string | null,"points"?: number,"reward"?: string | null,"user_id": string
                  }
                  Update: {
                    "day"?: string,"opened_at"?: string | null,"points"?: number,"reward"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mystery_seeds_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_admins": {
                  Row: {
                    "company_id": string,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_admins_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_feasibility": {
                  Row: {
                    "level": string,"template_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "level": string,"template_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "level"?: string,"template_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_feasibility_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "challenge_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_feasibility_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"points_ledger": {
                  Row: {
                    "company_id": string,"created_at": string,"id": string,"kind": string,"points": number,"ref_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"id"?: string,"kind": string,"points": number,"ref_id": string,"user_id": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"points"?: number,"ref_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "points_ledger_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "points_ledger_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"product_scans": {
                  Row: {
                    "co2_kg_per_kg": number | null,"code": string,"company_id": string,"created_at": string,"grade": string | null,"id": string,"name": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "co2_kg_per_kg"?: number | null,"code": string,"company_id": string,"created_at"?: string,"grade"?: string | null,"id"?: string,"name"?: string | null,"user_id": string
                  }
                  Update: {
                    "co2_kg_per_kg"?: number | null,"code"?: string,"company_id"?: string,"created_at"?: string,"grade"?: string | null,"id"?: string,"name"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_scans_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_scans_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"product_swaps": {
                  Row: {
                    "company_id": string,"created_at": string,"from_co2": number | null,"from_code": string,"from_grade": string | null,"id": string,"to_co2": number | null,"to_code": string,"to_grade": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"from_co2"?: number | null,"from_code": string,"from_grade"?: string | null,"id"?: string,"to_co2"?: number | null,"to_code": string,"to_grade"?: string | null,"user_id": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"from_co2"?: number | null,"from_code"?: string,"from_grade"?: string | null,"id"?: string,"to_co2"?: number | null,"to_code"?: string,"to_grade"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_swaps_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_swaps_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "company_id": string,"consent_data": boolean,"consent_feedback": boolean,"consent_team_stats": boolean,"created_at": string,"display_name": string,"feed_choice_at": string | null,"id": string,"share_feed": boolean,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"consent_data": boolean,"consent_feedback"?: boolean,"consent_team_stats"?: boolean,"created_at"?: string,"display_name": string,"feed_choice_at"?: string | null,"id": string,"share_feed"?: boolean,"team_id"?: string | null
                  }
                  Update: {
                    "company_id"?: string,"consent_data"?: boolean,"consent_feedback"?: boolean,"consent_team_stats"?: boolean,"created_at"?: string,"display_name"?: string,"feed_choice_at"?: string | null,"id"?: string,"share_feed"?: boolean,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"proof_checks": {
                  Row: {
                    "checked_at": string,"company_id": string,"id": number,"model": string,"points_withheld": number,"prompt_version": string,"reason_code": string,"validation_id": string,"verdict": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_at"?: string,"company_id": string,"id"?: never,"model": string,"points_withheld"?: number,"prompt_version": string,"reason_code": string,"validation_id": string,"verdict": string
                  }
                  Update: {
                    "checked_at"?: string,"company_id"?: string,"id"?: never,"model"?: string,"points_withheld"?: number,"prompt_version"?: string,"reason_code"?: string,"validation_id"?: string,"verdict"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proof_checks_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "proof_checks_validation_id_fkey"
      columns: ["validation_id"]
isOneToOne: false
      referencedRelation: "validations"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"last_sent_on": string | null,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"last_sent_on"?: string | null,"p256dh": string,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"last_sent_on"?: string | null,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_answers": {
                  Row: {
                    "choice": number,"correct": boolean,"created_at": string,"day": string,"question_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "choice": number,"correct": boolean,"created_at"?: string,"day": string,"question_id": number,"user_id": string
                  }
                  Update: {
                    "choice"?: number,"correct"?: boolean,"created_at"?: string,"day"?: string,"question_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "quiz_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_answers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_questions": {
                  Row: {
                    "active": boolean,"answer": number,"choices": (string)[],"explanation": string,"id": number,"question": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"answer": number,"choices": (string)[],"explanation": string,"id": number,"question": string
                  }
                  Update: {
                    "active"?: boolean,"answer"?: number,"choices"?: (string)[],"explanation"?: string,"id"?: number,"question"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quiz_week_answers": {
                  Row: {
                    "choice": number,"correct": boolean,"created_at": string,"question_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "choice": number,"correct": boolean,"created_at"?: string,"question_id": number,"user_id": string
                  }
                  Update: {
                    "choice"?: number,"correct"?: boolean,"created_at"?: string,"question_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_week_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "quiz_week_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_week_answers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_week_questions": {
                  Row: {
                    "answer": number,"choices": (string)[],"created_at": string,"explanation": string,"id": number,"position": number,"prompt_version": string,"question": string,"source_kind": string,"source_title": string,"source_url": string | null,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": number,"choices": (string)[],"created_at"?: string,"explanation": string,"id"?: never,"position": number,"prompt_version": string,"question": string,"source_kind": string,"source_title": string,"source_url"?: string | null,"week_start": string
                  }
                  Update: {
                    "answer"?: number,"choices"?: (string)[],"created_at"?: string,"explanation"?: string,"id"?: never,"position"?: number,"prompt_version"?: string,"question"?: string,"source_kind"?: string,"source_title"?: string,"source_url"?: string | null,"week_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"id": string,"reason": string | null,"user_id": string,"validation_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"reason"?: string | null,"user_id": string,"validation_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"reason"?: string | null,"user_id"?: string,"validation_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_validation_id_fkey"
      columns: ["validation_id"]
isOneToOne: false
      referencedRelation: "validations"
      referencedColumns: ["id"]
    }
                  ]
                },"team_message_reports": {
                  Row: {
                    "created_at": string,"message_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"message_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"message_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_message_reports_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "team_messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_message_reports_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"team_messages": {
                  Row: {
                    "author_kind": string,"body": string,"company_id": string,"created_at": string,"hidden": boolean,"id": string,"team_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_kind"?: string,"body": string,"company_id": string,"created_at"?: string,"hidden"?: boolean,"id"?: string,"team_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "author_kind"?: string,"body"?: string,"company_id"?: string,"created_at"?: string,"hidden"?: boolean,"id"?: string,"team_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_messages_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_messages_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"team_rank_state": {
                  Row: {
                    "rank": number,"team_id": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "rank": number,"team_id": string,"week_start": string
                  }
                  Update: {
                    "rank"?: number,"team_id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_rank_state_team_id_fkey"
      columns: ["team_id"]
isOneToOne: true
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_week_proposals": {
                  Row: {
                    "created_at": string,"kind": string,"team_id": string,"user_id": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"kind": string,"team_id": string,"user_id": string,"week_start": string
                  }
                  Update: {
                    "created_at"?: string,"kind"?: string,"team_id"?: string,"user_id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_week_proposals_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_week_proposals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"team_week_votes": {
                  Row: {
                    "choice": string,"created_at": string,"team_id": string,"user_id": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "choice": string,"created_at"?: string,"team_id": string,"user_id": string,"week_start": string
                  }
                  Update: {
                    "choice"?: string,"created_at"?: string,"team_id"?: string,"user_id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_week_votes_team_id_week_start_fkey"
      columns: ["team_id","week_start"]
isOneToOne: false
      referencedRelation: "team_weeks"
      referencedColumns: ["team_id","week_start"]
    },{
      foreignKeyName: "team_week_votes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"team_weeks": {
                  Row: {
                    "chosen": string | null,"options": (string)[],"target": number | null,"team_id": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chosen"?: string | null,"options": (string)[],"target"?: number | null,"team_id": string,"week_start": string
                  }
                  Update: {
                    "chosen"?: string | null,"options"?: (string)[],"target"?: number | null,"team_id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_weeks_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "company_id": string,"goal_kg": number | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"goal_kg"?: number | null,"id"?: string,"name": string
                  }
                  Update: {
                    "company_id"?: string,"goal_kg"?: number | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"user_challenges": {
                  Row: {
                    "abandoned_at": string | null,"company_id": string,"created_at": string,"done_at": string | null,"ends_on": string,"id": string,"inspired_by": string | null,"shared_done_at": string | null,"shared_start_at": string | null,"starts_on": string,"status": string,"target": number,"template_id": string,"user_id": string,"variant": string
                  }
                  ComputedFields: never
                  Insert: {
                    "abandoned_at"?: string | null,"company_id": string,"created_at"?: string,"done_at"?: string | null,"ends_on": string,"id"?: string,"inspired_by"?: string | null,"shared_done_at"?: string | null,"shared_start_at"?: string | null,"starts_on"?: string,"status"?: string,"target": number,"template_id": string,"user_id": string,"variant"?: string
                  }
                  Update: {
                    "abandoned_at"?: string | null,"company_id"?: string,"created_at"?: string,"done_at"?: string | null,"ends_on"?: string,"id"?: string,"inspired_by"?: string | null,"shared_done_at"?: string | null,"shared_start_at"?: string | null,"starts_on"?: string,"status"?: string,"target"?: number,"template_id"?: string,"user_id"?: string,"variant"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_challenges_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_challenges_inspired_by_fkey"
      columns: ["inspired_by"]
isOneToOne: false
      referencedRelation: "validations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_challenges_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "challenge_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_challenges_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_plans": {
                  Row: {
                    "company_id": string,"created_at": string,"items": NonNullable<Json>,"prompt_version": string | null,"source": string,"user_id": string,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"items": NonNullable<Json>,"prompt_version"?: string | null,"source": string,"user_id": string,"week_start": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"items"?: NonNullable<Json>,"prompt_version"?: string | null,"source"?: string,"user_id"?: string,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_plans_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_plans_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"validations": {
                  Row: {
                    "caption": string | null,"challenge_id": string | null,"company_id": string,"created_at": string,"day": string,"id": string,"kg": number,"points": number,"proof_level": number,"proof_photo_path": string | null,"proof_status": string,"receipt_path": string | null,"status": string,"team_id": string | null,"template_id": string,"units": number,"user_id": string,"variant": string,"visibility": string,"witness_id": string | null,"witness_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"challenge_id"?: string | null,"company_id": string,"created_at"?: string,"day"?: string,"id"?: string,"kg": number,"points": number,"proof_level": number,"proof_photo_path"?: string | null,"proof_status"?: string,"receipt_path"?: string | null,"status"?: string,"team_id"?: string | null,"template_id": string,"units": number,"user_id": string,"variant": string,"visibility": string,"witness_id"?: string | null,"witness_status"?: string
                  }
                  Update: {
                    "caption"?: string | null,"challenge_id"?: string | null,"company_id"?: string,"created_at"?: string,"day"?: string,"id"?: string,"kg"?: number,"points"?: number,"proof_level"?: number,"proof_photo_path"?: string | null,"proof_status"?: string,"receipt_path"?: string | null,"status"?: string,"team_id"?: string | null,"template_id"?: string,"units"?: number,"user_id"?: string,"variant"?: string,"visibility"?: string,"witness_id"?: string | null,"witness_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "validations_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "user_challenges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "validations_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "validations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "validations_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "challenge_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "validations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "validations_witness_id_fkey"
      columns: ["witness_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "active_days":
{ Args: { "p_user": string }; Returns: string[]
                           },
"admin_add_teams":
{ Args: { "p_company": string,"p_teams": (string)[] }; Returns: number
                           },
"admin_ai_consume":
{ Args: { "p_company": string,"p_limit": number,"p_task": string }; Returns: boolean
                           },
"admin_ai_log":
{ Args: { "p_cache_read_tokens"?: number,"p_company": string,"p_cost_usd"?: number,"p_error_code"?: string,"p_input_tokens"?: number,"p_latency_ms"?: number,"p_model": string,"p_output_tokens"?: number,"p_prompt_version": string,"p_status": string,"p_task": string }; Returns: undefined
                           },
"admin_dashboard":
{ Args: { "p_company": string }; Returns: Json
                           },
"admin_mobility_csv":
{ Args: { "p_company": string,"p_from": string,"p_to": string }; Returns: {
              "kg_avoided": number,"km": number,"mode": string,"month": string,"people": number,"trips": number
            }[]
                           },
"admin_report_data":
{ Args: { "p_company": string,"p_month": string }; Returns: Json
                           },
"admin_save_report":
{ Args: { "p_company": string,"p_content": Json,"p_month": string,"p_source": string,"p_version": string }; Returns: undefined
                           },
"ai_cache_get":
{ Args: { "p_key": string }; Returns: Json
                           },
"ai_cache_put":
{ Args: { "p_key": string,"p_output": Json,"p_task": string,"p_ttl_hours"?: number }; Returns: undefined
                           },
"ai_consume":
{ Args: { "p_org_limit": number,"p_task": string,"p_user_limit": number }; Returns: boolean
                           },
"ai_log":
{ Args: { "p_cache_read_tokens"?: number,"p_company"?: string,"p_cost_usd"?: number,"p_error_code"?: string,"p_input_tokens"?: number,"p_latency_ms"?: number,"p_model": string,"p_output_tokens"?: number,"p_prompt_version": string,"p_status": string,"p_task": string,"p_token"?: string }; Returns: undefined
                           },
"ai_log_service":
{ Args: { "p_cache_read_tokens"?: number,"p_company": string,"p_cost_usd"?: number,"p_error_code"?: string,"p_input_tokens"?: number,"p_latency_ms"?: number,"p_model": string,"p_output_tokens"?: number,"p_prompt_version": string,"p_status": string,"p_task": string }; Returns: undefined
                           },
"alerts_due":
{ Args: { "p_token": string }; Returns: {
              "endpoint": string,"user_id": string
            }[]
                           },
"alerts_due_at":
{ Args: { "p_now": string,"p_token": string }; Returns: {
              "endpoint": string,"user_id": string
            }[]
                           },
"alerts_pushed":
{ Args: { "p_gone": (string)[],"p_token": string,"p_users": (string)[] }; Returns: undefined
                           },
"animator_due":
{ Args: { "p_now"?: string,"p_token": string }; Returns: {
              "company_id": string,"context": Json,"ref": string,"slot": string,"team_id": string
            }[]
                           },
"animator_post":
{ Args: { "p_body": string,"p_meta"?: Json,"p_now"?: string,"p_ref": string,"p_slot": string,"p_team": string,"p_token": string }; Returns: boolean
                           },
"anonymize_text":
{ Args: { "p_names": (string)[],"p_text": string }; Returns: string
                           },
"answer_duel":
{ Args: { "p_accept": boolean,"p_duel": string }; Returns: {
              "challenge_id": string | null,
"challenger": string,
"company_id": string,
"created_at": string,
"ends_on": string | null,
"id": string,
"kind": string,
"opponent": string,
"stakes": boolean,
"starts_on": string | null,
"status": string,
"target": number,
"template_id": string | null,
"variant": string | null,
"winner": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "duels"
        isOneToOne: true
        isSetofReturn: false
      } },
"answer_quiz":
{ Args: { "p_choice": number,"p_question": number }; Returns: Json
                           },
"answer_week_quiz":
{ Args: { "p_choice": number,"p_question": number }; Returns: Json
                           },
"apply_penalty":
{ Args: { "p_company": string,"p_points": number,"p_ref": string,"p_user": string }; Returns: number
                           },
"avoided_kg":
{ Args: { "h": Omit<Database["public"]['Tables']["habits"]['Row'], Database["public"]['Tables']["habits"]['ComputedFields']>,"p_quantity": number,"p_template": string,"p_variant": string }; Returns: number
                           },
"challenge_duel":
{ Args: { "p_kind": string,"p_opponent": string,"p_target"?: number }; Returns: {
              "challenge_id": string | null,
"challenger": string,
"company_id": string,
"created_at": string,
"ends_on": string | null,
"id": string,
"kind": string,
"opponent": string,
"stakes": boolean,
"starts_on": string | null,
"status": string,
"target": number,
"template_id": string | null,
"variant": string | null,
"winner": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "duels"
        isOneToOne: true
        isSetofReturn: false
      } },
"challenge_duel_action":
{ Args: { "p_challenge": string,"p_opponent": string }; Returns: {
              "challenge_id": string | null,
"challenger": string,
"company_id": string,
"created_at": string,
"ends_on": string | null,
"id": string,
"kind": string,
"opponent": string,
"stakes": boolean,
"starts_on": string | null,
"status": string,
"target": number,
"template_id": string | null,
"variant": string | null,
"winner": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "duels"
        isOneToOne: true
        isSetofReturn: false
      } },
"check_duel_opponent":
{ Args: { "me": Omit<Database["public"]['Tables']["profiles"]['Row'], Database["public"]['Tables']["profiles"]['ComputedFields']>,"p_opponent": string }; Returns: undefined
                           },
"claim_daily_rewards":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"collective_goal":
{ Args: Record<PropertyKey, never>; Returns: {
              "ends_on": string,"goal_kg": number,"kg": number,"name": string,"participants": number
            }[]
                           },
"company_by_code":
{ Args: { "p_code": string }; Returns: Json
                           },
"company_challenge_feed":
{ Args: { "p_team_only"?: boolean }; Returns: {
              "at": string,"display_name": string,"done": number,"duel_with": string,"ends_on": string,"event": string,"id": string,"status": string,"target": number,"team_name": string,"template_id": string,"user_id": string,"variant": string
            }[]
                           },
"company_pulse":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"company_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "kg": number,"participants": number
            }[]
                           },
"create_organization":
{ Args: { "p_email_domain": string,"p_name": string,"p_teams": (string)[] }; Returns: Json
                           },
"cron_key_named":
{ Args: { "p_name": string,"p_token": string }; Returns: boolean
                           },
"cron_key_ok":
{ Args: { "p_token": string }; Returns: boolean
                           },
"cron_key_valid":
{ Args: { "p_name": string,"p_token": string }; Returns: boolean
                           },
"day_streak":
{ Args: { "p_user": string }; Returns: {
              "started_on": string,"streak": number
            }[]
                           },
"dearmor":
{ Args: { "": string }; Returns: string
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"duel_count":
{ Args: { "p_from": string,"p_kind": string,"p_to": string,"p_user": string }; Returns: number
                           },
"duel_feasible":
{ Args: { "d": Omit<Database["public"]['Tables']["duels"]['Row'], Database["public"]['Tables']["duels"]['ComputedFields']>,"p_user": string }; Returns: boolean
                           },
"duel_progress":
{ Args: { "d": Omit<Database["public"]['Tables']["duels"]['Row'], Database["public"]['Tables']["duels"]['ComputedFields']>,"p_user": string }; Returns: number
                           },
"ef":
{ Args: { "p_slug": string }; Returns: number
                           },
"effective_quantity":
{ Args: { "h": Omit<Database["public"]['Tables']["habits"]['Row'], Database["public"]['Tables']["habits"]['ComputedFields']>,"p_quantity": number,"p_template": string,"p_variant": string }; Returns: number
                           },
"garden":
{ Args: { "p_user": string }; Returns: Json
                           },
"gen_random_uuid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_salt":
{ Args: { "": string }; Returns: string
                           },
"goal_count":
{ Args: { "p_company": string,"p_from": string,"p_kind": string,"p_to": string,"p_user": string }; Returns: number
                           },
"grade_rank":
{ Args: { "g": string }; Returns: number
                           },
"is_habit_action":
{ Args: { "p_template": string }; Returns: boolean
                           },
"is_org_admin":
{ Args: { "p_company": string }; Returns: boolean
                           },
"join_company":
{ Args: { "p_code": string,"p_consent_feedback": boolean,"p_consent_team_stats": boolean,"p_display_name": string,"p_team": string }; Returns: undefined
                           },
"keep_habit":
{ Args: { "p_habit": string }; Returns: {
              "company_id": string,
"created_at": string,
"habit": string,
"id": string,
"user_id": string,
"week_start": string
            }
                          SetofOptions: {
        from: "*"
        to: "habit_checkins"
        isOneToOne: true
        isSetofReturn: false
      } },
"kept_habits":
{ Args: { "h": Omit<Database["public"]['Tables']["habits"]['Row'], Database["public"]['Tables']["habits"]['ComputedFields']> }; Returns: (string)[]
                           },
"log_action":
{ Args: { "p_quantity"?: number,"p_receipt"?: string,"p_template": string,"p_variant"?: string }; Returns: Json
                           },
"log_action_slug":
{ Args: { "p_action": string,"p_quantity"?: number,"p_receipt"?: string }; Returns: Json
                           },
"mark_alerts_seen":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"member_points":
{ Args: { "p_since": string,"p_user": string }; Returns: number
                           },
"my_admin_organizations":
{ Args: Record<PropertyKey, never>; Returns: {
              "company_id": string,"email_domain": string,"join_code": string,"name": string,"participants": number,"teams": Json
            }[]
                           },
"my_company_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_day_streak":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"my_duels":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_influence":
{ Args: Record<PropertyKey, never>; Returns: {
              "challenges": number,"colleagues": number,"kg": number
            }[]
                           },
"my_latest_alert":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_plan_inputs":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_reminder":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_team_week":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_team_week_at":
{ Args: { "p_now": string }; Returns: Json
                           },
"my_weekly_goal":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"notify":
{ Args: { "p_body": string,"p_kind": string,"p_ref": string,"p_title": string,"p_url": string,"p_user": string }; Returns: undefined
                           },
"open_seed":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"open_seed_roll":
{ Args: { "p_roll": number,"p_user": string }; Returns: Json
                           },
"pgp_armor_headers":
{ Args: { "": string }; Returns: Record<string, unknown>[]
                           },
"plan_pending":
{ Args: { "p_limit"?: number,"p_token": string }; Returns: {
              "active_recently": boolean,"company_id": string,"feasibility": Json,"habits": Json,"stats": Json,"user_id": string
            }[]
                           },
"plan_validate":
{ Args: { "p_items": Json }; Returns: Json
                           },
"plan_week_stats":
{ Args: { "p_user": string }; Returns: Json
                           },
"post_team_message":
{ Args: { "p_body": string }; Returns: {
              "author_kind": string,
"body": string,
"company_id": string,
"created_at": string,
"hidden": boolean,
"id": string,
"team_id": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "team_messages"
        isOneToOne: true
        isSetofReturn: false
      } },
"poste_of":
{ Args: { "p_category": string }; Returns: string
                           },
"propose_team_challenge":
{ Args: { "p_kind": string }; Returns: string
                           },
"publish_action":
{ Args: { "p_caption"?: string,"p_photo_path"?: string,"p_validation": string }; Returns: {
              "caption": string | null,
"challenge_id": string | null,
"company_id": string,
"created_at": string,
"day": string,
"id": string,
"kg": number,
"points": number,
"proof_level": number,
"proof_photo_path": string | null,
"proof_status": string,
"receipt_path": string | null,
"status": string,
"team_id": string | null,
"template_id": string,
"units": number,
"user_id": string,
"variant": string,
"visibility": string,
"witness_id": string | null,
"witness_status": string
            }
                          SetofOptions: {
        from: "*"
        to: "validations"
        isOneToOne: true
        isSetofReturn: false
      } },
"quest_done":
{ Args: { "p_quest": string,"p_user": string }; Returns: boolean
                           },
"quiz_day_ids":
{ Args: { "d": string }; Returns: (number)[]
                           },
"quiz_week_insert":
{ Args: { "p_questions": Json,"p_token": string,"p_version": string,"p_week": string }; Returns: number
                           },
"record_proof_verdict":
{ Args: { "p_model": string,"p_reason": string,"p_validation": string,"p_verdict": string,"p_version": string }; Returns: Json
                           },
"record_swap":
{ Args: { "p_from_co2": number,"p_from_code": string,"p_from_grade": string,"p_to_co2": number,"p_to_code": string,"p_to_grade": string }; Returns: Json
                           },
"reminders_due":
{ Args: { "p_token": string }; Returns: {
              "endpoint": string,"streak": number
            }[]
                           },
"reminders_sent":
{ Args: { "p_gone": (string)[],"p_sent": (string)[],"p_token": string }; Returns: undefined
                           },
"report_team_message":
{ Args: { "p_message": string }; Returns: undefined
                           },
"respond_witness":
{ Args: { "p_confirm": boolean,"p_validation": string }; Returns: undefined
                           },
"resubmit_proof":
{ Args: { "p_receipt": string,"p_validation": string }; Returns: undefined
                           },
"save_my_plan":
{ Args: { "p_items": Json,"p_source": string,"p_version"?: string }; Returns: undefined
                           },
"save_plan_for":
{ Args: { "p_items": Json,"p_source": string,"p_token": string,"p_user": string,"p_version"?: string }; Returns: undefined
                           },
"set_feasibility":
{ Args: { "p_level": string,"p_template": string }; Returns: undefined
                           },
"settle_duels":
{ Args: { "p_user": string }; Returns: undefined
                           },
"settle_team_week":
{ Args: { "p_now": string,"p_team": string,"p_week": string }; Returns: {
              "chosen": string | null,
"options": (string)[],
"target": number | null,
"team_id": string,
"week_start": string
            }
                          SetofOptions: {
        from: "*"
        to: "team_weeks"
        isOneToOne: true
        isSetofReturn: false
      } },
"share_challenge":
{ Args: { "p_challenge": string,"p_event": string }; Returns: undefined
                           },
"team_kind_count":
{ Args: { "p_from": string,"p_kind": string,"p_team": string,"p_to": string,"p_user": string }; Returns: number
                           },
"team_kind_label":
{ Args: { "p_kind": string }; Returns: string
                           },
"team_kind_per_member":
{ Args: { "p_kind": string }; Returns: number
                           },
"team_rank":
{ Args: { "p_since": string,"p_team": string }; Returns: Json
                           },
"team_scores":
{ Args: { "p_company": string,"p_since": string }; Returns: {
              "active": number,"kg": number,"members": number,"points": number,"score": number,"team_id": string,"team_name": string
            }[]
                           },
"team_stats":
{ Args: { "p_since"?: string }; Returns: {
              "active": number,"is_mine": boolean,"kg": number,"participants": number,"points": number,"points_per_person": number,"team_name": string
            }[]
                           },
"team_week_kg":
{ Args: { "p_from": string,"p_team": string,"p_to": string }; Returns: number
                           },
"tick":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"tick_at":
{ Args: { "p_now": string }; Returns: Json
                           },
"today_quiz":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"todays_quests":
{ Args: { "p_user": string }; Returns: (string)[]
                           },
"unaccent_fr":
{ Args: { "t": string }; Returns: string
                           },
"unit_kg":
{ Args: { "h": Omit<Database["public"]['Tables']["habits"]['Row'], Database["public"]['Tables']["habits"]['ComputedFields']>,"p_template": string,"p_variant": string }; Returns: number
                           },
"validate_challenge_day":
{ Args: { "p_caption"?: string,"p_challenge": string,"p_photo_path"?: string,"p_units": number,"p_visibility"?: string,"p_witness"?: string }; Returns: {
              "caption": string | null,
"challenge_id": string | null,
"company_id": string,
"created_at": string,
"day": string,
"id": string,
"kg": number,
"points": number,
"proof_level": number,
"proof_photo_path": string | null,
"proof_status": string,
"receipt_path": string | null,
"status": string,
"team_id": string | null,
"template_id": string,
"units": number,
"user_id": string,
"variant": string,
"visibility": string,
"witness_id": string | null,
"witness_status": string
            }
                          SetofOptions: {
        from: "*"
        to: "validations"
        isOneToOne: true
        isSetofReturn: false
      } },
"vote_team_week":
{ Args: { "p_choice": string }; Returns: Json
                           },
"vote_team_week_at":
{ Args: { "p_choice": string,"p_now": string }; Returns: Json
                           },
"week_quiz":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"weekly_cap":
{ Args: { "h": Omit<Database["public"]['Tables']["habits"]['Row'], Database["public"]['Tables']["habits"]['ComputedFields']>,"p_template": string }; Returns: number
                           },
"weekly_goal_kind":
{ Args: { "p_company": string,"p_week": string }; Returns: string
                           },
"weekly_goal_target":
{ Args: { "p_kind": string,"p_participants": number }; Returns: number
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
