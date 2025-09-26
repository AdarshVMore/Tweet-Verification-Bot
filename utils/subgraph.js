const axios = require('axios');
require('dotenv').config();

class TokenAPIUtil {
  constructor() {
    this.baseURL = 'https://token-api.thegraph.com';
    this.substreamsEndpoint = 'https://api.substreams.dev';

    this.headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (process.env.GRAPH_TOKEN_API_KEY) {
      this.headers['Authorization'] = `Bearer ${process.env.GRAPH_TOKEN_API_KEY}`;
    }

    this.supportedChains = {
      ethereum: 'mainnet',
      polygon: 'polygon',
      arbitrum: 'arbitrum',
      optimism: 'optimism',
      base: 'base',
      bsc: 'bsc',
      avalanche: 'avalanche'
    };
  }

  async getTokenPrice(tokenAddress, chain = 'ethereum') {
    try {
      const chainId = this.supportedChains[chain] || 'mainnet';
      const url = `${this.baseURL}/tokens/evm/${chainId}/${tokenAddress}/price`;

      const response = await axios.get(url, { headers: this.headers });

      if (response.data && response.data.data) {
        const priceData = response.data.data;
        return {
          symbol: priceData.symbol,
          name: priceData.name,
          priceUSD: parseFloat(priceData.price_usd || priceData.priceUSD || 0),
          priceETH: parseFloat(priceData.price_eth || priceData.priceETH || 0),
          volume24h: parseFloat(priceData.volume_24h || priceData.volume24h || 0),
          totalSupply: priceData.total_supply || priceData.totalSupply,
          marketCap: parseFloat(priceData.market_cap || priceData.marketCap || 0),
          timestamp: priceData.last_updated || new Date().toISOString(),
          source: 'token_api'
        };
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get token price: ${error.message}`);
    }
  }

  async queryUniswapPrice(tokenAddress, blockNumber = null) {
    return this.getTokenPrice(tokenAddress, 'ethereum');
  }

  async getProtocolTVL(protocol, chain = 'ethereum') {
    try {
      const chainId = this.supportedChains[chain] || 'mainnet';
      const url = `${this.baseURL}/protocols/evm/${chainId}/${protocol}/tvl`;

      const response = await axios.get(url, { headers: this.headers });

      if (response.data && response.data.data) {
        const tvlData = response.data.data;
        return {
          protocol,
          chain,
          totalValueLocked: parseFloat(tvlData.total_value_locked || tvlData.tvl || 0),
          tokens: tvlData.tokens || [],
          pools: tvlData.pools || [],
          timestamp: tvlData.last_updated || new Date().toISOString(),
          source: 'token_api'
        };
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get protocol TVL: ${error.message}`);
    }
  }

  async queryAAVEPoolData(poolAddress) {
    return this.getProtocolTVL('aave', 'ethereum');
  }

  async getTokenBalances(walletAddress, chain = 'ethereum') {
    try {
      const chainId = this.supportedChains[chain] || 'mainnet';
      const url = `${this.baseURL}/balances/evm/${chainId}/${walletAddress}`;

      const response = await axios.get(url, { headers: this.headers });

      if (response.data && response.data.data) {
        return {
          address: walletAddress,
          chain,
          balances: response.data.data.balances || [],
          totalValueUSD: parseFloat(response.data.data.total_value_usd || 0),
          timestamp: response.data.data.last_updated || new Date().toISOString(),
          source: 'token_api'
        };
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get token balances: ${error.message}`);
    }
  }

  async queryENSResolver(domain) {
    try {
      const url = `${this.baseURL}/ens/${domain}`;
      const response = await axios.get(url, { headers: this.headers });

      if (response.data && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to query ENS resolver: ${error.message}`);
    }
  }

  async getTokenTransfers(tokenAddress, walletAddress = null, chain = 'ethereum', limit = 10) {
    try {
      const chainId = this.supportedChains[chain] || 'mainnet';
      let url = `${this.baseURL}/transfers/evm/${chainId}/${tokenAddress}`;

      const params = new URLSearchParams();
      if (walletAddress) {
        params.append('address', walletAddress);
      }
      params.append('limit', limit.toString());

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await axios.get(url, { headers: this.headers });

      if (response.data && response.data.data) {
        return {
          tokenAddress,
          transfers: response.data.data.transfers || [],
          totalTransfers: response.data.data.total || 0,
          timestamp: new Date().toISOString(),
          source: 'token_api'
        };
      }
      return [];
    } catch (error) {
      throw new Error(`Failed to get token transfers: ${error.message}`);
    }
  }

  async queryTransactionHistory(userAddress, protocol = 'uniswap', limit = 10) {
    return this.getTokenTransfers(null, userAddress, 'ethereum', limit);
  }

  async getTokenHolders(tokenAddress, chain = 'ethereum', limit = 10) {
    try {
      const chainId = this.supportedChains[chain] || 'mainnet';
      const url = `${this.baseURL}/holders/evm/${chainId}/${tokenAddress}?limit=${limit}`;

      const response = await axios.get(url, { headers: this.headers });

      if (response.data && response.data.data) {
        return {
          tokenAddress,
          chain,
          holders: response.data.data.holders || [],
          totalHolders: response.data.data.total || 0,
          timestamp: new Date().toISOString(),
          source: 'token_api'
        };
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get token holders: ${error.message}`);
    }
  }

  async getTokenLocks(tokenAddress, chain = 'ethereum') {
    try {
      const chainId = this.supportedChains[chain] || 'mainnet';
      const url = `${this.baseURL}/locks/evm/${chainId}/${tokenAddress}`;

      const response = await axios.get(url, { headers: this.headers });

      if (response.data && response.data.data) {
        return {
          tokenAddress,
          chain,
          locks: response.data.data.locks || [],
          totalLocked: parseFloat(response.data.data.total_locked || 0),
          timestamp: new Date().toISOString(),
          source: 'token_api'
        };
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get token locks: ${error.message}`);
    }
  }

  async queryCustomTokenAPI(endpoint, params = {}) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await axios.get(url, {
        headers: this.headers,
        params
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to query custom Token API endpoint: ${error.message}`);
    }
  }

  async queryCustomSubgraph(endpoint, query, variables = {}) {
    return this.queryCustomTokenAPI(endpoint, variables);
  }

  getProofLink(endpoint, tokenAddress, chain = 'ethereum') {
    const chainId = this.supportedChains[chain] || 'mainnet';
    return `${this.baseURL}${endpoint}/evm/${chainId}/${tokenAddress}`;
  }

  getTokenAPIEndpoint(tokenAddress, chain = 'ethereum') {
    return this.getProofLink('/tokens', tokenAddress, chain);
  }

  getTVLEndpoint(protocol, chain = 'ethereum') {
    const chainId = this.supportedChains[chain] || 'mainnet';
    return `${this.baseURL}/protocols/evm/${chainId}/${protocol}/tvl`;
  }
}

module.exports = TokenAPIUtil;