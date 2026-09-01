import { redirect } from "next/navigation";

export default function NewEmployeePage() {
  redirect("/dashboard/employees/add");
}