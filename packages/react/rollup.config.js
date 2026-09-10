import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import dts from "rollup-plugin-dts";

// Пакет самодостаточен: ядро imager-client бандлится внутрь (src/imager-ts),
// react остаётся external (peerDependency).
const external = ["react", "react/jsx-runtime"];

export default [
    {
        input: "src/index.tsx",
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
            resolve({ extensions: [".ts", ".tsx", ".js"] }),
            commonjs(),
        ],
    },
    {
        input: "src/index.tsx",
        external,
        output: [{ file: "dist/index.d.ts", format: "es" }],
        plugins: [dts()],
    },
];
