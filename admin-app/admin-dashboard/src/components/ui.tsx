import * as React from "react"
export const Button = React.forwardRef<HTMLButtonElement, any>(({ className, ...props }, ref) => (
  <button ref={ref} className={"inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 transition-colors hover:bg-slate-900/90 disabled:opacity-50 " + (className || "")} {...props} />
))
Button.displayName = "Button"

export const Card = ({ className, ...props }: any) => <div className={"rounded-xl border bg-white shadow-sm " + (className || "")} {...props} />
export const CardHeader = ({ className, ...props }: any) => <div className={"flex flex-col space-y-1.5 p-6 " + (className || "")} {...props} />
export const CardTitle = ({ className, ...props }: any) => <h3 className={"font-semibold leading-none tracking-tight " + (className || "")} {...props} />
export const CardContent = ({ className, ...props }: any) => <div className={"p-6 pt-0 " + (className || "")} {...props} />

export const Badge = ({ className, ...props }: any) => <div className={"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold " + (className || "")} {...props} />

export const Input = React.forwardRef<HTMLInputElement, any>(({ className, ...props }, ref) => (
  <input ref={ref} className={"flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 " + className} {...props} />
))
Input.displayName = "Input"
