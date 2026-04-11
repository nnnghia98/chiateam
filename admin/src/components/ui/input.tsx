import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-airbnb border border-[#c1c1c1] bg-white px-3 py-2 text-sm text-[#222222] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#6a6a6a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff385c] focus-visible:ring-offset-0 focus-visible:border-[#222222] disabled:cursor-not-allowed disabled:opacity-50 transition-all',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
