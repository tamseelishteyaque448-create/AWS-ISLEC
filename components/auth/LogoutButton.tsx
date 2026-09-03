"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);
    const { error } = await createClient().auth.signOut();

    if (error) {
      setIsLoading(false);
      return;
    }

    router.replace("/join");
    router.refresh();
  }

  return <button className="logout-button" type="button" onClick={handleLogout} disabled={isLoading}>{isLoading ? "Logging out…" : "Log out"}<LogOut size={15} aria-hidden="true" /></button>;
}
