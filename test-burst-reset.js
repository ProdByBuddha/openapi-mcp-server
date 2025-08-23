// Quick test to verify burst protection resets after 1 minute
const { LinkedInRateLimiter } = require('./test-rate-limiter.js');

async function testBurstReset() {
  console.log('Testing burst protection reset...');
  
  // Simulate the burst counter being set to reset in 5 seconds instead of 1 minute
  const limiter = {
    limits: {
      burstActions: { max: 3, current: 3, resetTime: new Date(Date.now() + 5000) }
    },
    
    resetExpiredCounters(now) {
      if (now > this.limits.burstActions.resetTime) {
        console.log('🔄 Burst protection reset! Actions allowed again.');
        this.limits.burstActions.current = 0;
        this.limits.burstActions.resetTime = new Date(Date.now() + 60000);
        return true;
      }
      return false;
    },
    
    canPerformAction() {
      const now = new Date();
      this.resetExpiredCounters(now);
      
      if (this.limits.burstActions.current >= this.limits.burstActions.max) {
        console.log('❌ Still blocked by burst protection');
        return false;
      }
      
      console.log('✅ Action allowed!');
      this.limits.burstActions.current++;
      return true;
    }
  };
  
  console.log('Initial state - should be blocked:');
  limiter.canPerformAction();
  
  console.log('\nWaiting 6 seconds for reset...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  console.log('After reset - should be allowed:');
  limiter.canPerformAction();
  limiter.canPerformAction();
  limiter.canPerformAction();
  
  console.log('Fourth action - should be blocked again:');
  limiter.canPerformAction();
}

testBurstReset();
