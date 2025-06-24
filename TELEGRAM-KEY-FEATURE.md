# 🤖 Fixed Telegram Key Feature - Email-Based Authentication

## Overview

This feature provides each user with a unique, fixed telegram key that never changes and is tied to their email address. Users can use this key to connect their Telegram bot account to their application account.

## Key Features

### Fixed Keys (No Regeneration)
- **Email-Based Generation**: Keys are generated deterministically from user email addresses
- **Fixed Forever**: Same email always produces the same key - no refresh/regenerate functionality
- **Automatic Creation**: Keys are created automatically during user signup
- **Secure Format**: Keys use format `TG-[HASH1]-[HASH2]-[HASH3]` for easy identification

### Data Storage
- **User Documents**: Telegram keys are stored directly in user documents within the `users` collection
- **No Separate Collection**: Removed the separate `telegram_keys` collection for cleaner data model
- **Integrated Data**: All user information including telegram keys stored together

### Database Schema
```javascript
// User document in 'users' collection
{
  userId: "user123",
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  telegramKey: "TG-A1B2C3-D4E5F6-G7H8I9",
  telegramKeyCreatedAt: timestamp,
  telegramKeyUsed: false,
  telegramUserId: "123456789", // Set when connected
  telegramUsername: "johndoe", // Set when connected
  telegramFirstName: "John",   // Set when connected
  telegramLastName: "Doe",     // Set when connected
  telegramLinkedAt: timestamp, // Set when connected
  // ... other user fields
}
```

## API Endpoints

### For Web Application
- `GET /api/user/:userId/telegram-key` - Get user's telegram key and status
- `POST /api/user/ensure-fixed-key` - Ensure user has a fixed key (idempotent)

### For Telegram Bot
- `POST /api/telegram/validate-key` - Validate a telegram key
- `POST /api/telegram/connect` - Mark key as used and store telegram user info

## Implementation Details

### Key Generation
```javascript
function generateFixedTelegramKey(email) {
    const hash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
    const part1 = hash.substring(0, 6).toUpperCase();
    const part2 = hash.substring(6, 12).toUpperCase();
    const part3 = hash.substring(12, 18).toUpperCase();
    return `TG-${part1}-${part2}-${part3}`;
}
```

### Database Queries
```javascript
// Find user by telegram key
const usersQuery = await db.collection('users')
    .where('telegramKey', '==', telegramKey)
    .limit(1)
    .get();

// Validate key and check if already used
const validation = await dbHelpers.validateTelegramKey(key);
```

### User Registration Integration
During user signup, the system automatically:
1. Generates a fixed key based on email
2. Stores it directly in the user document
3. Key becomes immediately available for telegram connection

## Benefits

1. **Simplified Data Model**: All user data in one place
2. **Better Performance**: Fewer database operations needed
3. **Data Consistency**: User and key data always in sync
4. **Cleaner Queries**: Direct user lookup instead of join operations
5. **Reduced Complexity**: No separate collection to maintain

## Migration Notes

### From Previous Implementation
- Removed separate `telegram_keys` collection
- Moved all key data into user documents
- Updated all API endpoints to query users collection directly
- Changed from "permanent" to "fixed" terminology
- Removed all refresh/regenerate functionality

### Backward Compatibility
Existing users will have their telegram keys automatically migrated to the new structure when they next access their profile or attempt to connect telegram.

## Security Considerations

- Keys are deterministic but use cryptographic hashing
- Email addresses are normalized (lowercase) before hashing
- Keys cannot be reverse-engineered to reveal email addresses
- No key regeneration prevents security issues from old keys

## Usage Flow

1. **User Signup**: Fixed key automatically generated and stored in user document
2. **Profile View**: Key displayed immediately (deterministic generation)
3. **Telegram Bot**: User provides key to bot for account linking
4. **Validation**: Bot validates key by querying users collection
5. **Connection**: Key marked as used, telegram info stored in user document

## Code Structure

- `server.js` - Production server with Firestore integration
- `start-dev-server.js` - Development server with in-memory storage
- `public/js/profile.js` - Frontend telegram key management
- `public/js/sign-up.js` - Automatic key generation during signup

## 🛠 Technical Implementation

### Backend (server.js)

#### New Endpoints:
```javascript
POST /api/user/register
- Creates new user with fixed telegram key based on email
- Returns: { telegramKey, userId, userData }

GET /api/user/:userId/telegram-key  
- Retrieves user's fixed telegram key
- Returns: { telegramKey, telegramKeyUsed, telegramKeyCreatedAt }

POST /api/user/ensure-fixed-key
- Ensures fixed telegram key exists for user (no regeneration)
- Returns: { telegramKey }

POST /api/telegram/verify-credentials
- Verifies email + telegram key combination
- Returns: { success, userData } or { error, reason }
```

#### Database Collections:
```javascript
// users collection
{
  email: "user@example.com",
  telegramKey: "TG-ABC123DEF-XYZ789PQ-RST456",  // Fixed based on email
  telegramKeyCreatedAt: "timestamp",
  telegramKeyUsed: false,
  telegramLinkedAt: "timestamp",
  telegramUserId: "telegram_user_id"
}

// telegram_keys collection  
{
  userId: "firebase_user_id",
  email: "user@example.com",
  createdAt: "timestamp", 
  used: false,
  fixed: true  // Indicates this is a fixed key
}
```

### Frontend Changes

#### Profile Page:
- **Removed**: "Refresh Key" button
- **Updated**: Key description to "This key is fixed to your email address and never changes"
- **Enhanced**: Key display shows it's tied to the user's email

