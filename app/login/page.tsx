import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("https://www.ashesstack.cloud/login?next=/connect");
}
