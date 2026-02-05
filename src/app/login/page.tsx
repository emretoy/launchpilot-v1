"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Giriş yapmışsa dashboard'a yönlendir
  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      if (isRegister) {
        const result = await signUpWithEmail(email, password);
        if (result.error) {
          setError(result.error);
        } else {
          setSuccessMessage("Kayıt başarılı! E-posta adresinize doğrulama linki gönderildi.");
        }
      } else {
        const result = await signInWithEmail(email, password);
        if (result.error) {
          setError(result.error);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
      </main>
    );
  }

  if (user) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <h1
            className="text-2xl font-bold tracking-tight cursor-pointer"
            onClick={() => router.push("/")}
          >
            LaunchPilot
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRegister ? "Hesap oluştur" : "Hesabınıza giriş yapın"}
          </p>
        </div>

        {/* Google ile Giriş */}
        <Button
          variant="outline"
          className="w-full h-11 gap-2"
          onClick={signInWithGoogle}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google ile {isRegister ? "Kayıt Ol" : "Giriş Yap"}
        </Button>

        {/* Ayırıcı */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">veya</span>
          </div>
        </div>

        {/* Email / Şifre Formu */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <Input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
            className="h-11"
          />
          <Input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
            minLength={6}
            className="h-11"
          />
          <Button type="submit" className="w-full h-11" disabled={submitting}>
            {submitting
              ? "Lütfen bekleyin..."
              : isRegister
                ? "Kayıt Ol"
                : "Giriş Yap"}
          </Button>
        </form>

        {/* Hata / Başarı */}
        {error && <p className="text-destructive text-sm text-center">{error}</p>}
        {successMessage && (
          <p className="text-green-600 text-sm text-center">{successMessage}</p>
        )}

        {/* Toggle */}
        <p className="text-sm text-center text-muted-foreground">
          {isRegister ? "Zaten hesabınız var mı?" : "Hesabınız yok mu?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
              setSuccessMessage(null);
            }}
            className="text-primary underline-offset-4 hover:underline font-medium"
          >
            {isRegister ? "Giriş Yap" : "Kayıt Ol"}
          </button>
        </p>
      </div>
    </main>
  );
}
