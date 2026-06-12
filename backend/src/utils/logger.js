'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const { config } = require('../config/environment');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    ({ level, message, timestamp, stack }) => `${timestamp} ${level}: ${message} ${stack || ''}`
  )
);

const transports = [
  new winston.transports.Console({
    format: config.node_env === 'development' ? consoleFormat : logFormat,
  }),
];

if (config.node_env === 'production') {
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
    }),
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    })
  );
}

const logger = winston.createLogger({
  level: config.node_env === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports,
});

module.exports = logger;
