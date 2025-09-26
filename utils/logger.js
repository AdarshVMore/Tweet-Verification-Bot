const fs = require('fs');
const path = require('path');
require('dotenv').config();

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.enableAuditLogging = process.env.ENABLE_AUDIT_LOGGING === 'true';
    this.logDir = path.join(__dirname, '../logs');

    if (this.enableAuditLogging && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  log(level, message, data = null) {
    if (this.levels[level] <= this.levels[this.logLevel]) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        message,
        data
      };

      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data ? JSON.stringify(data, null, 2) : '');

      if (this.enableAuditLogging) {
        this.writeToFile(logEntry);
      }
    }
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }

  auditVerification(tweetData, verificationResult) {
    if (!this.enableAuditLogging) return;

    const auditEntry = {
      timestamp: new Date().toISOString(),
      type: 'verification_audit',
      tweetId: tweetData.id,
      tweetText: tweetData.text,
      tweetAuthor: tweetData.author,
      verificationResult,
      processingTime: verificationResult.processingTime
    };

    const auditLogPath = path.join(this.logDir, `audit_${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(auditLogPath, JSON.stringify(auditEntry) + '\n');

    this.info('Verification audit logged', {
      tweetId: tweetData.id,
      verdict: verificationResult.verdict,
      confidence: verificationResult.confidence
    });
  }

  writeToFile(logEntry) {
    try {
      const logFileName = `app_${new Date().toISOString().split('T')[0]}.log`;
      const logPath = path.join(this.logDir, logFileName);
      fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  getAuditLogs(date = null) {
    if (!this.enableAuditLogging) {
      return { error: 'Audit logging is disabled' };
    }

    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const auditLogPath = path.join(this.logDir, `audit_${targetDate}.log`);

      if (!fs.existsSync(auditLogPath)) {
        return { logs: [], message: `No audit logs found for ${targetDate}` };
      }

      const logContent = fs.readFileSync(auditLogPath, 'utf8');
      const logs = logContent.trim().split('\n').map(line => JSON.parse(line));

      return { logs, count: logs.length };
    } catch (error) {
      this.error('Failed to retrieve audit logs', { error: error.message, date });
      return { error: 'Failed to retrieve audit logs' };
    }
  }
}

module.exports = new Logger();