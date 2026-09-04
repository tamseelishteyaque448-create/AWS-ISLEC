import { Sidebar } from "@/components/layout/Sidebar";

export function WorkspaceShell({ children, workspace = "member" }: Readonly<{ children: React.ReactNode; workspace?: "admin" | "member" }>) {
  return <div className="shell"><Sidebar workspace={workspace} /><main className="main">{children}</main></div>;
}
