import { Head } from 'nextra/components'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: {
    default: 'Frontend to AI Engineer',
    template: '%s — Frontend to AI Engineer'
  },
  description: 'Practical guides for front-end developers transitioning into AI engineering'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>{children}</body>
    </html>
  )
}
