import nextra from 'nextra'

const withNextra = nextra({
  defaultShowCopyCode: true,
  unstable_shouldAddLocaleToLinks: true
})

export default withNextra({
  output: 'export',
  basePath: '/frontend-to-ai',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  reactStrictMode: true,
  i18n: {
    locales: ['en', 'zh-Hans'],
    defaultLocale: 'en'
  }
})
