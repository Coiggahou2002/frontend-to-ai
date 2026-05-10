import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  guidesSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        'how-llms-work',
        'python-guide-for-ts-devs',
        'llm-apis-and-prompts',
        'gpu-and-model-sizing',
        'ai-infra-stack',
        'kv-cache',
        'inference-concurrency',
        'post-training',
      ],
    },
  ],
};

export default sidebars;
