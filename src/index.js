'use strict';
/** Public engine API. No DOM access anywhere in src/. */
const core = require('./core');
const expr = require('./expr');
const question = require('./question');
const templates = require('./templates');
const practice = require('./practice');
const progress = require('./progress');
const worksheet = require('./worksheet');
const coverage = require('./coverage');
const adaptive = require('./adaptive');
const diagnostic = require('./diagnostic');
const exam = require('./exam');
const diagram = require('./diagram');
module.exports = { ENGINE_VERSION: '0.12.0', ...core, ...expr, ...question, ...templates, ...practice, ...progress, ...worksheet, ...coverage, ...adaptive, ...diagnostic, ...exam, ...diagram };
