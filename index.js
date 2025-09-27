const express = require('express');
const TweetVerifyBot = require('./bot');
const logger = require('./utils/logger');
require('dotenv').config();

class TweetVerifyBotAPI {
  constructor() {
    this.app = express();
    this.bot = new TweetVerifyBot();
    this.port = process.env.PORT || 3000;

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next();
    });

    this.app.use((err, req, res, next) => {
      logger.error('API Error', { error: err.message, path: req.path });
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
      });
    });
  }

  setupRoutes() {
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Tweet Verification Bot API',
        version: '1.0.0',
        description: 'API for verifying tweets using on-chain sources',
        endpoints: {
          'GET /': 'API information',
          'GET /status': 'Bot status',
          'POST /verify/tweet/:id': 'Verify a single tweet (supports manual text with tweetText in body)',
          'POST /verify/user/:username': 'Verify recent tweets from a user',
          'POST /verify/search': 'Search and verify tweets',
          'GET /stats': 'Verification statistics',
          'GET /config': 'Bot configuration',
          'PUT /config': 'Update bot configuration',
          'POST /start': 'Start the bot',
          'POST /stop': 'Stop the bot'
        }
      });
    });

    this.app.get('/status', (req, res) => {
      res.json(this.bot.getStatus());
    });

    this.app.post('/verify/tweet/:id', async (req, res) => {
      try {
        const tweetId = req.params.id;
        const includeReply = req.body.reply === true;
        const manualTweetText = req.body.tweetText || null;

        logger.info('Tweet verification requested', { tweetId, includeReply, hasManualText: !!manualTweetText });

        logger.info("1")

        const result = includeReply
          ? await this.bot.verifyTweetAndReply(tweetId, manualTweetText)
          : await this.bot.verifyTweet(tweetId, manualTweetText);

          console.log("2", result)

        if (!result) {
          return res.status(404).json({
            error: 'Tweet not verifiable',
            message: 'Tweet does not contain verifiable claims or was already processed'
          });
        }

        res.json({
          success: true,
          data: this.formatVerificationResponse(result)
        });

      } catch (error) {
        logger.error('Tweet verification API error', { error: error.message });
        res.status(400).json({
          error: 'Verification failed',
          message: error.message
        });
      }
    });

    this.app.post('/verify/user/:username', async (req, res) => {
      try {
        const username = req.params.username;
        const count = parseInt(req.body.count) || 10;

        logger.info('User tweets verification requested', { username, count });

        const results = await this.bot.verifyUserTweets(username, count);

        res.json({
          success: true,
          data: {
            username,
            verifiedTweets: results.length,
            results: results.map(result => this.formatVerificationResponse(result))
          }
        });

      } catch (error) {
        logger.error('User verification API error', { error: error.message });
        res.status(400).json({
          error: 'User verification failed',
          message: error.message
        });
      }
    });

    this.app.post('/verify/search', async (req, res) => {
      try {
        const query = req.body.query;
        const count = parseInt(req.body.count) || 10;

        if (!query) {
          return res.status(400).json({
            error: 'Query required',
            message: 'Search query is required in request body'
          });
        }

        logger.info('Search verification requested', { query, count });

        const results = await this.bot.searchAndVerifyTweets(query, count);

        res.json({
          success: true,
          data: {
            query,
            verifiedTweets: results.length,
            results: results.map(result => this.formatVerificationResponse(result))
          }
        });

      } catch (error) {
        logger.error('Search verification API error', { error: error.message });
        res.status(400).json({
          error: 'Search verification failed',
          message: error.message
        });
      }
    });

    this.app.get('/stats', async (req, res) => {
      try {
        const stats = await this.bot.getVerificationStats();
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('Stats API error', { error: error.message });
        res.status(500).json({
          error: 'Failed to get stats',
          message: error.message
        });
      }
    });

    this.app.get('/config', (req, res) => {
      res.json({
        success: true,
        data: this.bot.getConfig()
      });
    });

    this.app.put('/config', (req, res) => {
      try {
        this.bot.updateConfig(req.body);
        res.json({
          success: true,
          data: this.bot.getConfig()
        });
      } catch (error) {
        logger.error('Config update API error', { error: error.message });
        res.status(400).json({
          error: 'Config update failed',
          message: error.message
        });
      }
    });

    this.app.post('/start', async (req, res) => {
      try {
        if (this.bot.isRunning) {
          return res.status(400).json({
            error: 'Bot already running'
          });
        }

        await this.bot.start();
        res.json({
          success: true,
          message: 'Bot started successfully'
        });
      } catch (error) {
        logger.error('Start bot API error', { error: error.message });
        res.status(500).json({
          error: 'Failed to start bot',
          message: error.message
        });
      }
    });

    this.app.post('/stop', async (req, res) => {
      try {
        await this.bot.stop();
        res.json({
          success: true,
          message: 'Bot stopped successfully'
        });
      } catch (error) {
        logger.error('Stop bot API error', { error: error.message });
        res.status(500).json({
          error: 'Failed to stop bot',
          message: error.message
        });
      }
    });

    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  formatVerificationResponse(result) {
    if (result.error) {
      return {
        tweetId: result.tweetId,
        error: result.error,
        timestamp: result.timestamp
      };
    }

    return {
      tweetId: result.tweetId,
      tweet: {
        text: result.tweetData.text,
        author: result.tweetData.author?.username,
        createdAt: result.tweetData.createdAt,
        metrics: result.tweetData.metrics
      },
      classification: {
        intent: result.classification.intent,
        confidence: result.classification.confidence,
        reasoning: result.classification.reasoning,
        source: result.classification.source || 'gemini',
        mcpReasoning: result.classification.mcpReasoning || null
      },
      verification: {
        verdict: result.verificationResult.verdict,
        confidence: result.verificationResult.confidence,
        processingTime: result.verificationResult.processingTime,
        sources: result.verificationResult.verificationResults?.map(r => ({
          source: r.source,
          verified: r.verified,
          type: r.type
        })) || [],
        proofLinks: result.verificationResult.proofLinks || []
      },
      timestamp: result.timestamp
    };
  }

  async start() {
    try {
      this.server = this.app.listen(this.port, () => {
        logger.info(`Tweet Verify Bot API listening on port ${this.port}`);
        console.log(`🚀 Tweet Verify Bot API running on http://localhost:${this.port}`);
        console.log(`📊 API Documentation: http://localhost:${this.port}`);
      });

      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());

    } catch (error) {
      logger.error('Failed to start API server', { error: error.message });
      throw error;
    }
  }

  async gracefulShutdown() {
    logger.info('Graceful shutdown initiated...');

    if (this.bot.isRunning) {
      await this.bot.stop();
    }

    if (this.server) {
      this.server.close(() => {
        logger.info('API server closed');
        process.exit(0);
      });
    }
  }
}

if (require.main === module) {
  const api = new TweetVerifyBotAPI();
  api.start().catch(error => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

module.exports = TweetVerifyBotAPI;