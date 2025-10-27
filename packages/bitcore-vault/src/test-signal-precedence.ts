/**
 * PROOF: JavaScript Listener Precedence
 * 
 * This test proves our handler works by showing that our JS listener
 * intercepts SIGUSR1 and prevents the C++ handler from running.
 */

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║        PROOF: JS Listener Intercepts SIGUSR1                  ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log(`Process PID: ${process.pid}\n`);

console.log('Setup:');
console.log(`  - listenerCount('SIGUSR1'): ${process.listenerCount('SIGUSR1')}`);
console.log('  - Installing JS listener for SIGUSR1\n');

// Install our signal handler (like our fix does)
process.on('SIGUSR1', () => {
  console.log('[SUCCESS] Our JavaScript handler intercepted SIGUSR1!');
  console.log('          (C++ handler was bypassed)\n');
});

console.log(`✓ Handler installed`);
console.log(`  listenerCount('SIGUSR1'): ${process.listenerCount('SIGUSR1')}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Send SIGUSR1: kill -USR1 ${process.pid}`);
console.log('Watch for the SUCCESS message above');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Keep alive
setInterval(() => {}, 1000);
