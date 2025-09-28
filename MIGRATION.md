# Migration Guide: Subgraph to Token API/Substreams

This guide helps you migrate from the previous subgraph-based implementation to the new Token API/Substreams integration.

## What's Changed

### 🔄 Core Updates

1. **Subgraph Replacement**: `utils/subgraph.js` now uses The Graph Token API instead of traditional GraphQL subgraph queries
2. **Enhanced Verification**: Added support for TVL, token locks, vesting, and airdrop verification
3. **MCP Integration**: Optional Model Context Protocol support for enhanced AI reasoning
4. **Multi-Chain Expansion**: Improved support for Polygon, Arbitrum, Optimism, Base, BSC, Avalanche

### 📊 New Verification Types

| Type | Description | Data Source |
|------|-------------|-------------|
| `tvl_claim` | Protocol TVL verification | Token API/Substreams |
| `token_lock_claim` | Token locks and vesting | Token API + Contract calls |
| `airdrop_claim` | Airdrop eligibility | Contract calls |

## Configuration Changes

### Environment Variables

#### New Required Variables
```bash
# The Graph Token API (Primary)
GRAPH_TOKEN_API_KEY=your_token_api_key

# MCP Integration (Optional)
ENABLE_MCP_REASONING=false
MCP_SERVER_URL=http://localhost:3001
```

#### Existing Variables (Still Supported)
```bash
# Legacy Graph API (Fallback)
GRAPH_API_KEY=your_graph_api_key
```

### API Response Changes

#### Enhanced Classification Response
```json
{
  "classification": {
    "intent": "tvl_claim",
    "confidence": 88,
    "reasoning": "Tweet contains TVL claim",
    "source": "mcp",                    // NEW: Classification source
    "mcpReasoning": {                   // NEW: Enhanced reasoning
      "explanation": "...",
      "verificationSteps": [...],
      "riskFactors": [...],
      "contextualInfo": {...}
    }
  }
}
```

#### Enhanced Proof Links
```json
{
  "proofLinks": [
    {
      "source": "token_api",
      "url": "https://token-api.thegraph.com/protocols/evm/mainnet/uniswap/tvl",
      "description": "Token API TVL verification"
    }
  ]
}
```

## Breaking Changes

### ⚠️ Breaking Changes

1. **Import Changes**: `SubgraphUtil` is now `TokenAPIUtil` (but maintains backward compatibility)
2. **Method Signatures**: Some internal methods have new parameters for chain support
3. **Response Format**: New fields added to API responses (existing fields unchanged)

### ✅ Backward Compatibility

- All existing API endpoints remain functional
- Existing verification types (`price_claim`, `balance_claim`, etc.) still work
- Legacy environment variables are still supported
- Proof links from previous sources (Pyth, etherscan) still included

## Migration Steps

### 1. Update Environment Configuration

```bash
# Copy your existing .env
cp .env .env.backup

# Add new Token API key
echo "GRAPH_TOKEN_API_KEY=your_new_key" >> .env

# Optional: Enable MCP
echo "ENABLE_MCP_REASONING=true" >> .env
echo "MCP_SERVER_URL=http://localhost:3001" >> .env
```

### 2. Update Dependencies (if needed)

```bash
npm install  # Installs any new dependencies
```

### 3. Test New Features

```bash
# Run the test suite
node examples/test-verification.js

# Test TVL verification
curl -X POST http://localhost:3000/verify/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Uniswap TVL billion", "count": 1}'
```

### 4. Verify Existing Functionality

```bash
# Test existing price verification
curl -X POST http://localhost:3000/verify/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Bitcoin price", "count": 1}'
```

## Performance Improvements

### 🚀 Speed Enhancements

- **24x Faster**: Token API leverages Substreams for improved performance
- **Multi-Chain**: Parallel processing across multiple networks
- **Reduced Latency**: Direct API calls instead of GraphQL queries

### 📈 Data Quality

- **Real-Time**: Substreams provide near real-time data updates
- **Reliability**: Decentralized data extraction with built-in redundancy
- **Accuracy**: Enhanced verification algorithms with multiple data sources

## Testing Your Migration

### 1. Verification Type Tests

```javascript
// Test new TVL verification
const tvlTest = {
  intent: "tvl_claim",
  data: {
    protocol: "uniswap",
    expectedTVL: "5000000000",
    chain: "ethereum"
  }
};

// Test token lock verification
const lockTest = {
  intent: "token_lock_claim",
  data: {
    tokenAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    expectedLocked: "100000000",
    chain: "ethereum"
  }
};
```

### 2. API Response Validation

Check that responses include new fields:
- `classification.source` (gemini/mcp)
- `classification.mcpReasoning` (if enabled)
- `proofLinks` with Token API URLs

### 3. Backward Compatibility Check

Ensure existing integrations still work:
- Price verification via Pyth Network
- Balance verification via blockchain RPC
- Transaction verification

## Troubleshooting

### Common Issues

#### 1. Token API Authentication Errors
```
Error: Token API authentication failed
```
**Solution**: Verify `GRAPH_TOKEN_API_KEY` is correctly set

#### 2. MCP Connection Issues
```
Warning: MCP classification failed, falling back to Gemini
```
**Solution**: Check `MCP_SERVER_URL` or disable MCP with `ENABLE_MCP_REASONING=false`

#### 3. Legacy Endpoints Still Used
```
Warning: Using legacy subgraph endpoint
```
**Solution**: Ensure Token API key is configured correctly

### Performance Monitoring

Monitor these metrics post-migration:
- Verification response times
- Token API rate limits
- Error rates by verification type

## Rollback Plan

If issues arise, you can rollback by:

1. **Disable New Features**:
   ```bash
   ENABLE_MCP_REASONING=false
   # Keep GRAPH_TOKEN_API_KEY for improved performance
   ```

2. **Emergency Rollback**:
   ```bash
   # Remove Token API key to force legacy mode
   # GRAPH_TOKEN_API_KEY=
   ```

## Support

For migration issues:
1. Check the logs: `tail -f logs/app_$(date +%Y-%m-%d).log`
2. Run tests: `node examples/test-verification.js`
3. Review configuration: Ensure all required environment variables are set

## Next Steps

After successful migration:
1. Monitor performance improvements
2. Explore new verification types (TVL, token locks, airdrops)
3. Consider enabling MCP for enhanced reasoning
4. Update any custom integrations to use new response fields