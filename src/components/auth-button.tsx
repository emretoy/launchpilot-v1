"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function AuthButton() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dışarı tıklayınca menüyü kapat
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />;
  }

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={() => router.push("/login")}>
        Giriş Yap
      </Button>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Kullanıcı";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 rounded-full border px-3 py-1.5 hover:bg-muted transition-colors"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-6 h-6 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm font-medium hidden sm:inline">{displayName}</span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-background shadow-lg py-1 z-50">
          <button
            onClick={() => {
              setMenuOpen(false);
              router.push("/dashboard");
            }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Dashboard
          </button>
          <hr className="my-1 border-border" />
          <button
            onClick={async () => {
              setMenuOpen(false);
              await signOut();
              router.push("/");
            }}
            className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-muted transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      )}
    </div>
  );
}
