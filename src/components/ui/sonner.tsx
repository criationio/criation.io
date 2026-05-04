import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ theme: themeProp, ...props }: ToasterProps) => {
  const { theme: resolvedTheme } = useTheme()
  const themeValue = themeProp ?? (resolvedTheme as 'dark' | 'light' | 'system') ?? 'system'

  return (
    <Sonner
      theme={themeValue}
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-[var(--color-bg-elevated)] group-[.toaster]:text-[var(--color-fg)] group-[.toaster]:border-[var(--color-border)] group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-[var(--color-fg-muted)]',
          actionButton:
            'group-[.toast]:bg-[var(--color-accent)] group-[.toast]:text-[var(--color-fg-on-accent)]',
          cancelButton:
            'group-[.toast]:bg-[var(--color-bg-muted)] group-[.toast]:text-[var(--color-fg-muted)]',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
