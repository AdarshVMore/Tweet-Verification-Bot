const { GraphQLClient, gql } = require('graphql-request');
require('dotenv').config();

class SubgraphUtil {
  constructor() {
    this.baseURL = 'https://gateway.thegraph.com/api';
    this.hostedServiceURL = 'https://api.thegraph.com/subgraphs/name';

    this.headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (process.env.GRAPH_API_KEY) {
      this.headers['Authorization'] = `Bearer ${process.env.GRAPH_API_KEY}`;
    }

    this.supportedSubgraphs = {
      'uniswap-v3': {
        decentralized: `${this.baseURL}/${process.env.GRAPH_API_KEY}/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`,
        hosted: `${this.hostedServiceURL}/uniswap/uniswap-v3`
      },
      'aave-v3': {
        decentralized: `${this.baseURL}/${process.env.GRAPH_API_KEY}/subgraphs/id/C4ayEZP2yTXRAB8vSaTrgN4m9anTe9Mdm2ViyiAuV9TV`,
        hosted: `${this.hostedServiceURL}/aave/protocol-v3`
      },
      'compound-v3': {
        decentralized: `${this.baseURL}/${process.env.GRAPH_API_KEY}/subgraphs/id/3p5KZFtaPsNnXYNjfkDNNvq6YYibXrVKfuNdvRJvVnNs`,
        hosted: `${this.hostedServiceURL}/compound-v3/compound-v3`
      },
      'ethereum-blocks': {
        decentralized: `${this.baseURL}/${process.env.GRAPH_API_KEY}/subgraphs/id/ELUcwgpm14LKPLrBRuVvPvNKHQ9HvwmtKgKSH6123cr7`,
        hosted: `${this.hostedServiceURL}/blocklytics/ethereum-blocks`
      }
    };

    this.clients = {};
  }

  getClient(subgraphName, useDecentralized = true) {
    const key = `${subgraphName}-${useDecentralized}`;

    if (!this.clients[key]) {
      const subgraphConfig = this.supportedSubgraphs[subgraphName];
      if (!subgraphConfig) {
        throw new Error(`Subgraph ${subgraphName} not supported. Available: ${Object.keys(this.supportedSubgraphs).join(', ')}`);
      }

      const endpoint = useDecentralized && process.env.GRAPH_API_KEY ?
        subgraphConfig.decentralized :
        subgraphConfig.hosted;

      this.clients[key] = new GraphQLClient(endpoint, { headers: this.headers });
    }

    return this.clients[key];
  }

  async queryUniswapV3Pools(options = {}) {
    try {
      const client = this.getClient('uniswap-v3');

      const query = gql`
        query GetPools($first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: String!) {
          pools(
            first: $first
            skip: $skip
            orderBy: $orderBy
            orderDirection: $orderDirection
            where: { totalValueLockedUSD_gt: "1000" }
          ) {
            id
            token0 {
              id
              symbol
              name
              decimals
            }
            token1 {
              id
              symbol
              name
              decimals
            }
            feeTier
            totalValueLockedUSD
            totalValueLockedToken0
            totalValueLockedToken1
            volumeUSD
            txCount
            createdAtTimestamp
            createdAtBlockNumber
          }
        }
      `;

      const variables = {
        first: options.limit || 10,
        skip: options.skip || 0,
        orderBy: options.orderBy || 'totalValueLockedUSD',
        orderDirection: options.orderDirection || 'desc'
      };

      const data = await client.request(query, variables);

      return {
        pools: data.pools.map(pool => ({
          address: pool.id,
          token0: {
            address: pool.token0.id,
            symbol: pool.token0.symbol,
            name: pool.token0.name,
            decimals: pool.token0.decimals
          },
          token1: {
            address: pool.token1.id,
            symbol: pool.token1.symbol,
            name: pool.token1.name,
            decimals: pool.token1.decimals
          },
          fee: pool.feeTier,
          tvlUSD: parseFloat(pool.totalValueLockedUSD),
          volumeUSD: parseFloat(pool.volumeUSD),
          txCount: parseInt(pool.txCount),
          createdAt: new Date(pool.createdAtTimestamp * 1000).toISOString(),
          blockNumber: parseInt(pool.createdAtBlockNumber)
        })),
        timestamp: new Date().toISOString(),
        source: 'uniswap-v3-subgraph'
      };

    } catch (error) {
      throw new Error(`Failed to query Uniswap V3 pools: ${error.message}`);
    }
  }

  async queryAAVEV3Markets(options = {}) {
    try {
      const client = this.getClient('aave-v3');

      const query = gql`
        query GetMarkets($first: Int!) {
          reserves(first: $first, orderBy: totalLiquidity, orderDirection: desc) {
            id
            name
            symbol
            decimals
            underlyingAsset
            totalLiquidity
            availableLiquidity
            totalCurrentVariableDebt
            liquidityRate
            variableBorrowRate
            utilizationRate
            price {
              priceInEth
            }
            lastUpdateTimestamp
          }
        }
      `;

      const variables = {
        first: options.limit || 10
      };

      const data = await client.request(query, variables);

      return {
        markets: data.reserves.map(reserve => ({
          id: reserve.id,
          name: reserve.name,
          symbol: reserve.symbol,
          decimals: parseInt(reserve.decimals),
          underlyingAsset: reserve.underlyingAsset,
          totalLiquidity: parseFloat(reserve.totalLiquidity),
          availableLiquidity: parseFloat(reserve.availableLiquidity),
          totalDebt: parseFloat(reserve.totalCurrentVariableDebt),
          liquidityRate: parseFloat(reserve.liquidityRate),
          borrowRate: parseFloat(reserve.variableBorrowRate),
          utilizationRate: parseFloat(reserve.utilizationRate),
          priceInEth: parseFloat(reserve.price?.priceInEth || 0),
          lastUpdated: new Date(reserve.lastUpdateTimestamp * 1000).toISOString()
        })),
        timestamp: new Date().toISOString(),
        source: 'aave-v3-subgraph'
      };

    } catch (error) {
      throw new Error(`Failed to query AAVE V3 markets: ${error.message}`);
    }
  }

