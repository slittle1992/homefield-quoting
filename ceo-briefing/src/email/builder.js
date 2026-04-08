const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const dayjs = require('dayjs');
const { createLogger } = require('../utils/logger');
const fmt = require('../utils/formatters');

const log = createLogger('email-builder');

// Register Handlebars helpers
Handlebars.registerHelper('currency', (val) => fmt.currency(val));
Handlebars.registerHelper('number', (val, dec) => fmt.number(val, typeof dec === 'number' ? dec : 0));
Handlebars.registerHelper('percent', (val) => fmt.percent(val));
Handlebars.registerHelper('date', (val) => fmt.date(val));
Handlebars.registerHelper('shortDate', (val) => fmt.shortDate(val));
Handlebars.registerHelper('time', (val) => fmt.time(val));
Handlebars.registerHelper('cashColor', (val) => fmt.cashFlowColor(val));
Handlebars.registerHelper('statusEmoji', (val) => fmt.statusEmoji(val));
Handlebars.registerHelper('statusColor', (val) => fmt.statusColor(val));

Handlebars.registerHelper('gt', (a, b) => a > b);
Handlebars.registerHelper('lt', (a, b) => a < b);
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('or', (a, b) => a || b);
Handlebars.registerHelper('and', (a, b) => a && b);
Handlebars.registerHelper('len', (arr) => (arr ? arr.length : 0));
Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
  switch (operator) {
    case '>': return v1 > v2 ? options.fn(this) : options.inverse(this);
    case '<': return v1 < v2 ? options.fn(this) : options.inverse(this);
    case '>=': return v1 >= v2 ? options.fn(this) : options.inverse(this);
    case '==': return v1 == v2 ? options.fn(this) : options.inverse(this);
    default: return options.inverse(this);
  }
});

const templateCache = {};

function loadTemplate(name) {
  if (templateCache[name]) return templateCache[name];

  const templatePath = path.join(__dirname, 'templates', `${name}.hbs`);
  const source = fs.readFileSync(templatePath, 'utf-8');
  const compiled = Handlebars.compile(source);
  templateCache[name] = compiled;
  return compiled;
}

function buildCEOEmail(data) {
  const template = loadTemplate('ceo-briefing');
  const html = template({
    ...data,
    date: dayjs().format('dddd, MMMM D, YYYY'),
    timestamp: dayjs().format('h:mm A [CST]'),
  });
  return {
    subject: `CEO Briefing — ${dayjs().format('MMM D, YYYY')}`,
    html,
  };
}

function buildTrevorEmail(data) {
  const template = loadTemplate('trevor-briefing');
  const html = template({
    ...data,
    date: dayjs().format('dddd, MMMM D, YYYY'),
  });
  return {
    subject: `Homefield Daily Plan — ${dayjs().format('MMM D')}`,
    html,
  };
}

function buildStevenEmail(data) {
  const template = loadTemplate('steven-briefing');
  const html = template({
    ...data,
    date: dayjs().format('dddd, MMMM D, YYYY'),
  });
  return {
    subject: `Pool Care Daily Route — ${dayjs().format('MMM D')}`,
    html,
  };
}

module.exports = { buildCEOEmail, buildTrevorEmail, buildStevenEmail };
