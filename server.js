const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const fetch = require('node-fetch');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection check
let dbConnectionStatus = 'disconnected';

// Initialize Firebase Admin SDK for server-side operations
const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
try {
  // Check if service account key exists
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    dbConnectionStatus = 'connected';
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    console.warn('⚠️  Firebase service account not found. Using environment variables...');
    
    // Fallback to environment variables
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
      dbConnectionStatus = 'connected';
      console.log('✅ Firebase Admin SDK initialized with environment variables');
    } else {
      throw new Error('Firebase configuration missing');
    }
  }
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  dbConnectionStatus = 'error';
  
  // In production, we might want to exit if database is critical
  if (process.env.NODE_ENV === 'production' && process.env.REQUIRE_DATABASE === 'true') {
    console.error('💥 Database connection required in production. Exiting...');
    process.exit(1);
  }
}

// Get Firestore instance
const db = admin.firestore();

// Enhanced security middleware
app.use(helmet()); // Set security HTTP headers
app.use(xss()); // Sanitize request data

// Rate limiting to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Stricter rate limiting for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 AI requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many AI requests from this IP, please try again after 1 minute'
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);
app.use('/api/ai/', aiLimiter);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || 'https://kitakita.com' 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Configure multer for file uploads with size limits and filters
const upload = multer({
  limits: { 
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only certain file types
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, XLSX, and CSV files are allowed.'), false);
    }
  }
});

// Authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization token provided' });
    }

    const token = authHeader.substring(7);
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Database helper functions
const dbHelpers = {
  async getUserData(userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      return userDoc.exists ? userDoc.data() : null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    }
  },

  async storeUserData(userId, data) {
    try {
      await db.collection('users').doc(userId).set(data, { merge: true });
      return true;
    } catch (error) {
      console.error('Error storing user data:', error);
      throw error;
    }
  },

  async getUserTransactions(userId) {
    try {
      const transactionsRef = db.collection('users').doc(userId).collection('transactions');
      const snapshot = await transactionsRef.orderBy('timestamp', 'desc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  },

  async storeTransaction(userId, transactionData) {
    try {
      const transactionRef = db.collection('users').doc(userId).collection('transactions').doc();
      await transactionRef.set({
        ...transactionData,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId
      });
      return transactionRef.id;
    } catch (error) {
      console.error('Error storing transaction:', error);
      throw error;
    }
  },

  // Generate special telegram connection key for new users
  generateTelegramKey() {
    // Generate telegram key (format: TG-[6chars]-[7chars]-[6chars])
    const part1 = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 chars
    const part2 = Math.random().toString(36).substring(2, 9).toUpperCase(); // 7 chars
    const part3 = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 chars
    return `TG-${part1}-${part2}-${part3}`;
  },

  generateFixedTelegramKey(email) {
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
  },

  async createUserWithTelegramKey(userId, userData) {
    try {
      const telegramKey = this.generateFixedTelegramKey(userData.email);
      
      const userDataWithKey = {
        ...userData,
        telegramKey,
        telegramKeyCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        telegramKeyUsed: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('users').doc(userId).set(userDataWithKey);

      return { ...userDataWithKey, userId };
    } catch (error) {
      console.error('Error creating user with fixed telegram key:', error);
      throw error;
    }
  },

  async verifyEmailAndTelegramKey(email, telegramKey) {
    try {
      // Look up user by telegram key within users collection
      const usersQuery = await db.collection('users')
        .where('telegramKey', '==', telegramKey)
        .where('email', '==', email)
        .limit(1)
        .get();
      
      if (usersQuery.empty) {
        return { valid: false, reason: 'Invalid email and telegram key combination' };
      }

      const userDoc = usersQuery.docs[0];
      const userData = userDoc.data();
      const userId = userDoc.id;

      return { 
        valid: true, 
        userId: userId,
        userData: userData,
        keyData: {
          telegramKey: userData.telegramKey,
          email: userData.email,
          used: userData.telegramKeyUsed || false
        }
      };
    } catch (error) {
      console.error('Error verifying email and telegram key:', error);
      throw error;
    }
  },

  async validateTelegramKey(telegramKey) {
    try {
      // Look up user by telegram key within users collection
      const usersQuery = await db.collection('users')
        .where('telegramKey', '==', telegramKey)
        .limit(1)
        .get();
      
      if (usersQuery.empty) {
        return { valid: false, reason: 'Telegram key not found' };
      }

      const userDoc = usersQuery.docs[0];
      const userData = userDoc.data();
      const userId = userDoc.id;

      if (userData.telegramKeyUsed) {
        return { valid: false, reason: 'Telegram key already used' };
      }

      return { 
        valid: true, 
        userId: userId,
        userEmail: userData.email,
        userData: userData
      };
    } catch (error) {
      console.error('Error validating telegram key:', error);
      throw error;
    }
  }
};

// AI Agent Integration
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// AI helper function
async function callGeminiAI(prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error(`Gemini AI attempt ${attempt} failed:`, error);
      if (attempt === retries) {
        throw new Error(`Gemini AI failed after ${retries} attempts: ${error.message}`);
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

// API Routes

// Health check endpoint with database status
app.get('/api/health', async (req, res) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbConnectionStatus,
    environment: process.env.NODE_ENV || 'development'
  };

  // Test database connection
  if (dbConnectionStatus === 'connected') {
    try {
      await db.collection('health').doc('test').set({ timestamp: admin.firestore.FieldValue.serverTimestamp() });
      healthStatus.database = 'healthy';
    } catch (error) {
      healthStatus.database = 'unhealthy';
      healthStatus.databaseError = error.message;
    }
  }

  const statusCode = healthStatus.database === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// User data endpoints
app.get('/api/user/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify user can only access their own data
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userData = await dbHelpers.getUserData(userId);
    res.json({ success: true, data: userData });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// User registration endpoint that generates telegram key
app.post('/api/user/register', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userData = req.body;

    // Check if user already exists
    const existingUser = await dbHelpers.getUserData(userId);
    if (existingUser) {
      return res.status(400).json({ 
        error: 'User already exists',
        telegramKey: existingUser.telegramKey 
      });
    }

    // Create user with telegram key
    const newUser = await dbHelpers.createUserWithTelegramKey(userId, userData);
    
    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully',
      data: {
        userId: newUser.userId,
        telegramKey: newUser.telegramKey,
        user: newUser
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Get user's telegram connection key
app.get('/api/user/:userId/telegram-key', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userData = await dbHelpers.getUserData(userId);
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      success: true, 
      data: {
        telegramKey: userData.telegramKey,
        telegramKeyUsed: userData.telegramKeyUsed || false,
        telegramKeyCreatedAt: userData.telegramKeyCreatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching telegram key:', error);
    res.status(500).json({ error: 'Failed to fetch telegram key' });
  }
});

// Ensure user has a fixed telegram key (no regeneration allowed)
app.post('/api/user/ensure-fixed-key', authenticateUser, async (req, res) => {
  try {
    const { userId, email, displayName, fixedKey } = req.body;
    
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get or create user data
    let userData = await dbHelpers.getUserData(userId);
    if (!userData) {
      console.log('User not found in database, creating user data');
      
      // Create user data from Firebase Auth user
      const authUser = req.user;
      const nameParts = displayName ? displayName.split(' ') : [];
      
      userData = {
        firstName: nameParts[0] || email.split('@')[0],
        lastName: nameParts.slice(1).join(' ') || '',
        email: email,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        accountStatus: 'active'
      };
    }
    
    // Update user record with fixed telegram key (only if they don't have one or it's different)
    const updatedUserData = {
      ...userData,
      telegramKey: fixedKey,
      telegramKeyCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      telegramKeyUsed: userData.telegramKeyUsed || false // Preserve existing connection status
    };
    
    await dbHelpers.storeUserData(userId, updatedUserData);

    res.json({ 
      success: true, 
      message: 'Fixed telegram key ensured',
      data: { telegramKey: fixedKey }
    });
  } catch (error) {
    console.error('Error ensuring fixed telegram key:', error);
    res.status(500).json({ error: 'Failed to ensure fixed telegram key' });
  }
});

// Verify email and telegram key combination (for telegram bot)
app.post('/api/telegram/verify-credentials', async (req, res) => {
  try {
    const { email, telegramKey } = req.body;
    
    if (!email || !telegramKey) {
      return res.status(400).json({ 
        error: 'Email and telegram key are required' 
      });
    }

    const verification = await dbHelpers.verifyEmailAndTelegramKey(email, telegramKey);
    
    if (!verification.valid) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        reason: verification.reason 
      });
    }

    res.json({ 
      success: true, 
      message: 'Credentials verified successfully',
      data: {
        userId: verification.userId,
        email: email,
        telegramKey: telegramKey,
        userData: {
          name: verification.userData.name,
          email: verification.userData.email,
          telegramKeyUsed: verification.userData.telegramKeyUsed
        }
      }
    });
  } catch (error) {
    console.error('Error verifying telegram credentials:', error);
    res.status(500).json({ error: 'Failed to verify credentials' });
  }
});

app.post('/api/user/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify user can only modify their own data
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await dbHelpers.storeUserData(userId, req.body);
    res.json({ success: true, message: 'User data updated successfully' });
  } catch (error) {
    console.error('Error updating user data:', error);
    res.status(500).json({ error: 'Failed to update user data' });
  }
});

// Transaction endpoints
app.get('/api/user/:userId/transactions', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const transactions = await dbHelpers.getUserTransactions(userId);
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/user/:userId/transactions', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const transactionId = await dbHelpers.storeTransaction(userId, req.body);
    res.json({ success: true, transactionId, message: 'Transaction stored successfully' });
  } catch (error) {
    console.error('Error storing transaction:', error);
    res.status(500).json({ error: 'Failed to store transaction' });
  }
});

