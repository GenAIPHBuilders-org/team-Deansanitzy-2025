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

// Configure static file serving with proper MIME types
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

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



// Get user's transactions
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
        total: transactions.length
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

    console.log(`\n🌐 Open http://localhost:${PORT} to test`);
});

module.exports = app; 