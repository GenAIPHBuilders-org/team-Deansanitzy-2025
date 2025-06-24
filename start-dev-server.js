const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory storage for development
const users = new Map();
const telegramKeys = new Map();

// Simple function to extract email from Firebase token (for development)
function extractEmailFromToken(token) {
    try {
        // Firebase tokens are JWTs. For development, we'll do a simple decode
        const payload = token.split('.')[1];
        if (payload) {
            const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
            return decoded.email || decoded.firebase?.identities?.email?.[0] || null;
        }
    } catch (error) {
        console.log('Error extracting email from token:', error.message);
    }
    return null;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Mock authentication middleware for development
const mockAuth = (req, res, next) => {
    // For development, extract user ID from request or use mock
    const authHeader = req.headers.authorization;
    let userId = 'dev-user-123'; // default
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // Try to decode Firebase token for real user ID
        const token = authHeader.substring(7);
        try {
            // For development, just use a hash of the token as user ID
            const crypto = require('crypto');
            userId = crypto.createHash('md5').update(token).digest('hex').substring(0, 16);
            
            // Store the token for potential email extraction
            req.firebaseToken = token;
        } catch (error) {
            console.log('Could not parse token, using default user ID');
        }
    }
    
    req.user = { uid: userId };
    next();
};

// Development API endpoints
app.get('/api/user/:userId/telegram-key', mockAuth, (req, res) => {
    const userId = req.params.userId;
    const user = users.get(userId);
    
    if (user && user.telegramKey) {
        res.json({
            success: true,
            data: {
                telegramKey: user.telegramKey,
                telegramKeyUsed: user.telegramKeyUsed || false,
                telegramKeyCreatedAt: user.telegramKeyCreatedAt
            }
        });
    } else {
        res.status(404).json({ error: 'User not found or no telegram key' });
    }
});

app.post('/api/user/register', mockAuth, (req, res) => {
    const userId = req.user.uid;
    const userData = req.body;
    
    // Prioritize email from request body (real Firebase user email)
    const userEmail = userData.email || `user.${userId.substring(0, 5)}@example.com`;
    
    console.log(`📝 User registration for ${userId}:`, {
        email: userEmail,
        displayName: userData.displayName,
        firstName: userData.firstName,
        lastName: userData.lastName
    });
    
    // Check if user already exists
    if (users.has(userId)) {
        const existingUser = users.get(userId);
        console.log(`👤 User ${userId} already exists with email: ${existingUser.email}`);
        return res.status(400).json({
            error: 'User already exists',
            telegramKey: existingUser.telegramKey,
            email: existingUser.email // Return the real email
        });
    }
    
    // Generate telegram key (format: TG-[6chars]-[7chars]-[6chars])
    const part1 = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 chars
    const part2 = Math.random().toString(36).substring(2, 9).toUpperCase(); // 7 chars
    const part3 = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 chars
    const telegramKey = `TG-${part1}-${part2}-${part3}`;
    
    // Store user data with real email and all provided data
    const userDataWithKey = {
        ...userData,
        email: userEmail, // Ensure real email is used
        telegramKey,
        telegramKeyCreatedAt: new Date().toISOString(),
        telegramKeyUsed: false,
        createdAt: new Date().toISOString()
    };
    
    users.set(userId, userDataWithKey);
    
    // Store key mapping with real email
    telegramKeys.set(telegramKey, {
        userId,
        email: userEmail, // Store real email for validation
        createdAt: new Date().toISOString(),
        used: false,
        permanent: true
    });
    
    console.log(`✅ User ${userId} registered with key ${telegramKey} and email ${userEmail}`);
    
    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
            userId: userId,
            telegramKey: telegramKey,
            user: userDataWithKey
        }
    });
});

