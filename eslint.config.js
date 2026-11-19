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
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // \x2F is "/": esquery regex literals cannot contain a raw slash.
          selector:
            "JSXOpeningElement[name.name='a'] > JSXAttribute[name.name='href'] > Literal[value=/^\\x2F/]",
          message:
            "Use <Link to> for internal navigation. A raw <a href> reloads the whole page.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='a'] > JSXAttribute[name.name='href'] TemplateLiteral > TemplateElement:first-child[value.raw=/^\\x2F/]",
          message:
            "Use <Link to params search> for internal navigation. A raw <a href> reloads the whole page.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='a'] > JSXAttribute[name.name='href'] ConditionalExpression",
          message:
            "Conditional hrefs hide internal links from lint. Use <Link> with typed options.",
        },
      ],
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
      "worker-configuration.d.ts",
    ],
  },
]
