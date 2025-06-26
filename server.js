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
// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       directives: {
//         ...helmet.contentSecurityPolicy.getDefaultDirectives(),
//         "script-src": ["'self'", "https://www.gstatic.com", "https://cdn.jsdelivr.net", "'unsafe-inline'", "https://www.googletagmanager.com", "https://apis.google.com"],
//         "img-src": ["'self'", "data:", "https://www.google.com"],
//         "connect-src": ["'self'", "https://*.googleapis.com", "https://www.googleapis.com", "https://www.google-analytics.com"],
//         "frame-src": ["'self'", "https://*.firebaseapp.com"],
//       },
//     },
//   })
// );
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

// API endpoint to serve the config
app.get('/api/config', (req, res) => {
    res.json({
        gemini_api_key: process.env.GEMINI_API_KEY
    });
});

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

// Enhanced authentication middleware with audit logging
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Log authentication failure
      await dbHelpers.logUserActivity('anonymous', 'AUTHENTICATION_FAILED', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        reason: 'no_token'
      }, true);
      return res.status(401).json({ error: 'No valid authorization token provided' });
    }

    const token = authHeader.substring(7);
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Add request context for audit logging
    req.user = decodedToken;
    req.auditContext = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      sessionId: req.headers['x-session-id'] || 'unknown'
    };

    // Log successful authentication
    await dbHelpers.logUserActivity(decodedToken.uid, 'AUTHENTICATION_SUCCESS', req.auditContext);
    
    // Check for suspicious activity
    const suspiciousCheck = await dbHelpers.checkSuspiciousActivity(decodedToken.uid);
    if (suspiciousCheck.suspicious) {
      console.warn(`⚠️ Suspicious activity detected for user ${decodedToken.uid}`);
      // Still allow access but flag for review
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    await dbHelpers.logUserActivity('unknown', 'AUTHENTICATION_ERROR', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      error: error.message
    }, true);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Database helper functions
