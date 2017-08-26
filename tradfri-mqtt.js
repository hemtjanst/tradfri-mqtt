#!/usr/bin/env node

process.on('SIGINT', process.exit);
process.on('SIGTERM', process.exit);

require("./lib/cli.js");