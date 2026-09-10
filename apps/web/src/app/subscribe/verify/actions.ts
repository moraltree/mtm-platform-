"use server";
import { redirect } from "next/navigation";
import { consumeLogin } from "@/lib/subscriptions/auth";
export async function verify(form: FormData) {
  try {
    await consumeLogin(String(form.get("token") ?? ""));
  } catch {
    redirect("/subscribe?notice=invalid-link");
  }
  redirect("/subscribe");
}
