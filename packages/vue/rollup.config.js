import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import dts from "rollup-plugin-dts";

// Пакет самодостаточен: ядро imager-client бандлится внутрь (src/imager-ts),
// vue остаётся external (peerDependency).
const external = ["vue"];

export default [
    {
        input: "src/index.ts",
        external,
        output: [
            { file: "dist/index.js", format: "es" },
            { file: "dist/index.cjs", format: "cjs", exports: "named" },
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
