# 🔐 Security Setup Guide for Kita-kita AI Banking Platform

## Overview

This guide helps you set up the project with proper security practices to protect sensitive information like API keys.

## 🚨 Important Security Changes

**API keys are no longer hardcoded in the source code!** All sensitive information must be configured properly before development.

## 🛠️ Development Setup

### 1. Quick Setup (Recommended)

```bash
# Run the secure setup script
npm run setup-secure
```

This will:

- Create `public/js/env-loader.js` from the template
- Guide you through adding your API keys
- Explain security best practices

### 2. Manual Setup

If you prefer manual setup:

```bash
# Copy the environment template
cp public/js/env-loader.example.js public/js/env-loader.js

# Edit the file and add your actual API keys
# Replace YOUR_GEMINI_API_KEY_HERE with your actual Gemini API key
# Replace YOUR_FIREBASE_API_KEY_HERE with your actual Firebase API key
# Replace YOUR_FIREBASE_APP_ID_HERE with your actual Firebase App ID
```

### 3. Get Your API Keys

#### Gemini AI API Key

1. Go to [Google AI Studio](https://ai.google.dev/)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key (starts with `AIzaSy...`)

#### Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Go to Project Settings > General
4. Scroll down to "Your apps" section
5. Copy the configuration values:
   - `apiKey`
   - `appId`
   - Other values should match the defaults in the template

## 🔒 Security Features

### What's Protected

- ✅ API keys are not committed to version control
- ✅ `env-loader.js` is gitignored
- ✅ Environment variables for production
- ✅ Secure fallbacks for development
- ✅ Configuration validation

### Files to Never Commit

- `public/js/env-loader.js` (contains your actual API keys)
- `.env` (if using server-side environment variables)
- Any file ending with `.local.js`

### Files Safe to Commit

- ✅ `public/js/env-loader.example.js` (template without keys)
- ✅ `public/js/config.js` (uses environment variables)
- ✅ `env.example` (template without actual values)

## 🚀 Production Deployment

For production deployments, set these environment variables in your hosting platform:

### Required Environment Variables

```bash
GEMINI_API_KEY=your_actual_gemini_api_key
FIREBASE_API_KEY=your_actual_firebase_api_key
FIREBASE_APP_ID=your_actual_firebase_app_id
```

### Optional Environment Variables

```bash
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Platform-Specific Instructions

#### Vercel

1. Go to your project settings
2. Add environment variables in the "Environment Variables" section
3. Deploy your project

#### Netlify

1. Go to Site Settings > Environment Variables
2. Add your environment variables
3. Redeploy your site

#### Firebase Hosting

1. Use Firebase Functions to serve environment variables
2. Set up environment configuration in your CI/CD pipeline

## 🧪 Testing Your Setup

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Open the browser console and check for:

   - ✅ "🔧 Dean Sanitize Config Loaded" message
   - ✅ No API key error messages
   - ✅ Environment detection (development/production)

3. If you see warnings about missing API keys:
   - Edit `public/js/env-loader.js`
   - Add your actual API keys
   - Refresh the page

## 🔄 Team Development

### For New Team Members

1. Clone the repository
2. Run `npm install`
3. Run `npm run setup-secure`
4. Add your own API keys to `env-loader.js`
5. **Never commit the `env-loader.js` file!**

### Sharing API Keys Securely

- Use encrypted communication (Signal, encrypted email)
- Share through your team's password manager
- Use separate development API keys for each developer
- Never share API keys in Slack, Discord, or other plain text

## 🚨 Emergency Procedures

### If API Keys Are Accidentally Committed

1. **Immediately rotate all exposed API keys**
2. Remove the commit from git history:
   ```bash
   git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch public/js/env-loader.js' --prune-empty --tag-name-filter cat -- --all
   ```
3. Force push to all remotes
4. Update all team members

### If You Suspect a Security Breach

1. Immediately revoke and rotate all API keys
2. Check API usage logs for unusual activity
3. Update all team members
4. Consider implementing additional security measures

## 📚 Best Practices

1. **Regular Key Rotation**: Rotate API keys every 3-6 months
2. **Environment Separation**: Use different keys for dev/staging/production
3. **Access Control**: Limit who has access to production keys
4. **Monitoring**: Set up alerts for unusual API usage
5. **Documentation**: Keep this guide updated as the project evolves

## 🆘 Getting Help

If you encounter issues:

1. Check the browser console for error messages
2. Verify your API keys are correctly formatted
3. Ensure `env-loader.js` exists and has the correct values
4. Check that no files are being blocked by `.gitignore`

For additional support, contact the development team or create an issue in the repository.