app.post('/api/user/:userId/regenerate-telegram-key', mockAuth, (req, res) => {
    const userId = req.params.userId;
    let user = users.get(userId);
    
    // Get all user data from request body
    const requestData = req.body || {};
    const userEmail = requestData.email;
    const displayName = requestData.displayName;
    const emailVerified = requestData.emailVerified;
    
    console.log(`🔑 Regenerate key request for ${userId}:`, {
        requestEmail: userEmail,
        displayName: displayName,
        emailVerified: emailVerified,
        existingUser: !!user,
        fullRequestBody: requestData
    });
    
    // CRITICAL: Ensure we have the real email
    if (!userEmail || userEmail.includes('@example.com')) {
        console.log(`⚠️  WARNING: Invalid or mock email detected: ${userEmail}`);
        console.log(`🔍 Request headers:`, req.headers);
        console.log(`🔍 Auth user:`, req.user);
    }
    
    if (!user) {
        // Create new user with all the real data
        const nameParts = displayName ? displayName.split(' ') : [];
        const finalEmail = userEmail || `user.${userId.substring(0, 5)}@example.com`;
        
        user = {
            email: finalEmail,
            displayName: displayName || '',
            firstName: nameParts[0] || finalEmail.split('@')[0],
            lastName: nameParts.slice(1).join(' ') || '',
            emailVerified: emailVerified || false,
            createdAt: new Date().toISOString(),
            telegramKeyUsed: false
        };
        
        console.log(`📝 Created new user ${userId}:`, user);
    } else {
        // Update existing user with fresh data
        if (userEmail && userEmail !== user.email) {
            console.log(`📧 Updating email: ${user.email} → ${userEmail}`);
            user.email = userEmail;
        }
        
        if (displayName) {
            user.displayName = displayName;
            const nameParts = displayName.split(' ');
            user.firstName = nameParts[0] || user.firstName;
            user.lastName = nameParts.slice(1).join(' ') || user.lastName;
        }
        
        if (emailVerified !== undefined) {
            user.emailVerified = emailVerified;
        }
        
        console.log(`📧 Updated user ${userId}:`, user);
    }
    
    // Generate new telegram key (format: TG-[6chars]-[7chars]-[6chars])
    const part1 = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 chars
    const part2 = Math.random().toString(36).substring(2, 9).toUpperCase(); // 7 chars
    const part3 = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 chars
    const newTelegramKey = `TG-${part1}-${part2}-${part3}`;
    
    // Update user data
    user.telegramKey = newTelegramKey;
    user.telegramKeyCreatedAt = new Date().toISOString();
    user.telegramKeyUsed = false;
    
    users.set(userId, user);
    
    // Store new key mapping with correct email
    telegramKeys.set(newTelegramKey, {
        userId,
        email: user.email,
        createdAt: new Date().toISOString(),
        used: false,
        permanent: true
    });
    
    console.log(`🔑 Generated new key for ${userId} (${user.email}): ${newTelegramKey}`);
    
    res.json({
        success: true,
        message: 'Telegram key regenerated successfully',
        data: { telegramKey: newTelegramKey }
    });
});

// Telegram bot endpoints
app.post('/api/telegram/validate-key', (req, res) => {
    const { key } = req.body;
    
    console.log(`\n🔍 ========== TELEGRAM BOT VALIDATION REQUEST ==========`);
    console.log(`🔑 Key: ${key}`);
    console.log(`🕐 Time: ${new Date().toISOString()}`);
    console.log(`📡 Request from: ${req.ip}`);
    console.log(`🔍 User-Agent: ${req.get('User-Agent')}`);
    
    if (!key) {
        console.log(`❌ No key provided in request`);
        return res.status(400).json({ error: 'Key is required' });
    }
    
    const keyData = telegramKeys.get(key);
    
    if (!keyData) {
        console.log(`❌ Key not found: ${key}`);
        console.log(`📋 Available keys:`, Array.from(telegramKeys.keys()));
        return res.json({ valid: false, reason: 'Key not found' });
    }
    
    if (keyData.used) {
        console.log(`❌ Key already used: ${key}`);
        return res.json({ valid: false, reason: 'Key already used' });
    }
    
    // Get full user data for complete info
    const userData = users.get(keyData.userId);
    
    console.log(`✅ Valid key found:`, {
        key: key,
        userId: keyData.userId,
        email: keyData.email,
        userData: userData ? {
            email: userData.email,
            displayName: userData.displayName,
            firstName: userData.firstName,
            lastName: userData.lastName,
            emailVerified: userData.emailVerified,
            createdAt: userData.createdAt
        } : 'No user data'
    });
    
    // CRITICAL DEBUG: Check if email is mock
    if (keyData.email && keyData.email.includes('@example.com')) {
        console.log(`🚨 MOCK EMAIL DETECTED IN KEY VALIDATION:`, {
            keyEmail: keyData.email,
            userDataEmail: userData ? userData.email : 'none',
            allUsers: Array.from(users.entries()).map(([id, data]) => ({
                id: id,
                email: data.email,
                displayName: data.displayName
            }))
        });
    }
    
    res.json({
        valid: true,
        userId: keyData.userId,
        userEmail: keyData.email,
        userData: userData || null
    });
});

