const { createLogger } = require('./logger');
const log = createLogger('retry');

async function withRetry(fn, { retries = 3, baseDelay = 1000, label = 'operation' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        log.warn(`${label} failed (attempt ${attempt}/${retries}), retrying in ${delay}ms...`, {
          error: err.message,
        });
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  log.error(`${label} failed after ${retries} attempts`, { error: lastError.message });
  throw lastError;
}

module.exports = { withRetry };