  async queryCompoundV3Markets(options = {}) {
    try {
      const client = this.getClient('compound-v3');

      const query = gql`
        query GetMarkets($first: Int!) {
          markets(first: $first, orderBy: totalSupplyUsd, orderDirection: desc) {
            id
            baseToken {
              symbol
              name
              address
            }
            totalSupplyUsd
            totalBorrowUsd
            utilization
            supplyApr
            borrowApr
            totalReserves
            creationBlockNumber
          }
        }
      `;

      const variables = {
        first: options.limit || 10
      };

      const data = await client.request(query, variables);

      return {
        markets: data.markets.map(market => ({
          id: market.id,
          baseToken: {
            symbol: market.baseToken.symbol,
            name: market.baseToken.name,
            address: market.baseToken.address
          },
          totalSupplyUSD: parseFloat(market.totalSupplyUsd),
          totalBorrowUSD: parseFloat(market.totalBorrowUsd),
          utilization: parseFloat(market.utilization),
          supplyAPR: parseFloat(market.supplyApr),
          borrowAPR: parseFloat(market.borrowApr),
          totalReserves: parseFloat(market.totalReserves),
          createdAtBlock: parseInt(market.creationBlockNumber)
        })),
        timestamp: new Date().toISOString(),
        source: 'compound-v3-subgraph'
      };

    } catch (error) {
      throw new Error(`Failed to query Compound V3 markets: ${error.message}`);
    }
  }

  async queryTokenPrice(tokenAddress, options = {}) {
    try {
      const client = this.getClient('uniswap-v3');

      const query = gql`
        query GetTokenPrice($tokenAddress: String!) {
          token(id: $tokenAddress) {
            id
            symbol
            name
            decimals
            derivedETH
            totalValueLocked
            txCount
            volume
            volumeUSD
          }
          bundle(id: "1") {
            ethPriceUSD
          }
        }
      `;

      const variables = {
        tokenAddress: tokenAddress.toLowerCase()
      };

      const data = await client.request(query, variables);

      if (!data.token) {
        return null;
      }

      const ethPriceUSD = parseFloat(data.bundle?.ethPriceUSD || 0);
      const derivedETH = parseFloat(data.token.derivedETH || 0);
      const priceUSD = derivedETH * ethPriceUSD;

      return {
        address: data.token.id,
        symbol: data.token.symbol,
        name: data.token.name,
        decimals: parseInt(data.token.decimals),
        priceUSD,
        priceETH: derivedETH,
        totalValueLocked: parseFloat(data.token.totalValueLocked),
        volumeUSD: parseFloat(data.token.volumeUSD),
        txCount: parseInt(data.token.txCount),
        timestamp: new Date().toISOString(),
        source: 'uniswap-v3-subgraph'
      };

    } catch (error) {
      throw new Error(`Failed to query token price: ${error.message}`);
    }
  }

  async queryBlockData(blockNumber = null, options = {}) {
    try {
      const client = this.getClient('ethereum-blocks');

      const query = blockNumber ? gql`
        query GetBlock($blockNumber: String!) {
          block(id: $blockNumber) {
            id
            number
            timestamp
            parentHash
            gasUsed
            gasLimit
            difficulty
            totalDifficulty
            size
            transactionCount
          }
        }
      ` : gql`
        query GetLatestBlocks($first: Int!) {
          blocks(first: $first, orderBy: timestamp, orderDirection: desc) {
            id
            number
            timestamp
            parentHash
            gasUsed
            gasLimit
            difficulty
            totalDifficulty
            size
            transactionCount
          }
        }
      `;

      const variables = blockNumber ?
        { blockNumber: blockNumber.toString() } :
        { first: options.limit || 10 };

      const data = await client.request(query, variables);

      const blocks = blockNumber ? [data.block] : data.blocks;

      if (!blocks || (blockNumber && !data.block)) {
        return null;
      }

      return blocks.filter(Boolean).map(block => ({
        number: parseInt(block.number),
        hash: block.id,
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        parentHash: block.parentHash,
        gasUsed: parseInt(block.gasUsed),
        gasLimit: parseInt(block.gasLimit),
        difficulty: block.difficulty,
        totalDifficulty: block.totalDifficulty,
        size: parseInt(block.size),
        transactionCount: parseInt(block.transactionCount),
        source: 'ethereum-blocks-subgraph'
      }));

    } catch (error) {
      throw new Error(`Failed to query block data: ${error.message}`);
    }
  }

  async customQuery(subgraphName, query, variables = {}, options = {}) {
    try {
      const client = this.getClient(subgraphName, options.useDecentralized);
      const data = await client.request(query, variables);

      return {
        data,
        timestamp: new Date().toISOString(),
        source: `${subgraphName}-subgraph`
      };

    } catch (error) {
      throw new Error(`Failed to execute custom query on ${subgraphName}: ${error.message}`);
    }
  }

  getSupportedSubgraphs() {
    return Object.keys(this.supportedSubgraphs);
  }

  getSubgraphEndpoint(subgraphName, useDecentralized = true) {
    const subgraphConfig = this.supportedSubgraphs[subgraphName];
    if (!subgraphConfig) {
      throw new Error(`Subgraph ${subgraphName} not supported`);
    }

    return useDecentralized && process.env.GRAPH_API_KEY ?
      subgraphConfig.decentralized :
      subgraphConfig.hosted;
  }
}

module.exports = SubgraphUtil;