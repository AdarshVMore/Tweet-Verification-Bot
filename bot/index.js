const TwitterBot = require('./twitter');
const GeminiClassifier = require('./gemini');
const OnChainVerifier = require('../verification/verifier');
const logger = require('../utils/logger');
require('dotenv').config();

class TweetVerifyBot {
  constructor() {
    this.twitterBot = new TwitterBot();
    this.geminiClassifier = new GeminiClassifier();
    this.verifier = new OnChainVerifier();
    this.isRunning = false;
    this.processedTweets = new Set();
    this.config = {
      monitorMentions: true,
      autoReply: true,
      batchProcessing: false,
      maxTweetsPerHour: 100,
      minConfidenceThreshold: 30
    };
  }

  async start() {
    try {
      logger.info('Starting Tweet Verify Bot...');
      this.isRunning = true;

      if (this.config.monitorMentions) {
        await this.startMentionMonitoring();
      }

      logger.info('Tweet Verify Bot started successfully');
      return true;
    } catch (error) {
      logger.error('Failed to start bot', { error: error.message });
      throw error;
    }
  }

  async stop() {
    logger.info('Stopping Tweet Verify Bot...');
    this.isRunning = false;
  }

  async verifyTweet(tweetId, manualTweetText = null) {
    try {
      if (this.processedTweets.has(tweetId)) {
        logger.debug('Tweet already processed', { tweetId });
        return null;
      }

      const tweetData = await this.twitterBot.getTweetById(tweetId, manualTweetText);

      if (!tweetData.metadata.hasCryptoTerms && !tweetData.metadata.hasNumbers) {
        logger.debug('Tweet does not contain crypto-related content', { tweetId });
        return null;
      }

      const classification = await this.geminiClassifier.classifyTweetIntent(
        tweetData.text,
        tweetData.author?.username,
        tweetData.metadata
      );

      if (classification.intent === 'not_verifiable' ||
          classification.confidence < this.config.minConfidenceThreshold) {
        logger.debug('Tweet not verifiable or low confidence', {
          tweetId,
          intent: classification.intent,
          confidence: classification.confidence
        });
        return null;
      }

      const verificationResult = await this.verifier.verifyTweetClaims(tweetData, classification);

      this.processedTweets.add(tweetId);

      const result = {
        tweetId,
        tweetData,
        classification,
        verificationResult,
        timestamp: new Date().toISOString()
      };

      logger.info('Tweet verification completed', {
        tweetId,
        verdict: verificationResult.verdict,
        confidence: verificationResult.confidence
      });

      return result;

    } catch (error) {
      logger.error('Tweet verification failed', { tweetId, error: error.message });
      throw error;
    }
  }

  async verifyTweetAndReply(tweetId, manualTweetText = null) {
    try {
      const result = await this.verifyTweet(tweetId, manualTweetText);

      if (!result) {
        return null;
      }

      if (this.config.autoReply) {
        await this.twitterBot.postVerificationThread(
          tweetId,
          result.verificationResult
        );
      }

      return result;
    } catch (error) {
      logger.error('Failed to verify tweet and reply', { tweetId, error: error.message });
      throw error;
    }
  }

  async batchVerifyTweets(tweetIds) {
    const results = [];

    for (const tweetId of tweetIds) {
      try {
        const result = await this.verifyTweet(tweetId);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        logger.warn('Failed to verify tweet in batch', { tweetId, error: error.message });
        results.push({
          tweetId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  async verifyUserTweets(username, count = 10) {
    try {
      const tweets = await this.twitterBot.getTweetsByUser(username, count);
      const tweetIds = tweets.map(tweet => tweet.id);
      return await this.batchVerifyTweets(tweetIds);
    } catch (error) {
      logger.error('Failed to verify user tweets', { username, error: error.message });
      throw error;
    }
  }

  async startMentionMonitoring() {
    try {
      const stream = await this.twitterBot.monitorMentions(async (tweetData) => {
        if (!this.isRunning) return;

        try {
          logger.info('Received mention', {
            tweetId: tweetData.id,
            author: tweetData.author?.username
          });

          await this.verifyTweetAndReply(tweetData.id);
        } catch (error) {
          logger.error('Failed to process mention', {
            tweetId: tweetData.id,
            error: error.message
          });
        }
      });

      logger.info('Mention monitoring started');
      return stream;
    } catch (error) {
      logger.error('Failed to start mention monitoring', { error: error.message });
      throw error;
    }
  }

  async searchAndVerifyTweets(query, count = 10) {
    try {
      const tweets = await this.twitterBot.searchTweets(query, count);
      const verifiableTweets = tweets.filter(tweet =>
        tweet.metadata.hasCryptoTerms || tweet.metadata.hasNumbers
      );

      const results = [];
      for (const tweet of verifiableTweets) {
        try {
          const result = await this.verifyTweet(tweet.id);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          logger.warn('Failed to verify searched tweet', {
            tweetId: tweet.id,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Failed to search and verify tweets', { query, error: error.message });
      throw error;
    }
  }

  async getVerificationStats() {
    try {
      const auditLogs = logger.getAuditLogs();

      if (auditLogs.error) {
        return { error: auditLogs.error };
      }

      const stats = {
        totalVerifications: auditLogs.logs.length,
        verdictBreakdown: {},
        averageConfidence: 0,
        averageProcessingTime: 0,
        sourceUsage: {},
        successRate: 0
      };

      let totalConfidence = 0;
      let totalProcessingTime = 0;
      let successCount = 0;

      auditLogs.logs.forEach(log => {
        const verdict = log.verificationResult.verdict;
        stats.verdictBreakdown[verdict] = (stats.verdictBreakdown[verdict] || 0) + 1;

        totalConfidence += log.verificationResult.confidence;
        totalProcessingTime += log.verificationResult.processingTime;

        if (verdict !== 'ERROR') {
          successCount++;
        }

        log.verificationResult.verificationResults?.forEach(result => {
          stats.sourceUsage[result.source] = (stats.sourceUsage[result.source] || 0) + 1;
        });
      });

      if (auditLogs.logs.length > 0) {
        stats.averageConfidence = Math.round(totalConfidence / auditLogs.logs.length);
        stats.averageProcessingTime = Math.round(totalProcessingTime / auditLogs.logs.length);
        stats.successRate = Math.round((successCount / auditLogs.logs.length) * 100);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get verification stats', { error: error.message });
      return { error: 'Failed to get verification stats' };
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Bot configuration updated', { config: this.config });
  }

  getConfig() {
    return { ...this.config };
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      processedTweets: this.processedTweets.size,
      config: this.config,
      uptime: process.uptime()
    };
  }
}

module.exports = TweetVerifyBot;