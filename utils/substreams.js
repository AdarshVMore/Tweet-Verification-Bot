const axios = require('axios');
require('dotenv').config();

class SubstreamsUtil {
  constructor() {
    this.endpoint = process.env.SUBSTREAMS_ENDPOINT || 'https://mainnet.eth.streamingfast.io:443';
    this.apiToken = process.env.STREAMINGFAST_API_TOKEN || process.env.GRAPH_API_KEY;
    this.client = null;

    this.supportedPackages = {
      'uniswap-v3': {
        packageUrl: 'https://github.com/streamingfast/substreams-uniswap-v3/releases/download/v0.2.8/substreams-uniswap-v3-v0.2.8.spkg',
        module: 'map_pools_created'
      },
      'ethereum-blocks': {
        packageUrl: 'https://github.com/streamingfast/substreams-ethereum/releases/download/v0.1.0/substreams-ethereum-v0.1.0.spkg',
        module: 'map_block_meta'
      }
    };

    this.supportedChains = {
      ethereum: 'mainnet',
      polygon: 'polygon',
      arbitrum: 'arbitrum-one',
      optimism: 'optimism',
      base: 'base',
      bsc: 'bsc'
    };
  }

  async initialize() {
    try {
      if (!this.apiToken) {
        console.warn('STREAMINGFAST_API_TOKEN or GRAPH_API_KEY not configured - Substreams will be disabled');
        return false;
      }

      this.client = {
        endpoint: this.endpoint,
        token: this.apiToken,
        initialized: true
      };

      return true;
    } catch (error) {
      throw new Error(`Failed to initialize Substreams client: ${error.message}`);
    }
  }

  async streamData(packageName, options = {}) {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        console.warn('Substreams not available - API token not configured');
        return null;
      }

      const packageInfo = this.supportedPackages[packageName];
      if (!packageInfo) {
        throw new Error(`Package ${packageName} not supported. Available: ${Object.keys(this.supportedPackages).join(', ')}`);
      }

      console.warn('Substreams functionality not fully implemented - returning mock data for development');

      // Return mock data structure for development/testing
      return [{
        blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
        timestamp: new Date().toISOString(),
        data: {
          pools: [{
            id: '0x' + Math.random().toString(16).substr(2, 40),
            totalValueLockedUSD: (Math.random() * 1000000).toString(),
            volumeUSD: (Math.random() * 100000).toString(),
            token0: { symbol: 'ETH' },
            token1: { symbol: 'USDC' },
            feeTier: '3000'
          }]
        },
        cursor: 'mock_cursor_' + Date.now()
      }];

    } catch (error) {
      throw new Error(`Failed to stream data: ${error.message}`);
    }
  }

  async getUniswapPoolData(options = {}) {
    try {
      const streamData = await this.streamData('uniswap-v3', {
        startBlock: options.startBlock || -100,
        stopBlock: options.stopBlock || 0
      });

      if (!streamData || streamData.length === 0) {
        return null;
      }

      const pools = [];
      let totalTVL = 0;

      streamData.forEach(block => {
        if (block.data && block.data.pools) {
          block.data.pools.forEach(pool => {
            const poolTVL = parseFloat(pool.totalValueLockedUSD || 0);
            totalTVL += poolTVL;

            pools.push({
              address: pool.id,
              token0: pool.token0?.symbol,
              token1: pool.token1?.symbol,
              fee: pool.feeTier,
              tvl: poolTVL,
              volume24h: parseFloat(pool.volumeUSD || 0),
              blockNumber: block.blockNumber,
              timestamp: block.timestamp
            });
          });
        }
      });

      return {
        protocol: 'uniswap-v3',
        totalValueLocked: totalTVL,
        pools,
        timestamp: new Date().toISOString(),
        source: 'substreams',
        blockRange: {
          start: Math.min(...streamData.map(d => d.blockNumber)),
          end: Math.max(...streamData.map(d => d.blockNumber))
        }
      };

    } catch (error) {
      throw new Error(`Failed to get Uniswap pool data: ${error.message}`);
    }
  }

  async getBlockData(blockNumber = null, options = {}) {
    try {
      const streamOptions = {
        startBlock: blockNumber || -1,
        stopBlock: blockNumber || 0
      };

      const streamData = await this.streamData('ethereum-blocks', streamOptions);

      if (!streamData || streamData.length === 0) {
        return null;
      }

      return streamData.map(block => ({
        number: block.blockNumber,
        timestamp: block.timestamp,
        hash: block.data?.hash,
        parentHash: block.data?.parentHash,
        gasUsed: block.data?.gasUsed,
        gasLimit: block.data?.gasLimit,
        transactionCount: block.data?.transactionCount || 0,
        source: 'substreams'
      }));

    } catch (error) {
      throw new Error(`Failed to get block data: ${error.message}`);
    }
  }

  decodeSubstreamsData(data) {
    try {
      if (data.mapOutput && data.mapOutput.value) {
        return JSON.parse(new TextDecoder().decode(data.mapOutput.value));
      }
      return data;
    } catch (error) {
      console.warn('Failed to decode substreams data:', error.message);
      return {};
    }
  }

  async close() {
    if (this.client) {
      try {
        this.client = null;
        console.log('Substreams client closed');
      } catch (error) {
        console.warn('Error closing Substreams client:', error.message);
      }
    }
  }

  getSupportedPackages() {
    return Object.keys(this.supportedPackages);
  }

  getSupportedChains() {
    return Object.keys(this.supportedChains);
  }
}

module.exports = SubstreamsUtil;