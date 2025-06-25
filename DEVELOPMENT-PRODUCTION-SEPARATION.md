# Development/Production Code Separation

## Overview
This document outlines the changes made to properly separate development and production code, eliminating mixed development/production code issues.

## Changes Made

### 1. New Environment Utility Module
**File**: `public/js/utils/environment.js`

Created a centralized environment detection and management system:
- **Environment Detection**: `isProduction()`, `isDevelopment()`
- **Mode Detection**: `isDebugMode()`, `isTestMode()`, `isSimpleMode()`
- **Environment-aware Logging**: `devLog()`, `devWarn()`, `prodError()`, etc.
- **Conditional Execution**: `runInDevelopment()`, `runInProduction()`
- **Configuration**: `getEnvironmentConfig()`

### 2. Updated Pera Planner AI
**File**: `public/agents/peraPlanner.js`

**Removed:**
- Mixed debug/test/simple mode flags in constructor
- Direct URL parameter parsing for modes
- Development-specific console.log statements
- Hardcoded debug logic mixed with production code

**Added:**
- Environment-aware configuration via `getEnvironmentConfig()`
- Proper environment-based logging
- Clean separation of development and production features

### 3. Updated Agent Configuration
**File**: `public/agents/agent.config.js`

**Improvements:**
- Separated development and production configurations
- Environment-aware feature flags
- Proper import of environment utilities
- Clean configuration structure without mixed code

### 4. Updated Base Agent
**File**: `public/agents/BaseAgent.js`

**Changes:**
- Added environment configuration to constructor
- Replaced console.log with environment-aware logging
- Updated error handling to use production-safe logging
- Separated development and production behaviors

### 5. Dashboard Cleanup
**File**: `public/js/dashboard.js`

**Removed:**
- Development-only sample transaction code comments
- Commented-out testing code

## Benefits

### 🔒 **Security Improvements**
- No development code exposed in production
- Clean separation of environments
- Proper logging levels for each environment

### ⚡ **Performance Improvements**
- No unnecessary debug logging in production
- Optimized code paths for production
- Reduced bundle size in production

### 🛠️ **Maintainability**
- Clear separation of concerns
- Easier debugging in development
- Consistent environment handling across all modules

### 🎯 **Production Stability**
- No debug modes accessible in production
- Consistent behavior across environments
- Proper error handling and logging

## Usage Examples

### Environment Detection
```javascript
import { isProduction, isDevelopment } from '../js/utils/environment.js';

if (isProduction()) {
    // Production-only code
    initializeAnalytics();
} else {
    // Development-only code
    enableDebugTools();
}
```

### Environment-aware Logging
```javascript
import { devLog, prodError } from '../js/utils/environment.js';

// This will only log in development
devLog('Debug information:', data);

// This will always log (important for production monitoring)
prodError('Critical error occurred:', error);
```

### Configuration
```javascript
import { getEnvironmentConfig } from '../js/utils/environment.js';

const config = getEnvironmentConfig();
if (config.features.mockData) {
    // Use mock data in development
}
```

## Migration Guide

### For Existing Code
1. Replace `console.log` with `devLog` for debug information
2. Replace `console.error` with `prodError` for critical errors
3. Use environment detection instead of manual checks
4. Move development-only code behind environment guards

### For New Code
1. Import environment utilities at the top of files
2. Use environment-aware logging from the start
3. Check environment before adding development features
4. Use configuration object for environment-specific settings

## File Structure

```
public/js/utils/
├── environment.js          # Environment detection and utilities

public/agents/
├── agent.config.js         # Environment-aware agent configuration
├── BaseAgent.js           # Updated with environment utilities
├── peraPlanner.js         # Cleaned up development/production separation
├── gastosGuardian.js      # (Future update needed)
└── iponCoach.js          # (Future update needed)

public/js/
├── dashboard.js           # Cleaned up development code
└── ...                    # (Other files need similar updates)
```

## Next Steps

1. **Apply to remaining agents**: Update `gastosGuardian.js` and `iponCoach.js`
2. **Update remaining JS files**: Apply environment utilities to all client-side code
3. **Server-side separation**: Apply similar patterns to `server.js` and Node.js code
4. **Testing**: Add tests for environment detection and separation
5. **Documentation**: Update README with environment setup instructions

## Environment Variables

### Development
```bash
NODE_ENV=development
DEBUG=true
```

### Production
```bash
NODE_ENV=production
DEBUG=false
```

### URL Parameters (Development Only)
- `?debug=true` - Enable debug mode
- `?test=true` - Enable test mode  
- `?simple=true` - Enable simple mode

## Verification

To verify the separation is working:

1. **In Development**: Debug logs should appear, test modes should work
2. **In Production**: No debug logs, no test modes accessible, clean error handling
3. **Performance**: Production builds should be smaller and faster
4. **Security**: No development features exposed in production 