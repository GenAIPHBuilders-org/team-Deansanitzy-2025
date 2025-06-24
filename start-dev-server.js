const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory storage for development
const users = new Map();

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

// Development authentication middleware 
const devAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    let userId = 'dev-user-123';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const crypto = require('crypto');
            userId = crypto.createHash('md5').update(token).digest('hex').substring(0, 16);
            req.firebaseToken = token;
        } catch (error) {
            console.log('Could not parse token, using default user ID');
        }
    }
    
    req.user = { uid: userId };
    next();
};

// Development API endpoints
app.get('/api/user/:userId/telegram-key', devAuth, (req, res) => {
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

app.post('/api/user/register', devAuth, (req, res) => {
    const userId = req.user.uid;
    const userData = req.body;
    
    // Prioritize email from request body (real Firebase user email)
    const userEmail = userData.email || `user.${userId.substring(0, 5)}@temp.local`;
    
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
    
    // Generate fixed telegram key based on email
    const telegramKey = generateFixedTelegramKey(userEmail);
    
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

app.post('/api/user/:userId/regenerate-telegram-key', devAuth, (req, res) => {
    const userId = req.params.userId;
    const { email: userEmail, displayName, emailVerified } = req.body;
    
    console.log(`🔄 Key regeneration request for ${userId}:`, {
        userEmail: userEmail,
        displayName: displayName,
        emailVerified: emailVerified
    });
    
    let user = users.get(userId);
    
    if (!user) {
        // Create new user with all the real data
        const nameParts = displayName ? displayName.split(' ') : [];
        const finalEmail = userEmail || `user.${userId.substring(0, 5)}@temp.local`;
        
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
    
    if (!key) {
        console.log(`❌ No key provided in request`);
        return res.status(400).json({ error: 'Key is required' });
    }
    
    const validation = validateTelegramKey(key);
    
    if (!validation.valid) {
        console.log(`❌ Key validation failed: ${validation.reason}`);
        return res.json({ valid: false, reason: validation.reason });
    }
    
    console.log(`✅ Valid key found:`, {
        key: key,
        userId: validation.userId,
        email: validation.userEmail,
        userData: validation.userData ? {
            email: validation.userData.email,
            displayName: validation.userData.displayName,
            firstName: validation.userData.firstName,
            lastName: validation.userData.lastName
        } : 'No user data'
    });
    
    res.json({
        valid: true,
        userId: validation.userId,
        userEmail: validation.userEmail,
        userData: validation.userData
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
    
    const validation = validateTelegramKey(key);
    
    if (!validation.valid) {
        console.log(`❌ Invalid key: ${key}`, { reason: validation.reason });
        return res.status(400).json({ error: validation.reason });
    }
    
    // Mark key as used and update user data
    const user = users.get(validation.userId);
    if (user) {
        user.telegramKeyUsed = true;
        user.telegramLinkedAt = new Date().toISOString();
        user.telegramUserId = telegramUserData.id.toString();
        user.telegramUsername = telegramUserData.username;
        user.telegramFirstName = telegramUserData.first_name;
        user.telegramLastName = telegramUserData.last_name;
        users.set(validation.userId, user);
        
        console.log(`✅ Connected Telegram account:`, {
            userId: validation.userId,
            userEmail: validation.userEmail,
            telegramId: telegramUserData.id,
            telegramUsername: telegramUserData.username
        });
    } else {
        console.log(`⚠️ No user data found for userId: ${validation.userId}`);
    }
    
    res.json({
        success: true,
        userId: validation.userId,
        userEmail: validation.userEmail,
        userData: user || null
    });
});

// Save transaction from Telegram bot (development mode)
app.post('/api/telegram/save-transaction', (req, res) => {
    const { userId, userEmail, transactionData } = req.body;
    
    if (!userId || !userEmail || !transactionData) {
        return res.status(400).json({ 
            error: 'User ID, email, and transaction data are required' 
        });
    }

    console.log(`💾 Telegram bot saving transaction for user ${userId} (${userEmail}):`, transactionData);

    // Find the user by ID
    const user = users.get(userId);
    if (!user) {
        console.log(`❌ User not found: ${userId}`);
        return res.status(404).json({ error: 'User not found' });
    }

    if (!user.telegramKeyUsed) {
        console.log(`❌ User ${userId} does not have a connected Telegram account`);
        return res.status(403).json({ 
            error: 'User does not have a connected Telegram account' 
        });
    }

    if (user.email !== userEmail) {
        console.log(`❌ Email mismatch for user ${userId}: expected ${user.email}, got ${userEmail}`);
        return res.status(403).json({ 
            error: 'Email mismatch for user account' 
        });
    }

    // Initialize transactions array if not exists
    if (!user.transactions) {
        user.transactions = [];
    }

    // Create transaction with ID and metadata
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const enhancedTransaction = {
        id: transactionId,
        ...transactionData,
        source: 'telegram_bot',
        scannedAt: new Date().toISOString(),
        telegramUserId: user.telegramUserId,
        verified: false,
        timestamp: new Date().toISOString()
    };

    // Add to user's transactions
    user.transactions.push(enhancedTransaction);
    users.set(userId, user);
    
    console.log(`✅ Transaction saved successfully: ${transactionId} for user ${userId}`);
    console.log(`💰 Transaction details:`, {
        id: transactionId,
        amount: transactionData.amount,
        category: transactionData.category,
        merchant: transactionData.receiptData?.merchant || 'Unknown'
    });

    res.json({ 
        success: true, 
        transactionId: transactionId,
        message: 'Transaction saved successfully from Telegram bot',
        data: {
            transactionId,
            userId,
            amount: transactionData.amount,
            category: transactionData.category,
            merchant: transactionData.receiptData?.merchant
        }
    });
});

// Get user's Telegram connection status and info
app.get('/api/user/:userId/telegram-status', devAuth, (req, res) => {
    const { userId } = req.params;
    
    const user = users.get(userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const status = {
        connected: user.telegramKeyUsed || false,
        telegramKey: user.telegramKey,
        connectionInfo: user.telegramKeyUsed ? {
            telegramUserId: user.telegramUserId,
            telegramUsername: user.telegramUsername,
            telegramFirstName: user.telegramFirstName,
            telegramLastName: user.telegramLastName,
            connectedAt: user.telegramLinkedAt
        } : null,
        botInfo: {
            botName: 'Kita-kita Bot',
            botUsername: '@KitakitaAIBot',
            botUrl: 'https://t.me/KitakitaAIBot'
        }
    };
    
    res.json({ success: true, data: status });
});

// Get user's transactions (including Telegram scanned ones)
app.get('/api/user/:userId/transactions', devAuth, (req, res) => {
    const { userId } = req.params;
    
    const user = users.get(userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const transactions = user.transactions || [];
    
    // Add some metadata about transaction sources
    const transactionStats = {
        total: transactions.length,
        telegramScanned: transactions.filter(t => t.source === 'telegram_bot').length,
        webApp: transactions.filter(t => t.source !== 'telegram_bot').length
    };

    res.json({ 
        success: true, 
        data: transactions,
        stats: transactionStats
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

// Debug endpoint to check all stored users
app.get('/api/debug/keys', (req, res) => {
    const allUsers = Array.from(users.entries()).map(([id, data]) => ({
        userId: id,
        email: data.email,
        telegramKey: data.telegramKey,
        telegramKeyUsed: data.telegramKeyUsed,
        displayName: data.displayName
    }));
    
    res.json({
        users: allUsers,
        totalUsers: users.size
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to ensure permanent key exists
app.post('/api/user/ensure-permanent-key', devAuth, (req, res) => {
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

// Ensure user has fixed telegram key (no regeneration)
app.post('/api/user/ensure-fixed-key', devAuth, (req, res) => {
    const { userId, email, displayName, fixedKey } = req.body;
    
    console.log(`🔑 Ensuring fixed key for ${userId}: ${fixedKey}`);
    
    // Check if user already exists
    let user = users.get(userId);
    
    if (!user) {
        // Create new user with fixed key
        user = {
            email: email,
            displayName: displayName || email.split('@')[0],
            firstName: displayName ? displayName.split(' ')[0] : email.split('@')[0],
            lastName: displayName ? displayName.split(' ').slice(1).join(' ') : '',
            telegramKey: fixedKey,
            telegramKeyCreatedAt: new Date().toISOString(),
            telegramKeyUsed: false,
            createdAt: new Date().toISOString()
        };
        
        users.set(userId, user);
        console.log(`📝 Created new user with fixed key: ${userId}`);
    } else {
        // Update existing user with fixed key only if they don't have the same one
        if (!user.telegramKey || user.telegramKey !== fixedKey) {
            user.telegramKey = fixedKey;
            user.telegramKeyCreatedAt = new Date().toISOString();
            users.set(userId, user);
            console.log(`📝 Updated user with fixed key: ${userId}`);
        }
    }
    
    res.json({
        success: true,
        message: 'Fixed key ensured',
        telegramKey: fixedKey
    });
});

// Generate fixed telegram key based on email address
function generateFixedTelegramKey(email) {
    // Generate a fixed key based on email address (deterministic)
    const emailHash = Buffer.from(email).toString('base64').replace(/[^A-Z0-9]/g, '');
    
    // Create consistent parts from email hash
    let hash = emailHash;
    while (hash.length < 20) {
        hash += emailHash; // Repeat if too short
    }
    
    const part1 = hash.substring(0, 6);
    const part2 = hash.substring(6, 13);
    const part3 = hash.substring(13, 19);
    
    return `TG-${part1}-${part2}-${part3}`;
}

// Helper function to find user by telegram key
function findUserByTelegramKey(telegramKey) {
    for (const [userId, userData] of users.entries()) {
        if (userData.telegramKey === telegramKey) {
            return { userId, userData };
        }
    }
    return null;
}

// Helper function to validate telegram key
function validateTelegramKey(telegramKey) {
    const userMatch = findUserByTelegramKey(telegramKey);
    
    if (!userMatch) {
        return { valid: false, reason: 'Telegram key not found' };
    }
    
    if (userMatch.userData.telegramKeyUsed) {
        return { valid: false, reason: 'Telegram key already used' };
    }
    
    return {
        valid: true,
        userId: userMatch.userId,
        userEmail: userMatch.userData.email,
        userData: userMatch.userData
    };
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Development server running on port ${PORT}`);
    console.log(`📊 Environment: development`);
    console.log(`🔧 Database: in-memory (for testing)`);
    console.log(`🔑 Telegram integration: enabled`);
    console.log(`\n🌐 Open http://localhost:${PORT} to test`);
});

module.exports = app; 