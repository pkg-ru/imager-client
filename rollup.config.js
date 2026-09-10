import typescript from 'rollup-plugin-typescript2';

export default [
    {
        // Клиентская (браузерная) сборка — src/imager-ts/index.ts,
        // без token и админ-методов.
        input: 'src/imager-ts/index.ts',
        output: [
            {
                file: 'dist/imager/index.js',
                format: 'umd',
                name: 'Imager',
                exports: 'named'
            },
        ],
        plugins: [typescript({ tsconfigOverride: { compilerOptions: { declaration: false } } })],
    },
    {
        // Серверная сборка — src/imager-ts-server/index.ts (token + админ).
        input: 'src/imager-ts-server/index.ts',
        output: [
            {
                file: 'dist/imager-server/index.js',
                format: 'cjs',
                exports: 'named'
            },
        ],
        plugins: [typescript({ tsconfigOverride: { compilerOptions: { declaration: false } } })],
    },
];
