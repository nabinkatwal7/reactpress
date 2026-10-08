"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { loginAction } from "./actions";

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "admin@reactpress.local",
      password: "admin123",
    },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const result = await loginAction(values);
    if (result.error) setServerError(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          autoComplete="email"
          className="rounded border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-neutral-900"
          {...register("email")}
        />
        {errors.email ? (
          <span className="text-sm text-red-600">{errors.email.message}</span>
        ) : null}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          autoComplete="current-password"
          className="rounded border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-neutral-900"
          {...register("password")}
        />
        {errors.password ? (
          <span className="text-sm text-red-600">{errors.password.message}</span>
        ) : null}
      </label>
      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
