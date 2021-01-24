/* eslint-disable */

const path = require('path');
const webpack = require('webpack');
const AssetsPlugin = require('assets-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const serverHost = process.env.HOST || 'localhost';
const serverPort = process.env.PORT || 16888;
const sourcePath = path.join(__dirname, 'src');
const outputPath = path.join(__dirname, 'dist');
const withHotReloading = process.env.HOT_RELOAD === 'true';

if (withHotReloading) {
    console.log('Hot reloading enabled. Intended only for modern browsers.');
}

module.exports = {
    resolve: {
        extensions: ['.ts', '.js'],
    },
    entry: { main: './src/index.tsx' },
    target: withHotReloading ? undefined : ['web', 'es4'],
    output: {
        path: outputPath,
        filename: 'soroban.js',
        chunkFilename: 'soroban-[name]-[chunkhash].js',
        sourceMapFilename: 'soroban-map.js',
    },
    plugins: [
        new CleanWebpackPlugin({
            cleanStaleWebpackAssets: false,
        }),
        new CopyPlugin(
            {
                patterns: [{ from: 'static' }],
            },
            { symlink: true },
        ),
        withHotReloading &&
            new ReactRefreshWebpackPlugin({
                overlay: { sockIntegration: 'wps' },
            }),
        new AssetsPlugin(),
    ].filter(Boolean),
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                include: sourcePath,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            plugins: [
                                withHotReloading &&
                                    require.resolve('react-refresh/babel'),
                            ].filter(Boolean),
                            presets: [
                                [
                                    '@babel/preset-env',
                                    {
                                        targets: { ios: 5, firefox: 3 },
                                        // useBuiltIns: 'usage',
                                        // corejs: '3.6.5',
                                    },
                                ],
                            ],
                        },
                    },
                    {
                        loader: 'ts-loader',
                    },
                ],
            },
            {
                test: /\.js$/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                [
                                    '@babel/preset-env',
                                    {
                                        targets: { ios: 5, firefox: 3 },
                                        // useBuiltIns: 'usage',
                                        // corejs: '3.6.5',
                                    },
                                ],
                            ],
                        },
                    },
                ],
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.jpg$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                        },
                    },
                ],
            },
        ],
    },
    // For webpack-dev-server
    devServer: {
        contentBase: outputPath,
        compress: true,
        historyApiFallback: true,
        host: serverHost,
        port: serverPort,
        hot: true,
    },
};
