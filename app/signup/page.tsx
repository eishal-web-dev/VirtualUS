import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect("https://www.ashesstack.cloud/signup?next=/connect");
}
