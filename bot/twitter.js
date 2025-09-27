const { TwitterApi } = require('twitter-api-v2');
const logger = require('../utils/logger');
require('dotenv').config();

class TwitterBot {
  constructor() {
    this.client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });

    this.bearerClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
    this.rwClient = this.client.readWrite;
    this.rateLimitRetries = 3;
  }

  async retryWithBackoff(apiCall, maxRetries = 3, baseDelayMs = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isRateLimitError = error.code === 429 ||
                                error.message.includes('429') ||
                                error.message.includes('rate limit');

        if (isRateLimitError && !isLastAttempt) {
          const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 1000;
          const totalDelay = Math.min(delayMs + jitter, 60000);

          logger.warn(`Twitter API rate limit hit (attempt ${attempt}/${maxRetries}), waiting ${Math.round(totalDelay)}ms`, {
            error: error.message
          });

          await new Promise(resolve => setTimeout(resolve, totalDelay));
          continue;
        }

        logger.error(`Twitter API call failed after ${attempt} attempts`, {
          error: error.message,
          isRateLimit: isRateLimitError
        });

        throw error;
      }
    }
  }

  async getTweetById(tweetId, manualTweetText = null) {
    try {
      // COMMENTED OUT: Automatic tweet fetching
      // console.log("Fetching tweet with ID:", tweetId);

      // const tweet = await this.retryWithBackoff(async () => {
      //   return await this.bearerClient.v2.singleTweet(tweetId, {
      //     'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'context_annotations', 'entities'],
      //     'user.fields': ['username', 'name', 'verified', 'public_metrics'],
      //     'expansions': ['author_id']
      //   });
      // }, this.rateLimitRetries);

      // console.log("Fetched tweet:", tweet);

      // return this.formatTweetData(tweet);

      // MANUAL TWEET INPUT MODE
      if (!manualTweetText) {
        throw new Error('Manual tweet text is required when tweet fetching is disabled');
      }

      console.log("Using manual tweet text:", manualTweetText);

      // Create a mock tweet structure for manual input
      const mockTweetData = {
        data: {
          id: tweetId,
          text: manualTweetText,
          author_id: 'manual_user_id',
          created_at: new Date().toISOString(),
          public_metrics: {
            retweet_count: 0,
            like_count: 0,
            reply_count: 0,
            quote_count: 0
          },
          context_annotations: [],
          entities: {}
        },
        includes: {
          users: [{
            id: 'manual_user_id',
            username: 'manual_user',
            name: 'Manual User',
            verified: false,
            public_metrics: {
              followers_count: 0
            }
          }]
        }
      };

      return this.formatTweetData(mockTweetData);
    } catch (error) {
      logger.error('Failed to process tweet', { tweetId, error: error.message });
      throw new Error(`Failed to process tweet: ${error.message}`);
    }
  }

  async getTweetsByUser(username, count = 10) {
    try {
      const user = await this.retryWithBackoff(async () => {
        return await this.bearerClient.v2.userByUsername(username);
      }, this.rateLimitRetries);

      const tweets = await this.retryWithBackoff(async () => {
        return await this.bearerClient.v2.userTimeline(user.data.id, {
          max_results: count,
          'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'context_annotations', 'entities'],
          'user.fields': ['username', 'name', 'verified', 'public_metrics']
        });
      }, this.rateLimitRetries);

      return tweets.data.map(tweet => this.formatTweetData({
        data: tweet,
        includes: { users: [user.data] }
      }));
    } catch (error) {
      logger.error('Failed to fetch user tweets', { username, error: error.message });
      throw new Error(`Failed to fetch user tweets: ${error.message}`);
    }
  }

  async searchTweets(query, count = 10) {
    try {
      const tweets = await this.retryWithBackoff(async () => {
        return await this.bearerClient.v2.search(query, {
          max_results: count,
          'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'context_annotations', 'entities'],
          'user.fields': ['username', 'name', 'verified', 'public_metrics'],
          'expansions': ['author_id']
        });
      }, this.rateLimitRetries);

      if (!tweets.data) {
        return [];
      }

      return tweets.data.map(tweet => this.formatTweetData({
        data: tweet,
        includes: tweets.includes
      }));
    } catch (error) {
      logger.error('Failed to search tweets', { query, error: error.message });
      throw new Error(`Failed to search tweets: ${error.message}`);
    }
  }

  async replyToTweet(tweetId, replyText) {
    try {
      const reply = await this.rwClient.v2.reply(replyText, tweetId);
      logger.info('Replied to tweet', { originalTweetId: tweetId, replyId: reply.data.id });
      return reply.data;
    } catch (error) {
      logger.error('Failed to reply to tweet', { tweetId, error: error.message });
      throw new Error(`Failed to reply to tweet: ${error.message}`);
    }
  }

  async quoteTweet(tweetId, quoteText) {
    try {
      const quote = await this.rwClient.v2.tweet({
        text: quoteText,
        quote_tweet_id: tweetId
      });
      logger.info('Quote tweeted', { originalTweetId: tweetId, quoteId: quote.data.id });
      return quote.data;
    } catch (error) {
      logger.error('Failed to quote tweet', { tweetId, error: error.message });
      throw new Error(`Failed to quote tweet: ${error.message}`);
    }
  }

  async postTweet(text) {
    try {
      const tweet = await this.rwClient.v2.tweet(text);
      logger.info('Posted tweet', { tweetId: tweet.data.id });
      return tweet.data;
    } catch (error) {
      logger.error('Failed to post tweet', { error: error.message });
      throw new Error(`Failed to post tweet: ${error.message}`);
    }
  }

  formatTweetData(tweetResponse) {
    const tweet = tweetResponse.data;
    const author = tweetResponse.includes?.users?.find(user => user.id === tweet.author_id);

    return {
      id: tweet.id,
      text: tweet.text,
      author: author ? {
        id: author.id,
        username: author.username,
        name: author.name,
        verified: author.verified || false,
        followers: author.public_metrics?.followers_count || 0
      } : null,
      metrics: {
        retweets: tweet.public_metrics?.retweet_count || 0,
        likes: tweet.public_metrics?.like_count || 0,
        replies: tweet.public_metrics?.reply_count || 0,
        quotes: tweet.public_metrics?.quote_count || 0
      },
      createdAt: tweet.created_at,
      entities: tweet.entities || {},
      contextAnnotations: tweet.context_annotations || [],
      metadata: {
        hasUrls: !!(tweet.entities?.urls?.length),
        hasMentions: !!(tweet.entities?.mentions?.length),
        hasHashtags: !!(tweet.entities?.hashtags?.length),
        hasNumbers: /\d/.test(tweet.text),
        hasCryptoTerms: this.detectCryptoTerms(tweet.text)
      }
    };
  }

  detectCryptoTerms(text) {
    const cryptoTerms = [
      'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain',
      'defi', 'nft', 'token', 'coin', 'wallet', 'address',
      'transaction', 'tx', 'hash', 'usdc', 'usdt', 'matic',
      'polygon', 'arbitrum', 'optimism', 'avalanche', 'bsc',
      'uniswap', 'aave', 'compound', 'makerdao', 'chainlink',
      'price', 'trading', 'volume', 'liquidity', 'yield',
      'staking', 'farming', 'mining', 'hodl', 'degen'
    ];

    const lowercaseText = text.toLowerCase();
    return cryptoTerms.some(term => lowercaseText.includes(term));
  }

  async getRecentCryptoTweets(count = 50) {
    try {
      const cryptoQueries = [
        'bitcoin OR btc lang:en -is:retweet',
        'ethereum OR eth lang:en -is:retweet',
        'defi OR "decentralized finance" lang:en -is:retweet',
        'crypto OR cryptocurrency lang:en -is:retweet'
      ];

      let allTweets = [];

      for (const query of cryptoQueries) {
        try {
          const tweets = await this.searchTweets(query, Math.ceil(count / cryptoQueries.length));
          allTweets = allTweets.concat(tweets);
        } catch (error) {
          logger.warn('Failed to search with query', { query, error: error.message });
        }
      }

      const uniqueTweets = allTweets.reduce((unique, tweet) => {
        if (!unique.find(t => t.id === tweet.id)) {
          unique.push(tweet);
        }
        return unique;
      }, []);

      return uniqueTweets.slice(0, count);
    } catch (error) {
      logger.error('Failed to get recent crypto tweets', { error: error.message });
      throw new Error(`Failed to get recent crypto tweets: ${error.message}`);
    }
  }

  async monitorMentions(callback) {
    try {
      logger.info('Starting mention monitoring...');

      const stream = await this.client.v2.searchStream({
        'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'context_annotations', 'entities'],
        'user.fields': ['username', 'name', 'verified', 'public_metrics'],
        'expansions': ['author_id']
      });

      stream.on('data', async (tweetResponse) => {
        try {
          const formattedTweet = this.formatTweetData(tweetResponse);
          await callback(formattedTweet);
        } catch (error) {
          logger.error('Error processing mention', { error: error.message });
        }
      });

      stream.on('error', (error) => {
        logger.error('Stream error', { error: error.message });
      });

      return stream;
    } catch (error) {
      logger.error('Failed to start mention monitoring', { error: error.message });
      throw new Error(`Failed to start mention monitoring: ${error.message}`);
    }
  }

  formatVerificationResult(tweetData, verificationResult) {
    let response = '';

    switch (verificationResult.verdict) {
      case 'VERIFIED':
        response = `✅ VERIFIED (${verificationResult.confidence}% confidence)\\n\\n`;
        break;
      case 'PARTIALLY_VERIFIED':
        response = `🟡 PARTIALLY VERIFIED (${verificationResult.confidence}% confidence)\\n\\n`;
        break;
      case 'DISPUTED':
        response = `⚠️ DISPUTED (${verificationResult.confidence}% confidence)\\n\\n`;
        break;
      case 'FALSE':
        response = `❌ FALSE (${verificationResult.confidence}% confidence)\\n\\n`;
        break;
      default:
        response = `❓ UNVERIFIABLE\\n\\n`;
    }

    if (verificationResult.verificationResults?.length > 0) {
      response += 'Sources checked:\\n';
      verificationResult.verificationResults.forEach((result, index) => {
        const status = result.verified ? '✓' : '✗';
        response += `${status} ${result.source}\\n`;
      });
    }

    if (verificationResult.proofLinks?.length > 0) {
      response += '\\n🔗 Proof links in replies';
    }

    response += `\\n\\n⏱️ Verified in ${verificationResult.processingTime}ms`;

    return response;
  }

  async postVerificationThread(originalTweetId, verificationResult) {
    try {
      const mainReply = this.formatVerificationResult(null, verificationResult);
      const mainReplyTweet = await this.replyToTweet(originalTweetId, mainReply);

      if (verificationResult.proofLinks?.length > 0) {
        let proofText = '🔗 Verification sources:\\n\\n';
        verificationResult.proofLinks.forEach((link, index) => {
          proofText += `${index + 1}. ${link.source}: ${link.url}\\n`;
        });

        await this.replyToTweet(mainReplyTweet.id, proofText);
      }

      return mainReplyTweet;
    } catch (error) {
      logger.error('Failed to post verification thread', {
        originalTweetId,
        error: error.message
      });
      throw new Error(`Failed to post verification thread: ${error.message}`);
    }
  }
}

module.exports = TwitterBot;