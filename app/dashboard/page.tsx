import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardStats from '@/components/DashboardStats'
import Link from 'next/link'
import { PlusCircle, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'hr'

  // Fetch stats concurrently
  const [
    { count: totalEmployees },
    { count: activeEmployees },
    { count: departmentsCount },
    { count: onNotice },
  ] = await Promise.all([
    supabase.from('employees').select('*', { count: 'exact', head: true }),
    supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('departments').select('*', { count: 'exact', head: true }),
    supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'on_notice'),
  ])

  // New Hires this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const { count: newHires } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .gte('joining_date', startOfMonth.toISOString())

  // Recent 5 employees
  const { data: recentEmployees } = await supabase
    .from('employees')
    .select('*, department:departments(*)')
    .order('created_at', { ascending: false })
    .limit(5)

  const stats = {
    totalEmployees: totalEmployees || 0,
    activeEmployees: activeEmployees || 0,
    departments: departmentsCount || 0,
    newHires: newHires || 0,
    onNotice: onNotice || 0,
    recentEmployees: recentEmployees || [],
  }

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        {role === 'hr' && (
          <Link
            href="/dashboard/employees/add"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <PlusCircle className="h-4 w-4" />
            Add New Employee
          </Link>
        )}
      </div>

      {role === 'ceo' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-indigo-100 p-3 text-indigo-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Company Overview</h2>
              <p className="text-sm text-slate-600">Welcome to Teens Software Solutions HR Portal. Here is your organizational summary.</p>
            </div>
          </div>
        </div>
      )}

      <DashboardStats stats={stats} role={role} />
    </div>
  )
}
