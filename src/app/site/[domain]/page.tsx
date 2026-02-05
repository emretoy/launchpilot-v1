"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function SiteDomainIndex() {
  const router = useRouter();
  const params = useParams();
  const domain = params?.domain as string;

  useEffect(() => {
    router.replace(`/site/${domain}/overview`);
  }, [router, domain]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-pulse text-muted-foreground">Yönlendiriliyor...</div>
    </div>
  );
}
