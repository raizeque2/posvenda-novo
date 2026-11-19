import { cn } from "./utils.js";
export function ShinyButton({
  children,
  className,
  size = "default",
  type = "button",
  ...props
}) {
  return <button
    type={type}
    className={cn("shiny-cta", `shiny-cta-${size}`, className)}
    {...props}
  >
      <span className="shiny-cta-content">{children}</span>
    </button>;
}
