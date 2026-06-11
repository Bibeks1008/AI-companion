import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { LoginForm } from "@/features/auth/components/login-form";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_ROUTE } from "@/constants/routes.constants";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(ONBOARDING_ROUTE);
  }

  return (
    <PageShell>
      <LoginForm />
    </PageShell>
  );
}
