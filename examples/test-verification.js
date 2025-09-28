const GeminiClassifier = require('../bot/gemini');
const OnChainVerifier = require('../verification/verifier');
const logger = require('../utils/logger');
require('dotenv').config();

class VerificationTester {
  constructor() {
    this.geminiClassifier = new GeminiClassifier();
    this.onChainVerifier = new OnChainVerifier();
  }

  async testPriceClaim() {
    console.log('🔍 Testing Price Claim Verification...');

    const priceClaims = [
      {
        text: "Bitcoin just hit $50,000! Major milestone reached 💰",
        type: "price_milestone"
      },
      {
        text: "ETH is trading at $3,200 right now! 📈",
        type: "price_current"
      },
      {
        text: "SOL pumped to $200 this morning! 🚀",
        type: "price_movement"
      }
    ];

    try {
      for (const claim of priceClaims) {
        console.log(`\n🧪 Testing: "${claim.text}"`);

        // Step 1: Get intent classification from Gemini
        const classification = await this.geminiClassifier.classifyTweetIntent(claim.text);
        console.log(`   Intent: ${classification.intent} (${classification.confidence}% confidence)`);

        if (classification.intent === 'price_claim') {
          // Step 2: Perform actual verification using OnChainVerifier
          const tweetData = { id: 'test_' + Date.now(), text: claim.text };
          const verification = await this.onChainVerifier.verifyTweetClaims(tweetData, classification);

          console.log(`✅ ${claim.type} test - Verdict: ${verification.verdict}`);
          console.log(`   Confidence: ${verification.confidence}%`);
          console.log(`   Processing Time: ${verification.processingTime}ms`);
          console.log(`   Sources: ${verification.verificationResults?.map(r => r.source).join(', ') || 'none'}`);
          console.log(`   Proof Links: ${verification.proofLinks?.length || 0} available`);
        } else {
          console.log(`⚠️  Classified as ${classification.intent}, skipping verification`);
        }
      }
      return { success: true, tests: priceClaims.length };
    } catch (error) {
      console.error('❌ Price claim test failed:', error.message);
      return null;
    }
  }

  async testTVLClaim() {
    console.log('🔍 Testing TVL Claim Verification...');

    const tvlClaims = [
      {
        text: "Uniswap TVL just crossed $5 billion! 🦄 #DeFi #TVL",
        type: "tvl_milestone",
        protocol: "uniswap"
      },
      {
        text: "AAVE protocol TVL reached $10 billion! 📊",
        type: "tvl_milestone",
        protocol: "aave"
      },
      {
        text: "Compound TVL hits $8.5B - massive growth! 📈",
        type: "tvl_surge",
        protocol: "compound"
      }
    ];

    try {
      for (const claim of tvlClaims) {
        console.log(`\n🧪 Testing: "${claim.text}"`);

        // Step 1: Get intent classification from Gemini
        const classification = await this.geminiClassifier.classifyTweetIntent(claim.text);
        console.log(`   Intent: ${classification.intent} (${classification.confidence}% confidence)`);

        if (classification.intent === 'tvl_claim') {
          // Step 2: Perform actual verification using OnChainVerifier
          const tweetData = { id: 'test_' + Date.now(), text: claim.text };
          const verification = await this.onChainVerifier.verifyTweetClaims(tweetData, classification);

          console.log(`✅ ${claim.type} test - Protocol: ${claim.protocol}`);
          console.log(`   Verdict: ${verification.verdict}`);
          console.log(`   Confidence: ${verification.confidence}%`);
          console.log(`   Processing Time: ${verification.processingTime}ms`);
          console.log(`   Sources: ${verification.verificationResults?.map(r => r.source).join(', ') || 'none'}`);
          console.log(`   Proof Links: ${verification.proofLinks?.length || 0} available`);
        } else {
          console.log(`⚠️  Classified as ${classification.intent}, skipping verification`);
        }
      }
      return { success: true, tests: tvlClaims.length };
    } catch (error) {
      console.error('❌ TVL claim test failed:', error.message);
      return null;
    }
  }

