# Configuration du domaine Facebook/Instagram

## Problème : "Le domaine de cette URL n'est pas inscrit dans ceux de l'application"

Cette erreur apparaît car Facebook/Meta doit autoriser votre domaine ngrok avant de pouvoir l'utiliser pour OAuth.

## Solution : Ajouter le domaine dans Facebook Developer Console

### Étape 1 : Aller dans Settings > Basic

1. Ouvrez https://developers.facebook.com/apps
2. Sélectionnez votre application (celle avec l'App ID : `2107667860071428`)
3. Dans le menu de gauche, cliquez sur **Settings** puis **Basic**

### Étape 2 : Ajouter le domaine dans "App Domains"

1. Trouvez la section **"App Domains"**
2. Cliquez sur **"Add Domain"**
3. Ajoutez le domaine ngrok (sans `https://`) :
   ```
   kimberly-quintessential-thuy.ngrok-free.dev
   ```
4. Cliquez sur **"Save Changes"**

### Étape 3 : Configurer Facebook Login Settings

1. Dans le menu de gauche, cliquez sur **Products** > **Facebook Login** > **Settings**
2. Dans la section **"Valid OAuth Redirect URIs"**, ajoutez :
   ```
   https://kimberly-quintessential-thuy.ngrok-free.dev/api/auth/instagram/callback
   ```
3. Dans **"Site URL"**, ajoutez :
   ```
   https://kimberly-quintessential-thuy.ngrok-free.dev
   ```
4. Cliquez sur **"Save Changes"**

### Étape 4 : Configurer Instagram Graph API (si applicable)

1. Dans le menu de gauche, cliquez sur **Products** > **Instagram** > **Basic Display**
   (ou **Instagram Graph API** selon votre configuration)
2. Dans **"Valid OAuth Redirect URIs"**, ajoutez :
   ```
   https://kimberly-quintessential-thuy.ngrok-free.dev/api/auth/instagram/callback
   ```
3. Cliquez sur **"Save Changes"**

## Configuration complète résumée

Dans **Facebook Developer Console**, configurez :

### Settings > Basic
- **App Domains** : `kimberly-quintessential-thuy.ngrok-free.dev`

### Facebook Login > Settings
- **Site URL** : `https://kimberly-quintessential-thuy.ngrok-free.dev`
- **Valid OAuth Redirect URIs** : `https://kimberly-quintessential-thuy.ngrok-free.dev/api/auth/instagram/callback`

### Instagram (si configuré)
- **Valid OAuth Redirect URIs** : `https://kimberly-quintessential-thuy.ngrok-free.dev/api/auth/instagram/callback`

## Points importants

1. ⚠️ **Pas de `https://` dans App Domains** : juste le domaine
2. ⚠️ **Avec `https://` dans Valid OAuth Redirect URIs** : l'URL complète
3. ⚠️ **Attendre quelques minutes** après avoir sauvegardé pour que les changements prennent effet
4. ⚠️ **Si votre URL ngrok change**, vous devrez mettre à jour ces paramètres avec la nouvelle URL

## Si l'erreur persiste

1. Vérifiez que vous avez bien sauvegardé toutes les modifications
2. Attendez 2-3 minutes pour que Facebook synchronise les changements
3. Effacez les cookies de Facebook dans votre navigateur
4. Réessayez la connexion Instagram
5. Si ça ne marche toujours pas, vérifiez que vous êtes bien connecté avec un compte qui a les droits administrateur sur l'application Facebook

## Pour la production (Vercel)

Quand vous déployez sur Vercel, vous devrez aussi ajouter votre domaine de production dans ces mêmes paramètres :
- App Domains : `votre-domaine.vercel.app`
- Site URL : `https://votre-domaine.vercel.app`
- Valid OAuth Redirect URIs : `https://votre-domaine.vercel.app/api/auth/instagram/callback`
