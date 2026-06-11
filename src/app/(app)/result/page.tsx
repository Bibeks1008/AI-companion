import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { PersonaResultCard } from "@/features/persona/components/persona-result-card";
import { getPersonaResult } from "@/features/persona/queries";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_ROUTE, ONBOARDING_ROUTE, CHAT_ROUTE } from "@/constants/routes.constants";

export default async function ResultPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_ROUTE);

  const result = await getPersonaResult();
  if (!result) redirect(ONBOARDING_ROUTE);

  return (
    <PageShell>
      <PersonaResultCard result={result} />
      <div className="mt-6 text-center">
        <Button size="lg" className="w-full" asChild>
          <a href={CHAT_ROUTE}>Start talking</a>
        </Button>
      </div>
    </PageShell>
  );
}
