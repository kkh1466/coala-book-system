import canvaPlugin from "@canva/app-eslint-plugin";

export default [
  {
    ignores: [
      "**/node_modules/",
      "**/dist",
      "**/*.d.ts",
      "**/*.d.tsx",
      "**/*.config.*",
      // Node에서 도는 명령줄 도구다. 앱(브라우저) 규칙의 대상이 아니다.
      "scripts/",
    ],
  },
  ...canvaPlugin.configs.apps_no_i18n,
];
