import { Topline } from "@/components/ui/Topline";

export default function Loading() {
  return <><Topline section="Everything you have done" /><div className="panel"><p className="muted">Loading your activity...</p></div></>;
}