module.exports = function(api) {
  api.cache(true);
  const isWeb = process.env.EXPO_PUBLIC_PLATFORM === 'web' || process.argv.includes('--web');

  const plugins = [];
  if (isWeb) {
    plugins.push([
      'module-resolver',
      {
        alias: {
          'react-native-maps': './src/lib/MapsMock.web.tsx',
        },
      },
    ]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
