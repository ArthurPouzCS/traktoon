# Configuration du fichier .env.local

Créez un fichier `.env.local` à la racine du projet `traktoon-app/` avec le contenu suivant :

## Contenu du fichier .env.local

```env
# Base URL de l'application
# En local avec ngrok : https://votre-url-ngrok.ngrok-free.dev
# En production Vercel : https://votre-domaine.vercel.app (optionnel, détecté automatiquement)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key

# Reddit OAuth (optionnel)
REDDIT_CLIENT_ID=votre_client_id_reddit
REDDIT_CLIENT_SECRET=votre_client_secret_reddit
REDDIT_USER_AGENT=Traktoon/1.0 by u/votre_username_reddit

# Instagram OAuth (via Facebook/Meta) - OBLIGATOIRE
# Récupérer ces valeurs depuis https://developers.facebook.com/apps
# 1. Créer une app Facebook sur https://developers.facebook.com/apps
# 2. Aller dans Settings > Basic
# 3. Copier l'App ID et l'App Secret
INSTAGRAM_APP_ID=votre_facebook_app_id
INSTAGRAM_APP_SECRET=votre_facebook_app_secret

# Ou utiliser les noms Facebook (compatibles)
# FACEBOOK_APP_ID=votre_facebook_app_id
# FACEBOOK_APP_SECRET=votre_facebook_app_secret

# Gemini API (existant)
GEMINI_API_KEY=votre_cle_api_gemini
```

## Exemple avec ngrok en local

```env
# Base URL avec ngrok
NEXT_PUBLIC_BASE_URL=https://kimberly-quintessential-thuy.ngrok-free.dev

# Instagram OAuth
INSTAGRAM_APP_ID=1234567890123456
INSTAGRAM_APP_SECRET=abcdef1234567890abcdef1234567890

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Gemini (si utilisé)
GEMINI_API_KEY=AIzaSy...
```

## Comment obtenir l'INSTAGRAM_APP_ID

1. Aller sur https://developers.facebook.com/apps
2. Cliquer sur "Create App" ou sélectionner une app existante
3. Aller dans **Settings > Basic**
4. Copier **App ID** et **App Secret**
5. Les coller dans `.env.local` comme :
   ```
   INSTAGRAM_APP_ID=votre_app_id_ici
   INSTAGRAM_APP_SECRET=votre_app_secret_ici
   ```

## Redémarrer le serveur

⚠️ **IMPORTANT** : Après avoir créé ou modifié `.env.local`, vous devez redémarrer le serveur Next.js :

```bash
# Arrêter le serveur (Ctrl+C)
# Puis redémarrer
npm run dev
```

## Vérification

Pour vérifier que les variables sont bien chargées, vous pouvez temporairement ajouter un `console.log` dans `/app/api/auth/instagram/initiate/route.ts` :

```typescript
console.log("APP_ID:", process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID);
```

## Erreur "ID d'app non valide"

Si vous obtenez cette erreur, vérifiez :

1. ✅ Le fichier `.env.local` existe à la racine de `traktoon-app/`
2. ✅ Les variables `INSTAGRAM_APP_ID` et `INSTAGRAM_APP_SECRET` sont définies
3. ✅ Vous avez redémarré le serveur Next.js après avoir créé/modifié le fichier
4. ✅ L'App ID correspond bien à une app Facebook valide
5. ✅ L'App Secret est correct (sans espaces, sans guillemets)

## Production (Vercel)

Sur Vercel, ajoutez ces variables dans :
**Settings > Environment Variables**

Les variables sans préfixe `NEXT_PUBLIC_` ne sont accessibles que côté serveur.
Les variables avec préfixe `NEXT_PUBLIC_` sont accessibles côté client.
