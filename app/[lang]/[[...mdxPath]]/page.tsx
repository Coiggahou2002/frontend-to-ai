import { generateStaticParamsFor, importPage } from 'nextra/pages'
import type { FC } from 'react'

export const generateStaticParams = generateStaticParamsFor('mdxPath')

type PageProps = Readonly<{
  params: Promise<{
    mdxPath: string[]
    lang: string
  }>
}>

const Page: FC<PageProps> = async props => {
  const params = await props.params
  return <div>HELLO from {params.lang} / {(params.mdxPath || []).join('/')}</div>
}

export default Page
