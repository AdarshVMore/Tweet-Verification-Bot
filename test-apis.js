const PythUtil = require('./utils/pyth');
const TokenAPIUtil = require('./utils/subgraph');
const SubstreamsUtil = require('./utils/substreams');

async function testAPIs() {
  console.log('🧪 Testing Direct API Calls...\n');

  // Test Pyth Network API
  console.log('📊 Testing Pyth Network API...');
  try {
    const pythUtil = new PythUtil();

    console.log('1. Getting current BTC price...');
    const btcPrice = await pythUtil.getCurrentPrice('BTC/USD');
    console.log(`   ✅ BTC Price: $${btcPrice.price}`);
    console.log(`   ✅ Confidence: ±$${btcPrice.confidence}`);
    console.log(`   ✅ Last Update: ${new Date(btcPrice.timestamp * 1000).toISOString()}`);

    console.log('2. Getting latest price feeds...');
    const priceFeeds = await pythUtil.getPriceFeeds(['BTC/USD', 'ETH/USD']);
    console.log(`   ✅ Got ${priceFeeds.length} price feeds`);

    if (priceFeeds.length > 0) {
      priceFeeds.forEach(feed => {
        const price = feed.price.value * Math.pow(10, feed.price.expo);
        console.log(`   - ${feed.symbol}: $${price.toFixed(2)}`);
      });
    }

    console.log('3. Testing supported symbols...');
    const supportedSymbols = pythUtil.getSupportedSymbols();
    console.log(`   ✅ Supports ${supportedSymbols.length} symbols: ${supportedSymbols.join(', ')}`);

  } catch (error) {
    console.log(`   ❌ Pyth API failed: ${error.message}`);
  }

  console.log('\n🌐 Testing The Graph Token API...');
  try {
    const tokenAPI = new TokenAPIUtil();

    console.log('1. Getting USDC token price...');
    const usdcPrice = await tokenAPI.getTokenPrice('0xA0b86a33E6441Bc0527AE84F6b4DC7e05c21608', 'ethereum');
    console.log(`   ✅ USDC Data:`, usdcPrice);

    console.log('2. Getting Uniswap TVL (with Substreams fallback)...');
    const uniTVL = await tokenAPI.getProtocolTVL('uniswap', 'ethereum');
    console.log(`   ✅ Uniswap TVL:`, uniTVL);
    console.log(`   📊 Data Source: ${uniTVL?.source || 'unknown'}`);

  } catch (error) {
    console.log(`   ❌ Token API failed: ${error.message}`);
  }

  console.log('\n⚡ Testing Substreams Direct API...');
  try {
    const substreamsAPI = new SubstreamsUtil();

    console.log('1. Testing Substreams initialization...');
    await substreamsAPI.initialize();
    console.log(`   ✅ Substreams client initialized`);

    console.log('2. Testing AAVE protocol TVL via Substreams...');
    const aaveTVL = await substreamsAPI.getProtocolTVL('aave', 'ethereum');
    console.log(`   ✅ AAVE TVL:`, aaveTVL);

    console.log('3. Testing Uniswap protocol TVL via Substreams...');
    const uniSubstreamsTVL = await substreamsAPI.getProtocolTVL('uniswap', 'ethereum');
    console.log(`   ✅ Uniswap TVL (Substreams):`, uniSubstreamsTVL);

    await substreamsAPI.close();

  } catch (error) {
    console.log(`   ❌ Substreams API failed: ${error.message}`);
    console.log(`   📝 Note: This is expected if Substreams packages aren't available locally`);
  }

  console.log('\n✨ API Testing Complete!');
}

if (require.main === module) {
  testAPIs().catch(console.error);
}

module.exports = { testAPIs };