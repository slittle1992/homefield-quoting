const dayjs = require('dayjs');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'];

function format(level, source, message, data) {
  const ts = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const prefix = `[${ts}] [${level.toUpperCase()}] [${source}]`;
  if (data) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

function createLogger(source) {
  return {
    error(msg, data) {
      if (currentLevel >= LEVELS.error) console.error(format('error', source, msg, data));
    },
    warn(msg, data) {
      if (currentLevel >= LEVELS.warn) console.warn(format('warn', source, msg, data));
    },
    info(msg, data) {
      if (currentLevel >= LEVELS.info) console.log(format('info', source, msg, data));
    },
    debug(msg, data) {
      if (currentLevel >= LEVELS.debug) console.log(format('debug', source, msg, data));
    },
  };
}

module.exports = { createLogger };
