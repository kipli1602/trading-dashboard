// Local cron runner: runs local cron + syncs result to Vercel
const fetch = (url, opts) => globalThis.fetch(url, opts);

const LOCAL_API = 'http://localhost:3000/api/bot';
const VERCEL_API = 'https://trading-dashboard-kipli.vercel.app/api/bot';

async function runLocalCron() {
  console.log(`[${new Date().toISOString()}] Running local cron...`);
  
  try {
    // Run cron on local server (has HK VPN access to KuCoin)
    const cronRes = await fetch(`${LOCAL_API}?action=cron`, { timeout: 60000 });
    const cronData = await cronRes.json();
    
    if (!cronData.success) {
      console.error('Local cron failed:', cronData.error || 'unknown');
      return;
    }
    
    // Extract key data
    const portfolio = cronData.portfolio;
    const balance = cronData.balance;
    const openPositions = cronData.openPositions || [];
    
    console.log(`[${new Date().toISOString()}] Local cron done!`);
    console.log(`  Balance: $${Number(balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    console.log(`  Portfolio: $${Number(portfolio?.totalValue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    console.log(`  Positions: ${openPositions.length}`);
    console.log(`  Signals: ${cronData.cycle?.signals?.length || 0}`);
    
    // Sync ke Vercel agar browser tampilkan data real
    if (portfolio || balance !== undefined) {
      try {
        await fetch(`${VERCEL_API}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync-portfolio',
            portfolio,
            openPositions,
            balance,
          }),
          timeout: 30000,
        });
        console.log(`[${new Date().toISOString()}] Synced to Vercel!`);
      } catch (syncErr) {
        console.error('Sync to Vercel failed:', syncErr.message);
      }
    }
    
  } catch (err) {
    console.error('Cron error:', err.message);
  }
}

// Run now, then schedule
(async () => {
  await runLocalCron();
  // Next run scheduled by Task Scheduler
})();
