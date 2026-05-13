import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { getPageMap } from 'nextra/page-map'
import HtmlLangSetter from './html-lang-setter'

export default async function LangLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const pageMap = await getPageMap(`/${lang}`)

  const navbar = (
    <Navbar
      logo={<b>Frontend to AI Engineer</b>}
      projectLink="https://github.com/Coiggahou2002/frontend-to-ai"
    />
  )

  const footer = <Footer>CC BY-SA 4.0 · Built with Nextra.</Footer>

  return (
    <>
      <HtmlLangSetter lang={lang} />
      <Layout
        navbar={navbar}
        pageMap={pageMap}
        docsRepositoryBase={`https://github.com/Coiggahou2002/frontend-to-ai/tree/main/content/${lang}`}
        footer={footer}
        i18n={[
          { locale: 'en', name: 'English' },
          { locale: 'zh-Hans', name: '简体中文' }
        ]}
      >
        {children}
      </Layout>
    </>
  )
}