app.post('/api/telegram/connect', (req, res) => {
    const { key, telegramUserData } = req.body;
    
    console.log(`🔗 Telegram connection request:`, {
        key: key,
        telegramUser: telegramUserData
    });
    
    if (!key || !telegramUserData) {
        return res.status(400).json({ error: 'Key and telegram user data are required' });
    }
    
    const keyData = telegramKeys.get(key);
    
    if (!keyData || keyData.used) {
        console.log(`❌ Invalid or used key: ${key}`, { keyData: keyData });
        return res.status(400).json({ error: 'Invalid or already used key' });
    }
    
    // Mark key as used
    keyData.used = true;
    keyData.usedAt = new Date().toISOString();
    keyData.telegramUserId = telegramUserData.id.toString();
    telegramKeys.set(key, keyData);
    
    // Update user data
    const user = users.get(keyData.userId);
    if (user) {
        user.telegramKeyUsed = true;
        user.telegramLinkedAt = new Date().toISOString();
        user.telegramUserId = telegramUserData.id.toString();
        user.telegramUsername = telegramUserData.username;
        user.telegramFirstName = telegramUserData.first_name;
        user.telegramLastName = telegramUserData.last_name;
        users.set(keyData.userId, user);
        
        console.log(`✅ Connected Telegram account:`, {
            userId: keyData.userId,
            userEmail: keyData.email,
            telegramId: telegramUserData.id,
            telegramUsername: telegramUserData.username,
            finalUserData: {
                email: user.email,
                displayName: user.displayName,
                firstName: user.firstName,
                lastName: user.lastName
            }
        });
    } else {
        console.log(`⚠️ No user data found for userId: ${keyData.userId}`);
    }
    
    res.json({
        success: true,
        userId: keyData.userId,
        userEmail: keyData.email,
        userData: user || null
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'memory',
        environment: 'development'
    });
});

