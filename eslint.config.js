import vuePlugin from "eslint-plugin-vue";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import vueParser from "vue-eslint-parser";
import tsParser from "@typescript-eslint/parser";

export default [
    {
        files: ["**/*.{js,ts,jsx,tsx,vue}"],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                parser: tsParser,
                ecmaVersion: "latest",
                sourceType: "module",
            },
        },
        plugins: {
            vue: vuePlugin,
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            // Vue
            "vue/multi-word-component-names": "off",

            // TS
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/explicit-function-return-type": "off",
        },
    },
];
