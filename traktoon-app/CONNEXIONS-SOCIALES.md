# Configuration des Connexions Sociales

Ce document explique comment configurer les connexions sociales, notamment Reddit OAuth et Instagram OAuth.

## Prérequis

1. Un projet Supabase configuré
2. Une application Reddit créée sur https://www.reddit.com/prefs/apps (pour Reddit)
3. Une application Meta/Facebook créée sur https://developers.facebook.com/apps (pour Instagram)

## Configuration Supabase

### 1. Créer les tables

Exécuter le script SQL dans `supabase-schema.sql` dans l'éditeur SQL de Supabase :

```sql
-- Le contenu du fichier supabase-schema.sql
```

### 2. Variables d'environnement

Créer un fichier `.env.local` (ou `.env`) avec les variables suivantes :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key

# Base URL de l'application (utilisée pour générer les redirect URIs)
# En local avec ngrok : https://votre-url-ngrok.ngrok-free.dev
# En production Vercel : https://votre-domaine.vercel.app
# Optionnel : sera détectée automatiquement sur Vercel via VERCEL_URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Reddit OAuth
REDDIT_CLIENT_ID=votre_client_id
REDDIT_CLIENT_SECRET=votre_client_secret
# Optionnel : si défini, sera utilisé au lieu de la génération dynamique
# REDDIT_REDIRECT_URI=https://votre-url/api/auth/reddit/callback

# Reddit API
REDDIT_USER_AGENT=Traktoon/1.0 by u/votre_username_reddit

# Instagram OAuth (via Facebook)
INSTAGRAM_APP_ID=votre_facebook_app_id
INSTAGRAM_APP_SECRET=votre_facebook_app_secret
# Optionnel : si défini, sera utilisé au lieu de la génération dynamique
# INSTAGRAM_REDIRECT_URI=https://votre-url/api/auth/instagram/callback

# Ou utiliser les variables Facebook (compatibles)
FACEBOOK_APP_ID=votre_facebook_app_id
FACEBOOK_APP_SECRET=votre_facebook_app_secret
# Optionnel : si défini, sera utilisé au lieu de la génération dynamique
# FACEBOOK_REDIRECT_URI=https://votre-url/api/auth/instagram/callback
```

## Configuration Reddit OAuth

### 1. Créer une application Reddit

1. Aller sur https://www.reddit.com/prefs/apps
2. Cliquer sur "create another app..." ou "create app"
3. Remplir le formulaire :
   - **name** : Le nom de votre application (ex: Traktoon)
   - **type** : Sélectionner "web app"
   - **description** : Description de l'application
   - **about url** : URL de votre site (optionnel)
   - **redirect uri** : Utiliser l'URL générée automatiquement à partir de `NEXT_PUBLIC_BASE_URL` (ex: `https://votre-url/api/auth/reddit/callback`)
4. Noter le **client_id** (sous le nom de l'app, c'est une longue chaîne aléatoire)
5. Noter le **client_secret** (le "secret" affiché, gardez-le confidentiel !)

### 2. Configurer les variables d'environnement

Ajouter les valeurs dans votre fichier `.env.local` :

```env
NEXT_PUBLIC_BASE_URL=https://votre-url-ngrok.ngrok-free.dev  # ou https://votre-domaine.vercel.app en prod
REDDIT_CLIENT_ID=votre_client_id_ici
REDDIT_CLIENT_SECRET=votre_client_secret_ici
REDDIT_USER_AGENT=Traktoon/1.0 by u/votre_username_reddit
```

Le redirect URI sera automatiquement généré : `{NEXT_PUBLIC_BASE_URL}/api/auth/reddit/callback`

**Important** : 
- Le `REDDIT_USER_AGENT` doit suivre le format `AppName/Version by u/username`
- Le `redirect_uri` sera généré automatiquement à partir de `NEXT_PUBLIC_BASE_URL`
- Vous devez configurer exactement le même redirect URI dans les paramètres de votre app Reddit

## Configuration Instagram OAuth

### 1. Créer une application Meta/Facebook

1. Aller sur https://developers.facebook.com/apps
2. Cliquer sur "Create App" et sélectionner "Consumer" ou "Business"
3. Remplir le formulaire avec le nom et l'email de contact
4. Dans le tableau de bord, ajouter les produits :
   - **Facebook Login**
   - **Instagram** (Graph API)
5. Dans **Settings > Basic** :
   - Dans **App Domains**, ajouter votre domaine (sans `https://`) : `kimberly-quintessential-thuy.ngrok-free.dev`
   - ⚠️ **IMPORTANT** : C'est obligatoire pour éviter l'erreur "Le domaine n'est pas inscrit"
6. Dans **Facebook Login > Settings** :
   - Dans **Site URL**, ajouter : `https://kimberly-quintessential-thuy.ngrok-free.dev`
   - Dans **Valid OAuth Redirect URIs**, ajouter : `https://kimberly-quintessential-thuy.ngrok-free.dev/api/auth/instagram/callback`
   - Activer "Instagram Basic Display" si nécessaire
6. Dans **Instagram > Basic Display** (ou Graph API) :
   - Configurer les scopes nécessaires :
     - `instagram_basic`
     - `instagram_content_publish`
     - `pages_show_list`
     - `pages_read_engagement`
