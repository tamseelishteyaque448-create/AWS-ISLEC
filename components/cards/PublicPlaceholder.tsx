import Link from "next/link";

export function PublicPlaceholder({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="public-placeholder"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p><Link href="/member" className="button">Open Member Workspace</Link></section>;
}
