import typescript from 'rollup-plugin-typescript2';

// Защищённый от минификации комментарий (/*! ... */ — legal comment):
// rollup добавляет banner в начало каждого бандла ПОСЛЕ минификации,
// поэтому сборщики мусора (terser/uglify/esbuild) его не удаляют.
const banner = `/*! @license
 * imager-client — клиент микросервиса Imager
 * Репозиторий: https://gitverse.ru/pkg-ru/imager-client (зеркало: https://github.com/pkg-ru/imager-client)
 * Автор: Vladislav Altukhov (https://altuh.ru/about)
 * Демо: https://altuh.ru/demo/imager
 */`;

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
                exports: 'named',
                banner
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
                exports: 'named',
                banner
            },
        ],
        plugins: [typescript({ tsconfigOverride: { compilerOptions: { declaration: false } } })],
    },
];