// Debug endpoint to check all stored keys and users
app.get('/api/debug/keys', (req, res) => {
    const allUsers = Array.from(users.entries()).map(([id, data]) => ({
        userId: id,
        email: data.email,
        telegramKey: data.telegramKey,
        telegramKeyUsed: data.telegramKeyUsed,
        displayName: data.displayName
    }));
    
    const allKeys = Array.from(telegramKeys.entries()).map(([key, data]) => ({
        key: key,
        userId: data.userId,
        email: data.email,
        used: data.used,
        createdAt: data.createdAt
    }));
    
    res.json({
        users: allUsers,
        keys: allKeys,
        totalUsers: users.size,
        totalKeys: telegramKeys.size
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to ensure permanent key exists
app.post('/api/user/ensure-permanent-key', mockAuth, (req, res) => {
    const { userId, email, displayName, permanentKey } = req.body;
    
    console.log(`🔑 Ensuring permanent key for ${userId}: ${permanentKey}`);
    
    // Check if user already exists
    let user = users.get(userId);
    
    if (!user) {
        // Create new user with permanent key
        user = {
            email: email,
            displayName: displayName || email.split('@')[0],
            firstName: displayName ? displayName.split(' ')[0] : email.split('@')[0],
            lastName: displayName ? displayName.split(' ').slice(1).join(' ') : '',
            telegramKey: permanentKey,
            telegramKeyCreatedAt: new Date().toISOString(),
            telegramKeyUsed: false,
            createdAt: new Date().toISOString()
        };
        
        users.set(userId, user);
        console.log(`📝 Created new user with permanent key: ${userId}`);
    } else if (!user.telegramKey || user.telegramKey !== permanentKey) {
        // Update existing user with permanent key
        user.telegramKey = permanentKey;
        user.telegramKeyCreatedAt = new Date().toISOString();
        users.set(userId, user);
        console.log(`📝 Updated user with permanent key: ${userId}`);
    }
    
    // Ensure key mapping exists
    if (!telegramKeys.has(permanentKey)) {
        telegramKeys.set(permanentKey, {
            userId: userId,
            email: email,
            createdAt: new Date().toISOString(),
            used: false,
            permanent: true
        });
        console.log(`🔑 Created permanent key mapping: ${permanentKey}`);
    }
    
    res.json({
        success: true,
        message: 'Permanent key ensured',
        telegramKey: permanentKey
    });
});

// Simple key generation endpoint for direct connection
app.post('/api/generate-simple-key', (req, res) => {
    const { email, displayName } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    console.log(`🔑 Generating simple key for: ${email}`);
    
    // Generate a simple user ID from email
    const userId = email.replace('@', '_at_').replace('.', '_dot_');
    
    // Generate telegram key (format: TG-[6chars]-[7chars]-[6chars])
    const part1 = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 chars
    const part2 = Math.random().toString(36).substring(2, 9).toUpperCase(); // 7 chars
    const part3 = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 chars
    const telegramKey = `TG-${part1}-${part2}-${part3}`;
    
    // Store user data
    const userData = {
        email: email,
        displayName: displayName || email.split('@')[0],
        firstName: displayName ? displayName.split(' ')[0] : email.split('@')[0],
        lastName: displayName ? displayName.split(' ').slice(1).join(' ') : '',
        telegramKey: telegramKey,
        telegramKeyCreatedAt: new Date().toISOString(),
        telegramKeyUsed: false,
        createdAt: new Date().toISOString()
    };
    
    users.set(userId, userData);
    
    // Store key mapping
    telegramKeys.set(telegramKey, {
        userId: userId,
        email: email,
        createdAt: new Date().toISOString(),
        used: false,
        permanent: true
    });
    
    console.log(`✅ Generated key ${telegramKey} for ${email}`);
    
    res.json({
        success: true,
        telegramKey: telegramKey,
        email: email,
        message: `Key generated for ${email}. Use /connect ${telegramKey} in Telegram.`
    });
});

// Simple connection page
app.get('/simple-connect', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Simple Telegram Connection</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .result { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px; }
        .key { font-family: monospace; font-size: 16px; font-weight: bold; color: #007bff; }
    </style>
</head>
<body>
    <h1>🤖 Simple Telegram Connection</h1>
    <p>Generate a connection key to link your Telegram account:</p>
    
    <form id="keyForm">
        <div class="form-group">
            <label for="email">Your Email:</label>
            <input type="email" id="email" name="email" required placeholder="your@email.com">
        </div>
        <div class="form-group">
            <label for="displayName">Your Name (optional):</label>
            <input type="text" id="displayName" name="displayName" placeholder="Your Full Name">
        </div>
        <button type="submit">Generate Connection Key</button>
    </form>
    
    <div id="result" class="result" style="display: none;">
        <h3>✅ Your Connection Key:</h3>
        <div class="key" id="generatedKey"></div>
        <p><strong>Next Steps:</strong></p>
        <ol>
            <li>Copy the key above</li>
            <li>Go to Telegram and find the Kita-kita bot</li>
            <li>Send: <code>/connect YOUR_KEY_HERE</code></li>
        </ol>
    </div>
    
    <script>
        document.getElementById('keyForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const displayName = document.getElementById('displayName').value;
            
            try {
                const response = await fetch('/api/generate-simple-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, displayName })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('generatedKey').textContent = result.telegramKey;
                    document.getElementById('result').style.display = 'block';
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error generating key: ' + error.message);
            }
        });
    </script>
</body>
</html>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Development server running on port ${PORT}`);
    console.log(`📊 Environment: development`);
    console.log(`🔧 Database: in-memory (for testing)`);
    console.log(`🔑 Telegram integration: enabled`);
    console.log(`\n🌐 Open http://localhost:${PORT} to test`);
});

module.exports = app; 