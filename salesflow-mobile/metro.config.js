// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// When building via a junction/symlink (d:\s -> real path), Metro needs
// to watch the real project root so it can compute SHA-1 for all files.
const realProjectRoot = path.resolve(__dirname);

config.watchFolders = [
  realProjectRoot,
  path.join(realProjectRoot, 'node_modules'),
];

// Ensure Metro uses the real project root, not a symlinked one
config.projectRoot = realProjectRoot;

// Map Mock for Web
const isWeb = process.env.EXPO_PUBLIC_PLATFORM === 'web' || process.argv.includes('--web');
if (isWeb) {
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native-maps': path.resolve(__dirname, 'src/lib/MapsMock.web.tsx'),
  };
}

module.exports = config;