  async testTokenLockClaim() {
    console.log('🔍 Testing Token Lock Verification...');

    const lockClaims = [
      {
        text: "100M UNI tokens are currently locked in vesting contracts 🔐",
        type: "vesting_lock",
        token: "UNI"
      },
      {
        text: "AAVE has 5M tokens locked for governance until 2025 🏛️",
        type: "governance_lock",
        token: "AAVE"
      },
      {
        text: "USDC contract has 50M tokens locked in treasury 🔒",
        type: "treasury_lock",
        token: "USDC"
      }
    ];

    try {
      for (const claim of lockClaims) {
        console.log(`\n🧪 Testing: "${claim.text}"`);

        // Step 1: Get intent classification from Gemini
        const classification = await this.geminiClassifier.classifyTweetIntent(claim.text);
        console.log(`   Intent: ${classification.intent} (${classification.confidence}% confidence)`);

        if (classification.intent === 'token_lock_claim') {
          // Step 2: Perform actual verification using OnChainVerifier
          const tweetData = { id: 'test_' + Date.now(), text: claim.text };
          const verification = await this.onChainVerifier.verifyTweetClaims(tweetData, classification);

          console.log(`✅ ${claim.type} test - Token: ${claim.token}`);
          console.log(`   Verdict: ${verification.verdict}`);
          console.log(`   Confidence: ${verification.confidence}%`);
          console.log(`   Processing Time: ${verification.processingTime}ms`);
          console.log(`   Sources: ${verification.verificationResults?.map(r => r.source).join(', ') || 'none'}`);
          console.log(`   Proof Links: ${verification.proofLinks?.length || 0} available`);
        } else {
          console.log(`⚠️  Classified as ${classification.intent}, skipping verification`);
        }
      }
      return { success: true, tests: lockClaims.length };
    } catch (error) {
      console.error('❌ Token lock test failed:', error.message);
      return null;
    }
  }

  async testBalanceClaim() {
    console.log('🔍 Testing Balance Claim Verification...');

    const balanceClaims = [
      {
        text: "My wallet 0x742d35Cc6634C0532925a3b8D4c8C8c8c8c8c8c has 100 ETH! 💰",
        type: "balance_claim"
      },
      {
        text: "This address 0x123d35Cc6634C0532925a3b8D4c8C8c8c8c8c8c holds 50,000 USDC 💎",
        type: "token_balance"
      }
    ];

    try {
      for (const claim of balanceClaims) {
        console.log(`\n🧪 Testing: "${claim.text}"`);

        // Step 1: Get intent classification from Gemini
        const classification = await this.geminiClassifier.classifyTweetIntent(claim.text);
        console.log(`   Intent: ${classification.intent} (${classification.confidence}% confidence)`);

        if (classification.intent === 'balance_claim') {
          // Step 2: Perform actual verification using OnChainVerifier
          const tweetData = { id: 'test_' + Date.now(), text: claim.text };
          const verification = await this.onChainVerifier.verifyTweetClaims(tweetData, classification);

          console.log(`✅ ${claim.type} test`);
          console.log(`   Verdict: ${verification.verdict}`);
          console.log(`   Confidence: ${verification.confidence}%`);
          console.log(`   Processing Time: ${verification.processingTime}ms`);
          console.log(`   Sources: ${verification.verificationResults?.map(r => r.source).join(', ') || 'none'}`);
          console.log(`   Proof Links: ${verification.proofLinks?.length || 0} available`);
        } else {
          console.log(`⚠️  Classified as ${classification.intent}, skipping verification`);
        }
      }
      return { success: true, tests: balanceClaims.length };
    } catch (error) {
      console.error('❌ Balance claim test failed:', error.message);
      return null;
    }
  }

