import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { OnboardingFlow } from "@/features/onboarding/components/onboarding-flow";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_ROUTE, RESULT_ROUTE } from "@/constants/routes.constants";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_ROUTE);

  // Onboarding is once-per-user; send completed users to their result.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();
  if (profile?.onboarding_completed) redirect(RESULT_ROUTE);

  return (
    <PageShell>
      <OnboardingFlow />
    </PageShell>
  );
}
