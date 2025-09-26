const axios = require('axios');
require('dotenv').config();

class PythUtil {
  constructor() {
    this.endpoint = process.env.PYTH_ENDPOINT || 'https://hermes.pyth.network';
    this.priceIds = {
      'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
      'MATIC/USD': '0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52',
      'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
      'LINK/USD': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
      'UNI/USD': '0x78d185a741d07edb3aeb9547aa6e684ec8abd7031daf4546ba8d5b21e3f00e8f',
      'AAVE/USD': '0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445'
    };
  }

  async getPriceFeeds(symbols = []) {
    try {
      const priceIds = symbols.length > 0
        ? symbols.map(symbol => this.priceIds[symbol]).filter(Boolean)
        : Object.values(this.priceIds);

      const response = await axios.get(`${this.endpoint}/api/latest_price_feeds`, {
        params: {
          ids: priceIds,
          verbose: true
        }
      });

      return response.data.map(feed => ({
        id: feed.id,
        price: {
          value: feed.price.price,
          conf: feed.price.conf,
          expo: feed.price.expo,
          publishTime: feed.price.publish_time
        },
        emaPrice: {
          value: feed.ema_price.price,
          conf: feed.ema_price.conf,
          expo: feed.ema_price.expo,
          publishTime: feed.ema_price.publish_time
        },
        symbol: this.getSymbolFromId(feed.id)
      }));
    } catch (error) {
      throw new Error(`Failed to get Pyth price feeds: ${error.message}`);
    }
  }

  async getHistoricalPrices(symbol, startTime, endTime) {
    try {
      const priceId = this.priceIds[symbol];
      if (!priceId) {
        throw new Error(`Price ID not found for symbol: ${symbol}`);
      }

      const response = await axios.get(`${this.endpoint}/api/get_price_feed`, {
        params: {
          id: priceId,
          start_time: startTime,
          end_time: endTime
        }
      });

      return response.data.map(entry => ({
        timestamp: entry.metadata.timestamp,
        price: {
          value: entry.price.price,
          conf: entry.price.conf,
          expo: entry.price.expo
        },
        symbol
      }));
    } catch (error) {
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

      const actualPrice = closestPrice.price.value * Math.pow(10, closestPrice.price.expo);
      const priceDifference = Math.abs(actualPrice - expectedPrice) / expectedPrice;

      return {
        verified: priceDifference <= tolerance,
        expectedPrice,
        actualPrice,
        priceDifference: priceDifference * 100, // percentage
        tolerance: tolerance * 100, // percentage
        timestamp: closestPrice.timestamp,
        confidence: closestPrice.price.conf * Math.pow(10, closestPrice.price.expo)
      };
    } catch (error) {
      throw new Error(`Failed to verify price: ${error.message}`);
    }
  }

  getSymbolFromId(priceId) {
    return Object.keys(this.priceIds).find(symbol => this.priceIds[symbol] === priceId) || 'UNKNOWN';
  }

  getSupportedSymbols() {
    return Object.keys(this.priceIds);
  }
}

module.exports = PythUtil;