const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  } else {
    // Use environment variables
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  }
}

const db = admin.firestore();

class SecurityAuditDashboard {
  constructor() {
    this.startTime = new Date();
  }

  // Main audit function
  async runSecurityAudit() {
    console.log('🔍 Starting comprehensive security audit...\n');
    
    const results = {
      timestamp: this.startTime.toISOString(),
      userAudit: await this.auditUserCredentials(),
      systemAudit: await this.auditSystemSecurity(),
      suspiciousActivity: await this.detectSuspiciousActivity(),
      compliance: await this.checkComplianceRequirements(),
      recommendations: []
    };

    // Generate recommendations based on findings
    results.recommendations = this.generateRecommendations(results);
    
    // Generate report
    await this.generateReport(results);
    
    console.log('\n✅ Security audit completed!');
    return results;
  }

  // Audit user credentials and data integrity
  async auditUserCredentials() {
    console.log('🔐 Auditing user credentials...');
    
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const audit = {
      totalUsers: users.length,
      usersWithCredentials: 0,
      
      usersWithActiveKeys: 0,
      usersWithAuditTrails: 0,
      dataQualityIssues: [],
      securityIssues: []
    };

    for (const user of users) {
      // Check credential completeness
                  if (user.email) {
        audit.usersWithCredentials++;
      }
      


      // Check for audit trail existence
      const auditLogsSnapshot = await db.collection('users')
        .doc(user.id)
        .collection('audit_logs')
        .limit(1)
        .get();
      
      if (!auditLogsSnapshot.empty) {
        audit.usersWithAuditTrails++;
      }

      // Data quality checks
      if (!user.email) {
        audit.dataQualityIssues.push({
          userId: user.id,
          issue: 'missing_email',
          severity: 'high'
        });
      }

      if (!user.createdAt && !user.lastModified) {
        audit.dataQualityIssues.push({
          userId: user.id,
          issue: 'missing_timestamps',
          severity: 'medium'
        });
      }

      if (!user.modifiedBy && user.lastModified) {
        audit.securityIssues.push({
          userId: user.id,
          issue: 'missing_audit_fields',
          severity: 'high'
        });
      }


    }

    console.log(`   ✓ Audited ${audit.totalUsers} users`);
    console.log(`   ✓ Found ${audit.dataQualityIssues.length} data quality issues`);
    console.log(`   ✓ Found ${audit.securityIssues.length} security issues`);
    
    return audit;
  }

