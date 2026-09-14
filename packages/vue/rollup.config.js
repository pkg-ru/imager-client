import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import dts from "rollup-plugin-dts";

// Защищённый от минификации комментарий (/*! ... */ — legal comment):
// rollup добавляет banner в начало каждого бандла ПОСЛЕ минификации,
// поэтому сборщики мусора (terser/uglify/esbuild) его не удаляют.
const banner = `/*! @license
 * @pkg-ru/imager-vue — Vue 3-компоненты для микросервиса Imager
 * Репозиторий: https://gitverse.ru/pkg-ru/imager-client (зеркало: https://github.com/pkg-ru/imager-client)
 * Автор: Vladislav Altukhov (https://altuh.ru/about)
 * Демо: https://altuh.ru/demo/imager
 */`;

// Пакет самодостаточен: ядро imager-client бандлится внутрь (src/imager-ts),
// vue остаётся external (peerDependency).
const external = ["vue"];

export default [
    {
        input: "src/index.ts",
        external,
        output: [
            { file: "dist/index.js", format: "es", banner },
            { file: "dist/index.cjs", format: "cjs", exports: "named", banner },
        ],
        plugins: [
            typescript({
                tsconfig: "tsconfig.build.json",
                compilerOptions: {
                    declaration: false,
                },
            }),
            resolve({ extensions: [".ts", ".js"] }),
            commonjs(),
        ],
    },
    {
        input: "src/index.ts",
        external,
        output: [{ file: "dist/index.d.ts", format: "es" }],
        plugins: [dts()],
    },
];
