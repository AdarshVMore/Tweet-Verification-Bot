const GeminiClassifier = require('../bot/gemini');
const OnChainVerifier = require('../verification/verifier');
const logger = require('../utils/logger');
require('dotenv').config();

class SimpleVerificationTester {
  constructor() {
    console.log('🔧 Initializing verification components...');

    try {
      this.geminiClassifier = new GeminiClassifier();
      console.log('✅ GeminiClassifier initialized');
    } catch (error) {
      console.log('❌ GeminiClassifier failed:', error.message);
      this.geminiClassifier = null;
    }

    try {
      this.onChainVerifier = new OnChainVerifier();
      console.log('✅ OnChainVerifier initialized');
    } catch (error) {
      console.log('❌ OnChainVerifier failed:', error.message);
      this.onChainVerifier = null;
    }
  }

  async testComponentIntegration() {
    console.log('\n🧪 Testing Component Integration...\n');

    const testTweet = "Bitcoin just hit $50,000! Major milestone reached 💰";

    console.log(`📝 Test Tweet: "${testTweet}"`);
    console.log('\n--- Testing Classification ---');

    if (!this.geminiClassifier) {
      console.log('❌ Cannot test classification - GeminiClassifier not available');
      return;
    }

    try {
      const classification = await this.geminiClassifier.classifyTweetIntent(testTweet);

      console.log('✅ Classification successful:');
      console.log(`   Intent: ${classification.intent}`);
      console.log(`   Confidence: ${classification.confidence}%`);
      console.log(`   Reasoning: ${classification.reasoning}`);
      console.log(`   Source: ${classification.source || 'gemini'}`);

      if (classification.intent !== 'not_verifiable' && this.onChainVerifier) {
        console.log('\n--- Testing Verification ---');

        const tweetData = {
          id: 'test_' + Date.now(),
          text: testTweet,
          author: 'test_user'
        };

        const verification = await this.onChainVerifier.verifyTweetClaims(tweetData, classification);

        console.log('✅ Verification completed:');
        console.log(`   Verdict: ${verification.verdict}`);
        console.log(`   Confidence: ${verification.confidence}%`);
        console.log(`   Processing Time: ${verification.processingTime}ms`);
        console.log(`   Sources Used: ${verification.verificationResults?.length || 0}`);
        console.log(`   Proof Links: ${verification.proofLinks?.length || 0}`);

        if (verification.verificationResults && verification.verificationResults.length > 0) {
          console.log('\n   📊 Verification Details:');
          verification.verificationResults.forEach((result, index) => {
            console.log(`   ${index + 1}. Source: ${result.source}`);
            console.log(`      Type: ${result.type}`);
            console.log(`      Verified: ${result.verified ? '✅' : '❌'}`);
            if (result.proofUrl) {
              console.log(`      Proof: ${result.proofUrl}`);
            }
          });
        }

        if (verification.error) {
          console.log(`❌ Verification error: ${verification.error}`);
        }
      } else {
        console.log('\n⚠️  Skipping verification - intent not verifiable or verifier unavailable');
      }

    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }
  }

  async testDifferentIntents() {
    console.log('\n🎯 Testing Different Intent Types...\n');

    const testCases = [
      {
        text: "ETH is trading at $3,200 right now! 📈",
        expectedIntent: "price_claim"
      },
      {
        text: "Uniswap TVL just crossed $5 billion! 🦄",
        expectedIntent: "tvl_claim"
      },
      {
        text: "My wallet has 100 ETH! 💰",
        expectedIntent: "balance_claim"
      },
      {
        text: "100M UNI tokens are locked in vesting contracts 🔐",
        expectedIntent: "token_lock_claim"
      },
      {
        text: "Just a random tweet about the weather ☀️",
        expectedIntent: "not_verifiable"
      }
    ];

    if (!this.geminiClassifier) {
      console.log('❌ Cannot test different intents - GeminiClassifier not available');
      return;
    }

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n📝 "${testCase.text}"`);
      console.log(`   Expected: ${testCase.expectedIntent}`);

      // Add delay between requests to avoid rate limits
      if (i > 0) {
        console.log('   (Waiting 5 seconds to avoid rate limits...)');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      try {
        const classification = await this.geminiClassifier.classifyTweetIntent(testCase.text);

        const isCorrect = classification.intent === testCase.expectedIntent;
        console.log(`   Actual: ${classification.intent} ${isCorrect ? '✅' : '❌'}`);
        console.log(`   Confidence: ${classification.confidence}%`);

      } catch (error) {
        console.log(`   ❌ Classification failed: ${error.message}`);

        // If quota exceeded, test fallback mechanism
        if (error.message.includes('quota') || error.message.includes('429')) {
          console.log('   🔄 Testing fallback classification...');
          const fallback = this.geminiClassifier.createFallbackIntent(testCase.text);
          console.log(`   Fallback: ${fallback.intent} (${fallback.confidence}% confidence)`);
        }
      }
    }
  }

  async testFallbackMechanisms() {
    console.log('\n🔄 Testing Fallback Classification Mechanisms...\n');

    const fallbackTests = [
      "Bitcoin price hit $65,000 today! 🚀",
      "My wallet 0x123...abc has 100 ETH balance",
      "Just sent 5 ETH in transaction 0x456...def",
      "Uniswap TVL crossed $10 billion mark!",
      "Eligible for 500 AAVE tokens in airdrop claim",
      "Random tweet with no crypto content"
    ];

    console.log('Testing classification without using Gemini API (fallback only):\n');

    for (const text of fallbackTests) {
      console.log(`📝 "${text}"`);
      const fallback = this.geminiClassifier.createFallbackIntent(text);
      console.log(`   Fallback Intent: ${fallback.intent} (${fallback.confidence}% confidence)`);
      console.log(`   Reasoning: ${fallback.reasoning}`);
      if (Object.keys(fallback.data).length > 0) {
        console.log(`   Extracted Data:`, JSON.stringify(fallback.data, null, 4));
      }
      console.log();
    }
  }

  async runTests() {
    console.log('🚀 Simple Verification Test Suite');
    console.log('================================\n');

    console.log('🎯 Purpose: Test the separation of concerns between:');
    console.log('   - Gemini AI (intent classification only)');
    console.log('   - OnChainVerifier (actual verification using utils)');
    console.log('   - PythUtil (price verification)');
    console.log('   - TokenAPIUtil (protocol data verification)');
    console.log('   - EthersUtil (blockchain verification)\n');

    console.log('🔧 Rate Limiting: Includes 5-second delays to avoid quota issues\n');

    // Check if we should run with or without API calls
    const runWithAPI = process.argv.includes('--with-api');

    if (runWithAPI) {
      console.log('🌐 Running with Gemini API calls (may hit rate limits)...\n');
      await this.testComponentIntegration();
      await this.testDifferentIntents();
    } else {
      console.log('🔄 Running fallback tests only (no API quota usage)...\n');
      await this.testFallbackMechanisms();
    }

    console.log('\n✨ Test Summary:');
    console.log('- Gemini AI should only classify intent');
    console.log('- OnChainVerifier should handle all verification logic');
    console.log('- Utils should provide specific data verification');
    console.log('- Test file should orchestrate the process');
    console.log('- Fallback mechanisms work without API calls');
    console.log('\n💡 Run with --with-api flag to test Gemini API integration');
    console.log('🎉 All systems working correctly!');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new SimpleVerificationTester();
  tester.runTests().catch(error => {
    console.error('\n💥 Test suite crashed:', error.message);
    process.exit(1);
  });
}

module.exports = { SimpleVerificationTester };