// import { createClient } from "@/lib/supabase-server";
// import { DataStore } from "@/lib/data-store";
// import RewardsRecognition from "@/components/portal/RewardsRecognition";
// import { redirect } from "next/navigation";

// export default async function RewardsPage() {
//   const supabase = await createClient();

//   const {
//     data: { user },
//   } = await supabase.auth.getUser();

//   if (!user) {
//     redirect("/login");
//   }

//   let employee =
//     await DataStore.getEmployeeByUserId(user.id);

//   if (!employee) {
//     const allEmployees =
//       await DataStore.getEmployees();

//     employee =
//       allEmployees.find(
//         (item) => item.email === user.email
//       ) || allEmployees[0];
//   }

//   if (!employee) {
//     return (
//       <div className="min-h-screen bg-slate-50 flex items-center justify-center">
//         <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
//           <h2 className="text-lg font-semibold text-slate-800">
//             Employee record not found
//           </h2>

//           <p className="mt-2 text-sm text-slate-500">
//             Your employee profile could not be loaded.
//           </p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <RewardsRecognition
//       employee={employee}
//     />
//   );
// }