// AI Agent endpoints
app.post('/api/ai/ipon-coach', authenticateUser, async (req, res) => {
  try {
    const { userId, message, context } = req.body;
    
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user's financial data for context
    const userData = await dbHelpers.getUserData(userId);
    const transactions = await dbHelpers.getUserTransactions(userId);

    const prompt = `
    You are IponCoach, a Filipino AI financial advisor specializing in savings (ipon). 
    
    User Context:
    - User ID: ${userId}
    - Financial Profile: ${JSON.stringify(userData?.financialProfile || {})}
    - Recent Transactions: ${JSON.stringify(transactions?.slice(0, 10) || [])}
    
    User Message: "${message}"
    Additional Context: ${context || 'None'}
    
    Provide personalized savings advice in a friendly, culturally-aware Filipino context. 
    Use Filipino financial terms when appropriate and consider local economic conditions.
    Be specific and actionable in your recommendations.
    `;

    const aiResponse = await callGeminiAI(prompt);
    
    // Store the interaction for learning
    await db.collection('users').doc(userId).collection('ai_interactions').add({
      agent: 'ipon-coach',
      userMessage: message,
      aiResponse,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      context
    });

    res.json({ success: true, response: aiResponse });
  } catch (error) {
    console.error('IponCoach error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

app.post('/api/ai/gastos-guardian', authenticateUser, async (req, res) => {
  try {
    const { userId, message, context } = req.body;
    
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userData = await dbHelpers.getUserData(userId);
    const transactions = await dbHelpers.getUserTransactions(userId);

    const prompt = `
    You are GastosGuardian, a Filipino AI expense tracking and budgeting assistant.
    
    User Context:
    - User ID: ${userId}
    - Financial Profile: ${JSON.stringify(userData?.financialProfile || {})}
    - Recent Transactions: ${JSON.stringify(transactions?.slice(0, 20) || [])}
    
    User Message: "${message}"
    Additional Context: ${context || 'None'}
    
    Analyze spending patterns and provide budget recommendations. 
    Focus on Filipino spending habits and local cost of living.
    Identify areas for improvement and suggest practical cost-cutting measures.
    `;

    const aiResponse = await callGeminiAI(prompt);
    
    await db.collection('users').doc(userId).collection('ai_interactions').add({
      agent: 'gastos-guardian',
      userMessage: message,
      aiResponse,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      context
    });

    res.json({ success: true, response: aiResponse });
  } catch (error) {
    console.error('GastosGuardian error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

app.post('/api/ai/pera-planner', authenticateUser, async (req, res) => {
  try {
    const { userId, message, context } = req.body;
    
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userData = await dbHelpers.getUserData(userId);
    const transactions = await dbHelpers.getUserTransactions(userId);

    const prompt = `
    You are PeraPlanner, a Filipino AI financial planning and investment advisor.
    
    User Context:
    - User ID: ${userId}
    - Financial Profile: ${JSON.stringify(userData?.financialProfile || {})}
    - Recent Transactions: ${JSON.stringify(transactions?.slice(0, 20) || [])}
    
    User Message: "${message}"
    Additional Context: ${context || 'None'}
    
    Provide comprehensive financial planning advice including investment options available in the Philippines.
    Consider local investment vehicles like UITF, mutual funds, stocks (PSE), bonds, and digital banks.
    Factor in Filipino financial goals like OFW remittances, family support, and retirement planning.
    `;

    const aiResponse = await callGeminiAI(prompt);
    
    await db.collection('users').doc(userId).collection('ai_interactions').add({
      agent: 'pera-planner',
      userMessage: message,
      aiResponse,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      context
    });

    res.json({ success: true, response: aiResponse });
  } catch (error) {
    console.error('PeraPlanner error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

// File upload endpoint
app.post('/api/upload', authenticateUser, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Store file metadata in database
    const fileMetadata = {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: req.user.uid
    };

    const docRef = await db.collection('uploads').add(fileMetadata);
    
    res.json({ 
      success: true, 
      fileId: docRef.id,
      message: 'File uploaded successfully' 
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Validate telegram key (for telegram bot use)
app.post('/api/telegram/validate-key', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'Telegram key is required' });
    }

    const validation = await dbHelpers.validateTelegramKey(key);
    
    if (!validation.valid) {
      return res.json({ 
        valid: false, 
        reason: validation.reason 
      });
    }

    res.json({
      valid: true,
      userId: validation.userId,
      userEmail: validation.userEmail,
      userData: validation.userData
    });
  } catch (error) {
    console.error('Error validating telegram key:', error);
    res.status(500).json({ error: 'Failed to validate telegram key' });
  }
});

// Connect telegram account (mark key as used)
app.post('/api/telegram/connect', async (req, res) => {
  try {
    const { key, telegramUserData } = req.body;
    
    if (!key || !telegramUserData) {
      return res.status(400).json({ error: 'Key and telegram user data are required' });
    }

    // Validate the key first
    const validation = await dbHelpers.validateTelegramKey(key);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    // Mark key as used and store telegram user info
    const updatedUserData = {
      ...validation.userData,
      telegramKeyUsed: true,
      telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
      telegramUserId: telegramUserData.id.toString(),
      telegramUsername: telegramUserData.username,
      telegramFirstName: telegramUserData.first_name,
      telegramLastName: telegramUserData.last_name
    };

    await dbHelpers.storeUserData(validation.userId, updatedUserData);

    res.json({
      success: true,
      userId: validation.userId,
      userEmail: validation.userEmail,
      userData: updatedUserData
    });
  } catch (error) {
    console.error('Error connecting telegram account:', error);
    res.status(500).json({ error: 'Failed to connect telegram account' });
  }
});

// API endpoint for Telegram bot to verify email and telegram key
app.post('/api/telegram/verify-credentials', async (req, res) => {
    try {
        const { email, telegramKey } = req.body;
        
        if (!email || !telegramKey) {
            return res.status(400).json({ error: 'Email and telegram key are required' });
        }
        
        console.log('Verifying credentials:', email, telegramKey);
        
        // Use server-side verification function
        const verification = await dbHelpers.verifyEmailAndTelegramKey(email, telegramKey);
        
        if (verification.valid) {
            res.json({ 
                success: true, 
                data: {
                    userId: verification.userId,
                    email: verification.keyData.email,
                    userData: verification.userData
                }
            });
        } else {
            res.status(400).json({ 
                success: false, 
                reason: verification.reason 
            });
        }
    } catch (error) {
        console.error('Error verifying credentials:', error);
        res.status(500).json({ error: 'Failed to verify credentials' });
    }
});

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  // Log the error with context
  console.error('Error occurred:', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    ip: req.ip,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    userId: req.user?.uid || 'anonymous'
  });
  
  // Categorize errors for better client responses
  if (err.name === 'MulterError') {
    return res.status(400).json({ 
      error: 'File upload error', 
      details: err.message,
      code: 'FILE_UPLOAD_ERROR'
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.message,
      code: 'VALIDATION_ERROR'
    });
  }
  
  if (err.name === 'AuthenticationError') {
    return res.status(401).json({
      error: 'Authentication error',
      details: 'Authentication failed or token expired',
      code: 'AUTH_ERROR'
    });
  }
  
  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      error: 'Resource not found',
      details: err.message,
      code: 'NOT_FOUND'
    });
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      error: 'Service unavailable',
      details: 'Database connection failed',
      code: 'DATABASE_ERROR'
    });
  }
  
  // Default server error response
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message,
    requestId: req.id || Math.random().toString(36).substring(2, 15),
    code: 'SERVER_ERROR'
  });
  
  // If we have Sentry or other error tracking, send it there
  if (process.env.NODE_ENV === 'production' && typeof Sentry !== 'undefined') {
    Sentry.captureException(err);
  }
};

// Apply error handler middleware
app.use(errorHandler);

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    code: 'ROUTE_NOT_FOUND'
  });
});

// Start server with graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔥 Database: ${dbConnectionStatus}`);
  console.log(`🤖 AI Integration: ${process.env.GEMINI_API_KEY ? 'Enabled' : 'Disabled'}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.warn('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.warn('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.warn('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.warn('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app; 