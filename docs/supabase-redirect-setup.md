# Fix Supabase Redirect URLs for Localhost

## ✅ Current Configuration
I can see your Supabase configuration already has:
- **Site URL**: `https://NeuraPool.aga.social`
- **Redirect URLs**: 
  - `https://NeuraPool.aga.social`
  - `http://localhost:3000`

## 🔧 Missing URLs for OAuth

You need to add **locale-specific callback URLs** for OAuth providers to work properly:

### Add These URLs to Redirect URLs:

```
http://localhost:3000/en/auth/callback
http://localhost:3000/es/auth/callback
http://localhost:3000/auth/callback
```

### Step-by-Step:

1. **In your Supabase Dashboard** → Authentication → URL Configuration
2. **Click "Add URL"** and add each of the above URLs
3. **Save the changes**

## 🧪 Test the Fix

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Try logging in** - check the browser console for the redirect URLs being used

3. **Test OAuth login** (Google/Apple) - this should now work with localhost

## 🔍 Debugging

If you're still having issues:

1. **Check browser console** when logging in - you should see logs like:
   ```
   Google OAuth redirect: http://localhost:3000/en/auth/callback
   ```

2. **Verify the callback page** works: `http://localhost:3000/en/auth/callback`

3. **Clear browser cache** if redirects are still cached

## 📝 Why This Matters

- **Email/password login** uses the general redirect URLs
- **OAuth login** (Google/Apple) needs the specific callback URLs
- **Locale support** requires separate URLs for `/en/` and `/es/` paths 