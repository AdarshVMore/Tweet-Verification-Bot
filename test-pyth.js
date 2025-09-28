const PythUtil = require('./utils/pyth');

async function testPythIntegration() {
  console.log('🐍 Testing Pyth Network Integration...\n');

  const pythUtil = new PythUtil();

  // Test 1: Check supported symbols
  console.log('1. Testing supported symbols...');
  const supportedSymbols = pythUtil.getSupportedSymbols();
  console.log('   ✅ Supported symbols:', supportedSymbols.slice(0, 5).join(', '), '...');

  // Test 2: Test getTokenPrice method
  console.log('\n2. Testing getTokenPrice method...');
  try {
    console.log('   🔄 Fetching BTC price...');
    const btcPrice = await pythUtil.getTokenPrice('BTC');
    if (btcPrice) {
      console.log('   ✅ BTC Price retrieved successfully');
      console.log('   📊 Price:', btcPrice.price.toFixed(2));
      console.log('   📊 Confidence:', btcPrice.confidence.toFixed(2));
      console.log('   📊 Timestamp:', btcPrice.timestamp);
    } else {
      console.log('   ❌ No BTC price data returned');
    }
  } catch (error) {
    console.log('   ❌ BTC price fetch failed:', error.message);
  }

  // Test 3: Test getCurrentPrice method
  console.log('\n3. Testing getCurrentPrice method...');
  try {
    console.log('   🔄 Fetching ETH current price...');
    const ethPrice = await pythUtil.getCurrentPrice('ETH/USD');
    if (ethPrice) {
      console.log('   ✅ ETH Price retrieved successfully');
      console.log('   📊 Price:', ethPrice.price.toFixed(2));
      console.log('   📊 Confidence:', ethPrice.confidence.toFixed(2));
      console.log('   📊 Timestamp:', new Date(ethPrice.timestamp * 1000).toISOString());
    } else {
      console.log('   ❌ No ETH price data returned');
    }
  } catch (error) {
    console.log('   ❌ ETH price fetch failed:', error.message);
  }

  // Test 4: Test getPriceFeeds method
  console.log('\n4. Testing getPriceFeeds method...');
  try {
    console.log('   🔄 Fetching multiple price feeds...');
    const priceFeeds = await pythUtil.getPriceFeeds(['BTC/USD', 'ETH/USD']);
    if (priceFeeds && priceFeeds.length > 0) {
      console.log('   ✅ Price feeds retrieved successfully');
      console.log('   📊 Number of feeds:', priceFeeds.length);
      priceFeeds.forEach(feed => {
        const price = parseFloat(feed.price.value) * Math.pow(10, feed.price.expo);
        console.log(`   📊 ${feed.symbol}: $${price.toFixed(2)}`);
      });
    } else {
      console.log('   ❌ No price feeds returned');
    }
  } catch (error) {
    console.log('   ❌ Price feeds fetch failed:', error.message);
  }

  console.log('\n🎉 Pyth integration testing completed!');
  console.log('\n📋 Summary:');
  console.log('   • API Endpoint: https://hermes.pyth.network/api/latest_price_feeds');
  console.log('   • Authentication: None required (public endpoint)');
  console.log('   • Price IDs: Using correct hex format');
  console.log('   • Response Format: Hermes API compatible');
  console.log('   • Rate Limiting: 334ms delay between requests');
}

// Run the test
testPythIntegration().catch(console.error);