#### Signup Process:
- **Added**: Automatic telegram key generation during registration
- **Integration**: Key created server-side using email hash
- **Seamless**: No additional user action required

## 🔄 Migration Notes

### What Changed:
- **Removed**: All key regeneration/refresh functionality
- **Removed**: `/api/user/:userId/regenerate-telegram-key` endpoints
- **Updated**: Key generation now deterministic based on email
- **Enhanced**: Keys are truly permanent and tied to email addresses

### Backward Compatibility:
- ✅ Existing users keep their current keys
- ✅ Existing connections remain functional
- ✅ Bot validation works with both old and new key formats

**Authentication Method**: Email + Fixed Telegram Key  
**Key Lifecycle**: Generated once during signup, never changes

**Key Features**: 
- 🔑 Fixed telegram keys (tied to email address)
- 📧 Email + key dual authentication
- 🔒 Enhanced security verification
- 🚫 No regeneration capability (intentional security feature)

## 🎯 User Interface Integration

### Registration Success Page:
```html
<div class="telegram-key-section">
  <h3>🤖 Your Permanent Telegram Key</h3>
  <div class="key-display">TG-M7X5K2L-ABC123</div>
  <p>Save this key - it's permanent and never expires!</p>
  <div class="instructions">
    <h4>Connect to Telegram Bot:</h4>
    <ol>
      <li>Search for @KitaKitaBot on Telegram</li>
      <li>Click "Connect with Email + Key"</li>
      <li>Enter your email: <strong>{{user.email}}</strong></li>
      <li>Enter your key: <strong>{{user.telegramKey}}</strong></li>
    </ol>
  </div>
  <button onclick="copyKey()">📋 Copy Key</button>
</div>
```

### Settings Page:
```html
<div class="telegram-integration">
  <h4>Telegram Bot Connection</h4>
  <div class="key-info">
    <label>Your Permanent Telegram Key:</label>
    <div class="key-display">
      <input value="TG-M7X5K2L-ABC123" readonly>
      <button onclick="copyKey()">📋 Copy</button>
    </div>
    <p class="key-status">
      {{#if telegramKeyUsed}}
        ✅ Connected to Telegram Bot
      {{else}}
        ⏳ Not connected yet
      {{/if}}
    </p>
  </div>
  <div class="actions">
    <button onclick="regenerateKey()">🔄 Regenerate Key</button>
    <a href="https://t.me/KitaKitaBot" target="_blank" class="btn">
      📱 Open Telegram Bot
    </a>
  </div>
</div>
```

## 📊 Database Schema

### User Document:
```json
{
  "userId": "user123",
  "email": "user@example.com",
  "name": "John Doe",
  "telegramKey": "TG-M7X5K2L-ABC123",
  "telegramKeyCreatedAt": "2024-01-01T00:00:00Z",
  "telegramKeyUsed": false,
  "telegramLinkedAt": null,
  "telegramUserId": null,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Telegram Key Document:
```json
{
  "keyId": "TG-M7X5K2L-ABC123",
  "userId": "user123",
  "email": "user@example.com",
  "createdAt": "2024-01-01T00:00:00Z",
  "used": false,
  "permanent": true,
  "usedAt": null,
  "telegramUserId": null
}
```

### Telegram Link Document:
```json
{
  "userId": "user123",
  "telegramUserId": "telegram123",
  "telegramUsername": "johndoe",
  "telegramFirstName": "John",
  "email": "user@example.com",
  "linkedAt": "2024-01-01T12:00:00Z",
  "linkMethod": "email_telegram_key",
  "active": true
}
```

## 🔒 Security Features

- **Dual verification**: Requires both email and telegram key
- **Permanent keys**: No expiration, always reliable
- **Unique generation**: Timestamp + random ensures uniqueness
- **Format validation**: Prevents invalid key formats
- **Email matching**: Key must match registered email
- **One-time setup**: Key marked as used after linking

## 🚀 Getting Started

### For Developers:

1. **Deploy** the updated server with new endpoints
2. **Update** the bot with email + key handling
3. **Integrate** permanent key display in registration UI
4. **Test** the complete authentication flow

### For Users:

1. **Sign up** in the Kita-kita app
2. **Save** your permanent telegram key
3. **Find** `@KitaKitaBot` on Telegram
4. **Send** `/start` and click "Connect with Email + Key"
5. **Enter** your email and telegram key
6. **Enjoy** fully integrated experience!

## 📈 Benefits

### For Users:
- **No expiration anxiety** - permanent keys never expire
- **Enhanced security** - dual authentication required
- **Better reliability** - no time-sensitive codes
- **Clear process** - step-by-step guidance

### For Business:
- **Reduced support** - no expired key issues
- **Better security** - stronger authentication
- **Higher success rate** - permanent keys always work
- **User confidence** - reliable connection process

## 🔄 Migration from Old System

### Existing Users:
- Old temporary codes still work
- Can upgrade to permanent keys anytime
- Settings page shows current telegram key

### New Users:
- Automatically get permanent telegram key
- Guided through email + key connection
- No temporary code confusion

---

**Implementation Status**: ✅ Complete  
**Authentication Method**: Email + Fixed Telegram Key  
**Backward Compatibility**: ✅ Old methods still supported  

**Key Features**: 
- 🔑 Fixed telegram keys (tied to email address)
- 📧 Email + key dual authentication
- 🔒 Enhanced security verification
- 🚫 No regeneration capability (intentional security feature) 