import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  LOGIN_ROUTE,
  ONBOARDING_ROUTE,
  RESULT_ROUTE,
} from "@/constants/routes.constants";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_ROUTE);

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  redirect(profile?.onboarding_completed ? RESULT_ROUTE : ONBOARDING_ROUTE);
}
