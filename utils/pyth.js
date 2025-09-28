const axios = require('axios');
require('dotenv').config();

class PythUtil {
  constructor() {
    this.endpoint = process.env.PYTH_ENDPOINT || 'https://hermes.pyth.network';
    this.benchmarkEndpoint = process.env.PYTH_BENCHMARK_ENDPOINT || 'https://benchmarks.pyth.network';
    this.priceIds = {
      'BTC/USD': '0xe62df6c8b4c85fe1d1b7ba3ac8c1c19eab3da4df7e4b00e1be4efbe1e0d0d0a7',
      'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
      'MATIC/USD': '0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52',
      'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
      'LINK/USD': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
      'UNI/USD': '0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501',
      'AAVE/USD': '0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db5a7d6b75d6fcb',
      'BTC': '0xe62df6c8b4c85fe1d1b7ba3ac8c1c19eab3da4df7e4b00e1be4efbe1e0d0d0a7',
      'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      'SOL': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
      'BITCOIN': '0xe62df6c8b4c85fe1d1b7ba3ac8c1c19eab3da4df7e4b00e1be4efbe1e0d0d0a7',
      'ETHEREUM': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
    };
    this.requestDelay = 334; // Rate limit: 30 requests per 10 seconds = ~333ms between requests
  }

  async getPriceFeeds(symbols = []) {
    try {
      const pythSymbols = symbols.length > 0
        ? symbols.map(symbol => this.priceIds[symbol]).filter(Boolean)
        : Object.values(this.priceIds);

      if (pythSymbols.length === 0) {
        throw new Error('No valid symbols found');
      }

      const results = [];

      // Use the correct Hermes API endpoint for latest price feeds
      try {
        const response = await axios.get(`${this.endpoint}/api/latest_price_feeds`, {
          params: {
            ids: pythSymbols
          },
          timeout: 10000
        });

        if (response.data && Array.isArray(response.data)) {
          for (const feed of response.data) {
            if (feed && feed.price) {
              results.push({
                id: feed.id,
                price: {
                  value: feed.price.price,
                  conf: feed.price.conf,
                  expo: feed.price.expo,
                  publishTime: feed.price.publish_time
                },
                emaPrice: {
                  value: feed.ema_price?.price,
                  conf: feed.ema_price?.conf,
                  expo: feed.ema_price?.expo,
                  publishTime: feed.ema_price?.publish_time
                },
                symbol: this.getSymbolFromPriceId(feed.id)
              });
            }
          }
        }
      } catch (apiError) {
        // Fallback: try individual requests if bulk request fails
        for (const pythSymbol of pythSymbols) {
          try {
            const response = await axios.get(`${this.endpoint}/api/latest_price_feeds`, {
              params: {
                ids: [pythSymbol]
              },
              timeout: 10000
            });

            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
              const feed = response.data[0];
              results.push({
                id: feed.id,
                price: {
                  value: feed.price.price,
                  conf: feed.price.conf,
                  expo: feed.price.expo,
                  publishTime: feed.price.publish_time
                },
                emaPrice: {
                  value: feed.ema_price?.price,
                  conf: feed.ema_price?.conf,
                  expo: feed.ema_price?.expo,
                  publishTime: feed.ema_price?.publish_time
                },
                symbol: this.getSymbolFromPriceId(feed.id)
              });
            }
          } catch (symbolError) {
            console.warn(`Failed to get price for ${pythSymbol}:`, symbolError.message);
          }

          // Add delay between requests for rate limiting
          if (this.requestDelay) {
            await new Promise(resolve => setTimeout(resolve, this.requestDelay));
          }
        }
      }

      return results;
    } catch (error) {
      if (error.response) {
        throw new Error(`Pyth API error: ${error.response.status} - ${error.response.data?.message || error.message}`);
      }
      throw new Error(`Failed to get Pyth price feeds: ${error.message}`);
    }
  }

  async getHistoricalPrices(symbol, startTime, endTime) {
    try {
      const pythSymbol = this.priceIds[symbol];
      if (!pythSymbol) {
        throw new Error(`Symbol not found: ${symbol}`);

      
      }

      const response = await axios.get(`${this.benchmarkEndpoint}/v1/shims/tradingview/history`, {
        params: {
          symbol: pythSymbol,
          resolution: '1',
          from: startTime,
          to: endTime
        },
        timeout: 15000
      });


      if (!response.data || !response.data.t) {
        throw new Error('Invalid historical data response format');
      }

      const { t: timestamps, o: opens, h: highs, l: lows, c: closes } = response.data;

      return timestamps.map((timestamp, index) => ({
        timestamp,
        price: {
          value: closes[index],
          open: opens[index],
          high: highs[index],
          low: lows[index],
          expo: 0
        },
        symbol
      }));
    } catch (error) {
      if (error.response) {
        throw new Error(`Pyth benchmarks API error: ${error.response.status} - ${error.response.data?.message || error.message}`);
      }
      throw new Error(`Failed to get historical prices: ${error.message}`);
    }
  }

  async getCurrentPrice(symbol) {
    try {
      const feeds = await this.getPriceFeeds([symbol]);
      if (feeds.length === 0) {
        throw new Error(`Price feed not found for symbol: ${symbol}`);
      }

      const feed = feeds[0];
      const price = feed.price.value * Math.pow(10, feed.price.expo);
      const confidence = feed.price.conf * Math.pow(10, feed.price.expo);

      return {
        symbol,
        price,
        confidence,
        timestamp: feed.price.publishTime,
        priceId: feed.id
      };
    } catch (error) {
      throw new Error(`Failed to get current price for ${symbol}: ${error.message}`);
    }
  }

  async verifyPriceAtTime(symbol, expectedPrice, timestamp, tolerance = 0.05) {
    try {
      const startTime = timestamp - 300; // 5 minutes before
      const endTime = timestamp + 300;   // 5 minutes after

      const historicalPrices = await this.getHistoricalPrices(symbol, startTime, endTime);

      if (historicalPrices.length === 0) {
        return {
          verified: false,
          reason: 'No price data available for the specified time',
          expectedPrice,
          actualPrice: null,
          timestamp
        };
      }

      const closestPrice = historicalPrices.reduce((closest, current) => {
        const currentDiff = Math.abs(current.timestamp - timestamp);
        const closestDiff = Math.abs(closest.timestamp - timestamp);
        return currentDiff < closestDiff ? current : closest;
      });

      const actualPrice = closestPrice.price.value;
      const priceDifference = Math.abs(actualPrice - expectedPrice) / expectedPrice;

      return {
        verified: priceDifference <= tolerance,
        expectedPrice,
        actualPrice,
        priceDifference: priceDifference * 100, // percentage
        tolerance: tolerance * 100, // percentage
        timestamp: closestPrice.timestamp,
        priceRange: {
          open: closestPrice.price.open,
          high: closestPrice.price.high,
          low: closestPrice.price.low,
          close: closestPrice.price.value
        }
      };
    } catch (error) {
      throw new Error(`Failed to verify price: ${error.message}`);
    }
  }

  getSymbolFromPriceId(priceId) {
    const cleanPriceId = priceId.startsWith('0x') ? priceId : `0x${priceId}`;
    return Object.keys(this.priceIds).find(symbol => this.priceIds[symbol] === cleanPriceId) || 'UNKNOWN';
  }

  getSymbolFromId(priceId) {
    return this.getSymbolFromPriceId(priceId);
  }

  getSymbolFromPythSymbol(pythSymbol) {
    return Object.keys(this.priceIds).find(symbol => this.priceIds[symbol] === pythSymbol) || 'UNKNOWN';
  }

  async getTokenPrice(tokenSymbol) {
    try {
      // Normalize token symbol
      const normalizedSymbol = tokenSymbol?.toUpperCase();
      const priceId = this.priceIds[normalizedSymbol] || this.priceIds[`${normalizedSymbol}/USD`];

      if (!priceId) {
        throw new Error(`Price ID not found for token: ${tokenSymbol}`);
      }

      const response = await axios.get(`${this.endpoint}/api/latest_price_feeds`, {
        params: {
          ids: [priceId]
        },
        timeout: 10000
      });

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const feed = response.data[0];
        const price = parseFloat(feed.price.price) * Math.pow(10, feed.price.expo);

        return {
          id: feed.id,
          symbol: tokenSymbol,
          price: price,
          confidence: parseFloat(feed.price.conf) * Math.pow(10, feed.price.expo),
          publishTime: feed.price.publish_time,
          timestamp: new Date(feed.price.publish_time * 1000).toISOString()
        };
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to get token price for ${tokenSymbol}: ${error.message}`);
    }
  }

  getSupportedSymbols() {
    return Object.keys(this.priceIds);
  }
}

module.exports = PythUtil;