const dbHelpers = {
  // Audit logging function
  async logUserActivity(userId, activity, details = {}, sensitiveData = false) {
    try {
      const auditEntry = {
        userId,
        activity,
        details: this.sanitizeAuditData(details),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ip: details.ip || 'unknown',
        userAgent: details.userAgent || 'unknown',
        sessionId: details.sessionId || 'unknown',
        sensitiveData,
        environment: process.env.NODE_ENV || 'development'
      };
      
      // Store in both user-specific and system-wide audit logs
      const batch = db.batch();
      
      // User-specific audit log
      const userAuditRef = db.collection('users').doc(userId).collection('audit_logs').doc();
      batch.set(userAuditRef, auditEntry);
      
      // System-wide audit log for sensitive operations
      if (sensitiveData) {
        const systemAuditRef = db.collection('system_audit').doc();
        batch.set(systemAuditRef, {
          ...auditEntry,
          auditLevel: 'CRITICAL',
          requiresReview: true
        });
      }
      
      await batch.commit();
      
      // Log to console for immediate monitoring
      const logLevel = sensitiveData ? 'SECURITY' : 'AUDIT';
      console.log(`[${logLevel}] User ${userId}: ${activity}`, 
        sensitiveData ? '(SENSITIVE DATA - details redacted)' : details);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to log user activity:', error);
      // Never let audit failure block the main operation
      return false;
    }
  },

  // Sanitize audit data to remove sensitive information
  sanitizeAuditData(data) {
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'credential'];
    const sanitized = { ...data };
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  },

  // Enhanced user data retrieval with audit
  async getUserData(userId, requestDetails = {}) {
    try {
      // Log data access
      await this.logUserActivity(userId, 'USER_DATA_ACCESS', {
        ...requestDetails,
        operation: 'read'
      });
      
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        // Update last access time
        await this.updateUserLastAccess(userId);
        return userDoc.data();
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      await this.logUserActivity(userId, 'USER_DATA_ACCESS_ERROR', {
        ...requestDetails,
        error: error.message
      }, true);
      throw error;
    }
  },

  // Enhanced user data storage with audit and validation
  async storeUserData(userId, data, requestDetails = {}) {
    try {
      // Validate that sensitive fields include audit information
      const auditData = {
        lastModified: admin.firestore.FieldValue.serverTimestamp(),
        modifiedBy: userId,
        modificationReason: requestDetails.reason || 'user_update',
        previousValues: {} // Will be populated below
      };

      // Get existing data to track changes
      const existingDoc = await db.collection('users').doc(userId).get();
      const existingData = existingDoc.exists ? existingDoc.data() : {};
      
      // Track sensitive field changes
      const sensitiveFields = ['email', 'telegramKey', 'telegramKeyUsed', 'role', 'permissions'];
      const changedSensitiveFields = [];
      
      sensitiveFields.forEach(field => {
        if (data[field] !== undefined && data[field] !== existingData[field]) {
          changedSensitiveFields.push(field);
          auditData.previousValues[field] = existingData[field] || '[NOT_SET]';
        }
      });

      // Add audit data to the update
      const dataWithAudit = {
        ...data,
        ...auditData
      };

      // Store the updated data
      await db.collection('users').doc(userId).set(dataWithAudit, { merge: true });

      // Log the operation with appropriate security level
      const isSensitiveUpdate = changedSensitiveFields.length > 0;
      await this.logUserActivity(userId, 
        isSensitiveUpdate ? 'SENSITIVE_DATA_UPDATE' : 'USER_DATA_UPDATE', 
        {
          ...requestDetails,
          changedFields: isSensitiveUpdate ? changedSensitiveFields : Object.keys(data),
          operation: 'update'
        }, 
        isSensitiveUpdate
      );

      return true;
    } catch (error) {
      console.error('Error storing user data:', error);
      await this.logUserActivity(userId, 'USER_DATA_STORE_ERROR', {
        ...requestDetails,
        error: error.message
      }, true);
      throw error;
    }
  },

  // Update user last access time
  async updateUserLastAccess(userId) {
    try {
      await db.collection('users').doc(userId).update({
        lastAccess: admin.firestore.FieldValue.serverTimestamp(),
        accessCount: admin.firestore.FieldValue.increment(1)
      });
    } catch (error) {
      // Don't throw error for last access update failures
      console.warn('Failed to update last access time:', error.message);
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

  async storeTransaction(userId, transactionData, requestDetails = {}) {
    try {
      const transactionRef = db.collection('users').doc(userId).collection('transactions').doc();
      const auditedTransaction = {
        ...transactionData,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId,
        lastModified: admin.firestore.FieldValue.serverTimestamp(),
        modifiedBy: userId
      };
      
      await transactionRef.set(auditedTransaction);
      
      // Log transaction creation
      await this.logUserActivity(userId, 'TRANSACTION_CREATED', {
        ...requestDetails,
        transactionId: transactionRef.id,
        amount: transactionData.amount,
        category: transactionData.category
      });
      
      return transactionRef.id;
    } catch (error) {
      console.error('Error storing transaction:', error);
      await this.logUserActivity(userId, 'TRANSACTION_STORE_ERROR', {
        ...requestDetails,
        error: error.message
      }, true);
      throw error;
    }
  },

  // Security monitoring functions
  async checkSuspiciousActivity(userId) {
    try {
      const recentAudits = await db.collection('users')
        .doc(userId)
        .collection('audit_logs')
        .where('timestamp', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
        .get();

      const activities = recentAudits.docs.map(doc => doc.data());
      
      // Check for suspicious patterns
      const failedAttempts = activities.filter(a => 
        a.activity.includes('FAILED') || a.activity.includes('ERROR')).length;
      
      const sensitiveChanges = activities.filter(a => 
        a.activity.includes('SENSITIVE_DATA_UPDATE')).length;
      
      const multipleIPs = new Set(activities.map(a => a.ip)).size;
      
      const suspicious = failedAttempts > 5 || sensitiveChanges > 3 || multipleIPs > 3;
      
      if (suspicious) {
        await this.logUserActivity(userId, 'SUSPICIOUS_ACTIVITY_DETECTED', {
          failedAttempts,
          sensitiveChanges,
          uniqueIPs: multipleIPs,
          timeWindow: '24h'
        }, true);
      }
      
      return {
        suspicious,
        failedAttempts,
        sensitiveChanges,
        uniqueIPs: multipleIPs
      };
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      return { suspicious: false };
    }
  },

  // Get audit trail for user
  async getUserAuditTrail(userId, limit = 50) {
    try {
      const auditSnapshot = await db.collection('users')
        .doc(userId)
        .collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return auditSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()?.toISOString()
      }));
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      return [];
    }
  },

  async checkSuspiciousActivity(userId) {
    try {
      const activities = await this.getUserAuditTrail(userId, 100);
      
      const failedAttempts = activities.filter(a => 
        a.activity.includes('FAILED') || a.activity.includes('ERROR')).length;
      
      const sensitiveChanges = activities.filter(a => 
        a.activity.includes('SENSITIVE_DATA_UPDATE') || a.activity.includes('USER_DATA_UPDATE')).length;
      
      const suspicious = failedAttempts > 3 || sensitiveChanges > 3;
      
      if (suspicious) {
        await this.logUserActivity(userId, 'SUSPICIOUS_ACTIVITY_DETECTED', {
          recentAudits: activities.map(a => ({
            activity: a.activity,
            timestamp: a.timestamp.toDate().toISOString()
          })),
          failedAttempts,
          sensitiveChanges
        }, true);
      }
      
      return suspicious;
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      return false;
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

// Health check endpoint
app.get('/health', async (req, res) => {
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
      await dbHelpers.logUserActivity(req.user.uid, 'UNAUTHORIZED_ACCESS_ATTEMPT', {
        ...req.auditContext,
        targetUserId: userId,
        reason: 'attempted_access_other_user_data'
      }, true);
      return res.status(403).json({ error: 'Access denied' });
    }

    const userData = await dbHelpers.getUserData(userId, req.auditContext);
    res.json({ success: true, data: userData });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// New audit trail endpoint
app.get('/api/user/:userId/audit', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    // Verify user can only access their own audit data
    if (req.user.uid !== userId) {
      await dbHelpers.logUserActivity(req.user.uid, 'UNAUTHORIZED_AUDIT_ACCESS_ATTEMPT', {
        ...req.auditContext,
        targetUserId: userId
      }, true);
      return res.status(403).json({ error: 'Access denied' });
    }

    await dbHelpers.logUserActivity(userId, 'AUDIT_TRAIL_ACCESS', {
      ...req.auditContext,
      limit
    });

    const auditTrail = await dbHelpers.getUserAuditTrail(userId, limit);
    res.json({ success: true, data: auditTrail });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

// Security status endpoint
app.get('/api/user/:userId/security-status', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify user can only access their own security status
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const suspiciousCheck = await dbHelpers.checkSuspiciousActivity(userId);
    
    await dbHelpers.logUserActivity(userId, 'SECURITY_STATUS_CHECK', req.auditContext);

    res.json({ 
      success: true, 
      data: {
        suspicious: suspiciousCheck.suspicious,
        stats: {
          failedAttempts: suspiciousCheck.failedAttempts,
          sensitiveChanges: suspiciousCheck.sensitiveChanges,
          uniqueIPs: suspiciousCheck.uniqueIPs
        },
        timeWindow: '24h'
      }
    });
  } catch (error) {
    console.error('Error checking security status:', error);
    res.status(500).json({ error: 'Failed to check security status' });
  }
});

// User registration endpoint that generates telegram key
app.post('/api/user/register', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userData = req.body;

    // Check if user already exists
    const existingUser = await dbHelpers.getUserData(userId, req.auditContext);
    if (existingUser) {
      await dbHelpers.logUserActivity(userId, 'DUPLICATE_REGISTRATION_ATTEMPT', {
        ...req.auditContext,
        existingEmail: existingUser.email
      }, true);
      
      return res.status(400).json({ 
        error: 'User already exists',
        telegramKey: existingUser.telegramKey 
      });
    }

    // Create user with telegram key
    const newUser = await dbHelpers.createUserWithTelegramKey(userId, userData, {
      ...req.auditContext,
      reason: 'user_registration'
    });
    
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
    await dbHelpers.logUserActivity(req.user?.uid || 'unknown', 'USER_REGISTRATION_ERROR', {
      ...req.auditContext,
      error: error.message
    }, true);
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
      await dbHelpers.logUserActivity(req.user.uid, 'UNAUTHORIZED_KEY_GENERATION_ATTEMPT', {
        ...req.auditContext,
        targetUserId: userId
      }, true);
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get or create user data
    let userData = await dbHelpers.getUserData(userId, req.auditContext);
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
    
    // Check if this is a key change (security critical)
    const isKeyChange = userData.telegramKey && userData.telegramKey !== fixedKey;
    
    // Update user record with fixed telegram key
    const updatedUserData = {
      ...userData,
      telegramKey: fixedKey,
      telegramKeyCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      telegramKeyUsed: userData.telegramKeyUsed || false // Preserve existing connection status
    };
    
    await dbHelpers.storeUserData(userId, updatedUserData, {
      ...req.auditContext,
      reason: isKeyChange ? 'telegram_key_change' : 'telegram_key_creation',
      previousKey: userData.telegramKey || '[NOT_SET]'
    });

    // Log the key operation with high security level
    await dbHelpers.logUserActivity(userId, 
      isKeyChange ? 'TELEGRAM_KEY_CHANGED' : 'TELEGRAM_KEY_CREATED', 
      {
        ...req.auditContext,
        email: email,
        keyChanged: isKeyChange
      }, 
      true
    );

    res.json({ 
      success: true, 
      message: 'Fixed telegram key ensured',
      data: { telegramKey: fixedKey }
    });
  } catch (error) {
    console.error('Error ensuring fixed telegram key:', error);
    await dbHelpers.logUserActivity(req.user?.uid || 'unknown', 'TELEGRAM_KEY_OPERATION_ERROR', {
      ...req.auditContext,
      error: error.message
    }, true);
    res.status(500).json({ error: 'Failed to ensure fixed telegram key' });
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

app.post('/api/ai/cashflow-optimizer', authenticateUser, async (req, res) => {
  try {
    const { userId, context } = req.body;
    
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { promptType, transactionSummary, accountSummary } = context;
    let prompt;

    if (promptType === 'subscriptions') {
      prompt = `
        As an AI "Subscription Sleuth," analyze the user's transactions and accounts to identify all potential recurring subscriptions or bills.
        Look for repeated payments to the same merchant (e.g., Netflix, Spotify, Meralco, PLDT).
        Also consider account types that might have recurring fees.
        For each, provide the name and estimated monthly cost.

        Accounts:
        ${accountSummary}

        Transactions:
        ${transactionSummary}

        Provide the output as a JSON array of objects, or an empty array if none are found:
        [
          {"name": "Netflix Subscription", "amount": 550},
          {"name": "Spotify Premium", "amount": 149}
        ]
      `;
    } else if (promptType === 'optimization-tips') {
      prompt = `
        As a "Cashflow Optimizer AI," provide 2-3 actionable, personalized tips to improve financial efficiency based on this user's accounts and transactions.
        Focus on reducing recurring costs, cutting down on non-essential spending, or suggesting cheaper alternatives.
        Analyze spending patterns in relation to account balances. For example, if high-interest debt accounts exist, suggest prioritizing payments.

        Accounts:
        ${accountSummary}

        Transactions:
        ${transactionSummary}

        Provide the output as a JSON array of strings:
        ["Actionable tip based on spending.", "Another optimization suggestion."]
      `;
    } else {
      return res.status(400).json({ error: 'Invalid prompt type for Cashflow Optimizer' });
    }
    
    const aiResponse = await callGeminiAI(prompt);
    
    await db.collection('users').doc(userId).collection('ai_interactions').add({
      agent: 'cashflow-optimizer',
      userMessage: `Analyze: ${promptType}`,
      aiResponse,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      context
    });

    res.json({ success: true, response: aiResponse });
  } catch (error) {
    console.error('Cashflow Optimizer error:', error);
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

app.post('/api/ai/wealth-builder', authenticateUser, async (req, res) => {
  try {
    const { userId, prompt } = req.body;
    
    if (req.user.uid !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const aiResponse = await callGeminiAI(prompt);
    
    await db.collection('users').doc(userId).collection('ai_interactions').add({
      agent: 'wealth-builder',
      userMessage: 'WealthBuilder Analysis',
      aiResponse,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      context: { prompt }
    });

    res.json({ success: true, response: aiResponse });
  } catch (error) {
    console.error('WealthBuilder AI error:', error);
    res.status(500).json({ error: 'Failed to get AI response from WealthBuilder' });
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