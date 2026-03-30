const cron = require('node-cron');
const { scrapePermits, processPermitResults, getRegisteredCounties } = require('./permitScraper');

/**
 * Run a full permit scrape cycle for all enabled counties.
 */
async function runPermitScrapeCycle() {
  const countiesEnv = process.env.PERMIT_COUNTIES || '';
  const enabledCounties = countiesEnv
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  if (enabledCounties.length === 0) {
    console.log('Permit worker: no counties configured (set PERMIT_COUNTIES)');
    return;
  }

  console.log(`Permit worker: scraping ${enabledCounties.length} county(ies): ${enabledCounties.join(', ')}`);

  for (const county of enabledCounties) {
    try {
      console.log(`Permit worker: scraping ${county}...`);
      const permits = await scrapePermits(county);
      console.log(`Permit worker: found ${permits.length} permit(s) for ${county}`);

      if (permits.length > 0) {
        const results = await processPermitResults(county, permits);
        console.log(
          `Permit worker: ${county} results — ` +
          `new: ${results.new_count}, duplicates: ${results.duplicate_count}, ` +
          `total processed: ${results.total_processed}`
        );
      }
    } catch (err) {
      console.error(`Permit worker: error scraping ${county}:`, err.message);
    }
  }

  console.log('Permit worker: scrape cycle complete');
}

/**
 * Scrape a single county on demand.
 */
async function scrapeCounty(county) {
  console.log(`Permit worker: manual scrape for ${county}`);
  const permits = await scrapePermits(county);
  const results = await processPermitResults(county, permits);
  console.log(
    `Permit worker: ${county} manual scrape — ` +
    `new: ${results.new_count}, duplicates: ${results.duplicate_count}, ` +
    `total processed: ${results.total_processed}`
  );
  return results;
}

/**
 * Start the permit scraper cron job.
 */
function startPermitWorker() {
  const cronExpression = process.env.PERMIT_SCRAPE_CRON || '0 6 * * *';

  if (!cron.validate(cronExpression)) {
    console.error(`Permit worker: invalid cron expression "${cronExpression}", using default`);
    return startWithCron('0 6 * * *');
  }

  return startWithCron(cronExpression);
}

function startWithCron(cronExpression) {
  console.log(`Permit worker: scheduling cron job with expression "${cronExpression}"`);

  const task = cron.schedule(cronExpression, async () => {
    console.log(`Permit worker: running scrape cycle at ${new Date().toISOString()}`);
    await runPermitScrapeCycle();
  });

  // Run once on startup after a short delay
  setTimeout(() => {
    console.log('Permit worker: running initial scrape cycle');
    runPermitScrapeCycle();
  }, 10000);

  return task;
}

module.exports = {
  startPermitWorker,
  runPermitScrapeCycle,
  scrapeCounty,
};