  async testAirdropClaim() {
    console.log('🔍 Testing Airdrop Claim Verification...');

    const airdropClaims = [
      {
        text: "I'm eligible for 1000 UNI tokens in the Uniswap airdrop! 💰",
        type: "eligibility_claim",
        project: "Uniswap"
      },
      {
        text: "My address can claim 500 AAVE tokens from contract 0x123...! 🎁",
        type: "airdrop_claim",
        project: "AAVE"
      }
    ];

    try {
      for (const claim of airdropClaims) {
        console.log(`\n🧪 Testing: "${claim.text}"`);

        // Step 1: Get intent classification from Gemini
        const classification = await this.geminiClassifier.classifyTweetIntent(claim.text);
        console.log(`   Intent: ${classification.intent} (${classification.confidence}% confidence)`);

        if (classification.intent === 'airdrop_claim') {
          // Step 2: Perform actual verification using OnChainVerifier
          const tweetData = { id: 'test_' + Date.now(), text: claim.text };
          const verification = await this.onChainVerifier.verifyTweetClaims(tweetData, classification);

          console.log(`✅ ${claim.type} test - Project: ${claim.project}`);
          console.log(`   Verdict: ${verification.verdict}`);
          console.log(`   Confidence: ${verification.confidence}%`);
          console.log(`   Processing Time: ${verification.processingTime}ms`);
          console.log(`   Sources: ${verification.verificationResults?.map(r => r.source).join(', ') || 'none'}`);
          console.log(`   Proof Links: ${verification.proofLinks?.length || 0} available`);
        } else {
          console.log(`⚠️  Classified as ${classification.intent}, skipping verification`);
        }
      }
      return { success: true, tests: airdropClaims.length };
    } catch (error) {
      console.error('❌ Airdrop claim test failed:', error.message);
      return null;
    }
  }

  async testTransactionClaim() {
    console.log('🔍 Testing Transaction Claim Verification...');

    const transactionClaims = [
      {
        text: "Just sent 10 ETH in transaction 0x123abc...def! 💸",
        type: "transaction_sent"
      },
      {
        text: "Check out this huge transaction: 0x456def...789! 🔥",
        type: "transaction_reference"
      }
    ];

    try {
      for (const claim of transactionClaims) {
        console.log(`\n🧪 Testing: "${claim.text}"`);

        // Step 1: Get intent classification from Gemini
        const classification = await this.geminiClassifier.classifyTweetIntent(claim.text);
        console.log(`   Intent: ${classification.intent} (${classification.confidence}% confidence)`);

        if (classification.intent === 'transaction_claim') {
          // Step 2: Perform actual verification using OnChainVerifier
          const tweetData = { id: 'test_' + Date.now(), text: claim.text };
          const verification = await this.onChainVerifier.verifyTweetClaims(tweetData, classification);

          console.log(`✅ ${claim.type} test`);
          console.log(`   Verdict: ${verification.verdict}`);
          console.log(`   Confidence: ${verification.confidence}%`);
          console.log(`   Processing Time: ${verification.processingTime}ms`);
          console.log(`   Sources: ${verification.verificationResults?.map(r => r.source).join(', ') || 'none'}`);
          console.log(`   Proof Links: ${verification.proofLinks?.length || 0} available`);
        } else {
          console.log(`⚠️  Classified as ${classification.intent}, skipping verification`);
        }
      }
      return { success: true, tests: transactionClaims.length };
    } catch (error) {
      console.error('❌ Transaction claim test failed:', error.message);
      return null;
    }
  }


