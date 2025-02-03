import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
export default [
    {
        ignores: [
            "node_modules",
            "dist",
            ".angular",
            "src/zone-flags.ts",
            "increment-build.js",
            "seal-bundle.js",
            "android/app/**", // Ignore Android build folder
            "ios/App/App/public/**", // Ignore iOS assets
        ],
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: await import("@typescript-eslint/parser"),
            parserOptions: {
                project: "./tsconfig.json",
            },
        },
        plugins: {
            "@typescript-eslint": await import("@typescript-eslint/eslint-plugin"),
        },
        rules: {
            "@typescript-eslint/await-thenable": "error",
            "require-await": "off",
            "@typescript-eslint/require-await": "error",
            "@typescript-eslint/no-misused-promises": [
                "error",
                { "checksVoidReturn": false },
            ],
            "no-shadow": "off",
            "@typescript-eslint/no-shadow": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    "args": "all",
                    "argsIgnorePattern": "^_",
                    "caughtErrors": "all",
                    "caughtErrorsIgnorePattern": "^_",
                    "destructuredArrayIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "ignoreRestSiblings": true,
                },
            ],
        },
    },
];
