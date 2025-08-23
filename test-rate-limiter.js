#!/usr/bin/env node

/**
 * Test script for LinkedIn Rate Limiter and Activity Pattern Manager
 * Simulates behavior without making actual API calls
 */

class LinkedInRateLimiter {
  constructor() {
    this.limits = {
      // Daily limits (24-hour rolling window)
      searches: { max: 100, current: 0, resetTime: this.getResetTime(24) },
      profileViews: { max: 80, current: 0, resetTime: this.getResetTime(24) },
      connectionRequests: { max: 20, current: 0, resetTime: this.getResetTime(24) },
      messages: { max: 50, current: 0, resetTime: this.getResetTime(24) },
      postReactions: { max: 200, current: 0, resetTime: this.getResetTime(24) },
      comments: { max: 30, current: 0, resetTime: this.getResetTime(24) },
      
      // Hourly limits
      hourlySearches: { max: 15, current: 0, resetTime: this.getResetTime(1) },
      hourlyConnections: { max: 5, current: 0, resetTime: this.getResetTime(1) },
      
      // Burst protection (per minute)
      burstActions: { max: 3, current: 0, resetTime: this.getResetTime(1/60) }
    };
    
    this.actionLog = [];
  }
  
  getResetTime(hours) {
    return new Date(Date.now() + (hours * 60 * 60 * 1000));
  }
  
  canPerformAction(actionType) {
    const now = new Date();
    
    // Reset counters if time has passed
    this.resetExpiredCounters(now);
    
    // Check relevant limits based on action type
    const checks = this.getActionChecks(actionType);
    
    for (const check of checks) {
      if (this.limits[check].current >= this.limits[check].max) {
        console.log(`❌ Rate limit exceeded for ${check}: ${this.limits[check].current}/${this.limits[check].max}`);
        return false;
      }
    }
    
    return true;
  }
  
  getActionChecks(actionType) {
    const actionMap = {
      'search': ['searches', 'hourlySearches', 'burstActions'],
      'profile_view': ['profileViews', 'burstActions'],
      'connection': ['connectionRequests', 'hourlyConnections', 'burstActions'],
      'message': ['messages', 'burstActions'],
      'reaction': ['postReactions', 'burstActions'],
      'comment': ['comments', 'burstActions']
    };
    
    return actionMap[actionType] || ['burstActions'];
  }
  
  recordAction(actionType) {
    const now = new Date();
    const checks = this.getActionChecks(actionType);
    
    // Increment relevant counters
    for (const check of checks) {
      this.limits[check].current++;
    }
    
    // Log the action
    this.actionLog.push({
      type: actionType,
      timestamp: now,
      limits: JSON.parse(JSON.stringify(this.limits)) // Deep copy for history
    });
    
    console.log(`✅ Action recorded: ${actionType} (${checks.map(c => `${c}: ${this.limits[c].current}/${this.limits[c].max}`).join(', ')})`);
  }
  
  resetExpiredCounters(now) {
    for (const [key, limit] of Object.entries(this.limits)) {
      if (now > limit.resetTime) {
        const oldCurrent = limit.current;
        limit.current = 0;
        limit.resetTime = this.getResetTime(this.getLimitHours(key));
        
        if (oldCurrent > 0) {
          console.log(`🔄 Reset ${key}: ${oldCurrent} → 0`);
        }
      }
    }
  }
  
  getLimitHours(limitType) {
    if (limitType.startsWith('hourly')) return 1;
    if (limitType === 'burstActions') return 1/60; // 1 minute
    return 24; // Daily limits
  }
  
  getStatus() {
    const now = new Date();
    this.resetExpiredCounters(now);
    
    console.log('\n📊 Current Rate Limit Status:');
    console.log('================================');
    
    for (const [key, limit] of Object.entries(this.limits)) {
      const percentage = Math.round((limit.current / limit.max) * 100);
      const timeLeft = Math.round((limit.resetTime - now) / (1000 * 60)); // minutes
      
      console.log(`${key.padEnd(20)}: ${limit.current.toString().padStart(3)}/${limit.max.toString().padEnd(3)} (${percentage.toString().padStart(3)}%) - Resets in ${timeLeft}m`);
    }
    console.log('================================\n');
  }
}

class ActivityPatternManager {
  constructor() {
    this.workingHours = {
      start: 9,  // 9 AM
      end: 18,   // 6 PM
      timezone: 'America/New_York'
    };
    
    this.activityPatterns = {
      morning: { weight: 0.3, actions: ['search', 'profile_view'] },
      midday: { weight: 0.4, actions: ['connection', 'message'] },
      afternoon: { weight: 0.2, actions: ['reaction', 'comment'] },
      evening: { weight: 0.1, actions: ['search'] }
    };
  }
  