7. **IMPORTANT** : Le compte Instagram doit être :
   - Un compte professionnel ou créateur
   - Lié à une Page Facebook
   - L'utilisateur doit être administrateur de la Page

### 2. Noter les identifiants

- **App ID** : visible dans le tableau de bord
- **App Secret** : visible dans Settings > Basic (gardez-le confidentiel !)

### 3. Configurer les variables d'environnement

Ajouter les valeurs dans votre fichier `.env.local` :

```env
NEXT_PUBLIC_BASE_URL=https://votre-url-ngrok.ngrok-free.dev  # ou https://votre-domaine.vercel.app en prod
INSTAGRAM_APP_ID=votre_facebook_app_id
INSTAGRAM_APP_SECRET=votre_facebook_app_secret
```

Le redirect URI sera automatiquement généré : `{NEXT_PUBLIC_BASE_URL}/api/auth/instagram/callback`

**Important** :
- Instagram utilise l'API Facebook/Meta, donc les variables peuvent s'appeler `INSTAGRAM_*` ou `FACEBOOK_*`
- Le `redirect_uri` sera généré automatiquement à partir de `NEXT_PUBLIC_BASE_URL`
- Vous devez configurer exactement le même redirect URI dans Facebook Login
- Le compte Instagram doit être un compte Business/Creator lié à une Page Facebook

## Utilisation

### Frontend

Le composant `ConnectionSocial` est disponible sur la page `/connections`.

Pour y accéder :
1. Cliquer sur le bouton "Connexions" dans le header
2. Cliquer sur "Connecter" pour Reddit ou Instagram
3. Autoriser l'application sur Reddit ou Facebook/Instagram
4. Vous serez redirigé vers `/connections` avec une confirmation

### API - Créer un post Reddit

Exemple d'utilisation de l'API pour créer un post :

```typescript
const response = await fetch('/api/reddit/post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    subreddit: 'test',
    title: 'Mon premier post via Traktoon',
    text: 'Le contenu du post en markdown...',
  }),
});

const data = await response.json();
if (data.success) {
  console.log('Post créé avec succès !', data.post);
}
```

### API - Créer un post Instagram

Exemple d'utilisation de l'API pour créer un post Instagram :

```typescript
const response = await fetch('/api/instagram/post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    image_url: 'https://example.com/image.jpg',
    caption: 'Mon premier post Instagram via Traktoon !',
    media_type: 'IMAGE', // 'IMAGE', 'CAROUSEL_ALBUM', ou 'VIDEO'
  }),
});

const data = await response.json();
if (data.success) {
  console.log('Post Instagram créé avec succès !', data.post);
}
```

**Important pour Instagram** :
- L'URL de l'image doit être accessible publiquement (pas de localhost)
- Le compte Instagram doit être un compte Business/Creator
- L'image doit respecter les formats et tailles Instagram

## Structure des fichiers

- `components/ConnectionSocial.tsx` : Composant principal
- `components/ConnectionSocial.tsx` : Composant principal
- `app/api/auth/reddit/initiate/route.ts` : Route d'initiation OAuth Reddit
- `app/api/auth/reddit/callback/route.ts` : Route de callback OAuth Reddit
- `app/api/reddit/post/route.ts` : Route pour créer un post Reddit
- `app/api/auth/instagram/initiate/route.ts` : Route d'initiation OAuth Instagram
- `app/api/auth/instagram/callback/route.ts` : Route de callback OAuth Instagram
- `app/api/instagram/post/route.ts` : Route pour créer un post Instagram
- `app/api/auth/social/route.ts` : Route pour lister les connexions
- `lib/reddit/` : Utilitaires Reddit (OAuth, client API)
- `lib/instagram/` : Utilitaires Instagram (OAuth, client API)
- `lib/supabase/` : Clients Supabase (server et client)
- `types/social.ts` : Types TypeScript pour les connexions sociales
- `types/reddit.ts` : Types TypeScript pour Reddit (dans lib/reddit/types.ts)
- `types/instagram.ts` : Types TypeScript pour Instagram (dans lib/instagram/types.ts)

## Ajouter des logos

Placer les logos PNG dans le dossier `public/logos/` :

- `reddit.png`
- `twitter.png`
- `instagram.png`
- `linkedin.png`
- `facebook.png`
- `tiktok.png`
- `youtube.png`

Si un logo n'existe pas, le composant affichera la première lettre du nom du réseau social.

## Sécurité

- Les tokens sont stockés de manière sécurisée dans Supabase
- Les credentials (Reddit, Instagram/Facebook) ne doivent jamais être exposés côté client
- Le `REDDIT_CLIENT_SECRET`, `INSTAGRAM_APP_SECRET` et `SUPABASE_SERVICE_ROLE_KEY` doivent rester secrets
- Les routes API vérifient l'authentification utilisateur
- Protection CSRF avec le paramètre `state` dans OAuth

## Notes importantes

### Reddit
- Le User-Agent est obligatoire pour toutes les requêtes Reddit API
- Les tokens expirent après 1 heure (d'où le refresh_token)

### Instagram
- **Instagram Basic Display API est dépréciée** depuis décembre 2024
- Utilisez uniquement **Instagram Graph API** avec un compte Business/Creator
- Le compte Instagram doit être lié à une Page Facebook
- Les tokens long-lived expirent après 60 jours et peuvent être rafraîchis
- La création de posts nécessite le scope `instagram_content_publish`
