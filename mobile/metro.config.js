const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
// Shared runtime validation lives beside the web application.
config.watchFolders = [path.resolve(__dirname, '..')];

config.resolver.alias = {
  '@shared': path.resolve(__dirname, '../lib'),
};

module.exports = config;