  shouldPerformAction(actionType, testHour = null) {
    const now = new Date();
    const hour = testHour !== null ? testHour : now.getHours();
    
    // Respect working hours
    if (hour < this.workingHours.start || hour > this.workingHours.end) {
      const allowed = Math.random() < 0.1; // 10% chance outside work hours
      console.log(`⏰ Outside working hours (${hour}:00) - Action ${allowed ? 'allowed' : 'blocked'} (10% chance)`);
      return allowed;
    }
    
    // Weekend activity reduction
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    if (isWeekend) {
      const allowed = Math.random() < 0.3; // 30% normal activity on weekends
      console.log(`📅 Weekend detected - Action ${allowed ? 'allowed' : 'blocked'} (30% chance)`);
      return allowed;
    }
    
    // Get time period
    const period = this.getTimePeriod(hour);
    const pattern = this.activityPatterns[period];
    
    // Check if action type is preferred for this time period
    const isPreferred = pattern.actions.includes(actionType);
    const baseChance = isPreferred ? pattern.weight : pattern.weight * 0.5;
    
    const allowed = Math.random() < baseChance;
    console.log(`🕐 ${period} (${hour}:00) - ${actionType} ${allowed ? 'allowed' : 'blocked'} (${Math.round(baseChance * 100)}% chance, preferred: ${isPreferred})`);
    
    return allowed;
  }
  
  getTimePeriod(hour) {
    if (hour >= 9 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 15) return 'midday';
    if (hour >= 15 && hour < 18) return 'afternoon';
    return 'evening';
  }
  
  testActivityPatterns() {
    console.log('\n🧪 Testing Activity Patterns Across 24 Hours:');
    console.log('==============================================');
    
    const actionTypes = ['search', 'profile_view', 'connection', 'message', 'reaction', 'comment'];
    
    for (let hour = 0; hour < 24; hour++) {
      console.log(`\nHour ${hour.toString().padStart(2, '0')}:00`);
      
      for (const actionType of actionTypes) {
        // Test multiple times to see probability
        let allowed = 0;
        const tests = 10;
        
        for (let i = 0; i < tests; i++) {
          if (this.shouldPerformAction(actionType, hour)) {
            allowed++;
          }
        }
        
        const percentage = Math.round((allowed / tests) * 100);
        console.log(`  ${actionType.padEnd(15)}: ${allowed}/${tests} (${percentage}%)`);
      }
    }
  }
}

function getHumanDelay(actionType) {
  const baseDelays = {
    'search': [5000, 12000],      // 5-12 seconds
    'profile_view': [3000, 8000], // 3-8 seconds  
    'connection': [20000, 45000], // 20-45 seconds
    'reaction': [2000, 6000],     // 2-6 seconds
    'comment': [15000, 30000],    // 15-30 seconds
    'message': [30000, 60000]     // 30-60 seconds
  };
  
  const [min, max] = baseDelays[actionType] || [3000, 10000];
  
  // Add randomness with normal distribution
  const random = Math.random() * 0.3 + 0.85; // 85-115% of base time
  const delay = min + (max - min) * Math.random() * random;
  
  return Math.floor(delay);
}

// Test Functions
async function testRateLimiter() {
  console.log('🧪 Testing Rate Limiter System');
  console.log('==============================\n');
  
  const limiter = new LinkedInRateLimiter();
  
  // Test normal usage
  console.log('Testing normal usage pattern:');
  for (let i = 0; i < 5; i++) {
    if (limiter.canPerformAction('search')) {
      limiter.recordAction('search');
    }
    
    if (limiter.canPerformAction('profile_view')) {
      limiter.recordAction('profile_view');
    }
  }
  
  limiter.getStatus();
  
  // Test burst protection
  console.log('Testing burst protection (should block after 3 actions):');
  for (let i = 0; i < 6; i++) {
    console.log(`Attempt ${i + 1}:`);
    if (limiter.canPerformAction('reaction')) {
      limiter.recordAction('reaction');
    } else {
      console.log('❌ Burst protection activated!');
    }
  }
  
  limiter.getStatus();
}

async function testActivityPatterns() {
  console.log('\n🧪 Testing Activity Pattern Manager');
  console.log('===================================\n');
  
  const patternManager = new ActivityPatternManager();
  
  // Test current time
  console.log('Testing current time:');
  const actionTypes = ['search', 'profile_view', 'connection', 'message', 'reaction', 'comment'];
  
  for (const actionType of actionTypes) {
    patternManager.shouldPerformAction(actionType);
  }
  
  // Test full 24-hour pattern
  patternManager.testActivityPatterns();
}

async function testHumanDelays() {
  console.log('\n🧪 Testing Human Delay Generation');
  console.log('=================================\n');
  
  const actionTypes = ['search', 'profile_view', 'connection', 'reaction', 'comment', 'message'];
  
  for (const actionType of actionTypes) {
    console.log(`${actionType.padEnd(15)}:`);
    
    const delays = [];
    for (let i = 0; i < 10; i++) {
      delays.push(getHumanDelay(actionType));
    }
    
    const min = Math.min(...delays);
    const max = Math.max(...delays);
    const avg = Math.round(delays.reduce((a, b) => a + b, 0) / delays.length);
    
    console.log(`  Range: ${min}ms - ${max}ms, Average: ${avg}ms`);
    console.log(`  Sample delays: ${delays.slice(0, 5).map(d => `${d}ms`).join(', ')}`);
  }
}

// Run all tests
async function runAllTests() {
  await testRateLimiter();
  await testActivityPatterns();
  await testHumanDelays();
  
  console.log('\n✅ All tests completed!');
  console.log('\nNext steps:');
  console.log('1. Review the rate limiting behavior');
  console.log('2. Adjust limits if needed');
  console.log('3. Test activity patterns match your preferences');
  console.log('4. Validate human delays feel realistic');
}

// Run the tests
runAllTests().catch(console.error);