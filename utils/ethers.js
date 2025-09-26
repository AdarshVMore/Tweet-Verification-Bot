const { ethers } = require('ethers');
require('dotenv').config();

class EthersUtil {
  constructor() {
    this.providers = {
      ethereum: new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL),
      polygon: new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL),
      arbitrum: new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL),
      bsc: new ethers.JsonRpcProvider(process.env.BSC_RPC_URL)
    };
  }

  getProvider(network = 'ethereum') {
    return this.providers[network];
  }

  async getTokenBalance(tokenAddress, walletAddress, network = 'ethereum') {
    try {
      const provider = this.getProvider(network);
      const tokenABI = [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
      ];

      const contract = new ethers.Contract(tokenAddress, tokenABI, provider);
      const balance = await contract.balanceOf(walletAddress);
      const decimals = await contract.decimals();
      const symbol = await contract.symbol();

      return {
        balance: ethers.formatUnits(balance, decimals),
        symbol,
        raw: balance.toString(),
        decimals
      };
    } catch (error) {
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }

  async getETHBalance(walletAddress, network = 'ethereum') {
    try {
      const provider = this.getProvider(network);
      const balance = await provider.getBalance(walletAddress);
      return {
        balance: ethers.formatEther(balance),
        symbol: this.getNetworkSymbol(network),
        raw: balance.toString()
      };
    } catch (error) {
      throw new Error(`Failed to get ETH balance: ${error.message}`);
    }
  }

  async getTransactionDetails(txHash, network = 'ethereum') {
    try {
      const provider = this.getProvider(network);
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);

      return {
        transaction: tx,
        receipt: receipt,
        success: receipt.status === 1,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: tx.timestamp
      };
    } catch (error) {
      throw new Error(`Failed to get transaction details: ${error.message}`);
    }
  }

  async getContractData(contractAddress, abi, methodName, params = [], network = 'ethereum') {
    try {
      const provider = this.getProvider(network);
      const contract = new ethers.Contract(contractAddress, abi, provider);
      const result = await contract[methodName](...params);
      return result;
    } catch (error) {
      throw new Error(`Failed to call contract method: ${error.message}`);
    }
  }

  getNetworkSymbol(network) {
    const symbols = {
      ethereum: 'ETH',
      polygon: 'MATIC',
      arbitrum: 'ETH',
      bsc: 'BNB'
    };
    return symbols[network] || 'ETH';
  }

  isValidAddress(address) {
    return ethers.isAddress(address);
  }

  isValidTransactionHash(hash) {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }
}

module.exports = EthersUtil;