import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const surfaceVariants = cva(
  "relative overflow-hidden rounded-[var(--radius-lg)] border border-line-ghost/50 bg-surface-dawn text-text-ink transition-[box-shadow] duration-fast ease-fast",
  {
    variants: {
      elevation: {
        flat: "shadow-none",
        soft: "shadow-[var(--elevation-soft)]",
        raised: "shadow-[var(--elevation-raised)]",
      },
      padding: {
        none: "p-0",
        sm: "p-sm",
        md: "p-md",
        lg: "p-lg",
        xl: "p-xl",
      },
      interactive: {
        false: "",
        true: "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-ink/20 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-bone hover:shadow-[var(--elevation-raised)] active:scale-[0.99]",
      },
    },
    defaultVariants: {
      elevation: "soft",
      padding: "md",
      interactive: false,
    },
  },
);

type SurfaceVariants = VariantProps<typeof surfaceVariants>;

export type SurfaceElevation = NonNullable<SurfaceVariants["elevation"]>;
export type SurfacePadding = NonNullable<SurfaceVariants["padding"]>;

type SurfaceOwnProps = {
  elevation?: SurfaceElevation;
  padding?: SurfacePadding;
  interactive?: boolean;
  className?: string;
};

type AsProp<T extends React.ElementType> = {
  as?: T;
};

type PropsToOmit<T extends React.ElementType, P> = keyof (AsProp<T> & P);

export type SurfaceProps<T extends React.ElementType = "div"> = SurfaceOwnProps &
  AsProp<T> &
  Omit<React.ComponentPropsWithoutRef<T>, PropsToOmit<T, SurfaceOwnProps>>;

type SurfaceComponent = {
  <T extends React.ElementType = "div">(
    props: SurfaceProps<T> & { ref?: React.Ref<any> },
  ): React.ReactElement | null;
  displayName?: string;
};

export const Surface = React.forwardRef(
  <T extends React.ElementType = "div">(
    {
      as,
      elevation = "soft",
      padding = "md",
      interactive = false,
      className,
      ...rest
    }: SurfaceProps<T>,
    ref?: React.Ref<any>,
  ) => {
    const Component = (as ?? "div") as React.ElementType;

    return (
      <Component
        ref={ref}
        data-surface-elevation={elevation}
        data-surface-interactive={interactive ? "true" : undefined}
        className={cn(surfaceVariants({ elevation, padding, interactive }), className)}
        {...rest}
      />
    );
  },
) as SurfaceComponent;

Surface.displayName = "Surface";
