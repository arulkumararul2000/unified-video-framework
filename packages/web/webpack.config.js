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
      '@unified-video/core': path.resolve(__dirname, '../core/dist')
    }
  },
  // Don't externalize @unified-video/core - bundle it
  externals: [
    function(context, request, callback) {
      // Bundle @unified-video/core
      if (request.startsWith('@unified-video/core')) {
        return callback();
      }
      // Externalize these
      if (request === 'hls.js' || request === 'dashjs') {
        return callback(null, {
          commonjs: request,
          commonjs2: request,
          amd: request,
          root: request === 'hls.js' ? 'Hls' : 'dashjs'
        });
      }
      callback();
    }
  ],
  devtool: 'source-map'
};
