import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Frontend to AI Engineer',
  tagline: 'Practical guides for front-end developers transitioning into AI engineering',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://coiggahou2002.github.io',
  baseUrl: '/frontend-to-ai/',

  organizationName: 'Coiggahou2002',
  projectName: 'frontend-to-ai',

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'warn',
  trailingSlash: false,

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-Hans'],
    localeConfigs: {
      en: {label: 'English'},
      'zh-Hans': {label: '中文'},
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl:
            'https://github.com/Coiggahou2002/frontend-to-ai/tree/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Frontend to AI Engineer',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'guidesSidebar',
          position: 'left',
          label: 'Guides',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/Coiggahou2002/frontend-to-ai',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `CC BY-SA 4.0 · Built with Docusaurus`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['python', 'bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
