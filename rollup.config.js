import typescript from 'rollup-plugin-typescript2';

export default {
    input: 'src/imager-ts/Imager.ts',
    output: [
        {
            file: 'dist/Imager.js',
            format: 'umd',
            name: 'Imager',
            exports: 'named'
        },
    ],
    plugins: [typescript()],
};
