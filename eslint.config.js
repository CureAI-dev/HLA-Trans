//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  ...tanstackConfig,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "import/consistent-type-specifier-style": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  {
    // shadcn-generated code is vendored, not linted
    ignores: [
      "eslint.config.js",
      ".prettierrc",
      "src/components/ui/**",
      "src/hooks/use-highlighted-code.ts",
      "src/hooks/use-mobile.ts",
      "src/lib/highlighter.tsx",
      "src/routeTree.gen.ts",
    ],
  },
]
