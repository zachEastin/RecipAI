export const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT,
  servings INTEGER NOT NULL,
  prep_minutes INTEGER NOT NULL,
  cook_minutes INTEGER NOT NULL,
  rating INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  last_cooked_at TEXT,
  image_url TEXT,
  provenance TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  quantity REAL,
  unit TEXT,
  name TEXT NOT NULL,
  note TEXT,
  grocery_category TEXT NOT NULL DEFAULT 'Other',
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_steps (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  timer_minutes INTEGER,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  prompt TEXT NOT NULL,
  source_recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  structured_response_json TEXT NOT NULL,
  save_status TEXT NOT NULL DEFAULT 'unsaved',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id TEXT PRIMARY KEY,
  plan_date TEXT NOT NULL UNIQUE,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id TEXT PRIMARY KEY,
  shopping_list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  quantity REAL,
  unit TEXT,
  name TEXT NOT NULL,
  grocery_category TEXT NOT NULL DEFAULT 'Other',
  checked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS recipe_search USING fts5(
  recipe_id UNINDEXED,
  title,
  summary,
  tags,
  ingredients
);
`;
