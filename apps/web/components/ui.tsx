import type { ButtonHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  return <button className={`button button-${variant} ${className}`} {...props} />;
}

export function Chip({ children }: { children: ReactNode }) {
  return <button className="chip">{children}</button>;
}

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`text-area ${className}`} {...props} />;
}

export function SectionHeader({
  title,
  action
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}