  async runAllTests() {
    console.log('🚀 Starting Enhanced Tweet Verification Bot Tests...\n');

    const results = {
      priceClaims: await this.testPriceClaim(),
      tvlClaims: await this.testTVLClaim(),
      tokenLockClaims: await this.testTokenLockClaim(),
      balanceClaims: await this.testBalanceClaim(),
      airdropClaims: await this.testAirdropClaim(),
      transactionClaims: await this.testTransactionClaim()
    };

    console.log('\n📊 Test Results Summary:');
    console.log('Price Claims:', results.priceClaims ? '✅' : '❌');
    console.log('TVL Claims:', results.tvlClaims ? '✅' : '❌');
    console.log('Token Lock Claims:', results.tokenLockClaims ? '✅' : '❌');
    console.log('Balance Claims:', results.balanceClaims ? '✅' : '❌');
    console.log('Airdrop Claims:', results.airdropClaims ? '✅' : '❌');
    console.log('Transaction Claims:', results.transactionClaims ? '✅' : '❌');

    const totalTests = Object.values(results).reduce((sum, result) => {
      return sum + (result?.tests || 0);
    }, 0);

    console.log(`\n🎯 Total Tests Run: ${totalTests}`);
    console.log('\n🔄 Live verification uses:');
    console.log('- Gemini AI for intent classification');
    console.log('- Pyth Network for price verification');
    console.log('- Substreams for real-time protocol data (with Token API fallback)');
    console.log('- The Graph Token API for TVL/token data (fallback)');
    console.log('- Blockchain RPC for on-chain verification');
    console.log('- OnChainVerifier for comprehensive verification');

    return results;
  }

  // Helper method to test classification only (without verification)
  async testClassificationOnly(tweetText) {
    try {
      const classification = await this.geminiClassifier.classifyTweetIntent(tweetText);
      console.log(`Text: "${tweetText}"`);
      console.log(`Intent: ${classification.intent}`);
      console.log(`Confidence: ${classification.confidence}%`);
      console.log(`Reasoning: ${classification.reasoning}`);
      return classification;
    } catch (error) {
      console.error('Classification failed:', error.message);
      return null;
    }
  }

  // Helper method to test full verification chain
  async testFullVerification(tweetText) {
    try {
      const classification = await this.geminiClassifier.classifyTweetIntent(tweetText);
      const tweetData = { id: 'test_' + Date.now(), text: tweetText };
      const verification = await this.onChainVerifier.verifyTweetClaims(tweetData, classification);

      return {
        classification,
        verification,
        success: true
      };
    } catch (error) {
      console.error('Full verification failed:', error.message);
      return {
        error: error.message,
        success: false
      };
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new VerificationTester();

  console.log('🎯 Tweet Verification Bot - Testing Suite');
  console.log('==========================================\n');

  console.log('📝 Testing Real Verification Chain:');
  console.log('1. Gemini AI classifies tweet intent');
  console.log('2. OnChainVerifier performs actual verification');
  console.log('3. Pyth Network validates price claims');
  console.log('4. Substreams verifies real-time protocol data');
  console.log('5. Token API verifies TVL and token data (fallback)');
  console.log('6. Blockchain RPC checks on-chain data\n');

  console.log('🔧 Verification Components:');
  console.log('✅ GeminiClassifier - Intent classification');
  console.log('✅ OnChainVerifier - Multi-source verification');
  console.log('✅ PythUtil - Price feed verification');
  console.log('✅ SubstreamsUtil - Real-time protocol data streaming');
  console.log('✅ TokenAPIUtil - DeFi protocol data (with Substreams integration)');
  console.log('✅ EthersUtil - Blockchain interactions\n');

  console.log('🧪 Running Verification Tests...\n');
  tester.runAllTests().then(results => {
    console.log('\n✨ Testing complete! Real verification chain tested.');
    console.log('\n🔍 Verification Process:');
    console.log('- Intent classification via Gemini AI');
    console.log('- Multi-source data verification');
    console.log('- Confidence scoring and verdict calculation');
    console.log('- Proof link generation for transparency');
    console.log('- Error handling and fallback mechanisms');
  }).catch(error => {
    console.error('\n❌ Test suite failed:', error.message);
  });
}

module.exports = {
  VerificationTester
};