"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { AUTH_CALLBACK_ROUTE } from "@/constants/routes.constants";

interface LoginFormValues {
  email: string;
}

export function LoginForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ defaultValues: { email: "" } });

  async function onSubmit({ email }: LoginFormValues) {
    setSubmitError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${AUTH_CALLBACK_ROUTE}`,
      },
    });

    if (error) {
      setSubmitError(
        "We couldn't send your link just now. Please try again in a moment.",
      );
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Mail className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Check your inbox
        </h1>
        <p className="mt-2 text-balance text-muted-foreground">
          We sent a magic sign-in link to{" "}
          <span className="font-medium text-foreground">{sentTo}</span>. Tap it
          to continue — you can close this tab.
        </p>
        <Button
          variant="ghost"
          className="mt-6"
          onClick={() => setSentTo(null)}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
        <p className="mt-2 text-balance text-muted-foreground">
          Enter your email and we&apos;ll send you a magic link to sign in.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            {...register("email", {
              required: "Please enter your email.",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Please enter a valid email address.",
              },
            })}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        {submitError && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <p>{submitError}</p>
            <button
              type="button"
              className="mt-1 font-medium underline underline-offset-2"
              onClick={() => onSubmit({ email: getValues("email") })}
            >
              Try again
            </button>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Sending link…" : "Send magic link"}
        </Button>
      </form>
    </div>
  );
}
