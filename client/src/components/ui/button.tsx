import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent text-base font-semibold whitespace-nowrap select-none outline-none transition-[transform,box-shadow,background-color,color,border-color] duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-[3px] focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:active:scale-100 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-soft hover:bg-amber-400 hover:shadow-glow",
        outline:
          "border-input bg-card/70 text-foreground shadow-soft hover:bg-card hover:shadow-lift",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)]",
        ghost: "text-foreground hover:translate-y-0 hover:bg-accent",
        destructive: "bg-destructive text-background hover:opacity-90",
        link: "text-link underline decoration-2 underline-offset-4 hover:translate-y-0 hover:decoration-[3px]",
      },
      size: {
        default: "h-12 px-6",
        xs: "h-8 rounded-lg px-3 text-sm",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 px-8 text-lg",
        icon: "size-11 rounded-xl",
        "icon-sm": "size-10 rounded-lg",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
