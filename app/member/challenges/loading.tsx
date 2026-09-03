import { Topline } from "@/components/ui/Topline";

export default function Loading() {
  return <>
    <Topline section="Challenges / make it real" />
    <div className="page-intro" aria-busy="true">
      <div className="eyebrow">Practical missions</div>
      <h1>Loading challenges...</h1>
    </div>
    <div className="grid" aria-hidden="true">
      {[1, 2, 3].map((item) => <div className="panel" key={item}><div className="muted">Loading challenge</div></div>)}
    </div>
  </>;
}
