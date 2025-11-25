import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Optional ID for label association. If not provided, one will be generated.
   */
  id?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || `input-${generatedId}`;

    return (
      <input
        id={inputId}
        type={type}
        className={cn(
          "flex h-10 w-full border-b border-line-ghost bg-transparent px-3 py-2 text-sm ring-offset-canvas-bone file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-inkSubtle focus-visible:border-text-ink focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
