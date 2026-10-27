'use client'

import { ThemeProvider } from 'next-themes'
import type { ComponentProps } from 'react'

export function ProvedorTema(props: ComponentProps<typeof ThemeProvider>) {
  return <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...props} />
}