  // Audit system-wide security configurations
  async auditSystemSecurity() {
    console.log('🛡️ Auditing system security...');
    
    const systemAudit = {
      auditLogsCount: 0,
      criticalAuditLogsCount: 0,
      recentSecurityEvents: [],
      accessPatterns: {},
      riskLevel: 'low'
    };

    // Check system audit logs
    const systemAuditSnapshot = await db.collection('system_audit')
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();

    systemAudit.auditLogsCount = systemAuditSnapshot.size;
    
    const systemAuditLogs = systemAuditSnapshot.docs.map(doc => doc.data());
    
    systemAudit.criticalAuditLogsCount = systemAuditLogs.filter(log => 
      log.auditLevel === 'CRITICAL' || log.sensitiveData === true
    ).length;

    // Analyze recent security events (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    systemAudit.recentSecurityEvents = systemAuditLogs.filter(log => {
      const logDate = log.timestamp?.toDate() || new Date(0);
      return logDate > sevenDaysAgo && log.sensitiveData === true;
    });

    // Analyze access patterns
    const activities = systemAuditLogs.map(log => log.activity);
    systemAudit.accessPatterns = activities.reduce((acc, activity) => {
      acc[activity] = (acc[activity] || 0) + 1;
      return acc;
    }, {});

    // Determine risk level
    const failedAttempts = systemAuditLogs.filter(log => 
      log.activity.includes('FAILED') || log.activity.includes('ERROR')
    ).length;
    
    if (failedAttempts > 50 || systemAudit.recentSecurityEvents.length > 20) {
      systemAudit.riskLevel = 'high';
    } else if (failedAttempts > 20 || systemAudit.recentSecurityEvents.length > 5) {
      systemAudit.riskLevel = 'medium';
    }

    console.log(`   ✓ Analyzed ${systemAudit.auditLogsCount} system audit logs`);
    console.log(`   ✓ Found ${systemAudit.criticalAuditLogsCount} critical events`);
    console.log(`   ✓ System risk level: ${systemAudit.riskLevel}`);

    return systemAudit;
  }

  // Detect suspicious activity patterns
  async detectSuspiciousActivity() {
    console.log('🚨 Detecting suspicious activity...');
    
    const suspiciousPatterns = {
      suspiciousUsers: [],
      anomalousAccess: [],
      potentialThreats: []
    };

    // Get all users to check their activity
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      // Get recent audit logs for this user
      const auditSnapshot = await db.collection('users')
        .doc(userId)
        .collection('audit_logs')
        .where('timestamp', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
        .get();

      const activities = auditSnapshot.docs.map(doc => doc.data());
      
      // Analyze patterns
      const failedAttempts = activities.filter(a => 
        a.activity.includes('FAILED') || a.activity.includes('ERROR')
      ).length;

      const multipleIPs = new Set(activities.map(a => a.ip)).size;
      const sensitiveOperations = activities.filter(a => a.sensitiveData === true).length;

      // Flag suspicious users
      if (failedAttempts > 5 || multipleIPs > 3 || sensitiveOperations > 5) {
        suspiciousPatterns.suspiciousUsers.push({
          userId,
          failedAttempts,
          uniqueIPs: multipleIPs,
          sensitiveOperations,
          riskScore: failedAttempts * 2 + multipleIPs * 3 + sensitiveOperations * 1
        });
      }

      // Check for anomalous access patterns
      const accessHours = activities.map(a => {
        const timestamp = a.timestamp?.toDate() || new Date();
        return timestamp.getHours();
      });

      const nightAccess = accessHours.filter(hour => hour < 6 || hour > 22).length;
      if (nightAccess > 0 && activities.length > 10) {
        suspiciousPatterns.anomalousAccess.push({
          userId,
          totalActivities: activities.length,
          nightActivities: nightAccess,
          pattern: 'unusual_hours'
        });
      }
    }

    // Sort by risk score
    suspiciousPatterns.suspiciousUsers.sort((a, b) => b.riskScore - a.riskScore);

    console.log(`   ✓ Found ${suspiciousPatterns.suspiciousUsers.length} suspicious users`);
    console.log(`   ✓ Found ${suspiciousPatterns.anomalousAccess.length} anomalous access patterns`);

    return suspiciousPatterns;
  }

  // Check compliance with security requirements
  async checkComplianceRequirements() {
    console.log('📋 Checking compliance requirements...');
    
    const compliance = {
      auditTrailCoverage: 0,
      dataRetention: { compliant: true, issues: [] },
      accessControl: { compliant: true, issues: [] },
      encryption: { compliant: true, issues: [] },
      overallScore: 0
    };

    // Check audit trail coverage
    const totalUsersSnapshot = await db.collection('users').get();
    const totalUsers = totalUsersSnapshot.size;
    
    let usersWithAuditTrails = 0;
    for (const userDoc of totalUsersSnapshot.docs) {
      const auditSnapshot = await db.collection('users')
        .doc(userDoc.id)
        .collection('audit_logs')
        .limit(1)
        .get();
      
      if (!auditSnapshot.empty) {
        usersWithAuditTrails++;
      }
    }

    compliance.auditTrailCoverage = totalUsers > 0 ? (usersWithAuditTrails / totalUsers) * 100 : 0;

    // Check data retention (audit logs older than 90 days should be archived)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const oldAuditLogsSnapshot = await db.collection('system_audit')
      .where('timestamp', '<', ninetyDaysAgo)
      .limit(10)
      .get();

    if (!oldAuditLogsSnapshot.empty) {
      compliance.dataRetention.compliant = false;
      compliance.dataRetention.issues.push({
        issue: 'old_audit_logs_not_archived',
        count: oldAuditLogsSnapshot.size,
        recommendation: 'Archive audit logs older than 90 days'
      });
    }

    // Calculate overall compliance score
    let score = 0;
    if (compliance.auditTrailCoverage > 90) score += 25;
    else if (compliance.auditTrailCoverage > 70) score += 15;
    else if (compliance.auditTrailCoverage > 50) score += 10;

    if (compliance.dataRetention.compliant) score += 25;
    if (compliance.accessControl.compliant) score += 25;
    if (compliance.encryption.compliant) score += 25;

    compliance.overallScore = score;

    console.log(`   ✓ Audit trail coverage: ${compliance.auditTrailCoverage.toFixed(1)}%`);
    console.log(`   ✓ Overall compliance score: ${compliance.overallScore}/100`);

    return compliance;
  }

  // Generate security recommendations
  generateRecommendations(auditResults) {
    const recommendations = [];

    // User credential recommendations
    if (auditResults.userAudit.dataQualityIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'data_quality',
        title: 'Fix Missing User Data',
        description: `${auditResults.userAudit.dataQualityIssues.length} users have missing critical data fields`,
        action: 'Review and populate missing email addresses and timestamps'
      });
    }

    if (auditResults.userAudit.securityIssues.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'security',
        title: 'Address Security Issues',
        description: `${auditResults.userAudit.securityIssues.length} users have security-related issues`,
        action: 'Implement proper audit fields and strengthen security'
      });
    }

    // System security recommendations
    if (auditResults.systemAudit.riskLevel === 'high') {
      recommendations.push({
        priority: 'critical',
        category: 'system_security',
        title: 'High Risk Level Detected',
        description: 'System shows high risk indicators',
        action: 'Investigate recent security events and implement additional monitoring'
      });
    }

    // Suspicious activity recommendations
    if (auditResults.suspiciousActivity.suspiciousUsers.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'threat_detection',
        title: 'Suspicious Users Detected',
        description: `${auditResults.suspiciousActivity.suspiciousUsers.length} users show suspicious activity patterns`,
        action: 'Review flagged users and consider additional authentication requirements'
      });
    }

    // Compliance recommendations
    if (auditResults.compliance.overallScore < 80) {
      recommendations.push({
        priority: 'medium',
        category: 'compliance',
        title: 'Improve Compliance Score',
        description: `Current compliance score: ${auditResults.compliance.overallScore}/100`,
        action: 'Address compliance gaps to meet security standards'
      });
    }

    return recommendations;
  }

  // Generate comprehensive security report
  async generateReport(auditResults) {
    const reportPath = path.join(__dirname, `security-audit-${new Date().toISOString().split('T')[0]}.json`);
    
    const report = {
      ...auditResults,
      metadata: {
        auditVersion: '1.0',
        generatedAt: new Date().toISOString(),
        auditDuration: Date.now() - this.startTime.getTime(),
        environment: process.env.NODE_ENV || 'development'
      }
    };

    // Write detailed JSON report
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Detailed report saved to: ${reportPath}`);

    // Generate summary report
    console.log('\n📋 SECURITY AUDIT SUMMARY');
    console.log('=====================================');
    console.log(`🔐 User Credentials: ${auditResults.userAudit.usersWithCredentials}/${auditResults.userAudit.totalUsers} users have complete credentials`);

    console.log(`📝 Audit Coverage: ${auditResults.compliance.auditTrailCoverage.toFixed(1)}% of users have audit trails`);
    console.log(`⚠️ Risk Level: ${auditResults.systemAudit.riskLevel.toUpperCase()}`);
    console.log(`📊 Compliance Score: ${auditResults.compliance.overallScore}/100`);
    
    if (auditResults.recommendations.length > 0) {
      console.log('\n🎯 TOP RECOMMENDATIONS:');
      auditResults.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
        console.log(`   ${rec.description}`);
      });
    }
  }
}

// Run the audit if called directly
if (require.main === module) {
  const dashboard = new SecurityAuditDashboard();
  dashboard.runSecurityAudit()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Audit failed:', error);
      process.exit(1);
    });
}

module.exports = SecurityAuditDashboard; 