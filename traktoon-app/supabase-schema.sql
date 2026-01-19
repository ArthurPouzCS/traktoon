-- Schéma Supabase pour les connexions sociales
-- Exécuter ce script dans l'éditeur SQL de Supabase

-- Table pour stocker les connexions OAuth des utilisateurs
CREATE TABLE IF NOT EXISTS social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'reddit', 'twitter', etc.
  access_token TEXT,
  refresh_token TEXT,
  -- OAuth1 tokens optionnels pour certains providers (par ex. X/Twitter)
  oauth1_access_token TEXT,
  oauth1_access_token_secret TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  provider_user_id VARCHAR(255), -- ID utilisateur sur le réseau social
  provider_username VARCHAR(255), -- Username sur le réseau social
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_social_connections_user_id ON social_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_provider ON social_connections(provider);

-- Table pour stocker les credentials de l'application (optionnel)
-- Peut être remplacé par des variables d'environnement
CREATE TABLE IF NOT EXISTS app_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) UNIQUE NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) pour protéger les données
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_credentials ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour social_connections : les utilisateurs ne peuvent voir/modifier que leurs propres connexions
CREATE POLICY "Users can view their own social connections"
  ON social_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social connections"
  ON social_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social connections"
  ON social_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social connections"
  ON social_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Politique RLS pour app_credentials : seulement le service role peut y accéder
CREATE POLICY "Only service role can access app credentials"
  ON app_credentials FOR ALL
  USING (false); -- Bloqué pour tous, seulement accessible via service role

-- Table pour stocker les plans GTM des utilisateurs
CREATE TABLE IF NOT EXISTS gtm_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  answers JSONB, -- Les réponses aux questions
  plan_data JSONB NOT NULL, -- Le plan complet (GoToMarketPlan)
  detailed_plans JSONB DEFAULT '{}'::jsonb, -- Plans détaillés par channel: { "X": DetailedPlan, "Instagram": DetailedPlan, ... }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_gtm_plans_user_id ON gtm_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_gtm_plans_created_at ON gtm_plans(created_at DESC);

-- RLS pour gtm_plans
ALTER TABLE gtm_plans ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour gtm_plans : les utilisateurs ne peuvent voir/modifier que leurs propres plans
CREATE POLICY "Users can view their own GTM plans"
  ON gtm_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own GTM plans"
  ON gtm_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own GTM plans"
  ON gtm_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own GTM plans"
  ON gtm_plans FOR DELETE
  USING (auth.uid() = user_id);

-- Table pour stocker les posts publiés sur les réseaux sociaux
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'twitter', 'instagram', 'reddit'
  provider_post_id VARCHAR(255) NOT NULL, -- ID du post sur le réseau social
  content TEXT, -- Contenu du post (pour référence)
  media_url TEXT, -- URL de l'image/média si applicable
  plan_id UUID REFERENCES gtm_plans(id) ON DELETE SET NULL, -- Lien optionnel vers le plan GTM
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_post_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_provider ON posts(provider);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_plan_id ON posts(plan_id);

-- RLS pour posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour posts : les utilisateurs ne peuvent voir/modifier que leurs propres posts
CREATE POLICY "Users can view their own posts"
  ON posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);

-- Table pour stocker les métriques des posts (historique)
CREATE TABLE IF NOT EXISTS post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  impressions INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0, -- Pour Twitter/X
  upvotes INTEGER DEFAULT 0, -- Pour Reddit
  downvotes INTEGER DEFAULT 0, -- Pour Reddit
  views INTEGER DEFAULT 0, -- Pour les vidéos
  engagement_rate DECIMAL(10, 4), -- Taux d'engagement calculé
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_post_metrics_post_id ON post_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_metrics_measured_at ON post_metrics(measured_at DESC);

-- RLS pour post_metrics
ALTER TABLE post_metrics ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour post_metrics : les utilisateurs ne peuvent voir que les métriques de leurs propres posts
CREATE POLICY "Users can view metrics of their own posts"
  ON post_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_metrics.post_id
      AND posts.user_id = auth.uid()
    )
  );

-- Politique RLS pour post_metrics : les utilisateurs peuvent insérer des métriques pour leurs propres posts
CREATE POLICY "Users can insert metrics for their own posts"
  ON post_metrics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_metrics.post_id
      AND posts.user_id = auth.uid()
    )
  );