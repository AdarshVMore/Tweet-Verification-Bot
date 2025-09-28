const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
require('dotenv').config();

class GeminiClassifier {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    this.mcpEnabled = process.env.ENABLE_MCP_REASONING === 'true';
    this.mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3001';

    // Rate limiting for Gemini API (15 requests per minute for free tier)
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.rateLimitWindow = 60000; // 1 minute
    this.maxRequestsPerWindow = 12; // Conservative limit
  }

  async classifyTweetIntent(tweetText, tweetAuthor = null, tweetMetadata = {}) {
    try {
      logger.debug('Classifying tweet intent', {
        tweetText: tweetText.substring(0, 100) + '...',
        author: tweetAuthor
      });

      let parsedIntent;

      if (this.mcpEnabled) {
        parsedIntent = await this.classifyWithMCP(tweetText, tweetAuthor, tweetMetadata);
      } else {
        parsedIntent = await this.classifyWithGeminiRetry(tweetText, tweetAuthor, tweetMetadata);
      }

      if (this.mcpEnabled && parsedIntent.intent !== 'not_verifiable') {
        parsedIntent.mcpReasoning = await this.generateMCPReasoning(parsedIntent, tweetText);
      }

      logger.info('Tweet intent classified', {
        intent: parsedIntent.intent,
        confidence: parsedIntent.confidence,
        mcpEnabled: this.mcpEnabled
      });

      return parsedIntent;

    } catch (error) {
      logger.error('Failed to classify tweet intent', { error: error.message });

      logger.warn('Using fallback classification due to error');
      return this.createFallbackIntent(tweetText);
    }
  }

  async checkRateLimit() {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - this.lastRequestTime > this.rateLimitWindow) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // Check if we're at the limit
    if (this.requestCount >= this.maxRequestsPerWindow) {
      const waitTime = this.rateLimitWindow - (now - this.lastRequestTime);
      logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }

    this.requestCount++;
  }

  async classifyWithGeminiRetry(tweetText, tweetAuthor, tweetMetadata, maxRetries = 3) {
    const prompt = this.buildClassificationPrompt(tweetText, tweetAuthor, tweetMetadata);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check rate limit before making request
        await this.checkRateLimit();

        logger.debug(`Gemini classification attempt ${attempt}/${maxRetries}`);

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return this.parseGeminiResponse(text);

      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isQuotaError = error.message.includes('429') ||
                            error.message.includes('quota') ||
                            error.message.includes('rate limit');
        const isRetryableError = error.message.includes('503') ||
                                error.message.includes('Service Unavailable') ||
                                error.message.includes('502') ||
                                error.message.includes('timeout') ||
                                isQuotaError;

        // For quota errors, don't retry - just fail fast
        if (isQuotaError) {
          logger.error(`Gemini classification failed after ${attempt} attempts`, {
            error: error.message,
            isRetryable: false
          });
          throw error;
        }

        if (isRetryableError && !isLastAttempt) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          logger.warn(`Gemini API error (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms`, {
            error: error.message
          });

          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        logger.error(`Gemini classification failed after ${attempt} attempts`, {
          error: error.message,
          isRetryable: isRetryableError
        });

        throw error;
      }
    }
  }

  buildClassificationPrompt(tweetText, tweetAuthor, tweetMetadata) {
    return `
You are an AI system that analyzes tweets to identify verifiable blockchain/crypto claims.

Tweet Text: "${tweetText}"
Author: ${tweetAuthor || 'Unknown'}
Metadata: ${JSON.stringify(tweetMetadata)}

Your task is to classify this tweet and extract verifiable claims. Respond ONLY with a valid JSON object in this exact format:

{
  "intent": "price_claim|balance_claim|transaction_claim|protocol_data_claim|tvl_claim|token_lock_claim|airdrop_claim|not_verifiable",
  "confidence": 0-100,
  "data": {
    // Extracted parameters based on intent type
  },
  "reasoning": "Brief explanation of classification"
}

INTENT TYPES AND REQUIRED DATA:

1. "price_claim" - Claims about token/crypto prices
   Required data: { "symbol": "BTC/USD", "price": "50000", "timestamp": 1234567890 }

2. "balance_claim" - Claims about wallet balances
   Required data: { "address": "0x...", "token": "ETH", "balance": "10.5", "network": "ethereum" }

3. "transaction_claim" - Claims about specific transactions
   Required data: { "txHash": "0x...", "network": "ethereum", "expectedData": {...} }

4. "protocol_data_claim" - Claims about DeFi protocol data
   Required data: { "protocol": "aave", "dataType": "pool_data", "expectedValue": "...", "poolAddress": "0x..." }

5. "tvl_claim" - Claims about Total Value Locked in protocols
   Required data: { "protocol": "uniswap", "expectedTVL": "1000000", "chain": "ethereum" }

6. "token_lock_claim" - Claims about locked/vested tokens
   Required data: { "tokenAddress": "0x...", "expectedLocked": "500000", "chain": "ethereum", "lockType": "vesting_contract" }

7. "airdrop_claim" - Claims about airdrops or token distributions
   Required data: { "contractAddress": "0x...", "claimerAddress": "0x...", "expectedAmount": "1000", "chain": "ethereum" }

8. "not_verifiable" - Tweet contains no verifiable blockchain claims
   Required data: {}

EXTRACTION RULES:
- Extract exact numeric values for prices and balances
- Identify token symbols (BTC, ETH, USDC, etc.)
- Detect wallet addresses (0x... format)
- Detect transaction hashes (0x... 64 characters)
- Parse timestamps or use current time if recent claim
- Identify blockchain networks (ethereum, polygon, arbitrum, bsc)
- Confidence should reflect how clear and specific the claim is

IMPORTANT:
- Only return valid JSON, no other text
- Be conservative with confidence scores
- Extract exact values mentioned in the tweet
- Use standard token symbols (BTC/USD, ETH/USD, etc.)
`;
  }

  async classifyWithMCP(tweetText, tweetAuthor, tweetMetadata) {
    try {
      const mcpPayload = {
        method: 'classify_intent',
        params: {
          text: tweetText,
          author: tweetAuthor,
          metadata: tweetMetadata,
          supported_intents: ['price_claim', 'balance_claim', 'transaction_claim', 'protocol_data_claim', 'tvl_claim', 'token_lock_claim', 'airdrop_claim', 'not_verifiable']
        }
      };

      const axios = require('axios');
      const response = await axios.post(`${this.mcpServerUrl}/mcp/classify`, mcpPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      if (response.data && response.data.result) {
        return {
          intent: response.data.result.intent,
          confidence: response.data.result.confidence,
          data: response.data.result.data || {},
          reasoning: response.data.result.reasoning || 'MCP classification',
          timestamp: Date.now(),
          source: 'mcp'
        };
      } else {
        throw new Error('Invalid MCP response format');
      }
    } catch (error) {
      logger.warn('MCP classification failed, falling back to Gemini', { error: error.message });
      const prompt = this.buildClassificationPrompt(tweetText, tweetAuthor, tweetMetadata);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return this.parseGeminiResponse(text);
    }
  }

  async generateMCPReasoning(parsedIntent, tweetText) {
    try {
      const mcpPayload = {
        method: 'generate_reasoning',
        params: {
          intent: parsedIntent.intent,
          data: parsedIntent.data,
          original_text: tweetText,
          confidence: parsedIntent.confidence
        }
      };

      const axios = require('axios');
      const response = await axios.post(`${this.mcpServerUrl}/mcp/reason`, mcpPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      if (response.data && response.data.result) {
        return {
          explanation: response.data.result.explanation,
          verificationSteps: response.data.result.verification_steps || [],
          riskFactors: response.data.result.risk_factors || [],
          contextualInfo: response.data.result.contextual_info || {},
          recommendedActions: response.data.result.recommended_actions || []
        };
      }
      return null;
    } catch (error) {
      logger.warn('MCP reasoning generation failed', { error: error.message });
      return null;
    }
  }

  async queryMCPContext(query, contextType = 'general') {
    try {
      const mcpPayload = {
        method: 'query_context',
        params: {
          query,
          context_type: contextType,
          include_historical: true,
          max_results: 10
        }
      };

      const axios = require('axios');
      const response = await axios.post(`${this.mcpServerUrl}/mcp/context`, mcpPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000
      });

      if (response.data && response.data.result) {
        return response.data.result;
      }
      return null;
    } catch (error) {
      logger.debug('MCP context query failed', { error: error.message, query });
      return null;
    }
  }

  parseGeminiResponse(responseText) {
    try {
      const cleanedResponse = responseText.trim()
        .replace(/```json\s*/, '')
        .replace(/```\s*$/, '')
        .replace(/^[^{]*/, '')
        .replace(/[^}]*$/, '');

      const parsed = JSON.parse(cleanedResponse);

      if (!this.isValidIntent(parsed)) {
        throw new Error('Invalid intent structure from Gemini');
      }

      return {
        intent: parsed.intent,
        confidence: Math.max(0, Math.min(100, parsed.confidence || 0)),
        data: parsed.data || {},
        reasoning: parsed.reasoning || 'No reasoning provided',
        timestamp: Date.now()
      };

    } catch (error) {
      logger.warn('Failed to parse Gemini response, using fallback', {
        error: error.message,
        response: responseText.substring(0, 200)
      });

      return this.createFallbackIntent(responseText);
    }
  }

  isValidIntent(parsed) {
    const validIntents = ['price_claim', 'balance_claim', 'transaction_claim', 'protocol_data_claim', 'tvl_claim', 'token_lock_claim', 'airdrop_claim', 'not_verifiable'];

    return (
      parsed &&
      typeof parsed === 'object' &&
      validIntents.includes(parsed.intent) &&
      typeof parsed.confidence === 'number' &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 100 &&
      typeof parsed.data === 'object'
    );
  }

  createFallbackIntent(responseText) {
    const text = responseText.toLowerCase();

    if (text.includes('airdrop') || text.includes('claim') || text.includes('eligible')) {
      return {
        intent: 'airdrop_claim',
        confidence: 25,
        data: this.extractBasicAirdropData(responseText),
        reasoning: 'Fallback classification - detected airdrop-related content',
        timestamp: Date.now()
      };
    }

    if (text.includes('price') || text.includes('$') || /\d+\s*(btc|eth|usd)/.test(text)) {
      return {
        intent: 'price_claim',
        confidence: 30,
        data: this.extractBasicPriceData(responseText),
        reasoning: 'Fallback classification - detected price-related content',
        timestamp: Date.now()
      };
    }

    if (text.includes('balance') || text.includes('wallet') || text.includes('0x')) {
      return {
        intent: 'balance_claim',
        confidence: 25,
        data: this.extractBasicBalanceData(responseText),
        reasoning: 'Fallback classification - detected balance-related content',
        timestamp: Date.now()
      };
    }

    if (text.includes('transaction') || text.includes('tx') || /0x[a-f0-9]{64}/.test(text)) {
      return {
        intent: 'transaction_claim',
        confidence: 25,
        data: this.extractBasicTransactionData(responseText),
        reasoning: 'Fallback classification - detected transaction-related content',
        timestamp: Date.now()
      };
    }

    if (text.includes('tvl') || text.includes('total value locked') || (text.includes('protocol') && /\d+.*billion/.test(text))) {
      return {
        intent: 'tvl_claim',
        confidence: 30,
        data: this.extractBasicTVLData(responseText),
        reasoning: 'Fallback classification - detected TVL-related content',
        timestamp: Date.now()
      };
    }

    return {
      intent: 'not_verifiable',
      confidence: 80,
      data: {},
      reasoning: 'Fallback classification - no verifiable claims detected',
      timestamp: Date.now()
    };
  }

  extractBasicPriceData(text) {
    const priceMatch = text.match(/\$?(\d+(?:,\d+)*(?:\.\d+)?)/);
    const symbolMatch = text.match(/(BTC|ETH|USDC|USDT|LINK|UNI|AAVE)(?:\/USD)?/i);

    return {
      symbol: symbolMatch ? `${symbolMatch[1].toUpperCase()}/USD` : 'BTC/USD',
      price: priceMatch ? priceMatch[1].replace(/,/g, '') : '0',
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  extractBasicBalanceData(text) {
    const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);
    const balanceMatch = text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(ETH|BTC|USDC|USDT|UNI|AAVE|LINK)?/i);

    return {
      address: addressMatch ? addressMatch[1] : '0x742d35Cc6634C0532925a3b8D4c8C8c8c8c8c8c',  // Default test address
      token: balanceMatch && balanceMatch[2] ? balanceMatch[2].toUpperCase() : 'ETH',
      balance: balanceMatch ? balanceMatch[1].replace(/,/g, '') : '0',
      network: 'ethereum'
    };
  }

  extractBasicTransactionData(text) {
    const txMatch = text.match(/(0x[a-fA-F0-9]{64})/);
    const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(ETH|BTC|USDC|USDT)?/i);

    return {
      txHash: txMatch ? txMatch[1] : '0x123abc456def789012345678901234567890123456789012345678901234567890',  // Default test hash
      network: 'ethereum',
      expectedData: amountMatch ? {
        value: amountMatch[1],
        token: amountMatch[2] || 'ETH'
      } : {}
    };
  }

  extractBasicAirdropData(text) {
    const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);
    const amountMatch = text.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(UNI|AAVE|LINK|ETH|USDC)?/i);
    const contractMatch = text.match(/contract\s+(0x[a-fA-F0-9]{40})/i);

    return {
      contractAddress: contractMatch ? contractMatch[1] : (addressMatch ? addressMatch[1] : '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'), // Default UNI token
      claimerAddress: '0x742d35Cc6634C0532925a3b8D4c8C8c8c8c8c8c', // Default test address
      expectedAmount: amountMatch ? amountMatch[1].replace(/,/g, '') : '1000',
      chain: 'ethereum'
    };
  }

  extractBasicTVLData(text) {
    const tvlMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*(?:billion|million|B|M)/i);
    const protocolMatch = text.match(/(uniswap|aave|compound|maker|curve)/i);

    return {
      protocol: protocolMatch ? protocolMatch[1].toLowerCase() : 'uniswap',
      expectedTVL: tvlMatch ? this.normalizeAmount(tvlMatch[0]) : '1000000000',
      chain: 'ethereum'
    };
  }

  normalizeAmount(amountStr) {
    const amount = parseFloat(amountStr.replace(/[$,]/g, ''));
    if (amountStr.toLowerCase().includes('billion') || amountStr.toLowerCase().includes('b')) {
      return (amount * 1e9).toString();
    }
    if (amountStr.toLowerCase().includes('million') || amountStr.toLowerCase().includes('m')) {
      return (amount * 1e6).toString();
    }
    return amount.toString();
  }

  async batchClassifyTweets(tweets) {
    const results = [];

    for (const tweet of tweets) {
      try {
        const classification = await this.classifyTweetIntent(
          tweet.text,
          tweet.author,
          tweet.metadata
        );

        results.push({
          tweetId: tweet.id,
          classification,
          success: true
        });

      } catch (error) {
        logger.warn('Failed to classify tweet in batch', {
          tweetId: tweet.id,
          error: error.message
        });

        results.push({
          tweetId: tweet.id,
          classification: this.createFallbackIntent(tweet.text),
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  getClassificationStats(classifications) {
    const stats = {
      total: classifications.length,
      by_intent: {},
      avg_confidence: 0,
      success_rate: 0
    };

    let totalConfidence = 0;
    let successCount = 0;

    classifications.forEach(result => {
      const intent = result.classification.intent;
      stats.by_intent[intent] = (stats.by_intent[intent] || 0) + 1;

      totalConfidence += result.classification.confidence;
      if (result.success) successCount++;
    });

    stats.avg_confidence = Math.round(totalConfidence / classifications.length);
    stats.success_rate = Math.round((successCount / classifications.length) * 100);

    return stats;
  }
}

module.exports = GeminiClassifier;