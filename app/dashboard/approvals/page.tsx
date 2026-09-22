import { createClient } from "@/lib/supabase-server";
import { DataStore } from "@/lib/data-store";
import ApprovalsHub from "@/components/admin/ApprovalsHub";
import { redirect } from "next/navigation";

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profileRequests = await DataStore.getProfileChangeRequests();
  const leaveRequests = await DataStore.getLeaveRequests();
  const regularizations = await DataStore.getAttendanceRegularizations();

  return (
    <ApprovalsHub
      initialProfileRequests={profileRequests}
      initialLeaveRequests={leaveRequests}
      initialRegularizations={regularizations}
    />
  );
}
