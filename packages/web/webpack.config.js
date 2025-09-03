const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'unified-video-web.js',
    library: {
      name: 'UnifiedVideoWeb',
      type: 'umd'
    },
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@unified-video/core': path.resolve(__dirname, '../core/src')
    }
  },
  externals: {
    'hls.js': {
      commonjs: 'hls.js',
      commonjs2: 'hls.js',
      amd: 'hls.js',
      root: 'Hls'
    },
    'dashjs': {
      commonjs: 'dashjs',
      commonjs2: 'dashjs',
      amd: 'dashjs',
      root: 'dashjs'
    }
  },
  devtool: 'source-map'
};
