import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className = '', variant = 'primary', ...props },
  ref,
) {
  const base =
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-black text-white hover:bg-gray-800 focus:ring-black',
    ghost: 'bg-transparent text-black hover:bg-gray-100 focus:ring-gray-300',
  } as const;
  return <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />;
});
