#!/usr/bin/env node

/**
 * Security Check Automation Script
 * Monitors dependencies for vulnerabilities and provides automated fixes
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SecurityChecker {
    constructor() {
        this.packageJsonPath = path.join(process.cwd(), 'package.json');
        this.vulnerabilities = [];
        this.criticalCount = 0;
        this.highCount = 0;
        this.moderateCount = 0;
        this.lowCount = 0;
    }

    /**
     * Main security check routine
     */
    async runSecurityCheck() {
        console.log('🔒 Starting Security Check...\n');
        
        try {
            await this.checkNodeVersion();
            await this.checkPackageJson();
            await this.runNpmAudit();
            await this.checkOutdatedPackages();
            await this.generateReport();
            
            console.log('\n✅ Security check completed successfully!');
            
            if (this.criticalCount > 0 || this.highCount > 0) {
                console.log('\n🚨 CRITICAL/HIGH vulnerabilities found! Please review and fix immediately.');
                process.exit(1);
            }
            
        } catch (error) {
            console.error('❌ Security check failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Check Node.js version against security requirements
     */
    async checkNodeVersion() {
        console.log('📋 Checking Node.js version...');
        
        const nodeVersion = process.version;
        const requiredVersion = 'v20.19.2';
        
        console.log(`Current Node.js version: ${nodeVersion}`);
        console.log(`Required minimum version: ${requiredVersion}`);
        
        if (this.compareVersions(nodeVersion, requiredVersion) < 0) {
            throw new Error(`Node.js version ${nodeVersion} is below the required minimum ${requiredVersion}`);
        }
        
        console.log('✅ Node.js version is secure\n');
    }

    /**
     * Validate package.json security configuration
     */
    async checkPackageJson() {
        console.log('📦 Checking package.json configuration...');
        
        if (!fs.existsSync(this.packageJsonPath)) {
            throw new Error('package.json not found');
        }
        
        const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
        
        // Check for security-related configurations
        const checks = [
            { key: 'engines.node', value: packageJson.engines?.node, required: true },
            { key: 'scripts.audit', value: packageJson.scripts?.audit, required: true },
            { key: 'scripts.security-check', value: packageJson.scripts?.['security-check'], required: true }
        ];
        
        for (const check of checks) {
            if (check.required && !check.value) {
                console.log(`⚠️  Missing recommended configuration: ${check.key}`);
            } else if (check.value) {
                console.log(`✅ Found: ${check.key}`);
            }
        }
        
        console.log('✅ package.json validation completed\n');
    }

    /**
     * Run npm audit and parse results
     */
    async runNpmAudit() {
        console.log('🔍 Running npm audit...');
        
        try {
            const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
            const auditData = JSON.parse(auditResult);
            
            this.parseAuditResults(auditData);
            
        } catch (error) {
            // npm audit returns non-zero exit code when vulnerabilities are found
            if (error.stdout) {
                const auditData = JSON.parse(error.stdout);
                this.parseAuditResults(auditData);
            } else {
                throw new Error('Failed to run npm audit');
            }
        }
    }

    /**
     * Parse npm audit results
     */
    parseAuditResults(auditData) {
        if (auditData.vulnerabilities) {
            for (const [packageName, vulnData] of Object.entries(auditData.vulnerabilities)) {
                const severity = vulnData.severity;
                
                this.vulnerabilities.push({
                    package: packageName,
                    severity: severity,
                    title: vulnData.title || 'Unknown vulnerability',
                    url: vulnData.url || '',
                    fixAvailable: vulnData.fixAvailable || false
                });
                
                // Count by severity
                switch (severity) {
                    case 'critical':
                        this.criticalCount++;
                        break;
                    case 'high':
                        this.highCount++;
                        break;
                    case 'moderate':
                        this.moderateCount++;
                        break;
                    case 'low':
                        this.lowCount++;
                        break;
                }
            }
        }
        
        console.log(`Found ${this.vulnerabilities.length} vulnerabilities:`);
        console.log(`  🔴 Critical: ${this.criticalCount}`);
        console.log(`  🟠 High: ${this.highCount}`);
        console.log(`  🟡 Moderate: ${this.moderateCount}`);
        console.log(`  🟢 Low: ${this.lowCount}\n`);
    }

    /**
     * Check for outdated packages
     */
    async checkOutdatedPackages() {
        console.log('📅 Checking for outdated packages...');
        
        try {
            const outdatedResult = execSync('npm outdated --json', { encoding: 'utf8' });
            const outdatedData = JSON.parse(outdatedResult);
            
            const outdatedCount = Object.keys(outdatedData).length;
            
            if (outdatedCount > 0) {
                console.log(`⚠️  Found ${outdatedCount} outdated packages:`);
                
                for (const [packageName, packageData] of Object.entries(outdatedData)) {
                    console.log(`  - ${packageName}: ${packageData.current} → ${packageData.latest}`);
                }
            } else {
                console.log('✅ All packages are up to date');
            }
            
        } catch (error) {
            // npm outdated returns non-zero exit code when outdated packages are found
            if (error.stdout) {
                const outdatedData = JSON.parse(error.stdout);
                const outdatedCount = Object.keys(outdatedData).length;
                console.log(`⚠️  Found ${outdatedCount} outdated packages`);
            } else {
                console.log('✅ All packages are up to date');
            }
        }
        
        console.log('');
    }

    /**
     * Generate security report
     */
    async generateReport() {
        console.log('📊 Generating security report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            vulnerabilities: {
                total: this.vulnerabilities.length,
                critical: this.criticalCount,
                high: this.highCount,
                moderate: this.moderateCount,
                low: this.lowCount
            },
            details: this.vulnerabilities
        };
        
        // Save report to file
        const reportPath = path.join(process.cwd(), 'security-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`✅ Security report saved to: ${reportPath}`);
        
        // Display summary
        this.displaySummary();
    }

    /**
     * Display security summary
     */
    displaySummary() {
        console.log('\n📋 SECURITY SUMMARY');
        console.log('==================');
        console.log(`Node.js Version: ${process.version}`);
        console.log(`Total Vulnerabilities: ${this.vulnerabilities.length}`);
        console.log(`Critical: ${this.criticalCount}`);
        console.log(`High: ${this.highCount}`);
        console.log(`Moderate: ${this.moderateCount}`);
        console.log(`Low: ${this.lowCount}`);
        
        if (this.vulnerabilities.length > 0) {
            console.log('\n🔧 RECOMMENDED ACTIONS:');
            
            if (this.criticalCount > 0 || this.highCount > 0) {
                console.log('1. 🚨 URGENT: Fix critical/high vulnerabilities immediately');
                console.log('   Run: npm audit fix --force');
            }
            
            if (this.moderateCount > 0) {
                console.log('2. ⚠️  Review and fix moderate vulnerabilities');
                console.log('   Run: npm audit fix');
            }
            
            console.log('3. 📦 Update outdated packages');
            console.log('   Run: npm update');
            
            console.log('4. 🔍 Review security report for details');
            console.log('   File: security-report.json');
        }
    }

    /**
     * Compare version strings
     */
    compareVersions(version1, version2) {
        const v1parts = version1.replace('v', '').split('.').map(Number);
        const v2parts = version2.replace('v', '').split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const v1part = v1parts[i] || 0;
            const v2part = v2parts[i] || 0;
            
            if (v1part < v2part) return -1;
            if (v1part > v2part) return 1;
        }
        
        return 0;
    }
}

// Auto-fix function
async function autoFix() {
    console.log('🔧 Running automatic security fixes...\n');
    
    try {
        console.log('Running npm audit fix...');
        execSync('npm audit fix', { stdio: 'inherit' });
        
        console.log('\n✅ Automatic fixes completed!');
        console.log('🔍 Running security check again...\n');
        
        // Run security check again
        const checker = new SecurityChecker();
        await checker.runSecurityCheck();
        
    } catch (error) {
        console.error('❌ Auto-fix failed:', error.message);
        console.log('\n🔧 Try manual fixes:');
        console.log('1. npm audit fix --force');
        console.log('2. npm update');
        console.log('3. Manual package updates');
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--fix') || args.includes('-f')) {
        autoFix();
    } else {
        const checker = new SecurityChecker();
        checker.runSecurityCheck();
    }
}

module.exports = SecurityChecker; 