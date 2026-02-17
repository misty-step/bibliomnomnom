import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-sm whitespace-nowrap rounded-[var(--radius-md)] font-medium text-sm transition-all duration-fast ease-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-bone disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-text-ink text-canvas-bone hover:bg-text-inkMuted",
        secondary:
          "bg-canvas-boneMuted text-text-ink hover:bg-canvas-bone border border-line-ghost",
        ghost: "bg-transparent text-text-ink hover:bg-canvas-boneMuted",
        destructive: "bg-accent-ember text-white hover:bg-accent-ember/90",
      },
      size: {
        sm: "px-sm py-2xs text-xs",
        md: "px-8 py-3",
        lg: "px-lg py-md text-base",
        icon: "h-9 w-9",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, asChild = false, ...props }, ref) => {
    const Comp = (asChild ? Slot : "button") as React.ElementType;
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        ref={ref}
        {...(!asChild && props.type === undefined ? { type: "button" } : {})}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
